from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json

from ..models.schemas import ChatRequest, ChatResponse, ChatMessageResponse, ResponseVariant
from ..utils.embeddings import HybridRAGProcessor
from ..utils.llm_router import get_llm_client
from ..utils.ollama_client import LLMRequestContext, LocalModeLock, acquire_llm_lock, release_llm_lock
from ..utils.hierarchical_processor import hierarchical_summarization
from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, DocumentChunk, ChatMessage, Document
from ..database import SessionLocal

router = APIRouter()


def _get_latest_assistant_id(db: Session, conversation_id: int) -> int | None:
    last_assistant = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.role == "assistant",
        )
        .order_by(ChatMessage.id.desc())
        .first()
    )
    return last_assistant.id if last_assistant else None


def _validate_parent_message_id(
    db: Session,
    conversation_id: int,
    parent_message_id: int,
) -> int:
    parent = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.id == parent_message_id,
            ChatMessage.conversation_id == conversation_id,
        )
        .first()
    )
    if not parent:
        raise HTTPException(status_code=400, detail="Invalid parent_message_id")
    if parent.role != "assistant":
        raise HTTPException(status_code=400, detail="parent_message_id must refer to an assistant message")
    return parent.id


def _build_branch_chat_history(
    db: Session,
    conversation_id: int,
    tail_assistant_id: int | None,
    max_messages: int,
) -> list[dict]:
    """Build chat history by following reply_to_message_id chain backwards from an assistant.

    This is the ONLY safe way to build history when conversations can branch.
    """
    if tail_assistant_id is None:
        return []

    history_msgs: list[ChatMessage] = []
    current_id: int | None = tail_assistant_id
    visited: set[int] = set()

    while current_id is not None and current_id not in visited:
        visited.add(current_id)
        msg = db.get(ChatMessage, current_id)
        if not msg or msg.conversation_id != conversation_id:
            break
        history_msgs.append(msg)
        current_id = msg.reply_to_message_id

        if len(history_msgs) >= max_messages:
            break

    history_msgs.reverse()
    return [{"role": m.role, "content": m.content} for m in history_msgs]

@router.post("/chat", response_model=ChatResponse)
async def chat(
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == chat_request.conversation_id, Conversation.user_id == current_user.id)
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get active document IDs
    active_docs = (
        db.query(Document)
        .filter(Document.conversation_id == conversation.id, Document.is_active == True)
        .all()
    )
    active_doc_ids = [doc.id for doc in active_docs]
    active_doc_names = [doc.filename for doc in active_docs]

    # Get all document names for context
    all_docs = (
        db.query(Document)
        .filter(Document.conversation_id == conversation.id)
        .all()
    )
    all_doc_names = [doc.filename for doc in all_docs]
    inactive_doc_names = [doc.filename for doc in all_docs if doc.id not in active_doc_ids]

    # Load only chunks from active documents
    chunks = (
        db.query(DocumentChunk)
        .filter(
            DocumentChunk.conversation_id == conversation.id,
            DocumentChunk.document_id.in_(active_doc_ids) if active_doc_ids else True
        )
        .all()
    )

    # Build context about which documents are active/inactive
    doc_context_info = ""
    if inactive_doc_names:
        doc_context_info = f"\n\nNOTE: The user has disabled the following documents for this query: {', '.join(inactive_doc_names)}. If the user's question relates to disabled documents, inform them that the answer is based only on the active documents ({', '.join(active_doc_names) if active_doc_names else 'none'}) and conversation history."

    if not chunks:
        # No chunks available, but we can still use chat history
        chunk_dicts = []
    else:
        chunk_dicts = [
            {
                "content": chunk.content,
                "metadata_json": chunk.metadata_json,
                "chunk_index": chunk.chunk_index
            }
            for chunk in chunks
        ]

    # Determine the parent message to chain from BEFORE building chat history.
    # To prevent cross-branch corruption, require an explicit parent for follow-ups.
    has_any_assistant = (
        db.query(ChatMessage.id)
        .filter(ChatMessage.conversation_id == conversation.id, ChatMessage.role == "assistant")
        .first()
        is not None
    )

    if chat_request.parent_message_id is not None:
        parent_reply_to = _validate_parent_message_id(db, conversation.id, chat_request.parent_message_id)
    else:
        if has_any_assistant and (not chat_request.is_edit) and (not chat_request.regenerate):
            raise HTTPException(
                status_code=400,
                detail="parent_message_id is required for follow-up messages to preserve branching",
            )
        parent_reply_to = _get_latest_assistant_id(db, conversation.id)

    # Determine edit_group_id/version_index, and for edits force the same parent as the original.
    if chat_request.is_edit and chat_request.edit_group_id is not None:
        original_message = (
            db.query(ChatMessage)
            .filter(
                ChatMessage.id == chat_request.edit_group_id,
                ChatMessage.conversation_id == conversation.id,
                ChatMessage.role == "user",
            )
            .first()
        )
        if not original_message:
            edit_group_id = None
            version_index = 1
        else:
            edit_group_id = original_message.edit_group_id or original_message.id
            existing_versions = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.conversation_id == conversation.id,
                    ChatMessage.edit_group_id == edit_group_id,
                    ChatMessage.role == "user",
                )
                .count()
            )
            version_index = existing_versions + 1
            parent_reply_to = original_message.reply_to_message_id
    else:
        edit_group_id = None
        version_index = 1

    # Load chat history ONLY from the active branch.
    # Do not include sibling branches in context.
    max_history = 10 if conversation.llm_mode == "local" else 50
    chat_history = _build_branch_chat_history(db, conversation.id, parent_reply_to, max_history)

    # Initialize Hybrid RAG Processor with Qdrant
    conv_embedding_model_sync = getattr(conversation, 'embedding_model', 'custom')
    hybrid_rag = HybridRAGProcessor(conversation_id=conversation.id, embedding_model_name=conv_embedding_model_sync)
    hybrid_rag.load_documents(chunks=chunk_dicts, document_ids=active_doc_ids if active_doc_ids else None)
    hybrid_rag.load_chat_history(chat_history)

    llm_client = get_llm_client(conversation.llm_mode, chat_request.cloud_model)

    is_summary_request = any(word in chat_request.message.lower() for word in [
        'summarize', 'summary', 'summarise', 'sumary', 'brief',
        'overview', 'gist', 'main points', 'key points', 'highlights'
    ])

    is_local = (conversation.llm_mode or "api") == "local"
    is_gemini = (conversation.llm_mode == "api" and chat_request.cloud_model == "gemini")
    
    if is_summary_request:
        all_chunks = []
        if active_doc_ids:
            for doc_id in active_doc_ids:
                doc_chunks = db.query(DocumentChunk).filter(
                    DocumentChunk.conversation_id == conversation.id,
                    DocumentChunk.document_id == doc_id
                ).order_by(DocumentChunk.chunk_index).all()
                all_chunks.extend([{"content": chunk.content, "metadata": {"source": chunk.document.filename if chunk.document else "Unknown"}} for chunk in doc_chunks])
        else:
            doc_chunks = db.query(DocumentChunk).filter(
                DocumentChunk.conversation_id == conversation.id
            ).order_by(DocumentChunk.document_id, DocumentChunk.chunk_index).all()
            all_chunks = [{"content": chunk.content, "metadata": {"source": chunk.document.filename if chunk.document else "Unknown"}} for chunk in doc_chunks]
        
        if not all_chunks:
            raise HTTPException(status_code=400, detail="No documents found for summarization")
        
        try:
            if is_local:
                async with LLMRequestContext(conversation.id):
                    summary_text = await hierarchical_summarization(
                        all_chunks, llm_client, 30, is_local=True
                    )
            else:
                async with LLMRequestContext(conversation.id):
                    summary_text = await hierarchical_summarization(
                        all_chunks, llm_client, 30, is_local=False
                    )
            
            result = {"response": summary_text, "sources": [], "source_chunks": []}
        except TimeoutError:
            raise HTTPException(status_code=503, detail="Service is busy. Please try again.")
        except ValueError as exc:
            raise HTTPException(status_code=500, detail=str(exc))
    else:
        print(f"[Chat] Query: '{chat_request.message[:100]}...'")
        print(f"[Chat] Building hybrid context (doc_k=10, chat_k=3)...")
        context_result = hybrid_rag.build_context(
            query=chat_request.message,
            chat_history=chat_history,
            doc_k=10,
            chat_k=3,
            recent_messages=8
        )

        formatted_context_docs = [
            {"page_content": doc["content"], "metadata": doc["metadata"]}
            for doc in context_result["document_chunks"]
        ]
        print(f"[Chat] Found {len(formatted_context_docs)} document chunks")

        recent_context = context_result.get("recent_context", [])
        combined_context = context_result.get("combined_context", "") + doc_context_info
        
        import time
        start_time = time.time()
        print(f"[Chat] Starting generation...")
        try:
            if is_local:
                async with LLMRequestContext(conversation.id):
                    result = await llm_client.generate_response(
                        chat_request.message,
                        formatted_context_docs,
                        recent_context,
                        combined_context
                    )
            else:
                async with LLMRequestContext(conversation.id):
                    result = await llm_client.generate_response(
                        chat_request.message,
                        formatted_context_docs,
                        recent_context,
                        combined_context
                    )
            elapsed = time.time() - start_time
            print(f"[Chat] Completed in {elapsed:.2f}s")
        except TimeoutError:
            raise HTTPException(status_code=503, detail="Ollama is busy. Please try again.")
        except ValueError as exc:
            raise HTTPException(status_code=500, detail=str(exc))

    user_message = ChatMessage(
        conversation_id=conversation.id,
        role="user",
        content=chat_request.message,
        reply_to_message_id=parent_reply_to,
        edit_group_id=edit_group_id,
        version_index=version_index,
        is_edited=1 if (chat_request.is_edit and edit_group_id is not None and version_index > 1) else 0,
    )
    db.add(user_message)
    db.flush()
    
    # For new messages, set edit_group_id to its own ID
    if edit_group_id is None:
        user_message.edit_group_id = user_message.id

    assistant_message = ChatMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=result["response"],
        sources_json="||".join(result["sources"]) if result["sources"] else None,
        source_chunks_json=json.dumps(result.get("source_chunks", [])) if result.get("source_chunks") else None,
        prompt_snapshot=chat_request.message,
        reply_to_message_id=user_message.id,
        version_index=1,
        is_archived=False
    )

    db.add(assistant_message)
    conversation.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)

    response_variant = ResponseVariant(
        id=assistant_message.id,
        version_index=assistant_message.version_index,
        content=assistant_message.content,
        sources=result["sources"],
        source_chunks=result.get("source_chunks", []),
        is_active=True,
        created_at=assistant_message.created_at,
        prompt_content=chat_request.message
    )

    user_message_payload = ChatMessageResponse(
        id=user_message.id,
        role=user_message.role,
        content=user_message.content,
        sources=[],
        created_at=user_message.created_at,
        is_edited=user_message.is_edited,
        reply_to_message_id=user_message.reply_to_message_id,
        version_index=user_message.version_index,
        is_archived=user_message.is_archived,
        response_versions=[response_variant]
    )

    assistant_message_payload = ChatMessageResponse(
        id=assistant_message.id,
        role=assistant_message.role,
        content=assistant_message.content,
        sources=result["sources"],
        source_chunks=result.get("source_chunks", []),
        created_at=assistant_message.created_at,
        is_edited=assistant_message.is_edited,
        reply_to_message_id=assistant_message.reply_to_message_id,
        version_index=assistant_message.version_index,
        is_archived=assistant_message.is_archived
    )

    return ChatResponse(
        response=result["response"],
        sources=result["sources"],
        source_chunks=result.get("source_chunks", []),
        user_message=user_message_payload,
        assistant_message=assistant_message_payload,
        response_versions=[response_variant]
    )


@router.post("/chat/stream")
async def chat_stream(
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Streaming chat endpoint for word-by-word responses."""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == chat_request.conversation_id, Conversation.user_id == current_user.id)
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get active document IDs
    active_docs = (
        db.query(Document)
        .filter(Document.conversation_id == conversation.id, Document.is_active == True)
        .all()
    )
    active_doc_ids = [doc.id for doc in active_docs]
    active_doc_names = [doc.filename for doc in active_docs]

    # Get all document names for context
    all_docs = (
        db.query(Document)
        .filter(Document.conversation_id == conversation.id)
        .all()
    )
    inactive_doc_names = [doc.filename for doc in all_docs if doc.id not in active_doc_ids]

    # Load only chunks from active documents
    chunks = (
        db.query(DocumentChunk)
        .filter(
            DocumentChunk.conversation_id == conversation.id,
            DocumentChunk.document_id.in_(active_doc_ids) if active_doc_ids else True
        )
        .all()
    )

    # Build context about which documents are active/inactive
    doc_context_info = ""
    if inactive_doc_names:
        doc_context_info = f"\n\nNOTE: The user has disabled the following documents: {', '.join(inactive_doc_names)}."

    chunk_dicts = [
        {
            "content": chunk.content,
            "metadata_json": chunk.metadata_json,
            "chunk_index": chunk.chunk_index
        }
        for chunk in chunks
    ] if chunks else []


    # Build chat history from the active branch only.
    max_history = 10 if conversation.llm_mode == "local" else 50

    # Build context - reduce for local mode
    if conversation.llm_mode == "local":
        doc_k, chat_k, recent_msgs = 10, 2, 4  # Increased from 5 to 10 for local
    else:
        doc_k, chat_k, recent_msgs = 10, 3, 8  # Increased from 8 to 10 for cloud

    # Capture conversation ID before session closes
    conv_id = conversation.id
    
    # Only save user message if not regenerating
    user_message_id = None
    edit_group_id = None
    parent_reply_to = None

    # Determine the parent/tail BEFORE building any context.
    if chat_request.regenerate:
        # Existing behavior: regenerate the latest user turn by default.
        # If the client provides an explicit parent_message_id, prefer it.
        last_user_msg = (
            db.query(ChatMessage)
            .filter(ChatMessage.conversation_id == conv_id, ChatMessage.role == "user")
            .order_by(ChatMessage.id.desc())
            .first()
        )
        if last_user_msg:
            user_message_id = last_user_msg.id
            parent_reply_to = last_user_msg.reply_to_message_id

        if chat_request.parent_message_id is not None:
            parent_reply_to = _validate_parent_message_id(db, conv_id, chat_request.parent_message_id)
    else:
        # Determine the parent message to chain from.
        # Priority: explicit parent_message_id (validated) > latest assistant in this conversation.
        has_any_assistant = (
            db.query(ChatMessage.id)
            .filter(ChatMessage.conversation_id == conv_id, ChatMessage.role == "assistant")
            .first()
            is not None
        )

        if chat_request.parent_message_id is not None:
            parent_reply_to = _validate_parent_message_id(db, conv_id, chat_request.parent_message_id)
        else:
            if has_any_assistant and (not chat_request.is_edit):
                raise HTTPException(
                    status_code=400,
                    detail="parent_message_id is required for follow-up messages to preserve branching",
                )
            parent_reply_to = _get_latest_assistant_id(db, conv_id)

    chat_history = _build_branch_chat_history(db, conv_id, parent_reply_to, max_history)

    # Initialize RAG processor with Qdrant
    conv_embedding_model = getattr(conversation, 'embedding_model', 'custom')
    hybrid_rag = HybridRAGProcessor(conversation_id=conv_id, embedding_model_name=conv_embedding_model)
    hybrid_rag.load_documents(chunks=chunk_dicts, document_ids=active_doc_ids if active_doc_ids else None)
    hybrid_rag.load_chat_history(chat_history)

    context_result = hybrid_rag.build_context(
        query=chat_request.message,
        chat_history=chat_history,
        doc_k=doc_k,
        chat_k=chat_k,
        recent_messages=recent_msgs
    )

    formatted_context_docs = [
        {
            "page_content": doc["content"],
            "metadata": doc["metadata"]
        }
        for doc in context_result["document_chunks"]
    ]

    recent_context = context_result.get("recent_context", [])
    combined_context = context_result.get("combined_context", "") + doc_context_info

    sources = list(set(
        doc["metadata"].get("source", "Unknown")
        for doc in context_result["document_chunks"]
    ))
    source_chunks = []
    for i, doc in enumerate(context_result["document_chunks"]):
        source = doc["metadata"].get("source", "Unknown")
        source_chunks.append({
            "index": i + 1,
            "source": source,
            "chunk": doc["content"][:800]
        })

    llm_client = get_llm_client(conversation.llm_mode, chat_request.cloud_model)
    is_local = (conversation.llm_mode or "api") == "local"
    
    if not chat_request.regenerate:
        # Determine edit_group_id and version_index
        if chat_request.is_edit and chat_request.edit_group_id is not None:
            # This is an edit - create new version in the edit group
            # DO NOT archive the old version - keep all branches active
            original_message = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.id == chat_request.edit_group_id,
                    ChatMessage.conversation_id == conv_id,
                    ChatMessage.role == "user",
                )
                .first()
            )
            if not original_message:
                edit_group_id = None
                version_index = 1
            else:
                edit_group_id = original_message.edit_group_id or original_message.id
            
            # Count existing versions in this group
            existing_versions = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.conversation_id == conv_id,
                    ChatMessage.edit_group_id == edit_group_id,
                    ChatMessage.role == "user"
                )
                .count()
            )
            version_index = existing_versions + 1
            
            # For edits, the parent should be the same as the original message's parent
            parent_reply_to = original_message.reply_to_message_id
        else:
            # New message - will set edit_group_id to its own ID after creation
            edit_group_id = None
            version_index = 1
        
        user_message = ChatMessage(
            conversation_id=conv_id,
            role="user",
            content=chat_request.message,
            edit_group_id=edit_group_id,
            version_index=version_index,
            reply_to_message_id=parent_reply_to,
            is_edited=1 if (chat_request.is_edit and edit_group_id is not None and version_index > 1) else 0,
        )
        db.add(user_message)
        db.flush()
        user_message_id = user_message.id
        
        # For new messages, set edit_group_id to its own ID
        if edit_group_id is None:
            user_message.edit_group_id = user_message.id
            edit_group_id = user_message.id
        
        db.commit()

    async def generate_stream():
        full_response = ""
        error_occurred = False
        
        # Send initial metadata
        yield f"data: {json.dumps({'type': 'meta', 'sources': sources, 'source_chunks': source_chunks, 'user_message_id': user_message_id, 'edit_group_id': edit_group_id})}\n\n"
        
        # Acquire LLM lock for this conversation
        lock_acquired = await acquire_llm_lock(conv_id, timeout=300.0)
        
        if not lock_acquired:
            # Save error assistant message to prevent orphaned user message
            err_session = SessionLocal()
            try:
                err_msg = ChatMessage(
                    conversation_id=conv_id,
                    role="assistant",
                    content="[Error: Another request is in progress. Please wait and try again.]",
                    reply_to_message_id=user_message_id,
                    version_index=1,
                    is_archived=False
                )
                err_session.add(err_msg)
                err_session.commit()
            finally:
                err_session.close()
            yield f"data: {json.dumps({'type': 'error', 'message': 'Another request is in progress. Please wait and try again.'})}\n\n"
            return
        
        print(f"[Chat Stream] Query: '{chat_request.message[:100]}...'")
        print(f"[Chat Stream] Found {len(formatted_context_docs)} document chunks")
        
        import time
        start_time = time.time()
        token_count = 0
        print(f"[Chat Stream] Starting generation...")
        
        try:
            # Check if streaming is supported (local mode)
            if hasattr(llm_client, 'generate_response_stream'):
                try:
                    if is_local:
                        async for token in llm_client.generate_response_stream(
                            chat_request.message,
                            formatted_context_docs,
                            recent_context,
                            combined_context
                        ):
                            full_response += token
                            token_count += 1
                            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                    else:
                        async for token in llm_client.generate_response_stream(
                            chat_request.message,
                            formatted_context_docs,
                            recent_context,
                            combined_context
                        ):
                            full_response += token
                            token_count += 1
                            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                except Exception as e:
                    error_occurred = True
                    error_message = str(e)
                    yield f"data: {json.dumps({'type': 'error', 'message': error_message})}\n\n"
            else:
                try:
                    result = await llm_client.generate_response(
                        chat_request.message,
                        formatted_context_docs,
                        recent_context,
                        combined_context
                    )
                    full_response = result["response"]
                    words = full_response.split(' ')
                    for i, word in enumerate(words):
                        token = word + (' ' if i < len(words) - 1 else '')
                        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                except Exception as e:
                    error_occurred = True
                    error_message = str(e)
                    yield f"data: {json.dumps({'type': 'error', 'message': error_message})}\n\n"
        except TimeoutError:
            error_occurred = True
            yield f"data: {json.dumps({'type': 'error', 'message': 'Ollama is busy with another request. Please wait.'})}\n\n"
        finally:
            await release_llm_lock(conv_id)

        # Save assistant message after streaming completes (even on error to prevent orphaned user messages)
        elapsed = time.time() - start_time
        print(f"[Chat Stream] Generated {token_count} tokens in {elapsed:.2f}s")
        
        # Clean up prompt echo and hallucinated artifacts from local LLM output
        import re as _re
        full_response = _re.sub(r'\n*\bQUESTION\s*:.*$', '', full_response, flags=_re.DOTALL | _re.IGNORECASE)
        full_response = _re.sub(r'\n*\bREMINDER\s*:.*$', '', full_response, flags=_re.DOTALL | _re.IGNORECASE)
        full_response = _re.sub(r'\n*\bDOCUMENTS\s*:.*$', '', full_response, flags=_re.DOTALL | _re.IGNORECASE)
        full_response = _re.sub(r'\n*\bPREVIOUS CHAT\s*:.*$', '', full_response, flags=_re.DOTALL | _re.IGNORECASE)
        full_response = _re.sub(r'\n+(?:Q(?:uestion)?|A(?:nswer)?)\s*:\s*.+$', '', full_response, flags=_re.DOTALL | _re.IGNORECASE)
        full_response = _re.sub(r'\n*\bPlease note\b.*$', '', full_response, flags=_re.DOTALL | _re.IGNORECASE)
        full_response = _re.sub(r'\n*\bNote\s*:.*$', '', full_response, flags=_re.DOTALL | _re.IGNORECASE)
        full_response = _re.sub(r'\n*\bImportant\s*:.*$', '', full_response, flags=_re.DOTALL | _re.IGNORECASE)
        full_response = full_response.strip()
        
        session = SessionLocal()
        try:
            if error_occurred:
                # Save partial response with error marker so user message isn't orphaned
                error_content = full_response if full_response else ""
                if error_content:
                    error_content += "\n\n[Error: Response generation failed]"
                else:
                    error_content = "[Error: Response generation failed]"
                assistant_message = ChatMessage(
                    conversation_id=conv_id,
                    role="assistant",
                    content=error_content,
                    sources_json="||".join(sources) if sources else None,
                    source_chunks_json=json.dumps(source_chunks) if source_chunks else None,
                    prompt_snapshot=chat_request.message,
                    reply_to_message_id=user_message_id,
                    version_index=1,
                    is_archived=False
                )
                session.add(assistant_message)
                session.commit()
                session.refresh(assistant_message)
                yield f"data: {json.dumps({'type': 'done', 'assistant_message_id': assistant_message.id, 'full_response': error_content, 'error': True})}\n\n"
            else:
                assistant_message = ChatMessage(
                    conversation_id=conv_id,
                    role="assistant",
                    content=full_response,
                    sources_json="||".join(sources) if sources else None,
                    source_chunks_json=json.dumps(source_chunks) if source_chunks else None,
                    prompt_snapshot=chat_request.message,
                    reply_to_message_id=user_message_id,
                    version_index=1,
                    is_archived=False
                )
                session.add(assistant_message)
                session.query(Conversation).filter(Conversation.id == conv_id).update(
                    {"updated_at": datetime.utcnow()}
                )
                session.commit()
                session.refresh(assistant_message)
                
                # Send final message with IDs
                yield f"data: {json.dumps({'type': 'done', 'assistant_message_id': assistant_message.id, 'full_response': full_response})}\n\n"
        finally:
            session.close()

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
