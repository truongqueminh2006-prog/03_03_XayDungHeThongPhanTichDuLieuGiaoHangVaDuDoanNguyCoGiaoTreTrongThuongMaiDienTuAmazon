from pathlib import Path
from datetime import datetime
import json
import joblib
import pandas as pd
import traceback

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import PyMongoError
from app.db.mongodb import db

from app.core.dependencies import get_current_user

# 1. ĐƯỜNG DẪN MÔ HÌNH CỦA TV2
MODEL_DIR = Path(
    r"D:\ĐỒ ÁN\Dự án mô hình\Dự án mô hình\backend\models"
)

MODEL_PATH = MODEL_DIR / "optimized_delivery_model.joblib"
META_PATH = MODEL_DIR / "optimized_metadata.json"

RISK_MODEL_PATH = MODEL_DIR / "delivery_risk_classifier.joblib"
RISK_META_PATH = MODEL_DIR / "classification_metadata.json"

CLUSTER_MODEL_PATH = MODEL_DIR / "kmeans_model.joblib"
CLUSTER_META_PATH = MODEL_DIR / "clustering_metadata.joblib"

router = APIRouter(
    prefix="/api/predict",
    tags=["AI Prediction"]
)

# API THỐNG KÊ NGUY CƠ GIAO HÀNG THỰC TẾ
@router.get("/actual-risk/summary")
def get_actual_risk_summary(
    current_user: dict = Depends(get_current_user),
):
    """
    Thống kê nhãn Actual_Risk từ collection predictions.
    Chỉ đọc dữ liệu, không thay đổi MongoDB.
    """
    try:
        collection = db["predictions"]

        # Đếm số bản ghi có nhãn rủi ro
        risk_count = collection.count_documents({
            "Actual_Risk": 1
        })

        non_risk_count = collection.count_documents({
            "Actual_Risk": 0
        })

        total_labeled = risk_count + non_risk_count

        risk_rate = (
            risk_count / total_labeled * 100
            if total_labeled > 0
            else 0
        )

        return {
            "risk_count": risk_count,
            "non_risk_count": non_risk_count,
            "total_labeled": total_labeled,
            "risk_rate": round(risk_rate, 2),
            "message": "Thống kê Actual_Risk thành công."
        }

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Không thể thống kê dữ liệu Actual_Risk."
        ) from exc

# ==========================================
# API DASHBOARD PHAN TICH NGUY CO DU DOAN
# ==========================================

@router.get("/dashboard/risk-analysis")
def get_risk_analysis(
    start_date: str | None = None,
    end_date: str | None = None,
    area: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    print("[RISK TEST] DA VAO HAM get_risk_analysis")
    """
    Tổng hợp dữ liệu dự đoán rủi ro.
    Chỉ đọc predictions, orders và dim_vehicle.
    Không thay đổi dữ liệu MongoDB.
    """
    try:
        print("[RISK] API da nhan request")

        predictions_collection = db["predictions"]
        orders_collection = db["orders"]
        vehicles_collection = db["dim_vehicle"]
        categories_collection = db["dim_category"]

        print("[RISK] Da ket noi cac collection")
        # Chuyển ngày YYYY-MM-DD thành DateKey YYYYMMDD
        date_filter = {}

        if start_date:
            date_filter["$gte"] = int(start_date.replace("-", ""))

        if end_date:
            date_filter["$lte"] = int(end_date.replace("-", ""))

        order_match = {}

        if date_filter:
            order_match["DateKey"] = date_filter

        if area:
            order_match["Area"] = area

        # Lấy dữ liệu dự đoán
        prediction_pipeline = [
            {
                "$match": {
                    "model_type": "classification",
                    "Predicted_Risk": {"$in": [0, 1]},
                    "Risk_Probability": {"$ne": None}
                }
            },
            {
                "$lookup": {
                    "from": "orders",
                    "localField": "Order_ID",
                    "foreignField": "Order_ID",
                    "as": "order"
                }
            },
            {"$unwind": "$order"},
            {"$match": {
                **{
                    f"order.{key}": value
                    for key, value in order_match.items()
                }
            }},
            {
                "$lookup": {
                    "from": "dim_vehicle",
                    "localField": "order.VehicleKey",
                    "foreignField": "VehicleKey",
                    "as": "vehicle_info"
                }
            },
            {
                "$unwind": {
                    "path": "$vehicle_info",
                    "preserveNullAndEmptyArrays": True
                }
            },
            {
                "$lookup": {
                    "from": "dim_category",
                    "localField": "order.CategoryKey",
                    "foreignField": "CategoryKey",
                    "as": "category_info"
                }
            },
            {
                "$unwind": {
                    "path": "$category_info",
                    "preserveNullAndEmptyArrays": True
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "Order_ID": 1,
                    "Predicted_Risk": 1,
                    "Actual_Risk": 1,
                    "Risk_Probability": 1,
                    "Area": "$order.Area",
                    "Vehicle": "$vehicle_info.VehicleType",
                    "CategoryName": "$category_info.CategoryName",
                    "VehicleKey": "$order.VehicleKey",
                    "DateKey": "$order.DateKey"
                }
            }
        ]

        print("[RISK] Bat dau aggregate MongoDB")

        records = list(
            predictions_collection.aggregate(
                prediction_pipeline,
                maxTimeMS=30000
            )
        )

        print(f"[RISK] Aggregate hoan tat: {len(records)} records")

        total = len(records)

        all_orders_count = orders_collection.count_documents(order_match)

        blank_count = max(all_orders_count - total, 0)

        if total == 0:
            return {
                "filters": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "area": area
                },
                "kpi": {
                    "total_orders": 0,
                    "risk_count": 0,
                    "non_risk_count": 0,
                    "average_probability": 0,
                    "risk_rate": 0
                },
                "by_area_vehicle": [],
                "risk_distribution": [
                    {
                        "label": "(Blank)",
                        "count": blank_count
                    }
                ],
                "urgent_orders": []
            }
        risk_records = [
            item for item in records
            if int(item.get("Predicted_Risk", 0)) == 1
        ]

        safe_records = [
            item for item in records
            if int(item.get("Predicted_Risk", 0)) == 0
        ]

        average_probability = sum(
            float(item["Risk_Probability"])
            for item in records
        ) / total

        risk_count = len(risk_records)

        # Phân tích theo khu vực và phương tiện
        grouped = {}

        for item in records:
            key = (
                item.get("Area", "Unknown"),
                item.get("Vehicle", "Unknown")
            )

            if key not in grouped:
                grouped[key] = {
                    "area": key[0],
                    "vehicle": key[1],
                    "total_orders": 0,
                    "risk_count": 0
                }

            grouped[key]["total_orders"] += 1

            if int(item.get("Predicted_Risk", 0)) == 1:
                grouped[key]["risk_count"] += 1

        by_area_vehicle = []

        for item in grouped.values():
            count = item["total_orders"]
            risky = item["risk_count"]

            by_area_vehicle.append({
                **item,
                "risk_rate": round(risky / count * 100, 2)
            })

        by_area_vehicle.sort(
            key=lambda x: (x["area"], x["vehicle"])
        )

        # Phân bố phân loại rủi ro
        risk_distribution = [
            {
                "label": "(Blank)",
                "count": blank_count
            },
            {
                "label": "An toàn",
                "count": len(safe_records)
            },
            {
                "label": "Nguy cơ trễ",
                "count": risk_count
            }
        ]

        # 20 đơn có xác suất  rủi ro cao nhất
        urgent_orders = sorted(
            risk_records,
            key=lambda x: float(x["Risk_Probability"]),
            reverse=True
        )[:20]

        urgent_orders = [
            {
                "Order_ID": item["Order_ID"],
                "Area": item.get("Area"),
                "CategoryName": item.get("CategoryName"),
                "Risk_Probability": round(
                    float(item["Risk_Probability"]), 4
                ),
                "Predicted_Risk": int(item["Predicted_Risk"])
            }
            for item in urgent_orders
        ]

        return {
            "filters": {
                "start_date": start_date,
                "end_date": end_date,
                "area": area
            },
            "kpi": {
                "total_orders": total,
                "risk_count": risk_count,
                "non_risk_count": len(safe_records),
                "average_probability": round(
                    average_probability, 4
                ),
                "risk_rate": round(risk_count / total * 100, 2)
            },
            "by_area_vehicle": by_area_vehicle,
            "risk_distribution": risk_distribution,
            "urgent_orders": urgent_orders
        }

    except Exception as exc:
        print(f"[RISK ERROR] {type(exc).__name__}: {exc}")
        raise
# 2. TẢI MÔ HÌNH
try:
    required_paths = [
        MODEL_PATH,
        META_PATH,
        RISK_MODEL_PATH,
        RISK_META_PATH,
        CLUSTER_MODEL_PATH,
        CLUSTER_META_PATH,
    ]

    for path in required_paths:
        if not path.exists():
            raise FileNotFoundError(
                f"Không tìm thấy file: {path}"
            )

    model = joblib.load(MODEL_PATH)
    risk_model = joblib.load(RISK_MODEL_PATH)
    cluster_model = joblib.load(CLUSTER_MODEL_PATH)

    with open(META_PATH, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    with open(RISK_META_PATH, "r", encoding="utf-8") as f:
        risk_meta = json.load(f)

    cluster_meta = joblib.load(CLUSTER_META_PATH)

    FEATURES = metadata["features"]
    RISK_FEATURES = risk_meta["features"]
    CLUSTER_FEATURES = cluster_meta["features"]

except Exception as exc:
    raise RuntimeError(
        f"Không thể tải mô hình dự đoán: {exc}"
    ) from exc

# 3. DỮ LIỆU ĐẦU VÀO
class DeliveryInput(BaseModel):
    agent_age: int = Field(ge=18, le=100)
    agent_rating: float = Field(ge=0, le=5)
    distance_km: float = Field(ge=0)

    traffic: str
    vehicle: str
    area: str
    category: str

    order_datetime: datetime = Field(
        default_factory=datetime.now
    )

    temperature_c: float | None = None
    precipitation_mm: float | None = Field(
        default=None, ge=0
    )
    wind_speed_kmh: float | None = Field(
        default=None, ge=0
    )

# 4. CHUẨN BỊ ĐẶC TRƯNG
VEHICLES = ["motorcycle", "scooter", "van"]
AREAS = ["Metropolitan", "Other", "Semi-Urban", "Urban"]
TRAFFIC = ["Low", "Medium", "High", "Jam"]

CATEGORIES = [
    "Books", "Clothing", "Cosmetics", "Electronics",
    "Grocery", "Home", "Jewelry", "Kitchen",
    "Outdoors", "Pet Supplies", "Shoes", "Skincare",
    "Snacks", "Sports", "Toys"
]

def prepare_features(data: DeliveryInput) -> pd.DataFrame:
    if data.traffic not in TRAFFIC:
        raise HTTPException(422, "Giá trị traffic không hợp lệ")

    if data.vehicle not in VEHICLES:
        raise HTTPException(422, "Giá trị vehicle không hợp lệ")

    if data.area not in AREAS:
        raise HTTPException(422, "Giá trị area không hợp lệ")

    if data.category not in CATEGORIES:
        raise HTTPException(422, "Giá trị category không hợp lệ")

    dt = data.order_datetime

    row = {
        "Agent_Age": data.agent_age,
        "Agent_Rating": data.agent_rating,
        "order_hour": dt.hour,
        "day_of_week": dt.weekday(),
        "is_weekend": int(dt.weekday() >= 5),
        "distance_haversine_km": data.distance_km,
        "api_temperature_2m_c": data.temperature_c,
        "api_precipitation_mm": data.precipitation_mm,
        "api_wind_speed_10m_kmh": data.wind_speed_kmh,
        "Traffic": data.traffic,
    }

    # Khởi tạo các cột one-hot theo đúng metadata
    for col in FEATURES:
        if col.startswith(("Vehicle_", "Area_", "Category_")):
            row[col] = 0

    # Chọn đúng cột tương ứng với dữ liệu đầu vào
    for col in (
        f"Vehicle_{data.vehicle}",
        f"Area_{data.area}",
        f"Category_{data.category}",
    ):
        if col in FEATURES:
            row[col] = 1

    # Nếu metadata có đặc trưng chưa được tạo, báo lỗi rõ ràng.
    missing = [col for col in FEATURES if col not in row]
    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Chưa tạo được các đặc trưng: {missing}"
        )

    df = pd.DataFrame([row], columns=FEATURES)

    return df

# 5. API DỰ ĐOÁN THỜI GIAN
@router.post("/delivery-time")
def predict_delivery_time(
    data: DeliveryInput,
    current_user: dict = Depends(get_current_user),
):
    df = prepare_features(data)

    try:
        prediction = float(model.predict(df)[0])
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Mô hình không thể dự đoán: {exc}"
        ) from exc

    return {
        "predicted_minutes": round(prediction, 2),
        "unit": "minutes",
        "model": metadata.get("selected_model", "Optimized"),
    }

# 6. API PHÂN CỤM K-MEANS
@router.post("/cluster")
def predict_cluster(
    data: DeliveryInput,
    current_user: dict = Depends(get_current_user),
):
    df = prepare_features(data)

    try:
        cluster_input = df[CLUSTER_FEATURES]
        cluster = int(cluster_model.predict(cluster_input)[0])

        return {
            "cluster": cluster,
            "model": "K-Means",
            "total_clusters": cluster_meta["best_k"],
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Mô hình K-Means không thể phân cụm: {exc}"
        ) from exc

# 7. API PHÂN LOẠI RỦI RO GIAO HÀNG
@router.post("/delivery-risk")
def predict_delivery_risk(
    data: DeliveryInput,
    current_user: dict = Depends(get_current_user),
):
    df = prepare_features(data)

    try:
        # Lấy đúng các đặc trưng mà mô hình rủi ro đã huấn luyện
        risk_input = df[RISK_FEATURES]

        # Xác suất đơn hàng thuộc lớp rủi ro (class 1)
        if not hasattr(risk_model, "predict_proba"):
            raise ValueError(
                "Mô hình phân loại không hỗ trợ predict_proba"
            )

        probabilities = risk_model.predict_proba(risk_input)[0]
        classes = list(risk_model.classes_)

        if 1 not in classes:
            raise ValueError(
                "Không tìm thấy lớp 1 trong mô hình phân loại rủi ro"
            )

        risk_probability = float(probabilities[classes.index(1)])
        threshold = float(
            risk_meta.get("probability_threshold", 0.55)
        )

        # Phân loại theo ngưỡng xác suất trong metadata
        is_risky = risk_probability >= threshold

        return {
            "risk_class": int(is_risky),
            "risk_label": (
                "Nguy cơ giao hàng lâu"
                if is_risky
                else "Nguy cơ giao hàng thấp"
            ),
            "risk_probability": round(risk_probability, 4),
            "probability_threshold": threshold,
            "delivery_threshold_minutes": risk_meta.get(
                "delivery_threshold_minutes", 160.0
            ),
            "model": risk_meta.get("model", "RandomForest"),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Mô hình phân loại rủi ro không thể dự đoán: {exc}"
        ) from exc

@router.get("/debug-risk-analysis")
def debug_risk_analysis(
    current_user: dict = Depends(get_current_user)
):
    result = {}
    step = "Bắt đầu"

    try:
        predictions = db["predictions"]

        step = "Kiểm tra aggregation"

        pipeline = [
            {
                "$match": {
                    "model_type": "classification",
                    "Predicted_Risk": {"$in": [0, 1]},
                    "Risk_Probability": {"$ne": None}
                }
            },
            {
                "$lookup": {
                    "from": "orders",
                    "localField": "Order_ID",
                    "foreignField": "Order_ID",
                    "as": "order"
                }
            },
            {"$unwind": "$order"},
            {
                "$lookup": {
                    "from": "dim_vehicle",
                    "localField": "order.VehicleKey",
                    "foreignField": "VehicleKey",
                    "as": "vehicle_info"
                }
            },
            {
                "$unwind": {
                    "path": "$vehicle_info",
                    "preserveNullAndEmptyArrays": True
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "Order_ID": 1,
                    "Predicted_Risk": 1,
                    "Risk_Probability": 1,
                    "Area": "$order.Area",
                    "Vehicle": "$vehicle_info.VehicleType"
                }
            }
        ]

        records = list(
            predictions.aggregate(
                pipeline,
                maxTimeMS=30000
            )
        )

        result["aggregate_count"] = len(records)

        step = "Tính toán phân loại rủi ro"

        risk_records = [
            item for item in records
            if int(item.get("Predicted_Risk", 0)) == 1
        ]

        safe_records = [
            item for item in records
            if int(item.get("Predicted_Risk", 0)) == 0
        ]

        result["risk_count"] = len(risk_records)
        result["safe_count"] = len(safe_records)

        step = "Tính xác suất trung bình"

        total = len(records)

        average_probability = (
            sum(float(item["Risk_Probability"]) for item in records)
            / total if total else 0
        )

        result["average_probability"] = average_probability

        step = "Phân nhóm khu vực và phương tiện"

        grouped = {}

        for item in records:
            key = (
                item.get("Area", "Unknown"),
                item.get("Vehicle", "Unknown")
            )

            if key not in grouped:
                grouped[key] = {
                    "area": key[0],
                    "vehicle": key[1],
                    "total_orders": 0,
                    "risk_count": 0
                }

            grouped[key]["total_orders"] += 1

            if int(item.get("Predicted_Risk", 0)) == 1:
                grouped[key]["risk_count"] += 1

        result["group_count"] = len(grouped)

        step = "Sắp xếp đơn hàng khẩn cấp"

        urgent_orders = sorted(
            risk_records,
            key=lambda x: float(x["Risk_Probability"]),
            reverse=True
        )[:20]

        result["urgent_count"] = len(urgent_orders)

        result["status"] = "SUCCESS"

        return result

    except Exception as exc:
        return {
            "status": "ERROR",
            "failed_step": step,
            "error_type": type(exc).__name__,
            "error_message": str(exc),
            "last_result": result
        }