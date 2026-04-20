import csv
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from core.db import db
from core.security import require_roles

router = APIRouter()


@router.get("/analytics/summary")
async def analytics_summary(
    date: Optional[str] = None,
    user: dict = Depends(require_roles("owner")),
):
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start, end = f"{target}T00:00:00", f"{target}T23:59:59.999999+00:00"
    bills = await db.bills.find(
        {"created_at": {"$gte": start, "$lt": end}, "status": {"$ne": "cancelled"}},
        {"_id": 0},
    ).to_list(5000)
    paid = [b for b in bills if b.get("payment", {}).get("status") == "received"]
    revenue = round(sum(b["total"] for b in paid), 2)
    cost_of_goods = 0.0
    category_sales: dict = {}
    payment_split = {"cash": 0.0, "upi": 0.0, "card": 0.0}
    for b in paid:
        p = b.get("payment", {}) or {}
        m = p.get("method")
        if m == "split":
            sp = p.get("split", {}) or {}
            payment_split["cash"] = round(payment_split["cash"] + float(sp.get("cash_amount", 0)), 2)
            dm = sp.get("digital_method")
            if dm in payment_split:
                payment_split[dm] = round(payment_split[dm] + float(sp.get("digital_amount", 0)), 2)
        elif m in payment_split:
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


@router.get("/analytics/export")
async def export_csv(
    date: Optional[str] = None,
    user: dict = Depends(require_roles("owner", "cashier")),
):
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start, end = f"{target}T00:00:00", f"{target}T23:59:59.999999+00:00"
    bills = await db.bills.find(
        {"created_at": {"$gte": start, "$lt": end}}, {"_id": 0},
    ).sort("created_at", 1).to_list(10000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "Bill#", "Created At", "Captain", "Table", "Customer", "Mobile", "Status",
        "Payment", "Method", "Cash Part", "Digital Part", "Digital Method",
        "Collected By", "Collected By Role", "Collected At",
        "Items", "Subtotal", "CGST", "SGST", "Total",
    ])
    for b in bills:
        items_str = "; ".join([f"{i['quantity']}x {i['name']}" for i in b["items"] if i.get("chef_status") != "cancelled"])
        p = b.get("payment", {}) or {}
        sp = p.get("split", {}) or {}
        w.writerow([
            b["bill_number"], b["created_at"], b.get("captain_name", ""),
            b.get("table_name", ""), b.get("customer_name", ""), b.get("customer_mobile", ""),
            b["status"], p.get("status", "pending"), p.get("method") or "",
            sp.get("cash_amount", "") if p.get("method") == "split" else "",
            sp.get("digital_amount", "") if p.get("method") == "split" else "",
            sp.get("digital_method", "") if p.get("method") == "split" else "",
            p.get("received_by_name") or "", p.get("received_by_role") or "",
            p.get("received_at") or "",
            items_str, b["subtotal"], b["cgst"], b["sgst"], b["total"],
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="bills_{target}.csv"'},
    )
