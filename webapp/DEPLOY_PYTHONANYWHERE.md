# Put the Katara app online for your team — step by step

This makes your app live on the internet at a link like
`https://YOURNAME.pythonanywhere.com` that all ~10 staff open from any
computer or phone. It's **free** and your data is **saved permanently**.

You do this **once**, in about **15 minutes**. No coding — just follow along.
You only need the file I gave you: **`katara_app.zip`**.

> If anything on screen looks slightly different from the wording here, tell me
> what you see and I'll guide you — websites occasionally rename buttons.

---

## Step 1 — Create a free account

1. Go to **https://www.pythonanywhere.com**
2. Click **Pricing & signup** → under **"Create a Beginner account"** click
   **Create a Beginner account** (this one is **free**).
3. Pick a username (this becomes your web address, e.g. `katara`), enter an
   email + password, and confirm. Log in.

---

## Step 2 — Upload the app

1. At the top right, open the **Files** tab.
2. On the right side under **"Upload a file"**, click **Choose file**, pick
   **`katara_app.zip`**, and wait for it to finish uploading (it's ~18 MB).
3. Now open a terminal: top menu **Consoles** → **Bash** (click "Bash" to start
   a new console). A black screen appears. Type this and press Enter:

   ```
   unzip katara_app.zip
   ```

   You'll see files being extracted. This created a folder named **katara_app**.

---

## Step 3 — Install the building blocks

In that same Bash console, copy-paste this line and press Enter:

```
pip3.10 install --user Flask SQLAlchemy openpyxl Pillow lxml python-pptx
```

Wait until it finishes (1–2 minutes; lots of text is normal, that's fine).

---

## Step 4 — Create the web app

1. Open the **Web** tab (top menu) → click **Add a new web app** → **Next**.
2. Choose **Manual configuration** (NOT "Flask") → **Next**.
3. Choose **Python 3.10** → **Next**. It creates the web app.

---

## Step 5 — Point it at the app (the only "techy" bit — just paste)

1. Still on the **Web** tab, scroll to **"Code"** and set:
   * **Source code:**  `/home/YOURNAME/katara_app`
   * **Working directory:** `/home/YOURNAME/katara_app`
   *(Replace `YOURNAME` with your PythonAnywhere username.)*
2. In the same section, click the **WSGI configuration file** link (it looks
   like `/var/www/YOURNAME_pythonanywhere_com_wsgi.py`).
3. **Delete everything** in that file and paste exactly this (change `YOURNAME`):

   ```python
   import sys
   path = "/home/YOURNAME/katara_app"
   if path not in sys.path:
       sys.path.insert(0, path)

   from webapp.app import app as application
   ```

4. Click the green **Save** button (top right of the editor).

---

## Step 6 — Start it

1. Go back to the **Web** tab.
2. Click the big green **Reload** button.
3. Click your link at the top: **https://YOURNAME.pythonanywhere.com**

Your board opens, already filled with all 143 members. 🎉

---

## Step 7 — Share with your staff

Just send your colleagues the link:

```
https://YOURNAME.pythonanywhere.com
```

They open it on any browser or phone. Everyone uses it together — add a member,
drag/change a status (the card moves to the matching column), tap a card to see
full details, and use the **PowerPoint** / **Excel** buttons to download decks.

---

## Good to know

* **Your data is saved** in a file on PythonAnywhere and stays between visits.
* **Keep it alive (free plan):** PythonAnywhere asks you to click a "Run until 3
  months from today" button on the **Web** tab every ~3 months. Just log in and
  click it; takes 5 seconds.
* **Photos:** new members' photos you upload in the app are saved too. Existing
  members already have their photos.
* **Backups:** to back up, open the Files tab and download the file
  `katara_app/webapp/katara.db` now and then.
* **Want to try it on your own computer first?** Install Python from
  python.org, then in a terminal run `pip install -r requirements.txt` and
  `python webapp/app.py`, and open `http://localhost:8000`.

---

## If you get stuck

Tell me which step number you're on and what the screen says (a screenshot is
perfect). I'll get you to the finish line.
