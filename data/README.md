# Data

Everything the map claims lives here, as plain JSON checked on every build by
the schema in `src/content.config.ts`. A build fails if a claim has no source,
a confidence level is missing, or an LGA id does not exist.

| Path | What it holds |
| :-- | :-- |
| `groups/<id>.json` | One ethnic group: language, summary, ruler, LGAs, named communities (each with optional villages, `history` and `livelihoods`), review notes |
| `places/<lga-id>.json` | A brief about who lives in one LGA: its peoples, indigenous or settled, rough share, languages (two or more means bilingual), how languages are used, and optional `history` (why the place matters) and `livelihoods` (what people mainly do) |
| `polities/<id>.json` | A kingdom, empire, confederacy, city-state or ritual network on the history timeline: its span, dated snapshots (territory by LGA and state, rough rings outside Nigeria, capital, places, tribute, trade, war and ritual links), and what remains today |
| `events/<id>.json` | Something that happened between states, or to one: a war, raid, alliance, migration, British conquest, or a kingdom divided among colonial provinces. Its actors, a summary, routes (marches, migrations, exiles, loot), dated moments marked on the map, land fought over, and for a partition the pieces its lands went to |
| `societies/<id>.json` | A people who governed themselves between the mapped states: how (`elders`, village `assemblies`, many small `chiefdoms`, `kingdoms` too small for the timeline, or independent `villages` when sources do not say), the years they are shown, how their independence ended, and the LGAs where their name is written for each stretch of years. Written in the open land on the history map so unshaded land never reads as empty. The build warns when a name falls inside a state's ruled land |
| `towns/<id>.json` | A town whose founding or allegiance matters: founded by several peoples (Illah: Igbo, Igala and Benin quarters), or held by a state for a time (Agenebode: Igala land, then a Benin garrison). Each founder names its people, the quarters it founded and where it came from; `under` lists the states that held the town and how (ruled, tribute, garrison, crowned) |
| `thrones/<id>.json` | A throne of the colonial era: `created` where a people had none (Tor Tiv, 1946), `restored` after a break (Oba of Benin, 1914), `installed` (the British chose the king), `imposed` (rulers set over a people from outside, as the warrant chiefs were), or `retitled`. Who made it, its seat and first holder |
| `politics/<id>.json` | A period of Nigerian politics (1954–1960, the First Republic, each military regime, the Second and Fourth Republics): the federal leaders, and each region (or, since 1999, each geopolitical zone) with the peoples who dominated its politics and who led it. Every leader names the people they came from, as the sources give it; where sources disagree the leader is marked `disputed` with the alternatives in `groupNote`. Hausa and Fulani are always kept apart |
| `forces/<id>.json` | How a state (or a people who ruled themselves) made war, for the Versus page: its home ground (`sahel`, `savanna`, `river`, `forest`, `delta`), the arms it fielded and when (cavalry, archers, guns, war canoes, a standing army, walls, allies, sacred awe, village militias, each rated 1 to 3), and the wars it really won or lost. The id is the polity's or the society's. The page weighs these with the land drawn for each snapshot to guess who would likely win, always beside the real record |
| `families.json` | Language families and their lineage |
| `sources.json` | Every source, cited by id from the claims |
| `raw/` | Downloaded open data, not committed (see below) |

## Rules

- Every claim names at least one source and a confidence level: `high` (well attested), `medium` (one source, approximate, or not yet checked directly), `disputed` (sources disagree).
- A source with `"checked": false` has only been seen cited elsewhere.
- `status` is `draft`, then `reviewed`, then `published`. **Only `published` groups reach the public site.** `npm run dev` and `npm run build:preview` include drafts, and the `/review` page lists every unpublished claim in plain text.
- LGA ids are `<state>-<lga>` slugs from `src/data/lgas.json`, for example `kogi-idah`.
- Areas show where people live. They are never claims of land ownership.
- Polity snapshots run from their `year` to the next snapshot. Territory inside Nigeria is drawn to the nearest LGA (`core`: ruled directly; `influence`: tributaries and looser control); `beyond` rings cover land in neighbouring countries and are clipped at the border. An extent can carry its own `confidence` when it is less sure than the snapshot.
- Events show from their `year` to their `until` (left out: a generation, or to the end of the timeline for a partition). Every route and moment can carry its own sources and confidence; a place an event cannot locate is told in its chronology but not drawn. Origin claims (a town tracing its founders to Idah) are history only, never drawn on the peoples atlas. The timeline runs to 1970, the end of the civil war. An actor with no polity on the timeline (Biafra, the Federal army) can carry a fixed `ink` so it keeps its colour from one event to the next.

## Licence

The compiled data in this folder is licensed CC BY-SA 4.0. Third party data keeps its own licence:

- LGA and state boundaries: GRID3 via geoBoundaries, CC BY 4.0
- Rivers and lakes: Natural Earth, public domain
- Map label font: Noto Sans, SIL Open Font License 1.1 (`public/fonts/OFL.txt`)

## Rebuilding the geometry

`public/geo/*.json` and `src/data/lgas.json` are committed. To rebuild them, download the raw files, then run `npm run geo` and `npm run geo:region` (the land around Nigeria for the history view):

```sh
mkdir -p data/raw && cd data/raw
curl -L -o nga-adm2.geojson https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NGA/ADM2/geoBoundaries-NGA-ADM2_simplified.geojson
curl -L -o nga-adm1.geojson https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NGA/ADM1/geoBoundaries-NGA-ADM1_simplified.geojson
curl -L -o rivers.zip https://naciscdn.org/naturalearth/10m/physical/ne_10m_rivers_lake_centerlines.zip && unzip -o rivers.zip -d rivers
curl -L -o lakes.zip https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes.zip && unzip -o lakes.zip -d lakes
curl -L -o countries.zip https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip && unzip -o countries.zip -d countries
```

Known quirks in the GRID3 names: `bayelsa-yenegoa` (Yenagoa) and `abia-obi-nwga` (Obi Ngwa) keep the source spelling for now.
