/**
 * 大杀四方 - 僵尸派系多步交互 E2E 测试
 *
 * 覆盖：
 * - zombie_outbreak（爆发）：选基地（棋盘直选） → 选手牌随从（PromptOverlay）
 * - zombie_they_keep_coming（它们不断来临）：选弃牌堆随从（PromptOverlay） → 选基地（棋盘直选）
 *
 * 注意：SmashUp 的交互模式：
 * - 基地选择 → 基地在棋盘上高亮（ring-amber-400），直接点击
 * - 随从选择 → 随从在棋盘上高亮（ring-purple-400），直接点击
 * - 手牌弃牌 → 手牌区直接选择
 * - 其他选项 → PromptOverlay（z-index:300）
 */

import { test, expect } from '@playwright/test';
import { initContext } from '../helpers/common';
import {
    closeDebugPanel, readFullState, applyCoreStateDirect,
    gotoLocalSmashUp, waitForHandArea, completeFactionSelectionLocal,
    getCurrentPlayer, makeCard, waitForPrompt, isPromptVisible,
    clickPromptOption, clickHandCard, waitForBaseSelect,
    clickHighlightedBase, isBaseSelectMode,
    FACTION,
} from './smashup-debug-helpers';

test.describe('SmashUp 僵尸多步交互', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ context }) => {
        await initContext(context, { storageKey: '__smashup_zombie_multi_reset' });
    });

    // ========================================================================
    // zombie_outbreak（爆发）：选空基地（棋盘直选） → 选手牌随从（PromptOverlay）
    // ========================================================================
    test('zombie_outbreak: 选空基地 → 选手牌随从 → 随从部署到基地', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.ZOMBIES, FACTION.PIRATES, FACTION.NINJAS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(
            makeCard(`card_${nextUid}`, 'zombie_outbreak', 'action', currentPid),
            makeCard(`card_${nextUid + 1}`, 'zombie_walker', 'minion', currentPid),
        );
        core.nextUid = nextUid + 2;

        const bases = core.bases as any[];
        for (const base of bases) {
            base.minions = [];
        }

        player.actionsPlayed = 0;
        player.actionLimit = 1;
        player.minionsPlayed = 0;
        player.minionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        // 打出 zombie_outbreak（行动卡）
        await clickHandCard(page, 0);
        await page.waitForTimeout(1000);

        // 第一步：选择空基地 — 基地在棋盘上高亮，直接点击
        await waitForBaseSelect(page);
        await page.screenshot({ path: testInfo.outputPath('step1-choose-base.png'), fullPage: true });
        await clickHighlightedBase(page, 0);
        await page.waitForTimeout(1500);

        // 第二步：选择手牌随从 — 通过 PromptOverlay 或手牌直选
        // outbreak 的第二步是选手牌随从，可能走 PromptOverlay 或手牌直选
        const hasPrompt = await isPromptVisible(page);
        await page.screenshot({ path: testInfo.outputPath('step2-choose-minion.png'), fullPage: true });

        if (hasPrompt) {
            await clickPromptOption(page, 0);
        } else {
            // 手牌直选模式：点击手牌中的随从
            await clickHandCard(page, 0);
        }
        await page.waitForTimeout(1000);

        // Prompt 应消失
        expect(await isPromptVisible(page)).toBe(false);
        expect(await isBaseSelectMode(page)).toBe(false);

        // 验证状态：基地上应有随从
        const afterState = await readFullState(page);
        const afterCore = (afterState.core ?? afterState) as Record<string, unknown>;
        const afterBases = afterCore.bases as { minions: any[] }[];
        const totalMinions = afterBases.reduce(
            (sum, b) => sum + b.minions.filter((m: any) => m.controller === currentPid).length, 0,
        );
        expect(totalMinions).toBeGreaterThanOrEqual(1);

        await page.screenshot({ path: testInfo.outputPath('step3-final.png'), fullPage: true });
    });

    // ========================================================================
    // zombie_they_keep_coming（它们不断来临）：选弃牌堆随从（PromptOverlay） → 选基地（棋盘直选）
    // ========================================================================
    test('zombie_they_keep_coming: 选弃牌堆随从 → 选基地 → 随从从弃牌堆打出', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.ZOMBIES, FACTION.PIRATES, FACTION.NINJAS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'zombie_they_keep_coming', 'action', currentPid));

        const discard = player.discard as any[];
        discard.push(
            makeCard(`card_${nextUid + 1}`, 'zombie_walker', 'minion', currentPid),
            makeCard(`card_${nextUid + 2}`, 'zombie_tenacious_z', 'minion', currentPid),
        );
        core.nextUid = nextUid + 3;

        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        // 打出 zombie_they_keep_coming
        await clickHandCard(page, 0);
        await page.waitForTimeout(1500);

        // 第一步：选择弃牌堆随从 — PromptOverlay（卡牌模式）
        await waitForPrompt(page, 15000);
        await page.screenshot({ path: testInfo.outputPath('step1-choose-discard-minion.png'), fullPage: true });
        await clickPromptOption(page, 0);
        await page.waitForTimeout(2000);

        // 第二步：选择基地 — 可能是棋盘直选或 PromptOverlay
        const hasBaseSelect = await isBaseSelectMode(page);
        const hasPrompt = await isPromptVisible(page);
        await page.screenshot({ path: testInfo.outputPath('step2-choose-base.png'), fullPage: true });

        if (hasBaseSelect) {
            await clickHighlightedBase(page, 0);
        } else if (hasPrompt) {
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        // Prompt 应消失
        expect(await isPromptVisible(page)).toBe(false);

        // 验证：弃牌堆减少
        const afterState = await readFullState(page);
        const afterCore = (afterState.core ?? afterState) as Record<string, unknown>;
        // 验证基地上有随从（action 卡本身也会进弃牌堆，所以验证基地更可靠）
        const afterBases = afterCore.bases as { minions: any[] }[];
        const totalMinions = afterBases.reduce(
            (sum, b) => sum + b.minions.filter((m: any) => m.controller === currentPid).length, 0,
        );
        expect(totalMinions).toBeGreaterThanOrEqual(1);

        await page.screenshot({ path: testInfo.outputPath('step3-final.png'), fullPage: true });
    });
});
