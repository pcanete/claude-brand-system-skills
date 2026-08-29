# Motion System

## Principle

Motion must reproduce reference behavior.

Do not add motion merely to make a site feel more premium.

## Categories

- ENTRANCE
- INTERACTION
- SCROLL_TRIGGERED
- SCROLL_LINKED
- SCROLL_SCENE
- CONTINUOUS
- TRANSITION
- MEDIA
- WEBGL

## Minimum descriptor

Each meaningful sequence should define:

- target
- trigger
- initial state
- final state
- duration or duration class
- ease or ease character
- delay
- stagger
- scroll relationship
- repeat
- responsive behavior
- reduced-motion behavior
- confidence

## CSS vs GSAP

Use CSS for:

- basic hover transitions
- simple opacity
- simple transform state changes
- scroll-linked effects that are allowed to fail silently, via
  `animation-timeline`

Use GSAP for:

- choreography
- timelines
- scroll-linked progression
- pinning
- complex stagger
- dynamic values
- interruptible sequences

Since GSAP 3.13 the whole toolset, including formerly Club-only plugins such as
ScrollSmoother, is free for commercial use. Availability is no longer a reason
to settle for a weaker implementation — and not a reason to reach for GSAP
where CSS already reproduces the behavior.

## Scroll

Differentiate triggered from linked.

Do not infer scrub merely because animation happens during scrolling.

Implementation — scrub, pinning, frame sequences, smooth scroll, lifecycle and
responsive rebuilding — is in `references/scroll-scenes.md`. Read it before
building any scroll-linked behavior.

## Timing

If timing is not directly observed, mark it inferred.

Prefer consistency with overall motion language over arbitrary precision.

## Performance

Prefer transform and opacity.

Avoid unnecessary layout-triggering animation.

## Reduced motion

Provide meaningful static or low-motion alternatives.

Do not simply set every duration to zero if that destroys hierarchy.
