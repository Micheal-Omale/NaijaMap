# Gemini prompt: "Before the Lines" promo film for HistoNaija

Copy everything below the line into Gemini, then attach the asset folder described in §4.

---

You are the editor and Remotion engineer on a 45-second promotional film. The creative direction is decided and written down below in full. Do not invent a new concept, new claims or new UI. Your job is to build it exactly, frame-accurately, in Remotion, and to verify the render.

## 1. The product (verified facts only)

**HistoNaija** is a free interactive web map of Nigeria (Astro, React and MapLibre). Use only the facts in this section. If something is not here, it is not in the product.

- **Tagline (the site's own words):** "Where Nigeria's peoples live today, and the states they built before."
- **Four views**, switched by tabs: **Peoples** (today), **Kingdoms** (history), **Politics** (1954 to today) and **Versus**. This film uses only Peoples and Kingdoms.
- **Peoples (today).** Every Local Government Area (LGA) is coloured by its main people. The hue follows the language family and each people gets a shade of it; hatching and stripes mark shared areas. Searching for a people (for example "Igala") lights up every area where they live in one bright orange, across state lines, and opens a profile: language family, traditional ruler, where they live, sources with confidence levels, and a link to "<Kingdom> at its height, <year>".
- **Kingdoms (history).** An old-map look: parchment land, a grey-green sea, serif type. A timeline runs from **1000 AD** through colonial rule to the civil war of 1967 to 1970, plus a **Today** stop. Kingdoms, empires, caliphates, confederacies and city-states are drawn as a solid ruled core with hatched tributaries. Nri and Aro are drawn as ritual and trade networks (dotted reach). Lines show tribute, trade, war, ritual ties and descent. Events (wars, raids, migrations, alliances, British conquests, partitions, Europeans by sea) draw routes like a pen. Migrations carry walking dots, European ships sail along their sea lanes, and a divided kingdom bursts into pieces along scarlet cracks. Colonial forces are always drawn in one hard scarlet (#c8102e). Unshaded land carries the names of peoples who governed themselves; the site says "Unshaded land was not empty." A checkbox, **"Show today's state lines"**, lays the modern state lines over any year.
- **Playback.** Pressing play turns the timeline into a documentary: letterbox bars close in, the camera follows each event, and captions hold for their reading time. Ink soaks in over about 760 ms when the year changes.
- **Story mode.** Tapping a kingdom opens its story: letterbox bars close, the name rises out of a mask, and chapters follow its dated snapshots while the frontier is drawn by pen. It ends with what remains today.
- **Today stop.** It shows the traditional rulers who still reign: the Oba of Benin, the Attah Igala, the Shehu of Borno, the Sultan of Sokoto, the Emir of Kano, the Eze Nri, the Alaafin of Oyo and others.
- **Sources.** Every claim carries a source and a confidence level (high, medium or disputed). The map is not a statement of land ownership.
- **Sound.** The site plays its own music, synthesised in the browser: an ensemble in 12/8 at 92 BPM. The talking drum leads, over an iron bell timeline, shekere, udu (clay pot drum), a big skin drum, a second answering drum, a wooden flute, balafon, a big iron gong on each section's first beat, kakaki (long royal trumpets) from far off, a few voices, and a warm pad, all in one reverberant courtyard. The first time it starts there is a gust of wind, the talking drum calls alone for **two bars**, and the ensemble comes in **on the gong**.
- **Look (Kingdoms view):** parchment `#ece1c8` and surface `#f7efdc`; ink `#2b2118`; muted ink `#5f5141`; accent sienna `#8a3f1c`; sea `#c9d1bf`; film black (story and playback bars) `#110c08`; colonial scarlet `#c8102e`. **Look (Peoples view):** background `#f4f2ed`, ink `#17191e`, accent green `#0a7650`, search highlight orange `#e8590c`. **Type:** the Kingdoms view uses a Palatino-style serif ("Iowan Old Style", "Palatino Linotype"); the Peoples view uses **Bricolage Grotesque**.

## 2. The concept

**Title: Before the Lines.** Everyone knows Nigeria's shape and its state lines, and those lines are recent. Under them lie a thousand years of kingdoms, empires, city-states and self-governing peoples who rose, spread, traded, fought and were divided, and whose rulers still reign. HistoNaija lets you lift the lines and watch it.

The viewer moves from **curiosity** ("that's Nigeria?") to **discovery** (a thousand years flooding across the map), then **weight** (silence, then "Their rulers still reign"), then **participation** (search a people, see their kingdom, visit the URL).

**Signature moment, "the drain and the flood":** today's state lines lift off the 1600 map, the ink drains backwards to 1000 AD, and on the gong a thousand years flood forward.

## 3. Hard rules

1. **Never draw, mock, recreate or "improve" product UI.** Every map image comes from the supplied plates or recordings. Your overlays are film typography (bands, headlines, kickers, the year counter, the end card). They must never look like buttons, chips, panels or app chrome.
2. **Use only the on-screen text in the claims ledger (§7), character for character.** Add no facts, numbers or dates. Do not "fix" the history.
3. **Deterministic rendering only.** All motion comes from `useCurrentFrame()` with `interpolate()`, `spring()` or `Easing`. No CSS animations or transitions, no `setTimeout`, no `Date`, and no `Math.random()` (use Remotion's `random(seed)` if you need noise). Wait for fonts with `delayRender`.
4. **No generic effects.** No glow, particles, light leaks, lens flares, glitch, whip pans, 3D, parallax layers, film-grain overlays or stock footage. No AI-generated imagery.
5. **If an asset is missing, render a labelled slate** (a film-black frame with the asset's file name and its scene ID in 40 px monospace). Never substitute an invented image.

## 4. Assets you will receive (inspect these first)

Before writing any code, list every file you received and check it against this table. Report anything missing or wrong-sized, and say which scenes it affects.

```
public/
  plates/                         # real map stills, 2160×3840 JPEG, map only (UI hidden)
    p01-today-atlas.jpg           # Peoples view, every LGA coloured
    p02-then-1600-statelines.jpg  # Kingdoms view 1600 WITH today's state lines
    p03-then-1600.jpg             # same, without state lines (same camera as p02)
    sweep-1000.jpg … sweep-1850.jpg   # 18 years, all the SAME camera:
                                  #   1000 1180 1255 1300 1380 1400 1440 1472 1500 1515
                                  #   1535 1580 1650 1700 1750 1800 1808 1850
    p20-portuguese-1472.jpg       # event view (different camera)
    p21-benin-1897.jpg            # event view: British routes to Benin City
    p22-borno-divided-1902.jpg    # event view: the kingdom split along scarlet cracks
    p23-then-today.jpg            # Today stop: the reigning traditional rulers
    p24-today-igala.jpg           # Peoples view, Igala highlighted (backup for S8)
  rec/                            # phone screen recordings, H.264, CFR 30 fps, light mode
    R1-igala-bridge.mp4           # search "Igala" → highlight → tap "Igala Kingdom at its height, 1750"
    R2-oyo-story.mp4              # tap Oyo → story title sequence → frontier drawn
    R3-ships-1472.mp4             # Kingdoms view 1472: a Portuguese ship sails in along its lane
    R4-playback.mp4               # (optional b-roll) Play pressed: letterbox film mode
    markers.json                  # {"R1": {"tapKingdom": 11.4, ...}, ...} seconds of key moments
  audio/
    A1-score.wav                  # the site's own music, first start: wind → drum call → gong → ensemble
    A1-markers.json               # {"firstStroke": s, "gong": s} measured from A1's start
    cues/tap.wav, cues/chapter.wav, cues/open.wav   # the site's own UI sounds
  fonts/
    texgyrepagella-regular.otf, texgyrepagella-italic.otf, texgyrepagella-bold.otf
  brand/icon.svg                  # the HistoNaija mark
```

Plates are the map area of a 1080 × 1920 CSS-pixel window at 2× scale. All sweep plates share one camera, so they dissolve in register. Never crop or position sweep plates differently from each other.

## 5. Format and timing

- Composition `BeforeTheLines`: **1080 × 1920, 30 fps, 1350 frames (45.0 s)**.
- **The music grid drives the cut.** The constants are `BPM = 92`, `PULSE = 60 / BPM / 3` s, and `BAR = 12 × PULSE` = 2.6087 s = 78.26 frames. Then `bar(n) = Math.round(n × BAR × FPS)`. Bar 0 is A1's first talking-drum stroke, which is placed on frame 0 by starting A1 at `A1-markers.firstStroke`. Check `(gong − firstStroke) / 2` against `BAR`. If they differ by more than 0.02 s, use the measured value and say so.
- Bar starts: b0 0, b1 78, b2 157, b3 235, b4 313, b5 391, b6 470, b7 548, b8 626, b9 704, b10 783, b11 861, b12 939, b13 1017, b14 1096, b15 1174, b16 1252, b17 1330. Compute these from `bar()`; never hard-code them.

### Scene table (build exactly this)

| ID | Frames | Picture | Text | Audio |
|---|---|---|---|---|
| **S1 Hook** | 0–45 | `p01` full-bleed. Scale 1.00 → 1.04 (linear). Top band closed. | Headline **"You know this shape."** in Bricolage Grotesque 600, ink `#17191e` on the plate's light background, centred at y≈300. In at frame 0 (no fade: already there on frame 0), out by frame 45. | A1 from `firstStroke − 0.5 s` so the wind is already rising; the first drum stroke lands on frame 0. |
| **S2 Turn** | 45–112 | **Hard cut** to `p02`. Snap the cut to the nearest drum-stroke transient within ±4 frames of frame 45 (find it in the A1 waveform). The top band opens from 0 to 560 px over 33 frames. Frames 80–112: cross-dissolve `p02` → `p03` (the state lines lift away). Slow push-in 1.00 → 1.03. | **"This is the same land in 1600."** | Drum call continues alone. |
| **S3 Drain** | 112–157 | Hard cuts backwards: sweep 1580, 1535, 1515, 1500, 1472, 1440, 1400, 1380, 1300, 1255, 1180, 1000 (about 4 frames each; the last holds until 157). | **"Rewind a thousand years."** in from frame 118, held to 235. The year counter rolls 1600 → 1000 with `Easing.in(Easing.quad)`. | Drum call ends. |
| **S4 Flood** | 157–470 | **The gong lands on frame 157**, the downbeat of bar 2. Sweep forward from 1000 to 1850, cross-dissolving over 12 frames (`Easing.bezier(0.37,0,0.63,1)`) at roughly even spacing, ending on 1850 by frame 455. One continuous Ken Burns across S4: scale 1.00 → 1.08, drifting toward the centre of the map. The year counter climbs with the plates and shows each plate's year as it lands. | b2 (157–235): the S3 headline holds and the counter settles on **1000**. b3 (235–313): **"Kingdoms rise."** with kicker *c. 1440 · Oba Ewuare the Great*. b4 (313–391): **"Empires spread."** with kicker *c. 1580 · Idris Alooma: the imperial height*. b5 (391–470): **"Between them, peoples ruled themselves."** with kicker *c. 1850 · Sokoto Caliphate: the largest state in West Africa*. | Full ensemble (A1 continues). |
| **S5 Story** | 470–626 | R2: start where the story's title sequence begins (`markers.R2.title`). Full-bleed, cropped to 9:16 keeping the title and the map. | **"Open any kingdom's story."** (b6). Clear the band during b7 so R2's own title reads. | Ensemble. Add `cues/open.wav` at R2's tap and `cues/chapter.wav` at its first chapter. |
| **S6 Contact** | 626–783 | 626–690: R3 (from `markers.R3.shipIn`). 690–745: `p21`, slow push toward Benin City. 745–783: `p22`, slight push. Hard cuts between them. | Kickers only, larger (48 px), one per shot: *1472 · The Portuguese reach the coast*, then *1897 · The British invasion of Benin*, then *1902 · Borno divided four ways*. | **At frame 745 the music stops**: cut A1 there with a 3-frame fade. Let only the reverb tail and the wind continue (gain-ride a section of A1's wind if needed). |
| **S7 Today** | 783–939 | 18-frame dissolve `p22` → `p23`, then a slow push 1.00 → 1.04. | 800–861: **"The empires ended."** 861–939: **"Their rulers still reign."** | Silence until **frame 861**. Then A1 re-enters at its own position for frame 861 (the bar grid continues as if the music never stopped), with a 6-frame fade-in. |
| **S8 Bridge** | 939–1174 | R1: type "Igala", the orange highlight spreads across states, the profile opens, then the tap on "Igala Kingdom at its height, 1750" and the map turns to parchment. Time-remap R1 only by trimming and by `playbackRate` ≤ 1.5 between interactions, never during a tap. Put the kingdom tap on frame ≈ 1096 (b14). | b12: **"Search for a people."** b13: **"See where they live today."** b14: **"And the states they built before."** | Ensemble. `cues/tap.wav` on each tap visible in R1. R1's own audio muted. |
| **S9 End** | 1174–1350 | Cut to film black `#110c08`. End card (see §6). | Logo, tagline, URL, sub-line, credits (§7). | **One gong stroke on frame 1174.** Lift the gong at A1's bar 10 downbeat, the one muted in S6, and place it here. The ensemble ducks −9 dB under it and fades out over 2 bars. The last 12 frames are the gong's tail only. |

## 6. Visual system

**Frame and bands.** The film borrows the product's letterbox. A **top band** of film black `#110c08` holds the headline and kicker. Its height animates between 0 (S1) and 560 px with `Easing.bezier(0.83,0,0.17,1)` over 33 frames. The map shows below it, and plates are positioned so Nigeria sits centred in the visible area (with a 560 px band, place the plate so its Nigeria centre lands at about y = 1180). Keep one transform for all sweep plates. Do not add a bottom band, because the platform UI covers the bottom. In the plates, the land sits in the upper half and the lower ~40 % is open sea. Repositioning must never expose a plate edge: scale up to cover the frame rather than translate past an edge. (At 0.5 scale the plate exactly fills 1080 × 1920, so any downward shift needs a matching scale-up.)

**Safe area.** Keep all text clear of the top 220 px, the bottom 380 px and the right-hand 120 px. Add an `inputProps.debug` flag that draws these zones and the bar numbers.

**Typography**
- **Headline:** TeX Gyre Pagella Regular, 84 px, line-height 1.08, tracking −0.5 %, colour `#f7efdc` on the band. Two lines at most; break by meaning, not by width. Left-aligned at x = 72, baseline area y 300–470.
- **Kicker:** Pagella Italic, 38 px (48 px in S6), colour `#d9c9a8`, above the headline at y≈250. "c." stays lowercase.
- **Year counter:** Pagella Regular with tabular lining figures, 150 px, `#f7efdc`, right-aligned at x = 1008 in the band (S3 to S4 only). "AD" is set small (40 px) after "1000" only.
- **S1 headline** uses Bricolage Grotesque 600 (`@remotion/google-fonts/BricolageGrotesque`), because S1 is the Peoples view, whose voice is Bricolage.
- **End card:** the logo `brand/icon.svg` at 96 px, with the wordmark "HistoNaija" in Bricolage Grotesque 700 at 64 px beside it. Below them, the tagline in Pagella 52 px on 2 to 3 lines, then the URL in Bricolage Grotesque 700 at 84 px. The URL is the largest text on the card; shrink it to fit 936 px width if the real URL is long, but never below 64 px. Then "Free · Every claim sourced" in Pagella Italic 36 px, and the credits in Bricolage 24 px at 60 % opacity: "Boundaries: GRID3 (CC BY 4.0) · Rivers and neighbouring lands: Natural Earth". All text is parchment `#f7efdc`, with a 2 px sienna `#8a3f1c` rule (240 px wide) between the tagline and the URL. Vertically centre the whole block between y 420 and 1500.

**Motion grammar (the product's own).**
- Headline **in:** each line rises from `translateY(115%)` to 0 inside an `overflow: hidden` mask over 27 frames, `Easing.bezier(0.25,1,0.5,1)`, with lines staggered 3 frames. Kicker: opacity 0 → 1 and y 18 → 0 over 24 frames, starting 6 frames after the headline.
- Headline **out:** 12 frames, `Easing.bezier(0.32,0,0.67,0)`, upward (0 → −115 %). Exits are about three times faster than entrances. A new headline never enters until the previous one has fully left.
- **Plates:** dissolves are opacity only. Ken Burns is scale and translate only, never rotation, never faster than 1 % scale per second.
- **Year counter:** `Math.round(interpolate(...))` so every frame shows an integer year. No blur and no slot-machine flicker.
- **End card:** the elements rise in sequence (logo and wordmark, tagline, rule drawn left to right over 18 frames, URL, sub-line, credits), 5 frames apart, then hold still for at least 120 frames.
- **Banned:** bouncing springs on text, per-character "typewriter" effects, scaling text, colour cycling, shaking on the conquest beats. The scarlet in the plates is the drama; do not add more.

## 7. Claims ledger: the only text allowed on screen

| Scene | Exact text | Product source |
|---|---|---|
| S1 | You know this shape. | (no claim) |
| S2 | This is the same land in 1600. | Kingdoms view, year 1600 |
| S3 | Rewind a thousand years. | timeline starts at 1000 AD |
| S4 | Kingdoms rise. / Empires spread. | site tagline: kingdoms "rose, spread and changed" |
| S4 | c. 1440 · Oba Ewuare the Great | Benin snapshot 1440 (medium confidence) |
| S4 | c. 1580 · Idris Alooma: the imperial height | Kanem-Bornu snapshot 1580 (medium) |
| S4 | Between them, peoples ruled themselves. | "Unshaded land was not empty"; self-governing peoples layer |
| S4 | c. 1850 · Sokoto Caliphate: the largest state in West Africa | Sokoto snapshot 1850 (medium) |
| S5 | Open any kingdom's story. | story mode |
| S6 | 1472 · The Portuguese reach the coast | event "The Portuguese reach the coast" |
| S6 | 1897 · The British invasion of Benin | event "The British invasion of Benin" (high) |
| S6 | 1902 · Borno divided four ways | event "Borno divided four ways" |
| S7 | The empires ended. / Their rulers still reign. | Today stop: "the traditional rulers who still reign from the old seats" |
| S8 | Search for a people. / See where they live today. / And the states they built before. | Peoples search and kingdom link; site tagline |
| S9 | HistoNaija · Where Nigeria's peoples live today, and the states they built before. · {{SITE_URL}} · Free · Every claim sourced · Boundaries: GRID3 (CC BY 4.0) · Rivers and neighbouring lands: Natural Earth | site name, tagline, sourcing rule, map credits |

Put every string in one `copy.ts` file. `{{SITE_URL}}` is an `inputProps.siteUrl` with the default `"histonaija.example"`; the owner sets the real one at render time.

## 8. Sound design

**Source.** The score is the site's own ensemble (A1). It is honest, unlicensed and consistent with the product. Do not add any other music, loops or beats. Do not add Foley (no paper rustles, quill scratches or whooshes).

**The arc**
1. **0–157:** wind, then the talking drum calling alone. Its strokes are the hook's cuts.
2. **157:** the gong, and the full ensemble enters with the flood.
3. **157–745:** the ensemble carries the story. Leave the mix as recorded. There is no ducking, because there is no voice.
4. **745–861:** silence. This is the most important sound in the film. The conquest beats end in quiet, not drama. Keep only the natural reverb tail and a faint wind (≤ −36 dBFS).
5. **861:** the ensemble re-enters on a downbeat, as if it never stopped (the players never stop; only the sections change).
6. **1174:** one gong, then the tail.

**UI cues.** Use `tap`, `open` and `chapter` only where a real tap or chapter is visible, mixed at −10 dB relative to the ensemble.

**Mix.** −14 LUFS integrated, −1 dBTP true peak, mono-compatible. The talking drum must be audible on a phone speaker: if it isn't, apply a gentle +2 dB shelf at 2–4 kHz to the master, never more. Measure with `ffmpeg -i out.mp4 -af loudnorm=I=-14:TP=-1:LRA=11:print_format=summary -f null -` and adjust the master `volume` until it passes.

**Fallback (only if the owner rejects A1).** Use licensed recordings of real players. The same cue sheet maps instruments by scene: S1–S3 a solo talking drum; S4–S5 talking drum, iron bell timeline, udu and a wooden flute; S6 at 626 a single distant kakaki call, then silence; S7–S8 balafon and flute over a soft bell; S9 one iron gong. Credit the musicians in the description. Never claim that a recording is from a specific historical kingdom.

**Optional voice-over (off by default; `inputProps.vo`).** One calm voice, Nigerian English, unhurried, no "trailer voice":
"You know this shape. / This is the same land, in 1600. / Rewind a thousand years. / Kingdoms rose. Empires spread. Between them, peoples ruled themselves. / Then ships came from the sea. / The empires ended. Their rulers still reign. / Search for your people, and the states they built before. / HistoNaija."
If VO is on, duck the score −8 dB under speech with 4-frame ramps. The on-screen text stays.

## 9. Remotion project structure

Use the latest Remotion v4 with TypeScript (`npx create-video@latest`, blank template). Packages: `remotion`, `@remotion/cli`, `@remotion/google-fonts`, and optionally `@remotion/media-utils` for the waveform.

```
src/
  index.ts                 registerRoot
  Root.tsx                 <Composition id="BeforeTheLines" 1080×1920 30fps 1350f, defaultProps {siteUrl, vo:false, debug:false}>
  film/config.ts           FPS, W, H, BPM, PULSE, BAR, bar(n), SAFE, COLORS, EASE (the bezier constants above), SCENES (from/to per ID)
  film/copy.ts             every on-screen string (§7)
  film/assets.ts           every file path in one place, plus getStaticFiles() checks
  film/BeforeTheLines.tsx  <AbsoluteFill> + one <Sequence> per scene from SCENES + <Score/>
  film/scenes/S1Hook.tsx … S9End.tsx
  film/components/
    Band.tsx               the top letterbox band (height from frame)
    Headline.tsx           masked line rise and exit (props: lines[], inAt, outAt)
    Kicker.tsx
    YearCounter.tsx        (props: keyframes [{frame, year}])
    Plate.tsx              <Img> + framing transform + Ken Burns (props: src, from/to scale, focus)
    PlateSweep.tsx         a list of {src, at} → stacked cross-dissolves in register
    Recording.tsx          <OffthreadVideo> + crop/position + trim + playbackRate, slate if missing
    Slate.tsx              missing-asset placeholder
    Score.tsx              <Audio> A1 segments (0–745, 861–end), gong lift, cues, VO, volume callbacks
    Debug.tsx              safe zones + bar numbers when debug
```

Implementation notes:
- Use `<Sequence>` with `from` and `durationInFrames` taken from `SCENES`. Inside a scene, `useCurrentFrame()` is local, so convert to bars with `bar(n) − scene.from`.
- Cross-dissolves are two `<Plate>`s with complementary opacity. Do not use `@remotion/transitions` for the sweep, because you need the plates to share one transform.
- Audio: split A1 into two `<Audio>` elements, `startFrom` set so each sits on the global bar grid. Fades go in the `volume={(f) => …}` callbacks. The gong lift is a third `<Audio>` with `startFrom = A1 gong time + 8 × BAR` (the bar 10 downbeat), cut at its natural tail.
- Images: `<Img>` (it waits for decode). Videos: `<OffthreadVideo>`. Never use a `<video>` tag.
- Fonts: load Pagella with `@font-face` from `staticFile('fonts/…')`, wrapped in `delayRender()` and `continueRender()` around `document.fonts.load()`. Load Bricolage with `@remotion/google-fonts`.
- Performance: the plates are large, so set `remotion.config.ts` to `Config.setVideoImageFormat('jpeg')` and `Config.setJpegQuality(92)`, and mount only the plates the current frame needs. Leave concurrency at the default.

## 10. Render and verify

1. Run `npx remotion studio`, scrub every scene with `debug: true`, and fix overlaps.
2. Render stills for review at frames 0, 44, 100, 150, 157, 270, 350, 430, 520, 660, 720, 760, 830, 900, 1000, 1100, 1200 and 1340: `npx remotion still BeforeTheLines out/check-<f>.png --frame=<f>`. Look at each one and check it against the scene table and the safe area.
3. Final render: `npx remotion render BeforeTheLines out/before-the-lines_9x16.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --audio-codec=aac --audio-bitrate=320k --props='{"siteUrl":"<url>"}'`.
4. Verify with `ffprobe`: 1080×1920, 30 fps, 1350 frames, 45.0 s, AAC 48 kHz. Run the loudness pass (§8).
5. Watch it three times: with sound on headphones, on a phone speaker, and muted. Muted, every beat must still read.

**Report back with:** the asset checklist, any deviation from this brief (each with its reason), the measured BAR value, the loudness numbers, the 18 check stills, and the final MP4.

## 11. Acceptance criteria

- [ ] Every map pixel comes from a supplied plate or recording, and no UI is drawn.
- [ ] Every on-screen string matches §7 exactly. The URL comes from props.
- [ ] Hard cuts land on drum strokes, the gong lands on frame 157 ± 1, the music stops at 745 ± 1 and re-enters at 861 ± 1, and the end gong lands at 1174.
- [ ] Sweep plates dissolve with no shift between years.
- [ ] Headlines follow the mask-rise and fast-exit grammar, with no overlaps and none read in less than 0.4 s per word plus 0.5 s.
- [ ] All text is inside the safe area and the minimum sizes hold.
- [ ] The S6 to S7 silence is real.
- [ ] Loudness is −14 LUFS and −1 dBTP.
- [ ] Rendering the same props twice produces identical frames (rendering is deterministic).
- [ ] The end card URL is legible on a phone at arm's length and holds for at least 4 s.
