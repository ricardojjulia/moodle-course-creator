"""Course library CRUD + .mbz build endpoints."""

import sys
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Make create_course.py importable
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
import create_course as cc

from ..database import (
    list_courses, get_course, upsert_course,
    list_versions, get_version, save_version, record_build, get_settings,
    delete_course, delete_version,
)

router = APIRouter(prefix="/courses", tags=["courses"])

BUILD_DIR = Path(__file__).parent.parent.parent / "builds"
BUILD_DIR.mkdir(exist_ok=True)


# ── Request / Response models ─────────────────────────────────────────────────

class CourseIn(BaseModel):
    shortname: str
    fullname: str
    professor: str = "Ricardo Julia"
    category: str = "2025 - 2026 Spring Term"
    prompt: str = ""


class GenerateIn(BaseModel):
    shortname: str
    fullname: str
    professor: str = "Ricardo Julia"
    category: str = "2025 - 2026 Spring Term"
    prompt: str
    start_date: str = ""
    end_date: str = ""
    model_id: str
    num_questions: int = 50
    homework_spec: dict[str, str] = {}   # {"1": "assign", "3": "forum"}


class ImportVersionIn(BaseModel):
    shortname: str
    fullname: str
    professor: str = "Ricardo Julia"
    category: str = "2025 - 2026 Spring Term"
    model_used: str = "imported"
    start_date: str = ""
    end_date: str = ""
    content: dict


# ── Courses ───────────────────────────────────────────────────────────────────

@router.get("")
def get_courses():
    return list_courses()


@router.get("/{shortname}")
def get_one_course(shortname: str):
    course = get_course(shortname)
    if not course:
        raise HTTPException(404, f"Course {shortname} not found")
    return course


@router.put("/{shortname}")
def update_course(shortname: str, body: CourseIn):
    return upsert_course(shortname, body.fullname, body.professor,
                         body.category, body.prompt)


# ── Versions ──────────────────────────────────────────────────────────────────

@router.get("/{shortname}/versions")
def get_versions(shortname: str):
    return list_versions(shortname)


@router.get("/{shortname}/versions/{version_id}")
def get_one_version(shortname: str, version_id: int):
    v = get_version(version_id)
    if not v or v["shortname"] != shortname:
        raise HTTPException(404, "Version not found")
    return v


@router.delete("/{shortname}")
def remove_course(shortname: str):
    if not delete_course(shortname):
        raise HTTPException(404, f"Course {shortname} not found")
    return {"deleted": shortname}


@router.delete("/{shortname}/versions/{version_id}")
def remove_version(shortname: str, version_id: int):
    v = get_version(version_id)
    if not v or v["shortname"] != shortname:
        raise HTTPException(404, "Version not found")
    delete_version(version_id)
    return {"deleted": version_id}


@router.post("/{shortname}/versions/import")
def import_version(shortname: str, body: ImportVersionIn):
    """Save an existing content dict as a new version (no LLM needed)."""
    upsert_course(shortname, body.fullname, body.professor,
                  body.category, "")
    return save_version(shortname, body.model_used,
                        body.start_date, body.end_date, body.content)


# ── Generate (calls LLM pipeline) ────────────────────────────────────────────

@router.post("/generate")
def generate_course(body: GenerateIn):
    """Run full LLM pipeline and store result as a new version."""
    settings = get_settings()
    llm_url  = settings.get("llm_url", cc.DEFAULT_LLM_URL)

    from datetime import datetime, timedelta
    start_dt = (datetime.strptime(body.start_date, "%Y-%m-%d")
                if body.start_date else datetime.now())
    end_dt   = (datetime.strptime(body.end_date, "%Y-%m-%d")
                if body.end_date else start_dt + timedelta(weeks=8))

    # Step 1 — course structure
    course_structure = cc.generate_course_structure(
        body.shortname, body.fullname, body.prompt, llm_url, body.model_id)
    modules = course_structure["modules"]

    # Step 2 — module content
    module_contents = []
    for m in modules:
        mc = cc.generate_module_content(
            m["number"], m["title"], m["objective"],
            m.get("key_topics", []), body.fullname, body.professor,
            llm_url, body.model_id)
        module_contents.append(mc)

    # Step 3 — syllabus
    syllabus = cc.generate_syllabus(
        body.fullname, body.shortname, body.professor,
        modules, llm_url, body.model_id)

    # Step 4 — quiz questions
    quiz_questions = cc.generate_quiz_questions(
        body.fullname, modules, body.num_questions, llm_url, body.model_id)

    # Step 5 — homework prompts (if requested)
    hw_spec = {int(k): v for k, v in body.homework_spec.items()}
    homework_prompts = {}
    if hw_spec:
        homework_prompts = cc.generate_homework_prompts(
            body.fullname, modules, hw_spec, llm_url, body.model_id)

    content = {
        "course_structure":  course_structure,
        "module_contents":   module_contents,
        "syllabus":          syllabus,
        "quiz_questions":    quiz_questions,
        "homework_prompts":  homework_prompts,
        "homework_spec":     hw_spec,
    }

    upsert_course(body.shortname, body.fullname, body.professor,
                  body.category, body.prompt)
    version = save_version(body.shortname, body.model_id,
                           body.start_date, body.end_date, content)
    return version


# ── Build .mbz ────────────────────────────────────────────────────────────────

@router.post("/{shortname}/versions/{version_id}/build")
def build_mbz(shortname: str, version_id: int):
    v = get_version(version_id)
    if not v or v["shortname"] != shortname:
        raise HTTPException(404, "Version not found")

    course = get_course(shortname)
    if not course:
        raise HTTPException(404, "Course not found")

    from datetime import datetime
    start_date = v.get("start_date", "")
    end_date   = v.get("end_date", "")
    start_dt   = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now()
    from datetime import timedelta
    end_dt     = datetime.strptime(end_date, "%Y-%m-%d") if end_date else start_dt + timedelta(weeks=8)

    # homework_spec may be stored in content as {str_key: str} — normalise to {int: str}
    raw_hw = v["content"].get("homework_spec", {})
    hw_spec = {int(k): val for k, val in raw_hw.items()}

    config = {
        "shortname":     shortname,
        "fullname":      course["fullname"],
        "professor":     course["professor"],
        "category":      course["category"],
        "start_ts":      int(start_dt.timestamp()),
        "end_ts":        int(end_dt.timestamp()),
        "homework_spec": hw_spec,
    }

    mbz_bytes = cc.build_mbz(config, v["content"])
    filename  = f"{shortname}_v{v['version_num']}.mbz"
    out_path  = BUILD_DIR / filename
    out_path.write_bytes(mbz_bytes)
    record_build(version_id, filename)

    return {"filename": filename, "size_kb": round(len(mbz_bytes) / 1024, 1)}


@router.get("/{shortname}/versions/{version_id}/download")
def download_mbz(shortname: str, version_id: int):
    v = get_version(version_id)
    if not v or v["shortname"] != shortname:
        raise HTTPException(404, "Version not found")

    filename = f"{shortname}_v{v['version_num']}.mbz"
    path     = BUILD_DIR / filename
    if not path.exists():
        # Auto-build if not cached
        build_mbz(shortname, version_id)
    return FileResponse(path, media_type="application/octet-stream",
                        filename=filename)
