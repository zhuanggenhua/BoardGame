import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { MeshoptEncoder } from 'meshoptimizer';
import { BufferAttribute, BufferGeometry } from 'three';
import sharp from 'sharp';
import { reduceTriangles } from './simplify-betrayal-geometry.mjs';

const { positionals: [input], values } = parseArgs({
    allowPositionals: true,
    options: { triangles: { type: 'string' }, output: { type: 'string' } },
});
if (!input) throw new Error('Supply the WorkBuddy mummy GLB path');
const budget = values.triangles === undefined ? 6000 : Number(values.triangles);
if (!Number.isSafeInteger(budget) || budget < 0) throw new Error('Expected a non-negative triangle budget');

const original = await readFile(input);
const jsonSize = original.readUInt32LE(12);
const binOffset = 28 + jsonSize;
const model = JSON.parse(original.toString('utf8', 20, 20 + jsonSize));
if (original.toString('ascii', 0, 4) !== 'glTF' || model.buffers.length !== 1 || model.buffers[0].uri) {
    throw new Error('Expected a self-contained GLB');
}

function readGeometry() {
    if (model.meshes.length !== 1 || model.meshes[0].primitives.length !== 1) {
        throw new Error('Expected the trimmed mummy to contain one mesh primitive');
    }
    const { attributes, indices, mode = 4 } = model.meshes[0].primitives[0];
    if (mode !== 4 || indices === undefined || Object.keys(attributes).length !== 3) {
        throw new Error('Expected indexed mummy triangles with position, normal and UV');
    }
    const geometry = new BufferGeometry();
    const accessors = Object.entries({ position: attributes.POSITION, normal: attributes.NORMAL, uv: attributes.TEXCOORD_0, index: indices });
    const indexTypes = { 5123: Uint16Array, 5125: Uint32Array };
    for (const [name, id] of accessors) {
        const accessor = model.accessors[id];
        if (!accessor) throw new Error(`Missing mummy ${name} accessor`);
        const view = model.bufferViews[accessor.bufferView];
        const arrayType = (name === 'index' ? indexTypes : { 5126: Float32Array })[accessor.componentType];
        const itemSizes = { SCALAR: 1, VEC2: 2, VEC3: 3 };
        const itemSize = itemSizes[accessor.type];
        if (!arrayType || !itemSize || view.byteStride || view.extensions || accessor.sparse || accessor.normalized) {
            throw new Error(`Unsupported mummy ${name} accessor`);
        }
        const offset = original.byteOffset + binOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        const array = new arrayType(original.buffer, offset, accessor.count * itemSize);
        const attribute = new BufferAttribute(array, itemSize);
        if (name === 'index') geometry.setIndex(attribute);
        else geometry.setAttribute(name, attribute);
    }
    reduceTriangles(geometry, budget);
    if (budget && geometry.index.count / 3 > budget) throw new Error(`Mummy did not reach ${budget} triangles`);
    geometry.computeBoundingBox();
    const views = new Map();
    for (const [name, id] of accessors) {
        const accessor = model.accessors[id];
        const attribute = name === 'index' ? geometry.index : geometry.getAttribute(name);
        delete accessor.byteOffset;
        accessor.count = attribute.count;
        if (name === 'position') {
            accessor.min = geometry.boundingBox.min.toArray();
            accessor.max = geometry.boundingBox.max.toArray();
        }
        if (name === 'index') accessor.componentType = attribute.array instanceof Uint16Array ? 5123 : 5125;
        views.set(accessor.bufferView, { attribute, indices: name === 'index' });
    }
    return { views, triangles: geometry.index.count / 3 };
}

await MeshoptEncoder.ready;
const { views, triangles } = readGeometry();
const imageViews = new Map(model.images.map(image => [image.bufferView, image]));
const packed = [];
let byteLength = 0;
let fallbackLength = 0;
for (const [index, view] of model.bufferViews.entries()) {
    const begin = binOffset + (view.byteOffset ?? 0);
    let bytes = original.subarray(begin, begin + view.byteLength);
    const image = imageViews.get(index);
    const mesh = views.get(index);
    if (image) {
        bytes = await sharp(bytes).resize({ width: 1024, height: 1024, fit: 'inside' }).webp({ quality: 88 }).toBuffer();
        image.mimeType = 'image/webp';
        view.byteOffset = byteLength;
        view.byteLength = bytes.length;
    } else if (mesh) {
        const { attribute, indices } = mesh;
        const { array, count, itemSize } = attribute;
        const stride = itemSize * array.BYTES_PER_ELEMENT;
        const mode = indices ? 'TRIANGLES' : 'ATTRIBUTES';
        const raw = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        bytes = MeshoptEncoder.encodeGltfBuffer(raw, count, stride, mode);
        model.bufferViews[index] = {
            buffer: 1, byteOffset: fallbackLength, byteLength: raw.length,
            ...(indices ? {} : { byteStride: stride }),
            extensions: {
                EXT_meshopt_compression: { buffer: 0, byteOffset: byteLength, byteLength: bytes.length, byteStride: stride, count, mode },
            },
        };
        fallbackLength += Math.ceil(raw.length / 4) * 4;
    } else {
        throw new Error(`Unexpected mummy buffer view ${index}`);
    }
    const padding = Buffer.alloc((4 - bytes.length % 4) % 4);
    packed.push(bytes, padding);
    byteLength += bytes.length + padding.length;
}
for (const texture of model.textures) {
    texture.extensions = { ...texture.extensions, EXT_texture_webp: { source: texture.source } };
    delete texture.source;
}
model.extensionsUsed = [...new Set([...(model.extensionsUsed ?? []), 'EXT_texture_webp', 'EXT_meshopt_compression'])];
model.extensionsRequired = [...new Set([...(model.extensionsRequired ?? []), 'EXT_texture_webp', 'EXT_meshopt_compression'])];
model.buffers[0].byteLength = byteLength;
model.buffers.push({ byteLength: fallbackLength, extensions: { EXT_meshopt_compression: { fallback: true } } });

const json = Buffer.from(JSON.stringify(model));
const jsonPadding = Buffer.alloc((4 - json.length % 4) % 4, 0x20);
const header = Buffer.alloc(20);
header.write('glTF');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + jsonPadding.length + byteLength, 8);
header.writeUInt32LE(json.length + jsonPadding.length, 12);
header.write('JSON', 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(byteLength);
binHeader.write('BIN\0', 4);

const result = Buffer.concat([header, json, jsonPadding, binHeader, ...packed]);
await writeFile(values.output ?? new URL('../../public/betrayal-models/monster-mummy.glb', import.meta.url), result);
console.log(`木乃伊 GLB ${triangles} triangles, ${original.length} → ${result.length} bytes`);
