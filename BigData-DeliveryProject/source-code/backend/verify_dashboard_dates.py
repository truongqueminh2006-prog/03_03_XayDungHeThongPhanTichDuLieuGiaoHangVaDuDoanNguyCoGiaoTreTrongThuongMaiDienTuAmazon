from app.db.mongodb import db
from datetime import datetime

start = "2022-02-11"
end = "2022-04-06"

from_date = int(start.replace("-", ""))
to_date = int(end.replace("-", ""))

dates = list(
    db["dim_date"].find(
        {"DateKey": {"$gte": from_date, "$lte": to_date}},
        {"_id": 0, "DateKey": 1, "FullDate": 1}
    ).sort("DateKey", 1)
)

orders = {
    item["_id"]: item["count"]
    for item in db["orders"].aggregate([
        {"$group": {"_id": "$DateKey", "count": {"$sum": 1}}}
    ])
}

empty_dates = [
    item["FullDate"]
    for item in dates
    if orders.get(item["DateKey"], 0) == 0
]

print("TOTAL CALENDAR DAYS:", len(dates))
print("DAYS WITHOUT ORDERS:", len(empty_dates))
print("EMPTY DATES:", empty_dates)
