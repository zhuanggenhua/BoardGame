/**
 * E2E 测试：调停者持续标记被移除后重新判定胜负
 * 
 * Bug 场景：
 * 1. 第一次遭遇：玩家0打出card04（影响力4），玩家1打出card11（影响力11）
 * 2. 玩家1获胜，card11获得1枚印戒
 * 3. 玩家0激活调停者能力，放置持续标记，强制平局，移除card11的印戒
 * 4. 第二次遭遇：玩家1打出card02（虚空法师），激活能力移除card04的持续标记
 * 5. 预期：card11应该重新获得1枚印戒（因为调停者效果失效，恢复原本的胜负结果）
 */

import { test, expect } from '../framework';

test('调停者标记被移除后应该重新判定胜负并授予印戒', async ({ page, game }, testInfo) => {
    await page.goto('/play/cardia');
    await page.waitForFunction(() => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered());
    
    // 设置初始场景：第一次遭遇已完成，调停者能力已激活
    await game.setupScene({
        gameId: 'cardia',
        player0: {
            hand: [],
            deck: [],
            playedCards: [
                {
                    defId: 'deck_i_card_04',
                    encounterIndex: 1,
                    signets: 0,
                    ongoingMarkers: ['ability_i_mediator'],
                },
                {
                    defId: 'deck_i_card_09',
                    encounterIndex: 2,
                    signets: 1,
                },
            ],
        },
        player1: {
            hand: [],
            deck: [],
            playedCards: [
                {
                    defId: 'deck_i_card_11',
                    encounterIndex: 1,
                    signets: 0,  // 调停者效果生效，印戒被移除
                },
                {
                    defId: 'deck_i_card_02',
                    encounterIndex: 2,
                },
            ],
        },
        currentPlayer: '1',
        phase: 'ability',
        turnNumber: 2,
        encounterHistory: [
            {
                player1Card: { defId: 'deck_i_card_04', baseInfluence: 4 },
                player2Card: { defId: 'deck_i_card_11', baseInfluence: 11 },
                player1Influence: 4,
                player2Influence: 11,
                winnerId: '1',
                loserId: '0',
            },
            {
                player1Card: { defId: 'deck_i_card_09', baseInfluence: 9 },
                player2Card: { defId: 'deck_i_card_02', baseInfluence: 2 },
                player1Influence: 9,
                player2Influence: 2,
                winnerId: '0',
                loserId: '1',
            },
        ],
        ongoingAbilities: [
            {
                abilityId: 'ability_i_mediator',
                cardId: 'deck_i_card_04_xxx',
                playerId: '0',
                effectType: 'forceTie',
                encounterIndex: 1,
            },
        ],
    });
    
    await page.waitForTimeout(2000);
    
    // 截图：初始状态
    await game.screenshot('01-initial-state', testInfo);
    
    // 验证初始状态：card11没有印戒（因为调停者效果）
    const initialState = await game.readCoreState();
    const card11Initial = initialState.players['1'].playedCards.find((c: any) => c.defId === 'deck_i_card_11');
    expect(card11Initial.signets).toBe(0);
    console.log('✅ 初始状态：card11没有印戒（调停者效果生效）');
    
    // 玩家1激活虚空法师能力
    await page.click('button:has-text("激活能力")');
    await page.waitForTimeout(1000);
    
    // 截图：能力激活后的交互界面
    await game.screenshot('02-void-mage-interaction', testInfo);
    
    // 选择card04作为目标（移除调停者标记）
    await page.click('[data-card-uid*="deck_i_card_04"]');
    await page.waitForTimeout(2000);
    
    // 截图：移除标记后的状态
    await game.screenshot('03-after-marker-removed', testInfo);
    
    // 验证：调停者标记已被移除
    const stateAfterRemoval = await game.readCoreState();
    const card04AfterRemoval = stateAfterRemoval.players['0'].playedCards.find((c: any) => c.defId === 'deck_i_card_04');
    expect(card04AfterRemoval.ongoingMarkers).toHaveLength(0);
    console.log('✅ 调停者标记已被移除');
    
    // 验证：card11重新获得1枚印戒
    const card11AfterRemoval = stateAfterRemoval.players['1'].playedCards.find((c: any) => c.defId === 'deck_i_card_11');
    expect(card11AfterRemoval.signets).toBe(1);
    console.log('✅ card11重新获得1枚印戒（调停者效果失效，恢复原本的胜负结果）');
    
    // 验证：ongoingAbilities中没有调停者记录
    expect(stateAfterRemoval.ongoingAbilities).toHaveLength(0);
    console.log('✅ ongoingAbilities中没有调停者记录');
    
    // 截图：最终状态
    await game.screenshot('04-final-state', testInfo);
});
