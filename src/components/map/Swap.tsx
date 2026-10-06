// Moves the side panel from one view to the next (a people, a place, a
// community, the key): the old view lifts away quickly, then the new one rises
// in. Exits are faster than entrances, and a new choice made mid-exit simply
// replaces the queued one instead of stacking animations.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const MOTION = {
	exit: { ms: 120, y: 8, easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)' }, // power2.in
	enter: { ms: 340, y: 14, easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)' }, // power3.out
};

interface Props {
	/** Identifies the view; a new key plays the swap. */
	viewKey: string;
	/** 0 the key, 1 a people, 2 a place or community. Going deeper moves forward (up), going back moves down. */
	depth: number;
	/** The scroll container, so each view opens at its top (or where it was left, when coming back). */
	scroller: React.RefObject<HTMLElement | null>;
	children: ReactNode;
}

export default function Swap({ viewKey, depth, scroller, children }: Props) {
	const ref = useRef<HTMLDivElement>(null);
	const [shown, setShown] = useState({ key: viewKey, depth });
	// What the shown view last rendered, kept so it can play its exit after the parent has moved on.
	const lastChildren = useRef(children);
	if (viewKey === shown.key) lastChildren.current = children;
	const latest = useRef({ key: viewKey, depth });
	latest.current = { key: viewKey, depth };
	const exiting = useRef<Animation | null>(null);
	const direction = useRef(1);
	// Whether keyboard focus was inside the old view, so it can follow to the new one.
	const hadFocus = useRef(false);
	// Scroll positions of views left for a deeper one, restored on the way back.
	const saved = useRef(new Map<string, number>());

	// Start the exit when the requested view differs from the shown one.
	useLayoutEffect(() => {
		if (viewKey === shown.key) {
			// Changed back before the exit finished: just bring the view back.
			exiting.current?.cancel();
			exiting.current = null;
			return;
		}
		if (exiting.current) return;
		const el = ref.current;
		direction.current = depth >= shown.depth ? 1 : -1;
		hadFocus.current = Boolean(el?.contains(document.activeElement));
		if (direction.current > 0 && depth > shown.depth) saved.current.set(shown.key, scroller.current?.scrollTop ?? 0);
		if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			setShown({ key: viewKey, depth });
			return;
		}
		const { exit } = MOTION;
		const anim = el.animate(
			[
				{ opacity: 1, transform: 'none' },
				{ opacity: 0, transform: `translateY(${-exit.y * direction.current}px)` },
			],
			{ duration: exit.ms, easing: exit.easing, fill: 'forwards' },
		);
		exiting.current = anim;
		// Show whatever was asked for last, not necessarily what started this exit.
		anim.onfinish = () => setShown({ ...latest.current });
	}, [viewKey, depth, shown, scroller]);

	// The new view is in the DOM: place the scroll, then rise in.
	useLayoutEffect(() => {
		const el = ref.current;
		const back = saved.current.get(shown.key);
		saved.current.delete(shown.key);
		if (scroller.current) scroller.current.scrollTop = direction.current < 0 && back !== undefined ? back : 0;
		if (hadFocus.current && el) {
			// The button that was pressed is gone; start keyboard users at the top of the new view.
			el.focus({ preventScroll: true });
			hadFocus.current = false;
		}
		if (!exiting.current || !el) return;
		exiting.current.cancel();
		exiting.current = null;
		const { enter } = MOTION;
		el.animate(
			[
				{ opacity: 0, transform: `translateY(${enter.y * direction.current}px)` },
				{ opacity: 1, transform: 'none' },
			],
			{ duration: enter.ms, easing: enter.easing },
		);
	}, [shown.key, scroller]);

	return (
		<div ref={ref} className="swap" tabIndex={-1}>
			{viewKey === shown.key ? children : lastChildren.current}
		</div>
	);
}
