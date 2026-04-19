from fastapi import APIRouter

from . import (
    auth,
    settings as settings_routes,
    menu,
    tables,
    inventory,
    staff,
    cashier,
    bills,
    guard,
    expenses,
    analytics,
)

api_router = APIRouter(prefix="/api")

@api_router.get("/")
async def api_root():
    return {"service": "Spice POS API v2", "status": "ok"}

for module in (
    auth,
    settings_routes,
    menu,
    tables,
    inventory,
    staff,
    cashier,
    bills,
    guard,
    expenses,
    analytics,
):
    api_router.include_router(module.router)
