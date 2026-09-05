# Behavioral evidence and WordPress release

The entry skills now use scanner 1.0.0, lab 1.0.0, Astro 2.0.0 and
WordPress publisher 1.0.0. These majors reflect stricter validation and the new
PHP runtime requirement, not a promise that a client deployment was tested.

## Migration

- New scans set scan.validation_profile to behavior-evidence/1 and use the
  behavior inventory described in the scanner's behavior-handoff reference.
- Existing unprofiled scans retain the legacy inventory policy. Strict handoffs
  now reject missing declared capture files. Preserve actual artifacts relative
  to REFERENCE_EVIDENCE.json; do not synthesize historical evidence.
- Unique evidence IDs and acyclic references are enforced. behavior_audits are
  now first-class evidence IDs across scanner, lab and Astro.
- Persisted captures under the new profile need SHA-256. Unsaved observations
  explicitly record their limitation and cannot alone support critical audits.
- The lab schema is aligned across platforms, including WebGL and transitions.
  Both support the same Reference Lab Spec 0.1 capabilities.
- SITE_BLUEPRINT is 1.0, including optional deployment and runtime_content from
  Claude. Runtime content still needs project-specific CMS implementation and QA.
- PHP CLI must be available in PATH or PHP_BINARY. validate-plugin checks every
  generated PHP file with php -n -l; publish stops before ZIP on failure.
- QA route/interaction assertions check expected state and declared font loading.
  Captures remain evidence requiring visual review.

## Shared maintenance

brand-system-skills is the proposed integration source for the shared core.
Both repositories remain independent distributions, with intentional differences
in platform guidance and WordPress hosting strategies. No repository was deleted
or wholesale overwritten.

Before a cross-platform release, run each suite and:

    node scripts/check-peer.mjs <other-checkout>

This checks the actual shared schema/runtime files, not version strings.
The current patch synchronizes the evidence module, web contract gates, lab
demos/schema, blueprint schema, visual QA and PHP syntax gate.
Future edits should be integrated in one branch and ported together with tests.

## Browser and WordPress verification

Run scripts/test-qa-assertions.mjs inside reference-to-astro with Chromium
installed. It verifies an expected menu state and rejects silent font fallback.

The fixture exercises export and packaging. PHP lint verifies syntax only.
Before a customer deployment, test a disposable WordPress instance with that
site's plugin set: anonymous front page, logged-in view, non-front-page routes,
asset responses, SEO ownership, consent and functional WooCommerce components.
No broad CSS isolation policy should be selected solely from a static audit.
The CSS tool is diagnostic and flags potentially active @media rules.

No live WordPress deployment or customer reference scan is included in this
maintenance release. Those checks require an actual target and its content.

## Remaining evolution

A single generated distribution pipeline can replace manual cross-porting later.
Real-reference perceptual benchmarks, automated local/published comparison and
the cross-format editorial layer remain separate work. This release supplies the
evidence and publishing gates they depend on.
