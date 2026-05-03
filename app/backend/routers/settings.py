"""App settings + named Moodle instance management."""

import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..database import get_settings, set_setting

router = APIRouter(prefix="/settings", tags=["settings"])


# ── Models ────────────────────────────────────────────────────────────────────

class SettingsIn(BaseModel):
    moodle_url:   str = ""
    moodle_token: str = ""
    llm_url:      str = ""
    last_model:   str = ""


class MoodleInstanceIn(BaseModel):
    name:  str
    url:   str
    token: str


# ── Instance helpers ──────────────────────────────────────────────────────────

def _get_instances() -> list[dict]:
    raw = get_settings().get("moodle_instances", "[]")
    try:
        return json.loads(raw)
    except Exception:
        return []


def _save_instances(instances: list[dict]):
    set_setting("moodle_instances", json.dumps(instances, ensure_ascii=False))


def _mask(token: str) -> str:
    return ("*" * (len(token) - 4) + token[-4:]) if len(token) > 4 else token


# ── Settings endpoints ────────────────────────────────────────────────────────

@router.get("")
def read_settings():
    s = get_settings()
    token = s.get("moodle_token", "")
    s["moodle_token_masked"] = _mask(token)
    s["active_instance"] = s.get("active_instance", "")
    return s


@router.put("")
def write_settings(body: SettingsIn):
    data = body.model_dump()
    for url_key in ("moodle_url", "llm_url"):
        if data.get(url_key) and not data[url_key].startswith(("http://", "https://")):
            data[url_key] = "http://" + data[url_key]
    for key, value in data.items():
        if value:
            set_setting(key, value)
    return get_settings()


# ── Instance endpoints ────────────────────────────────────────────────────────

@router.get("/instances")
def list_instances():
    """Return all saved Moodle instances with masked tokens."""
    instances = _get_instances()
    active = get_settings().get("active_instance", "")
    return [
        {
            "name":         inst["name"],
            "url":          inst["url"],
            "token_masked": _mask(inst.get("token", "")),
            "active":       inst["name"] == active,
            "added_at":     inst.get("added_at", ""),
        }
        for inst in instances
    ]


@router.post("/instances")
def save_instance(body: MoodleInstanceIn):
    """Add or update a named Moodle instance."""
    url = body.url.strip()
    if url and not url.startswith(("http://", "https://")):
        url = "http://" + url

    instances = _get_instances()
    for inst in instances:
        if inst["name"] == body.name:
            inst["url"] = url
            if body.token:
                inst["token"] = body.token
            _save_instances(instances)
            return {"ok": True, "updated": True}

    instances.append({
        "name":     body.name,
        "url":      url,
        "token":    body.token,
        "added_at": datetime.now(timezone.utc).isoformat(),
    })
    _save_instances(instances)
    return {"ok": True, "updated": False}


@router.post("/instances/{name}/activate")
def activate_instance(name: str):
    """Set a saved instance as the active Moodle connection."""
    inst = next((i for i in _get_instances() if i["name"] == name), None)
    if not inst:
        raise HTTPException(404, f"Instance '{name}' not found")
    set_setting("moodle_url",        inst["url"])
    set_setting("moodle_token",      inst["token"])
    set_setting("active_instance",   name)
    return {"ok": True, "activated": name}


@router.delete("/instances/{name}")
def remove_instance(name: str):
    """Delete a saved instance."""
    instances = _get_instances()
    filtered  = [i for i in instances if i["name"] != name]
    if len(filtered) == len(instances):
        raise HTTPException(404, f"Instance '{name}' not found")
    _save_instances(filtered)
    if get_settings().get("active_instance") == name:
        set_setting("active_instance", "")
    return {"ok": True}
