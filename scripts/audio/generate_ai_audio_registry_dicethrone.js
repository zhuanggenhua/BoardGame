import fs from 'fs';
import path from 'path';

const DEFAULT_INPUT = path.resolve('public/assets/common/audio/registry.json');
const DEFAULT_OUTPUT = path.resolve('docs/audio/registry.ai.dicethrone.json');
const DEFAULT_SOURCE = path.resolve('src/games/dicethrone');
const SUPPORTED_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);

const parseArgs = (argv) => {
    const options = {
        input: DEFAULT_INPUT,
        output: DEFAULT_OUTPUT,
        source: DEFAULT_SOURCE,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--input' && argv[i + 1]) {
            options.input = path.resolve(argv[i + 1]);
            i += 1;
            continue;
        }
        if (arg === '--output' && argv[i + 1]) {
            options.output = path.resolve(argv[i + 1]);
            i += 1;
            continue;
        }
        if (arg === '--source' && argv[i + 1]) {
            options.source = path.resolve(argv[i + 1]);
            i += 1;
        }
    }

    return options;
};

const walkFiles = (dirPath, out = []) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walkFiles(fullPath, out);
            continue;
        }
        if (SUPPORTED_EXTS.has(path.extname(entry.name).toLowerCase())) {
            out.push(fullPath);
        }
    }
    return out;
};

const extractRegistryKeys = (content) => {
    const keys = new Set();
    const regex = /(['"`])([^'"`\\]*(?:\\.[^'"`\\]*)*)\1/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        keys.add(match[2]);
    }
    return keys;
};

const run = () => {
    const { input, output, source } = parseArgs(process.argv.slice(2));
    const registryRaw = fs.readFileSync(input, 'utf8');
    const registry = JSON.parse(registryRaw);
    const registryMap = new Map((registry.entries ?? []).map((entry) => [entry.key, entry]));

    const files = walkFiles(source);
    const usedKeys = new Set();

    for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf8');
        const literals = extractRegistryKeys(content);
        for (const key of literals) {
            if (registryMap.has(key)) {
                usedKeys.add(key);
            }
        }
    }

    const entries = Array.from(usedKeys)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => {
            const entry = registryMap.get(key);
            return {
                key,
                type: entry?.type,
                category: entry?.category,
            };
        });

    const payload = {
        version: registry.version ?? 1,
        generatedAt: new Date().toISOString(),
        registrySource: path.relative(process.cwd(), input).replace(/\\/g, '/'),
        scanRoot: path.relative(process.cwd(), source).replace(/\\/g, '/'),
        total: entries.length,
        entries,
    };

    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`[AudioRegistryAI] Dicethrone keys=${entries.length} -> ${path.relative(process.cwd(), output)}`);
};

try {
    run();
} catch (error) {
    console.error('[AudioRegistryAI] 生成失败:', error);
    process.exit(1);
}
