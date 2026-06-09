"""Shared analytics over a list of Client records.

Used by the Excel Analysis sheet and by the Analysis section slides in both
deck formats, so every surface reports identical numbers.
"""

from __future__ import annotations

from collections import defaultdict

from .odp_parser import Client
from .theme import STATUSES


def kpis(clients: list[Client]) -> list[tuple[str, int, bool]]:
    """Return [(label, value, is_money)] headline metrics."""
    paid = [c for c in clients if c.status == "Paid"]
    approved = [c for c in clients if c.status == "Approved"]
    pending = [c for c in clients if c.status == "Pending approval"]
    total_paid = sum(c.rate_amount for c in paid)
    pipeline = sum(c.rate_amount for c in clients)
    avg = round(pipeline / len(clients)) if clients else 0
    return [
        ("Total joiners (clients)", len(clients), False),
        ("Pending approval", len(pending), False),
        ("Approved (not paid)", len(approved), False),
        ("Paid", len(paid), False),
        ("TOTAL AMOUNT PAID (all joiners)", total_paid, True),
        ("Total pipeline value (all statuses)", pipeline, True),
        ("Average rate (all)", avg, True),
    ]


def membership_breakdown(clients: list[Client]) -> list[dict]:
    """Per-membership-type rows, sorted by joiner count (desc)."""
    by_type = defaultdict(lambda: {"n": 0, "paid": 0, "paid_amt": 0, "pipe": 0})
    for c in clients:
        key = c.membership_plan or "(unspecified)"
        d = by_type[key]
        d["n"] += 1
        d["pipe"] += c.rate_amount
        if c.status == "Paid":
            d["paid"] += 1
            d["paid_amt"] += c.rate_amount
    rows = []
    for key in sorted(by_type, key=lambda k: -by_type[k]["n"]):
        d = by_type[key]
        rows.append({"type": key, **d})
    return rows


def status_counts(clients: list[Client]) -> dict:
    return {s: sum(1 for c in clients if c.status == s) for s in STATUSES}
