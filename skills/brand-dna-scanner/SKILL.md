---
name: brand-dna-scanner
description: Extracts an evidence-backed Brand DNA from a brand's own material — website, guidelines, campaigns, social, photography, video, packaging, product, UI and copy — separating lasting identity from category convention, campaign styling and one-off execution. Produces BRAND_DNA, BRAND_EVIDENCE, BRAND_REPORT, BRAND_RULES and a reusable BRAND_PROMPT. Use when a brand's rules have to be captured, audited, or handed to whoever makes new work. Not for analyzing one reference website's layout and behavior — that is reference-scanner.
license: MIT
metadata:
  version: "0.4.0"
---

# Brand DNA Scanner

Analyze a brand as a system.

The objective is not to produce a moodboard description.

The objective is to reconstruct the strategic, verbal, visual, behavioral,
experiential, and perceptual rules that make the brand identifiable and
reproducible across media.

## Standard outputs

Generate:

1. `BRAND_DNA.json`
2. `BRAND_EVIDENCE.json`
3. `BRAND_REPORT.md`
4. `BRAND_RULES.md`
5. `BRAND_PROMPT.md`

BRAND_DNA is the machine-readable identity model.

BRAND_EVIDENCE records provenance.

BRAND_REPORT is the detailed human-readable analysis.

BRAND_RULES defines operational brand constraints.

BRAND_PROMPT converts the DNA into reusable instructions for another
creative/design agent.

## Working files

Write against the contracts from the start rather than reshaping the output at
the end.

| Output | Contract or template |
| --- | --- |
| `BRAND_DNA.json` | `schemas/brand-dna.schema.json` |
| `BRAND_EVIDENCE.json` | `schemas/brand-evidence.schema.json` |
| `BRAND_REPORT.md` | `assets/BRAND_REPORT.template.md` |
| `BRAND_RULES.md` | `assets/BRAND_RULES.template.md` |
| `BRAND_RULES.json` | `schemas/brand-rules.schema.json`, example in `assets/BRAND_RULES.example.json` |
| `BRAND_PROMPT.md` | `assets/BRAND_PROMPT.template.md` |

`assets/SCAN_PROFILE.example.json` shows how to declare the scan up front:
sources, channels, mode and the capabilities actually available.

`examples/BRAND_DNA.example.json` and `examples/BRAND_EVIDENCE.example.json`
are a small worked pair. Read them before writing your own: they show what
"supported" looks like, including a claim deliberately kept channel-specific
because a single source cannot establish recurrence.

## Rules that can be checked

`BRAND_RULES.md` is the human read. `BRAND_RULES.json` is the same rules in a
form a machine can test a piece against, and it is what makes the DNA
operational instead of archival.

Each rule carries a statement, the evidence it was derived from, and a
`detect` block that is either a pattern or an explicit `manual` question.
That split is the point. A rule like "never open with a rhetorical question"
is checkable; a rule like "the turn must implicate the reader" is not, and
marking it `manual` means it gets reported as needing judgement rather than
silently passing.

```bash
node scripts/check-piece.mjs --piece caption.md --rules BRAND_RULES.json
```

Without this, brand compliance is checked by whoever wrote the piece, against
rules they are also interpreting, and that check always passes.

Only write a rule the evidence supports. A brand rule with no observation
behind it is an opinion with a rule number.

## Derived material is not evidence

In any brand with history, much of the available material is already a
distillation of an earlier brand document: a voice guide generated from a
dossier, a palette copied out of a manual, an editorial POV canonised from a
strategy deck.

Those files restate the document they came from. Scanning them recovers that
document and produces a Brand DNA that looks impressively accurate while
having observed nothing.

Record such sources with authority `derived-internal`. An observation whose
evidence traces only to derived-internal sources cannot be `exact` or
`derived`, and the validator enforces it.

The tell is usually in the file itself: a header saying what it was generated
from, a note naming a section of another document. Look for it before treating
anything internal as a touchpoint.

## What a scan of published work can and cannot reach

Published pieces carry the expressive layer: voice, verbal positioning, content
mechanics, visual system, distinctive assets.

They rarely carry the strategic layer: who the competitor actually is, who the
audience actually is, the business model, the time horizon. Those are decided,
not expressed, and no amount of forensic reading of campaigns will recover
them.

Say so in `limitations` rather than inferring them. If the objective needs the
strategic layer, the scan needs declarative material — a manual, an interview,
a strategy document — and that requirement belongs in the source inventory,
not in a guess.

## Evidence-first behavior

Prefer:

OBSERVE
→ RECORD
→ COMPARE
→ IDENTIFY RECURRENCE
→ DISTINGUISH CORE FROM TEMPORARY
→ SYNTHESIZE

Never:

SEE ONE EXAMPLE
→ DECLARE IT A GLOBAL BRAND RULE

## Input scope

The skill may inspect:

- websites
- identity guidelines
- logos
- campaigns
- social media
- advertising
- photography
- films
- packaging
- physical products
- retail
- offices
- exhibitions
- presentations
- UI
- apps
- copy
- founder communication
- customer communication
- audio
- naming systems

Record which channels were actually observed.

Do not imply cross-channel consistency when only one channel was inspected.

## Scan modes

### QUICK

Broad perceptual signature.

Use for early exploration.

### STANDARD

Cross-channel working Brand DNA.

### FORENSIC

Use when the objective is high-confidence brand reproduction or creation of
future branded work.

FORENSIC mode should seek multiple independent touchpoints whenever available.

## Observation model

Every important conclusion should support:

- mode
- confidence
- salience
- recurrence
- consistency
- distinctiveness
- evidence_refs
- notes

Modes:

- exact
- derived
- inferred
- adaptive
- unknown

Read `references/evidence-model.md`.

## Core-vs-expression rule

The scanner must separate:

### BRAND CORE

Long-lived strategic and perceptual identity.

### BRAND SYSTEM

Repeatable rules used across touchpoints.

### CHANNEL EXPRESSION

How the brand behaves in a specific medium.

### CAMPAIGN EXPRESSION

Temporary campaign-specific variation.

### EXECUTION

A single creative artifact.

Do not promote execution-level behavior to Brand DNA without recurrence.

Read `references/core-vs-expression.md`.

## Phase 1 — Source inventory

Create an inventory of available sources.

For each source record:

- source ID
- URL/path
- channel
- date
- campaign/product
- locale
- authority
- current/legacy status
- evidence quality

Authority may include:

- official guideline
- official owned channel
- official campaign
- product
- third-party publication
- archive
- inferred

Prefer first-party current sources.

## Phase 2 — Brand core

Read `references/brand-core.md`.

Analyze when evidence supports it:

- purpose
- mission
- vision
- promise
- category
- positioning
- audience
- differentiation
- functional value
- emotional value
- symbolic value
- reasons to believe
- values
- principles
- cultural position
- archetypes
- personality
- tensions
- boundaries

Declared statements and inferred positioning must remain separate.

## Phase 3 — Verbal DNA

Read `references/verbal-dna.md`.

Analyze:

- voice
- tone
- syntax
- rhythm
- vocabulary
- naming
- claims
- slogans
- CTA language
- product descriptions
- microcopy
- storytelling
- evidence-vs-emotion balance
- recurring phrases
- banned/off-brand language when inferable
- localization/transcreation behavior

Do not infer global tone from one headline.

## Phase 4 — Visual DNA

Read `references/visual-dna.md`.

Analyze:

- logo
- color
- typography
- composition
- grid
- spacing
- shape language
- surfaces/materials
- patterns
- iconography
- hierarchy
- visual mass
- distinctive visual assets

Distinguish design-system constants from campaign art direction.

## Phase 5 — Photography

Read `references/photography-dna.md`.

Analyze:

- subject
- casting
- styling
- pose
- expression
- camera language
- framing
- crop
- lens character
- depth
- lighting
- environment
- set design
- texture
- color grade
- grain
- retouching
- recurring motifs
- prohibited-looking alternatives

## Phase 6 — Illustration, iconography and 3D

Read `references/graphic-assets-dna.md`.

Analyze:

- illustration
- iconography
- CGI
- 3D
- shape systems
- material systems
- recurring visual metaphors

## Phase 7 — Motion

Read `references/motion-dna.md`.

Analyze:

- motion philosophy
- speed
- easing character
- inertia
- amplitude
- stagger
- hierarchy
- entrance
- exit
- interaction
- loading
- scroll
- transitions
- ambient motion
- logo motion
- media motion
- typography motion
- reduced-motion behavior

Do not infer libraries.

## Phase 8 — Digital / web experience

Read `references/web-experience-dna.md`.

Analyze:

- homepage narrative
- navigation
- menus
- loaders
- component language
- cursor
- hover
- focus
- click/press
- drag
- swipe
- filtering
- fullscreen media
- scroll behavior
- scroll scenes
- page transitions
- video
- interactive scenes
- WebGL/canvas behavior
- responsive transformation
- runtime content
- localization
- accessibility behavior

Website-specific behavior must not automatically become global Brand DNA.

Label whether behavior is:

- brand-defining
- channel-specific
- campaign-specific
- implementation-specific
- unknown

## Phase 9 — Content system

Read `references/content-dna.md`.

Analyze:

- content categories
- editorial hierarchy
- narrative structure
- content depth
- educational vs promotional balance
- case studies
- testimonials
- metrics
- founder voice
- product stories
- behind-the-scenes
- CTA frequency
- proof mechanisms
- recurring content modules

## Phases 10-13 — Optional channels

Product and packaging, environmental identity, sonic identity and brand
behavior are expressed by some brands and not others.

Read `references/optional-channels.md` and analyze only the channels the
available evidence actually supports. An empty channel is a correct result.

## Phase 14 — Distinctive asset analysis

Read `references/distinctive-assets.md`.

Identify assets such as:

- logo
- symbol
- color
- type
- shape
- photography treatment
- phrase
- naming pattern
- motion
- sonic cue
- product silhouette
- packaging
- interaction pattern
- recurring composition

Score each on:

- salience
- recurrence
- consistency
- distinctiveness
- ownership confidence

Do not confuse category codes with proprietary assets.

## Phase 15 — Competitive/category separation

When competitor/category evidence is available distinguish:

- category conventions
- category clichés
- brand-specific codes
- whitespace
- lookalike risk
- generic design decisions
- truly distinctive decisions

If no competitor evidence exists, mark category-specific conclusions as
inferred.

## Phase 16 — Contradiction analysis

Read `references/contradiction-analysis.md`.

Detect:

- guideline vs execution differences
- legacy vs current identity
- campaign exceptions
- regional differences
- channel differences
- old vs new logos
- inconsistent tone
- inconsistent colors
- conflicting positioning signals

Contradiction is evidence.

Do not average contradictions away.

A contradiction is also a finding about a channel. Record it in
`contradictions` **and** as an observation of the channel it was found in.
Otherwise the channel reads as uninspected: the coverage gate counts
observations, and a contradiction filed only under `contradictions` leaves the
strongest thing you learned about that channel outside the index.

## Phase 17 — Temporal analysis

Identify:

- timeless/core assets
- trend-dependent styling
- legacy identity
- new emerging identity
- campaign-only experiments
- seasonal behavior

Do not make a recent experimental campaign define the historical brand unless
it is clearly becoming the new system.

## Phases 18-20 — Synthesis

Read `references/synthesis-rules.md`.

This is where the scan either becomes a system or stays an inventory. Produce:

- the **relationship graph**: strategic principles connected to the executions
  that express them
- the **recognition model**: the minimum asset set the brand is recognized by,
  which is often not the logo
- the **rule sets**: must preserve, may adapt, must not introduce, plus what is
  channel-specific and what is campaign-specific

Do not output disconnected checklists only.

## Phase 21 — Master Brand Prompt

Generate BRAND_PROMPT.md.

It must be usable by another creative agent to produce new work in the
brand's language without copying existing executions.

The prompt should describe:

- strategic essence
- personality
- verbal rules
- visual rules
- photography
- motion
- content
- interaction when relevant
- distinctive assets
- allowed variation
- forbidden patterns

Do not include unsupported certainty.

## Completion gate

FORENSIC mode should not claim complete Brand DNA when:

- only one channel was observed
- major current touchpoints are missing
- evidence is almost entirely campaign-specific
- core identity is contradicted without resolution
- distinctive asset claims lack recurrence
- current vs legacy identity cannot be separated

## Verification gate

Before presenting anything, verify the contracts:

```bash
node scripts/validate-brand-dna.mjs \
  --dna BRAND_DNA.json --evidence BRAND_EVIDENCE.json
```

Install the validator's dependencies once with `npm install` in the skill
directory.

Beyond schema shape, the validator enforces what this skill exists to protect:

- an observation recorded as `exact` or `derived` carries `evidence_refs`
- an asset claimed as owned or recurrent carries evidence
- **recurrence is earned**: anything scored recurrent must trace back to at
  least two distinct sources, so one spectacular execution cannot become
  Brand DNA
- declared coverage is backed by observations in that dimension
- claims the contract itself marks as salient and confident appear in
  `observations`, where they can be traced
- **every channel that asserts something carries an evidence-backed
  observation.** Describing the photography commits you to saying where you
  saw it. This gate ignores confidence, salience and coverage: those are
  numbers you write about your own work, and personality is the easiest thing
  in a brand to project without evidence

A rejection is information, not an obstacle. There are two honest answers to
one: record the missing evidence, or lower the claim to what the material
actually supports. `--lenient` checks shape only; it is for work in progress,
never for a delivered Brand DNA.

## Final response

Return:

- scan mode
- source coverage
- perceptual signature
- strongest distinctive assets
- major contradictions
- evidence limitations
- generated artifacts

Do not expose hidden chain-of-thought.
