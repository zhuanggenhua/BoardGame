import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { disableAudio, setChineseLocale } from '../helpers/common';
import { encodeLocalMatchSnapshot } from '../../src/engine/transport/localSessionCodec';
import { qidahenTutorialProgressIdentity } from './tutorialPersistence';
import { QIDAHEN_VISUAL_SOURCE_PATHS, requireCompleteQidahenSourceIdentity, trackQidahenSourceIdentity } from './sourceIdentity';
import { waitForQidahenVisualReady } from './visualReady';

test.use({ channel: 'chromium', launchOptions: { args: [] } });

for (const step of ['recruit-payment', 'hand-limit']) {
    test(`真实手牌引导：${step}`, async ({ page }) => {
        test.setTimeout(180_000);
        const checkpointDir = process.env.QIDAHEN_CHECKPOINT_DIR;
        const outputDir = process.env.QIDAHEN_HAND_GUIDANCE_DIR;
        if (!checkpointDir || !outputDir) throw new Error('Current checkpoint and output directories are required');
        const checkpoint = resolve(checkpointDir, `${step}.json`);
        const sourceIdentity = trackQidahenSourceIdentity(page, 'e2e/qidahen/hand-guidance-check.diagnostic.ts',
            ['e2e/qidahen/sourceIdentity.ts', checkpoint], QIDAHEN_VISUAL_SOURCE_PATHS);
        await setChineseLocale(page); await disableAudio(page);
        await page.setViewportSize({ width: 1920, height: 1080 });
        const encoded = encodeLocalMatchSnapshot(JSON.parse(readFileSync(checkpoint, 'utf8')));
        await page.addInitScript(({ encoded, seed }) => {
            (window as any).__E2E_TEST_MODE__ = true;
            localStorage.setItem(`local_match_snapshot_v1:qidahen:${seed}`, encoded);
        }, { encoded, seed: qidahenTutorialProgressIdentity.seed });
        await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
        await expect(page.locator(`[data-tutorial-step="${step}"]`)).toBeVisible({ timeout: 60_000 });
        await waitForQidahenVisualReady(page);
        await page.mouse.move(10, 10);
        await expect(page.getByTestId('tutorial-anchor-arrow')).toBeVisible();
        const attachment = await page.getByTestId('tutorial-overlay-card').evaluate(element => {
            const targetId = element.getAttribute('data-tutorial-anchor');
            const marker = document.querySelector(`[data-testid="${targetId}"]`)!;
            const card = marker.closest('[data-qidahen-hand-recommended="true"]')!.getBoundingClientRect();
            const tip = element.getBoundingClientRect();
            const dx = Math.max(0, tip.left - card.right, card.left - tip.right);
            const dy = Math.max(0, tip.top - card.bottom, card.top - tip.bottom);
            const polygon = document.querySelector<SVGPolygonElement>('[data-testid="tutorial-anchor-arrow"] polygon')!;
            const points = polygon.getAttribute('points')!.trim().split(/\s+/).map(point => point.split(',').map(Number));
            const svg = polygon.ownerSVGElement!.getBoundingClientRect();
            const m = marker.getBoundingClientRect(); const mx = m.left + m.width / 2, my = m.top + m.height / 2;
            const tipDistance = Math.hypot(mx - svg.left - points[2][0], my - svg.top - points[2][1]);
            const baseDistance = Math.hypot(mx - svg.left - (points[0][0] + points[1][0]) / 2, my - svg.top - (points[0][1] + points[1][1]) / 2);
            return { distance: Math.hypot(dx, dy), arrowPointsTowardMarker: tipDistance < baseDistance };
        });
        expect(attachment.distance).toBeLessThanOrEqual(32);
        expect(attachment.arrowPointsTowardMarker).toBe(true);
        const recommended = page.locator('[data-qidahen-hand-recommended="true"]');
        await expect(recommended).toHaveCount(step === 'hand-limit' ? 6 : 1);
        const output = resolve(outputDir); mkdirSync(output, { recursive: true });
        await page.screenshot({ path: resolve(output, `${step}.png`) });
        if (step === 'recruit-payment') {
            const shell = page.getByTestId('qidahen-hand-card-shell-hand-3');
            const atRest = (await shell.boundingBox())!;
            const magnifier = page.getByTestId('qidahen-hand-card-magnify-hand-3');
            await magnifier.hover();
            await expect.poll(async () => (await shell.boundingBox())!.y, { timeout: 5_000 }).toBeLessThan(atRest.y - atRest.height * 0.4);
            await expect.poll(async () => { const raised = (await shell.boundingBox())!; return raised.y + raised.height; },
                { timeout: 5_000 }).toBeLessThanOrEqual(1081);
            await page.screenshot({ path: resolve(output, 'recruit-payment-hover.png') });
            await magnifier.click();
            await expect(page.getByTestId('qidahen-card-magnify-overlay')).toBeVisible();
            expect(await page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core.selectedPaymentCardIds)).toEqual([]);
        }
        const verified = requireCompleteQidahenSourceIdentity(await sourceIdentity());
        writeFileSync(resolve(output, `${step}.json`), JSON.stringify({ status: 'PASS', step, sourceIdentity: verified }, null, 2));
    });
}
