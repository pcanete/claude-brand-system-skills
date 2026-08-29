---
name: brand-manual-builder
description: Turns evidence-backed BRAND_DNA and BRAND_EVIDENCE into a navigable visual identity manual for human review. Produces BRAND_MANUAL_SPEC, a static HTML checkpoint, and an explicit approval record before downstream design work. Use after brand-dna-scanner when the user needs to see, inspect, and approve the extracted identity system. Not for discovering brand rules, cloning a reference website, building the final customer site, or packaging WordPress.
license: MIT
metadata:
  version: "0.1.0"
---

# Brand Manual Builder

Convert an already-supported Brand DNA into a reviewable visual checkpoint.

This skill does not reinterpret weak evidence as truth. It arranges what the
scanner established, exposes limitations, and gives the user a place to accept
or request changes before any reference website is applied.

## Required inputs

1. `BRAND_DNA.json`
2. `BRAND_EVIDENCE.json`
3. `BRAND_MANUAL_SPEC.json` following `schemas/brand-manual-spec.schema.json`

Read `references/manual-composition.md` before preparing the spec. Start from
`assets/BRAND_MANUAL_SPEC.example.json`; replace every synthetic value.

## Outputs

Generate:

1. `BRAND_MANUAL_SPEC.json`
2. `brand-manual/index.html`
3. `brand-manual/BRAND_MANUAL.json`

The HTML is a standalone static artifact. It may be opened locally, hosted as
a checkpoint, or attached to a review. It is not the customer's final site.

## Workflow

### 1. Verify the source contracts

Run the validator from `brand-dna-scanner` when it is available. If that skill
is not installed, do not claim that the DNA was independently revalidated;
the manual validator still checks every path and evidence reference it uses.

### 2. Compose the manual

Create `BRAND_MANUAL_SPEC.json` with:

- a neutral review-shell theme informed by the Brand DNA;
- a deliberate section order;
- explicit source paths for every section;
- evidence references for visual or strategic claims;
- a review checklist;
- `review.status: draft` until the user decides.

The manual must include identity, recognition, verbal, visual, imagery or
motion when supported, operational rules, evidence, coverage, and limitations.
Omit unsupported sections instead of filling them with inventions.

### 3. Validate the draft

```bash
node scripts/validate-manual.mjs \
  --dna BRAND_DNA.json \
  --evidence BRAND_EVIDENCE.json \
  --spec BRAND_MANUAL_SPEC.json \
  --allow-draft
```

### 4. Build the visual checkpoint

```bash
node scripts/build-manual.mjs \
  --dna BRAND_DNA.json \
  --evidence BRAND_EVIDENCE.json \
  --spec BRAND_MANUAL_SPEC.json \
  --out brand-manual
```

Serve the output with any static server. Review at desktop and mobile widths.

### 5. Stop for human review

Present the manual and ask for corrections. Do not approve it on the user's
behalf. Once the user accepts it, update `review.status` to `approved`, record
`approved_by` and `approved_at`, then run validation without `--allow-draft`.

An approved manual becomes the brand checkpoint referenced by
`SITE_BLUEPRINT`. It does not replace `BRAND_DNA`; the source contract remains
authoritative for claims and evidence.

## Completion gate

The checkpoint is complete only when:

- all declared `source_paths` resolve in `BRAND_DNA`;
- all `evidence_refs` resolve in `BRAND_EVIDENCE`;
- section ids are unique;
- required review items exist;
- the manual is usable at desktop and mobile widths;
- limitations remain visible;
- the user, not the agent, approved the final review record.

