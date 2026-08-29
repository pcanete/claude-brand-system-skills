# WebGL Policy

WebGL is evidence-driven.

## Valid reasons

Use WebGL when evidence shows:

- shader distortion
- GPU image transition
- displacement
- particle system
- true 3D object/scene
- depth-aware spatial interaction
- custom canvas renderer
- postprocessing
- texture-based warping

## Invalid reasons

Do not use WebGL because:

- the reference is an award site
- the site feels experimental
- Three.js would look impressive
- a visually complex effect has not been technically identified

## Architecture

Keep WebGL isolated from document semantics.

HTML remains responsible for:

- content
- SEO
- navigation
- accessibility

Canvas is an enhancement layer.

## Color and light

A correctly loaded model that looks dark, flat or washed out is almost always a
colour-management problem, not a lighting one. Before adding lights to
compensate — which is how a scene ends up looking wrong in a different way —
check the pipeline:

- `renderer.outputColorSpace` should be `THREE.SRGBColorSpace`.
- `renderer.toneMapping` maps HDR values into displayable range.
  `ACESFilmicToneMapping` is the common filmic choice; `AgXToneMapping` and
  `NeutralToneMapping` are also available and preserve saturation differently.
  Adjust with `toneMappingExposure`.
- Texture colour space: colour and emissive maps are `SRGBColorSpace`; data
  maps — normal, roughness, metalness, AO — are `LinearSRGBColorSpace`.
  A normal map tagged as sRGB produces subtly wrong shading everywhere.
- A PBR model needs an environment to reflect. Without one it reads as plastic
  regardless of the lights added.

Tone mapping is an art-direction decision as much as a technical one. When the
reference's rendering has a distinct character, say so in the fidelity notes
rather than treating the default as neutral.

## Payload

GPU work is not the usual bottleneck; download and parse are.

- Compress geometry (Draco or meshopt) and textures (KTX2/Basis, which also
  stays compressed in GPU memory).
- Size textures to their on-screen footprint. A 4K map on a model occupying a
  third of the viewport costs memory and buys nothing.
- Load the scene after the page is usable. A WebGL bundle that blocks first
  paint fails the reconstruction even when the scene is perfect.

## Runtime

- Cap the pixel ratio, typically at 2. Uncapped DPR on a modern phone renders
  several times the pixels the screen can show.
- Stop the render loop when the canvas leaves the viewport and on
  `visibilitychange`. An always-running loop drains battery and shows up as
  scroll jank elsewhere on the page.
- Handle context loss: `webglcontextlost` fires on mobile under memory
  pressure, and a scene that never restores leaves a blank hole.
- Dispose geometries, materials and textures when a scene is torn down —
  including on client-side navigation.

## Fallback

Every WebGL feature needs:

- reduced-motion behavior
- no-WebGL fallback
- mobile performance consideration

The fallback is content, not an error state: a still frame of the scene, a
poster image, or the composition without the effect. Decide what it is before
building the effect, not after QA finds a blank canvas.
