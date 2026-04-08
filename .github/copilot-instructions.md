# Ghana SHS Curriculum AI Question Generator

## Project Overview
Web application that generates AI-powered exam questions for Ghana Secondary School students based on:
- Course syllabi (PDF)
- Historical past questions (PDF)
- Textbook content (PDF)

Uses RAG (Retrieval-Augmented Generation) to analyze patterns in past questions and generate realistic practice questions.

## Tech Stack
- **Backend**: FastAPI with LangChain for RAG
- **Frontend**: React + Vite
- **Database**: SQLite (local)
- **PDF Processing**: PyPDF2, pydantic
- **LLM**: OpenAI API
- **Vector Store**: FAISS for embeddings

## Project Structure
```
.
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── config.py
│   │   ├── routes/
│   │   │   ├── questions.py
│   │   │   ├── uploads.py
│   │   │   └── analysis.py
│   │   ├── services/
│   │   │   ├── pdf_processor.py
│   │   │   ├── rag_engine.py
│   │   │   └── question_generator.py
│   │   └── utils/
│   │       └── embeddings.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── UploadPDF.tsx
│   │   │   ├── QuestionGenerator.tsx
│   │   │   └── AnalysisDashboard.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
├── README.md
└── .gitignore
```

## Setup Instructions

### Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### Frontend Setup
```bash
cd frontend
npm install
```

### Environment Setup
Create `.env` file in backend folder with:
```
OPENAI_API_KEY=your-key-here
DATABASE_URL=sqlite:///./gh_shs.db
```

## Commands
- `npm run dev` - Start frontend dev server
- `uvicorn app.main:app --reload` - Start backend server
