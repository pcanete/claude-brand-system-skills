# Architecture

## Independent skills, compatible contracts

The repository is a monorepo for maintenance, not a single coupled skill.

### brand-dna-scanner

Analyzes multiple brand touchpoints and produces:

- `BRAND_DNA.json`
- `BRAND_EVIDENCE.json`
- `BRAND_REPORT.md`
- `BRAND_RULES.md`
- `BRAND_PROMPT.md`

Its output can inform websites, campaigns, presentations, social content, and
other production systems.

### reference-scanner

Analyzes one reference website as a visual and behavioral system. It produces
`STYLE_DNA.json`, `REFERENCE_EVIDENCE.json`, and `STYLE_REPORT.md`.

Brand DNA may inform interpretation, but website-specific behavior remains
channel-specific unless cross-channel evidence supports promotion to brand core.

### reference-to-astro

Consumes `STYLE_DNA`, `REFERENCE_EVIDENCE`, `CONTENT_MANIFEST`, and a build brief
to construct and verify an Astro implementation.

## Contract ownership

- Brand contracts belong to `brand-dna-scanner`.
- Web reference contracts are authored by `reference-scanner`.
- `reference-to-astro` carries exact copies of the web contracts so it remains
  independently installable.
- CI fails if shared web schemas drift.

The same applies to verification. `scripts/lib/web-contracts.mjs` holds the
gates for the web contracts and is duplicated byte-identically in
`reference-scanner` and `reference-to-astro`: the scanner verifies what it
produced, the builder verifies what it received, and neither depends on the
other being installed. CI fails if the copies drift.

## Verification

Each skill validates its own output, and the validators check two different
things.

**Shape** — the documents match their JSON Schema. Necessary, and easy to
satisfy without saying anything true.

**Support** — the gates. Observations recorded as observed carry evidence;
declared coverage is backed by what the scan recorded; claims the contract
itself marks as salient appear in `observations`; in brand, recurrence traces
back to at least two distinct sources; and every block that asserts anything
has an evidence-backed observation behind it.

That last gate exists because the others shared a flaw: each read a number the
author wrote about their own work. Any gate driven by a self-reported score is
satisfied by reporting a lower score, and omitting the field entirely was
cheaper still. A contract asserting an exact typeface, a twelve-column grid and
a named easing curve passed every gate by declaring itself uncertain. The fix
was to stop reading the scores and start reading the claims:
`tests/rejected-evasive/` holds that contract, and it must keep failing.

The split matters because the failure mode of an agent writing these contracts
is not malformed JSON. It is a well-formed document full of confident claims
nobody can trace. `--lenient` runs shape only, for work in progress.

`tests/rejected/` holds fixtures that must fail. If they ever pass, the gates
stopped working and the repository check fails.

## Las dos herramientas del final

El recorrido no termina en el build. Dos pasos quedaban a mano, y son los que
más se repiten en un trabajo real.

**site-tuner** cubre el ajuste fino. Su contrato es lo único que separa un
calibrador de un editor de CSS con pasos extra: sólo existe lo que el proyecto
declaró. El panel vive en desarrollo y escribe un archivo de valores aprobados
que sí se compila — probar y decidir son dos estados distintos a propósito.

**wordpress-publisher** cubre la publicación cuando el cliente ya tiene un
WordPress que debe seguir funcionando. Reemplaza la portada y nada más, y
distingue con cuidado entre desencolar los estilos visuales del tema —que
pelean con el diseño nuevo— y dejar intactos scripts, analítica y
consentimiento, que otros plugins necesitan.

Las dos salieron de un rediseño real y estaban atrapadas dentro del proyecto de
un cliente. Extraerlas fue el trabajo: separar el motor genérico del contrato
del proyecto, y parametrizar lo que tenía un nombre propio adentro.
