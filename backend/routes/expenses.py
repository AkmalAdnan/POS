import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.security import require_roles
from core.utils import iso
from models.schemas import ExpenseIn

router = APIRouter()


@router.post("/expenses")
async def create_expense(body: ExpenseIn, user: dict = Depends(require_roles("owner"))):
    date = body.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    d = {
        "id": str(uuid.uuid4()), "title": body.title, "amount": float(body.amount),
        "category": body.category or "general", "date": date, "created_at": iso(),
    }
    await db.expenses.insert_one(d.copy())
    d.pop("_id", None)
    return d


@router.get("/expenses")
async def list_expenses(date: Optional[str] = None, user: dict = Depends(require_roles("owner"))):
    q = {"date": date} if date else {}
    return await db.expenses.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.delete("/expenses/{eid}")
async def del_expense(eid: str, user: dict = Depends(require_roles("owner"))):
    r = await db.expenses.delete_one({"id": eid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}
