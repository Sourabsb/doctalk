from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json

from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, Document, DocumentChunk
from ..models.schemas import (
    ConversationSummary,
    ConversationDetailResponse,
    ChatMessageResponse,
    ResponseVariant
)
from ..utils.document_processor import DocumentProcessor
from ..utils.embeddings import EmbeddingProcessor

router = APIRouter(tags=["conversations"])


class NoteCreate(BaseModel):
    title: str
    content: str


class NoteUpdate(BaseModel):
    title: str = None
    content: str = None


class DocumentToggle(BaseModel):
    is_active: bool

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
                last_message=last_message,
                llm_mode=getattr(convo, "llm_mode", "api")
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
        last_message=conversation.messages[-1].content if conversation.messages else None,
        llm_mode=getattr(conversation, "llm_mode", "api")
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
                response_versions=response_versions,
                edit_group_id=getattr(message, 'edit_group_id', None)
            )
        )

    documents = []
    for doc in conversation.documents:
        has_embeddings = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).first() is not None
        documents.append({
            "id": doc.id,
            "filename": doc.filename,
            "content": doc.content,
            "uploaded_at": doc.uploaded_at,
            "doc_type": getattr(doc, 'doc_type', 'file'),
            "is_active": getattr(doc, 'is_active', True),
            "has_embeddings": has_embeddings
        })

    return ConversationDetailResponse(
        conversation=summary,
        messages=messages,
        documents=documents,
        llm_mode=getattr(conversation, "llm_mode", "api"),
    )

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


@router.delete("/conversations/{conversation_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    conversation_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a document and its chunks from a conversation"""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.conversation_id == conversation_id)
        .first()
    )

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Delete associated chunks first
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
    
    # Delete the document
    db.delete(document)
    db.commit()


@router.post("/conversations/{conversation_id}/notes")
def create_note(
    conversation_id: int,
    note: NoteCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new note in a conversation"""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    document = Document(
        conversation_id=conversation_id,
        filename=note.title,
        content=note.content,
        doc_type="note",
        is_active=True
    )
    db.add(document)
    db.flush()
    db.commit()
    db.refresh(document)

    print(f"Note created: ID={document.id}, Title={document.filename}, ConvID={conversation_id}")

    return {
        "id": document.id,
        "filename": document.filename,
        "content": document.content,
        "doc_type": document.doc_type,
        "is_active": document.is_active,
        "uploaded_at": document.uploaded_at
    }


@router.put("/conversations/{conversation_id}/notes/{note_id}")
def update_note(
    conversation_id: int,
    note_id: int,
    note: NoteUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update a note"""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    document = (
        db.query(Document)
        .filter(Document.id == note_id, Document.conversation_id == conversation_id, Document.doc_type == "note")
        .first()
    )

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    if note.title is not None:
        document.filename = note.title
    if note.content is not None:
        document.content = note.content

    db.commit()
    db.refresh(document)

    return {
        "id": document.id,
        "filename": document.filename,
        "content": document.content,
        "doc_type": document.doc_type,
        "is_active": document.is_active,
        "uploaded_at": document.uploaded_at
    }


@router.post("/conversations/{conversation_id}/notes/{note_id}/convert")
def convert_note_to_source(
    conversation_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Convert a note to a searchable source by creating embeddings.
    If already converted, updates the existing chunks with new content."""
    try:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
            .first()
        )

        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        # Get the note document
        note_doc = (
            db.query(Document)
            .filter(Document.id == note_id, Document.conversation_id == conversation_id, Document.doc_type == "note")
            .first()
        )

        if not note_doc:
            print(f"DEBUG: Note with ID {note_id} not found in conversation {conversation_id}")
            print(f"DEBUG: Available notes in this conversation:")
            available_notes = db.query(Document).filter(
                Document.conversation_id == conversation_id,
                Document.doc_type == "note"
            ).all()
            for note in available_notes:
                print(f"  - ID: {note.id}, Title: {note.filename}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Note with ID {note_id} not found")

        if not note_doc.content or not note_doc.content.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Note has no content to convert")

        processor = DocumentProcessor()
        chunks = processor.chunk_text(note_doc.content, chunk_size=500, overlap=50)
        
        if not chunks:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not create chunks from note content")
        
        # Delete any existing chunks for this note (for re-conversion)
        db.query(DocumentChunk).filter(DocumentChunk.document_id == note_id).delete()
        
        # Create new chunks
        for i, chunk in enumerate(chunks):
            metadata = {
                "source": note_doc.filename,
                "chunk_index": i,
                "doc_type": "note"
            }
            db_chunk = DocumentChunk(
                conversation_id=conversation_id,
                document_id=note_doc.id,
                chunk_index=i,
                content=chunk,
                metadata_json=json.dumps(metadata)
            )
            db.add(db_chunk)
        
        # Mark the note as having embeddings
        note_doc.has_embeddings = True
        
        db.commit()
        
        return {
            "message": "Note converted to source",
            "id": note_doc.id,
            "filename": note_doc.filename,
            "content": note_doc.content,
            "doc_type": "note",
            "is_active": True,
            "has_embeddings": True,
            "chunks_created": len(chunks)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in convert_note_to_source: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error converting note: {str(e)}")


@router.post("/conversations/{conversation_id}/notes/{note_id}/unconvert")
def unconvert_note_from_source(
    conversation_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Remove embeddings from a note, converting it back to a regular note.
    This keeps the note but removes it from the searchable sources."""
    try:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
            .first()
        )

        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        # Get the note document
        note_doc = (
            db.query(Document)
            .filter(Document.id == note_id, Document.conversation_id == conversation_id, Document.doc_type == "note")
            .first()
        )

        if not note_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Note with ID {note_id} not found")

        # Delete all chunks for this note
        deleted_count = db.query(DocumentChunk).filter(DocumentChunk.document_id == note_id).delete()
        
        # Mark the note as no longer having embeddings
        note_doc.has_embeddings = False
        
        db.commit()
        
        return {
            "message": "Note unconverted from source",
            "id": note_doc.id,
            "filename": note_doc.filename,
            "has_embeddings": False,
            "chunks_deleted": deleted_count
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in unconvert_note_from_source: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error unconverting note: {str(e)}")


@router.patch("/conversations/{conversation_id}/documents/{document_id}/toggle")
def toggle_document(
    conversation_id: int,
    document_id: int,
    toggle: DocumentToggle,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Toggle document active status for queries"""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.conversation_id == conversation_id)
        .first()
    )

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    document.is_active = toggle.is_active
    db.commit()

    return {"id": document.id, "is_active": document.is_active}