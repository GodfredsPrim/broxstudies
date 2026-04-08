# Ghana SHS AI Question Generator

An AI-powered web application that generates exam questions for Ghana Secondary School students using Retrieval-Augmented Generation (RAG), analyzing patterns in past questions to create realistic practice questions.

## Features

- **PDF Upload**: Upload syllabi, past questions, and textbooks in PDF format
- **Pattern Analysis**: Analyze patterns and trends from historical exam questions
- **AI Question Generation**: Generate new questions based on identified patterns
- **Multi-Subject Support**: Mathematics, English, Science, Social Studies, ICT, and Electives
- **Multiple Question Types**: Multiple choice, short answer, essay, and true/false questions
- **Difficulty Levels**: Generate questions at easy, medium, and hard difficulty levels
- **Real-time Processing**: Asynchronous PDF processing and question generation

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **LangChain** - LLM orchestration framework
- **OpenAI API** - Large language model for question generation
- **FAISS** - Vector database for semantic search
- **PyPDF2** - PDF processing
- **SQLite** - Local database

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **TypeScript** - Type-safe JavaScript
- **Axios** - HTTP client

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application entry
│   │   ├── config.py            # Configuration and settings
│   │   ├── models.py            # Pydantic models
│   │   ├── routes/              # API endpoints
│   │   │   ├── uploads.py       # File upload endpoints
│   │   │   ├── questions.py     # Question generation endpoints
│   │   │   └── analysis.py      # Pattern analysis endpoints
│   │   ├── services/            # Business logic
│   │   │   ├── pdf_processor.py # PDF text extraction
│   │   │   ├── rag_engine.py    # RAG pipeline
│   │   │   └── question_generator.py  # Question generation
│   │   └── utils/
│   │       └── embeddings.py    # Embedding utilities
│   ├── requirements.txt         # Python dependencies
│   └── .env.example            # Environment template
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Main app component
│   │   ├── main.tsx            # React entry point
│   │   ├── index.css           # Global styles
│   │   ├── components/
│   │   │   ├── UploadPDF.tsx   # File upload component
│   │   │   ├── QuestionGenerator.tsx  # Question generation UI
│   │   │   └── AnalysisDashboard.tsx # Pattern analysis UI
│   │   └── services/
│   │       └── api.ts          # API client
│   ├── package.json            # Node dependencies
│   ├── vite.config.ts          # Vite configuration
│   ├── tsconfig.json           # TypeScript config
│   └── index.html             # HTML template
├── README.md                   # This file
└── .gitignore                 # Git ignore rules
```

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm or yarn
- OpenAI API key

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
```

3. Activate virtual environment (Windows):
```bash
venv\Scripts\activate
```

Or on macOS/Linux:
```bash
source venv/bin/activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Create `.env` file:
```bash
cp .env.example .env
```

6. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=your-api-key-here
DATABASE_URL=sqlite:///./gh_shs.db
```

7. Run the server:
```bash
uvicorn app.main:app --reload
```

Backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

Frontend will be available at `http://localhost:5173`

## API Endpoints

### Upload Files
- `POST /api/uploads/pdf` - Upload PDF file
- `GET /api/uploads/status` - Get upload status

### Question Generation
- `POST /api/questions/generate` - Generate questions
- `GET /api/questions/subjects` - Get available subjects
- `GET /api/questions/question-types` - Get question types

### Pattern Analysis
- `GET /api/analysis/patterns/{subject}` - Analyze patterns
- `GET /api/analysis/topics/{subject}` - Get topics
- `POST /api/analysis/index` - Rebuild vector index

## Usage Guide

### 1. Upload Files

1. Go to **Upload Files** tab
2. Select file type (Syllabus, Past Questions, or Textbook)
3. Choose subject
4. Upload PDF file
5. Wait for processing confirmation

### 2. Generate Questions

1. Go to **Generate Questions** tab
2. Select subject and question type
3. Set number of questions and difficulty level
4. Click **Generate Questions**
5. Review generated questions with explanations

### 3. Analyze Patterns

1. Go to **Pattern Analysis** tab
2. Select subject
3. Click **Analyze Patterns**
4. View common topics, distribution, and patterns

## Environment Variables

```
OPENAI_API_KEY          # Your OpenAI API key
OPENAI_MODEL            # GPT model to use (default: gpt-4-turbo-preview)
DATABASE_URL            # SQLite database URL
CORS_ORIGINS            # Allowed CORS origins
PDF_UPLOAD_DIR          # Directory for PDF uploads
CHUNK_SIZE              # Text chunk size for processing
CHUNK_OVERLAP           # Overlap between chunks
VECTOR_STORE_DIR        # Directory for vector store
EMBEDDING_MODEL         # Embedding model to use
MAX_QUESTIONS           # Maximum questions to generate
MIN_CONFIDENCE_SCORE    # Minimum confidence for patterns
```

## Development

### Building for Production

Backend:
```bash
cd backend
pip install -r requirements.txt
```

Frontend:
```bash
cd frontend
npm install
npm run build
```

### Running Tests

```bash
# Backend
pytest backend/

# Frontend
npm run test --prefix frontend
```

## Troubleshooting

**Issue: "OpenAI API key not found"**
- Ensure `.env` file exists in backend directory
- Check that `OPENAI_API_KEY` is set correctly

**Issue: PDF upload fails**
- Ensure file is valid PDF
- Check that `uploads/pdfs` directory exists
- Verify file size is reasonable

**Issue: Frontend can't connect to backend**
- Ensure backend is running on `localhost:8000`
- Check CORS origins in `.env` include `localhost:5173`
- Clear browser cache and restart frontend

## Performance Considerations

- **Vector Store**: FAISS stores vectors in memory; for large datasets, consider Pinecone or Weaviate
- **API Rate Limits**: OpenAI API has rate limits; implement caching for frequently generated questions
- **PDF Processing**: Large PDFs may take time; consider async job queue for bulk uploads

## Future Enhancements

- [ ] User authentication and progress tracking
- [ ] Custom question templates
- [ ] Export questions to PDF/Word
- [ ] Collaborative editing for instructors
- [ ] Mobile app for Android/iOS
- [ ] Integration with Learning Management Systems (LMS)
- [ ] Support for more file formats (Word, PowerPoint)
- [ ] Real-time collaboration features

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## Support

For support, please contact the development team or open an issue on the repository.

## Acknowledgments

- Ghana Education Service for curriculum guidance
- OpenAI for GPT models
- LangChain community for RAG patterns
- FastAPI and React communities
