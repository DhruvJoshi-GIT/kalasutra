from __future__ import annotations

import datetime as dt

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class StoredFile(Base):
    """Uploaded bytes kept in Postgres (Heroku dynos have no durable disk)."""
    __tablename__ = "stored_file"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(300), unique=True, index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # images | audio | kyc | enhanced
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("user_account.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=lambda: dt.datetime.now(dt.timezone.utc), nullable=False)
