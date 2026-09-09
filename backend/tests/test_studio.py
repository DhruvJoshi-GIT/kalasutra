"""Photo studio gateway + seller uploads / products (fixture mode: no fal.ai key needed)."""
from __future__ import annotations

import base64
import io

from PIL import Image


def _seller(client, phone="9811000001"):
    client.post("/api/auth/otp/request", json={"phone": phone})
    r = client.post("/api/auth/otp/verify", json={"phone": phone, "code": "123456"})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["data"]["token"]}


def _buyer(client):
    r = client.post("/api/auth/login", json={"email": "demo@kalasutra.in", "password": "password123"})
    return {"Authorization": "Bearer " + r.json()["data"]["token"]}


def _photo(size=600) -> bytes:
    """A terracotta 'pot' on a plain grey wall — enough for the fixture cutout."""
    im = Image.new("RGB", (size, size), (228, 226, 220))
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    d.ellipse((size * 0.25, size * 0.3, size * 0.75, size * 0.85), fill=(176, 84, 46))
    d.rectangle((size * 0.42, size * 0.2, size * 0.58, size * 0.35), fill=(150, 70, 40))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=90)
    return buf.getvalue()


def test_studio_status_without_key_is_browser(client):
    d = client.get("/api/ai/studio").json()["data"]
    assert d["server"] is False and d["provider"] == "browser" and d["mode"] == "fixture"
    assert "terracotta" in d["backdrops"] and "paper" in d["backdrops"]


def test_cutout_needs_a_seller_and_returns_alpha_png(client):
    photo = _photo()
    assert client.post("/api/ai/cutout", files={"file": ("p.jpg", photo, "image/jpeg")}).status_code == 401
    assert client.post("/api/ai/cutout", headers=_buyer(client), files={"file": ("p.jpg", photo, "image/jpeg")}).status_code == 403
    r = client.post("/api/ai/cutout", headers=_seller(client), files={"file": ("p.jpg", photo, "image/jpeg")})
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "image/png" and r.headers["x-studio-mode"] == "fixture"
    im = Image.open(io.BytesIO(r.content))
    assert im.mode == "RGBA"
    a = im.getchannel("A")
    w, h = im.size
    assert a.getpixel((w // 2, h // 2)) == 255          # the pot is kept
    assert a.getpixel((2, 2)) == 0                       # the wall is gone (after the crop, corners are transparent)
    bad = client.post("/api/ai/cutout", headers=_seller(client), files={"file": ("p.txt", b"hello", "text/plain")})
    assert bad.status_code == 422


def test_enhance_stores_a_studio_jpeg(client):
    h = _seller(client)
    r = client.post("/api/ai/enhance", headers=h, files={"file": ("p.jpg", _photo(), "image/jpeg")}, data={"backdrop": "terracotta"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["backdrop"] == "terracotta" and d["mode"] == "fixture" and d["url"].endswith("/api/files/" + d["key"])
    f = client.get("/api/files/" + d["key"])
    assert f.status_code == 200 and f.headers["content-type"] == "image/jpeg"
    im = Image.open(io.BytesIO(f.content))
    assert im.size == (1024, 1024)
    assert client.post("/api/ai/enhance", headers=h, files={"file": ("p.jpg", _photo(), "image/jpeg")}, data={"backdrop": "disco"}).status_code == 422


def test_upload_and_files(client):
    h = _seller(client)
    r = client.post("/api/uploads", headers=h, files={"file": ("p.jpg", _photo(), "image/jpeg")})
    assert r.status_code == 201, r.text
    d = r.json()["data"]
    assert d["key"].startswith("images/") and d["contentType"] == "image/jpeg"
    assert client.get("/api/files/" + d["key"]).status_code == 200
    assert client.get("/api/files/images/nope.jpg").status_code == 404
    k = client.post("/api/uploads", headers=h, files={"file": ("pan.jpg", _photo(), "image/jpeg")}, data={"kind": "kyc"}).json()["data"]["key"]
    assert client.get("/api/files/" + k).status_code == 403          # KYC docs are owner-only
    assert client.get("/api/files/" + k, headers=h).status_code == 200
    assert client.get("/api/files/" + k, headers=_seller(client, "9811000002")).status_code == 403


def test_seller_creates_and_removes_a_listing(client):
    h = _seller(client)
    data_url = "data:image/jpeg;base64," + base64.b64encode(_photo(400)).decode()
    body = {"name": "Studio Test Matka", "nameHi": "परीक्षण मटका", "price": 749, "categorySlug": "pottery", "craft": "Terracotta", "description": "Made for the test suite.", "imageData": data_url}
    assert client.post("/api/artisan/products", json=body).status_code == 401
    assert client.post("/api/artisan/products", headers=_buyer(client), json=body).status_code == 403
    r = client.post("/api/artisan/products", headers=h, json=body)
    assert r.status_code == 201, r.text
    card = r.json()["data"]
    assert card["mk"] == "priya" and card["cat"] == "pottery" and card["price"] == 749 and card["img"].startswith("/api/files/images/")
    assert card["d"]["technique"] and card["aiStatus"] == "AI_ENHANCED"
    assert client.get(card["img"]).status_code == 200
    mine = client.get("/api/artisan/products", headers=h).json()["data"]
    assert any(p["id"] == card["id"] for p in mine)
    boot = client.get("/api/catalogue/bootstrap").json()["data"]
    assert any(p["id"] == card["id"] for p in boot["products"])
    assert client.post("/api/artisan/products", headers=h, json={**body, "categorySlug": "nope"}).status_code == 422
    assert client.post("/api/artisan/products", headers=h, json={**body, "imageData": None}).status_code == 422
    assert client.delete(f"/api/artisan/products/{card['id']}", headers=_seller(client, "9811000002")).status_code == 404
    assert client.delete(f"/api/artisan/products/{card['id']}", headers=h).status_code == 200
    boot = client.get("/api/catalogue/bootstrap").json()["data"]
    assert not any(p["id"] == card["id"] for p in boot["products"])
