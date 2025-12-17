from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..dependencies import get_db, get_current_user
from ..models.db_models import ChatMessage, Conversation
from ..utils.embeddings import EmbeddingProcessor
from ..utils.gemini_client import GeminiClient
from ..models.db_models import DocumentChunk

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
    
    # Update the message
    message.content = request.content
    message.updated_at = datetime.utcnow()
    message.is_edited = 1
    db.commit()
    db.refresh(message)
    
    updated_message = {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "is_edited": message.is_edited,
        "sources": message.sources_json.split("||") if message.sources_json else []
    }
    
    response_data = {
        "message": "Message updated successfully",
        "updated_message": updated_message
    }
    
    # If regenerate is requested and message is from user, generate new AI response
    if regenerate and message.role == "user":
        try:
            # Get document chunks for context
            chunks = (
                db.query(DocumentChunk)
                .filter(DocumentChunk.conversation_id == conversation.id)
                .all()
            )
            
            if not chunks:
                raise HTTPException(status_code=400, detail="No documents in conversation")
            
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
            
            # Get chat history up to this message
            chat_history_records = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.conversation_id == conversation.id,
                    ChatMessage.id < message.id
                )
                .order_by(ChatMessage.created_at.asc())
                .all()
            )
            chat_history = [
                {"role": record.role, "content": record.content}
                for record in chat_history_records
            ]
            
            # Search for relevant context
            relevant_docs = embedding_processor.search_similar(request.content, k=15)
            source_groups = {}
            for doc in relevant_docs:
                source = doc["metadata"].get("source", "Unknown")
                source_groups.setdefault(source, []).append(doc)
            
            context_docs = []
            for source, docs in source_groups.items():
                context_docs.extend(docs[:3])
            context_docs = context_docs[:12]
            
            formatted_context_docs = [
                {
                    "page_content": doc["content"],
                    "metadata": doc["metadata"]
                }
                for doc in context_docs
            ]
            
            # Generate new response
            result = await gemini_client.generate_response(
                request.content,
                formatted_context_docs,
                chat_history
            )
            
            responses_for_message = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.conversation_id == conversation.id,
                    ChatMessage.reply_to_message_id == message.id
                )
                .order_by(ChatMessage.version_index.asc(), ChatMessage.created_at.asc())
                .all()
            )

            active_response = next((resp for resp in responses_for_message if not resp.is_archived), None)

            if not active_response:
                active_response = (
                    db.query(ChatMessage)
                    .filter(
                        ChatMessage.conversation_id == conversation.id,
                        ChatMessage.id > message.id,
                        ChatMessage.role == "assistant",
                        ChatMessage.is_archived == False
                    )
                    .order_by(ChatMessage.id.asc())
                    .first()
                )
                if active_response:
                    active_response.reply_to_message_id = message.id
                    active_response.version_index = active_response.version_index or 1
                    responses_for_message.append(active_response)

            archived_copy = None
            if active_response and active_response.content:
                archived_copy = ChatMessage(
                    conversation_id=active_response.conversation_id,
                    role=active_response.role,
                    content=active_response.content,
                    sources_json=active_response.sources_json,
                    prompt_snapshot=active_response.prompt_snapshot,
                    reply_to_message_id=message.id,
                    version_index=active_response.version_index or 1,
                    is_archived=True,
                    created_at=active_response.created_at,
                    updated_at=active_response.updated_at
                )
                db.add(archived_copy)
                responses_for_message.append(archived_copy)

            next_version_index = max(
                [resp.version_index or 0 for resp in responses_for_message] or [0]
            ) + 1

            if not active_response:
                active_response = ChatMessage(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=result["response"],
                    sources_json="||".join(result["sources"]) if result["sources"] else None,
                    prompt_snapshot=request.content,
                    reply_to_message_id=message.id,
                    version_index=next_version_index,
                    is_archived=False
                )
                db.add(active_response)
            else:
                active_response.content = result["response"]
                active_response.sources_json = "||".join(result["sources"]) if result["sources"] else None
                active_response.version_index = next_version_index
                active_response.is_archived = False
                active_response.reply_to_message_id = message.id
                active_response.prompt_snapshot = request.content
                active_response.updated_at = datetime.utcnow()

            conversation.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(active_response)

            updated_responses = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.conversation_id == conversation.id,
                    ChatMessage.reply_to_message_id == message.id
                )
                .order_by(ChatMessage.version_index.asc(), ChatMessage.created_at.asc())
                .all()
            )

            response_data["regenerated_response"] = {
                "id": active_response.id,
                "role": active_response.role,
                "content": active_response.content,
                "sources": result["sources"],
                "version_index": active_response.version_index,
                "reply_to_message_id": active_response.reply_to_message_id,
                "prompt_content": active_response.prompt_snapshot or request.content
            }
            response_data["response_versions"] = [
                {
                    "id": resp.id,
                    "version_index": resp.version_index,
                    "content": resp.content,
                    "sources": resp.sources_json.split("||") if resp.sources_json else [],
                    "is_active": not resp.is_archived,
                    "created_at": resp.created_at,
                    "prompt_content": resp.prompt_snapshot
                }
                for resp in updated_responses
            ]
            
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
