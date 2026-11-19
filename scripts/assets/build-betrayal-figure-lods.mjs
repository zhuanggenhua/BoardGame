import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { BufferAttribute, BufferGeometry } from 'three';
import { simplifyIndices } from './simplify-betrayal-geometry.mjs';

const models = fileURLToPath(new URL('../../public/betrayal-models/', import.meta.url));
const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } });
const destination = values['output-dir'] ? resolve(values['output-dir']) : models;
await mkdir(destination, { recursive: true });
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);

const compression = 'EXT_meshopt_compression';
const types = { 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

function readAttribute(gltf, binary, accessorId, size) {
    const accessor = gltf.accessors[accessorId];
    const view = gltf.bufferViews[accessor.bufferView];
    const ArrayType = types[accessor.componentType];
    const stride = ArrayType?.BYTES_PER_ELEMENT * size;
    const offset = accessor.byteOffset ?? 0;
    const encoded = view.extensions?.[compression];
    let bytes;
    if (encoded) {
        if (encoded.buffer !== 0 || encoded.byteStride !== stride) throw Error('Unsupported packed figure attribute');
        bytes = new Uint8Array(encoded.count * stride);
        const asset = binary.subarray(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
        MeshoptDecoder.decodeGltfBuffer(bytes, encoded.count, stride, asset, encoded.mode, encoded.filter);
    } else {
        if (view.buffer !== 0 || (view.byteStride && view.byteStride !== stride)) throw Error('Unsupported figure buffer layout');
        const start = view.byteOffset ?? 0;
        bytes = binary.subarray(start, start + view.byteLength);
    }
    return new BufferAttribute(new ArrayType(bytes.buffer, bytes.byteOffset + offset, accessor.count * size), size);
}

function buildTableScene(original, file) {
    const end = 20 + original.readUInt32LE(12);
    const gltf = JSON.parse(original.toString('utf8', 20, end));
    if (gltf.scenes.some(scene => scene.name === 'table')) return original;
    const scene = gltf.scenes[gltf.scene ?? 0];
    const node = gltf.nodes[scene.nodes[0]];
    const mesh = gltf.meshes[node.mesh];
    if (scene.nodes.length !== 1 || node.children?.length || !mesh) throw Error(`Expected one figure mesh in ${file}`);
    const binary = original.subarray(end + 8, end + 8 + gltf.buffers[0].byteLength);
    const chunks = [binary, Buffer.alloc((4 - binary.length % 4) % 4)];
    let byteLength = chunks[0].length + chunks[1].length;
    let fallbackId = gltf.buffers.findIndex(buffer => buffer.extensions?.[compression]?.fallback);
    if (fallbackId === -1) {
        fallbackId = gltf.buffers.push({ byteLength: 0, extensions: { [compression]: { fallback: true } } }) - 1;
    }
    const fallback = gltf.buffers[fallbackId];
    const baseTriangles = mesh.primitives.reduce((sum, primitive) => sum + gltf.accessors[primitive.indices].count / 3, 0);
    const budget = file === 'monster-mummy.glb' ? 3500 : file.startsWith('monster-')
        ? Math.min(3000, Math.round(baseTriangles * .72)) : 7000;
    const ratio = Math.min(1, budget / baseTriangles);
    let tableTriangles = 0;

    const primitives = mesh.primitives.map(primitive => {
        const geometry = new BufferGeometry();
        const { POSITION, NORMAL, TEXCOORD_0 } = primitive.attributes;
        geometry.setAttribute('position', readAttribute(gltf, binary, POSITION, 3));
        geometry.setAttribute('normal', readAttribute(gltf, binary, NORMAL, 3));
        geometry.setAttribute('uv', readAttribute(gltf, binary, TEXCOORD_0, 2));
        geometry.setIndex(readAttribute(gltf, binary, primitive.indices, 1));
        const indices = simplifyIndices(geometry, Math.max(4, Math.floor(geometry.index.count / 3 * ratio)));
        tableTriangles += indices.length / 3;
        if (indices === geometry.index.array) return primitive;

        // Both scenes reuse the position, normal, UV and material accessors. Only the index buffer is added.
        const array = geometry.getAttribute('position').count <= 65535 ? Uint16Array.from(indices) : indices;
        const stride = array.BYTES_PER_ELEMENT;
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        const encoded = MeshoptEncoder.encodeGltfBuffer(bytes, array.length, stride, 'TRIANGLES');
        const view = gltf.bufferViews.push({
            buffer: fallbackId, byteOffset: fallback.byteLength, byteLength: bytes.length,
            extensions: {
                [compression]: { buffer: 0, byteOffset: byteLength, byteLength: encoded.length, byteStride: stride, count: array.length, mode: 'TRIANGLES' },
            },
        }) - 1;
        const padding = Buffer.alloc((4 - encoded.length % 4) % 4);
        chunks.push(encoded, padding);
        byteLength += encoded.length + padding.length;
        fallback.byteLength += Math.ceil(bytes.length / 4) * 4;
        const accessor = gltf.accessors.push({ bufferView: view, componentType: stride === 2 ? 5123 : 5125, count: array.length, type: 'SCALAR' }) - 1;
        return { ...primitive, indices: accessor };
    });
    if (tableTriangles >= baseTriangles) throw Error(`The table mesh did not reduce ${file}`);
    const tableMesh = gltf.meshes.push({ ...mesh, primitives, name: 'Table mesh' }) - 1;
    const tableNode = gltf.nodes.push({ ...node, mesh: tableMesh, name: 'Table figure' }) - 1;
    gltf.scenes.push({ name: 'table', nodes: [tableNode] });
    gltf.buffers[0].byteLength = byteLength;
    gltf.extensionsUsed = [...new Set([...(gltf.extensionsUsed ?? []), compression])];
    gltf.extensionsRequired = [...new Set([...(gltf.extensionsRequired ?? []), compression])];

    const json = Buffer.from(JSON.stringify(gltf));
    const padding = Buffer.alloc((4 - json.length % 4) % 4, 0x20);
    const header = Buffer.from(original.subarray(0, 20));
    header.writeUInt32LE(28 + json.length + padding.length + byteLength, 8);
    header.writeUInt32LE(json.length + padding.length, 12);
    const binaryHeader = Buffer.from(original.subarray(end, end + 8));
    binaryHeader.writeUInt32LE(byteLength, 0);
    console.log(`${file}: ${baseTriangles} → ${tableTriangles} triangles`);
    return Buffer.concat([header, json, padding, binaryHeader, ...chunks]);
}

for (const file of (await readdir(models)).filter(file => file.endsWith('.glb'))) {
    const source = join(models, file);
    const original = await readFile(source);
    const packed = buildTableScene(original, file);
    if (packed !== original || destination !== models) await writeFile(join(destination, file), packed);
}
