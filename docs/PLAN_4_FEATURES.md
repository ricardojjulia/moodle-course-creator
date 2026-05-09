# Implementation Plan: 4 Feature Additions

## Status Summary

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| 1. Enhanced Moodle Deploy | partial | partial | **In progress** |
| 2. Single-Module Regeneration | ✓ done | ✓ done | **Complete** |
| 3. Bible Reference Validator | ✗ | ✗ | **To build** |
| 4. Quiz Bank Manager | ✓ done | ✓ done (core) | **Additions needed** |

---

## Feature 1 — Enhanced Moodle Deploy

### What Already Works
- `POST /moodle/deploy` creates a Moodle course shell and pushes each module's
  `lecture_html` as the section summary.
- Library.tsx has a deploy modal with category, shortname, fullname, and date fields.

### What's Missing
1. **Forum discussion seeding** — after the course is created, fetch its activity list
   and post each module's `forum_question` as the first discussion in the corresponding
   forum via `mod_forum_add_discussion`.
2. **Deploy history tracking** — a `moodle_deploys` table records every deploy event
   (version_id, moodle_course_id, url, sections_pushed, forums_seeded, deployed_at).
3. **Library deploy badge** — when a version is selected, show "Deployed X days ago →
   Open in Moodle" if a deploy record exists.

### Implementation

**`database.py`**
```sql
CREATE TABLE IF NOT EXISTS moodle_deploys (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id       INTEGER NOT NULL,
    shortname        TEXT    NOT NULL,
    moodle_course_id INTEGER NOT NULL,
    moodle_url       TEXT    NOT NULL DEFAULT '',
    sections_pushed  INTEGER NOT NULL DEFAULT 0,
    forums_seeded    INTEGER NOT NULL DEFAULT 0,
    deployed_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
```
New helpers: `save_deploy(version_id, shortname, moodle_course_id, moodle_url, sections_pushed, forums_seeded)`,
`list_deploys(version_id)`.

**`moodle.py` — `deploy_to_moodle`**
After pushing section summaries:
1. Fetch `core_course_get_contents` for the newly created course.
2. For each section (by section number), find forum activities.
3. If the corresponding module has a non-empty `forum_question`, call
   `mod_forum_add_discussion` with subject = module title, message = forum_question.
4. Call `save_deploy(...)` and return `forums_seeded` count in response.

New endpoint: `GET /moodle/deploys?version_id={vid}` → list deploy records.

**`client.ts`**
```typescript
export interface MoodleDeploy {
  id: number; version_id: number; shortname: string
  moodle_course_id: number; moodle_url: string
  sections_pushed: number; forums_seeded: number; deployed_at: string
}
// api.moodle.deploys(versionId) => Promise<MoodleDeploy[]>
```

**`Library.tsx`**
- On version select, call `api.moodle.deploys(vid)` and store in `deploys` state.
- Below version metadata, show: `Deployed 3 days ago · 5 sections · 4 forums → [Open in Moodle ↗]`
- After successful deploy, immediately refresh deploy list.

---

## Feature 2 — Single-Module Regeneration ✓ COMPLETE

**No new code needed.** Already fully implemented:
- Backend: `POST /courses/{sn}/versions/{vid}/modules/{num}/regenerate` (courses.py:1164)
- Frontend: "Regenerate" button in each ModulePanel — opens a modal with model selection,
  instructions field, and full-prompt mode. Only visible when `editProps` is passed
  (i.e., Course Studio, not Library read-only mode).

---

## Feature 3 — Bible Reference Validator

### Goal
Parse every text field in a course version for Bible citation patterns, validate them
against a canonical Spanish/English book list, and surface errors before the course
goes live.

### Patterns Recognized
```
(optional_num_prefix)(book_name)\s+(\d+)[:.]\s*(\d+)(?:\s*[-–]\s*\d+)?
```
Examples: `Juan 3:16`, `Ro 3:23`, `Gn 1:1`, `1 Jn 3:16–18`, `Hebreos 11:1`

### Implementation

**`courses.py` — new endpoint**
```
GET /courses/{sn}/versions/{vid}/bible-refs
```
Response:
```json
[
  {
    "ref_text": "Juan 3:16",
    "book_canonical": "Juan",
    "chapter": 3,
    "verse": 16,
    "source_field": "module_2.lecture_html",
    "context": "…Porque de tal manera amó Dios (Juan 3:16) que…",
    "status": "valid"   // "valid" | "unknown_book" | "chapter_out_of_range" | "verse_likely_ok"
  }
]
```

The validator uses a hardcoded map of ~80 Spanish book abbreviations → canonical name +
max chapter count for range validation. Verse-level validation uses max chapter count only
(exact verse counts per chapter are omitted for simplicity — a verse > 200 is flagged).

**`client.ts`**
```typescript
export interface BibleRef {
  ref_text: string; book_canonical: string; chapter: number; verse: number
  source_field: string; context: string; status: 'valid' | 'unknown_book' | 'chapter_out_of_range' | 'verse_likely_ok'
}
// api.courses.bibleRefs(sn, vid) => Promise<BibleRef[]>
```

**`CourseViewer.tsx`**
New accordion section "Bible References" below the Quiz Bank:
- "Scan" button (or auto-scans when `editProps` is present).
- Summary row: `12 references · 11 valid · 1 flagged`.
- Table: Ref | Book | Chapter | Source | Status badge.
- Status colors: green=valid, yellow=verse_likely_ok, red=unknown_book/chapter_out_of_range.

---

## Feature 4 — Quiz Bank Manager Additions

### What Already Works
- `PUT /courses/{sn}/versions/{vid}/quiz` replaces the full question bank.
- `QuizEditor` component: per-question edit, add, delete, save.
- View mode: read-only list of all questions with correct answer highlighted.

### What's Missing
1. **Export JSON** — download the current question bank as a `.json` file.
2. **Import JSON** — upload a JSON file, parse questions, append to existing bank.
3. **Reorder** — move individual questions up/down.

### Implementation

**`CourseViewer.tsx` — `QuizEditor` additions**

In the QuizEditor header button group:
```
[↑↓ Reorder mode toggle]  [⬆ Import JSON]  [⬇ Export JSON]  [Cancel]  [Save Quiz]
```

- Export: `URL.createObjectURL(new Blob([JSON.stringify(qs, null, 2)], {type:'application/json'}))`,
  trigger hidden `<a>` download.
- Import: hidden `<input type="file" accept=".json">`, on change parse JSON, validate shape
  (`question`, `options[4]`, `correct_index`), append to `qs`.
- Reorder: each question card gets ↑/↓ `ActionIcon` buttons on the left; swap adjacent items.

No backend changes needed — save goes through the existing `PUT /quiz` endpoint.

---

## Execution Order

1. `database.py` — moodle_deploys table + helpers
2. `moodle.py` — forum seeding + save_deploy + GET /moodle/deploys
3. `courses.py` — bible-refs endpoint
4. `client.ts` — MoodleDeploy, BibleRef types + api methods
5. `CourseViewer.tsx` — Bible References section + QuizEditor import/export/reorder
6. `Library.tsx` — deploy badge + Open in Moodle link
