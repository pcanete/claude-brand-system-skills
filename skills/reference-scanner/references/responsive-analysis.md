# Responsive Analysis

Reconstruct transformation logic, not merely breakpoints.

## Core model

Classify behavior as:

- INVARIANT
- SCALE
- REFLOW
- REORDER
- REPLACE
- OMIT
- RECROP
- INTERACTION_SUBSTITUTION
- MOTION_REDUCTION
- LAYOUT_MODE_CHANGE

## Invariant

Characteristics preserved across viewports.

Examples:

- dominant headline
- brand contrast
- media prominence
- asymmetric rhythm
- navigation identity

## Scale

Same structure, different magnitude.

Possible targets:

- typography
- spacing
- gutters
- media
- icons
- controls

Determine whether scaling is continuous, stepped, or unknown.

## Reflow

Semantic order remains while spatial distribution changes.

## Reorder

Visual or DOM reading order changes.

## Replace

Desktop component becomes another interaction pattern.

## Omit

Determine whether omitted elements are:

- decorative
- performance-related
- interaction-related
- content-related

## Recrop

Record:

- aspect ratio
- object position
- focal point
- container size

## Interaction substitution

Desktop hover may become:

- tap
- swipe
- persistent state
- no preview

Do not transfer hover-only information to touch devices.

## Motion reduction

Possible changes:

- lower amplitude
- shorter duration
- removed parallax
- removed pinning
- triggered instead of scroll-linked
- disabled WebGL

## Breakpoint discovery

Do not infer framework defaults.

Resize around structural changes and record observed intervals.

## Fluid behavior

Record relationships rather than assumed CSS implementation.

## Typography

Compare:

- scale
- line breaks
- measure
- line height
- tracking
- alignment
- visual mass

Do not automatically shrink oversized mobile typography when the reference
intentionally preserves it.

## Navigation

Inspect desktop and mobile separately.

Repeat open, close, nested navigation, outside dismissal, escape/back behavior,
scroll lock and focus/tap behavior when available. A mobile menu is not merely
the desktop menu at a narrower width.

## Layout rhythm

Mobile may compress or intentionally preserve extreme whitespace.

## Media

Compare:

- width
- aspect ratio
- crop
- alignment
- full bleed
- video behavior
- interaction

## Long scroll experiences

Pinned/horizontal desktop experiences may become:

- linear sequences
- swipe galleries
- static sections
- reduced pin duration

## Canvas / WebGL

Inspect mobile separately.

Possible outcomes:

- same
- lower quality
- different scene
- static fallback
- video fallback
- disabled

## Touch ergonomics

Record whether targets become:

- larger
- separated
- persistent
- simplified

## Cross-device behavior matrix

For every high-salience interactive family, record:

- desktop viewport and actual pointer/keyboard input tested
- mobile viewport and actual tap/swipe/drag input tested
- invariant states and responsive substitutions
- motion removed, reduced or replaced
- controls or information that only existed on hover
- orientation-specific behavior when salient

Viewport resizing alone does not prove mobile interaction. If touch emulation
or a mobile browser is unavailable, record the limitation and lower confidence.

## Synthesis

Describe responsive principles rather than implementation directives such as
specific flex rules.
