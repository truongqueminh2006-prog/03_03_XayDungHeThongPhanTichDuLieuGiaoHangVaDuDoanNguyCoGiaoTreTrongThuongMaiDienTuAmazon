import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.core.dependencies import require_admin
from app.core.config import settings

router = APIRouter(
    prefix="/api/backup",
    tags=["Backup & Restore"],
    dependencies=[Depends(require_admin)],
)

MONGODUMP = (
    r"C:\Users\TRUONG QUE MINH\Downloads"
    r"\mongodb-database-tools-windows-x86_64-100.20.0"
    r"\mongodb-database-tools-windows-x86_64-100.20.0"
    r"\bin\mongodump.exe"
)


@router.get("/download")
def create_backup():
    if not Path(MONGODUMP).is_file():
        raise HTTPException(
            status_code=500,
            detail="Không tìm thấy mongodump.exe.",
        )

    backup_dir = Path(tempfile.mkdtemp(prefix="delivery_backup_"))
    dump_dir = backup_dir / "dump"
    zip_path = backup_dir / "delivery_analytics_backup.zip"

    try:
        command = [
            MONGODUMP,
            "--host", "127.0.0.1",
            "--port", "27017",
            "--db", settings.MONGODB_DATABASE,
            "--out", str(dump_dir),
        ]

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )

        if result.returncode != 0:
            raise RuntimeError(
                result.stderr[-3000:] or "mongodump thất bại."
            )

        database_dir = dump_dir / settings.MONGODB_DATABASE
        if not database_dir.is_dir():
            raise RuntimeError("Không tìm thấy dữ liệu backup.")

        with zipfile.ZipFile(
            zip_path, "w", compression=zipfile.ZIP_DEFLATED
        ) as archive:
            for file_path in database_dir.rglob("*"):
                if file_path.is_file():
                    archive.write(
                        file_path,
                        file_path.relative_to(dump_dir),
                    )

        filename = (
            "delivery_analytics_backup_"
            + datetime.now().strftime("%Y%m%d_%H%M%S")
            + ".zip"
        )

        return FileResponse(
            path=str(zip_path),
            media_type="application/zip",
            filename=filename,
            background=BackgroundTask(
                shutil.rmtree, str(backup_dir), ignore_errors=True
            ),
        )

    except subprocess.TimeoutExpired:
        shutil.rmtree(backup_dir, ignore_errors=True)
        raise HTTPException(
            status_code=504,
            detail="Sao lưu quá thời gian cho phép.",
        )
    except Exception as exc:
        shutil.rmtree(backup_dir, ignore_errors=True)
        raise HTTPException(
            status_code=500,
            detail=f"Không thể sao lưu database: {exc}",
        )
