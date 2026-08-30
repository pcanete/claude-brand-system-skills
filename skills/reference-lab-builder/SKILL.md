---
name: reference-lab-builder
description: Turns evidence-backed STYLE_DNA and REFERENCE_EVIDENCE into a neutral interactive reference lab where typography, components, responsive states, motion, and behaviors can be inspected and approved before target content is applied. Use after reference-scanner and before SITE_BLUEPRINT. Not for scanning the source site, reproducing its content or brand, building the final customer website, or packaging WordPress.
license: MIT
metadata:
  version: "0.3.0"
---

# Reference Lab Builder

Build an invented, content-neutral website that demonstrates what the
reference scan actually established.

The lab answers a precise question: "Did we understand the design system and
its behavior before we use it?" It must not become a second clone or hide
unsupported behavior behind polished mockups.

## Inputs

1. `STYLE_DNA.json`
2. `REFERENCE_EVIDENCE.json`
3. `REFERENCE_LAB_SPEC.json` following `schemas/reference-lab-spec.schema.json`

Read `references/demo-catalog.md` when selecting demos. Start from
`assets/REFERENCE_LAB_SPEC.example.json` and replace all synthetic values.

## Outputs

1. `REFERENCE_LAB_SPEC.json`
2. `reference-lab/index.html`
3. `reference-lab/REFERENCE_LAB.json`

The lab uses neutral labels and generated shapes. Do not reuse third-party
copy, logos, photography, names, or proprietary assets.

## Workflow

### 1. Select evidenced patterns

Prioritize salient behaviors and those that are difficult to communicate in a
static report: navigation state, hover labels, scroll-linked changes,
marquees, reveals, stacking, parallax, filtering, fullscreen media, loading,
and direct manipulation.

Every demo declares:

- `source_paths` into `STYLE_DNA`;
- `evidence_refs` into `REFERENCE_EVIDENCE`;
- an implementation-neutral `kind`;
- parameters observed or deliberately marked adaptive.

### 2. Validate the draft

```bash
node scripts/validate-lab.mjs \
  --style STYLE_DNA.json \
  --evidence REFERENCE_EVIDENCE.json \
  --spec REFERENCE_LAB_SPEC.json \
  --allow-draft
```

### 3. Build and inspect

```bash
node scripts/build-lab.mjs \
  --style STYLE_DNA.json \
  --evidence REFERENCE_EVIDENCE.json \
  --spec REFERENCE_LAB_SPEC.json \
  --out reference-lab
```

Inspect desktop and mobile widths. Exercise every interaction, keyboard focus,
scroll behavior, and `prefers-reduced-motion` fallback.

### 4. Stop for approval

Show the user the lab. Record corrections in the spec. The agent must not set
`review.status: approved` or accept checklist items on the user's behalf.

Once the user approves, validate without `--allow-draft`. The approved lab is
the `reference-lab` checkpoint consumed by `SITE_BLUEPRINT` decisions.

## What backs each demo

A demo may rest on an observation the scanner committed to — with a mode, a
confidence and its evidence — or on material the document records without
asserting. Both are legitimate: demonstrating a value is not the same as citing
it to justify a decision, and only the second needs an observation behind it.

The rendered lab states which, per demo: fully observed, partially observed, or
resting on recorded data with no observation behind it. Without that, a reviewer
approves "we understood the system" unable to see where the scan committed and
where it merely noted something. The `source` block spells it out path by path.

A demo with no observation behind it is not a failure and is not rejected. It is
a fact the person approving should see.

## Boundaries

- The lab demonstrates behavior; it does not prove technology used by the source.
- Unknown timing, easing, breakpoint, or rendering technology remains unknown.
- Adaptive parameters must be labeled adaptive in notes.
- Custom JavaScript, raw HTML, and arbitrary CSS are not accepted in the spec.
- A demo without resolvable evidence is rejected.
- The final site may combine patterns differently only through an approved blueprint.
