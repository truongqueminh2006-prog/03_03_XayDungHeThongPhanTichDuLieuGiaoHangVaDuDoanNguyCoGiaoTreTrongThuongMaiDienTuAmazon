
from pwdlib import PasswordHash
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings


password_hash = PasswordHash.recommended()


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password."""
    return password_hash.hash(plain_password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """Verify a plain-text password against its stored hash."""
    return password_hash.verify(plain_password, hashed_password)


def create_access_token(
    subject: str,
    role: str,
    expires_minutes: int = 30,
) -> str:
    """Create a signed JWT access token."""
    if not settings.JWT_SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY chưa được cấu hình trong .env")

    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    """Verify and decode a JWT access token."""
    if not settings.JWT_SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY chưa được cấu hình trong .env")

    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
