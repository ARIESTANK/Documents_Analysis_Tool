# Marginal — AI Research Assistant (Demo Build)

A working full-stack implementation of the AI Research Assistant demo: **React** frontend, **Flask** backend, **Supabase** (Postgres + pgvector + Storage) for the database, and **Google Gemini (free tier)** for generation, with local embeddings so no embedding API key is required. Every AI component used here — the LLM and the embedding model — is free to run.

```
research-assistant/
├── backend/          Flask API (PDF parsing, RAG, LLM calls)
├── frontend/          React (Vite + Tailwind) UI
└── supabase/
    └── schema.sql     Run this once in your Supabase project
```

---

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it.
   This enables `pgvector`, creates all tables (`projects`, `documents`, `chunks`, `chat_messages`, `summaries`, `comparisons`), the `match_chunks` similarity-search function, and a private `papers` storage bucket.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → used as `SUPABASE_URL`
   - `service_role` key (secret, backend-only) → used as `SUPABASE_SERVICE_KEY`
   - `anon public` key → only needed if you extend the frontend to call Supabase directly

> The embedding column is `vector(384)` to match the default local embedding model (`BAAI/bge-small-en-v1.5`). If you swap in a different embedding model, update both `EMBEDDING_DIM` in `backend/.env` **and** the `vector(384)` dimensions in `supabase/schema.sql`.

---

## 2. Backend setup (Flask)

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# then edit .env and fill in:
#   SUPABASE_URL, SUPABASE_SERVICE_KEY   <- from step 1
#   ANTHROPIC_API_KEY                    <- console.anthropic.com

python app.py
```

The API runs at `http://localhost:5000`. Check `http://localhost:5000/api/health` — it reports any missing environment variables.

**Note on OCR:** scanned PDFs use `pytesseract`, which needs the Tesseract binary installed on your machine (`brew install tesseract` / `apt install tesseract-ocr`). Text-based PDFs work without it.

---

## 3. Frontend setup (React)

```bash
cd frontend
npm install
cp .env.example .env   # defaults work out of the box with the Vite proxy
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api/*` to your Flask backend on port 5000 (see `vite.config.js`).

---

## 4. Try the demo flow

1. **Create a workspace** on the dashboard (e.g. "Medical AI Literature Review").
2. **Upload a PDF** — a real paper on any topic works. Watch the upload progress and processing status.
3. Once status shows **Ready**, open the **Chat** tab and ask:
   - *"Summarize this paper"*
   - *"Explain the CNN section"* (or whatever technical section it has)
   - *"What dataset was used?"*
   Answers stream back with page/section citations, which also pin to the **margin notes** panel on the right.
4. Open the **Summary** tab and click **Generate summary** for a structured Problem / Method / Results / Limitations / Key Contributions breakdown.
5. Upload a second paper, check both boxes in the papers list, and open the **Compare** tab to generate a side-by-side comparison table with an AI insight paragraph.

---

## 5. Architecture notes

| Layer | Choice | Why |
|---|---|---|
| PDF parsing | PyMuPDF, with `pytesseract` OCR fallback | Fast, accurate text + layout extraction; OCR only kicks in for scanned pages |
| Chunking | Custom word-window chunker, section-aware | Keeps chunks aligned to detected headings for cleaner citations |
| Embeddings | `sentence-transformers` (`BAAI/bge-small-en-v1.5`), local | No extra API key/cost; runs on CPU |
| Vector storage & search | Supabase Postgres + `pgvector`, `match_chunks` RPC | Keeps retrieval inside the DB — no separate vector service to run |
| LLM | Claude via `anthropic` SDK | Used for chat answers, section explanations, summaries, and comparisons |
| Auth-ready | `projects.user_id` + RLS policies included | Wire up Supabase Auth on the frontend when you're ready for multi-user |

## 6. Extending this demo

- Move `process_pdf` + `store_chunks` in `routes/documents.py` into a background task (Celery/RQ) for large PDFs so uploads don't block the request.
- Add Supabase Auth on the frontend and pass the user's JWT to the backend to properly scope `projects.user_id` instead of relying solely on the service key.
- Add a real PDF viewer (e.g. `react-pdf`) in place of the outline-only `MarginNotes` panel to jump directly to cited pages."# Documents_Analysis_Tool" 
