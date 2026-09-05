from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import select

from app.auth.deps import DB
from app.models.artisan import ArtisanProfile
from app.models.catalogue import Category
from app.schemas.catalogue import CategoryOut
from app.services import catalogue as svc

router = APIRouter(tags=["catalogue"])


@router.get("/catalogue/bootstrap")
def get_bootstrap(db: DB, response: Response):
    data = svc.bootstrap(db)
    response.headers["Cache-Control"] = "public, max-age=60"
    return {"data": data}


@router.get("/products")
def get_products(
    db: DB,
    page: int = Query(1, ge=1), limit: int = Query(24, ge=1, le=100),
    category: str | None = None, search: str | None = None, sort: str = "newest",
    artisan: str | None = None, min_price: float | None = Query(None, alias="minPrice"),
    max_price: float | None = Query(None, alias="maxPrice"),
):
    items, total = svc.list_products(
        db, page=page, limit=limit, category=category, search=search, sort=sort,
        artisan=artisan, min_price=min_price, max_price=max_price,
    )
    return {"data": items, "meta": {"page": page, "limit": limit, "total": total}}


@router.get("/products/{id_or_slug}")
def get_product(db: DB, id_or_slug: str):
    p = svc.get_product(db, id_or_slug)
    if not p:
        raise HTTPException(404, "Product not found")
    return {"data": svc.product_full(db, p)}


@router.get("/categories")
def get_categories(db: DB):
    cats = db.scalars(select(Category).order_by(Category.position, Category.id)).all()
    return {"data": [CategoryOut(id=c.id, slug=c.slug, name=c.name, abbr=c.abbr) for c in cats]}


@router.get("/makers")
def get_makers(db: DB):
    makers = db.scalars(select(ArtisanProfile).order_by(ArtisanProfile.id)).all()
    return {"data": [svc.maker_card(m) for m in makers]}


@router.get("/makers/{slug}")
def get_maker(db: DB, slug: str):
    m = db.scalar(select(ArtisanProfile).where(ArtisanProfile.slug == slug))
    if not m:
        raise HTTPException(404, "Maker not found")
    items, _ = svc.list_products(db, artisan=slug, limit=100)
    return {"data": {"maker": svc.maker_card(m), "products": items}}
