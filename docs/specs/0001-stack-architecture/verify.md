# Verify: Stack & architecture · spec 0001 · updated 2026-10-05
_Steps derived from the feature's "Done when" in the scope (spec 0001 is a decision spec with no numbered acceptance criteria). `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] `npm run dev`, open `http://localhost:4321` → the HistoNaija title, tagline and status line show → runs locally
- [ ] Edit a string in `src/i18n/ui.ts` and reload → the page text changes; no UI text is hard coded in `.astro` files → UI text kept apart from code
- [ ] Push to a public GitHub repo, import it in Vercel (Hobby plan), open the live URL → the same page shows, and a later push to `main` redeploys → deploys to free hosting (not done yet)

## Commands
- [ ] `npm install` then `npm run build` → finishes with "1 page(s) built", and `dist/` holds `index.html` → builds
- [ ] Search `dist/index.html` for `<script` → no match → plain pages ship no JavaScript
- [ ] Read `astro.config.mjs` → `output: 'static'` and `i18n` with `defaultLocale: 'en'`, `prefixDefaultLocale: false` → static output, ready for translation
- [ ] `node --version` → v24.x, matching `.nvmrc` and `engines` in `package.json` → runtime matches spec

## Done when coverage
- Stack recorded in a spec: spec 0001 (already done)
- Builds and runs locally: build and dev steps
- Deploys to free hosting: the GitHub and Vercel step (pending, the engineer chose local only for now)
- UI text kept apart from code: the strings step and the i18n config step
