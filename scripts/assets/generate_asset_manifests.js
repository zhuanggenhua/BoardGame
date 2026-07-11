import { createReadStream, promises as fs } from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANIFEST_NAME = 'assets-manifest.json';
const MANIFEST_VERSION = 1;
const DEFAULT_SCOPE = 'official';
const ASSETS_ROOT = path.resolve(__dirname, '../../public/assets');

const SKIP_TOP_LEVEL_DIRS = new Set(['demo', 'ugc', 'staging']);
const SKIP_DIR_NAMES = new Set(['.git', 'node_modules']);
const SKIP_FILE_NAMES = new Set([MANIFEST_NAME, '.DS_Store', 'Thumbs.db']);

const MIME_BY_EXT = {
    avif: 'image/avif',
    webp: 'image/webp',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ogg: 'audio/ogg',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    mp4: 'video/mp4',
    webm: 'video/webm',
    json: 'application/json',
};

const toPosixPath = (value) => value.split(path.sep).join('/');

const fileExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

const parseArgs = (argv) => {
    const options = { mode: 'generate', manifestMode: 'incremental', id: null, root: null, help: false };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--validate' || arg === '-v') {
            options.mode = 'validate';
            continue;
        }
        if (arg === '--full') {
            options.manifestMode = 'full';
            continue;
        }
        if (arg === '--incremental') {
            options.manifestMode = 'incremental';
            continue;
        }
        if (arg === '--id') {
            options.id = argv[i + 1] ?? null;
            i += 1;
            continue;
        }
        if (arg === '--root') {
            options.root = argv[i + 1] ?? null;
            i += 1;
            continue;
        }
        if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    }
    return options;
};

const printHelp = () => {
    console.log(`用法:
  node scripts/assets/generate_asset_manifests.js
  node scripts/assets/generate_asset_manifests.js --full
  node scripts/assets/generate_asset_manifests.js --validate
  node scripts/assets/generate_asset_manifests.js --validate --full
  node scripts/assets/generate_asset_manifests.js --id <gameId>
  node scripts/assets/generate_asset_manifests.js --validate --id <gameId>

默认模式为增量合并：
  - 扫描本地存在的资源并更新/新增对应 manifest 条目
  - 保留 manifest 中已有但本地缺失的条目，避免要求合作者下载全量服务器远程素材
  - 如需“本地完整镜像 -> 全量重建/严格校验”，显式传入 --full
`);
};

const resolveAssetDirs = async (root, targetId) => {
    if (targetId) {
        const dirPath = path.join(root, targetId);
        if (!(await fileExists(dirPath))) {
            throw new Error(`[Manifest] 资源目录不存在: ${dirPath}`);
        }
        return [{ id: targetId, dirPath }];
    }
    const dirents = await fs.readdir(root, { withFileTypes: true });
    return dirents
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .filter((name) => !name.startsWith('.') && !SKIP_TOP_LEVEL_DIRS.has(name))
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ id: name, dirPath: path.join(root, name) }));
};

const walkFiles = async (dirPath, out = []) => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIR_NAMES.has(entry.name)) continue;
            await walkFiles(fullPath, out);
            continue;
        }
        if (SKIP_FILE_NAMES.has(entry.name)) continue;
        out.push(fullPath);
    }
    return out;
};

const hashFile = (filePath) => new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => {
        bytes += chunk.length;
        hash.update(chunk);
    });
    stream.on('end', () => {
        resolve({ sha256: hash.digest('hex'), bytes });
    });
    stream.on('error', reject);
});

const getMimeType = (ext) => MIME_BY_EXT[ext] || 'application/octet-stream';

const resolveLogicalKey = (posixRelativePath) => {
    const lower = posixRelativePath.toLowerCase();
    if (lower.endsWith('.atlas.json')) {
        return { logicalKey: posixRelativePath, variantExt: 'json' };
    }
    const ext = path.posix.extname(lower);
    if (!ext) {
        throw new Error(`[Manifest] 资源缺少扩展名: ${posixRelativePath}`);
    }
    if (ext === '.json') {
        return { logicalKey: posixRelativePath, variantExt: 'json' };
    }
    return {
        logicalKey: posixRelativePath.slice(0, -ext.length),
        variantExt: ext.slice(1),
    };
};

const buildManifestFiles = async (dirPath) => {
    const files = await walkFiles(dirPath);
    const map = new Map();

    for (const filePath of files) {
        const relativePath = toPosixPath(path.relative(dirPath, filePath));
        const { logicalKey, variantExt } = resolveLogicalKey(relativePath);
        const variants = map.get(logicalKey) ?? new Map();
        if (variants.has(variantExt)) {
            throw new Error(`[Manifest] 重复变体: ${logicalKey}.${variantExt}`);
        }
        const { sha256, bytes } = await hashFile(filePath);
        variants.set(variantExt, { sha256, bytes, mime: getMimeType(variantExt) });
        map.set(logicalKey, variants);
    }

    const sortedKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    const filesObject = {};
    for (const key of sortedKeys) {
        const variantsMap = map.get(key);
        const variantKeys = Array.from(variantsMap.keys()).sort((a, b) => a.localeCompare(b));
        const variants = {};
        for (const ext of variantKeys) {
            variants[ext] = variantsMap.get(ext);
        }
        filesObject[key] = { variants };
    }
    return filesObject;
};

const buildManifest = async ({ id, dirPath }) => {
    const files = await buildManifestFiles(dirPath);
    return {
        manifestVersion: MANIFEST_VERSION,
        scope: DEFAULT_SCOPE,
        id,
        basePrefix: `official/${id}/`,
        files,
    };
};

const createEmptyManifest = (entry) => ({
    manifestVersion: MANIFEST_VERSION,
    scope: DEFAULT_SCOPE,
    id: entry.id,
    basePrefix: `official/${entry.id}/`,
    files: {},
});

const sortFilesObject = (files) => {
    const sorted = {};
    for (const key of Object.keys(files).sort((a, b) => a.localeCompare(b))) {
        sorted[key] = files[key];
    }
    return sorted;
};

const loadExistingManifest = async (entry) => {
    const manifestPath = path.join(entry.dirPath, MANIFEST_NAME);
    if (!(await fileExists(manifestPath))) {
        return null;
    }
    const content = await fs.readFile(manifestPath, 'utf8');
    return JSON.parse(content);
};

const buildIncrementalManifest = async (entry) => {
    const existing = await loadExistingManifest(entry);
    const local = await buildManifest(entry);
    const base = existing ?? createEmptyManifest(entry);
    return {
        ...base,
        manifestVersion: MANIFEST_VERSION,
        scope: DEFAULT_SCOPE,
        id: entry.id,
        basePrefix: `official/${entry.id}/`,
        files: sortFilesObject({
            ...(base.files && typeof base.files === 'object' ? base.files : {}),
            ...local.files,
        }),
    };
};

const generateManifest = async (entry, { full }) => {
    const manifest = full
        ? await buildManifest(entry)
        : await buildIncrementalManifest(entry);
    const outputPath = path.join(entry.dirPath, MANIFEST_NAME);
    await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`[Manifest] 已生成(${full ? 'full' : 'incremental'}): ${path.relative(process.cwd(), outputPath)}`);
};

const compareManifest = (entry, actual, expected, { full }) => {
    const errors = [];
    if (!Number.isInteger(actual.manifestVersion)) {
        errors.push(`[Manifest] manifestVersion 非整数: ${entry.id}`);
    }
    if (actual.scope !== DEFAULT_SCOPE) {
        errors.push(`[Manifest] scope 不一致: ${entry.id} (${actual.scope ?? 'missing'})`);
    }
    if (actual.id !== entry.id) {
        errors.push(`[Manifest] id 不一致: ${entry.id} (${actual.id ?? 'missing'})`);
    }
    const expectedBasePrefix = `official/${entry.id}/`;
    if (actual.basePrefix !== expectedBasePrefix) {
        errors.push(`[Manifest] basePrefix 不一致: ${entry.id} (${actual.basePrefix ?? 'missing'})`);
    }

    const actualFiles = actual.files && typeof actual.files === 'object' ? actual.files : {};
    const expectedFiles = expected.files;

    const actualKeys = Object.keys(actualFiles);
    const expectedKeys = Object.keys(expectedFiles);
    const missingKeys = full ? expectedKeys.filter((key) => !(key in actualFiles)) : [];
    const extraKeys = full ? actualKeys.filter((key) => !(key in expectedFiles)) : [];

    if (missingKeys.length) {
        errors.push(`[Manifest] 缺少资源键: ${entry.id} -> ${missingKeys.join(', ')}`);
    }
    if (extraKeys.length) {
        errors.push(`[Manifest] 多余资源键: ${entry.id} -> ${extraKeys.join(', ')}`);
    }

    for (const key of expectedKeys) {
        if (!actualFiles[key]) continue;
        const expectedVariants = expectedFiles[key]?.variants ?? {};
        const actualVariants = actualFiles[key]?.variants ?? {};
        const expectedExts = Object.keys(expectedVariants);
        const actualExts = Object.keys(actualVariants);

        const missingExts = full ? expectedExts.filter((ext) => !(ext in actualVariants)) : [];
        const extraExts = full ? actualExts.filter((ext) => !(ext in expectedVariants)) : [];

        if (missingExts.length) {
            errors.push(`[Manifest] 缺少变体: ${entry.id}/${key} -> ${missingExts.join(', ')}`);
        }
        if (extraExts.length) {
            errors.push(`[Manifest] 多余变体: ${entry.id}/${key} -> ${extraExts.join(', ')}`);
        }

        for (const ext of expectedExts) {
            const expectedMeta = expectedVariants[ext];
            const actualMeta = actualVariants[ext];
            if (!actualMeta) continue;
            if (actualMeta.sha256 !== expectedMeta.sha256) {
                errors.push(`[Manifest] hash 不一致: ${entry.id}/${key}.${ext}`);
            }
            if (Number(actualMeta.bytes) !== expectedMeta.bytes) {
                errors.push(`[Manifest] bytes 不一致: ${entry.id}/${key}.${ext}`);
            }
            if (actualMeta.mime !== expectedMeta.mime) {
                errors.push(`[Manifest] mime 不一致: ${entry.id}/${key}.${ext}`);
            }
        }
    }

    return errors;
};

const validateManifest = async (entry, { full, required }) => {
    const manifestPath = path.join(entry.dirPath, MANIFEST_NAME);
    if (!(await fileExists(manifestPath))) {
        if (!full && !required) {
            console.log(`[Manifest] 跳过未登记资源目录(incremental): ${path.relative(process.cwd(), entry.dirPath)}`);
            return;
        }
        throw new Error(`[Manifest] 缺少清单文件: ${manifestPath}`);
    }
    const content = await fs.readFile(manifestPath, 'utf8');
    const actual = JSON.parse(content);
    const expected = await buildManifest(entry);
    const errors = compareManifest(entry, actual, expected, { full });
    if (errors.length) {
        const message = errors.join('\n');
        throw new Error(message);
    }
    console.log(`[Manifest] 校验通过(${full ? 'full' : 'incremental'}): ${path.relative(process.cwd(), manifestPath)}`);
};

const run = async () => {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const assetsRoot = args.root ? path.resolve(process.cwd(), args.root) : ASSETS_ROOT;
    const entries = await resolveAssetDirs(assetsRoot, args.id);
    const full = args.manifestMode === 'full';
    if (!entries.length) {
        console.log('[Manifest] 未发现可处理的资源目录。');
        return;
    }

    if (args.mode === 'validate') {
        for (const entry of entries) {
            await validateManifest(entry, { full, required: Boolean(args.id) });
        }
        return;
    }

    for (const entry of entries) {
        await generateManifest(entry, { full });
    }
};

run().catch((error) => {
    console.error('[Manifest] 执行失败:', error.message || error);
    process.exit(1);
});
