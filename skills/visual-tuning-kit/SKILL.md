---
name: visual-tuning-kit
description: Adds a bounded, development-only visual tuning layer to an Astro site so users can adjust declared typography, spacing, grid, alignment, content, section order, and behavior variants without becoming a free-form page builder. Produces validated tuning schema, approved values, and an auditable changeset. Use after an initial Astro implementation exists. Not for reference scanning, initial site generation, production CMS editing, or arbitrary drag-and-drop layout.
license: MIT
metadata:
  version: "0.6.0"
---

# Visual Tuning Kit

Turn a designed Astro implementation into a bounded review surface.

The site author decides what can be tuned. The user explores those controls,
saves a proposal, and explicitly approves values that the source project can
consume. The kit is not a visual page builder.

## Required inputs

1. An existing Astro project.
2. Its approved `SITE_BLUEPRINT.json`.
3. `TUNING_SCHEMA.json` following `schemas/tuning-schema.schema.json`.
4. `TUNING_VALUES.json` following `schemas/tuning-values.schema.json`.

Read `references/editor-boundary.md` before deciding which controls to expose.
Use `assets/TUNING_SCHEMA.example.json` as the structural example.
Use `assets/TUNING_VALUES.example.json` as the draft-values example.

## Safe editing model

Expose only deliberate controls:

- numerical design tokens through CSS custom properties;
- enumerated variants;
- boolean inspection or behavior switches;
- text and line breaks mapped to a content path;
- images chosen from a declared folder inside `public/`;
- section order chosen from a fixed set;
- navigation items with bounded labels, validated destinations, visibility and order;
- grid span, alignment and bounded offsets represented as tokens or enums.

Do not expose arbitrary CSS, raw HTML, executable JavaScript, unrestricted
selectors, free absolute positioning, or unconstrained drag-and-drop.
Navigation controls must reject unknown protocols and absolute URLs outside
their declared `allowed_hosts`.

## Workflow

1. Derive an initial numerical-control draft from CSS custom properties when useful:

```bash
node scripts/derive-schema.mjs --project /path/to/astro-project \
  --out TUNING_SCHEMA.json --values-out TUNING_VALUES.json
```

   Generation never approves values. It stops on contradictory defaults unless
   `--allow-conflicts` is explicitly used for diagnosis. Review zero-based
   ranges, labels, control membership and `preview_id`; then derive remaining
   text, image, order and enumerated controls from the approved blueprint.
2. Give every control a reason, safe range or option set, and production target.
3. Validate schema and values:

```bash
node scripts/validate-tuning.mjs \
  --schema TUNING_SCHEMA.json \
  --values TUNING_VALUES.json
```

4. Scaffold the local tuner:

```bash
node scripts/scaffold-tuner.mjs --project /path/to/astro-project \
  --schema TUNING_SCHEMA.json --values TUNING_VALUES.json
```

5. Add `visualTunerDev()` from `scripts/visual-tuner-dev.mjs` to
   `vite.plugins` in `astro.config.mjs`, import
   `assets/VisualTunerLoader.astro` into the base layout and render it once.
   The plugin has `apply: "serve"`; the loader uses `import.meta.env.DEV` to
   load `assets/visual-tuner-client.js`. Both are absent from production.
6. Bind production content with `assets/tuning-runtime.mjs`; generate production
   CSS custom properties only from approved values with:

```bash
node scripts/build-approved-css.mjs --schema TUNING_SCHEMA.json \
  --values TUNING_VALUES.json --out src/styles/tuning-approved.css
```

   Audit how much visible page content is bound to the manifest with:

```bash
node scripts/map-content.mjs --manifest CONTENT_MANIFEST.json \
  --url http://localhost:4321 --page home --out qa/CONTENT_MAP.json
```

   Add `data-content-path` when an exact binding is known. The audit prefers
   that attribute, then stable `data-rta-id`, and only then exact rendered text.
   Missing and ambiguous values remain report findings; the tool never writes
   content back or guesses a destination.
   It uses the project's Playwright installation. When Playwright is already
   installed in a separate QA skill, pass its directory with
   `--playwright-root /path/to/that/skill` instead of duplicating it.

7. Open the local site with `?tune=1` and experiment. Unapproved experiments
   stay in local storage.
   On desktop, drag the tuner by its header to uncover the page beneath it. Its
   viewport-bounded position is remembered locally; Reset also restores the
   default panel position. The panel remains fixed on narrow mobile viewports.
   Elements with `data-tune-id` become contextual targets: click one to isolate
   its control, and double-click declared text to edit it inline. Image controls
   list only files from their declared `public/` folder. Section order changes
   only direct children inside the declared container id. Control groups are
   collapsible and the relevant group opens automatically after contextual
   selection so larger schemas remain usable.
   Give each declared preview target both its `data-tune-id` and a stable
   semantic `data-rta-id`. The latter survives compilation for later review
   packages; it does not make compiled HTML the source of truth. Multiple
   related controls may share one `preview_id`, allowing a click on a title or
   image to reveal its content, scale, measure and bounded-position controls
   together.
8. Saving creates a complete validated `TUNING_VALUES.json` and an auditable
   `TUNING_CHANGESET.json`.
9. Once a person approves the values, fold the content controls back into the
   content contract:

```bash
node scripts/apply-content.mjs --schema TUNING_SCHEMA.json   --values TUNING_VALUES.json --content CONTENT_MANIFEST.json
```

   Controls with `target.css_variable` reach production through the CSS above.
   Controls with `target.content_path` — `text`, `text-lines`, `image`,
   `section-order` and `navigation` — reach it only through this step. Without
   it an approved text edit is lost on the next build, which is the whole reason
   daily edits feel more expensive than they should.

   It refuses draft values, writes nothing at all if any path fails to resolve,
   and is safe to run twice. Add `--dry-run` to see the changes first. Rebuild
   the site afterwards.
10. Production consumes approved values but never ships the tuner panel or save endpoint.

Run `scripts/test-runtime.mjs` when changing the development plugin, client or
production helpers.

## Approval and source of truth

The content contract stays the source of truth. The panel proposes; once a
person approves, `apply-content.mjs` writes the change back into
`CONTENT_MANIFEST.json` and the site is rebuilt from there. Values that only
live in the tuning file are a second copy of the content waiting to disagree
with the first.

`TUNING_VALUES.json` is data, not an invisible code mutation. The project must
bind CSS controls through custom properties and content controls through stable
ids or content paths. Approved values may be folded back into source later, but
that is a separate reviewed change.

The agent must not mark values approved on the user's behalf.

## Completion gate

- Every value matches a declared control.
- Every control has a bounded target and rationale.
- Text controls map to known content paths.
- Every declared preview target has a unique, stable `data-rta-id`.
- Image controls map to known content paths and a folder contained by `public/`.
- Order controls list every allowed section exactly once.
- The tuner and save endpoint are absent from production output.
- Desktop and mobile values are explicit where behavior differs.
- The user approved the final values.
