import type { APIRoute } from 'astro';
import { getGroupViews } from '../lib/groups';
import { getHistory } from '../lib/polities';
import { getStateViews } from '../lib/states';
import { absolute, byState, clip, firstSentence, paths, yearText } from '../lib/seo';

// A plain-text guide to the site for AI assistants and answer engines (llmstxt.org):
// what the atlas is, how to read its claims, and a link to every page.
export const GET: APIRoute = async () => {
	const [groups, history, states] = await Promise.all([getGroupViews(), getHistory(), getStateViews()]);
	const homeland = (g: (typeof groups)[number]) => {
		const core = g.areas.filter((a) => a.presence === 'core');
		return byState(core.length ? core : g.areas)
			.map((s) => s.state)
			.join(', ');
	};

	const lines = [
		'# HistoNaija',
		'',
		'> An interactive atlas of Nigeria: where each of its peoples (ethnic groups) lives today, by local government area, and the precolonial kingdoms, empires and city-states that came before, from about 1000 AD to the colonial conquest. Every claim carries its sources and a confidence level.',
		'',
		'How to read and cite it:',
		'- Confidence levels: high (well attested), medium (one source, approximate, or not yet checked directly), disputed (sources disagree; readings are given side by side).',
		'- Areas show where peoples live. They are approximate and are not claims of land ownership.',
		'- Nigeria has not counted ethnicity in a census since 1963; the atlas does not give population figures as fact.',
		'- Some claims rest on first-hand testimony (local knowledge); each page names these in its sources.',
		'- Compiled data is licensed CC BY-SA 4.0. Please cite pages by their URL.',
		'',
		'## Main pages',
		`- [Interactive map](${absolute('/')}): peoples today, kingdoms through time, and power since 1954`,
		`- [All peoples](${absolute(paths.peoples)}): ${groups.length} ethnic groups by language family`,
		`- [Peoples by state](${absolute(paths.states)}): the ethnic groups of each state and the FCT, LGA by LGA`,
		`- [All kingdoms](${absolute(paths.kingdoms)}): ${history.polities.length} precolonial states`,
		`- [All events](${absolute(paths.events)}): ${history.events.length} wars, treaties, migrations and conquests`,
		`- [About and method](${absolute(paths.about)})`,
		'',
		'## Peoples',
		...groups.map((g) => `- [${g.name}](${absolute(paths.people(g.id))}): ${homeland(g)}; ${g.language.name} (${g.language.family.name}). ${clip(firstSentence(g.summary.text), 160)}`),
		'',
		'## States',
		...[...states]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((s) => `- [${s.name}](${absolute(paths.state(s.id))}): ${s.lgas.length} LGAs; main peoples: ${s.main.map((p) => p.name).join(', ') || 'not yet mapped'}`),
		'',
		'## Kingdoms',
		...history.polities.map(
			(p) => `- [${p.name}](${absolute(paths.kingdom(p.id))}): ${yearText(p.span.from)}–${yearText(p.span.to)}. ${clip(firstSentence(p.summary.text), 160)}`,
		),
		'',
		'## Events',
		...[...history.events]
			.sort((a, b) => a.year - b.year)
			.map((e) => `- [${e.name}](${absolute(paths.event(e.id))}): ${e.yearLabel ?? yearText(e.year)}. ${clip(firstSentence(e.summary.text), 160)}`),
		'',
		'## Optional',
		`- [Peoples data (JSON)](${absolute('/data/groups.json')})`,
		`- [Kingdoms and events data (JSON)](${absolute('/data/history.json')})`,
		`- [Sitemap](${absolute('/sitemap.xml')})`,
		'',
	];
	return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
