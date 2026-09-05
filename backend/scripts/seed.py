"""Idempotent seed: categories, makers (users + profiles), the 25 real products, a demo buyer, an admin.

    python scripts/seed.py            # upserts by slug / email / phone
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402

from app.auth.passwords import hash_password  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import (  # noqa: E402
    ArtisanProfile, Category, KycStatus, Product, ProductImage, Role, User,
)

DATA = json.loads((ROOT / "data" / "seed_products.json").read_text(encoding="utf-8"))
DEMO_PASSWORD = "password123"


def split_place(place: str) -> tuple[str, str]:
    parts = [p.strip() for p in place.split(",")]
    return (parts[0], parts[1] if len(parts) > 1 else "India")


def run() -> None:
    Base.metadata.create_all(engine)  # harmless if Alembic already ran
    db = SessionLocal()
    try:
        # categories
        cats: dict[str, Category] = {}
        for i, c in enumerate(DATA["categories"]):
            cat = db.scalar(select(Category).where(Category.slug == c["slug"]))
            if not cat:
                cat = Category(slug=c["slug"]); db.add(cat)
            cat.name, cat.abbr, cat.position = c["name"], c.get("abbr"), i
            cats[c["slug"]] = cat
        db.flush()

        # makers → user (phone login) + artisan profile
        makers: dict[str, ArtisanProfile] = {}
        for i, (slug, m) in enumerate(DATA["makers"].items(), start=1):
            phone = f"+9198110000{i:02d}"
            email = f"{slug}@kalasutra.in"
            user = db.scalar(select(User).where(User.email == email))
            if not user:
                user = User(email=email); db.add(user)
            user.name, user.phone, user.role = m["n"], phone, Role.ARTISAN
            user.password_hash = user.password_hash or hash_password(DEMO_PASSWORD)
            user.preferred_language = "hi-IN"
            db.flush()
            prof = db.scalar(select(ArtisanProfile).where(ArtisanProfile.slug == slug))
            if not prof:
                prof = ArtisanProfile(slug=slug, user_id=user.id); db.add(prof)
            district, state = split_place(m["place"])
            prof.display_name, prof.shop_name, prof.craft_type = m["n"], m["shop"], m["craft"]
            prof.district, prof.state, prof.established_year = district, state, m.get("since")
            prof.languages = ["hi-IN", "en-IN"]
            prof.story, prof.story_hi = m["en"], m["hi"]
            prof.avatar_url = f"img/{m['img']}.jpg"
            prof.kyc_status = KycStatus.VERIFIED if slug in ("priya", "meera") else KycStatus.SUBMITTED
            makers[slug] = prof
        db.flush()

        # products
        defaults = DATA["defaults"]
        for p in DATA["products"]:
            slug = p["img"] if len(p["img"]) > 3 else f"p-{p['id']}"
            prod = db.scalar(select(Product).where(Product.slug == slug))
            if not prod:
                prod = Product(slug=slug); db.add(prod)
            d = {**defaults[p["cat"]], **p.get("d", {})}
            prod.name, prod.name_hi, prod.price = p["n"], p.get("hi"), p["price"]
            prod.compare_at = p.get("was")
            prod.category = cats[p["cat"]]
            prod.artisan = makers[p["mk"]]
            prod.brand = makers[p["mk"]].shop_name
            prod.origin = f"{makers[p['mk']].district}, {makers[p['mk']].state}"
            prod.craft = p.get("craft")
            prod.craft_technique = d["technique"]
            prod.materials = [s.strip() for s in d["materials"].replace("·", ",").split(",") if s.strip()]
            prod.dimensions, prod.care_instructions = d["size"], d["care"]
            prod.short_desc = f"{p.get('craft') or d['technique']} · {makers[p['mk']].district}"
            prod.description = (
                f"{p['n']} by {makers[p['mk']].display_name} ({makers[p['mk']].shop_name}), "
                f"{prod.origin}. {d['technique']}. Materials: {d['materials']}. Size: {d['size']}. Care: {d['care']}."
            )
            prod.sku = f"KS-{p['mk'][:3].upper()}-{p['id']:03d}"
            prod.stock = 12
            prod.is_featured = p["id"] in (3, 12, 7, 15, 23, 1, 17, 11)
            prod.tags = [p["cat"], p.get("craft") or ""]
            db.flush()
            if not prod.images:
                db.add(ProductImage(product_id=prod.id, url=f"img/{p['img']}.jpg", alt=p["n"], position=0))

        # demo buyer + admin
        for email, name, role in (("demo@kalasutra.in", "Demo Buyer", Role.USER), ("admin@kalasutra.in", "Admin", Role.ADMIN)):
            u = db.scalar(select(User).where(User.email == email))
            if not u:
                u = User(email=email); db.add(u)
            u.name, u.role = name, role
            u.password_hash = u.password_hash or hash_password(DEMO_PASSWORD)

        db.commit()
        n_p = db.scalar(select(Product).where(Product.is_synthetic.is_(False)).count()) if False else len(DATA["products"])
        print(f"seeded: {len(cats)} categories, {len(makers)} makers, {n_p} products, demo buyer + admin (password {DEMO_PASSWORD})")
    finally:
        db.close()


if __name__ == "__main__":
    run()
