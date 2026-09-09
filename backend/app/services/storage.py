"""Uploaded files live in Postgres (stored_file, bytea) and are served by GET /api/files/{key}."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.files import StoredFile

EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/wav": "wav", "audio/webm": "webm", "audio/mpeg": "mp3", "application/pdf": "pdf"}


def put(db: Session, kind: str, content_type: str, data: bytes, owner_user_id: int | None = None) -> StoredFile:
    key = f"{kind}/{uuid.uuid4().hex}.{EXT.get(content_type, 'bin')}"
    f = StoredFile(key=key, kind=kind, content_type=content_type, size=len(data), data=data, owner_user_id=owner_user_id)
    db.add(f)
    db.flush()
    return f


def get(db: Session, key: str) -> StoredFile | None:
    return db.scalar(select(StoredFile).where(StoredFile.key == key))


def url_for(key: str) -> str:
    base = (settings.public_base_url or "").rstrip("/")
    return f"{base}/api/files/{key}"
