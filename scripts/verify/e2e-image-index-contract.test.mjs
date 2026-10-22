import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateE2EImageIndex } from './e2e-image-index-contract.mjs';

const makeFixture = ({ descriptions, stages = ['前态', '中态', '后态'] }) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'boardgame-e2e-contract-'));
    const evidenceDir = path.join(root, 'evidence');
    mkdirSync(evidenceDir, { recursive: true });
    const paths = stages.map((stage, index) => {
        const fileName = `${index + 1}-${stage}.jpg`;
        writeFileSync(path.join(evidenceDir, fileName), 'fixture');
        return fileName;
    });
    const index = {
        version: 1,
        media: paths.map((fileName, index) => ({
            path: fileName,
            chainId: 'fixture-chain',
            chainStep: String(index + 1).padStart(2, '0'),
            sourceRun: 'fixture-run',
            sourceDir: 'evidence',
            stage: stages[index],
            role: 'main-flow',
            viewport: 'desktop',
            transition: index === 0 ? '进入测试链路' : `从第${index}张进入第${index + 1}张`,
            description: descriptions[index],
        })),
    };
    writeFileSync(path.join(evidenceDir, '.e2e-image-index.json'), JSON.stringify(index, null, 2));
    const visualReview = {
        mode: 'all-media',
        claimScope: 'interaction-ui',
        status: 'PASS',
        media: paths.map((fileName, index) => ({
            path: fileName,
            status: 'PASS',
            checks: ['target-visible', 'interaction-ui', 'layout-readable', 'no-error'],
            observation: `目标对象第${index + 1}张画面清楚可见`,
        })),
    };
    writeFileSync(path.join(evidenceDir, '.visual-review.json'), JSON.stringify(visualReview, null, 2));
    const manifestPath = path.join(evidenceDir, 'pass.json');
    writeFileSync(manifestPath, JSON.stringify({
        verdict: 'PASS',
        display: { finalPassBeforeOpen: true },
        visualReview: {
            mode: 'all-media',
            claimScope: 'interaction-ui',
            status: 'PASS',
            reviewer: { kind: 'subagent', id: 'fixture-reviewer' },
            reviewFile: '.visual-review.json',
        },
        behavioralVerification: {
            owner: 'vitest',
            status: 'PASS',
            commands: ['node scripts/infra/vitest-cli-safe.mjs run fixture.test.ts'],
            evidence: ['fixture 数值与规则断言通过'],
        },
        evidenceIndex: '.e2e-image-index.json',
        media: paths.map((fileName) => path.join('evidence', fileName)),
    }, null, 2));
    return { root, manifestPath };
};

test('最终 E2E 证据要求中文说明且具备前中后', () => {
    const fixture = makeFixture({ descriptions: ['目标对象在前态可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    assert.doesNotThrow(() => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }));
});

test('英文、夹带英文字母或缺中态的索引不能通过最终 PASS', () => {
    const english = makeFixture({ descriptions: ['Before state', 'During state', 'After state'] });
    const englishManifest = JSON.parse(readFileSync(english.manifestPath, 'utf8'));
    assert.throws(() => validateE2EImageIndex({ manifest: englishManifest, manifestPath: english.manifestPath, projectRoot: english.root }), /必须用中文/);

    const mixedLanguage = makeFixture({ descriptions: ['目标对象 before', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const mixedLanguageManifest = JSON.parse(readFileSync(mixedLanguage.manifestPath, 'utf8'));
    assert.throws(() => validateE2EImageIndex({ manifest: mixedLanguageManifest, manifestPath: mixedLanguage.manifestPath, projectRoot: mixedLanguage.root }), /不得包含英文字母/);

    const missingMiddle = makeFixture({
        descriptions: ['前态目标对象可见', '后态结果对象稳定可见'],
        stages: ['前态', '后态'],
    });
    const missingMiddleManifest = JSON.parse(readFileSync(missingMiddle.manifestPath, 'utf8'));
    assert.throws(() => validateE2EImageIndex({ manifest: missingMiddleManifest, manifestPath: missingMiddle.manifestPath, projectRoot: missingMiddle.root }), /缺少 中态/);
});

test('视觉审计缺少全量媒体时不能通过最终 PASS', () => {
    const fixture = makeFixture({ descriptions: ['前态目标对象可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    const reviewPath = path.join(fixture.root, 'evidence', '.visual-review.json');
    const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
    review.media = review.media.slice(0, 2);
    writeFileSync(reviewPath, JSON.stringify(review, null, 2));
    assert.throws(
        () => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }),
        /必须覆盖全部媒体/,
    );
});

test('视觉审计不得把数值正确性当成图片职责', () => {
    const fixture = makeFixture({ descriptions: ['前态目标对象可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    const reviewPath = path.join(fixture.root, 'evidence', '.visual-review.json');
    const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
    review.media[0].checks.push('numeric-correctness');
    writeFileSync(reviewPath, JSON.stringify(review, null, 2));
    assert.throws(
        () => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }),
        /不得承担数值\/规则正确性/,
    );
});

test('视觉审计允许未改写媒体标记为 carried-forward', () => {
    const fixture = makeFixture({ descriptions: ['前态目标对象可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    const reviewPath = path.join(fixture.root, 'evidence', '.visual-review.json');
    const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
    review.media[0].status = 'carried-forward';
    review.media[0].unchangedEvidence = '本轮未改该屏实现与验收条件，用户未点名不合格';
    writeFileSync(reviewPath, JSON.stringify(review, null, 2));
    assert.doesNotThrow(() => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }));
});

test('carried-forward 缺少未改写证据时不能通过最终 PASS', () => {
    const fixture = makeFixture({ descriptions: ['前态目标对象可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    const reviewPath = path.join(fixture.root, 'evidence', '.visual-review.json');
    const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
    review.media[0].status = 'carried-forward';
    writeFileSync(reviewPath, JSON.stringify(review, null, 2));
    assert.throws(
        () => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }),
        /unchangedEvidence|未改写证据/,
    );
});

test('合同外媒体声明必须存在且不能重复当前清单媒体', () => {
    const fixture = makeFixture({ descriptions: ['前态目标对象可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    manifest.outOfScopeMedia = [{
        path: manifest.media[0],
        contract: '其它证据合同',
        reason: '该媒体不属于当前清单合同',
    }];
    writeFileSync(fixture.manifestPath, JSON.stringify(manifest, null, 2));
    assert.throws(
        () => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }),
        /不能重复声明 PASS 清单媒体/,
    );
});

test('证据目录里的特写子目录不能通过最终 PASS', () => {
    const fixture = makeFixture({ descriptions: ['前态目标对象可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    const diagDir = path.join(fixture.root, 'evidence', '_diag');
    mkdirSync(diagDir, { recursive: true });
    writeFileSync(path.join(diagDir, 'crop.png'), 'fixture');
    assert.throws(
        () => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }),
        /特写\/裁切子目录/,
    );
});

test('未登记的递归媒体不能通过最终 PASS', () => {
    const fixture = makeFixture({ descriptions: ['前态目标对象可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    const nestedDir = path.join(fixture.root, 'evidence', 'nested');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(path.join(nestedDir, 'extra.png'), 'fixture');
    assert.throws(
        () => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }),
        /未登记媒体/,
    );
});

test('历史整屏归档目录不阻断最终 PASS', () => {
    const fixture = makeFixture({ descriptions: ['前态目标对象可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    const historyDir = path.join(fixture.root, 'evidence', '_history');
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(path.join(historyDir, 'old-full.png'), 'fixture');
    assert.doesNotThrow(() => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }));
});

test('未点名特写时 auxiliary-detail 不能进入最终 PASS', () => {
    const fixture = makeFixture({ descriptions: ['前态目标对象可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const indexPath = path.join(fixture.root, 'evidence', '.e2e-image-index.json');
    const index = JSON.parse(readFileSync(indexPath, 'utf8'));
    index.media[0].role = 'auxiliary-detail';
    writeFileSync(indexPath, JSON.stringify(index, null, 2));
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    assert.throws(
        () => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }),
        /禁止特写\/局部图/,
    );
});

test('用户点名特写后允许 auxiliary-detail 辅证', () => {
    const fixture = makeFixture({ descriptions: ['前态目标对象可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const extraName = '特写辅证.jpg';
    writeFileSync(path.join(fixture.root, 'evidence', extraName), 'fixture');
    const indexPath = path.join(fixture.root, 'evidence', '.e2e-image-index.json');
    const index = JSON.parse(readFileSync(indexPath, 'utf8'));
    index.media.push({
        path: extraName,
        chainId: 'fixture-chain',
        chainStep: '04',
        sourceRun: 'fixture-run',
        sourceDir: 'evidence',
        stage: '中态',
        role: 'auxiliary-detail',
        viewport: 'desktop',
        transition: '用户点名后补充特写',
        description: '用户点名后的局部放大画面',
    });
    writeFileSync(indexPath, JSON.stringify(index, null, 2));
    const reviewPath = path.join(fixture.root, 'evidence', '.visual-review.json');
    const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
    review.media.push({
        path: extraName,
        status: 'PASS',
        checks: ['target-visible', 'interaction-ui', 'layout-readable', 'no-error'],
        observation: '用户点名特写后局部画面清楚可见',
    });
    writeFileSync(reviewPath, JSON.stringify(review, null, 2));
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    manifest.display.userRequestedCloseup = true;
    manifest.media.push(path.join('evidence', extraName));
    writeFileSync(fixture.manifestPath, JSON.stringify(manifest, null, 2));
    assert.doesNotThrow(() => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }));
});

test('主代理真实审查允许明确记录采用原因，仍检查全量证据', () => {
    const fixture = makeFixture({ descriptions: ['前态目标对象可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    manifest.visualReview.reviewer = { kind: 'primary-agent', id: 'root-reviewer', reason: '用户明确要求主代理亲自验收' };
    assert.doesNotThrow(() => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }));
    const reviewPath = path.join(fixture.root, 'evidence', '.visual-review.json');
    const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
    review.media.pop();
    writeFileSync(reviewPath, JSON.stringify(review));
    assert.throws(() => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }), /必须覆盖全部媒体/);
});

test('审查者未知类型、缺失身份或主代理缺采用原因均拒绝', () => {
    const fixture = makeFixture({ descriptions: ['前态目标对象可见', '真实交互窗口在中态可见', '结果对象在后态稳定可见'] });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    for (const reviewer of [
        { kind: 'robot', id: 'reviewer' },
        { kind: 'subagent', id: ' ' },
        { kind: 'primary-agent', id: '', reason: '用户要求' },
        { kind: 'primary-agent', id: 'root-reviewer' },
        { kind: 'primary-agent', id: 'root-reviewer', reason: ' ' },
    ]) {
        manifest.visualReview.reviewer = reviewer;
        assert.throws(() => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }), /reviewer|采用原因/);
    }
});

test('独立纯视觉合同保留逐图来源哈希和需求门禁，不伪造三阶段', async () => {
    const { createHash } = await import('node:crypto');
    const f = makeFixture({ descriptions: ['独立代表界面清楚可见'], stages: ['独立代表态'] });
    const dir = path.dirname(f.manifestPath);
    const ip = path.join(dir, '.e2e-image-index.json');
    const rp = path.join(dir, '.visual-review.json');
    const m = JSON.parse(readFileSync(f.manifestPath));
    const i = JSON.parse(readFileSync(ip));
    const r = JSON.parse(readFileSync(rp));
    Object.assign(m, { acceptanceMode: 'visual-only', acceptanceReason: '用户明确只验收截图画面', gameId: 'fixture', evidenceCategory: 'independent', requirements: [{requirement:'独立界面完整可读',status:'PASS', evidence:[rp]}], behavioralVerification:{ status:'not-claimed', reason:'本合同只验画面' } });
    Object.assign(i, { acceptanceMode:'visual-only', gameId:'fixture', evidenceCategory:'independent' });
    Object.assign(r.media[0], {sha256:createHash('sha256').update('fixture').digest('hex'), source:path.join(dir,r.media[0].path), independentReviewFile:rp});
    const run = () => {writeFileSync(ip, JSON.stringify(i));writeFileSync(rp, JSON.stringify(r));return validateE2EImageIndex({manifest:m,manifestPath:f.manifestPath,projectRoot:f.root});};
    assert.equal(run().acceptanceMode, 'visual-only');
    i.acceptanceMode='behavioral-chain'; assert.throws(run,/模式/);i.acceptanceMode='visual-only';
    m.evidenceCategory='golden';assert.throws(run,/类别/);m.evidenceCategory='independent';
    m.evidenceCategory='tutorial';assert.throws(run,/类别/);m.evidenceCategory='independent';
    delete i.acceptanceMode;assert.throws(run,/模式/);i.acceptanceMode='visual-only';
    m.acceptanceMode='unknown';assert.throws(run,/未知/);m.acceptanceMode='visual-only';
    const sha=r.media[0].sha256;r.media[0].sha256='0'.repeat(64);assert.throws(run,/SHA/);r.media[0].sha256=sha;
    const source=r.media[0].source;r.media[0].source='/missing-original';assert.throws(run,/不存在/);r.media[0].source=source;
    m.requirements[0].evidence=['/missing-proof'];assert.throws(run,/证据不存在/);m.requirements[0].evidence=[rp];
    const outside = path.join(f.root, 'unreviewed.png');writeFileSync(outside,'other');m.requirements[0].evidence=[outside];assert.throws(run,/未审媒体/);m.requirements[0].evidence=[rp];
    r.media[0].status='carried-forward';r.media[0].unchangedEvidence='已核对相同来源';assert.throws(run,/unchangedEvidenceFiles/);
    r.media[0].unchangedEvidenceFiles=[rp];assert.doesNotThrow(run);
    r.media=[];assert.throws(run,/覆盖全部/);
});

test('重构必须逐项对照旧新画面且不可把原观察改成模板好评', async () => {
    const {createHash}=await import('node:crypto');
    const f=makeFixture({descriptions:['初始对象清楚可见','操作对象清楚可见','结束对象清楚可见']});
    const dir=path.dirname(f.manifestPath), rp=path.join(dir,'.visual-review.json');
    const m=JSON.parse(readFileSync(f.manifestPath)), r=JSON.parse(readFileSync(rp));
    m.changeType='refactor';m.requirements=[{requirement:'保留已有信息与动作',status:'PASS',evidence:[path.join(dir,r.media[0].path)]}];
    const originalPath=path.join(f.root,'original-review.json'), before=path.join(f.root,'before.png');writeFileSync(before,'old-frame');
    r.media.forEach((entry,i)=>Object.assign(entry,{sha256:createHash('sha256').update('fixture').digest('hex'),source:path.join(dir,entry.path),independentReviewFile:originalPath,sourceReviewEntry:`/media/${i}`}));
    writeFileSync(originalPath,JSON.stringify(r));
    const run=()=>{writeFileSync(rp,JSON.stringify(r));return validateE2EImageIndex({manifest:m,manifestPath:f.manifestPath,projectRoot:f.root});};
    assert.throws(run,/baselineReviewFile/);
    const baseline={status:'PASS',requirements:[{requirement:m.requirements[0].requirement,status:'PASS',before:[before],after:[path.join(dir,r.media[0].path)],baselineSource:'用户认可的旧版本牌桌截图',preservedInformation:'威力读数仍然可见',preservedActions:'选牌与撤回保留',changes:'恢复原位置',duplicateDecision:'没有第二个同职责入口',changeAuthority:'用户要求恢复旧布局'}]};
    const originalBaselinePath=path.join(f.root,'original-baseline.json');
    writeFileSync(originalBaselinePath,JSON.stringify(baseline));
    baseline.requirements[0].independentReviewFile=originalBaselinePath;
    baseline.requirements[0].sourceReviewEntry='/requirements/0';
    const bp=path.join(dir,'baseline.json');m.visualReview.baselineReviewFile=bp;writeFileSync(bp,JSON.stringify(baseline));assert.doesNotThrow(run);
    const originalBaseline=JSON.parse(readFileSync(originalBaselinePath));
    originalBaseline.requirements[0].status='REVISE';writeFileSync(originalBaselinePath,JSON.stringify(originalBaseline));
    assert.throws(run,/原基线/);
    originalBaseline.requirements[0].status='PASS';writeFileSync(originalBaselinePath,JSON.stringify(originalBaseline));
    baseline.requirements[0].changes='把新增滚动描述为通过';writeFileSync(bp,JSON.stringify(baseline));assert.throws(run,/原基线/);
    baseline.requirements[0].changes='恢复原位置';writeFileSync(bp,JSON.stringify(baseline));
    const wrongBefore=path.join(f.root,'wrong-before.png');writeFileSync(wrongBefore,'different-image');
    baseline.requirements[0].before=[wrongBefore];writeFileSync(bp,JSON.stringify(baseline));assert.throws(run,/原基线/);
    baseline.requirements[0].before=[before];writeFileSync(bp,JSON.stringify(baseline));assert.doesNotThrow(run);
    baseline.requirements[0].independentReviewFile=bp;writeFileSync(bp,JSON.stringify(baseline));assert.throws(run,/原基线.*自身/);
    const selfLink=path.join(f.root,'baseline-link.json');symlinkSync(bp,selfLink);
    baseline.requirements[0].independentReviewFile=selfLink;writeFileSync(bp,JSON.stringify(baseline));assert.throws(run,/原基线.*自身/);
    baseline.requirements[0].independentReviewFile=originalBaselinePath;writeFileSync(bp,JSON.stringify(baseline));
    originalBaseline.requirements[0].before=[{path:wrongBefore,sha256:createHash('sha256').update('old-frame').digest('hex')}];
    writeFileSync(originalBaselinePath,JSON.stringify(originalBaseline));assert.throws(run,/原基线媒体.*哈希/);
    originalBaseline.requirements[0].before=[before];writeFileSync(originalBaselinePath,JSON.stringify(originalBaseline));
    r.media[0].independentReviewFile=rp;assert.throws(run,/原审查.*自身/);r.media[0].independentReviewFile=originalPath;
    const observation=r.media[0].observation;r.media[0].observation='模板式清楚可辨';assert.throws(run,/原审查/);r.media[0].observation=observation;
    const savedReviewFile=m.visualReview.reviewFile;
    delete m.visualReview.reviewFile;m.visualReview.media=r.media;
    writeFileSync(f.manifestPath,JSON.stringify(m));assert.doesNotThrow(run);
    r.media[0].independentReviewFile=f.manifestPath;r.media[0].sourceReviewEntry='/visualReview/media/0';
    writeFileSync(f.manifestPath,JSON.stringify(m));assert.throws(run,/原审查.*自身/);
    r.media[0].independentReviewFile=originalPath;r.media[0].sourceReviewEntry='/media/0';
    delete m.visualReview.media;m.visualReview.reviewFile=savedReviewFile;
    r.media[0].status='carried-forward';r.media[0].unchangedEvidence='相同实现已核对';r.media[0].unchangedEvidenceFiles=[bp];assert.doesNotThrow(run);
    baseline.requirements[0].status='REVISE';writeFileSync(bp,JSON.stringify(baseline));assert.throws(run,/未证明/);
});

test('纯视觉交付拒绝不同文件名重复同一张图，但保留不同画面的独立证据',async()=>{
 const {createHash}=await import('node:crypto');
 const f=makeFixture({descriptions:['第一张独立界面清楚可见','第二张独立界面清楚可见'],stages:['独立代表态','独立代表态']});
 const dir=path.dirname(f.manifestPath),ip=path.join(dir,'.e2e-image-index.json'),rp=path.join(dir,'.visual-review.json');
 const m=JSON.parse(readFileSync(f.manifestPath)),i=JSON.parse(readFileSync(ip)),r=JSON.parse(readFileSync(rp));
 Object.assign(m,{acceptanceMode:'visual-only',acceptanceReason:'用户明确只验收截图画面',gameId:'fixture',evidenceCategory:'independent',requirements:[{requirement:'独立界面完整可读',status:'PASS',evidence:[rp]}],behavioralVerification:{status:'not-claimed',reason:'本合同只验画面'}});
 Object.assign(i,{acceptanceMode:'visual-only',gameId:'fixture',evidenceCategory:'independent'});
 r.media.forEach(entry=>Object.assign(entry,{sha256:createHash('sha256').update('fixture').digest('hex'),source:path.join(dir,entry.path),independentReviewFile:rp}));
 const run=()=>{writeFileSync(ip,JSON.stringify(i));writeFileSync(rp,JSON.stringify(r));return validateE2EImageIndex({manifest:m,manifestPath:f.manifestPath,projectRoot:f.root});};
 assert.throws(run,/重复画面/);
 writeFileSync(path.join(dir,r.media[1].path),'distinct-frame');r.media[1].sha256=createHash('sha256').update('distinct-frame').digest('hex');
 assert.doesNotThrow(run);
});

const makeDistinctFixture = () => {
    const fixture = makeFixture({ descriptions: ['并排手牌和操作入口完整可见'], stages: ['独特界面态'] });
    const dir = path.dirname(fixture.manifestPath);
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    const index = JSON.parse(readFileSync(path.join(dir, '.e2e-image-index.json'), 'utf8'));
    for (const target of [manifest, index]) Object.assign(target, { capturePolicy: 'distinct-ui-state', acceptanceMode: 'behavioral-chain', gameId: 'fixture', evidenceCategory: 'golden' });
    const trace = { evidenceCategory: 'golden', browserContextId: 'fixture-context', terminalStepId: 'confirm', gameId: 'fixture', sourceRun: 'fixture-run', sourceRevision: 'fixture-revision', chainId: 'fixture-chain', status: 'PASS', outcome: '对局完成', steps: [
        { id: 'select', action: '真实页面选牌', before: { visible: { selected: 0 }, authoritative: { selected: 0 } }, after: { visible: { selected: 1 }, authoritative: { selected: 1 } }, assertions: [{ name: '选中一张', actual: 1, expected: 1 }] },
        { id: 'confirm', action: '真实页面确认', before: { visible: { selected: 1 }, authoritative: { selected: 1 } }, after: { visible: { gameOver: true }, authoritative: { gameOver: true } }, assertions: [{ name: 'terminal-gameover', actual: true, expected: true }] },
    ] };
    writeFileSync(path.join(dir, 'behavior.json'), JSON.stringify(trace));
    manifest.behaviorChains = [{ chainId: trace.chainId, sourceRun: trace.sourceRun, sourceRevision: trace.sourceRevision, evidence: 'behavior.json', requiredSteps: ['select', 'confirm'] }];
    manifest.requirements = [{ requirement: '选牌与确认完整交互', status: 'PASS', evidence: ['behavior.json', manifest.media[0]] }];
    Object.assign(index.media[0], { uiStateId: 'hand-parallel', uiChange: 'layout', uiChangeReason: '手牌并排显示且操作入口无遮挡', behaviorStepId: 'select', sourceRevision: trace.sourceRevision, requirements: ['选牌与确认完整交互'] });
    trace.uiStates = [{ id: 'hand-parallel', stepId: 'select', change: 'layout', viewport: 'desktop', sha256: createHash('sha256').update(readFileSync(path.join(dir, index.media[0].path))).digest('hex') }];
    const save = () => { writeFileSync(fixture.manifestPath, JSON.stringify(manifest)); writeFileSync(path.join(dir, '.e2e-image-index.json'), JSON.stringify(index)); writeFileSync(path.join(dir, 'behavior.json'), JSON.stringify(trace)); };
    save();
    return { ...fixture, dir, manifest, index, trace, save, validate: () => validateE2EImageIndex({ manifest, manifestPath: fixture.manifestPath, projectRoot: fixture.root }) };
};

test('独特界面策略以一张实质变化图和完整行为日志验收，不强制三图', () => {
    const f = makeDistinctFixture();
    assert.equal(f.validate().capturePolicy, 'distinct-ui-state');
});
for (const [name, mutate, pattern] of [
    ['步骤倒序', f => { f.trace.steps.reverse(); }, /顺序/],
    ['空快照', f => { f.trace.steps[0].before = {}; }, /前后状态/],
    ['缺少终局断言', f => { delete f.trace.terminalStepId; }, /终局/],
    ['类别不一致', f => { f.trace.evidenceCategory = 'independent'; }, /同源/],
    ['缺少界面状态', f => { f.trace.uiStates.push({ id: 'missing' }); }, /缺少实质/],
    ['界面来源哈希错误', f => { f.trace.uiStates[0].sha256 = 'bad'; }, /哈希/],
    ['需求未引用链', f => { f.manifest.requirements[0].evidence.shift(); }, /需求覆盖/],
    ['缺少行为链', f => { delete f.manifest.behaviorChains; }, /行为链/],
    ['数值变化伪装新界面', f => { f.index.media[0].uiChange = 'numeric-only'; }, /实质界面/],
    ['重复返回伪装新界面', f => { f.index.media[0].uiChange = 'return-to-seen'; }, /实质界面/],
    ['来源跑次不一致', f => { f.trace.sourceRun = 'other-run'; }, /同源/],
    ['只声明测试通过没有真实断言', f => { f.trace.steps[1].assertions = []; }, /断言/],
    ['真实断言失败', f => { f.trace.steps[1].assertions[0].actual = false; }, /断言/],
    ['必要动作未执行', f => { f.trace.steps.pop(); }, /必要动作/],
    ['单边声明策略', f => { delete f.index.capturePolicy; }, /策略/],
    ['未知策略', f => { f.manifest.capturePolicy = 'few-images'; }, /策略/],
    ['未声明行为验收', f => { f.manifest.behavioralVerification.status = 'not-claimed'; }, /behavioralVerification/],
]) test(`独特界面策略拒绝${name}`, () => { const f = makeDistinctFixture(); mutate(f); f.save(); assert.throws(f.validate, pattern); });

const addBehaviorChain = (f, overrides = {}) => {
    const second = { ...structuredClone(f.trace), chainId: 'second-chain', uiStates: [], ...overrides };
    writeFileSync(path.join(f.dir, 'second.json'), JSON.stringify(second));
    f.manifest.behaviorChains.push({ ...f.manifest.behaviorChains[0], chainId: second.chainId, sourceRun: second.sourceRun, sourceRevision: second.sourceRevision, evidence: 'second.json' });
    f.manifest.requirements[0].evidence.push('second.json');
    return second;
};
test('黄金链拒绝跨跑次、版本及浏览器上下文拼接', () => {
    for (const field of ['sourceRun', 'sourceRevision', 'browserContextId']) {
        const f = makeDistinctFixture(); addBehaviorChain(f, { [field]: 'other' }); f.save();
        assert.throws(f.validate, /同源/);
    }
});
test('第二链不能借用第一链状态标识来伪装本链已有截图', () => {
    const f = makeDistinctFixture(); addBehaviorChain(f, { uiStates: [{ ...f.trace.uiStates[0], sha256: 'wrong' }] }); f.save();
    assert.throws(f.validate, /缺少实质/);
});
test('无新增界面的真实行为链可以没有截图但必须关联需求', () => {
    const f = makeDistinctFixture(); addBehaviorChain(f); f.save();
    assert.equal(f.validate().chainCount, 2);
    f.manifest.requirements[0].evidence.pop(); f.save();
    assert.throws(f.validate, /需求覆盖/);
});
test('含冒号的链与状态标识不能通过拼接碰撞借图', () => {
    const f=makeDistinctFixture();
    f.manifest.behaviorChains[0].chainId='cast:ui';f.trace.chainId='cast:ui';f.index.media[0].chainId='cast:ui';
    f.index.media[0].uiStateId='hand';f.trace.uiStates[0].id='hand';
    addBehaviorChain(f,{chainId:'cast',uiStates:[{...f.trace.uiStates[0],id:'ui:hand'}]});f.save();
    assert.throws(f.validate,/缺少实质/);
});
