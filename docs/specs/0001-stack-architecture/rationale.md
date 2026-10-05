# 0001. Stack & architecture: decision record

## Context

> ⚠️ Premise note: two of the engineer's picks carry known risks that the plan has to carry forward. First, Vercel's free plan is for non commercial use and caps bandwidth, while the scope plans a donate link and counts success by sharing, which is how traffic spikes happen. Second, with Vercel logs only, a map that crashes on a particular phone is invisible to the owner. Neither blocks building. Both are recorded as follow ups with a concrete fallback, so they are checked rather than forgotten.

NiajMap is a free, public, educational map of Nigeria with two modes: a present day ethnic atlas (groups mapped to LGAs and enclave towns) and a historical timeline of precolonial states from about 1000 AD to 1996. It is also the owner's portfolio piece. The team is one person working with an AI assistant. The scope is built as Tracer Bullet slices (one thin real thread end to end first, then thicken it); the first slice is "search Igala, see it on the map, open its profile, live on the internet".

The forces:
- **Cost**: hosting must be free. There is no budget for a running server or a paid database.
- **Audience and networks**: most visitors are on phones, many on 3G/4G with limited data, some on older mid range Android devices. First load size decides whether the site is usable at all.
- **Discoverability**: success is measured by people using and sharing it. That needs one indexable page per group and kingdom with good preview images, so search and social sharing bring visitors in.
- **Credibility**: every claim needs a source and a confidence level, and the owner reviews data before it is public. The data store must make review and history easy, and must reject entries that lack a source.
- **Interaction**: the map itself is rich: search, highlight across states, hatching, a year slider, animated playback. It needs GPU drawing to stay smooth with 774 LGA shapes.
- **Future**: translations (Hausa, Yoruba, Igbo, Pidgin) later without rework, a small form endpoint for corrections, and growth from 50 to 250 or more groups.

Without a decision, every later feature would invent its own tools and the first slice cannot start.

## Options considered

### Option 1: Astro static site, React map island, MapLibre, data files in the repo (chosen)

Astro prebuilds every page as HTML and loads React only where the map lives; MapLibre draws the map; data files are validated by Astro content collections at build time.

**Pros**:
- No JavaScript on plain pages; map code loads only where needed.
- Built in i18n routing and schema checked content collections fit translation readiness and the "no claim without a source" rule.
- Static output deploys anywhere for free.

**Cons**:
- Two component models (Astro and React) for contributors to learn.
- Rebuild on every data change.

### Option 2: Next.js static export, React, MapLibre

Next.js with `output: 'export'` produces a static site; the whole UI is React.

**Pros**:
- Matches the reusable Next.js components in the engineer's animation library.
- One component model throughout.

**Cons**:
- Ships React runtime JavaScript on every page, including plain group pages, which hurts slow networks.
- Translation routing and data validation are add ons rather than built in; static export loses some framework features.

### Option 3: SvelteKit static, Svelte, MapLibre

SvelteKit with its static adapter; Svelte for the map UI.

**Pros**:
- Very small bundles and simple reactive code.

**Cons**:
- Cannot reuse the engineer's React animation patterns directly; smaller ecosystem for map UI pieces.

### Option 4: Single page app (React + Vite) with a hosted free tier database

One JavaScript app does everything; data lives in a hosted database with an editing screen.

**Pros**:
- Simplest mental model; non coders could edit data in the database UI.

**Cons**:
- Slow first load on phones and weak indexing, which defeats "one page per group" on Google.
- A runtime dependency on a free tier database (limits, outages, pausing on inactivity) and no git history of data edits.

## Rationale

Option 1 is the only one that meets the cost, network and discoverability forces at the same time. Static output keeps hosting free and pages instant; Astro's islands keep the heavy map code off every page that does not show the map, which matters more on Nigerian mobile networks than any framework feature. Content collections turn the credibility rule into a build failure: an entry without a source or confidence cannot be published. Option 2 was the strongest alternative because of the engineer's existing Next.js animation library, but GSAP and React patterns still work inside Astro's React islands, so that reuse is not lost; paying React's runtime on every group page is.

Two picks differ from the recommended path, and the engineer accepted the tradeoffs:
- **Hosting.** The engineer chose Vercel. Cloudflare Pages was recommended because its free plan has no bandwidth cap, it has servers in Lagos, and it has no non commercial clause. Vercel works well for a static Astro site and gives a smooth Git workflow. The tradeoff is accepted with a check before the donate link ships. Because the output is static, switching later costs little.
- **Error tracking.** The engineer chose Vercel logs only over a free tier browser error tracker. This is fine at the start. The cost is blindness to phone specific map crashes, which matters given the mid range Android baseline.

MapLibre was chosen over D3 because zooming down to town level for enclave communities and drawing 774 shapes smoothly on a phone are core needs. Shape morphing for the timeline can be built on top of MapLibre without switching engines. Data files beat a hosted database because the owner is the only reviewer and history matters more than a friendly editing screen. Plain CSS tokens beat Tailwind because the two moods are a token swap, and the map's own style rules sit outside any CSS framework anyway.

## References

**Project sources**:
- `docs/scope/scope.md`: product decisions, build approach (Tracer Bullet), features 3, 4, 5, 6, 10, 12, 13 and 14 that this spec defers to.

**Practices & standards**:
- Islands architecture (ship JavaScript only for interactive parts).
- Monolith first for a small team.
- Static site generation for indexable content pages.
- Data as code (version controlled, schema validated data).
- WCAG AA, and providing a text alternative for map content.

**Links** (web verified during the landscape check, 2026-10-05):
- Astro blog (releases): https://astro.build/blog/
- Astro content collections: https://docs.astro.build/en/guides/content-collections/
- Next.js static exports: https://nextjs.org/docs/app/guides/static-exports
- MapLibre PMTiles example: https://maplibre.org/maplibre-gl-js/docs/examples/pmtiles-source-and-protocol/
- Cloudflare plans: https://www.cloudflare.com/plans/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Node.js releases: https://nodejs.org/en/about/releases/
- GSAP pricing (free for all use): https://gsap.com/pricing/
- Vercel Hobby plan terms: not verified in this check, cite by name only.
