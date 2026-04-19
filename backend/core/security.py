from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response

from .config import JWT_ALGORITHM, JWT_EXPIRE_HOURS, JWT_SECRET
from .db import db


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def create_token(user: dict) -> str:
    payload = {
        "sub": user["id"], "email": user["email"], "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def public_user(u: dict) -> dict:
    return {"id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"], "created_at": u["created_at"]}


def set_auth_cookie(resp: Response, token: str) -> None:
    resp.set_cookie(
        key="access_token", value=token, httponly=True, secure=False,
        samesite="lax", max_age=60 * 60 * JWT_EXPIRE_HOURS, path="/",
    )


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
