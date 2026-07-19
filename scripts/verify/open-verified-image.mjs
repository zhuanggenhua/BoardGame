#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

const usage = () => {
    console.log(`用法:
  node scripts/verify/open-verified-image.mjs --path <图片路径>
  node scripts/verify/open-verified-image.mjs --path <图片路径1> --path <图片路径2>
  node scripts/verify/open-verified-image.mjs --paths <图片路径1> <图片路径2> ...
  node scripts/verify/open-verified-image.mjs --latest [目录]

选项:
  --path <路径>     打开指定图片；可重复传入多次
  --paths <路径...> 依次打开多张指定图片
  --latest [目录]   递归查找目录下最后修改的一张图片，默认 test-results/evidence-screenshots
  --viewer <system|pureref>  指定查看器；pureref 会一次性打开整批图片
  --pureref         等同于 --viewer pureref
  --dry-run         只解析路径，不实际打开
  --help            显示帮助
`);
};

const isImageFile = (filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const collectImages = (dirPath) => {
    const results = [];
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectImages(fullPath));
            continue;
        }
        if (entry.isFile() && isImageFile(fullPath)) {
            results.push(fullPath);
        }
    }
    return results;
};

const parseArgs = (argv) => {
    const parsed = {
        path: null,
        paths: [],
        latest: null,
        viewer: process.env.BG_IMAGE_VIEWER ?? 'system',
        dryRun: false,
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const current = argv[index];
        if (current === '--help' || current === '-h') {
            parsed.help = true;
            continue;
        }
        if (current === '--dry-run') {
            parsed.dryRun = true;
            continue;
        }
        if (current === '--pureref') {
            parsed.viewer = 'pureref';
            continue;
        }
        if (current === '--viewer') {
            const viewer = argv[index + 1] ?? null;
            if (!viewer) {
                throw new Error('--viewer 缺少取值');
            }
            parsed.viewer = viewer;
            index += 1;
            continue;
        }
        if (current === '--path') {
            const targetPath = argv[index + 1] ?? null;
            if (targetPath) {
                if (!parsed.path && parsed.paths.length === 0) {
                    parsed.path = targetPath;
                } else if (parsed.path && parsed.paths.length === 0) {
                    parsed.paths = [parsed.path, targetPath];
                    parsed.path = null;
                } else {
                    parsed.paths.push(targetPath);
                }
            }
            index += 1;
            continue;
        }
        if (current === '--paths') {
            while (argv[index + 1] && !argv[index + 1].startsWith('--')) {
                parsed.paths.push(argv[index + 1]);
                index += 1;
            }
            continue;
        }
        if (current === '--latest') {
            const candidate = argv[index + 1];
            if (candidate && !candidate.startsWith('--')) {
                parsed.latest = candidate;
                index += 1;
            } else {
                parsed.latest = 'test-results/evidence-screenshots';
            }
            continue;
        }
        if (!parsed.path && parsed.paths.length === 0) {
            parsed.path = current;
            continue;
        }
        if (parsed.path && parsed.paths.length === 0) {
            parsed.paths = [parsed.path, current];
            parsed.path = null;
            continue;
        }
        if (parsed.paths.length > 0) {
            parsed.paths.push(current);
        }
    }

    return parsed;
};

const resolveImagePath = (imagePath) => {
    const resolved = path.resolve(imagePath);
    if (!existsSync(resolved)) {
        throw new Error(`图片不存在: ${resolved}`);
    }
    const stats = statSync(resolved);
    if (stats.isDirectory()) {
        throw new Error(`给定路径是目录，不是图片: ${resolved}`);
    }
    if (!isImageFile(resolved)) {
        throw new Error(`目标文件不是支持的图片格式: ${resolved}`);
    }
    return resolved;
};

const resolvePureRefPath = () => {
    const candidates = [
        process.env.PUREREF_PATH,
        'C:\\Program Files\\PureRef\\PureRef.exe',
        'C:\\Program Files (x86)\\PureRef\\PureRef.exe',
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error('未找到 PureRef.exe；可设置 PUREREF_PATH 指向 PureRef.exe');
};

const resolveTargetImages = ({ path: imagePath, paths, latest }) => {
    if (paths.length > 0) {
        return paths.map(resolveImagePath);
    }

    if (imagePath) {
        return [resolveImagePath(imagePath)];
    }

    const latestRoot = path.resolve(latest ?? 'test-results/evidence-screenshots');
    if (!existsSync(latestRoot)) {
        throw new Error(`目标目录不存在: ${latestRoot}`);
    }

    const stats = statSync(latestRoot);
    if (stats.isFile()) {
        if (!isImageFile(latestRoot)) {
            throw new Error(`目标文件不是支持的图片格式: ${latestRoot}`);
        }
        return [latestRoot];
    }

    const images = collectImages(latestRoot);
    if (images.length === 0) {
        throw new Error(`目录下未找到图片: ${latestRoot}`);
    }

    images.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
    return [images[0]];
};

const openImage = (imagePath) => {
    if (process.platform === 'win32') {
        const openResult = spawnSync(
            'powershell',
            [
                '-NoProfile',
                '-Command',
                '$target = $env:BG_TARGET_IMAGE_PATH;'
                + 'if (-not $target) { throw "缺少 BG_TARGET_IMAGE_PATH" };'
                + 'if (-not (Test-Path -LiteralPath $target)) { throw "图片不存在: " + $target };'
                + 'Start-Process -FilePath $target -ErrorAction Stop | Out-Null',
            ],
            {
                env: {
                    ...process.env,
                    BG_TARGET_IMAGE_PATH: imagePath,
                },
                encoding: 'utf8',
                stdio: 'pipe',
            },
        );

        if (openResult.error) {
            throw openResult.error;
        }
        if (openResult.status !== 0) {
            const stderr = openResult.stderr?.trim();
            const stdout = openResult.stdout?.trim();
            throw new Error(stderr || stdout || `Windows 开图失败，退出码: ${openResult.status}`);
        }
        return;
    }

    const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
    const child = spawn(command, [imagePath], {
        detached: true,
        stdio: 'ignore',
    });
    child.unref();
};

const openImages = (imagePaths) => {
    for (const imagePath of imagePaths) {
        openImage(imagePath);
    }
};

const openImagesWithPureRef = (imagePaths) => {
    const pureRefPath = resolvePureRefPath();
    const child = spawn(pureRefPath, imagePaths, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
    });
    child.unref();
    console.log(`OPENED_WITH_PUREREF=${pureRefPath}`);
};

const main = () => {
    const parsed = parseArgs(process.argv.slice(2));

    if (parsed.help) {
        usage();
        process.exit(0);
    }

    if (!parsed.path && parsed.paths.length === 0 && !parsed.latest) {
        usage();
        throw new Error('必须提供 --path、--paths 或 --latest');
    }

    const resolvedImages = resolveTargetImages(parsed);
    for (const resolvedImage of resolvedImages) {
        console.log(`RESOLVED_IMAGE=${resolvedImage}`);
    }

    const normalizedViewer = parsed.viewer.toLowerCase();
    if (!['system', 'pureref'].includes(normalizedViewer)) {
        throw new Error(`不支持的 viewer: ${parsed.viewer}`);
    }

    if (parsed.dryRun) {
        console.log(`RESOLVED_VIEWER=${normalizedViewer}`);
        return;
    }

    if (normalizedViewer === 'pureref') {
        openImagesWithPureRef(resolvedImages);
    } else {
        openImages(resolvedImages);
    }

    for (const resolvedImage of resolvedImages) {
        console.log(`OPENED_IMAGE=${resolvedImage}`);
    }
};

try {
    main();
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`open-verified-image 失败: ${message}`);
    process.exit(1);
}
