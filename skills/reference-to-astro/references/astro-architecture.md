# Astro Architecture

## Default

Use Astro for page composition and static content.

## Hydration decision

Ask for every interactive component:

Does this require persistent browser-side state?

NO:
Use `.astro` + CSS + optional lightweight script.

YES:
Consider an island.

## Client directive policy

Use `client:load` only for UI required immediately.

Prefer `client:idle` for secondary interaction.

Prefer `client:visible` for expensive below-the-fold UI.

Do not hydrate static display components.

## Preferred hierarchy

Astro
CSS
Vanilla TypeScript
GSAP
Interactive island
WebGL

Each step must be justified before moving down the hierarchy.

## Routing

Use filesystem routing unless requirements justify more complexity.

## Page transitions

First evaluate native View Transitions.

Use ClientRouter when navigation interception, persistence, or more advanced
transition control is required.

With ClientRouter, three things change and each breaks something if ignored:

- **Scripts.** Bundled module scripts run once, not per navigation. Initialize
  behavior inside an `astro:page-load` handler — it fires on first load and on
  every navigation afterwards. `data-astro-rerun` forces an inline script to
  re-execute.
- **Teardown.** Use `astro:before-swap` to kill animations, observers and
  animation frames belonging to the outgoing page. Without it, every navigation
  leaves another live listener set behind.
- **Persistence.** `transition:persist` keeps an element and its state across
  navigation — a playing video, a WebGL canvas, an audio player. Anything
  persisted must be excluded from teardown.

Match elements across routes with `transition:name`, and choose behavior with
`transition:animate`. The router announces route changes to assistive
technology and disables its own animations under `prefers-reduced-motion`; a
custom transition has to do both itself.

Do not convert the site into an SPA by default. Reach for ClientRouter because
the reference's navigation continuity requires it — persistent media, an
uninterrupted background, preserved scroll — not because transitions are
desirable in general.

## Assets

Prefer Astro asset handling for local imagery where appropriate.

Preserve focal points and crop behavior.

## Styling

Prefer CSS custom properties for genuine shared tokens.

Do not introduce Tailwind unless requested or already present.

## Framework islands

React/Svelte/Vue should only be introduced if they simplify genuinely
stateful interaction.

Do not create framework islands solely to animate elements.
