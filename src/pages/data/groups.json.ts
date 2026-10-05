import type { APIRoute } from 'astro';
import { getGroupViews } from '../../lib/groups';

// Prebuilt at build time into /data/groups.json. Only visible groups are included.
export const GET: APIRoute = async () => {
	return new Response(JSON.stringify(await getGroupViews()), {
		headers: { 'Content-Type': 'application/json' },
	});
};
