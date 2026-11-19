import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeshoptEncoder } from 'meshoptimizer';
import { Box3, Vector3 } from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const source = fileURLToPath(new URL('../../artifacts/betrayal-3d-prototype/public/betrayal-3d/', import.meta.url));
const destination = fileURLToPath(new URL('../../public/betrayal-models/', import.meta.url));
const explorerIds = [
    'anita-hernandez', 'jaden-jones', 'beat-box-bowen', 'michelle-monroe',
    'persephone-puleri', 'josef-hooper', 'dan-nguyen-md', 'stephanie-richter',
    'isa-valencia', 'father-warren-leung', 'oliver-swift', 'sammy-angler',
];

await MeshoptEncoder.ready;
await mkdir(destination, { recursive: true });
const entries = JSON.parse(await readFile(join(source, 'characters.json'), 'utf8'));
if (entries.length !== explorerIds.length) throw new Error('Unexpected Betrayal model catalog');

for (const [index, entry] of entries.entries()) {
    if (entry.mesh !== `character-${index}.obj`) throw new Error(`Unexpected model at index ${index}`);
    const object = new OBJLoader().parse(await readFile(join(source, entry.mesh), 'utf8'));
    const bounds = new Box3();
    object.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.geometry.rotateX(-Math.PI / 2);
        mesh.geometry.rotateY(entry.rotationY * Math.PI / 180);
        mesh.geometry.computeBoundingBox();
        bounds.union(mesh.geometry.boundingBox);
    });
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const scale = 1 / size.y;
    const extensions = ['EXT_meshopt_compression', 'EXT_texture_webp'];
    const gltf = {
        asset: { version: '2.0', generator: 'BoardGame Betrayal OBJ export' },
        extensionsUsed: extensions, extensionsRequired: extensions,
        scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [] }], materials: [],
        textures: [], images: [], accessors: [], bufferViews: [], buffers: [],
    };
    const chunks = [];
    let offset = 0;
    let uncompressedLength = 0;
    const append = bytes => {
        const position = offset;
        chunks.push(bytes, Buffer.alloc((4 - bytes.byteLength % 4) % 4));
        offset += Math.ceil(bytes.byteLength / 4) * 4;
        return position;
    };
    const texture = async filename => {
        const bytes = await readFile(join(source, filename));
        const bufferView = gltf.bufferViews.push({
            buffer: 0, byteOffset: append(bytes), byteLength: bytes.byteLength,
        }) - 1;
        const image = gltf.images.push({ bufferView, mimeType: 'image/webp' }) - 1;
        return { index: gltf.textures.push({ extensions: { EXT_texture_webp: { source: image } } }) - 1 };
    };
    gltf.materials.push({
        pbrMetallicRoughness: {
            baseColorTexture: await texture(entry.texture),
            metallicFactor: 0, roughnessFactor: 0.86,
        },
        normalTexture: await texture(entry.normal),
        occlusionTexture: await texture(entry.occlusion),
        emissiveTexture: await texture(entry.emissive),
        emissiveFactor: [0.35, 0.35, 0.35],
    });
    const accessor = (attribute, type, limits = {}) => {
        const indices = type === 'SCALAR';
        const stride = attribute.array.BYTES_PER_ELEMENT * attribute.itemSize;
        const bytes = new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
        const mode = indices ? 'TRIANGLES' : 'ATTRIBUTES';
        const compressed = MeshoptEncoder.encodeGltfBuffer(bytes, attribute.count, stride, mode);
        const bufferView = gltf.bufferViews.push({
            buffer: 1, byteOffset: uncompressedLength, byteLength: bytes.byteLength,
            ...(indices ? {} : { byteStride: stride }),
            extensions: {
                EXT_meshopt_compression: {
                    buffer: 0, byteOffset: append(compressed), byteLength: compressed.byteLength,
                    byteStride: stride, count: attribute.count, mode,
                },
            },
        }) - 1;
        uncompressedLength += Math.ceil(bytes.byteLength / 4) * 4;
        const componentType = indices ? (stride === 2 ? 5123 : 5125) : 5126;
        return gltf.accessors.push({ bufferView, componentType, count: attribute.count, type, ...limits }) - 1;
    };
    object.traverse(mesh => {
        if (!mesh.isMesh) return;
        const geometry = mesh.geometry;
        geometry.translate(-center.x, -bounds.min.y, -center.z).scale(scale, scale, scale);
        const uv = geometry.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
        const indexed = mergeVertices(geometry, 0.000001);
        indexed.computeBoundingBox();
        gltf.meshes[0].primitives.push({
            attributes: {
                POSITION: accessor(indexed.getAttribute('position'), 'VEC3', {
                    min: indexed.boundingBox.min.toArray(), max: indexed.boundingBox.max.toArray(),
                }),
                NORMAL: accessor(indexed.getAttribute('normal'), 'VEC3'),
                TEXCOORD_0: accessor(indexed.getAttribute('uv'), 'VEC2'),
            },
            indices: accessor(indexed.index, 'SCALAR'),
            material: 0,
        });
    });
    gltf.buffers.push({ byteLength: offset }, {
        byteLength: uncompressedLength,
        extensions: { EXT_meshopt_compression: { fallback: true } },
    });
    const json = Buffer.from(JSON.stringify(gltf));
    const jsonLength = Math.ceil(json.length / 4) * 4;
    const header = Buffer.alloc(20);
    header.write('glTF');
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(28 + jsonLength + offset, 8);
    header.writeUInt32LE(jsonLength, 12);
    header.write('JSON', 16);
    const binary = Buffer.alloc(8);
    binary.writeUInt32LE(offset);
    binary.write('BIN\0', 4);
    const result = Buffer.concat([header, json, Buffer.alloc(jsonLength - json.length, 0x20), binary, ...chunks]);
    await writeFile(join(destination, `${explorerIds[index]}.glb`), result);
    console.log(`${explorerIds[index]}: ${Math.round(result.byteLength / 1024)} KiB`);
}
