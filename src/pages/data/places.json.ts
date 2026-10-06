import type { APIRoute } from 'astro';
import { getPlaceViews } from '../../lib/groups';

// Prebuilt at build time into /data/places.json. Only visible briefs are included.
export const GET: APIRoute = async () => {
	return new Response(JSON.stringify(await getPlaceViews()), {
		headers: { 'Content-Type': 'application/json' },
	});
};
