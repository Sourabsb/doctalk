from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation
from ..models.schemas import (
    ConversationSummary,
    ConversationDetailResponse,
    ChatMessageResponse,
    ResponseVariant
)

router = APIRouter(tags=["conversations"])

@router.get("/conversations", response_model=List[ConversationSummary])
def list_conversations(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )

    summaries = []
    for convo in conversations:
        last_message = convo.messages[-1].content if convo.messages else None
        summaries.append(
            ConversationSummary(
                id=convo.id,
                title=convo.title,
                created_at=convo.created_at,
                updated_at=convo.updated_at,
                last_message=last_message
            )
        )
    return summaries

@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    summary = ConversationSummary(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        last_message=conversation.messages[-1].content if conversation.messages else None
    )

    response_groups = {}
    for msg in conversation.messages:
        if msg.reply_to_message_id:
            response_groups.setdefault(msg.reply_to_message_id, []).append(msg)

    messages = []
    for message in conversation.messages:
        if getattr(message, "is_archived", 0):
            continue

        response_versions = None
        if message.role == 'user':
            variants = sorted(
                response_groups.get(message.id, []),
                key=lambda resp: ((resp.version_index or 0), resp.created_at)
            )
            if variants:
                response_versions = [
                    ResponseVariant(
                        id=variant.id,
                        version_index=variant.version_index or 1,
                        content=variant.content,
                        sources=variant.sources_json.split("||") if variant.sources_json else [],
                        is_active=not variant.is_archived,
                        created_at=variant.created_at,
                        prompt_content=variant.prompt_snapshot or message.content
                    )
                    for variant in variants
                ]

        messages.append(
            ChatMessageResponse(
                id=message.id,
                role=message.role,
                content=message.content,
                sources=message.sources_json.split("||") if message.sources_json else [],
                created_at=message.created_at,
                is_edited=message.is_edited if hasattr(message, 'is_edited') else 0,
                reply_to_message_id=message.reply_to_message_id,
                version_index=message.version_index,
                is_archived=bool(getattr(message, 'is_archived', 0)),
                response_versions=response_versions
            )
        )

    documents = [doc.filename for doc in conversation.documents]

    return ConversationDetailResponse(conversation=summary, messages=messages, documents=documents)

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    db.delete(conversation)
    db.commit()