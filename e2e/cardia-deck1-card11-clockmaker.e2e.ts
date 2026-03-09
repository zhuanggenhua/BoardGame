/**
 * 钟表匠（Clockmaker）E2E 测试
 * 
 * 测试场景：
 * 1. P1 打出钟表匠（影响力 11），P2 打出财务官（影响力 12）
 * 2. P1 失败，激活钟表匠能力
 * 3. 验证延迟效果被注册（为下一张牌添加 +3）
 * 4. P1 打出下一张牌
 * 5. 验证延迟效果被触发，修正标记被添加
 */

import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
    applyCoreStateDirect,
} from './helpers/cardia';
import { ABILITY_IDS } from '../src/games/cardia/domain/ids';

test.describe('钟表匠延迟效果 E2E 测试', () => {
    test('应该为下一张打出的牌添加 +3 修正标记', async ({ browser }) => {
        // 1. 设置测试场景：使用状态注入，直接进入能力阶段
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 下一张要打出的牌（影响力1）
                deck: ['deck_i_card_02', 'deck_i_card_03'],
                playedCards: [
                    { defId: 'deck_i_card_11', signets: 0, encounterIndex: 0 }, // 钟表匠（影响力11）
                ],
            },
            player2: {
                hand: ['deck_i_card_13'], // 沼泽守卫（影响力13）
                deck: ['deck_i_card_07', 'deck_i_card_08'],
                playedCards: [
                    { defId: 'deck_i_card_12', signets: 1, encounterIndex: 0 }, // 财务官（影响力12，有1个印戒）
                ],
            },
            phase: 'ability', // 直接进入能力阶段
            turnNumber: 0,
            currentEncounter: {
                player1Influence: 11,
                player2Influence: 12,
                winnerId: '1',
                loserId: '0',
            },
        });
        
        try {
            console.log('\n=== 阶段1：激活钟表匠能力 ===');
            
            const stateBeforeActivate = await readCoreState(setup.player1Page);
            
            console.log('激活能力前状态:', {
                phase: stateBeforeActivate.phase,
                turnNumber: stateBeforeActivate.turnNumber,
                delayedEffects: stateBeforeActivate.delayedEffects,
                player0PlayedCards: stateBeforeActivate.players['0'].playedCards.length,
            });
            
            // 手动 dispatch ACTIVATE_ABILITY 命令
            await setup.player1Page.evaluate(async ({ abilityId, cardUid }) => {
                const dispatch = (window as any).__BG_DISPATCH__;
                if (!dispatch) {
                    throw new Error('__BG_DISPATCH__ not found');
                }
                
                const result = await dispatch('cardia:activate_ability', {
                    abilityId,
                    sourceCardUid: cardUid,
                });
                
                console.log('[Test] ACTIVATE_ABILITY result:', result);
            }, {
                abilityId: ABILITY_IDS.CLOCKMAKER,
                cardUid: stateBeforeActivate.players['0'].playedCards[0].uid,
            });
            
            // 等待能力执行完成
            await setup.player1Page.waitForTimeout(1000);
            
            // 验证延迟效果被注册
            const stateAfterAbility = await readCoreState(setup.player1Page);
            
            console.log('激活能力后状态:', {
                phase: stateAfterAbility.phase,
                turnNumber: stateAfterAbility.turnNumber,
                delayedEffects: stateAfterAbility.delayedEffects,
                modifierTokens: stateAfterAbility.modifierTokens,
            });
            
            // 验证延迟效果被注册
            expect(stateAfterAbility.delayedEffects).toHaveLength(1);
            expect(stateAfterAbility.delayedEffects[0]).toMatchObject({
                effectType: 'modifyInfluence',
                target: 'self',
                value: 3,
                condition: 'onNextCardPlayed',
                sourceAbilityId: ABILITY_IDS.CLOCKMAKER,
                sourcePlayerId: '0', // 在线模式下 P1 是 '0'
            });
            
            console.log('✅ 延迟效果已注册');
            
            console.log('\n=== 阶段2：等待回合推进 ===');
            
            // 等待回合推进到 play 阶段
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            const stateAfterTurnAdvance = await readCoreState(setup.player1Page);
            
            console.log('回合推进后状态:', {
                phase: stateAfterTurnAdvance.phase,
                turnNumber: stateAfterTurnAdvance.turnNumber,
                delayedEffects: stateAfterTurnAdvance.delayedEffects.length,
            });
            
            expect(stateAfterTurnAdvance.phase).toBe('play');
            expect(stateAfterTurnAdvance.delayedEffects).toHaveLength(1); // 延迟效果应该保留
            
            console.log('\n=== 阶段3：打出下一张牌 ===');
            
            // P1 打出下一张牌（影响力1）
            console.log('P1 打出下一张牌（影响力1）');
            await playCard(setup.player1Page, 0);
            
            await setup.player1Page.waitForTimeout(2000);
            
            // 验证延迟效果被触发
            const finalState = await readCoreState(setup.player1Page);
            
            console.log('打牌后最终状态:', {
                phase: finalState.phase,
                turnNumber: finalState.turnNumber,
                delayedEffects: finalState.delayedEffects,
                modifierTokens: finalState.modifierTokens,
                p1PlayedCards: (finalState.players as any)['0'].playedCards.length,
            });
            
            // 验证延迟效果被移除
            expect(finalState.delayedEffects).toHaveLength(0);
            
            // 验证修正标记被添加
            const modifierToken = finalState.modifierTokens.find(
                (t: any) => t.source === ABILITY_IDS.CLOCKMAKER
            );
            
            console.log('🔍 查找修正标记:', {
                found: !!modifierToken,
                modifierToken,
                allModifierTokens: finalState.modifierTokens,
            });
            
            expect(modifierToken).toBeDefined();
            expect(modifierToken.value).toBe(3);
            expect(modifierToken.source).toBe(ABILITY_IDS.CLOCKMAKER);
            
            console.log('✅ 测试通过：延迟效果成功触发，修正标记已添加');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
