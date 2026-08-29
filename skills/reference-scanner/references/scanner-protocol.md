# Scanner Protocol

## Purpose

Define how a reference website must be inspected before generating STYLE_DNA.

Prioritize evidence over interpretation.

## 1. Scan preparation

Record:

- canonical URL
- scan date
- requested scan mode
- available browser capabilities
- route scope
- authentication restrictions
- locale
- cookie/banner state
- viewport matrix

Create a unique scan ID.

## 2. Capability declaration

Possible capabilities:

- dom
- computed_css
- browser_navigation
- screenshots
- viewport_resize
- pointer
- keyboard
- scroll
- screen_recording
- network_inspection
- script_inspection
- canvas_detection
- performance_observation
- temporal_sampling
- touch_emulation
- reduced_motion_emulation
- local_video_metadata
- local_video_decode
- browser_video_playback
- timestamped_frame_sampling

Never generate evidence requiring unavailable capabilities.

## 3. Scan modes

QUICK:
broad art direction.

STANDARD:
production-oriented reconstruction.

FORENSIC:
high-fidelity reconstruction of sophisticated interactive references.

## 4. Route discovery

Build route inventory.

Classify routes:

- primary
- secondary
- utility
- dynamic
- localized
- external

Group structurally equivalent routes into route families.

## 5. Salience map

Estimate perceptual importance before deep inspection.

High-salience regions receive deeper inspection.

## 6. Viewport matrix

Default FORENSIC viewports:

- 1440 × 900
- 1280 × 800
- 768 × 1024
- 390 × 844

Add intermediate widths around suspected layout transformations.

## 7. Baseline capture

Capture passive state before interaction.

For important routes capture:

- viewport screenshot
- full page when practical
- major section screenshots
- navigation
- hero
- key media
- footer

User annotations are evidence of desired emphasis. Preserve the unannotated
source separately, then record what the annotation selects, rejects or moves.

## 8. Structural inventory

Identify semantic regions without forcing conventional component models.

## 9. Typography pass

Identify representative roles:

- display
- heading
- subheading
- body
- label
- navigation
- metadata
- caption
- button/link

Prefer ratio-based relationships when exact values are not structurally
important.

## 10. Geometry pass

Measure or infer:

- gutters
- content widths
- section heights
- media widths
- aspect ratios
- grid relationships
- alignment anchors
- vertical spacing
- overlap
- negative space

Classify values:

- fixed
- fluid
- viewport-relative
- content-driven
- breakpoint-dependent

## 11. Interaction inventory

Identify elements reacting to:

- hover
- focus
- pointer-down
- click
- drag
- swipe
- filter
- fullscreen
- direct manipulation
- scroll
- keyboard
- route navigation

Cluster equivalent interaction families.

Create a device-input matrix for every high-salience family. Record which of
pointer, keyboard, touch, wheel/trackpad, drag and swipe were actually tested
at each viewport.

Create a state matrix for those same families:

- initial
- activation
- early
- middle
- settled
- reverse or closing
- responsive substitute
- reduced-motion substitute

## 12. Interaction sampling

For high-salience interactions capture:

BEFORE
ACTION
DURING when possible
AFTER
REVERSE when possible

For temporal behavior, BEFORE and AFTER alone are insufficient. Capture
timestamped EARLY, MIDDLE and LATE states, or record why temporal sampling was
unavailable.

Store the test as a `behavior_audits` entry and link its captures or existing
interaction/motion evidence through `evidence_refs`.

## 13. Scroll segmentation

Divide long pages into semantic scroll regions.

Classify region behavior as:

- static
- triggered
- sticky
- pinned
- scroll-linked
- parallax
- horizontal
- continuous

## 14. Motion sampling

Prioritize:

- high salience
- large amplitude
- scroll dependency
- navigation
- media transitions
- page transitions

Observe important motion repeatedly when possible.

Classify the activation model before describing speed:

- autonomous
- scroll-triggered
- scroll-linked
- velocity-coupled
- inertial
- state-driven
- continuous
- unknown

For moving tracks, sample idle, positive input, settled state and reverse
input. Report sample count, elapsed time, displacement, direction, velocity
range, acceleration/deceleration and loop seam when measurable.

## 15. Responsive comparison

For each region ask:

- what remains invariant?
- what scales?
- what reflows?
- what disappears?
- what changes interaction?
- what becomes touch-oriented?
- what loses motion?
- what changes cropping?

Repeat the behavior, not only the screenshot. Desktop and mobile evidence must
show the actual input used and the resulting state sequence.

## 16. Technology separation

Always distinguish:

OBSERVED BEHAVIOR

from:

IMPLEMENTATION HYPOTHESIS

## 17. Evidence linking

Every high-salience STYLE_DNA observation should reference evidence IDs.

## 18. Unknowns

Unknown is valid output.

Do not fill unknown fields merely to make JSON look complete.

## 19. Synthesis

Convert observations into reusable rules.

Prefer design relationships over literal coordinate transcripts.

## 20. Coverage scoring

Generate separate coverage scores for:

- visual
- typography
- layout
- media
- interaction
- motion
- responsive
- transition
- WebGL

## 21. Completion gate

A FORENSIC scan should not be marked complete if:

- a high-salience interaction remains untested
- mobile was not observed
- significant WebGL behavior remains unidentified
- major transitions were inaccessible
- motion claims exceed evidence
- desktop and mobile high-salience behavior were not both exercised
- a high-salience temporal behavior lacks at least five timestamped states
- a scroll-reactive threshold was not probed on both sides and in reverse
- a moving track was labeled continuous without an idle/input dependency test
- a text microinteraction was called a character change without a text probe
- a supplied video reference was abandoned after only one decode path failed
- a high-salience menu or text effect lacks a state matrix

## 22. Final artifacts

Generate:

- STYLE_DNA.json
- REFERENCE_EVIDENCE.json
- STYLE_REPORT.md
