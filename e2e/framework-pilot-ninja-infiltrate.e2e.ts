/**
 * 测试框架试点 - 忍者渗透完整流程
 * 
 * 验证测试框架的完整能力：
 * 1. 场景构建（setupScene）
 * 2. 命令分发（通过 TestHarness）
 * 3. 交互系统（等待交互、选择选项、确认）
 * 4. 状态验证（断言方法）
 * 
 * 测试场景：渗透（消灭基地上的战术卡）
 * - 基地 0 上有两个战术卡：alien_supreme_overlord, dinosaur_king_rex
 * - 玩家 0 手牌：ninja_infiltrate
 * - 打出渗透到基地 0 → 创建交互 → 选择 alien_supreme_overlord → 确认
 * - 验证：alien_supreme_overlord 被消灭，dinosaur_king_rex 还在，ninja_infiltrate 在基地上
 */

import { test, expect } from './framework';

test.describe('测试框架试点 - 忍者渗透完整流程', () => {
    test('应该能选择并消灭基地上的战术卡（完整流程）', async ({ page, game }, testInfo) => {
        test.setTimeout(60000); // 状态注入模式：60 秒足够
        
        // 1. 导航到游戏（自动启用 TestHarness）
        console.log('📍 步骤 1: 导航到游戏');
        await page.goto('/play/smashup');
        
        // 2. 等待游戏加载完成
        console.log('⏳ 步骤 2: 等待游戏加载');
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return harness?.state?.isRegistered();
            },
            { timeout: 15000 }
        );
        console.log('✅ 游戏已加载，TestHarness 已就绪');

        // 3. 构建测试场景（状态注入）
        console.log('📝 步骤 3: 构建测试场景');
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [{ uid: 'card-infiltrate', defId: 'ninja_infiltrate', type: 'action' }],
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
            },
            bases: [
                {
                    ongoingActions: [
                        { uid: 'ongoing-1', defId: 'alien_supreme_overlord', ownerId: '1' },
                        { uid: 'ongoing-2', defId: 'dinosaur_king_rex', ownerId: '1' },
                    ],
                },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });
        console.log('✅ 场景构建完成');
        
        // 等待 React 重新渲染
        await page.waitForTimeout(2000);
        
        // 验证初始状态
        await game.expectCardInHand('ninja_infiltrate');
        console.log('✅ 初始状态验证通过：渗透在手牌中');

        // 截图：初始状态
        await game.screenshot('01-initial-state', testInfo);
        console.log('📸 截图：初始状态');

        // 4. 打出渗透到基地 0（通过命令分发）
        console.log('🎴 步骤 4: 打出渗透到基地 0');
        const cardUid = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            const currentPlayerIndex = state.core.currentPlayerIndex;
            const currentPlayerId = state.core.turnOrder[currentPlayerIndex];
            const player = state.core.players[currentPlayerId];
            const card = player.hand.find((c: any) => c.defId === 'ninja_infiltrate');
            return card?.uid;
        });
        
        if (!cardUid) {
            throw new Error('ninja_infiltrate not found in hand');
        }
        console.log(`✅ 找到渗透卡牌: ${cardUid}`);
        
        // 分发 PLAY_ACTION 命令（打出到基地 0）
        await page.evaluate((uid) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'su:play_action',
                payload: { cardUid: uid, baseIndex: 0 }
            });
        }, cardUid);
        console.log('✅ 渗透已打出到基地 0');

        // 5. 等待交互出现
        console.log('⏳ 步骤 5: 等待交互出现');
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness.state.get();
                const current = state.sys?.interaction?.current;
                return current?.data?.sourceId === 'ninja_infiltrate_destroy';
            },
            { timeout: 5000 }
        );
        console.log('✅ 交互已出现');

        // 截图：选择界面
        await game.screenshot('02-select-prompt', testInfo);
        console.log('📸 截图：选择界面');

        // 6. 读取交互选项
        console.log('🔍 步骤 6: 读取交互选项');
        const options = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            const current = state.sys?.interaction?.current;
            return current?.data?.options || [];
        });
        console.log(`✅ 找到 ${options.length} 个选项:`, options.map((o: any) => o.label || o.id));

        // 7. 选择 alien_supreme_overlord
        console.log('👆 步骤 7: 选择 alien_supreme_overlord');
        const alienOption = options.find((o: any) => 
            o.value?.cardUid === 'ongoing-1' ||
            o.value?.defId === 'alien_supreme_overlord' ||
            o.id?.includes('alien_supreme_overlord')
        );
        
        if (!alienOption) {
            console.error('可用选项:', JSON.stringify(options, null, 2));
            throw new Error('未找到 alien_supreme_overlord 选项');
        }
        console.log(`✅ 找到 alien_supreme_overlord 选项: ${alienOption.id}`);

        // 8. 解决交互（选择选项）
        console.log('✔️ 步骤 8: 解决交互');
        await page.evaluate((optionValue) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'resolve_interaction',
                payload: { value: optionValue }
            });
        }, alienOption.value);
        console.log('✅ 交互已解决');

        // 9. 等待状态更新
        console.log('⏳ 步骤 9: 等待状态更新');
        await page.waitForTimeout(1000);

        // 截图：最终状态
        await game.screenshot('03-final-state', testInfo);
        console.log('📸 截图：最终状态');

        // 10. 验证最终状态
        console.log('🔍 步骤 10: 验证最终状态');
        
        const finalState = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        
        const base0Ongoing = finalState.core.bases[0].ongoingActions;
        
        // 应该有 2 个战术卡：ninja_infiltrate + dinosaur_king_rex
        expect(base0Ongoing.length).toBe(2);
        console.log(`✅ 基地 0 上有 ${base0Ongoing.length} 个战术卡`);
        
        // ninja_infiltrate 应该在基地上
        expect(base0Ongoing.some((c: any) => c.defId === 'ninja_infiltrate')).toBe(true);
        console.log('✅ ninja_infiltrate 在基地上');
        
        // dinosaur_king_rex 应该还在
        expect(base0Ongoing.some((c: any) => c.defId === 'dinosaur_king_rex')).toBe(true);
        console.log('✅ dinosaur_king_rex 仍在基地上');
        
        // alien_supreme_overlord 应该被消灭
        expect(base0Ongoing.some((c: any) => c.defId === 'alien_supreme_overlord')).toBe(false);
        console.log('✅ alien_supreme_overlord 已被消灭');

        console.log('🎉 渗透完整流程测试通过！');
    });

    test('应该能跳过渗透交互（没有战术卡时）', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);
        
        // 1. 导航到游戏
        console.log('📍 步骤 1: 导航到游戏');
        await page.goto('/play/smashup');
        
        // 2. 等待游戏加载完成
        console.log('⏳ 步骤 2: 等待游戏加载');
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return harness?.state?.isRegistered();
            },
            { timeout: 15000 }
        );
        console.log('✅ 游戏已加载');

        // 3. 构建场景（基地上没有战术卡）
        console.log('📝 步骤 3: 构建测试场景（无战术卡）');
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [{ uid: 'card-infiltrate', defId: 'ninja_infiltrate', type: 'action' }],
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    ongoingActions: [], // 没有战术卡
                },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });
        console.log('✅ 场景构建完成');
        
        await page.waitForTimeout(2000);

        // 截图：初始状态
        await game.screenshot('01-no-tactics-initial', testInfo);
        console.log('📸 截图：初始状态（无战术卡）');

        // 4. 打出渗透到基地 0
        console.log('🎴 步骤 4: 打出渗透到基地 0');
        const cardUid = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            const currentPlayerIndex = state.core.currentPlayerIndex;
            const currentPlayerId = state.core.turnOrder[currentPlayerIndex];
            const player = state.core.players[currentPlayerId];
            const card = player.hand.find((c: any) => c.defId === 'ninja_infiltrate');
            return card?.uid;
        });
        
        await page.evaluate((uid) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'su:play_action',
                payload: { cardUid: uid, baseIndex: 0 }
            });
        }, cardUid);
        console.log('✅ 渗透已打出');

        // 5. 等待状态更新（不应该有交互）
        await page.waitForTimeout(1000);

        // 截图：最终状态
        await game.screenshot('02-no-tactics-final', testInfo);
        console.log('📸 截图：最终状态');

        // 6. 验证最终状态
        console.log('🔍 步骤 6: 验证最终状态');
        
        const finalState = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        
        // 不应该有交互
        expect(finalState.sys?.interaction?.current).toBeUndefined();
        console.log('✅ 没有交互（符合预期）');
        
        // ninja_infiltrate 应该在基地上
        const base0Ongoing = finalState.core.bases[0].ongoingActions;
        expect(base0Ongoing.some((c: any) => c.defId === 'ninja_infiltrate')).toBe(true);
        console.log('✅ ninja_infiltrate 在基地上');

        console.log('🎉 跳过渗透交互测试通过！');
    });

    test('应该能选择多个战术卡中的一个', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);
        
        // 1. 导航到游戏
        console.log('📍 步骤 1: 导航到游戏');
        await page.goto('/play/smashup');
        
        // 2. 等待游戏加载完成
        console.log('⏳ 步骤 2: 等待游戏加载');
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return harness?.state?.isRegistered();
            },
            { timeout: 15000 }
        );
        console.log('✅ 游戏已加载');

        // 3. 构建场景（基地上有 3 个战术卡）
        console.log('📝 步骤 3: 构建测试场景（3 个战术卡）');
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [{ uid: 'card-infiltrate', defId: 'ninja_infiltrate', type: 'action' }],
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    ongoingActions: [
                        { uid: 'ongoing-1', defId: 'alien_supreme_overlord', ownerId: '1' },
                        { uid: 'ongoing-2', defId: 'dinosaur_king_rex', ownerId: '1' },
                        { uid: 'ongoing-3', defId: 'wizard_arcane_power', ownerId: '1' },
                    ],
                },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });
        console.log('✅ 场景构建完成');
        
        await page.waitForTimeout(2000);

        // 截图：初始状态
        await game.screenshot('01-three-tactics-initial', testInfo);
        console.log('📸 截图：初始状态（3 个战术卡）');

        // 4. 打出渗透到基地 0
        console.log('🎴 步骤 4: 打出渗透到基地 0');
        const cardUid = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            const currentPlayerIndex = state.core.currentPlayerIndex;
            const currentPlayerId = state.core.turnOrder[currentPlayerIndex];
            const player = state.core.players[currentPlayerId];
            const card = player.hand.find((c: any) => c.defId === 'ninja_infiltrate');
            return card?.uid;
        });
        
        await page.evaluate((uid) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'su:play_action',
                payload: { cardUid: uid, baseIndex: 0 }
            });
        }, cardUid);
        console.log('✅ 渗透已打出');

        // 5. 等待交互出现
        console.log('⏳ 步骤 5: 等待交互出现');
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness.state.get();
                const current = state.sys?.interaction?.current;
                return current?.data?.sourceId === 'ninja_infiltrate_destroy';
            },
            { timeout: 5000 }
        );
        console.log('✅ 交互已出现');

        // 截图：选择界面（3 个选项）
        await game.screenshot('02-three-tactics-prompt', testInfo);
        console.log('📸 截图：选择界面（3 个选项）');

        // 6. 验证交互选项数量
        const options = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            const current = state.sys?.interaction?.current;
            return current?.data?.options || [];
        });
        expect(options.length).toBe(3);
        console.log(`✅ 找到 ${options.length} 个选项`);

        // 7. 选择第二个战术卡（dinosaur_king_rex）
        console.log('👆 步骤 7: 选择 dinosaur_king_rex');
        const kingRexOption = options.find((o: any) => 
            o.value?.cardUid === 'ongoing-2' ||
            o.value?.defId === 'dinosaur_king_rex'
        );
        
        if (!kingRexOption) {
            throw new Error('未找到 dinosaur_king_rex 选项');
        }
        console.log(`✅ 找到 dinosaur_king_rex 选项`);

        // 8. 解决交互
        await page.evaluate((optionValue) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'resolve_interaction',
                payload: { value: optionValue }
            });
        }, kingRexOption.value);
        console.log('✅ 交互已解决');

        // 9. 等待状态更新
        await page.waitForTimeout(1000);

        // 截图：最终状态
        await game.screenshot('03-three-tactics-final', testInfo);
        console.log('📸 截图：最终状态');

        // 10. 验证最终状态
        console.log('🔍 步骤 10: 验证最终状态');
        
        const finalState = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        
        const base0Ongoing = finalState.core.bases[0].ongoingActions;
        
        // 应该有 3 个战术卡：ninja_infiltrate + alien_supreme_overlord + wizard_arcane_power
        expect(base0Ongoing.length).toBe(3);
        console.log(`✅ 基地 0 上有 ${base0Ongoing.length} 个战术卡`);
        
        // ninja_infiltrate 应该在基地上
        expect(base0Ongoing.some((c: any) => c.defId === 'ninja_infiltrate')).toBe(true);
        console.log('✅ ninja_infiltrate 在基地上');
        
        // alien_supreme_overlord 应该还在
        expect(base0Ongoing.some((c: any) => c.defId === 'alien_supreme_overlord')).toBe(true);
        console.log('✅ alien_supreme_overlord 仍在基地上');
        
        // wizard_arcane_power 应该还在
        expect(base0Ongoing.some((c: any) => c.defId === 'wizard_arcane_power')).toBe(true);
        console.log('✅ wizard_arcane_power 仍在基地上');
        
        // dinosaur_king_rex 应该被消灭
        expect(base0Ongoing.some((c: any) => c.defId === 'dinosaur_king_rex')).toBe(false);
        console.log('✅ dinosaur_king_rex 已被消灭');

        console.log('🎉 多选项渗透测试通过！');
    });
});
