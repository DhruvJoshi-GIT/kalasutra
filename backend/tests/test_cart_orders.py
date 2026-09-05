import pytest


@pytest.fixture(scope="module")
def buyer(client):
    r = client.post("/api/auth/register", json={"email": "buyer1@example.com", "password": "secret12", "name": "Buyer One"})
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['data']['token']}"}


def test_cart_put_and_merge(client, buyer):
    assert client.get("/api/cart").status_code == 401
    r = client.put("/api/cart", headers=buyer, json={"items": [{"id": 1, "qty": 1}, {"id": 12, "qty": 2}, {"id": 999, "qty": 1}]})
    assert r.status_code == 200
    assert r.json()["data"]["items"] == [{"id": 1, "qty": 1}, {"id": 12, "qty": 2}]  # unknown product dropped
    m = client.post("/api/cart/merge", headers=buyer, json={"items": [{"id": 12, "qty": 1}, {"id": 19, "qty": 3}]})
    items = {i["id"]: i["qty"] for i in m.json()["data"]["items"]}
    assert items == {1: 1, 12: 2, 19: 3}  # max of both, new line added


def test_wishlist(client, buyer):
    assert client.post("/api/wishlist/3", headers=buyer).json()["data"] == [3]
    assert client.post("/api/wishlist/3", headers=buyer).json()["data"] == [3]  # idempotent
    assert client.post("/api/wishlist/merge", headers=buyer, json={"productIds": [3, 7, 999]}).json()["data"] == [3, 7]
    assert client.delete("/api/wishlist/3", headers=buyer).json()["data"] == [7]


def test_address_payment_and_order(client, buyer):
    a = client.post("/api/addresses", headers=buyer, json={"name": "Buyer One", "phone": "9876543210", "line": "12 MG Road", "city": "Bangalore", "state": "Karnataka", "pin": "560001"})
    assert a.status_code == 201 and a.json()["data"]["isDefault"] is True
    bad_pin = client.post("/api/addresses", headers=buyer, json={"name": "x", "phone": "1", "line": "x", "city": "x", "state": "x", "pin": "12"})
    assert bad_pin.status_code == 422 and bad_pin.json()["error"] == "Invalid input"
    assert client.post("/api/payment-methods", headers=buyer, json={"type": "upi", "upi": "not-a-upi"}).status_code == 422
    p = client.post("/api/payment-methods", headers=buyer, json={"type": "card", "card": "4111 1111 1111 1111", "cname": "Buyer One"})
    assert p.status_code == 201 and p.json()["data"]["label"] == "•••• 1111 · Buyer One" and p.json()["data"]["type"] == "card"

    o = client.post("/api/orders", headers=buyer, json={"addressId": a.json()["data"]["id"], "paymentMethodId": p.json()["data"]["id"], "items": [{"id": 1, "qty": 1}, {"id": 12, "qty": 2}]})
    assert o.status_code == 201, o.text
    order = o.json()["data"]
    assert order["no"].startswith("KS") and order["status"] == "PENDING" and order["paymentStatus"] == "PAID"
    assert order["sub"] == 1899 + 2 * 2450 and order["ship"] == 0 and order["total"] == order["sub"]
    assert order["addr"]["pin"] == "560001" and order["pay"]["label"].startswith("••••")
    # the server cart is cleared after checkout
    assert client.get("/api/cart", headers=buyer).json()["data"]["items"] == []
    # small order pays shipping
    small = client.post("/api/orders", headers=buyer, json={"addressId": a.json()["data"]["id"], "paymentMethodId": p.json()["data"]["id"], "items": [{"id": 8, "qty": 1}]}).json()["data"]
    assert small["sub"] == 349 and small["ship"] == 79 and small["total"] == 428
    mine = client.get("/api/orders", headers=buyer).json()["data"]
    assert [m["no"] for m in mine] == [small["no"], order["no"]]
    assert client.get(f"/api/orders/{order['no']}", headers=buyer).json()["data"]["items"][1]["qty"] == 2


def test_reviews_comments_enquiry(client, buyer):
    assert client.get("/api/products/1/reviews").json()["data"] == []
    r = client.post("/api/products/1/reviews", headers=buyer, json={"stars": 5, "text": "Lovely print"})
    assert r.status_code == 201 and r.json()["data"][0]["name"] == "Buyer One" and r.json()["data"][0]["stars"] == 5
    r2 = client.post("/api/products/1/reviews", headers=buyer, json={"stars": 4, "text": "Edited"})  # one review per user
    assert len(r2.json()["data"]) == 1 and r2.json()["data"][0]["stars"] == 4
    assert client.get("/api/products/1").json()["data"]["reviewCount"] == 1
    c = client.post("/api/products/1/comments", headers=buyer, json={"text": "Does it come in blue?"})
    assert c.status_code == 201 and c.json()["data"][0]["answer"] is None

    e = client.post("/api/enquiries", headers=buyer, json={"productId": 1, "quantity": 50, "targetPrice": 1500, "message": "For a store"})
    assert e.status_code == 201 and e.json()["data"]["status"] == "OPEN" and e.json()["data"]["maker"] == "Priya Devi"
    # Priya logs in by OTP and quotes
    client.post("/api/auth/otp/request", json={"phone": "9811000001"})
    tok = client.post("/api/auth/otp/verify", json={"phone": "9811000001", "code": "123456"}).json()["data"]["token"]
    priya = {"Authorization": f"Bearer {tok}"}
    lst = client.get("/api/artisan/enquiries", headers=priya).json()["data"]
    assert lst and lst[0]["quantity"] == 50
    q = client.patch(f"/api/artisan/enquiries/{lst[0]['id']}", headers=priya, json={"status": "QUOTED", "quotedPrice": 1650})
    assert q.json()["data"]["status"] == "QUOTED" and q.json()["data"]["quotedPrice"] == 1650
    assert client.get("/api/artisan/enquiries", headers=buyer).status_code == 403
