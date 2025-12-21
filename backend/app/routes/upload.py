import json
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from sqlalchemy.orm import Session
from typing import List

from ..models.schemas import UploadResponse
from ..utils.document_processor import DocumentProcessor
from ..utils.embeddings import EmbeddingProcessor
from ..config import MAX_FILE_SIZE, DEFAULT_LLM_MODE
from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, Document, DocumentChunk

router = APIRouter()

@router.post("/upload", response_model=UploadResponse)
async def upload_files(
    files: List[UploadFile] = File(...),
    title: str = Form(None),
    llm_mode: str = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        print(f"Upload request received: {len(files)} files, title: {title}")
        chosen_mode = (llm_mode or DEFAULT_LLM_MODE or "api").lower()
        if chosen_mode not in ("api", "local"):
            raise HTTPException(status_code=400, detail="Invalid llm_mode. Use 'api' or 'local'.")
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
            vector_store = embedding_processor.create_vector_store(all_text_data)

            conversation_title = title or (processed_files[0] if processed_files else "Untitled Conversation")
            conversation = Conversation(
                user_id=current_user.id,
                title=conversation_title,
                llm_mode=chosen_mode,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(conversation)
            db.flush()

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

            db.commit()

            return UploadResponse(
                message="Files processed successfully",
                conversation_id=conversation.id,
                processed_files=processed_files,
                llm_mode=chosen_mode
            )
        except Exception as vector_error:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Error creating vector store: {str(vector_error)}")
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Upload error: {str(e)}"
        print(f"ERROR in upload: {error_msg}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=error_msg)
