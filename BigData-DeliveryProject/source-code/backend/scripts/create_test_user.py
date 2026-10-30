
import getpass

from app.core.security import hash_password, verify_password
from app.db.mongodb import db


def main():
    username = input("Nhap username thu nghiem: ").strip()

    if not username:
        print("Username khong duoc de trong.")
        return

    password = getpass.getpass("Nhap mat khau thu nghiem: ")

    if len(password) < 12:
        print("Mat khau nen co it nhat 12 ky tu.")
        return

    users = db["users"]

    if users.find_one({"username": username}):
        print("Username da ton tai. Khong tao tai khoan moi.")
        return

    user = {
        "username": username,
        "hashed_password": hash_password(password),
        "role": "admin",
        "is_active": True,
    }

    users.insert_one(user)

    saved_user = users.find_one({"username": username})

    print("Tao tai khoan thu nghiem thanh cong.")
    print("Role:", saved_user.get("role"))
    print(
        "Kiem tra mat khau:",
        verify_password(password, saved_user["hashed_password"])
    )


if __name__ == "__main__":
    main()
