# Moodle Course Creator

> AI-powered course authoring studio — generate complete, classroom-ready Moodle 5.x course backups (`.mbz`) from a single text prompt using any OpenAI-compatible LLM.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Moodle](https://img.shields.io/badge/Moodle-5.x-F98012?logo=moodle&logoColor=white)](https://moodle.org/)

---

## What is this?

**Moodle Course Creator** is a full-stack web application that turns a plain-text description of a course into a complete, importable Moodle backup file (`.mbz`) — including module lectures, a glossary, discussion questions, a syllabus, a 30–50 question quiz bank, and optional homework activities.

Built at **Colegio Teológico Biblos** to accelerate theological course development, but designed for any subject area. The entire generation pipeline runs against a locally-hosted LLM (LM Studio, Ollama) or any cloud provider with an OpenAI-compatible API (OpenAI, OpenRouter, Anthropic). No Moodle CLI access is required.

---

## Features

### AI Course Generation

- **Full pipeline in one click** — course structure → 5 modules of content → syllabus → quiz bank → homework
- **Any LLM, any provider** — LM Studio, Ollama, OpenAI, OpenRouter, Anthropic — provider auto-detected from URL
- **Model evaluation** — benchmarks every locally-available model on a test prompt, scores and ranks them
- **Homework configurator** — per-module toggle to add Assignment or Forum activities with LLM-written prompts

### Course Library

- **Version history** — every generation is saved as a versioned snapshot; fork, compare, or roll back at any time
- **In-browser Course Viewer** — browse module content, glossary, quiz questions, and discussion prompts
- **Per-module regeneration** — regenerate a single module with new instructions without touching the rest
- **Import from Moodle** — pull live Moodle courses into your library as a starting point
- **Build & download** — compile any version to a valid `.mbz` on demand

### Autonomous Quality Review

- **Bulk LLM audit** — review an entire category of courses against two configurable expert agents
- **Course Reviewer agent** — academic auditor checking theology, structure, assessments, and course quality
- **Student Critic agent** — stress-tests content from a student perspective: depth, relevance, the "So What?" factor
- **Live step tracking** — colored progress rows light up in real time as each course is reviewed
- **Apply feedback & regenerate** — one click collects all "Needs Revision" findings and rewrites every module, quiz, and syllabus incorporating the reviewer recommendations

### Moodle Integration

- **Multi-instance support** — save and switch between multiple Moodle sites (dev, staging, production)
- **Live deploy** — push a library version directly to Moodle as a new course
- **Moodle Courses tab** — browse live courses, inspect section contents and activities, view grade books
- **REST API proxy** — update course metadata, section summaries, and forum discussions without leaving the app

---

## Tech Stack

| Layer | Technology | Version |
| ----- | ---------- | ------- |
| Frontend framework | React | 18 |
| UI component library | Mantine | 7 |
| Icon set | Tabler Icons React | 3 |
| Build tool | Vite | 6 |
| Language (frontend) | TypeScript | 5.6 |
| API framework | FastAPI | 0.115 |
| Language (backend) | Python | 3.11+ |
| Database | SQLite | built-in |
| LLM client | OpenAI-compatible REST | any |
| Course output format | Moodle `.mbz` (ZIP) | Moodle 5.x |
| Local Moodle (optional) | Docker + Bitnami Moodle | 5.x |

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      Browser  (React + Mantine)                      │
│                                                                      │
│  Course Studio  │  Library  │  Moodle Courses  │  Autonomous Review  │  Settings  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  HTTP /api/…
┌──────────────────────────▼──────────────────────────────────────────┐
│                     FastAPI  (Python 3.11+)                          │
│                                                                      │
│  /api/courses  ·  /api/llm  ·  /api/moodle  ·  /api/settings        │
│                                                                      │
│                        SQLite  library.db                            │
│              (courses · versions · builds · settings)               │
└────────┬──────────────────────────────────────────┬─────────────────┘
         │                                          │
         ▼                                          ▼
  create_course.py                          Moodle REST API
  ┌───────────────────┐                  (webservice/rest.php)
  │  LLM pipeline     │
  │  ───────────────  │
  │  1. Structure     │
  │  2. Content × 5   │
  │  3. Syllabus      │
  │  4. Quiz          │
  │  5. Homework      │
  │  ───────────────  │
  │  .mbz builder     │
  └────────┬──────────┘
           │
           ▼
   OpenAI-compatible
      LLM server
  (LM Studio / Ollama /
   OpenAI / OpenRouter /
   Anthropic)
```

---

## Quick Start

Full step-by-step instructions are in [docs/HOWTO.md](docs/HOWTO.md).

### Prerequisites

| Requirement | Minimum | Notes |
| ----------- | ------- | ----- |
| Python | 3.11 | 3.12+ recommended |
| Node.js | 20 LTS | includes npm |
| LLM server | — | LM Studio ≥ 0.3, Ollama, or a cloud API key |
| Moodle | 5.x | for `.mbz` import or live sync (optional) |

### Install

```bash
git clone https://github.com/ricardojjulia/moodle-course-creator.git
cd moodle-course-creator

# Python environment
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd app/frontend
npm install
npm run build
cd ../..
```

### Run

```bash
# Development — hot reload on both ends
uvicorn app.backend.main:app --reload &   # API on :8000
cd app/frontend && npm run dev            # UI  on :5173

# Production — frontend served by FastAPI
uvicorn app.backend.main:app --host 0.0.0.0 --port 8000
# open http://localhost:8000
```

### Optional: local Moodle via Docker

```bash
docker compose up -d
# Moodle 5.x at http://localhost:8080
```

---

## Application Guide

### Course Studio

Two modes in one tab:

**New Course** — four numbered cards guide you through setup:

1. **Language Model** — evaluate local models or type a cloud model ID
2. **Course Identity** — shortname, full name, professor, category, dates
3. **Assessment** — quiz question count and per-module homework type
4. **Course Prompt** — free-text description of the course content

Click **Generate Course**. A live step tracker shows progress through each phase (Structure → Content → Syllabus → Quiz → Homework).

**Review** — browse your library by category → course → version; fork or deploy directly to Moodle from here.

---

### Library

- Left panel: courses grouped by Moodle instance with a stats dashboard (version distribution, last activity)
- Right panel: selected course details, version list, full content viewer, per-module regeneration, build & download
- Search bar + category filter at the top
- Bulk delete available from the instance header

---

### Autonomous Review

Bulk quality audit powered by two expert LLM agents:

1. Pick a **category** then select which **courses** to audit
2. Enable/disable the **Course Reviewer** and/or **Student Critic** agents (edit their prompts if needed)
3. Choose a **model** and click **Begin Autonomous Review**
4. Watch each `course × agent` step row turn green as reviews complete
5. Results appear grouped by course — audit score, section-by-section breakdown, and item notes
6. Click **Apply feedback & regenerate** to automatically apply all recommendations in a new version

---

### Moodle Courses

- Connects to the active Moodle instance (configured in Settings)
- Browse all courses, expand sections and activity lists
- View grade books with full student roster
- Import any live course into your library

---

### Settings

- **LLM** — server URL and API key; provider auto-detected (local / OpenAI / OpenRouter / Anthropic)
- **Moodle Instances** — add multiple sites by name, URL, and token; click to activate
- The active instance is used everywhere (Library stats, Autonomous Review deploy, Moodle Courses)

---

## Project Structure

```text
.
├── create_course.py          # Core LLM pipeline + .mbz builder
├── requirements.txt          # Python dependencies
├── docker-compose.yml        # Local Moodle 5.x + MariaDB
├── LICENSE
├── CHANGELOG.md
│
├── app/
│   ├── backend/
│   │   ├── main.py           # FastAPI app + static file serving
│   │   ├── database.py       # SQLite schema and helpers
│   │   └── routers/
│   │       ├── courses.py    # Library CRUD, generate, build, review, regenerate
│   │       ├── llm.py        # Model list, evaluation cache
│   │       ├── moodle.py     # Moodle REST proxy, deploy endpoint
│   │       └── settings.py   # App settings, Moodle instance management
│   │
│   ├── frontend/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── App.tsx                       # Tab routing
│   │       ├── api/client.ts                 # Fully typed API client
│   │       ├── components/
│   │       │   └── CourseViewer.tsx          # Course content browser + editor
│   │       └── pages/
│   │           ├── NewCourse.tsx             # Course Studio
│   │           ├── Library.tsx               # Course library
│   │           ├── AutonomousReview.tsx      # Bulk AI review
│   │           ├── MoodleCourses.tsx         # Live Moodle browser
│   │           └── Settings.tsx              # App configuration
│   │
│   └── builds/               # Generated .mbz files (git-ignored)
│
└── docs/
    └── HOWTO.md              # Full installation and usage guide
```

---

## API Reference

Interactive docs at `http://localhost:8000/docs` when running in development.

| Group | Endpoint | Description |
| ----- | -------- | ----------- |
| **Library** | `GET /api/courses` | List all courses |
| | `POST /api/courses/generate` | Run full LLM generation pipeline |
| | `GET /api/courses/{sn}/versions` | List versions for a course |
| | `POST /api/courses/{sn}/versions/{vid}/build` | Compile version to `.mbz` |
| | `GET /api/courses/{sn}/versions/{vid}/download` | Download `.mbz` file |
| | `POST /api/courses/{sn}/versions/{vid}/fork` | Duplicate a version |
| | `POST /api/courses/{sn}/versions/{vid}/modules/{n}/regenerate` | Regenerate one module |
| **Review** | `POST /api/courses/{sn}/review` | Single-course LLM audit |
| | `POST /api/courses/{sn}/regenerate-from-review` | Full rewrite from review findings |
| | `POST /api/courses/{sn}/versions/{vid}/finalize-review` | Regenerate quiz + syllabus |
| **LLM** | `GET /api/llm/models` | List available models |
| | `GET /api/llm/evaluation` | Get cached evaluation results |
| | `POST /api/llm/evaluate` | Run model evaluation benchmark |
| **Moodle** | `GET /api/moodle/courses` | List live Moodle courses |
| | `POST /api/moodle/deploy` | Deploy library version to Moodle |
| | `GET /api/moodle/stats` | Site statistics |
| **Settings** | `GET /api/settings` | Get current settings |
| | `PUT /api/settings` | Update LLM / general settings |
| | `GET /api/settings/instances` | List saved Moodle instances |
| | `POST /api/settings/instances` | Add or update a Moodle instance |
| | `POST /api/settings/instances/{name}/activate` | Set active Moodle instance |

---

## Contributing

Pull requests are welcome. The `main` branch is protected — all changes must go through a PR with at least one review.

```bash
git checkout -b feat/your-feature
# make changes and commit
git push origin feat/your-feature
# open a Pull Request on GitHub
```

Please keep PRs focused and include a description of what changes and why. For significant new features, open an issue first to discuss the approach.

---

## License

[MIT](LICENSE) © 2026 Ricardo Julia — Colegio Teológico Biblos
