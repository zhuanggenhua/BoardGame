import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const input = process.argv[2];
if (!input) throw new Error('Supply the WorkBuddy mummy GLB path');

const original = await readFile(input);
const jsonSize = original.readUInt32LE(12);
const binOffset = 28 + jsonSize;
const model = JSON.parse(original.toString('utf8', 20, 20 + jsonSize));
if (original.toString('ascii', 0, 4) !== 'glTF' || model.buffers.length !== 1 || model.buffers[0].uri) {
    throw new Error('Expected a self-contained GLB');
}

const imageViews = new Map(model.images.map(image => [image.bufferView, image]));
const packed = [];
let byteLength = 0;
for (const [index, view] of model.bufferViews.entries()) {
    const begin = binOffset + (view.byteOffset ?? 0);
    let bytes = original.subarray(begin, begin + view.byteLength);
    const image = imageViews.get(index);
    if (image) {
        bytes = await sharp(bytes).resize({ width: 1024, height: 1024, fit: 'inside' }).webp({ quality: 88 }).toBuffer();
        image.mimeType = 'image/webp';
    }
    view.byteOffset = byteLength;
    view.byteLength = bytes.length;
    const padding = Buffer.alloc((4 - bytes.length % 4) % 4);
    packed.push(bytes, padding);
    byteLength += bytes.length + padding.length;
}
for (const texture of model.textures) {
    texture.extensions = { ...texture.extensions, EXT_texture_webp: { source: texture.source } };
    delete texture.source;
}
model.extensionsUsed = [...new Set([...(model.extensionsUsed ?? []), 'EXT_texture_webp'])];
model.extensionsRequired = [...new Set([...(model.extensionsRequired ?? []), 'EXT_texture_webp'])];
model.buffers[0].byteLength = byteLength;

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
await writeFile(new URL('../../public/betrayal-models/monster-mummy.glb', import.meta.url), result);
console.log(`木乃伊 GLB ${original.length} → ${result.length} bytes`);
