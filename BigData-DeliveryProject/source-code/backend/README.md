# Delivery Analytics API — Backend & Database

## 1. Giới thiệu

Backend của dự án BigData-DeliveryProject được xây dựng bằng Python và FastAPI, sử dụng MongoDB để lưu trữ và truy vấn dữ liệu giao hàng.

Các chức năng chính:

- Kết nối và kiểm tra trạng thái MongoDB.
- Truy vấn danh sách và chi tiết đơn hàng.
- Tìm kiếm, lọc và phân trang đơn hàng.
- Thêm, cập nhật và xóa đơn hàng.
- Đăng nhập và xác thực bằng JWT.
- Phân quyền người dùng theo vai trò `admin` và `user`.
- Thống kê tổng quan dữ liệu đơn hàng.

## 2. Công nghệ sử dụng

- Python 3.12
- FastAPI
- Uvicorn
- MongoDB
- PyMongo
- python-dotenv
- JWT phục vụ xác thực API

## 3. Cấu trúc thư mục

```text
backend/
├── app/
│   ├── api/
│   │   ├── auth.py
│   │   └── orders.py
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   └── db/
│       └── mongodb.py
├── data/
├── scripts/
├── .env.example
├── .gitignore
├── main.py
└── README.md
```

Cấu trúc trên mô tả các thành phần chính; những thư mục hoặc tệp bổ sung có thể được giữ lại theo mã nguồn thực tế.

## 4. Yêu cầu môi trường

Trước khi chạy backend, cần chuẩn bị:

1. Python 3.12.
2. MongoDB Server đang hoạt động.
3. Cơ sở dữ liệu `delivery_analytics` và dữ liệu đã được nạp.
4. Các thư viện Python cần thiết.
5. File `.env` chứa cấu hình môi trường hợp lệ.

## 5. Cài đặt và cấu hình

Mở PowerShell tại thư mục backend:

```powershell
cd E:\BigData-DeliveryProject\source-code\backend
```

### 5.1. Tạo môi trường ảo

Nếu chưa có môi trường ảo:

```powershell
py -3.12 -m venv .venv
```

### 5.2. Cài đặt thư viện

```powershell
.\.venv\Scripts\python.exe -m pip install fastapi uvicorn pymongo python-dotenv
```

Nếu dự án có tệp `requirements.txt`, nên cài các phiên bản thư viện được quy định trong tệp đó.

### 5.3. Cấu hình biến môi trường

Sao chép `.env.example` thành `.env`, sau đó kiểm tra các giá trị:

- `MONGODB_URI`: địa chỉ kết nối MongoDB.
- `MONGODB_DATABASE`: tên cơ sở dữ liệu.
- `JWT_SECRET_KEY`: khóa bí mật mạnh, không để trống.
- `JWT_ALGORITHM`: thuật toán ký token, mặc định `HS256`.

Không chia sẻ khóa bí mật và không đưa `.env` lên kho mã nguồn công khai.

## 6. Khởi chạy backend

Đảm bảo MongoDB đang hoạt động, sau đó chạy:

```powershell
$env:PYTHONPATH = (Get-Location).Path
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Địa chỉ mặc định:

- API: `http://127.0.0.1:8000`
- Swagger UI: `http://127.0.0.1:8000/docs`

Dừng máy chủ bằng `Ctrl + C`.

## 7. Các API chính

| Phương thức | Endpoint | Chức năng |
|---|---|---|
| GET | `/` | Kiểm tra endpoint gốc |
| GET | `/health` | Kiểm tra trạng thái ứng dụng |
| GET | `/health/db` | Kiểm tra kết nối cơ sở dữ liệu |
| POST | `/api/auth/login` | Đăng nhập, nhận JWT |
| GET | `/api/orders/` | Danh sách đơn hàng |
| GET | `/api/orders/search/filter` | Tìm kiếm và lọc đơn hàng |
| GET | `/api/orders/stats/summary` | Thống kê tổng quan đơn hàng |
| GET | `/api/orders/{order_id}` | Xem chi tiết đơn hàng |
| POST | `/api/orders/` | Thêm đơn hàng |
| PUT | `/api/orders/{order_id}` | Cập nhật đơn hàng |
| DELETE | `/api/orders/{order_id}` | Xóa đơn hàng |

Các API quản lý đơn hàng yêu cầu xác thực theo cấu hình hiện tại. Những thao tác thêm, cập nhật và xóa được giới hạn cho vai trò quản trị viên.

## 8. Đăng nhập và xác thực

Gửi yêu cầu `POST /api/auth/login` với nội dung JSON:

```json
{
  "username": "your_username",
  "password": "your_password"
}
```

Khi đăng nhập thành công, API trả về:

```json
{
  "access_token": "<JWT_TOKEN>",
  "token_type": "bearer",
  "expires_in": 1800
}
```

Giá trị minh họa trên không phải thông tin tài khoản thật. Token có thời hạn mặc định 1.800 giây, tương đương 30 phút.

Trong Swagger UI, sử dụng chức năng **Authorize** để cung cấp Bearer token trước khi gọi các endpoint yêu cầu đăng nhập.

Tài khoản phải tồn tại trong collection `users`, có mật khẩu đã được băm đúng định dạng và vai trò hợp lệ (`admin` hoặc `user`).

## 9. Thống kê dữ liệu

Endpoint `GET /api/orders/stats/summary` trả về các nhóm thông tin:

- Tổng số đơn hàng.
- Số lượng đơn hàng theo tình trạng giao thông.
- Số lượng đơn hàng theo khu vực.
- Số lượng đơn hàng theo loại phương tiện.
- Số lượng đơn hàng theo danh mục.
- Số lượng bản ghi và các chỉ số thời gian giao hàng.

Trong lần kiểm thử đã ghi nhận 39.997 đơn hàng. Kết quả có thể thay đổi khi dữ liệu trong MongoDB được cập nhật.

## 10. Phân quyền và xử lý lỗi

- `401 Unauthorized`: chưa xác thực hoặc thông tin đăng nhập không hợp lệ.
- `403 Forbidden`: tài khoản không có quyền thực hiện thao tác.
- `404 Not Found`: không tìm thấy tài nguyên.
- `400 Bad Request`: yêu cầu không hợp lệ theo quy tắc xử lý của API.
- `503 Service Unavailable`: không thể thực hiện truy vấn thống kê do lỗi MongoDB, nếu phát sinh lỗi thuộc nhóm được xử lý.

Phân quyền được kiểm tra tại backend, không chỉ dựa vào việc ẩn hoặc hiện nút trên giao diện.

## 11. Bảo mật

- Không lưu mật khẩu dạng văn bản thuần trong cơ sở dữ liệu.
- Không chia sẻ JWT, mật khẩu hoặc khóa bí mật.
- Không đưa `.env` và môi trường `.venv` vào bản mã nguồn chia sẻ.
- Sử dụng khóa JWT mạnh và cấu hình phù hợp trước khi triển khai thực tế.
- Kiểm tra quyền truy cập tại backend đối với các thao tác cần phân quyền.

## 12. Kiểm thử

Có thể kiểm thử API qua Swagger UI tại `http://127.0.0.1:8000/docs`.

Nên kiểm tra:

1. Trạng thái kết nối MongoDB.
2. Đăng nhập thành công và thất bại.
3. Truy vấn danh sách, chi tiết và lọc đơn hàng.
4. Kết quả thống kê tổng quan.
5. Thao tác CRUD với tài khoản quản trị viên.
6. Từ chối truy cập khi chưa đăng nhập hoặc không đủ quyền.