
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError

from app.core.security import decode_access_token
from app.db.mongodb import db


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    """Validate JWT and retrieve the active user from MongoDB."""

    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token khong hop le hoac da het han. Vui long dang nhap lai.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = decode_access_token(credentials.credentials)
    except InvalidTokenError:
        raise unauthorized

    username = payload.get("sub")
    if not username:
        raise unauthorized

    user = db["users"].find_one({"username": username})

    if not user or user.get("is_active", True) is not True:
        raise unauthorized

    role = user.get("role", "user")
    if role not in {"admin", "user"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vai tro tai khoan khong hop le.",
        )

    # Use the role currently stored in MongoDB, not the role claimed by the token.
    return {
        "username": username,
        "role": role,
    }


def require_admin(current_user: dict = Depends(get_current_user)):
    """Allow only users whose current database role is admin."""

    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ban khong co quyen thuc hien thao tac nay.",
        )

    return current_user
