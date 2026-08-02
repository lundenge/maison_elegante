"""
Maison Élégante — Business Management API
MySQL-backed PHP backend compatibility shim.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os, logging, uuid, jwt, bcrypt, stripe, httpx, asyncio

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Setup ---
DB_HOST = os.environ.get('DB_HOST', '127.0.0.1')
DB_PORT = os.environ.get('DB_PORT', '3306')
DB_NAME = os.environ.get('DB_NAME', 'uvira_db')
DB_USER = os.environ.get('DB_USER', 'root')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
EMAIL_KEY = os.environ.get('EMERGENT_EMAIL_KEY', '')
EMAIL_FROM_NAME = os.environ.get('EMAIL_FROM_NAME', 'Maison Élégante')
EMAIL_BASE_URL = "https://integrations.emergentagent.com"  # constant per playbook
WEBHOOK_CRON_SECRET = os.environ.get('WEBHOOK_CRON_SECRET', '')

stripe.api_key = STRIPE_SECRET_KEY

app = FastAPI(title="Maison Élégante API")
api = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("maison")

# --- Currency ---
# USD is the base. Rates are USD -> target. Must match frontend/src/context/CurrencyContext.js
CURRENCY_RATES = {"USD": 1.0, "EUR": 0.92, "TZS": 2600.0}
CURRENCY_DECIMALS = {"USD": 2, "EUR": 2, "TZS": 0}
CURRENCY_SYMBOLS = {"USD": "$", "EUR": "€", "TZS": "TSh"}
STRIPE_ZERO_DECIMAL = {"TZS", "JPY", "KRW", "VND"}


def convert_from_usd(usd_amount: float, currency: str) -> float:
    rate = CURRENCY_RATES.get(currency, 1.0)
    dec = CURRENCY_DECIMALS.get(currency, 2)
    return round(usd_amount * rate, dec)


def format_money(usd_amount: float, currency: str) -> str:
    value = convert_from_usd(usd_amount, currency)
    dec = CURRENCY_DECIMALS.get(currency, 2)
    sym = CURRENCY_SYMBOLS.get(currency, "$")
    if dec == 0:
        return f"{sym}{int(value):,}"
    return f"{sym}{value:,.{dec}f}"


def stripe_amount(usd_amount: float, currency: str) -> int:
    """Return Stripe unit_amount in smallest currency unit."""
    value = convert_from_usd(usd_amount, currency)
    if currency in STRIPE_ZERO_DECIMAL:
        return int(round(value))
    return int(round(value * 100))


# --- Helpers ---
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_token(payload: dict, days: int = 60) -> str:
    p = {**payload, "exp": datetime.now(timezone.utc) + timedelta(days=days)}
    return jwt.encode(p, JWT_SECRET, algorithm="HS256")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": data["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def require_admin(user=Depends(get_current_user)):
    if user["role"] not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin only")
    return user


async def require_super_admin(user=Depends(get_current_user)):
    if user["role"] != "super_admin":
        raise HTTPException(403, "Super admin only")
    return user


# --- Models ---
class RegisterIn(BaseModel):
    firstName: str
    lastName: str
    phone: str
    address: str
    city: str
    country: str
    continent: str
    email: Optional[EmailStr] = None


class UserLoginIn(BaseModel):
    phone: str


class AdminLoginIn(BaseModel):
    phone: str
    password: str


class ServiceIn(BaseModel):
    name: str
    category: Literal["rental", "party", "catering", "gift", "custom"]
    description: str
    price: float
    image_url: Optional[str] = None
    active: bool = True


class BookingIn(BaseModel):
    service_id: str
    quantity: int = 1
    event_date: str
    notes: Optional[str] = ""
    payment_method: Literal["stripe", "cash"]
    currency: Optional[str] = "USD"
    language: Optional[str] = "en"
    promo_code: Optional[str] = None


class PromoIn(BaseModel):
    code: str
    percent_off: Optional[float] = None       # 0-100
    amount_off_usd: Optional[float] = None    # flat USD off
    max_uses: Optional[int] = None
    expires_at: Optional[str] = None          # ISO date/time
    active: bool = True


class PromoValidateIn(BaseModel):
    code: str


class CheckoutIn(BaseModel):
    booking_id: str
    origin_url: str


class ReceiptScanIn(BaseModel):
    image_base64: str


class CreateAdminIn(BaseModel):
    firstName: str
    lastName: str
    phone: str
    email: EmailStr
    password: str


# --- Seed defaults ---
DEFAULT_SERVICES = [
    {"name": "Elegant Party Rentals", "category": "rental", "price": 250.0,
     "description": "Premium chairs, linens, glassware and decor for events up to 50 guests.",
     "image_url": "https://images.unsplash.com/photo-1530023367847-a683933f4172?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"},
    {"name": "Bespoke Party Organization", "category": "party", "price": 850.0,
     "description": "End-to-end party planning: lighting, music, staff, and atmosphere.",
     "image_url": "https://images.unsplash.com/photo-1763553113391-a659bee36e06?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"},
    {"name": "Private Catering & Cooking", "category": "catering", "price": 480.0,
     "description": "Chef-crafted menus prepared on-site for your celebration.",
     "image_url": "https://images.unsplash.com/photo-1740047602722-b4993b79e4b7?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"},
    {"name": "Signature Birthday Gift Delivery", "category": "gift", "price": 120.0,
     "description": "Hand-wrapped birthday gifts delivered to the recipient with a personal note.",
     "image_url": "https://images.pexels.com/photos/29873585/pexels-photo-29873585.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"},
]


async def seed_defaults():
    admin_phone = os.environ.get("ADMIN_PHONE", "+10000000000")
    admin_email = os.environ.get("ADMIN_EMAIL", "lundengel@gmail.com")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "Admin@Elegante2026")
    existing = await db.users.find_one({"phone": admin_phone})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "firstName": "Lund", "lastName": "Engel",
            "phone": admin_phone, "email": admin_email,
            "address": "HQ", "city": "—", "country": "—", "continent": "—",
            "role": "super_admin", "password": hash_password(admin_pw),
            "created_at": now_iso(),
        })
        logger.info("Seeded super admin %s", admin_phone)

    count = await db.services.count_documents({})
    if count == 0:
        for s in DEFAULT_SERVICES:
            await db.services.insert_one({
                "id": str(uuid.uuid4()), "active": True, "created_at": now_iso(), **s,
            })
        logger.info("Seeded default services")


@app.on_event("startup")
async def on_start():
    await seed_defaults()


# --- Auth ---
@api.post("/auth/register")
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"phone": payload.phone})
    if existing:
        raise HTTPException(400, "Phone already registered")
    user = {"id": str(uuid.uuid4()), "role": "user", "created_at": now_iso(), **payload.model_dump()}
    # Auto-generate personal 10% welcome promo (single-use, 90-day expiry)
    welcome_code = f"WELCOME-{user['id'][:6].upper()}"
    await db.promo_codes.insert_one({
        "id": str(uuid.uuid4()),
        "code": welcome_code,
        "percent_off": 10.0,
        "amount_off_usd": None,
        "max_uses": 1,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat(),
        "active": True,
        "uses": 0,
        "welcome_for_user_id": user["id"],
        "created_at": now_iso(),
    })
    user["welcome_promo_code"] = welcome_code
    await db.users.insert_one(user)
    token = create_token({"sub": user["id"], "role": "user"})
    user.pop("_id", None)
    return {"token": token, "user": user}


@api.post("/auth/user/login")
async def user_login(payload: UserLoginIn):
    user = await db.users.find_one({"phone": payload.phone, "role": "user"}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(404, "No account for this phone. Please register.")
    token = create_token({"sub": user["id"], "role": "user"})
    return {"token": token, "user": user}


@api.post("/auth/admin/login")
async def admin_login(payload: AdminLoginIn):
    user = await db.users.find_one({"phone": payload.phone})
    if not user or user["role"] not in ("admin", "super_admin"):
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(payload.password, user.get("password", "")):
        raise HTTPException(401, "Invalid credentials")
    token = create_token({"sub": user["id"], "role": user["role"]})
    user.pop("_id", None); user.pop("password", None)
    return {"token": token, "user": user}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# --- Currency helper (for frontend consistency check) ---
@api.get("/currency/rates")
async def currency_rates():
    return {"rates": CURRENCY_RATES, "decimals": CURRENCY_DECIMALS, "symbols": CURRENCY_SYMBOLS}


# --- Services ---
@api.get("/services")
async def list_services():
    items = await db.services.find({"active": True}, {"_id": 0}).to_list(500)
    return items


@api.post("/services")
async def create_service(payload: ServiceIn, admin=Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), "created_at": now_iso(), **payload.model_dump()}
    await db.services.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/services/{sid}")
async def update_service(sid: str, payload: ServiceIn, admin=Depends(require_admin)):
    await db.services.update_one({"id": sid}, {"$set": payload.model_dump()})
    return {"ok": True}


@api.delete("/services/{sid}")
async def delete_service(sid: str, admin=Depends(require_admin)):
    await db.services.update_one({"id": sid}, {"$set": {"active": False}})
    return {"ok": True}


# --- Promo Codes ---
async def _resolve_promo(code: str) -> Optional[dict]:
    if not code:
        return None
    doc = await db.promo_codes.find_one({"code": code.upper()}, {"_id": 0})
    if not doc or not doc.get("active"):
        return None
    if doc.get("expires_at"):
        try:
            if datetime.fromisoformat(doc["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
                return None
        except Exception:
            pass
    if doc.get("max_uses") is not None and doc.get("uses", 0) >= doc["max_uses"]:
        return None
    return doc


def _apply_discount(total_usd: float, promo: Optional[dict]) -> tuple[float, float]:
    """Returns (discount_usd, final_usd)."""
    if not promo:
        return 0.0, total_usd
    discount = 0.0
    if promo.get("percent_off"):
        discount = total_usd * (float(promo["percent_off"]) / 100.0)
    elif promo.get("amount_off_usd"):
        discount = min(float(promo["amount_off_usd"]), total_usd)
    discount = round(discount, 2)
    return discount, max(0.0, round(total_usd - discount, 2))


@api.post("/promo-codes/validate")
async def validate_promo(payload: PromoValidateIn, user=Depends(get_current_user)):
    promo = await _resolve_promo(payload.code)
    if not promo:
        raise HTTPException(404, "Invalid or expired code")
    return {
        "code": promo["code"],
        "percent_off": promo.get("percent_off"),
        "amount_off_usd": promo.get("amount_off_usd"),
    }


@api.get("/admin/promo-codes")
async def list_promos(admin=Depends(require_admin)):
    items = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Enrich with revenue analytics
    codes = [p["code"] for p in items]
    bookings = await db.bookings.find(
        {"promo_code": {"$in": codes}}, {"_id": 0, "promo_code": 1, "paid": 1, "total": 1, "discount_usd": 1}
    ).to_list(10000)
    from collections import defaultdict
    agg = defaultdict(lambda: {"paid_bookings": 0, "revenue_usd": 0.0, "discount_usd": 0.0})
    for b in bookings:
        c = b.get("promo_code")
        if not c:
            continue
        if b.get("paid"):
            agg[c]["paid_bookings"] += 1
            agg[c]["revenue_usd"] += b.get("total", 0)
            agg[c]["discount_usd"] += b.get("discount_usd", 0)
    for p in items:
        a = agg.get(p["code"], {"paid_bookings": 0, "revenue_usd": 0.0, "discount_usd": 0.0})
        p["paid_bookings"] = a["paid_bookings"]
        p["revenue_usd"] = round(a["revenue_usd"], 2)
        p["discount_usd_total"] = round(a["discount_usd"], 2)
    return items


@api.post("/admin/promo-codes")
async def create_promo(payload: PromoIn, admin=Depends(require_admin)):
    code = payload.code.strip().upper()
    if not code:
        raise HTTPException(400, "Code required")
    if payload.percent_off is None and payload.amount_off_usd is None:
        raise HTTPException(400, "Either percent_off or amount_off_usd required")
    existing = await db.promo_codes.find_one({"code": code})
    if existing:
        raise HTTPException(400, "Code already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "code": code,
        "percent_off": payload.percent_off,
        "amount_off_usd": payload.amount_off_usd,
        "max_uses": payload.max_uses,
        "expires_at": payload.expires_at,
        "active": payload.active,
        "uses": 0,
        "created_at": now_iso(),
    }
    await db.promo_codes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/admin/promo-codes/{pid}")
async def delete_promo(pid: str, admin=Depends(require_admin)):
    await db.promo_codes.delete_one({"id": pid})
    return {"ok": True}


# --- Bookings ---
@api.post("/bookings")
async def create_booking(payload: BookingIn, user=Depends(get_current_user)):
    svc = await db.services.find_one({"id": payload.service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Service not found")
    currency = (payload.currency or "USD").upper()
    if currency not in CURRENCY_RATES:
        currency = "USD"

    subtotal_usd = svc["price"] * payload.quantity
    promo = await _resolve_promo(payload.promo_code) if payload.promo_code else None
    discount_usd, total_usd = _apply_discount(subtotal_usd, promo)
    total_local = convert_from_usd(total_usd, currency)
    discount_local = convert_from_usd(discount_usd, currency)

    booking = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": f"{user['firstName']} {user['lastName']}",
        "user_phone": user["phone"],
        "user_email": user.get("email"),
        "service_id": svc["id"],
        "service_name": svc["name"],
        "service_category": svc["category"],
        "unit_price": svc["price"],
        "quantity": payload.quantity,
        "subtotal": subtotal_usd,
        "discount_usd": discount_usd,
        "discount_local": discount_local,
        "promo_code": promo["code"] if promo else None,
        "total": total_usd,
        "total_local": total_local,
        "currency": currency,
        "language": payload.language or "en",
        "event_date": payload.event_date,
        "notes": payload.notes or "",
        "payment_method": payload.payment_method,
        "status": "pending_payment" if payload.payment_method == "stripe" else "pending_office_payment",
        "paid": False,
        "created_at": now_iso(),
    }
    await db.bookings.insert_one(booking)
    booking.pop("_id", None)

    if promo:
        await db.promo_codes.update_one({"code": promo["code"]}, {"$inc": {"uses": 1}})

    if payload.payment_method == "cash":
        receipt = _make_receipt(booking, method="cash", status="unpaid")
        await db.receipts.insert_one(receipt)
        booking["receipt_id"] = receipt["id"]
        asyncio.create_task(_send_receipt_email(receipt, user, kind="reserved"))
    return booking


@api.get("/bookings")
async def my_bookings(user=Depends(get_current_user)):
    items = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.get("/admin/bookings")
async def all_bookings(admin=Depends(require_admin)):
    items = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items


@api.put("/admin/bookings/{bid}/mark-paid")
async def mark_paid(bid: str, admin=Depends(require_admin)):
    booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    await db.bookings.update_one({"id": bid}, {"$set": {"paid": True, "status": "completed", "paid_at": now_iso()}})
    await db.receipts.update_one({"booking_id": bid}, {"$set": {"status": "paid", "paid_at": now_iso()}})
    receipt = await db.receipts.find_one({"booking_id": bid}, {"_id": 0})
    user = await db.users.find_one({"id": booking["user_id"]}, {"_id": 0, "password": 0})
    if receipt and user:
        asyncio.create_task(_send_receipt_email(receipt, user, kind="paid"))
    return {"ok": True}


# --- Receipts ---
def _make_receipt(booking: dict, method: str, status: str = "paid") -> dict:
    return {
        "id": str(uuid.uuid4()),
        "number": "MEG-" + datetime.now(timezone.utc).strftime("%Y%m%d") + "-" + str(uuid.uuid4())[:6].upper(),
        "booking_id": booking["id"],
        "user_id": booking["user_id"],
        "user_name": booking["user_name"],
        "user_phone": booking["user_phone"],
        "user_email": booking.get("user_email"),
        "service_name": booking["service_name"],
        "service_category": booking["service_category"],
        "unit_price": booking["unit_price"],
        "quantity": booking["quantity"],
        "subtotal": booking.get("subtotal", booking["total"]),
        "discount_usd": booking.get("discount_usd", 0.0),
        "discount_local": booking.get("discount_local", 0.0),
        "promo_code": booking.get("promo_code"),
        "total": booking["total"],
        "total_local": booking.get("total_local", booking["total"]),
        "currency": booking.get("currency", "USD"),
        "language": booking.get("language", "en"),
        "event_date": booking["event_date"],
        "payment_method": method,
        "status": status,
        "created_at": now_iso(),
    }


@api.get("/receipts")
async def my_receipts(user=Depends(get_current_user)):
    items = await db.receipts.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.get("/receipts/{rid}")
async def get_receipt(rid: str, user=Depends(get_current_user)):
    r = await db.receipts.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Receipt not found")
    if user["role"] == "user" and r["user_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    return r


@api.get("/admin/receipts")
async def admin_receipts(admin=Depends(require_admin)):
    items = await db.receipts.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items


@api.post("/receipts/scan")
async def scan_receipt(payload: ReceiptScanIn, admin=Depends(require_admin)):
    b64 = payload.image_base64
    if b64.startswith("data:"):
        b64 = b64.split(",", 1)[1]
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"receipt-scan-{uuid.uuid4()}",
        system_message=(
            "You are a receipt OCR assistant. Given a photo of a receipt, extract structured data. "
            "Return ONLY valid minified JSON with keys: merchant (string), date (ISO string or empty), "
            "items (array of {name:string, qty:number, price:number}), subtotal (number), tax (number), "
            "total (number), currency (string). Use 0 for unknown numbers and empty string for unknown strings."
        ),
    ).with_model("openai", "gpt-5.4")

    img = ImageContent(image_base64=b64)
    msg = UserMessage(text="Extract the receipt data as JSON only, no prose.", file_contents=[img])

    full = ""
    from emergentintegrations.llm.chat import TextDelta, StreamDone
    try:
        async for ev in chat.stream_message(msg):
            if isinstance(ev, TextDelta): full += ev.content
            elif isinstance(ev, StreamDone): break
    except Exception as e:
        logger.exception("scan failed")
        raise HTTPException(500, f"OCR failed: {e}")

    import json, re
    m = re.search(r"\{.*\}", full.strip(), re.DOTALL)
    if not m:
        raise HTTPException(500, "Could not parse LLM output")
    try:
        parsed = json.loads(m.group(0))
    except Exception:
        raise HTTPException(500, "Invalid JSON from LLM")

    doc = {"id": str(uuid.uuid4()), "type": "scanned", "raw_data": parsed,
           "created_at": now_iso(), "scanned_by": admin["id"]}
    await db.scanned_receipts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/admin/scanned-receipts")
async def list_scanned(admin=Depends(require_admin)):
    items = await db.scanned_receipts.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


# --- Stripe Payments (Flow A) ---
@api.post("/payments/checkout")
async def create_checkout(payload: CheckoutIn, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": payload.booking_id, "user_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.get("paid"):
        raise HTTPException(400, "Already paid")

    currency = (booking.get("currency") or "USD").upper()
    amount = stripe_amount(booking["total"], currency)

    session = stripe.checkout.Session.create(
        line_items=[{
            "price_data": {
                "currency": currency.lower(),
                "unit_amount": amount,
                "product_data": {
                    "name": booking["service_name"],
                    "description": f"Booking #{booking['id'][:8]} for {booking['user_name']}",
                },
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{payload.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{payload.origin_url}/payment/cancel",
        metadata={"booking_id": booking["id"], "user_id": user["id"]},
    )

    sync_db.payment_transactions.insert_one({
        "session_id": session.id,
        "booking_id": booking["id"],
        "user_id": user["id"],
        "amount": booking["total_local"] if booking.get("total_local") else booking["total"],
        "currency": currency.lower(),
        "status": "initiated",
        "payment_status": "pending",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    rec = sync_db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Not found")
    if rec.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                sync_db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "stripe_payment_intent_id": s.payment_intent,
                              "updated_at": now_iso()}},
                )
                await _mark_paid_and_receipt(rec["booking_id"])
                rec = sync_db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {"session_id": rec["session_id"], "status": rec["status"], "payment_status": rec["payment_status"]}


async def _mark_paid_and_receipt(booking_id: str):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking or booking.get("paid"):
        return
    await db.bookings.update_one({"id": booking_id}, {"$set": {"paid": True, "status": "completed", "paid_at": now_iso()}})
    existing = await db.receipts.find_one({"booking_id": booking_id})
    if existing:
        await db.receipts.update_one({"booking_id": booking_id}, {"$set": {"status": "paid", "paid_at": now_iso(), "payment_method": "stripe"}})
        receipt = await db.receipts.find_one({"booking_id": booking_id}, {"_id": 0})
    else:
        receipt = _make_receipt(booking, method="stripe", status="paid")
        await db.receipts.insert_one(receipt)
    user = await db.users.find_one({"id": booking["user_id"]}, {"_id": 0, "password": 0})
    if receipt and user:
        asyncio.create_task(_send_receipt_email(receipt, user, kind="paid"))


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")

    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        sync_db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"),
                      "stripe_payment_intent_id": obj.get("payment_intent"),
                      "updated_at": now_iso()}},
        )
        bid = (obj.get("metadata") or {}).get("booking_id")
        if bid:
            await _mark_paid_and_receipt(bid)
    return {"status": "ok"}


# --- Analytics ---
@api.get("/admin/analytics")
async def analytics(admin=Depends(require_admin)):
    bookings = await db.bookings.find({}, {"_id": 0}).to_list(5000)
    users = await db.users.count_documents({"role": "user"})
    total_revenue = sum(b["total"] for b in bookings if b.get("paid"))
    pending_revenue = sum(b["total"] for b in bookings if not b.get("paid"))
    total_bookings = len(bookings)
    paid_bookings = sum(1 for b in bookings if b.get("paid"))

    from collections import defaultdict
    monthly = defaultdict(lambda: {"revenue": 0.0, "count": 0})
    for b in bookings:
        d = b.get("created_at", "")[:7]
        monthly[d]["count"] += 1
        if b.get("paid"): monthly[d]["revenue"] += b["total"]
    monthly_series = [{"month": k, **v} for k, v in sorted(monthly.items())][-6:]

    cat = defaultdict(lambda: {"revenue": 0.0, "count": 0})
    for b in bookings:
        c = b.get("service_category", "custom")
        cat[c]["count"] += 1
        if b.get("paid"): cat[c]["revenue"] += b["total"]
    by_category = [{"category": k, **v} for k, v in cat.items()]

    # Revenue by paid currency (using stored local amounts)
    ccy = defaultdict(lambda: {"paid_local": 0.0, "pending_local": 0.0, "count": 0})
    for b in bookings:
        code = b.get("currency", "USD")
        local_total = b.get("total_local", convert_from_usd(b["total"], code))
        ccy[code]["count"] += 1
        if b.get("paid"):
            ccy[code]["paid_local"] += local_total
        else:
            ccy[code]["pending_local"] += local_total
    by_currency = [
        {"currency": k, "paid_local": round(v["paid_local"], CURRENCY_DECIMALS.get(k, 2)),
         "pending_local": round(v["pending_local"], CURRENCY_DECIMALS.get(k, 2)),
         "count": v["count"], "symbol": CURRENCY_SYMBOLS.get(k, "$")}
        for k, v in ccy.items()
    ]

    return {
        "total_users": users, "total_bookings": total_bookings, "paid_bookings": paid_bookings,
        "total_revenue": round(total_revenue, 2), "pending_revenue": round(pending_revenue, 2),
        "monthly": monthly_series, "by_category": by_category, "by_currency": by_currency,
    }


# --- Super Admin ---
@api.get("/admin/users")
async def list_users(admin=Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(2000)
    return users


@api.post("/super-admin/create-admin")
async def create_admin(payload: CreateAdminIn, sa=Depends(require_super_admin)):
    existing = await db.users.find_one({"phone": payload.phone})
    if existing:
        raise HTTPException(400, "Phone already used")
    doc = {"id": str(uuid.uuid4()), "firstName": payload.firstName, "lastName": payload.lastName,
           "phone": payload.phone, "email": payload.email, "role": "admin",
           "password": hash_password(payload.password),
           "address": "—", "city": "—", "country": "—", "continent": "—",
           "created_at": now_iso()}
    await db.users.insert_one(doc)
    doc.pop("_id", None); doc.pop("password", None)
    return doc


@api.delete("/super-admin/users/{uid}")
async def delete_user(uid: str, sa=Depends(require_super_admin)):
    await db.users.delete_one({"id": uid})
    return {"ok": True}


# --- Email (Resend via Emergent proxy) ---
EMAIL_STRINGS = {
    "en": {
        "subject_paid": "Receipt {number} — Payment received",
        "subject_reserved": "Reservation {number} — Payment due at office",
        "heading_paid": "Merci — payment received",
        "heading_reserved": "Reservation confirmed",
        "greeting": "Hello {name},",
        "body_paid": "Your booking is confirmed and paid. This email is your official receipt.",
        "body_reserved": "Your booking is reserved. Please visit the office to complete the cash payment.",
        "receipt": "Receipt", "service": "Service", "event": "Event date",
        "quantity": "Quantity", "unit": "Unit price", "total": "Total",
        "payment": "Payment method", "status": "Status",
        "footer": "Maison Élégante · Crafted for celebrations",
        "cta": "View receipt online",
    },
    "fr": {
        "subject_paid": "Reçu {number} — Paiement reçu",
        "subject_reserved": "Réservation {number} — Paiement dû au bureau",
        "heading_paid": "Merci — paiement reçu",
        "heading_reserved": "Réservation confirmée",
        "greeting": "Bonjour {name},",
        "body_paid": "Votre réservation est confirmée et payée. Cet e-mail est votre reçu officiel.",
        "body_reserved": "Votre réservation est enregistrée. Merci de vous rendre au bureau pour régler en espèces.",
        "receipt": "Reçu", "service": "Service", "event": "Date de l'événement",
        "quantity": "Quantité", "unit": "Prix unitaire", "total": "Total",
        "payment": "Mode de paiement", "status": "Statut",
        "footer": "Maison Élégante · Conçu pour les célébrations",
        "cta": "Voir le reçu en ligne",
    },
    "sw": {
        "subject_paid": "Risiti {number} — Malipo yamepokelewa",
        "subject_reserved": "Uwekaji {number} — Malipo yanalipwa ofisini",
        "heading_paid": "Asante — malipo yamepokelewa",
        "heading_reserved": "Uwekaji umethibitishwa",
        "greeting": "Habari {name},",
        "body_paid": "Uwekaji wako umethibitishwa na kulipwa. Barua pepe hii ni risiti yako rasmi.",
        "body_reserved": "Uwekaji wako umerekodiwa. Tafadhali tembelea ofisi kulipa fedha taslimu.",
        "receipt": "Risiti", "service": "Huduma", "event": "Tarehe ya hafla",
        "quantity": "Idadi", "unit": "Bei ya kitengo", "total": "Jumla",
        "payment": "Njia ya malipo", "status": "Hali",
        "footer": "Maison Élégante · Imeundwa kwa sherehe",
        "cta": "Angalia risiti mtandaoni",
    },
}


def _render_receipt_email(receipt: dict, user: dict, kind: str) -> tuple[str, str]:
    lang = receipt.get("language", "en")
    s = EMAIL_STRINGS.get(lang, EMAIL_STRINGS["en"])
    subject_key = "subject_paid" if kind == "paid" else "subject_reserved"
    heading_key = "heading_paid" if kind == "paid" else "heading_reserved"
    body_key = "body_paid" if kind == "paid" else "body_reserved"

    total_str = format_money(receipt["total"], receipt.get("currency", "USD"))
    unit_str = format_money(receipt["unit_price"], receipt.get("currency", "USD"))
    subject = s[subject_key].format(number=receipt["number"])

    html = f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FDFBF7;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDFBF7;padding:32px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 40px -20px rgba(0,0,0,0.08);">
      <tr><td style="padding:36px 40px 20px;border-bottom:1px solid #EAE6DB;">
        <div style="font-family:Georgia,serif;font-size:26px;letter-spacing:-0.5px;">Maison<span style="color:#D4AF37;">·</span>Élégante</div>
        <div style="text-transform:uppercase;letter-spacing:0.2em;font-size:10px;color:#94A3B8;margin-top:6px;">{s['receipt']} · {receipt['number']}</div>
      </td></tr>
      <tr><td style="padding:36px 40px 8px;">
        <div style="font-family:Georgia,serif;font-size:30px;line-height:1.15;color:#0F172A;">{s[heading_key]}</div>
        <div style="margin-top:14px;font-size:15px;line-height:1.6;color:#475569;">{s['greeting'].format(name=user.get('firstName', ''))}</div>
        <div style="margin-top:6px;font-size:15px;line-height:1.6;color:#475569;">{s[body_key]}</div>
      </td></tr>
      <tr><td style="padding:24px 40px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EAE6DB;padding-top:20px;">
          <tr><td style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.15em;padding:6px 0;">{s['service']}</td>
              <td style="font-size:14px;color:#0F172A;text-align:right;padding:6px 0;">{receipt['service_name']}</td></tr>
          <tr><td style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.15em;padding:6px 0;">{s['event']}</td>
              <td style="font-size:14px;color:#0F172A;text-align:right;padding:6px 0;">{receipt['event_date']}</td></tr>
          <tr><td style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.15em;padding:6px 0;">{s['unit']}</td>
              <td style="font-size:14px;color:#0F172A;text-align:right;padding:6px 0;">{unit_str}</td></tr>
          <tr><td style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.15em;padding:6px 0;">{s['quantity']}</td>
              <td style="font-size:14px;color:#0F172A;text-align:right;padding:6px 0;">{receipt['quantity']}</td></tr>
          <tr><td style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.15em;padding:6px 0;">{s['payment']}</td>
              <td style="font-size:14px;color:#0F172A;text-align:right;padding:6px 0;">{receipt['payment_method']}</td></tr>
          <tr><td style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.15em;padding:6px 0;">{s['status']}</td>
              <td style="font-size:14px;color:#0F172A;text-align:right;padding:6px 0;text-transform:uppercase;letter-spacing:0.1em;">{receipt['status']}</td></tr>
        </table>
        <div style="border-top:1px solid #EAE6DB;margin-top:16px;padding-top:16px;">
          <table role="presentation" width="100%"><tr>
            <td style="font-family:Georgia,serif;font-size:18px;color:#0F172A;">{s['total']}</td>
            <td style="font-family:Georgia,serif;font-size:22px;color:#0F172A;text-align:right;">{total_str}</td>
          </tr></table>
        </div>
      </td></tr>
      <tr><td style="padding:20px 40px 40px;">
        <div style="text-align:center;font-size:12px;color:#94A3B8;padding-top:20px;border-top:1px solid #EAE6DB;">{s['footer']}</div>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>"""
    return subject, html


async def _send_receipt_email(receipt: dict, user: dict, kind: str = "paid"):
    email = user.get("email") or receipt.get("user_email")
    if not email or not EMAIL_KEY:
        logger.info("Skipping email — no address or no email key (email=%s)", bool(email))
        return
    try:
        subject, html = _render_receipt_email(receipt, user, kind)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json={"to": [email], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME},
            )
            resp.raise_for_status()
        logger.info("Email sent to %s (receipt %s)", email, receipt["number"])
    except Exception as e:
        logger.error("Email send failed: %s", e)


# --- Reminder emails ---
REMINDER_STRINGS = {
    "en": {
        "subject": "Your event is tomorrow — {service}",
        "heading": "See you tomorrow",
        "greeting": "Hello {name},",
        "body": "Just a friendly reminder: your booking with Maison Élégante is happening tomorrow. Here's everything you need to know.",
        "checklist_h": "A quick checklist",
        "checklist_1": "Have your receipt number handy at arrival",
        "checklist_2": "Guests confirmed and any dietary notes shared",
        "checklist_3": "Payment status verified (paid or ready at office)",
        "checklist_4": "Contact us anytime if plans shift",
        "event_date": "Event date", "service": "Service", "receipt": "Receipt",
        "directions_h": "Directions",
        "directions_body": "The atelier will contact you at {phone} with the exact address and access details.",
        "footer": "Maison Élégante · Crafted for celebrations",
    },
    "fr": {
        "subject": "Votre événement est demain — {service}",
        "heading": "À demain",
        "greeting": "Bonjour {name},",
        "body": "Petit rappel amical : votre réservation avec Maison Élégante a lieu demain. Voici l'essentiel.",
        "checklist_h": "Petite checklist",
        "checklist_1": "Ayez votre numéro de reçu à l'arrivée",
        "checklist_2": "Invités confirmés et régimes alimentaires partagés",
        "checklist_3": "Statut de paiement vérifié (payé ou à régler au bureau)",
        "checklist_4": "Contactez-nous à tout moment si les plans changent",
        "event_date": "Date de l'événement", "service": "Service", "receipt": "Reçu",
        "directions_h": "Directions",
        "directions_body": "L'atelier vous contactera au {phone} avec l'adresse exacte et les détails d'accès.",
        "footer": "Maison Élégante · Conçu pour les célébrations",
    },
    "sw": {
        "subject": "Hafla yako ni kesho — {service}",
        "heading": "Tuonane kesho",
        "greeting": "Habari {name},",
        "body": "Ukumbusho mzuri: uwekaji wako na Maison Élégante utafanyika kesho. Hii ndio unayohitaji kujua.",
        "checklist_h": "Orodha fupi",
        "checklist_1": "Kuwa na nambari ya risiti unapofika",
        "checklist_2": "Wageni wamethibitishwa na mahitaji ya chakula yameshirikiwa",
        "checklist_3": "Hali ya malipo imethibitishwa (imelipwa au tayari ofisini)",
        "checklist_4": "Wasiliana nasi wakati wowote iwapo mipango itabadilika",
        "event_date": "Tarehe ya hafla", "service": "Huduma", "receipt": "Risiti",
        "directions_h": "Maelekezo",
        "directions_body": "Ofisi itakuwasiliana kupitia {phone} na anwani halisi na maelezo ya ufikiaji.",
        "footer": "Maison Élégante · Imeundwa kwa sherehe",
    },
}


def _render_reminder_email(booking: dict, user: dict) -> tuple[str, str]:
    lang = booking.get("language", "en")
    s = REMINDER_STRINGS.get(lang, REMINDER_STRINGS["en"])
    subject = s["subject"].format(service=booking["service_name"])
    total_str = format_money(booking["total"], booking.get("currency", "USD"))
    html = f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FDFBF7;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDFBF7;padding:32px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 40px -20px rgba(0,0,0,0.08);">
      <tr><td style="padding:36px 40px 20px;border-bottom:1px solid #EAE6DB;">
        <div style="font-family:Georgia,serif;font-size:26px;letter-spacing:-0.5px;">Maison<span style="color:#D4AF37;">·</span>Élégante</div>
        <div style="text-transform:uppercase;letter-spacing:0.2em;font-size:10px;color:#D4AF37;margin-top:6px;">24H REMINDER</div>
      </td></tr>
      <tr><td style="padding:36px 40px 8px;">
        <div style="font-family:Georgia,serif;font-size:30px;line-height:1.15;">{s['heading']}</div>
        <div style="margin-top:14px;font-size:15px;line-height:1.6;color:#475569;">{s['greeting'].format(name=user.get('firstName',''))}</div>
        <div style="margin-top:6px;font-size:15px;line-height:1.6;color:#475569;">{s['body']}</div>
      </td></tr>
      <tr><td style="padding:24px 40px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EAE6DB;padding-top:20px;">
          <tr><td style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.15em;padding:6px 0;">{s['event_date']}</td>
              <td style="font-size:14px;text-align:right;padding:6px 0;">{booking['event_date']}</td></tr>
          <tr><td style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.15em;padding:6px 0;">{s['service']}</td>
              <td style="font-size:14px;text-align:right;padding:6px 0;">{booking['service_name']}</td></tr>
          <tr><td style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.15em;padding:6px 0;">Total</td>
              <td style="font-size:14px;text-align:right;padding:6px 0;">{total_str}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 40px 8px;">
        <div style="font-family:Georgia,serif;font-size:18px;">{s['checklist_h']}</div>
        <ul style="padding-left:20px;margin-top:12px;font-size:14px;color:#475569;line-height:1.9;">
          <li>{s['checklist_1']}</li><li>{s['checklist_2']}</li>
          <li>{s['checklist_3']}</li><li>{s['checklist_4']}</li>
        </ul>
      </td></tr>
      <tr><td style="padding:8px 40px 32px;">
        <div style="font-family:Georgia,serif;font-size:18px;">{s['directions_h']}</div>
        <p style="margin-top:10px;font-size:14px;color:#475569;line-height:1.7;">{s['directions_body'].format(phone=user.get('phone','—'))}</p>
      </td></tr>
      <tr><td style="padding:0 40px 40px;">
        <div style="text-align:center;font-size:12px;color:#94A3B8;padding-top:20px;border-top:1px solid #EAE6DB;">{s['footer']}</div>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>"""
    return subject, html


async def _send_reminder(booking: dict):
    email = booking.get("user_email")
    if not email or not EMAIL_KEY:
        return False
    user = await db.users.find_one({"id": booking["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        return False
    try:
        subject, html = _render_reminder_email(booking, user)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json={"to": [email], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME},
            )
            resp.raise_for_status()
        logger.info("Reminder sent to %s for booking %s", email, booking["id"])
        return True
    except Exception as e:
        logger.error("Reminder send failed: %s", e)
        return False


async def _process_reminders():
    """Find bookings with event_date within the next 24-30 hours that haven't been reminded."""
    now = datetime.now(timezone.utc).date()
    tomorrow = (now + timedelta(days=1)).isoformat()  # YYYY-MM-DD
    cursor = db.bookings.find(
        {"event_date": tomorrow, "reminder_sent": {"$ne": True}, "paid": True},
        {"_id": 0},
    )
    sent = 0
    async for b in cursor:
        ok = await _send_reminder(b)
        if ok:
            await db.bookings.update_one({"id": b["id"]}, {"$set": {"reminder_sent": True, "reminder_sent_at": now_iso()}})
            sent += 1
    logger.info("Reminder run complete — sent=%d for date=%s", sent, tomorrow)


import hmac


@api.post("/cron/reminders")
async def cron_reminders(request: Request, authorization: Optional[str] = Header(None)):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    expected = f"Bearer {WEBHOOK_CRON_SECRET}"
    if not authorization or not WEBHOOK_CRON_SECRET or not hmac.compare_digest(authorization, expected):
        raise HTTPException(401, "Unauthorized")
    asyncio.create_task(_process_reminders())
    return {"status": "accepted"}


@api.get("/")
async def root():
    return {"service": "Maison Élégante API", "ok": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
