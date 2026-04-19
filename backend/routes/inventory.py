import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.security import require_roles
from core.utils import iso
from models.schemas import InventoryIn

router = APIRouter()


@router.get("/inventory")
async def list_inventory(user: dict = Depends(require_roles("owner", "captain"))):
    return await db.inventory.find({}, {"_id": 0}).sort("name", 1).to_list(2000)


@router.post("/inventory")
async def create_inventory(body: InventoryIn, user: dict = Depends(require_roles("owner"))):
    d = {"id": str(uuid.uuid4()), **body.model_dump(), "created_at": iso(), "updated_at": iso()}
    await db.inventory.insert_one(d.copy())
    d.pop("_id", None)
    return d


@router.put("/inventory/{iid}")
async def update_inventory(iid: str, body: InventoryIn, user: dict = Depends(require_roles("owner"))):
    data = body.model_dump()
    data["updated_at"] = iso()
    r = await db.inventory.update_one({"id": iid}, {"$set": data})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.inventory.find_one({"id": iid}, {"_id": 0})


@router.delete("/inventory/{iid}")
async def delete_inventory(iid: str, user: dict = Depends(require_roles("owner"))):
    r = await db.inventory.delete_one({"id": iid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}
