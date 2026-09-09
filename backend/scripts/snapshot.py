"""Write web/catalogue.json — the demo-mode snapshot of GET /api/catalogue/bootstrap — straight from data/seed_products.json.

    python scripts/snapshot.py        # no database needed; run after any seed change
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "data" / "seed_products.json").read_text(encoding="utf-8"))
FEATURED = (3, 12, 7, 15, 23, 1, 17, 11)   # keep in sync with scripts/seed.py


def split_place(place: str) -> tuple[str, str]:
    parts = [p.strip() for p in place.split(",")]
    return (parts[0], parts[1] if len(parts) > 1 else "India")


def build() -> dict:
    cats = [{"id": i + 1, "slug": c["slug"], "name": c["name"], "abbr": c.get("abbr")} for i, c in enumerate(DATA["categories"])]
    makers = {}
    for slug, m in DATA["makers"].items():
        district, state = split_place(m["place"])
        makers[slug] = {
            "slug": slug, "n": m["n"], "shop": m["shop"], "place": m["place"], "district": district, "state": state,
            "craft": m["craft"], "since": m.get("since"), "img": f"img/{m['img']}.jpg", "en": m["en"], "hi": m["hi"],
            "kycStatus": "VERIFIED" if slug in ("priya", "meera") else "SUBMITTED",
        }
    products = []
    for p in DATA["products"]:
        d = {**DATA["defaults"][p["cat"]], **p.get("d", {})}
        products.append({
            "id": p["id"], "slug": p["img"], "n": p["n"], "hi": p.get("hi"), "mk": p["mk"],
            "price": float(p["price"]), "was": float(p["was"]) if p.get("was") else None,
            "img": f"img/{p['img']}.jpg", "cat": p["cat"], "craft": p.get("craft"),
            "d": {"technique": d["technique"], "materials": d["materials"], "size": d["size"], "care": d["care"]},
            "stock": 12, "isFeatured": p["id"] in FEATURED, "aiStatus": "NONE",
        })
    return {"categories": cats, "makers": makers, "products": products,
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat()}


if __name__ == "__main__":
    out = ROOT.parent / "web" / "catalogue.json"
    out.write_text(json.dumps(build(), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
