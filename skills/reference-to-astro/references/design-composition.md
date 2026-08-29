# Design and Composition Reasoning

Use this reference before styling a high-salience section and again during
visual QA. It exists to adapt a reference intelligently when content length,
media or viewport differs.

## Composition brief

For each major section identify:

- dominant visual actor
- secondary and tertiary actors
- visual mass ratio
- alignment anchors
- intended reading path
- deliberate negative space
- figure-ground strategy
- media focal point
- overlap or separation rules
- tension, symmetry or asymmetry
- content-length risk
- responsive structural transformation

Keep this brief implementation-neutral. It should explain the relationship that
must survive, not prescribe CSS prematurely.

## Operational principles

### Hierarchy

Hierarchy is perceived difference, not heading tags. Compare scale, weight,
contrast, position, isolation and motion. One dominant actor should remain
dominant after real content replaces reference copy.

### Visual mass and balance

Estimate how much attention each region carries. Large type, bright color,
faces, motion and dense copy all add mass. Preserve intentional imbalance, but
do not let adapted content accidentally create a second dominant region.

### Figure and ground

Moving photography changes contrast over time. Test text against several media
frames. Use crop, overlay or positioning to maintain legibility without
flattening the imagery.

### Negative space

Empty space must frame, separate or pace content. If it has no compositional
job, it is accidental vacancy. If content expansion consumes deliberate space,
adapt line breaks, measure or structure rather than shrinking everything first.

### Alignment and rhythm

Identify recurring edges, baselines and intervals. Preserve the anchor system
even when the exact grid changes. Repetition establishes rhythm; a deliberate
break creates emphasis.

### Typography and media

Treat headline line breaks as composition. Measure painted glyph bounds, not
only the block box. Protect photographic focal points and avoid letting text and
subject compete for the same visual territory unless the reference evidences
that tension.

### Reading path

Verify the eye moves from dominant message to explanation to action. Motion,
faces and high-contrast controls can interrupt that path. Reduce competition
rather than merely increasing every element.

## Adaptation order

When supplied content differs from the reference:

1. preserve hierarchy and dominant mass;
2. adapt line breaks and text measure;
3. adapt grid ratio and anchors;
4. adapt spacing and section height;
5. adapt type scale only after the preceding options;
6. document any remaining fidelity exception.

## Blocking critique

Fail the composition when:

- dominant regions collide without evidence;
- two actors compete for primary attention;
- adapted copy becomes illegibly small or visually dense;
- negative space loses its purpose;
- moving media destroys figure-ground legibility;
- the reading path no longer reaches the action;
- responsive stacking preserves content but destroys hierarchy.

Fix the highest-salience failure, recapture, and critique again.
