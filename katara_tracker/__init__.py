"""Katara member-profile tracker.

Turns a Katara member-profile ODP deck into a styled Excel tracking workbook
(status sheets + analysis + a Create-Slide form) and regenerates the deck from
the workbook so workflow-status changes move each member's slide to match.
"""

from .odp_parser import Client, parse_odp, extract_media
from .excel_builder import build_workbook

__all__ = ["Client", "parse_odp", "extract_media", "build_workbook"]
