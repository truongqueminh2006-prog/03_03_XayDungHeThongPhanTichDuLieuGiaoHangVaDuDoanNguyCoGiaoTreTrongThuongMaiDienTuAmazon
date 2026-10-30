
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import (
    OneHotEncoder, StandardScaler
)
from sklearn.impute import SimpleImputer
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score,
    recall_score, f1_score,
    roc_auc_score, average_precision_score,
    confusion_matrix, ConfusionMatrixDisplay,
    RocCurveDisplay
)

# ========================================
# 1. ĐƯỜNG DẪN
# ========================================

PROJECT = Path(
    r"C:\Users\Admin\Documents\ĐH SPKT\Năm 3\HK1\Big Data\Dự án"
)

DATA_PATH = PROJECT / "Data" / "dataset_fixed_cleaned.csv"
OUTPUT = PROJECT / "classification_results"
OUTPUT.mkdir(parents=True, exist_ok=True)

if not DATA_PATH.exists():
    raise FileNotFoundError(DATA_PATH)

# ========================================
# 2. ĐỌC DỮ LIỆU
# ========================================

df = pd.read_csv(DATA_PATH)

df["order_datetime"] = pd.to_datetime(
    df["order_datetime"], errors="coerce"
)

df["Delivery_Time"] = pd.to_numeric(
    df["Delivery_Time"], errors="coerce"
)

df = df.dropna(
    subset=["order_datetime", "Delivery_Time"]
)

df = df.sort_values(
    "order_datetime"
).reset_index(drop=True)

print("Kích thước dữ liệu:", df.shape)

# ========================================
# 3. CHỌN ĐẶC TRƯNG
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

missing = [c for c in features if c not in df.columns]

if missing:
    raise ValueError(f"Thiếu cột: {missing}")

# ========================================
# 4. CHIA TRAIN / VALIDATION / TEST
# Theo ngày đặt hàng
# ========================================

dates = np.sort(
    df["order_datetime"].dt.normalize().unique()
)

if len(dates) < 7:
    raise ValueError("Không đủ ngày để chia dữ liệu.")

cut1 = dates[int(len(dates) * 0.70)]
cut2 = dates[int(len(dates) * 0.85)]

day = df["order_datetime"].dt.normalize()

train_mask = day < cut1
val_mask = (day >= cut1) & (day < cut2)
test_mask = day >= cut2

# ========================================
# 5. TẠO NHÃN PHÂN LOẠI
# Ngưỡng lấy từ tập Train
# ========================================

threshold_minutes = float(
    df.loc[train_mask, "Delivery_Time"].quantile(0.75)
)

df["Long_Delivery_Risk"] = (
    df["Delivery_Time"] > threshold_minutes
).astype(int)

print("\nNgưỡng giao hàng kéo dài:",
      threshold_minutes, "phút")

X_train = df.loc[train_mask, features]
X_val = df.loc[val_mask, features]
X_test = df.loc[test_mask, features]

y_train = df.loc[train_mask, "Long_Delivery_Risk"]
y_val = df.loc[val_mask, "Long_Delivery_Risk"]
y_test = df.loc[test_mask, "Long_Delivery_Risk"]

print("\nSỐ LƯỢNG DỮ LIỆU")
print("Train:", len(X_train))
print("Validation:", len(X_val))
print("Test:", len(X_test))

for name, y in [
    ("Train", y_train),
    ("Validation", y_val),
    ("Test", y_test)
]:
    print(
        f"{name} - Tỷ lệ nhãn 1: {y.mean():.2%}"
    )
    if y.nunique() < 2:
        raise ValueError(
            f"{name} chỉ có một lớp. "
            "Không thể đánh giá đầy đủ."
        )

# ========================================
# 6. TIỀN XỬ LÝ
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

def build_pipeline(estimator):
    return Pipeline([
        ("preprocessor", preprocessor),
        ("model", estimator)
    ])

# ========================================
# 7. KHỞI TẠO CÁC THUẬT TOÁN
# ========================================

models = {
    "Dummy": DummyClassifier(
        strategy="prior"
    ),

    "LogisticRegression": LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        random_state=42
    ),

    "RandomForest": RandomForestClassifier(
        n_estimators=200,
        max_depth=16,
        min_samples_leaf=3,
        class_weight="balanced_subsample",
        random_state=42,
        n_jobs=-1
    )
}

# ========================================
# 8. HÀM ĐÁNH GIÁ
# ========================================

def evaluate(y_true, probability, cutoff=0.5):
    predicted = (probability >= cutoff).astype(int)

    return {
        "Accuracy": accuracy_score(y_true, predicted),
        "Precision": precision_score(
            y_true, predicted, zero_division=0
        ),
        "Recall": recall_score(
            y_true, predicted, zero_division=0
        ),
        "F1": f1_score(
            y_true, predicted, zero_division=0
        ),
        "ROC_AUC": roc_auc_score(
            y_true, probability
        ),
        "PR_AUC": average_precision_score(
            y_true, probability
        )
    }

# ========================================
# 9. HUẤN LUYỆN VÀ SO SÁNH
# ========================================

results = []
trained_models = {}

for name, estimator in models.items():

    print("\nĐang huấn luyện:", name)

    pipeline = build_pipeline(estimator)
    pipeline.fit(X_train, y_train)

    probability = pipeline.predict_proba(X_val)[:, 1]
    metrics = evaluate(y_val, probability)

    results.append({
        "Model": name,
        **metrics
    })

    trained_models[name] = pipeline

    print(pd.Series(metrics).round(4).to_string())

comparison = pd.DataFrame(results)

comparison = comparison.sort_values(
    ["PR_AUC", "F1"],
    ascending=False
)

comparison.to_csv(
    OUTPUT / "classification_comparison.csv",
    index=False,
    encoding="utf-8-sig"
)

print("\nSO SÁNH CÁC MÔ HÌNH")
print(comparison.to_string(index=False))

best_name = comparison.iloc[0]["Model"]

print("\nMô hình được chọn:", best_name)

# ========================================
# 10. CHỌN NGƯỠNG XÁC SUẤT
# Dựa trên Validation
# ========================================

best_model = trained_models[best_name]

val_prob = best_model.predict_proba(X_val)[:, 1]

threshold_results = []

for cutoff in np.arange(0.20, 0.81, 0.05):
    metrics = evaluate(y_val, val_prob, cutoff)

    threshold_results.append({
        "Probability_Threshold": round(float(cutoff), 2),
        "Precision": metrics["Precision"],
        "Recall": metrics["Recall"],
        "F1": metrics["F1"]
    })

threshold_df = pd.DataFrame(threshold_results)

threshold_df.to_csv(
    OUTPUT / "threshold_comparison.csv",
    index=False,
    encoding="utf-8-sig"
)

best_cutoff = float(
    threshold_df.loc[
        threshold_df["F1"].idxmax(),
        "Probability_Threshold"
    ]
)

print("\nNgưỡng xác suất được chọn:", best_cutoff)

# ========================================
# 11. HUẤN LUYỆN MÔ HÌNH CUỐI
# ========================================

X_trainval = pd.concat([X_train, X_val])
y_trainval = pd.concat([y_train, y_val])

final_estimator = models[best_name]

final_model = build_pipeline(final_estimator)

final_model.fit(X_trainval, y_trainval)

# ========================================
# 12. ĐÁNH GIÁ TRÊN TEST
# ========================================

test_prob = final_model.predict_proba(X_test)[:, 1]

test_pred = (
    test_prob >= best_cutoff
).astype(int)

test_metrics = evaluate(
    y_test, test_prob, best_cutoff
)

print("\n===== FINAL TEST METRICS =====")

for key, value in test_metrics.items():
    print(f"{key}: {value:.4f}")

pd.DataFrame([
    {"Model": best_name,
     "Probability_Threshold": best_cutoff,
     **test_metrics}
]).to_csv(
    OUTPUT / "classification_test_metrics.csv",
    index=False,
    encoding="utf-8-sig"
)

# ========================================
# 13. CONFUSION MATRIX
# ========================================

cm = confusion_matrix(
    y_test, test_pred, labels=[0, 1]
)

disp = ConfusionMatrixDisplay(
    confusion_matrix=cm,
    display_labels=["Normal", "Long Delivery"]
)

disp.plot(cmap="Blues", values_format="d")
plt.title("Confusion Matrix - Classification")
plt.tight_layout()

plt.savefig(
    OUTPUT / "confusion_matrix.png",
    dpi=200
)
plt.close()

# ========================================
# 14. ROC CURVE
# ========================================

RocCurveDisplay.from_predictions(
    y_test,
    test_prob,
    name=best_name
)

plt.title("ROC Curve - Delivery Risk")
plt.tight_layout()

plt.savefig(
    OUTPUT / "roc_curve.png",
    dpi=200
)
plt.close()

# ========================================
# 15. LƯU DỰ ĐOÁN
# ========================================

predictions = pd.DataFrame({
    "Order_ID": df.loc[test_mask, "Order_ID"].values,
    "Actual_Delivery_Time":
        df.loc[test_mask, "Delivery_Time"].values,
    "Actual_Risk": y_test.values,
    "Risk_Probability": test_prob,
    "Predicted_Risk": test_pred
})

predictions.to_csv(
    OUTPUT / "classification_predictions.csv",
    index=False,
    encoding="utf-8-sig"
)

# ========================================
# 16. LƯU MÔ HÌNH VÀ METADATA
# ========================================

joblib.dump(
    final_model,
    OUTPUT / "delivery_risk_classifier.joblib"
)

metadata = {
    "model": best_name,
    "features": features,
    "target": "Long_Delivery_Risk",
    "delivery_threshold_minutes": threshold_minutes,
    "probability_threshold": best_cutoff,
    "test_metrics": test_metrics,
    "risk_definition": "Delivery_Time exceeds train Q3"
}

with open(
    OUTPUT / "classification_metadata.json",
    "w",
    encoding="utf-8"
) as f:
    json.dump(
        metadata, f,
        ensure_ascii=False,
        indent=2
    )

print("\nHOÀN THÀNH CLASSIFICATION!")
print("Kết quả lưu tại:", OUTPUT)
