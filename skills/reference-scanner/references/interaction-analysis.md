# Interaction Analysis

Interaction analysis reconstructs behavioral grammar.

## Categories

- NAVIGATION
- HOVER
- FOCUS
- PRESS
- CLICK
- TOGGLE
- DRAG
- SWIPE
- CURSOR
- MEDIA
- FORM
- FILTERING
- FULLSCREEN_MEDIA
- DIRECT_MANIPULATION
- ROUTE_TRANSITION
- SCROLL_REACTIVE

## Interaction descriptor

A meaningful interaction should support:

- id
- target
- semantic_role
- trigger
- initial_state
- active_state
- final_state
- visual_changes
- layout_changes
- media_changes
- cursor_changes
- motion_ref
- reversible
- interruptible
- touch_equivalent
- keyboard_equivalent
- mode
- confidence
- salience
- evidence_refs
- notes

Also record viewport, device/input context and timestamped states in a
`behavior_audits` entry when the behavior unfolds over time.

## Required state matrix

For each high-salience interaction family, record:

| State | Input/time | Text | Geometry | Color/surface | Motion/media |
| --- | --- | --- | --- | --- | --- |
| Initial | none | observed | observed | observed | observed |
| Activation | pointer/click/key/scroll | observed | observed | observed | observed |
| Early | timestamp | observed | observed | observed | observed |
| Middle | timestamp | observed | observed | observed | observed |
| Settled | timestamp | observed | observed | observed | observed |
| Reverse/close | input + timestamp | observed | observed | observed | observed |

Use `unknown` when a cell was not observed. Do not collapse this matrix into
before/after screenshots for menus, letter effects, moving tracks or other
time-dependent behavior.

## Hover analysis

Inspect independently:

- text
- color
- opacity
- underline
- border
- background
- scale
- rotation
- position
- media
- mask
- clip-path
- cursor
- siblings
- parents

Do not inspect only the hovered element.

## Typographic microinteractions

When letters appear to change, test the text content and the rendered motion
separately. Classify the effect as one or more of:

- character-content mutation
- character translation
- clip or mask reveal
- duplicate-layer swap
- glyph substitution
- variable-font or font-feature change
- opacity/filter change
- no change observed
- unknown

Capture initial text, early/middle/final text, reverse text, per-character
geometry when available, and affected sibling layers. A split DOM span is not
evidence that the characters themselves mutate.

## Hover family detection

Synthesize repeated behavior into interaction families.

## Focus

Do not assume focus equals hover.

Reference fidelity never overrides fundamental keyboard accessibility.

## Press / active

Inspect pointer-down only when visually meaningful.

## Menus

Record:

- closed
- opening
- open
- closing
- route-transitioning when relevant
- overlay behavior
- scroll locking
- backdrop
- focus behavior
- content reveal
- close behavior
- interruption behavior

Test desktop and mobile menu implementations independently, including scroll
lock, tap targets, nested navigation, back/close behavior and focus restoration
when capabilities permit.

## Scroll-reactive headers

Record top state, the last state below the trigger, the first state above it,
settled state and reverse state. Measure height, position, background,
foreground, border, logo/nav/CTA variants and transition timing. Continue into
contrasting page sections to determine whether the header reacts to scroll
distance, section context, direction, velocity or a combination.

## Cursor systems

Record:

- native/custom
- shape
- size
- color
- blend mode
- label
- media preview
- lag/spring
- scale changes
- context changes
- touch fallback

## Drag and direct manipulation

Record:

- semantic purpose
- axis
- constraints
- momentum
- snap
- resistance
- cursor
- touch behavior
- spatial response
- edge behavior

Do not infer rendering technology from drag behavior.

## Filtering

Record:

- available options
- open/closed state
- single/multi-select
- collection changes
- animated reflow
- URL persistence
- reset behavior
- responsive behavior

Unknown values remain unknown.

## Fullscreen media

Record:

- entry action
- transition
- navigation inside
- close action
- keyboard behavior
- touch behavior
- background treatment
- media persistence

## Media interaction

Inspect:

- hover autoplay
- click-to-play
- mute controls
- fullscreen
- poster transition
- pause behavior
- scrub behavior
- looping
- reveal masks

## Stateful components

For accordions, tabs, filters, menus, carousels and modals, record the complete
state model.

## Reversibility

Record whether behavior reverses when user intent ends.

## Interruption

Determine whether rapid new input:

- queues
- interrupts
- snaps
- reverses
- is unknown

## Confidence

High confidence requires direct observation.

## Salience

Increase salience when interaction:

- changes large visual regions
- repeats
- defines navigation
- changes media
- changes cursor
- drives storytelling
- defines the site's personality

## Synthesis

STYLE_DNA should describe interaction grammar while REFERENCE_EVIDENCE stores
specific captures and state observations.
