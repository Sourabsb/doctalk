from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json

from ..dependencies import get_db, get_current_user
from ..models.db_models import ChatMessage, Conversation
from ..utils.embeddings import HybridRAGProcessor
from ..utils.llm_router import get_llm_client
from ..models.db_models import DocumentChunk, Document

router = APIRouter()

class EditMessageRequest(BaseModel):
    content: str

class EditMessageResponse(BaseModel):
    message: str
    updated_message: dict
    regenerated_response: dict = None
    response_versions: list | None = None

@router.put("/messages/{message_id}")
async def edit_message(
    message_id: int,
    request: EditMessageRequest,
    regenerate: bool = False,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Edit a message and optionally regenerate AI response"""
    
    # Find the message
    message = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Verify user owns this conversation
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == message.conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # DO NOT archive the old message - keep all branches active for navigation
    # Just create a new version in the same edit group
    
    # Find the original message in this edit chain
    original_message_id = message.edit_group_id if message.edit_group_id and message.edit_group_id != message.id else message.id
    
    # Count existing edits in this group to determine version
    existing_versions = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.conversation_id == message.conversation_id,
            ChatMessage.role == "user",
            ChatMessage.edit_group_id == original_message_id
        )
        .count()
    )
    
    new_user_message = ChatMessage(
        conversation_id=message.conversation_id,
        role="user",
        content=request.content,
        edit_group_id=original_message_id,
        version_index=existing_versions + 1,
        is_archived=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        is_edited=1,
        reply_to_message_id=message.reply_to_message_id  # Same parent as original - creates sibling branch
    )
    db.add(new_user_message)
    db.flush()
    
    db.commit()
    db.refresh(new_user_message)
    
    updated_message = {
        "id": new_user_message.id,
        "role": new_user_message.role,
        "content": new_user_message.content,
        "is_edited": new_user_message.is_edited,
        "sources": [],
        "edit_group_id": new_user_message.edit_group_id
    }
    
    response_data = {
        "message": "Message updated successfully",
        "updated_message": updated_message,
        "new_message_id": new_user_message.id,
        "archived_message_id": message.id
    }
    
    # If regenerate is requested and message was user, generate new AI response for the new message
    if regenerate and new_user_message.role == "user":
        try:
            # Respect active documents only (avoid deleted/disabled sources)
            active_docs = (
                db.query(Document)
                .filter(Document.conversation_id == conversation.id, Document.is_active == True)
                .all()
            )
            active_doc_ids = [doc.id for doc in active_docs]

            chunk_query = db.query(DocumentChunk).filter(DocumentChunk.conversation_id == conversation.id)
            if active_doc_ids:
                chunk_query = chunk_query.filter(DocumentChunk.document_id.in_(active_doc_ids))

            chunks = chunk_query.all()
            chunk_dicts = [
                {
                    "content": chunk.content,
                    "metadata_json": chunk.metadata_json,
                    "chunk_index": chunk.chunk_index,
                }
                for chunk in chunks
            ]

            # Load chat history up to this message for context (only non-archived from active branch)
            # Active branch means: messages that come before this edit point and aren't archived
            chat_history_records = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.conversation_id == conversation.id,
                    ChatMessage.id < message.id,
                    ChatMessage.is_archived == False
                )
                .order_by(ChatMessage.created_at.asc())
                .all()
            )
            chat_history = [
                {"role": record.role, "content": record.content}
                for record in chat_history_records
            ]

            conv_embedding_model = getattr(conversation, 'embedding_model', 'custom')
            hybrid_rag = HybridRAGProcessor(conversation_id=conversation.id, embedding_model_name=conv_embedding_model)
            hybrid_rag.load_documents(chunk_dicts)
            hybrid_rag.load_chat_history(chat_history)

            context_result = hybrid_rag.build_context(
                query=request.content,
                chat_history=chat_history,
                doc_k=12,
                chat_k=4,
                recent_messages=6,
            )

            formatted_context_docs = [
                {
                    "page_content": doc["content"],
                    "metadata": doc["metadata"],
                }
                for doc in context_result["document_chunks"]
            ]

            llm_client = get_llm_client(conversation.llm_mode)
            result = await llm_client.generate_response(
                request.content,
                formatted_context_docs,
                context_result.get("recent_context", []),
                context_result.get("combined_context", ""),
            )
            
            # Create a new assistant response for this new user message
            new_assistant_response = ChatMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=result["response"],
                sources_json="||".join(result["sources"]) if result["sources"] else None,
                source_chunks_json=json.dumps(result.get("source_chunks", [])) if result.get("source_chunks") else None,
                prompt_snapshot=request.content,
                reply_to_message_id=new_user_message.id,
                version_index=1,
                is_archived=False,
                created_at=datetime.utcnow()
            )
            db.add(new_assistant_response)
            
            conversation.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(new_assistant_response)

            response_data["regenerated_response"] = {
                "id": new_assistant_response.id,
                "role": new_assistant_response.role,
                "content": new_assistant_response.content,
                "sources": result["sources"],
                "source_chunks": result.get("source_chunks", []),
                "version_index": new_assistant_response.version_index,
                "reply_to_message_id": new_assistant_response.reply_to_message_id,
                "prompt_content": new_assistant_response.prompt_snapshot or request.content
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to regenerate response: {str(e)}")
    
    return response_data

@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a message"""
    
    message = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Verify user owns this conversation
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == message.conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(message)
    db.commit()
    
    return {"message": "Message deleted successfully"}
