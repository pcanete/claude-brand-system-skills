---
name: reference-to-astro
description: Builds a website in Astro from an analyzed reference. Consumes STYLE_DNA, CONTENT_MANIFEST and BUILD_BRIEF, and reconstructs the reference's layout, typography, media, responsive, interaction and motion language using the client's own content. Use when reference contracts exist and the site has to be built, extended or verified. Not for inventing a visual direction from scratch, and not for analyzing a reference — that is reference-scanner.
license: MIT
metadata:
  version: "0.7.0"
---

# Reference-to-Astro

Build websites from an analyzed reference language instead of inventing a new
visual direction.

The goal is not pixel copying.

The goal is faithful reconstruction of the reference's design system, spatial
logic, media behavior, interaction grammar, and motion language while adapting
them correctly to new content.

## Required inputs

Locate and read:

1. `STYLE_DNA.json`
2. `CONTENT_MANIFEST.json`
3. `BUILD_BRIEF.md`

Also read `REFERENCE_EVIDENCE.json` or reference screenshots/videos when
available.

Annotated screenshots carry explicit user intent. When an annotation selects a
target composition or calls out a mismatch, it overrides weaker inferred
geometry from the unannotated page while preserving supplied content.

When a reference video is supplied, read `references/reference-video.md`.

If an input is unavailable, do not fabricate certainty.

Continue with available evidence and mark assumptions as inferred.

Read `references/input-contract.md`.

Each input has a contract:

| Input | Schema | Template |
| --- | --- | --- |
| `STYLE_DNA.json` | `schemas/style-dna.schema.json` | produced by `reference-scanner` |
| `REFERENCE_EVIDENCE.json` | `schemas/reference-evidence.schema.json` | produced by `reference-scanner` |
| `CONTENT_MANIFEST.json` | `schemas/content-manifest.schema.json` | `assets/CONTENT_MANIFEST.example.json` |
| `BUILD_BRIEF.md` | — | `assets/BUILD_BRIEF.template.md` |

When an input is missing, produce it from its template before building rather
than improvising around the gap.

## Bundled tooling

This skill ships executable checks. They are not optional decoration: run them
at the points named below.

| Command | When |
| --- | --- |
| `node scripts/validate-inputs.mjs` | before any construction work |
| `node scripts/build-check.mjs` | after the structural build, and again before QA |
| `node scripts/audit-assets.mjs` | once supplied media is wired in |
| `node scripts/visual-qa.mjs` | during QA, once the site serves |

All four accept `--project <dir>` and write their reports under `qa/` in that
project. Install their dependencies once with `npm install` inside the skill
directory.

## Input gate

Before any construction work, verify the contracts:

```bash
node scripts/validate-inputs.mjs \
  --style STYLE_DNA.json \
  --evidence REFERENCE_EVIDENCE.json \
  --content CONTENT_MANIFEST.json
```

The validator rejects contracts that are well-formed but unsupported: claims
recorded as observed with no evidence behind them, coverage the scan did not
earn, salient claims missing from `observations`, blocks that assert findings
with no evidence-backed observation behind them, and behavior audits that a
STANDARD or FORENSIC scan promised and did not deliver.

A contract can be entirely well-formed, modest in every self-reported score,
and still assert an exact typeface and a twelve-column grid that nobody ever
observed. That is the case this gate exists for.

If it fails, do not start building. Return to whoever produced the contract
with the specific gaps. Building on an unsupported contract produces a site
whose decisions nobody can defend later.

`--lenient` checks shape only. Use it to confirm a contract is at least
well-formed while its evidence is still being gathered — never as a way past
the gate.

## Authority hierarchy

When requirements conflict, use this order:

1. Functional correctness
2. Explicit user requirements
3. Reference fidelity
4. Supplied content integrity
5. Responsive preservation of reference intent
6. Accessibility
7. Performance
8. Framework correctness
9. Agent aesthetic preference

The agent's personal design taste may never replace an intentional
reference-derived decision.

## Fidelity mode

When STYLE_DNA exists, enter REFERENCE FIDELITY MODE.

Do not:

- invent a competing art direction
- normalize unusual layouts into standard SaaS patterns
- add generic cards, gradients, pills, glass effects, shadows, or rounded
  corners without evidence
- simplify intentional interaction merely because conventional implementation
  is easier
- replace supplied copy or media with placeholders
- infer exact values when evidence is weak

Read `references/fidelity-rules.md`.

## Evidence model

Every important STYLE_DNA observation may have:

- `mode`: exact | derived | inferred | adaptive | unknown
- `confidence`: 0.0 to 1.0
- `salience`: 0.0 to 1.0
- `evidence_refs`
- `notes`

Interpret as follows.

EXACT:
Reproduce unless technically impossible or explicitly overridden.

DERIVED:
Reproduce the underlying relationship or rule, not necessarily the literal
value.

INFERRED:
Use as a working hypothesis and validate visually.

ADAPTIVE:
Preserve the visual principle while changing implementation according to
content or viewport.

UNKNOWN:
Do not invent complex behavior solely to fill the gap.

Confidence below 0.60 must never be treated as exact.

## Content integrity

CONTENT_MANIFEST is authoritative for actual site content.

Use supplied:

- copy
- images
- video
- logos
- icons
- links
- metadata
- project data

Do not distort content simply to force identical reference geometry.

Adapt the reference system to the content while preserving:

- hierarchy
- rhythm
- scale relationships
- compositional intent

Do not retrieve or reuse third-party copyrighted assets from the reference
unless explicitly supplied or authorized.

Read `references/media-strategy.md` before wiring media in: formats, cropping,
loading, poster states and fallbacks are where supplied content most often
breaks a reference layout.

Once media is wired in, confirm every referenced asset actually resolves:

```bash
node scripts/audit-assets.mjs --content CONTENT_MANIFEST.json \
  --evidence REFERENCE_EVIDENCE.json --project .
```

## Framework policy

Astro is preferred.

Before framework-specific work:

- inspect the existing project
- inspect installed versions
- verify current Astro APIs when needed
- never invent Astro directives or framework APIs

Do not hardcode an Astro version in this skill.

Prefer:

1. Astro components for static/editorial UI
2. CSS for layout, visual states, and simple transitions
3. Vanilla TypeScript for lightweight behavior
4. GSAP for sophisticated choreography or scroll animation
5. Astro client islands for genuinely stateful interactive components
6. Three.js/WebGL only when reference evidence requires GPU-rendered behavior

Read `references/astro-architecture.md`.

## JavaScript budget

Do not hydrate components merely because a UI framework is available.

Static content should remain static.

Use `client:*` only where browser-side state or interaction requires
hydration.

## Component architecture

Components should follow visual and behavioral boundaries found in the
reference, not arbitrary abstraction.

Create reusable components when at least one is true:

- it repeats
- it has independent behavior
- it has meaningful responsive logic
- it has reusable visual anatomy
- it deserves isolated testing

Do not fragment every wrapper into a component.

Read `references/component-strategy.md`.

## Design tokens

Before detailed construction derive reusable implementation tokens from
STYLE_DNA.

Consider:

- colors
- typography
- fluid scales
- spacing
- content widths
- grid
- radii
- borders
- easing
- durations
- z-index layers

Use CSS custom properties when values represent actual system relationships.

Do not manufacture regularity where the reference intentionally uses
irregular composition.

## Build sequence

### Phase 1 — Inspect

Read inputs.

Inspect project files when present.

Map:

- routes
- assets
- content groups
- interactive regions
- high-confidence reference rules
- high-salience uncertain regions

### Phase 2 — Implementation plan

Create an internal map for:

- routes
- layout primitives
- reusable components
- media
- interactive islands
- motion systems
- page transitions
- WebGL
- responsive transformations
- uncertain observations requiring QA

Read `references/design-composition.md` and create a composition brief for
each high-salience section before styling it. The brief identifies dominant and
secondary masses, alignment anchors, reading path, intended empty space,
figure-ground treatment, media focal point and responsive transformation.

Do not begin with animation.

### Phase 3 — Structural build

Implement:

- document structure
- global layout
- grid
- typography
- spacing
- major sections
- supplied media

The static site should already resemble the reference before sophisticated
motion is added.

### Phase 4 — Responsive reconstruction

Read `references/responsive-reconstruction.md`.

Preserve:

- hierarchy
- visual mass
- focal points
- reading order
- rhythm
- usability

Responsive adaptation is not simple stacking.

### Phase 5 — Interaction

Implement evidenced:

- navigation
- hover
- focus
- active states
- drag/swipe
- filters
- fullscreen media
- direct manipulation
- menus
- accordions
- carousels
- cursor behavior
- stateful controls

Touch must have an intentional equivalent for pointer-dependent behavior.

Use the scanner's state matrix as a completeness checklist. Implement and test
initial, activation, intermediate, settled and reverse/close states for
high-salience menus, text effects and moving media. A correct open state does
not compensate for a missing transition or reverse state.

### Phase 6 — Motion

Read `references/motion-system.md`.

When motion comes from supplied video evidence, also read
`references/reference-video.md`. Translate the observed motion grammar rather
than substituting a generic carousel, crossfade or marquee.

If GSAP is required, inspect the installed version and use its official
documentation for any API whose current behavior is uncertain. Do not assume
companion GSAP skills are available in the environment.

Use timelines for choreography.

Use scroll tooling only for evidenced scroll behavior.

For anything scroll-linked — scrubbed timelines, pinned scenes, frame
sequences, smooth scroll, and their teardown across client-side navigation —
read `references/scroll-scenes.md`.

Respect `prefers-reduced-motion`. Reduced does not mean removed: every motion
category has a defined reduced state, listed in
`references/accessibility-performance.md`.

### Phase 7 — WebGL

Read `references/webgl-policy.md`.

Do not introduce WebGL merely because a reference looks premium.

Use WebGL only when required to reproduce observed GPU-style behavior.

Always provide capability/reduced-motion fallback.

### Phase 8 — Page transitions

Prefer native browser View Transitions when sufficient.

Use Astro ClientRouter only when additional client-side navigation,
persistence, or transition control is required.

Do not convert the site into a SPA by default.

Client-side navigation changes how scripts run, what has to be torn down, and
what survives a swap. `references/astro-architecture.md` states the three
rules; ignoring them produces a site that behaves correctly on first load and
degrades with every navigation after it.

### Phase 9 — Accessibility and performance

Read `references/accessibility-performance.md`.

Accessibility may override literal reference behavior when necessary.

Document meaningful fidelity exceptions.

### Phase 10 — QA

The build is not complete when it compiles.

Read `references/visual-qa.md`.

Run the automated passes:

```bash
node scripts/build-check.mjs --project .
node scripts/audit-assets.mjs --project .
node scripts/visual-qa.mjs --profile QA_PROFILE.json --project .
```

`assets/QA_PROFILE.example.json` shows how to declare routes, viewports and
interaction steps. Report findings with `assets/QA_REPORT.template.md`.

`visual-qa.mjs` captures evidence — baselines per route and viewport,
before/after pairs for each declared interaction, a reduced-motion pass, and
every console or page error. It does not decide whether the result matches the
reference. That comparison is yours: open the captures against the reference
and judge them in the order below.

Composition is a blocking gate, not a subjective final polish. For each major
viewport, verify that primary visual regions remain distinct, intended
whitespace survives, and painted content does not collide, clip, or cross into
another region without reference evidence. Measure actual painted text bounds
when large typography is involved; CSS grid or block boxes alone can conceal
glyph overflow. Follow the composition gate in `references/visual-qa.md`.

Then run the passes the tooling cannot do for you:

- desktop, tablet and mobile comparison against the reference
- interaction pass
- motion pass
- reduced-motion pass
- keyboard pass
- design critique pass from `references/design-composition.md`
- temporal comparison against supplied reference videos

Fix significant mismatches and repeat.

## Fidelity QA priorities

Review in this order:

1. composition and hierarchy
2. typography
3. section proportions
4. media scale and cropping
5. spacing rhythm
6. color and surface treatment
7. interaction states
8. animation hierarchy
9. timing and easing
10. responsive transformation

## Completion criteria

Complete only when:

- `validate-inputs.mjs` passed before the build started
- `build-check.mjs`, `audit-assets.mjs` and `visual-qa.mjs` ran and their
  reports are in `qa/`
- production build succeeds
- no relevant console errors remain
- supplied assets resolve
- primary routes work
- primary interactions work
- desktop/mobile layouts were inspected
- the composition gate passed at every major viewport
- high-salience interaction state matrices are represented and tested
- supplied reference videos were decoded or their two-path failure documented
- reduced motion is supported where motion exists
- major STYLE_DNA rules are represented
- unresolved low-confidence assumptions are documented

## Final output

Return:

1. implementation summary
2. architecture decisions
3. fidelity exceptions
4. unresolved assumptions
5. QA results

Do not claim exact fidelity for interactions that were not directly observed.
