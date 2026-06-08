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
3. regenerates the deck — existing members keep their **original slide** (the
   green note is added/updated/removed to match their status), new members get a
   freshly cloned slide with their fields and photo — ordered
   *Pending → Approved → Paid* so a status change visibly moves the slide.

## How the design is preserved

Colours and layout are taken straight from the source deck
(maroon `#49153B` header, green `#00B050` status note, etc. — see `theme.py`),
and slide regeneration **reuses the original slides as templates** rather than
drawing new ones, so the output stays visually identical to the source.

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
| `slide_builder.py` | Regenerate the `.odp` deck from `Client` records |
| `sync.py` | Read the edited workbook, re-file, rebuild deck + workbook |
| `theme.py` | Brand colours / layout constants |
| `cli.py` | `extract` and `sync` commands |
