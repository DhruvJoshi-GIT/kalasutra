from __future__ import annotations

import enum

from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, Timestamps


class Role(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"
    ARTISAN = "ARTISAN"
    BUYER = "BUYER"


class PaymentType(str, enum.Enum):
    UPI = "UPI"
    CARD = "CARD"


class User(Base, Timestamps):
    __tablename__ = "user_account"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str | None] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(200), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(200))
    image: Mapped[str | None] = mapped_column(String(500))
    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False, length=16), default=Role.USER, nullable=False)
    preferred_language: Mapped[str] = mapped_column(String(10), default="en-IN", nullable=False)

    addresses: Mapped[list["Address"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    payment_methods: Mapped[list["PaymentMethod"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    artisan: Mapped["ArtisanProfile | None"] = relationship(back_populates="user", uselist=False)  # noqa: F821


class Address(Base, Timestamps):
    __tablename__ = "address"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_account.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    line1: Mapped[str] = mapped_column(String(200), nullable=False)
    line2: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    postal_code: Mapped[str] = mapped_column(String(10), nullable=False)
    country: Mapped[str] = mapped_column(String(60), default="India", nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped[User] = relationship(back_populates="addresses")


class PaymentMethod(Base, Timestamps):
    """Only a display label is ever stored — never a card number."""
    __tablename__ = "payment_method"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_account.id", ondelete="CASCADE"), index=True, nullable=False)
    type: Mapped[PaymentType] = mapped_column(Enum(PaymentType, native_enum=False, length=8), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped[User] = relationship(back_populates="payment_methods")
