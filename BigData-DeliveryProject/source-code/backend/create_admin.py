from app.db.mongodb import db
from app.core.security import hash_password, verify_password


username = "admin"
password = "123456"

users = db["users"]

# Tạo mật khẩu đã băm theo chuẩn backend
hashed_password = hash_password(password)

existing_user = users.find_one({"username": username})

if existing_user:
    # Không ghi đè nếu tài khoản đã tồn tại
    print("Tai khoan admin da ton tai.")
    print("Role hien tai:", existing_user.get("role", "user"))

    if verify_password(password, existing_user.get("hashed_password", "")):
        print("Mat khau admin/123456 da dung.")
    else:
        print("Tai khoan da ton tai nhung mat khau khong phai 123456.")
        print("Khong thay doi du lieu de tranh ghi de tai khoan.")
else:
    users.insert_one({
        "username": username,
        "hashed_password": hashed_password,
        "role": "admin",
        "is_active": True
    })

    print("Da tao tai khoan Admin thanh cong!")
    print("Username: admin")
    print("Password: 123456")
