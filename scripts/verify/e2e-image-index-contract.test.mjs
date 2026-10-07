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
            sourceDir: 'fixture',
            stage: stages[index],
            description: descriptions[index],
        })),
    };
    writeFileSync(path.join(evidenceDir, '.e2e-image-index.json'), JSON.stringify(index, null, 2));
    const manifestPath = path.join(evidenceDir, 'pass.json');
    writeFileSync(manifestPath, JSON.stringify({
        verdict: 'PASS',
        display: { finalPassBeforeOpen: true },
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
