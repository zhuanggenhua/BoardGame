import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const REQUIRED_FIELDS = ['path', 'chainId', 'chainStep', 'sourceRun', 'sourceDir', 'stage', 'role', 'viewport', 'transition', 'description'];
const MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.mp4', '.webm', '.mov', '.m4v', '.mkv']);
const REQUIRED_VISUAL_CHECKS = new Set(['target-visible', 'interaction-ui', 'layout-readable', 'no-error']);
const FORBIDDEN_VISUAL_CHECKS = new Set(['numeric-correctness', 'rule-correctness', 'value-delta']);
const VALID_VISUAL_STATUS = new Set(['PASS', 'carried-forward']);
const GENERIC_DESCRIPTIONS = new Set([
    '正常',
    '测试通过',
    '事件发生',
    '承接上一张',
    '承接上一主线步骤',
]);
const CHINESE_CHARACTERS = /[\u3400-\u9fff]/g;
const LATIN_LETTERS = /[A-Za-z]/;
export const FORBIDDEN_CROP_DIRECTORY_NAMES = new Set([
    '_diag',
    'crops',
    'clips',
    '_closeup',
    '_crops',
    'closeups',
    '_clips',
    '_closeups',
    'crop',
    'clip',
]);
export const ARCHIVE_DIRECTORY_NAMES = new Set([
    '_history',
    '_labeled-for-pureref',
    '_temporary',
]);

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

const readJsonFile = (filePath, label) => {
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
        throw new Error(`${label}不是有效 JSON: ${filePath}; ${error instanceof Error ? error.message : String(error)}`);
    }
};

const validateVisualReview = ({ manifest, manifestMedia, manifestDir, projectRoot, indexDir }) => {
    const visualReview = manifest?.visualReview;
    if (!visualReview || visualReview.mode !== 'all-media' || visualReview.claimScope !== 'interaction-ui' || visualReview.status !== 'PASS') {
        throw new Error('最终 PASS 必须声明 visualReview=all-media / interaction-ui / PASS，禁止用关键图抽查代替全量视觉验收');
    }
    const reviewer = visualReview.reviewer;
    if (!['subagent', 'primary-agent'].includes(reviewer?.kind) || typeof reviewer?.id !== 'string' || !reviewer.id.trim()) {
        throw new Error('最终 PASS 的 visualReview 必须记录真实 reviewer.kind=subagent 或 primary-agent 与非空 reviewer.id');
    }
    if (reviewer.kind === 'primary-agent') {
        assertString(reviewer.reason, '主代理审查采用原因 reviewer.reason');
    }

    const reviewPath = visualReview.reviewFile
        ? path.resolve(manifestDir, visualReview.reviewFile)
        : null;
    if (reviewPath && !existsSync(reviewPath)) {
        throw new Error(`最终 PASS 缺少逐图视觉审计报告: ${reviewPath}`);
    }
    const review = reviewPath ? readJsonFile(reviewPath, '逐图视觉审计报告') : visualReview;
    if (review.mode !== 'all-media' || review.claimScope !== 'interaction-ui' || review.status !== 'PASS') {
        throw new Error('逐图视觉审计报告必须声明 all-media / interaction-ui / PASS');
    }

    const entries = Array.isArray(review.media) ? review.media : review.entries;
    if (!Array.isArray(entries) || entries.length !== manifestMedia.length) {
        throw new Error(`逐图视觉审计必须覆盖全部媒体：期望 ${manifestMedia.length} 条，实际 ${Array.isArray(entries) ? entries.length : 0} 条`);
    }

    const expectedPaths = new Set(manifestMedia.map((reference) => (
        normalizePath(resolveMediaReference(reference, { projectRoot, manifestDir, indexDir }))
    )));
    const reviewedPaths = new Set();
    for (const [entryIndex, entry] of entries.entries()) {
        assertString(entry?.path, `第 ${entryIndex + 1} 条视觉审计的 path`);
        if (!VALID_VISUAL_STATUS.has(entry.status)) {
            throw new Error(`逐图视觉审计第 ${entryIndex + 1} 条未 PASS: ${entry.path}`);
        }
        if (entry.status === 'carried-forward') {
            assertString(entry.unchangedEvidence, `第 ${entryIndex + 1} 条视觉审计的 unchangedEvidence`);
            const chineseCount = entry.unchangedEvidence.trim().match(CHINESE_CHARACTERS)?.length ?? 0;
            if (chineseCount < 4) {
                throw new Error(`carried-forward 必须写未改写证据: ${entry.path}`);
            }
        }
        if (!Array.isArray(entry.checks)) {
            throw new Error(`逐图视觉审计第 ${entryIndex + 1} 条缺少 checks: ${entry.path}`);
        }
        const checkSet = new Set(entry.checks);
        for (const requiredCheck of REQUIRED_VISUAL_CHECKS) {
            if (!checkSet.has(requiredCheck)) {
                throw new Error(`逐图视觉审计第 ${entryIndex + 1} 条缺少 ${requiredCheck}: ${entry.path}`);
            }
        }
        for (const forbiddenCheck of FORBIDDEN_VISUAL_CHECKS) {
            if (checkSet.has(forbiddenCheck)) {
                throw new Error(`逐图视觉审计不得承担数值/规则正确性：${entry.path} 使用了 ${forbiddenCheck}`);
            }
        }
        assertChineseDescription(entry.observation, entryIndex);
        const resolvedPath = normalizePath(resolveMediaReference(entry.path, { projectRoot, manifestDir, indexDir }));
        if (!expectedPaths.has(resolvedPath)) {
            throw new Error(`逐图视觉审计引用了不在 PASS 清单中的媒体: ${entry.path}`);
        }
        if (reviewedPaths.has(resolvedPath)) {
            throw new Error(`逐图视觉审计存在重复媒体: ${entry.path}`);
        }
        reviewedPaths.add(resolvedPath);
    }
    if (reviewedPaths.size !== expectedPaths.size || [...expectedPaths].some((entry) => !reviewedPaths.has(entry))) {
        throw new Error('逐图视觉审计与 PASS 清单 media/images 未一一对应');
    }

    const behavioralVerification = manifest?.behavioralVerification;
    if (!behavioralVerification || behavioralVerification.owner !== 'vitest' || behavioralVerification.status !== 'PASS') {
        throw new Error('最终 PASS 必须单独声明 behavioralVerification.owner=vitest 且 status=PASS');
    }
    if (!Array.isArray(behavioralVerification.commands) || !behavioralVerification.commands.some((command) => typeof command === 'string' && /vitest/i.test(command))) {
        throw new Error('behavioralVerification 必须记录实际 Vitest 命令，数值/规则正确性不能由截图承担');
    }
    if (!Array.isArray(behavioralVerification.evidence) || behavioralVerification.evidence.length === 0) {
        throw new Error('behavioralVerification 必须记录至少一条数值/规则测试证据');
    }

    return { reviewPath, mediaCount: entries.length };
};

const validateChainSteps = (mediaEntries) => {
    const chains = new Map();
    for (const entry of mediaEntries) {
        const chain = chains.get(entry.chainId) ?? [];
        chain.push(entry);
        chains.set(entry.chainId, chain);
    }
    for (const [chainId, entries] of chains.entries()) {
        const sorted = [...entries].sort((a, b) => Number(a.chainStep) - Number(b.chainStep));
        const seenSteps = new Set();
        for (const [index, entry] of sorted.entries()) {
            const step = Number(entry.chainStep);
            if (!Number.isInteger(step) || step < 1) {
                throw new Error(`E2E 证据链 ${chainId} 的 chainStep 必须是正整数: ${entry.chainStep}`);
            }
            if (seenSteps.has(step)) {
                throw new Error(`E2E 证据链 ${chainId} 的 chainStep 重复: ${step}`);
            }
            seenSteps.add(step);
            if (step !== index + 1) {
                throw new Error(`E2E 证据链 ${chainId} 的 chainStep 不连续，期望 ${index + 1}，实际 ${step}`);
            }
        }
        for (const stage of ['前态', '中态', '后态']) {
            if (!sorted.some((entry) => entry.stage === stage && entry.role === 'main-flow')) {
                throw new Error(`E2E 证据链 ${chainId} 的 ${stage} 缺少 main-flow 主图，细节辅证不能独立充当流程证据`);
            }
        }
    }
};

export const mediaPathContainsForbiddenCropDirectory = (filePath) => {
    const parts = path.normalize(filePath).split(/[\\/]/);
    return parts.some((part) => FORBIDDEN_CROP_DIRECTORY_NAMES.has(part.toLowerCase()));
};

export const assertUserVisibleMediaDirectory = (directory) => {
    if (!existsSync(directory) || !statSync(directory).isDirectory()) {
        throw new Error(`E2E 证据目录不存在或不是目录: ${directory}`);
    }
    if (FORBIDDEN_CROP_DIRECTORY_NAMES.has(path.basename(directory).toLowerCase())) {
        throw new Error(`用户可见证据目录不能是特写/裁切目录: ${directory}`);
    }
    const found = [];
    const walk = (current) => {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const fullPath = path.join(current, entry.name);
            if (FORBIDDEN_CROP_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
                found.push(fullPath);
                continue;
            }
            if (ARCHIVE_DIRECTORY_NAMES.has(entry.name.toLowerCase())) continue;
            walk(fullPath);
        }
    };
    walk(directory);
    if (found.length > 0) {
        throw new Error(`用户可见证据目录存在特写/裁切子目录，禁止进入 PASS 或查看器: ${found.join(', ')}`);
    }
};

const collectUnregisteredMedia = (directory, expectedFiles) => {
    const extraMedia = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.resolve(directory, entry.name);
        if (entry.isDirectory()) {
            if (ARCHIVE_DIRECTORY_NAMES.has(entry.name.toLowerCase())) continue;
            extraMedia.push(...collectUnregisteredMedia(fullPath, expectedFiles));
            continue;
        }
        if (entry.isFile() && MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && !expectedFiles.has(fullPath)) {
            extraMedia.push(fullPath);
        }
    }
    return extraMedia;
};

const validateMediaDirectoryCompleteness = ({ mediaEntries, projectRoot, manifestDir, indexDir }) => {
    const expectedByDirectory = new Map();
    for (const entry of mediaEntries) {
        const directory = path.resolve(projectRoot, entry.sourceDir);
        const files = expectedByDirectory.get(directory) ?? new Set();
        files.add(resolveMediaReference(entry.path, { projectRoot, manifestDir, indexDir }));
        expectedByDirectory.set(directory, files);
    }
    for (const [directory, expectedFiles] of expectedByDirectory.entries()) {
        if (!existsSync(directory) || !statSync(directory).isDirectory()) {
            throw new Error(`E2E 证据 sourceDir 不存在或不是目录: ${directory}`);
        }
        assertUserVisibleMediaDirectory(directory);
        const extraMedia = collectUnregisteredMedia(directory, expectedFiles);
        if (extraMedia.length > 0) {
            throw new Error(`E2E 证据目录存在未登记媒体：${extraMedia.join(', ')}`);
        }
    }
};

const validateOutOfScopeMedia = ({ manifest, manifestMedia, projectRoot, manifestDir, indexDir }) => {
    const declarations = manifest?.outOfScopeMedia;
    if (declarations === undefined) return [];
    if (!Array.isArray(declarations)) {
        throw new Error('outOfScopeMedia 必须是数组，并为每张合同外媒体写明 path、contract 和 reason');
    }

    const manifestPaths = new Set(manifestMedia.map((reference) => (
        normalizePath(resolveMediaReference(reference, { projectRoot, manifestDir, indexDir }))
    )));
    const seenPaths = new Set();
    for (const [index, declaration] of declarations.entries()) {
        assertString(declaration?.path, `第 ${index + 1} 条 outOfScopeMedia 的 path`);
        assertString(declaration?.contract, `第 ${index + 1} 条 outOfScopeMedia 的 contract`);
        assertString(declaration?.reason, `第 ${index + 1} 条 outOfScopeMedia 的 reason`);
        const resolvedPath = normalizePath(resolveMediaReference(declaration.path, { projectRoot, manifestDir, indexDir }));
        if (!existsSync(resolvedPath)) {
            throw new Error(`outOfScopeMedia 引用的媒体不存在: ${declaration.path}`);
        }
        if (manifestPaths.has(resolvedPath)) {
            throw new Error(`outOfScopeMedia 不能重复声明 PASS 清单媒体: ${declaration.path}`);
        }
        if (seenPaths.has(resolvedPath)) {
            throw new Error(`outOfScopeMedia 存在重复媒体: ${declaration.path}`);
        }
        seenPaths.add(resolvedPath);
    }
    return declarations;
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
        if (!['main-flow', 'auxiliary-detail'].includes(entry.role)) {
            throw new Error(`E2E 证据索引第 ${entryIndex + 1} 条 role 必须是 main-flow 或 auxiliary-detail: ${entry.path}`);
        }
        if (entry.role === 'auxiliary-detail' && manifest?.display?.userRequestedCloseup !== true) {
            throw new Error(`最终 PASS 禁止特写/局部图: ${entry.path}。只有用户当轮明确点名特写且 display.userRequestedCloseup=true 时才允许 auxiliary-detail`);
        }
        if (mediaPathContainsForbiddenCropDirectory(resolvedPath)) {
            throw new Error(`最终 PASS 媒体不能放在特写/裁切目录: ${entry.path}`);
        }
        if (!['desktop', 'mobile'].includes(entry.viewport)) {
            throw new Error(`E2E 证据索引第 ${entryIndex + 1} 条 viewport 必须是 desktop 或 mobile: ${entry.path}`);
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

    validateChainSteps(mediaEntries);
    validateMediaDirectoryCompleteness({ mediaEntries, projectRoot, manifestDir, indexDir });

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

    const visualReview = validateVisualReview({
        manifest,
        manifestMedia,
        manifestDir,
        projectRoot,
        indexDir,
    });
    const outOfScopeMedia = validateOutOfScopeMedia({
        manifest,
        manifestMedia,
        projectRoot,
        manifestDir,
        indexDir,
    });

    for (const imagePath of imagePaths) {
        if (!seenPaths.has(normalizePath(imagePath))) {
            throw new Error(`本次打开的媒体不在 E2E 证据索引中: ${imagePath}`);
        }
    }

    return {
        indexPath,
        mediaCount: mediaEntries.length,
        chainCount: chains.size,
        visualReview,
        outOfScopeMediaCount: outOfScopeMedia.length,
    };
};
