from sqlalchemy.orm import Session
from models.models import Bill


class BillService:
    @staticmethod
    def get_all_bills(db: Session):
        return db.query(Bill).filter(Bill.active == True).all()

    @staticmethod
    def get_bill(db: Session, bill_id: int):
        return db.query(Bill).filter(Bill.id == bill_id).first()

    @staticmethod
    def create_bill(db: Session, bill_data: dict):
        bill = Bill(**bill_data)
        db.add(bill)
        db.commit()
        db.refresh(bill)
        return bill

    @staticmethod
    def update_bill(db: Session, bill_id: int, bill_data: dict):
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            return None
        for key, value in bill_data.items():
            setattr(bill, key, value)
        db.commit()
        db.refresh(bill)
        return bill

    @staticmethod
    def deactivate_bill(db: Session, bill_id: int):
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            return None
        bill.active = False
        db.commit()
        db.refresh(bill)
        return bill
