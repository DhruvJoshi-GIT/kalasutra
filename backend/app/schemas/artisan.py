from __future__ import annotations

from pydantic import Field

from app.schemas import CamelModel


class ArtisanProductIn(CamelModel):
    name: str = Field(min_length=2, max_length=200)
    name_hi: str | None = Field(default=None, max_length=200)
    price: float = Field(gt=0, le=10_000_000)
    compare_at: float | None = Field(default=None, gt=0)
    category_slug: str = Field(min_length=1, max_length=60)
    craft: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=4000)
    technique: str | None = Field(default=None, max_length=200)
    materials: str | None = Field(default=None, max_length=300)
    size: str | None = Field(default=None, max_length=160)
    care: str | None = Field(default=None, max_length=300)
    image_data: str | None = None      # data:image/...;base64,... straight from the studio
    image_url: str | None = None       # or a URL already returned by POST /uploads
    stock: int = Field(default=12, ge=0, le=100000)


class UploadOut(CamelModel):
    key: str
    url: str
    content_type: str
    size: int


class StudioOut(CamelModel):
    server: bool
    provider: str
    mode: str
    backdrops: list[str]


class EnhanceOut(CamelModel):
    url: str
    key: str
    mode: str
    backdrop: str
