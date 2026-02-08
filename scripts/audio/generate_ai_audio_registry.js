import fs from 'fs';
import path from 'path';

const DEFAULT_INPUT = path.resolve('public/assets/common/audio/registry.json');
const DEFAULT_OUTPUT = path.resolve('docs/audio/registry.ai.json');

const parseArgs = (argv) => {
    const options = {
        input: DEFAULT_INPUT,
        output: DEFAULT_OUTPUT,
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
        }
    }

    return options;
};

const run = () => {
    const { input, output } = parseArgs(process.argv.slice(2));
    const raw = fs.readFileSync(input, 'utf8');
    const registry = JSON.parse(raw);
    const entries = (registry.entries ?? [])
        .map((entry) => ({
            key: entry.key,
            type: entry.type,
            category: entry.category,
        }))
        .sort((a, b) => a.key.localeCompare(b.key));

    const payload = {
        version: registry.version ?? 1,
        generatedAt: new Date().toISOString(),
        source: path.relative(process.cwd(), input).replace(/\\/g, '/'),
        total: entries.length,
        entries,
    };

    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`[AudioRegistryAI] 已生成 ${entries.length} 条记录 -> ${path.relative(process.cwd(), output)}`);
};

try {
    run();
} catch (error) {
    console.error('[AudioRegistryAI] 生成失败:', error);
    process.exit(1);
}
