import type { Translate } from '../../i18n/utils';
import adsData from '../../../data/ads.json';

// Sponsored banners inside the description cards. Ads live in data/ads.json and
// are bundled with the island, so changing them needs a rebuild, like the rest of the data.

interface Ad {
	id: string;
	sponsor: string;
	title: string;
	text?: string;
	url: string;
	cta?: string;
	image?: string;
	states?: string[];
	lgas?: string[];
	groups?: string[];
	start?: string;
	end?: string;
}

const { ads, contact } = adsData as { ads: Ad[]; contact: string };

/** Where a banner sits: what the card is about. Any field can be left out. */
export interface AdContext {
	lgas?: string[];
	states?: string[];
	group?: string;
}

function live(ad: Ad, today: string) {
	return (!ad.start || ad.start <= today) && (!ad.end || today <= ad.end);
}

/** Higher is more specific: lga 3, group 2, state 1, site-wide 0. -1 means it does not run here. */
function fit(ad: Ad, ctx: AdContext) {
	const lgas = ad.lgas ?? [];
	const groups = ad.groups ?? [];
	const states = ad.states ?? [];
	if (lgas.length + groups.length + states.length === 0) return 0;
	if (lgas.some((l) => ctx.lgas?.includes(l))) return 3;
	if (ctx.group && groups.includes(ctx.group)) return 2;
	if (states.some((s) => ctx.states?.includes(s))) return 1;
	return -1;
}

function hash(s: string) {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
	return Math.abs(h);
}

function pick(ctx: AdContext, slot: string): Ad | undefined {
	const today = new Date().toISOString().slice(0, 10);
	let best = -1;
	let pool: Ad[] = [];
	for (const ad of ads) {
		if (!live(ad, today)) continue;
		const f = fit(ad, ctx);
		if (f > best) [best, pool] = [f, [ad]];
		else if (f === best && f >= 0) pool.push(ad);
	}
	if (pool.length === 0) return undefined;
	// Stable per card, so the banner does not change while someone reads.
	return pool[hash(`${slot}|${ctx.group ?? ''}|${ctx.lgas?.join() ?? ''}`) % pool.length];
}

/** `house` shows the "Advertise here" slot when no ad runs; turn it off for a second banner in the same card. */
export function AdBanner({ ctx, slot, tr, house = true }: { ctx: AdContext; slot: string; tr: Translate; house?: boolean }) {
	const { t } = tr;
	const ad = pick(ctx, slot);

	if (!ad) {
		if (!house || !contact) return null;
		return (
			<aside className="ad ad--house" aria-label={t('ad.label')}>
				<span className="ad__label">{t('ad.label')}</span>
				<a className="ad__body" href={contact}>
					<span className="ad__copy">
						<span className="ad__title">{t('ad.houseTitle')}</span>
						<span className="ad__text">{t('ad.houseText')}</span>
						<span className="ad__cta">{t('ad.houseCta')}</span>
					</span>
				</a>
			</aside>
		);
	}

	return (
		<aside className="ad" aria-label={t('ad.label')}>
			<span className="ad__label">
				{t('ad.label')} · {ad.sponsor}
			</span>
			<a className="ad__body" href={ad.url} rel="sponsored noopener" target="_blank">
				{ad.image && <img className="ad__img" src={ad.image} alt="" loading="lazy" />}
				<span className="ad__copy">
					<span className="ad__title">{ad.title}</span>
					{ad.text && <span className="ad__text">{ad.text}</span>}
					<span className="ad__cta">{ad.cta || t('ad.cta')}</span>
				</span>
			</a>
		</aside>
	);
}
