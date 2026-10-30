from app.db.mongodb import db

pipeline = [
    {
        "$group": {
            "_id": "$DateKey",
            "orders": {"$sum": 1}
        }
    },
    {"$sort": {"_id": 1}}
]

result = list(db["orders"].aggregate(pipeline))

print("NUMBER OF DISTINCT DATES:", len(result))
print("FIRST 5 DAYS:", result[:5])
print("LAST 5 DAYS:", result[-5:])
