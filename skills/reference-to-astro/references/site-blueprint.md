# Site Blueprint checkpoint

`SITE_BLUEPRINT.json` is the approved bridge between evidence, client content
and implementation. It exists because a valid `STYLE_DNA` does not decide
which real section should use which reference pattern, and a
`CONTENT_MANIFEST` does not decide composition.

## Two questions before writing the plan

Both are optional in the schema so an existing blueprint keeps validating, but
ask them anyway. They are cheap now and expensive later.

**Where will this live?** `project.deployment` — `standalone` or `wordpress`.

A site that goes inside WordPress is a guest, not the owner, and that changes
the plan itself, not just how it is packaged:

- Foreign CSS from the theme and its builders is blocked on the compiled page.
  Anything the page deliberately hosts — a popup, a consent banner, a chat —
  has to be measured and declared before it is allowed in.
- **The navigation cannot carry its links in the source.** The client manages
  their menu in WordPress; a header with hardcoded links becomes a second truth
  that silently diverges the first time they add an item.
- Regions the client updates often should be fed at runtime, not frozen at
  build time.

**Which regions are not frozen at build time?** `section.runtime_content`.

Declare it only on the sections that are fed after publication. A section
without it is frozen: changing it means rebuilding and republishing.

The field that matters most there is `tolerates`. A region fed by someone else
will eventually receive content that does not fit the shape it was designed
for — a headline of three lines where two were drawn, an article with no
featured image, a product shot in the wrong aspect. The day it happens nobody
says "my content does not fit"; they say "the site is broken", and the
complaint comes to whoever built it.

Writing down what the shape tolerates is what turns that from an incident into
a decision someone already made.

## When to create it

Create the blueprint after the reference scan and content manifest are valid,
but before writing components or styling the final site.

If no blueprint exists:

1. copy the structure demonstrated by `assets/SITE_BLUEPRINT.example.json`;
2. map every target page and content section;
3. attach every borrowed visual or behavioral rule to a real STYLE_DNA path
   and REFERENCE_EVIDENCE id;
4. write the composition brief and responsive transformation for each section;
5. record unresolved decisions as `open`;
6. validate with `--lenient` while the approval status is `draft`;
7. present the blueprint to the user and stop before implementation.

After review, resolve or record requested changes, set `approval.status` to
`approved`, and run the strict validator. Never mark approval on the user's
behalf merely because the blueprint was generated.

## What belongs in it

The blueprint records decisions that would otherwise remain implicit:

- why a target section uses a particular reference pattern;
- which content must survive adaptation;
- dominant and secondary visual masses;
- alignment anchors and intended empty space;
- desktop, tablet and mobile transformation;
- pointer, keyboard, touch and reduced-motion equivalents;
- criteria another reviewer can verify without reading the implementation.

It does not contain arbitrary CSS values or implementation code. Those belong
in design tokens, components and later tuning contracts.

## Checkpoints

The required checkpoint ids are:

- `brand-manual`: approve the visual identity manual, or waive it with a reason
  when no brand scan is in scope;
- `reference-lab`: approve the isolated visual and behavioral specimen, or
  waive it with a reason when the user explicitly accepts a reduced process;
- `content-architecture`: approve routes, section order, content mapping and
  conversion paths.

Strict validation rejects pending checkpoints and undocumented waivers.

## Fidelity target and ceremony

`project.fidelity_target` decides how much protocol strict validation demands.
It never changes what may be claimed.

| Target | Checkpoints | Open decisions | Patterns |
| --- | --- | --- | --- |
| `directional` | may stay pending | allowed, recorded | any mode |
| `high` | approved or waived with a reason | none | any mode |
| `forensic` | approved or waived with a reason | none | no `inferred` |

`directional` is the common case: the reference is a starting point rather than
something to reproduce, and often there is no brand scan at all. Recording an
open decision is better than closing it to satisfy a validator.

Human approval is required at every level. So are the gates that prevent
invention: the plan must cover the supplied content, and every pattern must
resolve to a recorded observation with evidence. Lowering the target lowers the
protocol, never the honesty.

## Coverage rule

Every section in the content manifest must either:

- appear exactly once through `content_section`, or
- be listed under `excluded_content_sections` with a reason.

This prevents supplied content from disappearing merely because it did not fit
the reference composition.

## Authority

An approved blueprint is authoritative for section mapping, composition and
responsive intent. Explicit later user instructions can change it, but the
blueprint must then be updated so code and approved intent do not diverge.
