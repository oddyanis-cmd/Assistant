# Katara Member Tracker

Automates turning the **Katara member-profile presentation** (`.odp`) into a
styled Excel tracking workbook — and back again. Each slide is one member; the
tool extracts every field, classifies members by their workflow status, and can
regenerate the deck from the workbook so a status change moves a member's slide
to match.

The goal is to remove manual copy/paste between the deck and a tracksheet, which
is where mistakes and oversights creep in.

## What it produces

`extract` builds `Katara_Tracker.xlsx` with these sheets:

| Sheet | Contents |
|-------|----------|
| **Pending approval** | Members whose slide has *no* green note |
| **Approved** | Members with the green **"Approved"** note |
| **Paid** | Members with the green **"Paid"** note |
| **Member Cards** | A visual **gallery of membership cards** (not a list): each member as a styled card with photo, maroon header, colour-coded status badge, name, plan, rate and contact — 3 cards per row, grouped by status |
| **Analysis** | KPIs (total joiners, counts per status, **total amount paid** = sum of the Rate of *Paid* members) and a per-**membership-type** breakdown |
| **Create Slide** | A form: add one new member per row (incl. a photo path) and `sync` turns each into a real slide |

Every member row has:

* all profile fields (App ID, Name, App Type, Date, Age, Occupation, Company,
  Membership Plan, Rate, Tag, CEC, Mobile, Special Request/Note),
* a **portrait thumbnail**, and
* a **Workflow Status** drop-down (`Pending approval` / `Approved` / `Paid`).

## Install

```bash
pip install -r requirements.txt   # openpyxl, Pillow, lxml
```

## Usage

### 1. Extract the deck into the tracking workbook

```bash
python -m katara_tracker extract Katara_Profiles_Final.odp \
    --out Katara_Tracker.xlsx --media media
```

This parses all slides, unpacks the photos into `media/`, and records the deck
path inside the workbook so `sync` knows the design template to reuse.

### 2. Edit the workbook

* Change a member's **Workflow Status** drop-down to move them between sheets.
* Add new members on the **Create Slide** sheet (set *Photo file* to an image
  path to show their picture on the generated slide).

### 3. Sync back

```bash
python -m katara_tracker sync Katara_Tracker.xlsx \
    --out-odp Katara_Profiles_Rebuilt.odp
```

`sync`:

1. re-files every member into the sheet matching its Workflow Status,
2. rebuilds the **Analysis** totals,
3. regenerates **two decks** — ordered *Pending → Approved → Paid* with a
   **section divider** before each group and an **Analysis section** at the end:
   * `--out-odp` (default `Katara_Profiles_Rebuilt.odp`): design-faithful;
     existing members keep their **original slide** (the green note is
     added/updated/removed to match their status), new members get a cloned
     slide with their fields + photo.
   * `--out-pptx` (default `Katara_Profiles_Rebuilt.pptx`): a **native
     PowerPoint** built from scratch, re-creating the design + sections +
     analysis. Pass `--out-pptx ''` to skip it.

### Segregated deck structure

```
[ PENDING APPROVAL — 107 ]  → the 107 member slides
[ APPROVED — 18 ]           → the 18 member slides
[ PAID — 18 ]               → the 18 member slides
[ ANALYSIS ]                → KPI slide + membership-type table slide
```

## How the design is preserved

Colours and layout are taken straight from the source deck
(maroon `#49153B` header, green `#00B050` status note, etc. — see `theme.py`).
The `.odp` regeneration **reuses the original slides as templates** rather than
drawing new ones, so it stays visually identical to the source. The native
`.pptx` re-creates the same design with python-pptx (a faithful re-creation
rather than a pixel clone).

## Notes & limitations

* **In-cell automation:** Excel cannot physically move a row between tabs the
  instant you change a drop-down without VBA macros (which don't survive in
  LibreOffice/`.odp` workflows). `sync` performs that re-filing reliably in one
  command — run it after editing, or wire it into a scheduler.
* Field **edits** to *existing* members in the workbook update the workbook and
  Analysis; their slide text is preserved as-is from the source (only the status
  note changes). New members added via *Create Slide* are fully rendered from
  the workbook values.
* A handful of source slides have no portrait or no mobile number — these are
  genuinely blank in the deck and are carried through faithfully.

## Tests

```bash
python -m pytest katara_tracker/tests -q
```

Tests build a small synthetic deck (no external file needed) and verify the
parse → build → sync round-trip, including a status change and a new member.

## Module map

| File | Responsibility |
|------|----------------|
| `odp_parser.py` | Parse `.odp` slides into `Client` records (+ extract media) |
| `excel_builder.py` | Build the styled workbook (status sheets, Analysis, Create Slide) |
| `slide_builder.py` | Regenerate the `.odp` deck (sections + analysis) |
| `pptx_builder.py` | Build the native `.pptx` deck (sections + analysis) |
| `analytics.py` | Shared KPI / membership-breakdown calculations |
| `render.py` | Render a single member slide to a PNG preview |
| `sync.py` | Read the edited workbook, re-file, rebuild decks + workbook |
| `theme.py` | Brand colours / layout constants |
| `cli.py` | `extract`, `sync`, `preview` commands |
