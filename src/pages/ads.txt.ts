import type { APIRoute } from 'astro';
import adsData from '../../data/ads.json';

// Who may sell ads on this site. Filled from the AdSense publisher id in data/ads.json;
// without one it lists no sellers, which is correct while the site runs no network ads.
export const GET: APIRoute = () => {
	const client = adsData.adsense.client.trim();
	const body = client
		? `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`
		: '# No ad networks are authorised to sell ads on this site yet.\n';
	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
