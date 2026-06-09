# Katara Member Tracker — shared live app for your team (Microsoft 365)

This guide turns your member tracker into a **shared, live app** that all ~10
staff use in the browser or Teams — **no Excel macros, no Python, no GitHub.**
Anyone with the link can add members, drag a card from Approved to Paid, and
click a card to open a detail page. Changes appear for everyone instantly.

You will use **Microsoft Lists**, which is already included free in your
Microsoft 365. The actual PowerPoint deck is still produced on demand (see the
last section), so you keep "both".

**Time to set up: about 20 minutes, once.**

---

## What you'll end up with

* **Board view** — three columns *Pending approval / Approved / Paid*. Drag a
  member's card between columns to change their status. Everyone sees it live.
* **Gallery view** — each member shown as a **card with their photo** (your
  "slides").
* **Click a card** → a **detail page (popup)** opens with every field, including
  the Special Request / note.
* **"+ New" form** — staff fill in a member's details; saving creates the row in
  the right status automatically.

---

## Before you start

You need:
1. A Microsoft 365 work account (the one with Outlook/Teams/Excel).
2. The file **`Katara_Members_ForImport.xlsx`** (I provided it). It contains all
   143 current members as one table, ready to import.

> Save that file somewhere easy to find, like your Desktop.

---

## Step 1 — Create the list from the Excel file

1. In your browser go to **https://lists.live.com** *(or open **Lists** from the
   Microsoft 365 app launcher / from inside **Teams → Apps → Lists**).*
2. Click **+ New list**.
3. Choose **From Excel**.
4. Click **Upload file** and pick **`Katara_Members_ForImport.xlsx`**.
5. It shows the columns it found. For each column you can set a type — leave most
   as **Single line of text**. For now leave **Workflow Status** as text too
   (we fix it in Step 2). Set **Rate (QAR)** to **Number** if offered.
6. Give the list a name like **Katara Members**, pick a colour/icon, click
   **Create**.

You now have a live list with all members. 🎉

---

## Step 2 — Make "Workflow Status" a dropdown (Choice) with colours

This is what powers the board and the drag-to-move.

1. Click the **Workflow Status** column header → **Column settings** →
   **Edit**.
2. Change **Type** to **Choice**.
3. Set the three choices exactly:
   - `Pending approval`
   - `Approved`
   - `Paid`
4. Give each a colour (e.g. Pending = yellow, Approved = green, Paid = teal).
5. Turn **OFF** "Allow multiple selections". Click **Save**.

---

## Step 3 — Add a Photo column for the cards

1. Scroll right to the **+ Add column** button → choose **Image** → **Next**.
2. Name it **Photo** → **Save**.
3. To add a picture to a member: click a row to open it, click **Edit**, and
   upload their photo into the **Photo** field. (Do this as you go; the photos
   for current members are in the **media** folder I provided — file names are
   in each row's *Photo file* column.)

> Tip: you don't have to add all photos at once. Cards without a photo still
> work; they just show a placeholder.

---

## Step 4 — Create the Board (drag-to-move) view

1. Top-right of the list, click the **view menu** (says *All Items*) →
   **Create new view**.
2. Name it **Board**.
3. Choose **Board** layout.
4. **"Organize by"** → pick **Workflow Status**.
5. Click **Create**.

You now have three columns: *Pending approval, Approved, Paid*. **Drag any card
from one column to another** to change its status — it saves instantly for
everyone. This is your "move from Approved to Paid". ✅

---

## Step 5 — Create the Gallery (cards) view

1. View menu → **Create new view** → name it **Cards** → layout **Gallery** →
   **Create**.
2. Click the view menu → **Format current view** → **Edit card** to choose which
   fields show on each card (e.g. Photo, Name, Membership Plan, Rate, Workflow
   Status).

Now you have a wall of **membership cards**. **Click any card** → the member's
**detail page opens as a popup** with all fields and the Special Request note. ✅

---

## Step 6 — How staff add a new member

* Click **+ New** (top-left). A form opens with all the fields.
* Fill them in, set **Workflow Status**, upload a **Photo**, click **Save**.
* The new member instantly appears in the right Board column and as a card.

*(Optional, nicer form: click the list menu **⋯ → Forms → + New form** to make a
simplified fill-in form you can send as a link.)*

---

## Step 7 — Share it with your 10 staff

1. Click **Share** (top-right).
2. Enter your colleagues' names/emails (your ~10 staff).
3. Set permission to **Can edit**.
4. Send. They open the link (works in browser, Teams, and the Lists mobile app)
   and can use everything live. Microsoft Lists is fine for small teams; 10
   editors is well within limits.

> To keep it tidy, you can also **add the list as a tab in a Teams channel**:
> in Teams, open the channel → **+** → **Lists** → **Add an existing list**.

---

## Generating the PowerPoint deck ("both")

Daily work happens in the list. When someone needs the actual **PowerPoint /
ODP deck** (e.g. for a management review), one person exports and runs one
command — or sends the export to whoever maintains the tool:

1. In the list, view menu → **Export** → **Export to CSV** (saves
   `Katara Members.csv`).
2. Run the generator once (this is the only command-line step, done by an admin
   or me):

   ```bash
   python -m katara_tracker from-table "Katara Members.csv" \
       --media media --template Katara_Profiles_Final.odp \
       --out-pptx Katara_Profiles.pptx --out-odp Katara_Profiles.odp
   ```

   This produces the **PowerPoint** and **ODP** decks — segregated into
   Pending / Approved / Paid sections with the Analysis slides — from the live
   list data. Existing members keep their original slide design; new members get
   a generated slide.

> Photos on generated slides: existing members reuse their original slide photo
> automatically. For brand-new members added in the list, put their photo in the
> `media` folder and write its filename in the **Photo file** column before
> exporting.

---

## Why not just "live Excel"?

Excel's automation (the VBA that moves rows) only runs in **desktop** Excel on
one person's PC — it does **not** run in shared/online Excel where a team
co-edits. Microsoft Lists is Microsoft's purpose-built tool for exactly this:
shared, live, board + cards + detail pages, included in your M365, no code.

---

## Quick comparison (if you ever want alternatives)

| Tool | Live & shared | Board (drag) | Cards + detail popup | Cost for 10 | Notes |
|------|:---:|:---:|:---:|------|-------|
| **Microsoft Lists** ✅ | ✔ | ✔ | ✔ | Free w/ M365 | Best fit for you |
| Power Apps | ✔ | ✔ | ✔ | Free w/ M365 | More polished, more setup |
| Airtable | ✔ | ✔ | ✔ | Free tier | Not in your tenant |
| Glide | ✔ | ✔ | ✔ | Free tier | App-like, not in tenant |
