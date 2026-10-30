
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()


class Settings:
    PROJECT_NAME: str = "Delivery Analytics API"
    PROJECT_VERSION: str = "1.0.0"

    MONGODB_URI: str = os.getenv(
        "MONGODB_URI",
        "mongodb://localhost:27017",
    )
    MONGODB_DATABASE: str = os.getenv(
        "MONGODB_DATABASE",
        "delivery_analytics",
    )

    # JWT authentication settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")


settings = Settings()
