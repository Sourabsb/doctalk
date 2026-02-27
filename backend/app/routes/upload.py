import json
import logging
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form, status
from sqlalchemy.orm import Session
from typing import List

from ..models.schemas import UploadResponse

logger = logging.getLogger(__name__)
from ..utils.document_processor import DocumentProcessor
from ..utils.embeddings import QdrantVectorStore, EmbeddingProcessor
from ..config import MAX_FILE_SIZE, DEFAULT_LLM_MODE
from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, Document, DocumentChunk

router = APIRouter()

@router.post("/upload", response_model=UploadResponse)
async def upload_files(
    files: List[UploadFile] = File(...),
    title: str = Form(None),
    llm_mode: str = Form(None),
    embedding_model: str = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        chosen_mode = (llm_mode or DEFAULT_LLM_MODE or "api").lower()
        if chosen_mode not in ("api", "local"):
            raise HTTPException(status_code=400, detail="Invalid llm_mode. Use 'api' or 'local'.")
        
        chosen_embedding = (embedding_model or "custom").lower()
        if chosen_embedding not in ("custom", "allminilm"):
            raise HTTPException(status_code=400, detail="Invalid embedding_model. Use 'custom' or 'allminilm'.")
        
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
            # Create conversation first (need ID for Qdrant)
            conversation_title = title or (processed_files[0] if processed_files else "Untitled Conversation")
            conversation = Conversation(
                user_id=current_user.id,
                title=conversation_title,
                llm_mode=chosen_mode,
                embedding_model=chosen_embedding,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(conversation)
            db.flush()

            # Create document records
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
                
                # Map all source variations to this document ID
                # Use full filename as primary key to avoid collisions (e.g., report.pdf vs report.docx)
                source_to_doc_id[filename] = document.id
                # Also map page-based sources (e.g., "file.name.pdf_page_1")
                for source in all_text_data.keys():
                    source_base = source.split('_page_')[0]
                    # Match if source exactly equals filename, or source_base equals filename
                    if source == filename or source_base == filename:
                        source_to_doc_id[source] = document.id
                        # Also store source_base if it's different from source (for page-based lookups)
                        if source_base != source:
                            source_to_doc_id[source_base] = document.id
            
            # Check for unmapped sources and log warnings
            available_doc_ids = {fn: doc.id for fn, doc in document_map.items()}
            for source in all_text_data.keys():
                if source not in source_to_doc_id:
                    logger.warning(
                        "Unmapped source '%s' could not be matched to any document. "
                        "Available documents: %s. Chunks will be created with document_id=None.",
                        source,
                        available_doc_ids
                    )

            vector_store = QdrantVectorStore(conversation.id, chosen_embedding)
            try:
                chunk_count, qdrant_texts, qdrant_metadatas = vector_store.add_documents(all_text_data, source_to_doc_id)
                logger.info("Added %d chunks to Qdrant for conversation %d", chunk_count, conversation.id)
            except Exception as qdrant_error:
                logger.error("Failed to add documents to Qdrant: %s", qdrant_error)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to create vector embeddings: {str(qdrant_error)}"
                )

            # Save chunks to SQLite for metadata backup
            embedding_processor = EmbeddingProcessor()
            embedding_processor.create_vector_store(all_text_data, precomputed_texts=qdrant_texts, precomputed_metadatas=qdrant_metadatas)
            
            try:
                for idx, metadata in enumerate(embedding_processor.metadatas):
                    source = metadata.get("source", processed_files[0]) if processed_files else metadata.get("source", "Unknown")
                    doc_id = source_to_doc_id.get(source)
                    chunk = DocumentChunk(
                        conversation_id=conversation.id,
                        document_id=doc_id,
                        chunk_index=metadata.get("chunk_id", idx),
                        content=embedding_processor.texts[idx],
                        metadata_json=json.dumps(metadata)
                    )
                    db.add(chunk)

                db.commit()
            except Exception as db_error:
                db.rollback()
                try:
                    vector_store.delete_by_conversation()
                    logger.info("Cleaned up Qdrant vectors after SQLite failure for conversation %d", conversation.id)
                except Exception as cleanup_error:
                    logger.error("Failed to cleanup Qdrant vectors: %s", cleanup_error)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to save document metadata: {str(db_error)}"
                )

            return UploadResponse(
                message="Files processed successfully",
                conversation_id=conversation.id,
                processed_files=processed_files,
                llm_mode=chosen_mode,
                embedding_model=chosen_embedding
            )
        except Exception as vector_error:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Error creating vector store: {str(vector_error)}")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")
