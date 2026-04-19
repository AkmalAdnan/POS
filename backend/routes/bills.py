import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.config import dept_for
from core.db import db
from core.security import get_current_user, require_roles
from core.utils import iso
from models.schemas import (
    AddItemsIn, BillCreate, ChefStatusIn, EditItemIn, PaymentIn,
)
from routes.settings import settings_doc

router = APIRouter()


async def next_bill_number() -> int:
    d = await db.counters.find_one_and_update(
        {"id": "bills"}, {"$inc": {"value": 1}}, upsert=True, return_document=True,
    )
    if not d:
        d = await db.counters.find_one({"id": "bills"})
    return int(d["value"])


def recompute_totals(bill: dict) -> dict:
    active = [i for i in bill["items"] if i.get("chef_status") != "cancelled"]
    subtotal = round(sum(i["price"] * i["quantity"] for i in active), 2)
    cgst = round(subtotal * bill["cgst_rate"] / 100, 2)
    sgst = round(subtotal * bill["sgst_rate"] / 100, 2)
    total = round(subtotal + cgst + sgst, 2)
    bill["subtotal"], bill["cgst"], bill["sgst"], bill["total"] = subtotal, cgst, sgst, total
    return bill


async def fetch_bill(bill_id: str) -> dict:
    b = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Bill not found")
    return b


async def save_bill(bill: dict) -> None:
    bill["updated_at"] = iso()
    recompute_totals(bill)
    await db.bills.update_one({"id": bill["id"]}, {"$set": bill})


@router.post("/bills")
async def create_bill(body: BillCreate, user: dict = Depends(require_roles("captain", "cashier", "owner"))):
    is_takeaway = body.order_type == "takeaway"
    if not is_takeaway:
        if not body.table_id:
            raise HTTPException(400, "Table required for dine-in")
        existing = await db.bills.find_one({"table_id": body.table_id, "status": "open"})
        if existing:
            existing.pop("_id", None)
            return existing
        table = await db.tables.find_one({"id": body.table_id}, {"_id": 0})
        if not table:
            raise HTTPException(404, "Table not found")
        table_name = table["name"]
        table_id = body.table_id
    else:
        table_name = "TAKEAWAY"
        table_id = None
    s = await settings_doc()
    bill = {
        "id": str(uuid.uuid4()),
        "bill_number": await next_bill_number(),
        "table_id": table_id,
        "table_name": table_name,
        "order_type": body.order_type,
        "customer_name": body.customer_name or "",
        "customer_mobile": body.customer_mobile or "",
        "captain_id": user["id"],
        "captain_name": user["name"],
        "captain_role": user["role"],
        "notes": body.notes or "",
        "status": "open",
        "items": [],
        "kot_batches": [],
        "cgst_rate": s["cgst_rate"],
        "sgst_rate": s["sgst_rate"],
        "subtotal": 0, "cgst": 0, "sgst": 0, "total": 0,
        "payment": {"status": "pending", "method": None, "amount_received": 0,
                    "received_at": None, "received_by": None, "received_by_name": None,
                    "received_by_role": None},
        "created_at": iso(), "updated_at": iso(),
    }
    await db.bills.insert_one(bill.copy())
    bill.pop("_id", None)
    return bill


@router.get("/bills")
async def list_bills(
    status: Optional[str] = None,
    date: Optional[str] = None,
    payment_status: Optional[str] = None,
    table_id: Optional[str] = None,
    order_type: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {}
    if status: q["status"] = status
    if date: q["created_at"] = {"$gte": f"{date}T00:00:00", "$lt": f"{date}T23:59:59.999999+00:00"}
    if table_id: q["table_id"] = table_id
    if payment_status: q["payment.status"] = payment_status
    if order_type: q["order_type"] = order_type
    if user["role"] == "customer":
        q["captain_id"] = user["id"]
    return await db.bills.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)


@router.get("/bills/{bid}")
async def get_bill(bid: str, user: dict = Depends(get_current_user)):
    return await fetch_bill(bid)


@router.post("/bills/{bid}/items")
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


@router.put("/bills/{bid}/items/{item_id}")
async def edit_item(bid: str, item_id: str, body: EditItemIn, user: dict = Depends(require_roles("captain", "owner"))):
    bill = await fetch_bill(bid)
    if bill["status"] != "open":
        raise HTTPException(400, "Bill is not open")
    for idx, it in enumerate(bill["items"]):
        if it["id"] != item_id:
            continue
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
            it["sent_to_kitchen"] = False
            it["kot_batch"] = None
            it["chef_status"] = "pending"
        bill["items"][idx] = it
        await save_bill(bill)
        return bill
    raise HTTPException(404, "Item not found")


@router.delete("/bills/{bid}/items/{item_id}")
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


@router.post("/bills/{bid}/send-kot")
async def send_kot(bid: str, user: dict = Depends(require_roles("captain", "owner"))):
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


@router.put("/bills/{bid}/items/{item_id}/chef")
async def set_chef_status(
    bid: str, item_id: str, body: ChefStatusIn,
    user: dict = Depends(require_roles("chef", "captain", "owner")),
):
    bill = await fetch_bill(bid)
    now = iso()
    for it in bill["items"]:
        if it["id"] == item_id:
            it["chef_status"] = body.chef_status
            it["chef_updated_at"] = now
            it["chef_updated_by"] = user["name"]
            if body.chef_status == "ready" and not it.get("ready_at"):
                it["ready_at"] = now
            if body.chef_status == "served" and not it.get("served_at"):
                it["served_at"] = now
                if not it.get("ready_at"):
                    it["ready_at"] = now
            if it.get("sent_at") and not it.get("received_at"):
                it["received_at"] = it["sent_at"]
            await save_bill(bill)
            return bill
    raise HTTPException(404, "Item not found")


@router.post("/bills/{bid}/payment")
async def record_payment(
    bid: str, body: PaymentIn,
    user: dict = Depends(require_roles("cashier", "owner", "captain")),
):
    bill = await fetch_bill(bid)
    bill["payment"] = {
        "status": "received", "method": body.method,
        "amount_received": round(float(body.amount), 2),
        "received_at": iso(),
        "received_by": user["id"], "received_by_name": user["name"],
        "received_by_role": user["role"],
    }
    bill["status"] = "closed"
    await save_bill(bill)
    return bill


@router.post("/bills/{bid}/cancel")
async def cancel_bill(bid: str, user: dict = Depends(require_roles("owner", "captain"))):
    bill = await fetch_bill(bid)
    bill["status"] = "cancelled"
    await save_bill(bill)
    return bill
