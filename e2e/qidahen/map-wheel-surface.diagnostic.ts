import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { disableAudio, setChineseLocale } from '../helpers/common';
import { encodeLocalMatchSnapshot } from '../../src/engine/transport/localSessionCodec';
import { qidahenTutorialProgressIdentity } from './tutorialPersistence';
import { waitForQidahenVisualReady } from './visualReady';

test.use({ channel: 'chromium' });
for (const step of ['frontier-goal', 'frontier-target', 'farm-target', 'reclaim-target', 'recruit-troops', 'dispatch-target', 'occupy', 'diplomacy-target', 'hire-action', 'hire-target', 'maintain-shanhai', 'upkeep-datong', 'upkeep-yehe', 'upkeep-pyongyang', 'claim-year', 'year-character', 'training-target', 'training-second-target', 'training-recruit-target', 'training-finish', 'abandon-inner-wall', 'abandon-outer-wall']) {
    test(`棋盘轮盘与取景：${step}`, async ({ page }) => {
        test.setTimeout(180_000);
        const output = resolve(process.env.QIDAHEN_MAP_SURFACE_DIR ?? '.tmp/qidahen-map-surface');
        mkdirSync(output, { recursive: true });
        await page.setViewportSize({ width: 1920, height: 1080 });
        await setChineseLocale(page); await disableAudio(page);
        const checkpointDir = process.env.QIDAHEN_CHECKPOINT_DIR ?? '.tmp/qidahen-r236-checkpoints';
        const encoded = !['frontier-goal', 'frontier-target'].includes(step) ? encodeLocalMatchSnapshot(JSON.parse(readFileSync(`${checkpointDir}/${step}.json`, 'utf8'))) : null;
        await page.addInitScript(({ encoded, seed }) => {
            (window as any).__E2E_TEST_MODE__ = true;
            if (encoded) localStorage.setItem(`local_match_snapshot_v1:qidahen:${seed}`, encoded);
        }, { encoded, seed: qidahenTutorialProgressIdentity.seed });
        await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
        if (encoded) await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
        if (step === 'frontier-target') await page.getByTestId('tutorial-next-button').click({ timeout: 90_000 });
        await expect.poll(() => page.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state.get()?.sys.tutorial.step?.id), { timeout: 90_000 }).toBe(step);
        await waitForQidahenVisualReady(page);
        await expect(page.getByTestId('qidahen-action-wheel')).toBeVisible();
        const geometry = await page.evaluate(() => ({ map: document.querySelector('[data-testid="qidahen-map-content"]')?.getBoundingClientRect().toJSON(),
            allTokens: [...document.querySelectorAll('[data-qidahen-map-token-region]')].map(node => ({ id: node.getAttribute('data-testid'), region: node.getAttribute('data-qidahen-map-token-region'), type: node.getAttribute('data-qidahen-map-token-type'), recommended: node.getAttribute('data-qidahen-tutorial-recommended'), selectable: node.getAttribute('data-pending-committed-selectable'), rect: node.getBoundingClientRect().toJSON() })),
            groups: [...document.querySelectorAll('[data-qidahen-army-group-region]')].map(node => ({ id: node.getAttribute('data-qidahen-army-group-region'), rect: node.getBoundingClientRect().toJSON() })),
            label: document.querySelector('[data-testid="qidahen-map-region-focus-name"]')?.getBoundingClientRect().toJSON(),
            anchors: [...document.querySelectorAll('[data-region-focus-shape]')].map(node => ({ id: node.getAttribute('data-testid'), rect: node.getBoundingClientRect().toJSON() })),
            battleRegions: [...document.querySelectorAll('[data-qidahen-battle-region-space]')].map(node => ({ id: node.getAttribute('data-qidahen-battle-region-space'), rect: node.getBoundingClientRect().toJSON() })),
            battleTokens: [...document.querySelectorAll('[data-qidahen-map-token-region]')].filter(node => ['city-region-15', 'city-region-7'].includes(node.getAttribute('data-qidahen-map-token-region') ?? '')).map(node => ({ id: node.getAttribute('data-testid'), rect: node.getBoundingClientRect().toJSON() })),
            hud: [...document.querySelectorAll('[data-testid="tutorial-overlay-card"], [data-testid="qidahen-actions-zone"], [data-testid="qidahen-player-float"], [data-testid="qidahen-hand-zone"], [data-testid="qidahen-hand-interaction-tray"] > div, [data-testid="qidahen-action-slot"] > *, [data-testid="qidahen-action-wheel"], [data-testid="qidahen-turn-choice"], [data-testid="qidahen-recruit-selection"], [data-testid="qidahen-map-viewport-controls"], [data-ui-role="qidahen-hand-magnify-viewport"], [data-testid="fab-menu"], [data-testid="qidahen-draw-anchor"], [data-testid="qidahen-discard-anchor"], [data-testid="qidahen-chronology-zone"], [data-testid="qidahen-korea-zone"]')].map(node => ({ id: node.getAttribute('data-testid'), rect: node.getBoundingClientRect().toJSON() })),
            tokenObstacles: [...document.querySelectorAll('[data-qidahen-map-token-type="army"], [data-qidahen-map-token-type="control"]')].map(node => ({ id: node.getAttribute('data-testid'), rect: node.getBoundingClientRect().toJSON() })).filter(item => item.rect.left < 1510 && item.rect.right > 1250 && item.rect.top < 660 && item.rect.bottom > 400),
            tokens: [...document.querySelectorAll('[data-qidahen-map-token-region]')].filter(node => node.getAttribute('data-qidahen-map-token-region') === 'city-region-15-liaodong').map(node => ({ id: node.getAttribute('data-testid'), rect: node.getBoundingClientRect().toJSON() })) }));
        writeFileSync(resolve(output, `${step}.json`), JSON.stringify(geometry, null, 2));
        if (step === 'reclaim-target') await expect(page.getByTestId('qidahen-map-region-focus-name')).toBeVisible();
        if (step === 'upkeep-datong') {
            const recommended = page.getByTestId('qidahen-map-token-city-region-1-army-ming-post-sarhu-1619-datong-regular-infantry-lv1__compat__1');
            await expect(recommended).toHaveAttribute('data-qidahen-tutorial-recommended', 'true');
            await expect(recommended).toHaveAttribute('data-pending-committed-selectable', 'true');
        }
        if (step === 'claim-year') {
            await expect(page.getByTestId('qidahen-year-card-slot-current-year')).toHaveAttribute('data-tutorial-id', 'qidahen-year-card-slot-current-year');
            await expect(page.getByTestId('qidahen-turn-option-claim')).toBeVisible();
        }
        if (step === 'training-recruit-target') {
            await expect(page.getByTestId('qidahen-army-group-city-region-15').locator('path')).toHaveCount(2);
        }
        if (step === 'upkeep-pyongyang') {
            await expect(page.getByTestId('tutorial-overlay-card')).toHaveAttribute('data-tutorial-anchor', 'qidahen-map-token-city-region-18-army-ming-post-sarhu-1619-pyongyang-mercenary-infantry-lv2__compat__1');
            await expect(page.getByTestId('tutorial-anchor-arrow')).toBeVisible();
        }
        if (step === 'frontier-target') {
            await expect(page.getByTestId('qidahen-map-region-focus-name')).toHaveText('叶赫部');
            await expect(page.getByTestId('qidahen-map-token-city-region-7-control')).toHaveAttribute('data-qidahen-tutorial-region-target', 'true');
            for (const id of ['city-region-7', 'city-region-15']) {
                const rect = await page.getByTestId(`qidahen-map-token-${id}-control`).boundingBox();
                expect(rect).not.toBeNull();
                expect(rect!.x).toBeGreaterThanOrEqual(-0.25);
                expect(rect!.y).toBeGreaterThanOrEqual(-0.25);
                expect(rect!.x + rect!.width).toBeLessThanOrEqual(1920.25);
                expect(rect!.y + rect!.height).toBeLessThanOrEqual(1080.25);
            }
        }
        let diplomacyPoint: { x: number; y: number } | null = null;
        let dispatchPoint: { x: number; y: number } | null = null;
        if (step === 'dispatch-target') {
            await expect(page.getByTestId('qidahen-map-token-city-region-7-control')).toHaveAttribute('data-qidahen-tutorial-region-target', 'true');
            await expect(page.getByTestId('qidahen-tutorial-target-ring')).toBeVisible();
            const group = geometry.groups.find(item => item.id === 'city-region-15')!.rect;
            const wheel = geometry.hud.find(item => item.id === 'qidahen-action-wheel')!.rect;
            expect(group.right <= wheel.left || group.left >= wheel.right || group.bottom <= wheel.top || group.top >= wheel.bottom,
                '辽北兵牌面板不能被轮盘遮住').toBe(true);
            const point = await page.evaluate(async () => {
                const path = '/src/games/qidahen/ui/mapGraph.ts';
                return (await import(path)).getQidahenRuntimeRegionAnchorTargetPoint('city-region-7') as { x: number; y: number };
            });
            const map = geometry.map!;
            dispatchPoint = { x: map.left + point.x / 1265 * map.width, y: map.top + point.y / 893 * map.height };
            expect(dispatchPoint.x >= group.left && dispatchPoint.x <= group.right && dispatchPoint.y >= group.top && dispatchPoint.y <= group.bottom,
                '辽北兵牌面板不能遮住推荐目标的真实点击点').toBe(false);
        }
        if (step === 'diplomacy-target') {
            const point = await page.evaluate(async () => {
                const path = '/src/games/qidahen/ui/mapGraph.ts';
                return (await import(path)).getQidahenRuntimeRegionAnchorTargetPoint('city-region-2') as { x: number; y: number };
            });
            const map = geometry.map!;
            const x = map.left + point.x / 1265 * map.width, y = map.top + point.y / 893 * map.height;
            expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1920);
            expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(1080);
            diplomacyPoint = { x, y };
        }
        if (step === 'occupy') {
            await expect(page.locator('[data-pending-committed-selected="true"]')).toHaveCount(3);
            await expect(page.locator('[data-qidahen-post-battle-target="true"]')).toHaveCount(1);
            await expect(page.getByTestId('qidahen-map-region-focus-name')).toHaveText('叶赫部');
            expect(geometry.battleRegions.length).toBeGreaterThanOrEqual(2);
            for (const region of geometry.battleRegions) {
                expect(region.rect.left).toBeGreaterThanOrEqual(0);
                expect(region.rect.top).toBeGreaterThanOrEqual(0);
                expect(region.rect.right).toBeLessThanOrEqual(1920);
                expect(region.rect.bottom).toBeLessThanOrEqual(1080);
            }
            for (const token of geometry.battleTokens) for (const overlay of geometry.hud.filter(item => ['tutorial-overlay-card', 'qidahen-actions-zone', 'qidahen-action-wheel', 'qidahen-hand-zone'].includes(item.id ?? ''))) {
                const a = token.rect, b = overlay.rect;
                expect(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom, `${token.id} 被 ${overlay.id} 遮挡`).toBe(true);
            }
        }
        await page.screenshot({ path: resolve(output, `${step}.png`) });
        if (step === 'abandon-inner-wall' || step === 'abandon-outer-wall') {
            const bounds = await page.getByTestId('qidahen-fortification-context').boundingBox();
            expect(bounds).not.toBeNull();
            expect(bounds!.x).toBeGreaterThanOrEqual(-0.25);
            expect(bounds!.y).toBeGreaterThanOrEqual(-0.25);
            expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1920.25);
            expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(1080.25);
        }
        if (step === 'abandon-inner-wall') {
            const abandon = page.getByTestId('qidahen-turn-option-abandon');
            const direct = await abandon.getAttribute('data-qidahen-direct-choice') === 'true';
            await abandon.click();
            if (!direct) {
                await expect(page.getByTestId('qidahen-turn-confirm')).toBeEnabled();
                await page.getByTestId('qidahen-turn-confirm').click();
            }
            await expect.poll(() => page.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state.get()?.sys.tutorial.step?.id),
                { timeout: 30_000 }).toBe('abandon-outer-wall');
            await expect(page.getByTestId('qidahen-fortification-highlight')).toHaveAttribute('data-fortification-id', 'outer-wall');
            await expect(page.getByText('游戏加载失败')).toHaveCount(0);
        }
        if (diplomacyPoint) {
            await page.mouse.click(diplomacyPoint.x, diplomacyPoint.y);
            await expect(page.getByTestId('qidahen-turn-confirm')).toBeEnabled();
        }
        if (dispatchPoint) {
            await page.mouse.click(dispatchPoint.x, dispatchPoint.y);
            await expect(page.getByTestId('qidahen-turn-confirm')).toBeEnabled();
        }
        if (step === 'upkeep-datong') {
            await page.getByTestId('qidahen-map-token-city-region-1-army-ming-post-sarhu-1619-datong-regular-infantry-lv1__compat__1').click();
            await expect(page.getByTestId('qidahen-turn-confirm')).toBeEnabled();
        }
        if (step === 'upkeep-pyongyang') {
            await expect(page.getByText(/需支持或移除1支部队/)).toBeVisible();
            await page.getByTestId('qidahen-map-token-city-region-18-army-ming-post-sarhu-1619-pyongyang-mercenary-infantry-lv2__compat__1').click();
            await expect(page.getByTestId('qidahen-turn-confirm')).toBeEnabled();
            await page.screenshot({ path: resolve(output, `${step}-selected.png`) });
        }
    });
}
