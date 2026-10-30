from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.orders import router as orders_router
from app.api.auth import router as auth_router
from app.db.mongodb import check_mongodb_connection
from app.api.predict import router as predict_router
from app.api.users import router as users_router
from app.api.backup import router as backup_router
from app.api.restore import router as restore_router

app = FastAPI(
    title="Delivery Analytics API",
    description="Backend API for the BigData-DeliveryProject",
    version="1.0.0",
)

# Cho phép frontend gọi API từ Live Server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký các API
app.include_router(orders_router)
app.include_router(auth_router)
app.include_router(predict_router)
app.include_router(users_router)
app.include_router(backup_router)
app.include_router(restore_router)

@app.get("/")
def home():
    return {
        "message": "Delivery Analytics API is running",
        "project": "BigData-DeliveryProject",
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "Backend is running normally",
    }


@app.get("/health/db")
def database_health_check():
    connected = check_mongodb_connection()

    return {
        "database": "delivery_analytics",
        "status": "connected" if connected else "disconnected",
    }
