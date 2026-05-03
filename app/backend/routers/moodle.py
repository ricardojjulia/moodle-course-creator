"""Moodle REST API proxy — fetch courses, inspect structure, push updates."""

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..database import get_settings

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
