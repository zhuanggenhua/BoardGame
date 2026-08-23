import fs from 'fs';
import path from 'path';

const DEFAULT_SOURCE_DIR = path.resolve('public/assets/common/audio');
const DEFAULT_TARGET_FILE = path.resolve('docs/audio/common-audio-assets.md');
const DEFAULT_EXTS = ['.wav', '.mp3', '.ogg', '.flac'];

function formatProjectPath(absPath) {
    return path.relative(process.cwd(), absPath).replace(/\\/g, '/') || '.';
}

function parseArgs(argv) {
    let source = DEFAULT_SOURCE_DIR;
    let output = DEFAULT_TARGET_FILE;
    let exts = [...DEFAULT_EXTS];
    let mode = 'summary';

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--source' && argv[i + 1]) {
            source = path.resolve(argv[i + 1]);
            i += 1;
            continue;
        }
        if (arg === '--output' && argv[i + 1]) {
            output = path.resolve(argv[i + 1]);
            i += 1;
            continue;
        }
        if (arg === '--mode' && argv[i + 1]) {
            mode = argv[i + 1];
            i += 1;
            continue;
        }
        if (arg === '--only-ogg') {
            exts = ['.ogg'];
            continue;
        }
        if (arg === '--extensions' && argv[i + 1]) {
            exts = argv[i + 1]
                .split(',')
                .map(ext => ext.trim())
                .filter(Boolean)
                .map(ext => (ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`));
            i += 1;
        }
    }

    return {
        source,
        output,
        exts,
        mode
    };
}

function scanDirectory(dir, root, exts, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        if (file.startsWith('.') || file === '__MACOSX') return;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            scanDirectory(filePath, root, exts, fileList);
        } else if (exts.includes(path.extname(file).toLowerCase())) {
            fileList.push({
                name: file,
                relativePath: path.relative(root, filePath)
            });
        }
    });
    return fileList;
}

function groupFiles(names) {
    if (names.length === 0) return [];

    // Grouping by pattern: prefix + <variable> + suffix
    // We'll try to group numbers first, then letters.

    const tryGroup = (list, regex, isAlpha = false) => {
        const groups = {};
        const remain = [];

        list.forEach(name => {
            const match = name.match(regex);
            if (match) {
                const [_, prefix, val, suffix] = match;
                const key = prefix + '###' + suffix;
                if (!groups[key]) groups[key] = [];
                groups[key].push({ val, original: name });
            } else {
                remain.push(name);
            }
        });

        const grouped = [];
        for (const key in groups) {
            const items = groups[key];
            const [prefix, suffix] = key.split('###');

            if (items.length === 1) {
                remain.push(items[0].original);
                continue;
            }

            // Sort items
            if (isAlpha) {
                items.sort((a, b) => a.val.localeCompare(b.val));
            } else {
                items.sort((a, b) => a.val.localeCompare(b.val)); // lexicographical fine for padded digits
            }

            const ranges = [];
            let start = items[0].val;
            let last = items[0].val;

            for (let i = 1; i <= items.length; i++) {
                const current = items[i]?.val;
                let isSequential = false;

                if (current) {
                    if (isAlpha) {
                        isSequential = current.charCodeAt(0) === last.charCodeAt(0) + 1;
                    } else {
                        isSequential = parseInt(current) === parseInt(last) + 1 && current.length === last.length;
                    }
                }

                if (isSequential) {
                    last = current;
                } else {
                    ranges.push(start === last ? start : `${start}-${last}`);
                    if (current) {
                        start = current;
                        last = current;
                    }
                }
            }
            grouped.push(`${prefix}[${ranges.join(', ')}]${suffix}`);
        }
        return [...remain, ...grouped];
    };

    // Pass 1: Numeric grouping (e.g. Sound_01.wav)
    let processed = tryGroup(names, /^(.*?)(\d+)([^0-9]*\.[^.]+)$/, false);

    // Pass 2: Alphabetic grouping (e.g. Hit_A.wav, or Action A.wav)
    // Looking for a single char A-Z that is either preceded by _ or space, or part of a suffix
    processed = tryGroup(processed, /^(.*?)([A-Z])([^A-Z]*\.[^.]+)$/, true);

    return processed.sort();
}

function generateNamesMarkdown(names, sourceDir, totalFiles) {
    const grouped = groupFiles(names);
    const projectSourceDir = formatProjectPath(sourceDir);

    let content = '# Audio Asset Symbols (Flat & Grouped)\n\n';
    content += `Generated on: ${new Date().toLocaleString()}\n`;
    content += `Total Metadata Symbols: ${grouped.length} (from ${totalFiles} physical files)\n\n`;

    content += '> [!TIP]\n';
    content += '> This is a **FLAT LIST** of all audio filenames found in the assets directory.\n';
    content += '> - **Grouping**: Numbers `[01-05]` and Letters `[A-C]` are merged to save space.\n';
    content += '> - **Lookup**: Use the command below to find the physical path of any symbol.\n\n';

    content += '## 🔍 Search Command\n';
    content += '```json\n';
    content += '{\n';
    content += `  "SearchDirectory": "${projectSourceDir}",\n`;
    content += '  "Pattern": "*SYMBOL_OR_PART*",\n';
    content += '  "Type": "file"\n';
    content += '}\n';
    content += '```\n\n';

    content += '---\n\n';
    content += '## 🎵 File Symbols\n\n';
    grouped.forEach(item => {
        content += `- \`${item}\` \n`;
    });

    return content;
}

function generatePathsMarkdown(paths, sourceDir, exts) {
    const normalized = paths.map(item => item.replace(/\\/g, '/'));
    normalized.sort();
    const projectSourceDir = formatProjectPath(sourceDir);

    const counts = {};
    normalized.forEach(item => {
        const top = item.split('/')[0] || 'root';
        counts[top] = (counts[top] ?? 0) + 1;
    });

    const categories = Object.keys(counts).sort();

    let content = '# Common Audio Asset Manifest\n\n';
    content += `Generated on: ${new Date().toLocaleString()}\n`;
    content += `Source: ${projectSourceDir}\n`;
    content += `Extensions: ${exts.join(', ')}\n`;
    content += `Total Files: ${normalized.length}\n\n`;

    content += '## 📦 顶层分类统计\n\n';
    categories.forEach(key => {
        content += `- ${key}: ${counts[key]}\n`;
    });

    content += '\n---\n\n';
    content += '## 🎧 资源路径清单（相对路径）\n\n';
    normalized.forEach(item => {
        content += `- \`${item}\`\n`;
    });

    return content;
}

function generateSummaryMarkdown(paths, sourceDir, exts) {
    const normalized = paths.map(item => item.replace(/\\/g, '/')).sort();
    const projectSourceDir = formatProjectPath(sourceDir);

    const topCounts = {};
    const extCounts = {};
    const examplesByTop = {};

    normalized.forEach(item => {
        const top = item.split('/')[0] || 'root';
        const ext = path.extname(item).toLowerCase() || '(none)';
        topCounts[top] = (topCounts[top] ?? 0) + 1;
        extCounts[ext] = (extCounts[ext] ?? 0) + 1;
        if (!examplesByTop[top]) examplesByTop[top] = [];
        if (examplesByTop[top].length < 5) examplesByTop[top].push(item);
    });

    let content = '# Common Audio Asset Manifest\n\n';
    content += `Generated on: ${new Date().toLocaleString()}\n`;
    content += `Source: ${projectSourceDir}\n`;
    content += `Extensions: ${exts.join(', ')}\n`;
    content += `Total Files: ${normalized.length}\n\n`;

    content += '> 自动生成。默认只保留统计、样例和检索命令；不要把全量资源路径长表写进文档。\n\n';

    content += '## Top-level counts\n\n';
    Object.keys(topCounts).sort().forEach(key => {
        content += `- ${key}: ${topCounts[key]}\n`;
    });

    content += '\n## Extension counts\n\n';
    Object.keys(extCounts).sort().forEach(key => {
        content += `- ${key}: ${extCounts[key]}\n`;
    });

    content += '\n## Lookup commands\n\n';
    content += '```powershell\n';
    content += 'rg --files public/assets/common/audio | rg -i "keyword"\n';
    content += 'rg -n "\\"key-or-phrase\\"" public/assets/common/audio/registry.json docs/audio/registry.ai.json docs/audio/audio-catalog.md\n';
    content += 'node scripts/audio/generate_audio_assets_md.js\n';
    content += '```\n\n';

    content += '## Examples\n\n';
    Object.keys(examplesByTop).sort().forEach(key => {
        content += `### ${key}\n\n`;
        examplesByTop[key].forEach(item => {
            content += `- \`${item}\`\n`;
        });
        content += '\n';
    });

    return content;
}

const { source, output, exts, mode } = parseArgs(process.argv.slice(2));

console.log('Scanning all files...');
try {
    const fileList = scanDirectory(source, source, exts);
    const nameSet = new Set(fileList.map(item => item.name));
    const names = Array.from(nameSet);

    console.log(`Found ${fileList.length} files (${names.length} unique filenames).`);

    console.log('Generating manifest...');
    const markdown = mode === 'paths'
        ? generatePathsMarkdown(fileList.map(item => item.relativePath), source, exts)
        : mode === 'names'
            ? generateNamesMarkdown(names, source, fileList.length)
            : generateSummaryMarkdown(fileList.map(item => item.relativePath), source, exts);

    fs.writeFileSync(output, markdown, 'utf8');
    console.log(`Successfully wrote to ${output}`);
} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}
