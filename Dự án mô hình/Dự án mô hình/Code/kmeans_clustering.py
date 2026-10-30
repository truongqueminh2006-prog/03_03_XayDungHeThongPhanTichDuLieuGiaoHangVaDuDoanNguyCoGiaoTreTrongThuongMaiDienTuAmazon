
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import joblib

from sklearn.cluster import KMeans
from sklearn.preprocessing import (
    StandardScaler, OneHotEncoder
)
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.metrics import silhouette_score
from sklearn.decomposition import PCA

# ==========================================
# 1. ĐƯỜNG DẪN DỰ ÁN
# ==========================================

PROJECT = Path(
    r"C:\Users\Admin\Documents\ĐH SPKT\Năm 3\HK1\Big Data\Dự án"
)

DATA_PATH = (
    PROJECT / "Data" / "dataset_fixed_cleaned.csv"
)

OUTPUT = PROJECT / "clustering_results"
OUTPUT.mkdir(parents=True, exist_ok=True)

if not DATA_PATH.exists():
    raise FileNotFoundError(
        f"Không tìm thấy file: {DATA_PATH}"
    )

# ==========================================
# 2. ĐỌC DỮ LIỆU
# ==========================================

df = pd.read_csv(DATA_PATH)

print("Kích thước dữ liệu:", df.shape)
print("Số đơn hàng:", len(df))

# ==========================================
# 3. LỰA CHỌN ĐẶC TRƯNG
# ==========================================

numeric_features = [
    "distance_haversine_km",
    "order_hour",
    "api_temperature_2m_c",
    "api_precipitation_mm",
    "api_wind_speed_10m_kmh"
]

categorical_features = ["Traffic"]

binary_features = [
    "Vehicle_scooter",
    "Vehicle_van",
    "Area_Other",
    "Area_Semi-Urban",
    "Area_Urban"
]

features = (
    numeric_features
    + categorical_features
    + binary_features
)

required = features + ["Delivery_Time", "Order_ID"]
missing = [c for c in required if c not in df.columns]

if missing:
    raise ValueError(f"Thiếu cột: {missing}")

X = df[features].copy()

# ==========================================
# 4. TIỀN XỬ LÝ
# ==========================================

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
    ("numeric", numeric_pipeline, numeric_features),
    ("categorical", categorical_pipeline, categorical_features),
    ("binary", "passthrough", binary_features)
])

X_scaled = preprocessor.fit_transform(X)

print("Số đặc trưng sau xử lý:", X_scaled.shape[1])

# ==========================================
# 5. THỬ K TỪ 2 ĐẾN 8
# ==========================================

# Dùng mẫu cố định để tính Silhouette,
# tránh phép tính quá nặng trên toàn bộ dữ liệu.
rng = np.random.default_rng(42)
sample_size = min(3000, len(df))
sample_idx = np.sort(
    rng.choice(len(df), size=sample_size, replace=False)
)

scores = []
models = {}

for k in range(2, 9):
    print(f"\nĐang thử K = {k}")

    model = KMeans(
        n_clusters=k,
        init="k-means++",
        n_init=10,
        random_state=42
    )

    labels = model.fit_predict(X_scaled)

    score = silhouette_score(
        X_scaled[sample_idx],
        labels[sample_idx]
    )

    scores.append({
        "K": k,
        "Inertia": model.inertia_,
        "Silhouette": score
    })

    models[k] = model

    print("Inertia:", round(model.inertia_, 2))
    print("Silhouette:", round(score, 4))

# ==========================================
# 6. CHỌN K TỐT NHẤT
# ==========================================

scores_df = pd.DataFrame(scores)

scores_df.to_csv(
    OUTPUT / "k_selection_scores.csv",
    index=False,
    encoding="utf-8-sig"
)

best_k = int(
    scores_df.loc[
        scores_df["Silhouette"].idxmax(), "K"
    ]
)

best_model = models[best_k]

print("\nK tốt nhất theo Silhouette:", best_k)

# ==========================================
# 7. GÁN NHÃN CỤM
# ==========================================

df["Cluster"] = best_model.labels_

cluster_counts = (
    df["Cluster"]
    .value_counts()
    .sort_index()
    .rename_axis("Cluster")
    .reset_index(name="Total_Orders")
)

cluster_counts["Percentage"] = (
    cluster_counts["Total_Orders"] / len(df) * 100
)

cluster_counts.to_csv(
    OUTPUT / "cluster_counts.csv",
    index=False,
    encoding="utf-8-sig"
)

# ==========================================
# 8. PHÂN TÍCH ĐẶC ĐIỂM TỪNG CỤM
# ==========================================

cluster_summary = df.groupby("Cluster").agg(
    Total_Orders=("Order_ID", "count"),
    Avg_Delivery_Time=("Delivery_Time", "mean"),
    Median_Delivery_Time=("Delivery_Time", "median"),
    Avg_Distance=("distance_haversine_km", "mean"),
    Avg_Order_Hour=("order_hour", "mean"),
    Avg_Temperature=("api_temperature_2m_c", "mean"),
    Avg_Precipitation=("api_precipitation_mm", "mean"),
    Avg_Wind_Speed=("api_wind_speed_10m_kmh", "mean")
).round(3)

cluster_summary.to_csv(
    OUTPUT / "cluster_summary.csv",
    encoding="utf-8-sig"
)

# Phân bố giao thông theo cụm
traffic_distribution = pd.crosstab(
    df["Cluster"],
    df["Traffic"],
    normalize="index"
).mul(100).round(2)

traffic_distribution.to_csv(
    OUTPUT / "cluster_traffic_distribution.csv",
    encoding="utf-8-sig"
)

# Phân bố khu vực và phương tiện
group_distribution = df.groupby("Cluster")[
    binary_features
].mean().mul(100).round(2)

group_distribution.to_csv(
    OUTPUT / "cluster_group_distribution.csv",
    encoding="utf-8-sig"
)

# ==========================================
# 9. BIỂU ĐỒ ELBOW
# ==========================================

plt.figure(figsize=(8, 5))
plt.plot(
    scores_df["K"],
    scores_df["Inertia"],
    marker="o"
)

plt.xlabel("Number of Clusters (K)")
plt.ylabel("Inertia")
plt.title("Elbow Method")
plt.xticks(range(2, 9))
plt.grid(alpha=0.3)
plt.tight_layout()

plt.savefig(
    OUTPUT / "01_elbow.png",
    dpi=200
)
plt.close()

# ==========================================
# 10. BIỂU ĐỒ SILHOUETTE
# ==========================================

plt.figure(figsize=(8, 5))
plt.plot(
    scores_df["K"],
    scores_df["Silhouette"],
    marker="o"
)

plt.axvline(
    best_k,
    linestyle="--",
    label=f"Best K = {best_k}"
)

plt.xlabel("Number of Clusters (K)")
plt.ylabel("Silhouette Score")
plt.title("Silhouette Score by K")
plt.xticks(range(2, 9))
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()

plt.savefig(
    OUTPUT / "02_silhouette.png",
    dpi=200
)
plt.close()

# ==========================================
# 11. PCA TRỰC QUAN HÓA CỤM
# ==========================================

pca = PCA(n_components=2, random_state=42)
X_pca = pca.fit_transform(X_scaled)

pca_df = pd.DataFrame({
    "PCA1": X_pca[:, 0],
    "PCA2": X_pca[:, 1],
    "Cluster": df["Cluster"].values
})

pca_df.to_csv(
    OUTPUT / "pca_coordinates.csv",
    index=False,
    encoding="utf-8-sig"
)

plt.figure(figsize=(10, 7))

scatter = plt.scatter(
    pca_df["PCA1"],
    pca_df["PCA2"],
    c=pca_df["Cluster"],
    cmap="tab10",
    s=5,
    alpha=0.4
)

plt.colorbar(scatter, label="Cluster")
plt.xlabel("Principal Component 1")
plt.ylabel("Principal Component 2")
plt.title(f"K-Means Clustering - K={best_k}")
plt.tight_layout()

plt.savefig(
    OUTPUT / "03_pca_clusters.png",
    dpi=200
)
plt.close()

print(
    "PCA explained variance:",
    round(pca.explained_variance_ratio_.sum(), 4)
)

# ==========================================
# 12. BIỂU ĐỒ THỜI GIAN GIAO THEO CỤM
# ==========================================

plt.figure(figsize=(9, 5))

plt.bar(
    cluster_summary.index.astype(str),
    cluster_summary["Avg_Delivery_Time"]
)

plt.xlabel("Cluster")
plt.ylabel("Average Delivery Time (minutes)")
plt.title("Average Delivery Time by Cluster")
plt.tight_layout()

plt.savefig(
    OUTPUT / "04_cluster_delivery_time.png",
    dpi=200
)
plt.close()

# ==========================================
# 13. XUẤT FILE PHÂN CỤM
# ==========================================

df.to_csv(
    OUTPUT / "amazon_delivery_clusters.csv",
    index=False,
    encoding="utf-8-sig"
)

# Lưu cả tiền xử lý và mô hình
clustering_pipeline = Pipeline([
    ("preprocessor", preprocessor),
    ("kmeans", best_model)
])

joblib.dump(
    clustering_pipeline,
    OUTPUT / "kmeans_model.joblib"
)

joblib.dump(
    {
        "features": features,
        "best_k": best_k,
        "pca": pca
    },
    OUTPUT / "clustering_metadata.joblib"
)

print("\n===== KẾT QUẢ PHÂN CỤM =====")
print(scores_df.to_string(index=False))
print("\nTHỐNG KÊ TỪNG CỤM:")
print(cluster_summary.to_string())

print("\nHOÀN THÀNH K-MEANS!")
print("Kết quả lưu tại:", OUTPUT)
