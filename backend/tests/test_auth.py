def test_register_login_me(client):
    r = client.post("/api/auth/register", json={"email": "tester@example.com", "password": "secret12", "name": "Tester"})
    assert r.status_code == 201, r.text
    token = r.json()["data"]["token"]
    assert client.post("/api/auth/register", json={"email": "tester@example.com", "password": "secret12"}).status_code == 409
    assert client.post("/api/auth/login", json={"email": "tester@example.com", "password": "nope"}).status_code == 401
    ok = client.post("/api/auth/login", json={"email": "tester@example.com", "password": "secret12"})
    assert ok.status_code == 200 and ok.json()["data"]["user"]["role"] == "USER"
    me = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["data"]["email"] == "tester@example.com"
    assert client.get("/api/me").status_code == 401
    upd = client.patch("/api/me", headers={"Authorization": f"Bearer {token}"}, json={"name": "New Name", "phone": "9876543210"})
    assert upd.status_code == 200 and upd.json()["data"]["phone"] == "+919876543210"


def test_otp_flow_for_a_seeded_maker(client):
    r = client.post("/api/auth/otp/request", json={"phone": "98110 00001"})
    assert r.status_code == 200 and r.json()["data"]["devCode"] == "123456"
    bad = client.post("/api/auth/otp/verify", json={"phone": "9811000001", "code": "000000"})
    assert bad.status_code == 401
    good = client.post("/api/auth/otp/verify", json={"phone": "9811000001", "code": "123456"})
    assert good.status_code == 200
    data = good.json()["data"]
    assert data["user"]["role"] == "ARTISAN" and data["user"]["artisanSlug"] == "priya" and data["needsProfile"] is False
    # the challenge is consumed
    assert client.post("/api/auth/otp/verify", json={"phone": "9811000001", "code": "123456"}).status_code == 401


def test_otp_new_phone_needs_profile(client):
    client.post("/api/auth/otp/request", json={"phone": "9000000001"})
    r = client.post("/api/auth/otp/verify", json={"phone": "9000000001", "code": "123456"})
    assert r.status_code == 200 and r.json()["data"]["needsProfile"] is True
