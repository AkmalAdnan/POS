from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import csv
import math
import uuid
import bcrypt
import jwt
import ipaddress
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr

# ---------- Setup
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

app = FastAPI(title="Spice POS API v2")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

Role = Literal["owner", "captain", "chef", "cashier", "customer"]

CATEGORY_TO_DEPARTMENT = {
    "Main Course": "Main Kitchen",
    "Biryanis": "Main Kitchen",
    "Mandi": "Main Kitchen",
    "Mutton": "Main Kitchen",
    "Chinese": "Chinese Counter",
    "Fried Rice": "Chinese Counter",
    "Roti": "Chinese Counter",
    "Sweets": "Sweets / Dessert",
    "Beverages": "Beverage Counter",
}
ALL_DEPARTMENTS = ["Main Kitchen", "Chinese Counter", "Sweets / Dessert", "Beverage Counter"]


def dept_for(category: str) -> str:
    return CATEGORY_TO_DEPARTMENT.get(category, "Main Kitchen")


# ---------- Helpers
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())

def iso(dt: Optional[datetime] = None) -> str:
    return (dt or datetime.now(timezone.utc)).isoformat()

def create_token(user: dict) -> str:
    payload = {"sub": user["id"], "email": user["email"], "role": user["role"],
               "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def public_user(u: dict) -> dict:
    return {"id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"], "created_at": u["created_at"]}

def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else ""

def haversine_m(lat1, lon1, lat2, lon2) -> float:
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(a))


# ---------- Models
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role = "customer"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class MenuItemIn(BaseModel):
    name: str
    category: str
    price: float
    cost: float = 0.0
    description: Optional[str] = ""
    is_available: bool = True

class BillCreate(BaseModel):
    table_id: str
    customer_name: Optional[str] = ""
    customer_mobile: Optional[str] = ""
    notes: Optional[str] = ""

class AddItemsIn(BaseModel):
    items: List[dict]  # [{menu_item_id, quantity, notes}]

class EditItemIn(BaseModel):
    menu_item_id: Optional[str] = None
    quantity: Optional[int] = None
    notes: Optional[str] = None

class ChefStatusIn(BaseModel):
    chef_status: Literal["pending", "ready", "served", "cancelled"]

class PaymentIn(BaseModel):
    method: Literal["cash", "upi", "card"]
    amount: float

class TableIn(BaseModel):
    name: str
    seats: int = 4
    sort_order: Optional[int] = None


class StaffIn(BaseModel):
    name: str
    email: EmailStr
    password: Optional[str] = None  # required on create, optional on update
    role: Literal["captain", "chef", "cashier"]


class StaffUpdateIn(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[Literal["captain", "chef", "cashier"]] = None

class InventoryIn(BaseModel):
    name: str
    unit: str = "kg"
    quantity: float = 0
    low_threshold: float = 0
    category: Optional[str] = "general"
    note: Optional[str] = ""

class SettingsIn(BaseModel):
    cgst_rate: float
    sgst_rate: float
    restaurant_name: Optional[str] = "Spice Route"
    address: Optional[str] = ""
    phone: Optional[str] = ""
    gstin: Optional[str] = ""
    restaurant_lat: Optional[float] = 0
    restaurant_lng: Optional[float] = 0
    geofence_radius_m: Optional[int] = 200
    geofence_enabled: Optional[bool] = False
    ip_check_enabled: Optional[bool] = False
    allowed_ips: Optional[List[str]] = []

class GuardCheckIn(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None


# ---------- Auth
def extract_token(request: Request) -> Optional[str]:
    tok = request.cookies.get("access_token")
    if not tok:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            tok = h[7:]
    return tok

async def get_current_user(request: Request) -> dict:
    tok = extract_token(request)
    if not tok:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(tok, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    u = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(401, "User not found")
    # Back-compat: legacy "staff" → captain
    if u["role"] == "staff":
        u["role"] = "captain"
        await db.users.update_one({"id": u["id"]}, {"$set": {"role": "captain"}})
    return u

def require_roles(*roles: str):
    async def dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return dep


def set_auth_cookie(resp: Response, token: str):
    resp.set_cookie(key="access_token", value=token, httponly=True, secure=False,
                    samesite="lax", max_age=60*60*12, path="/")


@api.post("/auth/register")
async def register(body: RegisterIn, resp: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {"id": uid, "name": body.name, "email": email, "role": body.role,
           "password_hash": hash_password(body.password), "created_at": iso()}
    await db.users.insert_one(doc)
    tok = create_token(doc)
    set_auth_cookie(resp, tok)
    return {"user": public_user(doc), "token": tok}

@api.post("/auth/login")
async def login(body: LoginIn, resp: Response):
    email = body.email.lower()
    u = await db.users.find_one({"email": email})
    if not u or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    if u["role"] == "staff":
        u["role"] = "captain"
        await db.users.update_one({"id": u["id"]}, {"$set": {"role": "captain"}})
    tok = create_token(u)
    set_auth_cookie(resp, tok)
    return {"user": public_user(u), "token": tok}

@api.post("/auth/logout")
async def logout(resp: Response):
    resp.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ---------- Settings
async def settings_doc() -> dict:
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {"id": "global", "cgst_rate": 2.5, "sgst_rate": 2.5,
             "restaurant_name": "Spice Route", "address": "42 MG Road, Bengaluru",
             "phone": "+91 98765 43210", "gstin": "29ABCDE1234F1Z5",
             "restaurant_lat": 12.9716, "restaurant_lng": 77.5946,
             "geofence_radius_m": 200, "geofence_enabled": False,
             "ip_check_enabled": False, "allowed_ips": []}
        await db.settings.insert_one(s.copy())
    # Ensure new keys exist on old settings docs
    defaults = {"restaurant_lat": 12.9716, "restaurant_lng": 77.5946,
                "geofence_radius_m": 200, "geofence_enabled": False,
                "ip_check_enabled": False, "allowed_ips": []}
    updates = {k: v for k, v in defaults.items() if k not in s}
    if updates:
        await db.settings.update_one({"id": "global"}, {"$set": updates})
        s.update(updates)
    return s

@api.get("/settings")
async def get_settings():
    s = await settings_doc()
    # Expose departments for UI use
    s["departments"] = ALL_DEPARTMENTS
    s["category_to_department"] = CATEGORY_TO_DEPARTMENT
    return s

@api.put("/settings")
async def update_settings(body: SettingsIn, user: dict = Depends(require_roles("owner"))):
    await db.settings.update_one({"id": "global"}, {"$set": body.model_dump()}, upsert=True)
    return await get_settings()


# ---------- Menu
@api.get("/menu")
async def list_menu():
    items = await db.menu_items.find({}, {"_id": 0}).to_list(3000)
    for it in items:
        it["department"] = dept_for(it.get("category", ""))
    return items

@api.post("/menu")
async def create_menu(body: MenuItemIn, user: dict = Depends(require_roles("owner"))):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = iso()
    await db.menu_items.insert_one(doc.copy())
    doc.pop("_id", None)
    doc["department"] = dept_for(doc["category"])
    return doc

@api.put("/menu/{item_id}")
async def update_menu(item_id: str, body: MenuItemIn, user: dict = Depends(require_roles("owner"))):
    r = await db.menu_items.update_one({"id": item_id}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    m = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    m["department"] = dept_for(m["category"])
    return m

@api.delete("/menu/{item_id}")
async def delete_menu(item_id: str, user: dict = Depends(require_roles("owner"))):
    r = await db.menu_items.delete_one({"id": item_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- Tables
@api.get("/tables")
async def list_tables(user: dict = Depends(get_current_user)):
    tables = await db.tables.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    # Attach current open bill (if any)
    open_bills = await db.bills.find({"status": "open"}, {"_id": 0, "id": 1, "table_id": 1, "bill_number": 1, "total": 1, "captain_name": 1, "created_at": 1, "payment": 1}).to_list(500)
    by_table = {b["table_id"]: b for b in open_bills}
    for t in tables:
        b = by_table.get(t["id"])
        t["status"] = "occupied" if b else "available"
        t["open_bill"] = b
    return tables

@api.post("/tables")
async def create_table(body: TableIn, user: dict = Depends(require_roles("owner"))):
    d = {"id": str(uuid.uuid4()), "name": body.name, "seats": body.seats, "created_at": iso()}
    await db.tables.insert_one(d.copy())
    d.pop("_id", None)
    return d

@api.put("/tables/{tid}")
async def update_table(tid: str, body: TableIn, user: dict = Depends(require_roles("owner"))):
    r = await db.tables.update_one({"id": tid}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.tables.find_one({"id": tid}, {"_id": 0})

@api.delete("/tables/{tid}")
async def delete_table(tid: str, user: dict = Depends(require_roles("owner"))):
    # Don't delete if occupied
    open_b = await db.bills.find_one({"table_id": tid, "status": "open"})
    if open_b:
        raise HTTPException(400, "Table has an open bill")
    r = await db.tables.delete_one({"id": tid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- Inventory
@api.get("/inventory")
async def list_inventory(user: dict = Depends(require_roles("owner", "captain"))):
    return await db.inventory.find({}, {"_id": 0}).sort("name", 1).to_list(2000)

@api.post("/inventory")
async def create_inventory(body: InventoryIn, user: dict = Depends(require_roles("owner"))):
    d = {"id": str(uuid.uuid4()), **body.model_dump(), "created_at": iso(), "updated_at": iso()}
    await db.inventory.insert_one(d.copy())
    d.pop("_id", None)
    return d

@api.put("/inventory/{iid}")
async def update_inventory(iid: str, body: InventoryIn, user: dict = Depends(require_roles("owner"))):
    data = body.model_dump(); data["updated_at"] = iso()
    r = await db.inventory.update_one({"id": iid}, {"$set": data})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.inventory.find_one({"id": iid}, {"_id": 0})

@api.delete("/inventory/{iid}")
async def delete_inventory(iid: str, user: dict = Depends(require_roles("owner"))):
    r = await db.inventory.delete_one({"id": iid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- Staff (owner only)
@api.get("/staff")
async def list_staff(user: dict = Depends(require_roles("owner"))):
    users = await db.users.find({"role": {"$in": ["captain", "chef", "cashier"]}},
                                {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return users

@api.post("/staff")
async def create_staff(body: StaffIn, user: dict = Depends(require_roles("owner"))):
    if not body.password:
        raise HTTPException(400, "Password required")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    d = {"id": str(uuid.uuid4()), "name": body.name, "email": email, "role": body.role,
         "password_hash": hash_password(body.password), "created_at": iso()}
    await db.users.insert_one(d.copy())
    return {"id": d["id"], "name": d["name"], "email": d["email"], "role": d["role"], "created_at": d["created_at"]}

@api.put("/staff/{sid}")
async def update_staff(sid: str, body: StaffUpdateIn, user: dict = Depends(require_roles("owner"))):
    existing = await db.users.find_one({"id": sid})
    if not existing:
        raise HTTPException(404, "Not found")
    if existing["role"] == "owner":
        raise HTTPException(400, "Cannot modify owner accounts here")
    patch = {}
    if body.name is not None: patch["name"] = body.name
    if body.role is not None: patch["role"] = body.role
    if body.password: patch["password_hash"] = hash_password(body.password)
    if patch:
        await db.users.update_one({"id": sid}, {"$set": patch})
    u = await db.users.find_one({"id": sid}, {"_id": 0, "password_hash": 0})
    return u

@api.delete("/staff/{sid}")
async def delete_staff(sid: str, user: dict = Depends(require_roles("owner"))):
    existing = await db.users.find_one({"id": sid})
    if not existing:
        raise HTTPException(404, "Not found")
    if existing["role"] == "owner":
        raise HTTPException(400, "Cannot delete owner accounts")
    await db.users.delete_one({"id": sid})
    return {"ok": True}


# ---------- Cashier Close Day
@api.get("/cashier/totals")
async def cashier_totals(date: Optional[str] = None, user: dict = Depends(require_roles("cashier", "owner"))):
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start, end = f"{target}T00:00:00", f"{target}T23:59:59.999999+00:00"
    bills = await db.bills.find(
        {"created_at": {"$gte": start, "$lt": end}},
        {"_id": 0}).to_list(5000)
    paid = [b for b in bills if b.get("payment", {}).get("status") == "received"]
    pending = [b for b in bills if b.get("payment", {}).get("status") != "received" and b["status"] != "cancelled"]
    cancelled = [b for b in bills if b["status"] == "cancelled"]
    pay_split = {"cash": 0.0, "upi": 0.0, "card": 0.0}
    for b in paid:
        m = b.get("payment", {}).get("method")
        if m in pay_split:
            pay_split[m] = round(pay_split[m] + b["total"], 2)
    return {
        "date": target,
        "total_collected": round(sum(b["total"] for b in paid), 2),
        "pending_amount": round(sum(b["total"] for b in pending), 2),
        "payment_split": pay_split,
        "paid_count": len(paid),
        "pending_count": len(pending),
        "cancelled_count": len(cancelled),
    }

@api.post("/cashier/close-day")
async def close_day(date: Optional[str] = None, user: dict = Depends(require_roles("cashier", "owner"))):
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.day_closures.find_one({"date": target}, {"_id": 0})
    if existing:
        return existing
    totals = await cashier_totals(target, user)
    d = {"id": str(uuid.uuid4()), "date": target, **totals,
         "closed_at": iso(), "closed_by": user["name"]}
    d.pop("_id", None)
    await db.day_closures.insert_one(d.copy())
    d.pop("_id", None)
    return d


# ---------- Bills / Orders
async def next_bill_number() -> int:
    d = await db.counters.find_one_and_update({"id": "bills"}, {"$inc": {"value": 1}}, upsert=True, return_document=True)
    if not d: d = await db.counters.find_one({"id": "bills"})
    return int(d["value"])

def recompute_totals(bill: dict) -> dict:
    active = [i for i in bill["items"] if i.get("chef_status") != "cancelled"]
    subtotal = round(sum(i["price"] * i["quantity"] for i in active), 2)
    cgst = round(subtotal * bill["cgst_rate"] / 100, 2)
    sgst = round(subtotal * bill["sgst_rate"] / 100, 2)
    total = round(subtotal + cgst + sgst, 2)
    bill["subtotal"] = subtotal; bill["cgst"] = cgst; bill["sgst"] = sgst; bill["total"] = total
    return bill

async def fetch_bill(bill_id: str) -> dict:
    b = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Bill not found")
    return b

async def save_bill(bill: dict):
    bill["updated_at"] = iso()
    recompute_totals(bill)
    await db.bills.update_one({"id": bill["id"]}, {"$set": bill})


@api.post("/bills")
async def create_bill(body: BillCreate, user: dict = Depends(require_roles("captain", "owner"))):
    # Enforce: one open bill per table
    existing = await db.bills.find_one({"table_id": body.table_id, "status": "open"})
    if existing:
        existing.pop("_id", None)
        return existing
    table = await db.tables.find_one({"id": body.table_id}, {"_id": 0})
    if not table:
        raise HTTPException(404, "Table not found")
    s = await settings_doc()
    bill = {
        "id": str(uuid.uuid4()),
        "bill_number": await next_bill_number(),
        "table_id": body.table_id,
        "table_name": table["name"],
        "customer_name": body.customer_name or "",
        "customer_mobile": body.customer_mobile or "",
        "captain_id": user["id"],
        "captain_name": user["name"],
        "notes": body.notes or "",
        "status": "open",
        "items": [],
        "kot_batches": [],
        "cgst_rate": s["cgst_rate"],
        "sgst_rate": s["sgst_rate"],
        "subtotal": 0, "cgst": 0, "sgst": 0, "total": 0,
        "payment": {"status": "pending", "method": None, "amount_received": 0,
                    "received_at": None, "received_by": None, "received_by_name": None},
        "created_at": iso(), "updated_at": iso(),
    }
    await db.bills.insert_one(bill.copy())
    bill.pop("_id", None)
    return bill


@api.get("/bills")
async def list_bills(
    status: Optional[str] = None,
    date: Optional[str] = None,
    payment_status: Optional[str] = None,
    table_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q = {}
    if status: q["status"] = status
    if date: q["created_at"] = {"$gte": f"{date}T00:00:00", "$lt": f"{date}T23:59:59.999999+00:00"}
    if table_id: q["table_id"] = table_id
    if payment_status: q["payment.status"] = payment_status
    if user["role"] == "customer":
        q["captain_id"] = user["id"]
    return await db.bills.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)


@api.get("/bills/{bid}")
async def get_bill(bid: str, user: dict = Depends(get_current_user)):
    return await fetch_bill(bid)


@api.post("/bills/{bid}/items")
async def add_items(bid: str, body: AddItemsIn, user: dict = Depends(require_roles("captain", "owner"))):
    bill = await fetch_bill(bid)
    if bill["status"] != "open":
        raise HTTPException(400, "Bill is not open")
    if not body.items:
        raise HTTPException(400, "No items")
    for it in body.items:
        menu = await db.menu_items.find_one({"id": it["menu_item_id"]}, {"_id": 0})
        if not menu:
            raise HTTPException(404, f"Menu item not found: {it['menu_item_id']}")
        bill["items"].append({
            "id": str(uuid.uuid4()),
            "menu_item_id": menu["id"],
            "name": menu["name"],
            "price": float(menu["price"]),
            "category": menu["category"],
            "department": dept_for(menu["category"]),
            "quantity": int(it.get("quantity", 1)),
            "notes": it.get("notes", "") or "",
            "added_at": iso(),
            "kot_batch": None,
            "sent_to_kitchen": False,
            "chef_status": "pending",
        })
    await save_bill(bill)
    return bill


@api.put("/bills/{bid}/items/{item_id}")
async def edit_item(bid: str, item_id: str, body: EditItemIn, user: dict = Depends(require_roles("captain", "owner"))):
    bill = await fetch_bill(bid)
    if bill["status"] != "open":
        raise HTTPException(400, "Bill is not open")
    for idx, it in enumerate(bill["items"]):
        if it["id"] != item_id:
            continue
        # Items already marked ready/served can't be edited
        if it.get("sent_to_kitchen") and it.get("chef_status") != "pending":
            raise HTTPException(400, "Item already processed by chef")
        if body.quantity is not None:
            it["quantity"] = int(body.quantity)
        if body.notes is not None:
            it["notes"] = body.notes
        if body.menu_item_id and body.menu_item_id != it["menu_item_id"]:
            menu = await db.menu_items.find_one({"id": body.menu_item_id}, {"_id": 0})
            if not menu:
                raise HTTPException(404, "Menu item not found")
            it["menu_item_id"] = menu["id"]
            it["name"] = menu["name"]
            it["price"] = float(menu["price"])
            it["category"] = menu["category"]
            it["department"] = dept_for(menu["category"])
            # swap resets kitchen status
            it["sent_to_kitchen"] = False
            it["kot_batch"] = None
            it["chef_status"] = "pending"
        bill["items"][idx] = it
        await save_bill(bill)
        return bill
    raise HTTPException(404, "Item not found")


@api.delete("/bills/{bid}/items/{item_id}")
async def delete_item(bid: str, item_id: str, user: dict = Depends(require_roles("captain", "owner"))):
    bill = await fetch_bill(bid)
    target = next((i for i in bill["items"] if i["id"] == item_id), None)
    if not target:
        raise HTTPException(404, "Item not found")
    if target.get("sent_to_kitchen") and target.get("chef_status") == "ready":
        raise HTTPException(400, "Cannot remove item already marked ready")
    if not target.get("sent_to_kitchen"):
        bill["items"] = [i for i in bill["items"] if i["id"] != item_id]
    else:
        target["chef_status"] = "cancelled"
    await save_bill(bill)
    return bill


@api.post("/bills/{bid}/send-kot")
async def send_kot(bid: str, user: dict = Depends(require_roles("captain", "owner"))):
    """Take all pending items (not yet sent) and put them into a new KOT batch."""
    bill = await fetch_bill(bid)
    pending = [i for i in bill["items"] if not i.get("sent_to_kitchen")]
    if not pending:
        raise HTTPException(400, "No pending items to send")
    batch_number = len(bill["kot_batches"]) + 1
    now = iso()
    for it in bill["items"]:
        if not it.get("sent_to_kitchen"):
            it["sent_to_kitchen"] = True
            it["kot_batch"] = batch_number
            it["sent_at"] = now
    bill["kot_batches"].append({
        "number": batch_number, "sent_at": now,
        "sent_by": user["id"], "sent_by_name": user["name"],
        "item_ids": [i["id"] for i in pending],
    })
    await save_bill(bill)
    return bill


@api.put("/bills/{bid}/items/{item_id}/chef")
async def set_chef_status(bid: str, item_id: str, body: ChefStatusIn, user: dict = Depends(require_roles("chef", "captain", "owner"))):
    bill = await fetch_bill(bid)
    now = iso()
    for it in bill["items"]:
        if it["id"] == item_id:
            prev = it.get("chef_status")
            it["chef_status"] = body.chef_status
            it["chef_updated_at"] = now
            it["chef_updated_by"] = user["name"]
            # Track specific timeline timestamps
            if body.chef_status == "ready" and not it.get("ready_at"):
                it["ready_at"] = now
            if body.chef_status == "served" and not it.get("served_at"):
                it["served_at"] = now
                # ensure ready_at is also set
                if not it.get("ready_at"):
                    it["ready_at"] = now
            # received_at = when sent to kitchen (from batch sent_at)
            if it.get("sent_at") and not it.get("received_at"):
                it["received_at"] = it["sent_at"]
            await save_bill(bill)
            return bill
    raise HTTPException(404, "Item not found")


@api.post("/bills/{bid}/payment")
async def record_payment(bid: str, body: PaymentIn, user: dict = Depends(require_roles("cashier", "owner"))):
    bill = await fetch_bill(bid)
    bill["payment"] = {
        "status": "received", "method": body.method,
        "amount_received": round(float(body.amount), 2),
        "received_at": iso(),
        "received_by": user["id"], "received_by_name": user["name"],
    }
    bill["status"] = "closed"
    await save_bill(bill)
    return bill


@api.post("/bills/{bid}/cancel")
async def cancel_bill(bid: str, user: dict = Depends(require_roles("owner", "captain"))):
    bill = await fetch_bill(bid)
    bill["status"] = "cancelled"
    await save_bill(bill)
    return bill


# ---------- Geofence / Access Guard
@api.post("/guard/check")
async def guard_check(body: GuardCheckIn, request: Request, user: dict = Depends(get_current_user)):
    s = await settings_doc()
    # Exempt these roles from geofencing
    if user["role"] in ("owner", "customer"):
        return {"allowed": True, "ip_ok": True, "geo_ok": True, "reason": "exempt"}
    ip_ok = True
    if s.get("ip_check_enabled"):
        ip = client_ip(request)
        allowed = s.get("allowed_ips", []) or []
        ip_ok = False
        try:
            for cidr in allowed:
                cidr = cidr.strip()
                if not cidr: continue
                if "/" in cidr:
                    if ipaddress.ip_address(ip) in ipaddress.ip_network(cidr, strict=False):
                        ip_ok = True; break
                else:
                    if ip == cidr:
                        ip_ok = True; break
        except Exception:
            ip_ok = False
    geo_ok = True
    if s.get("geofence_enabled"):
        if body.lat is None or body.lng is None:
            geo_ok = False
        else:
            d = haversine_m(s["restaurant_lat"], s["restaurant_lng"], body.lat, body.lng)
            geo_ok = d <= float(s.get("geofence_radius_m", 200))
    allowed = ip_ok and geo_ok
    reason = "ok"
    if not ip_ok: reason = "IP not allowed"
    elif not geo_ok: reason = "Out of premises"
    return {"allowed": allowed, "ip_ok": ip_ok, "geo_ok": geo_ok, "reason": reason,
            "ip": client_ip(request)}


# ---------- Expenses (same as before)
class ExpenseIn(BaseModel):
    title: str
    amount: float
    category: Optional[str] = "general"
    date: Optional[str] = None

@api.post("/expenses")
async def create_expense(body: ExpenseIn, user: dict = Depends(require_roles("owner"))):
    date = body.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    d = {"id": str(uuid.uuid4()), "title": body.title, "amount": float(body.amount),
         "category": body.category or "general", "date": date, "created_at": iso()}
    await db.expenses.insert_one(d.copy())
    d.pop("_id", None)
    return d

@api.get("/expenses")
async def list_expenses(date: Optional[str] = None, user: dict = Depends(require_roles("owner"))):
    q = {"date": date} if date else {}
    return await db.expenses.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)

@api.delete("/expenses/{eid}")
async def del_expense(eid: str, user: dict = Depends(require_roles("owner"))):
    r = await db.expenses.delete_one({"id": eid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- Analytics & CSV
@api.get("/analytics/summary")
async def analytics_summary(date: Optional[str] = None, user: dict = Depends(require_roles("owner"))):
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start, end = f"{target}T00:00:00", f"{target}T23:59:59.999999+00:00"
    bills = await db.bills.find(
        {"created_at": {"$gte": start, "$lt": end}, "status": {"$ne": "cancelled"}},
        {"_id": 0}).to_list(5000)
    paid = [b for b in bills if b.get("payment", {}).get("status") == "received"]
    revenue = round(sum(b["total"] for b in paid), 2)
    cost_of_goods = 0.0
    category_sales = {}
    payment_split = {"cash": 0.0, "upi": 0.0, "card": 0.0}
    for b in paid:
        m = b.get("payment", {}).get("method")
        if m in payment_split:
            payment_split[m] = round(payment_split[m] + b["total"], 2)
        for it in b["items"]:
            if it.get("chef_status") == "cancelled": continue
            menu = await db.menu_items.find_one({"id": it["menu_item_id"]}, {"_id": 0})
            cost_of_goods += (menu["cost"] if menu else 0) * it["quantity"]
            cat = it.get("category", "other")
            category_sales[cat] = round(category_sales.get(cat, 0) + it["price"] * it["quantity"], 2)
    cost_of_goods = round(cost_of_goods, 2)
    expenses = await db.expenses.find({"date": target}, {"_id": 0}).to_list(2000)
    spent = round(sum(e["amount"] for e in expenses), 2)
    total_cost = round(cost_of_goods + spent, 2)
    profit = round(revenue - total_cost, 2)
    loss = round(-profit, 2) if profit < 0 else 0.0
    net_profit = max(profit, 0.0)
    pending_bills = [b for b in bills if b.get("payment", {}).get("status") != "received"]
    pending_amount = round(sum(b["total"] for b in pending_bills), 2)
    return {
        "date": target,
        "orders_count": len(paid),
        "open_bills": len(pending_bills),
        "pending_amount": pending_amount,
        "revenue": revenue, "cost_of_goods": cost_of_goods, "spent": spent,
        "total_cost": total_cost, "profit": net_profit, "loss": loss,
        "category_sales": category_sales,
        "payment_split": payment_split,
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
    bills = await db.bills.find({"created_at": {"$gte": start, "$lt": end}}, {"_id": 0}).sort("created_at", 1).to_list(10000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Bill#", "Created At", "Captain", "Table", "Customer", "Status",
                "Payment", "Method", "Items", "Subtotal", "CGST", "SGST", "Total"])
    for b in bills:
        items_str = "; ".join([f"{i['quantity']}x {i['name']}" for i in b["items"] if i.get("chef_status") != "cancelled"])
        p = b.get("payment", {}) or {}
        w.writerow([
            b["bill_number"], b["created_at"], b.get("captain_name", ""),
            b.get("table_name", ""), b.get("customer_name", ""), b["status"],
            p.get("status", "pending"), p.get("method") or "",
            items_str, b["subtotal"], b["cgst"], b["sgst"], b["total"],
        ])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                            headers={"Content-Disposition": f'attachment; filename="bills_{target}.csv"'})


# ---------- Seeding
SAMPLE_MENU = [
    ("Paneer Butter Masala", "Main Course", 240, 110, "Creamy tomato gravy with paneer cubes"),
    ("Dal Makhani", "Main Course", 210, 80, "Slow-cooked black lentils in butter & cream"),
    ("Palak Paneer", "Main Course", 230, 100, "Paneer in a smooth spinach gravy"),
    ("Veg Hakka Noodles", "Chinese", 180, 70, "Stir-fried noodles with veggies"),
    ("Chilli Chicken Dry", "Chinese", 260, 120, "Indo-Chinese spicy chicken starter"),
    ("Manchurian Gravy", "Chinese", 200, 80, "Veg balls in tangy Manchurian sauce"),
    ("Hyderabadi Chicken Biryani", "Biryanis", 320, 150, "Dum-cooked aromatic chicken biryani"),
    ("Veg Dum Biryani", "Biryanis", 260, 100, "Fragrant mixed veggies & basmati"),
    ("Mutton Biryani", "Biryanis", 420, 200, "Slow-cooked mutton with saffron rice"),
    ("Butter Naan", "Roti", 50, 15, "Tandoor-baked naan brushed with butter"),
    ("Tandoori Roti", "Roti", 25, 8, "Whole-wheat roti from the tandoor"),
    ("Lachha Paratha", "Roti", 60, 20, "Flaky layered paratha"),
    ("Garlic Naan", "Roti", 70, 20, "Naan topped with fresh garlic & butter"),
    ("Schezwan Fried Rice", "Fried Rice", 200, 70, "Spicy schezwan tossed rice"),
    ("Veg Fried Rice", "Fried Rice", 180, 60, "Classic fried rice with veggies"),
    ("Egg Fried Rice", "Fried Rice", 200, 75, "Wok-tossed egg fried rice"),
    ("Chicken Mandi", "Mandi", 380, 180, "Yemeni-style aromatic chicken & rice"),
    ("Mutton Mandi", "Mandi", 520, 260, "Slow-smoked mutton with mandi rice"),
    ("Gulab Jamun (2 pc)", "Sweets", 80, 25, "Warm milk dumplings in rose syrup"),
    ("Rasmalai (2 pc)", "Sweets", 120, 40, "Chilled cottage cheese in saffron milk"),
    ("Gajar Halwa", "Sweets", 140, 50, "Carrot halwa with ghee & dry fruits"),
    ("Mutton Rogan Josh", "Mutton", 440, 210, "Kashmiri-style slow-cooked mutton"),
    ("Mutton Keema", "Mutton", 360, 170, "Spiced minced mutton"),
    ("Mutton Korma", "Mutton", 460, 220, "Rich, nutty mutton korma"),
    # Beverages
    ("Masala Chai", "Beverages", 30, 8, "Strong spiced Indian tea"),
    ("Cold Coffee", "Beverages", 120, 40, "Chilled frothy cold coffee"),
    ("Mango Lassi", "Beverages", 110, 35, "Sweet yogurt-mango drink"),
    ("Strawberry Milkshake", "Beverages", 140, 50, "Creamy strawberry milkshake"),
    ("Vanilla Icecream Scoop", "Beverages", 90, 30, "Classic vanilla ice cream scoop"),
    ("Fresh Lime Soda", "Beverages", 60, 15, "Sweet & salt lime soda"),
]

SAMPLE_INVENTORY = [
    ("Chicken", "kg", 10, 2, "meat"),
    ("Mutton", "kg", 6, 2, "meat"),
    ("Basmati Rice", "kg", 40, 10, "grains"),
    ("Paneer", "kg", 5, 1, "dairy"),
    ("Onion", "kg", 25, 5, "vegetables"),
    ("Tomato", "kg", 20, 5, "vegetables"),
    ("Ghee", "kg", 3, 1, "dairy"),
    ("Milk", "ltr", 15, 5, "dairy"),
    ("Cooking Oil", "ltr", 20, 5, "oils"),
    ("Wheat Flour (Maida)", "kg", 15, 5, "grains"),
]


async def seed_startup():
    await db.users.create_index("email", unique=True)
    await db.menu_items.create_index("id", unique=True)
    await db.bills.create_index("id", unique=True)
    await db.bills.create_index("created_at")
    await db.bills.create_index("status")
    await db.tables.create_index("id", unique=True)
    await db.inventory.create_index("id", unique=True)

    # Seed users
    seed_users = [
        (os.environ.get("ADMIN_EMAIL", "owner@spice.com"), "Spice Owner", "owner", os.environ.get("ADMIN_PASSWORD", "owner123")),
        ("captain@spice.com", "Ravi Captain", "captain", "captain123"),
        ("chef@spice.com", "Aarti Chef", "chef", "chef123"),
        ("cashier@spice.com", "Nila Cashier", "cashier", "cashier123"),
        ("guest@spice.com", "Aarav Guest", "customer", "guest123"),
        # Keep old staff login working by re-mapping it
        ("staff@spice.com", "Ravi Staff (legacy)", "captain", "staff123"),
    ]
    for email, name, role, pw in seed_users:
        email = email.lower()
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({"id": str(uuid.uuid4()), "name": name, "email": email,
                                       "role": role, "password_hash": hash_password(pw), "created_at": iso()})
        elif existing.get("role") == "staff":
            await db.users.update_one({"email": email}, {"$set": {"role": "captain"}})

    # Seed menu (idempotent per name)
    for name, cat, price, cost, desc in SAMPLE_MENU:
        if not await db.menu_items.find_one({"name": name}):
            await db.menu_items.insert_one({"id": str(uuid.uuid4()), "name": name, "category": cat,
                                            "price": float(price), "cost": float(cost),
                                            "description": desc, "is_available": True, "created_at": iso()})

    # Seed tables: ensure T1..T16 exist with sort_order
    existing_names = {t["name"] for t in await db.tables.find({}, {"name": 1, "_id": 0}).to_list(500)}
    for i in range(1, 17):
        nm = f"T{i}"
        if nm not in existing_names:
            await db.tables.insert_one({"id": str(uuid.uuid4()), "name": nm, "seats": 4,
                                        "sort_order": i, "created_at": iso()})
    # Backfill sort_order on tables missing it
    async for t in db.tables.find({"sort_order": {"$exists": False}}, {"_id": 0}):
        try:
            n = int(t["name"].lstrip("T"))
        except Exception:
            n = 99
        await db.tables.update_one({"id": t["id"]}, {"$set": {"sort_order": n}})

    # Seed inventory if empty
    if await db.inventory.count_documents({}) == 0:
        for name, unit, qty, low, cat in SAMPLE_INVENTORY:
            await db.inventory.insert_one({
                "id": str(uuid.uuid4()), "name": name, "unit": unit,
                "quantity": float(qty), "low_threshold": float(low),
                "category": cat, "note": "", "created_at": iso(), "updated_at": iso(),
            })

    await settings_doc()


@app.on_event("startup")
async def on_startup():
    try:
        await seed_startup()
        logger.info("Seeding completed.")
    except Exception as e:
        logger.exception("Seed error: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


@api.get("/")
async def root():
    return {"service": "Spice POS API v2", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)
