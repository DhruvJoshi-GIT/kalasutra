from __future__ import annotations

import datetime as dt
import enum
from decimal import Decimal

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, Timestamps


class JobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"


class JobKind(str, enum.Enum):
    ENHANCE = "ENHANCE"
    CATALOG = "CATALOG"
    PRICE = "PRICE"


class VoiceNote(Base):
    __tablename__ = "voice_note"

    id: Mapped[int] = mapped_column(primary_key=True)
    artisan_id: Mapped[int] = mapped_column(ForeignKey("artisan_profile.id", ondelete="CASCADE"), index=True, nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("product.id", ondelete="SET NULL"))
    audio_key: Mapped[str] = mapped_column(String(300), nullable=False)
    language: Mapped[str] = mapped_column(String(10), nullable=False)
    transcript: Mapped[str | None] = mapped_column(Text)
    transcript_en: Mapped[str | None] = mapped_column(Text)
    duration_sec: Mapped[float | None] = mapped_column(Float)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus, native_enum=False, length=10), default=JobStatus.QUEUED, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=lambda: dt.datetime.now(dt.timezone.utc), nullable=False)


class PriceSuggestion(Base):
    __tablename__ = "price_suggestion"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("product.id", ondelete="SET NULL"), index=True)
    artisan_id: Mapped[int] = mapped_column(ForeignKey("artisan_profile.id", ondelete="CASCADE"), index=True, nullable=False)
    floor: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    fair: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    premium: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    rationale_hi: Mapped[str | None] = mapped_column(Text)
    comparables: Mapped[list] = mapped_column(JSONB, nullable=False)
    cost_inputs: Mapped[dict] = mapped_column(JSONB, nullable=False)
    accepted: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=lambda: dt.datetime.now(dt.timezone.utc), nullable=False)


class AiCache(Base):
    """Content-hash cache so the same audio / text / image is never billed twice."""
    __tablename__ = "ai_cache"
    __table_args__ = (UniqueConstraint("provider", "operation", "hash", name="uq_ai_cache"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    operation: Mapped[str] = mapped_column(String(30), nullable=False)
    hash: Mapped[str] = mapped_column(String(64), nullable=False)
    result: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=lambda: dt.datetime.now(dt.timezone.utc), nullable=False)


class Job(Base, Timestamps):
    __tablename__ = "job"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[JobKind] = mapped_column(Enum(JobKind, native_enum=False, length=10), nullable=False)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus, native_enum=False, length=10), default=JobStatus.QUEUED, nullable=False)
    stage: Mapped[str | None] = mapped_column(String(40))
    input: Mapped[dict] = mapped_column(JSONB, nullable=False)
    result: Mapped[dict | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)
    artisan_id: Mapped[int | None] = mapped_column(ForeignKey("artisan_profile.id", ondelete="SET NULL"), index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
