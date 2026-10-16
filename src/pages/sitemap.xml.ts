import type { APIRoute } from 'astro';
import { absolute } from '../lib/seo';
import { publicPaths } from '../lib/sitemap';

// Every public page, for Google, Bing and the AI search crawlers. Drafts never appear:
// the lists come from the same published data as the pages.
export const GET: APIRoute = async () => {
	const urls = (await publicPaths()).map((p) => `\t<url><loc>${absolute(p)}</loc></url>`).join('\n');
	return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' },
	});
};
