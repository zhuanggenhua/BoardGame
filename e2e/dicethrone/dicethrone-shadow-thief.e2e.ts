/**
 * 暗影刺客 (Shadow Thief) E2E 交互测试
 *
 * 覆盖交互面：
 * - 角色选择 + 基础攻击流程
 * - Sneak 免伤触发
 * - 双防御技能选择
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { TOKEN_IDS } from '../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../src/games/dicethrone/domain/resources';
import {
    setupOnlineMatch,
    advanceToOffensiveRoll,
    applyDiceValues,
    getPlayerIdFromUrl,
    readCoreState,
    applyCoreStateDirect,
    maybePassResponse,
    getModalContainerByHeading,
} from '../helpers/dicethrone';

test.describe('DiceThrone Shadow Thief E2E', () => {

    test('Online match: Shadow Thief Steal CP ability (with and without Shadow)', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) test.skip(true, '游戏服务器不可用或房间创建失败');
        const { hostPage, guestPage, hostContext, guestContext, autoStarted } = match!;

        try {
            if (autoStarted) test.skip(true, '游戏自动开始，无法选择暗影刺客角色');

            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 3000 }).catch(() => false);
            if (!hostIsActive) test.skip(true, '非预期起始玩家，无法构造偷窃场景');

            const attackerPage = hostPage;
            const defenderId = getPlayerIdFromUrl(guestPage, '1');
            const attackerId = getPlayerIdFromUrl(hostPage, '0');

            // 场景1：无 Shadow，只从银行获得 CP
            await advanceToOffensiveRoll(attackerPage);
            const rollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await attackerPage.waitForTimeout(300);

            // 设置骰子为 2 个 Bag (value 3, 4)，无 Shadow
            await applyDiceValues(attackerPage, [3, 4, 1, 2, 5]);

            const confirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();

            // 读取初始 CP
            const coreStateBefore = await readCoreState(attackerPage) as Record<string, unknown>;
            const playersBefore = coreStateBefore?.players as Record<string, Record<string, unknown>> | undefined;
            const attackerBefore = playersBefore?.[attackerId];
            const defenderBefore = playersBefore?.[defenderId];
            const attackerCpBefore = (attackerBefore?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;
            const defenderCpBefore = (defenderBefore?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;

            // 选择偷窃技能（steal-2）
            const stealAbility = attackerPage.locator('[data-ability-slot]')
                .filter({ has: attackerPage.locator('div.animate-pulse[class*="border-"]') })
                .filter({ hasText: /Steal|偷窃/ });
            
            if (await stealAbility.first().isVisible({ timeout: 5000 }).catch(() => false)) {
                await stealAbility.first().click();
                
                const resolveAttackButton = attackerPage.getByRole('button', { name: /Resolve Attack|结算攻击/i });
                await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
                await resolveAttackButton.click();

                // 等待技能执行完成
                await attackerPage.waitForTimeout(1000);

                // 验证：攻击者获得 2 CP，防御者 CP 不变（无 Shadow）
                const coreStateAfter1 = await readCoreState(attackerPage) as Record<string, unknown>;
                const playersAfter1 = coreStateAfter1?.players as Record<string, Record<string, unknown>> | undefined;
                const attackerAfter1 = playersAfter1?.[attackerId];
                const defenderAfter1 = playersAfter1?.[defenderId];
                const attackerCpAfter1 = (attackerAfter1?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;
                const defenderCpAfter1 = (defenderAfter1?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;

                expect(attackerCpAfter1).toBe(attackerCpBefore + 2); // 从银行获得 2 CP
                expect(defenderCpAfter1).toBe(defenderCpBefore); // 对手 CP 不变

                await attackerPage.screenshot({ path: testInfo.outputPath('shadow-thief-steal-no-shadow.png'), fullPage: false });
            }

            // 跳过防御阶段和后续阶段，进入下一回合
            for (let i = 0; i < 4; i++) {
                const hp = await maybePassResponse(hostPage);
                const gp = await maybePassResponse(guestPage);
                if (!hp && !gp) break;
            }

            // 等待回到主要阶段
            await expect(attackerPage.getByText(/Main Phase|主要阶段/)).toBeVisible({ timeout: 15000 });

            // 推进到下一回合的攻击阶段
            const advanceButton = attackerPage.locator('[data-tutorial-id="advance-phase-button"]');
            await advanceButton.click(); // main2
            await attackerPage.waitForTimeout(500);
            await advanceButton.click(); // discard
            await attackerPage.waitForTimeout(500);
            await advanceButton.click(); // income
            await attackerPage.waitForTimeout(500);
            await advanceButton.click(); // main1
            await attackerPage.waitForTimeout(500);
            await advanceButton.click(); // offensiveRoll
            await attackerPage.waitForTimeout(500);

            // 场景2：有 Shadow，从对手偷取 CP
            const rollButton2 = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton2).toBeEnabled({ timeout: 5000 });
            await rollButton2.click();
            await attackerPage.waitForTimeout(300);

            // 设置骰子为 2 个 Bag + 1 个 Shadow (value 3, 4, 6)
            await applyDiceValues(attackerPage, [3, 4, 6, 1, 2]);

            const confirmButton2 = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton2).toBeEnabled({ timeout: 5000 });
            await confirmButton2.click();

            // 读取第二次攻击前的 CP
            const coreStateBefore2 = await readCoreState(attackerPage) as Record<string, unknown>;
            const playersBefore2 = coreStateBefore2?.players as Record<string, Record<string, unknown>> | undefined;
            const attackerBefore2 = playersBefore2?.[attackerId];
            const defenderBefore2 = playersBefore2?.[defenderId];
            const attackerCpBefore2 = (attackerBefore2?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;
            const defenderCpBefore2 = (defenderBefore2?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;

            // 选择偷窃技能
            const stealAbility2 = attackerPage.locator('[data-ability-slot]')
                .filter({ has: attackerPage.locator('div.animate-pulse[class*="border-"]') })
                .filter({ hasText: /Steal|偷窃/ });
            
            if (await stealAbility2.first().isVisible({ timeout: 5000 }).catch(() => false)) {
                await stealAbility2.first().click();
                
                const resolveAttackButton2 = attackerPage.getByRole('button', { name: /Resolve Attack|结算攻击/i });
                await expect(resolveAttackButton2).toBeVisible({ timeout: 10000 });
                await resolveAttackButton2.click();

                // 等待技能执行完成
                await attackerPage.waitForTimeout(1000);

                // 验证：攻击者获得 2 CP，防御者失去 2 CP（有 Shadow）
                const coreStateAfter2 = await readCoreState(attackerPage) as Record<string, unknown>;
                const playersAfter2 = coreStateAfter2?.players as Record<string, Record<string, unknown>> | undefined;
                const attackerAfter2 = playersAfter2?.[attackerId];
                const defenderAfter2 = playersAfter2?.[defenderId];
                const attackerCpAfter2 = (attackerAfter2?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;
                const defenderCpAfter2 = (defenderAfter2?.resources as Record<string, number>)?.[RESOURCE_IDS.CP] ?? 0;

                expect(attackerCpAfter2).toBe(attackerCpBefore2 + 2); // 获得 2 CP
                expect(defenderCpAfter2).toBe(Math.max(0, defenderCpBefore2 - 2)); // 失去最多 2 CP

                await attackerPage.screenshot({ path: testInfo.outputPath('shadow-thief-steal-with-shadow.png'), fullPage: false });
            }

        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('Online match: Shadow Thief character selection and basic attack flow', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'monk');
        if (!match) test.skip(true, '游戏服务器不可用或房间创建失败');
        const { hostPage, guestPage, hostContext, guestContext, autoStarted } = match!;

        try {
            if (autoStarted) test.skip(true, '游戏自动开始，无法选择暗影刺客角色');

            await hostPage.waitForTimeout(2000);
            const hostHandArea = hostPage.locator('[data-tutorial-id="hand-area"]');
            await expect(hostHandArea).toBeVisible();
            await expect(hostHandArea.locator('[data-card-id]')).toHaveCount(4, { timeout: 15000 });

            let attackerPage: Page;
            let defenderPage: Page;
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            if (await hostNextPhase.isEnabled({ timeout: 3000 }).catch(() => false)) {
                attackerPage = hostPage; defenderPage = guestPage;
            } else {
                attackerPage = guestPage; defenderPage = hostPage;
            }

            await advanceToOffensiveRoll(attackerPage);
            const rollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await attackerPage.waitForTimeout(300);
            await applyDiceValues(attackerPage, [1, 1, 1, 1, 1]);

            const confirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();

            const highlightedSlots = attackerPage
                .locator('[data-ability-slot]')
                .filter({ has: attackerPage.locator('div.animate-pulse[class*="border-"]') });
            const hasHighlight = await highlightedSlots.first().isVisible({ timeout: 5000 }).catch(() => false);

            if (hasHighlight) {
                await highlightedSlots.first().click();
                const resolveAttackButton = attackerPage.getByRole('button', { name: /Resolve Attack|结算攻击/i });
                await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
                await resolveAttackButton.click();
            } else {
                const advanceButton = attackerPage.locator('[data-tutorial-id="advance-phase-button"]');
                await advanceButton.click();
                const confirmHeading = attackerPage.getByRole('heading', { name: /End offensive roll\?|确认结束攻击掷骰？/i });
                if (await confirmHeading.isVisible({ timeout: 4000 }).catch(() => false)) {
                    await confirmHeading.locator('..').locator('..').getByRole('button', { name: /Confirm|确认/i }).click();
                }
            }

            for (let i = 0; i < 5; i++) {
                let choiceModal: ReturnType<typeof attackerPage.locator> | null = null;
                try { choiceModal = await getModalContainerByHeading(attackerPage, /Ability Resolution Choice|技能结算选择/i, 1500); } catch { choiceModal = null; }
                if (!choiceModal) break;
                const btn = choiceModal.getByRole('button').filter({ hasText: /\S+/ }).first();
                if (await btn.isVisible({ timeout: 500 }).catch(() => false)) { await btn.click(); await attackerPage.waitForTimeout(500); }
            }

            const defensePhaseStarted = await Promise.race([
                defenderPage.getByRole('button', { name: /End Defense|结束防御/i }).isVisible({ timeout: 8000 }).then(() => true).catch(() => false),
                attackerPage.getByText(/Main Phase \(2\)|主要阶段 \(2\)/).isVisible({ timeout: 8000 }).then(() => false).catch(() => false),
            ]);

            if (defensePhaseStarted) {
                const defRoll = defenderPage.locator('[data-tutorial-id="dice-roll-button"]');
                const defConfirm = defenderPage.locator('[data-tutorial-id="dice-confirm-button"]');
                const endDef = defenderPage.getByRole('button', { name: /End Defense|结束防御/i });
                if (await defRoll.isEnabled({ timeout: 5000 }).catch(() => false)) {
                    await defRoll.click(); await defenderPage.waitForTimeout(300); await defConfirm.click(); await endDef.click();
                } else if (await endDef.isEnabled({ timeout: 2000 }).catch(() => false)) {
                    await endDef.click();
                }
                for (let i = 0; i < 4; i++) {
                    const hp = await maybePassResponse(hostPage);
                    const gp = await maybePassResponse(guestPage);
                    if (!hp && !gp) break;
                }
            }

            await expect(attackerPage.getByText(/Main Phase \(2\)|主要阶段 \(2\)/)).toBeVisible({ timeout: 15000 });
            await attackerPage.screenshot({ path: testInfo.outputPath('shadow-thief-attack-flow.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });


    test('Online match: Shadow Thief Sneak prevents damage', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'shadow_thief');
        if (!match) test.skip(true, '游戏服务器不可用或房间创建失败');
        const { hostPage, guestPage, hostContext, guestContext, autoStarted } = match!;

        try {
            if (autoStarted) test.skip(true, '游戏自动开始，无法选择暗影刺客角色');

            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 3000 }).catch(() => false);
            if (!hostIsActive) test.skip(true, '非预期起始玩家，无法构造 Sneak 防御场景');

            const attackerPage = hostPage;
            const defenderId = getPlayerIdFromUrl(guestPage, '1');

            const coreState = await readCoreState(attackerPage) as Record<string, unknown>;
            const players = coreState?.players as Record<string, Record<string, unknown>> | undefined;
            const defenderState = players?.[defenderId];
            if (!defenderState) test.skip(true, '无法读取防御方状态');

            const resources = defenderState!.resources as Record<string, number> | undefined;
            const hpBefore = resources?.[RESOURCE_IDS.HP] ?? 0;
            const nextCoreState = {
                ...coreState,
                players: {
                    ...players,
                    [defenderId]: {
                        ...defenderState,
                        tokens: {
                            ...((defenderState!.tokens as Record<string, unknown>) ?? {}),
                            [TOKEN_IDS.SNEAK]: 1,
                        },
                    },
                },
            };

            await applyCoreStateDirect(attackerPage, nextCoreState);
            await attackerPage.waitForTimeout(300);

            await advanceToOffensiveRoll(attackerPage);
            const rollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await attackerPage.waitForTimeout(300);
            await applyDiceValues(attackerPage, [6, 6, 6, 6, 1]);

            const confirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();

            const highlightedSlots = attackerPage
                .locator('[data-ability-slot]')
                .filter({ has: attackerPage.locator('div.animate-pulse[class*="border-"]') });
            await expect(highlightedSlots.first()).toBeVisible({ timeout: 8000 });
            await highlightedSlots.first().click();

            const resolveAttackButton = attackerPage.getByRole('button', { name: /Resolve Attack|结算攻击/i });
            await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
            await resolveAttackButton.click();

            await expect(attackerPage.getByText(/Main Phase \(2\)|主要阶段 \(2\)/)).toBeVisible({ timeout: 15000 });

            const coreAfter = await readCoreState(attackerPage) as Record<string, unknown>;
            const playersAfter = coreAfter?.players as Record<string, Record<string, unknown>> | undefined;
            const defenderAfter = playersAfter?.[defenderId];
            const resourcesAfter = defenderAfter?.resources as Record<string, number> | undefined;
            expect(resourcesAfter?.[RESOURCE_IDS.HP] ?? 0).toBe(hpBefore);
            const tokensAfter = defenderAfter?.tokens as Record<string, number> | undefined;
            expect(tokensAfter?.[TOKEN_IDS.SNEAK] ?? 0).toBe(0);

            await attackerPage.screenshot({ path: testInfo.outputPath('shadow-thief-sneak-prevent.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('Online match: Shadow Thief defense ability selection (dual defense)', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'shadow_thief');
        if (!match) test.skip(true, '游戏服务器不可用或房间创建失败');
        const { hostPage, guestPage, hostContext, guestContext, autoStarted } = match!;

        try {
            if (autoStarted) test.skip(true, '游戏自动开始，无法选择暗影刺客角色');

            let attackerPage: Page;
            let defenderPage: Page;
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            if (await hostNextPhase.isEnabled({ timeout: 3000 }).catch(() => false)) {
                attackerPage = hostPage; defenderPage = guestPage;
            } else {
                attackerPage = guestPage; defenderPage = hostPage;
            }

            await advanceToOffensiveRoll(attackerPage);
            const rollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await attackerPage.waitForTimeout(300);
            await applyDiceValues(attackerPage, [1, 1, 1, 4, 5]);

            const confirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();

            const highlightedSlots = attackerPage
                .locator('[data-ability-slot]')
                .filter({ has: attackerPage.locator('div.animate-pulse[class*="border-"]') });
            const hasHighlight = await highlightedSlots.first().isVisible({ timeout: 5000 }).catch(() => false);

            if (hasHighlight) {
                await highlightedSlots.first().click();
                const resolveAttackButton = attackerPage.getByRole('button', { name: /Resolve Attack|结算攻击/i });
                await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
                await resolveAttackButton.click();
            } else {
                const advanceButton = attackerPage.locator('[data-tutorial-id="advance-phase-button"]');
                await advanceButton.click();
                const confirmHeading = attackerPage.getByRole('heading', { name: /End offensive roll\?|确认结束攻击掷骰？/i });
                if (await confirmHeading.isVisible({ timeout: 4000 }).catch(() => false)) {
                    await confirmHeading.locator('..').locator('..').getByRole('button', { name: /Confirm|确认/i }).click();
                }
            }

            for (let i = 0; i < 5; i++) {
                let choiceModal: ReturnType<typeof attackerPage.locator> | null = null;
                try { choiceModal = await getModalContainerByHeading(attackerPage, /Ability Resolution Choice|技能结算选择/i, 1500); } catch { choiceModal = null; }
                if (!choiceModal) break;
                const btn = choiceModal.getByRole('button').filter({ hasText: /\S+/ }).first();
                if (await btn.isVisible({ timeout: 500 }).catch(() => false)) { await btn.click(); await attackerPage.waitForTimeout(500); }
            }

            const defensePhaseStarted = await Promise.race([
                defenderPage.getByRole('button', { name: /End Defense|结束防御/i }).isVisible({ timeout: 8000 }).then(() => true).catch(() => false),
                defenderPage.locator('[data-ability-slot]').first().isVisible({ timeout: 8000 }).then(() => true).catch(() => false),
                attackerPage.getByText(/Main Phase \(2\)|主要阶段 \(2\)/).isVisible({ timeout: 8000 }).then(() => false).catch(() => false),
            ]);

            if (defensePhaseStarted) {
                const defenderHighlighted = defenderPage.locator('[data-ability-slot]')
                    .filter({ has: defenderPage.locator('div.animate-pulse[class*="border-"]') });
                await defenderPage.screenshot({ path: testInfo.outputPath('shadow-thief-defense-selection.png'), fullPage: false });

                if (await defenderHighlighted.first().isVisible({ timeout: 5000 }).catch(() => false)) {
                    await defenderHighlighted.first().click();
                    await defenderPage.waitForTimeout(500);
                }

                const defRoll = defenderPage.locator('[data-tutorial-id="dice-roll-button"]');
                if (await defRoll.isEnabled({ timeout: 5000 }).catch(() => false)) {
                    await defRoll.click();
                    await defenderPage.waitForTimeout(300);
                    await defenderPage.locator('[data-tutorial-id="dice-confirm-button"]').click();
                }

                const endDef = defenderPage.getByRole('button', { name: /End Defense|结束防御/i });
                if (await endDef.isEnabled({ timeout: 5000 }).catch(() => false)) await endDef.click();

                for (let i = 0; i < 4; i++) {
                    const hp = await maybePassResponse(hostPage);
                    const gp = await maybePassResponse(guestPage);
                    if (!hp && !gp) break;
                }
            }

            await expect(attackerPage.getByText(/Main Phase \(2\)|主要阶段 \(2\)/)).toBeVisible({ timeout: 15000 });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});
