"""Background removal through fal.ai (BiRefNet) — the server half of the photo studio.

Live mode needs FAL_KEY (https://fal.ai/dashboard/keys). Without it the fixture cutout in image.py answers,
so every route keeps working; the browser then prefers its own on-device model (web/js/studio.js).

Endpoint shape is UNVERIFIED until the first live call — see api-notes.md; `scripts/verify_fal.py` checks it.
"""
from __future__ import annotations

import base64

import httpx
from PIL import Image

from app.config import settings
from app.services.ai import image as img
from app.services.ai import provider

FAL_ENDPOINT = "https://fal.run/fal-ai/birefnet"


class StudioError(RuntimeError):
    pass


def cutout(im: Image.Image) -> tuple[Image.Image, str]:
    """Return (RGBA image with the background removed, how) where how is 'fal' or 'fixture'."""
    m = provider.mode("fal")
    if m == "fixture":
        return img.keyed_cutout(im), "fixture"
    payload = {
        "image_url": "data:image/jpeg;base64," + base64.b64encode(img.to_jpeg(im, 92)).decode(),
        "model": "General Use (Light)",
        "operating_resolution": "1024x1024",
        "output_format": "png",
        "refine_foreground": True,
    }
    try:
        r = httpx.post(FAL_ENDPOINT, headers={"Authorization": f"Key {settings.fal_key}"}, json=payload, timeout=120)
        r.raise_for_status()
        url = r.json()["image"]["url"]
        png = httpx.get(url, timeout=60).content
    except (httpx.HTTPError, KeyError, ValueError) as e:  # pragma: no cover - network
        raise StudioError(f"fal.ai cutout failed: {e}") from e
    return img.load(png).convert("RGBA"), "fal"
