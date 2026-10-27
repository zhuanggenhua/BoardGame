import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

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

const validateVisualReview = ({ manifest, manifestPath, manifestMedia, manifestDir, projectRoot, indexDir, visualOnly = false }) => {
    const visualReview = manifest?.visualReview;
    if (!visualReview || visualReview.mode !== 'all-media' || visualReview.claimScope !== 'interaction-ui' || visualReview.status !== 'PASS') {
        throw new Error('最终 PASS 必须声明 visualReview=all-media / interaction-ui / PASS，禁止用关键图抽查代替全量视觉验收');
    }
    const reviewer = visualReview.reviewer;
    if (!['subagent', 'primary-agent'].includes(reviewer?.kind) || typeof reviewer?.id !== 'string' || !reviewer.id.trim()) {
        throw new Error('最终 PASS 的 visualReview 必须记录真实 reviewer.kind=subagent 或 primary-agent 与非空 reviewer.id');
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
        if (visualOnly || manifest.changeType === 'refactor') {
            const resolve = (reference) => resolveMediaReference(reference, { projectRoot, manifestDir, indexDir });
            const requireFile = (reference, label) => {
                assertString(reference, label);
                const file = resolve(reference);
                if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`视觉证据文件不存在: ${label}`);
                return file;
            };
            if (!/^[a-f0-9]{64}$/i.test(entry.sha256 ?? '')) throw new Error('视觉审计缺少有效 sha256');
            const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
            if (sha(resolvedPath) !== entry.sha256.toLowerCase() || sha(requireFile(entry.source, 'source')) !== entry.sha256.toLowerCase()) {
                throw new Error(`视觉媒体与来源 SHA 不一致: ${entry.path}`);
            }
            const originalReviewFile = requireFile(entry.independentReviewFile, 'independentReviewFile');
            if (manifest.changeType === 'refactor') {
                if (realpathSync(originalReviewFile) === realpathSync(reviewPath ?? manifestPath)) throw new Error('原审查报告不能指向聚合报告自身');
                assertString(entry.sourceReviewEntry, 'sourceReviewEntry');
                if (!entry.sourceReviewEntry.startsWith('/')) throw new Error('sourceReviewEntry 必须是 JSON Pointer');
                let original = readJsonFile(originalReviewFile, '原审查报告');
                for (const part of entry.sourceReviewEntry.slice(1).split('/')) {
                    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
                    original = original && Object.hasOwn(original, key) ? original[key] : undefined;
                }
                if (!original || !(original.status === entry.status || (original.status === 'PASS' && entry.status === 'carried-forward')) || original.observation !== entry.observation || original.sha256 !== entry.sha256) throw new Error('聚合条目与原审查观察、状态或哈希不一致');
            }
            if (entry.status === 'carried-forward') {
                if (!Array.isArray(entry.unchangedEvidenceFiles) || entry.unchangedEvidenceFiles.length === 0) throw new Error('沿用项缺少 unchangedEvidenceFiles');
                entry.unchangedEvidenceFiles.forEach((file) => requireFile(file, 'unchangedEvidenceFiles'));
            }
        }
        reviewedPaths.add(resolvedPath);
    }
    if (reviewedPaths.size !== expectedPaths.size || [...expectedPaths].some((entry) => !reviewedPaths.has(entry))) {
        throw new Error('逐图视觉审计与 PASS 清单 media/images 未一一对应');
    }

    if (manifest.changeType === 'refactor') {
        assertString(visualReview.baselineReviewFile, 'baselineReviewFile');
        const baseline = readJsonFile(path.resolve(manifestDir, visualReview.baselineReviewFile), '旧新职责对照');
        if (baseline.status !== 'PASS' || !Array.isArray(baseline.requirements) || baseline.requirements.length !== manifest.requirements?.length) throw new Error('旧新职责对照缺项或未通过');
        const names = new Set();
        for (const item of baseline.requirements) {
            assertString(item.requirement, '基线需求');
            if (names.has(item.requirement) || !manifest.requirements.some(req => req.requirement === item.requirement) || item.status !== 'PASS') throw new Error('基线需求重复、不对应或未证明');
            names.add(item.requirement);
            for (const field of ['baselineSource', 'preservedInformation', 'preservedActions', 'changes', 'duplicateDecision', 'changeAuthority']) assertString(item[field], field);
            assertString(item.independentReviewFile, '原基线 independentReviewFile');
            assertString(item.sourceReviewEntry, '原基线 sourceReviewEntry');
            if (!item.sourceReviewEntry.startsWith('/')) throw new Error('原基线 sourceReviewEntry 必须是 JSON Pointer');
            const originalBaselinePath = resolveMediaReference(item.independentReviewFile, { projectRoot, manifestDir, indexDir });
            if (realpathSync(originalBaselinePath) === realpathSync(path.resolve(manifestDir, visualReview.baselineReviewFile))) throw new Error('原基线不能指向派生报告自身');
            const originalBaseline = readJsonFile(originalBaselinePath, '原基线报告');
            let originalItem = originalBaseline;
            for (const part of item.sourceReviewEntry.slice(1).split('/')) {
                const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
                originalItem = originalItem && Object.hasOwn(originalItem, key) ? originalItem[key] : undefined;
            }
            if (originalBaseline.status !== 'PASS' || originalItem?.status !== 'PASS') throw new Error('原基线裁决已失效或缺失');
            const unpack = value => { if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return value; } };
            for (const field of ['requirement', 'baselineSource', 'preservedInformation', 'preservedActions', 'changes', 'duplicateDecision', 'changeAuthority']) {
                if (!isDeepStrictEqual(unpack(item[field]), unpack(originalItem[field]))) throw new Error(`派生基线与原基线内容不一致: ${field}`);
            }
            // Archived and published copies may move; compare exact bytes, not path spelling.
            const mediaHash = (ref, original = false) => {
                const declared = original && typeof ref === 'object' && /^[a-f0-9]{64}$/i.test(ref.sha256 ?? '') ? ref.sha256.toLowerCase() : null;
                const file = resolveMediaReference(typeof ref === 'string' ? ref : ref.path, { projectRoot, manifestDir, indexDir });
                if (!existsSync(file) && declared) return declared; // Original may have been archived; derived bytes still must match.
                if (!existsSync(file) || !statSync(file).isFile()) throw new Error('原基线媒体不存在');
                const actual = createHash('sha256').update(readFileSync(file)).digest('hex');
                if (declared && declared !== actual) throw new Error('原基线媒体与声明哈希不一致');
                return actual;
            };
            for (const field of ['before', 'after']) {
                if (!Array.isArray(originalItem[field]) || !Array.isArray(item[field]) ||
                    !isDeepStrictEqual(originalItem[field].map(ref => mediaHash(ref, true)).sort(), item[field].map(ref => mediaHash(ref)).sort())) {
                    throw new Error(`派生基线与原基线媒体映射不一致: ${field}`);
                }
            }
            for (const field of ['before', 'after']) {
                if (!Array.isArray(item[field]) || !item[field].length) throw new Error(`基线对照缺少 ${field}`);
                for (const ref of item[field]) {
                    assertString(ref, field);
                    const file = normalizePath(resolveMediaReference(ref, { projectRoot, manifestDir, indexDir }));
                    if (!MEDIA_EXTENSIONS.has(path.extname(file).toLowerCase()) || (!existsSync(file) || !statSync(file).isFile())) throw new Error('基线对照媒体不存在');
                    if (field === 'after') {
                        const requirement = manifest.requirements.find(req => req.requirement === item.requirement);
                        const linked = requirement.evidence.map(ref => normalizePath(resolveMediaReference(ref, { projectRoot, manifestDir, indexDir })));
                        if (!expectedPaths.has(file) || !linked.includes(file)) throw new Error('基线新图不在该需求已审证据中');
                    }
                }
            }
        }
    }

    const behavioralVerification = manifest?.behavioralVerification;
    if (visualOnly && behavioralVerification?.status === 'not-claimed') {
        assertString(behavioralVerification.reason, '不声明行为验收的 reason');
        return { reviewPath, mediaCount: entries.length };
    }
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

const validateChainSteps = (mediaEntries, visualOnly = false) => {
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
        for (const stage of (visualOnly ? [] : ['前态', '中态', '后态'])) {
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
        if (declaration.chainId !== undefined || declaration.uiStateId !== undefined) {
            assertString(declaration.chainId, '内部媒体 chainId');
            assertString(declaration.uiStateId, '内部媒体 uiStateId');
        }
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

// 行为日志保留完整覆盖，展示媒体可按规范选取；内部状态仍须关联原图并校验来源。
const validateDistinctUIEvidence = ({ manifest, index, outOfScopeMedia, projectRoot, manifestDir, indexDir }) => {
    const resolve = ref => resolveMediaReference(ref, { projectRoot, manifestDir, indexDir });
    const requireFile = ref => {
        assertString(ref, '行为证据文件');
        const file = resolve(ref);
        if (!existsSync(file) || !statSync(file).isFile()) throw new Error('行为证据文件不存在');
        return file;
    };
    if (!Array.isArray(manifest.behaviorChains) || !manifest.behaviorChains.length) throw new Error('独特界面策略缺少完整行为链');
    if (!Array.isArray(manifest.requirements) || !manifest.requirements.length) throw new Error('独特界面策略缺少需求覆盖');
    const traces = new Map();
    const capturedStates = new Set();
    const isRecord = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
    const states = new Set();
    const hashes = new Set();
    for (const chain of manifest.behaviorChains) {
        for (const field of ['chainId', 'sourceRun', 'sourceRevision']) assertString(chain[field], field);
        if (traces.has(chain.chainId)) throw new Error('重复行为链');
        const trace = readJsonFile(requireFile(chain.evidence), '行为链日志');
        if (trace.evidenceCategory !== manifest.evidenceCategory || trace.gameId !== manifest.gameId || ['chainId', 'sourceRun', 'sourceRevision'].some(key => trace[key] !== chain[key])) throw new Error('行为链日志与清单必须同源');
        if (trace.status !== 'PASS') throw new Error('行为链未通过');
        assertString(trace.outcome, '行为链最终结果');
        if (!Array.isArray(trace.steps) || !trace.steps.length || !Array.isArray(chain.requiredSteps) || !chain.requiredSteps.length) throw new Error('行为链缺少必要动作');
        const stepIds = new Set();
        if (new Set(chain.requiredSteps).size !== chain.requiredSteps.length || chain.requiredSteps.some(id => typeof id !== 'string' || !id.trim())) throw new Error('必要动作标识无效或重复');
        for (const step of trace.steps) {
            assertString(step.id, '行为步骤标识');
            assertString(step.action, '实际动作');
            if (stepIds.has(step.id)) throw new Error('重复行为步骤');
            stepIds.add(step.id);
            if (!isRecord(step.before) || !isRecord(step.after) || !isRecord(step.before.visible) || !isRecord(step.before.authoritative) || !isRecord(step.after.visible) || !isRecord(step.after.authoritative)) throw new Error('行为链缺少前后状态');
            if (!Array.isArray(step.assertions) || !step.assertions.length) throw new Error('行为链缺少实际断言');
            for (const assertion of step.assertions) {
                assertString(assertion.name, '断言名称');
                if (!Object.hasOwn(assertion, 'actual') || !Object.hasOwn(assertion, 'expected') || !isDeepStrictEqual(assertion.actual, assertion.expected)) throw new Error('行为链实际断言失败');
            }
        }
        if (chain.requiredSteps.some(id => !stepIds.has(id))) throw new Error('行为链缺少必要动作');
        const requiredOrder = chain.requiredSteps.map(id => trace.steps.findIndex(step => step.id === id));
        if (requiredOrder.some((position, i) => i > 0 && position <= requiredOrder[i - 1])) throw new Error('必要动作顺序不一致');
        if (manifest.evidenceCategory === 'golden') {
            assertString(trace.browserContextId, '黄金链浏览器上下文');
            const first = traces.values().next().value?.trace;
            if (first && ['sourceRun', 'sourceRevision', 'browserContextId'].some(key => first[key] !== trace[key])) throw new Error('黄金链必须同源同浏览器上下文');
            const terminal = trace.steps.find(step => step.id === trace.terminalStepId);
            if (!terminal || terminal !== trace.steps.at(-1) || terminal.after.authoritative.gameOver !== true || terminal.after.visible.gameOver !== true || !terminal.assertions.some(assertion => assertion.name === 'terminal-gameover' && assertion.actual === true && assertion.expected === true)) throw new Error('黄金链缺少正式终局断言');
        }
        if (!Array.isArray(trace.uiStates)) throw new Error('行为链缺少独特界面状态清单');
        traces.set(chain.chainId, { trace, stepIds });
    }
    const meaningfulChanges = new Set(['layout', 'panel', 'interaction-mode', 'target-highlight', 'error', 'empty', 'animation-phase']);
    for (const entry of index.media) {
        assertString(entry.uiStateId, '稳定界面状态标识');
        assertString(entry.uiChangeReason, '实质界面变化理由');
        if (!meaningfulChanges.has(entry.uiChange)) throw new Error('截图必须是实质界面变化，不是数值变化或重复返回');
        if (states.has(entry.uiStateId)) throw new Error('重复独特界面状态');
        states.add(entry.uiStateId);
        capturedStates.add(JSON.stringify([entry.chainId, entry.uiStateId]));
        const source = traces.get(entry.chainId);
        if (!source || entry.sourceRun !== source.trace.sourceRun || entry.sourceRevision !== source.trace.sourceRevision || !source.stepIds.has(entry.behaviorStepId)) throw new Error('截图与行为步骤必须同源');
        const state = source.trace.uiStates.find(state => state.id === entry.uiStateId);
        const digest = createHash('sha256').update(readFileSync(requireFile(entry.path))).digest('hex');
        if (!state || state.stepId !== entry.behaviorStepId || state.change !== entry.uiChange || state.viewport !== entry.viewport || state.sha256 !== digest) throw new Error('截图与行为日志的界面状态或来源哈希不一致');
        if (hashes.has(digest)) throw new Error('重复界面内容');
        hashes.add(digest);
        if (!Array.isArray(entry.requirements) || !entry.requirements.length || entry.requirements.some(name => !manifest.requirements.some(req => req.requirement === name))) throw new Error('截图缺少有效需求关联');
    }
    const internalStates = new Map();
    for (const declaration of outOfScopeMedia.filter(entry => entry.chainId !== undefined)) {
        const key = JSON.stringify([declaration.chainId, declaration.uiStateId]);
        if (internalStates.has(key)) throw new Error('重复内部界面状态声明');
        internalStates.set(key, declaration);
    }
    for (const { trace, stepIds } of traces.values()) {
        if (new Set(trace.uiStates.map(state => state.id)).size !== trace.uiStates.length) throw new Error('日志重复独特界面状态');
        for (const state of trace.uiStates) {
            const key = JSON.stringify([trace.chainId, state.id]);
            if (capturedStates.has(key)) continue;
            const declaration = internalStates.get(key);
            if (!declaration) throw new Error('缺少实质界面状态截图或内部媒体声明');
            if (!stepIds.has(state.stepId) || !meaningfulChanges.has(state.change)) throw new Error('内部界面状态关联无效');
            assertString(state.viewport, '内部界面状态 viewport');
            const file = requireFile(declaration.path);
            const relative = path.relative(realpathSync(indexDir), realpathSync(file));
            if (relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))) throw new Error('内部媒体必须位于展示目录之外');
            const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
            if (state.sha256 !== digest) throw new Error('内部媒体与行为日志的来源哈希不一致');
            internalStates.delete(key);
        }
    }
    if (internalStates.size) throw new Error('内部媒体声明未关联未展示的界面状态');
    if (new Set(manifest.requirements.map(req => req.requirement)).size !== manifest.requirements.length) throw new Error('重复需求名称');
    for (const chain of manifest.behaviorChains) {
        if (!manifest.requirements.some(req => req.evidence?.some(ref => normalizePath(resolve(ref)) === normalizePath(resolve(chain.evidence))))) throw new Error('行为链没有需求覆盖');
        const media = index.media.filter(entry => entry.chainId === chain.chainId);
        const positions = media.map(entry => traces.get(chain.chainId).trace.steps.findIndex(step => step.id === entry.behaviorStepId));
        if (positions.some((position, i) => i > 0 && position < positions[i - 1])) throw new Error('图片与行为步骤顺序不一致');
    }
    for (const entry of index.media) for (const req of manifest.requirements) {
        const linked = req.evidence?.some(ref => normalizePath(resolve(ref)) === normalizePath(resolve(entry.path)));
        if (Boolean(linked) !== entry.requirements.includes(req.requirement)) throw new Error('媒体与需求关联不一致');
    }
    const allowedEvidence = new Set([...manifest.behaviorChains.map(chain => normalizePath(resolve(chain.evidence))), ...index.media.map(entry => normalizePath(resolve(entry.path)))]);
    for (const req of manifest.requirements) {
        assertString(req.requirement, '需求名称');
        if (req.status !== 'PASS' || !Array.isArray(req.evidence) || !req.evidence.length) throw new Error('需求缺少通过证据');
        for (const ref of req.evidence) if (!allowedEvidence.has(normalizePath(requireFile(ref)))) throw new Error('需求证据未关联实际行为链或已审界面');
    }
    return traces.size;
};

export const validateE2EImageIndex = ({ manifest, manifestPath, imagePaths = [], projectRoot }) => {
    if (manifest?.display?.finalPassBeforeOpen !== true) return null;
    if (manifest.changeType !== undefined && !['refactor', 'new', 'unchanged'].includes(manifest.changeType)) throw new Error('未知 changeType');

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

    const policies = [manifest.capturePolicy, index.capturePolicy];
    if (policies.some(policy => policy !== undefined && !['distinct-ui-state', 'legacy-three-stage'].includes(policy))) throw new Error('未知截图策略');
    const distinctUI = policies.includes('distinct-ui-state');
    if (distinctUI && (!policies.every(policy => policy === 'distinct-ui-state') || manifest.acceptanceMode !== 'behavioral-chain' || index.acceptanceMode !== 'behavioral-chain' || !manifest.gameId || manifest.gameId !== index.gameId || !['golden', 'tutorial', 'independent'].includes(manifest.evidenceCategory) || manifest.evidenceCategory !== index.evidenceCategory)) throw new Error('截图策略、验收模式、游戏或类别不一致');
    const modes = [manifest.acceptanceMode, index.acceptanceMode];
    if (modes.some((mode) => mode !== undefined && !['behavioral-chain', 'visual-only'].includes(mode))) throw new Error('未知 acceptanceMode');
    const visualOnly = modes.includes('visual-only');
    if (visualOnly) {
        if (!modes.every((mode) => mode === 'visual-only') || manifest.evidenceCategory !== 'independent' || index.evidenceCategory !== 'independent' || !manifest.gameId || manifest.gameId !== index.gameId) {
            throw new Error('纯视觉合同模式、类别或游戏身份不一致');
        }
        assertString(manifest.acceptanceReason, '用户限定视觉范围的 acceptanceReason');
        if (!Array.isArray(manifest.requirements) || manifest.requirements.length === 0) throw new Error('视觉合同缺少 requirements');
        const declaredMedia = Array.isArray(manifest.media) ? manifest.media : manifest.images;
        const declaredPaths = new Set((declaredMedia ?? []).map((reference) => normalizePath(resolveMediaReference(reference, { projectRoot, manifestDir, indexDir: path.dirname(indexPath) }))));
        for (const requirement of manifest.requirements) {
            assertString(requirement.requirement, 'requirement.requirement');
            if (requirement.status !== 'PASS' || !Array.isArray(requirement.evidence) || requirement.evidence.length === 0) throw new Error('视觉需求缺少已通过证据');
            for (const reference of requirement.evidence) {
                assertString(reference, 'requirement.evidence');
                const file = resolveMediaReference(reference, { projectRoot, manifestDir, indexDir: path.dirname(indexPath) });
                if (!existsSync(file) || !statSync(file).isFile()) throw new Error('视觉需求证据不存在');
                if (MEDIA_EXTENSIONS.has(path.extname(file).toLowerCase()) && !declaredPaths.has(normalizePath(file))) throw new Error('视觉需求引用了本组未审媒体');
            }
        }
    }
    const indexDir = path.dirname(indexPath);
    const mediaEntries = index.media;
    const seenPaths = new Set();
    const seenVisualContent = new Map();
    const chains = new Map();
    for (const [entryIndex, entry] of mediaEntries.entries()) {
        for (const field of REQUIRED_FIELDS) assertString(entry?.[field], `第 ${entryIndex + 1} 条媒体的 ${field}`);
        assertChineseDescription(entry.description, entryIndex);
        if (visualOnly && entry.stage !== '独立代表态') throw new Error('纯视觉媒体必须明确为独立代表态');
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
        if (visualOnly) {
            const digest = createHash('sha256').update(readFileSync(resolvedPath)).digest('hex');
            const prior = seenVisualContent.get(digest);
            if (prior) throw new Error(`纯视觉证据存在重复画面: ${entry.path} 与 ${prior}`);
            seenVisualContent.set(digest, entry.path);
        }

        const chain = chains.get(entry.chainId) ?? new Set();
        assertString(entry.stage, `第 ${entryIndex + 1} 条媒体的 stage`);
        chain.add(entry.stage.trim());
        chains.set(entry.chainId, chain);
    }

    const expectedStages = visualOnly || distinctUI ? [] : ['前态', '中态', '后态'];
    for (const [chainId, stages] of chains.entries()) {
        const missingStages = expectedStages.filter((stage) => !stages.has(stage));
        if (missingStages.length > 0) {
            throw new Error(`E2E 证据链 ${chainId} 缺少 ${missingStages.join('、')}，最终 PASS 必须有前态/中态/后态`);
        }
    }

    validateChainSteps(mediaEntries, visualOnly || distinctUI);
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

    const outOfScopeMedia = validateOutOfScopeMedia({
        manifest,
        manifestMedia,
        projectRoot,
        manifestDir,
        indexDir,
    });
    const behaviorChainCount = distinctUI ? validateDistinctUIEvidence({ manifest, index, outOfScopeMedia, projectRoot, manifestDir, indexDir }) : chains.size;
    const visualReview = validateVisualReview({
        manifestPath,
        visualOnly,
        manifest,
        manifestMedia,
        manifestDir,
        projectRoot,
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
        chainCount: behaviorChainCount,
        capturePolicy: distinctUI ? 'distinct-ui-state' : manifest.capturePolicy ?? 'legacy-three-stage',
        acceptanceMode: visualOnly ? 'visual-only' : 'behavioral-chain',
        visualReview,
        outOfScopeMediaCount: outOfScopeMedia.length,
    };
};
