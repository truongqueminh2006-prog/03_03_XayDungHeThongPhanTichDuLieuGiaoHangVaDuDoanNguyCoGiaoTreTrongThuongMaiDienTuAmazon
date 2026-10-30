import zipfile
from pathlib import PurePosixPath

from bson import decode_file_iter
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.dependencies import require_admin

router = APIRouter(
    prefix="/api/restore",
    tags=["Backup & Restore"],
    dependencies=[Depends(require_admin)],
)

MAX_BACKUP_SIZE = 500 * 1024 * 1024
REQUIRED_COLLECTIONS = {
    "orders",
    "predictions",
    "users",
    "dim_category",
    "dim_date",
    "dim_vehicle",
    "dim_weather",
}


@router.post("/validate")
def validate_backup(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(400, "Vui lòng chọn file ZIP backup.")

    try:
        content = file.file.read(MAX_BACKUP_SIZE + 1)

        if len(content) > MAX_BACKUP_SIZE:
            raise HTTPException(413, "File backup vượt quá 500 MB.")

        import io

        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            entries = archive.namelist()

            # Chỉ chấp nhận file nằm trực tiếp trong thư mục database.
            safe_entries = {}
            for name in entries:
                path = PurePosixPath(name.replace("\\", "/"))

                if path.is_absolute() or ".." in path.parts:
                    raise HTTPException(400, "ZIP chứa đường dẫn không an toàn.")

                if len(path.parts) == 2 and path.parts[0] == "delivery_analytics":
                    safe_entries[path.name] = name

            bson_files = {
                name[:-5]
                for name in safe_entries
                if name.endswith(".bson")
            }

            missing = REQUIRED_COLLECTIONS - bson_files
            if missing:
                raise HTTPException(
                    400,
                    f"Backup thiếu collection: {', '.join(sorted(missing))}",
                )

            counts = {}

            for collection in sorted(REQUIRED_COLLECTIONS):
                entry_name = safe_entries[f"{collection}.bson"]
                count = 0

                with archive.open(entry_name) as bson_file:
                    for _ in decode_file_iter(bson_file):
                        count += 1

                counts[collection] = count

            return {
                "valid": True,
                "database": "delivery_analytics",
                "collections": counts,
                "total_documents": sum(counts.values()),
                "message": "File backup hợp lệ; chưa có dữ liệu nào được khôi phục.",
            }

    except HTTPException:
        raise
    except (zipfile.BadZipFile, KeyError, ValueError) as exc:
        raise HTTPException(
            400,
            f"File backup không hợp lệ: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            400,
            f"Không thể kiểm tra file backup: {exc}",
        ) from exc

import io
import zipfile

from bson import decode_file_iter
from fastapi import File, HTTPException, UploadFile
from pymongo.errors import BulkWriteError

@router.post("/test-restore")
def restore_to_test_database(file: UploadFile = File(...)):
    """
    Restore thử nghiệm vào delivery_restore_test.
    Không ghi vào database gốc.
    Chỉ chạy khi database thử nghiệm chưa có collection.
    """
    from app.db.mongodb import db

    test_db = db.client["delivery_restore_test"]

    if test_db.list_collection_names():
        raise HTTPException(
            status_code=409,
            detail="Database thử nghiệm đã có dữ liệu; từ chối ghi đè.",
        )

    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(400, "Vui lòng chọn file ZIP backup.")

    content = file.file.read(500 * 1024 * 1024 + 1)
    if len(content) > 500 * 1024 * 1024:
        raise HTTPException(413, "File backup vượt quá 500 MB.")

    expected = {
        "orders", "predictions", "users",
        "dim_category", "dim_date", "dim_vehicle", "dim_weather",
    }

    inserted = {}

    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            entries = archive.namelist()
            bson_paths = {}

            for name in entries:
                normalized = name.replace("\\", "/")
                parts = normalized.split("/")

                if ".." in parts or normalized.startswith("/"):
                    raise HTTPException(400, "ZIP chứa đường dẫn không an toàn.")

                if (
                    len(parts) == 2
                    and parts[0] == "delivery_analytics"
                    and parts[1].endswith(".bson")
                ):
                    collection = parts[1][:-5]
                    bson_paths[collection] = name

            missing = expected - set(bson_paths)
            if missing:
                raise HTTPException(
                    400,
                    f"Backup thiếu collection: {', '.join(sorted(missing))}",
                )

            # Kiểm tra toàn bộ BSON trước khi ghi bất kỳ dữ liệu nào.
            for collection in sorted(expected):
                with archive.open(bson_paths[collection]) as stream:
                    for _ in decode_file_iter(stream):
                        pass

            # Ghi theo lô để tránh nạp toàn bộ 40.000 đơn vào RAM.
            for collection in sorted(expected):
                count = 0
                batch = []

                with archive.open(bson_paths[collection]) as stream:
                    for document in decode_file_iter(stream):
                        batch.append(document)

                        if len(batch) >= 500:
                            test_db[collection].insert_many(
                                batch, ordered=True
                            )
                            count += len(batch)
                            batch = []

                    if batch:
                        test_db[collection].insert_many(
                            batch, ordered=True
                        )
                        count += len(batch)

                inserted[collection] = count
        # Xác minh số bản ghi thực tế trong database thử nghiệm.
        for collection, expected_count in inserted.items():
            actual_count = test_db[collection].count_documents({})

            if actual_count != expected_count:
                raise RuntimeError(
                    f"Collection {collection}: "
                    f"mong đợi {expected_count}, thực tế {actual_count}."
                )
        return {
            "success": True,
            "database": "delivery_restore_test",
            "collections": inserted,
            "total_documents": sum(inserted.values()),
            "message": "Restore thử nghiệm hoàn tất; database gốc không bị thay đổi.",
        }
        return {
            "success": True,
            "database": "delivery_restore_test",
            "collections": inserted,
            "total_documents": sum(inserted.values()),
            "message": "Restore thử nghiệm hoàn tất; database gốc không bị thay đổi.",
        }
    except HTTPException:
        raise
    except (zipfile.BadZipFile, ValueError) as exc:
        raise HTTPException(
            400, f"File backup không hợp lệ: {exc}"
        ) from exc
    except Exception as exc:
        # Không tự động xóa database khi có lỗi.
        # Giữ nguyên dữ liệu để kiểm tra và xử lý thủ công.
        raise HTTPException(
            500,
            f"Restore thử nghiệm thất bại. "
            f"Database thử nghiệm có thể đã nhập một phần dữ liệu; "
            f"hãy kiểm tra trước khi thử lại. Chi tiết: {exc}",
        ) from exc
