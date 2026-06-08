"""Brand palette and layout constants extracted from the original
Katara member-profile presentation (Katara_Profiles_Final.odp).

Keeping these in one place means the Excel workbook and the regenerated
slides stay visually consistent with the source design.
"""

# --- Brand colours (hex, no leading '#') -------------------------------------
MAROON = "49153B"        # primary header / brand colour
GREEN = "00B050"         # "Approved" / "Paid" green note
LIGHT_PANEL = "FBF5F9"   # light pink note background
RED = "FF0000"           # highlighted special-request text
WHITE = "FFFFFF"
BLACK = "000000"
GREY = "8A8A8A"

# Status-specific accent colours used for the status sheets / badges.
STATUS_COLORS = {
    "Pending approval": "B0883B",  # amber/gold = waiting
    "Approved": "00B050",          # green
    "Paid": "1F7A3D",              # darker green = money collected
}

# Canonical workflow statuses (order matters: drives sheet order & dropdowns).
STATUSES = ["Pending approval", "Approved", "Paid"]

# Excel number format for QAR money values.
MONEY_FMT = '#,##0" QAR"'
