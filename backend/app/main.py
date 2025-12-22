from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import datetime
from .routes import upload, chat, download, auth, conversations, add_document, messages
from .config import GEMINI_API_KEY, AZURE_VISION_ENDPOINT, AZURE_VISION_KEY
from .database import Base, engine, run_migrations

app = FastAPI(title="Document Chat API")

run_migrations()
Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://doctalk-delta.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth")
app.include_router(upload.router, prefix="/api")
app.include_router(add_document.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(download.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")
app.include_router(messages.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Document Chat API is running"}

@app.get("/health")
async def health():
    # Check if necessary services are available
    api_status = {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": str(datetime.datetime.now()),
        "services": {
            "gemini": GEMINI_API_KEY is not None,
            "azure_vision": AZURE_VISION_ENDPOINT is not None and AZURE_VISION_KEY is not None
        }
    }
    return api_status
