from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr

from core.config import Role


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role = "customer"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class MenuItemIn(BaseModel):
    name: str
    category: str
    price: float
    cost: float = 0.0
    description: Optional[str] = ""
    is_available: bool = True


class BillCreate(BaseModel):
    table_id: Optional[str] = None
    customer_name: Optional[str] = ""
    customer_mobile: Optional[str] = ""
    notes: Optional[str] = ""
    order_type: Literal["dine_in", "takeaway"] = "dine_in"


class AddItemsIn(BaseModel):
    items: List[dict]  # [{menu_item_id, quantity, notes}]


class EditItemIn(BaseModel):
    menu_item_id: Optional[str] = None
    quantity: Optional[int] = None
    notes: Optional[str] = None


class ChefStatusIn(BaseModel):
    chef_status: Literal["pending", "ready", "served", "cancelled"]


class PaymentIn(BaseModel):
    method: Literal["cash", "upi", "card"]
    amount: float


class TableIn(BaseModel):
    name: str
    seats: int = 4
    sort_order: Optional[int] = None


class StaffIn(BaseModel):
    name: str
    email: EmailStr
    password: Optional[str] = None  # required on create, optional on update
    role: Literal["captain", "chef", "cashier"]


class StaffUpdateIn(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[Literal["captain", "chef", "cashier"]] = None


class InventoryIn(BaseModel):
    name: str
    unit: str = "kg"
    quantity: float = 0
    low_threshold: float = 0
    category: Optional[str] = "general"
    note: Optional[str] = ""


class SettingsIn(BaseModel):
    cgst_rate: float
    sgst_rate: float
    restaurant_name: Optional[str] = "Spice Route"
    address: Optional[str] = ""
    phone: Optional[str] = ""
    gstin: Optional[str] = ""
    restaurant_lat: Optional[float] = 0
    restaurant_lng: Optional[float] = 0
    geofence_radius_m: Optional[int] = 200
    geofence_enabled: Optional[bool] = False
    ip_check_enabled: Optional[bool] = False
    allowed_ips: Optional[List[str]] = []


class GuardCheckIn(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None


class ExpenseIn(BaseModel):
    title: str
    amount: float
    category: Optional[str] = "general"
    date: Optional[str] = None
