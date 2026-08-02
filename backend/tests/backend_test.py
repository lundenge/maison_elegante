"""Backend API tests for Maison Élégante."""
import base64
import io
import os
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

SUPER_ADMIN_PHONE = "+10000000000"
SUPER_ADMIN_PW = "Admin@Elegante2026"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def super_admin_token(s):
    r = s.post(f"{API}/auth/admin/login",
               json={"phone": SUPER_ADMIN_PHONE, "password": SUPER_ADMIN_PW})
    assert r.status_code == 200, f"super admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def test_user(s):
    # Register a fresh user
    unique = uuid.uuid4().hex[:8]
    phone = f"+1555{unique[:7]}"
    payload = {
        "firstName": "TEST",
        "lastName": f"User_{unique}",
        "phone": phone,
        "address": "1 Test St",
        "city": "Testville",
        "country": "Testland",
        "continent": "TestCont",
    }
    r = s.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["phone"] == phone
    assert data["user"]["role"] == "user"
    return {"token": data["token"], "user": data["user"], "phone": phone}


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# --- Services ---
class TestServices:
    def test_list_services_seeded(self, s):
        r = s.get(f"{API}/services")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 4
        cats = {i["category"] for i in items}
        for expected in ["rental", "party", "catering", "gift"]:
            assert expected in cats, f"Missing category {expected}"
        for it in items:
            for k in ["name", "category", "price", "description", "image_url"]:
                assert k in it, f"Missing key {k} in service"


# --- Auth ---
class TestAuth:
    def test_register_returns_token_user(self, test_user):
        assert test_user["token"]
        u = test_user["user"]
        for k in ["firstName", "lastName", "phone", "address", "city", "country", "continent"]:
            assert k in u

    def test_user_login_phone_only(self, s, test_user):
        r = s.post(f"{API}/auth/user/login", json={"phone": test_user["phone"]})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["phone"] == test_user["phone"]
        assert d["token"]

    def test_user_login_unregistered_returns_404(self, s):
        r = s.post(f"{API}/auth/user/login", json={"phone": "+19999999998"})
        assert r.status_code == 404

    def test_admin_login_success(self, super_admin_token):
        assert super_admin_token

    def test_admin_login_wrong_password(self, s):
        r = s.post(f"{API}/auth/admin/login",
                   json={"phone": SUPER_ADMIN_PHONE, "password": "wrong"})
        assert r.status_code == 401

    def test_me_returns_user_without_password(self, s, test_user):
        r = s.get(f"{API}/auth/me", headers=auth(test_user["token"]))
        assert r.status_code == 200
        me = r.json()
        assert me["phone"] == test_user["phone"]
        assert "password" not in me

    def test_me_no_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401


# --- Bookings + Receipts ---
@pytest.fixture(scope="session")
def a_service(s):
    r = s.get(f"{API}/services")
    return r.json()[0]


@pytest.fixture(scope="session")
def cash_booking(s, test_user, a_service):
    payload = {
        "service_id": a_service["id"],
        "quantity": 2,
        "event_date": "2026-12-25T18:00:00Z",
        "notes": "TEST cash booking",
        "payment_method": "cash",
    }
    r = s.post(f"{API}/bookings", json=payload, headers=auth(test_user["token"]))
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def stripe_booking(s, test_user, a_service):
    payload = {
        "service_id": a_service["id"],
        "quantity": 1,
        "event_date": "2026-12-30T18:00:00Z",
        "notes": "TEST stripe booking",
        "payment_method": "stripe",
    }
    r = s.post(f"{API}/bookings", json=payload, headers=auth(test_user["token"]))
    assert r.status_code == 200, r.text
    return r.json()


class TestBookings:
    def test_cash_booking_creates_receipt(self, cash_booking):
        assert cash_booking["payment_method"] == "cash"
        assert cash_booking["status"] == "pending_office_payment"
        assert not cash_booking["paid"]
        assert "receipt_id" in cash_booking

    def test_cash_receipt_unpaid(self, s, test_user, cash_booking):
        r = s.get(f"{API}/receipts/{cash_booking['receipt_id']}",
                  headers=auth(test_user["token"]))
        assert r.status_code == 200
        assert r.json()["status"] == "unpaid"

    def test_stripe_booking_no_receipt(self, stripe_booking):
        assert stripe_booking["payment_method"] == "stripe"
        assert stripe_booking["status"] == "pending_payment"
        assert "receipt_id" not in stripe_booking

    def test_my_bookings_only_own(self, s, test_user, cash_booking):
        r = s.get(f"{API}/bookings", headers=auth(test_user["token"]))
        assert r.status_code == 200
        items = r.json()
        assert all(b["user_id"] == test_user["user"]["id"] for b in items)
        assert any(b["id"] == cash_booking["id"] for b in items)


class TestReceipts:
    def test_my_receipts_only_own(self, s, test_user, cash_booking):
        r = s.get(f"{API}/receipts", headers=auth(test_user["token"]))
        assert r.status_code == 200
        items = r.json()
        assert all(rec["user_id"] == test_user["user"]["id"] for rec in items)
        assert any(rec["id"] == cash_booking["receipt_id"] for rec in items)

    def test_receipt_access_forbidden_other_user(self, s, cash_booking):
        # Register a second user
        unique = uuid.uuid4().hex[:8]
        phone = f"+1666{unique[:7]}"
        r = s.post(f"{API}/auth/register", json={
            "firstName": "TEST", "lastName": "Other", "phone": phone,
            "address": "x", "city": "x", "country": "x", "continent": "x"
        })
        assert r.status_code == 200
        tok = r.json()["token"]
        r2 = s.get(f"{API}/receipts/{cash_booking['receipt_id']}", headers=auth(tok))
        assert r2.status_code == 403


# --- Payments ---
class TestPayments:
    def test_checkout_requires_auth(self, s, stripe_booking):
        r = s.post(f"{API}/payments/checkout",
                   json={"booking_id": stripe_booking["id"], "origin_url": BASE_URL})
        assert r.status_code == 401

    def test_checkout_creates_session(self, s, test_user, stripe_booking):
        r = s.post(f"{API}/payments/checkout",
                   json={"booking_id": stripe_booking["id"], "origin_url": BASE_URL},
                   headers=auth(test_user["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("checkout_url", "").startswith("http")
        assert d.get("session_id")
        pytest.session_id = d["session_id"]

    def test_payment_status_pending(self, s):
        sid = getattr(pytest, "session_id", None)
        assert sid, "checkout must run first"
        r = s.get(f"{API}/payments/status/{sid}")
        assert r.status_code == 200
        d = r.json()
        assert d["payment_status"] in ("pending", "unpaid")


# --- Admin ---
class TestAdmin:
    def test_admin_bookings_forbidden_for_user(self, s, test_user):
        r = s.get(f"{API}/admin/bookings", headers=auth(test_user["token"]))
        assert r.status_code == 403

    def test_admin_bookings_ok(self, s, super_admin_token, cash_booking):
        r = s.get(f"{API}/admin/bookings", headers=auth(super_admin_token))
        assert r.status_code == 200
        items = r.json()
        assert any(b["id"] == cash_booking["id"] for b in items)

    def test_mark_paid_flips_receipt(self, s, super_admin_token, test_user, cash_booking):
        r = s.put(f"{API}/admin/bookings/{cash_booking['id']}/mark-paid",
                  headers=auth(super_admin_token))
        assert r.status_code == 200
        # Verify receipt flipped
        r2 = s.get(f"{API}/receipts/{cash_booking['receipt_id']}",
                   headers=auth(test_user["token"]))
        assert r2.status_code == 200
        assert r2.json()["status"] == "paid"

    def test_analytics_shape(self, s, super_admin_token):
        r = s.get(f"{API}/admin/analytics", headers=auth(super_admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ["total_users", "total_bookings", "paid_bookings",
                  "total_revenue", "pending_revenue", "monthly", "by_category"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["monthly"], list)
        assert isinstance(d["by_category"], list)

    def test_admin_users_list(self, s, super_admin_token):
        r = s.get(f"{API}/admin/users", headers=auth(super_admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --- Super Admin ---
class TestSuperAdmin:
    def test_create_admin_forbidden_regular_user(self, s, test_user):
        r = s.post(f"{API}/super-admin/create-admin",
                   json={"firstName": "X", "lastName": "Y",
                         "phone": "+15550000001", "email": "x@y.com",
                         "password": "pw12345"},
                   headers=auth(test_user["token"]))
        assert r.status_code == 403

    def test_create_admin_ok(self, s, super_admin_token):
        unique = uuid.uuid4().hex[:6]
        phone = f"+177{unique}"
        r = s.post(f"{API}/super-admin/create-admin",
                   json={"firstName": "TEST", "lastName": f"Adm_{unique}",
                         "phone": phone, "email": f"TEST_{unique}@x.com",
                         "password": "Admin@1234"},
                   headers=auth(super_admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "admin"
        assert d["phone"] == phone
        assert "password" not in d
        # Cleanup
        s.delete(f"{API}/super-admin/users/{d['id']}",
                 headers=auth(super_admin_token))


# --- OCR Receipt Scan ---
def _make_receipt_image_b64():
    """Create a PNG with realistic receipt-like text content."""
    from PIL import Image, ImageDraw, ImageFont
    W, H = 500, 700
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
        big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
    except Exception:
        font = ImageFont.load_default()
        big = font
    lines = [
        ("CAFE PARIS", big),
        ("123 Rue de Test", font),
        ("Date: 2026-07-15", font),
        ("--------------------------", font),
        ("Espresso        x2   6.00", font),
        ("Croissant       x1   3.50", font),
        ("Cappuccino      x1   4.20", font),
        ("--------------------------", font),
        ("Subtotal          13.70", font),
        ("Tax                1.10", font),
        ("TOTAL USD         14.80", big),
        ("Thank you!", font),
    ]
    y = 30
    for text, f in lines:
        d.text((30, y), text, fill="black", font=f)
        y += 45
    # Add some visual texture (lines/rects) so it's not uniform
    d.rectangle([20, 20, W - 20, H - 20], outline="black", width=2)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


class TestOCR:
    def test_scan_receipt(self, s, super_admin_token):
        b64 = _make_receipt_image_b64()
        payload = {"image_base64": b64}
        headers = auth(super_admin_token)
        # try up to 2 times
        last = None
        for attempt in range(2):
            r = s.post(f"{API}/receipts/scan", json=payload,
                       headers=headers, timeout=120)
            last = r
            if r.status_code == 200:
                break
            time.sleep(2)
        assert last.status_code == 200, f"OCR failed: {last.status_code} {last.text[:500]}"
        d = last.json()
        assert "raw_data" in d
        raw = d["raw_data"]
        for k in ["merchant", "date", "items", "subtotal", "tax", "total", "currency"]:
            assert k in raw, f"missing OCR key {k}"
        assert isinstance(raw["items"], list)
