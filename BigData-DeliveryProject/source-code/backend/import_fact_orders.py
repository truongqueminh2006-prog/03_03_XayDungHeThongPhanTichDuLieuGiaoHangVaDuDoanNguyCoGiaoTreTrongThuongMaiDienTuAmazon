
from pathlib import Path

import pandas as pd
from pymongo.errors import PyMongoError

from app.db.mongodb import db


DATA_FILE = (
    Path(__file__).resolve().parent
    / "data"
    / "Star_Schema_5_Sheets_Delivery_Data.xlsx"
)

BATCH_SIZE = 1000


def clean_value(value):
    """Convert pandas/numpy values into MongoDB-friendly Python values."""
    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    if hasattr(value, "item"):
        value = value.item()

    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime()

    return value


def main():
    if not DATA_FILE.exists():
        print(f"Khong tim thay file: {DATA_FILE}")
        return

    df = pd.read_excel(DATA_FILE, sheet_name="FactOrders")

    if "Order_ID" not in df.columns:
        print("Loi: FactOrders khong co cot Order_ID.")
        return

    if df["Order_ID"].isna().any():
        print("Loi: Co Order_ID bi thieu. Khong import.")
        return

    if df["Order_ID"].duplicated().any():
        print("Loi: File co Order_ID trung. Khong import.")
        return

    records = []
    for row in df.to_dict(orient="records"):
        record = {
            key: clean_value(value)
            for key, value in row.items()
        }
        record["Order_ID"] = str(record["Order_ID"]).strip()

        if not record["Order_ID"]:
            print("Loi: Co Order_ID rong. Khong import.")
            return

        records.append(record)

    if len({r["Order_ID"] for r in records}) != len(records):
        print("Loi: Order_ID bi trung sau khi chuan hoa.")
        return

    collection = db["orders"]

    # Only insert orders that do not already exist.
    existing_ids = {
        doc["Order_ID"]
        for doc in collection.find(
            {"Order_ID": {"$in": [r["Order_ID"] for r in records]}},
            {"_id": 0, "Order_ID": 1},
        )
    }

    new_records = [
        record for record in records
        if record["Order_ID"] not in existing_ids
    ]

    print(f"So dong trong FactOrders: {len(records)}")
    print(f"Don da ton tai, bo qua: {len(existing_ids)}")
    print(f"Don moi se them: {len(new_records)}")

    if not new_records:
        print("Khong co don moi de import.")
        print("Tong don hien co:", collection.count_documents({}))
        return

    answer = input(
        "Nhap YES de xac nhan them don moi vao MongoDB: "
    ).strip()

    if answer != "YES":
        print("Da huy. MongoDB khong thay doi.")
        return

    inserted = 0

    try:
        for start in range(0, len(new_records), BATCH_SIZE):
            batch = new_records[start:start + BATCH_SIZE]
            result = collection.insert_many(batch, ordered=True)
            inserted += len(result.inserted_ids)
            print(f"Da them {inserted}/{len(new_records)} don moi.")

        print("Import hoan tat.")
        print("So don da them:", inserted)
        print("Tong don trong MongoDB:", collection.count_documents({}))

    except PyMongoError as exc:
        print("Loi MongoDB khi import:", exc)
        print("So don da them truoc khi gap loi:", inserted)
        print("Chay lai script se bo qua cac Order_ID da ton tai.")


if __name__ == "__main__":
    main()
