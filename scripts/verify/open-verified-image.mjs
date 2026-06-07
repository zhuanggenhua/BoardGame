#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

const usage = () => {
    console.log(`用法:
  node scripts/verify/open-verified-image.mjs --path <图片路径>
  node scripts/verify/open-verified-image.mjs --latest [目录]

选项:
  --path <路径>     打开指定图片
  --latest [目录]   递归查找目录下最后修改的一张图片，默认 test-results/evidence-screenshots
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
        latest: null,
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
        if (current === '--path') {
            parsed.path = argv[index + 1] ?? null;
            index += 1;
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
        if (!parsed.path) {
            parsed.path = current;
        }
    }

    return parsed;
};

const resolveTargetImage = ({ path: imagePath, latest }) => {
    if (imagePath) {
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
        return latestRoot;
    }

    const images = collectImages(latestRoot);
    if (images.length === 0) {
        throw new Error(`目录下未找到图片: ${latestRoot}`);
    }

    images.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
    return images[0];
};

const openImage = (imagePath) => {
    if (process.platform === 'win32') {
        const escapedPath = imagePath.replace(/'/g, "''");
        const child = spawn(
            'powershell',
            ['-NoProfile', '-Command', `Start-Process -LiteralPath '${escapedPath}'`],
            {
                detached: true,
                stdio: 'ignore',
            },
        );
        child.unref();
        return;
    }

    const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
    const child = spawn(command, [imagePath], {
        detached: true,
        stdio: 'ignore',
    });
    child.unref();
};

const main = () => {
    const parsed = parseArgs(process.argv.slice(2));

    if (parsed.help) {
        usage();
        process.exit(0);
    }

    if (!parsed.path && !parsed.latest) {
        usage();
        throw new Error('必须提供 --path 或 --latest');
    }

    const resolvedImage = resolveTargetImage(parsed);
    console.log(`RESOLVED_IMAGE=${resolvedImage}`);

    if (parsed.dryRun) {
        return;
    }

    openImage(resolvedImage);
    console.log(`OPENED_IMAGE=${resolvedImage}`);
};

try {
    main();
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`open-verified-image 失败: ${message}`);
    process.exit(1);
}
