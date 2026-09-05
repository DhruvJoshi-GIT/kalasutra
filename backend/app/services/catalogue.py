"""Catalogue queries and serialisers (the shapes the prototype already renders)."""
from __future__ import annotations

import datetime as dt

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.artisan import ArtisanProfile
from app.models.catalogue import Category, Product
from app.models.social import Review
from app.schemas.catalogue import (
    Bootstrap, CategoryOut, MakerCard, ProductCard, ProductDetails, ProductFull,
)

SORTS = {
    "newest": lambda q: q.order_by(Product.id.desc()),
    "price-asc": lambda q: q.order_by(Product.price.asc()),
    "price-desc": lambda q: q.order_by(Product.price.desc()),
    "sale": lambda q: q.order_by(Product.compare_at.is_(None), Product.id.desc()),
    "name": lambda q: q.order_by(Product.name.asc()),
}


def maker_card(a: ArtisanProfile) -> MakerCard:
    return MakerCard(
        slug=a.slug, n=a.display_name, shop=a.shop_name or a.display_name,
        place=f"{a.district}, {a.state}", district=a.district, state=a.state,
        craft=a.craft_type, since=a.established_year, img=a.avatar_url,
        en=a.story or "", hi=a.story_hi or "", kyc_status=a.kyc_status.value,
    )


def product_card(p: Product) -> ProductCard:
    img = p.images[0].url if p.images else ""
    return ProductCard(
        id=p.id, slug=p.slug, n=p.name, hi=p.name_hi,
        mk=p.artisan.slug if p.artisan else "",
        price=float(p.price), was=float(p.compare_at) if p.compare_at else None,
        img=img, cat=p.category.slug, craft=p.craft,
        d=ProductDetails(
            technique=p.craft_technique or "", materials=", ".join(p.materials),
            size=p.dimensions or "", care=p.care_instructions or "",
        ),
        stock=p.stock, is_featured=p.is_featured, ai_status=p.ai_status.value,
    )


def _shop_query():
    return (
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.artisan), selectinload(Product.category))
        .where(Product.is_active.is_(True), Product.is_synthetic.is_(False))
    )


def bootstrap(db: Session) -> Bootstrap:
    cats = db.scalars(select(Category).order_by(Category.position, Category.id)).all()
    makers = db.scalars(select(ArtisanProfile).order_by(ArtisanProfile.id)).all()
    products = db.scalars(_shop_query().order_by(Product.id)).all()
    return Bootstrap(
        categories=[CategoryOut(id=c.id, slug=c.slug, name=c.name, abbr=c.abbr) for c in cats],
        makers={m.slug: maker_card(m) for m in makers},
        products=[product_card(p) for p in products],
        generated_at=dt.datetime.now(dt.timezone.utc).isoformat(),
    )


def list_products(
    db: Session, *, page: int = 1, limit: int = 24, category: str | None = None, search: str | None = None,
    sort: str = "newest", artisan: str | None = None, min_price: float | None = None, max_price: float | None = None,
) -> tuple[list[ProductCard], int]:
    q = _shop_query()
    if category and category != "all":
        q = q.join(Product.category).where(Category.slug == category)
    if artisan:
        q = q.join(Product.artisan).where(ArtisanProfile.slug == artisan)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(or_(
            Product.name.ilike(like), Product.name_hi.ilike(like), Product.craft.ilike(like),
            Product.craft_technique.ilike(like), Product.brand.ilike(like), Product.origin.ilike(like),
            Product.description.ilike(like),
        ))
    if min_price is not None:
        q = q.where(Product.price >= min_price)
    if max_price is not None:
        q = q.where(Product.price <= max_price)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    q = SORTS.get(sort, SORTS["newest"])(q)
    rows = db.scalars(q.offset((page - 1) * limit).limit(limit)).all()
    return [product_card(p) for p in rows], total


def get_product(db: Session, id_or_slug: str) -> Product | None:
    q = _shop_query()
    q = q.where(Product.id == int(id_or_slug)) if id_or_slug.isdigit() else q.where(Product.slug == id_or_slug)
    return db.scalar(q)


def product_full(db: Session, p: Product) -> ProductFull:
    card = product_card(p)
    agg = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(Review.product_id == p.id)
    ).one()
    return ProductFull(
        **card.model_dump(by_alias=False),
        description=p.description, short_desc=p.short_desc,
        images=[i.url for i in p.images], materials_list=list(p.materials), bullets=list(p.bullets),
        tags=list(p.tags), maker=maker_card(p.artisan) if p.artisan else None,
        rating=float(agg[0] or 0), review_count=int(agg[1] or 0),
    )
