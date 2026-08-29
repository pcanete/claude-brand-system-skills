# Media Strategy

Honor CONTENT_MANIFEST asset identity while reproducing STYLE_DNA media
relationships.

Do not substitute reference-site proprietary media for supplied project media.

## Composition

Reproduce, from the evidence:

- aspect ratio
- crop and focal point
- object position
- full-bleed behavior
- posters and loading states
- media sequences and interactive scenes
- fullscreen behavior

Supplied media rarely matches the reference's proportions. Adapt the crop to
protect the focal point; do not distort the image to force identical geometry.
Record the choice as a fidelity exception when it visibly changes a
composition.

## Images

- Serve responsive sources sized to the actual rendered box at each breakpoint,
  not to the original upload.
- Modern formats first, with a fallback the browser can choose from.
- **Always reserve the box.** Set `width`/`height` or an `aspect-ratio` so the
  layout does not shift when the image resolves. On a reference built around
  precise vertical rhythm, layout shift destroys the thing being reproduced.
- The largest above-the-fold image is the LCP element: load it eagerly, mark it
  `fetchpriority="high"`, and never lazy-load it.
- Everything below the fold: `loading="lazy"`, `decoding="async"`.
- Art direction — a different crop rather than a different size at a breakpoint
  — needs `<picture>` with media conditions, not CSS scaling.

## Video

When video is evidence for an effect rather than a production asset, read
`reference-video.md` before choosing an implementation.

- Autoplay only survives when the video is `muted` and `playsinline`. A
  background video that requires a click is not the observed behavior.
- Always supply a `poster` matching the first frame, so the section is composed
  before playback begins.
- `preload="metadata"` for anything not immediately visible. A hero video with
  `preload="auto"` competes with the LCP image for bandwidth.
- Pause playback when the element leaves the viewport and on
  `visibilitychange`. Off-screen decoding is a common source of scroll jank and
  battery drain.
- Under reduced motion, show the poster instead of autoplaying.
- Long ambient video is a bandwidth decision, not only a visual one. Note the
  weight when the reference's clip is heavy and the supplied one is heavier.

For a video whose progress is bound to scroll rather than to time, do not use a
video element at all — see `references/scroll-scenes.md`.

## Fonts

Typography is where reference fidelity is judged first, and where default
loading behavior undoes it.

- Preload the one or two faces used above the fold. Preloading the whole family
  delays first paint.
- `font-display: swap` keeps text readable while loading; combined with a
  fallback whose metrics are adjusted (`size-adjust`, `ascent-override`) it
  avoids the reflow that shifts an entire hero when the real face arrives.
- Subset when the reference uses a display face for a handful of words.
- Variable fonts replace several static weights with one file. Check what the
  reference actually uses before assuming either.
- Wait for `document.fonts.ready` before measuring anything for animation. Text
  measured in the fallback face produces scroll ranges wrong by the difference
  between the two.

## Loading order

Decide, deliberately, what the visitor sees first:

1. the LCP element and the fonts it needs
2. above-the-fold media
3. everything below the fold
4. sequences, WebGL payloads and ambient media

A reference with a loading screen is making a statement about pacing. A
reconstruction with an accidental loading screen is making an excuse.
