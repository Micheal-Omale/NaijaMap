import type { APIRoute } from 'astro';
import { getHistory } from '../../lib/polities';

// Prebuilt at build time into /data/history.json: the Then view's polities and their territory.
// Only visible polities are included. Loaded only when a visitor opens the history view.
export const GET: APIRoute = async () => {
	return new Response(JSON.stringify(await getHistory()), {
		headers: { 'Content-Type': 'application/json' },
	});
};
