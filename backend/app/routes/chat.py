from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..models.schemas import ChatRequest, ChatResponse, ChatMessageResponse, ResponseVariant
from ..utils.embeddings import EmbeddingProcessor
from ..utils.gemini_client import GeminiClient
from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, DocumentChunk, ChatMessage

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

    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.conversation_id == conversation.id)
        .all()
    )

    if not chunks:
        raise HTTPException(status_code=400, detail="No documents stored for this conversation")

    chunk_dicts = [
        {
            "content": chunk.content,
            "metadata_json": chunk.metadata_json,
            "chunk_index": chunk.chunk_index
        }
        for chunk in chunks
    ]

    embedding_processor = EmbeddingProcessor().load_from_chunks(chunk_dicts)

    gemini_client = GeminiClient()
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

    is_summary_request = any(word in chat_request.message.lower() for word in [
        'summarize', 'summary', 'summarise', 'sumary', 'brief',
        'overview', 'gist', 'main points', 'key points', 'highlights'
    ])

    if is_summary_request:
        all_docs = []
        search_terms = ["", "introduction", "conclusion", "main", "important", "key", "overview"]

        for term in search_terms:
            docs = embedding_processor.search_similar(term, k=20)
            all_docs.extend(docs)

        source_groups = {}
        for doc in all_docs:
            source = doc["metadata"].get("source", "Unknown")
            source_groups.setdefault(source, []).append(doc)

        context_docs = []
        for source, docs in source_groups.items():
            context_docs.extend(docs[:8])
    else:
        relevant_docs = embedding_processor.search_similar(chat_request.message, k=15)
        source_groups = {}
        for doc in relevant_docs:
            source = doc["metadata"].get("source", "Unknown")
            source_groups.setdefault(source, []).append(doc)

        context_docs = []
        for source, docs in source_groups.items():
            context_docs.extend(docs[:3])

        context_docs = context_docs[:12]

    if not context_docs:
        context_docs = embedding_processor.search_similar("", k=5)

    formatted_context_docs = [
        {
            "page_content": doc["content"],
            "metadata": doc["metadata"]
        }
        for doc in context_docs
    ]

    result = await gemini_client.generate_response(
        chat_request.message,
        formatted_context_docs,
        chat_history
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
        user_message=user_message_payload,
        assistant_message=assistant_message_payload,
        response_versions=[response_variant]
    )
