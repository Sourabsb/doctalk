# DocTalk - AI Document Chat Application

🚀 A full-featured web application for intelligent conversations with your documents. Upload files, ask questions, generate mind maps, flashcards, and get AI-powered insights — all with persistent history and source citations.

## ✨ Features

- 👤 **Accounts & Auth**: Sign up / sign in with JWT-secured sessions (FastAPI + SQLite), profile management, password change, and account deletion
- 🗂️ **Persistent History**: Every conversation, message, and document chunk is stored and reloadable without re-uploading
- 📁 **Multi-format Upload**: PDF, TXT, DOCX, Images (PNG, JPG, JPEG) with Azure OCR support. Add more documents to existing conversations
- 🧠 **AI Conversations**: Multi-LLM support (Gemini, Groq, Ollama/llama.cpp) with streaming responses and response regeneration
- 🔍 **Semantic Search**: Qdrant vector database with sentence-transformer embeddings for accurate context retrieval
- 🗺️ **Mind Maps**: Auto-generate interactive mind maps from your documents with hierarchical topic extraction
- 🃏 **Flashcards**: AI-generated flashcards from document content for study and review
- 📝 **Notes**: Create, edit, and convert notes within conversations
- 🗣️ **Voice Input**: Dictate questions via speech-to-text for hands-free document queries
- 📥 **Export Options**: Download any chat as PDF, TXT, or JSON
- 🔒 **Document Toggle**: Enable/disable specific documents per conversation for focused Q&A
- 🎨 **Responsive UI**: Clean modern interface with conversation sidebar, upload modal, and chat experience that works on desktop and mobile

## 🛠️ Tech Stack

### Frontend
- **React 18** + Vite
- **Tailwind CSS** + shadcn/ui components
- **Axios** for API calls

### Backend
- **FastAPI** (High-performance Python API)
- **LangChain** (Document chunking)
- **SQLite + SQLAlchemy** (Persistent storage for users, conversations, documents, and chat history)
- **Qdrant** (Vector database for semantic search)
- **Sentence Transformers** (Custom embedding model for document embeddings)
- **Multi-LLM Support** (Google Gemini, Groq, Ollama/llama.cpp)
- **Azure Computer Vision** (OCR for image documents)
- **ReportLab** (PDF generation)

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/Sourabsb/DocTalk.git
cd DocTalk
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment Configuration
Create `backend/.env`:
```env
AZURE_VISION_ENDPOINT=https://your-endpoint.cognitiveservices.azure.com/
AZURE_VISION_KEY=your_azure_vision_key
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key          # Optional: for Groq LLM
JWT_SECRET=super_secret_token
DATABASE_URL=sqlite:///./app.db
QDRANT_HOST=localhost                     # Qdrant vector DB
QDRANT_PORT=6333
```

### 4. Frontend Setup
```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```

### 5. Run Application
```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

Visit **http://localhost:3000** to start using DocTalk! 🎉

## 📖 Usage

1. **Create an Account / Sign In**: Access your personal DocTalk workspace
2. **Upload Documents**: Select or drag & drop files (PDF, TXT, DOCX, Images) and optionally name the conversation
3. **Ask or Continue**: Chat immediately or return later — DocTalk remembers every chunk and response
4. **Add More Documents**: Append additional files to any existing conversation
5. **Use Voice**: Click the mic button to dictate your question via speech-to-text
6. **Mind Maps & Flashcards**: Generate interactive mind maps or study flashcards from your documents
7. **Take Notes**: Create and manage notes within conversations, convert them as needed
8. **Summaries & Sources**: Ask for summaries or targeted questions with clear source citations
9. **Export History**: Download the full chat as PDF, TXT, or JSON from the header

## 🚀 Deployment

This project can be deployed on **Render** for both frontend and backend services.

## 📁 Project Structure
```
DocTalk/
├── backend/              # FastAPI application
│   ├── app/
│   │   ├── main.py      # Application entry point
│   │   ├── config.py    # Configuration settings
│   │   ├── database.py  # Database setup
│   │   ├── dependencies.py # Dependency injection
│   │   ├── models/      # DB models & Pydantic schemas
│   │   ├── routes/      # API endpoints (auth, chat, upload, mindmap, flashcards, etc.)
│   │   ├── sessions/    # Session management
│   │   └── utils/       # Embeddings, LLM clients, document processing, security
│   ├── qdrant_data/     # Qdrant vector database storage
│   ├── requirements.txt # Python dependencies
│   └── .env            # Environment variables
├── frontend/            # React application
│   ├── src/
│   │   ├── components/  # React components (Chat, Sidebar, MindMap, Upload, etc.)
│   │   ├── context/     # React contexts (Auth)
│   │   ├── pages/       # Page components (Dashboard, Landing, SignIn, SignUp)
│   │   ├── styles/      # CSS styling
│   │   └── utils/       # API utilities
│   ├── package.json    # Node dependencies
│   └── .env           # Frontend environment
└── README.md          # This file
```

## 🔧 API Endpoints

### Auth
- `POST /auth/signup` - Create a new DocTalk user
- `POST /auth/signin` - Retrieve an access token
- `GET /auth/verify-token` - Verify JWT token
- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update user profile
- `POST /auth/change-password` - Change password
- `DELETE /auth/account` - Delete account

### Documents & Chat
- `POST /api/upload` - Upload and process documents into a new conversation
- `POST /api/add-documents/{id}` - Add documents to an existing conversation
- `POST /api/chat` - Send a message for a stored conversation
- `POST /api/chat/stream` - Stream a chat response
- `PUT /api/messages/{id}` - Edit/regenerate a message
- `DELETE /api/messages/{id}` - Delete a message

### Conversations
- `GET /api/conversations` - List a user's conversations
- `GET /api/conversations/{id}` - Fetch full history + documents for a conversation
- `DELETE /api/conversations/{id}` - Remove a conversation and its data
- `DELETE /api/conversations/{id}/documents/{doc_id}` - Remove a document from a conversation
- `PATCH /api/conversations/{id}/documents/{doc_id}/toggle` - Enable/disable a document

### Notes
- `POST /api/conversations/{id}/notes` - Create a note
- `PUT /api/conversations/{id}/notes/{note_id}` - Update a note
- `POST /api/conversations/{id}/notes/{note_id}/convert` - Convert a note
- `POST /api/conversations/{id}/notes/{note_id}/unconvert` - Unconvert a note

### Mind Maps & Flashcards
- `GET /api/conversations/{id}/mindmap` - Get mind map for a conversation
- `POST /api/conversations/{id}/mindmap/generate` - Generate a mind map
- `DELETE /api/conversations/{id}/mindmap` - Delete a mind map
- `GET /api/conversations/{id}/flashcards` - Get flashcards
- `POST /api/conversations/{id}/flashcards/generate` - Generate flashcards
- `DELETE /api/conversations/{id}/flashcards/{card_id}` - Delete a flashcard
- `DELETE /api/conversations/{id}/flashcards` - Delete all flashcards

### Export
- `POST /api/download` - Export chat history (PDF, TXT, or JSON)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

**Made with ❤️ using React, FastAPI, Qdrant, and AI**
