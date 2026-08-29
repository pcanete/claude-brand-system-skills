---
name: reference-scanner
description: Analyzes a reference website as a visual and behavioral system and records evidence another agent can build from. Covers layout, typography, media, desktop and mobile interaction, responsive transformation, motion, page transitions and WebGL, producing STYLE_DNA and REFERENCE_EVIDENCE. Use when a chosen reference site's visual logic or detailed behavior must be captured, documented or handed to an implementer. Not for cross-channel brand identity extraction or for building the result.
license: MIT
metadata:
  version: "0.7.0"
---

# Reference Scanner

Analyze an existing website as a design and interaction system.

The objective is not to copy source code or proprietary assets.

The objective is to reconstruct the site's:

- visual grammar
- spatial logic
- typography system
- component language
- media behavior
- responsive transformations
- interaction grammar
- motion language
- transition system
- optional WebGL behavior

Produce structured evidence another agent can implement.

## Required output

Produce:

1. `STYLE_DNA.json`
2. `REFERENCE_EVIDENCE.json`
3. `STYLE_REPORT.md`

STYLE_DNA is the synthesized implementation specification.

REFERENCE_EVIDENCE records what was actually observed.

STYLE_REPORT is the human-readable interpretation.

For STANDARD and FORENSIC scans, STYLE_REPORT must include a concise behavior
matrix showing which desktop/mobile inputs were tested, the activation model,
important thresholds or timing/velocity profiles, responsive substitutions and
remaining unknowns.

Never present an inferred behavior as directly observed.

Both contracts have schemas: `schemas/style-dna.schema.json` and
`schemas/reference-evidence.schema.json`. Write against them from the start
rather than reshaping the output at the end.

For STANDARD and FORENSIC scans, record `behavior_audits` in
REFERENCE_EVIDENCE. These are temporal, input-specific tests of important
behavior, not prose summaries.

`assets/scan-profile.example.json` shows how to declare the scan up front:
routes, viewports, states and the capabilities actually available.

## Capability detection

Before scanning, determine what inspection capabilities are actually available.

Possible capabilities include:

- page text/content access
- DOM inspection
- computed CSS inspection
- browser automation
- screenshots
- viewport resizing
- pointer interaction
- keyboard interaction
- scroll automation
- video/screen recording
- local video metadata/decode
- browser video playback
- timestamped frame sampling
- source/network inspection
- JavaScript inspection
- canvas/WebGL inspection

Do not claim evidence from capabilities that are unavailable.

Record available capabilities in REFERENCE_EVIDENCE.

If browser automation is unavailable, continue with reduced confidence and
document the limitation.

## Scan modes

### QUICK

Use for early exploration.

Inspect:

- homepage
- dominant visual language
- primary typography
- main layout
- representative media
- obvious interaction

Do not claim comprehensive coverage.

### STANDARD

Use for normal reconstruction.

Inspect:

- homepage
- important routes
- multiple viewport sizes
- navigation
- representative components
- interaction states
- scroll behavior
- media behavior
- responsive transformations

### FORENSIC

Use for high-fidelity reconstruction or complex interactive references.

Inspect:

- route inventory
- section inventory
- component families
- major interaction states
- hover/focus/active states
- scroll-linked sequences
- page transitions
- responsive behavior
- video/media behavior
- WebGL/canvas behavior
- repeated motion samples
- detailed desktop and mobile behavior audits
- input substitution across pointer, keyboard and touch
- capability fallbacks

Default to FORENSIC when the reference is highly animated, experimental,
WebGL-driven, or award-site-like and high fidelity is requested.

Read `references/scanner-protocol.md`.

## Observation model

Every meaningful conclusion must be distinguishable from its evidence.

Use:

- exact
- derived
- inferred
- adaptive
- unknown

And a confidence score from 0.0 to 1.0.

Also assign perceptual salience from 0.0 to 1.0 when useful.

Read `references/observation-model.md`.

## Evidence-first rule

Prefer:

OBSERVE
→ RECORD
→ COMPARE
→ INFER
→ SYNTHESIZE

Never:

ASSUME
→ DESCRIBE AS FACT

## Phase 1 — Reconnaissance

Identify:

- canonical URL
- primary routes
- navigation structure
- language variants
- page families
- major content types
- visible interactive regions
- embedded media
- canvas/WebGL presence
- dynamic or personalized content

Record scan scope.

## Phase 2 — Capture matrix

Define routes, viewports, and states requiring evidence.

Treat user-supplied annotated captures as intent evidence, not merely another
screenshot. An annotation can identify the composition or behavior the user
wants preserved even when the live page exposes several possible states.

At minimum for STANDARD or FORENSIC evaluate representative:

- large desktop
- desktop/laptop
- tablet
- mobile

Do not assume desktop behavior describes mobile behavior.

## Phase 3 — Art direction

Read `references/visual-analysis.md`.

Analyze:

- visual personality
- editorial character
- density
- tension
- contrast
- hierarchy
- visual mass
- negative space
- repetition
- asymmetry
- composition
- brand expression

Describe principles rather than adjectives alone.

## Phase 4 — Typography

Identify when evidence allows:

- font family
- fallback family
- category
- optical character
- weight
- width
- size relationships
- line height
- tracking
- capitalization
- measure
- wrapping behavior
- responsive scale

Do not invent exact font identities from visual similarity alone.

## Phase 5 — Layout system

Capture:

- container behavior
- viewport-relative sizing
- grid logic
- alignment
- section rhythm
- horizontal margins
- vertical spacing
- overlap
- full-bleed behavior
- sticky/pinned structures
- negative space
- intentional irregularity

Classify important properties as:

- fixed
- fluid
- content-driven
- viewport-driven
- breakpoint-transformed

## Phase 6 — Component language

Identify reusable visual families.

Do not impose conventional component categories on intentionally editorial
layouts.

Record anatomy, states, visual rules, responsive behavior, and interaction.

## Phase 7 — Media

When a supplied reference is a video or screen recording, read
`references/video-analysis.md`. Do not declare the video unreadable after one
decoder fails: follow the decoder fallback ladder, record metadata, sample
timestamped frames and analyze temporal grammar.

Analyze:

- image aspect ratios
- cropping
- object positioning
- masks
- video behavior
- embeds
- autoplay/mute/loop when observable
- poster states
- hover media
- fullscreen treatment
- media sequences
- interactive scenes
- loading/reveal behavior

Do not reuse third-party reference assets unless explicitly authorized.

## Phase 8 — Interaction

Read `references/interaction-analysis.md`.
For STANDARD or FORENSIC scans also read `references/behavior-forensics.md`.

Inspect representative:

- hover
- focus
- pointer down
- active
- menu open/close
- carousel navigation
- filtering
- fullscreen media
- direct manipulation
- drag/swipe
- cursor transformations
- link transitions
- media interaction

For high-salience interactions, distinguish changes to character content from
translation, clipping, layering, glyph substitution and font-feature changes.
Never describe text as "changing" from a before/after screenshot alone.

For every high-salience family, include a state matrix covering initial,
activation, early, middle, settled and reverse/close states where applicable.
Menus and typographic microinteractions cannot be marked covered from only
closed/open or before/after captures.

## Phase 9 — Motion

Read `references/motion-analysis.md`.

Classify animation as:

- entrance
- interaction
- scroll-triggered
- scroll-linked
- continuous
- media
- page transition
- WebGL

For complex long-form regions, represent coordinated behavior as scroll scenes
rather than isolated animation fragments.

Do not assign a single speed to a marquee, ticker or scroll-reactive element
until idle, active and reverse samples establish whether it is autonomous,
scroll-linked, velocity-coupled, inertial or state-driven.

## Phase 10 — Scroll behavior

Inspect:

- native scrolling
- smooth/inertial feel
- pinned regions
- sticky elements
- scrubbed sequences
- horizontal movement
- scroll snapping
- section reveals
- media scaling
- parallax
- progressive masking
- header behavior

For scroll-reactive headers, probe immediately below and above the activation
threshold, then reverse direction. Record geometry, colors, content changes,
timing, easing, section-context changes and whether the header hides, compacts
or only restyles.

## Phase 11 — WebGL detection

Read `references/webgl-detection.md`.

Separate observed behavior from suspected technology.

Do not prescribe WebGL when CSS, DOM animation, video, or Canvas 2D adequately
explain available evidence.

## Phase 12 — Responsive analysis

Read `references/responsive-analysis.md`.

Compare the same conceptual component across viewport classes.

Desktop and mobile are separate behavioral targets. Re-run important menus,
headers, carousels, media controls and text microinteractions with the input
available on each device; do not extrapolate hover to touch.

Classify changes as:

- invariant
- scale
- reflow
- reorder
- replace
- omit
- recrop
- interaction substitution
- motion reduction
- layout mode change

When the same content or assets remain present across viewports, do not assume
the behavior is invariant. Compare activation model, movement axis, amplitude,
direction, sequencing and whether actors move independently or as one shared
track. Record a mechanism change as a responsive replacement even when the
visible content is unchanged.

## Phase 13 — Page transitions

When observable inspect:

- outgoing behavior
- incoming behavior
- persistent/shared media
- overlays
- background transitions
- navigation continuity
- scroll restoration
- interruption behavior

Describe observable behavior separately from technology hypothesis.

## Phase 14 — Synthesis

Read `references/synthesis-rules.md`.

Convert observations into reusable design rules rather than a transcript of
coordinates.

## Phase 15 — Constraints

Produce:

`must_preserve`

`may_adapt`

`must_not_introduce`

## Phase 16 — Coverage audit

Report separate coverage for:

- visual
- typography
- layout
- media
- interaction
- motion
- responsive
- transitions
- WebGL

A FORENSIC scan must not call itself complete when high-salience behavior
remains unobserved.

It must also fail completion when desktop and mobile behavior were not both
tested, or when a high-salience temporal claim rests on a single sample.

It must fail when a supplied reference video was not decoded through either a
media tool or browser playback, unless both paths were attempted and the
limitation is explicit.

## Phase 17 — Output validation

STYLE_DNA must not contradict REFERENCE_EVIDENCE. Verify it before handing the
artifacts to anyone:

```bash
node scripts/validate-style-dna.mjs \
  --style STYLE_DNA.json --evidence REFERENCE_EVIDENCE.json
```

Install the validator's dependencies once with `npm install` in the skill
directory.

After changing the behavioral contract or gates, run:

```bash
node scripts/test-behavior-gates.mjs
```

Beyond schema shape, the validator enforces what this skill claims to stand
for:

- an observation recorded as `exact` or `derived` carries `evidence_refs`
- declared coverage is backed by observations and by recorded samples —
  a motion coverage of 0.8 with no motion samples is rejected
- claims the contract itself marks as salient and confident appear in
  `observations`, where they can be traced
- STANDARD and FORENSIC behavioral claims satisfy the temporal and
  cross-device gates in `behavior_audits`
- **every block that asserts something carries an evidence-backed
  observation.** Describe the typography and you have to say where you saw it.
  This gate ignores confidence, salience and coverage entirely: those are
  numbers you write about your own work, and any gate that reads them can be
  satisfied by writing a smaller one

A rejection is information, not an obstacle. Either record the missing
evidence, or lower the claim to what was actually seen. Lowering a score is
not lowering a claim: `family: "Söhne"` asserts the same thing at confidence
0.55 as at 0.99. `--lenient` checks
shape only; it is for work in progress, not for shipping.

## Final response

Return a short summary containing:

- scan mode
- coverage
- strongest design characteristics
- important uncertainty
- generated artifacts

Do not claim exact interaction fidelity where evidence was unavailable.
