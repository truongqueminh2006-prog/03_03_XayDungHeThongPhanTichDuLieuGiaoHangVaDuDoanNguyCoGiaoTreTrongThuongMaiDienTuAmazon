
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import (
    RandomizedSearchCV,
    TimeSeriesSplit
)
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)
from sklearn.inspection import permutation_importance

# ========================================
# 1. ĐƯỜNG DẪN DỰ ÁN
# ========================================

PROJECT = Path(
    r"C:\Users\Admin\Documents\ĐH SPKT\Năm 3\HK1\Big Data\Dự án"
)

DATA_PATH = PROJECT / "Data" / "dataset_fixed_cleaned.csv"
OUTPUT = PROJECT / "optimized_results"
OUTPUT.mkdir(parents=True, exist_ok=True)

if not DATA_PATH.exists():
    raise FileNotFoundError(
        f"Không tìm thấy dữ liệu: {DATA_PATH}"
    )

# ========================================
# 2. ĐỌC DỮ LIỆU
# ========================================

df = pd.read_csv(DATA_PATH)

print("Kích thước dữ liệu:", df.shape)

df["order_datetime"] = pd.to_datetime(
    df["order_datetime"], errors="coerce"
)

df = df.dropna(
    subset=["order_datetime", "Delivery_Time"]
)

df = df.sort_values(
    "order_datetime"
).reset_index(drop=True)

# ========================================
# 3. LỰA CHỌN ĐẶC TRƯNG
# ========================================

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

X = df[features]
y = df["Delivery_Time"]

# ========================================
# 4. CHIA TRAIN / VALIDATION / TEST
# Theo ngày để tránh trùng ngày giữa các tập
# ========================================

dates = np.sort(
    df["order_datetime"].dt.normalize().unique()
)

cut1 = dates[int(len(dates) * 0.70)]
cut2 = dates[int(len(dates) * 0.85)]

day = df["order_datetime"].dt.normalize()

train_mask = day < cut1
val_mask = (day >= cut1) & (day < cut2)
test_mask = day >= cut2

X_train, y_train = X.loc[train_mask], y.loc[train_mask]
X_val, y_val = X.loc[val_mask], y.loc[val_mask]
X_test, y_test = X.loc[test_mask], y.loc[test_mask]

print("\nSỐ LƯỢNG DỮ LIỆU")
print("Train:", len(X_train))
print("Validation:", len(X_val))
print("Test:", len(X_test))

print("\nKHOẢNG THỜI GIAN")
print("Train đến:", df.loc[train_mask, "order_datetime"].max())
print("Validation từ:", df.loc[val_mask, "order_datetime"].min())
print("Test từ:", df.loc[test_mask, "order_datetime"].min())

if min(len(X_train), len(X_val), len(X_test)) == 0:
    raise ValueError("Một tập dữ liệu rỗng. Kiểm tra lại ngày.")

# ========================================
# 5. TIỀN XỬ LÝ
# ========================================

numeric_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler())
])

categorical_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OneHotEncoder(
        handle_unknown="ignore",
        sparse_output=False
    ))
])

preprocessor = ColumnTransformer([
    ("num", numeric_pipeline, numeric_features),
    ("cat", categorical_pipeline, categorical_features),
    ("binary", "passthrough", binary_features)
])

def make_pipeline(model):
    return Pipeline([
        ("preprocessor", preprocessor),
        ("model", model)
    ])

# ========================================
# 6. HÀM ĐÁNH GIÁ
# ========================================

def evaluate(model, X_data, y_data):
    pred = model.predict(X_data)
    return {
        "MAE": mean_absolute_error(y_data, pred),
        "RMSE": np.sqrt(
            mean_squared_error(y_data, pred)
        ),
        "R2": r2_score(y_data, pred)
    }

def print_metrics(name, metrics):
    print(f"\n{name}")
    for key, value in metrics.items():
        print(f"{key}: {value:.4f}")

# ========================================
# 7. HUẤN LUYỆN RANDOM FOREST BAN ĐẦU
# ========================================

print("\nĐang huấn luyện Random Forest ban đầu...")

baseline = make_pipeline(
    RandomForestRegressor(
        n_estimators=150,
        max_depth=16,
        min_samples_leaf=3,
        random_state=42,
        n_jobs=-1
    )
)

baseline.fit(X_train, y_train)

base_train = evaluate(baseline, X_train, y_train)
base_val = evaluate(baseline, X_val, y_val)

print_metrics("Baseline - Train", base_train)
print_metrics("Baseline - Validation", base_val)

# ========================================
# 8. TỐI ƯU SIÊU THAM SỐ
# ========================================

print("\nBắt đầu RandomizedSearchCV...")

search_pipeline = make_pipeline(
    RandomForestRegressor(
        random_state=42,
        n_jobs=1
    )
)

param_distributions = {
    "model__n_estimators": [100, 150, 200, 250],
    "model__max_depth": [8, 12, 16, 20, None],
    "model__min_samples_split": [2, 5, 10],
    "model__min_samples_leaf": [2, 3, 5, 8],
    "model__max_features": ["sqrt", 0.7, 1.0]
}

tscv = TimeSeriesSplit(n_splits=3)

search = RandomizedSearchCV(
    estimator=search_pipeline,
    param_distributions=param_distributions,
    n_iter=12,
    scoring="neg_mean_absolute_error",
    cv=tscv,
    random_state=42,
    n_jobs=-1,
    verbose=1,
    refit=True
)

search.fit(X_train, y_train)

print("\nTHAM SỐ TỐT NHẤT:")
print(search.best_params_)

print(
    "CV MAE:",
    round(-search.best_score_, 4)
)

# ========================================
# 9. ĐÁNH GIÁ TRÊN VALIDATION
# ========================================

optimized = search.best_estimator_

opt_train = evaluate(optimized, X_train, y_train)
opt_val = evaluate(optimized, X_val, y_val)

print_metrics("Optimized - Train", opt_train)
print_metrics("Optimized - Validation", opt_val)

validation_comparison = pd.DataFrame([
    {"Model": "Baseline", **base_train,
     "Dataset": "Train"},
    {"Model": "Baseline", **base_val,
     "Dataset": "Validation"},
    {"Model": "Optimized", **opt_train,
     "Dataset": "Train"},
    {"Model": "Optimized", **opt_val,
     "Dataset": "Validation"}
])

validation_comparison.to_csv(
    OUTPUT / "validation_comparison.csv",
    index=False,
    encoding="utf-8-sig"
)

# ========================================
# 10. CHỌN MÔ HÌNH
# Chỉ dùng Validation, không dùng Test
# ========================================

if opt_val["MAE"] < base_val["MAE"]:
    selected_name = "Optimized"
    selected = optimized
else:
    selected_name = "Baseline"
    selected = baseline

print("\nMô hình được chọn:", selected_name)

# ========================================
# 11. HUẤN LUYỆN LẠI TRÊN TRAIN + VAL
# ========================================

X_trainval = pd.concat([X_train, X_val])
y_trainval = pd.concat([y_train, y_val])

# Tạo lại pipeline với tham số đã chọn
selected_params = selected.named_steps[
    "model"
].get_params()

final_model = make_pipeline(
    RandomForestRegressor(**selected_params)
)

final_model.fit(X_trainval, y_trainval)

# ========================================
# 12. ĐÁNH GIÁ CUỐI CÙNG TRÊN TEST
# ========================================

test_metrics = evaluate(
    final_model, X_test, y_test
)

print_metrics("FINAL MODEL - TEST", test_metrics)

pd.DataFrame([
    {"Model": selected_name, **test_metrics}
]).to_csv(
    OUTPUT / "final_test_metrics.csv",
    index=False,
    encoding="utf-8-sig"
)

# ========================================
# 13. LƯU MÔ HÌNH
# ========================================

joblib.dump(
    final_model,
    OUTPUT / "optimized_delivery_model.joblib"
)

with open(
    OUTPUT / "optimized_metadata.json",
    "w",
    encoding="utf-8"
) as f:
    json.dump({
        "selected_model": selected_name,
        "features": features,
        "target": "Delivery_Time",
        "unit": "minutes",
        "best_search_params": search.best_params_,
        "test_metrics": test_metrics
    }, f, ensure_ascii=False, indent=2)

# ========================================
# 14. LƯU KẾT QUẢ DỰ ĐOÁN
# ========================================

pred = final_model.predict(X_test)

prediction_df = pd.DataFrame({
    "Order_ID": df.loc[test_mask, "Order_ID"].values,
    "Actual": y_test.values,
    "Predicted": pred,
    "Absolute_Error": np.abs(y_test.values - pred)
})

prediction_df.to_csv(
    OUTPUT / "optimized_predictions.csv",
    index=False,
    encoding="utf-8-sig"
)

# ========================================
# 15. BIỂU ĐỒ ACTUAL VS PREDICTED
# ========================================

plt.figure(figsize=(8, 6))
plt.scatter(y_test, pred, alpha=0.25, s=12)

low = min(y_test.min(), pred.min())
high = max(y_test.max(), pred.max())

plt.plot([low, high], [low, high], "r--")

plt.xlabel("Actual Delivery Time (minutes)")
plt.ylabel("Predicted Delivery Time (minutes)")
plt.title("Final Random Forest - Actual vs Predicted")
plt.tight_layout()

plt.savefig(
    OUTPUT / "optimized_actual_vs_predicted.png",
    dpi=200
)
plt.close()

# ========================================
# 16. FEATURE IMPORTANCE
# ========================================

print("\nĐang tính Feature Importance...")

importance = permutation_importance(
    final_model,
    X_test,
    y_test,
    scoring="neg_mean_absolute_error",
    n_repeats=3,
    random_state=42,
    n_jobs=1
)

importance_df = pd.DataFrame({
    "Feature": features,
    "Importance": importance.importances_mean
}).sort_values("Importance", ascending=False)

importance_df.to_csv(
    OUTPUT / "feature_importance.csv",
    index=False,
    encoding="utf-8-sig"
)

top = importance_df.head(15).sort_values("Importance")

plt.figure(figsize=(10, 7))
plt.barh(top["Feature"], top["Importance"])
plt.xlabel("Increase in MAE when feature is shuffled")
plt.title("Top 15 Feature Importances")
plt.tight_layout()

plt.savefig(
    OUTPUT / "feature_importance.png",
    dpi=200
)
plt.close()

print("\nHOÀN THÀNH TỐI ƯU MÔ HÌNH!")
print("Kết quả lưu tại:", OUTPUT)
