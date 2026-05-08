# How to Install and Use Moodle Course Creator

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Running the Application](#3-running-the-application)
4. [First-time Setup (Settings)](#4-first-time-setup-settings)
5. [Generating a Course from Scratch](#5-generating-a-course-from-scratch)
6. [Building and Importing the .mbz](#6-building-and-importing-the-mbz)
7. [Course Library](#7-course-library)
8. [Autonomous Quality Review](#8-autonomous-quality-review)
9. [Moodle Integration](#9-moodle-integration)
10. [LLM Provider Setup](#10-llm-provider-setup)
11. [Local Moodle with Docker](#11-local-moodle-with-docker)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

| Requirement | Minimum | Recommended | Notes |
| ----------- | ------- | ----------- | ----- |
| Python | 3.11 | 3.12+ | `python3 --version` to check |
| Node.js | 20 LTS | 22 LTS | includes npm |
| LLM server | — | — | See [Section 10](#10-llm-provider-setup) |
| Moodle | 5.0 | 5.2 | For import/sync — optional |
| Git | any | — | For cloning the repo |

The application runs entirely on your local machine. No public internet access is required unless you use a cloud LLM provider (OpenAI, OpenRouter, Anthropic).

---

## 2. Installation

### Clone the repository

```bash
git clone https://github.com/ricardojjulia/moodle-course-creator.git
cd moodle-course-creator
```

### Python environment

Using a virtual environment is strongly recommended to avoid dependency conflicts:

```bash
python3 -m venv .venv
source .venv/bin/activate          # macOS / Linux
# OR
.venv\Scripts\activate             # Windows
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### Frontend

```bash
cd app/frontend
npm install
npm run build      # compiles TypeScript and bundles into app/frontend/dist/
cd ../..
```

The compiled frontend is served automatically by the FastAPI backend from `app/frontend/dist/`. You only need to rebuild when you change frontend source files.

---

## 3. Running the Application

### Development mode (recommended during setup)

Run the backend and frontend as two separate processes so both support hot reload:

```bash
# Terminal 1 — backend (API on port 8000)
source .venv/bin/activate
uvicorn app.backend.main:app --reload

# Terminal 2 — frontend dev server (UI on port 5173)
cd app/frontend
npm run dev
```

Open **<http://localhost:5173>** in your browser. API calls are proxied to `:8000` automatically.

### Production mode

If you only want one process (e.g. on a server or when the frontend is already built):

```bash
source .venv/bin/activate
uvicorn app.backend.main:app --host 0.0.0.0 --port 8000
```

Open **<http://localhost:8000>**. The FastAPI server serves the compiled frontend from `app/frontend/dist/`.

### Data storage

The app creates `app/library.db` (SQLite) on first run. This file stores all courses, versions, settings, and Moodle connections. Back it up regularly — it is excluded from git by `.gitignore`.

---

## 4. First-time Setup (Settings)

Open the **Settings** tab to configure your LLM and Moodle connections.

### LLM Configuration

Enter your LLM server URL in the **LLM URL** field:

| Provider | URL to enter |
| -------- | ------------ |
| LM Studio (local) | `http://localhost:1234/v1` |
| Ollama (local) | `http://localhost:11434/v1` |
| OpenAI | `https://api.openai.com/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| Anthropic | `https://api.anthropic.com/v1` |
| Custom / self-hosted | your server's base URL |

For cloud providers, also enter your **API Key**. For local servers, leave the key blank.

The app auto-detects which provider you are using from the URL and adjusts the model picker accordingly — local providers get the evaluate-and-rank workflow; cloud providers get a simple model ID input.

### Moodle Instances

Click **Add Instance** and fill in:

- **Name** — a label for this connection (e.g. `Biblos Production`, `Local Docker`)
- **URL** — your Moodle site root (e.g. `https://biblos.moodlecloud.com`)
- **Token** — a Moodle webservice token with the required permissions (see [Section 9](#9-moodle-integration))

Click **Save**. The instance appears in the list. Click **Activate** to make it the active connection used throughout the app.

You can save multiple instances and switch between them at any time.

---

## 5. Generating a Course from Scratch

Navigate to the **Course Studio** tab and select **New Course** mode.

### Step 1 — Language Model

**Local LLM:**

1. Click **Evaluate Models** — the app sends a test prompt to every model available on your LLM server and scores them on accuracy, speed, and JSON validity.
2. The top 3 models are displayed as cards with score rings. Click any card to select it.
3. Expand "Show all N models" to see the full ranked list.

**Cloud LLM:**

The evaluate workflow is skipped. A model ID autocomplete appears with suggestions for your provider. Type or select a model ID (e.g. `gpt-4o`, `claude-sonnet-4-6`).

### Step 2 — Course Identity

| Field | Description | Example |
| ----- | ----------- | ------- |
| Short name | Unique course code used as the filename | `TH308-2026` |
| Full name | Human-readable course title | `TH 308 — Ética Cristiana` |
| Professor | Instructor name, appears in the syllabus | `Prof. Ricardo Julia` |
| Category | Moodle course category | `2025–2026 Spring Term` |
| Start date | Course start (sets the Moodle timeline) | `2026-01-15` |
| End date | Course end | `2026-03-15` |

### Step 3 — Assessment

- **Quiz questions** — total number of questions in the final quiz bank (30–50 recommended; reviewers flag anything below 30)
- **Homework modules** — click any of the five module pills to add a homework activity to that module, then choose the type:
  - **Assignment** — an LLM-written written assignment prompt
  - **Forum** — an LLM-written discussion forum prompt

### Step 4 — Course Prompt

Write a plain-text description of the course. The richer and more specific this is, the better the generated content.

**Good prompt:**

```text
Curso de Ética Cristiana para estudiantes de tercer año de teología evangélica.
El curso debe abordar: fundamentos bíblicos de la ética, virtud y carácter cristiano,
dilemas éticos contemporáneos (bioética, ética sexual, justicia social) desde una
perspectiva reformada. Enfoque práctico para el ministerio pastoral. Idioma: español.
```

**Weak prompt:**

```text
Ethics course for theology students.
```

### Generation

Click **Generate Course**. The step tracker shows each phase in real time:

1. **Course structure** — module titles, objectives, key topics
2. **Module content** — lectures, glossary terms, discussion questions (5 modules)
3. **Syllabus** — prontuario and learning outcomes
4. **Quiz** — question bank
5. **Homework** — assignment and forum prompts (if enabled)

Total time: **5–20 minutes** depending on model speed and prompt complexity. Do not close the browser tab while generation is running.

When finished, the course appears in your Library.

---

## 6. Building and Importing the .mbz

### Build

1. Go to the **Library** tab.
2. Find and click your course in the left panel.
3. In the right panel, select the version you want.
4. Click **Build .mbz** — the server compiles all content into a Moodle backup archive.
5. Click **Download** to save the `.mbz` file to your computer.

### Import into Moodle

1. Log in to your Moodle site as administrator.
2. Go to **Site administration → Courses → Restore course**.
3. Upload the `.mbz` file.
4. Follow the restore wizard — select a destination category and course settings.
5. Click **Perform restore**.

The course will appear in the selected category with all sections, activities, quiz questions, and the syllabus page populated.

---

## 7. Course Library

### Browsing

The Library is a two-panel layout:

- **Left panel** — courses grouped by Moodle instance. At the top of each group is a stats card showing total courses, categories, version distribution (V1 / V2 / V3+), and last activity date. Use the search bar and category filter at the top to narrow the list.
- **Right panel** — appears when you click a course. Shows course metadata, version list, and the full Course Viewer.

### Course Viewer

Click any version to load the Course Viewer. You can browse:

- Module structure (objectives, key topics)
- Lecture content for each module
- Glossary terms
- Discussion questions
- Quiz questions
- Syllabus

Click any **activity row** in the content tree to view the full HTML content in a side panel.

### Per-module Regeneration

If a module's content needs improvement without regenerating the whole course:

1. Open the Course Viewer and navigate to the module.
2. Click the regeneration button (wand icon) next to the module.
3. Optionally write custom instructions for that regeneration.
4. The module content is replaced in-place in the current version.

### Forking

Fork a version to create a safe copy before making changes:

- In **Library**: click the version → **Fork** button in the right panel.
- In **Course Studio → Review**: use the **Fork** button in Step 3.

A new version (incremented version number) is created with identical content.

### Import from Moodle

In the **Moodle Courses** tab, find any live course and click **Import to Library**. The course is parsed from the Moodle site and saved as Version 1 in your library, ready for editing and regeneration.

---

## 8. Autonomous Quality Review

The Autonomous Review feature audits courses in bulk using two configurable LLM agents.

### Setup

1. Navigate to the **Autonomous Review** tab.
2. **Select a category** in the "Courses to Review" card, then pick individual courses (or use All/None).
3. **Choose agents** — both are enabled by default:
   - **Course Reviewer** — checks theology, structure, syllabus, quiz count, and assignment load
   - **Student Critic** — stress-tests depth, relevance, "So What?" factor, and test fairness
4. Toggle the switch on each agent card to enable or disable it. Click **Edit prompt** to customise the agent's instructions.
5. **Select a model** in the Model card.

### Running a Review

Click **Begin Autonomous Review**. A step list appears showing every `course × agent` combination. Rows turn green as each review completes, violet while running, and red on error.

When all reviews finish, results appear below grouped by course.

### Reading Results

Each result card shows:

- **Overall verdict** — Passed / Needs Revision / Incomplete
- **Score** — 0–100
- **Summary** — 2–3 sentence overall assessment
- **Audit detail** — expandable section-by-section breakdown with per-item status (Passed / Needs Revision / Missing) and a one-sentence note

### Applying Feedback

Click **Apply feedback & regenerate** on any course to run the full improvement pipeline:

1. **Fork** — creates a new version from the current latest
2. **Module regeneration** — each module is rewritten with all "Needs Revision" and "Missing" items from both agents injected as improvement instructions, alongside the existing content as context
3. **Quiz & Syllabus** — regenerated if the quiz was flagged or has fewer than 30 questions

The step list inside the course header tracks each step in real time. When complete, a badge shows the new version number.

---

## 9. Moodle Integration

### Generating a Moodle Token

1. Log in to Moodle as an administrator.
2. Go to **Site administration → Server → Web services → Manage tokens**.
3. Click **Create token**, select a user with admin or manager rights, and choose the **Moodle mobile web service** (or create a custom service).
4. Copy the token and paste it into Settings → Moodle Instances.

The following webservice functions must be enabled for full functionality:

| Function | Used for |
| -------- | -------- |
| `core_course_get_courses` | Browse courses |
| `core_course_get_contents` | Read section content |
| `core_course_create_courses` | Deploy new courses |
| `core_course_update_courses` | Update course metadata |
| `gradereport_user_get_grade_items` | Grade book view |
| `mod_forum_add_discussion` | Push forum discussions |
| `core_webservice_get_site_info` | Ping / site stats |

### Deploying to Moodle

From **Course Studio → Review** (Step 3) or after an Autonomous Review:

1. Click **Deploy to Moodle**.
2. Select a **Moodle category** from the dropdown.
3. Optionally set start and end dates.
4. Click **Deploy** — the course content is pushed to Moodle via the REST API and a new course is created in the chosen category.
5. A link to the live Moodle course appears on success.

---

## 10. LLM Provider Setup

### LM Studio (recommended for local use)

1. Download [LM Studio](https://lmstudio.ai).
2. Download a model from the Discover tab (7B–13B parameter models work well; 13B+ gives better theological content).
3. Go to **Local Server** and click **Start Server**.
4. In Settings, enter URL: `http://localhost:1234/v1` (no API key needed).
5. Click **Evaluate Models** in Course Studio to rank available models.

**Recommended models for theological content:**

- `mistral-7b-instruct` — fast, good JSON compliance
- `llama-3.1-8b-instruct` — well-rounded
- `qwen2.5-14b-instruct` — higher quality, slower

### Ollama

```bash
# Install Ollama, then pull a model
ollama pull llama3.1
ollama serve       # starts on http://localhost:11434
```

In Settings, enter URL: `http://localhost:11434/v1`

### OpenAI

Enter URL `https://api.openai.com/v1` and your OpenAI API key. Recommended models: `gpt-4o` (best quality) or `gpt-4o-mini` (faster, lower cost).

### OpenRouter

Enter URL `https://openrouter.ai/api/v1` and your OpenRouter API key. OpenRouter provides access to hundreds of models from different providers through a single API.

### Anthropic

Enter URL `https://api.anthropic.com/v1` and your Anthropic API key. Recommended: `claude-sonnet-4-6` (strong reasoning, good JSON compliance).

---

## 11. Local Moodle with Docker

The repo includes a `docker-compose.yml` that starts a full Moodle 5.x + MariaDB stack for local testing.

### Start

```bash
docker compose up -d
```

Moodle will be available at **<http://localhost:8080>** once the containers are healthy (typically 2–3 minutes on first start).

### First-time Moodle setup

1. Open <http://localhost:8080> and complete the installation wizard.
2. Default database credentials (already configured in `docker-compose.yml`):
   - Host: `db`, User: `moodle`, Password: `moodle`, Database: `moodle`
3. Create an admin account when prompted.
4. After setup, generate a webservice token (see [Section 9](#9-moodle-integration)) and add it in Settings.

### Stop

```bash
docker compose down          # stops containers, keeps data
docker compose down -v       # stops and deletes all data (clean slate)
```

---

## 12. Troubleshooting

### "No models found" in Course Studio

- Verify your LLM server is running and the URL in Settings is correct.
- For LM Studio, make sure the server is started (green indicator in the Local Server tab).
- Click **Evaluate Models** — if the request times out, increase LM Studio's request timeout.

### Generation fails with a JSON error

The LLM returned malformed JSON. Try:

- Switching to a model with better instruction-following (higher score in evaluation).
- Lowering the temperature — well-rated models at temperature 0.4–0.6 produce more reliable JSON.
- Reducing prompt complexity or shortening it.

### Moodle token "access denied"

- Confirm the token has the required webservice functions enabled.
- Ensure the token user has the **manager** or **administrator** role.
- Check that the Moodle webservice protocol is enabled: **Site administration → Plugins → Web services → Manage protocols → REST**.

### .mbz import fails in Moodle

- The `.mbz` file is a ZIP archive. If Moodle rejects it, open it with any ZIP tool and inspect the contents — `moodle_backup.xml` should be present at the root.
- Ensure you are restoring to a Moodle 5.x site; older versions may reject the backup format.

### Frontend shows a blank page

- Check that `app/frontend/dist/` exists — run `cd app/frontend && npm run build` if it is missing.
- In development mode, make sure both the backend (`:8000`) and the Vite dev server (`:5173`) are running.

### Database errors on startup

The SQLite database is created automatically at `app/library.db`. If it becomes corrupted, stop the server, delete `app/library.db`, and restart — the schema will be recreated. Your generated `.mbz` files in `app/builds/` are unaffected.
