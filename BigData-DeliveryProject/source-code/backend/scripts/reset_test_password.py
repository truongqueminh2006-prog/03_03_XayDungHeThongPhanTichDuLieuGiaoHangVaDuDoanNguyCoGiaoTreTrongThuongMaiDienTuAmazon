
import getpass

from app.core.security import hash_password
from app.db.mongodb import db


def main():
    username = input("Nhap username da tao: ").strip()

    user = db["users"].find_one({"username": username})
    if not user:
        print("Khong tim thay username nay trong MongoDB.")
        return

    new_password = getpass.getpass("Nhap mat khau moi: ")
    if len(new_password) < 12:
        print("Mat khau can it nhat 12 ky tu.")
        return

    confirm = getpass.getpass("Nhap lai mat khau moi: ")
    if new_password != confirm:
        print("Hai mat khau khong trung nhau.")
        return

    db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"hashed_password": hash_password(new_password)}},
    )

    print("Dat lai mat khau thanh cong.")
    print("Username:", username)


if __name__ == "__main__":
    main()
