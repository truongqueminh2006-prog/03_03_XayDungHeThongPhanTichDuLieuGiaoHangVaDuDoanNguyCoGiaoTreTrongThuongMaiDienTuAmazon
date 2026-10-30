
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import verify_password, create_access_token
from app.db.mongodb import db


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 1800
    role: str


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):
    # Find account in MongoDB
    user = db["users"].find_one({
        "username": data.username
    })

    # Use a generic message to avoid revealing which field is incorrect
    if not user or not verify_password(
        data.password,
        user.get("hashed_password", ""),
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ten dang nhap hoac mat khau khong dung",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.get("is_active", True) is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tai khoan da bi vo hieu hoa",
        )

    role = user.get("role", "user")
    if role not in {"admin", "user"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vai tro tai khoan khong hop le",
        )

    token = create_access_token(
        subject=user["username"],
        role=role,
    )

    # Record last successful login
    db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}},
    )

    return TokenResponse(
    access_token=token,
    role=role,
    )
