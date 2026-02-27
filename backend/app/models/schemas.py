from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict

class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: EmailStr
    name: Optional[str]
    created_at: datetime

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: Optional[str] = None

class SignInRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=8)
    new_password: str = Field(min_length=8)

class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=8)

class ChatRequest(BaseModel):
    message: str
    conversation_id: int
    regenerate: bool = False  # If true, don't create a new user message
    edit_group_id: Optional[int] = None  # Links edited messages to original
    is_edit: bool = False  # Indicates this is an edited message
    cloud_model: Optional[str] = None  # 'gemini' (default) or 'groq' when in cloud mode
    parent_message_id: Optional[int] = None  # Explicit parent for branching - message to chain from

class ResponseVariant(BaseModel):
    id: int
    version_index: int
    content: str
    sources: List[str]
    source_chunks: Optional[List['SourceWithChunk']] = None
    is_active: bool
    created_at: datetime
    prompt_content: Optional[str] = None

class SourceWithChunk(BaseModel):
    index: int
    source: str
    chunk: str

class ChatResponse(BaseModel):
    response: str
    sources: List[str]
    source_chunks: Optional[List[SourceWithChunk]] = None
    user_message: Optional['ChatMessageResponse'] = None
    assistant_message: Optional['ChatMessageResponse'] = None
    response_versions: Optional[List[ResponseVariant]] = None

class UploadResponse(BaseModel):
    message: str
    conversation_id: int
    processed_files: List[str]
    llm_mode: Optional[str] = "api"
    embedding_model: Optional[str] = "custom"

class DownloadRequest(BaseModel):
    conversation_id: int
    format: str = "txt"

class ConversationSummary(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    last_message: Optional[str]
    llm_mode: Optional[str] = "api"
    embedding_model: Optional[str] = "custom"

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    sources: List[str]
    source_chunks: Optional[List[SourceWithChunk]] = None
    created_at: datetime
    is_edited: Optional[int] = 0
    reply_to_message_id: Optional[int] = None
    version_index: Optional[int] = 1
    is_archived: Optional[bool] = False
    response_versions: Optional[List[ResponseVariant]] = None
    edit_group_id: Optional[int] = None  # Groups edited messages together

class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    filename: str
    content: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    doc_type: Optional[str] = 'file'
    is_active: Optional[bool] = True
    has_embeddings: Optional[bool] = False

class ConversationDetailResponse(BaseModel):
    conversation: ConversationSummary
    messages: List[ChatMessageResponse]
    documents: List[DocumentResponse]
    llm_mode: Optional[str] = None
    embedding_model: Optional[str] = None


class FlashcardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    front: str
    back: str
    order_index: int
    created_at: datetime


class FlashcardListResponse(BaseModel):
    flashcards: List[FlashcardResponse]


class FlashcardGenerateRequest(BaseModel):
    cloud_model: Optional[str] = None


class MindMapNode(BaseModel):
    id: str
    label: str
    children: Optional[List['MindMapNode']] = None

class MindMapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    conversation_id: int
    title: str
    nodes: List[MindMapNode]
    source_count: int
    created_at: datetime
    updated_at: datetime

class MindMapGenerateRequest(BaseModel):
    cloud_model: Optional[str] = None


MindMapNode.model_rebuild()
ResponseVariant.model_rebuild()
ChatMessageResponse.model_rebuild()
ChatResponse.model_rebuild()
