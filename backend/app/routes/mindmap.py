from typing import List
import asyncio
import json
import logging
import re
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, DocumentChunk, MindMap, Document
from ..models.schemas import MindMapResponse, MindMapGenerateRequest, MindMapNode
from ..utils.llm_router import get_llm_client
from ..utils.ollama_client import LocalModeLock

logger = logging.getLogger(__name__)

router = APIRouter(tags=["mindmap"])


def _remove_trailing_commas_outside_strings(json_str: str) -> str:
    """Remove trailing commas before ] or } only when not inside a string literal.
    
    This is JSON-aware and won't corrupt string contents like regex-based approaches.
    """
    result = []
    in_string = False
    escape_next = False
    i = 0
    
    while i < len(json_str):
        char = json_str[i]
        
        if escape_next:
            result.append(char)
            escape_next = False
            i += 1
            continue
        
        if char == '\\' and in_string:
            result.append(char)
            escape_next = True
            i += 1
            continue
        
        if char == '"':
            in_string = not in_string
            result.append(char)
            i += 1
            continue
        
        if char == ',' and not in_string:
            # Look ahead to see if this comma precedes ] or } (with optional whitespace)
            j = i + 1
            while j < len(json_str) and json_str[j] in ' \t\n\r':
                j += 1
            if j < len(json_str) and json_str[j] in ']}':
                # Skip this trailing comma
                i += 1
                continue
        
        result.append(char)
        i += 1
    
    return ''.join(result)


MINDMAP_PROMPT = """Analyze the following document content and generate a mind map structure.
The mind map should have a central topic and hierarchical subtopics covering the main themes.

IMPORTANT: Respond ONLY with valid JSON in the following format, nothing else:
{{
    "title": "Main Document Topic",
    "nodes": [
        {{"id": "1", "label": "Major Topic 1", "children": [
            {{"id": "1.1", "label": "Subtopic 1.1"}},
            {{"id": "1.2", "label": "Subtopic 1.2"}}
        ]}},
        {{"id": "2", "label": "Major Topic 2", "children": [
            {{"id": "2.1", "label": "Subtopic 2.1"}}
        ]}}
    ]
}}

Rules:
- Create 4-8 major topics
- Each major topic can have 2-5 subtopics
- Subtopics can have 1-3 nested children if needed
- Keep labels concise (2-6 words)
- Cover the entire document comprehensively

Document Content:
{context}

Generate a comprehensive mind map covering all major themes from the document."""


def parse_mindmap_response(response_text: str) -> dict:
    """Parse LLM response to extract mind map data with robust fallbacks."""
    
    # Clean up common issues from local models
    cleaned = response_text.strip()
    
    # Remove markdown code blocks
    cleaned = re.sub(r'```(?:json)?\s*', '', cleaned)
    cleaned = re.sub(r'\s*```', '', cleaned)
    
    # Remove preamble text before JSON (like "Here is the mind map in JSON format:")
    # Find the first { character
    first_brace = cleaned.find('{')
    if first_brace > 0:
        cleaned = cleaned[first_brace:]
    
    cleaned = cleaned.strip()
    
    # Direct JSON parse
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict) and "nodes" in data:
            return data
    except json.JSONDecodeError:
        pass

    # Brace matching extraction (string-aware)
    try:
        start = cleaned.find('{')
        if start != -1:
            depth = 0
            end = start
            in_string = False
            escape_next = False
            for i, c in enumerate(cleaned[start:], start):
                if escape_next:
                    escape_next = False
                    continue
                if c == '\\':
                    escape_next = True
                    continue
                if c == '"' and not escape_next:
                    in_string = not in_string
                    continue
                if not in_string:
                    if c == '{':
                        depth += 1
                    elif c == '}':
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
            
            json_str = cleaned[start:end]
            json_str = _remove_trailing_commas_outside_strings(json_str)
            
            data = json.loads(json_str)
            if isinstance(data, dict) and "nodes" in data:
                return data
    except (json.JSONDecodeError, Exception):
        pass

    # Text fallback - build simple mindmap from content
    try:
        nodes = []
        lines = response_text.strip().split('\n')
        node_id = 1
        for line in lines:
            line = line.strip()
            if not line or line.startswith('{') or line.startswith('['):
                continue
            match = re.match(r'^[\-\*\d\.\)]+\s*(.+)', line)
            if not match:
                label_match = re.search(r'"label"\s*:\s*"([^"]+)"', line)
                if label_match:
                    label = label_match.group(1).strip()[:50]
                    if label and len(label) > 2:
                        nodes.append({"id": str(node_id), "label": label, "children": []})
                        node_id += 1
            else:
                label = match.group(1).strip()[:50]
                if label and len(label) > 2:
                    nodes.append({"id": str(node_id), "label": label, "children": []})
                    node_id += 1
            if node_id > 8:
                break
        
        if nodes:
            return {"title": "Document Overview", "nodes": nodes}
    except Exception:
        pass

    return None


def validate_and_fix_nodes(nodes: List[dict], prefix: str = "") -> List[dict]:
    """Ensure all nodes have proper IDs and structure."""
    fixed = []
    for i, node in enumerate(nodes):
        node_id = node.get("id", f"{prefix}{i + 1}")
        fixed_node = {
            "id": str(node_id),
            "label": node.get("label", "Untitled")
        }
        if node.get("children"):
            fixed_node["children"] = validate_and_fix_nodes(
                node["children"], 
                f"{node_id}."
            )
        fixed.append(fixed_node)
    return fixed


@router.get("/conversations/{conversation_id}/mindmap", response_model=MindMapResponse)
def get_mindmap(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get the mind map for a conversation."""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    mindmap = (
        db.query(MindMap)
        .filter(MindMap.conversation_id == conversation_id)
        .first()
    )
    
    if not mindmap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mind map not found")
    
    source_count = db.query(Document).filter(
        Document.conversation_id == conversation_id,
        Document.is_active == True
    ).count()
    
    try:
        nodes_data = json.loads(mindmap.data_json)
    except (json.JSONDecodeError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid mind map data format: {str(e)}"
        )
    
    return MindMapResponse(
        id=mindmap.id,
        conversation_id=mindmap.conversation_id,
        title=mindmap.title,
        nodes=nodes_data.get("nodes", []),
        source_count=source_count,
        created_at=mindmap.created_at,
        updated_at=mindmap.updated_at
    )


@router.post("/conversations/{conversation_id}/mindmap/generate", response_model=MindMapResponse)
async def generate_mindmap(
    conversation_id: int,
    request: MindMapGenerateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Generate a mind map from conversation documents using LLM."""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    # Query chunks only from active documents
    chunks = (
        db.query(DocumentChunk)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(
            DocumentChunk.conversation_id == conversation_id,
            Document.conversation_id == conversation_id,
            Document.is_active == True
        )
        .order_by(DocumentChunk.chunk_index.asc())
        .all()
    )
    
    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No documents found in this conversation to generate mind map from"
        )
    
    source_count = db.query(Document).filter(
        Document.conversation_id == conversation_id,
        Document.is_active == True
    ).count()
    
    is_local = (conversation.llm_mode or "api") == "local"
    context_limit = 8000 if is_local else 30000
    
    context = "\n\n".join([chunk.content for chunk in chunks])
    context = context[:context_limit]
    
    # Use simpler prompt for local models
    if is_local:
        prompt = """You are a helpful assistant. Analyze the document below and create a mind map.

You MUST respond with ONLY a JSON object in this exact format (no other text before or after):
{"title": "Document Title", "nodes": [{"id": "1", "label": "Topic 1", "children": [{"id": "1.1", "label": "Subtopic"}]}, {"id": "2", "label": "Topic 2", "children": []}]}

Document content:
""" + context[:3000]
    else:
        prompt = MINDMAP_PROMPT.format(context=context)
    
    llm_client = get_llm_client(conversation.llm_mode, request.cloud_model)
    
    try:
        if is_local:
            async with LocalModeLock(timeout=180.0):
                response_text = await llm_client.generate_simple_response(prompt)
        else:
            result = await asyncio.wait_for(
                llm_client.generate_response(prompt, [], [], ""),
                timeout=180.0
            )
            if result and isinstance(result, dict):
                response_text = result.get("response", "")
            else:
                response_text = ""
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama is busy with another request. Please wait a moment and try again."
        )
    except Exception as e:
        logger.exception("Failed to generate mind map: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate mind map"
        )
    
    mindmap_data = parse_mindmap_response(response_text)
    
    if not mindmap_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse mind map response from LLM"
        )
    
    title = mindmap_data.get("title", conversation.title)
    nodes = validate_and_fix_nodes(mindmap_data.get("nodes", []))
    
    data_json = json.dumps({"nodes": nodes})
    
    existing = db.query(MindMap).filter(MindMap.conversation_id == conversation_id).first()
    
    if existing:
        existing.title = title
        existing.data_json = data_json
        db.commit()
        db.refresh(existing)
        mindmap = existing
    else:
        try:
            mindmap = MindMap(
                conversation_id=conversation_id,
                title=title,
                data_json=data_json
            )
            db.add(mindmap)
            db.commit()
            db.refresh(mindmap)
        except IntegrityError:
            db.rollback()
            existing = db.query(MindMap).filter(MindMap.conversation_id == conversation_id).first()
            if existing is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create or retrieve mind map due to concurrent access"
                )
            existing.title = title
            existing.data_json = data_json
            db.commit()
            db.refresh(existing)
            mindmap = existing
    
    return MindMapResponse(
        id=mindmap.id,
        conversation_id=mindmap.conversation_id,
        title=mindmap.title,
        nodes=nodes,
        source_count=source_count,
        created_at=mindmap.created_at,
        updated_at=mindmap.updated_at
    )


@router.delete("/conversations/{conversation_id}/mindmap", status_code=status.HTTP_204_NO_CONTENT)
def delete_mindmap(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete the mind map for a conversation."""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    db.query(MindMap).filter(MindMap.conversation_id == conversation_id).delete()
    db.commit()
