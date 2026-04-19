import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.security import get_current_user, require_roles
from core.utils import iso
from models.schemas import TableIn

router = APIRouter()


@router.get("/tables")
async def list_tables(user: dict = Depends(get_current_user)):
    tables = await db.tables.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    open_bills = await db.bills.find(
        {"status": "open"},
        {"_id": 0, "id": 1, "table_id": 1, "bill_number": 1, "total": 1,
         "captain_name": 1, "created_at": 1, "payment": 1},
    ).to_list(500)
    by_table = {b["table_id"]: b for b in open_bills if b.get("table_id")}
    for t in tables:
        b = by_table.get(t["id"])
        t["status"] = "occupied" if b else "available"
        t["open_bill"] = b
    return tables


@router.post("/tables")
async def create_table(body: TableIn, user: dict = Depends(require_roles("owner"))):
    d = {"id": str(uuid.uuid4()), "name": body.name, "seats": body.seats, "created_at": iso()}
    await db.tables.insert_one(d.copy())
    d.pop("_id", None)
    return d


@router.put("/tables/{tid}")
async def update_table(tid: str, body: TableIn, user: dict = Depends(require_roles("owner"))):
    r = await db.tables.update_one({"id": tid}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.tables.find_one({"id": tid}, {"_id": 0})


@router.delete("/tables/{tid}")
async def delete_table(tid: str, user: dict = Depends(require_roles("owner"))):
    open_b = await db.bills.find_one({"table_id": tid, "status": "open"})
    if open_b:
        raise HTTPException(400, "Table has an open bill")
    r = await db.tables.delete_one({"id": tid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}
