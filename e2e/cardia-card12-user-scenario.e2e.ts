/**
 * Cardia 财务官（card12）能力测试 - 用户真实场景复现
 * 
 * 场景：
 * - 回合2：P1 打出财务官（12），P2 打出精灵（16），P2 获胜
 * - P1 激活财务官能力（持续标记已放置）
 * - 回合3：P1 打出任意牌，P2 打出任意牌，遭遇结算
 * - 预期：精灵应该获得额外印戒（从 1 枚变成 2 枚）
 * 
 * 注：使用状态注入，直接设置财务官能力已激活的状态
 */

import { test, expect } from './framework';

test('财务官能力 - 用户真实场景：P1 激活财务官，P2 上一个遭遇获胜，下一个遭遇精灵应获得额外印戒', async ({ page, game }, testInfo) => {
    await page.goto('/play/cardia');
    await page.waitForFunction(() => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered());
    
    // 构造初始状态：回合3开始，财务官能力已激活
    // 回合2：P1 的财务官（12）vs P2 的精灵（16），P2 获胜，P1 激活了财务官能力
    await game.setupScene({
        gameId: 'cardia',
        player0: {
            hand: [
                { defId: 'deck_i_card_01', uid: 'p0-hand-1' }, // 雇佣剑士（1）
            ],
            playedCards: [
                { 
                    defId: 'deck_i_card_12', 
                    uid: 'p0-card12', 
                    encounterIndex: 1, 
                    signets: 0,
                    ongoingMarkers: ['ability_i_treasurer'], // 财务官能力已激活
                }, // 财务官（12）
            ],
            deck: [
                { defId: 'deck_i_card_02', uid: 'p0-deck-1' },
                { defId: 'deck_i_card_03', uid: 'p0-deck-2' },
            ],
            discard: [],
            currentCard: null,
            hasPlayed: false,
            cardRevealed: false,
        },
        player1: {
            hand: [
                { defId: 'deck_i_card_02', uid: 'p1-hand-1' }, // 虚空法师（2）
            ],
            playedCards: [
                { defId: 'deck_i_card_16', uid: 'p1-card16', encounterIndex: 1, signets: 1 }, // 精灵（16），已有1枚印戒
            ],
            deck: [
                { defId: 'deck_i_card_03', uid: 'p1-deck-1' },
                { defId: 'deck_i_card_04', uid: 'p1-deck-2' },
            ],
            discard: [],
            currentCard: null,
            hasPlayed: false,
            cardRevealed: false,
        },
        currentPlayer: '0',
        phase: 'play',
        turnNumber: 2, // 回合3
        encounterHistory: [
            {
                player1Card: { defId: 'deck_i_card_12', uid: 'p0-card12', ownerId: '0', baseInfluence: 12 },
                player2Card: { defId: 'deck_i_card_16', uid: 'p1-card16', ownerId: '1', baseInfluence: 16 },
                player1Influence: 12,
                player2Influence: 16,
                winnerId: '1', // P2 获胜
                loserId: '0',
            },
        ],
        currentEncounter: undefined, // 新回合开始，还没有当前遭遇
        previousEncounter: {
            player1Card: { defId: 'deck_i_card_12', uid: 'p0-card12', ownerId: '0', baseInfluence: 12 },
            player2Card: { defId: 'deck_i_card_16', uid: 'p1-card16', ownerId: '1', baseInfluence: 16 },
            player1Influence: 12,
            player2Influence: 16,
            winnerId: '1', // P2 获胜
            loserId: '0',
        },
        modifierTokens: [],
        ongoingAbilities: [
            {
                abilityId: 'ability_i_treasurer',
                cardId: 'p0-card12',
                playerId: '0',
                effectType: 'extraSignet',
                timestamp: Date.now(),
                encounterIndex: 1,
            },
        ],
        delayedEffects: [],
    });
    
    await page.waitForTimeout(2000);
    await game.screenshot('01-initial-state', testInfo);
    
    // 验证初始状态
    const initialState = await game.getState();
    console.log('[Test] 初始状态:', {
        turnNumber: initialState.core.turnNumber,
        phase: initialState.sys.phase,
        currentPlayerId: initialState.core.currentPlayerId,
        previousEncounter: initialState.core.previousEncounter ? {
            winnerId: initialState.core.previousEncounter.winnerId,
            player1CardUid: initialState.core.previousEncounter.player1Card?.uid,
            player2CardUid: initialState.core.previousEncounter.player2Card?.uid,
        } : null,
        ongoingAbilities: initialState.core.ongoingAbilities,
        elfSignets: initialState.core.players['1'].playedCards.find((c: any) => c.uid === 'p1-card16')?.signets,
    });
    
    expect(initialState.core.turnNumber).toBe(2); // 回合3
    expect(initialState.sys.phase).toBe('play');
    expect(initialState.core.previousEncounter).toBeDefined();
    expect(initialState.core.previousEncounter?.winnerId).toBe('1'); // P2 获胜
    expect(initialState.core.ongoingAbilities).toContainEqual(
        expect.objectContaining({
            abilityId: 'ability_i_treasurer',
            playerId: '0',
        })
    );
    
    // P1 打出雇佣剑士（1）
    console.log('[Test] P1 打出雇佣剑士');
    await page.click('[data-testid="hand-card-p0-hand-1"]');
    await page.waitForTimeout(2000);
    await game.screenshot('02-p1-played-card', testInfo);
    
    // P2 打出虚空法师（2）
    console.log('[Test] P2 打出虚空法师');
    await page.click('[data-testid="hand-card-p1-hand-1"]');
    await page.waitForTimeout(3000);
    await game.screenshot('03-encounter-resolved', testInfo);
    
    // 验证遭遇结算后，精灵应该有2枚印戒（基础1枚 + 财务官额外1枚）
    const afterEncounter = await game.getState();
    console.log('[Test] 遭遇结算后状态:', {
        turnNumber: afterEncounter.core.turnNumber,
        phase: afterEncounter.sys.phase,
        player1PlayedCards: afterEncounter.core.players['1'].playedCards.map((c: any) => ({
            uid: c.uid,
            defId: c.defId,
            signets: c.signets,
        })),
        ongoingAbilities: afterEncounter.core.ongoingAbilities,
    });
    
    // 查找精灵卡牌
    const elfCard = afterEncounter.core.players['1'].playedCards.find((c: any) => c.uid === 'p1-card16');
    console.log('[Test] 精灵卡牌状态:', elfCard);
    
    expect(elfCard).toBeDefined();
    expect(elfCard?.signets).toBe(2); // 应该有2枚印戒（基础1枚 + 财务官额外1枚）
    
    // 验证财务官能力已被移除（一次性效果）
    expect(afterEncounter.core.ongoingAbilities).not.toContainEqual(
        expect.objectContaining({
            abilityId: 'ability_i_treasurer',
        })
    );
    
    await game.screenshot('04-final-state', testInfo);
});
