"""LLM model listing and evaluation endpoints."""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
import create_course as cc

from ..database import get_settings, set_setting

router = APIRouter(prefix="/llm", tags=["llm"])


class EvaluateIn(BaseModel):
    llm_url: str = ""


@router.get("/models")
def list_models(llm_url: str = ""):
    url = llm_url or get_settings().get("llm_url", cc.DEFAULT_LLM_URL)
    try:
        models = cc._fetch_models(url)
    except Exception as e:
        raise HTTPException(503, f"Cannot reach LLM server at {url} — {e}")
    result = []
    for m in models:
        specs = cc._infer_specs(m)
        result.append({
            "id":          m,
            "arch":        specs.get("arch", "unknown"),
            "size_b":      specs.get("size_b", 0),
            "quant":       specs.get("quant", "unknown"),
            "ctx_k":       specs.get("ctx_k", 0),
            "size_score":  specs.get("size_score", 5),
            "quant_score": specs.get("quant_score", 5),
            "arch_score":  specs.get("arch_score", 5),
        })
    return result


@router.get("/evaluation")
def get_evaluation_cache():
    """Return the last saved evaluation results without re-running."""
    raw = get_settings().get("eval_cache")
    if not raw:
        return {"results": [], "evaluated_at": None, "llm_url": None}
    return json.loads(raw)


@router.post("/evaluate")
def evaluate_models(body: EvaluateIn):
    """Run the 90-second theology test against all available models and cache results."""
    url = body.llm_url or get_settings().get("llm_url", cc.DEFAULT_LLM_URL)
    try:
        models = cc._fetch_models(url)
    except Exception as e:
        raise HTTPException(503, f"Cannot reach LLM server at {url} — is it running?")
    results = []
    for model_id in models:
        specs  = cc._infer_specs(model_id)
        result = cc._evaluate_model(url, model_id, timeout=90)
        score  = cc._final_score(result, specs)
        results.append({
            "id":            model_id,
            "arch":          specs.get("arch", "unknown"),
            "size_b":        specs.get("size_b", 0),
            "quant":         specs.get("quant", "unknown"),
            "accuracy":      round(result.get("accuracy", 0), 2),
            "speed":         round(result.get("speed", 0), 2),
            "model_quality": round(result.get("model_quality", 0), 2),
            "final_score":   round(score, 2),
            "json_valid":    result.get("json_valid", False),
            "elapsed_s":     round(result.get("elapsed_s", 0), 1),
        })

    results.sort(key=lambda x: x["final_score"], reverse=True)

    evaluated_at = datetime.now(timezone.utc).isoformat()

    # Persist cache and top model
    set_setting("eval_cache", json.dumps({
        "results":      results,
        "evaluated_at": evaluated_at,
        "llm_url":      url,
    }))
    if results:
        set_setting("last_model", results[0]["id"])
        set_setting("llm_url", url)

    return {"results": results, "evaluated_at": evaluated_at, "llm_url": url}
