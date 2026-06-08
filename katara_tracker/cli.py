"""Command-line interface for the Katara member tracker.

Usage
-----
Extract an ODP deck into the tracking workbook (and unpack its photos):

    python -m katara_tracker extract Katara_Profiles_Final.odp \
        --out Katara_Tracker.xlsx --media media

Re-sync after editing the workbook (re-files members by Workflow Status,
rebuilds Analysis, and regenerates the deck with one slide per member,
including any new members added on the "Create Slide" sheet):

    python -m katara_tracker sync Katara_Tracker.xlsx \
        --media media --out-odp Katara_Profiles_Rebuilt.odp
"""

from __future__ import annotations

import argparse
import os
import sys

from .excel_builder import build_workbook
from .odp_parser import extract_media, parse_odp


def cmd_extract(args: argparse.Namespace) -> int:
    if not os.path.exists(args.odp):
        print("ERROR: file not found: %s" % args.odp, file=sys.stderr)
        return 2
    print("Parsing %s ..." % args.odp)
    clients = parse_odp(args.odp)
    print("  parsed %d members" % len(clients))
    if args.media:
        extract_media(args.odp, args.media)
        print("  extracted photos -> %s/" % args.media)
    build_workbook(clients, args.media or "", args.out, template_path=args.odp)
    print("Wrote workbook -> %s" % args.out)
    # Quick status summary.
    from collections import Counter

    for status, n in Counter(c.status for c in clients).most_common():
        print("    %-18s %d" % (status, n))
    return 0


def cmd_sync(args: argparse.Namespace) -> int:
    from .sync import sync_workbook

    return sync_workbook(
        args.xlsx, args.media, args.out_odp, args.out_xlsx, args.template
    )


def cmd_preview(args: argparse.Namespace) -> int:
    from .render import render_slide

    clients = parse_odp(args.odp)
    matches = [
        c for c in clients
        if str(c.slide_index) == args.who
        or args.who.lower() in c.name.lower()
        or args.who.lower() in c.app_id.lower()
    ]
    if not matches:
        print("No member matched %r" % args.who, file=sys.stderr)
        return 1
    out = render_slide(matches[0], args.out, args.media)
    print("Wrote slide preview -> %s (%s)" % (out, matches[0].name))
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="katara_tracker", description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)

    e = sub.add_parser("extract", help="ODP deck -> tracking workbook")
    e.add_argument("odp", help="path to the source .odp presentation")
    e.add_argument("--out", default="Katara_Tracker.xlsx", help="output .xlsx")
    e.add_argument("--media", default="media", help="folder to unpack photos into")
    e.set_defaults(func=cmd_extract)

    s = sub.add_parser("sync", help="workbook -> re-filed workbook + rebuilt deck")
    s.add_argument("xlsx", help="the edited tracking workbook")
    s.add_argument("--media", default=None,
                   help="folder holding member photos "
                        "(defaults to the path recorded at extract time)")
    s.add_argument("--out-odp", default="Katara_Profiles_Rebuilt.odp",
                   help="regenerated presentation")
    s.add_argument("--out-xlsx", default=None,
                   help="rewritten workbook (defaults to overwriting input)")
    s.add_argument("--template", default=None,
                   help="original .odp to reuse as design template "
                        "(defaults to the path recorded at extract time)")
    s.set_defaults(func=cmd_sync)

    pv = sub.add_parser("preview", help="render one member's slide to a PNG")
    pv.add_argument("odp", help="source .odp presentation")
    pv.add_argument("who", help="slide number, name fragment, or App ID")
    pv.add_argument("--media", default="media", help="folder holding photos")
    pv.add_argument("--out", default="slide_preview.png", help="output PNG")
    pv.set_defaults(func=cmd_preview)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
