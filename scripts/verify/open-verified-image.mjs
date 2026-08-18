#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.mkv']);
const MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);

const usage = () => {
    console.log(`用法:
  node scripts/verify/open-verified-image.mjs --pass-manifest <本轮要求达标清单.json> --path <图片路径>
  node scripts/verify/open-verified-image.mjs --pass-manifest <本轮要求达标清单.json> --viewer system --path <录屏/视频路径>
  node scripts/verify/open-verified-image.mjs --pass-manifest <本轮要求达标清单.json> --path <00-sequence-index.png> --path <01-labeled-*.png>
  node scripts/verify/open-verified-image.mjs --pass-manifest <本轮要求达标清单.json> --paths <00-sequence-index.png> <01-labeled-*.png> <02-labeled-*.png> ...
  node scripts/verify/open-verified-image.mjs --pass-manifest <本轮要求达标清单.json> --latest [目录]

选项:
  --path <路径>     打开指定图片/GIF/视频；可重复传入多次，默认 PureRef 多图只接受带序号标记组
  --paths <路径...> 依次打开多张指定图片/GIF/视频；默认 PureRef 多图只接受带序号标记组
  --latest [目录]   递归查找目录下最后修改的一张图片/GIF/视频，默认 test-results/evidence-screenshots
  --viewer <system|pureref>  指定查看器；默认 pureref，pureref 只用于图片/GIF，视频请用 system
  --pureref         等同于 --viewer pureref
  --pass-manifest <路径>  本轮用户要求达标清单；没有清单禁止实际开图
  --confirmed-pass  历史参数，已废弃；请使用 --pass-manifest
  --dry-run         只解析路径，不实际打开
  --help            显示帮助
`);
};

const isImageFile = (filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
const isVideoFile = (filePath) => VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
const isMediaFile = (filePath) => MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const collectMedia = (dirPath) => {
    const results = [];
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectMedia(fullPath));
            continue;
        }
        if (entry.isFile() && isMediaFile(fullPath)) {
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
        viewer: process.env.BG_IMAGE_VIEWER ?? 'pureref',
        dryRun: false,
        confirmedPass: false,
        passManifest: null,
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
        if (current === '--confirmed-pass') {
            parsed.confirmedPass = true;
            continue;
        }
        if (current === '--pass-manifest') {
            const manifestPath = argv[index + 1] ?? null;
            if (!manifestPath) {
                throw new Error('--pass-manifest 缺少取值');
            }
            parsed.passManifest = manifestPath;
            index += 1;
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

const resolveMediaPath = (mediaPath) => {
    const resolved = path.resolve(mediaPath);
    if (!existsSync(resolved)) {
        throw new Error(`媒体文件不存在: ${resolved}`);
    }
    const stats = statSync(resolved);
    if (stats.isDirectory()) {
        throw new Error(`给定路径是目录，不是图片或视频: ${resolved}`);
    }
    if (!isMediaFile(resolved)) {
        throw new Error(`目标文件不是支持的图片或视频格式: ${resolved}`);
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
        return paths.map(resolveMediaPath);
    }

    if (imagePath) {
        return [resolveMediaPath(imagePath)];
    }

    const latestRoot = path.resolve(latest ?? 'test-results/evidence-screenshots');
    if (!existsSync(latestRoot)) {
        throw new Error(`目标目录不存在: ${latestRoot}`);
    }

    const stats = statSync(latestRoot);
    if (stats.isFile()) {
        if (!isMediaFile(latestRoot)) {
            throw new Error(`目标文件不是支持的图片或视频格式: ${latestRoot}`);
        }
        return [latestRoot];
    }

    const images = collectMedia(latestRoot);
    if (images.length === 0) {
        throw new Error(`目录下未找到图片或视频: ${latestRoot}`);
    }

    images.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
    return [images[0]];
};

const validatePureRefSequence = (imagePaths) => {
    const videoPaths = imagePaths.filter(isVideoFile);
    if (videoPaths.length > 0) {
        throw new Error(`PureRef 展示只支持图片/GIF；录屏或视频请使用 --viewer system: ${videoPaths.join(', ')}`);
    }

    if (imagePaths.length <= 1) {
        return;
    }

    const indexImages = imagePaths.filter((imagePath) => path.basename(imagePath) === '00-sequence-index.png');
    const labeledImages = imagePaths.filter((imagePath) => /^\d{2}-labeled-.+\.png$/i.test(path.basename(imagePath)));
    const invalidImages = imagePaths.filter((imagePath) => (
        path.basename(imagePath) !== '00-sequence-index.png'
        && !/^\d{2}-labeled-.+\.png$/i.test(path.basename(imagePath))
    ));

    if (indexImages.length !== 1 || labeledImages.length !== imagePaths.length - 1 || invalidImages.length > 0) {
        throw new Error(`PureRef 多图必须先生成带序号标记组：参数中必须恰好包含 00-sequence-index.png 和每张对应的 NN-labeled-*.png；禁止直接传原始截图或混合原图。`);
    }
};

const normalizeForCompare = (targetPath) => path.resolve(targetPath).toLowerCase();

const validatePassManifest = (manifestPath, imagePaths) => {
    if (!manifestPath) {
        throw new Error('拒绝打开：缺少 --pass-manifest。本脚本只接受“本轮用户要求逐项达标”的清单，不接受口头确认或泛化 UI PASS。');
    }

    const resolvedManifestPath = path.resolve(manifestPath);
    if (!existsSync(resolvedManifestPath)) {
        throw new Error(`PASS 清单不存在: ${resolvedManifestPath}`);
    }

    let manifest;
    try {
        manifest = JSON.parse(readFileSync(resolvedManifestPath, 'utf8'));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`PASS 清单不是有效 JSON: ${resolvedManifestPath}; ${message}`);
    }

    if (manifest?.verdict !== 'PASS') {
        throw new Error('拒绝打开：PASS 清单 verdict 必须是 "PASS"');
    }
    if (manifest?.scope !== 'current-user-request') {
        throw new Error('拒绝打开：PASS 清单 scope 必须是 "current-user-request"，不能用整页 UI 或其它范围替代本轮要求');
    }
    if (!Array.isArray(manifest.requirements) || manifest.requirements.length === 0) {
        throw new Error('拒绝打开：PASS 清单必须包含非空 requirements');
    }

    for (const [index, item] of manifest.requirements.entries()) {
        if (!item || typeof item.requirement !== 'string' || item.requirement.trim().length === 0) {
            throw new Error(`拒绝打开：第 ${index + 1} 条 requirement 为空`);
        }
        if (item.status !== 'PASS') {
            throw new Error(`拒绝打开：第 ${index + 1} 条要求未 PASS: ${item.requirement}`);
        }
        if (!Array.isArray(item.evidence) || item.evidence.length === 0 || item.evidence.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
            throw new Error(`拒绝打开：第 ${index + 1} 条要求缺少直接 evidence: ${item.requirement}`);
        }
    }

    const manifestMedia = Array.isArray(manifest.media) ? manifest.media : manifest.images;
    if (!Array.isArray(manifestMedia) || manifestMedia.length === 0) {
        throw new Error('拒绝打开：PASS 清单必须包含 media 或 images，并且必须覆盖本次打开的全部图片/视频');
    }

    const manifestImageSet = new Set(manifestMedia.map((mediaPath) => normalizeForCompare(mediaPath)));
    const missingImages = imagePaths.filter((imagePath) => !manifestImageSet.has(normalizeForCompare(imagePath)));
    if (missingImages.length > 0) {
        throw new Error(`拒绝打开：本次打开的图片/视频不在 PASS 清单 media/images 中: ${missingImages.join(', ')}`);
    }

    console.log(`PASS_MANIFEST=${resolvedManifestPath}`);
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
        console.log(`RESOLVED_MEDIA=${resolvedImage}`);
        console.log(`${isVideoFile(resolvedImage) ? 'RESOLVED_VIDEO' : 'RESOLVED_IMAGE'}=${resolvedImage}`);
    }

    const normalizedViewer = parsed.viewer.toLowerCase();
    if (!['system', 'pureref'].includes(normalizedViewer)) {
        throw new Error(`不支持的 viewer: ${parsed.viewer}`);
    }

    if (normalizedViewer === 'pureref') {
        validatePureRefSequence(resolvedImages);
    }

    if (parsed.confirmedPass && !parsed.passManifest) {
        throw new Error('拒绝打开：--confirmed-pass 已废弃，不能单独作为开图依据；请提供 --pass-manifest。');
    }

    if (parsed.passManifest) {
        validatePassManifest(parsed.passManifest, resolvedImages);
    } else if (!parsed.dryRun) {
        validatePassManifest(parsed.passManifest, resolvedImages);
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
        console.log(`OPENED_MEDIA=${resolvedImage}`);
        console.log(`${isVideoFile(resolvedImage) ? 'OPENED_VIDEO' : 'OPENED_IMAGE'}=${resolvedImage}`);
    }
};

try {
    main();
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`open-verified-image 失败: ${message}`);
    process.exit(1);
}
