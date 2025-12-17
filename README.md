# DocTalk - AI Document Chat Application

🚀 Simple and powerful web application for intelligent conversations with your documents using Azure Computer Vision OCR and Google Gemini AI.

## ✨ Features

- 👤 **Accounts & Auth**: Sign up / sign in with JWT-secured sessions (FastAPI + SQLite)
- 🗂️ **Persistent History**: Every conversation, message, and document chunk is stored and reloadable without re-uploading
- 📁 **Multi-format Upload**: PDF, TXT, DOCX, Images (PNG, JPG, JPEG) with Azure OCR support
- 🧠 **AI Conversations & Summaries**: Gemini 2.0 Flash answers and multi-document summaries with automatic source citations
- 🗣️ **Voice Friendly**: Dictate questions via speech-to-text and listen to AI answers with built-in text-to-speech
- 📥 **Export Options**: Download any chat as TXT or PDF
- 🎨 **Responsive UI**: Modern dark theme with history sidebar, upload flow, and chat experience that works on desktop and mobile

## 🛠️ Tech Stack

### Frontend
- **React 18** + Vite
- **Tailwind CSS** 
- **Axios** for API calls

### Backend
- **FastAPI** (High-performance Python API)
- **LangChain** (Document chunking)
- **SQLite + SQLAlchemy** (Persistent storage for users, conversations, documents, and chat history)
- **TF-IDF Similarity** (Lightweight semantic search per conversation)
- **Azure Computer Vision** (OCR)
- **Google Gemini 2.0 Flash** (AI responses)
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
JWT_SECRET=super_secret_token
DATABASE_URL=sqlite:///./app.db
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
3. **Ask or Continue**: Chat immediately or return later—DocTalk remembers every chunk and response
4. **Use Voice**: Click the voice button to dictate a prompt or the listen button to hear AI answers
5. **Summaries & Sources**: Ask for summaries or targeted questions with clear source attribution
6. **Export History**: Download the full chat as TXT or PDF straight from the header

## 🚀 Deployment

This project can be deployed on **Render** for both frontend and backend services.

## 📁 Project Structure
```
Chat/
├── backend/              # FastAPI application
│   ├── app/
│   │   ├── main.py      # Application entry point
│   │   ├── config.py    # Configuration settings
│   │   ├── models/      # Pydantic schemas
│   │   ├── routes/      # API endpoints
│   │   ├── sessions/    # Session management
│   │   └── utils/       # Core utilities
│   ├── requirements.txt # Python dependencies
│   └── .env            # Environment variables
├── frontend/            # React application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── styles/      # CSS styling
│   │   └── utils/       # Frontend utilities
│   ├── package.json    # Node dependencies
│   └── .env           # Frontend environment
└── README.md          # This file
```

## 🔧 API Endpoints

- `POST /auth/signup` - Create a new DocTalk user
- `POST /auth/signin` - Retrieve an access token
- `POST /api/upload` - Upload and process documents into a new conversation
- `POST /api/chat` - Send a message for a stored conversation
- `GET /api/conversations` - List a user's conversations
- `GET /api/conversations/{id}` - Fetch full history + documents for a conversation
- `DELETE /api/conversations/{id}` - Remove a conversation and its chunks
- `POST /api/download` - Export chat history (TXT or PDF)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

**Made with ❤️ using React, FastAPI, and Google Gemini AI**
