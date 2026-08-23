# Track it

A private, minimal period-date tracker. No account, no cloud, no ads, no
health advice — just: log it, see it, get reminded.

Everything in this folder is the whole app. It doesn't need a database,
a server, or anyone to maintain it.

---

## What it does

- One-time setup: type a name, tap Continue. That's the entire "account."
- Tap a day on the calendar to log a period, tap a colour to change how it's shown — everything else stays the same.
- A simple calendar shows logged periods in one pastel colour you choose.
- History shows the last 3 months.
- Once two periods are logged, it estimates the next one and can show a
  reminder — no setup required.
- Works offline once it's loaded, and can be added to a phone's home
  screen like a regular app.

## What it deliberately doesn't do

No login, no email or phone number, no fertility/ovulation/symptom
tracking, no ads, no subscriptions, no analytics. If a future request
would add any of that, it's out of scope for this app.

---

## Part 1 — Try it before deploying

You don't need to know how to code for this. You only need a folder and
a browser.

1. Unzip the project if it came zipped, so you have one folder containing
   `index.html`, `manifest.webmanifest`, `sw.js`, and the `css`, `js`,
   `icons` folders.
2. Because phones and browsers block some features (like offline saving)
   on plain files, run it through a tiny local server rather than
   double-clicking `index.html`:
   - **Easiest option:** install the free **"Web Server for Chrome"**
     extension from the Chrome Web Store, open it, choose the `trackit`
     folder, and click the link it shows you (something like
     `http://127.0.0.1:8887`).
3. Open that link. You should see the "track it" welcome screen.
4. Run through the checklist below.

## Part 2 — Test checklist (do this before deploying)

Go through each row. Every "Expected result" should match what you see.

| Step | Expected result |
|---|---|
| Open the app for the first time | Only a name field and "Continue" — nothing else |
| Type a name, tap Continue | Home screen appears, greeting shows your name |
| Close the tab and reopen the link | Your name is remembered, no sign-in asked |
| Tap today's day on the calendar, then tap it again | A bar slides up from the bottom; a prompt then appears asking you to come back later, with "I'll add it later" / "Save for now" |
| Tap "Save for now" | A one-day entry appears on today in the calendar and in History |
| Tap that day (or its History entry) | The bottom bar reopens with those dates, ready to edit |
| Tap a new end day further out and tap "Update dates" | The entry updates to the new range |
| Try to navigate the calendar past 3 months back, or past the current month | The ‹ or › arrow is greyed out and won't move further |
| Tap an end day before the start day | The selection restarts from that day instead (can't produce an invalid range) |
| Start a second period with a start day in the same month as one you already saved | A prompt asks "Update this month's dates?" |
| Choose "Save latest" | The old dates in that month are replaced; History shows only the new ones |
| Choose "Keep existing" (on a second try) | Nothing changes |
| Change the colour swatch in the bottom bar | Every period on the calendar and in History changes colour immediately |
| Turn off Wi-Fi/data and reopen the app | It still opens and shows your saved data |
| Log only one period | No reminder banner appears |
| Log two periods a few weeks apart | A "Want a nudge…" banner appears; tapping "Turn on" asks for notification permission |
| Add the app to your Home Screen (see Part 3) and reopen it from there | It opens full-screen, like a normal app, without browser bars |

If anything doesn't match, note which row failed — that's the thing to
fix before deploying.

## Part 3 — Add it to your phone's Home Screen (for your own testing)

**iPhone (Safari):** open the link → tap the Share icon → "Add to Home
Screen" → Add.

**Android (Chrome):** open the link → tap the ⋮ menu → "Add to Home
screen" / "Install app".

---

## Part 4 — Deploy it for free (GitHub Pages)

This publishes the app at a free, permanent web address so you (or
whoever the app is for) can open it from any phone, without you running
anything locally.

1. Go to **github.com** and create a free account if you don't have one.
2. Click the **+** in the top right → **New repository**.
   - Name it `trackit` (or anything you like).
   - Set it to **Public**.
   - Click **Create repository**.
3. On the new repository page, click **"uploading an existing file"**
   (or **Add file → Upload files**).
4. Drag in **everything inside** the `trackit` folder — `index.html`,
   `manifest.webmanifest`, `sw.js`, and the `css`, `js`, and `icons`
   folders — keeping the folder structure. Commit the upload.
5. Go to the repository's **Settings** tab → **Pages** (left sidebar).
6. Under "Build and deployment," set **Source** to **"Deploy from a
   branch,"** branch **`main`**, folder **`/ (root)`**. Save.
7. Wait about a minute, then refresh that Settings → Pages screen. It
   will show a link like:
   `https://yourusername.github.io/trackit/`
8. Open that link on the phone it's for, and repeat the **Add to Home
   Screen** steps in Part 3.

That's it — no cost, no server to maintain. Every time you want to
update the app, upload the changed files to the same repository the
same way.

### If you'd rather use Cloudflare Pages instead

Cloudflare Pages also has a free tier and works well with this kind of
static app. The steps are similar: create a free Cloudflare account,
create a new Pages project, and either connect it to a GitHub repo (see
above) or use "Upload assets" to drag in the same files directly. Either
host is a fine choice — pick whichever feels easier.

---

## About reminders (please read)

Track it estimates your next period from your own logged dates once at
least two are saved, and can show a notification a few days around that
estimate. There's an honest limitation worth knowing:

- **While the app is open, or on Android/Chrome after it's installed,**
  reminders work reliably — the app checks each time it's opened, and on
  supported Android installs it can also check periodically in the
  background.
- **On iPhone (Safari/PWA),** Apple only allows a web app to show
  notifications it generates locally — it can't wake itself up in the
  background the way some "real" apps can. In practice this means the
  most reliable moment for a reminder is when the app is opened.
- Reliable "notify me even if I never open the app for days," on iPhone
  in particular, needs a small push-notification server that stores an
  anonymous device token and sends pushes on a schedule (still free to
  run, but it's a separate piece of infrastructure with its own moving
  parts). This app is built so that piece can be added later without
  changing anything else — just say the word if you'd like it added, and
  it'll be built and tested as its own clearly-versioned step, the same
  way this app was.

No period dates or your name are ever part of a push subscription — only
an anonymous device token would be, if that piece is ever added.

---

## Data & privacy, in plain terms

- Your name and period dates are stored in the browser's on-device
  storage (IndexedDB) — nothing is uploaded.
- If you delete the app or clear browser data, that data is gone. There
  is no cloud backup, by design.
- Uninstalling the app removes its data the same way uninstalling any
  app would.

## Version

- **v1.0** — initial release: profile, date entry with all the rules
  above, monthly replace logic, pastel colour system, 3-month history,
  calendar, and local/foreground reminders. This is the known-good
  baseline — future changes should be tested against the checklist in
  Part 2 before replacing it.
