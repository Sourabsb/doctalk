from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import json

from ..models.schemas import ChatRequest, ChatResponse, ChatMessageResponse, ResponseVariant
from ..utils.embeddings import HybridRAGProcessor
from ..utils.gemini_client import GeminiClient
from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, DocumentChunk, ChatMessage, Document

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

    gemini_client = GeminiClient()

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
    
    result = await gemini_client.generate_response(
        chat_request.message,
        formatted_context_docs,
        recent_context,  # Use recent messages for conversational continuity
        combined_context  # Additional context from hybrid search + doc info
    )

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
