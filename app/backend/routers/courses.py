"""Course library CRUD + .mbz build endpoints."""

import json
import re
import sys
import tarfile
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime
from io import BytesIO
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
import requests as http_requests

# Make create_course.py importable
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
import create_course as cc

from ..database import (
    db as _db,
    list_courses, get_course, upsert_course,
    list_versions, get_version, save_version, update_version_content,
    record_build, get_settings, delete_course, delete_version,
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


class ImportMbzIn(BaseModel):
    download_url: str
    filename: str = ""
    shortname: str = ""   # override parsed value if supplied
    fullname: str = ""    # override parsed value if supplied
    instance: str = "Local"


class _MbzReader:
    """Unified reader for .mbz files — handles both ZIP and tar.gz formats."""

    def __init__(self, mbz_bytes: bytes):
        if zipfile.is_zipfile(BytesIO(mbz_bytes)):
            self._zf       = zipfile.ZipFile(BytesIO(mbz_bytes))
            self._tf       = None
            self._name_map = {n: n for n in self._zf.namelist()}
        elif tarfile.is_tarfile(BytesIO(mbz_bytes)):
            self._zf = None
            self._tf = tarfile.open(fileobj=BytesIO(mbz_bytes), mode="r:*")
            raw = [m.name.lstrip("./") for m in self._tf.getmembers() if m.isfile()]
            # Strip common top-level directory prefix (e.g. "backup-moodle2-course-123-/")
            prefix = ""
            if raw:
                candidate = raw[0].split("/")[0] + "/"
                if len(candidate) > 1 and all(n.startswith(candidate) for n in raw):
                    prefix = candidate
            self._name_map = {n[len(prefix):]: n for n in raw}
        else:
            raise ValueError("File is not a recognised .mbz format (not ZIP or tar.gz)")
        self.names = set(self._name_map.keys())

    def open(self, name: str) -> BytesIO:
        if self._zf:
            return self._zf.open(self._name_map[name])
        raw = self._name_map[name]
        member = next(
            m for m in self._tf.getmembers()
            if m.name.lstrip("./") == raw and m.isfile()
        )
        return BytesIO(self._tf.extractfile(member).read())


def _parse_mbz(mbz_bytes: bytes) -> dict:
    """Extract course metadata and section structure from a .mbz file."""
    NULL = "$@NULL@$"

    def clean(text: str | None) -> str:
        if not text or text == NULL:
            return ""
        return re.sub(r"<[^>]+>", "", text).strip()

    zf = _MbzReader(mbz_bytes)
    names = zf.names

    shortname = fullname = start_date = end_date = ""

    # moodle_backup.xml — top-level info
    if "moodle_backup.xml" in names:
        try:
            root = ET.parse(zf.open("moodle_backup.xml")).getroot()
            info = root.find(".//information")
            if info is not None:
                shortname = info.findtext("original_course_shortname", "") or ""
                fullname  = info.findtext("original_course_fullname",  "") or ""
                if shortname == NULL: shortname = ""
                if fullname  == NULL: fullname  = ""
        except Exception:
            pass

    # course/course.xml — dates + fallback names
    if "course/course.xml" in names:
        try:
            root = ET.parse(zf.open("course/course.xml")).getroot()
            shortname = shortname or root.findtext("shortname", "") or ""
            fullname  = fullname  or root.findtext("fullname",  "") or ""
            sd = root.findtext("startdate", "0") or "0"
            ed = root.findtext("enddate",   "0") or "0"
            if int(sd) > 0:
                start_date = datetime.fromtimestamp(int(sd)).strftime("%Y-%m-%d")
            if int(ed) > 0:
                end_date   = datetime.fromtimestamp(int(ed)).strftime("%Y-%m-%d")
        except Exception:
            pass

    # ── Activity manifest from moodle_backup.xml ─────────────────────────────────
    # moduleid → {sectionid, modulename, title, directory}
    mod_info: dict[int, dict] = {}
    if "moodle_backup.xml" in names:
        try:
            root = ET.parse(zf.open("moodle_backup.xml")).getroot()
            for act in root.findall(".//contents/activities/activity"):
                mid   = int(act.findtext("moduleid",   "0") or 0)
                sid   = int(act.findtext("sectionid",  "0") or 0)
                mname = act.findtext("modulename", "") or ""
                title = act.findtext("title",      "") or ""
                # directory e.g. "activities/page_15" — strip any leading ./ or /
                directory = re.sub(r'^[./]+', '', (act.findtext("directory", "") or "").strip())
                if mid:
                    mod_info[mid] = {
                        "sectionid":  sid,
                        "modulename": mname,
                        "title":      title,
                        "directory":  directory,
                    }
        except Exception:
            pass

    # ── Sections ──────────────────────────────────────────────────────────────────
    section_pattern = re.compile(r"sections/section_\d+/section\.xml")
    sections_raw = []
    for name in names:
        if not section_pattern.match(name):
            continue
        try:
            root   = ET.parse(zf.open(name)).getroot()
            sec_id = int(root.get("id", "0") or 0)
            num         = int(root.findtext("number", "0") or 0)
            raw_name    = root.findtext("name",    "") or ""
            raw_summary = root.findtext("summary", "") or ""
            sections_raw.append({
                "number":    num,
                "sec_id":    sec_id,
                "title":     clean(raw_name) or ("General" if num == 0 else f"Module {num}"),
                "summary":   raw_summary,
                "objective": clean(raw_summary)[:300],
            })
        except Exception:
            continue

    sections_raw.sort(key=lambda s: s["number"])

    # ── Per-activity content: use directory from manifest to locate XML ──────────
    act_content: dict[int, str] = {}   # moduleid → content_html
    act_name_override: dict[int, str] = {}  # for labels whose title is empty

    for mod_id, info in mod_info.items():
        modname = info["modulename"]
        if not modname:
            continue

        # Resolve XML path: manifest directory → fallback by moduleid
        directory = info["directory"]
        directory = re.sub(r'^[./]+', '', directory) if directory else ""
        xml_path  = f"{directory}/{modname}.xml" if directory else ""

        # Fallback 1: infer from moduleid
        if not xml_path or xml_path not in names:
            xml_path = f"activities/{modname}_{mod_id}/{modname}.xml"

        # Fallback 2: search names for any matching file
        if xml_path not in names:
            pattern = re.compile(rf"activities/{re.escape(modname)}_\d+/{re.escape(modname)}\.xml")
            candidates = [n for n in names if pattern.match(n)]
            xml_path = candidates[0] if candidates else xml_path

        if xml_path not in names:
            continue

        try:
            root = ET.parse(zf.open(xml_path)).getroot()

            # Extract name from XML for activities where manifest title may be empty (e.g. label)
            xml_name = root.findtext(".//name", "") or ""
            if xml_name and xml_name != NULL:
                act_name_override[mod_id] = xml_name

            def _field(tag: str) -> str:
                v = root.findtext(f".//{tag}", "") or ""
                return "" if v == NULL else v

            if modname == "page":
                # Pages have both <intro> (shown before content) and <content> (main body)
                intro   = _field("intro")
                body    = _field("content")
                act_content[mod_id] = (intro + body).strip()
            else:
                # All other modules: try intro first, then fallback fields
                for field in ("intro", "content", "externalurl", "reference"):
                    val = _field(field)
                    if val:
                        act_content[mod_id] = val
                        break
        except Exception:
            continue

    # ── Group activities by section ───────────────────────────────────────────────
    sec_activities: dict[int, list[dict]] = {}
    for mod_id, info in mod_info.items():
        sid = info["sectionid"]
        if not sid:
            continue
        name = info["title"] or act_name_override.get(mod_id, "")
        sec_activities.setdefault(sid, []).append({
            "id":           mod_id,
            "name":         name,
            "modname":      info["modulename"],
            "content_html": act_content.get(mod_id, ""),
        })

    modules = [
        {"number": s["number"], "title": s["title"],
         "objective": s["objective"], "key_topics": []}
        for s in sections_raw
    ]
    module_contents = []
    for s in sections_raw:
        activities = sec_activities.get(s["sec_id"], [])
        # Use section summary as lecture; fall back to first page's content
        lecture_html = s["summary"]
        if not lecture_html.strip():
            page = next((a for a in activities if a["modname"] == "page"), None)
            if page:
                lecture_html = page["content_html"]
        # First forum intro → forum_question
        forum = next((a for a in activities if a["modname"] == "forum"), None)
        module_contents.append({
            "module_num":          s["number"],
            "lecture_html":        lecture_html,
            "glossary_terms":      [],
            "forum_question":      forum["content_html"] if forum else "",
            "activities_snapshot": activities,
        })

    return {
        "shortname":   shortname,
        "fullname":    fullname,
        "start_date":  start_date,
        "end_date":    end_date,
        "content": {
            "course_structure":  {"course_summary": "", "modules": modules},
            "module_contents":   module_contents,
            "syllabus":          {},
            "quiz_questions":    [],
            "homework_prompts":  {},
            "homework_spec":     {},
            "mbz_import":        True,
        },
    }


# ── Instance stats ────────────────────────────────────────────────────────────

@router.get("/stats")
def get_instance_stats(instance: str = "Local"):
    """Aggregate stats for all courses belonging to an instance."""
    with _db() as conn:
        row = conn.execute("""
            SELECT
                COUNT(DISTINCT c.shortname)  AS total_courses,
                COUNT(DISTINCT c.category)   AS total_categories
            FROM courses c
            WHERE c.instance = ?
        """, (instance,)).fetchone()

        total_courses     = row["total_courses"]    if row else 0
        total_categories  = row["total_categories"] if row else 0

        # Avg versions per course
        avg_row = conn.execute("""
            SELECT AVG(vc) AS avg_versions
            FROM (
                SELECT COUNT(v.id) AS vc
                FROM courses c
                LEFT JOIN course_versions v ON v.shortname = c.shortname
                WHERE c.instance = ?
                GROUP BY c.shortname
            ) sub
        """, (instance,)).fetchone()

        avg_versions = round(avg_row["avg_versions"], 1) if avg_row and avg_row["avg_versions"] is not None else None

        # Last activity: most recent version added for this instance
        last_row = conn.execute("""
            SELECT MAX(v.created_at) AS last_at
            FROM course_versions v
            JOIN courses c ON c.shortname = v.shortname
            WHERE c.instance = ?
        """, (instance,)).fetchone()

        last_activity_at = last_row["last_at"] if last_row else None

        # Version distribution: count courses by number of versions
        vdist_row = conn.execute("""
            SELECT
                SUM(CASE WHEN vc = 1 THEN 1 ELSE 0 END) AS v1_count,
                SUM(CASE WHEN vc = 2 THEN 1 ELSE 0 END) AS v2_count,
                SUM(CASE WHEN vc >= 3 THEN 1 ELSE 0 END) AS v3plus_count
            FROM (
                SELECT c.shortname, COUNT(v.id) AS vc
                FROM courses c
                LEFT JOIN course_versions v ON v.shortname = c.shortname
                WHERE c.instance = ?
                GROUP BY c.shortname
            ) sub
        """, (instance,)).fetchone()

        v1_count     = int(vdist_row["v1_count"]     or 0) if vdist_row else 0
        v2_count     = int(vdist_row["v2_count"]     or 0) if vdist_row else 0
        v3plus_count = int(vdist_row["v3plus_count"] or 0) if vdist_row else 0

    return {
        "total_courses":    total_courses,
        "total_categories": total_categories,
        "avg_versions":     avg_versions,
        "last_activity_at": last_activity_at,
        "v1_count":         v1_count,
        "v2_count":         v2_count,
        "v3plus_count":     v3plus_count,
    }


# ── Autonomous review ─────────────────────────────────────────────────────────

_JSON_OUTPUT_INSTRUCTION = """

---
RESPONSE FORMAT: Reply with ONLY a valid JSON object — no markdown fences, no prose before or after.
Required structure:
{
  "overall": "Passed" | "Needs Revision" | "Incomplete",
  "score": <integer 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "sections": [
    {
      "title": "<category from your review criteria>",
      "items": [
        {
          "label": "<specific check>",
          "status": "Passed" | "Needs Revision" | "Missing",
          "note": "<one sentence explanation>"
        }
      ]
    }
  ]
}"""


def _strip_html(text: str) -> str:
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', text)).strip()


def _format_for_review(shortname: str, ver: dict) -> str:
    """Render course content as structured plain text for LLM review."""
    content = ver.get("content", {}) if isinstance(ver.get("content"), dict) else {}
    structure = content.get("course_structure", {})
    modules   = structure.get("modules", [])
    mcs       = content.get("module_contents", [])

    lines = [
        f"COURSE SHORTNAME: {shortname}",
        f"TITLE: {structure.get('course_title', shortname)}",
        f"OBJECTIVE: {structure.get('course_objective', '—')}",
        f"VERSION: v{ver.get('version_num', '?')} | MODEL: {ver.get('model_used', '—')}",
        "",
    ]

    # Syllabus
    syllabus = content.get("syllabus")
    if syllabus:
        lines.append("=== SYLLABUS ===")
        if isinstance(syllabus, dict):
            for k, v in list(syllabus.items())[:8]:
                lines.append(f"  {k}: {str(v)[:250]}")
        else:
            lines.append(str(syllabus)[:800])
        lines.append("")

    # Modules
    for mod in modules:
        num   = mod.get("number") or mod.get("module_num", "?")
        title = mod.get("title", f"Module {num}")
        lines.append(f"=== MODULE {num}: {title} ===")
        lines.append(f"  Objective : {mod.get('objective', '—')}")
        lines.append(f"  Key Topics: {', '.join(mod.get('key_topics', []))}")

        mc = next((m for m in mcs if m.get("module_num") == num), None)
        if mc:
            lecture = mc.get("lecture_html", "")
            if lecture:
                clean = _strip_html(lecture)
                lines.append(f"  Lecture excerpt: {clean[:500]}")

            q = mc.get("discussion_question") or mc.get("forum_question", "")
            if q:
                lines.append(f"  Discussion question: {q}")

            glossary = mc.get("glossary") or mc.get("glossary_terms", [])
            if glossary:
                lines.append(f"  Glossary terms: {len(glossary)}")

            # Activities snapshot (Moodle imports)
            acts = mc.get("activities_snapshot", [])
            if acts:
                lines.append(f"  Activities: {', '.join(a.get('modname','?') + ':' + a.get('name','') for a in acts[:6])}")
        lines.append("")

    # Quiz
    quiz = content.get("quiz_questions", [])
    lines.append(f"=== ASSESSMENT ===")
    lines.append(f"  Quiz questions: {len(quiz)}")
    if quiz:
        sample = "; ".join(str(q.get("question", q))[:80] for q in quiz[:3])
        lines.append(f"  Sample: {sample}")

    # Homework
    hw = content.get("homework_spec", {})
    lines.append(f"  Homework modules: {len(hw)} ({', '.join(f'Mod {k}:{v}' for k, v in hw.items())})")

    return "\n".join(lines)


def _extract_json_block(text: str) -> str:
    m = re.search(r'\{.*\}', text, re.DOTALL)
    return m.group(0) if m else ""


@router.post("/{shortname}/review")
def review_course(shortname: str, body: dict):
    """Run an autonomous LLM audit on the latest version of a course."""
    agent_context = (body.get("agent_context") or "").strip()
    model_id      = (body.get("model_id")      or "").strip()

    if not agent_context:
        raise HTTPException(400, detail="agent_context is required and cannot be empty")

    vers = list_versions(shortname)
    if not vers:
        raise HTTPException(404, detail=f"No versions found for '{shortname}'")

    ver = get_version(vers[0]["id"])
    if not ver:
        raise HTTPException(404, detail="Version record not found")

    course_text = _format_for_review(shortname, ver)

    settings = get_settings()
    llm_url  = settings.get("llm_url", "")
    api_key  = settings.get("llm_api_key", "")

    if not llm_url:
        raise HTTPException(400, detail="LLM URL not configured — visit Settings.")

    system_msg = agent_context + _JSON_OUTPUT_INSTRUCTION
    messages   = [
        {"role": "system", "content": system_msg},
        {"role": "user",   "content": f"Audit this course:\n\n{course_text}"},
    ]

    try:
        raw = cc.call_llm(
            messages, llm_url,
            model_id=model_id or "local-model",
            temperature=0.2, max_tokens=2048,
            api_key=api_key,
        )
    except RuntimeError as exc:
        raise HTTPException(502, detail=str(exc))

    result = None
    for candidate in [raw, _extract_json_block(raw)]:
        if not candidate:
            continue
        try:
            result = json.loads(candidate)
            break
        except (json.JSONDecodeError, ValueError):
            pass

    if result is None:
        raise HTTPException(500, detail=f"LLM returned non-JSON: {raw[:300]}")

    return {
        "shortname":   shortname,
        "version_num": ver.get("version_num"),
        **result,
    }


# ── Regenerate course from review feedback ────────────────────────────────────

@router.post("/{shortname}/regenerate-from-review")
def regenerate_from_review(shortname: str, body: dict):
    """Fork the latest version and regenerate all modules using review findings as improvement instructions."""
    reviews  = body.get("reviews", [])
    model_id = (body.get("model_id") or "").strip()

    if not reviews:
        raise HTTPException(400, "reviews list is required")

    vers = list_versions(shortname)
    if not vers:
        raise HTTPException(404, f"No versions found for '{shortname}'")

    ver = get_version(vers[0]["id"])
    if not ver:
        raise HTTPException(404, "Version record not found")

    # ── Collect all failing/missing items from every review ───────────────────
    failing_items = []
    for review in reviews:
        agent_label = review.get("agent_label") or "Reviewer"
        for section in review.get("sections", []):
            section_title = section.get("title", "")
            for item in section.get("items", []):
                if item.get("status") in ("Needs Revision", "Missing"):
                    label = item.get("label", "")
                    note  = item.get("note", "")
                    failing_items.append(
                        f"[{agent_label} · {section_title}] {label}: {note}"
                    )

    if not failing_items:
        raise HTTPException(400, "No revision items found in the reviews — all checks passed")

    review_instructions = (
        "Apply ALL of the following improvements identified by expert reviewers:\n\n"
        + "\n".join(f"- {item}" for item in failing_items)
        + "\n\n"
        "Ensure every revision item above is directly addressed in the content you produce. "
        "Where content is flagged as Missing, add it in full. "
        "Where content Needs Revision, rewrite it to meet the standard described. "
        "Maintain the existing course structure and module titles."
    )

    # ── Fork the current version ──────────────────────────────────────────────
    new_rec = save_version(
        shortname,
        model_id or "reviewed",
        ver["start_date"], ver["end_date"],
        ver["content"],
    )
    new_vid = new_rec["id"]
    new_ver = get_version(new_vid)
    content = new_ver["content"]

    settings  = get_settings()
    llm_url   = settings.get("llm_url", cc.DEFAULT_LLM_URL)
    api_key   = settings.get("llm_api_key", "")
    course    = get_course(shortname)
    professor = (course or {}).get("professor", "")
    fullname  = (course or {}).get("fullname", shortname)
    eff_model = model_id or ver["model_used"]
    # Imported courses have non-LLM model_used values — fall back to last_model
    if eff_model in NON_REGENERABLE or not eff_model:
        eff_model = settings.get("last_model") or "local-model"

    modules = content.get("course_structure", {}).get("modules", [])
    mc_list = content.get("module_contents", [])

    # ── Regenerate every module with improvement instructions ─────────────────
    # For imported courses include the existing lecture as context so the LLM
    # can improve the actual content rather than generating from titles alone.
    for mod in modules:
        existing_mc = next(
            (m for m in mc_list if m.get("module_num") == mod["number"]), None
        )
        existing_text = ""
        if existing_mc:
            existing_text = _strip_html(existing_mc.get("lecture_html", ""))[:1200]

        mod_instructions = review_instructions
        if existing_text:
            mod_instructions = (
                "EXISTING MODULE CONTENT (use this as your starting point and improve it):\n"
                f"{existing_text}\n\n"
                + review_instructions
            )

        raw_mc = cc.generate_module_content(
            mod["number"], mod["title"], mod["objective"],
            mod.get("key_topics", []), fullname, professor,
            llm_url, eff_model,
            extra_instructions=mod_instructions,
            api_key=api_key,
        )
        normalized = {
            **raw_mc,
            "module_num":     mod["number"],
            "lecture_html":   cc.sections_to_html(raw_mc.get("sections", [])),
            "glossary_terms": [g.get("term", "") for g in raw_mc.get("glossary", [])],
            "forum_question": raw_mc.get("discussion_question", ""),
        }
        replaced = False
        for i, item in enumerate(mc_list):
            if item.get("module_num") == mod["number"]:
                mc_list[i] = normalized
                replaced = True
                break
        if not replaced:
            mc_list.append(normalized)

    content["module_contents"] = mc_list

    # ── Regenerate quiz if flagged or under-count ──────────────────────────────
    quiz_flagged = any(
        item.get("status") in ("Needs Revision", "Missing")
        and ("quiz" in (item.get("label", "") + item.get("note", "")).lower()
             or "question" in (item.get("label", "") + item.get("note", "")).lower())
        for review in reviews
        for section in review.get("sections", [])
        for item in section.get("items", [])
    )
    if quiz_flagged or len(content.get("quiz_questions", [])) < 30:
        content["quiz_questions"] = cc.generate_quiz_questions(
            fullname, modules, 40, llm_url, eff_model, api_key=api_key)

    # ── Regenerate syllabus to reflect improvements ───────────────────────────
    content["syllabus"] = cc.generate_syllabus(
        fullname, shortname, professor,
        modules, llm_url, eff_model, api_key=api_key)

    update_version_content(new_vid, content)
    return get_version(new_vid)


# ── Finalize review: quiz + syllabus only (frontend drives module steps) ──────

@router.post("/{shortname}/versions/{version_id}/finalize-review")
def finalize_review(shortname: str, version_id: int, body: dict):
    """Regenerate quiz (if flagged or < 30 q's) and syllabus. Called after all modules are done."""
    reviews  = body.get("reviews", [])
    model_id = (body.get("model_id") or "").strip()

    v = get_version(version_id)
    if not v or v["shortname"] != shortname:
        raise HTTPException(404, "Version not found")

    settings  = get_settings()
    llm_url   = settings.get("llm_url", cc.DEFAULT_LLM_URL)
    api_key   = settings.get("llm_api_key", "")
    course    = get_course(shortname)
    professor = (course or {}).get("professor", "")
    fullname  = (course or {}).get("fullname", shortname)
    eff_model = model_id or v["model_used"]
    if eff_model in NON_REGENERABLE or not eff_model:
        eff_model = settings.get("last_model") or "local-model"

    content = v["content"]
    modules = content.get("course_structure", {}).get("modules", [])

    quiz_flagged = any(
        item.get("status") in ("Needs Revision", "Missing")
        and ("quiz" in (item.get("label", "") + item.get("note", "")).lower()
             or "question" in (item.get("label", "") + item.get("note", "")).lower())
        for review in reviews
        for section in review.get("sections", [])
        for item in section.get("items", [])
    )
    if quiz_flagged or len(content.get("quiz_questions", [])) < 30:
        content["quiz_questions"] = cc.generate_quiz_questions(
            fullname, modules, 40, llm_url, eff_model, api_key=api_key)

    content["syllabus"] = cc.generate_syllabus(
        fullname, shortname, professor,
        modules, llm_url, eff_model, api_key=api_key)

    update_version_content(version_id, content)
    return get_version(version_id)


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
                  body.category, "", instance="Local")
    return save_version(shortname, body.model_used,
                        body.start_date, body.end_date, body.content)


# ── Bulk delete ───────────────────────────────────────────────────────────────

class BulkDeleteIn(BaseModel):
    shortnames: list[str]


@router.post("/bulk-delete")
def bulk_delete_courses(body: BulkDeleteIn):
    """Delete multiple courses and all their versions."""
    deleted, not_found = [], []
    for sn in body.shortnames:
        if delete_course(sn):
            deleted.append(sn)
        else:
            not_found.append(sn)
    return {"deleted": deleted, "not_found": not_found}


# ── Import .mbz from a URL (e.g. Moodle backup download) ────────────────────

@router.post("/import-mbz")
def import_mbz_from_url(body: ImportMbzIn):
    """Download a .mbz from a URL, parse its structure, save as a library version."""
    try:
        resp = http_requests.get(body.download_url, timeout=60)
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(502, f"Failed to download backup file: {e}")

    try:
        parsed = _parse_mbz(resp.content)
    except Exception as e:
        raise HTTPException(422, f"Could not parse .mbz file: {e}")

    shortname = body.shortname or parsed["shortname"] or "mbz-import"
    fullname  = body.fullname  or parsed["fullname"]  or shortname

    upsert_course(shortname, fullname, "", "", "", instance=body.instance)
    version = save_version(
        shortname, "mbz-import",
        parsed["start_date"], parsed["end_date"],
        parsed["content"],
    )
    return version


# ── Debug: inspect .mbz without saving ───────────────────────────────────────

@router.post("/debug-mbz")
async def debug_mbz(file: UploadFile = File(...)):
    """Return raw parse diagnostics for a .mbz without saving anything."""
    mbz_bytes = await file.read()
    zf = _MbzReader(mbz_bytes)
    all_names = sorted(zf.names)

    manifest_activities = []
    if "moodle_backup.xml" in zf.names:
        root = ET.parse(zf.open("moodle_backup.xml")).getroot()
        for act in root.findall(".//contents/activities/activity"):
            manifest_activities.append({
                "moduleid":   act.findtext("moduleid"),
                "sectionid":  act.findtext("sectionid"),
                "modulename": act.findtext("modulename"),
                "title":      act.findtext("title"),
                "directory":  act.findtext("directory"),
            })

    sec_pat = re.compile(r"sections/section_\d+/section\.xml")
    sections_found = []
    for name in all_names:
        if not sec_pat.match(name):
            continue
        root    = ET.parse(zf.open(name)).getroot()
        summary = root.findtext("summary", "") or ""
        sections_found.append({
            "file":            name,
            "id_attr":         root.get("id"),
            "number":          root.findtext("number"),
            "name":            root.findtext("name"),
            "summary_len":     len(summary),
            "summary_preview": summary[:120],
        })

    act_samples = []
    for act in manifest_activities:
        d    = (act["directory"] or "").strip()
        mn   = act["modulename"] or ""
        path = re.sub(r'^[./]+', '', d) + f"/{mn}.xml"
        exists = path in zf.names
        content_preview = ""
        if exists:
            r = ET.parse(zf.open(path)).getroot()
            if mn == "page":
                intro = r.findtext(".//intro",   "") or ""
                body  = r.findtext(".//content", "") or ""
                val   = (intro + body).strip()
            else:
                val = r.findtext(".//intro", "") or r.findtext(".//content", "") or ""
            content_preview = val[:200]
        act_samples.append({
            "moduleid":        act["moduleid"],
            "modulename":      mn,
            "title":           act["title"],
            "directory_raw":   act["directory"],
            "resolved_path":   path,
            "path_exists":     exists,
            "content_preview": content_preview,
        })

    return {
        "total_files":         len(all_names),
        "sections_found":      sections_found,
        "manifest_activities": manifest_activities,
        "activity_samples":    act_samples,
        "file_list_sample":    all_names[:80],
    }


# ── Import .mbz from a local file upload ─────────────────────────────────────

@router.post("/upload-mbz")
async def upload_mbz_file(file: UploadFile = File(...)):
    """Accept a .mbz file upload, parse its structure, save as a library version."""
    mbz_bytes = await file.read()
    try:
        parsed = _parse_mbz(mbz_bytes)
    except Exception as e:
        raise HTTPException(422, f"Could not parse .mbz file: {e}")

    shortname = parsed["shortname"] or (file.filename or "mbz-import").removesuffix(".mbz")
    fullname  = parsed["fullname"]  or shortname

    upsert_course(shortname, fullname, "", "", "", instance="Local")
    version = save_version(
        shortname, "mbz-import",
        parsed["start_date"], parsed["end_date"],
        parsed["content"],
    )
    return version


# ── Patch version content (homework_spec etc.) ───────────────────────────────

class PatchVersionIn(BaseModel):
    homework_spec: dict[str, str] | None = None


@router.patch("/{shortname}/versions/{version_id}")
def patch_version(shortname: str, version_id: int, body: PatchVersionIn):
    """Partially update a version's content (e.g. homework_spec)."""
    v = get_version(version_id)
    if not v or v["shortname"] != shortname:
        raise HTTPException(404, "Version not found")
    content = v["content"]
    if body.homework_spec is not None:
        content["homework_spec"] = {int(k): val for k, val in body.homework_spec.items()}
    updated = update_version_content(version_id, content)
    return updated


# ── Regenerate a single module's content ─────────────────────────────────────

NON_REGENERABLE = {"mbz-import", "moodle-import", "imported"}


class RegenerateModuleIn(BaseModel):
    instructions: str = ""
    model_id: str = ""
    custom_prompt: str = ""


@router.post("/{shortname}/versions/{version_id}/modules/{module_num}/regenerate")
def regenerate_module(shortname: str, version_id: int, module_num: int,
                      body: RegenerateModuleIn = None):
    """Re-run the LLM for one module and update the stored version in place."""
    v = get_version(version_id)
    if not v or v["shortname"] != shortname:
        raise HTTPException(404, "Version not found")
    if v["model_used"] in NON_REGENERABLE:
        raise HTTPException(400, "Cannot regenerate content for imported courses — use Generate Course instead")

    course = get_course(shortname)
    content = v["content"]
    modules = content.get("course_structure", {}).get("modules", [])
    mod = next((m for m in modules if m["number"] == module_num), None)
    if not mod:
        raise HTTPException(404, f"Module {module_num} not found in course structure")

    settings  = get_settings()
    llm_url   = settings.get("llm_url", cc.DEFAULT_LLM_URL)
    api_key   = settings.get("llm_api_key", "")
    professor = (course or {}).get("professor", "")
    fullname  = (course or {}).get("fullname", shortname)

    b = body or RegenerateModuleIn()
    model_id  = b.model_id.strip() or v["model_used"]
    raw_mc = cc.generate_module_content(
        mod["number"], mod["title"], mod["objective"],
        mod.get("key_topics", []), fullname, professor,
        llm_url, model_id,
        extra_instructions=b.instructions,
        custom_prompt=b.custom_prompt,
        api_key=api_key,
    )
    normalized = {
        **raw_mc,
        "module_num":     mod["number"],
        "lecture_html":   cc.sections_to_html(raw_mc.get("sections", [])),
        "glossary_terms": [item.get("term", "") for item in raw_mc.get("glossary", [])],
        "forum_question": raw_mc.get("discussion_question", ""),
    }

    mc_list = content.get("module_contents", [])
    replaced = False
    for i, item in enumerate(mc_list):
        if item.get("module_num") == module_num:
            mc_list[i] = normalized
            replaced = True
            break
    if not replaced:
        mc_list.append(normalized)
    content["module_contents"] = mc_list

    update_version_content(version_id, content)
    return {"ok": True, "module_content": normalized}


# ── Fork: save current version content as a new version ─────────────────────

@router.post("/{shortname}/versions/{version_id}/fork")
def fork_version(shortname: str, version_id: int):
    """Copy this version's content into a new version (version_num + 1)."""
    v = get_version(version_id)
    if not v or v["shortname"] != shortname:
        raise HTTPException(404, "Version not found")
    new_version = save_version(
        shortname, v["model_used"],
        v["start_date"], v["end_date"],
        v["content"],
    )
    return new_version


# ── Generate (calls LLM pipeline) ────────────────────────────────────────────

@router.post("/generate")
def generate_course(body: GenerateIn):
    """Run full LLM pipeline and store result as a new version."""
    settings = get_settings()
    llm_url  = settings.get("llm_url", cc.DEFAULT_LLM_URL)
    api_key  = settings.get("llm_api_key", "")

    from datetime import datetime, timedelta
    start_dt = (datetime.strptime(body.start_date, "%Y-%m-%d")
                if body.start_date else datetime.now())
    end_dt   = (datetime.strptime(body.end_date, "%Y-%m-%d")
                if body.end_date else start_dt + timedelta(weeks=8))

    # Step 1 — course structure
    course_structure = cc.generate_course_structure(
        body.shortname, body.fullname, body.prompt, llm_url, body.model_id, api_key=api_key)
    modules = course_structure["modules"]

    # Step 2 — module content
    module_contents = []
    for m in modules:
        mc = cc.generate_module_content(
            m["number"], m["title"], m["objective"],
            m.get("key_topics", []), body.fullname, body.professor,
            llm_url, body.model_id, api_key=api_key)
        # Normalise to the same shape as .mbz imports so the UI viewer works
        module_contents.append({
            **mc,
            "module_num":     m["number"],
            "lecture_html":   cc.sections_to_html(mc.get("sections", [])),
            "glossary_terms": [item.get("term", "") for item in mc.get("glossary", [])],
            "forum_question": mc.get("discussion_question", ""),
        })

    # Step 3 — syllabus
    syllabus = cc.generate_syllabus(
        body.fullname, body.shortname, body.professor,
        modules, llm_url, body.model_id, api_key=api_key)

    # Step 4 — quiz questions
    quiz_questions = cc.generate_quiz_questions(
        body.fullname, modules, body.num_questions, llm_url, body.model_id, api_key=api_key)

    # Step 5 — homework prompts (if requested)
    hw_spec = {int(k): v for k, v in body.homework_spec.items()}
    homework_prompts = {}
    if hw_spec:
        homework_prompts = cc.generate_homework_prompts(
            body.fullname, modules, hw_spec, llm_url, body.model_id, api_key=api_key)

    content = {
        "course_structure":  course_structure,
        "module_contents":   module_contents,
        "syllabus":          syllabus,
        "quiz_questions":    quiz_questions,
        "homework_prompts":  homework_prompts,
        "homework_spec":     hw_spec,
    }

    upsert_course(body.shortname, body.fullname, body.professor,
                  body.category, body.prompt, instance="Local")
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
