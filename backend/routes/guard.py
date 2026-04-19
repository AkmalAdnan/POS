import ipaddress

from fastapi import APIRouter, Depends, Request

from core.security import get_current_user
from core.utils import client_ip, haversine_m
from models.schemas import GuardCheckIn
from routes.settings import settings_doc

router = APIRouter()


@router.post("/guard/check")
async def guard_check(body: GuardCheckIn, request: Request, user: dict = Depends(get_current_user)):
    s = await settings_doc()
    if user["role"] in ("owner", "customer"):
        return {"allowed": True, "ip_ok": True, "geo_ok": True, "reason": "exempt"}
    ip_ok = True
    if s.get("ip_check_enabled"):
        ip = client_ip(request)
        allowed = s.get("allowed_ips", []) or []
        ip_ok = False
        try:
            for cidr in allowed:
                cidr = cidr.strip()
                if not cidr: continue
                if "/" in cidr:
                    if ipaddress.ip_address(ip) in ipaddress.ip_network(cidr, strict=False):
                        ip_ok = True; break
                else:
                    if ip == cidr:
                        ip_ok = True; break
        except Exception:
            ip_ok = False
    geo_ok = True
    if s.get("geofence_enabled"):
        if body.lat is None or body.lng is None:
            geo_ok = False
        else:
            d = haversine_m(s["restaurant_lat"], s["restaurant_lng"], body.lat, body.lng)
            geo_ok = d <= float(s.get("geofence_radius_m", 200))
    allowed_flag = ip_ok and geo_ok
    reason = "ok"
    if not ip_ok: reason = "IP not allowed"
    elif not geo_ok: reason = "Out of premises"
    return {
        "allowed": allowed_flag, "ip_ok": ip_ok, "geo_ok": geo_ok,
        "reason": reason, "ip": client_ip(request),
    }
