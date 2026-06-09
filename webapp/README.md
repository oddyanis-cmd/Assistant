# Katara Members — shared web app

A small, mobile-friendly web app so your whole team works from one live board:
add members, move them between **Pending / Approved / Paid**, click a card for a
detail popup, and download the **PowerPoint / Excel** any time. Data is stored in
a local SQLite file (`katara.db`) so it persists.

## Put it online for your team

Follow **`DEPLOY_PYTHONANYWHERE.md`** — a 15-minute, click-by-click guide to host
it free at `https://YOURNAME.pythonanywhere.com`. (Upload `katara_app.zip`,
install the dependencies, paste the WSGI snippet, Reload.)

## Run it on your own computer (to try it first)

```bash
pip install -r ../requirements.txt        # Flask, SQLAlchemy, openpyxl, Pillow, lxml, python-pptx
python app.py                              # then open http://localhost:8000
```

On first run it seeds itself from `seed_data.csv` (and serves photos from the
`media/` folder). Set `KATARA_DATA=/some/folder` to keep the database + uploads
outside the app folder.

## How it maps to what you asked for

| Your requirement | In the app |
|---|---|
| Staff add a row + details, a slide is created | **+ Add member** form → card appears; **View slide** renders the styled slide |
| Change status → row moves to the matching list | Status dropdown on each card / in the detail popup → card moves columns instantly |
| Click a slide → popup with more details + note | Click a card → detail popup with all fields incl. Special Request |
| Shared & live for all staff | Hosted once; everyone opens the link; the board auto-refreshes every 5s |
| Keep the PowerPoint deck | **PowerPoint** / **Excel** download buttons (built by `katara_tracker`) |

## Files

| File | Role |
|------|------|
| `app.py` | Flask routes + API + downloads |
| `models.py` | SQLite model (`Member`) and conversions |
| `templates/index.html` | The board UI (cards, drag/select, popups) |
| `wsgi.py` | Hosting entry point (PythonAnywhere) |
| `seed_data.csv` | Initial members (not in the repo — provided with the bundle) |
| `media/` | Member photos (not in the repo) |
