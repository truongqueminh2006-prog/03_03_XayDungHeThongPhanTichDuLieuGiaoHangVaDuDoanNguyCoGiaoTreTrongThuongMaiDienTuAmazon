
import getpass

from app.core.security import hash_password
from app.db.mongodb import db

username = "qminh_test"
users = db["users"]

user = users.find_one({"username": username})

if not user:
    print("Khong tim thay tai khoan.")
else:
    password = getpass.getpass("Nhap mat khau moi (toi thieu 12 ky tu): ")

    if len(password) < 12:
        print("Mat khau phai co it nhat 12 ky tu.")
    else:
        confirm = getpass.getpass("Nhap lai mat khau moi: ")

        if password != confirm:
            print("Mat khau khong trung khop.")
        else:
            users.update_one(
                {"username": username},
                {"$set": {"hashed_password": hash_password(password)}}
            )
            print("Dat lai mat khau thanh cong.")
