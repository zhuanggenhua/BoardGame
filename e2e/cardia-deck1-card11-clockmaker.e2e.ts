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
            
            // 验证延迟效果被注册（效果2：为下一张牌添加修正）
            expect(stateAfterAbility.delayedEffects).toHaveLength(1);
            expect(stateAfterAbility.delayedEffects[0]).toMatchObject({
                effectType: 'modifyInfluence',
                target: 'self',
                value: 3,
                condition: 'onNextCardPlayed',
                sourceAbilityId: ABILITY_IDS.CLOCKMAKER,
                sourcePlayerId: '0', // 在线模式下 P1 是 '0'
            });
            
            console.log('✅ 延迟效果已注册（效果2）');
            
            // 验证上一个遭遇的牌添加了修正标记（效果1）
            // 注意：钟表匠本身是 encounterIndex: 0，所以"上一个遭遇的牌"不存在
            // 但我们需要验证实现中正确处理了这个边界情况
            // 由于当前场景中钟表匠是第一张牌（encounterIndex: 0），没有"上一个遭遇的牌"
            // 所以不应该有为"上一个遭遇的牌"添加的修正标记
            
            // 为了测试效果1，我们需要修改初始状态，让钟表匠不是第一张牌
            // 这将在下一个测试用例中验证
            
            console.log('✅ 当前场景：钟表匠是第一张牌，无上一个遭遇的牌（边界情况）');
            
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

    test('应该为上一个遭遇的牌和下一张打出的牌都添加 +3 修正标记', async ({ browser }) => {
        // 1. 设置测试场景：P1 已有一张已打出的牌，然后打出钟表匠
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_03'], // 下一张要打出的牌（外科医生，影响力3）
                deck: ['deck_i_card_02', 'deck_i_card_04'],
                playedCards: [
                    { defId: 'deck_i_card_01', signets: 0, encounterIndex: 0 }, // 雇佣剑士（影响力1）- 上一个遭遇的牌
                    { defId: 'deck_i_card_11', signets: 0, encounterIndex: 1 }, // 钟表匠（影响力11）- 当前遭遇
                ],
            },
            player2: {
                hand: ['deck_i_card_13'], // 沼泽守卫（影响力13）
                deck: ['deck_i_card_07', 'deck_i_card_08'],
                playedCards: [
                    { defId: 'deck_i_card_12', signets: 1, encounterIndex: 1 }, // 财务官（影响力12，有1个印戒）
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
                modifierTokens: stateBeforeActivate.modifierTokens,
                player0PlayedCards: stateBeforeActivate.players['0'].playedCards.length,
            });
            
            // 获取钟表匠的 uid（encounterIndex: 1）
            const clockmakerCard = stateBeforeActivate.players['0'].playedCards.find(
                (c: any) => c.encounterIndex === 1
            );
            
            expect(clockmakerCard).toBeDefined();
            console.log('钟表匠卡牌:', clockmakerCard);
            
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
                cardUid: clockmakerCard.uid,
            });
            
            // 等待能力执行完成
            await setup.player1Page.waitForTimeout(1000);
            
            // 验证能力执行后的状态
            const stateAfterAbility = await readCoreState(setup.player1Page);
            
            console.log('激活能力后状态:', {
                phase: stateAfterAbility.phase,
                turnNumber: stateAfterAbility.turnNumber,
                delayedEffects: stateAfterAbility.delayedEffects,
                modifierTokens: stateAfterAbility.modifierTokens,
            });
            
            // 验证延迟效果被注册（效果2：为下一张牌添加修正）
            expect(stateAfterAbility.delayedEffects).toHaveLength(1);
            expect(stateAfterAbility.delayedEffects[0]).toMatchObject({
                effectType: 'modifyInfluence',
                target: 'self',
                value: 3,
                condition: 'onNextCardPlayed',
                sourceAbilityId: ABILITY_IDS.CLOCKMAKER,
                sourcePlayerId: '0',
            });
            
            console.log('✅ 延迟效果已注册（效果2）');
            
            // 验证上一个遭遇的牌添加了修正标记（效果1）
            const previousCard = stateAfterAbility.players['0'].playedCards.find(
                (c: any) => c.encounterIndex === 0
            );
            
            expect(previousCard).toBeDefined();
            console.log('上一个遭遇的牌:', previousCard);
            
            // 查找为上一个遭遇的牌添加的修正标记
            const previousCardModifier = stateAfterAbility.modifierTokens.find(
                (t: any) => t.cardId === previousCard.uid && t.source === ABILITY_IDS.CLOCKMAKER
            );
            
            console.log('🔍 查找上一个遭遇的牌的修正标记:', {
                found: !!previousCardModifier,
                modifierToken: previousCardModifier,
                allModifierTokens: stateAfterAbility.modifierTokens,
            });
            
            expect(previousCardModifier).toBeDefined();
            expect(previousCardModifier.value).toBe(3);
            expect(previousCardModifier.source).toBe(ABILITY_IDS.CLOCKMAKER);
            expect(previousCardModifier.cardId).toBe(previousCard.uid);
            
            console.log('✅ 上一个遭遇的牌已添加修正标记（效果1）');
            
            console.log('\n=== 阶段4：等待回合推进并打出下一张牌 ===');
            
            // 等待回合推进到 play 阶段
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            const stateBeforeNextCard = await readCoreState(setup.player1Page);
            
            console.log('打牌前状态:', {
                phase: stateBeforeNextCard.phase,
                turnNumber: stateBeforeNextCard.turnNumber,
                delayedEffects: stateBeforeNextCard.delayedEffects.length,
                p1Hand: stateBeforeNextCard.players['0'].hand.length,
            });
            
            // P1 打出下一张牌（外科医生，影响力3）
            console.log('P1 打出下一张牌（外科医生，影响力3）');
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
            
            // 验证有两个修正标记（一个给上一个遭遇的牌，一个给新打出的牌）
            const clockmakerModifiers = finalState.modifierTokens.filter(
                (t: any) => t.source === ABILITY_IDS.CLOCKMAKER
            );
            
            console.log('🔍 查找钟表匠的所有修正标记:', {
                count: clockmakerModifiers.length,
                modifiers: clockmakerModifiers,
            });
            
            // 应该有 2 个修正标记
            expect(clockmakerModifiers).toHaveLength(2);
            
            // 验证第一个修正标记是给上一个遭遇的牌的
            const previousCardModifierFinal = clockmakerModifiers.find(
                (t: any) => t.cardId === previousCard.uid
            );
            expect(previousCardModifierFinal).toBeDefined();
            expect(previousCardModifierFinal.value).toBe(3);
            
            // 验证第二个修正标记是给新打出的牌的（不是上一个遭遇的牌）
            const newCardModifier = clockmakerModifiers.find(
                (t: any) => t.cardId !== previousCard.uid
            );
            expect(newCardModifier).toBeDefined();
            expect(newCardModifier.value).toBe(3);
            
            console.log('✅ 测试通过：钟表匠的两个效果都正确执行');
            console.log('  - 效果1：上一个遭遇的牌（雇佣剑士）添加了 +3 修正标记');
            console.log('  - 效果2：下一张打出的牌（外科医生）添加了 +3 修正标记');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});