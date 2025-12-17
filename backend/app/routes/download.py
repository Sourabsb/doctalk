import io
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

from ..models.schemas import DownloadRequest
from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, ChatMessage

router = APIRouter()

@router.post("/download")
async def download_chat(
    download_request: DownloadRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == download_request.conversation_id, Conversation.user_id == current_user.id)
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    chat_messages = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.conversation_id == conversation.id,
            ChatMessage.is_archived == False
        )
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    if not chat_messages:
        raise HTTPException(status_code=400, detail="No chat history to download")

    chat_history = []
    for message in chat_messages:
        entry = {
            "role": message.role,
            "content": message.content,
            "sources": message.sources_json.split("||") if message.sources_json else []
        }
        chat_history.append(entry)

    if download_request.format == "txt":
        content = _generate_txt_content(chat_history)
        return StreamingResponse(
            io.StringIO(content),
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=chat_history.txt"}
        )
    elif download_request.format == "pdf":
        pdf_content = _generate_pdf_content(chat_history)
        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=chat_history.pdf"}
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")

def _pair_history(chat_history):
    pairs = []
    current_question = None
    for entry in chat_history:
        if entry["role"] == "user":
            current_question = entry
        elif entry["role"] == "assistant" and current_question:
            pairs.append({
                "question": current_question["content"],
                "answer": entry["content"],
                "sources": entry.get("sources", [])
            })
            current_question = None
    return pairs

def _generate_txt_content(chat_history):
    content = "Chat History\n" + "="*50 + "\n\n"
    pairs = _pair_history(chat_history)
    
    for i, pair in enumerate(pairs, 1):
        content += f"Q{i}: {pair['question']}\n"
        content += f"A{i}: {pair['answer']}\n"
        if pair.get('sources'):
            content += f"Sources: {', '.join(pair['sources'])}\n"
        content += "\n" + "-"*30 + "\n\n"
    
    return content

def _generate_pdf_content(chat_history):
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    y_position = height - 50
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, y_position, "Chat History")
    y_position -= 50
    pairs = _pair_history(chat_history)

    for i, pair in enumerate(pairs, 1):
        # Check if we need a new page
        if y_position < 120:
            p.showPage()
            y_position = height - 50
        
        # Question section
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, y_position, f"Question {i}:")
        y_position -= 20
        
        p.setFont("Helvetica", 10)
        user_lines = _wrap_text(pair['question'], 85)
        for line in user_lines:
            if y_position < 80:
                p.showPage()
                y_position = height - 50
            p.drawString(70, y_position, line)
            y_position -= 14
        
        y_position -= 10
        
        # Answer section
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, y_position, f"Answer {i}:")
        y_position -= 20
        
        p.setFont("Helvetica", 10)
        assistant_lines = _wrap_text(pair['answer'], 85)
        for line in assistant_lines:
            if y_position < 80:
                p.showPage()
                y_position = height - 50
            p.drawString(70, y_position, line)
            y_position -= 14
        
        # Sources section
        if pair.get('sources'):
            y_position -= 5
            p.setFont("Helvetica-Oblique", 9)
            sources_text = f"Sources: {', '.join(pair['sources'])}"
            sources_lines = _wrap_text(sources_text, 85)
            for line in sources_lines:
                if y_position < 80:
                    p.showPage()
                    y_position = height - 50
                p.drawString(70, y_position, line)
                y_position -= 12
        
        # Add separator
        y_position -= 15
        p.setStrokeColorRGB(0.7, 0.7, 0.7)
        p.line(50, y_position, width - 50, y_position)
        y_position -= 25
    
    p.save()
    buffer.seek(0)
    return buffer.getvalue()

def _wrap_text(text, max_length):
    """Wrap text to fit within specified character length"""
    if not text:
        return [""]
    
    words = text.split()
    lines = []
    current_line = ""
    
    for word in words:
        # Check if adding this word would exceed the limit
        test_line = current_line + (" " if current_line else "") + word
        if len(test_line) <= max_length:
            current_line = test_line
        else:
            # If current line has content, add it to lines
            if current_line:
                lines.append(current_line)
                current_line = word
            else:
                # Handle very long words
                if len(word) > max_length:
                    # Break long words
                    while len(word) > max_length:
                        lines.append(word[:max_length])
                        word = word[max_length:]
                    current_line = word
                else:
                    current_line = word
    
    # Add the last line if it has content
    if current_line:
        lines.append(current_line)
    
    return lines if lines else [""]
