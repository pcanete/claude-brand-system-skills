---
name: visual-tuning-kit
description: Adds a bounded, development-only visual tuning layer to an Astro site so users can adjust declared typography, spacing, grid, alignment, content, section order, and behavior variants without becoming a free-form page builder. Produces validated tuning schema, approved values, and an auditable changeset. Use after an initial Astro implementation exists. Not for reference scanning, initial site generation, production CMS editing, or arbitrary drag-and-drop layout.
license: MIT
metadata:
  version: "0.4.0"
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
- grid span, alignment and bounded offsets represented as tokens or enums.

Do not expose arbitrary CSS, raw HTML, executable JavaScript, unrestricted
selectors, free absolute positioning, or unconstrained drag-and-drop.

## Deriving the schema instead of writing it

Declaring thirty controls by hand for each project is the work that keeps this
kit from existing on the next site. The code already says where the adjustment
points are: every `var(--name, value)` is a variable the author decided to leave
adjustable, with its default beside it. So is the same pattern written from
JavaScript — a helper reading the variable with a fallback, which is how the
values that scripts animate get declared.

```bash
node scripts/derive-schema.mjs --project .   --out TUNING_SCHEMA.json --values-out TUNING_VALUES.json
```

The range comes from the value the project chose, never from a table: a ratio
between 0 and 1 is clamped to 0–1, an angle opens symmetrically around zero, a
length opens both ways. Each control carries a `rationale` naming the file it
came from, so a reviewer can check it rather than trust it.

Values are emitted as a **draft**, unsigned. Approving is the user's act.

It is a starting point, not the final contract. The generator proposes
everything the project parameterised; whatever does not deserve a slider gets
removed by hand, and text, image and section-order controls are added on top —
those cannot be derived from CSS variables.

If the generator misses something you want to tune, the answer is not to add it
to the contract: it is to parameterise it in the code. A control pointing at a
variable nobody reads does nothing.

## Mapping content to the page

Text controls need a `content_path`, and knowing which element holds which
field usually means annotating every component.

```bash
node scripts/map-content.mjs --manifest CONTENT_MANIFEST.json   --url http://localhost:4321
```

The manifest text is its own signal. A field appearing exactly once on the page
is linked; one appearing twice or not at all is reported and **not** offered for
editing, because guessing which one it was would write into the contract
something nobody asked for. For those, a component can declare
`data-content-key`, which takes precedence.

The report is worth reading on its own: it measures how much of the page
actually comes from the manifest. A declared field that never appears is
hardcoded, stale, or its section does not render.

## Workflow

1. Derive controls with `scripts/derive-schema.mjs`, then review them against
   the implementation and approved blueprint.
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

7. Open the local site with `?tune=1` and experiment. Unapproved experiments
   stay in local storage.
   Elements with `data-tune-id` become contextual targets: click one to isolate
   its control, and double-click declared text to edit it inline. Image controls
   list only files from their declared `public/` folder. Section order changes
   only direct children inside the declared container id.
8. Saving creates a complete validated `TUNING_VALUES.json` and an auditable
   `TUNING_CHANGESET.json`.
9. Once a person approves the values, fold the content controls back into the
   content contract:

```bash
node scripts/apply-content.mjs --schema TUNING_SCHEMA.json   --values TUNING_VALUES.json --content CONTENT_MANIFEST.json
```

   Controls with `target.css_variable` reach production through the CSS above.
   Controls with `target.content_path` — `text`, `text-lines`, `image` and
   `section-order` — reach it only through this step. Without it an approved
   text edit is lost on the next build, which is the whole reason daily edits
   feel more expensive than they should.

   It refuses draft values, writes nothing at all if any path fails to resolve,
   and is safe to run twice. Add `--dry-run` to see the changes first.
   Rebuild the site afterwards.
10. Production consumes approved values but never ships the tuner panel or save endpoint.

Run `scripts/test-runtime.mjs` when changing the development plugin, client or
production helpers.

## Approval and source of truth

`TUNING_VALUES.json` is data, not an invisible code mutation. The project must
bind CSS controls through custom properties and content controls through stable
ids or content paths.

The content contract stays the source of truth. The panel proposes; once a
person approves, `apply-content.mjs` writes the change back into
`CONTENT_MANIFEST.json` and the site is rebuilt from there. Values that only
live in the tuning file are a second copy of the content waiting to disagree
with the first.

The agent must not mark values approved on the user's behalf.

## Completion gate

- Every value matches a declared control.
- Every control has a bounded target and rationale.
- Text controls map to known content paths.
- Image controls map to known content paths and a folder contained by `public/`.
- Order controls list every allowed section exactly once.
- The tuner and save endpoint are absent from production output.
- Desktop and mobile values are explicit where behavior differs.
- The user approved the final values.
