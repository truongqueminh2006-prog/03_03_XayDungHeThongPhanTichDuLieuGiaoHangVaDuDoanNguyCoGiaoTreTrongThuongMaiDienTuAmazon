
import getpass

from app.core.security import hash_password
from app.db.mongodb import db


def main():
    username = input("Nhap username user thu nghiem: ").strip()

    if not username:
        print("Username khong duoc de trong.")
        return

    password = getpass.getpass("Nhap mat khau (toi thieu 12 ky tu): ")

    if len(password) < 12:
        print("Mat khau phai co it nhat 12 ky tu.")
        return

    confirm = getpass.getpass("Nhap lai mat khau: ")

    if password != confirm:
        print("Mat khau khong trung khop.")
        return

    users = db["users"]

    if users.find_one({"username": username}):
        print("Username da ton tai. Hay chon username khac.")
        return

    users.insert_one({
        "username": username,
        "hashed_password": hash_password(password),
        "role": "user",
        "is_active": True,
    })

    print("Tao tai khoan user thanh cong.")
    print("Role: user")


if __name__ == "__main__":
    main()
