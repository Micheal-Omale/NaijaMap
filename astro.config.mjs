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
	// The dev toolbar floats over the bottom of the screen, where the phone's tab bar is.
	devToolbar: { enabled: false },
	vite: {
		// MapLibre 6 runs its worker as an ES module.
		worker: { format: 'es' },
		// The story view loads GSAP lazily. Prebundle it up front, or the dev server
		// discovers it on the first click, re-optimises and fails that import (504).
		optimizeDeps: { include: ['gsap', 'gsap/SplitText', 'maplibre-gl'] },
	},
});
