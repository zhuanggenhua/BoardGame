import { test, expect } from '@playwright/test';
import { 
    setupOnlineMatch,
    readCoreState,
    applyCoreStateDirect,
    type CardiaMatchSetup,
} from './helpers/cardia';

/**
 * 影响力9 - 伏击者
 * 能力：选择一个派系，你的对手弃掉所有该派系的手牌
 * 
 * 能力类型：即时能力（instant）
 * 效果：
 * - 步骤1：P1 选择一个派系
 * - 步骤2：P2 弃掉所有该派系的手牌
 * 
 * 测试场景：
 * - 使用调试面板注入测试状态（play 阶段）
 * - P1 出伏击者卡牌
 * - P2 出牌（自动或手动）
 * - P1 激活伏击者能力
 * - P1 选择派系（Academy）
 * - 验证：P2 的 Academy 派系手牌被弃掉
 */
test.describe('Cardia 一号牌组 - 伏击者', () => {
    let setup: CardiaMatchSetup;

    test.beforeEach(async ({ page }) => {
        setup = await setupOnlineMatch(page);
        
        // 捕获所有浏览器控制台日志
        setup.player1Page.on('console', msg => {
            console.log(`[Browser ${msg.type()}] ${msg.text()}`);
        });
    });

    test.afterEach(async () => {
        await setup.player1Context.close().catch(() => {});
        await setup.player2Context.close().catch(() => {});
    });

    test('影响力9 - 伏击者：对手弃掉所有指定派系的手牌', async () => {
        console.log('\n=== 阶段1：注入测试状态 ===');
        
        // 读取预定义的测试状态（已经是 ability 阶段，双方都已出牌）
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
        console.log('注入后的状态:', {
            phase: injectedState.phase,
            currentPlayerId: injectedState.currentPlayerId,
            p1Hand: (injectedState.players as any)['0'].hand.length,
            p2Hand: (injectedState.players as any)['1'].hand.length,
            p2HandCards: (injectedState.players as any)['1'].hand.map((c: any) => ({ defId: c.defId, faction: c.faction })),
            p1HasPlayed: (injectedState.players as any)['0'].hasPlayed,
            p2HasPlayed: (injectedState.players as any)['1'].hasPlayed,
            currentEncounter: (injectedState as any).currentEncounter,
        });
        
        expect(injectedState.phase).toBe('ability');
        expect((injectedState.players as any)['0'].hand.length).toBe(1); // P1 手牌：1 张（伏击者已出）
        expect((injectedState.players as any)['1'].hand.length).toBe(2); // P2 手牌：2 张（1 张 Academy + 1 张 Guild，Judge 已出）
        expect((injectedState.players as any)['0'].hasPlayed).toBe(true);
        expect((injectedState.players as any)['1'].hasPlayed).toBe(true);
        
        console.log('\n=== 阶段2：激活能力 ===');
        
        // 记录初始状态
        type PlayerState = { 
            hand: Array<{ uid: string; defId: string; faction: string }>;
            deck: unknown[];
            discard: unknown[];
        };
        const players = injectedState.players as Record<string, PlayerState>;
        const initialP2HandSize = players['1'].hand.length;
        const initialP2DiscardSize = players['1'].discard.length;
        
        // 激活能力
        const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
        await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
        console.log('激活伏击者能力');
        await abilityButton.click();
        await setup.player1Page.waitForTimeout(1000);
        
        // 检查交互是否被创建
        const stateAfterActivate = await setup.player1Page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return {
                hasInteraction: !!state?.sys?.interaction?.current,
                interactionType: state?.sys?.interaction?.current?.data?.interactionType,
                interactionSourceId: state?.sys?.interaction?.current?.data?.sourceId,
            };
        });
        console.log('激活能力后的交互状态:', stateAfterActivate);
        
        // 等待派系选择弹窗出现
        const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
        await modal.waitFor({ state: 'visible', timeout: 5000 });
        console.log('✅ 派系选择弹窗已显示');
        
        // 选择 Academy 派系（P2 手牌中有 1 张 Academy 派系的牌）
        const factionButtons = modal.locator('button');
        const academyButton = factionButtons.nth(1); // 第二个是 Academy
        await academyButton.click();
        await setup.player1Page.waitForTimeout(500);
        console.log('✅ 已选择 Academy 派系');
        
        // 检查选择后的状态
        const stateAfterSelect = await setup.player1Page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return {
                hasInteraction: !!state?.sys?.interaction?.current,
                eventStreamLength: state?.sys?.eventStream?.entries?.length || 0,
                lastEvent: state?.sys?.eventStream?.entries?.[state.sys.eventStream.entries.length - 1],
            };
        });
        console.log('选择派系后的状态:', stateAfterSelect);
        
        // 等待弹窗关闭（表示交互已处理）
        await modal.waitFor({ state: 'hidden', timeout: 5000 });
        console.log('✅ 弹窗已关闭');
        
        // 等待能力执行完成（自动回合结束）
        console.log('等待回合结束...');
        await setup.player1Page.waitForTimeout(2000);
        
        console.log('\n=== 阶段3：验证结果 ===');
        
        // 验证：P2 的 Academy 派系手牌被弃掉
        const stateAfter = await readCoreState(setup.player1Page);
        const playersAfter = stateAfter.players as Record<string, PlayerState>;
        
        console.log('\n能力执行后:', {
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
    });
});
