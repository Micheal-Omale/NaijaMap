// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

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
	integrations: [react()],
	vite: {
		// MapLibre 6 runs its worker as an ES module.
		worker: { format: 'es' },
	},
});
