from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import csv
import uuid
import bcrypt
import jwt
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# --- Setup
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

app = FastAPI(title="Spice POS API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# --- Helpers
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def iso(dt: Optional[datetime] = None) -> str:
    return (dt or datetime.now(timezone.utc)).isoformat()


# --- Models
Role = Literal["owner", "staff", "customer"]


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role = "customer"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Role
    created_at: str


class MenuItemIn(BaseModel):
    name: str
    category: str
    price: float
    cost: float = 0.0
    description: Optional[str] = ""
    is_available: bool = True


class MenuItemOut(MenuItemIn):
    id: str
    created_at: str


class OrderItemIn(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int


class OrderCreate(BaseModel):
    items: List[OrderItemIn]
    table_number: Optional[str] = None
    customer_name: Optional[str] = None
    notes: Optional[str] = ""


class OrderStatusUpdate(BaseModel):
    status: Literal["new", "preparing", "ready", "served", "cancelled"]


class ExpenseIn(BaseModel):
    title: str
    amount: float
    category: Optional[str] = "general"
    date: Optional[str] = None  # ISO date YYYY-MM-DD


class SettingsIn(BaseModel):
    cgst_rate: float  # percentage, e.g., 2.5
    sgst_rate: float
    restaurant_name: Optional[str] = "Spice Route"
    address: Optional[str] = ""
    phone: Optional[str] = ""
    gstin: Optional[str] = ""


# --- Auth dependency
def extract_token(request: Request) -> Optional[str]:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    return token


async def get_current_user(request: Request) -> dict:
    token = extract_token(request)
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return checker


# --- Auth endpoints
def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 12,
        path="/",
    )


def user_public(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "created_at": user["created_at"],
    }


@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "name": body.name,
        "email": email,
        "role": body.role,
        "password_hash": hash_password(body.password),
        "created_at": iso(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email, body.role)
    set_auth_cookie(response, token)
    return {"user": user_public(doc), "token": token}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token)
    return {"user": user_public(user), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_public(user)


# --- Menu
@api.get("/menu")
async def list_menu():
    items = await db.menu_items.find({}, {"_id": 0}).to_list(2000)
    return items


@api.post("/menu", response_model=MenuItemOut)
async def create_menu_item(body: MenuItemIn, user: dict = Depends(require_roles("owner"))):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = iso()
    await db.menu_items.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api.put("/menu/{item_id}")
async def update_menu_item(item_id: str, body: MenuItemIn, user: dict = Depends(require_roles("owner"))):
    res = await db.menu_items.update_one({"id": item_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    return item


@api.delete("/menu/{item_id}")
async def delete_menu_item(item_id: str, user: dict = Depends(require_roles("owner"))):
    res = await db.menu_items.delete_one({"id": item_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# --- Settings (CGST/SGST/restaurant info)
async def get_settings_doc() -> dict:
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {
            "id": "global",
            "cgst_rate": 2.5,
            "sgst_rate": 2.5,
            "restaurant_name": "Spice Route",
            "address": "42 MG Road, Bengaluru",
            "phone": "+91 98765 43210",
            "gstin": "29ABCDE1234F1Z5",
        }
        await db.settings.insert_one(s.copy())
    return s


@api.get("/settings")
async def get_settings():
    return await get_settings_doc()


@api.put("/settings")
async def update_settings(body: SettingsIn, user: dict = Depends(require_roles("owner"))):
    data = body.model_dump()
    await db.settings.update_one({"id": "global"}, {"$set": data}, upsert=True)
    return await get_settings_doc()


# --- Orders
def compute_totals(items: List[dict], cgst_rate: float, sgst_rate: float) -> dict:
    subtotal = round(sum(i["price"] * i["quantity"] for i in items), 2)
    cgst = round(subtotal * cgst_rate / 100, 2)
    sgst = round(subtotal * sgst_rate / 100, 2)
    total = round(subtotal + cgst + sgst, 2)
    return {"subtotal": subtotal, "cgst": cgst, "sgst": sgst, "total": total}


async def next_order_number() -> int:
    doc = await db.counters.find_one_and_update(
        {"id": "orders"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True,
    )
    if not doc:
        doc = await db.counters.find_one({"id": "orders"})
    return int(doc["value"])


@api.post("/orders")
async def create_order(body: OrderCreate, user: dict = Depends(get_current_user)):
    if not body.items:
        raise HTTPException(400, "Order must contain at least 1 item")
    settings = await get_settings_doc()
    items = [i.model_dump() for i in body.items]
    totals = compute_totals(items, settings["cgst_rate"], settings["sgst_rate"])
    order_no = await next_order_number()
    doc = {
        "id": str(uuid.uuid4()),
        "order_number": order_no,
        "items": items,
        "table_number": body.table_number or "-",
        "customer_name": body.customer_name or user.get("name", ""),
        "notes": body.notes or "",
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_by_role": user["role"],
        "status": "new",
        "cgst_rate": settings["cgst_rate"],
        "sgst_rate": settings["sgst_rate"],
        **totals,
        "created_at": iso(),
    }
    await db.orders.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api.get("/orders")
async def list_orders(
    status: Optional[str] = None,
    date: Optional[str] = None,  # YYYY-MM-DD
    user: dict = Depends(get_current_user),
):
    q = {}
    if status:
        q["status"] = status
    if date:
        q["created_at"] = {"$gte": f"{date}T00:00:00", "$lt": f"{date}T23:59:59.999999+00:00"}
    # Customers only see their own orders
    if user["role"] == "customer":
        q["created_by"] = user["id"]
    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return orders


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Not found")
    if user["role"] == "customer" and o["created_by"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    return o


@api.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusUpdate, user: dict = Depends(require_roles("owner", "staff"))):
    res = await db.orders.update_one({"id": order_id}, {"$set": {"status": body.status, "updated_at": iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return o


# --- Expenses
@api.post("/expenses")
async def create_expense(body: ExpenseIn, user: dict = Depends(require_roles("owner"))):
    date = body.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "amount": float(body.amount),
        "category": body.category or "general",
        "date": date,
        "created_at": iso(),
    }
    await db.expenses.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api.get("/expenses")
async def list_expenses(date: Optional[str] = None, user: dict = Depends(require_roles("owner"))):
    q = {}
    if date:
        q["date"] = date
    items = await db.expenses.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items


@api.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: dict = Depends(require_roles("owner"))):
    res = await db.expenses.delete_one({"id": expense_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# --- Analytics
@api.get("/analytics/summary")
async def analytics_summary(date: Optional[str] = None, user: dict = Depends(require_roles("owner"))):
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start, end = f"{target}T00:00:00", f"{target}T23:59:59.999999+00:00"

    orders = await db.orders.find(
        {"created_at": {"$gte": start, "$lt": end}, "status": {"$ne": "cancelled"}},
        {"_id": 0},
    ).to_list(5000)

    revenue = round(sum(o["total"] for o in orders), 2)
    cost_of_goods = 0.0
    category_sales: dict = {}
    for o in orders:
        for it in o["items"]:
            menu = await db.menu_items.find_one({"id": it["menu_item_id"]}, {"_id": 0})
            cost = (menu["cost"] if menu else 0) * it["quantity"]
            cost_of_goods += cost
            cat = menu["category"] if menu else "other"
            category_sales[cat] = round(category_sales.get(cat, 0) + it["price"] * it["quantity"], 2)
    cost_of_goods = round(cost_of_goods, 2)

    expenses = await db.expenses.find({"date": target}, {"_id": 0}).to_list(2000)
    spent = round(sum(e["amount"] for e in expenses), 2)

    total_cost = round(cost_of_goods + spent, 2)
    profit = round(revenue - total_cost, 2)
    loss = round(-profit, 2) if profit < 0 else 0.0
    net_profit = max(profit, 0.0)

    return {
        "date": target,
        "orders_count": len(orders),
        "revenue": revenue,
        "cost_of_goods": cost_of_goods,
        "spent": spent,
        "total_cost": total_cost,
        "profit": net_profit,
        "loss": loss,
        "category_sales": category_sales,
        "pie": [
            {"name": "Profit", "value": net_profit},
            {"name": "Spent", "value": spent},
            {"name": "Cost of Goods", "value": cost_of_goods},
            {"name": "Loss", "value": loss},
        ],
    }


@api.get("/analytics/export")
async def export_csv(date: Optional[str] = None, user: dict = Depends(require_roles("owner"))):
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start, end = f"{target}T00:00:00", f"{target}T23:59:59.999999+00:00"
    orders = await db.orders.find({"created_at": {"$gte": start, "$lt": end}}, {"_id": 0}).sort("created_at", 1).to_list(10000)

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Order#", "Created At", "Staff", "Table", "Customer", "Status", "Items", "Subtotal", "CGST", "SGST", "Total"])
    for o in orders:
        items_str = "; ".join([f"{i['quantity']}x {i['name']}" for i in o["items"]])
        w.writerow([
            o["order_number"], o["created_at"], o.get("created_by_name", ""),
            o.get("table_number", "-"), o.get("customer_name", ""), o["status"],
            items_str, o["subtotal"], o["cgst"], o["sgst"], o["total"],
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="orders_{target}.csv"'},
    )


# --- Seeding
SAMPLE_MENU = [
    # Main Course
    ("Paneer Butter Masala", "Main Course", 240, 110, "Creamy tomato gravy with paneer cubes"),
    ("Dal Makhani", "Main Course", 210, 80, "Slow-cooked black lentils in butter & cream"),
    ("Palak Paneer", "Main Course", 230, 100, "Paneer in a smooth spinach gravy"),
    # Chinese
    ("Veg Hakka Noodles", "Chinese", 180, 70, "Stir-fried noodles with veggies"),
    ("Chilli Chicken Dry", "Chinese", 260, 120, "Indo-Chinese spicy chicken starter"),
    ("Manchurian Gravy", "Chinese", 200, 80, "Veg balls in tangy Manchurian sauce"),
    # Biryanis
    ("Hyderabadi Chicken Biryani", "Biryanis", 320, 150, "Dum-cooked aromatic chicken biryani"),
    ("Veg Dum Biryani", "Biryanis", 260, 100, "Fragrant mixed veggies & basmati"),
    ("Mutton Biryani", "Biryanis", 420, 200, "Slow-cooked mutton with saffron rice"),
    # Roti
    ("Butter Naan", "Roti", 50, 15, "Tandoor-baked naan brushed with butter"),
    ("Tandoori Roti", "Roti", 25, 8, "Whole-wheat roti from the tandoor"),
    ("Lachha Paratha", "Roti", 60, 20, "Flaky layered paratha"),
    # Fried Rice
    ("Schezwan Fried Rice", "Fried Rice", 200, 70, "Spicy schezwan tossed rice"),
    ("Veg Fried Rice", "Fried Rice", 180, 60, "Classic fried rice with veggies"),
    ("Egg Fried Rice", "Fried Rice", 200, 75, "Wok-tossed egg fried rice"),
    # Mandi
    ("Chicken Mandi", "Mandi", 380, 180, "Yemeni-style aromatic chicken & rice"),
    ("Mutton Mandi", "Mandi", 520, 260, "Slow-smoked mutton with mandi rice"),
    # Sweets
    ("Gulab Jamun (2 pc)", "Sweets", 80, 25, "Warm milk dumplings in rose syrup"),
    ("Rasmalai (2 pc)", "Sweets", 120, 40, "Chilled cottage cheese in saffron milk"),
    ("Gajar Halwa", "Sweets", 140, 50, "Carrot halwa with ghee & dry fruits"),
    # Mutton
    ("Mutton Rogan Josh", "Mutton", 440, 210, "Kashmiri-style slow-cooked mutton"),
    ("Mutton Keema", "Mutton", 360, 170, "Spiced minced mutton"),
    ("Mutton Korma", "Mutton", 460, 220, "Rich, nutty mutton korma"),
]


async def seed_startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.menu_items.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("created_at")

    # Seed owner
    admin_email = os.environ.get("ADMIN_EMAIL", "owner@spice.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "owner123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Spice Owner",
            "email": admin_email,
            "role": "owner",
            "password_hash": hash_password(admin_password),
            "created_at": iso(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Seed a staff + customer for convenience
    for email, name, role, pw in [
        ("staff@spice.com", "Ravi Staff", "staff", "staff123"),
        ("guest@spice.com", "Aarav Guest", "customer", "guest123"),
    ]:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "name": name,
                "email": email,
                "role": role,
                "password_hash": hash_password(pw),
                "created_at": iso(),
            })

    # Seed menu
    count = await db.menu_items.count_documents({})
    if count == 0:
        for name, cat, price, cost, desc in SAMPLE_MENU:
            await db.menu_items.insert_one({
                "id": str(uuid.uuid4()),
                "name": name,
                "category": cat,
                "price": float(price),
                "cost": float(cost),
                "description": desc,
                "is_available": True,
                "created_at": iso(),
            })

    # Seed settings
    await get_settings_doc()


@app.on_event("startup")
async def on_startup():
    try:
        await seed_startup()
        logger.info("Seeding completed.")
    except Exception as e:
        logger.exception("Seeding failed: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# --- Health
@api.get("/")
async def root():
    return {"service": "Spice POS API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
