from __future__ import annotations

import enum
from decimal import Decimal

from sqlalchemy import ARRAY, Boolean, Enum, Float, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, Timestamps


class AiStatus(str, enum.Enum):
    NONE = "NONE"
    DRAFT = "DRAFT"
    AI_ENHANCED = "AI_ENHANCED"
    PUBLISHED = "PUBLISHED"


class EnhanceStatus(str, enum.Enum):
    NONE = "NONE"
    QUEUED = "QUEUED"
    DONE = "DONE"
    FAILED = "FAILED"


class Category(Base, Timestamps):
    __tablename__ = "category"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    abbr: Mapped[str | None] = mapped_column(String(4))
    description: Mapped[str | None] = mapped_column(Text)
    image: Mapped[str | None] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("category.id", ondelete="SET NULL"))

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(Base, Timestamps):
    __tablename__ = "product"
    __table_args__ = (
        Index("ix_product_active_featured", "is_active", "is_featured"),
        Index("ix_product_synthetic", "is_synthetic"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    short_desc: Mapped[str | None] = mapped_column(String(300))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    compare_at: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    cost_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    sku: Mapped[str | None] = mapped_column(String(60), unique=True)
    stock: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    low_stock: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("category.id"), index=True, nullable=False)
    brand: Mapped[str | None] = mapped_column(String(160))
    origin: Mapped[str] = mapped_column(String(160), default="India", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(60)), default=list, nullable=False)

    # maker + craft
    artisan_id: Mapped[int | None] = mapped_column(ForeignKey("artisan_profile.id", ondelete="SET NULL"), index=True)
    craft: Mapped[str | None] = mapped_column(String(80))            # one-line craft word shown on tiles
    craft_technique: Mapped[str | None] = mapped_column(String(200))  # fuller technique line in the popup
    materials: Mapped[list[str]] = mapped_column(ARRAY(String(120)), default=list, nullable=False)
    dimensions: Mapped[str | None] = mapped_column(String(160))
    care_instructions: Mapped[str | None] = mapped_column(String(300))
    is_handmade: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    gi_tag: Mapped[str | None] = mapped_column(String(120))
    hsn_code: Mapped[str | None] = mapped_column(String(20))

    # bilingual copy
    name_hi: Mapped[str | None] = mapped_column(String(200))
    short_desc_hi: Mapped[str | None] = mapped_column(String(300))
    description_hi: Mapped[str | None] = mapped_column(Text)
    bullets: Mapped[list[str]] = mapped_column(ARRAY(String(300)), default=list, nullable=False)
    bullets_hi: Mapped[list[str]] = mapped_column(ARRAY(String(300)), default=list, nullable=False)
    seo_keywords: Mapped[list[str]] = mapped_column(ARRAY(String(60)), default=list, nullable=False)

    # AI
    ai_status: Mapped[AiStatus] = mapped_column(Enum(AiStatus, native_enum=False, length=16), default=AiStatus.NONE, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(ARRAY(Float))
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    category: Mapped[Category] = relationship(back_populates="products")
    artisan: Mapped["ArtisanProfile | None"] = relationship(back_populates="products")  # noqa: F821
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.position"
    )


class ProductImage(Base):
    __tablename__ = "product_image"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id", ondelete="CASCADE"), index=True, nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)  # relative (web/img/x.jpg) or absolute
    alt: Mapped[str | None] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    original_key: Mapped[str | None] = mapped_column(String(300))
    enhanced_key: Mapped[str | None] = mapped_column(String(300))
    enhance_status: Mapped[EnhanceStatus] = mapped_column(
        Enum(EnhanceStatus, native_enum=False, length=16), default=EnhanceStatus.NONE, nullable=False
    )
    qc_notes: Mapped[dict | None] = mapped_column(JSONB)

    product: Mapped[Product] = relationship(back_populates="images")
