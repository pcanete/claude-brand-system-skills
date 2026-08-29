# Security Policy

Never include credentials, private client material, unpublished strategy,
personal data, or proprietary media in issues, pull requests, fixtures, or
example outputs.

For a vulnerability involving sensitive information, use GitHub private
vulnerability reporting when available. Otherwise contact the maintainer
through the repository owner's GitHub profile before disclosing details.

The bundled scripts run locally and act on the project you point them at:
`build-check.mjs` executes that project's own build command, and `visual-qa.mjs`
opens its pages in a headless browser. Point them at a project you trust, and
keep `--project` pointed where you expect.

The skills analyze user-provided and public materials. Users remain responsible
for authorization, copyright, trademark, privacy, and data-handling obligations.
