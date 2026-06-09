# Live Excel automation (VBA)

Make the workbook move members and refresh cards **the instant you change a
Workflow Status** — no buttons, no commands. Unlike PowerPoint, Excel has a real
"cell changed" event, so this is genuinely live.

## What it does

* Change a row's **Workflow Status** on the *Pending / Approved / Paid* sheet
  → the whole row **moves to the matching sheet** immediately.
* Fill a row on **Create Slide** and set its Workflow Status → the member is
  **filed into the right sheet** (auto App ID if blank) and the form row clears.
* After either change, the **Member Cards** gallery is **rebuilt** so every
  member shows as a card with the correct status colour and photo.

## Setup (once, ~2 minutes)

1. **Build a macro-ready workbook** so rows can move cleanly:

   ```bash
   python -m katara_tracker extract Katara_Profiles_Final.odp \
       --out Katara_Tracker.xlsm --media media --macro-ready
   ```

   (Status sheets become plain data tables; photos stay on the Member Cards
   tab. Save/keep the file as **.xlsm**.)

2. Open it, press **Alt+F11** (VBA editor).
3. **Import the module:** File → *Import File…* → `KataraExcel.bas`.
4. **Add the event handler:** double-click **ThisWorkbook** in the left tree and
   paste the contents of `ThisWorkbook.txt` into the code window.
5. Back in Excel, **enable macros** when prompted (the workbook must stay
   `.xlsm`). Keep the `media/` photo folder next to the workbook.

That's it. Change any Workflow Status dropdown and watch the row move and the
card update live. You can also run **`KataraRefreshAll`** (Alt+F8) any time to
rebuild the cards manually.

## Notes & limits

* **Desktop Excel only** (Windows/Mac). Excel on the **web** doesn't run VBA —
  there you'd use *Office Scripts* + Power Automate, or just the Python
  `watch` mode (below).
* Keep the `media/` folder beside the workbook so the cards can find photos
  (the cards read each row's **Photo file** path).
* The photo thumbnails on the status sheets are intentionally omitted in
  macro-ready mode (they would block row moving); the **Member Cards** tab is
  the visual surface.

## Don't want macros? Same result via Python

Everything above also happens with one command — or automatically on save:

```bash
python -m katara_tracker sync   Katara_Tracker.xlsx     # one-shot
python -m katara_tracker watch  Katara_Tracker.xlsx     # auto on every save
```

`sync`/`watch` re-file members by status, rebuild the Member Cards, file new
Create-Slide members, and regenerate both decks — cross-platform, no macros.
