# Demo catalog

Choose the smallest set that exposes the reference's distinctive behavior.

| Kind | Use for |
| --- | --- |
| `typography` | scale, hierarchy, wrapping, case and rhythm |
| `hover-label` | rolling, scrambling or swapping label states |
| `navigation` | persistent header and overlay menu states |
| `marquee` | continuous horizontal tracks and speed changes |
| `scroll-reveal` | opacity, color or position linked to scroll |
| `sticky-stack` | cards that enter and accumulate while scrolling |
| `parallax` | media moving at different scroll ratios |
| `loader` | initial progress or staged entry |
| `filter` | category filtering and active states |
| `media-sequence` | ordered or rapid image/object progression |
| `drag-surface` | direct manipulation without claiming WebGL |
| `fullscreen` | media expansion and dismissal |

`config` is data, never executable code. Common keys are `items`, `labels`,
`duration_ms`, `speed_px_s`, `distance_px`, `ratio`, and `direction`.

`typography` also reads `sizes_px`, `line_height_px` and `tracking_px`: arrays
parallel to `items`. When `sizes_px` is present and complete, the demo renders
those exact values and prints the ratio between consecutive levels. Declare them
whenever the scan measured them — a demo that cites a typographic record as its
source and then renders a scale of its own invites approval of something nobody
measured. Without them the demo falls back to an adaptive scale and says so on
screen.

When exact values were not measured, choose a conservative adaptive value and
say so in the demo `note`. Do not make the adaptive value look observed.

