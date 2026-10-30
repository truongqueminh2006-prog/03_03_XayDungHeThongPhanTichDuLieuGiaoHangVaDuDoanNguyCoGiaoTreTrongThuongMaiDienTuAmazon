
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.dummy import DummyRegressor
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)

# =====================================
# 1. ĐỌC DỮ LIỆU
# =====================================

BASE = Path(__file__).resolve().parent
DATA_PATH = BASE / "dataset_fixed_cleaned.csv"
OUTPUT = BASE / "model_results"
OUTPUT.mkdir(exist_ok=True)

df = pd.read_csv(DATA_PATH)

print("Số dòng, số cột:", df.shape)
print("Số Order_ID trùng:", df["Order_ID"].duplicated().sum())

# =====================================
# 2. CHỌN ĐẶC TRƯNG
# =====================================

numeric_features = [
    "Agent_Age",
    "Agent_Rating",
    "order_hour",
    "day_of_week",
    "is_weekend",
    "distance_haversine_km",
    "api_temperature_2m_c",
    "api_precipitation_mm",
    "api_wind_speed_10m_kmh"
]

categorical_features = ["Traffic"]

binary_features = [
    c for c in df.columns
    if c.startswith(("Vehicle_", "Area_", "Category_"))
]

features = (
    numeric_features
    + categorical_features
    + binary_features
)

target = "Delivery_Time"

# Kiểm tra các cột
missing_cols = [
    c for c in features + [target, "order_datetime"]
    if c not in df.columns
]
if missing_cols:
    raise ValueError(f"Thiếu cột: {missing_cols}")

# =====================================
# 3. CHIA TRAIN / TEST THEO THỜI GIAN
# =====================================

df["order_datetime"] = pd.to_datetime(
    df["order_datetime"], errors="coerce"
)

df = df.dropna(
    subset=["order_datetime", target]
).sort_values("order_datetime").reset_index(drop=True)

# Tránh chia cùng một thời điểm sang hai tập.
unique_dates = np.sort(
    df["order_datetime"].dt.normalize().unique()
)
cutoff_date = unique_dates[int(len(unique_dates) * 0.8)]

train_mask = (
    df["order_datetime"].dt.normalize() < cutoff_date
)

train_df = df.loc[train_mask]
test_df = df.loc[~train_mask]

X_train = train_df[features].copy()
X_test = test_df[features].copy()
y_train = train_df[target]
y_test = test_df[target]

print("Train:", X_train.shape)
print("Test:", X_test.shape)
print("Train đến:", train_df["order_datetime"].max())
print("Test từ:", test_df["order_datetime"].min())

# =====================================
# 4. TIỀN XỬ LÝ
# =====================================

numeric_transformer = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler())
])

categorical_transformer = Pipeline([
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("onehot", OneHotEncoder(
        handle_unknown="ignore",
        sparse_output=False
    ))
])

preprocessor = ColumnTransformer([
    ("num", numeric_transformer, numeric_features),
    ("cat", categorical_transformer, categorical_features),
    ("binary", "passthrough", binary_features)
])

# =====================================
# 5. KHỞI TẠO MÔ HÌNH
# =====================================

models = {
    "Dummy": DummyRegressor(strategy="mean"),

    "LinearRegression": LinearRegression(),

    "RandomForest": RandomForestRegressor(
        n_estimators=150,
        max_depth=16,
        min_samples_leaf=3,
        random_state=42,
        n_jobs=-1
    )
}

results = []
trained_models = {}

# =====================================
# 6. HUẤN LUYỆN VÀ ĐÁNH GIÁ
# =====================================

for name, estimator in models.items():

    print(f"\nĐang huấn luyện: {name}")

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("model", estimator)
    ])

    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    results.append({
        "Model": name,
        "MAE": mae,
        "RMSE": rmse,
        "R2": r2
    })

    trained_models[name] = pipeline

    print(f"MAE: {mae:.3f}")
    print(f"RMSE: {rmse:.3f}")
    print(f"R2: {r2:.3f}")

# =====================================
# 7. SO SÁNH CÁC MÔ HÌNH
# =====================================

comparison = pd.DataFrame(results).sort_values("MAE")

comparison.to_csv(
    OUTPUT / "model_comparison.csv",
    index=False,
    encoding="utf-8-sig"
)

print("\nBẢNG SO SÁNH:")
print(comparison.to_string(index=False))

best_name = comparison.iloc[0]["Model"]
best_model = trained_models[best_name]

print("\nMô hình có MAE thấp nhất:", best_name)

# =====================================
# 8. LƯU MÔ HÌNH
# =====================================

joblib.dump(
    best_model,
    OUTPUT / "best_delivery_model.joblib"
)

with open(
    OUTPUT / "model_metadata.json",
    "w",
    encoding="utf-8"
) as f:
    json.dump({
        "model": best_name,
        "target": target,
        "features": features,
        "unit": "minutes",
        "evaluation": "chronological holdout"
    }, f, ensure_ascii=False, indent=2)

# =====================================
# 9. XUẤT DỰ ĐOÁN
# =====================================

predictions = best_model.predict(X_test)

pred_df = pd.DataFrame({
    "Order_ID": test_df["Order_ID"].to_numpy(),
    "Actual": y_test.to_numpy(),
    "Predicted": predictions,
    "Absolute_Error": np.abs(
        y_test.to_numpy() - predictions
    )
})

pred_df.to_csv(
    OUTPUT / "test_predictions.csv",
    index=False,
    encoding="utf-8-sig"
)

# =====================================
# 10. BIỂU ĐỒ THỰC TẾ VS DỰ ĐOÁN
# =====================================

plt.figure(figsize=(8, 6))
plt.scatter(
    y_test,
    predictions,
    alpha=0.25,
    s=12
)

low = min(y_test.min(), predictions.min())
high = max(y_test.max(), predictions.max())

plt.plot([low, high], [low, high], "r--")

plt.xlabel("Actual Delivery Time (minutes)")
plt.ylabel("Predicted Delivery Time (minutes)")
plt.title(f"Actual vs Predicted - {best_name}")
plt.tight_layout()

plt.savefig(
    OUTPUT / "actual_vs_predicted.png",
    dpi=200
)
plt.close()

print("\nHOÀN THÀNH!")
print("Kết quả lưu tại:", OUTPUT)
