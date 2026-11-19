import { MeshoptSimplifier } from 'meshoptimizer';
import { BufferAttribute } from 'three';

await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;

export function simplifyIndices(geometry, targetTriangles) {
    const index = geometry.index;
    if (!targetTriangles || index.count <= targetTriangles * 3) return index.array;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    const attributes = new Float32Array(position.count * 5);
    const locked = new Uint8Array(position.count);
    const extrema = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < position.count; i++) {
        attributes.set(normal.array.subarray(i * 3, i * 3 + 3), i * 5);
        attributes.set(uv.array.subarray(i * 2, i * 2 + 2), i * 5 + 3);
        for (let axis = 0; axis < 3; axis++) {
            const coordinate = position.array[i * 3 + axis];
            if (coordinate < position.array[extrema[axis] * 3 + axis]) extrema[axis] = i;
            if (coordinate > position.array[extrema[axis + 3] * 3 + axis]) extrema[axis + 3] = i;
        }
    }
    // Preserve the fit and the resting height used by the game board.
    extrema.forEach(vertex => { locked[vertex] = 1; });
    const [indices] = MeshoptSimplifier.simplifyWithAttributes(
        Uint32Array.from(index.array), position.array, 3, attributes, 5,
        [.1, .1, .1, .5, .5], locked, targetTriangles * 3, .02,
    );
    return indices;
}

export function reduceTriangles(geometry, targetTriangles) {
    const indices = simplifyIndices(geometry, targetTriangles);
    if (indices === geometry.index.array) return;
    const [remap, vertexCount] = MeshoptSimplifier.compactMesh(indices);
    for (const name of ['position', 'normal', 'uv']) {
        const attribute = geometry.getAttribute(name);
        const packed = new Float32Array(vertexCount * attribute.itemSize);
        for (let old = 0; old < remap.length; old++) {
            if (remap[old] === 0xffffffff) continue;
            const offset = old * attribute.itemSize;
            packed.set(attribute.array.subarray(offset, offset + attribute.itemSize), remap[old] * attribute.itemSize);
        }
        geometry.setAttribute(name, new BufferAttribute(packed, attribute.itemSize));
    }
    geometry.setIndex(new BufferAttribute(vertexCount <= 65535 ? Uint16Array.from(indices) : indices, 1));
}
