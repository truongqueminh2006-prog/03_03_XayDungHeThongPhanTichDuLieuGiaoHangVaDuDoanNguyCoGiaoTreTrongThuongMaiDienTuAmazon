
from pathlib import Path
from datetime import datetime
import json
import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

BASE = Path(__file__).resolve().parent
MODELS = BASE / "models"

app = FastAPI(
    title="Amazon Delivery Prediction API",
    version="1.0.0",
    description="Regression, Classification and K-Means"
)

# =====================================
# 1. TẢI MÔ HÌNH
# =====================================

reg_model = joblib.load(
    MODELS / "optimized_delivery_model.joblib"
)

risk_model = joblib.load(
    MODELS / "delivery_risk_classifier.joblib"
)

cluster_model = joblib.load(
    MODELS / "kmeans_model.joblib"
)

with open(
    MODELS / "optimized_metadata.json",
    encoding="utf-8"
) as f:
    reg_meta = json.load(f)

with open(
    MODELS / "classification_metadata.json",
    encoding="utf-8"
) as f:
    risk_meta = json.load(f)

cluster_meta = joblib.load(
    MODELS / "clustering_metadata.joblib"
)

# =====================================
# 2. DANH SÁCH GIÁ TRỊ HỢP LỆ
# =====================================

VEHICLES = ["motorcycle", "scooter", "van"]
AREAS = ["Metropolitan", "Other", "Semi-Urban", "Urban"]

CATEGORIES = [
    "Books", "Clothing", "Cosmetics",
    "Electronics", "Grocery", "Home",
    "Jewelry", "Kitchen", "Outdoors",
    "Pet Supplies", "Shoes", "Skincare",
    "Snacks", "Sports", "Toys"
]

TRAFFIC = ["Low", "Medium", "High", "Jam"]

# =====================================
# 3. ĐỊNH NGHĨA DỮ LIỆU ĐẦU VÀO
# =====================================

class DeliveryInput(BaseModel):
    agent_age: int = Field(ge=18, le=100)
    agent_rating: float = Field(ge=0, le=5)
    distance_km: float = Field(ge=0)
    order_datetime: datetime

    traffic: str
    vehicle: str
    area: str
    category: str

    temperature_c: float | None = None
    precipitation_mm: float | None = Field(
        default=None, ge=0
    )
    wind_speed_kmh: float | None = Field(
        default=None, ge=0
    )

# =====================================
# 4. CHUYỂN DỮ LIỆU ĐẦU VÀO
# =====================================

def prepare_features(data: DeliveryInput):
    if data.traffic not in TRAFFIC:
        raise HTTPException(
            422, "Traffic không hợp lệ"
        )

    if data.vehicle not in VEHICLES:
        raise HTTPException(
            422, "Vehicle không hợp lệ"
        )

    if data.area not in AREAS:
        raise HTTPException(
            422, "Area không hợp lệ"
        )

    if data.category not in CATEGORIES:
        raise HTTPException(
            422, "Category không hợp lệ"
        )

    dt = data.order_datetime

    row = {
        "Agent_Age": data.agent_age,
        "Agent_Rating": data.agent_rating,
        "distance_haversine_km": data.distance_km,
        "order_hour": dt.hour,
        "day_of_week": dt.weekday(),
        "is_weekend": int(dt.weekday() >= 5),
        "Traffic": data.traffic,
        "api_temperature_2m_c": data.temperature_c,
        "api_precipitation_mm": data.precipitation_mm,
        "api_wind_speed_10m_kmh": data.wind_speed_kmh
    }

    # Tạo cột one-hot đúng tên mô hình đã học
    all_features = set(
        reg_meta["features"]
        + risk_meta["features"]
        + cluster_meta["features"]
    )

    for col in all_features:
        if col.startswith(("Vehicle_", "Area_", "Category_")):
            row[col] = 0

    vehicle_col = f"Vehicle_{data.vehicle}"
    area_col = f"Area_{data.area}"
    category_col = f"Category_{data.category}"

    for col in [vehicle_col, area_col, category_col]:
        if col in all_features:
            row[col] = 1

    return pd.DataFrame([row])

# =====================================
# 5. HÀM DỰ ĐOÁN
# =====================================

def predict_time(df):
    return float(reg_model.predict(
        df[reg_meta["features"]]
    )[0])

def predict_risk(df):
    probability = float(
        risk_model.predict_proba(
            df[risk_meta["features"]]
        )[0, 1]
    )

    cutoff = float(
        risk_meta["probability_threshold"]
    )

    return {
        "risk_probability": round(probability, 4),
        "risk_percentage": round(probability * 100, 2),
        "predicted_risk": int(probability >= cutoff),
        "probability_threshold": cutoff,
        "delivery_threshold_minutes": risk_meta[
            "delivery_threshold_minutes"
        ]
    }

def predict_cluster(df):
    cluster = int(
        cluster_model.predict(
            df[cluster_meta["features"]]
        )[0]
    )
    return cluster

# =====================================
# 6. CÁC ENDPOINT
# =====================================

@app.get("/")
def home():
    return {
        "message": "Amazon Delivery API is running"
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": 3
    }

@app.post("/predict/delivery-time")
def delivery_time(data: DeliveryInput):
    df = prepare_features(data)
    return {
        "predicted_minutes": round(
            predict_time(df), 2
        )
    }

@app.post("/predict/delivery-risk")
def delivery_risk(data: DeliveryInput):
    df = prepare_features(data)
    return predict_risk(df)

@app.post("/predict/cluster")
def cluster(data: DeliveryInput):
    df = prepare_features(data)
    return {
        "cluster": predict_cluster(df)
    }

@app.post("/predict/all")
def predict_all(data: DeliveryInput):
    df = prepare_features(data)

    return {
        "delivery_time": {
            "predicted_minutes": round(
                predict_time(df), 2
            )
        },
        "delivery_risk": predict_risk(df),
        "clustering": {
            "cluster": predict_cluster(df)
        }
    }
