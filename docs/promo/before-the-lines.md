# Before the Lines: promo film brief

A 45 second vertical film for HistoNaija. This file holds the creative direction (A), the production blueprint (B) and the quality checklist (D). The self-contained prompt for Gemini (C) is in [gemini-prompt.md](gemini-prompt.md). The plate capture script is [capture-plates.mjs](capture-plates.mjs).

## How the film is built now

The film is made here, end to end, from the real site. Gemini is no longer in the loop ([gemini-prompt.md](gemini-prompt.md) is kept for reference only).

```
npx astro dev --background                     # the capture scripts drive the dev server
npm i --no-save puppeteer-core
node docs/promo/capture-plates.mjs             # 25 map stills  -> film-public/plates/
node docs/promo/capture-recordings.mjs         # R1-R3 phone takes -> film-public/rec/
node docs/promo/render-score.mjs               # the site's own music, offline -> film-public/audio/
npm run film:render                            # -> out/before-the-lines.mp4 (-14 LUFS)
npm run film                                   # Remotion Studio, to scrub and tweak
```

- **Footage** lives in `film-public/` (Remotion's public dir), so the site never ships it. It is rebuilt by the scripts, so it is not committed.
- **Recordings** are scripted taps in a 432 × 768 touch viewport at 2.5×. Headless Chrome paints slowly, so the page's clock runs 4× slower while the camera rolls (`SLOW=4`) and the frames are retimed back to real speed. That gives smooth 30 fps.
- **Score.** `renderSoundscape` and `renderCue` in `src/lib/sound.ts` render the ensemble offline with a seeded random. `SEED=<n>` gives another take. The drain cuts land on the drum's closing roll (frames 117 to 150), and 1000 AD lands on the gong (frame 157).
- **Code:** `src/film/` (`config.ts` holds the grid, colours, eases and recording marks; `parts.tsx` the plate, type, year odometer and screen; `BeforeTheLines.tsx` the cut and the sound).
- **Draft data.** The dev server shows drafts, and the film shows them too. Publish what it shows (below) before the film is posted.

## Before anything is filmed

These are owner tasks. Gemini cannot do them.

1. **Publish what the film shows.** All 145 peoples, 29 polities and 99 events are `draft` today, and the public build (`dist/`) shows an empty map. A film that shows draft claims publishes them. Before capture, review and publish at least: the Igala group; the Benin, Kanem-Bornu, Oyo, Sokoto and Igala polities; the events `portuguese-at-the-coast`, `benin-expedition-1897` and `kanem-bornu-partition`; and every polity that appears in the 1000 to 1850 sweep plates. Then capture from the **public** build (`npm run build && npm run preview`), not the dev server.
2. **Re-read the numbers.** After publishing, note the counts the real UI shows ("In 1600 · N states on the map"; "Igala · N LGAs across N states"). The film does not overlay these numbers, but the screen recordings show them, so they must be the public ones.
3. **Pick the URL.** The site is not deployed yet (scope feature 24). The film uses `{{SITE_URL}}` until there is one.
4. **The name.** The UI, logo and code say **HistoNaija**, so the film does too. "Nigeria Histomap" appears nowhere in the product. If you want the film to use that name, the site has to change first, or the footage contradicts the end card.

## Capture list (what you hand Gemini)

Gemini cannot open your local site, so you capture everything and attach it in the folder layout given in §4 of the prompt.

**Plates.** Run these against the public build:
```
npm run build && npm run preview          # leave running
npm i --no-save puppeteer-core
node docs/promo/capture-plates.mjs http://localhost:4321 docs/promo/plates
```
This produces 26 JPEGs of the map alone. Each plate takes 10 to 25 s (the script waits until the map stops changing), so the run takes about ten minutes. Open them and check that none is blank or half drawn, then re-shoot any that are with `ONLY=sweep-1255 node …`.

**Phone recordings.** Use light mode, Do Not Disturb, full brightness, and 1080p at 30 or 60 fps. Serve the public build to the phone with `npx astro preview --host` and open `http://<your PC's LAN IP>:4321` on the same Wi-Fi. Move slowly and pause about 1 s before each tap.
- **R1 Igala bridge (about 20 s).** Peoples tab → type "Igala" letter by letter → select it → hold 2 s on the highlight → scroll the profile to "In history" → tap "Igala Kingdom at its height, 1750" → hold 4 s.
- **R2 Oyo story (about 15 s).** Kingdoms tab, year 1750 → tap Oyo → let the title sequence play → let the first chapter draw its frontier.
- **R3 Ships (about 12 s).** Kingdoms tab, year 1472 → zoom gently toward the Bight of Benin → hold while a ship sails in along its lane.
- **R4 Playback (optional, about 20 s).** Kingdoms tab at 1000 → press Play → hold.

Convert each recording to a constant 30 fps: `ffmpeg -i in.mp4 -vf fps=30 -c:v libx264 -crf 16 -pix_fmt yuv420p -an R1-igala-bridge.mp4`. CapCut's bundled ffmpeg works. Write `rec/markers.json` with the second of each key moment: R1 `tapKingdom`, R2 `title`, R3 `shipIn`.

**Audio.** Use desktop Chrome with system audio recorded (OBS "Application Audio Capture", or Audacity with WASAPI loopback) as a 48 kHz WAV.
- **A1 score.** Open a fresh tab on `/?mode=then&year=1000` with sound on, start recording, then press Play. That first gesture starts the wind, the drum's two-bar call, the gong, and the full "film" mix. Record 90 s. The music is generative, so make three takes and keep the best. In Audacity, note the first drum stroke and the gong in seconds, and save them as `A1-markers.json`.
- **Cues.** With sound on, tap a map mark (`tap`), open a story (`open`) and step a chapter (`chapter`). Cut each into its own short WAV.
- **Listen honestly.** The ensemble is synthesised in the browser. If it sounds too synthetic for a film, say so, and Gemini uses the licensed fallback in §8 of the prompt.

**Fonts and brand.** Download TeX Gyre Pagella (GUST font licence, free to embed) from gust.org.pl, and copy `public/icons/icon.svg` to `brand/icon.svg`.

## A. Creative concept

**Title: Before the Lines**

**Central narrative.** Everyone in Nigeria knows the shape of the map and its state lines. Those lines are recent. Under them is a thousand years of kingdoms, empires, city-states and peoples who governed themselves. They rose, spread, traded, fought and were divided, and their rulers still reign today. HistoNaija lets you lift the lines and watch it happen.

**The viewer's journey**

| Beat | The viewer feels | What they see |
|---|---|---|
| Curiosity (0 to 5 s) | "Wait, that's Nigeria?" | The familiar coloured map, then a hard cut to the same land in 1600: an old-map parchment crowded with kingdoms, with today's state lines lying over them. The lines fade away. |
| Discovery (5 to 26 s) | "There was this much here?" | The ink drains back to the year 1000, a gong sounds, and a thousand years flood forward. Then a kingdom's story opens, ships arrive, and scarlet conquest cracks the map apart. |
| Weight (26 to 31 s) | "It didn't vanish." | Silence. Then the rulers who still reign from the old seats. |
| Participation (31 to 45 s) | "I want to look up my people." | A real phone search: a people lights up across six states, then one tap shows the kingdom they built. End card with the URL. |

**Why this fits HistoNaija specifically**

- The opening move is a real feature. In the Then view, "Show today's state lines" lays the modern lines over the old map. The film's title is that toggle.
- The product already thinks like a documentary. Playback runs in letterbox bars with a following camera, a polity opens as a titled story with a frontier drawn by pen, and every snapshot carries a source and a confidence level. The film borrows that grammar: film-black bands, masked serif titles, ink that soaks in.
- It is honest about what most empire maps leave out. The product labels the unshaded land: "Unshaded land was not empty." The film gives that a line of its own.
- The bridge between peoples today and the states they built is the product's signature feature. The film ends on it.
- The score is the map's own. The site plays an ensemble synthesised in the browser: talking drum, iron bell, udu, wooden flute, balafon, gong, kakaki and voices, in 12/8 at 92 BPM. The film is cut to that music.

**The signature moment: the drain and the flood.** Today's lines lift off 1600. The ink drains backwards through the centuries to 1000 AD. On the gong (the product's own opening, which lands two bars after the talking drum's call), a thousand years flood forward.

## B. Production blueprint

**Format.** 1080 × 1920 (9:16), 30 fps, 45.0 s (1350 frames), H.264 and AAC. The audience is Nigerian and diaspora mobile users, and the platforms are Instagram Reels, TikTok, WhatsApp Status, YouTube Shorts and X, so the film is vertical. A 16:9 cut can follow later from the same components.

**The grid.** Picture is cut to the music. One bar of 12/8 at 92 BPM is 2.6087 s, or 78.26 frames. Bar *n* starts at frame round(78.26 × n). Bar 0 is the talking drum's first stroke, and the gong is the downbeat of bar 2.

**Footage.** There are two kinds, and both are the real product.
- **Plates.** High-resolution stills of the map alone, made by `capture-plates.mjs` with a 1080 × 1920 map area at 2× scale. All the sweep plates share one camera, so they cross-dissolve in register. The map's own controls are hidden; the end card carries the GRID3 and Natural Earth credit.
- **Recordings.** Phone screen recordings of real interactions (R1 to R3), with the UI visible.

### Storyboard

| # | Frames | Time | Picture | On-screen text | Sound |
|---|---|---|---|---|---|
| S1 Hook | 0–45 | 0:00.0–0:01.5 | Plate `p01-today-atlas`: modern Nigeria, every LGA coloured by people. Slow push-in, 1.00 to 1.04. Top band closed (height 0). | **You know this shape.** | Wind already rising. The talking drum's first stroke lands on frame 0. |
| S2 Turn | 45–112 | 0:01.5–0:03.7 | Hard cut, on a drum stroke near frame 45, to `p02-then-1600-statelines` (parchment, kingdoms, modern state lines over them). The top band opens. At frames 80–112 the state lines fade out (cross-dissolve to `p03-then-1600`). | **This is the same land in 1600.** | The drum's call continues alone. |
| S3 Drain | 112–157 | 0:03.7–0:05.2 | Hard cuts backwards through the sweep plates, 1580 to 1000, about 5 frames each. The year counter rolls 1600 to 1000, accelerating. | **Rewind a thousand years.** (from frame 118, held to 235) | The drum's call ends. |
| S4 Flood | 157–470 | 0:05.2–0:15.7 | **The gong lands on frame 157.** From `sweep-1000` forward to `sweep-1850`, cross-dissolving 12 frames each on bar and half-bar lines, under a continuous slow Ken Burns. The year counter climbs. | Bar 2: the counter settles on 1000 under the held line. Bar 3: **Kingdoms rise.** (kicker: *c. 1440 · Oba Ewuare the Great*). Bar 4: **Empires spread.** (kicker: *c. 1580 · Idris Alooma: the imperial height*). Bar 5: **Between them, peoples ruled themselves.** (kicker: *c. 1850 · Sokoto Caliphate: the largest state in West Africa*) | Full ensemble (the "film" mix). |
| S5 Story | 470–626 | 0:15.7–0:20.9 | Recording R2: a phone taps Oyo, the story opens (letterbox bars close in, "Oyo Empire" rises out of its mask), and a frontier is drawn by pen. | **Open any kingdom's story.** | Ensemble continues. |
| S6 Contact | 626–783 | 0:20.9–0:26.1 | 626–690: R3, the Portuguese ship sails in, drawing its wake. 690–745: plate `p21-benin-1897`, with scarlet British routes converging on Benin City. 745–783: plate `p22-borno-divided-1902`, the kingdom's pieces split along scarlet cracks. | *1472 · The Portuguese reach the coast* → *1897 · The British invasion of Benin* → *1902 · Borno divided four ways* | **The music stops at frame 745.** Only the room's reverb tail and wind remain. |
| S7 Today | 783–939 | 0:26.1–0:31.3 | Slow 18-frame dissolve to `p23-then-today`: the seats of the Oba of Benin, the Attah Igala, the Shehu of Borno, the Sultan of Sokoto and the rest. | 800–861: **The empires ended.** 861–939: **Their rulers still reign.** | Silence until frame 861, then the ensemble re-enters on the downbeat of bar 11, as if it had never stopped. |
| S8 Bridge | 939–1174 | 0:31.3–0:39.1 | Recording R1: type "Igala", and every Igala area lights up in orange across state lines. The profile shows, then a tap on "Igala Kingdom at its height, 1750" turns the map to parchment. | Bar 12: **Search for a people.** Bar 13: **See where they live today.** Bar 14: **And the states they built before.** | Ensemble, plus the product's own tap cue on each tap. |
| S9 End | 1174–1350 | 0:39.1–0:45.0 | End card on film black: logo, wordmark, the tagline "Where Nigeria's peoples live today, and the states they built before.", **{{SITE_URL}}**, "Free · Every claim sourced", and the map credits. | (as listed) | A single gong stroke on frame 1174 (the bar 10 gong that was cut in S6), ringing out. The ensemble fades under it over 2 bars. |

**Transitions.** There are four kinds and no others: hard cuts on drum strokes (S1→S2, the drain), cross-dissolves for time passing (sweep plates, the state lines lifting, S6→S7), the top band opening and closing (film letterbox, 33 frames, ease-in-out), and a cut to black into the end card. No glitch effects, light leaks, whip pans, particles or 3D.

**Narration.** None in the main cut. The film is text-led, so it works without sound. An optional voice-over draft is in the Gemini prompt, off by default.

**Call to action.** The end card holds for 5.9 s, with the URL as the largest text on it. The last line before it ("And the states they built before.") hands straight into the tagline.

## D. Quality-control checklist

**History and honesty**
- [ ] Every on-screen claim matches the claims ledger in the prompt, word for word, and its source file is `published`.
- [ ] Approximate dates carry "c.", as the product shows them. No claim is added that is not in the ledger.
- [ ] No frame shows a "Draft" banner, the dev server, or data that is not on the public build.
- [ ] The self-governing peoples line is present. The film does not suggest that unshaded land was empty.

**Fidelity to the product**
- [ ] Every map image is a plate or a recording from the real site. No UI was drawn, mocked or "improved".
- [ ] Film overlays (bands, headlines, the counter) are clearly film typography, not imitation buttons, chips or panels.
- [ ] The name is HistoNaija everywhere, and the GRID3 and Natural Earth credits appear on the end card.

**Hook and pacing**
- [ ] With sound off, the first 1.5 s reads on its own: the map shape and four words.
- [ ] By 5 s a viewer has seen the 1600 parchment map. Nothing before it is a logo or a fade from black.
- [ ] No text is on screen for less than 0.4 s per word plus 0.5 s.
- [ ] Each act has one idea. Product features shown: three (timeline, story, search-to-kingdom bridge).

**Motion**
- [ ] Sweep plates dissolve in register (no jump in the map between years).
- [ ] Headlines rise out of a mask and leave about three times faster than they arrived. Nothing bounces.
- [ ] The gong lands on frame 157 ± 1 and the music stop on frame 745 ± 1.

**Sound**
- [ ] The score is the product's own ensemble (or the approved fallback). There is no stock "African" loop and no modern beat.
- [ ] The silence in S6 to S7 is real silence for at least 1.0 s, apart from the reverb tail and wind.
- [ ] Loudness is −14 LUFS integrated and −1 dBTP true peak. The talking drum is audible on a phone speaker.

**Readability and the end**
- [ ] All text sits inside the safe area (top 220 px, bottom 380 px and right 120 px are kept clear for platform UI).
- [ ] Headlines are at least 72 px and kickers at least 36 px, with contrast of at least 4.5:1.
- [ ] The URL is the largest text on the end card and holds for at least 4 s.
- [ ] The render is 1080 × 1920, 30 fps, 1350 frames, H.264 yuv420p and AAC 48 kHz, and plays in WhatsApp.
