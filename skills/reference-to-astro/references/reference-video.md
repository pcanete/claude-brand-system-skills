# Reference Video Consumption

Use when a video or screen recording defines desired motion, pacing or media
treatment.

## Establish readable evidence

Prefer scanner artifacts when they include metadata, sampled frames and a
timeline. If only the raw video is available:

1. obtain duration and dimensions with an available media tool;
2. extract timestamped frames when decoding is available;
3. otherwise serve the file locally and use browser playback plus timestamped
   screenshots;
4. ask for another format only after media decoding and browser playback fail.

Record which path succeeded and which temporal properties remain uncertain.

## Translate grammar, not footage

Identify:

- scene order and whether order is deterministic or random
- hold and transition duration ranges
- speed changes and acceleration character
- movement axis, zoom, scale and rotation
- blur, smear, ghosting and echo layers
- cut, crossfade, mask, wipe or displacement
- subject/focal-point protection
- final state and loop behavior
- responsive and reduced-motion interpretation

Do not replace a zoom/blur montage with a generic slideshow, carousel or
marquee merely because both change images.

## Choose implementation deliberately

Map the observed grammar to the lightest sufficient implementation:

- CSS for simple deterministic transforms and filters
- vanilla JavaScript for random ordering, timing ranges and interruption
- GSAP for coordinated timelines or non-trivial easing
- pre-rendered video when real-time reconstruction adds no value
- Canvas/WebGL only when DOM/CSS cannot reproduce the evidenced effect

## Temporal QA

Compare implementation and reference at:

- initial state
- representative hold
- transition start
- transition peak
- transition settle
- speed/direction change
- final or loop state

Check composition during unfavorable frames, not only the best-looking still.
If timing is inferred, report a range or perceptual class instead of invented
precision.
