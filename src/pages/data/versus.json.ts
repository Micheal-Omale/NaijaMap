import type { APIRoute } from 'astro';
import { getVersus } from '../../lib/forces';

// Prebuilt at build time into /data/versus.json: how each state made war, and a small base map.
// Loaded only by the Versus page, with /data/history.json for the land each side held.
export const GET: APIRoute = async () => {
	return new Response(JSON.stringify(await getVersus()), {
		headers: { 'Content-Type': 'application/json' },
	});
};
