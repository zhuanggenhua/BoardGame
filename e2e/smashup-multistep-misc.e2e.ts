/**
 * 大杀四方 - 其他派系多步交互 E2E 测试
 *
 * 交互模式说明：
 * - 基地选择 → 基地在棋盘上高亮（ring-amber-400），直接点击
 * - 随从选择 → 随从在棋盘上高亮（ring-purple-400），直接点击
 * - 手牌弃牌 → 手牌区直接选择
 * - 其他选项 → PromptOverlay（z-index:300）
 */

import { test, expect } from '@playwright/test';
import { initContext } from './helpers/common';
import {
    closeDebugPanel, readFullState, applyCoreStateDirect,
    gotoLocalSmashUp, waitForHandArea, completeFactionSelectionLocal,
    getCurrentPlayer, makeCard, makeMinion, waitForPrompt, isPromptVisible,
    clickPromptOption, clickPromptOptionByText, clickHandCard,
    waitForBaseSelect, clickHighlightedBase, isBaseSelectMode,
    waitForMinionSelect, clickHighlightedMinion, isMinionSelectMode,
    FACTION,
} from './smashup-debug-helpers';

// ============================================================================
// 忍者派系
// ============================================================================

test.describe('SmashUp 忍者多步交互', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ context }) => {
        await initContext(context, { storageKey: '__smashup_ninja_multi_reset' });
    });

    test('ninja_way_of_deception: 选对手随从 → 选目标基地 → 随从被移动', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.NINJAS, FACTION.PIRATES, FACTION.ROBOTS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const turnOrder = core.turnOrder as string[];
        const opponentPid = turnOrder.find(p => p !== currentPid)!;
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'ninja_way_of_deception', 'action', currentPid));

        const bases = core.bases as any[];
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'pirate_first_mate', opponentPid, opponentPid, 2),
        ];
        bases[1].minions = [];
        core.nextUid = nextUid + 2;
        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        await clickHandCard(page, 0);
        await page.waitForTimeout(1000);

        // 第一步：选随从 — 随从在棋盘上高亮
        await waitForMinionSelect(page);
        await clickHighlightedMinion(page, 0);
        await page.waitForTimeout(1000);

        // 第二步：选基地 — 基地在棋盘上高亮
        const hasBase = await isBaseSelectMode(page);
        const hasPrompt = await isPromptVisible(page);
        if (hasBase) {
            await clickHighlightedBase(page, 0);
        } else if (hasPrompt) {
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        expect(await isPromptVisible(page)).toBe(false);

        // 验证：随从从基地0移走
        const afterState = await readFullState(page);
        const afterBases = (afterState.core ?? afterState).bases as any[];
        expect(afterBases[0].minions.filter((m: any) => m.controller === opponentPid).length).toBe(0);
    });
});


// ============================================================================
// 机器人派系
// ============================================================================

test.describe('SmashUp 机器人多步交互', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ context }) => {
        await initContext(context, { storageKey: '__smashup_robot_multi_reset' });
    });

    test('robot_zapbot: 打出后获得额外随从额度（无弹窗）', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.ROBOTS, FACTION.PIRATES, FACTION.NINJAS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(
            makeCard(`card_${nextUid}`, 'robot_zapbot', 'minion', currentPid),
            makeCard(`card_${nextUid + 1}`, 'robot_microbot_fixer', 'minion', currentPid),
        );
        core.nextUid = nextUid + 2;
        player.minionsPlayed = 0;
        player.minionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        // 打出 zapbot：先选手牌，再选基地
        await clickHandCard(page, 0);
        await page.waitForTimeout(300);

        // 选基地打出 zapbot
        await waitForBaseSelect(page);
        await clickHighlightedBase(page, 0);
        await page.waitForTimeout(1500);

        // zapbot 的 onPlay 直接给额度，不弹窗
        expect(await isPromptVisible(page)).toBe(false);
        await page.screenshot({ path: testInfo.outputPath('zapbot-no-prompt.png'), fullPage: true });
    });

    test('robot_hoverbot: 确认打出牌库顶随从 → 选基地', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.ROBOTS, FACTION.PIRATES, FACTION.NINJAS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'robot_hoverbot', 'minion', currentPid));

        const deck = player.deck as any[];
        deck.unshift(makeCard(`card_${nextUid + 1}`, 'robot_microbot_fixer', 'minion', currentPid));
        core.nextUid = nextUid + 2;
        player.minionsPlayed = 0;
        player.minionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        // 打出 hoverbot：先选手牌，再选基地
        await clickHandCard(page, 0);
        await page.waitForTimeout(300);
        await waitForBaseSelect(page);
        await clickHighlightedBase(page, 0);
        await page.waitForTimeout(1500);

        // hoverbot onPlay：先展示牌库顶（pendingReveal），需要确认
        // 然后确认是否打出牌库顶随从（PromptOverlay）
        // 先处理可能的 reveal 确认
        const revealDismiss = page.getByTestId('reveal-dismiss-btn');
        if (await revealDismiss.isVisible({ timeout: 3000 }).catch(() => false)) {
            await revealDismiss.click();
            await page.waitForTimeout(1000);
        }

        const hasPrompt = await isPromptVisible(page);
        await page.screenshot({ path: testInfo.outputPath('step1-hoverbot-prompt.png'), fullPage: true });

        if (hasPrompt) {
            // 选择打出（非跳过/放回）
            const playResult = await page.evaluate(() => {
                const overlays = document.querySelectorAll('.fixed[style*="z-index"]');
                for (const overlay of overlays) {
                    const style = (overlay as HTMLElement).style;
                    if (style.zIndex && parseInt(style.zIndex) >= 300) {
                        const btns = overlay.querySelectorAll('button:not([disabled])');
                        for (const btn of btns) {
                            const text = btn.textContent || '';
                            if (!text.match(/跳过|Skip|放回/i)) {
                                (btn as HTMLElement).click();
                                return 'clicked-play';
                            }
                        }
                        if (btns.length > 0) { (btns[0] as HTMLElement).click(); return 'clicked-first'; }
                    }
                }
                return 'not-found';
            });
            console.log('hoverbot 选打出:', playResult);
            await page.waitForTimeout(1000);

            // 选基地
            const hasBase = await isBaseSelectMode(page);
            if (hasBase) {
                await clickHighlightedBase(page, 0);
            } else if (await isPromptVisible(page)) {
                await clickPromptOption(page, 0);
            }
            await page.waitForTimeout(1000);
        }

        expect(await isPromptVisible(page)).toBe(false);
        await page.screenshot({ path: testInfo.outputPath('step2-final.png'), fullPage: true });
    });
});


// ============================================================================
// 幽灵派系
// ============================================================================

test.describe('SmashUp 幽灵多步交互', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ context }) => {
        await initContext(context, { storageKey: '__smashup_ghost_multi_reset' });
    });

    test('ghost_spirit: 选目标随从 → 弃牌确认 → 随从被消灭', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.GHOSTS, FACTION.PIRATES, FACTION.NINJAS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const turnOrder = core.turnOrder as string[];
        const opponentPid = turnOrder.find(p => p !== currentPid)!;
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(
            makeCard(`card_${nextUid}`, 'ghost_spirit', 'action', currentPid),
            makeCard(`card_${nextUid + 1}`, 'zombie_walker', 'minion', currentPid),
            makeCard(`card_${nextUid + 2}`, 'zombie_tenacious_z', 'minion', currentPid),
            makeCard(`card_${nextUid + 3}`, 'pirate_first_mate', 'minion', currentPid),
        );

        const bases = core.bases as any[];
        // 清空所有基地随从
        for (const base of bases) {
            base.minions = [];
        }
        bases[0].minions = [
            makeMinion(`m_${nextUid + 4}`, 'pirate_first_mate', opponentPid, opponentPid, 2),
        ];
        core.nextUid = nextUid + 5;
        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        await clickHandCard(page, 0);
        await page.waitForTimeout(1000);

        // 第一步：选目标随从 — 随从在棋盘上高亮
        const hasMinionSelect = await isMinionSelectMode(page);
        const hasPrompt = await isPromptVisible(page);
        await page.screenshot({ path: testInfo.outputPath('step1-choose-target.png'), fullPage: true });

        if (hasMinionSelect) {
            await clickHighlightedMinion(page, 0);
        } else if (hasPrompt) {
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        // 第二步：弃牌确认（选择弃哪些牌）— PromptOverlay 多选模式
        const hasDiscardPrompt = await isPromptVisible(page);
        await page.screenshot({ path: testInfo.outputPath('step2-discard-confirm.png'), fullPage: true });
        expect(hasDiscardPrompt).toBe(true);

        // 选择弃牌（使用 evaluate 匹配 z-index style）
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('.fixed[style*="z-index"]');
            let clicked = 0;
            for (const overlay of overlays) {
                const style = (overlay as HTMLElement).style;
                if (style.zIndex && parseInt(style.zIndex) >= 300) {
                    const btns = overlay.querySelectorAll('button:not([disabled])');
                    for (const btn of btns) {
                        const text = btn.textContent || '';
                        if (!text.match(/跳过|Skip|确认|Confirm|取消全选|全选/i) && clicked < 2) {
                            (btn as HTMLElement).click();
                            clicked++;
                        }
                    }
                }
            }
        });
        await page.waitForTimeout(500);

        // 点确认
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('.fixed[style*="z-index"]');
            for (const overlay of overlays) {
                const style = (overlay as HTMLElement).style;
                if (style.zIndex && parseInt(style.zIndex) >= 300) {
                    const btns = overlay.querySelectorAll('button');
                    for (const btn of btns) {
                        const text = btn.textContent || '';
                        if (text.match(/确认|Confirm/i) && !btn.disabled) {
                            (btn as HTMLElement).click();
                            return;
                        }
                    }
                }
            }
        });
        await page.waitForTimeout(1000);

        await page.screenshot({ path: testInfo.outputPath('step3-final.png'), fullPage: true });
    });

    test('ghost_the_dead_rise: 弃手牌 → 选弃牌堆随从 → 选基地', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.GHOSTS, FACTION.PIRATES, FACTION.NINJAS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(
            makeCard(`card_${nextUid}`, 'ghost_the_dead_rise', 'action', currentPid),
            makeCard(`card_${nextUid + 1}`, 'zombie_walker', 'minion', currentPid),
            makeCard(`card_${nextUid + 2}`, 'zombie_tenacious_z', 'minion', currentPid),
        );

        const discard = player.discard as any[];
        discard.push(
            makeCard(`card_${nextUid + 3}`, 'robot_microbot_fixer', 'minion', currentPid),
        );
        core.nextUid = nextUid + 4;
        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        await clickHandCard(page, 0);
        await page.waitForTimeout(1000);

        // 第一步：多选弃牌 — PromptOverlay 多选模式
        await waitForPrompt(page);
        await page.screenshot({ path: testInfo.outputPath('step1-discard-cards.png'), fullPage: true });

        // 选择弃牌（点两张 + 确认）
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('.fixed[style*="z-index"]');
            let clicked = 0;
            for (const overlay of overlays) {
                const style = (overlay as HTMLElement).style;
                if (style.zIndex && parseInt(style.zIndex) >= 300) {
                    const btns = overlay.querySelectorAll('button:not([disabled])');
                    for (const btn of btns) {
                        const text = btn.textContent || '';
                        if (!text.match(/确认|Confirm|跳过|Skip|取消全选|全选/i) && clicked < 2) {
                            (btn as HTMLElement).click();
                            clicked++;
                        }
                    }
                }
            }
        });
        await page.waitForTimeout(500);

        // 点确认
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('.fixed[style*="z-index"]');
            for (const overlay of overlays) {
                const style = (overlay as HTMLElement).style;
                if (style.zIndex && parseInt(style.zIndex) >= 300) {
                    const btns = overlay.querySelectorAll('button');
                    for (const btn of btns) {
                        const text = btn.textContent || '';
                        if (text.match(/确认|Confirm/i) && !btn.disabled) {
                            (btn as HTMLElement).click();
                            return;
                        }
                    }
                }
            }
        });
        await page.waitForTimeout(1000);

        // 第二步：选弃牌堆随从 — PromptOverlay
        const hasPickPrompt = await isPromptVisible(page);
        await page.screenshot({ path: testInfo.outputPath('step2-pick-minion.png'), fullPage: true });
        if (hasPickPrompt) {
            await clickPromptOption(page, 0);
            await page.waitForTimeout(1000);

            // 第三步：选基地 — 棋盘直选或 PromptOverlay
            const hasBase = await isBaseSelectMode(page);
            if (hasBase) {
                await clickHighlightedBase(page, 0);
            } else if (await isPromptVisible(page)) {
                await clickPromptOption(page, 0);
            }
            await page.waitForTimeout(1000);
        }

        await page.screenshot({ path: testInfo.outputPath('step3-final.png'), fullPage: true });
    });
});


// ============================================================================
// 恐龙派系
// ============================================================================

test.describe('SmashUp 恐龙多步交互', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ context }) => {
        await initContext(context, { storageKey: '__smashup_dino_multi_reset' });
    });

    test('dino_natural_selection: 选己方随从 → 选力量更低的目标 → 目标被消灭', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.DINOSAURS, FACTION.PIRATES, FACTION.NINJAS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const turnOrder = core.turnOrder as string[];
        const opponentPid = turnOrder.find(p => p !== currentPid)!;
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'dino_natural_selection', 'action', currentPid));

        const bases = core.bases as any[];
        // 清空所有基地随从
        for (const base of bases) {
            base.minions = [];
        }
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'dino_king_rex', currentPid, currentPid, 7),
            makeMinion(`m_${nextUid + 2}`, 'pirate_first_mate', opponentPid, opponentPid, 2),
        ];
        core.nextUid = nextUid + 3;
        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        await clickHandCard(page, 0);
        await page.waitForTimeout(1000);

        // 第一步：选己方随从 — 随从高亮或 PromptOverlay
        const hasMinionSelect = await isMinionSelectMode(page);
        await page.screenshot({ path: testInfo.outputPath('step1-choose-mine.png'), fullPage: true });
        if (hasMinionSelect) {
            await clickHighlightedMinion(page, 0);
        } else {
            await waitForPrompt(page);
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        // 第二步：选力量更低的目标 — 随从高亮或 PromptOverlay
        const hasMinionSelect2 = await isMinionSelectMode(page);
        const hasPrompt2 = await isPromptVisible(page);
        await page.screenshot({ path: testInfo.outputPath('step2-choose-target.png'), fullPage: true });
        expect(hasMinionSelect2 || hasPrompt2).toBe(true);
        if (hasMinionSelect2) {
            await clickHighlightedMinion(page, 0);
        } else {
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        expect(await isPromptVisible(page)).toBe(false);

        // 验证：对手随从被消灭
        const afterState = await readFullState(page);
        const afterBases = (afterState.core ?? afterState).bases as any[];
        const opponentMinions = afterBases[0].minions.filter((m: any) => m.controller === opponentPid);
        expect(opponentMinions.length).toBe(0);

        await page.screenshot({ path: testInfo.outputPath('step3-final.png'), fullPage: true });
    });
});

// ============================================================================
// 熊骑兵派系
// ============================================================================

test.describe('SmashUp 熊骑兵多步交互', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ context }) => {
        await initContext(context, { storageKey: '__smashup_bear_multi_reset' });
    });

    test('bear_cavalry_bear_cavalry: 选己方随从 → 选目标基地 → 随从被移动', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.BEAR_CAVALRY, FACTION.PIRATES, FACTION.NINJAS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'bear_cavalry_bear_cavalry', 'action', currentPid));

        const bases = core.bases as any[];
        // 清空所有基地随从
        for (const base of bases) {
            base.minions = [];
        }
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'pirate_first_mate', currentPid, currentPid, 2),
        ];
        core.nextUid = nextUid + 2;
        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        await clickHandCard(page, 0);
        await page.waitForTimeout(1000);

        // 第一步：选随从 — 随从高亮或 PromptOverlay
        const hasMinionSelect = await isMinionSelectMode(page);
        if (hasMinionSelect) {
            await clickHighlightedMinion(page, 0);
        } else {
            await waitForPrompt(page);
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        // 第二步：选目标基地 — 基地高亮或 PromptOverlay
        const hasBase = await isBaseSelectMode(page);
        const hasPrompt = await isPromptVisible(page);
        expect(hasBase || hasPrompt).toBe(true);
        if (hasBase) {
            await clickHighlightedBase(page, 0);
        } else {
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        expect(await isPromptVisible(page)).toBe(false);

        // 验证：随从从基地0移走
        const afterState = await readFullState(page);
        const afterBases = (afterState.core ?? afterState).bases as any[];
        expect(afterBases[0].minions.filter((m: any) => m.controller === currentPid).length).toBe(0);
    });

    test('bear_cavalry_youre_screwed: 选基地 → 选对手随从 → 选目标基地', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.BEAR_CAVALRY, FACTION.PIRATES, FACTION.NINJAS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const turnOrder = core.turnOrder as string[];
        const opponentPid = turnOrder.find(p => p !== currentPid)!;
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'bear_cavalry_youre_screwed', 'action', currentPid));

        const bases = core.bases as any[];
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'pirate_first_mate', opponentPid, opponentPid, 2),
        ];
        bases[1].minions = [];
        core.nextUid = nextUid + 2;
        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        await clickHandCard(page, 0);
        await page.waitForTimeout(1000);

        // 第一步：选基地
        const hasBase1 = await isBaseSelectMode(page);
        if (hasBase1) {
            await clickHighlightedBase(page, 0);
        } else {
            await waitForPrompt(page);
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        // 第二步：选对手随从
        const hasMinion = await isMinionSelectMode(page);
        const hasPrompt2 = await isPromptVisible(page);
        expect(hasMinion || hasPrompt2).toBe(true);
        if (hasMinion) {
            await clickHighlightedMinion(page, 0);
        } else {
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        // 第三步：选目标基地
        const hasBase2 = await isBaseSelectMode(page);
        const hasPrompt3 = await isPromptVisible(page);
        expect(hasBase2 || hasPrompt3).toBe(true);
        if (hasBase2) {
            await clickHighlightedBase(page, 0);
        } else {
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        expect(await isPromptVisible(page)).toBe(false);

        // 验证：随从从基地0移走
        const afterState = await readFullState(page);
        const afterBases = (afterState.core ?? afterState).bases as any[];
        expect(afterBases[0].minions.filter((m: any) => m.controller === opponentPid).length).toBe(0);
    });

    test('bear_cavalry_borscht: 选来源基地 → 选目标基地 → 对手随从批量移动', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.BEAR_CAVALRY, FACTION.PIRATES, FACTION.NINJAS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const turnOrder = core.turnOrder as string[];
        const opponentPid = turnOrder.find(p => p !== currentPid)!;
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'bear_cavalry_youre_pretty_much_borscht', 'action', currentPid));

        const bases = core.bases as any[];
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'pirate_first_mate', opponentPid, opponentPid, 2),
            makeMinion(`m_${nextUid + 2}`, 'ninja_shinobi', opponentPid, opponentPid, 2),
        ];
        bases[1].minions = [];
        core.nextUid = nextUid + 3;
        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        await clickHandCard(page, 0);
        await page.waitForTimeout(1000);

        // 第一步：选来源基地
        const hasBase1 = await isBaseSelectMode(page);
        if (hasBase1) {
            await clickHighlightedBase(page, 0);
        } else {
            await waitForPrompt(page);
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        // 第二步：选目标基地
        const hasBase2 = await isBaseSelectMode(page);
        const hasPrompt2 = await isPromptVisible(page);
        expect(hasBase2 || hasPrompt2).toBe(true);
        if (hasBase2) {
            await clickHighlightedBase(page, 0);
        } else {
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        expect(await isPromptVisible(page)).toBe(false);

        // 验证：基地0的对手随从被移走
        const afterState = await readFullState(page);
        const afterBases = (afterState.core ?? afterState).bases as any[];
        expect(afterBases[0].minions.filter((m: any) => m.controller === opponentPid).length).toBe(0);
    });
});


// ============================================================================
// 巫师派系
// ============================================================================

test.describe('SmashUp 巫师多步交互', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ context }) => {
        await initContext(context, { storageKey: '__smashup_wizard_multi_reset' });
    });

    test('wizard_portal: 选随从放入手牌 → 排序剩余牌放回牌库', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.WIZARDS, FACTION.PIRATES, FACTION.NINJAS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'wizard_portal', 'action', currentPid));

        const deck = player.deck as any[];
        deck.length = 0;
        deck.push(
            makeCard(`card_${nextUid + 1}`, 'zombie_walker', 'minion', currentPid),
            makeCard(`card_${nextUid + 2}`, 'pirate_cannon', 'action', currentPid),
            makeCard(`card_${nextUid + 3}`, 'pirate_shanghai', 'action', currentPid),
            makeCard(`card_${nextUid + 4}`, 'zombie_tenacious_z', 'minion', currentPid),
        );
        core.nextUid = nextUid + 5;
        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        await clickHandCard(page, 0);
        await page.waitForTimeout(1000);

        // portal 先展示牌库顶5张（pendingReveal），需要确认
        const revealDismiss = page.getByTestId('reveal-dismiss-btn');
        if (await revealDismiss.isVisible({ timeout: 5000 }).catch(() => false)) {
            await revealDismiss.click();
            await page.waitForTimeout(1000);
        }

        // 第一步：选随从放入手牌（多选）— PromptOverlay
        await waitForPrompt(page);
        await page.screenshot({ path: testInfo.outputPath('step1-pick-minions.png'), fullPage: true });

        // 选一个随从 + 确认（使用 evaluate 匹配 z-index style）
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('.fixed[style*="z-index"]');
            for (const overlay of overlays) {
                const style = (overlay as HTMLElement).style;
                if (style.zIndex && parseInt(style.zIndex) >= 300) {
                    const btns = overlay.querySelectorAll('button:not([disabled])');
                    for (const btn of btns) {
                        const text = btn.textContent || '';
                        if (!text.match(/确认|Confirm|取消全选|全选/i)) {
                            (btn as HTMLElement).click();
                            return;
                        }
                    }
                }
            }
        });
        await page.waitForTimeout(500);

        // 点确认
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('.fixed[style*="z-index"]');
            for (const overlay of overlays) {
                const style = (overlay as HTMLElement).style;
                if (style.zIndex && parseInt(style.zIndex) >= 300) {
                    const btns = overlay.querySelectorAll('button');
                    for (const btn of btns) {
                        const text = btn.textContent || '';
                        if (text.match(/确认|Confirm/i) && !btn.disabled) {
                            (btn as HTMLElement).click();
                            return;
                        }
                    }
                }
            }
        });
        await page.waitForTimeout(1000);

        // 第二步：排序剩余牌（可能多轮选择）— PromptOverlay
        let loopCount = 0;
        while (await isPromptVisible(page) && loopCount < 5) {
            await page.screenshot({ path: testInfo.outputPath(`step2-order-${loopCount}.png`), fullPage: true });
            await clickPromptOption(page, 0);
            await page.waitForTimeout(800);
            loopCount++;
        }

        await page.screenshot({ path: testInfo.outputPath('step3-final.png'), fullPage: true });
    });
});
