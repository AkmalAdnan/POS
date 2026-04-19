import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 12

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

Role = Literal["owner", "captain", "chef", "cashier", "customer"]

CATEGORY_TO_DEPARTMENT = {
    "Main Course": "Main Kitchen",
    "Biryanis": "Main Kitchen",
    "Mandi": "Main Kitchen",
    "Mutton": "Main Kitchen",
    "Chinese": "Chinese Counter",
    "Fried Rice": "Chinese Counter",
    "Roti": "Chinese Counter",
    "Sweets": "Sweets / Dessert",
    "Beverages": "Beverage Counter",
}
ALL_DEPARTMENTS = ["Main Kitchen", "Chinese Counter", "Sweets / Dessert", "Beverage Counter"]


def dept_for(category: str) -> str:
    return CATEGORY_TO_DEPARTMENT.get(category, "Main Kitchen")
