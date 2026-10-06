# Data

Everything the map claims lives here, as plain JSON checked on every build by
the schema in `src/content.config.ts`. A build fails if a claim has no source,
a confidence level is missing, or an LGA id does not exist.

| Path | What it holds |
| :-- | :-- |
| `groups/<id>.json` | One ethnic group: language, summary, ruler, LGAs, named communities (each with optional villages, `history` and `livelihoods`), review notes |
| `places/<lga-id>.json` | A brief about who lives in one LGA: its peoples, indigenous or settled, rough share, languages (two or more means bilingual), how languages are used, and optional `history` (why the place matters) and `livelihoods` (what people mainly do) |
| `families.json` | Language families and their lineage |
| `sources.json` | Every source, cited by id from the claims |
| `raw/` | Downloaded open data, not committed (see below) |

## Rules

- Every claim names at least one source and a confidence level: `high` (well attested), `medium` (one source, approximate, or not yet checked directly), `disputed` (sources disagree).
- A source with `"checked": false` has only been seen cited elsewhere.
- `status` is `draft`, then `reviewed`, then `published`. **Only `published` groups reach the public site.** `npm run dev` and `npm run build:preview` include drafts, and the `/review` page lists every unpublished claim in plain text.
- LGA ids are `<state>-<lga>` slugs from `src/data/lgas.json`, for example `kogi-idah`.
- Areas show where people live. They are never claims of land ownership.

## Licence

The compiled data in this folder is licensed CC BY-SA 4.0. Third party data keeps its own licence:

- LGA and state boundaries: GRID3 via geoBoundaries, CC BY 4.0
- Rivers and lakes: Natural Earth, public domain
- Map label font: Noto Sans, SIL Open Font License 1.1 (`public/fonts/OFL.txt`)

## Rebuilding the geometry

`public/geo/*.json` and `src/data/lgas.json` are committed. To rebuild them, download the raw files, then run `npm run geo`:

```sh
mkdir -p data/raw && cd data/raw
curl -L -o nga-adm2.geojson https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NGA/ADM2/geoBoundaries-NGA-ADM2_simplified.geojson
curl -L -o nga-adm1.geojson https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NGA/ADM1/geoBoundaries-NGA-ADM1_simplified.geojson
curl -L -o rivers.zip https://naciscdn.org/naturalearth/10m/physical/ne_10m_rivers_lake_centerlines.zip && unzip -o rivers.zip -d rivers
curl -L -o lakes.zip https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes.zip && unzip -o lakes.zip -d lakes
```

Known quirks in the GRID3 names: `bayelsa-yenegoa` (Yenagoa) and `abia-obi-nwga` (Obi Ngwa) keep the source spelling for now.
