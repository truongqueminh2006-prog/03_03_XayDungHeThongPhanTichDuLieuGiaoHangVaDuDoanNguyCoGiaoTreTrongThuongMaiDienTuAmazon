
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pymongo.errors import PyMongoError

from app.core.dependencies import get_current_user, require_admin
from app.db.mongodb import db


router = APIRouter(
    prefix="/api/orders",
    tags=["Orders"],
)


# 1. GET: Danh sach don hang - yeu cau dang nhap
@router.get("/")
def get_orders(
    limit: int = Query(default=1000, ge=1, le=1000),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """Get a paginated list of orders from MongoDB."""
    try:
        collection = db["orders"]
        total = collection.count_documents({})

        documents = list(
            collection.find({}, {"_id": 0})
            .sort("Order_ID", 1)
            .skip(skip)
            .limit(limit)
        )

        return {
            "total": total,
            "limit": limit,
            "skip": skip,
            "count": len(documents),
            "data": documents,
        }

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to retrieve orders from database.",
        ) from exc


# 2. GET: Tim kiem va loc don hang - yeu cau dang nhap
# Dat route nay truoc /{order_id} de tranh bi bat nham
@router.get("/search/filter")
def search_orders(
    traffic: str | None = None,
    area: str | None = None,
    vehicle_key: int | None = None,
    category_key: int | None = None,
    min_delivery_time: float | None = Query(default=None, ge=0),
    max_delivery_time: float | None = Query(default=None, ge=0),
    limit: int = Query(default=1000, ge=1, le=1000),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """Search and filter orders."""
    if (
        min_delivery_time is not None
        and max_delivery_time is not None
        and min_delivery_time > max_delivery_time
    ):
        raise HTTPException(
            status_code=400,
            detail="Minimum delivery time cannot exceed maximum.",
        )

    try:
        collection = db["orders"]
        filters = {}

        if traffic:
            filters["Traffic"] = {
                "$regex": traffic,
                "$options": "i",
            }

        if area:
            filters["Area"] = {
                "$regex": area,
                "$options": "i",
            }

        if vehicle_key is not None:
            filters["VehicleKey"] = vehicle_key

        if category_key is not None:
            filters["CategoryKey"] = category_key

        delivery_time_filter = {}

        if min_delivery_time is not None:
            delivery_time_filter["$gte"] = min_delivery_time

        if max_delivery_time is not None:
            delivery_time_filter["$lte"] = max_delivery_time

        if delivery_time_filter:
            filters["Delivery_Time"] = delivery_time_filter

        total = collection.count_documents(filters)

        documents = list(
            collection.find(filters, {"_id": 0})
            .sort("Order_ID", 1)
            .skip(skip)
            .limit(limit)
        )

        return {
            "total": total,
            "limit": limit,
            "skip": skip,
            "count": len(documents),
            "filters": {
                "traffic": traffic,
                "area": area,
                "vehicle_key": vehicle_key,
                "category_key": category_key,
                "min_delivery_time": min_delivery_time,
                "max_delivery_time": max_delivery_time,
            },
            "data": documents,
        }

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to search orders in database.",
        ) from exc


# API thống kê tổng quan đơn hàng - yêu cầu đăng nhập
@router.get("/stats/summary")
def get_orders_summary(
    current_user: dict = Depends(get_current_user),
):
    """Return summary statistics for delivery orders."""
    try:
        collection = db["orders"]

        total_orders = collection.count_documents({})

        def count_by(field: str):
            pipeline = [
                {
                    "$group": {
                        "_id": {"$ifNull": [f"${field}", "Unknown"]},
                        "count": {"$sum": 1},
                    }
                },
                {"$sort": {"count": -1}},
            ]
            return [
                {"value": item["_id"], "count": item["count"]}
                for item in collection.aggregate(pipeline)
            ]

        delivery_pipeline = [
            {
                "$group": {
                    "_id": None,
                    "count": {
                        "$sum": {
                            "$cond": [
                                {"$isNumber": "$Delivery_Time"},
                                1,
                                0,
                            ]
                        }
                    },
                    "average": {"$avg": "$Delivery_Time"},
                    "minimum": {"$min": "$Delivery_Time"},
                    "maximum": {"$max": "$Delivery_Time"},
                }
            }
        ]

        delivery_result = list(collection.aggregate(delivery_pipeline))
        delivery_stats = (
            {
                "count": delivery_result[0]["count"],
                "average": delivery_result[0]["average"],
                "minimum": delivery_result[0]["minimum"],
                "maximum": delivery_result[0]["maximum"],
            }
            if delivery_result
            else {
                "count": 0,
                "average": None,
                "minimum": None,
                "maximum": None,
            }
        )

        # Lấy tên danh mục từ collection dim_category
        category_collection = db["dim_category"]
        category_map = {
            str(item["CategoryKey"]): item["CategoryName"]
            for item in category_collection.find(
            {},
            {"_id": 0, "CategoryKey": 1, "CategoryName": 1}
            )
        }

        # Chuyển CategoryKey thành CategoryName
        category_counts = count_by("CategoryKey")
        by_category = [
            {
                "value": category_map.get(str(item["value"]), "Unknown"),
                "count": item["count"]
            }
            for item in category_counts
        ]

        return {
            "total_orders": total_orders,
            "by_traffic": count_by("Traffic"),
            "by_area": count_by("Area"),
            "by_vehicle": count_by("VehicleKey"),
            "by_category": by_category,
            "delivery_time": delivery_stats,
        }

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to calculate order statistics.",
        ) from exc
# API Dashboard Overview - phuc vu trang Tong quan Power BI
@router.get("/dashboard/overview")
def get_dashboard_overview(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    area: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    """Return overview analytics with date and area filters."""

    try:
        orders_collection = db["orders"]
        date_collection = db["dim_date"]

        # 1. Lay khoang ngay mac dinh tu dim_date
        date_bounds = list(
            date_collection.aggregate([
                {
                    "$group": {
                        "_id": None,
                        "minimum": {"$min": "$DateKey"},
                        "maximum": {"$max": "$DateKey"},
                    }
                }
            ])
        )

        if not date_bounds:
            raise HTTPException(
                status_code=404,
                detail="Date dimension is empty.",
            )

        min_date_key = date_bounds[0]["minimum"]
        max_date_key = date_bounds[0]["maximum"]

        # 2. Chuyen ngay YYYY-MM-DD thanh DateKey
        def to_date_key(value, default):
            if value is None:
                return default

            try:
                return int(datetime.strptime(value, "%Y-%m-%d").strftime("%Y%m%d"))
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Date must use YYYY-MM-DD format.",
                )

        start_key = to_date_key(start_date, min_date_key)
        end_key = to_date_key(end_date, max_date_key)

        if start_key > end_key:
            raise HTTPException(
                status_code=400,
                detail="start_date cannot be after end_date.",
            )

        if start_key < min_date_key or end_key > max_date_key:
            raise HTTPException(
                status_code=400,
                detail="Selected dates are outside available data range.",
            )

        # 3. Tao dieu kien loc don hang
        filters = {
            "DateKey": {
                "$gte": start_key,
                "$lte": end_key,
            }
        }

        if area:
            filters["Area"] = area

        # 4. Tinh KPI tong quan
        kpi_pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": None,
                    "total_orders": {"$sum": 1},
                    "average_delivery_time": {"$avg": "$Delivery_Time"},
                    "average_distance": {
                        "$avg": "$distance_haversine_km"
                    },
                    "average_prep_time": {"$avg": "$prep_time_min"},
                }
            }
        ]

        kpi_result = list(orders_collection.aggregate(kpi_pipeline))

        if kpi_result:
            kpi = {
                "total_orders": kpi_result[0]["total_orders"],
                "average_delivery_time": round(
                    kpi_result[0]["average_delivery_time"], 2
                ) if kpi_result[0]["average_delivery_time"] is not None else None,
                "average_distance": round(
                    kpi_result[0]["average_distance"], 2
                ) if kpi_result[0]["average_distance"] is not None else None,
                "average_prep_time": round(
                    kpi_result[0]["average_prep_time"], 2
                ) if kpi_result[0]["average_prep_time"] is not None else None,
            }
        else:
            kpi = {
                "total_orders": 0,
                "average_delivery_time": None,
                "average_distance": None,
                "average_prep_time": None,
            }

        # Ham thong ke theo mot truong
        def aggregate_by(field):
            pipeline = [
                {"$match": filters},
                {
                    "$group": {
                        "_id": {"$ifNull": [f"${field}", "Unknown"]},
                        "count": {"$sum": 1},
                        "average_delivery_time": {"$avg": "$Delivery_Time"},
                    }
                },
                {"$sort": {"count": -1}},
            ]

            return list(orders_collection.aggregate(pipeline))

        # 5. Thong ke xu huong theo ngay
        daily_pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": "$DateKey",
                    "order_count": {"$sum": 1},
                    "average_delivery_time": {"$avg": "$Delivery_Time"},
                }
            }
        ]

        daily_results = {
            item["_id"]: item
            for item in orders_collection.aggregate(daily_pipeline)
        }

        # Lay toan bo ngay trong dim_date, ke ca ngay khong co don
        date_documents = list(
            date_collection.find(
                {
                    "DateKey": {
                        "$gte": start_key,
                        "$lte": end_key,
                    }
                },
                {"_id": 0, "DateKey": 1, "FullDate": 1}
            ).sort("DateKey", 1)
        )

        daily_trend = []

        for date_item in date_documents:
            key = date_item["DateKey"]
            result = daily_results.get(key, {})

            daily_trend.append({
                "date": date_item["FullDate"],
                "date_key": key,
                "order_count": result.get("order_count", 0),
                "average_delivery_time": round(
                    result["average_delivery_time"], 2
                ) if result.get("average_delivery_time") is not None else None,
            })

        # 6. Anh xa ten thoi tiet
        weather_map = {
            item["WeatherKey"]: item["WeatherType"]
            for item in db["dim_weather"].find(
                {}, {"_id": 0, "WeatherKey": 1, "WeatherType": 1}
            )
        }

        by_weather = [
            {
                "value": weather_map.get(item["_id"], "Unknown"),
                "count": item["count"],
                "average_delivery_time": round(
                    item["average_delivery_time"], 2
                ) if item["average_delivery_time"] is not None else None,
            }
            for item in aggregate_by("WeatherKey")
        ]

        # 7. Thong ke theo giao thong
        by_traffic = [
            {
                "value": item["_id"],
                "count": item["count"],
                "average_delivery_time": round(
                    item["average_delivery_time"], 2
                ) if item["average_delivery_time"] is not None else None,
            }
            for item in aggregate_by("Traffic")
        ]

        # 8. Anh xa ten danh muc san pham
        category_map = {
            str(item["CategoryKey"]): item["CategoryName"]
            for item in db["dim_category"].find(
                {}, {"_id": 0, "CategoryKey": 1, "CategoryName": 1}
            )
        }

        by_category = [
            {
                "value": category_map.get(str(item["_id"]), "Unknown"),
                "count": item["count"],
            }
            for item in aggregate_by("CategoryKey")
        ]

        # 9. Anh xa ten phuong tien
        vehicle_map = {
            item["VehicleKey"]: item["VehicleType"]
            for item in db["dim_vehicle"].find(
                {}, {"_id": 0, "VehicleKey": 1, "VehicleType": 1}
            )
        }

        # 10. Thoi gian giao theo phuong tien va khu vuc
        vehicle_area_pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": {
                        "vehicle": "$VehicleKey",
                        "area": "$Area",
                    },
                    "order_count": {"$sum": 1},
                    "average_delivery_time": {"$avg": "$Delivery_Time"},
                }
            },
            {"$sort": {"_id.area": 1, "_id.vehicle": 1}},
        ]

        vehicle_area_results = list(
            orders_collection.aggregate(vehicle_area_pipeline)
        )

        by_vehicle_area = [
            {
                "vehicle": vehicle_map.get(
                    item["_id"]["vehicle"], "Unknown"
                ),
                "vehicle_key": item["_id"]["vehicle"],
                "area": item["_id"]["area"],
                "order_count": item["order_count"],
                "average_delivery_time": round(
                    item["average_delivery_time"], 2
                ) if item["average_delivery_time"] is not None else None,
            }
            for item in vehicle_area_results
        ]

        return {
            "filters": {
                "start_date": str(start_key),
                "end_date": str(end_key),
                "area": area,
            },
            "kpi": kpi,
            "daily_trend": daily_trend,
            "by_weather": by_weather,
            "by_traffic": by_traffic,
            "by_category": by_category,
            "by_vehicle_area": by_vehicle_area,
        }

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to calculate dashboard overview.",
        ) from exc
# API Dashboard Phan tich theo khu vuc va phuong tien - Trang 3
@router.get("/dashboard/area-vehicle")
def get_area_vehicle_dashboard(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    area: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    """Return area and vehicle analytics for dashboard page 3."""

    try:
        orders_collection = db["orders"]
        date_collection = db["dim_date"]

        # 1. Lay gioi han ngay tu dim_date
        date_bounds = list(
            date_collection.aggregate([
                {
                    "$group": {
                        "_id": None,
                        "minimum": {"$min": "$DateKey"},
                        "maximum": {"$max": "$DateKey"},
                    }
                }
            ])
        )

        if not date_bounds:
            raise HTTPException(
                status_code=404,
                detail="Date dimension is empty.",
            )

        min_date_key = date_bounds[0]["minimum"]
        max_date_key = date_bounds[0]["maximum"]

        # 2. Chuyen ngay YYYY-MM-DD thanh DateKey
        def to_date_key(value, default):
            if value is None:
                return default

            try:
                return int(
                    datetime.strptime(
                        value, "%Y-%m-%d"
                    ).strftime("%Y%m%d")
                )
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Date must use YYYY-MM-DD format.",
                )

        start_key = to_date_key(start_date, min_date_key)
        end_key = to_date_key(end_date, max_date_key)

        if start_key > end_key:
            raise HTTPException(
                status_code=400,
                detail="start_date cannot be after end_date.",
            )

        if start_key < min_date_key or end_key > max_date_key:
            raise HTTPException(
                status_code=400,
                detail="Selected dates are outside available data range.",
            )

        # 3. Dieu kien loc
        filters = {
            "DateKey": {
                "$gte": start_key,
                "$lte": end_key,
            }
        }

        if area:
            filters["Area"] = area

        # 4. Lay ten phuong tien tu dim_vehicle
        vehicle_map = {
            item["VehicleKey"]: item["VehicleType"]
            for item in db["dim_vehicle"].find(
                {},
                {"_id": 0, "VehicleKey": 1, "VehicleType": 1},
            )
        }

        # 5. KPI tong the
        kpi_pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": None,
                    "total_orders": {"$sum": 1},
                    "average_distance": {
                        "$avg": "$distance_haversine_km"
                    },
                    "average_delivery_time": {
                        "$avg": "$Delivery_Time"
                    },
                }
            },
        ]

        kpi_result = list(
            orders_collection.aggregate(kpi_pipeline)
        )

        if kpi_result:
            kpi = {
                "total_orders": kpi_result[0]["total_orders"],
                "average_distance": round(
                    kpi_result[0]["average_distance"], 2
                ) if kpi_result[0]["average_distance"] is not None else None,
                "average_delivery_time": round(
                    kpi_result[0]["average_delivery_time"], 2
                ) if kpi_result[0]["average_delivery_time"] is not None else None,
            }
        else:
            kpi = {
                "total_orders": 0,
                "average_distance": None,
                "average_delivery_time": None,
            }

        # 6. Thoi gian giao trung binh va khoang cach theo khu vuc
        area_pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": "$Area",
                    "order_count": {"$sum": 1},
                    "average_delivery_time": {
                        "$avg": "$Delivery_Time"
                    },
                    "average_distance": {
                        "$avg": "$distance_haversine_km"
                    },
                }
            },
            {"$sort": {"average_delivery_time": 1}},
        ]

        area_results = list(
            orders_collection.aggregate(area_pipeline)
        )

        by_area = [
            {
                "area": item["_id"],
                "order_count": item["order_count"],
                "average_delivery_time": round(
                    item["average_delivery_time"], 2
                ) if item["average_delivery_time"] is not None else None,
                "average_distance": round(
                    item["average_distance"], 2
                ) if item["average_distance"] is not None else None,
            }
            for item in area_results
        ]

        # 7. Co cau so don theo phuong tien
        vehicle_pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": "$VehicleKey",
                    "order_count": {"$sum": 1},
                    "average_delivery_time": {
                        "$avg": "$Delivery_Time"
                    },
                }
            },
            {"$sort": {"_id": 1}},
        ]

        vehicle_results = list(
            orders_collection.aggregate(vehicle_pipeline)
        )

        by_vehicle = [
            {
                "vehicle": vehicle_map.get(
                    item["_id"], "Unknown"
                ),
                "vehicle_key": item["_id"],
                "order_count": item["order_count"],
                "average_delivery_time": round(
                    item["average_delivery_time"], 2
                ) if item["average_delivery_time"] is not None else None,
            }
            for item in vehicle_results
        ]

        # 8. Ma tran thoi gian giao theo khu vuc va phuong tien
        matrix_pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": {
                        "area": "$Area",
                        "vehicle": "$VehicleKey",
                    },
                    "order_count": {"$sum": 1},
                    "average_delivery_time": {
                        "$avg": "$Delivery_Time"
                    },
                }
            },
            {
                "$sort": {
                    "_id.area": 1,
                    "_id.vehicle": 1,
                }
            },
        ]

        matrix_results = list(
            orders_collection.aggregate(matrix_pipeline)
        )

        by_area_vehicle = [
            {
                "area": item["_id"]["area"],
                "vehicle": vehicle_map.get(
                    item["_id"]["vehicle"], "Unknown"
                ),
                "vehicle_key": item["_id"]["vehicle"],
                "order_count": item["order_count"],
                "average_delivery_time": round(
                    item["average_delivery_time"], 2
                ) if item["average_delivery_time"] is not None else None,
            }
            for item in matrix_results
        ]

        # 9. Khu vuc va phuong tien co thoi gian giao nhanh nhat
        fastest_area = min(
            (
                item for item in by_area
                if item["average_delivery_time"] is not None
            ),
            key=lambda item: item["average_delivery_time"],
            default=None,
        )

        fastest_vehicle = min(
            (
                item for item in by_vehicle
                if item["average_delivery_time"] is not None
            ),
            key=lambda item: item["average_delivery_time"],
            default=None,
        )

        return {
            "filters": {
                "start_date": str(start_key),
                "end_date": str(end_key),
                "area": area,
            },
            "kpi": kpi,
            "fastest_area": fastest_area,
            "fastest_vehicle": fastest_vehicle,
            "by_area": by_area,
            "by_vehicle": by_vehicle,
            "by_area_vehicle": by_area_vehicle,
        }

    except HTTPException:
        raise

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to calculate area and vehicle dashboard.",
        ) from exc
# 3. GET: Chi tiet don hang - yeu cau dang nhap
@router.get("/{order_id}")
def get_order_detail(
    order_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get one order by its Order_ID."""
    try:
        document = db["orders"].find_one(
            {"Order_ID": order_id},
            {"_id": 0},
        )

        if document is None:
            raise HTTPException(
                status_code=404,
                detail="Order not found.",
            )

        return document

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to retrieve order from database.",
        ) from exc


# 4. POST: Them don hang - chi admin
@router.post("/")
def create_order(
    order: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """Create an order. Admin access required."""
    if not order:
        raise HTTPException(
            status_code=400,
            detail="Order data cannot be empty.",
        )

    order_id = order.get("Order_ID")

    if order_id is None:
        raise HTTPException(
            status_code=400,
            detail="Order_ID is required.",
        )

    try:
        collection = db["orders"]

        if collection.find_one({"Order_ID": order_id}):
            raise HTTPException(
                status_code=409,
                detail="Order_ID already exists.",
            )

        now = datetime.now(timezone.utc)
        order["created_at"] = now
        order["updated_at"] = now

        collection.insert_one(order)

        saved_order = collection.find_one(
            {"Order_ID": order_id},
            {"_id": 0},
        )

        return {
            "message": "Order created successfully.",
            "data": saved_order,
        }

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to create order in database.",
        ) from exc


# 5. PUT: Cap nhat don hang - chi admin
@router.put("/{order_id}")
def update_order(
    order_id: str,
    order: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """Update an order. Admin access required."""
    if not order:
        raise HTTPException(
            status_code=400,
            detail="Order data cannot be empty.",
        )

    # Khong cho phep thay doi Order_ID qua API cap nhat
    order.pop("Order_ID", None)

    # Khong cho phep ghi de thoi diem tao ban dau
    order.pop("created_at", None)

    if not order:
        raise HTTPException(
            status_code=400,
            detail="No editable fields provided.",
        )

    order["updated_at"] = datetime.now(timezone.utc)

    try:
        collection = db["orders"]

        result = collection.update_one(
            {"Order_ID": order_id},
            {"$set": order},
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Order not found.",
            )

        updated_order = collection.find_one(
            {"Order_ID": order_id},
            {"_id": 0},
        )

        return {
            "message": "Order updated successfully.",
            "data": updated_order,
        }

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to update order in database.",
        ) from exc


# 6. DELETE: Xoa don hang - chi admin
@router.delete("/{order_id}")
def delete_order(
    order_id: str,
    current_user: dict = Depends(require_admin),
):
    """Delete an order. Admin access required."""
    try:
        collection = db["orders"]

        result = collection.delete_one({"Order_ID": order_id})

        if result.deleted_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Order not found.",
            )

        return {
            "message": "Order deleted successfully.",
            "Order_ID": order_id,
        }

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to delete order from database.",
        ) from exc
