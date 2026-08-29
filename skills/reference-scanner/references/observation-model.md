# Observation Model

Every meaningful design or behavior claim should preserve provenance.

## Modes

### exact

The value was measured, extracted, or directly established.

### derived

The rule is derived from multiple observed values.

### inferred

Evidence suggests the conclusion, but it was not directly established.

### adaptive

The observation describes a principle expected to transform according to
content or viewport.

### unknown

Evidence is insufficient.

## Evidence types

- computed
- source-code
- dom
- screenshot
- video
- direct-interaction
- external
- estimated

## Confidence guidance

### 0.95–1.00

Directly measured or repeatedly verified.

### 0.85–0.94

Strong direct observation with little ambiguity.

### 0.70–0.84

Good evidence, but implementation details remain uncertain.

### 0.55–0.69

Plausible inference supported by partial evidence.

### 0.30–0.54

Weak inference.

### 0.00–0.29

Unknown or speculative.

Confidence reflects evidence quality, not plausibility.

## Confidence penalties

Reduce confidence when:

- only one viewport was observed
- animation was sampled only once
- temporal evidence is missing
- the element changes dynamically
- the observation depends on external commentary
- technology is guessed from visual appearance
- responsive behavior is extrapolated
- only pointer or only touch behavior was tested
- timing comes from tool waits rather than timestamped browser states
- a motion classification lacks an idle or reverse test

## Salience

Salience describes perceptual importance.

### 0.90–1.00

Identity-defining.

### 0.70–0.89

Strongly characteristic.

### 0.40–0.69

Supporting.

### 0.00–0.39

Minor.

Scanner inspection priority may be approximated as:

salience × uncertainty × behavioral complexity

## Important distinction

Observed behavior:

"The image increases in apparent scale while the user scrolls through the
section."

Implementation hypothesis:

"This may be a scrubbed scroll animation implemented with GSAP."

These are separate observations.

The first can have high confidence while the second has lower confidence.
