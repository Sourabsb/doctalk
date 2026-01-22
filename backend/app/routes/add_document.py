import json
import logging
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from ..models.schemas import UploadResponse

logger = logging.getLogger(__name__)
from ..utils.document_processor import DocumentProcessor
from ..utils.embeddings import EmbeddingProcessor, QdrantVectorStore
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
            # Add new document records first (need document IDs for Qdrant)
            unique_files = list(dict.fromkeys(processed_files))
            document_map = {}
            source_to_doc_id = {}  # Map source names to document IDs for Qdrant
            
            for filename in unique_files:
                document = Document(
                    conversation_id=conversation.id, 
                    filename=filename,
                    content=file_contents.get(filename, "")
                )
                db.add(document)
                db.flush()
                document_map[filename] = document
                
                # Map all source variations to this document ID using robust stem
                source_to_doc_id[filename] = document.id
                # Get filename stem: "file.name.pdf" -> "file.name"
                filename_stem = filename.rsplit('.', 1)[0] if '.' in filename else filename
                source_to_doc_id[filename_stem] = document.id
                for source in all_text_data.keys():
                    # Match exact filename or sources that start with stem followed by underscore/dot/end
                    source_stem = source.rsplit('.', 1)[0] if '.' in source else source
                    # Also handle page-based sources like "file.name.pdf_page_1"
                    source_base = source.split('_page_')[0]
                    source_base_stem = source_base.rsplit('.', 1)[0] if '.' in source_base else source_base
                    if source == filename or source_base == filename or source_base_stem == filename_stem:
                        source_to_doc_id[source] = document.id
            
            # Check for unmapped sources and log warnings (do not silently fallback)
            available_doc_ids = {fn: doc.id for fn, doc in document_map.items()}
            for source in all_text_data.keys():
                if source not in source_to_doc_id:
                    logger.warning(
                        "Unmapped source '%s' could not be matched to any document. "
                        "Available documents: %s. Source will be skipped for document association.",
                        source,
                        available_doc_ids
                    )

            vector_store = QdrantVectorStore(conversation.id)
            chunk_count, qdrant_texts, qdrant_metadatas = vector_store.add_documents(all_text_data, source_to_doc_id)

            # Save chunks to SQLite for metadata backup
            embedding_processor = EmbeddingProcessor()
            embedding_processor.create_vector_store(all_text_data, precomputed_texts=qdrant_texts, precomputed_metadatas=qdrant_metadatas)
            
            for idx, metadata in enumerate(embedding_processor.metadatas):
                source = metadata.get("source", processed_files[0]) if processed_files else metadata.get("source", "Unknown")
                filename_key = source.split("_page_")[0]
                document = document_map.get(filename_key) or document_map.get(source)
                chunk = DocumentChunk(
                    conversation_id=conversation.id,
                    document_id=document.id if document else None,
                    chunk_index=metadata.get("chunk_id", idx),
                    content=embedding_processor.texts[idx],
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
