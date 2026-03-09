import { test, expect } from '@playwright/test';
import { 
    setupOnlineMatch,
    readCoreState,
    applyCoreStateDirect,
    type CardiaMatchSetup,
} from './helpers/cardia';

/**
 * 分段测试：验证从手牌弃牌功能
 * 
 * 目的：验证 reduceCardsDiscarded 函数是否正确工作
 * 
 * 测试步骤：
 * 1. 注入测试状态（P2 手牌有 3 张牌）
 * 2. 使用调试面板直接发射 CARDS_DISCARDED 事件
 * 3. 验证：P2 手牌减少，弃牌堆增加
 */
test.describe('Cardia - 从手牌弃牌功能测试', () => {
    let setup: CardiaMatchSetup;

    test.beforeEach(async ({ page }) => {
        setup = await setupOnlineMatch(page);
    });

    test.afterEach(async () => {
        await setup.player1Context.close().catch(() => {});
        await setup.player2Context.close().catch(() => {});
    });

    test('直接发射 CARDS_DISCARDED 事件，验证 reducer 是否正确工作', async () => {
        console.log('\n=== 阶段1：注入测试状态 ===');
        
        // 读取预定义的测试状态
        const fs = await import('fs/promises');
        const path = await import('path');
        const testStateJson = await fs.readFile(
            path.join(process.cwd(), '.kiro/specs/cardia-e2e-test-optimization/CARD09-INJECT-STATE.json'),
            'utf-8'
        );
        const testState = JSON.parse(testStateJson);
        
        // 注入状态
        await applyCoreStateDirect(setup.player1Page, testState);
        await setup.player1Page.waitForTimeout(1000);
        
        // 验证状态注入成功
        const injectedState = await readCoreState(setup.player1Page);
        type PlayerState = { 
            hand: Array<{ uid: string; defId: string; faction: string }>;
            deck: unknown[];
            discard: unknown[];
        };
        const players = injectedState.players as Record<string, PlayerState>;
        
        console.log('注入后的状态:', {
            p2HandSize: players['1'].hand.length,
            p2HandCards: players['1'].hand.map(c => ({ defId: c.defId, faction: c.faction })),
            p2DiscardSize: players['1'].discard.length,
        });
        
        expect(players['1'].hand.length).toBe(3);
        expect(players['1'].discard.length).toBe(0);
        
        // 记录要弃掉的卡牌 UID（2 张 Academy 派系的牌）
        const academyCards = players['1'].hand.filter(c => c.faction === 'academy');
        const cardIdsToDiscard = academyCards.map(c => c.uid);
        
        console.log('\n要弃掉的卡牌:', {
            count: cardIdsToDiscard.length,
            cards: academyCards.map(c => ({ uid: c.uid, defId: c.defId, faction: c.faction })),
        });
        
        expect(cardIdsToDiscard.length).toBe(2);
        
        console.log('\n=== 阶段2：在 Node.js 中直接测试 reduce 函数 ===');
        
        // 在 Node.js 环境中直接导入并测试 reduce 函数
        const { reduce } = await import('../src/games/cardia/domain/reduce.js');
        
        const event = {
            type: 'cardia:cards_discarded',
            payload: {
                playerId: '1',
                cardIds: cardIdsToDiscard,
                from: 'hand',
            },
            timestamp: Date.now(),
        };
        
        console.log('调用 reduce 函数，事件:', event);
        
        // 调用 reduce 函数
        const newCore = reduce(injectedState, event);
        
        console.log('Reduce 结果:', {
            oldHandSize: players['1'].hand.length,
            newHandSize: newCore.players['1'].hand.length,
            oldDiscardSize: players['1'].discard.length,
            newDiscardSize: newCore.players['1'].discard.length,
        });
        
        // 验证 reduce 函数的输出
        expect(newCore.players['1'].hand.length).toBe(1); // 3 - 2 = 1
        expect(newCore.players['1'].discard.length).toBe(2); // 0 + 2 = 2
        
        console.log('✅ Reduce 函数正确工作');
        
        console.log('\n=== 阶段3：将新状态注入到浏览器 ===');
        
        // 将新状态注入到浏览器
        await applyCoreStateDirect(setup.player1Page, newCore);
        
        await setup.player1Page.waitForTimeout(1000);
        
        console.log('\n=== 阶段3：验证结果 ===');
        
        // 验证：P2 手牌减少，弃牌堆增加
        const stateAfter = await readCoreState(setup.player1Page);
        const playersAfter = stateAfter.players as Record<string, PlayerState>;
        
        console.log('\n事件发射后:', {
            p2HandSize: playersAfter['1'].hand.length,
            p2Hand: playersAfter['1'].hand.map(c => ({ defId: c.defId, faction: c.faction })),
            p2DiscardSize: playersAfter['1'].discard.length,
        });
        
        // 核心验证：手牌减少 2 张，弃牌堆增加 2 张
        expect(playersAfter['1'].hand.length).toBe(1); // 3 - 2 = 1
        expect(playersAfter['1'].discard.length).toBe(2); // 0 + 2 = 2
        
        // 验证剩余手牌中没有 Academy 派系
        const remainingAcademyCards = playersAfter['1'].hand.filter(c => c.faction === 'academy');
        expect(remainingAcademyCards.length).toBe(0);
        
        console.log('✅ 从手牌弃牌功能正常工作');
    });
});
