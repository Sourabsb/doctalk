from typing import List
import json
import re
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, DocumentChunk, Flashcard
from ..models.schemas import FlashcardResponse, FlashcardListResponse, FlashcardGenerateRequest
from ..utils.llm_router import get_llm_client
from ..utils.ollama_client import LocalModeLock

router = APIRouter(tags=["flashcards"])


FLASHCARD_PROMPT = """Based on the following document content, generate 15 to 20 flashcards for studying.
Each flashcard should have a "front" (a short question, max 50 characters) and a "back" (a concise answer, max 60 characters).
Cover the ENTIRE document - include key concepts, definitions, important facts, and main ideas from all sections.

IMPORTANT: Respond ONLY with valid JSON in the following format, nothing else:
[
    {{"front": "Question 1?", "back": "Answer 1"}},
    {{"front": "Question 2?", "back": "Answer 2"}},
    ...
]

Document Content:
{context}

Generate diverse, meaningful flashcards covering all major topics from the document. Keep answers SHORT (under 60 characters)."""


def parse_flashcards_response(response_text: str) -> List[dict]:
    """Parse LLM response to extract flashcard data with multiple fallback strategies."""
    
    # Clean up common issues
    cleaned = response_text.strip()
    
    # Remove markdown code blocks
    cleaned = re.sub(r'```(?:json)?\s*', '', cleaned)
    cleaned = re.sub(r'\s*```', '', cleaned)
    
    # Remove preamble text before JSON array
    first_bracket = cleaned.find('[')
    if first_bracket > 0:
        cleaned = cleaned[first_bracket:]
    
    cleaned = cleaned.strip()

    # Direct JSON parse
    try:
        data = json.loads(cleaned)
        if isinstance(data, list) and len(data) > 0:
            return data
        if isinstance(data, dict) and "flashcards" in data:
            return data["flashcards"]
    except json.JSONDecodeError:
        pass

    # Bracket matching extraction (string-aware)
    try:
        start = cleaned.find('[')
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
                    if c == '[':
                        depth += 1
                    elif c == ']':
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
            
            json_str = cleaned[start:end]
            json_str = re.sub(r',\s*([\]\}])', r'\1', json_str)
            
            data = json.loads(json_str)
            if isinstance(data, list) and len(data) > 0:
                return data
    except (json.JSONDecodeError, Exception):
        pass
    
    # Regex extraction fallback (handles escaped quotes)
    try:
        flashcards = []
        pattern = r'\{\s*"front"\s*:\s*"((?:\\.|[^"])*)"\s*,\s*"back"\s*:\s*"((?:\\.|[^"])*)"\s*\}'
        matches = re.findall(pattern, response_text)
        for front, back in matches:
            # Use json.loads for robust unescaping of all escape sequences
            try:
                front = json.loads(f'"{front}"')
                back = json.loads(f'"{back}"')
            except json.JSONDecodeError:
                # Fallback: unescape in correct order (backslashes first, then quotes)
                front = front.replace('\\\\', '\\').replace('\\"', '"')
                back = back.replace('\\\\', '\\').replace('\\"', '"')
            flashcards.append({"front": front, "back": back})
        
        if flashcards:
            return flashcards
    except Exception:
        pass
    
    # Text format fallback
    flashcards = []
    lines = response_text.strip().split('\n')
    current_front = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if re.match(r'^(Q|Front|Question)\d?[:\.]', line, re.I):
            parts = re.split(r'[:\.]', line, 1)
            if len(parts) > 1:
                current_front = parts[1].strip()
        elif re.match(r'^(A|Back|Answer)\d?[:\.]', line, re.I) and current_front:
            parts = re.split(r'[:\.]', line, 1)
            if len(parts) > 1:
                back = parts[1].strip()
                flashcards.append({"front": current_front, "back": back})
                current_front = None
    
    return flashcards


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
        # Force strict behavior for local model - very clear prompt
        # Calculate space for existing questions (reserve ~500 chars for deduplication)
        max_context_len = 3500
        truncated_context = context[:max_context_len]
        
        # Build deduplication instruction if there are existing questions
        dedup_instruction = ""
        if existing_questions:
            # Truncate existing questions to fit within remaining context budget
            existing_qs_text = "; ".join(existing_questions[-15:])  # Last 15 questions
            if len(existing_qs_text) > 300:
                existing_qs_text = existing_qs_text[:300] + "..."
            dedup_instruction = f"\n\nAVOID these existing questions: {existing_qs_text}"
        
        prompt = f"""You are a flashcard generator. Create 6-8 high-quality study flashcards from the document below.

RULES:
1. "front" = A clear, specific QUESTION about a key concept, skill, or fact
2. "back" = A precise, informative ANSWER (not just a name or single word)
3. Focus on: definitions, explanations, key concepts, technical terms, important facts
4. Questions should test understanding, not just recall names
5. Answers should be educational and explain the concept

BAD examples (avoid these):
- "Who created X?" -> "Person" (too vague, not educational)
- "What is the name of...?" -> "Some name" (useless for learning)

GOOD examples:
- "What is LoRA in machine learning?" -> "LoRA (Low-Rank Adaptation) is a technique for efficiently fine-tuning large language models by adding small trainable matrices to attention layers, reducing memory and compute requirements while maintaining model quality."
- "What does RAG stand for and what is it used for?" -> "RAG (Retrieval-Augmented Generation) combines document retrieval with LLM generation to answer questions using external knowledge sources, improving accuracy and reducing hallucinations."
{dedup_instruction}
Output ONLY valid JSON array, no other text:
[{{"front": "Question?", "back": "Detailed educational answer"}}]

Document:
{truncated_context}"""
    else:
        # Build prompt with existing questions to avoid
        if existing_questions:
            questions_list = "\n".join([f"- {q}" for q in existing_questions])
            prompt = base_prompt.format(context=context) + f"\n\nDo NOT reuse these questions:\n{questions_list}"
        else:
            prompt = base_prompt.format(context=context)
    
    llm_client = get_llm_client(conversation.llm_mode, request.cloud_model)
    
    try:
        if is_local:
            async with LocalModeLock(timeout=180.0):
                response_text = await llm_client.generate_simple_response(prompt)
        else:
            result = await llm_client.generate_response(
                prompt,
                [],
                [],
                ""
            )
            response_text = result.get("response", "")
    except TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama is busy with another request. Please wait a moment and try again."
        )
    except Exception as e:
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
