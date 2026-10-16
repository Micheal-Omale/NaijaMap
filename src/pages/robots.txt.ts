import type { APIRoute } from 'astro';
import { absolute } from '../lib/seo';

// Search engines and AI assistants are all welcome: the atlas is meant to be found and
// cited. A crawler named in its own group ignores the * group, so each repeats the rule.
const AI_CRAWLERS = [
	'GPTBot',
	'OAI-SearchBot',
	'ChatGPT-User',
	'ClaudeBot',
	'Claude-SearchBot',
	'Claude-User',
	'PerplexityBot',
	'Perplexity-User',
	'Google-Extended',
	'Applebot-Extended',
	'Meta-ExternalAgent',
	'Amazonbot',
	'CCBot',
];

export const GET: APIRoute = () => {
	const body = [
		'User-agent: *',
		'Allow: /',
		'Disallow: /review/',
		'',
		'# AI search and assistants',
		...AI_CRAWLERS.map((bot) => `User-agent: ${bot}`),
		'Allow: /',
		'Disallow: /review/',
		'',
		`Sitemap: ${absolute('/sitemap.xml')}`,
		'',
	].join('\n');
	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
