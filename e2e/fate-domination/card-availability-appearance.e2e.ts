import { expect, test } from '@playwright/test';
import path from 'node:path';
import { createEvidenceScreenshotRun } from '../framework/evidenceScreenshots';
import { initContext } from '../helpers/common';
import { getMatchState, patchMatchState } from '../helpers/state-injection';
import { expectFateHandArtLoaded } from './handVisibility';
import { chooseFateIdentity } from './identitySelection';
import type { MatchState } from '../../src/engine/types';
import { FATE_ATTACK_BY_ID } from '../../src/games/fate-domination/data';
import type { FateDominationCore } from '../../src/games/fate-domination/domain';

test.use({ viewport: { width: 1366, height: 768 } });

test('仅在本人出牌时灰显不能打出的牌，前哨和放大保持原色', async ({ page, context }, testInfo) => {
    test.setTimeout(90000);
    await initContext(context);
    await page.goto('/');
    await page.locator('[data-game-id="fate-domination"] .platform-game-open').first().click();
    await page.getByTestId('game-details-open-create-room').first().click();
    const room = page.getByTestId('create-room-modal').last();
    await room.getByRole('button', { name: '3人', exact: true }).click();
    await room.getByRole('button', { name: /^加入 AI/ }).click();
    await room.getByTestId('create-room-confirm-button').click();
    await page.waitForURL(/\/play\/fate-domination\/match\/[^/?]+\?playerID=0/);
    const matchId = new URL(page.url()).pathname.split('/').at(-1)!;
    const read = async () => await getMatchState(matchId, page) as MatchState<FateDominationCore>;
    const primary = page.getByTestId('fate-domination-primary-action');
    await chooseFateIdentity(page, 'master', 'm_waver');
    await chooseFateIdentity(page, 'servant', 'servant-saber');
    await primary.click();
    await expect.poll(async () => (await read()).core.phase).toBe('outpost');

    const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const capture = (name: string) => page.screenshot({ path: path.join(run.stagingDir, name), animations: 'disabled' });
    const skill = page.locator('[data-card-zone="skill"][data-focus-card*="sc_saber_2:"]');
    const art = (card: typeof skill) => card.locator('.fd-runtime-card-art');
    await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready');
    await expectFateHandArtLoaded(page);
    await expect(skill).toHaveAttribute('aria-disabled', 'true');
    await expect(art(skill)).toHaveCSS('filter', 'none');
    await expect(page.locator('[data-card-zone="hand"] .fd-runtime-card-art').first()).toHaveCSS('filter', 'none');
    await capture('01-前哨阶段保留牌面颜色.png');

    // 复用在线房的真实牌实例，固定低魔力的行动局面。
    const { core, sys } = await read();
    const actor = core.players['0'];
    const cards = [...actor.hand, ...actor.deck];
    const payable = cards.find(card => FATE_ATTACK_BY_ID[card.definitionId].manaCost === 0)!;
    const costly = cards.find(card => FATE_ATTACK_BY_ID[card.definitionId].manaCost > 0)!;
    const hand = [...new Map([payable, costly, ...actor.hand].map(card => [card.id, card])).values()].slice(0, 3);
    await patchMatchState(matchId, { core: {
        phase: 'action', currentPlayerId: '0', currentTurnIndex: core.turnOrder.indexOf('0'),
        battlefield: { ...core.battlefield, shinto: { ...core.battlefield.shinto, playerIds: ['0'] } },
        players: { '0': { ...actor, hand, deck: cards.filter(card => !hand.includes(card)), locationId: 'shinto', deploymentSlot: 0, mana: 0 } },
    }, sys: { ...sys, turnOrder: core.turnOrder, currentPlayerIndex: core.turnOrder.indexOf('0') } }, page);
    const payableCard = page.locator(`[data-card-zone="hand"][data-card-id="${payable.id}"]`);
    const costlyCard = page.locator(`[data-card-zone="hand"][data-card-id="${costly.id}"]`);
    await expect(payableCard).toHaveAttribute('aria-disabled', 'false');
    await expect(costlyCard).toHaveAttribute('aria-disabled', 'true');
    await expect(art(payableCard)).toHaveCSS('filter', 'none');
    await expect(art(costlyCard)).toHaveCSS('filter', /grayscale/);
    await expect(art(skill)).toHaveCSS('filter', /grayscale/);
    await expectFateHandArtLoaded(page);
    await capture('02-行动时只有不可打出的牌变灰.png');

    await skill.hover();
    await skill.locator('..').getByTestId('card-inspect-button').click();
    const enlarged = page.getByTestId('fate-inspection-card-face').locator('img');
    await expect(enlarged).toBeVisible();
    await expect.poll(() => enlarged.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(enlarged).toHaveCSS('filter', 'none');
    await capture('03-灰显技能的放大图保持原色.png');
    console.log('[Fate card availability]', run.stagingDir);
});
