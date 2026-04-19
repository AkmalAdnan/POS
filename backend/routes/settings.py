from fastapi import APIRouter, Depends

from core.config import ALL_DEPARTMENTS, CATEGORY_TO_DEPARTMENT
from core.db import db
from core.security import require_roles
from models.schemas import SettingsIn

router = APIRouter()


async def settings_doc() -> dict:
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {
            "id": "global", "cgst_rate": 2.5, "sgst_rate": 2.5,
            "restaurant_name": "Spice Route", "address": "42 MG Road, Bengaluru",
            "phone": "+91 98765 43210", "gstin": "29ABCDE1234F1Z5",
            "restaurant_lat": 12.9716, "restaurant_lng": 77.5946,
            "geofence_radius_m": 200, "geofence_enabled": False,
            "ip_check_enabled": False, "allowed_ips": [],
        }
        await db.settings.insert_one(s.copy())
    defaults = {
        "restaurant_lat": 12.9716, "restaurant_lng": 77.5946,
        "geofence_radius_m": 200, "geofence_enabled": False,
        "ip_check_enabled": False, "allowed_ips": [],
    }
    updates = {k: v for k, v in defaults.items() if k not in s}
    if updates:
        await db.settings.update_one({"id": "global"}, {"$set": updates})
        s.update(updates)
    return s


@router.get("/settings")
async def get_settings():
    s = await settings_doc()
    s["departments"] = ALL_DEPARTMENTS
    s["category_to_department"] = CATEGORY_TO_DEPARTMENT
    return s


@router.put("/settings")
async def update_settings(body: SettingsIn, user: dict = Depends(require_roles("owner"))):
    await db.settings.update_one({"id": "global"}, {"$set": body.model_dump()}, upsert=True)
    return await get_settings()
