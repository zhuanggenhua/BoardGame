import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
