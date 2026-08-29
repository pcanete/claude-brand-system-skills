# Site Blueprint checkpoint

`SITE_BLUEPRINT.json` is the approved bridge between evidence, client content
and implementation. It exists because a valid `STYLE_DNA` does not decide
which real section should use which reference pattern, and a
`CONTENT_MANIFEST` does not decide composition.

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
