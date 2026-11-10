/** 从运行时唯一图集帧配置生成原分辨率放大单卡；默认只核对，--write 仅创建缺失文件。 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { getCardAtlasSource } from '../../src/components/common/media/cardAtlasRegistry';
import { QIDAHEN_INSPECT_ATLASES } from '../../src/games/qidahen/ui/inspectAtlas';

const writeMissing = process.argv.includes('--write');
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const assets: Array<{ path: string; sha256: string; width: number; height: number }> = [];
for (const [atlasId, prefix] of Object.entries(QIDAHEN_INSPECT_ATLASES)) {
    const source = getCardAtlasSource(atlasId, 'zh-CN');
    if (!source || !('frames' in source.config)) throw new Error(`Missing explicit atlas frames: ${atlasId}`);
    const original = resolve('public/assets/i18n/zh-CN', `${source.image}.jpg`);
    const metadata = await sharp(original).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`Invalid atlas: ${original}`);
    for (const [index, frame] of source.config.frames.entries()) {
        const left = Math.round(frame.x), top = Math.round(frame.y);
        const width = Math.min(metadata.width, Math.round(frame.x + frame.width)) - left;
        const height = Math.min(metadata.height, Math.round(frame.y + frame.height)) - top;
        const relative = `${prefix.replace(/\/([^/]+)$/, '/compressed/$1')}-${index}.webp`;
        const output = resolve('public/assets/i18n/zh-CN', relative);
        const bytes = await sharp(original).extract({ left, top, width, height }).webp({ quality: 90, effort: 4 }).toBuffer();
        if (existsSync(output)) {
            if (hash(readFileSync(output)) !== hash(bytes)) throw new Error(`Existing inspect card differs; not overwritten: ${output}`);
        } else {
            if (!writeMissing) throw new Error(`Missing inspect card: ${output}`);
            mkdirSync(dirname(output), { recursive: true });
            writeFileSync(output, bytes, { flag: 'wx' });
        }
        assets.push({ path: output, sha256: hash(bytes), width, height });
    }
}
console.log(JSON.stringify({ status: 'PASS', count: assets.length, mode: writeMissing ? 'create-missing' : 'verify', assets }));
