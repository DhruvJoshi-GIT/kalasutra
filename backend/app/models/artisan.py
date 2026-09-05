from __future__ import annotations

import datetime as dt
import enum

from sqlalchemy import ARRAY, Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, Timestamps


class KycStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class ArtisanProfile(Base, Timestamps):
    __tablename__ = "artisan_profile"
    __table_args__ = (Index("ix_artisan_state_district", "state", "district"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_account.id", ondelete="CASCADE"), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    shop_name: Mapped[str | None] = mapped_column(String(160))
    craft_type: Mapped[str] = mapped_column(String(160), nullable=False)
    cluster_name: Mapped[str | None] = mapped_column(String(120))
    district: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    languages: Mapped[list[str]] = mapped_column(ARRAY(String(10)), default=list, nullable=False)
    story: Mapped[str | None] = mapped_column(Text)
    story_hi: Mapped[str | None] = mapped_column(Text)
    avatar_key: Mapped[str | None] = mapped_column(String(300))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    established_year: Mapped[int | None] = mapped_column(Integer)
    bank_account: Mapped[str | None] = mapped_column(String(40))
    ifsc: Mapped[str | None] = mapped_column(String(20))
    upi_id: Mapped[str | None] = mapped_column(String(120))
    kyc_status: Mapped[KycStatus] = mapped_column(
        Enum(KycStatus, native_enum=False, length=16), default=KycStatus.PENDING, nullable=False, index=True
    )
    kyc_docs: Mapped[dict | None] = mapped_column(JSONB)

    user: Mapped["User"] = relationship(back_populates="artisan")  # noqa: F821
    products: Mapped[list["Product"]] = relationship(back_populates="artisan")  # noqa: F821


class OtpChallenge(Base):
    __tablename__ = "otp_challenge"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    code_hash: Mapped[str] = mapped_column(String(80), nullable=False)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=lambda: dt.datetime.now(dt.timezone.utc), nullable=False)
