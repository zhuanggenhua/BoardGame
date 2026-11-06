import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/** 直接读取运行组件中的图片引用，避免维护第二份资源清单。 */
export async function verifyOperationGuideAssets(root = process.cwd()) {
    const source = fs.readFileSync(path.join(root, 'src/components/system/OperationGuidePanel.tsx'), 'utf8');
    const urls = [...source.matchAll(/src:\s*['"](\/images\/operation-guide\/[^'"]+)['"]/g)].map(match => match[1]);
    if (!urls.length) throw new Error('操作指南图片引用为空，构建检查需要跟随运行入口更新');
    for (const url of urls) {
        const bytes = fs.readFileSync(path.join(root, 'public', url));
        if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
            throw new Error(`操作指南需要真实图片，不能使用网页或占位文件：${url}`);
        }
        try {
            await sharp(bytes, { failOn: 'warning' }).raw().toBuffer();
        } catch (cause) {
            throw new Error(`操作指南图片无法完整解码：${url}`, { cause });
        }
    }
    return urls;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    console.log(`操作指南构建检查通过：${(await verifyOperationGuideAssets()).length} 张可完整解码图片`);
}
