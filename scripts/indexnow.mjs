// Tells Bing (which feeds ChatGPT search and Copilot), Yandex and Seznam that pages are
// new or changed, so they are crawled within hours instead of weeks. Run after a deploy:
//
//   node scripts/indexnow.mjs            every page in the live sitemap
//   node scripts/indexnow.mjs /peoples/igala /kingdoms/igala
//
// The key is in src/lib/site.ts and is served at /<key>.txt (public/).

import { readFile } from 'node:fs/promises';

const HOST = 'histonaija.logfolio.pro';
const site = await readFile('src/lib/site.ts', 'utf8');
const key = site.match(/indexNowKey: '([0-9a-f]+)'/)?.[1];
if (!key) throw new Error('No indexNowKey in src/lib/site.ts');

let urls = process.argv.slice(2).map((p) => new URL(p, `https://${HOST}`).href);
if (!urls.length) {
	const res = await fetch(`https://${HOST}/sitemap.xml`);
	if (!res.ok) throw new Error(`sitemap: ${res.status}`);
	urls = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json; charset=utf-8' },
	body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: urls }),
});
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urls.length} URLs`);
if (!res.ok && res.status !== 202) console.log(await res.text());
