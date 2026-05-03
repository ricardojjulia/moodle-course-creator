# How to Install and Use Moodle Course Creator

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Configuration](#3-configuration)
4. [Running the App](#4-running-the-app)
5. [Generating a Course](#5-generating-a-course)
6. [Building and Importing the .mbz](#6-building-and-importing-the-mbz)
7. [Moodle Sync (Live Push)](#7-moodle-sync-live-push)
8. [Local Moodle with Docker](#8-local-moodle-with-docker)
9. [LLM Server Setup](#9-llm-server-setup)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Requirement | Minimum version | Notes |
|---|---|---|
| Python | 3.11 | 3.12+ recommended |
| Node.js | 20 LTS | includes npm |
| LLM server | — | LM Studio ≥ 0.3 or Ollama |
| Moodle | 5.x | for `.mbz` import / sync |

---

## 2. Installation

### Clone the repository

```bash
git clone https://github.com/ricardojjulia/moodle-course-creator.git
cd moodle-course-creator
```

### Python dependencies

```bash
python3 -m pip install -r requirements.txt
```

> **Tip:** Use a virtual environment to keep dependencies isolated:
> ```bash
> python3 -m venv .venv
> source .venv/bin/activate   # Windows: .venv\Scripts\activate
> pip install -r requirements.txt
> ```

### Frontend dependencies

```bash
cd app/frontend
npm install
npm run build   # builds the SPA into app/frontend/dist/
cd ../..
```

The FastAPI backend automatically serves the built frontend from `app/frontend/dist/` when you open `http://localhost:8000`.  
During development you can use `npm run dev` (port 5173) instead and skip the build step.

---

## 3. Configuration

All settings are stored in `app/library.db` (SQLite) and can be changed through the **Settings** tab in the UI.

### LLM Server URL

- **LM Studio**: Start the local server in LM Studio → copy the base URL (default `http://localhost:1234/v1`)
- **Ollama**: `http://localhost:11434/v1` (Ollama exposes an OpenAI-compatible endpoint)
- **Remote host**: use the machine's LAN IP, e.g. `http://192.168.1.100:1234/v1`

### Moodle URL and Token

Only needed if you want to push content to a live Moodle site.

1. Log into Moodle as admin.
2. Go to **Site administration → Server → Web services → Manage tokens**.
3. Create a token for your user with the `moodle_mobile_app` service (or a custom service with the functions listed in `app/backend/routers/moodle.py`).
4. Paste the token into the **Settings** tab.

> The app will automatically prepend `http://` if you forget the scheme.

---

## 4. Running the App

### One-command start (development)

```bash
./start.sh
```

This launches:
- **Backend** on `http://localhost:8000` (auto-reload on Python changes)
- **Frontend** dev server on `http://localhost:5173`
- Opens `http://localhost:5173` in your browser

Logs go to `/tmp/moodle_backend.log` and `/tmp/moodle_frontend.log`.

### Production mode (served from FastAPI)

```bash
cd app/frontend && npm run build && cd ../..
uvicorn app.backend.main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000`. The frontend is embedded in the backend — no separate Node process needed.

### API documentation

Interactive Swagger UI: `http://localhost:8000/docs`

---

## 5. Generating a Course

### Step 1 — Select and evaluate models

1. Click the **New Course** tab.
2. The app loads any previously cached evaluation results automatically.
3. Click **Run Evaluation** to benchmark every model available on your LLM server against a short theology test prompt (~90 seconds per model). Results are cached so you won't need to re-run unless you add new models.
4. Click a row to select your preferred model. The top-ranked model is pre-selected.

### Step 2 — Fill in course details

| Field | Example | Notes |
|---|---|---|
| Short name | `TH310-2026_1` | Used as Moodle's `shortname`; must be unique |
| Full name | `TH 310 - HERMENÉUTICA` | Display name in Moodle |
| Professor | `Ricardo Julia` | Appears in the syllabus |
| Category | `2025 - 2026 Spring Term` | Moodle category label |
| Start date | `2026-04-20` | ISO 8601 format |
| End date | `2026-06-15` | ISO 8601 format |
| Quiz questions | `50` | Total questions in the quiz bank |

### Step 3 — Homework (optional)

Check the modules (1–5) that should include extra homework. For each checked module, choose:
- **Assignment** — an upload-based graded assignment
- **Forum** — a discussion forum with a reflection prompt

### Step 4 — Content prompt

Write a detailed description of the course. Include:
- Subject and theological tradition (e.g., evangelical, Reformed, Wesleyan)
- Target audience (seminary students, laypeople, pastors)
- Key themes and texts
- Language (the LLM will generate content in the same language as the prompt)

**Example:**
```
Curso de hermenéutica bíblica para estudiantes de teología evangélica de nivel universitario.
El curso cubre principios de interpretación literal-histórica-gramatical, uso del contexto
literario e histórico, y aplicación práctica a textos del Antiguo y Nuevo Testamento.
Énfasis en pasajes proféticos y epístolas paulinas.
```

### Step 5 — Generate

Click **Generate Course**. The stepper shows progress through each pipeline stage:

1. **Structure** — LLM creates 5 module titles, objectives, and key topics
2. **Content** — LLM writes glossary entries and lecture text for each module
3. **Prontuario** — LLM produces a full academic syllabus
4. **Quiz** — LLM generates N multiple-choice questions with answers
5. **Homework** *(if selected)* — LLM writes assignment or forum prompts per module

Total time: **5–15 minutes** depending on model speed and number of questions.

---

## 6. Building and Importing the .mbz

### Build the archive

1. Go to the **Library** tab.
2. Expand the course you want to export.
3. Click the **build icon** (arch) on the version row — this packages the stored content into a Moodle 5.x `.mbz` backup file.
4. Click the **download icon** (green arrow) to download the file.

### Import into Moodle

1. Log into Moodle as a teacher or administrator.
2. Go to **Site administration → Courses → Restore course** (or inside a category, click **Restore**).
3. Upload the `.mbz` file.
4. Follow the restore wizard: choose **Restore as a new course**, select the target category, confirm settings.
5. Moodle will restore all sections, pages, forums, quizzes, and (optionally) assignments.

> **Note:** The restore may run asynchronously. If you don't see the course immediately, wait a minute and refresh, or check **Site administration → Server → Tasks → Ad hoc tasks**.

---

## 7. Moodle Sync (Live Push)

The **Moodle Sync** tab lets you push content directly to an already-existing Moodle course via the REST API, without needing to import a `.mbz`.

### What you can push

- Course metadata (full name, start/end date, visibility)
- Section summaries
- Forum discussion posts

### Requirements

- Moodle URL and token must be configured in **Settings**.
- Web services must be enabled in Moodle: **Site administration → Advanced features → Enable web services**.
- The REST protocol must be enabled: **Site administration → Plugins → Web services → Manage protocols**.
- The token's user must have the `webservice/rest:use` capability and teacher-level access in the target course.

---

## 8. Local Moodle with Docker

The included `docker-compose.yml` spins up a local Moodle 5.x instance for testing.

```bash
docker compose up -d
```

- Moodle UI: **http://localhost:8080**
- Default admin credentials: `admin` / `Admin@1234` (set during first-run wizard)
- MariaDB is on port `3306` (mapped to host)

### First-time Moodle setup

1. Open `http://localhost:8080` and complete the installation wizard.
2. When prompted for the database, use:
   - Host: `mariadb`
   - Database: `moodle`
   - User: `moodle`
   - Password: `moodle`
3. Enable web services (see [Section 7](#7-moodle-sync-live-push)).
4. In the app **Settings**, set Moodle URL to `http://localhost:8080`.

### Enable cron (required for async restores)

If you use async restore (uploading through the Moodle UI), cron must be running:

```bash
docker exec -it <moodle-container-name> bash
echo '*/5 * * * * www-data php /var/www/html/admin/cli/cron.php > /dev/null 2>&1' \
  > /etc/cron.d/moodle
service cron start
```

Alternatively, run the restore synchronously from the CLI:

```bash
docker exec <moodle-container-name> \
  php /var/www/html/admin/cli/restore_backup.php \
  --file=/path/to/course.mbz --categoryid=1
```

---

## 9. LLM Server Setup

### LM Studio

1. Download from [lmstudio.ai](https://lmstudio.ai).
2. Load a model (7B–13B Qwen or Llama recommended for Spanish theological content).
3. Go to **Local Server** tab → **Start Server**.
4. Copy the base URL shown (e.g., `http://localhost:1234/v1`).
5. Paste it in the app **Settings → LLM Server URL**.

**Recommended models (multilingual, Spanish-capable):**
- `Qwen2.5-7B-Instruct` (excellent Spanish, fast)
- `Qwen2.5-14B-Instruct` (higher quality, slower)
- `Llama-3.1-8B-Instruct`

### Ollama

```bash
# Install: https://ollama.com
ollama pull qwen2.5:7b
ollama serve   # starts on http://localhost:11434
```

Set LLM Server URL to `http://localhost:11434/v1` in Settings.

### Remote LLM server (LAN)

If your LLM server runs on another machine (e.g., a GPU workstation), use its LAN IP:

```
http://192.168.1.100:1234/v1
```

Make sure the server is bound to `0.0.0.0` (not just `127.0.0.1`).

---

## 10. Troubleshooting

### "No models found"

- Confirm the LLM server is running and the URL is correct in Settings.
- Check that the server exposes `/v1/models` (LM Studio and Ollama both do).
- Verify there are no firewall rules blocking the port.

### "Generation failed — Internal Server Error"

- Check `/tmp/moodle_backend.log` for the Python traceback.
- The most common cause is the LLM returning malformed JSON. Try a different (higher-quality) model.
- Increase the model's context window if content is being truncated.

### Moodle restore fails with "unexpected_grade_item_type"

This is fixed in v0.1.0. If you have an older `.mbz`, rebuild it — the new `gradebook.xml` only includes `itemtype=course`.

### "Moodle unreachable"

- Confirm the Moodle URL includes `http://` or `https://`.
- If running Moodle in Docker, use `http://localhost:8080` from the host (not the container IP).
- Run `php admin/cli/purge_caches.php` inside the container if settings were recently changed.

### Restore stuck / never finishes

Moodle async restores require cron. Check: **Site administration → Server → Tasks → Scheduled tasks → Cron task**. If cron is not running, use the synchronous CLI restore (see [Section 8](#8-local-moodle-with-docker)).

### Frontend shows blank page after build

Run `npm run build` again inside `app/frontend/`. If TypeScript errors appear, fix them first — the build will not output partial files.

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss major changes.

## License

[MIT](../LICENSE) © 2026 Ricardo Julia
