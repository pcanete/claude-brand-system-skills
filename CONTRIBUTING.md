# Contributing

Contributions are welcome when they improve evidence quality, portability,
schema clarity, validation, or real-world usefulness.

## Before opening a pull request

1. Keep each skill independently installable.
2. Do not add client data, credentials, proprietary assets, or unlicensed media.
3. Put shared project documentation at repository level, not inside individual
   skill folders unless the skill needs it at runtime.
4. Update the relevant skill version when behavior or contracts change.
5. Run the repository validation:

```powershell
npm ci --prefix skills/brand-dna-scanner
npm ci --prefix skills/reference-scanner
npm ci --prefix skills/reference-to-astro
npm test
```

## Changes to the gates

The validators in each skill are the point of the project: they turn the stated
discipline into something that fails. Loosening a gate needs a reason in the
pull request, and `tests/rejected/` must keep failing.

Keep `scripts/lib/web-contracts.mjs` byte-identical between `reference-scanner`
and `reference-to-astro`.

## Changes to schemas

Schema changes must document compatibility impact. Keep the duplicated
`STYLE_DNA` and `REFERENCE_EVIDENCE` schemas byte-identical between
`reference-scanner` and `reference-to-astro`.

## Examples and benchmarks

Use synthetic, public-domain, or explicitly authorized materials. Do not commit
screenshots, copy, fonts, media, or private evidence from analyzed references.
