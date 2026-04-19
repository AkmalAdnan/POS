import uuid

from fastapi import APIRouter, Depends, HTTPException, Response

from core.db import db
from core.security import (
    create_token, get_current_user, hash_password, public_user,
    set_auth_cookie, verify_password,
)
from core.utils import iso
from models.schemas import LoginIn, RegisterIn

router = APIRouter()


@router.post("/auth/register")
async def register(body: RegisterIn, resp: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "name": body.name, "email": email, "role": body.role,
        "password_hash": hash_password(body.password), "created_at": iso(),
    }
    await db.users.insert_one(doc)
    tok = create_token(doc)
    set_auth_cookie(resp, tok)
    return {"user": public_user(doc), "token": tok}


@router.post("/auth/login")
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


@router.post("/auth/logout")
async def logout(resp: Response):
    resp.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)
