import io
import re
import urllib.parse
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor

from ..models.schemas import DownloadRequest
from ..dependencies import get_db, get_current_user
from ..models.db_models import Conversation, ChatMessage

router = APIRouter()


def _safe_filename(title: str) -> str:
    """Sanitise a conversation title for use as a filename."""
    name = re.sub(r'[\\/*?:"<>|]', "", title or "chat").strip() or "chat"
    return urllib.parse.quote(name, safe=" ._-")


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
            "sources": message.sources_json.split("||") if message.sources_json else [],
            "timestamp": message.created_at,
        }
        chat_history.append(entry)

    conv_title = conversation.title or "Chat"
    safe_name = _safe_filename(conv_title)

    if download_request.format == "txt":
        content = _generate_txt_content(chat_history, conv_title)
        return StreamingResponse(
            io.StringIO(content),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.txt"'}
        )
    elif download_request.format == "pdf":
        pdf_content = _generate_pdf_content(chat_history, conv_title)
        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'}
        )
    elif download_request.format == "json":
        import json
        json_data = _generate_json_content(chat_history, conv_title)
        return StreamingResponse(
            io.StringIO(json.dumps(json_data, indent=2, default=str)),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.json"'}
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")


# ── JSON generation ─────────────────────────────────────────────────

def _generate_json_content(chat_history: list, title: str) -> dict:
    messages = []
    for entry in chat_history:
        msg = {
            "role": entry["role"],
            "content": entry["content"],
            "timestamp": entry.get("timestamp"),
        }
        if entry.get("sources"):
            msg["sources"] = entry["sources"]
        messages.append(msg)
    return {
        "title": title,
        "exported_at": datetime.now().isoformat(),
        "message_count": len(messages),
        "messages": messages,
    }


# ── TXT generation ──────────────────────────────────────────────────

def _format_ts(ts) -> str:
    if ts is None:
        return ""
    if isinstance(ts, datetime):
        return ts.strftime("%b %d, %Y  %I:%M %p")
    return str(ts)


def _generate_txt_content(chat_history: list, title: str) -> str:
    lines: list[str] = []
    lines.append(f"  {title}")
    lines.append("=" * 60)
    lines.append(f"  Exported on {datetime.now().strftime('%b %d, %Y at %I:%M %p')}")
    lines.append(f"  Total messages: {len(chat_history)}")
    lines.append("=" * 60)
    lines.append("")

    for entry in chat_history:
        role = entry["role"]
        label = "You" if role == "user" else "DocTalk"
        ts = _format_ts(entry.get("timestamp"))
        header = f"[{label}]" + (f"  ({ts})" if ts else "")
        lines.append(header)
        lines.append(entry["content"])
        if entry.get("sources"):
            lines.append(f"  Sources: {', '.join(entry['sources'])}")
        lines.append("")
        lines.append("-" * 50)
        lines.append("")

    lines.append("— End of conversation —")
    return "\n".join(lines)


# ── PDF generation ──────────────────────────────────────────────────

_BLACK = HexColor("#000000")
_GRAY  = HexColor("#555555")
_LGRAY = HexColor("#AAAAAA")

_ML  = 54
_MR  = 54
_MB  = 56
_MT  = 46

_BODY_FONT     = "Helvetica"
_BODY_BOLD     = "Helvetica-Bold"
_BODY_ITALIC   = "Helvetica-Oblique"
_BODY_SIZE     = 10
_BODY_LEADING  = 14.5
_SMALL_SIZE    = 8.5
_SMALL_LEADING = 11.5
_CODE_SIZE     = 9
_CODE_LEADING  = 13
_LABEL_SIZE    = 11
_H1_SIZE       = 13
_H2_SIZE       = 11.5
_BULLET_INDENT = 14


def _generate_pdf_content(chat_history: list, title: str) -> bytes:
    from reportlab.pdfbase.pdfmetrics import stringWidth

    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    W, H = letter
    usable = W - _ML - _MR
    page_num = 1

    y = H - _MT

    def _page_footer():
        p.saveState()
        p.setFont(_BODY_FONT, 7.5)
        p.setFillColor(_LGRAY)
        p.drawCentredString(W / 2, 28, f"— {page_num} —")
        p.restoreState()

    def _new_page():
        nonlocal y, page_num
        _page_footer()
        p.showPage()
        page_num += 1
        y = H - _MT
        p.setFont(_BODY_ITALIC, 8)
        p.setFillColor(_LGRAY)
        p.drawString(_ML, y, f"{title}  (continued)")
        y -= 6
        p.setStrokeColor(_LGRAY)
        p.setLineWidth(0.3)
        p.line(_ML, y, W - _MR, y)
        y -= 18

    def _ensure(need: float):
        if y - need < _MB:
            _new_page()

    def _tw(txt: str, font: str, size: float) -> float:
        return stringWidth(txt, font, size)

    def _wrap(text: str, font: str, size: float, max_w: float) -> list[str]:
        if not text:
            return [""]
        words = text.split()
        lines: list[str] = []
        cur = ""
        for word in words:
            test = cur + (" " if cur else "") + word
            if _tw(test, font, size) <= max_w:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                if _tw(word, font, size) <= max_w:
                    cur = word
                else:
                    while _tw(word, font, size) > max_w:
                        for i in range(len(word), 0, -1):
                            if _tw(word[:i], font, size) <= max_w:
                                lines.append(word[:i])
                                word = word[i:]
                                break
                        else:
                            lines.append(word[0])
                            word = word[1:]
                    cur = word
        if cur:
            lines.append(cur)
        return lines or [""]

    # title
    p.setFont(_BODY_BOLD, 18)
    p.setFillColor(_BLACK)
    for tl in _wrap(title, _BODY_BOLD, 18, usable):
        p.drawString(_ML, y, tl)
        y -= 24
    y += 4

    export_date = datetime.now().strftime("%b %d, %Y  •  %I:%M %p")
    p.setFont(_BODY_FONT, 8)
    p.setFillColor(_GRAY)
    p.drawString(_ML, y, f"Exported {export_date}   •   {len(chat_history)} messages")
    y -= 10

    p.setStrokeColor(_LGRAY)
    p.setLineWidth(0.5)
    p.line(_ML, y, W - _MR, y)
    y -= 24

    content_left = _ML + 4
    content_max  = usable - 8

    for entry in chat_history:
        is_user = entry["role"] == "user"
        label = "You:" if is_user else "DocTalk:"
        ts = _format_ts(entry.get("timestamp"))

        segments = _parse_markdown(entry["content"])

        rendered_lines: list[dict] = []
        for seg in segments:
            kind = seg["type"]
            text = seg.get("text", "")

            if kind == "heading1":
                for wl in _wrap(text, _BODY_BOLD, _H1_SIZE, content_max):
                    rendered_lines.append({"text": wl, "font": _BODY_BOLD, "size": _H1_SIZE, "leading": 18, "indent": 0})
                rendered_lines.append({"text": "", "font": _BODY_FONT, "size": 4, "leading": 4, "indent": 0})
            elif kind == "heading2":
                for wl in _wrap(text, _BODY_BOLD, _H2_SIZE, content_max):
                    rendered_lines.append({"text": wl, "font": _BODY_BOLD, "size": _H2_SIZE, "leading": 16, "indent": 0})
                rendered_lines.append({"text": "", "font": _BODY_FONT, "size": 3, "leading": 3, "indent": 0})
            elif kind == "bullet":
                first = True
                for wl in _wrap(text, _BODY_FONT, _BODY_SIZE, content_max - _BULLET_INDENT):
                    prefix = "•  " if first else ""
                    rendered_lines.append({"text": prefix + wl, "font": _BODY_FONT, "size": _BODY_SIZE,
                                           "leading": _BODY_LEADING, "indent": _BULLET_INDENT if not first else 0})
                    first = False
            elif kind == "numbered":
                num = seg.get("num", "1")
                first = True
                for wl in _wrap(text, _BODY_FONT, _BODY_SIZE, content_max - _BULLET_INDENT):
                    prefix = f"{num}.  " if first else ""
                    rendered_lines.append({"text": prefix + wl, "font": _BODY_FONT, "size": _BODY_SIZE,
                                           "leading": _BODY_LEADING, "indent": _BULLET_INDENT if not first else 0})
                    first = False
            elif kind == "code":
                for cl in text.split("\n"):
                    for wl in _wrap(cl or " ", "Courier", _CODE_SIZE, content_max - 12):
                        rendered_lines.append({"text": wl, "font": "Courier", "size": _CODE_SIZE,
                                               "leading": _CODE_LEADING, "indent": 8})
                rendered_lines.append({"text": "", "font": _BODY_FONT, "size": 4, "leading": 4, "indent": 0})
            elif kind == "bold":
                for wl in _wrap(text, _BODY_BOLD, _BODY_SIZE, content_max):
                    rendered_lines.append({"text": wl, "font": _BODY_BOLD, "size": _BODY_SIZE,
                                           "leading": _BODY_LEADING, "indent": 0})
            elif kind == "italic":
                for wl in _wrap(text, _BODY_ITALIC, _BODY_SIZE, content_max):
                    rendered_lines.append({"text": wl, "font": _BODY_ITALIC, "size": _BODY_SIZE,
                                           "leading": _BODY_LEADING, "indent": 0})
            elif kind == "blank":
                rendered_lines.append({"text": "", "font": _BODY_FONT, "size": 5, "leading": 7, "indent": 0})
            else:
                for wl in _wrap(text, _BODY_FONT, _BODY_SIZE, content_max):
                    rendered_lines.append({"text": wl, "font": _BODY_FONT, "size": _BODY_SIZE,
                                           "leading": _BODY_LEADING, "indent": 0})

        source_rendered: list[dict] = []
        if entry.get("sources"):
            src_text = "Sources: " + ", ".join(entry["sources"])
            for wl in _wrap(src_text, _BODY_ITALIC, _SMALL_SIZE, content_max):
                source_rendered.append({"text": wl, "font": _BODY_ITALIC, "size": _SMALL_SIZE,
                                        "leading": _SMALL_LEADING, "indent": 0})

        header_h = 20
        content_h = sum(rl["leading"] for rl in rendered_lines)
        source_h  = (sum(sl["leading"] for sl in source_rendered) + 4) if source_rendered else 0
        total_h = header_h + content_h + source_h + 10

        _ensure(min(total_h, 60))

        p.setFont(_BODY_BOLD, _LABEL_SIZE)
        p.setFillColor(_BLACK)
        p.drawString(_ML, y, label)
        if ts:
            p.setFont(_BODY_FONT, 7.5)
            p.setFillColor(_LGRAY)
            p.drawRightString(W - _MR, y, ts)
        y -= header_h

        all_lines = rendered_lines + source_rendered
        for li, rl in enumerate(all_lines):
            if li == len(rendered_lines) and source_rendered:
                y -= 4

            if y - rl["leading"] < _MB:
                _new_page()

            if rl["text"]:
                p.setFillColor(_GRAY if li >= len(rendered_lines) else _BLACK)
                p.setFont(rl["font"], rl["size"])
                p.drawString(content_left + rl["indent"], y, rl["text"])

            y -= rl["leading"]

        y -= 6

        p.setStrokeColor(_LGRAY)
        p.setLineWidth(0.2)
        p.line(_ML, y, W - _MR, y)
        y -= 16

    _ensure(30)
    p.setFont(_BODY_ITALIC, 8)
    p.setFillColor(_LGRAY)
    p.drawCentredString(W / 2, y, "— End of conversation —")

    _page_footer()
    p.save()
    buffer.seek(0)
    return buffer.getvalue()


def _parse_markdown(text: str) -> list[dict]:
    if not text:
        return [{"type": "text", "text": ""}]

    segments: list[dict] = []
    lines = text.split("\n")
    in_code = False
    code_buf: list[str] = []

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("```"):
            if in_code:
                segments.append({"type": "code", "text": "\n".join(code_buf)})
                code_buf = []
                in_code = False
            else:
                in_code = True
            continue

        if in_code:
            code_buf.append(line)
            continue

        if not stripped:
            segments.append({"type": "blank"})
            continue

        if stripped.startswith("## "):
            segments.append({"type": "heading2", "text": stripped[3:]})
            continue
        if stripped.startswith("# "):
            segments.append({"type": "heading1", "text": stripped[2:]})
            continue

        bullet_match = re.match(r'^[-*]\s+(.+)$', stripped)
        if bullet_match and not stripped.startswith("**"):
            segments.append({"type": "bullet", "text": bullet_match.group(1)})
            continue

        num_match = re.match(r'^(\d+)[.)]\s+(.+)$', stripped)
        if num_match:
            segments.append({"type": "numbered", "text": num_match.group(2), "num": num_match.group(1)})
            continue

        bold_match = re.match(r'^\*\*(.+?)\*\*$', stripped)
        if bold_match:
            segments.append({"type": "bold", "text": bold_match.group(1)})
            continue

        italic_match = re.match(r'^\*(.+?)\*$', stripped)
        if italic_match:
            segments.append({"type": "italic", "text": italic_match.group(1)})
            continue

        cleaned = re.sub(r'\*\*(.+?)\*\*', r'\1', stripped)
        cleaned = re.sub(r'\*(.+?)\*', r'\1', cleaned)
        cleaned = re.sub(r'`(.+?)`', r'\1', cleaned)
        segments.append({"type": "text", "text": cleaned})

    if in_code and code_buf:
        segments.append({"type": "code", "text": "\n".join(code_buf)})

    return segments or [{"type": "text", "text": ""}]
