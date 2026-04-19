import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.config import dept_for
from core.db import db
from core.security import require_roles
from core.utils import iso
from models.schemas import MenuItemIn

router = APIRouter()


@router.get("/menu")
async def list_menu():
    items = await db.menu_items.find({}, {"_id": 0}).to_list(3000)
    for it in items:
        it["department"] = dept_for(it.get("category", ""))
    return items


@router.post("/menu")
async def create_menu(body: MenuItemIn, user: dict = Depends(require_roles("owner"))):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = iso()
    await db.menu_items.insert_one(doc.copy())
    doc.pop("_id", None)
    doc["department"] = dept_for(doc["category"])
    return doc


@router.put("/menu/{item_id}")
async def update_menu(item_id: str, body: MenuItemIn, user: dict = Depends(require_roles("owner"))):
    r = await db.menu_items.update_one({"id": item_id}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    m = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    m["department"] = dept_for(m["category"])
    return m


@router.delete("/menu/{item_id}")
async def delete_menu(item_id: str, user: dict = Depends(require_roles("owner"))):
    r = await db.menu_items.delete_one({"id": item_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}
