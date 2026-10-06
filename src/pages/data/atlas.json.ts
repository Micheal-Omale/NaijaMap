import type { APIRoute } from 'astro';
import { buildAtlas } from '../../lib/atlas';
import { getGroupViews } from '../../lib/groups';

// Prebuilt at build time into /data/atlas.json: the default coloured view.
export const GET: APIRoute = async () => {
	return new Response(JSON.stringify(buildAtlas(await getGroupViews())), {
		headers: { 'Content-Type': 'application/json' },
	});
};
