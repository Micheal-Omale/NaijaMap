# 0001. Static first Astro site with a React and MapLibre map island

**Date**: 2026-10-05
**Status**: In Progress

## Summary

HistoNaija is built as a static website: every page is prebuilt ahead of time, so it loads fast and Google can read it. The map is one interactive app inside the site. Astro builds the pages, React and MapLibre power the map, and the data lives as plain files in the code repo that are checked on every build. It is hosted free on Vercel and goes live automatically when code is pushed to GitHub. This keeps hosting at zero cost, keeps the site quick on Nigerian mobile networks, and puts every data edit in public history.

## Decision

**Chosen option**: Option 1: Astro static site, React map island, MapLibre, data files in the repo, on Vercel.

Build HistoNaija as a single static first Astro project (TypeScript, strict), with the interactive map as a lazily loaded React island drawn by MapLibre GL over our own minimal base layers, data stored as validated files in a public GitHub repo, and auto deploy to Vercel's free plan.

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Architecture pattern | One static first project (a monolith), prebuilt HTML pages plus one interactive map island; no running server | Free hosting, instant pages on slow networks, and indexable pages per group and kingdom. |
| Language | TypeScript, strict mode | Catches broken data shapes (a missing source, a bad confidence value) before they ship. |
| Runtime | Node.js 24 LTS | Stable long term support that hosts and tools target today. |
| Package manager | npm | Engineer's pick; comes with Node, nothing extra to install. |
| Site framework | Astro (current major, 7.x as of this spec), static output | Ships no JavaScript on plain pages, has built in translation routing and content collections that validate data at build time. |
| Interactive UI | React, inside Astro islands only (the map app: search, slider, profiles) | Largest ecosystem and reuse of the engineer's React animation patterns; plain pages stay JavaScript free. |
| Map engine | MapLibre GL JS (current major, 6.x as of this spec) | Free, no API key, GPU drawn, data driven colours, fill patterns for hatching, fast highlight via feature state. |
| Base layers | Our own minimal layers from open data: Niger and Benue rivers, lakes, coastline, key towns, borders | Free forever, styled for both moods; roads would be wrong in a 1600 AD view anyway. Exact sources and file format are decided in feature 4 (Base map geometry). |
| Data store | Version controlled data files in the repo, validated at build time with Astro content collections (schema checks) | Zero cost, full edit history, easy owner review, nothing to run. The data shape is decided in feature 3 (Data model & sourcing rules). |
| Styling | Plain CSS with CSS custom properties as design tokens, switched by mood (Today, Then) | No extra tool, sits naturally beside the map's own style rules. Token details are decided in feature 5 (Design system). |
| Motion | GSAP (now free including all plugins), installed when a feature first needs it | Precise timelines suit the timeline playback. Used only where a moment earns it, adapted or newly invented. |
| Translation readiness | Astro built in i18n routing, English as the default locale without a URL prefix; all UI text kept in one strings module | Launch in English; Hausa, Yoruba, Igbo and Pidgin can be added later without rework. |
| Hosting | Vercel, free Hobby plan, static output (small serverless functions later for the correction form) | Engineer's pick. Must be checked again before the donate link goes live (see Consequences). |
| Code and deploy | Public GitHub repo; Vercel's Git integration deploys `main` on push and gives every pull request a preview link | Hands free deploys; a failed data check or build stops the deploy. |
| Observability | Vercel's built in logs only | Engineer's pick. Does not see errors in visitors' browsers (see Consequences). |
| Licences | Code: MIT. Compiled data: Creative Commons Attribution ShareAlike 4.0 (CC BY-SA 4.0) | Open code invites contributors; share alike data requires credit and keeps derived maps open. Third party source licences are respected per dataset (feature 4 checks the boundary files). |
| Device baseline | A typical mid range Android phone on 3G/4G; phones without WebGL (the GPU drawing the map needs) get a readable list and a static map image | Nobody hits a blank screen; the text alternative also serves screen readers. |
| Performance budget | Plain pages ship no JavaScript; map code loads only on pages that show the map; target under about 400 KB of compressed JavaScript on a map page | MapLibre alone is the bulk of that; the budget stops the app from quietly growing past what slow networks bear. Measured in feature 6. |

**Left to later features, on purpose** (each needs its own decision, made when it is built):
- App state handling in the map island (engineer chose to decide later): feature 6. The web address stays the source of truth for the current view, since feature 10 (sharing) depends on it.
- Search method: feature 6.
- Geometry source, simplification and tile format: feature 4.
- Preview image generation: feature 10.
- Correction form backend and spam control: feature 13.
- Analytics tool: feature 14.
- Test framework: set by `/test` preferences. Lint and format: set by `/audit`.

## Consequences

**Positive**:
- Zero running cost and no server to look after; a static site cannot go down from a database outage.
- Group and kingdom pages are plain HTML, so they load fast and rank on Google.
- Every data change is a reviewed commit with history, which supports the "every claim has a source" promise.
- Moving hosts later is cheap: the output is static files.

**Negative / tradeoffs**:
- **Vercel Hobby terms**: the free plan is for non commercial use, and a donate link may count as commercial. It also caps monthly bandwidth (about 100 GB a month as last known; not verified in this spec's landscape check, so confirm the current figure). A viral share could hit the cap. This must be checked again before feature 12 ships the donate link; the fallback is a move to Cloudflare Pages (no bandwidth cap on its free plan, servers in Lagos).
- **No browser error tracking**: Vercel logs see build and server problems, not the map crashing on a visitor's phone. Device specific failures will surface only when someone reports them through the correction form (feature 13). Adding a free tier error tracker later is a small change.
- Editing data means editing files; non coders cannot edit directly. Acceptable while the owner is the only reviewer.
- A full rebuild runs on every data change. Fine at hundreds of pages; worth watching if pages grow into the thousands.
- The map needs WebGL, so the no WebGL fallback is real extra work that must be kept in step with the map.

**Neutral**:
- React is used only inside islands; plain Astro components handle everything else. Contributors need to know both.
- GSAP and other libraries are installed only when the feature that needs them is built, not up front.

## Follow-up

- [ ] Before feature 12 (About, sources & donate page) ships: check Vercel's current Hobby plan terms on commercial use and bandwidth, and move to Cloudflare Pages if the donate link or traffic does not fit.
- [ ] Feature 6 decides the app state approach for the map island (left open by the engineer), keeping the web address as the source of truth for the current view.
- [ ] Agent Skills and MCP servers were deferred ("not now"). Worth adding later: an Astro skill (component, island and content collection conventions), a MapLibre skill (style expressions, layers, performance), a GSAP skill (timeline and cleanup patterns), and the Vercel MCP server (deploy and log access).
- [ ] Revisit browser error tracking if visitors report crashes that the logs cannot explain.
- [ ] Pick a domain name before public launch (end of Phase 1); canonical URLs and share links depend on it.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
