# Scope: HistoNaija

An interactive map of Nigeria that shows where each ethnic group lives today, and how the great precolonial states grew and shrank from about 1000 AD to the 36 states of 1996. It is a free public educational site, and also a portfolio piece. It must be trustworthy, beautiful, and fast on a phone with slow data.

**Build approach:** Tracer Bullet (prove one real thread end to end first, then thicken it one strand at a time).
**Weight profile:** mostly medium. The data model is full weight, because it holds every claim the site makes, and accuracy is the product. Small pages are lean.

**Product decisions already made:** this section gives the context every feature below works within.
- Two modes on one map. **Today**: a clean modern look. **Then**: an old map look.
- **Ethnic areas are mapped by LGA.** All 774 Local Government Areas (LGAs) can be used, and points mark enclave communities (single towns of a group outside its homeland).
- **Colours:** each language family gets a hue, and each group gets a shade of it. A search result always gets one bright highlight colour. Mixed LGAs are coloured by the dominant group, with hatching for other significant groups.
- **Kingdoms** are drawn as a solid core with fading influence zones, plus lines for tribute and trade. The timeline moves between dated snapshots, not data for every year.
- **Every data claim carries a source and a confidence level** (high, medium, disputed). Claude drafts the data and the owner reviews it before it goes public. The site never presents the map as land ownership.
- **Hard limits:** free hosting only, free to use, with a donate link.
- **Baselines for every feature:** colourblind safe colours, patterns as well as colour, keyboard use, and a text alternative for the map (WCAG AA). All UI text lives in one place so Hausa, Yoruba, Igbo and Pidgin can be added later. Analytics are privacy friendly and use no cookies.
- **Success** means people use the site and share it.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | in-progress |
| 2 | Coding standards & tooling | Foundation | planned |
| 3 | Data model & sourcing rules | Foundation | in-progress |
| 4 | Base map geometry | Foundation | in-progress |
| 5 | Design system (two moods) | Foundation | in-progress |
| 6 | Find a group on the map | Slice 1 | in-progress |
| 7 | Top 50 groups data | Slice 2 | in-progress |
| 8 | Atlas colours & mixed areas | Slice 2 | in-progress |
| 9 | Rich group profiles | Slice 2 | planned |
| 10 | Shareable links & preview images | Slice 3 | planned |
| 11 | Group pages for search engines | Slice 3 | planned |
| 12 | About, sources & donate page | Slice 3 | planned |
| 13 | Suggest a correction | Slice 3 | planned |
| 14 | Privacy friendly analytics | Slice 3 | planned |
| 15 | Timeline with one kingdom | Slice 4 | in-progress |
| 16 | Big empires data | Slice 5 | in-progress |
| 17 | Many kingdoms at once | Slice 5 | in-progress |
| 18 | Colonial and modern boundaries | Slice 6 | planned |
| 19 | Timeline playback | Slice 6 | in-progress |
| 20 | Middle Belt kingdoms data | Slice 7 | in-progress |
| 21 | South East and Delta polities | Slice 7 | in-progress |
| 22 | Group and kingdom bridge | Slice 8 | in-progress |
| 23 | Beyond 50 groups | Slice 9 | planned |
| 24 | Domain & hosting check | Slice 3 | planned |

## Foundations

### 1. Stack & architecture · in-progress
Choose the stack and scaffold a runnable site that costs nothing to host and loads fast on a phone with slow data.
**Done when:** the stack is recorded in a spec, the empty site builds and runs locally and deploys to free hosting, and UI text is kept apart from code so translation can be added later.
- [x] Decide the stack (spec): `/architect stack & architecture`
- [ ] Scaffold from the decision: `/develop stack & architecture`
Spec [0001](../specs/0001-stack-architecture/index.md) · code in `/` (Astro project root: `src/`, `astro.config.mjs`)

### 2. Coding standards & tooling
Capture the project's conventions and install lint, format and pre-commit checks from the real scaffold.
**Done when:** root `AGENTS.md` reflects the real stack, and lint, format and pre-commit all run clean.
- [ ] Capture conventions + tooling choices: `/audit`

### 3. Data model & sourcing rules · in-progress · needs a decision · full
Decide how groups, language families, LGAs, enclave points, kingdoms, dated snapshots, influence zones, tribute links, sources and confidence are stored. Also decide the review flow (draft, reviewed, published) that the owner signs off in.
**Done when:** one shape holds both modes without a breaking change later, every claim must carry a source and a confidence level, nothing unreviewed can reach the public site, and drafts can be reviewed as a simple readable list.
- [ ] Design it (spec): `/architect data model & sourcing rules`
⚠ spec pending: built directly at the owner's request (2026-10-05). Decisions to backfill: JSON files in `data/` checked by Astro content collections (`src/content.config.ts`); every claim has `sources` (min 1) and `confidence`; LGA ids are `<state>-<lga>` slugs checked against `src/data/lgas.json`; status `draft` → `reviewed` → `published`, only `published` reaches the public build; drafts show in dev and `npm run build:preview`, with a `/review` page listing every unpublished claim. Kingdoms and snapshots are not modelled yet.
· code in `src/content.config.ts`, `src/lib/groups.ts`, `data/`

### 4. Base map geometry · in-progress · needs a decision
Get the outlines of all 774 LGAs and the states from an open source, simplified so they stay light on phones, plus a way to place enclave points.
**Done when:** every LGA and state draws correctly with its official name and code, the full map loads quickly on a slow mobile connection, and the source and licence of the boundaries are recorded.
- [ ] Design it (spec): `/architect base map geometry`
⚠ spec pending: built directly at the owner's request (2026-10-05). Decisions to backfill: GRID3 LGA boundaries via geoBoundaries (CC BY 4.0, 774 LGAs), states joined by largest overlap, simplified with mapshaper to about 128 KB gzipped GeoJSON; state lines and outline derived from the LGAs; Natural Earth rivers and lakes; enclave points are lon/lat, or the LGA centre marked approximate. Two GRID3 name typos kept (Yenegoa, Obi Nwga). Labels (2026-10-06): geopolitical zone, state and LGA label points in `public/geo/labels.json`, drawn with self hosted Noto Sans glyphs (`public/fonts`, OFL); zones on the overview, states from zoom 5, LGA names from zoom 7.2, thin LGA edges inside highlights.
· code in `scripts/build-geo.mjs`, `public/geo/`, `src/data/lgas.json`

### 5. Design system (two moods) · in-progress · needs a decision
The look of the site in both moods: a clean modern Today mode and an old map Then mode. It covers type, colour tokens, the highlight colour, the confidence styling (how a "disputed" area looks), and the base components.
**Done when:** `design.md` covers both moods, the confidence styles, and colourblind safe colours with patterns, and the base components work by keyboard and on a phone.
- [ ] Design it (spec): `/architect design system`
⚠ spec pending: Today mood only, built directly (2026-10-05). Tokens in `src/styles/global.css` (light and dark), Bricolage Grotesque for headings, one orange highlight, presence shown as solid, hatched and dotted patterns. No `design.md` yet; Then mood not started.
· code in `src/styles/global.css`, `src/components/map/map-app.css`

## Slice 1: Find one group (Phase 1, Today mode)

### 6. Find a group on the map · in-progress · needs a decision
The first real thread, using Igala. Igala data is drafted with sources and reviewed. A visitor types "Igala", and every Igala LGA in Kogi and the enclave towns in other states (Delta and others) light up. A basic profile shows the language family, the states and LGAs, and the sources with confidence levels. The site is live on the internet.
**Done when:** on a phone, a visitor can search Igala (including near misses in spelling), see all Igala areas highlighted across states, open the profile with its sources, and the whole thing is deployed publicly.
- [ ] Design it (spec): `/architect find a group on the map`
⚠ spec pending: built directly at the owner's request (2026-10-05). Decisions to backfill: React island state in `MapApp.tsx` with the web address (`?group=igala`) as the source of truth; own fuzzy search (no library); bottom sheet on phones. Igala data is a draft awaiting owner review, so the public build shows no groups yet. Not deployed.
· code in `src/components/map/`, `src/lib/search.ts`

## Slice 2: The full atlas (Phase 1, Today mode)

### 7. Top 50 groups data · in-progress
Draft the 50 largest groups in reviewable batches (for example Hausa, Yoruba, Igbo, Fulani, Ijaw, Kanuri, Tiv, Ibibio, Edo, Nupe, Idoma, Urhobo, Ebira and others). Each group gets its LGAs, enclaves, language family, sources and confidence levels.
**Done when:** all 50 groups are drafted, every entry has a source and a confidence level, and the owner has reviewed each batch before it is published.
- [ ] Build it: `/develop top 50 groups data`
  - [x] Igala (with every Igala speaking community found, 2026-10-05/06)
  - [x] Batch 1: Ebira, Idoma, Nupe (drafted 2026-10-06, awaiting owner review)
  - [x] Batch 2: Bassa, Bassa-Nge, Igede, Gbagyi (drafted 2026-10-06, awaiting owner review); Igala, Ebira, Idoma and Nupe strengthened with Omachonu and Dalhatu (2018)
  - [x] Batch 3: Tiv, Eggon, Mada, Alago, Gwandara (drafted 2026-10-06, awaiting owner review)
  - [x] Batch 4: the remaining 37 (Hausa, Fulani, Kanuri, Shuwa Arab, Bura-Pabir, Marghi, Karai-Karai, Bolewa, Bade, Tangale, Zaar, Berom, Ngas, Tarok, Mwaghavul, Jukun, Mumuye, Bachama, Kuteb, Atyap, Bajju, Kilba, Yoruba, Igbo, Ijaw, Ibibio, Annang, Efik, Edo, Esan, Afemai, Urhobo, Isoko, Itsekiri, Ikwerre, Ogoni, Ejagham), drafted 2026-10-06
  - [ ] Owner review of all 50 drafts (then set status to published)

### 8. Atlas colours & mixed areas · in-progress · needs a decision
The whole country coloured at once. Each language family gets a hue and each group gets a shade, so related groups (like Igala, Yoruba and Itsekiri) look related. Mixed LGAs show their dominant colour with hatching for other groups. A legend explains it all.
**Done when:** the full map reads clearly with 50 groups, colourblind users can still tell families apart, mixed LGAs show hatching, the legend is complete, and a text list version of the map exists for screen readers.
- [ ] Design it (spec): `/architect atlas colours & mixed areas`
⚠ spec pending: built directly at the owner's request (2026-10-06). The default view colours every LGA by its main group (strongest presence, then surest claim, then the more local group); one hue per language family, shades by group; light hatching where another group is core or shared; group names written at the middle of their homeland; the intro panel lists families and groups as a colour key. Selecting a group fades the atlas behind the highlight. 698 of 774 LGAs coloured. Colourblind limits: 18 families cannot all be told apart by colour alone; names on the map, the key and tap cards carry the meaning.
· code in `src/lib/atlas.ts`, `src/components/map/`

### 9. Rich group profiles · needs a decision
Profiles grow beyond the basic version: other names, estimated population (clearly marked as an estimate), traditional ruler title (Attah, Oba, Ooni and so on), a short history, related groups, and sources.
**Done when:** every published group has a full profile, population shows as an estimate with its source, and related groups link to each other.
- [ ] Design it (spec): `/architect rich group profiles`

## Slice 3: Go public (Phase 1, Today mode)

### 10. Shareable links & preview images · needs a decision
Any view can be shared. A link opens exactly "Igala, highlighted", and when posted on WhatsApp or X it shows a good preview image of that group's map.
**Done when:** the address bar always reflects the current view, opening a shared link restores it exactly, and every group's link shows its own preview image when shared.
- [ ] Design it (spec): `/architect shareable links & preview images`

### 11. Group pages for search engines · needs a decision
Each group (and later each kingdom) gets its own page that Google can index, so a search like "where are Igala people" finds the site.
**Done when:** every group has an indexable page with its own title, description and preview, a sitemap lists them all, and the pages still load fast.
- [ ] Design it (spec): `/architect group pages for search engines`

### 12. About, sources & donate page · needs a decision · lean
Explains how the map was made: the sources, what the confidence levels mean, why borders are approximate, and that it is not a statement of land ownership. It also has a donate link.
**Done when:** the page explains the method and confidence levels in plain language, lists all sources, and has a working donate link.
- [ ] Design it (spec): `/architect about, sources & donate page`

### 13. Suggest a correction · needs a decision
Visitors can say "my town is Igala too" or dispute a boundary, adding their reasons and a source if they have one. The owner reviews each suggestion before anything changes.
**Done when:** a visitor can send a correction from any group or kingdom, the owner can see and act on it, spam is kept out, and it stays within free hosting.
- [ ] Design it (spec): `/architect suggest a correction`

### 14. Privacy friendly analytics · needs a decision · lean
Count visits, the top searched groups and shares, without cookies or a consent banner.
**Done when:** the owner can see visits, top searches and shares, and no cookies are set.
- [ ] Design it (spec): `/architect privacy friendly analytics`

### 24. Domain & hosting check · lean
From spec 0001. Before the public launch, pick and connect a domain name, and check Vercel's free plan terms (commercial use, bandwidth) against the donate link and expected traffic. Move to Cloudflare Pages if they do not fit.
**Done when:** the site runs on its own domain with correct canonical links, and the hosting plan's terms are confirmed to allow the donate link and launch traffic.
- [ ] Build it: `/develop domain & hosting check`

## Slice 4: Then mode thread (Phase 2)

### 15. Timeline with one kingdom · needs a decision
The first thread through Then mode, built with one kingdom only. The map switches to the old map look. A year slider steps through dated snapshots, and the kingdom is drawn as a solid core with fading influence. Each snapshot shows its source and confidence.
**Done when:** a visitor can switch to Then mode, move the slider, and watch one kingdom change across its snapshots, with sources shown, the year saved in the link, and it works on a phone.
- [ ] Design it (spec): `/architect timeline with one kingdom`
⚠ spec pending: built directly at the owner's request (2026-10-07), as one Then view covering features 15 to 22. Decisions to backfill: polities in `data/polities/<id>.json` (span, peak, dated snapshots with `core` and `influence` extents by state and LGA, rough `beyond` rings outside Nigeria smoothed and clipped at the border, capital, nodes, tribute/trade/war/ritual links, a `today` seat), each claim with sources and confidence; shapes dissolved at build time with mapshaper into `/data/history.json` (about 90 KB gzipped) and loaded only when the Then view opens; neighbouring land from Natural Earth in `public/geo/region.json`; web address `?mode=then&year=1600&polity=oyo`; slider weighted toward 1400 to 1914 plus a Today stop; snapshot changes fade with feature state (ink soaks in over 760 ms, lifts in 260 ms); war lines show for 25 years after their snapshot. 29 polities drafted, all awaiting owner review.
· code in `src/lib/polities.ts`, `src/lib/timeline.ts`, `src/components/map/history-*.ts`, `Timeline.tsx`, `HistoryPanel.tsx`, `data/polities/`

## Slice 5: The big empires (Phase 2)

### 16. Big empires data
Draft snapshots for Kanem Bornu, the Hausa states leading into the Sokoto Caliphate, Oyo, and Benin, from about 1000 AD to their end in colonial times. Each snapshot gets its source and confidence.
**Done when:** each empire has snapshots at its key dates and events, every snapshot has a source and a confidence level, and the owner has reviewed them.
- [ ] Build it: `/develop big empires data`
  - [x] Drafted 2026-10-07: Kanem-Bornu, Sokoto Caliphate, Oyo, Benin, and the Hausa states (Kano, Katsina, Zazzau, Gobir, Kebbi, Zamfara, Daura); plus Ife, Ijebu, Egba, Ibadan, Ekitiparapo, Lagos
  - [ ] Owner review

### 17. Many kingdoms at once · needs a decision
Several kingdoms on the timeline together. It shows overlapping influence, tribute and trade links as lines, and a profile for each kingdom.
**Done when:** overlapping kingdoms stay readable at every year, tribute and trade links show and can be explained, and each kingdom has a profile with its sources.
- [ ] Design it (spec): `/architect many kingdoms at once`

## Slice 6: Colonial to modern, and playback (Phase 2)

### 18. Colonial and modern boundaries · needs a decision
The timeline continues past the kingdoms: Lagos Colony (1861), the protectorates, amalgamation (1914), the regions, then state creation in 1967, 1976, 1987, 1991 and 1996. The modern state lines can be laid over any year.
**Done when:** every listed step shows correctly on the timeline, and the 36 states can be laid over any earlier year to compare.
- [ ] Design it (spec): `/architect colonial and modern boundaries`

### 19. Timeline playback · needs a decision
The signature moment: press play and watch the history of the region unfold like a film, with kingdoms rising, spreading and fading as they change between snapshots.
**Done when:** playback runs smoothly on a mid range phone, can be paused and scrubbed, does not suggest precision the data does not have, and respects reduced motion settings.
- [ ] Design it (spec): `/architect timeline playback`
⚠ spec pending: built 2026-10-07 at the owner's request ("documentary feeling"). Playback: letterbox bars, the camera sets off for each event's area while the year runs, then a narrated lower third holds 4.2 s; eras cross-dissolve (1.3 s sine) instead of blinking. Tapping a polity opens its story (`StoryMode.tsx`, lazy loaded with GSAP and SplitText, about 33 KB gzipped): a title sequence, chapters from its snapshots driven by scroll (a reading line at 40%) or by Watch (reading time from word count), the frontier drawn by pen with a line gradient, a slow Ken Burns drift once the map is idle, its own timeline with chapter stations, and an epilogue with today's ruler, the peoples now in its lands, a "continue with" neighbour and sources. Web address `?mode=then&polity=oyo&ch=4`.
⚠ spec pending (2026-10-08, owner's request): the Then view opens at 1000 AD (`DEFAULT_YEAR = FIRST_YEAR`), and pressing play there narrates 1000 before moving on. Captions hold for their reading time (2.2 s to settle, then 330 ms a word, 7 to 17 s), not a fixed 4.2 s; moments 5.6 to 14 s; the year counter runs at 14 ms a year (0.9 to 2.6 s). Polity and Power stories read at 330 to 340 ms a word. New event kind `contact` (Europeans by sea, drawn in the colonial scarlet like conquests) and route kind `voyage` with a `vessel` (sail or steam): a side-on ship is the pen of its own sea lane, drawing its wake as it sails in, then one ship keeps plying the lane (docking and fading in port, the next sailing in from beyond the map) while the event is on the map. Drafted with sources: the Portuguese at the coast (1472 to c. 1485), the Atlantic slave trade ports (c. 1650 to 1807), the 1841 Niger Expedition, Baikie and the Pleiad (1854 to 1864); the 1851 bombardment of Lagos now arrives by steamer.

## Slice 7: More kingdoms (Phase 3)

⚠ events built 2026-10-07 from the owner's notes (`hintsPrompts/doc1.md`), spec pending: a new `events` collection (`data/events/`, 29 drafted) for wars, raids, alliances, migrations, British conquests and partitions, with routes, dated moments and partition pieces, each sourced. Drawn by `history-map.ts`: routes draw on like a pen with an arrowhead, migrations carry walking travellers, moments are stamped with a ripple (scarlet squares for colonial forces, sepia rounds for the region's states; stacked with a count below zoom 6.5, fanned above), and a partition's pieces burst apart and settle with scarlet cracks. Every line, mark and piece can be hovered (desktop) or tapped (pinned card, a sheet on phones) to see what it means; the key shows every sign as drawn. Events are timeline stops with their own marks on the track; playback tells an event with placed moments one moment at a time, the camera visiting each place. Event panel at `?mode=then&event=<id>`. Igala now begins as Idah alone and gains the western Idoma tributaries and core towns; Benin and Oyo gain the doc's places. Open questions for the owner are in each event's review notes.

### 20. Middle Belt kingdoms data
Draft snapshots for Igala, Nupe, Kwararafa (Jukun) and Borgu, including key events such as the Benin and Igala war of 1515 to 1516.
**Done when:** each kingdom has reviewed snapshots with sources and confidence levels, and they appear on the timeline alongside the empires.
- [ ] Build it: `/develop middle belt kingdoms data`
  - [x] Drafted 2026-10-07: Igala, Nupe, Kwararafa, Borgu (Benin–Igala war 1515–1516 included)
  - [ ] Owner review

### 21. South East and Delta polities · needs a decision
Nri and the Aro Confederacy were ritual and trade networks, not territories, so they need a different way of drawing. This feature also covers the city states: Bonny, Kalabari, Nembe, Opobo, Old Calabar (Efik) and Itsekiri (Warri).
**Done when:** network polities are drawn as networks rather than territories, the city states and their trade reach show on the timeline, and all are reviewed with sources.
- [ ] Design it (spec): `/architect south east and delta polities`
  - [x] Drafted 2026-10-07: Nri and Aro as networks (dotted reach, places, trade lines); Warri, Bonny, Kalabari, Nembe, Opobo, Old Calabar as city-states. Awaiting owner review.

## Slice 8: The bridge (Phase 3)

### 22. Group and kingdom bridge · needs a decision
Join the two modes. From the Igala profile, one tap shows the Igala Kingdom at its height laid over where Igala people live today. From a kingdom, a visitor sees the groups living in its old lands now.
**Done when:** every group with a linked kingdom can jump to it, and back, with both layers shown together and the link shareable.
- [ ] Design it (spec): `/architect group and kingdom bridge`
  - [x] Built 2026-10-07: a people's profile links to its kingdom at its height; a polity's profile lists its people and the peoples whose homelands lie in its lands at its height.

## Slice 9: Expansion (Phase 4)

### 23. Beyond 50 groups
Add more groups in reviewed batches, working toward the 250 or more groups in Nigeria, guided by what people search for and the corrections they send.
**Done when:** each new batch is reviewed and published, the colours and legend still read clearly, and the map stays fast.
- [ ] Build it: `/develop beyond 50 groups`

## Deferred
Out of scope for now, kept here so the plan stays honest.
- **Translations**: Hausa, Yoruba, Igbo and Pidgin versions of the site · needs a decision
- **Compare two groups or two years**: side by side views · needs a decision
- **Culture content**: greetings, festivals and images in group profiles · needs a decision
- **Nok and Igbo Ukwu prologue**: a short opening before 1000 AD · needs a decision
- **Data review tool**: a private page to approve drafts (a readable list works for now) · needs a decision
- **Paid extras**: printable posters, a schools pack · needs a decision
- **Browser error tracking**: a free tier tracker for map crashes on visitors' phones, if logs prove not enough (from spec 0001) · needs a decision

## Legend

**The decision box.** Every feature has exactly one box whose label ends with `(spec)`. Its wording can vary (`Design it (spec)`, `Decide the stack (spec)`), so skills find it by that `(spec)` ending. Every other box is an execution box.

**Feature lifecycle:**

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | `/architect` at spec capture | `Design it` ticked, spec linked, `Build it: /develop <feature>` with 2 to 5 milestones from the spec, plus `Verify it` and `Test it` boxes |
| `in-progress` (building) | `/develop` | milestone boxes tick one by one, code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` and milestones ticked, `Verify it` ticked |
| `done` | `/test`, then `/sync` | all boxes ticked |

- **Next step** = the first unticked box.
- **needs a decision** = run `/architect` first; otherwise go straight to `/develop` (or `/audit` for standards & tooling).
- **Atomic build tasks live in each spec's `## Build plan`**, not here.
- **Status**: `planned` → `in-progress` → `done`, plus `existing` (built before this workflow) and `dropped` (removed from scope, kept for history).
- **Weight tag**: `· full` means a fresh model `/check review` is warranted. `· lean` means a light, low risk feature. No tag means medium.
- **Pointer line** (`spec <n> · code in <path>`) appears once a spec or code exists.
