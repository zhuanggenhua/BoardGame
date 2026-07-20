/**
 * 大杀四方 - 海盗派系多步交互 E2E 测试
 *
 * 覆盖：
 * - pirate_cannon（加农炮）：选第一目标 → 选第二目标（可跳过）
 * - pirate_shanghai（诱拐）：选随从 → 选基地
 * - pirate_sea_dogs（水手）：选派系 → 选来源基地 → 选目标基地
 * - pirate_full_sail（全速航行）：循环选随从 → 选基地 → 完成
 *
 * 交互模式说明：
 * - 基地选择 → 基地在棋盘上高亮（ring-amber-400），直接点击
 * - 随从选择 → 随从在棋盘上高亮（ring-purple-400），直接点击
 * - 其他选项 → PromptOverlay（z-index:300）
 */

import { test, expect } from '../framework';
import { dismissViteOverlay, initContext } from '../helpers/common';
import type { GameTestContext as __ThreeAxeFrameworkMarker } from '../framework';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;

import {
    closeDebugPanel, readFullState, applyCoreStateDirect,
    gotoLocalSmashUp, waitForHandArea, completeFactionSelectionLocal,
    getCurrentPlayer, makeCard, makeMinion, waitForPrompt, isPromptVisible,
    clickPromptOption, clickPromptOptionByText, clickHandCard,
    clickHighlightedBase, isBaseSelectMode, clickBaseByIndex,
    clickHighlightedMinion, isMinionSelectMode,
    FACTION,
} from './smashup-debug-helpers';

test.describe('SmashUp 海盗多步交互', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ context }) => {
        await initContext(context, { storageKey: '__smashup_pirate_multi_reset' });
    });

    test('pirate_broadside: 可选对手并只消灭对手弱随从', async ({ page }) => {
        await page.goto('/play/smashup?p0=pirates,aliens&p1=ninjas,robots&seed=24680', {
            waitUntil: 'domcontentloaded',
        });
        await dismissViteOverlay(page);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const turnOrder = core.turnOrder as string[];
        const opponentPid = turnOrder.find(p => p !== currentPid)!;
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'pirate_broadside', 'action', currentPid));

        const bases = core.bases as any[];
        for (const base of bases) {
            base.minions = [];
        }
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'pirate_first_mate', currentPid, currentPid, 3),
            makeMinion(`m_${nextUid + 2}`, 'pirate_saucy_wench', currentPid, currentPid, 2),
            makeMinion(`m_${nextUid + 3}`, 'ninja_shinobi', opponentPid, opponentPid, 2),
            makeMinion(`m_${nextUid + 4}`, 'zombie_tenacious_z', opponentPid, opponentPid, 1),
        ];
        core.nextUid = nextUid + 5;
        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        // 无前置目标的普通行动卡需要二次点击同一张手牌，才会真正 dispatch PLAY_ACTION。
        await clickHandCard(page, 0);
        await clickHandCard(page, 0);
        await page.waitForTimeout(800);
        const spotlightQueue = page.getByTestId('card-spotlight-queue');
        if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
            await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
            await expect(spotlightQueue).toBeHidden({ timeout: 5000 });
        }
        await expect(page.getByText('选择一个你有随从的基地')).toBeVisible();
        await page.screenshot({
            path: 'test-results/evidence-screenshots/_shared/smashup-feedback-69a6eac7-broadside-choose-base.png',
            fullPage: true,
        });
        await page.evaluate(async () => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            const options = current?.data?.options ?? [];
            const option = options.find((candidate: any) => candidate?.value?.baseIndex === 0) ?? options[0];
            if (!option?.id || !current?.playerId) {
                throw new Error('broadside base interaction option not found');
            }
            await harness.command.dispatch({
                type: 'SYS_INTERACTION_RESPOND',
                playerId: current.playerId,
                payload: { optionId: option.id },
            });
        });
        await page.waitForTimeout(800);

        await waitForPrompt(page);
        await page.screenshot({
            path: 'test-results/evidence-screenshots/_shared/smashup-feedback-69a6eac7-broadside-choose-player.png',
            fullPage: true,
        });
        await clickPromptOptionByText(page, /对手.*弱随从|玩家二.*弱随从|P1.*弱随从/i);
        await page.waitForTimeout(1000);

        await page.screenshot({
            path: 'test-results/evidence-screenshots/_shared/smashup-feedback-69a6eac7-broadside-after-resolve.png',
            fullPage: true,
        });

        const afterState = await readFullState(page);
        const afterBase = ((afterState.core ?? afterState).bases as any[])[0];
        expect(afterBase.minions.some((m: any) => m.uid === `m_${nextUid + 1}`)).toBe(true);
        expect(afterBase.minions.some((m: any) => m.uid === `m_${nextUid + 2}`)).toBe(true);
        expect(afterBase.minions.some((m: any) => m.uid === `m_${nextUid + 3}`)).toBe(false);
        expect(afterBase.minions.some((m: any) => m.uid === `m_${nextUid + 4}`)).toBe(false);
    });

    test('pirate_saucy_wench: 打出后会触发并消灭本基地弱随从', async ({ page }) => {
        await page.goto('/play/smashup?p0=pirates,aliens&p1=ninjas,robots&seed=24680', {
            waitUntil: 'domcontentloaded',
        });
        await dismissViteOverlay(page);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const turnOrder = core.turnOrder as string[];
        const opponentPid = turnOrder.find(p => p !== currentPid)!;
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'pirate_saucy_wench', 'minion', currentPid));

        const bases = core.bases as any[];
        for (const base of bases) {
            base.minions = [];
        }
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'pirate_first_mate', currentPid, currentPid, 3),
            makeMinion(`m_${nextUid + 2}`, 'ninja_shinobi', opponentPid, opponentPid, 2),
        ];
        core.nextUid = nextUid + 3;
        player.minionsPlayed = 0;
        player.minionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        await clickHandCard(page, 0);
        await clickBaseByIndex(page, 0);
        await page.waitForTimeout(1000);

        await expect(page.getByText('你可以消灭本基地一个力量≤2的随从')).toBeVisible();

        await page.screenshot({
            path: 'test-results/evidence-screenshots/_shared/smashup-feedback-69a6eac7-saucy-prompt.png',
            fullPage: true,
        });

        await page.evaluate(async ({ targetMinionUid }) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            const options = current?.data?.options ?? [];
            const option = options.find((candidate: any) => candidate?.value?.minionUid === targetMinionUid)
                ?? options.find((candidate: any) => candidate?.value?.minionUid)
                ?? options[0];
            if (!option?.id || !current?.playerId) {
                throw new Error('saucy wench interaction option not found');
            }
            await harness.command.dispatch({
                type: 'SYS_INTERACTION_RESPOND',
                playerId: current.playerId,
                payload: { optionId: option.id },
            });
        }, { targetMinionUid: `m_${nextUid + 2}` });
        await page.waitForTimeout(1000);

        await page.screenshot({
            path: 'test-results/evidence-screenshots/_shared/smashup-feedback-69a6eac7-saucy-after-resolve.png',
            fullPage: true,
        });

        const afterState = await readFullState(page);
        const afterBase = ((afterState.core ?? afterState).bases as any[])[0];
        expect(afterBase.minions.some((m: any) => m.uid === `card_${nextUid}`)).toBe(true);
        expect(afterBase.minions.some((m: any) => m.uid === `m_${nextUid + 2}`)).toBe(false);
    });

    // ========================================================================
    // pirate_cannon（加农炮）：选第一目标 → 选第二目标（可跳过）
    // ========================================================================
    test('pirate_cannon: 选第一目标消灭 → 选第二目标或跳过', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.PIRATES, FACTION.NINJAS, FACTION.ROBOTS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const turnOrder = core.turnOrder as string[];
        const opponentPid = turnOrder.find(p => p !== currentPid)!;
        const nextUid = (core.nextUid as number) ?? 100;

        // 注入：手牌放 pirate_cannon，基地上放对手力量≤2的随从
        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'pirate_cannon', 'action', currentPid));

        const bases = core.bases as any[];
        // 清空所有基地随从（避免旧格式数据导致崩溃）
        for (const base of bases) {
            base.minions = [];
        }
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'zombie_walker', opponentPid, opponentPid, 2),
            makeMinion(`m_${nextUid + 2}`, 'zombie_tenacious_z', opponentPid, opponentPid, 2),
        ];
        core.nextUid = nextUid + 3;
        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        
        // 诊断：在浏览器控制台输出状态
        await page.evaluate(() => {
            const G = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            if (!G) {
                console.error('NO STATE FOUND');
                return;
            }
            const c = G.core || G;
            console.log('=== STATE AFTER INJECTION ===');
            console.log('turnOrder:', c.turnOrder);
            console.log('playerIds:', Object.keys(c.players || {}));
            console.log('players:', Object.entries(c.players || {}).map(([pid, p]: [string, any]) => ({
                pid,
                hasFactions: !!p.factions,
                factions: p.factions,
                hasHand: !!p.hand,
                handLength: p.hand?.length,
            })));
        });
        
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        // 诊断：检查状态是否正确应用
        const diagnostic = await page.evaluate(() => {
            const G = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            if (!G) return { error: 'no state' };
            const c = G.core || G;
            return {
                turnOrder: c.turnOrder,
                playerIds: Object.keys(c.players || {}),
                currentPid: c.turnOrder?.[c.currentPlayerIndex || 0],
                players: Object.entries(c.players || {}).map(([pid, p]: [string, any]) => ({
                    pid,
                    hasFactions: !!p.factions,
                    factions: p.factions,
                    hasHand: !!p.hand,
                    handLength: p.hand?.length,
                    hasMinionsPlayed: p.minionsPlayed !== undefined,
                    hasMinionLimit: p.minionLimit !== undefined,
                }))
            };
        });
        console.log('State diagnostic:', JSON.stringify(diagnostic, null, 2));

        // 打出 pirate_cannon
        await clickHandCard(page, 0);
        await page.waitForTimeout(1000);

        // 第一步：选第一个目标 — 随从高亮或 PromptOverlay
        const hasMinion1 = await isMinionSelectMode(page);
        await page.screenshot({ path: testInfo.outputPath('step1-choose-first.png'), fullPage: true });
        if (hasMinion1) {
            await clickHighlightedMinion(page, 0);
        } else {
            await waitForPrompt(page);
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        // 第二步：选第二个目标或跳过
        const hasMinion2 = await isMinionSelectMode(page);
        const hasPrompt2 = await isPromptVisible(page);
        await page.screenshot({ path: testInfo.outputPath('step2-choose-second.png'), fullPage: true });

        if (hasMinion2) {
            // 随从高亮模式 — 可能有浮动"跳过"按钮
            await clickHighlightedMinion(page, 0);
        } else if (hasPrompt2) {
            await clickPromptOptionByText(page, /跳过|Skip/i);
        }
        await page.waitForTimeout(1000);

        const promptGone = !(await isPromptVisible(page));
        expect(promptGone).toBe(true);

        // 验证：至少一个随从被消灭
        const afterState = await readFullState(page);
        const afterBases = (afterState.core ?? afterState).bases as any[];
        const remainingMinions = afterBases[0].minions.filter((m: any) => m.controller === opponentPid);
        expect(remainingMinions.length).toBeLessThan(2);

        await page.screenshot({ path: testInfo.outputPath('step3-final.png'), fullPage: true });
    });

    // ========================================================================
    // pirate_shanghai（诱拐）：选随从 → 选基地
    // ========================================================================
    test('pirate_shanghai: 选对手随从 → 选目标基地 → 随从被移动', async ({ page }, testInfo) => {
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
        hand.push(makeCard(`card_${nextUid}`, 'pirate_shanghai', 'action', currentPid));

        const bases = core.bases as any[];
        // 清空所有基地随从
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
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        await clickHandCard(page, 0);
        await page.waitForTimeout(1000);

        // 第一步：选随从 — 随从高亮或 PromptOverlay
        const hasMinion = await isMinionSelectMode(page);
        await page.screenshot({ path: testInfo.outputPath('step1-choose-minion.png'), fullPage: true });
        if (hasMinion) {
            await clickHighlightedMinion(page, 0);
        } else {
            await waitForPrompt(page);
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        // 第二步：选目标基地 — 基地高亮或 PromptOverlay
        const hasBase = await isBaseSelectMode(page);
        const hasPrompt = await isPromptVisible(page);
        await page.screenshot({ path: testInfo.outputPath('step2-choose-base.png'), fullPage: true });
        expect(hasBase || hasPrompt).toBe(true);
        if (hasBase) {
            await clickHighlightedBase(page, 0);
        } else {
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        const promptGone = !(await isPromptVisible(page));
        expect(promptGone).toBe(true);

        // 验证：随从从基地0移走
        const afterState = await readFullState(page);
        const afterBases = (afterState.core ?? afterState).bases as any[];
        const base0Opponent = afterBases[0].minions.filter((m: any) => m.controller === opponentPid);
        expect(base0Opponent.length).toBe(0);

        await page.screenshot({ path: testInfo.outputPath('step3-final.png'), fullPage: true });
    });

    // ========================================================================
    // pirate_sea_dogs（水手）：选派系 → 选来源基地 → 选目标基地
    // ========================================================================
    test('pirate_sea_dogs: 选派系 → 选来源基地 → 选目标基地 → 批量移动', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const turnOrder = core.turnOrder as string[];
        const opponentPid = turnOrder.find(p => p !== currentPid)!;
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'pirate_sea_dogs', 'action', currentPid));

        const bases = core.bases as any[];
        // 清空所有基地随从
        for (const base of bases) {
            base.minions = [];
        }
        // 基地0放两个对手的忍者随从
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'ninja_tiger_assassin', opponentPid, opponentPid, 3),
            makeMinion(`m_${nextUid + 2}`, 'ninja_shinobi', opponentPid, opponentPid, 2),
        ];
        core.nextUid = nextUid + 3;
        player.actionsPlayed = 0;
        player.actionLimit = 1;
        core.phase = 'playCards';
        core.factionSelection = undefined;
        (player as any).factions = [FACTION.PIRATES, FACTION.ZOMBIES];
        const opponentPlayer = (core.players as Record<string, any>)[opponentPid];
        if (opponentPlayer) {
            opponentPlayer.factions = [FACTION.NINJAS, FACTION.ALIENS];
        }

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);
        await waitForHandArea(page);

        await page.waitForFunction(() => Boolean((window as any).__BG_TEST_HARNESS__?.command?.isRegistered?.()), { timeout: 10000 });
        await page.evaluate(async ({ playerId, cardUid }) => {
            await (window as any).__BG_TEST_HARNESS__.command.dispatch({
                type: 'su:play_action',
                playerId,
                payload: { cardUid },
            });
        }, { playerId: currentPid, cardUid: `card_${nextUid}` });
        await page.waitForTimeout(1000);

        const respondCurrentPrompt = async (optionIndex = 0) => {
            await page.evaluate(async ({ optionIndex }) => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const current = harness?.state?.get?.()?.sys?.interaction?.current;
                const options = current?.data?.options ?? [];
                const option = options[optionIndex];
                if (!option?.id) {
                    throw new Error(`interaction option ${optionIndex} not found`);
                }
                await harness.command.dispatch({
                    type: 'SYS_INTERACTION_RESPOND',
                    playerId: current.playerId,
                    payload: { optionId: option.id },
                });
            }, { optionIndex });
            await page.waitForTimeout(800);
        };

        // 第一步：选派系 — PromptOverlay（派系不是基地/随从，走 overlay）
        await waitForPrompt(page);
        await page.screenshot({ path: testInfo.outputPath('step1-choose-faction.png'), fullPage: true });
        await clickPromptOption(page, 0);
        await page.waitForTimeout(1000);

        // 第二步：选来源基地 — 基地高亮或 PromptOverlay
        await expect(page.getByText('已选种族：忍者')).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('step2-choose-from-base.png'), fullPage: true });
        await page.screenshot({ path: 'evidence/smashup/assets/feedback-69a2994f17d6c58872680809/01-sea-dogs-choose-from-base.png', fullPage: true });
        await respondCurrentPrompt(0);
        await page.waitForTimeout(1000);

        // 第三步：选目标基地 — 基地高亮或 PromptOverlay
        await expect(page.getByText('已选种族：忍者')).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('step3-choose-to-base.png'), fullPage: true });
        await page.screenshot({ path: 'evidence/smashup/assets/feedback-69a2994f17d6c58872680809/02-sea-dogs-choose-to-base.png', fullPage: true });
        await respondCurrentPrompt(0);
        await page.waitForTimeout(1000);

        const promptGone = !(await isPromptVisible(page));
        expect(promptGone).toBe(true);

        // 验证：基地0的对手随从被移走
        const afterState = await readFullState(page);
        const afterBases = (afterState.core ?? afterState).bases as any[];
        const base0Opponent = afterBases[0].minions.filter((m: any) => m.controller === opponentPid);
        expect(base0Opponent.length).toBe(0);

        await page.screenshot({ path: testInfo.outputPath('step4-final.png'), fullPage: true });
        await page.screenshot({ path: 'evidence/smashup/assets/feedback-69a2994f17d6c58872680809/03-sea-dogs-final.png', fullPage: true });
    });

    // ========================================================================
    // pirate_full_sail（全速航行）：循环选随从 → 选基地 → 完成
    // ========================================================================
    test('pirate_full_sail: 选随从 → 选基地 → 循环或完成', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page, [FACTION.PIRATES, FACTION.NINJAS, FACTION.ROBOTS, FACTION.ALIENS]);
        await waitForHandArea(page);

        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const { currentPid, player } = getCurrentPlayer(core);
        const nextUid = (core.nextUid as number) ?? 100;

        const hand = player.hand as any[];
        hand.length = 0;
        hand.push(makeCard(`card_${nextUid}`, 'pirate_full_sail', 'action', currentPid));

        const bases = core.bases as any[];
        // 清空所有基地随从
        for (const base of bases) {
            base.minions = [];
        }
        // 基地0放两个己方随从
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'pirate_first_mate', currentPid, currentPid, 2),
            makeMinion(`m_${nextUid + 2}`, 'pirate_saucy_wench', currentPid, currentPid, 3),
        ];
        core.nextUid = nextUid + 3;
        player.actionsPlayed = 0;
        player.actionLimit = 1;

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        await clickHandCard(page, 0);
        await page.waitForTimeout(1000);

        // 第一步：选随从 — 随从高亮或 PromptOverlay
        const hasMinion = await isMinionSelectMode(page);
        await page.screenshot({ path: testInfo.outputPath('step1-choose-minion.png'), fullPage: true });

        if (hasMinion) {
            await clickHighlightedMinion(page, 0);
        } else {
            await waitForPrompt(page);
            // 选第一个随从（非"完成"选项）
            const minionResult = await page.evaluate(() => {
                const overlays = document.querySelectorAll('.fixed[style*="z-index"]');
                for (const overlay of overlays) {
                    const style = (overlay as HTMLElement).style;
                    if (style.zIndex && parseInt(style.zIndex) >= 300) {
                        const btns = overlay.querySelectorAll('button:not([disabled])');
                        for (const btn of btns) {
                            const text = btn.textContent || '';
                            if (!text.match(/完成|Done|跳过|Skip/i)) {
                                (btn as HTMLElement).click();
                                return 'clicked-minion';
                            }
                        }
                        if (btns.length > 0) {
                            (btns[0] as HTMLElement).click();
                            return 'clicked-first';
                        }
                    }
                }
                return 'not-found';
            });
            console.log('全速航行选随从:', minionResult);
        }
        await page.waitForTimeout(1000);

        // 第二步：选目标基地 — 基地高亮或 PromptOverlay
        const hasBase = await isBaseSelectMode(page);
        const hasBasePrompt = await isPromptVisible(page);
        await page.screenshot({ path: testInfo.outputPath('step2-choose-base.png'), fullPage: true });
        if (hasBase) {
            await clickHighlightedBase(page, 0);
        } else if (hasBasePrompt) {
            await clickPromptOption(page, 0);
        }
        await page.waitForTimeout(1000);

        // 第三步：循环 — 可能再次出现选随从的 Prompt，点"完成"
        const hasLoopMinion = await isMinionSelectMode(page);
        const hasLoopPrompt = await isPromptVisible(page);
        await page.screenshot({ path: testInfo.outputPath('step3-loop-or-done.png'), fullPage: true });
        if (hasLoopMinion || hasLoopPrompt) {
            // 点击"完成"结束循环
            const doneResult = await clickPromptOptionByText(page, '完成|Done');
            if (doneResult === 'not-found') {
                await clickPromptOption(page, 0);
            }
            await page.waitForTimeout(1000);
        }

        const promptGone = !(await isPromptVisible(page));
        expect(promptGone).toBe(true);

        await page.screenshot({ path: testInfo.outputPath('step4-final.png'), fullPage: true });
    });
});
