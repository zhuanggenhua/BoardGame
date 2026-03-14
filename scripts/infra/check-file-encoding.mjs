import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

const TEXT_EXTENSIONS = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.json',
    '.md',
    '.html',
    '.css',
    '.scss',
    '.yml',
    '.yaml',
    '.ps1',
    '.bat',
    '.gradle',
    '.properties',
    '.xml',
    '.java',
    '.kt',
    '.pro',
    '.txt',
]);

const ALWAYS_INCLUDE = new Set([
    'AGENTS.md',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.node.json',
    'tsconfig.server.json',
    'playwright.config.ts',
    'playwright.config.parallel.ts',
]);

const DEFAULT_ROOTS = [
    'AGENTS.md',
    'package.json',
    'src',
    'apps',
    'e2e',
    'scripts',
    'docs',
    'openspec',
    'vite-plugins',
    'server.ts',
];

const IGNORED_DIRS = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    'coverage',
    'test-results',
    'temp',
    'logs',
]);

const CHANGED_FILE_ROOTS = [
    'public',
    '.github',
    'android',
];

const CHANGED_FILE_IGNORED_PREFIXES = [
    '.kiro/',
    '.windsurf/',
    'evidence/',
    'tmp/',
];

const ANDROID_GENERATED_PREFIXES = [
    'android/.gradle/',
    'android/app/build/',
    'android/app/src/main/assets/',
    'android/capacitor-cordova-android-plugins/build/',
];

const ROOT_LEVEL_CHANGED_EXTENSIONS = new Set(
    Array.from(TEXT_EXTENSIONS).filter(extension => extension !== '.md' && extension !== '.txt'),
);

const WARNING_RULES = [
    {
        id: 'replacement-char',
        message: 'contains Unicode replacement character',
        test: (text) => text.includes('\uFFFD'),
    },
    {
        id: 'repeated-question',
        message: 'contains repeated question marks',
        test: (text) => /\?{4,}/.test(text),
    },
];

function normalizeRelativePath(value) {
    return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function hasUtf8Bom(buffer) {
    return buffer.length >= 3
        && buffer[0] === UTF8_BOM[0]
        && buffer[1] === UTF8_BOM[1]
        && buffer[2] === UTF8_BOM[2];
}

function isTextLikeFile(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    const extension = path.extname(normalized).toLowerCase();
    const baseName = path.basename(normalized);
    return TEXT_EXTENSIONS.has(extension) || ALWAYS_INCLUDE.has(baseName);
}

function listGitFiles(args) {
    try {
        const stdout = execFileSync('git', args, {
            cwd: process.cwd(),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        return stdout
            .split(/\r?\n/)
            .map(item => item.trim())
            .filter(Boolean)
            .map(normalizeRelativePath);
    } catch {
        return [];
    }
}

function listChangedGitFiles() {
    return Array.from(new Set([
        ...listGitFiles(['diff', '--name-only', '--diff-filter=ACMR']),
        ...listGitFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR']),
        ...listGitFiles(['ls-files', '--others', '--exclude-standard']),
    ]));
}

function walkDirectory(relativeDir) {
    const absoluteDir = path.resolve(process.cwd(), relativeDir);
    if (!existsSync(absoluteDir)) return [];

    const results = [];
    const entries = readdirSync(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith('.git')) continue;

        const childRelative = normalizeRelativePath(path.join(relativeDir, entry.name));
        if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name)) continue;
            results.push(...walkDirectory(childRelative));
            continue;
        }

        if (isTextLikeFile(childRelative)) {
            results.push(childRelative);
        }
    }

    return results;
}

function expandInputPath(inputPath) {
    const normalized = normalizeRelativePath(inputPath);
    const absolutePath = path.resolve(process.cwd(), normalized);
    if (!existsSync(absolutePath)) return [];

    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
        return walkDirectory(normalized);
    }

    return isTextLikeFile(normalized) ? [normalized] : [];
}

export function shouldIncludeChangedGitFile(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    if (!isTextLikeFile(normalized)) {
        return false;
    }

    if (CHANGED_FILE_IGNORED_PREFIXES.some(prefix => normalized.startsWith(prefix))) {
        return false;
    }

    if (ANDROID_GENERATED_PREFIXES.some(prefix => normalized.startsWith(prefix))) {
        return false;
    }

    if (!normalized.includes('/')) {
        const extension = path.extname(normalized).toLowerCase();
        return ROOT_LEVEL_CHANGED_EXTENSIONS.has(extension) || ALWAYS_INCLUDE.has(path.basename(normalized));
    }

    return CHANGED_FILE_ROOTS.some(root => normalized === root || normalized.startsWith(`${root}/`));
}

export function collectImplicitCandidateFiles(defaultScopedFiles, changedGitFiles) {
    const normalizedDefaultFiles = defaultScopedFiles.map(normalizeRelativePath);
    const defaultFileSet = new Set(normalizedDefaultFiles);
    const changedScopedFiles = changedGitFiles
        .map(normalizeRelativePath)
        .filter(file => !defaultFileSet.has(file))
        .filter(shouldIncludeChangedGitFile);

    return Array.from(new Set([
        ...normalizedDefaultFiles,
        ...changedScopedFiles,
    ])).sort();
}

export function listCandidateFiles(explicitPaths) {
    if (explicitPaths.length > 0) {
        return Array.from(new Set(explicitPaths.flatMap(expandInputPath))).sort();
    }

    const defaultScopedFiles = Array.from(
        new Set([
            ...DEFAULT_ROOTS.flatMap(expandInputPath),
            ...Array.from(ALWAYS_INCLUDE).flatMap(expandInputPath),
        ]),
    ).sort();

    // 默认只扫正式目录；默认范围外只补充当前改动里的正式文件，避免把证据/临时目录噪音卷进门禁。
    const implicitFiles = collectImplicitCandidateFiles(defaultScopedFiles, listChangedGitFiles());
    if (implicitFiles.length > 0) {
        return implicitFiles;
    }

    const gitFiles = [
        ...listGitFiles(['ls-files']),
        ...listGitFiles(['ls-files', '--others', '--exclude-standard']),
    ].filter(isTextLikeFile);

    if (gitFiles.length > 0) {
        return Array.from(new Set(gitFiles)).sort();
    }

    return Array.from(new Set(DEFAULT_ROOTS.flatMap(expandInputPath))).sort();
}

function detectWarnings(text) {
    return WARNING_RULES.filter(rule => rule.test(text));
}

function formatRuleIds(rules) {
    return rules.map(rule => rule.id).join(', ');
}

function printSummary({ scanned, fixedBom, warnings, errors, strict }) {
    console.log('\n编码检查结果');
    console.log(`- 总文件数: ${scanned}`);
    console.log(`- 修复 BOM: ${fixedBom.length}`);
    console.log(`- 严重错误: ${errors.length}`);
    console.log(`- 可疑告警: ${warnings.length}`);

    if (fixedBom.length > 0) {
        console.log('\n已自动移除 UTF-8 BOM:');
        for (const file of fixedBom) {
            console.log(`- ${file}`);
        }
    }

    if (warnings.length > 0) {
        console.log('\n可疑告警:');
        for (const warning of warnings) {
            console.log(`- ${warning.file}: ${formatRuleIds(warning.rules)}`);
        }
        console.log('\n提示: 当前默认模式只告警，不阻断。要把可疑乱码告警也视为失败，请加 `--strict`。');
    }

    if (errors.length > 0) {
        console.log('\n严重错误:');
        for (const error of errors) {
            console.log(`- ${error.file}: ${error.message}`);
        }
    }

    console.log('\nPowerShell 当前会话若只是“显示乱码”，可先执行:');
    console.log('. .\\scripts\\infra\\enable-utf8.ps1');
    console.log('注意：这只修复终端显示，不允许替代 apply_patch / Node 显式 UTF-8 写回。');

    if (strict && warnings.length > 0 && errors.length === 0) {
        console.log('\n严格模式已开启：本次因为检测到可疑乱码而失败。');
    }
}

function main() {
    const rawArgs = process.argv.slice(2);
    const strict = rawArgs.includes('--strict');
    const quiet = rawArgs.includes('--quiet');
    const fixBom = rawArgs.includes('--fix-bom');
    const explicitPaths = rawArgs.filter(arg => !arg.startsWith('--'));

    const files = listCandidateFiles(explicitPaths);
    const fixedBom = [];
    const warnings = [];
    const errors = [];

    if (!quiet) {
        console.log('🔎 检查文件编码...');
    }

    for (const file of files) {
        const absolutePath = path.resolve(process.cwd(), file);
        let buffer = readFileSync(absolutePath);

        if (hasUtf8Bom(buffer)) {
            buffer = buffer.subarray(3);
            if (fixBom) {
                writeFileSync(absolutePath, buffer);
                fixedBom.push(file);
            } else {
                errors.push({
                    file,
                    message: '包含 UTF-8 BOM；请执行 `npm run check:encoding:fix -- <file>` 或显式去除 BOM',
                });
            }
        }

        let text;
        try {
            text = UTF8_DECODER.decode(buffer);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push({
                file,
                message: `不是有效 UTF-8：${message}`,
            });
            continue;
        }

        const fileWarnings = detectWarnings(text);
        if (fileWarnings.length > 0) {
            warnings.push({
                file,
                rules: fileWarnings,
            });
        }
    }

    if (!quiet) {
        printSummary({
            scanned: files.length,
            fixedBom,
            warnings,
            errors,
            strict,
        });
    }

    if (errors.length > 0) {
        process.exit(1);
    }

    if (strict && warnings.length > 0) {
        process.exit(1);
    }

    if (!quiet) {
        console.log('\n✅ 编码检查通过');
    }
}

function isDirectExecution() {
    const entryPath = process.argv[1];
    return Boolean(entryPath) && import.meta.url === pathToFileURL(entryPath).href;
}

if (isDirectExecution()) {
    main();
}
