# 📦 File Organization Guide with ZIP Support

## Recommended Structure

Your backend now supports **both direct PDFs and ZIPped PDFs**. Here's the optimal organization:

### Option 1: ZIP by Subject (Recommended for 2010-2025 data)

```
backend/data/
├── past_questions/
│   ├── Mathematics_2010-2025.zip
│   │   └── (contains: Math_2010.pdf, Math_2011.pdf, ..., Math_2025.pdf)
│   ├── English_2010-2025.zip
│   │   └── (contains: English_2010.pdf, English_2011.pdf, ..., English_2025.pdf)
│   ├── Physics_2010-2025.zip
│   ├── Chemistry_2010-2025.zip
│   ├── Biology_2010-2025.zip
│   ├── IntegratedScience_2010-2025.zip
│   ├── SocialStudies_2010-2025.zip
│   └── ICT_2010-2025.zip
│
├── syllabi/
│   ├── Mathematics_Syllabi.zip
│   │   └── (contains: Math_Syllabus_Year1.pdf, Math_Syllabus_Year2.pdf)
│   ├── English_Syllabi.zip
│   ├── Science_Syllabi.zip
│   ├── SocialStudies_Syllabi.zip
│   ├── ICT_Syllabi.zip
│   └── Electives_Syllabi.zip
│
└── textbooks/
    ├── Mathematics_Year1_Year2.zip
    │   └── (contains: Math_Year1.pdf, Math_Year2.pdf)
    ├── English_NewCurriculum.zip
    ├── Physics_Year1_Year2.zip
    ├── Chemistry_Year1_Year2.zip
    ├── Biology_Year1_Year2.zip
    ├── SocialStudies_Year1_Year2.zip
    ├── ICT_Year1_Year2.zip
    └── Electives_Year1_Year2.zip
```

### Option 2: Directory Structure Inside ZIP (for nested organization)

```
Mathematics_2010-2025.zip
└── Mathematics/
    ├── 2010/
    │   ├── WASSCE_2010_May-June.pdf
    │   └── WASSCE_2010_Nov-Dec.pdf
    ├── 2011/
    │   ├── WASSCE_2011_May-June.pdf
    │   └── WASSCE_2011_Nov-Dec.pdf
    └── ...
    └── 2025/
        ├── WASSCE_2025_May-June.pdf
        └── WASSCE_2025_Nov-Dec.pdf
```
✅ **Loader will find and process all PDFs recursively inside ZIP**

## How It Works

### ✨ ZIP Processing Flow
1. Loader finds `.zip` files in your directories
2. Extracts to temporary folder
3. Searches recursively for all `.pdf` files
4. Auto-detects subject from ZIP filename (e.g., `Mathematics_2010-2025.zip` → Math)
5. Falls back to PDF filename if ZIP name doesn't have subject
6. Cleans up temporary files
7. Adds all chunks to FAISS vector store

### Example Loading Output
```
📚 Document Loading Summary:
  Syllabi: 6/6 loaded
    ✓ Mathematics_Syllabi.zip (2 PDFs, 450 chunks)
    ✓ English_Syllabi.zip (2 PDFs, 380 chunks)
    ✓ Science_Syllabi.zip (3 PDFs, 520 chunks)
    ...

  Past Questions: 8/8 loaded
    ✓ Mathematics_2010-2025.zip (16 PDFs, 3200 chunks)
    ✓ English_2010-2025.zip (16 PDFs, 2800 chunks)
    ...

  Textbooks: 8/8 loaded
    ✓ Mathematics_Year1_Year2.zip (2 PDFs, 600 chunks)
    ✓ Physics_Year1_Year2.zip (2 PDFs, 580 chunks)
    ...
```

## Setup Instructions

### Step 1: Create ZIP Files

**For Past Questions (by subject):**
```bash
# Example: Windows
# Select all Math past questions from 2010-2025
# Right-click → Compress → Mathematics_2010-2025.zip

# Or use command line:
# Windows PowerShell
Compress-Archive -Path "C:\path\to\Math\*.pdf" -DestinationPath "Mathematics_2010-2025.zip"
```

**For Syllabi (group by subject):**
```bash
# Include Year 1 and Year 2 syllabi together
# Mathematics_Syllabus_Year1.pdf + Mathematics_Syllabus_Year2.pdf
# → Mathematics_Syllabi.zip
```

**For Textbooks:**
```bash
# Group Year 1 and Year 2 together by subject
# Physics_Textbook_Year1.pdf + Physics_Textbook_Year2.pdf
# → Physics_Year1_Year2.zip
```

### Step 2: Place ZIP Files
```
backend/data/
├── past_questions/     → Drop all subject ZIP files here
├── syllabi/            → Drop all subject ZIP files here
└── textbooks/          → Drop all subject ZIP files here
```

### Step 3: Set Environment
```bash
# backend/.env
OPENAI_API_KEY=sk-your-api-key-here
```

### Step 4: Start Backend
```bash
cd backend
python -m uvicorn app.main:app --reload
```

## Subject Detection Keywords

The loader recognizes these keywords in ZIP filenames:

```
"math" or "mathematics"    → Mathematics
"english"                  → English
"physics"                  → Science
"chemistry"                → Science
"biology"                  → Science
"integrated science"       → Science
"social" or "civics"       → Social Studies
"history" or "geography"   → Social Studies
"ict" or "computing"       → ICT
"music", "art", "pe"       → Electives
"french", "arabic"         → Electives
```

## Recommended ZIP Naming Patterns

✅ **Good:**
```
Mathematics_2010-2025.zip
English_Syllabi_Year1_Year2.zip
Physics_OldCurriculum.zip
Biology_PastQuestions_2020-2025.zip
```

❌ **Avoid:**
```
test.zip (unclear)
2010-2025.zip (no subject)
Final_final_FINAL.zip (confusing)
```

## Workflow Advantages

### ✅ What You Get
- **Organized**: Each subject grouped together
- **Compressed**: Easier to transfer files
- **Scalable**: Add more subjects easily
- **Automatic**: No manual extraction needed
- **Nested Support**: Subdirectories inside ZIP work fine
- **Fast**: All files processed on startup, cached in FAISS

### 📊 Performance Notes
- Loading **~20 subject ZIPs** typically takes: **2-5 minutes** (first time)
- Vector index cached: **subsequent startups are instant**
- Each startup: logs show exact files and chunk counts
- Failed files noted but don't crash the app

## File Size Tips

### Optimal ZIP Sizes
- **Per ZIP**: 50-500 MB (manageable extraction & processing)
- **Total Data**: Can handle 1+ GB without issues
- **Chunk Count**: System optimized for 10,000+ chunks

### If You Have Large Files
- **Option 1**: Split large subject ZIPs by year range
  ```
  Mathematics_2010-2017.zip
  Mathematics_2018-2025.zip
  ```
- **Option 2**: Keep as-is, loader handles it all

## Testing ZIP Support

Before deploying, test with 1-2 ZIPs:

```bash
# 1. Place test ZIP in backend/data/past_questions/
# 2. Start backend
# 3. Check logs for:
#    - "Extracting and processing" messages
#    - "✓ Loaded" confirmations
# 4. Verify via API:

curl http://localhost:8000/api/status/documents

# Should show files marked with "source": "zip"
```

## What Changed in Batch Loader

- ✅ Now processes `.zip` files in addition to `.pdf` files
- ✅ Extracts ZIPs to temporary folders automatically
- ✅ Searches recursively inside for all PDFs
- ✅ Cleans up temporary files after processing
- ✅ Handles both flat and nested ZIP structures
- ✅ Shows source ("direct" or "zip") in loading report

---

**Ready to organize and upload your files? All PDFs + ZIPs are now supported!** 📦
