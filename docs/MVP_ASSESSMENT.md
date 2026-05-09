# MVP Assessment — Moodle Course Creator

**Assessment date:** 2026-05-09
**Version assessed:** main branch (post-3-feature sprint)

---

## Executive Summary

The application has grown from a single-script `.mbz` generator into a full-stack course authoring platform. All core workflows are functional end-to-end. The tool is **production-ready for internal use** at a theological college or seminary, and is suitable for open-source release with the Biblos-specific branding removed.

**Overall readiness: MVP — Ready for internal production use**

---

## Feature Inventory

### AI Course Generation

| Feature | Status | Notes |
| ------- | ------ | ----- |
| LLM pipeline: structure → content → syllabus → quiz → homework | Complete | All 5 phases tracked in real time |
| Local LLM support (LM Studio, Ollama) | Complete | Auto-detected from URL |
| Cloud LLM support (OpenAI, OpenRouter, Anthropic) | Complete | Provider presets + API key storage |
| Model evaluation / ranking | Complete | Scored on accuracy, speed, JSON validity; results cached |
| Homework configurator (assign or forum per module) | Complete | Per-module toggle |
| Custom prompt → full course in one click | Complete | |

### Course Library

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Version history (unlimited snapshots) | Complete | |
| Course Viewer (browse all content) | Complete | Accordion layout, full HTML render |
| Inline field editing | Complete | Saves directly without forking |
| Per-module regeneration with custom instructions | Complete | Replaces single module in-place |
| Fork (safe copy before changes) | Complete | |
| Build to `.mbz` on demand | Complete | Valid Moodle 5.x backup |
| Download `.mbz` | Complete | |
| Import `.mbz` from file upload | Complete | |
| Import `.mbz` from URL | Complete | Useful with Moodle's automated backup area |
| HTML export for printing | Complete | Print dialog auto-opens |
| Bulk delete courses | Complete | |
| Instance grouping + stats sidebar | Complete | V1/V2/V3+ distribution, last activity |
| Search + category filter | Complete | |

### Quality Assurance

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Autonomous Review (two configurable agents) | Complete | Course Reviewer + Student Critic |
| Live step tracking during review | Complete | Color-coded rows |
| Apply feedback & regenerate | Complete | Full rewrite using all flagged items |
| Per-course review history | Complete | All runs stored in SQLite |
| Course Progress Report | Complete | Score timeline, trend arrows, improvement/regression diff |
| Bible Reference Validator | Complete | English + Spanish book names, chapter range validation, 400+ aliases |
| Quiz Bank editor (add/edit/delete/reorder) | Complete | ↑/↓ arrows per question |
| Quiz Bank import/export (JSON) | Complete | |
| Scheduled Reviews (daily/weekly/monthly) | Complete | Manual "run overdue" trigger; no background daemon |

### Moodle Integration

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Multi-instance management (save, activate, switch) | Complete | |
| Live deploy to Moodle | Complete | Creates course shell, pushes section summaries |
| Forum discussion seeding on deploy | Complete | Best-effort; deploy succeeds even if seeding fails |
| Deploy history per version | Complete | Timestamp, section/forum count, direct URL |
| Instance Course Catalog | Complete | Grouped by category, collapsible |
| Batch import from Moodle | Complete | Progress bar, per-course status, error retry |
| Select missing courses (not yet in library) | Complete | |
| Grade book viewer | Complete | Scrollable table, color-coded cells |
| Student Analytics | Complete | Enrollment, grade distribution, quiz performance, weak areas |
| Update course metadata via API | Complete | Name, dates, summary |
| Push section summaries via API | Complete | |
| Push forum discussions via API | Complete | |
| Instance dashboard (site-wide stats) | Complete | |
| Check / import existing backup files | Complete | Lists `.mbz` files from Moodle's backup area |

### Curriculum Map

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Theological domain matrix | Complete | 8 domains × all library courses |
| Keyword-based coverage scoring | Complete | English + Spanish keywords |
| Coverage ring (% of domains addressed) | Complete | |
| Per-instance filtering | Complete | |
| Domain totals summary | Complete | |

### Settings & Infrastructure

| Feature | Status | Notes |
| ------- | ------ | ----- |
| LLM URL + API key management | Complete | Masked key storage |
| Provider presets (local/OpenAI/OpenRouter/Anthropic) | Complete | |
| Moodle instance CRUD | Complete | |
| SQLite auto-migration | Complete | try/except ALTER TABLE pattern |
| Interactive API docs | Complete | `/docs` via FastAPI |

---

## Known Limitations

| Area | Limitation | Severity | Workaround |
| ---- | ---------- | -------- | ---------- |
| Scheduled Reviews | No background daemon — reviews only run when user clicks "Run overdue" | Low | Run manually from Settings, or add a cron job calling `POST /api/courses/schedules/run-overdue` |
| Course generation | Fixed at 5 modules; module count is not configurable | Medium | Fork and manually merge content for longer courses |
| Moodle deploy | Pushes section summaries only; does not create Page/Assignment/Quiz activities | Medium | Use `.mbz` restore for full activity deployment |
| Bible Validator | Verse-level validation is not performed (only book + chapter) | Low | Manually verify verse references |
| Curriculum Map | Domain scoring is keyword-based; does not understand context | Low | Scores are indicative, not authoritative |
| Analytics | Requires specific Moodle webservice functions that may not be enabled by default | Low | Enable functions in Moodle Site administration |
| Local LLM quality | Output quality is highly model-dependent | Medium | Use the Model Evaluation feature to select the best available model |
| No authentication | The web app has no login system; intended for local or intranet use | Medium | Run behind a VPN or firewall; do not expose to the open internet |

---

## Recommended Next Steps

### High Priority

1. **Background scheduler daemon** — Replace the manual "Run overdue" button with a background process (APScheduler or a cron job) that runs reviews automatically. This is the most significant gap in the Scheduled Reviews feature.

2. **Configurable module count** — Allow 3–10 modules instead of the fixed 5, controlled from the Course Studio identity step.

3. **User authentication** — Add optional Basic Auth or API-key protection so the app can be safely exposed on a LAN or small server.

### Medium Priority

4. **Full Moodle activity deploy** — Use the `.mbz` restore API (`core_backup_get_async_backup_progress`) or implement direct Page/Assignment/Quiz creation via REST to go beyond section summaries.

5. **Curriculum Map AI analysis** — Replace keyword matching with an LLM call that reads module content and tags it with domains more accurately.

6. **Version diff view** — The `VersionDiff.tsx` component exists but is not yet surfaced in the UI; wire it up to the version list so users can compare any two versions side-by-side.

7. **Multi-language course generation** — Add a language selector to the Course Studio that injects language instructions into the LLM prompts (currently the prompt must include language instructions manually).

### Low Priority

8. **Verse-level Bible validation** — Extend the validator to check verse counts per chapter.

9. **Quiz difficulty tagging** — Tag quiz questions as Easy / Medium / Hard and show distribution stats in the Quiz Bank editor.

10. **Export to Word/PDF** — Add a Word (`.docx`) export alongside the HTML export.

---

## Test Coverage

| Area | Coverage |
| ---- | -------- |
| Backend unit tests | None — relies on manual testing and type checking |
| Frontend unit tests | None |
| TypeScript type checking | Full (`npx tsc --noEmit` passes with zero errors) |
| Integration tests | None |
| End-to-end tests | None |

**Recommendation:** Add `pytest` tests for the core `.mbz` builder (`create_course.py`) and the `/api/courses/generate` pipeline as the highest-value first tests.

---

## Security Considerations

- API keys are stored in plaintext in `app/library.db`. Use filesystem permissions to restrict access.
- The app has no rate limiting or input sanitization beyond Pydantic model validation.
- The Moodle token is stored in the database and transmitted to the backend on every API call.
- The app should not be exposed to the public internet without adding authentication.

---

## Conclusion

The Moodle Course Creator delivers a complete, working MVP. The full pipeline — prompt → generated course → quality review → Moodle deploy — functions end-to-end. The two highest-value improvements for a v1.0 release are a background scheduler daemon and configurable module count. Authentication should be added before any public or multi-user deployment.
