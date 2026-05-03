# Changelog

All notable changes to this project will be documented in this file.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-05-02

### Added
- `create_course.py` — core pipeline: course structure, module content, syllabus, quiz, homework → Moodle 5.x `.mbz` backup
- FastAPI backend (`app/backend/`) with SQLite library for storing generated courses and versions
- React + Mantine v7 frontend (`app/frontend/`) with:
  - **New Course** wizard: model selection, LLM evaluation, course details, homework configurator, progress stepper
  - **Course Library**: browse courses, expand versions, build/download `.mbz`, delete courses and versions
  - **Settings**: Moodle URL + token, LLM server URL
  - **Moodle Sync**: ping, browse live courses, push updates via REST API
- LLM model evaluation: scores every available Ollama/LM Studio model on a theology test prompt; caches results to avoid re-runs
- Homework support: per-module Assignment or Forum activities with LLM-generated prompts
- Moodle webservice integration: create courses, update section summaries, add forum discussions
- `start.sh` — one-command dev launcher (backend + frontend)
- `docker-compose.yml` — local Moodle 5.x + MariaDB stack for testing

### Fixed
- `gradebook.xml` no longer includes `itemtype=mod` grade items — Moodle's restore pipeline only accepts `course`, `category`, and `manual` types at the course level; mod items are auto-created per activity.

[0.1.0]: https://github.com/ricardojjulia/moodle-course-creator/releases/tag/v0.1.0
