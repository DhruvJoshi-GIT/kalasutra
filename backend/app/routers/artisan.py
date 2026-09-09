"""Seller side: uploads, files, own products."""
from __future__ import annotations

import base64
import json
import random
import string
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from slugify import slugify
from sqlalchemy import select

from app.auth.deps import DB, CurrentArtisan, MaybeUser
from app.models.catalogue import AiStatus, Category, Product, ProductImage
from app.models.commerce import OrderItem
from app.models.user import Role
from app.schemas.artisan import ArtisanProductIn, UploadOut
from app.services import storage
from app.services.ai import image as img
from app.services.catalogue import product_card

router = APIRouter(tags=["artisan"])
MAX_UPLOAD = 20 * 1024 * 1024
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
_DEFAULTS = json.loads((Path(__file__).resolve().parent.parent.parent / "data" / "seed_products.json").read_text(encoding="utf-8"))["defaults"]


def _store_image(db, data: bytes, owner_id: int, kind: str = "images"):
    """Re-encode through Pillow (strips EXIF, caps at 2048 px) and keep it in Postgres."""
    try:
        im = img.load(data)
    except Exception:
        raise HTTPException(422, "That file is not an image")
    im = img.fit(im.convert("RGB"), 2048)
    return storage.put(db, kind, "image/jpeg", img.to_jpeg(im, 86), owner_user_id=owner_id)


@router.post("/uploads", status_code=201)
def upload(db: DB, who: CurrentArtisan, file: Annotated[UploadFile, File()], kind: Annotated[str, Form()] = "images"):
    user, _ = who
    if kind not in ("images", "audio", "kyc"):
        raise HTTPException(422, "kind must be images, audio or kyc")
    data = file.file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "File is larger than 20 MB")
    if not data:
        raise HTTPException(422, "Empty file")
    if kind == "images":
        f = _store_image(db, data, user.id)
    else:
        ct = file.content_type or "application/octet-stream"
        if kind == "kyc" and ct not in IMAGE_TYPES | {"application/pdf"}:
            raise HTTPException(422, "KYC documents must be an image or a PDF")
        f = storage.put(db, kind, ct, data, owner_user_id=user.id)
    db.commit()
    return {"data": UploadOut(key=f.key, url=storage.url_for(f.key), content_type=f.content_type, size=f.size)}


@router.get("/files/{key:path}")
def get_file(db: DB, key: str, user: MaybeUser):
    f = storage.get(db, key)
    if not f:
        raise HTTPException(404, "File not found")
    if f.kind == "kyc" and (user is None or (user.id != f.owner_user_id and user.role != Role.ADMIN)):
        raise HTTPException(403, "Not allowed")
    return Response(f.data, media_type=f.content_type, headers={"Cache-Control": "public, max-age=31536000, immutable" if f.kind != "kyc" else "private, no-store"})


def _own(db, profile, product_id: int) -> Product:
    p = db.get(Product, product_id)
    if not p or p.artisan_id != profile.id or not p.is_active:
        raise HTTPException(404, "Product not found")
    return p


@router.get("/artisan/products")
def my_products(db: DB, who: CurrentArtisan):
    _, profile = who
    rows = db.scalars(select(Product).where(Product.artisan_id == profile.id, Product.is_active.is_(True)).order_by(Product.id.desc())).all()
    return {"data": [product_card(p) for p in rows]}


@router.post("/artisan/products", status_code=201)
def create_product(db: DB, who: CurrentArtisan, body: ArtisanProductIn):
    user, profile = who
    cat = db.scalar(select(Category).where(Category.slug == body.category_slug))
    if not cat:
        raise HTTPException(422, "Unknown category")
    if not body.image_data and not body.image_url:
        raise HTTPException(422, "Add a photo first")
    url = body.image_url
    if body.image_data:
        try:
            head, b64 = body.image_data.split(",", 1)
            if not head.startswith("data:image/"):
                raise ValueError
            raw = base64.b64decode(b64)
        except Exception:
            raise HTTPException(422, "imageData must be a data:image/… URL")
        if len(raw) > MAX_UPLOAD:
            raise HTTPException(413, "Photo is larger than 20 MB")
        f = _store_image(db, raw, user.id)
        url = storage.url_for(f.key)
    d = _DEFAULTS.get(cat.slug, _DEFAULTS["home"])
    tail = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    p = Product(
        name=body.name.strip(), name_hi=body.name_hi, slug=f"{slugify(body.name)[:60]}-{tail}", description=body.description,
        short_desc=f"{body.craft or d['technique']} · {profile.district}", price=body.price, compare_at=body.compare_at,
        category=cat, artisan=profile, brand=profile.shop_name, origin=f"{profile.district}, {profile.state}",
        craft=body.craft or None, craft_technique=body.technique or d["technique"],
        materials=[s.strip() for s in (body.materials or d["materials"]).replace("·", ",").replace("/", ",").split(",") if s.strip()],
        dimensions=body.size or d["size"], care_instructions=body.care or d["care"], stock=body.stock,
        tags=[cat.slug, body.craft or ""], ai_status=AiStatus.AI_ENHANCED if body.image_data else AiStatus.NONE,
    )
    db.add(p)
    db.flush()
    p.sku = f"KS-{profile.slug[:3].upper()}-{p.id:03d}"
    db.add(ProductImage(product_id=p.id, url=url, alt=p.name, position=0))
    db.commit()
    db.refresh(p)
    return {"data": product_card(p)}


@router.delete("/artisan/products/{product_id}")
def delete_product(db: DB, who: CurrentArtisan, product_id: int):
    _, profile = who
    p = _own(db, profile, product_id)
    ordered = db.scalar(select(OrderItem.id).where(OrderItem.product_id == p.id).limit(1)) is not None
    if ordered:
        p.is_active = False           # keep order history intact
    else:
        db.delete(p)
    db.commit()
    return {"data": {"ok": True, "deactivated": ordered}}
