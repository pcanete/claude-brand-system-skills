# Responsive Reconstruction

Responsive reconstruction is not desktop compression.

For every major section identify:

1. invariant
2. scalable property
3. structural transformation
4. optional removal
5. touch equivalent

## Invariants

Examples:

- dominant headline
- focal image
- hierarchy
- intentional empty space

## Scalable

Examples:

- font size
- gaps
- margins
- media width

## Structural transformations

Examples:

- side-by-side to overlapping vertical composition
- horizontal reel to swipe gallery
- floating navigation to compact menu
- pinned desktop section to linear mobile storytelling

## Mobile

Never preserve desktop interaction when it produces:

- tiny targets
- inaccessible hover dependence
- horizontal overflow
- excessive pinned scrolling
- unusable GPU performance

Preserve intent instead.

## Viewport units

A full-height hero built with `100vh` is cut off on mobile: `vh` ignores the
browser chrome, and the URL bar collapses as the user scrolls, resizing the
viewport mid-gesture.

- `svh` — smallest viewport, chrome expanded. Safe when nothing may be clipped.
- `lvh` — largest viewport, chrome collapsed.
- `dvh` — follows the chrome live. Correct for a hero meant to fill the screen,
  but it changes the layout as the bar moves; do not attach measurements to it.

Choose per section from what the reference does, and verify with the URL bar
both expanded and collapsed.

## Capability, not width

Some transformations depend on the input device rather than the viewport size.
A touch laptop is wide and hoverless; a phone in landscape is short and wide.

- Gate hover-dependent behavior on `hover: hover` and `pointer: fine`, not on a
  breakpoint.
- Build breakpoint-dependent animation inside `gsap.matchMedia()` so it is
  created and reverted with the query instead of measured once at load.
- Re-measure on resize, and treat orientation change as a resize that can
  invalidate every pinned range on the page.
