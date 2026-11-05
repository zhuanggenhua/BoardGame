import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { validateE2EImageIndex } from './e2e-image-index-contract.mjs';

const projectRoot = process.cwd();
const baseDir = path.resolve(projectRoot, 'test-results/evidence-screenshots/mage-wars');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const resolve = (file) => path.resolve(projectRoot, file);
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const within = (root, target) => {
    const relative = path.relative(root, target);
    assert(relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`), `目标越界: ${target}`);
};
const contains = (root, target) => {
    const relative = path.relative(root, target);
    return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};
const specs = (suite) => [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(specs)];
const argument = process.argv.indexOf('--plan');
assert(argument >= 0 && process.argv[argument + 1], '用法: node scripts/verify/build-mage-wars-independent-aggregate.mjs --plan <当前证据计划.json>；必须提供真实跑次和逐媒体审查，不能按目录存在自动写 PASS。');
const planPath = resolve(process.argv[argument + 1]);
const plan = readJson(planPath);
assert(Array.isArray(plan.groups) && plan.groups.length > 0, '计划缺少目标组');
const outDir = resolve(plan.outputDir);
within(baseDir, outDir);
assert(!path.relative(baseDir, outDir).split(path.sep).some(segment => segment.startsWith('_')), '最终目录不能位于历史或临时区');
const verification = plan.behavioralVerification;
assert(verification?.owner === 'vitest' && verification.status === 'PASS', '缺少独立行为验证');
const unitReport = readJson(resolve(verification.report));
assert(unitReport.success === true && unitReport.numFailedTests === 0 && unitReport.numPassedTests > 0, 'Vitest 实际报告没有全部通过');
assert(verification.commands?.some(command => /vitest/i.test(command)), '缺少实际 Vitest 命令');
assert(Array.isArray(verification.testFiles) && verification.testFiles.length > 0, '计划缺少行为验证文件范围');
for (const expectedFile of verification.testFiles) {
    const result = unitReport.testResults?.find(item => typeof item.name === 'string' && resolve(item.name) === resolve(expectedFile));
    assert(result?.status === 'passed' && result.assertionResults?.some(item => item.status === 'passed'), `Vitest 报告未覆盖通过该文件: ${expectedFile}`);
}

const collected = [];
const excludedMedia = [];
for (const group of plan.groups) {
    assert(/^\d{2}$/.test(group.order) && typeof group.label === 'string', '组序号或名称无效');
    const sourceDir = resolve(group.sourceDir);
    within(baseDir, sourceDir);
    assert(!contains(outDir, sourceDir) && !contains(sourceDir, outDir), '输出与源证据目录不能相同或互为祖先');
    const sourceIndex = readJson(path.join(sourceDir, '.e2e-image-index.json'));
    assert(sourceIndex.gameId === 'mage-wars' && sourceIndex.evidenceCategory === 'independent', `证据身份不匹配: ${sourceDir}`);
    assert(sourceIndex.media?.length > 0, `源索引为空: ${sourceDir}`);
    assert(typeof sourceIndex.sourceRun === 'string' && sourceIndex.sourceRun.length > 0
        && sourceIndex.media.every(entry => entry.sourceRun === sourceIndex.sourceRun), `源索引混入其它跑次: ${sourceDir}`);
    const sourceManifestName = fs.readdirSync(sourceDir).find(name => name.endsWith('-PASS.json'));
    assert(sourceManifestName, `缺少源运行清单: ${sourceDir}`);
    const sourceManifestPath = path.join(sourceDir, sourceManifestName);
    const sourceManifest = readJson(sourceManifestPath);
    excludedMedia.push(...(sourceManifest.outOfScopeMedia ?? []));
    assert(sourceManifest.verdict === 'PASS' && sourceManifest.gameId === 'mage-wars'
        && sourceManifest.evidenceCategory === 'independent', `源运行清单未通过或身份不符: ${sourceManifestPath}`);
    const manifestMedia = new Set((sourceManifest.media ?? []).map(reference => {
        const fromProject = resolve(reference);
        return fs.existsSync(fromProject) ? fromProject : path.resolve(sourceDir, reference);
    }));
    assert(manifestMedia.size === sourceIndex.media.length && sourceIndex.media.every(entry =>
        manifestMedia.has(path.resolve(sourceDir, entry.path))), `源清单与索引媒体集合不一致: ${sourceDir}`);
    const runReport = readJson(resolve(group.e2eResults));
    const spec = specs({ suites: runReport.suites }).find(item => item.title === group.testTitle);
    const test = spec?.tests?.find(item => item.status === 'expected' && item.results?.at(-1)?.status === 'passed');
    assert(test, `当前用例未通过: ${group.testTitle}`);
    const annotations = [...(test.annotations ?? []), ...(test.results.at(-1).annotations ?? [])];
    assert(annotations.some(item => {
        if (item.type !== 'pass-manifest') return false;
        const recorded = path.resolve(item.description);
        if (recorded === sourceManifestPath) return true;
        return /^\d{13}-\d+-[a-f0-9-]{36}$/i.test(sourceIndex.sourceRun ?? '')
            && recorded.includes(`${path.sep}_temporary${path.sep}`)
            && path.basename(path.dirname(recorded)) === sourceIndex.sourceRun
            && path.basename(recorded) === sourceManifestName;
    }), `运行结果没有绑定该源清单或同一晋升前跑次: ${sourceManifestPath}`);
    const reviews = group.reviewFiles.map(reference => {
        const file = resolve(reference);
        const review = readJson(file);
        assert(review.mode === 'all-media' && review.claimScope === 'interaction-ui' && review.status === 'PASS', `图面报告尚未通过: ${file}`);
        assert(['subagent', 'primary-agent'].includes(review.reviewer?.kind) && review.reviewer.id, `报告缺少真实审查者: ${file}`);
        return { file, review };
    });
    for (const [index, entry] of sourceIndex.media.entries()) {
        const source = path.resolve(sourceDir, entry.path);
        within(sourceDir, source);
        const sha256 = hash(source);
        let match;
        for (const { file, review } of reviews) {
            const entries = review.media ?? review.entries;
            const reviewIndex = entries?.findIndex(item => typeof item.path === 'string'
                && path.resolve(projectRoot, item.path) === source && item.sha256 === sha256) ?? -1;
            if (reviewIndex >= 0) match = { file, reviewer: review.reviewer, entry: entries[reviewIndex], pointer: `/${review.media ? 'media' : 'entries'}/${reviewIndex}` };
        }
        assert(match && ['PASS', 'carried-forward'].includes(match.entry.status), `缺少本媒体对应的有效审查: ${source}`);
        assert(typeof match.entry.observation === 'string' && match.entry.observation.length > 0, `审查缺少真实观察: ${source}`);
        const part = group.parts?.find(item => index >= item.start && index < item.end);
        assert(!group.parts || part, `分段合同没有覆盖媒体: ${source}`);
        collected.push({ group, entry, index, source, sha256, match, part, sourceManifestPath });
    }
}
assert(new Set(plan.groups.map(group => group.order)).size === plan.groups.length, '组序号重复');
const candidateDir = path.resolve(projectRoot, '.tmp', `mage-wars-aggregate-${crypto.randomUUID()}`);
within(path.resolve(projectRoot, '.tmp'), candidateDir);
fs.mkdirSync(candidateDir, { recursive: true });
const media = [];
const reviewEntries = [];
const chainSteps = new Map();
for (const item of collected) {
    const displayName = item.group.fileNames?.[item.entry.path] ?? path.basename(item.entry.path);
    assert(path.basename(displayName) === displayName, '交付文件名不能包含路径');
    const title = path.basename(displayName, path.extname(displayName)).replace(/^(?:\d+[A-Za-z]?-)+/u, '');
    const fileName = `${String(media.length + 1).padStart(3, '0')}-${title}${path.extname(displayName)}`;
    const destination = path.join(candidateDir, fileName);
    assert(!fs.existsSync(destination), `媒体名称冲突: ${fileName}`);
    fs.copyFileSync(item.source, destination);
    assert(hash(destination) === item.sha256, `复制后内容不一致: ${fileName}`);
    const chainId = `${item.group.order}-${item.entry.chainId}${item.part ? `-${item.part.id}` : ''}`;
    const chainStep = (chainSteps.get(chainId) ?? 0) + 1;
    chainSteps.set(chainId, chainStep);
    const partIndex = item.part ? item.index - item.part.start : null;
    media.push({
        ...item.entry,
        path: fileName,
        label: title,
        groupOrder: item.group.order,
        chainId,
        chainStep: String(chainStep),
        role: 'main-flow',
        viewport: 'desktop',
        ...(item.part ? { stage: partIndex === 0 ? '前态' : item.index === item.part.end - 1 ? '后态' : '中态' } : {}),
        originalSourceDir: path.relative(projectRoot, path.dirname(item.source)).split(path.sep).join('/'),
        sourceDir: path.relative(projectRoot, candidateDir).split(path.sep).join('/'),
    });
    reviewEntries.push({
        ...item.match.entry,
        checks: Array.isArray(item.match.entry.checks)
            ? item.match.entry.checks
            : Object.entries(item.match.entry.checks ?? {}).filter(([, passed]) => passed === true).map(([check]) => check),
        sourceReviewChecks: item.match.entry.checks,
        path: fileName,
        source: item.source,
        sourceReviewMetadata: item.match.entry.source,
        sha256: item.sha256,
        reviewer: item.match.reviewer,
        independentReviewFile: item.match.file,
        sourceReviewEntry: item.match.pointer,
    });
}
const generatedAt = new Date().toISOString();
const review = {
    mode: 'all-media', claimScope: 'interaction-ui', status: 'PASS',
    reviewer: { kind: 'primary-agent', id: '/root' },
    method: '整合真实逐媒体审查报告；原审查者、原观察、状态和来源指针逐项保留，不替代原图审查。',
    media: reviewEntries,
};
const index = {
    title: '法师战争 · 当前独立交互与动效', gameId: 'mage-wars', evidenceCategory: 'independent',
    generatedAt, acceptanceMode: 'behavioral-chain', capturePolicy: 'legacy-three-stage',
    scope: plan.scope,
    groups: plan.groups.map(group => ({ order: group.order, label: group.label, entryBoundary: group.entryBoundary })),
    media,
};
const manifest = {
    verdict: 'PASS', gameId: 'mage-wars', evidenceCategory: 'independent', generatedAt,
    scope: 'current-user-request',
    acceptanceMode: 'behavioral-chain', capturePolicy: 'legacy-three-stage', changeType: 'unchanged',
    entryBoundary: '正式双人牌桌独立代表态消费链；不同用例不拼成自然开局或黄金链。',
    captureCompatibility: '沿用既有独立用例的整屏 JPEG 和三阶段索引；原始编码保留，不将压缩图重命名为无损原图。',
    evidenceIndex: '.e2e-image-index.json', media: media.map(item => path.join(candidateDir, item.path)),
    outOfScopeMedia: [...new Map(excludedMedia.map(item => [resolve(item.path), item])).values()],
    requirements: plan.groups.map(group => ({
        requirement: group.label, status: 'PASS',
        entryBoundary: group.entryBoundary ?? '独立代表态消费链',
        evidence: media.filter(item => item.groupOrder === group.order).map(item => item.path),
        behavioralEvidence: resolve(group.e2eResults),
    })),
    behavioralVerification: { ...verification, evidence: [resolve(verification.report), ...new Set(plan.groups.map(group => resolve(group.e2eResults)))] },
    visualReview: { mode: 'all-media', claimScope: 'interaction-ui', status: 'PASS', reviewer: review.reviewer, reviewFile: 'visual-review.json' },
    sourceManifests: [...new Set(collected.map(item => item.sourceManifestPath))],
    display: { purpose: 'final-user-visible-delivery', trigger: 'user-requested-evidence', viewer: 'web', finalPassBeforeOpen: true },
};
const manifestName = 'focused-pass-manifest.json';
writeJson(path.join(candidateDir, '.e2e-image-index.json'), index);
writeJson(path.join(candidateDir, 'visual-review.json'), review);
writeJson(path.join(candidateDir, manifestName), manifest);
validateE2EImageIndex({ manifest, manifestPath: path.join(candidateDir, manifestName), projectRoot });
index.media.forEach(item => { item.sourceDir = path.relative(projectRoot, outDir).split(path.sep).join('/'); });
manifest.media = media.map(item => path.join(outDir, item.path));
writeJson(path.join(candidateDir, '.e2e-image-index.json'), index);
writeJson(path.join(candidateDir, manifestName), manifest);
if (fs.existsSync(outDir)) {
    const history = path.join(baseDir, '_history', path.basename(outDir), crypto.randomUUID());
    within(baseDir, history);
    fs.mkdirSync(path.dirname(history), { recursive: true });
    fs.renameSync(outDir, history);
    try {
        fs.renameSync(candidateDir, outDir);
        validateE2EImageIndex({ manifest, manifestPath: path.join(outDir, manifestName), projectRoot });
    } catch (error) {
        if (fs.existsSync(outDir)) fs.renameSync(outDir, candidateDir);
        fs.renameSync(history, outDir);
        throw error;
    }
} else {
    fs.renameSync(candidateDir, outDir);
    try { validateE2EImageIndex({ manifest, manifestPath: path.join(outDir, manifestName), projectRoot }); }
    catch (error) { fs.renameSync(outDir, candidateDir); throw error; }
}
console.log(JSON.stringify({ outDir, groupCount: plan.groups.length, mediaCount: media.length, generatedAt }, null, 2));
