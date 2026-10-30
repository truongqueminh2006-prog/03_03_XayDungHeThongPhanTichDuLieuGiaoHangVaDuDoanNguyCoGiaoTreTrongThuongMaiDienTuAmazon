
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

# 1. Đường dẫn đến file CSV đã làm sạch
CSV_PATH = Path(
    r"C:\Users\Admin\Documents\ĐH SPKT\Năm 3\HK1\Big Data\Dự án\Data\dataset_fixed_cleaned.csv"
)

# 2. Thông tin kết nối PostgreSQL
DB_USER = "postgres"
DB_PASSWORD = "thang107"
DB_HOST = "localhost"
DB_PORT = 5432
DB_NAME = "amazon_delivery_db"
TABLE_NAME = "delivery_orders"


def main():
    # Kiểm tra file đầu vào
    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"Không tìm thấy file CSV: {CSV_PATH}"
        )

    # Đọc dữ liệu
    print("Đang đọc dữ liệu CSV...")
    df = pd.read_csv(CSV_PATH)

    print(f"Số dòng: {len(df):,}")
    print(f"Số cột: {len(df.columns)}")

    # Kiểm tra tên cột trùng lặp
    if df.columns.duplicated().any():
        duplicates = df.columns[
            df.columns.duplicated()
        ].tolist()
        raise ValueError(
            f"Có tên cột trùng lặp: {duplicates}"
        )

    # Tạo kết nối an toàn hơn với mật khẩu có ký tự đặc biệt
    connection_url = URL.create(
        drivername="postgresql+psycopg",
        username=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
    )

    engine = create_engine(connection_url)

    try:
        # Kiểm tra kết nối
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("Kết nối PostgreSQL thành công!")

        # Nhập dữ liệu theo từng lô
        # Lưu ý: replace sẽ xóa bảng cũ nếu bảng đã tồn tại.
        print("Đang nhập dữ liệu vào database...")

        df.to_sql(
    name=TABLE_NAME,
    con=engine,
    index=False,
    chunksize=1000,
    method="multi",
)

        print("Nhập dữ liệu thành công!")

        # Kiểm tra số dòng thực tế trong database
        with engine.connect() as connection:
            result = connection.execute(
                text("SELECT COUNT(*) FROM delivery_orders")
            )
            row_count = result.scalar_one()

        print(f"Số dòng trong database: {row_count:,}")

        # Xem thử 5 bản ghi đầu tiên
        preview = pd.read_sql(
            text("SELECT * FROM delivery_orders LIMIT 5"),
            engine,
        )
        print("\n5 bản ghi đầu tiên:")
        print(preview.to_string(index=False))

    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
