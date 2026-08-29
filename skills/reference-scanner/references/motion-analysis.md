# Motion Analysis

Reconstruct temporal grammar while separating behavior from implementation.

## Categories

- ENTRANCE
- EXIT
- INTERACTION
- SCROLL_TRIGGERED
- SCROLL_LINKED
- CONTINUOUS
- MEDIA
- PAGE_TRANSITION
- WEBGL

## Motion descriptor

Support:

- id
- category
- target
- trigger
- initial_state
- final_state
- transform
- opacity
- clip
- mask
- filter
- media_state
- duration
- delay
- stagger
- easing_character
- scroll_relationship
- repeat
- directionality
- interruptible
- responsive_behavior
- reduced_motion_observed
- mode
- confidence
- salience
- evidence_refs
- notes

## Triggered vs linked

### Scroll-triggered

Scroll reaches a threshold and autonomous animation begins.

### Scroll-linked

Animation progress depends on scroll progress.

Never conflate them.

## Temporal sampling

When possible sample:

- initial
- early
- middle
- late
- final

For reproducible scroll-linked scenes consider normalized samples:

- 0%
- 25%
- 50%
- 75%
- 100%

High-salience temporal behavior in a FORENSIC scan requires at least five
timestamped states. Use more samples for non-linear or inertial motion.

Record actual elapsed time between samples. Tool wait duration is not a timing
measurement when browser execution or capture latency is unknown.

## Duration

Use exact duration only when measured.

Otherwise classify:

- instant
- very fast
- fast
- moderate
- slow
- very slow
- scroll-dependent
- unknown

## Easing character

Use perceptual classes when exact curves are unavailable:

- linear
- soft-ease
- strong-ease-out
- ease-in-out
- spring-like
- elastic
- overshoot
- inertial
- step
- unknown

Do not invent cubic-bezier values.

## Amplitude

Describe movement scale and store measured values when possible.

## Stagger

Classify:

- simultaneous
- sequential
- overlapping
- random
- unknown

## Text reveals

Inspect whether reveal happens by:

- whole element
- line
- word
- character

And whether behavior uses:

- translate
- clip
- mask
- opacity
- blur
- width
- rotation

Do not infer a specific library plugin.

## Scroll scenes

A scroll scene is a coordinated region with multiple actors.

A scene may contain:

- sticky/pinned media
- text reveals
- image scaling
- background transitions
- scene exits

Store scene-level relationship rather than only disconnected tweens.

## Pinning

Differentiate CSS sticky from animation-controlled pinning.

## Parallax

Require relative movement between visual layers.

## Continuous motion

Examples:

- marquee
- ticker
- rotating object
- particles
- ambient video
- floating elements

Do not classify a moving strip as continuous from one displacement. Test:

1. idle with no user input
2. downward/forward input
3. settled state
4. upward/reverse input
5. loop boundary when reachable

Then classify its activation model as autonomous, scroll-triggered,
scroll-linked, velocity-coupled, inertial, state-driven, continuous or unknown.

For measurable translation record:

- sample count and timestamps
- displacement and axis
- idle, mean, minimum and maximum velocity
- acceleration and deceleration character
- direction under forward and reverse input
- loop distance, period and visible seam
- whether viewport visibility, hover, focus or reduced motion changes it

A transient peak must not be reported as steady speed. A single average must
not replace the velocity profile when the behavior accelerates or decelerates.

## Scroll-reactive state changes

Threshold-driven elements require boundary probing: last state below the
threshold, first state above it, settled state, and reverse crossing. Separate
scroll position from scroll direction and velocity. Record whether transitions
are discrete, scrubbed or inertial.

## Media transitions

Inspect:

- image-to-image
- poster-to-video
- mask
- wipe
- crossfade
- zoom
- displacement
- canvas transitions

## Page transitions

Inspect:

- outgoing page
- overlay
- shared/persistent element
- incoming page
- background
- navigation
- scroll restoration

Record transition ownership when observable:

- outgoing-page
- incoming-page
- transition-layer
- persistent
- shared
- unknown

## Motion hierarchy

Prioritize high-level motion before microanimation.

## Responsive motion

Possible mobile transformations:

- same
- reduced amplitude
- shorter
- removed
- triggered instead of linked
- pin removed
- parallax removed
- WebGL disabled

## Reduced motion

If testable, observe `prefers-reduced-motion`.

Do not infer support from visual quality.

## Synthesis

Describe behavior rather than library choice.
