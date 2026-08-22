# Likeness Maximization (Projection-First Pipeline)

Use this reference when the goal is maximum resemblance to a specific person or character in a single reference image, not a generic stylized character. This is the default high-likeness path for the `character` domain; `character/reconstruction.md` covers the fallback stylized/freehand path when the input is weak or the user accepts approximation.

This file is the executable reference for the high-likeness path. `docs/UPGRADE_PLAN.md` is only archived background and must not be used as a second spec.

## Why Freehand Sculpting Cannot Reach High Likeness

Hand-authored primitives (capsules, spheres, blend shapes tuned by eye) can approximate proportions but cannot reproduce the exact geometry and surface information encoded in a photo. The two levers that actually move likeness are: (1) getting the mesh's shape and camera to align precisely with the photo, and (2) putting the photo's own pixels onto that mesh as texture. Everything else is secondary.

## Pipeline

### (a) Fit a parametric template to landmarks

Ship a lightweight, code-generated parametric humanoid/face template — a head-unit-parameterized body plus a morphable face, conceptually mirroring SMPL-X (body + hands + face, jaw/eye joints, linear blend skinning with corrective blendshapes) and FLAME (face-from-scans). This stays procedural: the template is code-generated and parameter-driven, never a downloaded art asset.

Fit template parameters (shape, pose, expression) by minimizing reprojection error between template landmarks and the observed 2D landmarks from `stage1_intake/extract_landmarks.py` — the SMPLify-X idea. Do not hand-place vertices; solve for parameters that make the template's projected landmarks match the image landmarks.

### (b) Camera match

Estimate and store focal length, FOV, and orientation for the reference photo (`forge/stage1_intake/solve_camera_pose.py`, emits a `referenceCamera` spec block). The render camera must match this so:

- the review screenshot can be pixel-overlaid against the source photo
- the texture projection in step (d) lands correctly

Without a matched camera, projected texture will misalign the moment the model is viewed from any angle other than the accidental one it was authored at.

### (c) De-light before treating the photo as albedo

A raw photo bakes in shadows, highlights, and ambient occlusion from whatever light was present when it was taken. Using it directly as albedo means the projected texture fights the new scene's lights. Run a de-lighting pass (`forge/stage1_intake/delight_albedo.py`) — high-pass/overlay neutralization at minimum, an AI delighter equivalent if available — to recover a neutral base color, then derive roughness/normal/AO independently. Treat "album must be free of baked lighting" as a hard requirement, not a nice-to-have.

### (d) Project and bake

Solve projective/camera-projection texturing from the matched camera (Three.js `ShaderMaterial`, or the `three-projected-material` approach) to map the de-lit reference onto the fitted mesh, then bake the result into the mesh's UVs (`forge/stage3_build/bake_projected_texture.py`, stdlib PNG) for the visible (front) side.

### (e) Infer unseen regions, flag confidence

Back/sides are not observed. Options, in order of preference:

1. request an additional view (`request-input`: front/side/back) — always try this first for a real person
2. mirror the front texture across the body's symmetry plane where anatomically valid (works reasonably for faces, poorly for asymmetric hair/clothing)
3. palette-continue from the nearest observed edge as a last resort

Every inferred region gets its own confidence score and a note of which strategy produced it. Never silently present an inferred back as if it were observed.

### (f) Rig for deformation

Emit a `SkinnedMesh` with a joint skeleton for the body plus morph targets/blend shapes for facial expression, exportable as glTF. Keep topology predictable (retopologized, evenly quaded around the face) so blendshapes deform cleanly. Expose skeleton and morph channels through `root.userData.sculptRuntime`.

## Part-Specific Notes (stylized-to-realistic dial)

Same recipes as `character/reconstruction.md`, dialed toward realism: skin keeps the warm-base/soft-roughness/rim-light approximation (true SSS is out of scope); hair still prefers stylized clumps over strand geometry — a single image cannot supply real hair microstructure, so do not oversell hair likeness; eyes get the glossy-sphere-plus-iris-decal treatment with a correct catchlight, which reads as more "alive" than raw geometric accuracy.

## Honesty Note

State plainly, every time this pipeline runs: a single image cannot yield a guaranteed 100 percent likeness. Back/sides, occluded geometry, and true skin/hair microstructure are not observable from one photo. This pipeline maximizes likeness through parametric fit + photo projection + de-lighting + camera match, reports per-region confidence, and requests additional views whenever the subject is a real person and fidelity matters. Never claim "100 percent match" as an output — report confidence per region instead.

An optional, explicitly-flagged `generativeAssist` mode may import an external image-to-3D base mesh. It is non-procedural, breaks the default code-only promise, and is never the silent default.
