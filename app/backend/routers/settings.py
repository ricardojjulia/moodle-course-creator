"""App settings endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

from ..database import get_settings, set_setting

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsIn(BaseModel):
    moodle_url:   str = ""
    moodle_token: str = ""
    llm_url:      str = ""
    last_model:   str = ""


@router.get("")
def read_settings():
    s = get_settings()
    # Never expose the token in full — mask it
    token = s.get("moodle_token", "")
    s["moodle_token_masked"] = ("*" * (len(token) - 4) + token[-4:]) if len(token) > 4 else token
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
