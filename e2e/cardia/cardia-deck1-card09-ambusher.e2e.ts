import { test, expect } from '../fixtures';
import { 
    setupCardiaTestScenario,
    readCoreState,
    waitForPhase,
} from '../helpers/cardia';
import { ABILITY_IDS } from '../src/games/cardia/domain/ids';

/**
 * 影响力9 - 伏击者
 * 能力：选择一个派系，你的对手弃掉所有该派系的手牌
 * 
 * 能力类型：即时能力（instant）
 * 触发时机：onLose（失败时触发）
 * 效果：
 * - 步骤1：P1 选择一个派系
 * - 步骤2：P2 弃掉所有该派系的手牌
 * 
 * 测试场景：
 * - 使用 setupCardiaTestScenario 注入测试状态
 * - 使用 dispatch 手动触发能力
 * - P1 选择派系
 * - 验证：P2 的该派系手牌被弃掉
 */
test.describe('Cardia 一号牌组 - 伏击者', () => {

    test('影响力9 - 伏击者：对手弃掉所有指定派系的手牌（基础场景）', async ({ browser }) => {
        // 构造测试状态：P2 手牌有 1 张 Academy + 1 张 Guild
        // P1 打出伏击者（9），P2 打出审判官（16），P2 获胜，P1 失败触发伏击者能力
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 雇佣剑士（备用手牌）
                deck: ['deck_i_card_02', 'deck_i_card_03'],
                playedCards: [
                    { defId: 'deck_i_card_09', signets: 0, encounterIndex: 0 }, // 伏击者
                ],
            },
            player2: {
                hand: [
                    'deck_i_card_02', // Academy 派系
                    'deck_i_card_03', // Guild 派系
                ],
                deck: ['deck_i_card_04', 'deck_i_card_05'],
                playedCards: [
                    { defId: 'deck_i_card_16', signets: 0, encounterIndex: 0 }, // 审判官（影响力16）
                ],
            },
            phase: 'ability',
            currentEncounter: {
                player1Influence: 9,
                player2Influence: 16,
                winnerId: '1', // P2 获胜，P1 失败触发伏击者能力
            },
        });
        
        try {
            console.log('\n=== 阶段1：验证初始状态 ===');
            
            await setup.player1Page.waitForTimeout(2000);
            
            // 验证初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                hand: Array<{ defId: string; faction: string }>; 
                deck: unknown[]; 
                playedCards: Array<{ uid: string; defId: string }>;
                discard: Array<{ defId: string }>;
            };
            const players = initialState.players as Record<string, PlayerState>;
            
            console.log('初始状态:', {
                phase: initialState.phase,
                p2Hand: players['1'].hand.length,
                p2HandCards: players['1'].hand.map(c => ({ defId: c.defId, faction: c.faction })),
            });
            
            expect(initialState.phase).toBe('ability');
            expect(players['1'].hand.length).toBe(2);
            
            const initialP2DiscardSize = players['1'].discard.length;
            const ambusherCard = players['0'].playedCards[0];
            
            console.log('\n=== 阶段2：激活能力 ===');
            
            console.log('激活伏击者能力', ambusherCard.uid);
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            console.log('✅ 伏击者能力已激活');
            
            // 等待派系选择弹窗出现
            const modal = setup.player1Page.locator('[data-testid="faction-selection-modal"]');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 派系选择弹窗已显示');
            
            // 选择 Academy 派系（P2 手牌中有 1 张 Academy 派系的牌）
            const academyButton = modal.locator('[data-testid="faction-option-academy"]');
            await academyButton.click();
            await setup.player1Page.waitForTimeout(500);
            console.log('✅ 已选择 Academy 派系');
            
            // 等待弹窗关闭（表示交互已处理）
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ 弹窗已关闭');
            
            // 等待能力执行完成（自动回合结束）
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            console.log('\n=== 阶段3：验证结果 ===');
            
            // 验证：P2 的 Academy 派系手牌被弃掉
            const stateAfter = await readCoreState(setup.player1Page);
            const playersAfter = stateAfter.players as Record<string, PlayerState>;
            
            console.log('能力执行后:', {
                p2HandSize: playersAfter['1'].hand.length,
                p2Hand: playersAfter['1'].hand.map(c => ({ defId: c.defId, faction: c.faction })),
                p2DiscardSize: playersAfter['1'].discard.length,
                phase: stateAfter.phase,
            });
            
            // 核心功能验证：Academy 派系手牌被弃掉
            // 初始手牌：2 张（1 张 Academy + 1 张 Guild）
            // 伏击者能力：弃掉所有 Academy 派系手牌（1 张）
            // 回合结束：P2 抽 1 张牌
            // 最终手牌：2 张（1 张 Guild + 1 张新抽的牌）
            
            // 验证剩余手牌中没有 Academy 派系
            const academyCards = playersAfter['1'].hand.filter(c => c.faction === 'academy');
            expect(academyCards.length).toBe(0);
            console.log('✅ P2 的 Academy 派系手牌被弃掉');
            
            // 验证弃牌堆增加了 1 张（被弃掉的 Academy 派系手牌）
            expect(playersAfter['1'].discard.length).toBe(initialP2DiscardSize + 1);
            console.log('✅ 弃牌堆增加了 1 张');
            
            // 验证手牌数量变化：2 - 1（弃牌）+ 1（抽牌）= 2
            expect(playersAfter['1'].hand.length).toBe(2);
            console.log('✅ 手牌数量正确（弃掉 1 张，抽了 1 张）');
            
            console.log('✅ 所有断言通过');
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('影响力9 - 伏击者：对手没有该派系手牌时不执行弃牌', async ({ browser }) => {
        // 构造测试状态：P2 手牌只有 Guild 和 Dynasty 派系（没有 Academy）
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 雇佣剑士（备用手牌）
                deck: ['deck_i_card_02', 'deck_i_card_03'],
                playedCards: [
                    { defId: 'deck_i_card_09', signets: 0, encounterIndex: 0 }, // 伏击者
                ],
            },
            player2: {
                hand: [
                    'deck_i_card_03', // Guild 派系
                    'deck_i_card_04', // Dynasty 派系
                ],
                deck: ['deck_i_card_05', 'deck_i_card_06'],
                playedCards: [
                    { defId: 'deck_i_card_12', signets: 0, encounterIndex: 0 }, // 财务官（影响力12）
                ],
            },
            phase: 'ability',
            currentEncounter: {
                player1Influence: 9,
                player2Influence: 12,
                winnerId: '1', // P2 获胜，P1 失败触发伏击者能力
            },
        });
        
        try {
            console.log('\n=== 边界场景：对手没有该派系手牌 ===');
            
            await setup.player1Page.waitForTimeout(2000);
            
            // 验证初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                hand: Array<{ defId: string; faction: string }>; 
                discard: Array<{ defId: string }>;
            };
            const players = initialState.players as Record<string, PlayerState>;
            
            console.log('初始状态:', {
                p2Hand: players['1'].hand.map(c => ({ defId: c.defId, faction: c.faction })),
            });
            
            expect(players['1'].hand.length).toBe(2);
            
            const initialP2DiscardSize = players['1'].discard.length;
            const ambusherCard = players['0'].playedCards[0];
            
            console.log('\n=== 阶段2：激活能力并选择 Academy 派系 ===');
            
            console.log('激活伏击者能力', ambusherCard.uid);
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 等待派系选择弹窗出现
            const modal = setup.player1Page.locator('[data-testid="faction-selection-modal"]');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 派系选择弹窗已显示');
            
            // 选择 Academy 派系（P2 手牌中没有 Academy 派系）
            const academyButton = modal.locator('[data-testid="faction-option-academy"]');
            await academyButton.click();
            await setup.player1Page.waitForTimeout(500);
            console.log('✅ 已选择 Academy 派系');
            
            // 等待弹窗关闭
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            
            // 等待能力执行完成
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            console.log('\n=== 阶段3：验证结果 ===');
            
            // 验证：P2 手牌数量不变（没有该派系手牌，不执行弃牌）
            const stateAfter = await readCoreState(setup.player1Page);
            const playersAfter = stateAfter.players as Record<string, PlayerState>;
            
            console.log('能力执行后:', {
                p2HandSize: playersAfter['1'].hand.length,
                p2Hand: playersAfter['1'].hand.map(c => ({ defId: c.defId, faction: c.faction })),
                p2DiscardSize: playersAfter['1'].discard.length,
            });
            
            // 验证：回合结束后 P2 抽 1 张牌，手牌从 2 张变为 3 张
            expect(playersAfter['1'].hand.length).toBe(3);
            console.log('✅ P2 手牌数量正确（没有弃牌，只抽了 1 张）');
            
            // 验证：弃牌堆不增加（没有该派系手牌）
            expect(playersAfter['1'].discard.length).toBe(initialP2DiscardSize);
            console.log('✅ 弃牌堆不增加（没有该派系手牌）');
            
            // 验证：剩余手牌中没有 Academy 派系（本来就没有）
            const academyCards = playersAfter['1'].hand.filter(c => c.faction === 'academy');
            expect(academyCards.length).toBe(0);
            console.log('✅ P2 手牌中没有 Academy 派系');
            
            console.log('✅ 所有断言通过');
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('影响力9 - 伏击者：对手有多张该派系手牌时全部弃掉', async ({ browser }) => {
        // 构造测试状态：P2 手牌有 3 张 Academy 派系卡牌
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 雇佣剑士（备用手牌）
                deck: ['deck_i_card_03', 'deck_i_card_04'],
                playedCards: [
                    { defId: 'deck_i_card_09', signets: 0, encounterIndex: 0 }, // 伏击者
                ],
            },
            player2: {
                hand: [
                    'deck_i_card_02', // Academy 派系
                    'deck_i_card_06', // Academy 派系
                    'deck_i_card_14', // Academy 派系
                ],
                deck: ['deck_i_card_03', 'deck_i_card_04'],
                playedCards: [
                    { defId: 'deck_i_card_12', signets: 0, encounterIndex: 0 }, // 财务官（影响力12）
                ],
            },
            phase: 'ability',
            currentEncounter: {
                player1Influence: 9,
                player2Influence: 12,
                winnerId: '1', // P2 获胜，P1 失败触发伏击者能力
            },
        });
        
        try {
            console.log('\n=== 边界场景：对手有多张该派系手牌 ===');
            
            await setup.player1Page.waitForTimeout(2000);
            
            // 验证初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                hand: Array<{ defId: string; faction: string }>; 
                discard: Array<{ defId: string }>;
                playedCards: Array<{ uid: string; defId: string }>;
            };
            const players = initialState.players as Record<string, PlayerState>;
            
            console.log('初始状态:', {
                p2Hand: players['1'].hand.map(c => ({ defId: c.defId, faction: c.faction })),
            });
            
            expect(players['1'].hand.length).toBe(3);
            
            const initialP2DiscardSize = players['1'].discard.length;
            const ambusherCard = players['0'].playedCards[0];
            
            console.log('\n=== 阶段2：激活能力并选择 Academy 派系 ===');
            
            console.log('激活伏击者能力', ambusherCard.uid);
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 等待派系选择弹窗出现
            const modal = setup.player1Page.locator('[data-testid="faction-selection-modal"]');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 派系选择弹窗已显示');
            
            // 选择 Academy 派系（P2 手牌中有 3 张 Academy 派系）
            const academyButton = modal.locator('[data-testid="faction-option-academy"]');
            await academyButton.click();
            await setup.player1Page.waitForTimeout(500);
            console.log('✅ 已选择 Academy 派系');
            
            // 等待弹窗关闭
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            
            // 等待能力执行完成
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            console.log('\n=== 阶段3：验证结果 ===');
            
            // 验证：P2 的所有 Academy 派系手牌被弃掉
            const stateAfter = await readCoreState(setup.player1Page);
            const playersAfter = stateAfter.players as Record<string, PlayerState>;
            
            console.log('能力执行后:', {
                p2HandSize: playersAfter['1'].hand.length,
                p2Hand: playersAfter['1'].hand.map(c => ({ defId: c.defId, faction: c.faction })),
                p2DiscardSize: playersAfter['1'].discard.length,
            });
            
            // 验证：所有 Academy 派系手牌被弃掉
            const academyCards = playersAfter['1'].hand.filter(c => c.faction === 'academy');
            expect(academyCards.length).toBe(0);
            console.log('✅ P2 的所有 Academy 派系手牌被弃掉');
            
            // 验证：弃牌堆增加了 3 张（被弃掉的 Academy 派系手牌）
            expect(playersAfter['1'].discard.length).toBe(initialP2DiscardSize + 3);
            console.log('✅ 弃牌堆增加了 3 张');
            
            // 验证：手牌数量变化：3 - 3（弃牌）+ 1（抽牌）= 1
            expect(playersAfter['1'].hand.length).toBe(1);
            console.log('✅ 手牌数量正确（弃掉 3 张，抽了 1 张）');
            
            console.log('✅ 所有断言通过');
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('影响力9 - 伏击者：选择不同派系（Guild）', async ({ browser }) => {
        // 构造测试状态：P2 手牌有 Academy 和 Guild 派系
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 雇佣剑士（备用手牌）
                deck: ['deck_i_card_02', 'deck_i_card_04'],
                playedCards: [
                    { defId: 'deck_i_card_09', signets: 0, encounterIndex: 0 }, // 伏击者
                ],
            },
            player2: {
                hand: [
                    'deck_i_card_02', // Academy 派系
                    'deck_i_card_03', // Guild 派系
                ],
                deck: ['deck_i_card_04', 'deck_i_card_05'],
                playedCards: [
                    { defId: 'deck_i_card_12', signets: 0, encounterIndex: 0 }, // 财务官（影响力12）
                ],
            },
            phase: 'ability',
            currentEncounter: {
                player1Influence: 9,
                player2Influence: 12,
                winnerId: '1', // P2 获胜，P1 失败触发伏击者能力
            },
        });
        
        try {
            console.log('\n=== 边界场景：选择不同派系 ===');
            
            await setup.player1Page.waitForTimeout(2000);
            
            // 验证初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                hand: Array<{ defId: string; faction: string }>; 
                discard: Array<{ defId: string }>;
                playedCards: Array<{ uid: string; defId: string }>;
            };
            const players = initialState.players as Record<string, PlayerState>;
            
            console.log('初始状态:', {
                p2Hand: players['1'].hand.map(c => ({ defId: c.defId, faction: c.faction })),
            });
            
            expect(players['1'].hand.length).toBe(2);
            
            const initialP2DiscardSize = players['1'].discard.length;
            const ambusherCard = players['0'].playedCards[0];
            
            console.log('\n=== 阶段2：激活能力并选择 Guild 派系 ===');
            
            console.log('激活伏击者能力', ambusherCard.uid);
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 等待派系选择弹窗出现
            const modal = setup.player1Page.locator('[data-testid="faction-selection-modal"]');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 派系选择弹窗已显示');
            
            // 选择 Guild 派系（P2 手牌中有 1 张 Guild 派系）
            const guildButton = modal.locator('[data-testid="faction-option-guild"]');
            await guildButton.click();
            await setup.player1Page.waitForTimeout(500);
            console.log('✅ 已选择 Guild 派系');
            
            // 等待弹窗关闭
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            
            // 等待能力执行完成
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            console.log('\n=== 阶段3：验证结果 ===');
            
            // 验证：P2 的 Guild 派系手牌被弃掉，Academy 派系手牌保留
            const stateAfter = await readCoreState(setup.player1Page);
            const playersAfter = stateAfter.players as Record<string, PlayerState>;
            
            console.log('能力执行后:', {
                p2HandSize: playersAfter['1'].hand.length,
                p2Hand: playersAfter['1'].hand.map(c => ({ defId: c.defId, faction: c.faction })),
                p2DiscardSize: playersAfter['1'].discard.length,
            });
            
            // 验证：Guild 派系手牌被弃掉
            const guildCards = playersAfter['1'].hand.filter(c => c.faction === 'guild');
            expect(guildCards.length).toBe(0);
            console.log('✅ P2 的 Guild 派系手牌被弃掉');
            
            // 验证：Academy 派系手牌保留
            const academyCards = playersAfter['1'].hand.filter(c => c.faction === 'academy');
            expect(academyCards.length).toBe(1);
            console.log('✅ P2 的 Academy 派系手牌保留');
            
            // 验证：弃牌堆增加了 1 张（被弃掉的 Guild 派系手牌）
            expect(playersAfter['1'].discard.length).toBe(initialP2DiscardSize + 1);
            console.log('✅ 弃牌堆增加了 1 张');
            
            // 验证：手牌数量变化：2 - 1（弃牌）+ 1（抽牌）= 2
            expect(playersAfter['1'].hand.length).toBe(2);
            console.log('✅ 手牌数量正确（弃掉 1 张，抽了 1 张）');
            
            console.log('✅ 所有断言通过');
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
