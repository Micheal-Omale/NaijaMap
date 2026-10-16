// Draws the share previews (1200 by 630) shown when a page is posted on WhatsApp, X,
// Facebook or LinkedIn, from the menu's map drawings (src/components/menu-previews.ts):
//
//   public/og/atlas.png     the peoples map, for the home page and the peoples pages
//   public/og/kingdoms.png  the kingdoms of 1750 on the old map, for kingdoms and events
//
//   node scripts/build-og-images.mjs
//
// Run it again after scripts/build-menu-previews.mjs.

import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const src = await readFile('src/components/menu-previews.ts', 'utf8');
const P = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const [bw, bh] = P.box;

const W = 1200;
const H = 630;
/** The map fills the right, clear of the text column (which ends near x = 640). */
const SCALE = 4.3;
const MAP_X = W - bw * SCALE - 24;
const MAP_Y = (H - bh * SCALE) / 2;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function card({ bg, land, line, ink, muted, accent, display, title, sub, kicker, shapes }) {
	const lines = title.map((l, i) => `<text x="72" y="${250 + i * 68}" font-family="${display}" font-size="58" font-weight="700" fill="${ink}">${esc(l)}</text>`).join('');
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
	<rect width="${W}" height="${H}" fill="${bg}"/>
	<g transform="translate(${MAP_X} ${MAP_Y}) scale(${SCALE})">
		<path d="${P.outline}" fill="${land}" stroke="none"/>
		${shapes}
		<path d="${P.outline}" fill="none" stroke="${line}" stroke-width="0.5" stroke-linejoin="round"/>
	</g>
	<g transform="translate(72 96)">
		<rect width="56" height="56" rx="12" fill="#0a7650"/>
		<rect x="22" y="10.5" width="12" height="35" rx="2" fill="#f7efdc"/>
		<circle cx="40.7" cy="41.6" r="6.3" fill="#e8590c" stroke="#f7efdc" stroke-width="2"/>
		<text x="76" y="40" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="700" fill="${ink}">HistoNaija</text>
	</g>
	<text x="72" y="190" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3" fill="${accent}">${esc(kicker)}</text>
	${lines}
	<text x="72" y="${250 + (title.length - 1) * 68 + 58}" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="${muted}">${esc(sub)}</text>
	<text x="72" y="${H - 56}" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="600" fill="${muted}">histonaija.logfolio.pro</text>
</svg>`;
}

const atlas = card({
	bg: '#f4f2ed',
	land: '#e6e2d8',
	line: '#4a4740',
	ink: '#17191e',
	muted: '#565b66',
	accent: '#0a7650',
	display: 'Segoe UI, Arial, sans-serif',
	kicker: 'MAP OF NIGERIA’S PEOPLES',
	title: ['Where Nigeria’s', 'peoples live,', 'and the kingdoms', 'they built'],
	sub: 'Every claim sourced',
	shapes: P.peoples.map((s) => `<path d="${s.d}" fill="${s.fill}"/>`).join(''),
});

const kingdoms = card({
	bg: '#ece1c8',
	land: '#f0e4c6',
	line: '#6e5a3c',
	ink: '#2b2118',
	muted: '#5f5141',
	accent: '#8a3f1c',
	display: 'Palatino Linotype, Book Antiqua, Georgia, serif',
	kicker: `NIGERIA BEFORE THE LINES · ${P.kingdoms.year}`,
	title: ['Kingdoms and', 'empires of', 'precolonial Nigeria'],
	sub: 'Oyo, Benin, Bornu, Igala, Kwararafa and more',
	shapes:
		P.kingdoms.shapes
			.map((s) =>
				s.layer === 'core'
					? `<path d="${s.d}" fill="${s.fill}" fill-opacity="0.62"/>`
					: `<path d="${s.d}" fill="${s.fill}" fill-opacity="0.16" stroke="${s.fill}" stroke-width="0.8" stroke-dasharray="2 2"/>`,
			)
			.join('') +
		`<path d="${P.kingdoms.pen}" fill="none" stroke="#2b2118" stroke-width="1.2" stroke-linejoin="round"/>`,
});

await mkdir('public/og', { recursive: true });
for (const [name, svg] of Object.entries({ atlas, kingdoms })) {
	await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(`public/og/${name}.png`);
	console.log(`public/og/${name}.png`);
}
