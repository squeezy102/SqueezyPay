import sys
from sqlalchemy.orm import Session
from database.db import SessionLocal, init_db
from models.models import Bill

HARDCODED_BILLS = [
    {
        "name": "Example Credit Union",
        "category": "Loans / Debt",
        "expected_amount": None,
        "day_of_month": 1,
        "url": "https://www.example.com",
        "recurring": True,
        "notes": "Replace with your actual biller details",
    },
    {
        "name": "Example Internet Co",
        "category": "Internet / Phone",
        "expected_amount": None,
        "day_of_month": 15,
        "url": "https://www.example.com/acctmgmt/fastpmt/fastpay",
        "recurring": True,
    },
    {
        "name": "Example Electric Co",
        "category": "Utilities",
        "expected_amount": None,
        "day_of_month": 20,
        "url": "https://www.example.com/account/guest-pay",
        "recurring": True,
    },
    {
        "name": "Example Medical Co",
        "category": "Healthcare / Medical",
        "expected_amount": None,
        "day_of_month": 28,
        "url": "https://www.example.com/",
        "recurring": True,
        "notes": "Example Medical Co is part of Example Finance Co",
    },
    {
        "name": "Example Finance Co",
        "category": "Loans / Debt",
        "expected_amount": None,
        "day_of_month": 10,
        "url": "https://www.example.com/",
        "recurring": True,
    },
    {
        "name": "Example Student Loan Co",
        "category": "Education",
        "expected_amount": None,
        "day_of_month": 5,
        "url": "https://example.com/welcome",
        "recurring": True,
    },
    {
        "name": "Example Student Loan Co 2",
        "category": "Education",
        "expected_amount": None,
        "day_of_month": 5,
        "url": "https://www.example.com/login/",
        "recurring": True,
    },
]


def seed_bills(db: Session):
    existing_count = db.query(Bill).count()
    if existing_count > 0:
        print(f"Database already has {existing_count} bills. Skipping seed.")
        return

    for bill_data in HARDCODED_BILLS:
        bill = Bill(**bill_data)
        db.add(bill)

    db.commit()
    print(f"Seeded {len(HARDCODED_BILLS)} bills into database.")


if __name__ == "__main__":
    init_db()
    db = SessionLocal()
    try:
        seed_bills(db)
    finally:
        db.close()
