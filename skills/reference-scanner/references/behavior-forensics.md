# Behavior Forensics

Use this protocol for STANDARD and FORENSIC scans when a site contains
important interaction, motion or responsive behavior.

## 1. Build a behavior inventory

List high-salience targets before testing: navigation, header, primary CTAs,
text effects, carousels, marquees, filters, media controls, sticky scenes,
forms, cursors and page transitions.

Group repeated targets into families, but test a representative instance on
desktop and mobile when both exist.

## 2. Declare device and input context

Each audit records:

- route and viewport ID
- device class and orientation
- available inputs actually used
- target and semantic role
- initial scroll position and visibility
- reduced-motion state when testable

Do not label a resized desktop browser as a touch test unless touch input was
actually emulated or exercised.

## 3. Capture a temporal state sequence

Use timestamped samples. For high-salience FORENSIC behavior capture at least:

- before
- early
- middle
- late
- after
- reverse when the behavior is reversible

Record text content, geometry, computed visual state and media state when each
is relevant. Sample inside the page clock when possible so automation latency
does not contaminate timing.

## 4. Apply controlled inputs

Change one variable at a time:

- hover enter and leave
- focus and blur
- pointer down and release
- click/tap open and close
- drag/swipe forward and reverse
- scroll down and up
- threshold boundary before and after
- idle and post-input settling

Reload or restore baseline state between tests when earlier input can affect
the result.

## 5. Classify the behavior

Use observed evidence to classify activation:

- autonomous
- scroll-triggered
- scroll-linked
- velocity-coupled
- inertial
- state-driven
- continuous
- unknown

Record a technology hypothesis separately.

## 6. Specialized probes

### Header probe

Find the activation boundary with coarse scroll steps, then narrow steps.
Capture just below, just above, settled and reverse states. Continue through
contrasting sections to test context-aware color modes. Record visibility,
position, height, background, foreground, border, logo/nav/CTA variants,
duration and easing.

### Moving-track probe

Observe at idle, apply forward input, wait for settling, apply reverse input
and inspect a loop boundary. Use repeated page-timestamped samples to calculate
displacement and a velocity profile. Distinguish steady speed from transient
peak and scroll catch-up.

Set `moving_track: true` only for a continuous or shared track whose velocity
profile is itself part of the behavior, such as a marquee, ticker or
scroll-coupled gallery. A clipped reveal, color progression or finite card
interpolation may be scroll-linked without being a moving track; audit its
state progression and reversal instead of inventing a velocity profile.

### Text-effect probe

Capture actual text at multiple frames and compare it with per-character
geometry and sibling layers. State explicitly whether characters mutate or the
appearance comes from translation, clipping, layering, glyph/font changes,
opacity/filter or an unknown mechanism.

### Stateful-component probe

Record the complete state graph, including opening, open, closing, closed,
selection changes, interruption, reversal, keyboard behavior and touch
equivalent.

## 7. Compare desktop and mobile

Re-run high-salience behavior with native inputs for each device class. Record
same, reduced, removed, replaced and touch-substituted behavior. Treat missing
mobile evidence as a limitation, not as proof of equivalence.

Do not stop at whether the same text, image or card remains visible. Compare:

- activation model and input dependency
- movement axis, direction and amplitude
- independent actor motion versus a shared moving track
- reveal mechanism, clipping and opacity
- sequencing, staggering and reversibility
- normal-flow, sticky, pinned and absolute positioning roles

If the content is preserved but any of these mechanics changes materially,
classify and document it as a responsive behavior replacement. For example,
independent vertical parallax becoming one horizontal image track is a
replacement, not merely motion reduction.

## 8. Evidence contract

Store each test in `REFERENCE_EVIDENCE.behavior_audits`. Link captures and
existing interaction or motion evidence with `evidence_refs`. STYLE_DNA keeps
the synthesized reusable rule and cites the underlying evidence IDs.

Never promote a transient measurement, a single frame or an implementation
hypothesis into an exact behavioral rule.
