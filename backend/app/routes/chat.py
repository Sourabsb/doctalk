from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json

from ..models.schemas import ChatRequest, ChatResponse, ChatMessageResponse, ResponseVariant
from ..utils.embeddings import HybridRAGProcessor
from ..utils.llm_router import get_llm_client
from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, DocumentChunk, ChatMessage, Document
from ..database import SessionLocal

router = APIRouter()

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

    # Load chat history
    chat_history_records = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    chat_history = [
        {"role": record.role, "content": record.content}
        for record in chat_history_records
    ]

    # Initialize Hybrid RAG Processor
    hybrid_rag = HybridRAGProcessor()
    hybrid_rag.load_documents(chunk_dicts)
    hybrid_rag.load_chat_history(chat_history)

    llm_client = get_llm_client(conversation.llm_mode)

    is_summary_request = any(word in chat_request.message.lower() for word in [
        'summarize', 'summary', 'summarise', 'sumary', 'brief',
        'overview', 'gist', 'main points', 'key points', 'highlights'
    ])

    if is_summary_request:
        # For summary requests, get more document chunks and skip chat history search
        context_result = hybrid_rag.build_context(
            query=chat_request.message,
            chat_history=chat_history,
            doc_k=20,  # More document chunks for summaries
            chat_k=0,   # Skip chat history for summaries
            recent_messages=4
        )
    else:
        # For regular queries, use hybrid search
        context_result = hybrid_rag.build_context(
            query=chat_request.message,
            chat_history=chat_history,
            doc_k=8,    # Relevant document chunks
            chat_k=3,   # Relevant past conversations
            recent_messages=8  # Recent conversational context
        )

    # Prepare context documents for Gemini
    formatted_context_docs = [
        {
            "page_content": doc["content"],
            "metadata": doc["metadata"]
        }
        for doc in context_result["document_chunks"]
    ]

    # Build enhanced chat history with recent context
    recent_context = context_result.get("recent_context", [])
    
    # Combine hybrid context with document availability info
    combined_context = context_result.get("combined_context", "") + doc_context_info
    
    try:
        result = await llm_client.generate_response(
            chat_request.message,
            formatted_context_docs,
            recent_context,  # Use recent messages for conversational continuity
            combined_context  # Additional context from hybrid search + doc info
        )
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    user_message = ChatMessage(
        conversation_id=conversation.id,
        role="user",
        content=chat_request.message
    )
    db.add(user_message)
    db.flush()

    assistant_message = ChatMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=result["response"],
        sources_json="||".join(result["sources"]) if result["sources"] else None,
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

    # Load chat history - limit for local mode to avoid context overflow
    max_history = 10 if conversation.llm_mode == "local" else 50
    chat_history_records = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(max_history)
        .all()
    )
    chat_history_records.reverse()  # Back to chronological order
    chat_history = [
        {"role": record.role, "content": record.content}
        for record in chat_history_records
    ]

    # Initialize Hybrid RAG Processor
    hybrid_rag = HybridRAGProcessor()
    hybrid_rag.load_documents(chunk_dicts)
    hybrid_rag.load_chat_history(chat_history)

    llm_client = get_llm_client(conversation.llm_mode)

    # Build context - reduce for local mode
    if conversation.llm_mode == "local":
        doc_k, chat_k, recent_msgs = 5, 2, 4  # Much smaller context for local
    else:
        doc_k, chat_k, recent_msgs = 8, 3, 8
        
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

    # Capture conversation ID before session closes
    conv_id = conversation.id
    
    # Only save user message if not regenerating
    user_message_id = None
    edit_group_id = None
    
    if not chat_request.regenerate:
        # Determine edit_group_id for edited messages
        if chat_request.is_edit and chat_request.edit_group_id:
            # This is an edit of an existing message, use provided group ID
            edit_group_id = chat_request.edit_group_id
            # Count existing edits in this group to set version_index
            existing_edits_count = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.conversation_id == conv_id,
                    ChatMessage.edit_group_id == edit_group_id,
                    ChatMessage.role == "user"
                )
                .count()
            )
            version_index = existing_edits_count + 1
        else:
            # New message - generate new edit_group_id
            # Use a simple approach: make it the same as the message ID after save
            edit_group_id = None  # Will be set after message is created
            version_index = 1
        
        user_message = ChatMessage(
            conversation_id=conv_id,
            role="user",
            content=chat_request.message,
            edit_group_id=edit_group_id,
            version_index=version_index
        )
        db.add(user_message)
        db.flush()
        user_message_id = user_message.id
        
        # For new messages, set edit_group_id to its own ID
        if edit_group_id is None:
            user_message.edit_group_id = user_message.id
            edit_group_id = user_message.id
        
        db.commit()
    else:
        # For regenerate, find the last user message to link to
        last_user_msg = (
            db.query(ChatMessage)
            .filter(
                ChatMessage.conversation_id == conv_id,
                ChatMessage.role == "user"
            )
            .order_by(ChatMessage.created_at.desc())
            .first()
        )
        if last_user_msg:
            user_message_id = last_user_msg.id

    async def generate_stream():
        full_response = ""
        
        # Send initial metadata
        yield f"data: {json.dumps({'type': 'meta', 'sources': sources, 'source_chunks': source_chunks, 'user_message_id': user_message_id, 'edit_group_id': edit_group_id})}\n\n"
        
        # Check if streaming is supported (local mode)
        if hasattr(llm_client, 'generate_response_stream'):
            try:
                async for token in llm_client.generate_response_stream(
                    chat_request.message,
                    formatted_context_docs,
                    recent_context,
                    combined_context
                ):
                    full_response += token
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                return
        else:
            # Fallback to non-streaming for API mode
            try:
                result = await llm_client.generate_response(
                    chat_request.message,
                    formatted_context_docs,
                    recent_context,
                    combined_context
                )
                full_response = result["response"]
                # Send in chunks to simulate streaming
                words = full_response.split(' ')
                for i, word in enumerate(words):
                    token = word + (' ' if i < len(words) - 1 else '')
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                return

        # Save assistant message after streaming completes
        session = SessionLocal()
        try:
            assistant_message = ChatMessage(
                conversation_id=conv_id,
                role="assistant",
                content=full_response,
                sources_json="||".join(sources) if sources else None,
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
