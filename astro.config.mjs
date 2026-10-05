// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// Static output: every page is prebuilt, no running server (spec 0001).
	output: 'static',
	i18n: {
		// English first. Add 'ha', 'yo', 'ig', 'pcm' here when translations land.
		defaultLocale: 'en',
		locales: ['en'],
		routing: {
			prefixDefaultLocale: false,
		},
	},
});
