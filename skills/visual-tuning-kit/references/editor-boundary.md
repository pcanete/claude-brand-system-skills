# Editor boundary

The tuner exists for final design judgement, not page construction.

## Appropriate controls

- type scale and line-height within a reviewed interval;
- column span, max-width, gap and alignment;
- bounded x/y optical offsets;
- image treatment or motion variant from an enumerated set;
- text, line breaks and short labels tied to content ids;
- image replacement restricted to an authored folder inside `public/`;
- ordering of existing sections;
- inspection guides and motion pause.

Every exposed preview target also carries a semantic `data-rta-id`. This is a
review anchor for compiled output, not permission to write arbitrary edited
HTML back into Astro source.

Controls that describe the same visible target may share its `preview_id`.
Group only controls that truly affect that target; do not attach whole-page
settings merely to make them easier to find.

## Controls that cross the boundary

- drawing arbitrary boxes;
- unrestricted element dragging;
- arbitrary CSS properties or selectors;
- adding unknown components or scripts;
- editing production data without a content path;
- browsing arbitrary filesystem paths or accepting image URLs;
- changing navigation destinations, commerce or forms without domain validation.

Free dragging optimizes one viewport by breaking another. Represent movement as
grid intent, alignment, span, order or a small bounded optical offset instead.
