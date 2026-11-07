// 手动诊断，默认 **/*.e2e.ts 不收集。先用 annualTutorialFlow.test.ts 的
// QIDAHEN_CHECKPOINT_EXPORT_DIR 导出合法管线检查点，再通过 PW_TEST_MATCH
// 显式选择本文件运行。检查点来自本地生成，不作为仓内固定游戏状态。
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { disableAudio, setChineseLocale } from '../helpers/common';
import { qidahenTutorialProgressIdentity } from './tutorialPersistence';
import { encodeLocalMatchSnapshot } from '../../src/engine/transport/localSessionCodec';
import { createHash } from 'node:crypto';
import { QIDAHEN_VISUAL_SOURCE_PATHS, requireCompleteQidahenSourceIdentity, trackQidahenSourceIdentity } from './sourceIdentity';

const captureContractPath = 'docs/games/qidahen/records/qidahen-layout-required-ui-states.json';
const captureContractBytes = readFileSync(captureContractPath);
const captureContract = JSON.parse(captureContractBytes.toString('utf8')) as {
    requiredStates: Array<{ chainId: string; uiStateId: string; viewport: string }>;
};
const evidenceRoot = process.env.QIDAHEN_LAYOUT_EVIDENCE_ROOT
    ?? `.tmp/qidahen-layout-recovery-${Date.now()}`;

test.use({ channel: 'chromium', launchOptions: { args: [] } });

for (const viewport of [{ width: 960, height: 540 }, { width: 640, height: 480 }, { width: 320, height: 200 }]) {
    test(`PC ${viewport.width}x${viewport.height} 战斗布局释放地图与战后操作`, async ({ page }) => {
        test.setTimeout(180_000);
        const snapshotPath = process.env.QIDAHEN_LAYOUT_CHECKPOINT_PATH;
        if (!snapshotPath) throw new Error('QIDAHEN_LAYOUT_CHECKPOINT_PATH must name a current legal pipeline checkpoint');
        const verifySourceIdentity = trackQidahenSourceIdentity(page, 'e2e/qidahen/battle-layout-recovery.diagnostic.ts', ['e2e/qidahen/sourceIdentity.ts', snapshotPath], QIDAHEN_VISUAL_SOURCE_PATHS);
        const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
        const encodedSnapshot = encodeLocalMatchSnapshot(snapshot);
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await setChineseLocale(page);
        await disableAudio(page);
        await page.setViewportSize(viewport);
        await page.addInitScript(({ encodedSnapshot, identity }) => {
            (window as any).__E2E_TEST_MODE__ = true;
            localStorage.setItem(`local_match_snapshot_v1:qidahen:${identity.seed}`, encodedSnapshot);
        }, { encodedSnapshot, identity: qidahenTutorialProgressIdentity });
        await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
        await expect(page.locator('[data-tutorial-step="battle-roll"]')).toBeVisible({ timeout: 60_000 });
        const directory = `${evidenceRoot}/${viewport.width}`;
        mkdirSync(directory, { recursive: true });
        await page.screenshot({ path: `${directory}/before-battle.png` });
        await page.getByTestId('qidahen-resolve-pending-action').click();
        await expect.poll(async () => {
            if (await page.getByTestId('qidahen-battle-layout-report').isVisible()) return 'report';
            if (await page.getByTestId('qidahen-battle-roll-sequence').isVisible()) return 'animation';
            return 'waiting';
        }, { timeout: 30_000 }).not.toBe('waiting');
        const usedReport = await page.getByTestId('qidahen-battle-layout-report').isVisible();
        await page.screenshot({ path: `${directory}/battle.png` });
        if (usedReport) {
            await expect(page.getByTestId('qidahen-battle-report')).toHaveAttribute('data-report-mode', 'expanded');
            await expect(page.getByTestId('qidahen-post-battle-dice-summary')).not.toBeEmpty();
            await expect(page.getByTestId('qidahen-battle-layout-continue')).toBeInViewport({ ratio: 1 });
            const content = page.getByTestId('qidahen-battle-layout-report-content');
            const area = await content.boundingBox();
            if (!area) throw new Error('Missing report scrolling surface');
            await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
            for (const phaseIndex of [1, 2]) {
                const delta = await content.evaluate((element, index) => {
                    const phase = element.querySelectorAll('section')[index];
                    return phase.getBoundingClientRect().top - element.getBoundingClientRect().top;
                }, phaseIndex);
                const beforeScroll = await content.evaluate(element => element.scrollTop);
                await page.mouse.wheel(0, delta);
                if (viewport.height <= 200) await expect.poll(() => content.evaluate(element => element.scrollTop)).toBeGreaterThan(beforeScroll);
                await page.screenshot({ path: `${directory}/battle-phase-${phaseIndex}.png` });
            }
            await page.getByTestId('qidahen-battle-layout-continue').click();
        }
        await expect(page.getByTestId('qidahen-battle-roll-overlay')).toHaveCount(0, { timeout: 90_000 });
        await expect(page.getByTestId('qidahen-battle-layout-report')).toHaveCount(0);
        const afterPresentation = await page.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__.state.get();
            return { postBattleSelection: state.core.postBattleSelection, pending: state.core.pendingTargetAction,
                currentPlayer: state.core.currentPlayer, turnPhase: state.core.turnPhase,
                mapLocked: document.querySelector('[data-testid="qidahen-map-layer"]')?.getAttribute('data-map-playback-locked'),
                actionsZonePresent: Boolean(document.querySelector('[data-testid="qidahen-actions-zone"]')),
                tutorial: state.sys.tutorial.step?.id, interaction: state.sys.interaction?.current };
        });
        writeFileSync(`${directory}/after-presentation.json`, JSON.stringify(afterPresentation, null, 2));
        await expect(page.getByTestId('qidahen-map-layer')).toHaveAttribute('data-map-playback-locked', 'false');
        await page.screenshot({ path: `${directory}/post-report-selection.png` });
        await page.getByTestId('qidahen-post-battle-mode-occupy').click();
        await page.getByTestId('qidahen-post-battle-choice-occupy').click();
        await expect(page.getByTestId('qidahen-post-battle-confirm')).toBeVisible();
        await page.getByTestId('qidahen-post-battle-confirm').click();
        await expect(page.getByTestId('qidahen-post-battle-confirm')).toHaveCount(0);
        expect(errors).toEqual([]);
        const chainId = `qidahen-layout-${viewport.width}`;
        const uiStates = captureContract.requiredStates.filter(state => state.chainId === chainId).map(state => ({
            id: state.uiStateId, viewport: state.viewport, path: `${directory}/${state.uiStateId}.png`,
            sha256: createHash('sha256').update(readFileSync(`${directory}/${state.uiStateId}.png`)).digest('hex'),
        }));
        expect(readFileSync(captureContractPath).equals(captureContractBytes), 'capture contract changed during run').toBe(true);
        const sourceIdentity = await verifySourceIdentity();
        requireCompleteQidahenSourceIdentity(sourceIdentity);
        writeFileSync(`${directory}/result.json`, JSON.stringify({ status: 'PASS', viewport, usedReport, errors, postBattleInputAccepted: true,
            chainId, uiStates, sourceIdentity, captureContract: { path: captureContractPath, sha256: createHash('sha256').update(captureContractBytes).digest('hex') },
            entry: 'representative-state-restored-through-real-tutorial-resume' }, null, 2));
    });
}
