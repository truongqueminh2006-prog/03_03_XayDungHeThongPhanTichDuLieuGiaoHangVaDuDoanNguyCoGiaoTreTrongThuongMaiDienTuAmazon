from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from app.core.dependencies import require_admin
from app.core.security import hash_password
from app.db.mongodb import db


router = APIRouter(
    prefix="/api/users",
    tags=["User Management"],
    dependencies=[Depends(require_admin)],
)


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    fullname: str = Field(default="", max_length=150)
    password: str = Field(min_length=8, max_length=128)
    role: str = "user"
    status: str = "Hoạt động"


class UserUpdate(BaseModel):
    fullname: str = Field(default="", max_length=150)
    role: str = "user"
    status: str = "Hoạt động"


def normalize_role(role: str) -> str:
    value = role.strip().lower()
    mapping = {
        "admin": "admin",
        "user": "user",
    }
    if value not in mapping:
        raise HTTPException(400, "Vai trò không hợp lệ.")
    return mapping[value]


def normalize_active(value: str) -> bool:
    mapping = {
        "hoạt động": True,
        "active": True,
        "true": True,
        "bị khóa": False,
        "bi khoa": False,
        "inactive": False,
        "false": False,
    }
    result = mapping.get(value.strip().lower())
    if result is None:
        raise HTTPException(400, "Trạng thái không hợp lệ.")
    return result


def serialize_user(user: dict) -> dict:
    return {
        "username": user["username"],
        "fullname": user.get("fullname", user.get("full_name", "")),
        "role": "Admin" if user.get("role", "user") == "admin" else "User",
        "status": (
            "Hoạt động"
            if user.get("is_active", True) is True
            else "Bị khóa"
        ),
    }


def protect_last_admin(user: dict, new_role: str, new_active: bool):
    currently_admin = (
        user.get("role", "user") == "admin"
        and user.get("is_active", True) is True
    )

    will_remain_admin = new_role == "admin" and new_active is True

    if currently_admin and not will_remain_admin:
        other_admins = db["users"].count_documents({
            "username": {"$ne": user["username"]},
            "role": "admin",
            "is_active": True,
        })
        if other_admins == 0:
            raise HTTPException(
                status_code=400,
                detail="Không thể vô hiệu hóa hoặc hạ quyền admin cuối cùng.",
            )


@router.get("")
def list_users():
    users = db["users"].find(
        {},
        {
            "_id": 0,
            "username": 1,
            "fullname": 1,
            "full_name": 1,
            "role": 1,
            "is_active": 1,
        },
    ).sort("username", 1)

    return [serialize_user(user) for user in users]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate):
    username = data.username.strip()

    if not username:
        raise HTTPException(400, "Tên đăng nhập không được để trống.")

    if db["users"].find_one({"username": username}):
        raise HTTPException(409, "Tên đăng nhập đã tồn tại.")

    role = normalize_role(data.role)
    is_active = normalize_active(data.status)

    document = {
        "username": username,
        "fullname": data.fullname.strip(),
        "hashed_password": hash_password(data.password),
        "role": role,
        "is_active": is_active,
        "created_at": datetime.now(timezone.utc),
    }

    try:
        db["users"].insert_one(document)
    except DuplicateKeyError:
        raise HTTPException(409, "Tên đăng nhập đã tồn tại.")

    return serialize_user(document)


@router.put("/{username}")
def update_user(username: str, data: UserUpdate):
    user = db["users"].find_one({"username": username})
    if not user:
        raise HTTPException(404, "Không tìm thấy tài khoản.")

    role = normalize_role(data.role)
    is_active = normalize_active(data.status)

    protect_last_admin(user, role, is_active)

    db["users"].update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "fullname": data.fullname.strip(),
                "role": role,
                "is_active": is_active,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    updated = db["users"].find_one({"_id": user["_id"]})
    return serialize_user(updated)


@router.delete("/{username}")
def delete_user(
    username: str,
    current_user: dict = Depends(require_admin),
):
    if username == current_user["username"]:
        raise HTTPException(
            400,
            "Bạn không thể xóa tài khoản đang đăng nhập.",
        )

    user = db["users"].find_one({"username": username})
    if not user:
        raise HTTPException(404, "Không tìm thấy tài khoản.")

    protect_last_admin(user, "user", False)

    db["users"].delete_one({"_id": user["_id"]})
    return {"message": "Đã xóa tài khoản thành công."}
