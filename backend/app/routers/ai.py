"""AI routes — the photo studio gateway.

    GET  /ai/studio           what the server can do (server cutout needs FAL_KEY)
    POST /ai/cutout           photo -> PNG with alpha (sellers)
    POST /ai/enhance          photo + backdrop -> stored studio JPEG (sellers)
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from app.auth.deps import DB, CurrentArtisan
from app.services import storage
from app.services.ai import fal
from app.services.ai import image as img
from app.services.ai import provider
from app.schemas.artisan import EnhanceOut, StudioOut

router = APIRouter(tags=["ai"])
MAX_UPLOAD = 20 * 1024 * 1024


def _read_image(file: UploadFile) -> img.Image.Image:
    data = file.file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Photo is larger than 20 MB")
    if not data:
        raise HTTPException(422, "No photo received")
    try:
        im = img.load(data)
    except Exception:
        raise HTTPException(422, "That file is not an image")
    return img.fit(im.convert("RGB"), img.SIZE)


def _cutout(file: UploadFile) -> tuple[img.Image.Image, str]:
    im = _read_image(file)
    try:
        raw, how = fal.cutout(im)
    except fal.StudioError as e:
        raise HTTPException(502, str(e))
    cut = img.clean_alpha(raw)
    if cut is None:
        raise HTTPException(422, "Nothing was found in the photo — try a plainer background")
    return cut, how


@router.get("/ai/studio")
def studio_status():
    m = provider.mode("fal")
    return {"data": StudioOut(server=m in ("live", "record"), provider="fal.ai/birefnet" if m in ("live", "record") else "browser", mode=m, backdrops=img.BACKDROPS)}


@router.post("/ai/cutout")
def studio_cutout(who: CurrentArtisan, file: Annotated[UploadFile, File()]):
    cut, how = _cutout(file)
    return Response(img.to_png(cut), media_type="image/png", headers={"X-Studio-Mode": how, "Cache-Control": "no-store"})


@router.post("/ai/enhance")
def studio_enhance(db: DB, who: CurrentArtisan, file: Annotated[UploadFile, File()],
                   backdrop: Annotated[str, Form()] = "paper", shadow: Annotated[bool, Form()] = True):
    user, _ = who
    if backdrop not in img.BACKDROPS:
        raise HTTPException(422, f"backdrop must be one of {', '.join(img.BACKDROPS)}")
    cut, how = _cutout(file)
    out = img.compose(cut, backdrop, shadow)
    f = storage.put(db, "enhanced", "image/jpeg", img.to_jpeg(out), owner_user_id=user.id)
    db.commit()
    return {"data": EnhanceOut(url=storage.url_for(f.key), key=f.key, mode=how, backdrop=backdrop)}
