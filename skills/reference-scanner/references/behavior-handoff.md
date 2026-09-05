# Behavioral evidence handoff

New scans set `scan.validation_profile: "behavior-evidence/1"`.
This profile versions validation behavior independently of the JSON schema.

Before extracting design rules, inventory the important site behaviors. Record
route, target, viewports, criticality, status, audit_refs and notes in
`behavior_inventory`. Use observed, absent, blocked or not-tested; an absent
behavior needs an explicit observation, and a blocked critical behavior prevents
a complete handoff. Never lower criticality simply to pass.

```json
{
  "id": "primary-menu",
  "route": "/",
  "target": "header navigation",
  "critical": true,
  "status": "observed",
  "viewports": ["desktop", "mobile"],
  "audit_refs": ["menu-desktop", "menu-mobile"],
  "notes": "Open, close, focus return and touch input inspected."
}
```

Use a continuous first pass to understand loading, navigation, scroll and media.
Then isolate each important mechanism: initial state, input, intermediate states,
settling, reverse/close, interruption and device substitution. Use the existing
behavior-forensics protocol when motion or interaction is significant.
A video can establish timing but does not establish the input that caused it:
record that uncertainty and test the live site when available.

Persist evidence beside REFERENCE_EVIDENCE.json. Capture artifact paths resolve
relative to that document, not the shell working directory. Save nonempty local
files and their SHA-256 in captures[].sha256. Remote links must be downloaded
through an authorized source before a portable handoff. An unsaved observation
uses persistence=not-persisted, artifact="" and notes explaining the limitation.
That label does not replace captured support for a critical behavior.

Every behavior audit must cite evidence. IDs are unique across collections;
audit IDs can be cited downstream, but self-reference and cycles are rejected.
Samples use one increasing clock. Inventory entries recorded as observed require
an audit for each declared viewport and route.

Scanner, laboratory approval and Astro input validation run identical
scripts/lib/evidence-integrity.mjs checks. Draft/lenient modes remain preparation,
not approval. Existing documents without a profile retain their legacy inventory
policy, but duplicate IDs, cycles and declared missing artifacts are errors.
Migrate old captures by preserving their provenance, saving the actual files,
and adding hashes; never create replacement evidence merely to satisfy a gate.

Handoff includes a short behavior matrix and unresolved limitations. Carry the
audit IDs into the blueprint and QA acceptance checks so the implementation is
tested against the behavior observed at the beginning.
