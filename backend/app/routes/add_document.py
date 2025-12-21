import json
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from ..models.schemas import UploadResponse
from ..utils.document_processor import DocumentProcessor
from ..utils.embeddings import EmbeddingProcessor
from ..config import MAX_FILE_SIZE
from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, Document, DocumentChunk

router = APIRouter()

@router.post("/add-documents/{conversation_id}", response_model=UploadResponse)
async def add_documents_to_conversation(
    conversation_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Add documents to an existing conversation"""
    try:
        # Verify conversation exists and belongs to user
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
            .first()
        )
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Process new files
        processor = DocumentProcessor()
        embedding_processor = EmbeddingProcessor()
        
        all_text_data = {}
        processed_files = []
        file_contents = {}  # Store extracted text for each file
        error_msgs = []
        
        for file in files:
            try:
                content = await file.read()
                if len(content) > MAX_FILE_SIZE:
                    error_msg = f"File {file.filename} too large (max: {MAX_FILE_SIZE/1024/1024}MB)"
                    error_msgs.append(error_msg)
                    continue
                text_data = await processor.process_file(content, file.filename)
                
                if not text_data:
                    error_msg = f"No text could be extracted from {file.filename}"
                    error_msgs.append(error_msg)
                    continue
                    
                all_text_data.update(text_data)
                processed_files.append(file.filename)
                # Store the combined text content for this file
                file_contents[file.filename] = "\n\n".join(text_data.values())
                
            except Exception as file_error:
                error_msg = f"Error processing {file.filename}: {str(file_error)}"
                error_msgs.append(error_msg)
        
        if not all_text_data:
            if error_msgs:
                raise HTTPException(status_code=400, detail="; ".join(error_msgs))
            else:
                raise HTTPException(status_code=400, detail="No text extracted from files")
        
        try:
            # Create vector store for new documents
            vector_store = embedding_processor.create_vector_store(all_text_data)

            # Add new document records
            unique_files = list(dict.fromkeys(processed_files))
            document_map = {}
            for filename in unique_files:
                document = Document(
                    conversation_id=conversation.id, 
                    filename=filename,
                    content=file_contents.get(filename, "")  # Store the extracted text
                )
                db.add(document)
                db.flush()
                document_map[filename] = document

            # Add new chunks
            for idx, metadata in enumerate(vector_store.metadatas):
                source = metadata.get("source", processed_files[0]) if processed_files else metadata.get("source", "Unknown")
                filename_key = source.split("_page_")[0]
                document = document_map.get(filename_key) or document_map.get(source)
                chunk = DocumentChunk(
                    conversation_id=conversation.id,
                    document_id=document.id if document else None,
                    chunk_index=metadata.get("chunk_id", idx),
                    content=vector_store.texts[idx],
                    metadata_json=json.dumps(metadata)
                )
                db.add(chunk)

            # Update conversation timestamp
            conversation.updated_at = datetime.utcnow()
            db.commit()

            return UploadResponse(
                message=f"Added {len(processed_files)} document(s) to conversation",
                conversation_id=conversation.id,
                processed_files=processed_files,
                llm_mode=getattr(conversation, "llm_mode", "api")
            )
        except Exception as vector_error:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Error processing documents: {str(vector_error)}")
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Upload error: {str(e)}"
        db.rollback()
        raise HTTPException(status_code=500, detail=error_msg)
