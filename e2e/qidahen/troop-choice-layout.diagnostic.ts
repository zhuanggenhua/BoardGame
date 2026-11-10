// 私有布局回归。通过正式恢复入口载入年度管线导出的合法检查点，不能替代完整教程流程。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { setChineseLocale, disableAudio } from '../helpers/common';
import { encodeLocalMatchSnapshot } from '../../src/engine/transport/localSessionCodec';
import { qidahenTutorialProgressIdentity } from './tutorialPersistence';
import { waitForQidahenVisualReady } from './visualReady';
import { QIDAHEN_ANNUAL_TUTORIAL } from '../../src/games/qidahen/annualTutorial';

test.use({ channel: 'chromium', launchOptions: { args: [] } });

test('PC 逐兵选择的说明锚定实际推荐兵牌', async ({ page }) => {
    test.setTimeout(180_000);
    const checkpoint = process.env.QIDAHEN_TROOP_LAYOUT_CHECKPOINT;
    const output = process.env.QIDAHEN_TROOP_LAYOUT_OUTPUT;
    if (!checkpoint || !output) throw new Error('Current legal checkpoint and private output are required');
    const snapshot = JSON.parse(readFileSync(checkpoint, 'utf8'));
    const encoded = encodeLocalMatchSnapshot(snapshot);
    await setChineseLocale(page);
    await disableAudio(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(({ encoded, identity }) => {
        (window as any).__E2E_TEST_MODE__ = true;
        localStorage.setItem(`local_match_snapshot_v1:qidahen:${identity.seed}`, encoded);
    }, { encoded, identity: qidahenTutorialProgressIdentity });
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
    await expect(page.locator('[data-tutorial-step="dispatch-troops"]')).toBeVisible({ timeout: 60_000 });
    const currentStep = QIDAHEN_ANNUAL_TUTORIAL.steps.find(step => step.id === 'dispatch-troops')!;
    await expect(page.getByTestId('tutorial-overlay-card')).toHaveAttribute('data-tutorial-anchor', currentStep.tooltipAnchorTarget!);
    await expect.poll(async () => Math.abs((await page.getByTestId('tutorial-overlay-card').boundingBox())!.width - currentStep.tooltipMaxWidth!)).toBeLessThanOrEqual(1);
    await waitForQidahenVisualReady(page);
    await expect(page.getByTestId('tutorial-anchor-arrow')).toBeVisible();
    const geometry = async () => page.getByTestId('tutorial-overlay-card').evaluate(element => {
        const anchorId = element.getAttribute('data-tutorial-anchor');
        const target = document.querySelector(`[data-testid="${anchorId}"]`);
        if (!target) throw new Error('No actual troop anchor');
        const tip = element.getBoundingClientRect(), troop = target.getBoundingClientRect();
        const dx = Math.max(0, tip.left - troop.right, troop.left - tip.right);
        const dy = Math.max(0, tip.top - troop.bottom, troop.top - tip.bottom);
        const blocked = [...document.querySelectorAll('[data-qidahen-map-protected-token="true"]')].filter(node => {
            const rect = node.getBoundingClientRect();
            return tip.left < rect.right && tip.right > rect.left && tip.top < rect.bottom && tip.bottom > rect.top;
        }).map(node => node.getAttribute('data-testid'));
        const coveredPopulation = [...document.querySelectorAll('[data-qidahen-map-population="true"]')].filter(node => {
            const rect = node.getBoundingClientRect();
            return tip.left < rect.right && tip.right > rect.left && tip.top < rect.bottom && tip.bottom > rect.top;
        }).map(node => node.getAttribute('data-testid'));
        return { anchorId, distance: Math.hypot(dx, dy), tip: tip.toJSON(), troop: troop.toJSON(), blocked, coveredPopulation,
            arrowPoints: document.querySelector('[data-testid="tutorial-anchor-arrow"] polygon')?.getAttribute('points') };
    });
    mkdirSync(output, { recursive: true });
    try {
        await expect.poll(async () => (await geometry()).distance).toBeLessThanOrEqual(64);
        expect((await geometry()).blocked).toEqual([]);
        expect((await geometry()).coveredPopulation).not.toContain('qidahen-map-population-city-region-7');
        expect((await geometry()).coveredPopulation).not.toContain('qidahen-map-population-city-region-9');
        writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'PASS', entry: 'representative-state-real-resume', geometry: await geometry() }, null, 2));
    } finally {
        writeFileSync(`${output}/geometry.json`, JSON.stringify(await geometry(), null, 2));
        await page.screenshot({ path: `${output}/troop-choice.png` });
    }
});
