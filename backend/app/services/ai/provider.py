"""Which mode each AI provider runs in.

    mode(name) -> "fixture" | "record" | "live"

Resolution order: <NAME>_MODE, else "live" when that provider's key is set, else AI_MODE (default "fixture").
So the only thing needed to switch the photo studio to the real fal.ai model is FAL_KEY in the environment.
A "live" mode without a key always falls back to "fixture" (never a crash because a key is missing).
"""
from __future__ import annotations

from app.config import settings

KEY_FIELDS = {"fal": "fal_key", "sarvam": "sarvam_api_key", "anthropic": "anthropic_api_key", "voyage": "voyage_api_key"}


def has_key(name: str) -> bool:
    return bool(getattr(settings, KEY_FIELDS[name], "") or "")


def mode(name: str) -> str:
    explicit = (getattr(settings, f"{name}_mode", "") or "").strip().lower()
    m = explicit or ("live" if has_key(name) else (settings.ai_mode or "fixture").strip().lower())
    if m in ("live", "record") and not has_key(name):
        return "fixture"
    return m if m in ("fixture", "record", "live") else "fixture"


def status() -> dict:
    return {name: {"mode": mode(name), "key": has_key(name)} for name in KEY_FIELDS}
