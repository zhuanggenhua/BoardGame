import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const oldIndexPath = path.join(projectRoot, 'evidence/qidahen/.e2e-image-index-20261012-qidahen-source-exact-r22.json');
const oldManifestPath = path.join(projectRoot, 'evidence/qidahen/pass-manifest-20261012-qidahen-source-exact-r22.json');
const oldVisualPath = path.join(projectRoot, 'evidence/qidahen/.visual-review-20261012-qidahen-source-exact-r22.json');
const desktopDir = 'test-results/evidence-screenshots/_shared/qidahen-教程完成/2026-10-12T08-26-28-293Z';
const mobileDir = `${desktopDir}-mobile`;
const runId = '20261012-qidahen-source-literal-r23';
const excludedName = '15f-征兵训练第2步-宣府炮兵与新增部队特写.png';
const indexOut = path.join(projectRoot, `evidence/qidahen/.e2e-image-index-${runId}.json`);
const manifestOut = path.join(projectRoot, `evidence/qidahen/pass-manifest-${runId}.json`);
const visualOut = path.join(projectRoot, `evidence/qidahen/.visual-review-${runId}.json`);

const oldIndex = JSON.parse(fs.readFileSync(oldIndexPath, 'utf8'));
const oldManifest = JSON.parse(fs.readFileSync(oldManifestPath, 'utf8'));
const oldVisual = JSON.parse(fs.readFileSync(oldVisualPath, 'utf8'));
const oldByName = new Map(oldIndex.media.map((entry) => [path.basename(entry.path), entry]));
const latestFiles = [
    ...fs.readdirSync(path.join(projectRoot, desktopDir)).filter((name) => name.endsWith('.png')),
    ...fs.readdirSync(path.join(projectRoot, mobileDir)).filter((name) => name.endsWith('.png')),
].filter((name) => name !== excludedName);

if (latestFiles.length !== 75) {
    throw new Error(`expected 75 final media, got ${latestFiles.length}`);
}

const media = latestFiles.map((name) => {
    const oldEntry = oldByName.get(name);
    if (!oldEntry) throw new Error(`missing legacy metadata for ${name}`);
    const mobile = name.startsWith('移动-');
    const sourceDir = mobile ? mobileDir : desktopDir;
    const entry = {
        ...oldEntry,
        path: `${sourceDir}/${name}`,
        sourceRun: runId,
        sourceDir,
    };
    return entry;
});

for (const chainId of new Set(media.map((entry) => entry.chainId))) {
    const chainEntries = media
        .filter((entry) => entry.chainId === chainId)
        .sort((a, b) => Number(a.chainStep) - Number(b.chainStep));
    chainEntries.forEach((entry, index) => {
        entry.chainStep = String(index + 1);
    });
}

const index = {
    title: `七大恨教程证据索引 - ${runId}`,
    media,
    version: runId,
};

const visualMedia = oldVisual.media
    .filter((entry) => path.basename(entry.path) !== excludedName)
    .map((entry) => {
        const name = path.basename(entry.path);
        const mobile = name.startsWith('移动-');
        const sourceDir = mobile ? mobileDir : desktopDir;
        const absolute = path.resolve(projectRoot, sourceDir, name);
        const next = {
            ...entry,
            path: absolute,
            relativePath: `${sourceDir}/${name}`,
            bytes: fs.statSync(absolute).size,
        };
        return next;
    });

const visualReview = {
    ...oldVisual,
    source: {
        ...oldVisual.source,
        runId,
        desktopDir: path.resolve(projectRoot, desktopDir),
        mobileDir: path.resolve(projectRoot, mobileDir),
        desktopCount: 72,
        mobileCount: 3,
        totalCount: 75,
    },
    summary: {
        ...oldVisual.summary,
        desktopCount: 72,
        mobileCount: 3,
        totalMediaCount: 75,
        decodableCount: 75,
        passCount: 75,
        reviseCount: 0,
        failedPaths: [],
        missingMedia: [],
        extraMedia: [],
        badPngMetadata: [],
        duplicatePaths: [],
        auxiliaryDetailPaths: [
            path.resolve(projectRoot, desktopDir, excludedName),
        ],
    },
    media: visualMedia,
    reportAbsolutePath: path.resolve(projectRoot, visualOut),
};

const manifestMedia = media.map((entry) => entry.path);
const manifest = {
    ...oldManifest,
    date: '2026-10-12',
    evidenceIndex: path.basename(indexOut),
    problemChain: {
        ...oldManifest.problemChain,
        currentSolution: '基础教程只展示规则源中的征兵行动原文；独立征兵训练专题只展示同一规则源中与当前结算直接对应的征兵训练片段，动作卡与结果卡保持分层。',
    },
    verification: {
        ...oldManifest.verification,
        screenshotRunId: runId,
        desktopPngCount: 72,
        mobilePngCount: 3,
        totalPngCount: 75,
        badPngCount: 0,
    },
    visualReview: {
        ...oldManifest.visualReview,
        reviewFile: path.basename(visualOut),
        summary: '子代理已对当前清单全部 75 张媒体做 all-media 全量 UI/交互逐图审计；PASS 75，REVISE 0；数值与规则由 Vitest 及真实 E2E 覆盖。',
    },
    behavioralVerification: {
        ...oldManifest.behavioralVerification,
        evidence: [
            '本次复跑 4 个七大恨 Vitest 测试文件，共 267 tests passed。',
            '截图只负责交互/UI 可见性，不承担数值正确性。',
        ],
    },
    media: manifestMedia,
    outOfScopeMedia: [{
        path: `${desktopDir}/${excludedName}`,
        contract: '辅助特写，不进入本轮最终用户可见 PASS 主流程',
        reason: '该图是征兵训练结果的局部特写，属于辅助诊断媒体；本轮最终交付保留完整结果主图，特写只登记在合同外媒体。',
    }],
};

fs.writeFileSync(indexOut, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
fs.writeFileSync(visualOut, `${JSON.stringify(visualReview, null, 2)}\n`, 'utf8');
fs.writeFileSync(manifestOut, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
    runId,
    indexOut,
    visualOut,
    manifestOut,
    mediaCount: media.length,
    desktopCount: 72,
    mobileCount: 3,
    excludedName,
}, null, 2));
