# Fidelity Rules

## Objective

Reproduce design logic rather than blindly copying coordinates.

## Preserve first

Preserve:

- hierarchy
- proportion
- visual mass
- rhythm
- alignment logic
- whitespace relationships
- media prominence
- type relationships
- interaction grammar
- motion hierarchy

## Exact

Exact observations should normally be reproduced literally.

Examples:

- known font family
- exact color
- explicit border width
- observed aspect ratio

## Derived

Derived observations describe relationships.

Example:

A hero title occupies roughly 75% of viewport width.

When copy changes, preserve the relationship rather than the original pixel
width.

## Adaptive

Adaptive rules change according to content and viewport.

Do not simply stack every desktop column.

## Inferred

Treat inferred rules as hypotheses.

Implement the simplest interpretation fitting available evidence.

Validate during QA.

## Unknown

Unknown is not permission to invent spectacle.

Use the smallest behavior consistent with the known design language.

## Anti-normalization

Do not automatically convert unusual reference decisions into:

- standard SaaS layouts
- card grids
- centered hero templates
- pill buttons
- generic glassmorphism
- generic gradients
- excessive rounding
- template-like feature sections

## Content adaptation

If new copy has materially different length:

1. preserve hierarchy
2. preserve visual mass
3. preserve rhythm
4. adapt type size/measure
5. adapt line breaks
6. adapt section height afterward

Never truncate meaningful content merely to imitate a screenshot.
