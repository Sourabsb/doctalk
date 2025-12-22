from typing import List
import json
import re
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, DocumentChunk, Flashcard
from ..models.schemas import FlashcardResponse, FlashcardListResponse, FlashcardGenerateRequest
from ..utils.llm_router import get_llm_client

router = APIRouter(tags=["flashcards"])


FLASHCARD_PROMPT = """Based on the following document content, generate 15 to 20 flashcards for studying.
Each flashcard should have a "front" (a short question) and a "back" (a concise answer).
Cover the ENTIRE document - include key concepts, definitions, important facts, and main ideas from all sections.

IMPORTANT: Respond ONLY with valid JSON in the following format, nothing else:
[
    {{"front": "Question 1?", "back": "Answer 1"}},
    {{"front": "Question 2?", "back": "Answer 2"}},
    ...
]

Document Content:
{context}

Generate diverse, meaningful flashcards covering all major topics from the document."""


def parse_flashcards_response(response_text: str) -> List[dict]:
    """Parse LLM response to extract flashcard data."""
    print(f"[Flashcards] Parsing response (len={len(response_text)}): {response_text[:200]}...")

    # Strategy 1: Direct JSON parse
    try:
        data = json.loads(response_text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "flashcards" in data:
            return data["flashcards"]
    except json.JSONDecodeError:
        pass

    # Strategy 2: Regex extraction of the first valid JSON list
    try:
        # Non-greedy match for arrays
        matches = re.finditer(r'\[[\s\S]*?\]', response_text)
        for match in matches:
            try:
                data = json.loads(match.group())
                if isinstance(data, list) and len(data) > 0:
                    print("[Flashcards] Successfully extracted JSON list via regex")
                    return data
            except json.JSONDecodeError:
                continue
    except Exception as e:
        print(f"[Flashcards] Regex parsing error: {e}")
    
    # Strategy 3: Text fallback
    flashcards = []
    lines = response_text.strip().split('\n')
    current_front = None
    
    for line in lines:
        line = line.strip()
        if not line: continue
        # Handle various Q/A formats
        if re.match(r'^(Q|Front|Question)\d?[:\.]', line, re.I):
             parts = re.split(r'[:\.]', line, 1)
             if len(parts) > 1: current_front = parts[1].strip()
        elif re.match(r'^(A|Back|Answer)\d?[:\.]', line, re.I) and current_front:
             parts = re.split(r'[:\.]', line, 1)
             if len(parts) > 1:
                 back = parts[1].strip()
                 flashcards.append({"front": current_front, "back": back})
                 current_front = None
    
    if flashcards:
        print(f"[Flashcards] Parsed {len(flashcards)} cards via text fallback")
        return flashcards

    print("[Flashcards] Failed to parse any flashcards")
    return []


@router.get("/conversations/{conversation_id}/flashcards", response_model=FlashcardListResponse)
def get_flashcards(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all flashcards for a conversation."""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    flashcards = (
        db.query(Flashcard)
        .filter(Flashcard.conversation_id == conversation_id)
        .order_by(Flashcard.order_index.asc())
        .all()
    )
    
    return FlashcardListResponse(flashcards=flashcards)


@router.post("/conversations/{conversation_id}/flashcards/generate", response_model=FlashcardListResponse)
async def generate_flashcards(
    conversation_id: int,
    request: FlashcardGenerateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Generate flashcards from conversation documents using LLM."""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    # Get all chunks to cover entire document
    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.conversation_id == conversation_id)
        .order_by(DocumentChunk.chunk_index.asc())
        .all()
    )
    
    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No documents found in this conversation to generate flashcards from"
        )
    
    # Get existing flashcard questions to avoid duplicates
    existing_flashcards = (
        db.query(Flashcard)
        .filter(Flashcard.conversation_id == conversation_id)
        .all()
    )
    existing_questions = [fc.front for fc in existing_flashcards]
    
    # Use more context for comprehensive coverage (adjust for local/cloud)
    is_local = (conversation.llm_mode or "api") == "local"
    context_limit = 8000 if is_local else 30000
    
    context = "\n\n".join([chunk.content for chunk in chunks])
    context = context[:context_limit]
    
    # Adjust prompt for local mode to be faster (fewer cards)
    base_prompt = FLASHCARD_PROMPT
    if is_local:
        # Force strict behavior for local model
        # NOTE: JSON braces must be doubled ({{ }}) to escape them in Python's .format()
        base_prompt = """Based on the document content, generate exactly 10 flashcards.
IMPORTANT: Respond with a raw JSON list ONLY. Do not write "Here are the flashcards" or any other text.
Format:
[
    {{"front": "Question?", "back": "Answer"}},
    ...
]

Content:
{context}
"""
        print(f"[Local Mode] Using strict 5-card JSON prompt. Context len: {len(context)}")
    else:
        print(f"[Cloud Mode] Using standard prompt. Context len: {len(context)}")

    # Build prompt with existing questions to avoid
    if existing_questions:
        questions_list = "\n".join([f"- {q}" for q in existing_questions])
        prompt = base_prompt.format(context=context) + f"\n\nDo NOT reuse these questions:\n{questions_list}"
    else:
        prompt = base_prompt.format(context=context)
    
    llm_client = get_llm_client(conversation.llm_mode, request.cloud_model)
    
    try:
        result = await llm_client.generate_response(
            prompt,
            [],
            [],
            ""
        )
        response_text = result.get("response", "")
        response_text = result.get("response", "")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate flashcards: {str(e)}"
        )
    
    flashcard_data = parse_flashcards_response(response_text)
    
    if not flashcard_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse flashcard response from LLM"
        )
    
    # Get current max order_index to append new cards
    max_order = db.query(Flashcard).filter(
        Flashcard.conversation_id == conversation_id
    ).count()
    
    new_flashcards = []
    for i, fc in enumerate(flashcard_data):
        flashcard = Flashcard(
            conversation_id=conversation_id,
            front=fc.get("front", ""),
            back=fc.get("back", ""),
            order_index=max_order + i
        )
        db.add(flashcard)
        new_flashcards.append(flashcard)
    
    db.commit()
    
    for fc in new_flashcards:
        db.refresh(fc)
    
    # Return ALL flashcards for the conversation
    all_flashcards = (
        db.query(Flashcard)
        .filter(Flashcard.conversation_id == conversation_id)
        .order_by(Flashcard.order_index.asc())
        .all()
    )
    
    return FlashcardListResponse(flashcards=all_flashcards)


@router.delete("/conversations/{conversation_id}/flashcards/{flashcard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flashcard(
    conversation_id: int,
    flashcard_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a single flashcard."""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    flashcard = (
        db.query(Flashcard)
        .filter(Flashcard.id == flashcard_id, Flashcard.conversation_id == conversation_id)
        .first()
    )
    
    if not flashcard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found")
    
    db.delete(flashcard)
    db.commit()


@router.delete("/conversations/{conversation_id}/flashcards", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_flashcards(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete all flashcards for a conversation."""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    db.query(Flashcard).filter(Flashcard.conversation_id == conversation_id).delete()
    db.commit()
