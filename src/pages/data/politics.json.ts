import type { APIRoute } from 'astro';
import { getPolitics } from '../../lib/politics';

// Prebuilt at build time into /data/politics.json: who held power, and which peoples
// dominated politics, at the centre and in each region. Loaded only when the Power view opens.
export const GET: APIRoute = async () => {
	return new Response(JSON.stringify(await getPolitics()), {
		headers: { 'Content-Type': 'application/json' },
	});
};
