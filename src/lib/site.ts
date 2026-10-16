// Search engine and contact settings. Every value here is public: it ends up in the
// page source or at a public address. Ad settings live in data/ads.json.

export const SITE_CONFIG = {
	/** Google Search Console, "HTML tag" method: only the content="…" value. Leave empty when verified by DNS. */
	googleVerification: '',
	/** Bing Webmaster Tools, "Meta tag" method: only the content="…" value. Bing also accepts an import from Search Console. */
	bingVerification: '',
	/** A public contact address for the about and privacy pages. Empty hides those lines. */
	contact: '',
	/** IndexNow key (Bing, Yandex, Seznam; Bing feeds ChatGPT and Copilot search). The same key is in public/<key>.txt. */
	indexNowKey: '8ff0650107b676823f0e108c2e75c91b',
};
