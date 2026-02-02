from typing import List, Dict, Any
import json
import re
import random
import logging

logger = logging.getLogger(__name__)


def _select_intelligent_chunks(all_chunks: List[Dict], target_count: int = 8) -> List[Dict]:
    """
    Select document chunks using stratified sampling for optimal coverage.
    
    Strategy:
    - Beginning sections (10%): Capture introductory content
    - Ending sections (10%): Capture conclusions and summaries
    - Middle sections (80%): Random sampling for diverse content coverage
    
    This approach ensures representative content selection while managing token limits.
    """
    if len(all_chunks) <= target_count:
        return all_chunks
    
    selected = []
    
    # Ensure we don't exceed available chunks
    first_section_count = min(max(1, int(target_count * 0.1)), len(all_chunks) // 3)
    last_section_count = min(max(1, int(target_count * 0.1)), len(all_chunks) // 3)
    
    # Calculate available middle chunks BEFORE setting random_count
    available_middle = len(all_chunks) - first_section_count - last_section_count
    random_count = min(target_count - first_section_count - last_section_count, available_middle)
    random_count = max(0, random_count)  # Ensure non-negative
    
    selected.extend(all_chunks[:first_section_count])
    if last_section_count > 0:
        selected.extend(all_chunks[-last_section_count:])
    
    middle_chunks = all_chunks[first_section_count:-last_section_count] if last_section_count > 0 else all_chunks[first_section_count:]
    if middle_chunks and random_count > 0:
        random_selection = random.sample(middle_chunks, min(random_count, len(middle_chunks)))
        selected.extend(random_selection)
    
    return selected


async def hierarchical_summarization(
    all_chunks: List[Dict],
    llm_client: Any,
    batch_size: int,
    is_local: bool = False
) -> str:
    """
    Generate document summary using hierarchical processing.
    
    For large documents in local mode, implements batch processing to handle
    token limitations while maintaining comprehensive coverage.
    
    Args:
        all_chunks: List of document chunks with content and metadata
        llm_client: LLM client instance for generation
        batch_size: Number of chunks to process per batch
        is_local: Whether using local GPU mode (enables batching)
    
    Returns:
        Comprehensive summary text
    """
    
    chunk_count = 30  # Same as cloud for comprehensive coverage
    selected_chunks = _select_intelligent_chunks(all_chunks, target_count=chunk_count)
    
    mode_label = "LOCAL/GPU" if is_local else "CLOUD/API"
    print(f"[Summary] Selected {len(selected_chunks)} chunks from {len(all_chunks)} total ({mode_label} MODE)")
    context = "\n\n".join([chunk["content"] for chunk in selected_chunks])
    
    prompt = f"""Provide a comprehensive summary of the following document content:

{context}

Create a detailed summary covering all major topics, key points, and important details."""
    
    # Batching for local mode with limited token context
    if is_local and len(selected_chunks) > 6:
        # Process in batches for better coverage
        batch_size = 6
        batches = [selected_chunks[i:i+batch_size] for i in range(0, len(selected_chunks), batch_size)]
        print(f"[Summary] Using {len(batches)} batches for comprehensive coverage")
        
        summaries = []
        for batch_idx, batch in enumerate(batches):
            context = "\n\n".join([chunk["content"] for chunk in batch])
            batch_prompt = f"""Summarize the following document section:

{context}

Provide a concise summary of key points and main ideas."""
            
            print(f"[Summary] Processing batch {batch_idx + 1}/{len(batches)}...")
            response = await llm_client.generate_simple_response(batch_prompt)
            if response and response.strip():
                summaries.append(response.strip())
        
        # Combine all partial summaries
        if summaries:
            combined = "\n\n".join(summaries)
            final_prompt = f"""Combine these partial summaries into one comprehensive summary:

{combined}

Create a unified, well-structured summary covering all major topics."""
            
            print(f"[Summary] Merging {len(summaries)} partial summaries...")
            final_summary = await llm_client.generate_simple_response(final_prompt)
            print(f"[Summary] Final summary: {len(final_summary)} chars")
            return final_summary
        else:
            return "Unable to generate summary."
    else:
        # Single-shot for cloud or small documents
        import time
        start_time = time.time()
        print(f"[Summary] Starting generation...")
        response_text = await llm_client.generate_simple_response(prompt)
        elapsed = time.time() - start_time
        print(f"[Summary] Completed in {elapsed:.2f}s")
        
        return response_text


async def hierarchical_mindmap_generation(
    all_chunks: List[Dict],
    llm_client: Any,
    batch_size: int,
    is_local: bool = False
) -> Dict:
    """
    Generate hierarchical mind map from document content.
    
    For local GPU mode with large documents, splits content into batches,
    generates partial mind maps, and merges them into a comprehensive structure.
    
    Args:
        all_chunks: List of document chunks with content and metadata
        llm_client: LLM client instance for generation
        batch_size: Number of chunks to process per batch
        is_local: Whether using local GPU mode (enables batching)
    
    Returns:
        Dictionary with 'title' and 'nodes' structure for mind map visualization
    """
    
    mindmap_prompt_template = """Analyze the following document content and generate a mind map structure.

IMPORTANT: Respond ONLY with valid JSON in the following format:
{{
    "title": "Main Topic",
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
- Create 3-6 major topics
- Each major topic should have 2-4 subtopics
- Keep labels concise (2-6 words)
- Cover all key themes

Document Content:
{context}

Generate the mind map structure."""
    
    # Batching for local mode - process in smaller chunks to work within token limits
    chunk_count = 30  # Same as cloud for comprehensive coverage
    selected_chunks = _select_intelligent_chunks(all_chunks, target_count=chunk_count)
    
    mode_label = "LOCAL/GPU" if is_local else "CLOUD/API"
    logger.info(f"[Mindmap] Selected {len(selected_chunks)} chunks from {len(all_chunks)} total ({mode_label} MODE)")
    
    # Batch processing for better results with limited tokens
    if is_local and len(selected_chunks) > 6:
        # Split into batches of 5-6 chunks each for local mode
        batch_size = 6
        batches = [selected_chunks[i:i+batch_size] for i in range(0, len(selected_chunks), batch_size)]
        logger.info(f"[Mindmap] Using {len(batches)} batches for better coverage")
        
        all_mindmaps = []
        for batch_idx, batch in enumerate(batches):
            context = "\n\n".join([chunk["content"] for chunk in batch])
            batch_prompt = mindmap_prompt_template.format(context=context)
            
            logger.info(f"[Mindmap] Processing batch {batch_idx + 1}/{len(batches)}...")
            response_text = await llm_client.generate_simple_response(batch_prompt)
            
            parsed = _parse_mindmap_response(response_text)
            if parsed.get("nodes"):
                all_mindmaps.append(parsed)
        
        # Merge all partial mindmaps
        logger.info(f"[Mindmap] Merging {len(all_mindmaps)} partial mindmaps...")
        final_mindmap = _merge_mindmaps(all_mindmaps)
        logger.info(f"[Mindmap] Final result: {len(final_mindmap.get('nodes', []))} nodes")
        return final_mindmap
    else:
        # Single-shot for cloud mode or small documents
        context = "\n\n".join([chunk["content"] for chunk in selected_chunks])
        prompt = mindmap_prompt_template.format(context=context)
        
        import time
        start_time = time.time()
        logger.info(f"[Mindmap] Starting generation...")
        
        # Use generate_simple_response since context is already in the prompt
        response_text = await llm_client.generate_simple_response(prompt)
        
        elapsed = time.time() - start_time
        logger.info(f"[Mindmap] Completed in {elapsed:.2f}s")
        logger.info(f"[Mindmap] Response length: {len(response_text)} chars")
        logger.info(f"[Mindmap] Response preview: {response_text[:300] if response_text else 'EMPTY'}...")
        
        parsed = _parse_mindmap_response(response_text)
        logger.info(f"[Mindmap] Parsed nodes: {len(parsed.get('nodes', []))}")
        return parsed


async def hierarchical_flashcard_generation(
    all_chunks: List[Dict],
    llm_client: Any,
    batch_size: int,
    target_count: int = 15,
    is_local: bool = False,
    existing_questions: List[str] = None
) -> List[Dict]:
    """Create flashcards with intelligent chunk selection and deduplication."""
    
    if existing_questions is None:
        existing_questions = []
    
    chunk_count = 30  # Same as cloud for comprehensive coverage
    selected_chunks = _select_intelligent_chunks(all_chunks, target_count=chunk_count)
    
    mode_label = "LOCAL/GPU" if is_local else "CLOUD/API"
    print(f"[Flashcards] Selected {len(selected_chunks)} chunks from {len(all_chunks)} total ({mode_label} MODE)")
    print(f"[Flashcards] Avoiding {len(existing_questions)} existing questions")
    
    flashcard_prompt_template = """Based on the following document content, generate {count} flashcards.
Each flashcard should have a "front" (question, max 50 characters) and "back" (answer, max 25 words).

RULES:
- NO citations, references, or numbers like [1], [2]
- Plain text only, no markdown
- Keep answers SHORT (under 25 words)

{existing_instruction}

IMPORTANT: Respond ONLY with valid JSON:
[
    {{"front": "Question 1?", "back": "Answer 1"}},
    {{"front": "Question 2?", "back": "Answer 2"}}
]

Document Content:
{context}

Generate the flashcards."""
    
    existing_instruction = ""
    if existing_questions:
        questions_preview = ", ".join(existing_questions[:5])
        if len(existing_questions) > 5:
            questions_preview += f"... ({len(existing_questions)} total)"
        existing_instruction = f"AVOID duplicating these existing questions: {questions_preview}"
    
    import time
    start_time = time.time()
    print(f"[Flashcards] Starting generation of {target_count} cards...")
    
    # Batching for local mode to handle large documents
    if is_local and len(selected_chunks) > 6:
        print(f"[Flashcards] Using batching with {len(selected_chunks)} chunks")
        batch_size = 6
        batches = [selected_chunks[i:i+batch_size] for i in range(0, len(selected_chunks), batch_size)]
        cards_per_batch = max(3, target_count // len(batches))
        
        all_flashcards = []
        for i, batch in enumerate(batches):
            batch_context = "\n\n".join([chunk["content"] for chunk in batch])
            batch_prompt = flashcard_prompt_template.format(
                context=batch_context,
                count=cards_per_batch,
                existing_instruction=existing_instruction
            )
            print(f"[Flashcards] Processing batch {i+1}/{len(batches)}")
            batch_response = await llm_client.generate_simple_response(batch_prompt)
            batch_cards = _parse_flashcards_response(batch_response)
            all_flashcards.extend(batch_cards)
        
        flashcards = _deduplicate_flashcards(all_flashcards, target_count)
    else:
        # Single generation for cloud or small documents
        context = "\n\n".join([chunk["content"] for chunk in selected_chunks])
        prompt = flashcard_prompt_template.format(
            context=context, 
            count=target_count,
            existing_instruction=existing_instruction
        )
        response_text = await llm_client.generate_simple_response(prompt)
        flashcards = _parse_flashcards_response(response_text)
        flashcards = _deduplicate_flashcards(flashcards, target_count)
    
    elapsed = time.time() - start_time
    print(f"[Flashcards] Completed {len(flashcards)} cards in {elapsed:.2f}s")
    
    return flashcards


def _parse_mindmap_response(response_text: str) -> Dict:
    """Parse LLM response to extract mindmap data."""
    cleaned = response_text.strip()
    cleaned = re.sub(r'```(?:json)?\s*', '', cleaned)
    cleaned = re.sub(r'\s*```', '', cleaned)
    
    first_brace = cleaned.find('{')
    if first_brace > 0:
        cleaned = cleaned[first_brace:]
    
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict) and "nodes" in data:
            return data
    except json.JSONDecodeError:
        pass
    
    return {"title": "Document Overview", "nodes": []}


def _parse_flashcards_response(response_text: str) -> List[Dict]:
    """Parse LLM response to extract flashcard data."""
    cleaned = response_text.strip()
    cleaned = re.sub(r'```(?:json)?\s*', '', cleaned)
    cleaned = re.sub(r'\s*```', '', cleaned)
    
    first_bracket = cleaned.find('[')
    if first_bracket > 0:
        cleaned = cleaned[first_bracket:]
    
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return [card for card in data if "front" in card and "back" in card]
    except json.JSONDecodeError:
        pass
    
    return []


def _merge_mindmaps(mindmaps: List[Dict]) -> Dict:
    """Merge multiple mindmaps into one comprehensive structure."""
    if not mindmaps:
        return {"title": "Document Overview", "nodes": []}
    
    merged_title = mindmaps[0].get("title", "Document Overview")
    merged_nodes = []
    node_id_counter = 1
    
    for mindmap in mindmaps:
        nodes = mindmap.get("nodes", [])
        for node in nodes:
            new_node = {
                "id": str(node_id_counter),
                "label": node.get("label", ""),
                "children": []
            }
            
            if "children" in node:
                child_counter = 1
                for child in node["children"]:
                    new_child = {
                        "id": f"{node_id_counter}.{child_counter}",
                        "label": child.get("label", "")
                    }
                    if "children" in child:
                        new_child["children"] = child["children"]
                    new_node["children"].append(new_child)
                    child_counter += 1
            
            merged_nodes.append(new_node)
            node_id_counter += 1
    
    return {"title": merged_title, "nodes": merged_nodes}


def _deduplicate_flashcards(flashcards: List[Dict], target_count: int) -> List[Dict]:
    """Remove duplicate flashcards and limit to target count."""
    seen = set()
    unique_flashcards = []
    
    for card in flashcards:
        front = card.get("front", "").strip().lower()
        if front and front not in seen:
            seen.add(front)
            unique_flashcards.append(card)
            if len(unique_flashcards) >= target_count:
                break
    
    return unique_flashcards[:target_count]
