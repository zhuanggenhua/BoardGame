import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const REQUIRED_FIELDS = ['path', 'chainId', 'chainStep', 'sourceRun', 'sourceDir', 'description'];
const GENERIC_DESCRIPTIONS = new Set([
    '正常',
    '测试通过',
    '事件发生',
    '承接上一张',
    '承接上一主线步骤',
]);
const CHINESE_CHARACTERS = /[\u3400-\u9fff]/g;
const LATIN_LETTERS = /[A-Za-z]/;

const normalizePath = (value) => path.normalize(path.resolve(value));

const resolveMediaReference = (reference, { projectRoot, manifestDir, indexDir }) => {
    if (path.isAbsolute(reference)) return normalizePath(reference);
    const projectPath = normalizePath(path.resolve(projectRoot, reference));
    if (existsSync(projectPath)) return projectPath;
    const manifestPath = normalizePath(path.resolve(manifestDir, reference));
    if (existsSync(manifestPath)) return manifestPath;
    return normalizePath(path.resolve(indexDir, reference));
};

const assertString = (value, label) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`E2E 证据索引缺少 ${label}`);
    }
};

const assertChineseDescription = (description, index) => {
    assertString(description, `第 ${index + 1} 条媒体的 description`);
    const trimmed = description.trim();
    const chineseCount = trimmed.match(CHINESE_CHARACTERS)?.length ?? 0;
    if (chineseCount < 4) {
        throw new Error(`E2E 证据索引第 ${index + 1} 条 description 必须用中文描述画面（至少 4 个中文字符）`);
    }
    if (LATIN_LETTERS.test(trimmed)) {
        throw new Error(`E2E 证据索引第 ${index + 1} 条 description 必须只使用中文描述，不得包含英文字母: ${trimmed}`);
    }
    if (GENERIC_DESCRIPTIONS.has(trimmed)) {
        throw new Error(`E2E 证据索引第 ${index + 1} 条 description 不能是泛化说明: ${trimmed}`);
    }
    if (trimmed.includes('\n') || trimmed.includes('\r')) {
        throw new Error(`E2E 证据索引第 ${index + 1} 条 description 必须是一句话`);
    }
};

export const validateE2EImageIndex = ({ manifest, manifestPath, imagePaths = [], projectRoot }) => {
    if (manifest?.display?.finalPassBeforeOpen !== true) return null;

    assertString(manifest?.evidenceIndex, 'evidenceIndex');
    const resolvedManifestPath = normalizePath(manifestPath);
    const manifestDir = path.dirname(resolvedManifestPath);
    const indexPath = normalizePath(path.resolve(manifestDir, manifest.evidenceIndex));
    if (!existsSync(indexPath)) {
        throw new Error(`最终 PASS 缺少 .e2e-image-index.json: ${indexPath}`);
    }

    let index;
    try {
        index = JSON.parse(readFileSync(indexPath, 'utf8'));
    } catch (error) {
        throw new Error(`E2E 证据索引不是有效 JSON: ${indexPath}; ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!Array.isArray(index.media) || index.media.length === 0) {
        throw new Error(`E2E 证据索引 media 不能为空: ${indexPath}`);
    }

    const indexDir = path.dirname(indexPath);
    const mediaEntries = index.media;
    const seenPaths = new Set();
    const chains = new Map();
    for (const [entryIndex, entry] of mediaEntries.entries()) {
        for (const field of REQUIRED_FIELDS) assertString(entry?.[field], `第 ${entryIndex + 1} 条媒体的 ${field}`);
        assertChineseDescription(entry.description, entryIndex);
        const resolvedPath = resolveMediaReference(entry.path, { projectRoot, manifestDir, indexDir });
        if (!existsSync(resolvedPath)) {
            throw new Error(`E2E 证据索引引用的媒体不存在: ${entry.path}`);
        }
        const normalizedKey = normalizePath(resolvedPath);
        if (seenPaths.has(normalizedKey)) throw new Error(`E2E 证据索引存在重复媒体: ${entry.path}`);
        seenPaths.add(normalizedKey);

        const chain = chains.get(entry.chainId) ?? new Set();
        assertString(entry.stage, `第 ${entryIndex + 1} 条媒体的 stage`);
        chain.add(entry.stage.trim());
        chains.set(entry.chainId, chain);
    }

    const expectedStages = ['前态', '中态', '后态'];
    for (const [chainId, stages] of chains.entries()) {
        const missingStages = expectedStages.filter((stage) => !stages.has(stage));
        if (missingStages.length > 0) {
            throw new Error(`E2E 证据链 ${chainId} 缺少 ${missingStages.join('、')}，最终 PASS 必须有前态/中态/后态`);
        }
    }

    const manifestMedia = Array.isArray(manifest.media) ? manifest.media : manifest.images;
    if (!Array.isArray(manifestMedia) || manifestMedia.length === 0) {
        throw new Error('最终 PASS 缺少 media/images，无法与证据索引对账');
    }
    const expectedPaths = new Set(manifestMedia.map((reference) => normalizePath(resolveMediaReference(reference, { projectRoot, manifestDir, indexDir }))));
    for (const mediaPath of expectedPaths) {
        if (!existsSync(mediaPath)) {
            throw new Error(`PASS 清单引用的媒体不存在: ${mediaPath}`);
        }
    }
    if (expectedPaths.size !== seenPaths.size || [...expectedPaths].some((entry) => !seenPaths.has(entry))) {
        throw new Error('E2E 证据索引与 PASS 清单 media/images 未一一对应');
    }

    for (const imagePath of imagePaths) {
        if (!seenPaths.has(normalizePath(imagePath))) {
            throw new Error(`本次打开的媒体不在 E2E 证据索引中: ${imagePath}`);
        }
    }

    return { indexPath, mediaCount: mediaEntries.length, chainCount: chains.size };
};
