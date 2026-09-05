from __future__ import annotations

from pydantic import Field

from app.schemas import CamelModel


class ProductDetails(CamelModel):
    technique: str = ""
    materials: str = ""
    size: str = ""
    care: str = ""


class ProductCard(CamelModel):
    """Exactly the shape the prototype's P[] entries have."""
    id: int
    slug: str
    n: str
    hi: str | None = None
    mk: str                      # maker slug
    price: float
    was: float | None = None
    img: str                     # relative "img/x.jpg" or absolute URL
    cat: str                     # category slug
    craft: str | None = None
    d: ProductDetails = Field(default_factory=ProductDetails)
    stock: int = 0
    is_featured: bool = False
    ai_status: str = "NONE"


class MakerCard(CamelModel):
    slug: str
    n: str
    shop: str
    place: str
    district: str
    state: str
    craft: str
    since: int | None = None
    img: str | None = None
    en: str = ""
    hi: str = ""
    kyc_status: str = "PENDING"


class CategoryOut(CamelModel):
    id: int
    slug: str
    name: str
    abbr: str | None = None


class Bootstrap(CamelModel):
    categories: list[CategoryOut]
    makers: dict[str, MakerCard]
    products: list[ProductCard]
    generated_at: str


class ReviewOut(CamelModel):
    name: str
    stars: int
    text: str
    date: str


class CommentOut(CamelModel):
    name: str
    text: str
    date: str
    answer: str | None = None


class ProductFull(ProductCard):
    description: str | None = None
    short_desc: str | None = None
    images: list[str] = Field(default_factory=list)
    materials_list: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    maker: MakerCard | None = None
    rating: float = 0
    review_count: int = 0
