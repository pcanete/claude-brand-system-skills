# Video Reference Analysis

Use this protocol when the user supplies a video, screen recording or motion
reference. A video is temporal evidence: a poster frame alone does not explain
its behavior.

## 1. Preserve the source

Record:

- file or URL identity
- duration
- width, height and orientation
- frame rate and codec when available
- whether audio is relevant
- whether the clip is a site recording, edited montage or conceptual reference

Do not treat an edited montage as proof that a website uses the same rendering
technology. Extract motion grammar separately from implementation hypotheses.

## 2. Decoder fallback ladder

Try in this order:

1. media metadata and frame extraction with an available decoder such as
   ffprobe/ffmpeg, MediaInfo, AVFoundation or an equivalent;
2. browser playback with a local HTTP page when the browser supports the codec;
3. timestamped screenshots during real playback;
4. ask the user for a different format or exported frames only after the media
   decoder and browser paths both fail.

Record which path succeeded. Do not call a video unreadable because the first
tool is missing.

## 3. Temporal sampling

Capture:

- opening state
- representative holds
- the beginning, middle and end of important transitions
- direction or speed changes
- final state

Use both evenly distributed samples and scene-boundary samples. Sparse frames
can reveal composition but cannot establish duration, easing or velocity.
Measure elapsed media time rather than tool wait duration.

## 4. Analyze the visible grammar

For every segment inspect:

- subject and focal point
- crop and aspect-ratio treatment
- simulated camera direction
- translation, scale and rotation
- zoom or push/pull
- directional, radial or motion blur
- ghosting, echo layers or multiple exposure
- masks, wipes, crossfades and cuts
- sharp/blurred dwell pattern
- hold duration and transition duration
- acceleration, deceleration and rhythm
- deterministic, alternating or apparently random sequencing
- text overlays and their timing
- loop seam and final card

Separate actual subject motion from motion applied to a still image.

## 5. Synthesis

STYLE_REPORT must include a video timeline table:

| Time range | Visual state | Transition | Speed/rhythm | Confidence |
| --- | --- | --- | --- | --- |

Store sampled frames as captures in REFERENCE_EVIDENCE and link temporal tests
through `behavior_audits`. STYLE_DNA should describe reusable motion rules:
activation, sequence, amplitude, timing class, direction, blur/echo behavior,
randomness, responsive behavior and reduced-motion fallback.

## 6. Evidence boundaries

- A frame proves appearance at that instant, not the path taken to it.
- Two frames do not prove easing.
- An edited cut does not prove a DOM or canvas transition.
- Apparent randomness requires repeated observation; otherwise mark it inferred.
- If audio affects cuts or rhythm, state whether audio was inspected.
