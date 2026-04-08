# File Organization Guide

## Directory Structure Setup

Your backend is now configured to **automatically load all PDF files** on startup. Follow this structure:

```
backend/
├── data/
│   ├── syllabi/
│   │   ├── Mathematics_Year1.pdf
│   │   ├── Mathematics_Year2.pdf
│   │   ├── English_Year1.pdf
│   │   ├── Physics_Year1.pdf
│   │   └── ... (all other subject syllabi)
│   │
│   ├── past_questions/
│   │   ├── Mathematics_2010-2015.pdf
│   │   ├── Mathematics_2016-2020.pdf
│   │   ├── Mathematics_2021-2025.pdf
│   │   ├── English_2010-2025.pdf
│   │   ├── Physics_2010-2025.pdf
│   │   └── ... (all past question papers by subject and year)
│   │
│   └── textbooks/
│       ├── Mathematics_Year1.pdf
│       ├── Mathematics_Year2.pdf
│       ├── Physics_Year1.pdf
│       ├── Chemistry_Year1.pdf
│       ├── Biology_Year1.pdf
│       └── ... (all new curriculum textbooks)
│
├── vector_store/          (auto-generated FAISS index)
├── app/
│   ├── services/
│   │   ├── batch_loader.py    (NEW - auto-loads all PDFs)
│   │   ├── pdf_processor.py
│   │   ├── rag_engine.py
│   │   └── question_generator.py
│   ├── main.py            (UPDATED - triggers auto-loading)
│   ├── config.py          (UPDATED - added DATA_DIR)
│   └── ...
└── requirements.txt
```

## How It Works

1. **Application Startup**
   - When you start the backend server, the `lifespan` event triggers `BatchLoader`
   - All PDF files in `backend/data/*` directories are processed
   - Files are converted to text chunks and stored in FAISS vector index
   - See logs for detailed loading progress

2. **File Naming Convention**
   ```
   The system auto-detects subject from filename keywords:
   - "math" → Mathematics
   - "english" → English  
   - "physics", "chemistry", "biology" → Science
   - "social", "civics", "history", "geography" → Social Studies
   - "ict", "computing" → ICT
   - "music", "art", "french", "arabic", "pe" → Electives
   ```

## Setup Steps

### 1. Copy Your PDF Files
```bash
# Place your files in these directories:
backend/data/syllabi/              # Syllabi only
backend/data/past_questions/        # Past exam papers (2010-2025)
backend/data/textbooks/             # New curriculum textbooks (Year 1 & 2)
```

### 2. Set OpenAI API Key
Create or update `backend/.env`:
```env
OPENAI_API_KEY=sk-your-api-key-here
```

### 3. Start Backend
```bash
cd backend
python -m uvicorn app.main:app --reload
```

**Check success in server logs:**
```
🚀 Starting Ghana SHS AI Question Generator
📚 Document Loading Summary:
  Syllabi: 8/8 loaded
  Past Questions: 15/15 loaded
  Textbooks: 16/16 loaded
✓ Uvicorn running on http://127.0.0.1:8000
```

### 4. Check Document Status
```bash
curl http://localhost:8000/api/status/documents
```

Response:
```json
{
  "status": "loaded",
  "documents": {
    "syllabi": {
      "type": "syllabus",
      "total_files": 8,
      "successful": 8,
      "files": [...]
    },
    "past_questions": {...},
    "textbooks": {...}
  }
}
```

## What Changed

### Backend Changes
- ✅ **New**: `batch_loader.py` - Auto-loads all local PDFs on startup
- ✅ **Updated**: `config.py` - Added `DATA_DIR` path and `AUTO_LOAD_ON_STARTUP` flag
- ✅ **Updated**: `main.py` - Triggers `BatchLoader` in startup lifecycle
- ✅ **New**: `/api/status/documents` endpoint to check loaded documents

### Frontend Changes  
- ✅ **Removed**: "Upload Files" tab (students don't upload files)
- ✅ **Default**: App now starts with "Generate Questions" tab
- ✅ **Kept**: "Pattern Analysis" tab for insights

## Features

### ✨ Auto-Loading Benefits
1. **Zero Manual Steps** - All files load automatically on startup
2. **Caching** - FAISS vector index persists between restarts
3. **Logging** - Detailed logs show exactly what loaded successfully
4. **Error Handling** - Failed files are logged but don't crash the app

### ✨ Student Experience
1. Students open the app
2. All course materials are already indexed and ready
3. Click "Generate Questions" and instantly get AI-powered practice questions
4. View "Pattern Analysis" for insights into exam patterns

## Maintenance

### Adding New Files
1. Copy new PDF to appropriate `backend/data/` subdirectory
2. Restart backend server
3. New files are automatically indexed

### Force Rebuild Vector Index
```bash
# Delete the vector store
rm -rf backend/vector_store/

# Restart backend - will rebuild from scratch
python -m uvicorn app.main:app --reload
```

### Disable Auto-Loading (Optional)
Edit `backend/app/config.py`:
```python
AUTO_LOAD_ON_STARTUP: bool = False  # Set to False
```

## Recommended File Organization Tips

- Use clear naming: `Mathematics_Syllabus_Year1.pdf`
- Group past questions by subject and year range: `Mathematics_PastQuestions_2020-2025.pdf`
- Keep textbook naming consistent: `Physics_Textbook_Year1.pdf`
- Use uppercase first letters for better sorting

---

**Your project is now optimized for local data with zero-upload students workflow!** 🎓
