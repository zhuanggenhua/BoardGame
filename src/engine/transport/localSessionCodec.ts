import { gzipSync, gunzipSync, strFromU8, strToU8 } from 'fflate';
import type { LocalMatchSnapshot } from './localSession';

const STORAGE_CODEC = 'gzip-base64-v1';
const LARGE_SNAPSHOT_CHARS = 1024 * 1024;

/** 大存档无损压缩；小存档保留旧格式，不删对局、随机游标或回退历史。 */
export function encodeLocalMatchSnapshot(snapshot: LocalMatchSnapshot): string {
    const plain = JSON.stringify(snapshot);
    if (plain.length < LARGE_SNAPSHOT_CHARS) return plain;
    const bytes = gzipSync(strToU8(plain), { level: 6, mtime: 0 });
    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
    }
    return JSON.stringify({ storageCodec: STORAGE_CODEC, payload: btoa(chunks.join('')) });
}

/** 明文v1继续兼容；损坏压缩数据交由原读取owner按同一坏存档语义拒绝。 */
export function decodeLocalMatchSnapshot(raw: string): unknown {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('storageCodec' in parsed) || parsed.storageCodec !== STORAGE_CODEC) return parsed;
    if (!('payload' in parsed) || typeof parsed.payload !== 'string') throw new Error('Invalid local snapshot encoding');
    const bytes = Uint8Array.from(atob(parsed.payload), char => char.charCodeAt(0));
    return JSON.parse(strFromU8(gunzipSync(bytes)));
}
