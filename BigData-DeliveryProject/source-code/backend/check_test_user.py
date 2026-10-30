
import getpass
from app.core.security import verify_password
from app.db.mongodb import db

username = input("Username can kiem tra: ").strip()
password = getpass.getpass("Nhap mat khau dang thu: ")

user = db["users"].find_one({"username": username})

if not user:
    print("Khong tim thay tai khoan.")
else:
    print("Tai khoan ton tai.")
    print(
        "Mat khau khop:",
        verify_password(password, user.get("hashed_password", ""))
    )
