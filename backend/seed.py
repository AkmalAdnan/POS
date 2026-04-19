import os
import uuid

from core.db import db
from core.security import hash_password
from core.utils import iso
from routes.settings import settings_doc

SAMPLE_MENU = [
    ("Paneer Butter Masala", "Main Course", 240, 110, "Creamy tomato gravy with paneer cubes"),
    ("Dal Makhani", "Main Course", 210, 80, "Slow-cooked black lentils in butter & cream"),
    ("Palak Paneer", "Main Course", 230, 100, "Paneer in a smooth spinach gravy"),
    ("Veg Hakka Noodles", "Chinese", 180, 70, "Stir-fried noodles with veggies"),
    ("Chilli Chicken Dry", "Chinese", 260, 120, "Indo-Chinese spicy chicken starter"),
    ("Manchurian Gravy", "Chinese", 200, 80, "Veg balls in tangy Manchurian sauce"),
    ("Hyderabadi Chicken Biryani", "Biryanis", 320, 150, "Dum-cooked aromatic chicken biryani"),
    ("Veg Dum Biryani", "Biryanis", 260, 100, "Fragrant mixed veggies & basmati"),
    ("Mutton Biryani", "Biryanis", 420, 200, "Slow-cooked mutton with saffron rice"),
    ("Butter Naan", "Roti", 50, 15, "Tandoor-baked naan brushed with butter"),
    ("Tandoori Roti", "Roti", 25, 8, "Whole-wheat roti from the tandoor"),
    ("Lachha Paratha", "Roti", 60, 20, "Flaky layered paratha"),
    ("Garlic Naan", "Roti", 70, 20, "Naan topped with fresh garlic & butter"),
    ("Schezwan Fried Rice", "Fried Rice", 200, 70, "Spicy schezwan tossed rice"),
    ("Veg Fried Rice", "Fried Rice", 180, 60, "Classic fried rice with veggies"),
    ("Egg Fried Rice", "Fried Rice", 200, 75, "Wok-tossed egg fried rice"),
    ("Chicken Mandi", "Mandi", 380, 180, "Yemeni-style aromatic chicken & rice"),
    ("Mutton Mandi", "Mandi", 520, 260, "Slow-smoked mutton with mandi rice"),
    ("Gulab Jamun (2 pc)", "Sweets", 80, 25, "Warm milk dumplings in rose syrup"),
    ("Rasmalai (2 pc)", "Sweets", 120, 40, "Chilled cottage cheese in saffron milk"),
    ("Gajar Halwa", "Sweets", 140, 50, "Carrot halwa with ghee & dry fruits"),
    ("Mutton Rogan Josh", "Mutton", 440, 210, "Kashmiri-style slow-cooked mutton"),
    ("Mutton Keema", "Mutton", 360, 170, "Spiced minced mutton"),
    ("Mutton Korma", "Mutton", 460, 220, "Rich, nutty mutton korma"),
    ("Masala Chai", "Beverages", 30, 8, "Strong spiced Indian tea"),
    ("Cold Coffee", "Beverages", 120, 40, "Chilled frothy cold coffee"),
    ("Mango Lassi", "Beverages", 110, 35, "Sweet yogurt-mango drink"),
    ("Strawberry Milkshake", "Beverages", 140, 50, "Creamy strawberry milkshake"),
    ("Vanilla Icecream Scoop", "Beverages", 90, 30, "Classic vanilla ice cream scoop"),
    ("Fresh Lime Soda", "Beverages", 60, 15, "Sweet & salt lime soda"),
]

SAMPLE_INVENTORY = [
    ("Chicken", "kg", 10, 2, "meat"),
    ("Mutton", "kg", 6, 2, "meat"),
    ("Basmati Rice", "kg", 40, 10, "grains"),
    ("Paneer", "kg", 5, 1, "dairy"),
    ("Onion", "kg", 25, 5, "vegetables"),
    ("Tomato", "kg", 20, 5, "vegetables"),
    ("Ghee", "kg", 3, 1, "dairy"),
    ("Milk", "ltr", 15, 5, "dairy"),
    ("Cooking Oil", "ltr", 20, 5, "oils"),
    ("Wheat Flour (Maida)", "kg", 15, 5, "grains"),
]


async def seed_startup() -> None:
    await db.users.create_index("email", unique=True)
    await db.menu_items.create_index("id", unique=True)
    await db.bills.create_index("id", unique=True)
    await db.bills.create_index("created_at")
    await db.bills.create_index("status")
    await db.tables.create_index("id", unique=True)
    await db.inventory.create_index("id", unique=True)

    seed_users = [
        (os.environ.get("ADMIN_EMAIL", "owner@spice.com"), "Spice Owner", "owner",
         os.environ.get("ADMIN_PASSWORD", "owner123")),
        ("captain@spice.com", "Ravi Captain", "captain", "captain123"),
        ("chef@spice.com", "Aarti Chef", "chef", "chef123"),
        ("cashier@spice.com", "Nila Cashier", "cashier", "cashier123"),
        ("guest@spice.com", "Aarav Guest", "customer", "guest123"),
        ("staff@spice.com", "Ravi Staff (legacy)", "captain", "staff123"),
    ]
    for email, name, role, pw in seed_users:
        email = email.lower()
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "name": name, "email": email, "role": role,
                "password_hash": hash_password(pw), "created_at": iso(),
            })
        elif existing.get("role") == "staff":
            await db.users.update_one({"email": email}, {"$set": {"role": "captain"}})

    for name, cat, price, cost, desc in SAMPLE_MENU:
        if not await db.menu_items.find_one({"name": name}):
            await db.menu_items.insert_one({
                "id": str(uuid.uuid4()), "name": name, "category": cat,
                "price": float(price), "cost": float(cost),
                "description": desc, "is_available": True, "created_at": iso(),
            })

    existing_names = {t["name"] for t in await db.tables.find({}, {"name": 1, "_id": 0}).to_list(500)}
    for i in range(1, 17):
        nm = f"T{i}"
        if nm not in existing_names:
            await db.tables.insert_one({
                "id": str(uuid.uuid4()), "name": nm, "seats": 4,
                "sort_order": i, "created_at": iso(),
            })
    async for t in db.tables.find({"sort_order": {"$exists": False}}, {"_id": 0}):
        try:
            n = int(t["name"].lstrip("T"))
        except Exception:
            n = 99
        await db.tables.update_one({"id": t["id"]}, {"$set": {"sort_order": n}})

    if await db.inventory.count_documents({}) == 0:
        for name, unit, qty, low, cat in SAMPLE_INVENTORY:
            await db.inventory.insert_one({
                "id": str(uuid.uuid4()), "name": name, "unit": unit,
                "quantity": float(qty), "low_threshold": float(low),
                "category": cat, "note": "", "created_at": iso(), "updated_at": iso(),
            })

    await settings_doc()
