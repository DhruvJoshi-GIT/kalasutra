def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["ok"] is True


def test_bootstrap_has_the_prototype_catalogue(client):
    r = client.get("/api/catalogue/bootstrap")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data["categories"]) == 7
    assert len(data["makers"]) == 11
    assert len(data["products"]) == 25
    p = data["products"][0]
    for key in ("id", "slug", "n", "mk", "price", "img", "cat", "craft", "d"):
        assert key in p
    assert p["mk"] in data["makers"]
    assert p["img"].startswith("img/")
    assert set(p["d"]) == {"technique", "materials", "size", "care"}


def test_products_filter_sort_search(client):
    jewel = client.get("/api/products", params={"category": "jewel"}).json()
    assert jewel["meta"]["total"] == 6 and all(p["cat"] == "jewel" for p in jewel["data"])
    asc = client.get("/api/products", params={"sort": "price-asc", "limit": 100}).json()["data"]
    prices = [p["price"] for p in asc]
    assert prices == sorted(prices)
    hits = client.get("/api/products", params={"search": "kanjivaram"}).json()["data"]
    assert hits and all("Kanjivaram" in p["n"] or p["craft"] == "Kanjivaram silk" for p in hits)
    hindi = client.get("/api/products", params={"search": "साड़ी"}).json()["data"]
    assert len(hindi) >= 2


def test_product_detail_and_maker(client):
    p = client.get("/api/products/saree-cream").json()["data"]
    assert p["maker"]["slug"] == "priya" and p["images"] == ["img/saree-cream.jpg"]
    assert isinstance(p["reviewCount"], int) and p["reviewCount"] >= 0
    m = client.get("/api/makers/priya").json()["data"]
    assert m["maker"]["n"] == "Priya Devi" and len(m["products"]) >= 5
    assert client.get("/api/products/does-not-exist").status_code == 404
