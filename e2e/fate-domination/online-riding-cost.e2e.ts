import { expect, test } from '@playwright/test';
import { initContext } from '../helpers/common';
import { getMatchState, patchMatchState } from '../helpers/state-injection';
import { fateAttackManaCost } from '../../src/games/fate-domination/domain/attackSelection';
import { fateRidingCandidates } from '../../src/games/fate-domination/domain/ridingChoice';
import type { FateDominationCore } from '../../src/games/fate-domination/domain';
import type { MatchState } from '../../src/engine/types';
import { chooseFateIdentity } from './identitySelection';

test.use({ viewport: { width: 1169, height: 719 } });

test('在线房骑乘使用真实牌实例校验实付和第四张拒绝，费用草稿只由本人预览', async ({ page, context }) => {
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
    await patchMatchState(matchId, { core: { players: { '0': { ...player, hand, deck: pool, mana: 10 } } } }, page);
    await expect.poll(async () => (await own()).hand.map(card => card.id)).toEqual(hand.map(card => card.id));

    const attack = (id: string, zone = 'hand') => page.locator(`[data-card-zone="${zone}"][data-card-id="${id}"]`);
    const mana = page.getByTestId('fate-self-mana').locator('b');
    const readyHand = page.getByTestId('fate-domination-hand');
    const firstSlot = (await readyHand.locator('[data-card-zone="hand"]').first().boundingBox())!.x;
    const abilityButtons = page.locator('.fd-master-abilities');
    await expect(abilityButtons.getByRole('button')).toHaveCount(3);
    expect(await abilityButtons.evaluate(node => getComputedStyle(node).overflowY)).toBe('visible');
    await expect(mana).toHaveText('10');

    const first = attack(hand[0].id);
    await first.click({ button: 'right' });
    const close = page.getByTestId('fate-inspection-close');
    await expect(close).toHaveCSS('opacity', '0');
    await page.getByTestId('fate-runtime-inspection').hover();
    await expect(close).toHaveCSS('opacity', '1');
    await close.click();
    await expect(close).toHaveCount(0);

    await page.getByRole('button', { name: '选择 骑乘', exact: true }).click();
    await expect(mana).toHaveText('7');
    expect((await own()).mana).toBe(10);
    expect((await own()).selectedAttackIds).toEqual([]);
    await page.locator('[data-card-zone="staged-skill"]').click();
    await expect(mana).toHaveText('10');
    await page.getByRole('button', { name: '选择 骑乘', exact: true }).click();
    await attack(hand[0].id).click();
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
        await attack(id).click();
        await expect(attack(id)).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(attack(chosen[3])).toHaveAttribute('aria-disabled', 'true');
    const fourth = (await attack(chosen[3]).boundingBox())!;
    await page.mouse.click(fourth.x + fourth.width * .85, fourth.y + fourth.height * .5);
    await expect(attack(chosen[3])).toHaveAttribute('aria-pressed', 'false');
    expect((await own()).mana).toBe(beforeRide.core.players['0'].mana);
    expect((await own()).selectedAttackIds).toEqual([]);
    await page.getByTestId('fate-riding-confirm').click();
    await expect.poll(async () => (await own()).mana).toBe(beforeRide.core.players['0'].mana - expectedCost);
    const after = await own();
    expect(after.activeAttackIds).toEqual([hand[0].id, ...chosen.slice(0, 3)]);
    expect(after.selectedAttackIds).toEqual([]);
    expect(after.normalAttackPlayed).toBe(true);
    expect((await read()).core.currentPlayerId).toBe('0');
    const firstAfter = (await readyHand.locator('[data-card-zone="hand"]').first().boundingBox())!.x;
    expect(Math.abs(firstAfter - firstSlot)).toBeLessThan(2);
});
