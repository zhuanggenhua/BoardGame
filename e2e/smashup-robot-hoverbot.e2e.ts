/**
 * 大杀四方 - 盘旋机器人端到端测试
 * 
 * 测试场景：
 * 1. 打出盘旋机器人
 * 2. 查看牌库顶（随从）
 * 3. 选择打出 / 跳过
 * 4. 验证交互弹窗正常显示（不一闪而过）
 * 5. 验证选项可以点击
 * 
 * 核心验证：_source: 'static' 修复生效
 * - 修复前：客户端只收到 1 个选项（play 被过滤掉）
 * - 修复后：客户端收到 2 个选项（play 有 _source: static，不被过滤）
 */

import { test, expect, createSmashUpMatch } from './fixtures';
import { readCoreState, applyCoreState } from './helpers/smashup';

test.describe('盘旋机器人交互测试', () => {
    test('应该正确显示交互弹窗并允许选择', async ({ browser }, testInfo) => {
        // 创建机器人 + 海盗派系的对局
        const setup = await createSmashUpMatch(browser, testInfo.project.use.baseURL, {
            hostFactions: [4, 0], // 机器人 + 海盗
            guestFactions: [1, 2], // 忍者 + 恐龙
        });
        
        if (!setup) {
            test.skip();
            return;
        }

        const { hostPage: page, hostContext, guestContext } = setup;

        try {
            console.log('[E2E] 游戏已就绪，开始构造测试场景');

            // 3. 构造测试场景：玩家 0 手牌有盘旋机器人，牌库顶是海盗随从
            const state = await readCoreState(page);
            
            // 找到盘旋机器人和海盗随从的卡牌
            const player0 = state.players['0'];
            const hoverbotCard = player0.deck.find((c: any) => c.defId === 'robot_hoverbot');
            const pirateMinion = player0.deck.find((c: any) => 
                c.type === 'minion' && c.defId.startsWith('pirate_')
            );

            if (!hoverbotCard) {
                throw new Error('牌库中没有找到盘旋机器人');
            }
            if (!pirateMinion) {
                throw new Error('牌库中没有找到海盗随从');
            }

            console.log('[E2E] 找到卡牌:', {
                hoverbot: hoverbotCard.defId,
                pirate: pirateMinion.defId,
            });

            // 构造场景：盘旋机器人在手牌，海盗随从在牌库顶
            await applyCoreState(page, {
                players: {
                    '0': {
                        hand: [hoverbotCard],
                        deck: [pirateMinion, ...player0.deck.filter((c: any) => 
                            c.uid !== hoverbotCard.uid && c.uid !== pirateMinion.uid
                        )],
                        minionsPlayed: 0,
                        actionsPlayed: 0,
                    },
                },
            });

            console.log('[E2E] 场景构造完成，等待 UI 更新');
            await page.waitForTimeout(500);

            // 4. 打出盘旋机器人到基地 0
            console.log('[E2E] 打出盘旋机器人');
            
            // 点击手牌中的盘旋机器人
            const handCard = page.locator('[data-card-uid]').filter({ hasText: /盘旋机器人|Hoverbot/i }).first();
            await expect(handCard).toBeVisible({ timeout: 5000 });
            await handCard.click();

            // 等待基地高亮
            await page.waitForTimeout(300);

            // 点击基地 0
            const base0 = page.locator('[data-base-index="0"]').first();
            await expect(base0).toBeVisible({ timeout: 5000 });
            await base0.click();

            console.log('[E2E] 等待交互弹窗出现');

            // 5. 验证交互弹窗出现且不会一闪而过
            const promptOverlay = page.locator('[data-testid^="prompt-card-"]').first();
            
            // 等待弹窗出现
            await expect(promptOverlay).toBeVisible({ timeout: 5000 });
            console.log('[E2E] 交互弹窗已出现');

            // 等待 2 秒，确认弹窗不会消失
            await page.waitForTimeout(2000);
            await expect(promptOverlay).toBeVisible();
            console.log('[E2E] 交互弹窗稳定显示（2秒后仍可见）');

            // 6. 验证有两个选项：打出 + 跳过
            const cardOptions = page.locator('[data-testid^="prompt-card-"]');
            const optionCount = await cardOptions.count();
            console.log('[E2E] 选项数量:', optionCount);

            // 应该至少有 1 个卡牌选项（打出）
            expect(optionCount).toBeGreaterThanOrEqual(1);

            // 验证跳过按钮存在
            const skipButton = page.getByRole('button', { name: /跳过|放回牌库顶|Skip/i });
            await expect(skipButton).toBeVisible({ timeout: 3000 });
            console.log('[E2E] 跳过按钮已找到');

            // 7. 测试选择"打出"
            console.log('[E2E] 点击"打出"选项');
            const playOption = promptOverlay.first();
            await playOption.click();

            // 等待交互弹窗消失
            await expect(promptOverlay).not.toBeVisible({ timeout: 5000 });
            console.log('[E2E] 交互弹窗已消失');

            // 8. 验证海盗随从已打出到基地 0
            await page.waitForTimeout(1000);
            const finalState = await readCoreState(page);
            const base0Minions = finalState.bases[0].minions.filter((m: any) => m.controller === '0');
            
            console.log('[E2E] 基地 0 上的随从:', base0Minions.map((m: any) => m.defId));
            
            // 应该有 2 个随从：盘旋机器人 + 海盗随从
            expect(base0Minions.length).toBe(2);
            expect(base0Minions.some((m: any) => m.defId === 'robot_hoverbot')).toBe(true);
            expect(base0Minions.some((m: any) => m.defId === pirateMinion.defId)).toBe(true);

            console.log('[E2E] ✅ 测试通过：盘旋机器人交互正常工作');
        } finally {
            await hostContext.close().catch(() => {});
            await guestContext.close().catch(() => {});
        }
    });

    test('应该允许选择"跳过"', async ({ browser }, testInfo) => {
        const setup = await createSmashUpMatch(browser, testInfo.project.use.baseURL, {
            hostFactions: [4, 0], // 机器人 + 海盗
            guestFactions: [1, 2],
        });
        
        if (!setup) {
            test.skip();
            return;
        }

        const { hostPage: page, hostContext, guestContext } = setup;

        try {
            // 3. 构造测试场景
            const state = await readCoreState(page);
            const player0 = state.players['0'];
            const hoverbotCard = player0.deck.find((c: any) => c.defId === 'robot_hoverbot');
            const pirateMinion = player0.deck.find((c: any) => 
                c.type === 'minion' && c.defId.startsWith('pirate_')
            );

            if (!hoverbotCard || !pirateMinion) {
                throw new Error('未找到所需卡牌');
            }

            await applyCoreState(page, {
                players: {
                    '0': {
                        hand: [hoverbotCard],
                        deck: [pirateMinion, ...player0.deck.filter((c: any) => 
                            c.uid !== hoverbotCard.uid && c.uid !== pirateMinion.uid
                        )],
                        minionsPlayed: 0,
                    },
                },
            });

            await page.waitForTimeout(500);

            // 4. 打出盘旋机器人
            const handCard = page.locator('[data-card-uid]').filter({ hasText: /盘旋机器人|Hoverbot/i }).first();
            await handCard.click();
            await page.waitForTimeout(300);
            const base0 = page.locator('[data-base-index="0"]').first();
            await base0.click();

            // 5. 等待交互弹窗
            const promptOverlay = page.locator('[data-testid^="prompt-card-"]').first();
            await expect(promptOverlay).toBeVisible({ timeout: 5000 });

            // 6. 点击"跳过"
            console.log('[E2E] 点击"跳过"按钮');
            const skipButton = page.getByRole('button', { name: /跳过|放回牌库顶|Skip/i });
            await skipButton.click();

            // 7. 验证交互弹窗消失
            await expect(promptOverlay).not.toBeVisible({ timeout: 5000 });

            // 8. 验证海盗随从仍在牌库顶（未打出）
            await page.waitForTimeout(1000);
            const finalState = await readCoreState(page);
            const base0Minions = finalState.bases[0].minions.filter((m: any) => m.controller === '0');
            
            // 应该只有 1 个随从：盘旋机器人
            expect(base0Minions.length).toBe(1);
            expect(base0Minions[0].defId).toBe('robot_hoverbot');
            
            // 海盗随从应该仍在牌库顶
            expect(finalState.players['0'].deck[0].defId).toBe(pirateMinion.defId);

            console.log('[E2E] ✅ 测试通过：跳过功能正常工作');
        } finally {
            await hostContext.close().catch(() => {});
            await guestContext.close().catch(() => {});
        }
    });

    test('应该在牌库顶是行动卡时不创建交互', async ({ browser }, testInfo) => {
        const setup = await createSmashUpMatch(browser, testInfo.project.use.baseURL, {
            hostFactions: [4, 0],
            guestFactions: [1, 2],
        });
        
        if (!setup) {
            test.skip();
            return;
        }

        const { hostPage: page, hostContext, guestContext } = setup;

        try {
            // 3. 构造测试场景：牌库顶是行动卡
            const state = await readCoreState(page);
            const player0 = state.players['0'];
            const hoverbotCard = player0.deck.find((c: any) => c.defId === 'robot_hoverbot');
            const actionCard = player0.deck.find((c: any) => c.type === 'action');

            if (!hoverbotCard || !actionCard) {
                throw new Error('未找到所需卡牌');
            }

            await applyCoreState(page, {
                players: {
                    '0': {
                        hand: [hoverbotCard],
                        deck: [actionCard, ...player0.deck.filter((c: any) => 
                            c.uid !== hoverbotCard.uid && c.uid !== actionCard.uid
                        )],
                        minionsPlayed: 0,
                    },
                },
            });

            await page.waitForTimeout(500);

            // 4. 打出盘旋机器人
            const handCard = page.locator('[data-card-uid]').filter({ hasText: /盘旋机器人|Hoverbot/i }).first();
            await handCard.click();
            await page.waitForTimeout(300);
            const base0 = page.locator('[data-base-index="0"]').first();
            await base0.click();

            // 5. 验证不会出现交互弹窗（因为牌库顶是行动卡）
            await page.waitForTimeout(2000);
            const promptOverlay = page.locator('[data-testid^="prompt-card-"]').first();
            await expect(promptOverlay).not.toBeVisible();

            console.log('[E2E] ✅ 测试通过：牌库顶是行动卡时不创建交互');
        } finally {
            await hostContext.close().catch(() => {});
            await guestContext.close().catch(() => {});
        }
    });
});
