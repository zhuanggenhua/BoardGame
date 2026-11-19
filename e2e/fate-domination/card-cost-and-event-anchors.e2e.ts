import { expect, test } from '@playwright/test';
import path from 'node:path';
import { createEvidenceScreenshotRun } from '../framework/evidenceScreenshots';
import { initContext } from '../helpers/common';
import { getMatchState, patchMatchState } from '../helpers/state-injection';
import { chooseFateIdentity } from './identitySelection';
import { expectFateHandArtLoaded } from './handVisibility';
import type { MatchState } from '../../src/engine/types';
import type { FateDominationCore } from '../../src/games/fate-domination/domain';
import { FATE_SITUATIONS } from '../../src/games/fate-domination/data';

const variants = [
    { servant: 'servant-saber', skill: 'sc_saber_2', direction: 'decrease', cost: '↓2' },
    { servant: 'servant-cu-chulainn', skill: 'sc_cu_1', direction: 'increase', cost: '↑5' },
] as const;

for (const { servant, skill, direction, cost } of variants) {
    test(`在线代表态：${direction} 原费用格显示当前费用与箭头，事件保持地图位置`, async ({ page, context }, testInfo) => {
        test.setTimeout(120000);
        const evidence = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
        await page.setViewportSize({ width: 1366, height: 768 });
        await initContext(context);
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-game-id="fate-domination"] .platform-game-open').first().click();
        await page.getByTestId('game-details-open-create-room').first().click();
        const room = page.getByTestId('create-room-modal').last();
        await room.getByRole('button', { name: '3人', exact: true }).click();
        await room.getByRole('button', { name: /^加入 AI/ }).click();
        await room.getByTestId('create-room-confirm-button').click();
        await page.waitForURL(/\/play\/fate-domination\/match\/[^/?]+\?playerID=0/);
        const matchId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
        const read = async () => await getMatchState(matchId, page) as MatchState<FateDominationCore>;
        await chooseFateIdentity(page, 'master', 'm_shirou_emiya');
        await chooseFateIdentity(page, 'servant', servant);
        await page.getByTestId('fate-domination-primary-action').click();
        await expect.poll(async () => (await read()).core.phase).toBe('outpost');

        const original = await read();
        const { core, sys } = original;
        const actor = core.players['0'];
        const battlefield = structuredClone(core.battlefield);
        battlefield.shinto.playerIds.push('0');
        const situation = FATE_SITUATIONS.find(card => card.id === 'sit1')!;
        await patchMatchState(matchId, { core: { phase: 'action', currentPlayerId: '0', currentTurnIndex: core.turnOrder.indexOf('0'),
            battlefield, situation, shintoEventFaceDown: false, players: { '0': { ...actor, locationId: 'shinto', deploymentSlot: 0,
                mana: 10, piercingSpearPlays: direction === 'increase' ? 1 : 0, isRevealed: direction === 'increase' } } },
            sys: { ...sys, turnOrder: core.turnOrder, currentPlayerIndex: core.turnOrder.indexOf('0') } }, page);
        await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready');
        await expectFateHandArtLoaded(page);
        const card = page.locator(`[data-card-zone="skill"][data-focus-card*="${skill}:"]`);
        const badge = card.locator('[data-cost-change]');
        await expect(badge).toHaveAttribute('data-cost-change', direction);
        await expect(badge).toHaveText(cost);
        const sameWorld = page.locator('.fd-runtime-map-overlay button[data-fate-shinto-event]');
        await expect(sameWorld).toHaveCount(core.currentEvents.shinto.length);

        await card.hover({ position: { x: 10, y: 20 } });
        const inspect = card.locator('..').getByTestId('card-inspect-button');
        await expect(inspect).toHaveCSS('opacity', '1');
        const [face, icon] = await Promise.all([card.boundingBox(), inspect.boundingBox()]);
        expect(icon!.x).toBeGreaterThan(face!.x + face!.width / 2);
        expect(icon!.y).toBeLessThan(face!.y + 12);
        await page.screenshot({ path: path.join(evidence.stagingDir, '01-费用及右上放大镜.png'), animations: 'disabled' });
        await inspect.click();
        await expect(page.getByTestId('fate-runtime-inspection')).toBeVisible();
        await page.keyboard.press('Escape');

        await page.setViewportSize({ width: 920, height: 540 });
        const map = page.locator('.fd-runtime-map');
        const free = await map.evaluate(node => {
            for (let y = 90; y < 220; y += 20) for (let x = 110; x < 680; x += 20) {
                const hit = document.elementFromPoint(x, y);
                if (hit && node.contains(hit) && !hit.closest('button')) return { x, y };
            }
            throw new Error('找不到可用的地图空处');
        });
        await page.mouse.move(free.x, free.y);
        await page.mouse.wheel(0, 2000);
        await expect(page.locator('.fd-runtime-camera-controls span')).toHaveText('25%');
        const overlay = page.locator('.fd-runtime-map-overlay');
        await expect.poll(() => overlay.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).a)).toBeCloseTo(.25, 2);
        await expect(sameWorld).toHaveCount(core.currentEvents.shinto.length);
        await expect(page.locator('button[data-fate-shinto-event]')).toHaveCount(core.currentEvents.shinto.length);
        await page.screenshot({ path: path.join(evidence.stagingDir, '02-低缩放事件留在原战场.png'), animations: 'disabled' });
        const eventHit = await sameWorld.first().evaluate(node => {
            const rect = node.getBoundingClientRect();
            for (const y of [.15, .3, .5, .7]) for (const x of [.5, .25, .75]) {
                const point = { x: rect.left + rect.width * x, y: rect.top + rect.height * y };
                if (node.contains(document.elementFromPoint(point.x, point.y))) return point;
            }
            return null;
        });
        expect(eventHit, '低缩放下应能点击战场内的事件牌').not.toBeNull();
        await page.mouse.click(eventHit!.x, eventHit!.y);
        await expect(page.getByTestId('fate-runtime-inspection')).toBeVisible();
        console.log('[Fate cost and map]', evidence.stagingDir);
    });
}
