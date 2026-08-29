# Stable review anchors

Compiled HTML loses Astro component ownership and content-manifest context.
Stable anchors preserve enough identity for a visual review tool to describe a
proposal that can be translated back into source.

## Contract

- Add `data-rta-id` to user-reviewable content and meaningful structural
  regions, not every decorative wrapper.
- Use a unique semantic path such as `home.hero.title`,
  `home.faq.items.2.question`, or `about.team.grid`.
- Prefer durable content ids. When a contract has only ordered array items, a
  deterministic content-path index is acceptable until the content gains ids.
- Keep the value stable across builds. Never use CSS hashes, generated class
  names, timestamps, random ids, or measurements.
- A tuning target may also carry `data-tune-id`; the two attributes have
  different jobs. `data-tune-id` connects a bounded control, while
  `data-rta-id` identifies the compiled element for review.

## Revision boundary

An external HTML editor may alter a copy of the compiled page, but its export
is review evidence rather than Astro source. Preserve original and edited HTML,
editor CSS, a structural changeset keyed by `data-rta-id`, and desktop, tablet,
and mobile captures. Translate approved changes into components, content,
tokens, and the blueprint, then rebuild and re-run QA.

Do not infer component changes from unanchored DOM diffs when an anchor could
have been authored during the structural build.
