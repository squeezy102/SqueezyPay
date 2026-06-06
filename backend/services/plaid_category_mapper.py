from sqlalchemy.orm import Session

from models.models import TransactionCategory

# Maps Plaid's personal_finance_category.primary values to SqueezyPay TransactionCategory names.
# If a primary category isn't listed here the transaction receives no auto-category (category_id=None).
PLAID_PRIMARY_TO_LOCAL: dict[str, str] = {
    "FOOD_AND_DRINK":       "Fast Food / Dining Out",
    "GROCERIES":            "Groceries",
    "TRANSPORTATION":       "Convenience / Gas Station",
    "TRAVEL":               "Travel",
    "ENTERTAINMENT":        "Entertainment",
    "MEDICAL":              "Healthcare / Medical",
    "RENT_AND_UTILITIES":   "Utilities",
    "LOAN_PAYMENTS":        "Loans / Debt",
    "PERSONAL_CARE":        "Personal Care",
    "GENERAL_MERCHANDISE":  "Online Shopping",
    "EDUCATION":            "Education",
    "HOME_IMPROVEMENT":     "Housing",
    "INSURANCE":            "Insurance",
    "SUBSCRIPTION":         "Subscriptions / Streaming",
    "KIDS":                 "Kids",
    "INCOME":               "Income",
    "TRANSFER_IN":          "Transfer",
    "TRANSFER_OUT":         "Transfer",
    "BANK_FEES":            "Bank Fees",
    "GOVERNMENT_AND_NON_PROFIT": "Miscellaneous",
    "GENERAL_SERVICES":     "Miscellaneous",
}


def resolve_category_id(
    db: Session,
    plaid_primary: str | None,
    plaid_detailed: str | None = None,
) -> int | None:
    if not plaid_primary:
        return None
    local_name = PLAID_PRIMARY_TO_LOCAL.get(plaid_primary)
    if not local_name:
        return None
    category = db.query(TransactionCategory).filter(TransactionCategory.name == local_name).first()
    return category.id if category else None
