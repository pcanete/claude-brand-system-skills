# Brand Evidence Model

Brand analysis must preserve provenance.

## Observation modes

### exact

Directly established.

### derived

Derived from multiple observations.

### inferred

Supported but not directly established.

### adaptive

A principle intended to vary by channel/context.

### unknown

Insufficient evidence.

## Evidence dimensions

Every important observation may include:

### confidence

How strongly the evidence supports the conclusion.

0.95–1.00:
direct/repeated evidence

0.80–0.94:
strong evidence

0.60–0.79:
moderate evidence

0.40–0.59:
weak inference

0.00–0.39:
speculative / unknown

### salience

How perceptually important the characteristic is.

### recurrence

How often it appears across relevant artifacts.

### consistency

How consistently the brand applies it.

### distinctiveness

How uncommon or brand-owned it appears relative to generic category language.

### authority

Evidence-source authority.

Possible levels:

- official-guideline
- official-current-owned
- official-current-campaign
- official-legacy
- product
- third-party
- archive
- inferred

## Brand-strength heuristic

A candidate Brand DNA characteristic becomes stronger when:

- salience is high
- recurrence is high
- consistency is high
- distinctiveness is high
- source authority is high

A single spectacular campaign element may have:

high salience

but:

low recurrence

Therefore it should not automatically become core DNA.

## Evidence object

Recommended structure:

{
  "id": "",
  "claim_path": "",
  "source_refs": [],
  "mode": "derived",
  "confidence": 0.9,
  "salience": 0.8,
  "recurrence": 0.9,
  "consistency": 0.85,
  "distinctiveness": 0.75,
  "notes": ""
}
