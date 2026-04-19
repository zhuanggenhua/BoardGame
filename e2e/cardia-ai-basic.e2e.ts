import { test, expect } from './fixtures';
import { setupCardiaTestScenario } from './helpers/cardia';

/**
 * Cardia AI 基础功能 E2E 测试
 * 
 * 测试覆盖：
 * 1. AI Runtime 已注册
 * 2. AI 策略配置正确
 * 3. AI 动作生成功能正常
 */
test.describe('Cardia AI 基础功能', () => {
    test('AI Runtime 注册验证', async ({ browser }) => {
        console.log('\n=== 创建测试场景 ===');
        
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02'],
                deck: ['deck_i_card_03', 'deck_i_card_04'],
            },
            player2: {
                hand: ['deck_i_card_01', 'deck_i_card_05'],
                deck: ['deck_i_card_06', 'deck_i_card_07'],
            },
            phase: 'play',
        });

        try {
            console.log('✅ 测试场景创建成功');

            console.log('\n=== 验证 AI Runtime 已注册 ===');

            // 验证 AI Runtime 已注册
            const aiRuntimeInfo = await setup.player1Page.evaluate(() => {
                // @ts-expect-error - 访问全局测试工具
                const gameRegistry = window.__BG_GAME_REGISTRY__;
                if (!gameRegistry) return { error: 'Game registry not found' };
                
                const cardiaGame = gameRegistry.get('cardia');
                if (!cardiaGame) return { error: 'Cardia game not found' };
                
                const aiRuntime = cardiaGame.aiRuntime;
                if (!aiRuntime) return { error: 'AI runtime not found' };
                
                return {
                    gameId: aiRuntime.gameId,
                    hasBaseline: 'baseline' in aiRuntime.localPolicies,
                    hasAggro: 'aggro' in aiRuntime.localPolicies,
                    hasControl: 'control' in aiRuntime.localPolicies,
                    hasBalanced: 'balanced' in aiRuntime.localPolicies,
                    defaultPolicy: aiRuntime.defaultLocalPolicyId,
                    hasBuildLegalActions: typeof aiRuntime.buildLegalActions === 'function',
                };
            });

            console.log('AI Runtime 信息:', JSON.stringify(aiRuntimeInfo, null, 2));

            expect(aiRuntimeInfo).not.toHaveProperty('error');
            expect(aiRuntimeInfo.gameId).toBe('cardia');
            expect(aiRuntimeInfo.hasBaseline).toBe(true);
            expect(aiRuntimeInfo.hasAggro).toBe(true);
            expect(aiRuntimeInfo.hasControl).toBe(true);
            expect(aiRuntimeInfo.hasBalanced).toBe(true);
            expect(aiRuntimeInfo.defaultPolicy).toBe('baseline');
            expect(aiRuntimeInfo.hasBuildLegalActions).toBe(true);
            console.log('✅ AI Runtime 已正确注册');

            console.log('\n=== 验证动作生成功能 ===');

            // 验证动作生成功能
            const actionGenResult = await setup.player1Page.evaluate(() => {
                // @ts-expect-error - 访问全局测试工具
                const gameRegistry = window.__BG_GAME_REGISTRY__;
                const cardiaGame = gameRegistry?.get('cardia');
                const aiRuntime = cardiaGame?.aiRuntime;
                
                if (!aiRuntime) return { error: 'AI runtime not found' };
                
                // @ts-expect-error - 访问全局测试工具
                const state = window.__BG_TEST_HARNESS__?.readCoreState();
                if (!state) return { error: 'State not found' };
                
                try {
                    const actions = aiRuntime.buildLegalActions({
                        state: { core: state, sys: { interaction: null } },
                        playerId: '0',
                    });
                    
                    return {
                        success: true,
                        actionCount: actions.length,
                        actionKinds: actions.map((a: { kind: string }) => a.kind),
                        hasPlayCard: actions.some((a: { kind: string }) => a.kind === 'play-card'),
                        allHaveMetadata: actions.every((a: { metadata?: unknown }) => a.metadata !== undefined),
                        sampleAction: actions[0] ? {
                            kind: actions[0].kind,
                            hasActionId: !!actions[0].actionId,
                            hasCommands: Array.isArray(actions[0].commands),
                        } : null,
                    };
                } catch (error) {
                    return { error: String(error) };
                }
            });

            console.log('动作生成结果:', JSON.stringify(actionGenResult, null, 2));

            expect(actionGenResult).not.toHaveProperty('error');
            expect(actionGenResult.success).toBe(true);
            expect(actionGenResult.actionCount).toBeGreaterThan(0);
            expect(actionGenResult.hasPlayCard).toBe(true);
            expect(actionGenResult.allHaveMetadata).toBe(true);
            console.log(`✅ 动作生成功能正常，生成了 ${actionGenResult.actionCount} 个动作`);

            console.log('\n=== 测试完成 ===');
            console.log('✅ 所有断言通过');

        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
