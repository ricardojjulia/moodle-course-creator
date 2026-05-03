# Moodle Course Creator

> Generate complete Moodle 5.x course backups (`.mbz`) from a single text prompt using a local LLM — no cloud APIs required.

Built at **Colegio Teológico Biblos** for rapid, AI-assisted theological course development.

---

## Features

| Feature | Details |
|---|---|
| **Full course generation** | Structure → module content → syllabus → quiz bank → homework |
| **Local LLM** | Works with LM Studio or any OpenAI-compatible server (Ollama, llama.cpp) |
| **Model evaluation** | Benchmarks all available models on a theology prompt; caches results |
| **Moodle 5.x `.mbz`** | Produces importable backup files — no Moodle CLI access needed on the target |
| **Course library** | SQLite-backed store of every generated version; rebuild/download at any time |
| **Moodle sync** | Push course meta, section summaries, and forum discussions via REST API |
| **Web UI** | React + Mantine v7 single-page app served by the FastAPI backend |

---

## Architecture

```
┌─────────────────────────────────────────┐
│             Browser (React/Mantine)      │
│  New Course · Library · Settings · Sync  │
└────────────────┬────────────────────────┘
                 │ HTTP /api/…
┌────────────────▼────────────────────────┐
│        FastAPI backend (Python)          │
│  /courses  /llm  /moodle  /settings      │
│              SQLite (library.db)         │
└────┬───────────────────────┬────────────┘
     │                       │
     ▼                       ▼
create_course.py        Moodle REST API
(LLM pipeline +         (webservice/rest)
 .mbz builder)
     │
     ▼
Local LLM server
(LM Studio / Ollama)
```

---

## Quick Start

See [docs/HOWTO.md](docs/HOWTO.md) for full installation and configuration details.

### Prerequisites

- Python 3.11+
- Node.js 20+
- A running LLM server: [LM Studio](https://lmstudio.ai) or [Ollama](https://ollama.com)
- A Moodle 5.x site (local Docker or remote)

### Install & run

```bash
git clone https://github.com/ricardojjulia/moodle-course-creator.git
cd moodle-course-creator

# Python dependencies
python3 -m pip install -r requirements.txt

# Frontend dependencies + build
cd app/frontend
npm install
npm run build
cd ../..

# Launch (backend on :8000, frontend on :5173)
./start.sh
```

Open **http://localhost:5173** in your browser.

### Local Moodle (optional)

```bash
docker compose up -d
```

Starts Moodle 5.x at **http://localhost:8080** with MariaDB. See [docs/HOWTO.md](docs/HOWTO.md#local-moodle-docker) for first-time Moodle setup.

---

## Generating a Course

1. **Settings** tab → enter your LLM server URL and (optionally) Moodle URL + token.
2. **New Course** tab → click **Run Evaluation** to rank all available models.
3. Select a model, fill in course details, write a content prompt, click **Generate Course**.
4. After generation, go to **Library** → expand the course → **Build .mbz** → **Download**.
5. In Moodle: *Site administration → Restore* → upload the `.mbz` file.

---

## Project Structure

```
.
├── create_course.py          # Core LLM pipeline + .mbz builder
├── start.sh                  # Dev launcher
├── docker-compose.yml        # Local Moodle + MariaDB
├── requirements.txt          # Python dependencies
├── app/
│   ├── backend/
│   │   ├── main.py           # FastAPI app
│   │   ├── database.py       # SQLite helpers
│   │   └── routers/
│   │       ├── courses.py    # Course CRUD + generate + build
│   │       ├── llm.py        # Model list + evaluation cache
│   │       ├── moodle.py     # Moodle webservice proxy
│   │       └── settings.py   # App settings
│   ├── frontend/
│   │   └── src/
│   │       ├── pages/        # NewCourse, Library, Settings, MoodleSync
│   │       └── api/client.ts # Typed API client
│   └── builds/               # Generated .mbz files (git-ignored)
└── docs/
    └── HOWTO.md              # Detailed setup & usage guide
```

---

## License

[MIT](LICENSE) © 2026 Ricardo Julia
