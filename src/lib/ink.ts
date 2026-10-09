// Inks shared by the build and the map. No Astro imports here.

import type { EventKind } from './types';

/** The ink of colonial forces: a hard scarlet no polity uses, so a conquest reads as foreign at a glance. */
export const COLONIAL_INK = '#c8102e';

/** Events of outsiders from Europe (traders, slavers, expeditions, conquerors): drawn in the colonial scarlet. */
export const isForeign = (kind: EventKind): boolean => kind === 'colonial' || kind === 'partition' || kind === 'contact';
