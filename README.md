# REDLINE v2.0 — LLM Pressure Testing Framework

```
██████╗ ███████╗██████╗ ██╗     ██╗███╗   ██╗███████╗
██╔══██╗██╔════╝██╔══██╗██║     ██║████╗  ██║██╔════╝
██████╔╝█████╗  ██║  ██║██║     ██║██╔██╗ ██║█████╗
██╔══██╗██╔══╝  ██║  ██║██║     ██║██║╚██╗██║██╔══╝
██║  ██║███████╗██████╔╝███████╗██║██║ ╚████║███████╗
╚═╝  ╚═╝╚══════╝╚═════╝ ╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝
```

> Production-grade LLM red-teaming and security research framework.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite |
| Backend | FastAPI + Uvicorn |
| Database | SQLite (WAL mode, persistent) |
| Rate limiting | slowapi |
| Logging | loguru (structured, rotating) |
| Containers | Docker + Docker Compose |
| Deploy | Railway / Render (configs included) |

---

## Features

- **8 attack categories** — Jailbreak, Prompt Injection, Role Escalation, Data Extraction, Social Engineering, Obfuscation, Context Manipulation, Multimodal Bypass
- **30+ techniques** across categories
- **4 core actions** — Generate → Evolve → Execute → Adaptive Attack
- **Named sessions** — persistent attack campaigns stored in SQLite, survive restarts
- **Metrics panel** — compliance rate, block rate, avg score, by-category and by-technique breakdowns
- **Failure signal analysis** — auto-scores every response (BLOCKED / PARTIAL / COMPLIED / AMBIGUOUS)
- **Export** — download any session's attack history as JSON
- **Rate limiting** — configurable per-IP request limiting
- **Structured logging** — rotating log files via loguru
- **Plug-and-play** — Ollama (local) or OpenAI (cloud), switchable per session

---

## Quick Start

### Option A: Docker (recommended)

```bash
git clone <your-repo>
cd redline

# Copy and configure environment
cp .env.example .env
# Edit .env — set OPENAI_API_KEY if using OpenAI

# Build and start everything
docker-compose up --build

# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API docs: http://localhost:8000/docs
```

### Option B: Local development

**Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # configure as needed
uvicorn main:app --reload --port 8000
```

**Frontend** (separate terminal)
```bash
cd frontend
npm install
cp .env.example .env            # set VITE_API_URL=http://localhost:8000
npm run dev
# → http://localhost:3000
```

---

## Ollama Setup

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3
ollama pull mistral

# Redline will auto-detect models when you enter the URL
```

**Docker + Ollama on host machine:**
Set the Ollama URL in the UI to `http://host.docker.internal:11434`

---

## OpenAI Setup

1. Select **OpenAI** provider in the UI
2. Enter your API key (`sk-...`)
3. Choose model — gpt-4o recommended for best attack quality

The API key can also be set server-side via `OPENAI_API_KEY` in `.env` — in that case leave the UI field blank.

---

## Deploy to Railway (one-click live URL)

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Deploy backend
cd backend
railway up

# Set env vars in Railway dashboard:
# OPENAI_API_KEY, CORS_ORIGINS (your frontend URL)

# Deploy frontend
cd ../frontend
# Set VITE_API_URL to your Railway backend URL
railway up
```

## Deploy to Render

The `render.yaml` in the project root configures both services.
Connect your GitHub repo in the Render dashboard and it will pick up the config automatically.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | OpenAI key (optional if passing per-request) |
| `CORS_ORIGINS` | `*` | Allowed origins, comma-separated |
| `DB_PATH` | `./redline.db` | SQLite database path |
| `RATE_LIMIT_PER_MINUTE` | `60` | Requests per IP per minute |
| `DEBUG` | `false` | Enable debug mode |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend API URL |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check + version |
| `GET` | `/attack-categories` | All categories and techniques |
| `GET` | `/metrics` | Global metrics across all sessions |
| `GET` | `/models/ollama?base_url=` | List installed Ollama models |
| `POST` | `/sessions` | Create a named session |
| `GET` | `/sessions` | List all sessions |
| `GET` | `/sessions/{id}` | Get session details |
| `DELETE` | `/sessions/{id}` | Delete session + all attacks |
| `GET` | `/sessions/{id}/attacks` | List attacks in session |
| `GET` | `/sessions/{id}/metrics` | Session-scoped metrics |
| `POST` | `/generate` | Generate base attack prompt |
| `POST` | `/evolve` | Evolve/optimize a prompt |
| `POST` | `/execute` | Fire prompt, capture response + signals |
| `POST` | `/adaptive` | Synthesize optimal attack from history |

Full interactive docs: `http://localhost:8000/docs`

---

## Project Structure

```
redline/
├── backend/
│   ├── main.py               # FastAPI app, middleware, routing
│   ├── db.py                 # SQLite layer — sessions, attacks, metrics
│   ├── llm.py                # Unified LLM client (Ollama / OpenAI)
│   ├── attacks.py            # Categories, techniques, failure signal analysis
│   ├── config.py             # Pydantic settings loaded from .env
│   ├── routers/
│   │   ├── sessions.py       # Session CRUD endpoints
│   │   └── attack_routes.py  # Generate / Evolve / Execute / Adaptive
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── railway.toml
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Full UI — sessions, attack panel, metrics
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.example
├── docker-compose.yml
├── render.yaml
├── .env.example
├── .gitignore
└── README.md
```

---

## Adding a New Provider

Edit `backend/llm.py` — add an `elif` branch in `call_llm()`:

```python
elif provider.provider == "groq":
    return await _call_groq(provider, messages, system)
```

Then add `_call_groq()` using the Groq SDK or httpx. No other files need changing.

---

## Adding a New Attack Category

1. `backend/attacks.py` — add entry to `ATTACK_CATEGORIES`
2. `frontend/src/App.jsx` — add matching entry to `CATEGORIES` with a color and glyph

---

## Disclaimer

Redline is built for **authorized security research only**.
Always obtain explicit permission before testing any system you do not own.
