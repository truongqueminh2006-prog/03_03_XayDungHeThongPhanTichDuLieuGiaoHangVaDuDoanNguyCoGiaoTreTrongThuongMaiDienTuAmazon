from app.db.mongodb import db

collection = db["orders"]

print("TOTAL:", collection.count_documents({}))

min_date = list(
    collection.find(
        {"DateKey": {"$exists": True}},
        {"DateKey": 1, "_id": 0}
    ).sort("DateKey", 1).limit(1)
)

max_date = list(
    collection.find(
        {"DateKey": {"$exists": True}},
        {"DateKey": 1, "_id": 0}
    ).sort("DateKey", -1).limit(1)
)

missing_date = collection.count_documents(
    {"DateKey": {"$exists": False}}
)

print("MIN_DATEKEY:", min_date)
print("MAX_DATEKEY:", max_date)
print("MISSING_DATEKEY:", missing_date)
