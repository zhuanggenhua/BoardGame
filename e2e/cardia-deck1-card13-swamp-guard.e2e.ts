import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力13 - 沼泽守卫（使用新API重写）
 * 能力：拿取一张你之前打出的牌回到手上，并弃掉其相对的牌
 * 
 * 能力类型：即时能力（instant）
 * 效果：
 * - 步骤1：P1 选择一张自己之前打出的牌
 * - 步骤2：该牌回到 P1 手上
 * - 步骤3：该牌相对的 P2 的牌被弃掉
 * 
 * 测试场景：
 * - P1 之前打出了 2 张牌（card01 和 card03）
 * - P2 之前打出了 2 张牌（card02 和 card05）
 * - P1 打出影响力13（沼泽守卫）
 * - P2 打出影响力14（女导师）
 * - P1 失败（13 < 14），激活沼泽守卫能力
 * - P1 选择回收 card01
 * - 验证：card01 回到 P1 手上，card02（相对的牌）被弃掉
 * 
 * 对比旧版本：
 * - 旧版：~150行代码，手动注入状态
 * - 新版：~100行代码，使用 setupCardiaTestScenario 一行配置
 */
test.describe('Cardia 一号牌组 - 沼泽守卫（新API）', () => {
    test('影响力13 - 沼泽守卫：回收已打出的牌并弃掉相对的牌', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_13'], // 沼泽守卫（影响力13）
                deck: ['deck_i_card_15', 'deck_i_card_16'],
                playedCards: [
                    { defId: 'deck_i_card_01', signets: 1, encounterIndex: 0 }, // 雇佣剑士（影响力1）
                    { defId: 'deck_i_card_03', signets: 0, encounterIndex: 1 }, // 外科医生（影响力3）
                ],
            },
            player2: {
                hand: ['deck_i_card_14'], // 女导师（影响力14）
                deck: ['deck_i_card_07', 'deck_i_card_11'],
                playedCards: [
                    { defId: 'deck_i_card_02', signets: 0, encounterIndex: 0 }, // 虚空法师（影响力2）
                    { defId: 'deck_i_card_05', signets: 1, encounterIndex: 1 }, // 破坏者（影响力5）
                ],
            },
            phase: 'play',
        });
        
        // 捕获浏览器控制台日志
        setup.player1Page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[SwampGuard]') || text.includes('[CardiaEventSystem]') || text.includes('[Cardia]')) {
                console.log(`[Browser ${msg.type()}] ${text}`);
            }
        });
        
        try {
            console.log('\n=== 阶段1：打出卡牌 ===');
            
            // 1. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                hand: Array<{ uid: string; defId: string }>;
                playedCards: Array<{ uid: string; defId: string; encounterIndex: number }>;
                discard: unknown[];
            };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1HandSize = players['0'].hand.length;
            const initialP1PlayedSize = players['0'].playedCards.length;
            const initialP2PlayedSize = players['1'].playedCards.length;
            const initialP2DiscardSize = players['1'].discard.length;
            
            // 记录要回收的牌的 UID（encounterIndex=0 的牌）
            const targetCard = players['0'].playedCards.find(c => c.encounterIndex === 0);
            const targetCardUid = targetCard?.uid;
            const targetCardDefId = targetCard?.defId;
            
            // 记录相对的牌的 UID（P2 的 encounterIndex=0 的牌）
            const oppositeCard = players['1'].playedCards.find(c => c.encounterIndex === 0);
            const oppositeCardUid = oppositeCard?.uid;
            const oppositeCardDefId = oppositeCard?.defId;
            
            console.log('初始状态:', {
                p1HandSize: initialP1HandSize,
                p1PlayedSize: initialP1PlayedSize,
                p2PlayedSize: initialP2PlayedSize,
                p2DiscardSize: initialP2DiscardSize,
                targetCard: { uid: targetCardUid, defId: targetCardDefId },
                oppositeCard: { uid: oppositeCardUid, defId: oppositeCardDefId },
            });
            
            // 2. P1 打出影响力13（沼泽守卫）
            console.log('P1 打出影响力13（沼泽守卫）');
            await playCard(setup.player1Page, 0);
            
            // 3. P2 打出影响力14（女导师）
            console.log('P2 打出影响力14（女导师）');
            await playCard(setup.player2Page, 0);
            
            console.log('\n=== 阶段2：激活能力 ===');
            
            // 4. 等待进入能力阶段（P1失败，应该有能力按钮）
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 5. 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活沼泽守卫能力');
            
            // 检查激活前的状态
            const stateBeforeActivate = await setup.player1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                return {
                    currentCard: state?.core?.players?.['0']?.playedCards?.find((c: any) => c.encounterIndex === state.core.turnNumber),
                    hasInteraction: !!state?.sys?.interaction?.current,
                    currentInteractionSourceId: state?.sys?.interaction?.current?.data?.sourceId,
                    queuedInteractions: state?.sys?.interaction?.queue?.map((i: any) => ({
                        id: i.id,
                        sourceId: i.data?.sourceId,
                        playerId: i.playerId,
                    })),
                };
            });
            console.log('激活前状态:', stateBeforeActivate);
            
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 6. 等待卡牌选择弹窗出现
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 卡牌选择弹窗已显示');
            
            // 检查交互数据结构
            const interactionData = await setup.player1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                const interaction = state?.sys?.interaction?.current;
                return {
                    hasInteraction: !!interaction,
                    interactionType: interaction?.data?.interactionType,
                    sourceId: interaction?.data?.sourceId,
                    options: interaction?.data?.options?.map((opt: any) => ({
                        id: opt.id,
                        label: opt.label,
                        value: opt.value,
                    })),
                    cards: interaction?.data?.cards?.map((c: any) => ({
                        uid: c.uid,
                        defId: c.defId,
                        optionId: c.optionId,
                    })),
                };
            });
            console.log('交互数据结构:', JSON.stringify(interactionData, null, 2));
            
            // 7. 选择第一张已打出的牌（encounterIndex=0，雇佣剑士）
            // 枚举所有按钮，找到第一个启用的卡牌按钮（排除确认/取消按钮）
            const allButtons = modal.locator('button');
            const count = await allButtons.count();
            
            let cardButtonIndex = -1;
            for (let i = 0; i < count; i++) {
                const text = await allButtons.nth(i).textContent();
                const isEnabled = await allButtons.nth(i).isEnabled();
                if (text && !text.match(/确认|Confirm|取消|Cancel/) && isEnabled) {
                    cardButtonIndex = i;
                    break;
                }
            }
            
            if (cardButtonIndex >= 0) {
                await allButtons.nth(cardButtonIndex).click();
                await setup.player1Page.waitForTimeout(500);
                console.log('✅ 已选择第一张已打出的牌');
            } else {
                throw new Error('未找到可用的卡牌按钮');
            }
            
            // 8. 点击确认按钮
            const confirmButton = modal.locator('button').filter({ hasText: /Confirm|确认/ });
            await confirmButton.first().click({ timeout: 5000 });
            console.log('✅ 已确认选择');
            
            // 9. 等待弹窗关闭（表示交互已处理）
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ 弹窗已关闭');
            
            // 10. 等待能力执行完成（自动回合结束）
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            console.log('\n=== 阶段3：回合结束 ===');
            
            // 11. 验证：目标牌回到 P1 手上，相对的牌被弃掉
            const stateAfter = await readCoreState(setup.player1Page);
            const playersAfter = stateAfter.players as Record<string, PlayerState>;
            
            console.log('回合结束后:', {
                p1HandSize: playersAfter['0'].hand.length,
                p1Hand: playersAfter['0'].hand.map(c => c.defId),
                p1PlayedSize: playersAfter['0'].playedCards.length,
                p2PlayedSize: playersAfter['1'].playedCards.length,
                p2DiscardSize: playersAfter['1'].discard.length,
                phase: stateAfter.phase,
            });
            
            // 核心功能验证1：目标牌回到 P1 手上
            // 初始手牌：1 张（沼泽守卫）
            // P1 打出沼泽守卫：手牌 0 张
            // 回收雇佣剑士：手牌 1 张
            // 回合结束抽牌：手牌 2 张
            expect(playersAfter['0'].hand.length).toBe(initialP1HandSize + 1); // 0 + 1（回收）+ 1（抽牌）= 2
            
            // 验证回收的牌是雇佣剑士
            const recoveredCard = playersAfter['0'].hand.find(c => c.defId === targetCardDefId);
            expect(recoveredCard).toBeDefined();
            console.log('✅ 雇佣剑士已回到 P1 手上');
            
            // 核心功能验证2：P1 的已打出牌数减少 1
            expect(playersAfter['0'].playedCards.length).toBe(initialP1PlayedSize); // 2 - 1（回收）+ 1（新打出）= 2
            
            // 核心功能验证3：相对的牌被弃掉
            // P2 的已打出牌数减少 1
            expect(playersAfter['1'].playedCards.length).toBe(initialP2PlayedSize); // 2 - 1（弃掉）+ 1（新打出）= 2
            
            // P2 的弃牌堆增加 1
            expect(playersAfter['1'].discard.length).toBe(initialP2DiscardSize + 1);
            
            // 验证被弃掉的牌不在 P2 的已打出牌中
            const oppositeCardStillPlayed = playersAfter['1'].playedCards.find(c => c.uid === oppositeCardUid);
            expect(oppositeCardStillPlayed).toBeUndefined();
            console.log('✅ 虚空法师（相对的牌）已被弃掉');
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
