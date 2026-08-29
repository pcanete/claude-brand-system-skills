# WebGL Detection

Checkpoint v0.3.

WebGL is evidence-driven.

Separate:

1. observed visual behavior
2. runtime evidence
3. technology hypothesis

Possible evidence:

- canvas element
- WebGL rendering context
- shader-like distortion
- true 3D perspective/manipulation
- GPU particle systems
- texture-based image deformation
- post-processing
- source/runtime signatures

Do not infer WebGL merely because a site is visually sophisticated.

Possible alternative explanations include:

- CSS transforms
- DOM animation
- SVG
- Canvas 2D
- video
- image sequences

Set `webgl.required = true` only when evidence supports GPU-rendered behavior
as necessary for faithful reconstruction.
