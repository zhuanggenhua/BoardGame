/**
 * 调试状态注入问题：对比僵尸测试（通过）和海盗测试（崩溃）
 */

import { test, expect } from '@playwright/test';
import { initContext } from '../helpers/common';
import {
    readFullState, applyCoreStateDirect,
    gotoLocalSmashUp, waitForHandArea, completeFactionSelectionLocal,
    getCurrentPlayer, makeCard, makeMinion,
    FACTION,
} from './smashup-debug-helpers';

test.describe('SmashUp 状态注入调试', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ context }) => {
        await initContext(context, { storageKey: '__smashup_debug_reset' });
    });

    test('僵尸派系 - 状态注入后不崩溃', async ({ page }) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.ZOMBIES, FACTION.PIRATES, FACTION.NINJAS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'zombie_outbreak', 'action', currentPid));
        core.nextUid = nextUid + 1;

        const bases = core.bases as any[];
        for (const base of bases) {
            base.minions = [];
        }

        player.actionsPlayed = 0;
        player.actionLimit = 1;
        player.minionsPlayed = 0;
        player.minionLimit = 1;

        await applyCoreStateDirect(page, core);
        await page.waitForTimeout(2000);

        // 检查页面是否崩溃
        const hasError = await page.locator('text=Something went wrong').isVisible().catch(() => false);
        expect(hasError).toBe(false);

        // 检查手牌区是否可见
        const handArea = page.getByTestId('su-hand-area');
        await expect(handArea).toBeVisible({ timeout: 5000 });
    });

    test('海盗派系 - 状态注入后崩溃', async ({ page }) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.PIRATES, FACTION.NINJAS, FACTION.ROBOTS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const turnOrder = core.turnOrder as string[];
        const opponentPid = turnOrder.find(p => p !== currentPid)!;
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'pirate_cannon', 'action', currentPid));

        const bases = core.bases as any[];
        for (const base of bases) {
            base.minions = [];
        }
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'zombie_walker', opponentPid, opponentPid, 2),
        ];
        core.nextUid = nextUid + 2;
        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        await page.waitForTimeout(2000);

        // 检查页面是否崩溃
        const hasError = await page.locator('text=Something went wrong').isVisible().catch(() => false);
        expect(hasError).toBe(false);

        // 检查手牌区是否可见
        const handArea = page.getByTestId('su-hand-area');
        await expect(handArea).toBeVisible({ timeout: 5000 });
    });
});
