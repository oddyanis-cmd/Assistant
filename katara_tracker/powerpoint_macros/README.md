# Automated mode — moving slides without manual work

You have **two ways** to make slides re-organise into Pending / Approved / Paid
sections automatically. Pick whichever fits how you work.

## Option A — Inside PowerPoint (VBA macro)

`KataraAutoSort.bas` re-sorts the whole deck by each slide's status note, with
no dragging. The status is read from the **green note already on the slide**
(`Paid` / `Approved`, or none = Pending), so there's nothing extra to fill in.

**Install once**
1. Save the deck as **`.pptm`** (File → Save As → *PowerPoint Macro-Enabled*).
2. Press **Alt+F11** → File → *Import File…* → choose `KataraAutoSort.bas`.

**Then trigger it** — choose how automatic you want it:

| Mode | Setup | Feels like |
|------|-------|-----------|
| **One click** | Insert a shape → Insert → *Action* → "Run macro: `ReorganizeByStatus`". Change a status, click the shape. | manual, 1 click |
| **Live (timer)** | Run `StartAutoSort` once (Alt+F8). It re-sorts every few seconds until you run `StopAutoSort`. | fully automatic |
| **On open** | Load the deck as a PowerPoint **add-in** and call `ReorganizeByStatus` from its open handler. | fully automatic |

The macro also refreshes each divider's "N member(s)" count after sorting.

**Important caveats**
* Works in **desktop PowerPoint (Windows/Mac)** only — *not* PowerPoint on the
  web, mobile, or LibreOffice Impress (which uses a different Basic dialect).
* Macros must be **enabled** (the user clicks *Enable Content* once).
* PowerPoint has **no "edit = move instantly" event** like Excel's
  `Worksheet_Change`; that's why a trigger (click / timer / open) is needed.
  The timer mode is the closest to truly live.

## Option B — Hands-off pipeline (no macros, no typing commands)

If you'd rather not touch VBA, run the tracker in **watch mode**. It rebuilds
both decks automatically every time you save the Excel workbook:

```bash
python -m katara_tracker watch Katara_Tracker.xlsx
```

Now your only action is: change a **Workflow Status** dropdown in Excel and
save. The `.odp` and `.pptx` decks re-sort and the analysis recalculates on
their own — no command to re-run, no slides to drag. Stop with Ctrl+C.

This works on any platform and needs no macro security prompts; the trade-off is
that the automation lives in the tracker process rather than inside PowerPoint.

## Which should I use?

* Want everything to happen **inside PowerPoint** → Option A (timer mode).
* Want **zero manual steps** and don't mind the editing happening in Excel →
  Option B (watch mode) is the most reliable, cross-platform choice.
