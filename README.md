# HistoNaija

An interactive map of Nigeria. It shows where each ethnic group lives today, and how the precolonial states grew and shrank from about 1000 AD to the 36 states of 1996. Every claim on the map carries a source and a confidence level. The map is not a statement of land ownership.

## Run it

Needs Node.js 24 (see `.nvmrc`).

| Command | What it does |
| :-- | :-- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the local dev server at `localhost:4321` (shows draft data) |
| `npm run build` | Typecheck, then build the public site into `./dist/` (published data only) |
| `npm run build:preview` | Build a private preview that includes drafts and the `/review` page |
| `npm run check` | Typecheck and validate all data |
| `npm run geo` | Rebuild the map geometry from `data/raw/` (see [data/README.md](data/README.md)) |
| `npm run preview` | Serve the built site locally |

## How it is built

A static Astro site with the map as a React and MapLibre island, hosted on Vercel. The full decision is in [spec 0001](docs/specs/0001-stack-architecture/index.md). The plan lives in [docs/scope/scope.md](docs/scope/scope.md).

Data rules and sources are in [data/README.md](data/README.md). UI text lives in [src/i18n/ui.ts](src/i18n/ui.ts), never inline in components, so the site can be translated later.

## Licences

- **Code:** MIT, see [LICENSE](LICENSE).
- **Compiled data** (groups, areas, kingdoms, snapshots): [Creative Commons Attribution ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Third party sources keep their own licences, recorded with each dataset.
