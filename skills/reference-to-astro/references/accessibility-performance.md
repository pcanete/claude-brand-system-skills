# Accessibility and Performance

Reference fidelity does not override fundamental usability.

Declared accessibility claims in a reference are evidence, not proof of actual
conformance. Neither is the absence of a feature evidence that it should be
absent: a reference with no reduced-motion behavior is a reference with a
defect, not a design decision to reproduce.

Check:

- semantic structure
- keyboard navigation
- focus visibility
- touch target usability
- alt text
- form labels
- contrast
- reduced motion
- media fallbacks
- scroll locking
- route transition focus behavior

## Reduced motion

Never implement it as "all durations to zero". That empties sections whose
content only exists inside the animation, which is worse than the motion.

Each motion category has an honest reduced state:

| Motion | Reduced state |
| --- | --- |
| Entrance reveal | Content visible from the start |
| Scrubbed sequence | A representative frame, usually the last |
| Pinned scene | Unpinned, laid out as stacked sections |
| Parallax, drift, ambient loop | Held at rest |
| Page transition | Instant swap |
| Autoplaying video | Poster, with playback available on demand |

Read the preference at runtime and react to changes, not only at load.

## Interaction the reference forgot

Highly art-directed references routinely ship interaction that works with a
mouse and nowhere else. Reproducing the intent means supplying what is missing:

- Anything reachable by hover needs a focus state and a keyboard path. A
  custom cursor is decoration; the underlying control still needs to be
  operable.
- An overlay menu traps focus while open, returns it to the trigger on close,
  and closes on `Escape`.
- Scroll locking must not scroll the page to the top on open or restore.
- Drag, swipe and direct manipulation need a discrete equivalent — buttons,
  arrow keys, or a fallback control.
- A carousel or gallery announces position and state; visual-only indication
  leaves it unusable without sight.

## Performance as a fidelity constraint

Performance priorities:

- static-first Astro rendering
- minimal hydration
- lazy below-the-fold interaction
- optimized imagery
- sensible video loading
- transform/opacity animation
- capability-based WebGL
- avoid unnecessary client frameworks

Three failure modes matter more than a score:

- **Layout shift** breaks the exact thing being reconstructed. Reserve space
  for every image, video, embed and late-loading font.
- **Main-thread blocking** turns weighted scroll into stuttering scroll. Animate
  transform and opacity; keep per-frame work off layout-triggering properties.
- **Input latency** makes a premium reference feel cheap. Hydration and heavy
  listeners are the usual cause.

When a reference's own behavior cannot be reproduced within these limits on a
mid-range phone, that is a fidelity exception to document — not a reason to
ship something that stutters.
