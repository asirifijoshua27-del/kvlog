# KVLOG 1.0.0: installer, automatic updates, daily backups and tests

- **Windows installer:** `npm run dist` makes `release\\KVLOG-Setup-1.0.0.exe`, with the KVLOG icon, Start menu and desktop shortcuts, and a choice of install folder. Uninstalling keeps the church's data.
- **Automatic updates** from GitHub Releases. They download in the background and install when KVLOG closes. **Settings → Updates** shows the status and has *Restart and update*. KVLOG never restarts on its own during a service.
- **Daily backups:** songs, services and the song report log, every day KVLOG is used, for the last 14 days. Restore a day in **Settings → Backup and restore → Daily backups**.
- **Tests:** `npm test` (unit tests) and `npm run test:e2e` (drives the real app with an empty data folder). GitHub runs both before every release.
- The sidebar shows the KVLOG logo.

Update: copy `src`, `electron`, `shared`, `tests`, `docs`, `build`, `.github`, `package.json`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore` and `README.md`. Then run `npm install`, `npm run typecheck` and `npm test`. To publish, see **docs/RELEASING.md**: replace `YOUR-GITHUB-NAME` in `package.json` first.

### Check it works
- [ ] `npm test` passes.
- [ ] `npm run test:e2e` passes (the first time, run `npx playwright install` if asked).
- [ ] `npm run dist` makes the installer. Install it, open KVLOG from the Start menu, and check that your data is there (the installed app uses the same data folder).
- [ ] After a few minutes, **Settings → Daily backups** lists today.
- [ ] Windows shows "Windows protected your PC": click **More info → Run anyway** (expected until the installer is signed).

---

# KVLOG 0.11.0: screen setup

Display Manager has a new **Screen setup** section.

- **Safe margins** for the Projector, OBS and the Stage display. If a TV or projector cuts off the edges, click **Show guide on screens** and raise the margins until the whole yellow frame is visible. The picture shrinks and keeps its 16:9 shape, and overlays and alerts stay inside it. The guide turns off when you leave Display Manager.
- **OBS look:** pick a template for OBS only (or *Classic*). The projector keeps each item's own template. Slides you designed yourself look the same in both.
- **Stage display layout:** *Standard*, *Band* (words with chords and the key, the next slide, no notes), *Pastor* (big clock and timer, large notes, the current slide smaller) or *Words only*. **Text size** goes from 50 to 200%. The chords switch moved here from Settings.
- Alerts now float over the stage display instead of pushing the layout down.

Update: copy `src`, `electron`, `shared`, `package.json` and `README.md`, then `npm run typecheck` and `npm run dev`. No new packages.

### Check it works
- [ ] Open the projector. Display Manager → **Show guide on screens**. Set *All sides* to 5%. The picture shrinks with a black border, and the yellow frame is at the edge of the picture.
- [ ] Switch to **OBS** and set 10%. In OBS the KVLOG source shrinks; the projector does not change.
- [ ] Set **Template in OBS** to another template. Send a song live: OBS uses that template, the projector uses the song's own.
- [ ] Open the stage display and try each layout. *Band* shows chords; *Pastor* shows a big clock and notes; *Words only* shows only the words.
- [ ] Leave Display Manager: the guide goes away.

---

# KVLOG 0.10.0: song import, backup, reports, alerts, OBS automation, two languages, timing, chords

Update: copy `src`, `electron`, `shared`, `docs`, `package.json` and `README.md`. Then run **`npm install`** (it adds one package, `sql.js`, used to read EasyWorship and OpenLP databases), then `npm run typecheck` and `npm run dev`.

**1. Song import:** Presentation Studio → **Import songs**. Choose files, or a whole folder.
- Plain text (`.txt`), OpenLyrics `.xml` (OpenLP: *Tools → Export Song*), OpenLP `songs.sqlite`, EasyWorship `.ewsx` or *Songs.db + SongWords.db* (choose both), ProPresenter `.pro6/.pro5/.pro4` (with sections), ProPresenter 7 `.pro` (words only), ChordPro, Word `.docx` (each Heading starts a new song) and PowerPoint `.pptx`.
- You see the list first. Songs already in the library are not selected. Files that could not be read are listed with the reason.

**2. Backup and restore:** Settings → **Back up now** writes a folder with everything (items, services, templates, overlays, media, Bibles, the song log). **Restore a backup…** replaces the current data and keeps a copy of it (`kvlog-data.json.before-restore-…`). The OBS password is not included.

**3. Song usage report:** Settings → *Record every song shown live*, with the licence number. A song counts once per service. **Save report** saves a CSV file that opens in Excel. Add each song's CCLI number in Presentation Studio. Leave this off if your church has no song licence.

**4. Alerts:** the **Alert** button in the toolbar. Tap a ready message or type one. It shows across the top of the projector and on the stage display. Click **Hide alert** to remove it. Messages you save are kept.

**5. OBS automation:** Broadcast → *Automatic scene switching*. Choose a scene for each item type (e.g. Song → "Lyrics", Slides → "Pastor camera"). One item can use its own scene: Presentation Studio → **OBS scene**.

**6. Two-language songs:** a song's **Second language** field: *Line by line* or *Side by side*. Type the Twi words with the same section labels as the English. OpenLyrics and OpenLP files with two languages are imported this way automatically.

**7. Service timing:** each item has a **Planned length**. Service Planner shows the total and when each item starts. The stage display counts down the live item and turns red when it runs over.

**8. Chords:** type them in the lyrics, e.g. `[G]Amazing [C]grace`. The audience never sees them. The stage display shows them above the words. Set the song's **Key**. **Band plays in** moves the chords up or down. To turn chords off on the stage display, use Display Manager → *Stage display layout*.

**9. Phone remote:** planned only, see `docs/remote-control-plan.md`.

### Check it works
- [ ] Import a folder that has a mix of formats. The list shows titles, the format and tags (Chords, 2 languages, In library).
- [ ] Back up to a USB stick. Delete a song. Restore. The song is back.
- [ ] Turn on usage recording. Show a song twice, then save the report: it is counted once.
- [ ] Show an alert. It appears on the projector and the stage display. Hide it.
- [ ] Set Song → a scene in Broadcast, turn switching on, and send a song live: OBS switches.
- [ ] Add Twi lines to a song with *Line by line* on: each English line is followed by its Twi line.
- [ ] Give an item a planned length of 1 minute. After a minute live, the stage timer turns red.
- [ ] Add chords and a key, set *Band plays in* to +2. The stage shows the moved chords; the projector shows none.

---

# KVLOG 0.9.1 — bigger OBS panel with audio mixer

- **Live Studio → OBS Studio** is now much taller. **Scenes** are big tiles: click one to switch OBS (red = Program, blue = Preview in Studio Mode).
- **Audio** tab: every OBS audio source with a live level meter (green / yellow / red), a volume fader (double-click = 0 dB) and a mute button. Changes go straight to OBS.
- The **Overlays** panel was removed from Live Studio to make room. Turn overlays on/off on the **Overlays** page (power buttons, *Turn all off*), like the Bible page.

Update: copy `src`, `electron`, `shared`, `README.md`, then `npm run typecheck` and `npm run dev`. Reconnect to OBS once (Broadcast → Disconnect → Connect, or restart KVLOG) so the level meters start.

---

# KVLOG — Overlays (0.9.0)

A new **Overlays** page (sidebar, under Production) and an **Overlays** panel in Live Studio.

- **Kinds:** Logo / watermark, Lower third (name + title), Clock, Countdown (for N minutes, or until a time such as 10:00), Scrolling ticker, Song / verse bar (follows the live item automatically), Picture-in-picture (a video or picture from the Media Library).
- **Where it shows:** tick **Projector** and/or **OBS** for each overlay. Overlays hide during Blackout unless *Keep showing* is ticked. During Clear they still show (useful for a countdown before the service; in OBS it sits over your camera).
- **Turn on/off:** click it in Live Studio → Overlays. *All off* turns everything off. Lower thirds turn off by themselves after 10 seconds (change *Turn off after*, 0 = stays on).
- **Design:** on the Overlays page, drag the overlay on the preview to move it, drag the corner to resize, or use the position buttons. Font, size, colours, background, corners and transparency are on the right. List order = layer order.
- Overlays are not affected by slide fades. Whether an overlay is on is not saved: everything starts off when KVLOG opens.

Update: copy `src`, `electron`, `shared`, `package.json`, `README.md`, then `npm run typecheck` and `npm run dev`. Saved data is upgraded automatically (data version 6). OBS: nothing to change; the existing **KVLOG Output** source shows overlays too.

### Check it works

- [ ] Overlays → + Add… → Logo; pick a PNG. Turn it on: it shows on the projector and in OBS.
- [ ] Add a Lower third, untick Projector. Turn it on in Live Studio: OBS only, gone after 10 s.
- [ ] Add a Countdown (2 minutes) and turn it on with nothing live: the projector shows the countdown on black.
- [ ] Add a Song / verse bar (OBS). Send a scripture live: the bar shows the reference.
- [ ] Press B: overlays hide (except ones with *Keep showing*).

---

# KVLOG — presentation engine (0.8.0)

## What's new

- **Slides items (design your own deck).** Presentation Studio → **New slides**. In Slide Editor: **+ Slide**, duplicate, move up/down, delete. Each slide is a free page of text, pictures and shapes.
- **Layers** (bottom right): every object, top first. Move up/down, **lock** (can't be moved or deleted) and **hide** (kept, but not shown on any screen).
- **Copy / cut / paste** objects with Ctrl+C / Ctrl+X / Ctrl+V, also between slides and items. With nothing selected on a Slides item, Ctrl+C copies the whole slide.
- **Properties** are grouped as Text, Font, Alignment, Effects (transparency, outline, shadow) and Fill and border.
- **Apply to all:** on a Slides item, clicking a template applies it to **all slides** (words and pictures are kept). On songs, *Use this design on all slides* / *Reset slides to template*. **Use template for all … items** applies it across the open service.
- **Preview and Program** in Live Studio. Choose **Click = Preview** on the Preview monitor: clicking a slide queues it, **Take** (or **Enter**) sends it live. Double-click still sends straight to live. **Click = Live** works as before.

## Already in place (from earlier milestones)

- Keyboard: → / Space / PageDown next, ← / PageUp previous, **Enter** take, **B** blackout, **Esc** clear, **F5** projector.
- Storage: one local data file, saved 0.5 s after each change and again on close. Each save goes through a temporary file; the previous version is kept as `.bak`; a damaged file is moved aside and the `.bak` is used.
- Outputs: the main window sends one "snapshot" to the projector, stage display and the OBS browser source, so all screens show the same thing.

Update: copy `src`, `electron`, `shared`, `package.json`, `README.md`, then `npm run typecheck` and `npm run dev`. Saved data is upgraded automatically (data version 5).

### Check it works

- [ ] Presentation Studio → New slides. Slide Editor: add 3 slides, a logo, a shape. Lock the logo; try dragging it (it stays).
- [ ] Hide the shape in Layers: it disappears from the projector, stays in the list.
- [ ] Ctrl+C a text box, go to slide 3, Ctrl+V.
- [ ] Click the **Header** template: all slides change, words kept. Ctrl+Z restores.
- [ ] Live Studio → Click = Preview. Click slide 3: it appears in Preview. Enter: it goes live.

---

# KVLOG — Slide Editor and templates (0.7.0)

A **Slide Editor** page is now in the sidebar, under Presentation.

- **Pick an item** (top left) and a slide. The big slide in the middle is exactly what the projector and OBS show.
- **Move and resize:** drag a box; drag the white handles to resize. Boxes snap to the centre, the safe area (dashed line) and other boxes. Hold **Alt** to stop snapping, **Shift** on a corner to keep a picture's shape.
- **Style text** on the right: font, size, colour, bold, italic, capitals, alignment, line spacing, outline and shadow. *Shrink to fit* makes long verses smaller automatically.
- **Add** text, pictures/logos (from the Media Library) and shapes (bars, boxes behind text). *More…* adds the item title or reference.
- **All slides (template)** changes the template, so every slide (and every item using it) changes. **This slide only** changes one slide; it gets an *Own layout* badge. *Reset slide to template* undoes that. In this-slide mode you can also replace the words for that slide only.
- **Templates** (under the slide): click one to use it for the item. *Classic* is KVLOG's original look. Built-in templates are copied the first time you change them. **New template**, **Duplicate**, **Delete**, and **Save as new template** (from the slide you designed). Rename a template and give it its own background on the right when nothing is selected.
- **Undo / Redo:** Ctrl+Z / Ctrl+Y (or the arrows in the toolbar). Arrows nudge the selected box, Delete removes it, Ctrl+D duplicates it.

Update: copy `src`, `electron`, `shared`, `package.json`, `README.md`, then `npm run typecheck` and `npm run dev`. No new packages. Saved data is upgraded automatically (data version 4).

Note: *This slide only* layouts are linked to the slide number. If you add or remove verses above that slide later, check the layout is still on the right slide.

Still to come: **overlays** (logo, lower third, clock/countdown, ticker, reference bar, picture-in-picture) and **screen setup** (safe margins and masks per screen, a different template for OBS, stage display layout).

### Check it works

- [ ] Slide Editor → choose a song → click **Box** under the slide. The projector shows the dark box.
- [ ] Drag the words box down and make the text yellow. A notice says an editable copy was made. Projector and OBS update.
- [ ] Ctrl+Z twice: back to how it was.
- [ ] Add a picture (a logo PNG) top right; Shift-drag a corner to resize.
- [ ] Switch to **This slide only**, change slide 2's words. Only slide 2 changes; it shows *Own layout*.
- [ ] Click **Classic**: the song looks like before.

---

# KVLOG — Bible (0.6.6)

A **Bible** page is now in the sidebar, under Presentation.

- **First time:** click **Download** next to KJV, WEB, ASV and/or BBE (free, public domain; needs internet once, about 5 MB each). After that they work offline.
- **Find a verse:** type `John 3:16-18`, `jn 3 16`, `Ps 23`, `1 Cor 13:4-7` or `Gen 1:1-2:3` and press **Enter**. Press **Enter again** to show it live.
- **Or pick:** click a book, a chapter, then a verse. **Shift+click** another verse to choose a range. **Double-click** a verse to show it live straight away.
- **Side by side:** choose a second Bible in *Side by side*. Slides show both translations in two columns (projector and OBS).
- **Verses per slide:** 1–4 (default 2). **Verse numbers** can be turned off.
- **Add to service** saves the passage as a Scripture item at the end of the open service. You can edit it later in Presentation Studio.
- **Show live** reuses one library item (the reference you last showed), so quick look-ups do not fill your library.
- **Other translations (Twi, NIV, NKJV, ESV):** Bible page → **Translations** → **Import a Bible file** (Zefania XML, OSIS XML or JSON). These are copyrighted: use them only with the publisher's permission (for Twi, the Bible Society of Ghana). Then give it a short name such as "Twi".

Update: copy `src`, `electron`, `shared`, `package.json`, `README.md`, then `npm run typecheck` and `npm run dev`. No new packages.

### Check it works

- [ ] Bible → Download KJV and WEB. Both appear under "On this computer".
- [ ] Type `John 3:16-18`, Enter: verses 16–18 are highlighted and two slides appear. Enter again: it is live on the projector and in OBS.
- [ ] Press → : the next slide shows.
- [ ] Choose WEB in *Side by side*: slides show KJV and WEB in two columns.
- [ ] Click **Add to service**: the passage is in the service in Live Studio.
- [ ] Turn off the internet and restart KVLOG: the Bible still works.

---

# KVLOG — Milestone 6.5: pictures, videos, presentations

## New

- **Pictures and videos as service items.** Media Library → **Add pictures or videos** (PNG, JPG, WebP, GIF, MP4, WebM), then **Add to service**. Or in Presentation Studio / Service Planner click **Media** and choose one. They show full screen; videos loop until you move on.
- **Moving backgrounds.** A video can be the background of a song, scripture or announcement (pick it in Background).
- **PowerPoint and PDF.** Click **Presentation**, then **Import PowerPoint or PDF**. PowerPoint files are converted by Microsoft PowerPoint on this PC; each slide becomes a picture. Hidden slides are skipped.
- **Transitions.** Every item has **Fade** or **Cut**. The projector, the Live monitor and OBS all use it.
- **OBS shows everything.** Broadcast → **KVLOG in OBS** → *What OBS shows*: **Full screen** (same as the projector) or **Text over camera** (text over the camera; pictures, videos and slides full screen). Clear and Blackout make OBS see-through so the camera shows.
- **Video sound** plays on the projector (this PC's speakers) and in OBS ("Control audio via OBS" is ticked automatically). The Live and Next monitors in KVLOG are always muted.

### Update steps

1. Close KVLOG. Copy `src`, `electron`, `shared`, `package.json` and `README.md` over your project.
2. Install the one new package (draws PDF pages):
   ```
   cd C:\Users\HP\Documents\kvlog
   npm install
   npm run typecheck
   npm run dev
   ```
3. In OBS, delete the old **KVLOG Lyrics** source. In KVLOG click **Send to OBS** (or Broadcast → Add to current OBS scene) to create **KVLOG Output**.

Your saved data is upgraded automatically (data version 3). The previous file is kept as `kvlog-data.json.bak`.

### Check it works

- [ ] Media Library: add a picture and an MP4. The video card shows a still frame and a "Video" badge.
- [ ] Click **Add to service** on the video. In Live Studio, click it: it plays on the Live monitor (muted), on the projector with sound, and in OBS.
- [ ] Move to the next item: the video fades out. Change that item to **Cut**: it switches instantly.
- [ ] Presentation Studio → **Presentation** → **Import PowerPoint or PDF** → choose a .pptx. After it converts, each slide appears; send them live with → .
- [ ] Do the same with a PDF.
- [ ] Give a song a video background. The lyrics show over the moving video.
- [ ] Broadcast → KVLOG in OBS → **Text over camera** → Save. Song text sits over the camera; a picture still covers the screen.
- [ ] Press B (Blackout): OBS shows the camera, the projector goes black.

### Known limits

- PowerPoint animations, slide transitions and embedded videos are not kept. Add videos as separate Media items.
- MP4 must be H.264/AAC (most phone and editing exports are). HEVC/H.265 files may not play; re-export as H.264.
- Video files are copied into KVLOG, so large videos use the same space again on disk.

---

# Milestone 6

## New in Milestone 6

- **Go live / Stop stream** and **Record / Pause / Stop** on the Broadcast page and at the top of Live Studio's OBS panel. Go live and Stop need a second click.
- KVLOG only says "The stream is live" once OBS confirms it. If OBS fails to start (no stream key, no internet, recording folder missing), you get a plain explanation. If OBS gives no answer within 15 seconds, KVLOG says so.
- When a recording stops, KVLOG shows where OBS saved the file. If the stream stops or reconnects without you asking, KVLOG tells you.
- **Audio tab**: every OBS source with audio, with one-click mute/unmute. Muting in OBS updates KVLOG too.
- **Lyrics in OBS**: a transparent lyric overlay for an OBS Browser Source. It follows the live slide and hides on Blackout or Clear. **Add to current OBS scene** creates the "KVLOG Lyrics" source for you.
  - Address: `http://127.0.0.1:4460/lyrics` (port can be changed). Only this computer can open it.
  - Options: `?position=bottom|center|top`, `&size=56` (pixels), `&band=1` (dark strip), `&kinds=song,scripture,announcement`.

No new packages. Run `npm run dev` as usual.

### Verify Milestone 5 and 6 (OBS open, KVLOG connected)

Milestone 5 checks are below; run them first if you have not yet.

- [ ] Broadcast → Stream and recording: click **Record**. Within a second it says *Recording started* and the time runs. Toolbar Rec shows the same time.
- [ ] Click **Pause**, then **Resume**. Click **Stop** twice. KVLOG shows *Recording stopped. Saved to …* with the file path.
- [ ] In OBS, remove the stream key (Settings → Stream), then click **Go live** twice in KVLOG. KVLOG explains that OBS could not start the stream. Put the key back.
- [ ] With a valid key (a private/unlisted test stream), **Go live** works and **Stop stream** (two clicks) ends it.
- [ ] Start and stop recording in OBS itself. KVLOG follows.
- [ ] Live Studio → OBS panel → **Audio**: your mic and desktop audio are listed. Click one: it mutes in OBS. Mute in OBS: KVLOG shows Muted.
- [ ] Broadcast → Lyrics in OBS: tick **Turn on**, Save. The address appears. Click **Add to current OBS scene**. OBS gets a "KVLOG Lyrics" source.
- [ ] In Live Studio, click a song slide. The lyrics appear over the OBS video. Press → : they change. Press B: they hide. Esc: they hide.
- [ ] The card says *showing in 1 Browser Source*.
- [ ] Change the port to one another program uses (e.g. 4455, OBS's own). KVLOG says the port is in use. Set it back to 4460.

---

# Milestone 5

## New in Milestone 5

- **Real OBS connection** through the official obs-websocket API (OBS Studio 28 or newer).
- **Broadcast** page: address, port and password. The password is encrypted by Windows (`safeStorage`), kept only on this computer and never shown or logged.
- Clear status everywhere: Connected, Connecting, Wrong password, Not reachable, Retrying. If OBS closes or the network drops, KVLOG reconnects automatically (2 s, 4 s, 8 s … up to 30 s). A wrong password does not retry.
- **Live Studio → OBS Studio panel**: your real scenes, in the same order as OBS. Click one to switch OBS to it. The Sources tab lists the sources in the current scene.
- Toolbar **Stream** and **Rec** pills show what OBS reports.

### Verify Milestone 5

- [ ] With OBS **closed**, open Broadcast and click Connect. It says *Not reachable* and starts retrying.
- [ ] Start OBS. Within about 30 seconds KVLOG says *Connected* (or click Connect).
- [ ] Enter a **wrong** password and Save. It says *Wrong password* and stops retrying. Enter the right one and Save. It connects.
- [ ] Live Studio → OBS Studio → Scenes lists the same scenes as OBS. Click one: OBS switches. Switch in OBS: KVLOG follows.
- [ ] Add or rename a scene in OBS. KVLOG updates by itself.
- [ ] Sources tab lists the sources in the current scene. Hide one in OBS: it fades in KVLOG.
- [ ] Start recording in OBS. The toolbar shows Rec with a running time. Stop it: Rec says Off.
- [ ] Close OBS. KVLOG says *The connection to OBS was lost* and retries.

---

# Milestone 4

## New in Milestone 4

- **Projector window**: full-screen audience output on the screen you choose. **Present** (or F5) opens and closes it.
- **Stage display**: a separate screen for the people on stage, showing the current slide, the next slide, a clock and the item's notes.
- All windows stay in sync: the main window sends every change to the projector and stage display straight away.
- **Display Manager**: choose a screen for each output. KVLOG remembers your choice on this computer (`kvlog-settings.json`). If that screen is unplugged, the output moves to a normal window, and it goes back when the screen returns.
- Press **Esc** in an output window to close it.
- **Media Library**: add background images (PNG, JPG, WebP, GIF). They are copied into KVLOG's own `media` folder. Missing files are flagged, and slides that use them show black instead of breaking.
- Saved data is upgraded automatically from version 1 to version 2 (adds the Media Library). Your old file is kept as the `.bak` backup.

### Verify Milestone 4

With one screen:
- [ ] Display Manager: both outputs say “A normal window”. Click **Open projector** and **Open stage display**. Two windows appear.
- [ ] In Live Studio, click a slide and press →. Both windows change at the same time. Press B: the projector goes black and the stage display says BLACKOUT.
- [ ] Click into an output window and press Esc. It closes, and Display Manager shows it as Off.

With a second screen (Windows key + P → **Extend**):
- [ ] Display Manager lists both screens. Choose the second screen for the projector and click **Open projector**. It fills that screen.
- [ ] Unplug the second screen. The projector moves into a window. Plug it back in. It returns full screen.

Media:
- [ ] Media Library → **Add images**, choose a picture. It appears in the grid.
- [ ] Presentation Studio: the picture appears after the colour swatches under Background. Pick it. The slides show the image with the text on top.
- [ ] Close and reopen KVLOG. The image and the choice are still there.

---

# Milestone 3

## New in Milestone 3

- **Automatic saving.** Every change is saved about half a second after you make it, and again when you close the window. The status bar shows "All changes saved".
- Data is stored in `C:\Users\<you>\AppData\Roaming\KVLOG\kvlog-data.json` (Settings → Local data → Show in File Explorer).
- Safe writes: each save goes to a temporary file first, the previous version is kept as `kvlog-data.json.bak`, and a damaged file is never deleted (it is renamed and KVLOG restores the backup).
- The file has a version number so future KVLOG versions can upgrade it safely. SQLite will replace this file once the library is large enough to need it.
- **Service Planner**: create, rename, date, duplicate and delete service plans. Add items from the library, reorder by dragging or with the arrows, remove items, and **Open in Live Studio**.
- **Library**: songs, passages and announcements are stored once and can be used in many services. Editing a song updates it everywhere.
- Presentation Studio now has **This service / All items** tabs.

### Verify Milestone 3

- [ ] Start KVLOG. The status bar says **All changes saved**.
- [ ] In Presentation Studio, create a song and type a few lines. The status bar briefly shows **Saving…**.
- [ ] **Close the KVLOG window** (the X button, not Ctrl + C), then run `npm run dev` again. The song is still there.
- [ ] Open **Service Planner**. Click **New**, name the plan, pick a date.
- [ ] Click **Add** on three library items. Drag one to a new position. Use the arrows to move another.
- [ ] Click **Open in Live Studio**. Live Studio's service list shows the new plan in the new order.
- [ ] Close and reopen KVLOG. The plan, its order and the open plan are all restored.
- [ ] Settings → Local data shows the file path. **Show in File Explorer** opens the folder.

Note: stopping KVLOG with **Ctrl + C** in PowerShell skips the final save. Changes from the last half second may be lost. Close the window instead.

---

# Milestone 2

- **Presentation Studio**: create, edit and delete songs, scripture passages and announcements.
- Lyrics split into slides automatically: blank lines separate sections, labels like `[Verse 1]` or `Chorus:` name them, a label on its own repeats that section, and `---` forces a new slide. Choose 1–4 lines per slide.
- Scripture: one slide per paragraph, with the reference and translation at the bottom.
- Background choice per item, private notes, live preview and click-to-send-live.
- Long slides shrink their text automatically.
- **Present (F5)**: full-screen audience output in the main window. Esc or F5 exits. (Separate projector and stage windows: Milestone 4.)
- Changes are kept until you close KVLOG. Saving arrives in Milestone 3.

### Verify Milestone 2

- [ ] Open **Presentation Studio**. Click **Song** (top left). A new song appears with its title selected; type a title.
- [ ] Paste lyrics with `[Verse 1]` and `[Chorus]` sections separated by blank lines. Slides appear on the right as you type.
- [ ] Change **Lines per slide** from 2 to 4. The slide count changes.
- [ ] Type `[Chorus]` again on its own at the end. The chorus slides are repeated.
- [ ] Pick a different background. The thumbnails change.
- [ ] Click a slide on the right. It shows in **Live output**. Use ← → to move through slides (click outside a text field first).
- [ ] Press **F5**. The output fills the screen. Use ← → and B there, then Esc to return.
- [ ] Click **Scripture**, set a reference, paste two paragraphs. Two slides appear with the reference at the bottom.
- [ ] Click **Delete** twice on an item. It disappears from the list.

---

# Milestone 1

## What works in Milestone 1

- Secure Electron app (context isolation on, Node integration off, sandboxed renderer, restricted preload bridge, validated IPC, no pop-ups or navigation).
- Dark KVLOG workspace: sidebar, toolbar, status bar.
- Live Studio: Live and Next monitors, slide grid, service list, blackout and clear.
- Keyboard: → / Space / Page Down = next, ← / Page Up = previous, B = blackout, Esc = clear.
- Display Manager: real list of connected screens, with an Identify button that shows a number on each screen.
- Settings: real app version, Electron/Chromium/Node versions and the window's actual security settings.

## What is not connected yet (shown honestly in the app)

- OBS (scenes, sources, audio, stream and record status): Milestone 5–6. The app shows "Not connected" / "Unavailable".
- Song editor: Milestone 2. Saving and service planning: Milestone 3. Projector and stage windows: Milestone 4.
- The service list contains public-domain sample content so you can try slide control.

---

## 1. Install the required software (one time)

1. **Node.js (LTS version)**: go to https://nodejs.org, download the **LTS** Windows Installer (.msi) and run it. Keep the default options. This also installs **npm**.
2. **Visual Studio Code** (recommended editor): https://code.visualstudio.com
3. **Git** (optional for now, useful later): https://git-scm.com/download/win

Check that Node.js installed. Open **PowerShell** (Start menu → type "PowerShell") and run:

```
node -v
npm -v
```

You should see version numbers (for example `v22.x.x` and `10.x.x`).

## 2. Put the project on your computer

Unzip the downloaded `kvlog` folder to, for example, `C:\Projects\kvlog`. The folder must contain `package.json` directly inside it.

## 3. Install the project's packages (one time, and after any package.json change)

In PowerShell:

```
cd C:\Projects\kvlog
npm install
```

This downloads React, Electron and the other tools into a `node_modules` folder. It can take a few minutes the first time.

## 4. Launch KVLOG

Still in `C:\Projects\kvlog`:

```
npm run dev
```

The KVLOG window opens after a few seconds. Leave PowerShell open while you use it; closing the KVLOG window stops everything. You can also stop it with `Ctrl + C` in PowerShell.

## 5. Verify Milestone 1

- [ ] The KVLOG window opens with the dark workspace and the "KV" logo in the sidebar.
- [ ] In the service list, click **Amazing Grace**. Its six slides appear in the slide grid.
- [ ] Click slide 1. It shows in **Live output** with a red outline; slide 2 shows in **Next**.
- [ ] Press → several times. The live slide advances and moves on to the next service item at the end.
- [ ] Press **B**: Live output goes black. Press **B** again to bring it back. Press **Esc** to clear.
- [ ] The toolbar shows **OBS — Not connected** and Stream/Rec **Unavailable**.
- [ ] Open **Display Manager**. Your screens are listed. Click **Identify**: a number appears on that screen for about 2 seconds.
- [ ] Open **Settings**. Context isolation, Sandbox and Web security show **Enabled**; Node integration shows **Disabled**.
- [ ] The status bar shows the number of displays detected.

## 6. Check the code and production build (optional)

```
npm run typecheck
npm run build
npm start
```

`npm run build` checks types and builds the app into `dist` and `dist-electron`. `npm start` runs that built version without the development server. (The Windows installer comes in Milestone 7.)

## Troubleshooting

- **"running scripts is disabled on this system"** when running npm in PowerShell: run this once, then try again:
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (or use **Command Prompt** instead of PowerShell).
- **"Port 5173 is already in use"**: another `npm run dev` is still running. Close it, or close the other PowerShell window.
- **Electron failed to install / download errors**: check your internet connection, delete the `node_modules` folder and run `npm install` again.
- **Blank white or black window**: press `Alt` to show the menu, then View → Toggle Developer Tools, and look at the Console tab for red errors. Copy them into our chat.
- In development, Electron may print a "security warning" about the Content Security Policy in the terminal. That is expected: the development policy allows Vite's hot reload. The built app uses a strict policy.

## Project structure

```
kvlog/
  electron/
    main.ts            Electron main process: windows, security, IPC handlers
    preload.ts         The restricted bridge exposed to the UI as window.kvlog
    storage.ts         Validated, versioned, crash-safe data file
  shared/
    bridge-types.ts    Types shared by main, preload and UI
    data-types.ts      The saved data format
  src/
    main.tsx           React entry point
    App.tsx            App shell and module switching
    types.ts           Service item and slide types
    data/              Starter content, item types, backgrounds
    state/             Presentation state, keyboard shortcuts, automatic saving
    services/          Desktop bridge hooks, clock, dates
    slides/            Turns typed text into slides
    components/        Sidebar, Toolbar, StatusBar, Panel, SlideView, OutputView
    modules/           Live Studio, Presentation Studio, Service Planner, Display Manager, Settings
    styles/            global.css, presentation.css, planner.css
  index.html
  vite.config.mts      Vite config (adds the strict production CSP)
  tsconfig.json        TypeScript settings for the UI
  tsconfig.electron.json  TypeScript settings for Electron main/preload
```

## Commands reference

| Command | What it does |
| --- | --- |
| `npm install` | Install packages |
| `npm run dev` | Run KVLOG in development mode |
| `npm run typecheck` | Check all TypeScript for errors |
| `npm run build` | Build for production |
| `npm start` | Run the production build |
