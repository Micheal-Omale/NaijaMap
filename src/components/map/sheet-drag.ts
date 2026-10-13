// The phone's bottom sheet, dragged like a native one. It follows the finger and
// settles on the nearest of its three heights, or the next one along when flicked.
// It can be pulled by its handle, from anywhere while it only peeks, and down from
// its content once that is scrolled to the top, as in a native map app.

import { useEffect, useRef, type RefObject } from 'react';

export type SheetState = 'peek' | 'half' | 'full';

const DRAG = {
	/** Movement before a press becomes a drag, so taps on buttons inside still work. */
	slop: 6,
	/** A flick faster than this (px per ms) carries the sheet past the nearest height to the next. */
	flick: 0.45,
	/**
	 * A slow pull longer than this (px) still reaches the next height along: a reader scrolling a
	 * peeking card means "show me more", and springing back made the sheet feel stuck.
	 */
	commit: 40,
	/** Velocity is read over the last stretch of the gesture. */
	sampleMs: 90,
	/** Past the lowest or highest height the sheet resists, like a rubber band. */
	rubber: 0.25,
};

const ORDER: SheetState[] = ['peek', 'half', 'full'];

/** The sheet's resting heights in pixels, read from its CSS variables so they always match. */
function heights(sheet: HTMLElement): Record<SheetState, number> {
	const css = getComputedStyle(sheet);
	const px = (name: string) => {
		const probe = document.createElement('div');
		probe.style.cssText = `position:absolute;visibility:hidden;height:${css.getPropertyValue(name)}`;
		sheet.parentElement!.appendChild(probe);
		const h = probe.getBoundingClientRect().height;
		probe.remove();
		return h;
	};
	return { peek: px('--sheet-peek'), half: px('--sheet-half'), full: px('--sheet-full') };
}

/** Where a sheet released at height h, after starting at `from`, comes to rest. */
function settle(from: number, h: number, v: number, stops: Record<SheetState, number>): SheetState {
	const nearest = (among: SheetState[]) => among.reduce((best, s) => (Math.abs(stops[s] - h) < Math.abs(stops[best] - h) ? s : best));
	if (Math.abs(v) > DRAG.flick) {
		const ahead = v > 0 ? ORDER.filter((s) => stops[s] > h + 1) : ORDER.filter((s) => stops[s] < h - 1).reverse();
		return ahead[0] ?? (v > 0 ? 'full' : 'peek');
	}
	// A deliberate pull never springs back: it rests at the nearest height on the side it was pulled to.
	const moved = h - from;
	if (Math.abs(moved) > DRAG.commit) {
		const beyond = ORDER.filter((s) => (moved > 0 ? stops[s] > from + 1 : stops[s] < from - 1));
		if (beyond.length > 0) return nearest(beyond);
	}
	return nearest(ORDER);
}

export function useSheetDrag(ref: RefObject<HTMLElement | null>, state: SheetState, onState: (s: SheetState) => void, enabled: boolean): void {
	// Read the latest state inside long-lived listeners without re-binding them mid-gesture.
	const latest = useRef({ state, onState });
	latest.current = { state, onState };

	useEffect(() => {
		const sheet = ref.current;
		if (!sheet || !enabled) return;
		type Gesture = { y: number; h: number; stops: Record<SheetState, number> | null; handle: boolean; dragging: boolean; samples: { t: number; y: number }[] };
		let g: Gesture | null = null;

		const begin = (y: number, target: EventTarget | null, t: number) => {
			// Nothing is measured yet: most touches are taps or scrolls, and must stay cheap.
			g = { y, h: 0, stops: null, handle: Boolean((target as HTMLElement | null)?.closest('.sheet__handle')), dragging: false, samples: [{ t, y }] };
		};

		/** Returns true while the gesture moves the sheet. */
		const track = (y: number, t: number): boolean => {
			if (!g) return false;
			const dy = g.y - y;
			if (!g.dragging) {
				if (Math.abs(dy) < DRAG.slop) return false;
				const peeking = latest.current.state === 'peek';
				// From the content of an open sheet, only a pull down at the very top moves the sheet;
				// anything else is the content scrolling.
				const fromTop = dy < 0 && sheet.scrollTop <= 0;
				if (!g.handle && !peeking && !fromTop) {
					g = null;
					return false;
				}
				g.dragging = true;
				g.y = y;
				g.h = sheet.getBoundingClientRect().height;
				g.stops = heights(sheet);
				sheet.dataset.dragging = 'true';
			}
			const { peek, full } = g.stops!;
			let h = g.h + (g.y - y);
			if (h > full) h = full + (h - full) * DRAG.rubber;
			if (h < peek) h = peek - (peek - h) * DRAG.rubber;
			sheet.style.height = `${h}px`;
			g.samples.push({ t, y });
			while (g.samples.length > 2 && t - g.samples[0].t > DRAG.sampleMs) g.samples.shift();
			return true;
		};

		const end = () => {
			if (!g) return;
			const done = g;
			g = null;
			if (!done.dragging) return;
			const h = sheet.getBoundingClientRect().height;
			const first = done.samples[0];
			const last = done.samples[done.samples.length - 1];
			const v = last.t > first.t ? (first.y - last.y) / (last.t - first.t) : 0;
			sheet.style.height = '';
			delete sheet.dataset.dragging;
			latest.current.onState(settle(done.h, h, v, done.stops!));
			// The press that ended a drag is not a tap on whatever lay under the finger.
			const swallow = (c: Event) => {
				c.stopPropagation();
				c.preventDefault();
			};
			window.addEventListener('click', swallow, { capture: true, once: true });
			window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 350);
		};

		// Touch listeners stay passive, so the content scrolls on the compositor without waiting
		// for script. Nothing needs stopping: a peeking sheet and its handle have touch-action: none,
		// and a pull down from the top of open content has nothing left to scroll.
		const touchMove = (e: TouchEvent) => {
			if (e.touches.length === 1) track(e.touches[0].clientY, e.timeStamp);
		};
		// A touch's moves and its end go to the element it began on, even after a re-render (a
		// tap that opens a new card) takes that element out of the page, where they no longer
		// bubble to the sheet. So the gesture listens on that element: else a drag never ends,
		// and the sheet stays locked with its scrolling off.
		let touched: EventTarget | null = null;
		const release = () => {
			touched?.removeEventListener('touchmove', touchMove as EventListener);
			touched?.removeEventListener('touchend', touchEnd);
			touched?.removeEventListener('touchcancel', touchEnd);
			touched = null;
		};
		const touchEnd = () => {
			release();
			end();
		};
		const touchStart = (e: TouchEvent) => {
			if (e.touches.length !== 1 || !e.target) return;
			release();
			touched = e.target;
			touched.addEventListener('touchmove', touchMove as EventListener, { passive: true });
			touched.addEventListener('touchend', touchEnd, { passive: true });
			touched.addEventListener('touchcancel', touchEnd, { passive: true });
			begin(e.touches[0].clientY, e.target, e.timeStamp);
		};
		// Mouse (a narrow desktop window): the handle drags, as on a phone.
		const mouseDown = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse' || e.button !== 0) return;
			begin(e.clientY, e.target, e.timeStamp);
			const move = (m: PointerEvent) => track(m.clientY, m.timeStamp);
			const up = () => {
				window.removeEventListener('pointermove', move);
				window.removeEventListener('pointerup', up);
				end();
			};
			window.addEventListener('pointermove', move);
			window.addEventListener('pointerup', up);
		};

		sheet.addEventListener('touchstart', touchStart, { passive: true });
		sheet.addEventListener('pointerdown', mouseDown);
		return () => {
			sheet.removeEventListener('touchstart', touchStart);
			sheet.removeEventListener('pointerdown', mouseDown);
			release();
			// Switched off mid-drag (a story opening): leave the sheet free, not frozen at the finger.
			sheet.style.height = '';
			delete sheet.dataset.dragging;
		};
	}, [ref, enabled]);
}
