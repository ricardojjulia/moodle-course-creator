# Implementation Plan: Inline Editing + Review Persistence

## Feature A — Inline Content Editing

Allow professors to fix text, rewrite a lecture paragraph, or tweak a discussion
question directly in the viewer without triggering an LLM regeneration.

### Scope

| Target field       | Location                           |
| ------------------ | ---------------------------------- |
| Lecture HTML       | `content.module_contents[n].lecture_html`   |
| Forum question     | `content.module_contents[n].forum_question` |

Available everywhere the CourseViewer is rendered (Library + Course Studio).

### A1 — Backend (`courses.py`)

New endpoint:

```
PATCH /courses/{sn}/versions/{vid}/field
Body: { "module_num": 1, "field": "lecture_html", "value": "<p>…</p>" }
```

- Loads version content, finds the matching `module_contents` entry by `module_num`,
  sets `content[field] = value`, calls `update_version_content`.
- Returns `{ "ok": true }`.

### A2 — API client (`client.ts`)

```typescript
patchField(sn, vid, body: { module_num: number; field: string; value: string })
  => Promise<{ ok: boolean }>
```

### A3 — CourseViewer (`CourseViewer.tsx`)

- New optional prop on `CourseViewer`: `onFieldEdit?: (moduleNum, field, value) => Promise<void>`
- Pass it from Library and NewCourse.
- In `ModulePanel`:
  - `editingField: string | null` + `draft: string` + `saving: boolean` local state.
  - `localOverrides: Partial<ModuleContent>` — holds saved edits so re-fetch is unnecessary.
  - Pencil `ActionIcon` next to "Lecture" and "Forum Discussion Question" labels.
  - Click → switch to `Textarea` pre-filled with current content.
  - Save → call `onFieldEdit` → on success, write to `localOverrides` → exit edit mode.
  - Cancel → discard draft.

---

## Feature B — Review Persistence

Store every autonomous review result in SQLite so results survive navigation and
build up an audit history per course.

### B1 — Database (`database.py`)

New table:

```sql
CREATE TABLE IF NOT EXISTS reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  shortname    TEXT    NOT NULL,
  version_id   INTEGER,
  version_num  INTEGER,
  agent_id     TEXT    NOT NULL DEFAULT '',
  agent_label  TEXT    NOT NULL DEFAULT '',
  agent_color  TEXT    NOT NULL DEFAULT 'gray',
  overall      TEXT,
  score        INTEGER,
  summary      TEXT,
  sections_json TEXT   NOT NULL DEFAULT '[]',
  error        TEXT,
  run_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

Migration guard added so existing DBs are upgraded transparently.

Helpers: `save_review`, `list_reviews(shortname)`, `list_recent_reviews(limit)`,
`delete_review(id)`.

### B2 — Backend (`courses.py`)

- `review_course`: call `save_review` before returning the result JSON.
- `GET  /courses/{sn}/reviews` — most recent 50 reviews for a course.
- `DELETE /courses/{sn}/reviews/{rid}` — delete one entry.
- `GET  /reviews/recent` — last 100 across all courses (used by AutonomousReview on load).

### B3 — API client (`client.ts`)

New type `PersistedReview` (extends `CourseReviewResult` with `id`, `agent_id`,
`agent_color`, `run_at`).

New methods under `api.reviews`:
`list(sn)`, `recent()`, `delete(id)`.

### B4 — AutonomousReview (`AutonomousReview.tsx`)

- On mount, call `api.reviews.recent()` and populate a `history` state.
- New collapsible **Review History** section below results: table of
  `course | agent | overall | score | version | date` rows, sorted newest-first.
- Each row has a trash icon to delete that entry.
- After every live review run, newly persisted results automatically appear
  when the history section is next opened (backend handles persistence).

### B5 — Library (`Library.tsx`)

- When a course version is selected, call `api.courses.listReviews(sn)` (filtered
  to `version_id`).
- Show a compact inline badge row below the version metadata:
  `Last review: Course Reviewer — Passed 87/100 — 3 days ago`.
- If multiple agents reviewed, show the lowest score (worst result) as the
  primary badge.

---

## Implementation Order

1. `database.py` — reviews table + helpers
2. `courses.py` — patchField endpoint + review persistence + review list/delete endpoints
3. `main.py` — mount `/reviews/recent` route
4. `client.ts` — new types + methods
5. `CourseViewer.tsx` — inline edit UI
6. `Library.tsx` — pass `onFieldEdit` + show last-review badge
7. `AutonomousReview.tsx` — history section on load
