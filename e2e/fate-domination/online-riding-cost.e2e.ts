import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { initContext } from '../helpers/common';
import { getMatchState, patchMatchState } from '../helpers/state-injection';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory, promoteEvidenceScreenshotRun } from '../framework/evidenceScreenshots';
import { fateAttackManaCost } from '../../src/games/fate-domination/domain/attackSelection';
import { fateRidingCandidates } from '../../src/games/fate-domination/domain/ridingChoice';
import type { FateDominationCore } from '../../src/games/fate-domination/domain';
import type { MatchState } from '../../src/engine/types';
import { chooseFateIdentity } from './identitySelection';

test.use({ viewport: { width: 1169, height: 719 } });

test('在线房骑乘使用真实牌实例校验实付和第四张拒绝，费用草稿只由本人预览', async ({ page, context }, testInfo) => {
    test.setTimeout(180000);
    await initContext(context);
    await page.goto('/');
    await page.locator('[data-game-id="fate-domination"] .platform-game-open').first().click();
    await page.getByTestId('game-details-open-create-room').first().click();
    const room = page.getByTestId('create-room-modal').last();
    await room.getByRole('button', { name: '3人', exact: true }).click();
    await room.getByRole('button', { name: /^加入 AI/ }).click();
    await room.getByTestId('create-room-confirm-button').click();
    await page.waitForURL(/\/play\/fate-domination\/match\/[^/?]+\?playerID=0/);
    const matchId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
    const read = async () => await getMatchState(matchId, page) as MatchState<FateDominationCore>;
    const own = async () => (await read()).core.players['0'];
    const main = page.getByTestId('fate-domination-primary-action');

    await chooseFateIdentity(page, 'master', 'm_waver');
    await chooseFateIdentity(page, 'servant', 'servant-rider');
    await main.click();
    await expect.poll(async () => (await read()).core.phase, { timeout: 30000 }).toBe('outpost');
    await page.getByTestId('fate-domination-location-workshop').click();
    await expect.poll(async () => (await own()).locationId).toBe('workshop');
    await page.getByRole('button', { name: '发动战略部署' }).click();
    await expect.poll(async () => (await own()).hand.length).toBe(5);
    await main.click();
    await expect.poll(async () => (await read()).core.phase, { timeout: 30000 }).toBe('action');

    // Server fixture swaps locations of this match's real cards, retaining all instance IDs.
    const start = await read();
    const player = start.core.players['0'];
    const pool = [...player.hand, ...player.deck];
    const wanted = ['cardB1', 'cardSurveil', 'cardB1', 'cardQ1', 'cardB2'];
    const hand = wanted.map(definitionId => {
        const index = pool.findIndex(card => card.definitionId === definitionId);
        expect(index, definitionId).toBeGreaterThanOrEqual(0);
        return pool.splice(index, 1)[0];
    });
    // The shared test endpoint also validates these legacy turn fields.
    const sys = { ...start.sys, turnOrder: start.core.turnOrder, currentPlayerIndex: start.core.currentTurnIndex };
    await patchMatchState(matchId, {
        core: { players: { '0': { ...player, hand, deck: pool, mana: 10 } } },
        sys,
    }, page);
    await expect.poll(async () => (await own()).hand.map(card => card.id)).toEqual(hand.map(card => card.id));

    const attack = (id: string, zone = 'hand') => page.locator(`[data-card-zone="${zone}"][data-card-id="${id}"]`);
    const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true, subdir: '在线代表态诊断' });
    const capture = (name: string) => page.screenshot({
        path: getEvidenceScreenshotPathInDirectory(run.stagingDir, `${name}.png`, { requireChineseName: true }),
        animations: 'disabled',
    });
    const mana = page.getByTestId('fate-self-mana').locator('b');
    const readyHand = page.getByTestId('fate-domination-hand');
    const firstSlot = (await readyHand.locator('[data-card-zone="hand"]').first().boundingBox())!.x;
    const abilityButtons = page.locator('.fd-master-abilities');
    await expect(abilityButtons.getByRole('button')).toHaveCount(3);
    expect(await abilityButtons.evaluate(node => getComputedStyle(node).overflowY)).toBe('visible');
    await expect(mana).toHaveText('10');

    const map = page.locator('.fd-runtime-map-overlay');
    const zoom = page.locator('.fd-runtime-camera-controls span');
    const position = () => map.evaluate(node => getComputedStyle(node).transform);
    await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready');
    await page.mouse.move(566, 166);
    await page.mouse.wheel(0, 2400);
    await expect(zoom).toHaveText('25%');
    const beforeDrag = await position();
    await page.mouse.move(306, 196);
    await page.mouse.down();
    await page.mouse.move(1158, 6, { steps: 12 });
    await page.mouse.up();
    await expect.poll(position).not.toBe(beforeDrag);
    const visibleMap = await map.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return {
            widthPx: Math.min(rect.right, innerWidth) - Math.max(rect.left, 0),
            heightPx: Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
            width: rect.width,
            height: rect.height,
        };
    });
    expect(visibleMap.widthPx / visibleMap.width).toBeGreaterThanOrEqual(.84);
    expect(visibleMap.heightPx / visibleMap.height).toBeGreaterThanOrEqual(.84);
    await page.getByRole('button', { name: '复位', exact: true }).click();
    await expect(zoom).not.toHaveText('25%');
    await expect.poll(() => map.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(660);
    await capture('地图拖动与复位');

    const first = attack(hand[0].id);
    const seals = page.getByRole('button', { name: '使用令咒', exact: true });
    await expect(seals).toBeEnabled();
    const sealCard = seals.locator('.fd-self-seal-card').first();
    await sealCard.hover();
    await expect(sealCard).toHaveCSS('outline-style', 'solid');
    await capture('令咒悬浮描边');
    await first.click({ button: 'right', position: {x: 12, y: 60} });
    const close = page.getByTestId('fate-inspection-close');
    await expect(close).toHaveCSS('opacity', '0');
    await capture('检视未悬浮');
    await page.getByTestId('fate-runtime-inspection').hover();
    await expect(close).toHaveCSS('opacity', '1');
    await capture('检视悬浮可关闭');
    await close.click();
    await expect(close).toHaveCount(0);

    await page.getByRole('button', { name: '选择 骑乘', exact: true }).click();
    await expect(mana).toHaveText('7');
    expect((await own()).mana).toBe(10);
    expect((await own()).selectedAttackIds).toEqual([]);
    await page.mouse.move(12, 12);
    await capture('技能暂存预计扣费');
    await page.locator('[data-card-zone="staged-skill"]').click();
    await expect(mana).toHaveText('10');
    await page.getByRole('button', { name: '选择 骑乘', exact: true }).click();
    await attack(hand[0].id).click({ position: {x: 12, y: 60} });
    await main.click();
    await expect.poll(async () => (await own()).normalAttackPlayed).toBe(true);

    const beforeRide = await read();
    const candidates = fateRidingCandidates(beforeRide.core, '0');
    const chosen = hand.slice(1).map(card => card.id);
    expect(candidates.map(card => card.id)).toEqual(expect.arrayContaining(chosen));
    const expectedCost = chosen.slice(0, 3).reduce((sum, id) => sum + fateAttackManaCost(beforeRide.core.players['0'], id)!, 0);
    expect(expectedCost).toBeGreaterThan(0);
    await page.getByRole('button', { name: '发动 骑乘', exact: true }).click();
    for (const id of chosen.slice(0, 3)) {
        await attack(id).click({ position: {x: 12, y: 60} });
        await expect(attack(id)).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(attack(chosen[3])).toHaveAttribute('aria-disabled', 'true');
    const fourth = (await attack(chosen[3]).boundingBox())!;
    const fourthPoint = { x: fourth.x + 12, y: fourth.y + 60 };
    expect(await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.closest('[data-card-id]')?.getAttribute('data-card-id'), fourthPoint)).toBe(chosen[3]);
    await page.mouse.click(fourthPoint.x, fourthPoint.y);
    await expect(attack(chosen[3])).toHaveAttribute('aria-pressed', 'false');
    expect((await own()).mana).toBe(beforeRide.core.players['0'].mana);
    expect((await own()).selectedAttackIds).toEqual([]);
    await page.mouse.move(12, 12);
    await capture('骑乘三张与本批费用');
    await page.getByTestId('fate-domination-primary-action').click();
    await expect.poll(async () => (await own()).mana).toBe(beforeRide.core.players['0'].mana - expectedCost);
    const after = await own();
    expect(after.activeAttackIds).toEqual([hand[0].id, ...chosen.slice(0, 3)]);
    expect(after.selectedAttackIds).toEqual([]);
    expect(after.normalAttackPlayed).toBe(true);
    expect((await read()).core.currentPlayerId).toBe('0');
    const firstAfter = (await readyHand.locator('[data-card-zone="hand"]').first().boundingBox())!.x;
    expect(Math.abs(firstAfter - firstSlot)).toBeLessThan(2);
    await writeFile(join(run.stagingDir, 'diagnostic.json'), JSON.stringify({
        matchId, visibleMapAfterDragPx: { width: visibleMap.widthPx, height: visibleMap.heightPx }, manaBeforeRiding: beforeRide.core.players['0'].mana,
        manaAfterRiding: after.mana, expectedCost, firstSlotBefore: firstSlot, firstSlotAfter: firstAfter,
        scope: '正式在线房，使用本局真实实例调换牌区。仅诊断本用例的行为与画面。',
    }, null, 2));
    await promoteEvidenceScreenshotRun(run);
    console.log('[Fate online riding] 诊断截图', run.stableDir);
});
