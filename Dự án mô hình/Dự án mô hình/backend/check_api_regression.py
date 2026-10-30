
from pathlib import Path
import json
import joblib
import pandas as pd

BASE = Path(__file__).resolve().parent
PROJECT = BASE.parent

DATA_PATH = PROJECT / "Data" / "dataset_fixed_cleaned.csv"
MODEL_PATH = BASE / "models" / "optimized_delivery_model.joblib"
META_PATH = BASE / "models" / "optimized_metadata.json"

df = pd.read_csv(DATA_PATH)

model = joblib.load(MODEL_PATH)

with open(META_PATH, encoding="utf-8") as f:
    metadata = json.load(f)

features = metadata["features"]

# Chọn một đơn hàng thực tế có đủ thông tin
valid = df.dropna(subset=["Delivery_Time"])

row = valid.iloc[[0]].copy()

X = row[features]

prediction = model.predict(X)[0]
actual = row["Delivery_Time"].iloc[0]

print("\n===== KIỂM TRA MÔ HÌNH =====")
print("Order ID:", row["Order_ID"].iloc[0])
print("Actual:", actual)
print("Predicted:", round(prediction, 2))
print("Absolute Error:", round(abs(actual - prediction), 2))

print("\n===== ĐẶC TRƯNG ĐẦU VÀO =====")
for feature in features:
    print(f"{feature}: {row[feature].iloc[0]}")
