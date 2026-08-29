# Visual QA

A successful build is not equivalent to a faithful build.

## What the tooling does, and what it does not

`scripts/visual-qa.mjs` drives a headless browser from `QA_PROFILE.json` and
produces the material these passes need: a full-page baseline per route and
viewport, a before/after pair for each declared interaction, a reduced-motion
pass over every route, and any console or page error that appeared.

It does not compare anything to the reference. There is no automatic diff and
no score. The comparison below is human work performed against the captures;
the tool exists so that work happens on evidence instead of memory.

Two things it does decide: a page error, and a console error not listed in the
profile's `ignore_console`, each fail the run. Silencing known third-party
noise is a decision that belongs in the profile, where it stays visible.

## Required viewports

At minimum inspect:

- 1440 × 900
- 1280 × 800
- 768 × 1024
- 390 × 844

Add reference-specific viewports when needed.

## Pass A — Geometry

Compare:

- content width
- section height
- major alignments
- whitespace
- visual weight
- image scale
- cropping

### Blocking composition gate

Do not continue to typography, motion, or surface polish while the primary
composition fails.

At every required viewport:

1. identify the dominant regions from the reference, such as headline, copy,
   media, navigation and deliberate empty space;
2. compare their visual mass, alignment and separation against the reference;
3. fail the pass when unrelated regions collide, content is unintentionally
   clipped, a dominant element invades another region, or intended whitespace
   collapses;
4. adapt line breaks, measures, grid ratios or section height and repeat the
   capture.

For large text, do not trust the bounding box of a block or grid item as proof
that its letters fit. A block can remain inside its column while nowrap text
paints outside it. Measure the painted text itself — for example, the
`Range.getBoundingClientRect()` of each text line — and compare that boundary
with the adjacent region. Record the minimum separation at the tested desktop
viewports. On stacked layouts, measure vertical separation instead.

A clean console, a successful build and the absence of document-level
horizontal overflow do not pass this gate.

## Design critique gate

After geometry passes, inspect the rendered page as a composition rather than a
set of correct components:

- What is perceived first, second and third?
- Do dominant and secondary masses retain the reference relationship?
- Is text legible against the actual moving media, not only one favorable frame?
- Does negative space frame the hierarchy or merely remain unused?
- Do alignment anchors and intentional asymmetry still feel deliberate?
- Does the reading path reach the primary action without competing focal points?
- Did adapted copy preserve the hierarchy, or did fitting it flatten the design?

Record a concise verdict and the most important correction. Do not approve a
page whose parts are individually accurate but compositionally incoherent.

## Pass B — Typography

Compare:

- family
- weight
- width
- scale
- line height
- tracking
- measure
- line breaks

## Pass C — Surface

Compare:

- colors
- borders
- radius
- shadows
- texture
- opacity

## Pass D — Interaction

Test:

- hover
- keyboard focus
- active
- menu
- carousel
- filtering
- fullscreen
- drag
- direct manipulation
- links
- cursor
- touch equivalents

## Pass E — Motion

Compare:

- trigger
- direction
- sequence
- amplitude
- duration
- easing
- stagger
- scroll relationship
- scene choreography

## Pass F — Responsive

Check whether design intent survives.

## Pass G — Technical

Check:

- production build
- browser console
- missing assets
- overflow
- layout shift
- reduced motion
- keyboard use

## Priority

P0:
broken functionality

P1:
composition, hierarchy, typography, media geometry

P2:
motion, interaction detail

P3:
minor decoration
