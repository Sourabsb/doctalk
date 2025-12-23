from typing import List
import json
import re
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, DocumentChunk, MindMap, Document
from ..models.schemas import MindMapResponse, MindMapGenerateRequest, MindMapNode
from ..utils.llm_router import get_llm_client

router = APIRouter(tags=["mindmap"])

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
    """Parse LLM response to extract mind map data."""
    # Strategy 1: Direct JSON parse
    try:
        data = json.loads(response_text)
        if isinstance(data, dict) and "nodes" in data:
            return data
    except json.JSONDecodeError:
        pass

    # Strategy 2: Extract JSON object from text
    try:
        match = re.search(r'\{[\s\S]*\}', response_text)
        if match:
            data = json.loads(match.group())
            if isinstance(data, dict) and "nodes" in data:
                return data
    except (json.JSONDecodeError, AttributeError):
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
    
    nodes_data = json.loads(mindmap.data_json)
    
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
    
    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.conversation_id == conversation_id)
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
    
    prompt = MINDMAP_PROMPT.format(context=context)
    
    llm_client = get_llm_client(conversation.llm_mode, request.cloud_model)
    
    try:
        result = await llm_client.generate_response(prompt, [], [], "")
        response_text = result.get("response", "")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate mind map: {str(e)}"
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
        mindmap = MindMap(
            conversation_id=conversation_id,
            title=title,
            data_json=data_json
        )
        db.add(mindmap)
        db.commit()
        db.refresh(mindmap)
    
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
