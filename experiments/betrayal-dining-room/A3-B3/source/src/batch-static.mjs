import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Merge only opaque, static leaves with identical material/render flags.
 * Each independently visible assembly owns its own batches. Transparent glasses
 * and switchable candle flames remain separate, so sorting and lighting work.
 * This changes submission count, not the authored room geometry or materials.
 */
export function batchStaticRoom(room) {
  const root = room.root;
  const boundaries = new Set([...room.walls, room.cutEdges]);
  const partitions = new Map([[root, []]]);
  for (const boundary of boundaries) partitions.set(boundary, []);
  root.updateMatrixWorld(true);
  function collect(object, partition) {
    if (boundaries.has(object)) partition = object;
    if (object instanceof THREE.Mesh && !Array.isArray(object.material)
      && !object.material.transparent && object.name !== 'candle-flame'
      && object.visible && object.children.length === 0
      && !object.isSkinnedMesh && !object.isInstancedMesh
      && Object.keys(object.geometry.morphAttributes).length === 0) {
      partitions.get(partition).push(object);
    }
    for (const child of object.children) collect(child, partition);
  }
  collect(root, root);
  let mergedInputs = 0, batches = 0;
  const discarded = new Set();
  for (const [partition, meshes] of partitions) {
    const buckets = new Map();
    const inverse = partition.matrixWorld.clone().invert();
    for (const object of meshes) {
      const attributes = Object.entries(object.geometry.attributes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, attribute]) => [name, attribute.itemSize, attribute.normalized, attribute.array.constructor.name]);
      const key = JSON.stringify([object.material.uuid, object.castShadow, object.receiveShadow,
        object.renderOrder, object.layers.mask, object.frustumCulled, attributes]);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(object);
    }
    for (const objects of buckets.values()) {
      if (objects.length < 2) continue;
      const geometries = objects.map(object => {
        const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        return geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      });
      const combined = mergeGeometries(geometries, false);
      geometries.forEach(geometry => geometry.dispose());
      if (!combined) throw new Error('Static geometry batch failed');
      combined.computeBoundingBox();
      combined.computeBoundingSphere();
      const first = objects[0];
      const batch = new THREE.Mesh(combined, first.material);
      batch.name = `static-batch-${partition.name}-${batches}`;
      batch.castShadow = first.castShadow;
      batch.receiveShadow = first.receiveShadow;
      batch.renderOrder = first.renderOrder;
      batch.layers.mask = first.layers.mask;
      batch.frustumCulled = first.frustumCulled;
      batch.userData.sourceMeshCount = objects.length;
      for (const object of objects) {
        discarded.add(object.geometry);
        object.removeFromParent();
      }
      partition.add(batch);
      mergedInputs += objects.length;
      batches++;
    }
  }
  // Do not free a geometry still used by a retained mesh.
  root.traverse(object => {if (object instanceof THREE.Mesh) discarded.delete(object.geometry);});
  discarded.forEach(geometry => geometry.dispose());
  root.updateMatrixWorld(true);
  return {mergedInputs, batches};
}
