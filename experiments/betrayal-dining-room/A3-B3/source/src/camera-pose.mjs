export const inspectionControls = Object.freeze({
  enableDamping: true, dampingFactor: .08, minZoom: .55, maxZoom: 2.7,
  minPolarAngle: .001, maxPolarAngle: Math.PI * .47,
});

/** Consume residual OrbitControls motion before applying an exact inspection pose.
 * This deliberately uses public controls APIs, not private spherical/pan fields.
 */
export function applyCameraPose(camera, controls, preset, resize) {
  const damping = controls.enableDamping;
  const autoRotate = controls.autoRotate;
  controls.enableDamping = false;
  controls.autoRotate = false;
  try {
    controls.update();
    camera.position.fromArray(preset.position);
    controls.target.fromArray(preset.target);
    camera.zoom = 1;
    resize();
    controls.update();
  } finally {
    controls.enableDamping = damping;
    controls.autoRotate = autoRotate;
  }
}
