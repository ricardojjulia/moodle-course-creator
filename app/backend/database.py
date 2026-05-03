"""SQLite database setup — courses, versions, settings."""

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "library.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def db():
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS courses (
            shortname   TEXT PRIMARY KEY,
            fullname    TEXT NOT NULL,
            professor   TEXT NOT NULL DEFAULT 'Ricardo Julia',
            category    TEXT NOT NULL DEFAULT '2025 - 2026 Spring Term',
            prompt      TEXT NOT NULL DEFAULT '',
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS course_versions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            shortname   TEXT NOT NULL REFERENCES courses(shortname) ON DELETE CASCADE,
            version_num INTEGER NOT NULL,
            model_used  TEXT NOT NULL DEFAULT '',
            start_date  TEXT NOT NULL DEFAULT '',
            end_date    TEXT NOT NULL DEFAULT '',
            content     TEXT NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(shortname, version_num)
        );

        CREATE TABLE IF NOT EXISTS mbz_builds (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id INTEGER NOT NULL REFERENCES course_versions(id) ON DELETE CASCADE,
            built_at   TEXT NOT NULL DEFAULT (datetime('now')),
            filename   TEXT NOT NULL
        );
        """)

    _seed_settings()


def _seed_settings():
    defaults = {
        "moodle_url":   "https://biblos.moodlecloud.com",
        "moodle_token": "",
        "llm_url":      "http://192.168.86.41:1234/v1",
        "last_model":   "",
    }
    with db() as conn:
        for key, value in defaults.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)",
                (key, value),
            )


# ── Settings helpers ──────────────────────────────────────────────────────────

def get_settings() -> dict:
    with db() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
    return {r["key"]: r["value"] for r in rows}


def set_setting(key: str, value: str):
    with db() as conn:
        conn.execute(
            "INSERT INTO settings(key, value) VALUES(?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )


# ── Course helpers ────────────────────────────────────────────────────────────

def list_courses() -> list[dict]:
    with db() as conn:
        rows = conn.execute("""
            SELECT c.shortname, c.fullname, c.professor, c.category,
                   c.prompt, c.created_at,
                   COUNT(v.id) AS version_count,
                   MAX(v.version_num) AS latest_version
            FROM courses c
            LEFT JOIN course_versions v ON v.shortname = c.shortname
            GROUP BY c.shortname
            ORDER BY c.created_at DESC
        """).fetchall()
    return [dict(r) for r in rows]


def get_course(shortname: str) -> dict | None:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM courses WHERE shortname=?", (shortname,)
        ).fetchone()
    return dict(row) if row else None


def upsert_course(shortname: str, fullname: str, professor: str,
                  category: str, prompt: str) -> dict:
    with db() as conn:
        conn.execute("""
            INSERT INTO courses(shortname, fullname, professor, category, prompt)
            VALUES(?,?,?,?,?)
            ON CONFLICT(shortname) DO UPDATE SET
                fullname=excluded.fullname,
                professor=excluded.professor,
                category=excluded.category,
                prompt=excluded.prompt
        """, (shortname, fullname, professor, category, prompt))
    return get_course(shortname)


# ── Version helpers ───────────────────────────────────────────────────────────

def list_versions(shortname: str) -> list[dict]:
    with db() as conn:
        rows = conn.execute("""
            SELECT v.id, v.shortname, v.version_num, v.model_used,
                   v.start_date, v.end_date, v.created_at,
                   COUNT(b.id) AS build_count
            FROM course_versions v
            LEFT JOIN mbz_builds b ON b.version_id = v.id
            WHERE v.shortname=?
            GROUP BY v.id
            ORDER BY v.version_num DESC
        """, (shortname,)).fetchall()
    return [dict(r) for r in rows]


def get_version(version_id: int) -> dict | None:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM course_versions WHERE id=?", (version_id,)
        ).fetchone()
    if not row:
        return None
    result = dict(row)
    result["content"] = json.loads(result["content"])
    return result


def save_version(shortname: str, model_used: str, start_date: str,
                 end_date: str, content: dict) -> dict:
    with db() as conn:
        row = conn.execute(
            "SELECT COALESCE(MAX(version_num), 0) AS max_v "
            "FROM course_versions WHERE shortname=?", (shortname,)
        ).fetchone()
        next_v = row["max_v"] + 1
        cur = conn.execute("""
            INSERT INTO course_versions
                (shortname, version_num, model_used, start_date, end_date, content)
            VALUES (?,?,?,?,?,?)
        """, (shortname, next_v, model_used, start_date, end_date,
              json.dumps(content, ensure_ascii=False)))
        version_id = cur.lastrowid
    return get_version(version_id)


def record_build(version_id: int, filename: str):
    with db() as conn:
        conn.execute(
            "INSERT INTO mbz_builds(version_id, filename) VALUES(?,?)",
            (version_id, filename),
        )


def delete_version(version_id: int) -> bool:
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM course_versions WHERE id=?", (version_id,)
        )
    return cur.rowcount > 0


def delete_course(shortname: str) -> bool:
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM courses WHERE shortname=?", (shortname,)
        )
    return cur.rowcount > 0
