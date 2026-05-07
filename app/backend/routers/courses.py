"""Course library CRUD + .mbz build endpoints."""

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
