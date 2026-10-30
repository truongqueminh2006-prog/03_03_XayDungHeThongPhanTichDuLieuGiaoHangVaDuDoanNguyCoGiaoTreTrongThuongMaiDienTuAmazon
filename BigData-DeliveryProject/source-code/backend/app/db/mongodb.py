from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import settings

# Create MongoDB client
client = MongoClient(
    settings.MONGODB_URI,
    serverSelectionTimeoutMS=5000,
)

# Select project database
db: Database = client[settings.MONGODB_DATABASE]


def check_mongodb_connection() -> bool:
    """Check whether MongoDB is reachable."""
    try:
        client.admin.command("ping")
        return True
    except Exception:
        return False