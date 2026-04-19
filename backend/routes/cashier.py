import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends

from core.db import db
from core.security import require_roles
from core.utils import iso

router = APIRouter()


async def _totals(target: str) -> dict:
    start, end = f"{target}T00:00:00", f"{target}T23:59:59.999999+00:00"
    bills = await db.bills.find(
        {"created_at": {"$gte": start, "$lt": end}},
        {"_id": 0},
    ).to_list(5000)
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


@router.get("/cashier/totals")
async def cashier_totals(
    date: Optional[str] = None,
    user: dict = Depends(require_roles("cashier", "owner")),
):
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return await _totals(target)


@router.post("/cashier/close-day")
async def close_day(
    date: Optional[str] = None,
    user: dict = Depends(require_roles("cashier", "owner")),
):
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.day_closures.find_one({"date": target}, {"_id": 0})
    if existing:
        return existing
    totals = await _totals(target)
    d = {
        "id": str(uuid.uuid4()), "date": target, **totals,
        "closed_at": iso(), "closed_by": user["name"],
    }
    await db.day_closures.insert_one(d.copy())
    d.pop("_id", None)
    return d
