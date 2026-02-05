import { promises as fs } from 'fs';
import path from 'path';

const DEFAULT_SOURCE_DIR = path.resolve('public/assets/common/audio');
const DEFAULT_OUTPUT_FILE = path.resolve('public/assets/common/audio/registry.json');
const SUPPORTED_EXTS = new Set(['.ogg', '.wav', '.mp3', '.flac', '.m4a']);
const COMPRESSED_SEGMENT = 'compressed';

const toPosixPath = (value) => value.split(path.sep).join('/');

const normalizeSegment = (value) => value
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeGroup = (value) => {
    const normalized = normalizeSegment(value);
    const aliases = {
        cards: 'card',
    };
    return aliases[normalized] ?? normalized;
};

const walkFiles = async (dirPath, out = []) => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            await walkFiles(fullPath, out);
            continue;
        }
        out.push(fullPath);
    }
    return out;
};

const parseArgs = (argv) => {
    const options = {
        source: DEFAULT_SOURCE_DIR,
        output: DEFAULT_OUTPUT_FILE,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--source' && argv[i + 1]) {
            options.source = path.resolve(argv[i + 1]);
            i += 1;
            continue;
        }
        if (arg === '--output' && argv[i + 1]) {
            options.output = path.resolve(argv[i + 1]);
            i += 1;
        }
    }
    return options;
};

const buildEntry = (relativePath) => {
    const segments = relativePath.split('/');
    const root = segments.shift();
    if (!root) return null;

    const withoutCompressed = segments.filter(seg => seg && seg !== COMPRESSED_SEGMENT);
    if (withoutCompressed.length === 0) return null;

    const src = [root, ...withoutCompressed].join('/');
    const actionSegments = [...withoutCompressed];
    const type = root === 'bgm' ? 'bgm' : 'sfx';

    let group = 'misc';
    let actionParts = actionSegments;

    if (type === 'sfx') {
        const groupSegment = actionSegments.shift();
        if (!groupSegment) return null;
        group = normalizeGroup(groupSegment) || 'misc';
        actionParts = actionSegments;
    } else {
        group = 'bgm';
    }

    const action = actionParts
        .map(normalizeSegment)
        .filter(Boolean)
        .join('.');

    if (!action) return null;

    const key = `${group}.${action}`;
    const category = {
        group,
        sub: actionParts.length > 0 ? normalizeSegment(actionParts[0]) : undefined,
    };

    return {
        key,
        src,
        type,
        category,
    };
};

const run = async () => {
    const { source, output } = parseArgs(process.argv.slice(2));
    const files = await walkFiles(source);
    const entries = [];
    const seenKeys = new Set();

    for (const filePath of files) {
        if (filePath === output) continue;
        const ext = path.extname(filePath).toLowerCase();
        if (!SUPPORTED_EXTS.has(ext)) continue;

        const relative = toPosixPath(path.relative(source, filePath));
        const entry = buildEntry(relative);
        if (!entry) continue;
        if (seenKeys.has(entry.key)) {
            throw new Error(`[AudioRegistry] 发现重复 key: ${entry.key}`);
        }
        seenKeys.add(entry.key);
        entries.push(entry);
    }

    entries.sort((a, b) => a.key.localeCompare(b.key));

    const registry = {
        version: 1,
        generatedAt: new Date().toISOString(),
        source: toPosixPath(path.relative(process.cwd(), source)),
        total: entries.length,
        entries,
    };

    await fs.writeFile(output, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
    console.log(`[AudioRegistry] 已生成 ${entries.length} 条记录 -> ${path.relative(process.cwd(), output)}`);
};

run().catch((error) => {
    console.error('[AudioRegistry] 生成失败:', error);
    process.exit(1);
});
