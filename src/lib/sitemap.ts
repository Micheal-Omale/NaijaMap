// Every public page, for the sitemap, llms.txt and the IndexNow ping. A page added
// under src/pages must be listed here too, or search engines are slower to find it.

import { getGroupViews } from './groups';
import { getHistory } from './polities';
import { paths } from './seo';

export async function publicPaths(): Promise<string[]> {
	const [groups, history] = await Promise.all([getGroupViews(), getHistory()]);
	return [
		'/',
		'/versus',
		paths.peoples,
		...groups.map((g) => paths.people(g.id)),
		paths.kingdoms,
		...history.polities.map((p) => paths.kingdom(p.id)),
		paths.events,
		...history.events.map((e) => paths.event(e.id)),
		paths.about,
		paths.privacy,
	];
}
