# Scroll Scenes

The reference behavior most often observed and least often reproduced
correctly. STYLE_DNA records *what* the scroll does; this file is *how* to
build it without breaking the page.

Nothing here authorizes adding scroll behavior. Build what the evidence shows.

## Classify before implementing

| Kind | Relationship | Implementation |
| --- | --- | --- |
| Triggered | Scroll position starts a self-running animation | IntersectionObserver, or CSS `view()` timeline |
| Linked | Progress follows scroll continuously | Scrubbed timeline |
| Scene | Several elements choreographed over one pinned range | Pinned timeline with labels |
| Continuous | Runs regardless of scroll | CSS or rAF loop |

Getting this wrong is the usual fidelity failure: a triggered reveal rebuilt as
a scrub feels sluggish; a scrub rebuilt as a trigger loses the connection to the
user's hand.

## Scrubbed timelines

With GSAP ScrollTrigger:

- `scrub: true` binds progress directly to scroll position.
- `scrub: <seconds>` adds catch-up smoothing. Use it when the reference feels
  weighted rather than rigid — a value near `0.5` is a common starting point.
- `start` / `end` accept `"top center"`-style strings, pixel numbers, or
  functions. They are computed on creation and on resize.
- `invalidateOnRefresh: true` flushes recorded start values on refresh. Needed
  whenever the animation uses values that depend on layout or viewport size.
- `snap` accepts an increment, an array of progress values, or `"labels"`, with
  optional `duration`, `ease` and `directional`.

Call `ScrollTrigger.refresh()` after anything that changes document height
outside its knowledge: fonts finishing, images resolving, an accordion opening,
content injected after load.

## Pinning

- Do not animate the pinned element itself; that corrupts the measurements
  ScrollTrigger takes. Pin a wrapper and animate its children.
- `anticipatePin: 1` prevents the flash of unpinned content during fast
  scrolling.
- A `transform`, `filter` or `will-change` on an ancestor creates a containing
  block and breaks `position: fixed`. This is the most common cause of a pin
  that silently does nothing.
- Pinning reserves space by adding height. Verify the section's rhythm against
  the reference after pinning, not before.
- Pinned ranges are expensive on mobile. See the responsive rule below.

## Frame sequences

A scroll-scrubbed image sequence — the cinematic hero of most premium
references. It looks like video; it is not.

Pipeline:

1. Extract frames from the source clip. Around 12 fps is enough for scrubbed
   playback because the user's scroll rate, not real time, drives it. Cap the
   count: 60–120 frames covers most sequences.
2. Encode as WebP or AVIF, sized to the largest rendered box, not to the
   source resolution.
3. Preload progressively. Decode the first frames before the section is
   reachable, and continue in the background. Use `img.decode()` so the first
   paint never lands on an undecoded bitmap.
4. Render to a `<canvas>` sized to `clientWidth * min(devicePixelRatio, 2)`.
   Uncapped DPR triples the fill cost on phones for no visible gain.
5. Draw with cover geometry — compute the scale and offsets, do not stretch.
6. Map scroll to frame index through normalized progress, clamped to 0–1, then
   smooth it: `current += (target - current) * k` per frame, with `k` around
   `0.1`–`0.15`. Without smoothing the sequence stutters on trackpads.
7. Redraw only when the resolved index changes.

Fallback when the frame budget is too large for the connection: keep the
original video element and seek it to the mapped time. Quality is lower and
seeking is less precise, but it degrades instead of failing.

Memory is the real constraint. Hundreds of full-resolution decoded frames will
crash a mobile browser. Budget the sequence before building it, and record the
budget as a fidelity exception if it forces a shorter sequence than the
reference.

## CSS scroll-driven animations

`animation-timeline` with `scroll()` and `view()` moves scroll-linked animation
off the main thread with no library at all. Ideal for progress bars, reveals,
and parallax.

Support is real but not universal: shipped in Chrome and Edge since 115, in
Safari since 26, and still behind a flag in stable Firefox as of mid-2026.

Treat it as progressive enhancement. The page must be usable and correctly
composed when the timeline never runs — which is exactly how it behaves in a
browser without support, and also under reduced motion. If the observed
behavior is essential to the reference rather than decorative, drive it with
JavaScript and use CSS only where it can fail silently.

## Smooth scroll and inertia

Only implement it when the reference actually has it. Weighted, easing scroll
is a deliberate authorial choice and reproducing it wrongly is worse than
native scrolling.

Two current options, both viable:

- **Lenis** runs on native scroll rather than transforming a container, so
  `position: sticky`, find-in-page and accessibility keep working. It honors
  `prefers-reduced-motion` by default: smoothing is disabled by forcing `lerp`
  to 1 so scrolling tracks the input device 1:1, programmatic scrolls jump
  instantly, and the instance keeps running so anything synchronized to it
  stays synchronized. Anchor-link handling is opt-in via `anchors`.
- **GSAP ScrollSmoother**, which integrates with ScrollTrigger directly. Since
  GSAP 3.13 the whole toolset, formerly Club-only plugins included, is free for
  commercial use.

Whichever is used, verify afterwards: anchor links, browser find, keyboard
`Page Down` and `End`, focus scrolled into view, `position: sticky`, and
scroll position on back-navigation. The historic reputation of smooth scroll
comes from implementations that broke all six.

## Lifecycle in Astro

Scroll machinery survives the first page load and dies on the second unless it
is wired to the router.

- With `<ClientRouter />`, bundled module scripts run once. Initialize inside a
  handler for `astro:page-load`, which fires on first load and on every
  navigation.
- Tear down on `astro:before-swap`: kill ScrollTriggers, cancel rAF loops,
  disconnect observers, destroy the smooth-scroll instance. Skipping this leaks
  a listener set per navigation and produces scroll behavior that gets
  progressively wrong the longer the session lasts.
- Media or a WebGL canvas that must survive navigation needs
  `transition:persist`; its animation loop then must *not* be torn down.
- `data-astro-rerun` forces an inline script to re-execute after a transition.

## Responsive behavior

Scroll scenes are the least portable thing in a reference.

- Build breakpoint-dependent scenes inside `gsap.matchMedia()` so they are
  created and reverted with the query rather than measured once.
- A long pinned desktop scene usually becomes linear storytelling on mobile.
  That is a structural transformation, not a failure of fidelity.
- Re-measure on viewport resize, and remember that mobile URL-bar collapse
  fires resize events mid-scroll. Debounce, and prefer `invalidateOnRefresh`
  over caching layout values yourself.

## Reduced motion

Every scroll scene needs a defined reduced-motion state, and it is never
"duration zero" — that produces an empty section where a narrative used to be.

- Scrubbed sequences: show a representative frame, usually the final one.
- Pinned scenes: unpin, and lay the steps out as ordinary stacked sections.
- Parallax and drift: hold at rest position.
- Reveals: content visible from the start.

Read the preference at runtime and respond to changes, rather than only at
load. If the reference itself ships no reduced-motion behavior — which is
common — that absence is not part of the design language to reproduce.
