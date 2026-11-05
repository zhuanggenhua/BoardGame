import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');

/** 用户点名原图核查只校验来源同一性，不承接产品视觉 PASS。 */
export function validateRequestedSourceReview({ manifestPath, imagePaths }) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.purpose !== 'user-requested-source-review'
        || typeof manifest.userRequest !== 'string' || !manifest.userRequest.trim()
        || manifest.productAcceptance !== 'not-claimed') {
        throw new Error('原图核查必须记录用户点名请求，并声明 productAcceptance=not-claimed');
    }
    if (!Array.isArray(manifest.media) || manifest.media.length !== imagePaths.length) {
        throw new Error('原图核查清单必须覆盖本次全部媒体');
    }
    const expected = new Set(imagePaths.map(file => path.resolve(file)));
    for (const item of manifest.media) {
        if (typeof item.file !== 'string' || typeof item.source !== 'string'
            || typeof item.description !== 'string' || !item.description.trim()) {
            throw new Error('原图核查条目必须包含 file、source 和说明');
        }
        const file = path.resolve(path.dirname(manifestPath), item.file);
        if (!expected.delete(file)) throw new Error('原图核查存在重复或范围外媒体');
        const source = path.resolve(path.dirname(manifestPath), item.source);
        if (!/^[a-f0-9]{64}$/.test(item.sha256) || sha256(source) !== item.sha256 || sha256(file) !== item.sha256) {
            throw new Error('原图核查来源或交付文件哈希不一致');
        }
    }
    return { mode: 'source-review', mediaCount: manifest.media.length, productAcceptance: 'not-claimed' };
}
