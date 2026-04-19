import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.security import hash_password, require_roles
from core.utils import iso
from models.schemas import StaffIn, StaffUpdateIn

router = APIRouter()


@router.get("/staff")
async def list_staff(user: dict = Depends(require_roles("owner"))):
    return await db.users.find(
        {"role": {"$in": ["captain", "chef", "cashier"]}},
        {"_id": 0, "password_hash": 0},
    ).sort("created_at", -1).to_list(500)


@router.post("/staff")
async def create_staff(body: StaffIn, user: dict = Depends(require_roles("owner"))):
    if not body.password:
        raise HTTPException(400, "Password required")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    d = {
        "id": str(uuid.uuid4()), "name": body.name, "email": email, "role": body.role,
        "password_hash": hash_password(body.password), "created_at": iso(),
    }
    await db.users.insert_one(d.copy())
    return {"id": d["id"], "name": d["name"], "email": d["email"], "role": d["role"], "created_at": d["created_at"]}


@router.put("/staff/{sid}")
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
    return await db.users.find_one({"id": sid}, {"_id": 0, "password_hash": 0})


@router.delete("/staff/{sid}")
async def delete_staff(sid: str, user: dict = Depends(require_roles("owner"))):
    existing = await db.users.find_one({"id": sid})
    if not existing:
        raise HTTPException(404, "Not found")
    if existing["role"] == "owner":
        raise HTTPException(400, "Cannot delete owner accounts")
    await db.users.delete_one({"id": sid})
    return {"ok": True}
