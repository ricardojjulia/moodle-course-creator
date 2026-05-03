"""Moodle REST API proxy — fetch courses, inspect structure, push updates."""

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..database import get_settings, upsert_course, save_version

router = APIRouter(prefix="/moodle", tags=["moodle"])


def _moodle_call(function: str, params: dict = None, settings: dict = None) -> dict | list:
    s = settings or get_settings()
    url   = s.get("moodle_url", "").rstrip("/") + "/webservice/rest/server.php"
    token = s.get("moodle_token", "")
    if not token:
        raise HTTPException(400, "Moodle token not configured — set it in Settings")

    payload = {
        "wstoken":             token,
        "moodlewsrestformat":  "json",
        "wsfunction":          function,
        **(params or {}),
    }
    try:
        resp = requests.post(url, data=payload, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(502, f"Moodle unreachable: {e}")

    data = resp.json()
    if isinstance(data, dict) and "exception" in data:
        raise HTTPException(400, f"Moodle error: {data.get('message', data)}")
    return data


# ── Connection test ───────────────────────────────────────────────────────────

@router.get("/ping")
def ping_moodle():
    data = _moodle_call("core_webservice_get_site_info")
    return {
        "ok":          True,
        "site_name":   data.get("sitename"),
        "moodle_version": data.get("release"),
        "username":    data.get("username"),
        "fullname":    data.get("fullname"),
    }


# ── Courses ───────────────────────────────────────────────────────────────────

@router.get("/courses")
def get_moodle_courses():
    data = _moodle_call("core_course_get_courses")
    courses = []
    for c in data:
        if c.get("id", 0) == 1:  # skip site-level course
            continue
        courses.append({
            "id":        c["id"],
            "shortname": c.get("shortname", ""),
            "fullname":  c.get("fullname", ""),
            "summary":   c.get("summary", ""),
            "startdate": c.get("startdate", 0),
            "enddate":   c.get("enddate", 0),
            "visible":   c.get("visible", 1),
            "category":  c.get("categoryid", 0),
        })
    return courses


@router.get("/courses/{course_id}/contents")
def get_course_contents(course_id: int):
    """Return sections + activities with their type and current name."""
    data = _moodle_call("core_course_get_contents",
                        {"courseid": course_id})
    sections = []
    for sec in data:
        activities = []
        for mod in sec.get("modules", []):
            activities.append({
                "id":       mod.get("id"),
                "name":     mod.get("name"),
                "modname":  mod.get("modname"),
                "visible":  mod.get("visible", 1),
                "url":      mod.get("url", ""),
                # what can be pushed via API
                "api_updatable": mod.get("modname") in ("page", "forum", "assign", "quiz"),
            })
        sections.append({
            "id":         sec.get("id"),
            "section":    sec.get("section"),
            "name":       sec.get("name") or f"Section {sec.get('section', 0)}",
            "summary":    sec.get("summary", ""),
            "activities": activities,
        })
    return sections


# ── Push updates ──────────────────────────────────────────────────────────────

class SectionUpdateIn(BaseModel):
    section_id: int
    summary: str


class ForumPostIn(BaseModel):
    forum_id: int         # cmid of the forum activity
    subject: str
    message: str


class CourseMetaIn(BaseModel):
    course_id: int
    fullname: str = ""
    shortname: str = ""
    summary: str = ""
    startdate: int = 0
    enddate: int = 0


@router.post("/courses/{course_id}/meta")
def update_course_meta(course_id: int, body: CourseMetaIn):
    """Update course name, dates, summary."""
    update = {"courses[0][id]": course_id}
    if body.fullname:
        update["courses[0][fullname]"] = body.fullname
    if body.shortname:
        update["courses[0][shortname]"] = body.shortname
    if body.summary:
        update["courses[0][summary]"]       = body.summary
        update["courses[0][summaryformat]"] = 1
    if body.startdate:
        update["courses[0][startdate]"] = body.startdate
    if body.enddate:
        update["courses[0][enddate]"] = body.enddate

    _moodle_call("core_course_update_courses", update)
    return {"ok": True}


@router.post("/sections/summary")
def update_section_summary(body: SectionUpdateIn):
    """Update a section's summary text."""
    _moodle_call("core_course_edit_section", {
        "sectionid": body.section_id,
        "summaryformat": 1,
        "summary": body.summary,
    })
    return {"ok": True}


@router.post("/forum/discussion")
def add_forum_discussion(body: ForumPostIn):
    """Add a new discussion post to a forum."""
    result = _moodle_call("mod_forum_add_discussion", {
        "forumid": body.forum_id,
        "subject": body.subject,
        "message": body.message,
        "messageformat": 1,
    })
    return {"ok": True, "discussion_id": result.get("discussionid")}


# ── Import live course into local library ────────────────────────────────────

class MoodleImportIn(BaseModel):
    shortname: str
    fullname: str
    start_date: str = ""
    end_date: str = ""
    professor: str = ""
    category: str = ""
    instance: str = "Local"


@router.post("/courses/{course_id}/import")
def import_course_to_library(course_id: int, body: MoodleImportIn):
    """Snapshot a live Moodle course's section structure into the local library."""
    import re
    sections_raw = _moodle_call("core_course_get_contents", {"courseid": course_id})

    real_sections = [s for s in sections_raw if s.get("section", 0) != 0]
    modules = []
    module_contents = []

    for i, sec in enumerate(real_sections[:5], start=1):
        summary = sec.get("summary") or ""
        plain = re.sub(r"<[^>]+>", "", summary).strip()

        activities = []
        for m in sec.get("modules", []):
            # Capture inline content for pages / assignments
            content_html = ""
            for c in m.get("contents", []):
                if c.get("type") == "content":
                    content_html = c.get("content", "")
                    break
            if not content_html:
                content_html = m.get("description", "") or ""
            activities.append({
                "id":           m.get("id"),
                "name":         m.get("name"),
                "modname":      m.get("modname"),
                "content_html": content_html,
            })

        modules.append({
            "number": i,
            "title": sec.get("name") or f"Module {i}",
            "objective": plain[:300],
            "key_topics": [],
        })
        module_contents.append({
            "module_num": i,
            "lecture_html": summary,
            "glossary_terms": [],
            "forum_question": "",
            "activities_snapshot": activities,
        })

    content = {
        "course_structure":  {"course_summary": "", "modules": modules},
        "module_contents":   module_contents,
        "syllabus":          {},
        "quiz_questions":    [],
        "homework_prompts":  {},
        "homework_spec":     {},
        "moodle_import":     True,
        "moodle_course_id":  course_id,
    }

    professor = body.professor or get_settings().get("professor", "")
    upsert_course(body.shortname, body.fullname, professor, body.category, "",
                  instance=body.instance or "Local")
    version = save_version(body.shortname, "moodle-import",
                           body.start_date, body.end_date, content)
    return version


# ── Single module content ─────────────────────────────────────────────────────

@router.get("/courses/{course_id}/modules/{cmid}")
def get_module_content(course_id: int, cmid: int):
    """Return the HTML body and description of a single course module."""
    sections = _moodle_call("core_course_get_contents", {"courseid": course_id})
    for sec in sections:
        for mod in sec.get("modules", []):
            if mod.get("id") != cmid:
                continue
            # Inline content (page body, label HTML, etc.)
            content_html = ""
            for c in mod.get("contents", []):
                if c.get("type") == "content":
                    content_html = c.get("content", "")
                    break
            # Assignment / forum description fallback
            if not content_html:
                content_html = mod.get("description", "")
            return {
                "id":           cmid,
                "name":         mod.get("name", ""),
                "modname":      mod.get("modname", ""),
                "content_html": content_html,
                "url":          mod.get("url", ""),
            }
    raise HTTPException(404, f"Module {cmid} not found in course {course_id}")


# ── Check for existing backup files ──────────────────────────────────────────

@router.get("/courses/{course_id}/backups")
def get_course_backups(course_id: int):
    """Check Moodle's automated backup area for existing .mbz files."""
    s = get_settings()
    moodle_url = s.get("moodle_url", "").rstrip("/")
    token = s.get("moodle_token", "")

    try:
        data = _moodle_call("core_files_get_files", {
            "contextid":    -1,
            "contextlevel": "course",
            "instanceid":   course_id,
            "component":    "backup",
            "filearea":     "automated",
            "itemid":       0,
            "filepath":     "/",
            "filename":     "",
        })
    except Exception:
        return {"files": []}

    files = []
    for f in data.get("files", []):
        name = f.get("filename", "")
        if not name or name == ".":
            continue
        ctx = f.get("contextid", "")
        dl_url = (
            f"{moodle_url}/webservice/pluginfile.php/{ctx}/backup/automated/1/{name}"
            f"?token={token}"
        )
        files.append({
            "filename":    name,
            "size_kb":     round(f.get("filesize", 0) / 1024, 1),
            "modified":    f.get("timemodified", 0),
            "download_url": dl_url,
        })
    return {"files": files}


# ── Capabilities summary (what each modtype supports via API) ─────────────────

@router.get("/capabilities")
def get_capabilities():
    return [
        {"modname": "page",   "can_push": False,
         "note": "Page body content has no REST update endpoint — use .mbz restore"},
        {"modname": "forum",  "can_push": True,
         "note": "Can add new discussion posts via mod_forum_add_discussion"},
        {"modname": "assign", "can_push": False,
         "note": "Assignment description requires .mbz restore to update"},
        {"modname": "quiz",   "can_push": False,
         "note": "Quiz questions require .mbz restore to update"},
        {"modname": "course", "can_push": True,
         "note": "Course name, dates, summary updatable via core_course_update_courses"},
        {"modname": "section","can_push": True,
         "note": "Section summary updatable via core_course_edit_section"},
    ]
