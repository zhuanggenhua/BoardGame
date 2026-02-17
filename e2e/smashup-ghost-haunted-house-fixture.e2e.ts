/**
 * SmashUp E2E 测试：幽灵 + 鬼屋弃牌 bug 修复验证（使用 Fixture 重构版本）
 * 
 * 测试场景：
 * 1. 打出幽灵到鬼屋基地
 * 2. 幽灵 onPlay 触发：弃一张手牌（可跳过）
 * 3. 鬼屋 onMinionPlayed 触发：必须弃一张手牌
 * 4. 验证：第二次弃牌时不能选择第一次已弃掉的牌
 * 
 * 架构验证：optionsGenerator 动态生成选项，确保后续交互看到最新状态
 * 
 * 重构说明：
 * - 使用 fixture 自动管理对局创建和清理
 * - 减少 15+ 行样板代码
 * - 自动处理 context cleanup
 */

import { test, expect, createSmashUpMatch } from './fixtures';
import {
    readCoreState,
    applyCoreState,
} from './helpers/smashup';

test.describe('SmashUp: 幽灵 + 鬼屋弃牌修复（Fixture 版本）', () => {
    test('打出幽灵到鬼屋基地，两次弃牌不能选择同一张牌', async ({ browser }, testInfo) => {
        // 使用工厂函数创建自定义派系配置的对局
        const setup = await createSmashUpMatch(browser, testInfo.project.use.baseURL, {
            hostFactions: [9, 0], // 幽灵 + 海盗
            guestFactions: [1, 2], // 忍者 + 恐龙
        });
        
        if (!setup) {
            test.skip();
            return;
        }

        const { hostPage, hostContext, guestContext } = setup;

        try {
            // 注入测试状态：P0 手牌有幽灵 + 3张其他牌，基地0是鬼屋
            const initialState = await readCoreState(hostPage);
            const modifiedState = {
                ...initialState,
                phase: 'playCards',
                currentPlayerIndex: 0,
                players: {
                    ...initialState.players,
                    '0': {
                        ...initialState.players['0'],
                        hand: [
                            { uid: 'ghost1', defId: 'ghost_ghost', type: 'minion', owner: '0' },
                            { uid: 'h1', defId: 'test_card_a', type: 'action', owner: '0' },
                            { uid: 'h2', defId: 'test_card_b', type: 'action', owner: '0' },
                            { uid: 'h3', defId: 'test_card_c', type: 'action', owner: '0' },
                        ],
                        discard: [],
                        minionLimit: 1,
                        minionsPlayed: 0,
                    },
                },
                bases: [
                    {
                        defId: 'base_haunted_house_al9000',
                        minions: [],
                        ongoingActions: [],
                    },
                    ...initialState.bases.slice(1),
                ],
            };
            await applyCoreState(hostPage, modifiedState);
            await hostPage.waitForTimeout(500);

            // P0 打出幽灵到基地0
            await hostPage.click('[data-card-uid="ghost1"]');
            await hostPage.click('[data-base-index="0"]');

            // 等待第一个交互：幽灵弃牌
            await hostPage.waitForSelector('[data-testid="prompt-overlay"]', { timeout: 5000 });
            await hostPage.waitForTimeout(500);

            // 验证第一个交互的选项包含 h1, h2, h3
            const options1 = await hostPage.locator('[data-testid="prompt-overlay"] [data-option-id]').all();
            const options1Uids = await Promise.all(
                options1.map(opt => opt.getAttribute('data-card-uid'))
            );
            console.log('第一个交互选项 UIDs:', options1Uids);
            expect(options1Uids.filter(Boolean).length).toBeGreaterThanOrEqual(3);

            // 选择弃掉 h1
            await hostPage.click('[data-option-id^="card-"][data-card-uid="h1"]');
            await hostPage.waitForTimeout(500);

            // 等待第二个交互：鬼屋弃牌
            await hostPage.waitForSelector('[data-testid="prompt-overlay"]', { timeout: 5000 });
            await hostPage.waitForTimeout(500);

            // 验证第二个交互的选项不包含 h1（已被弃掉）
            const options2 = await hostPage.locator('[data-testid="prompt-overlay"] [data-option-id]').all();
            const options2Uids = await Promise.all(
                options2.map(opt => opt.getAttribute('data-card-uid'))
            );

            console.log('第二个交互选项 UIDs:', options2Uids);
            expect(options2Uids).not.toContain('h1');
            expect(options2Uids.filter(Boolean).length).toBeGreaterThanOrEqual(2);

            // 选择弃掉 h2
            await hostPage.click('[data-option-id^="card-"][data-card-uid="h2"]');
            await hostPage.waitForTimeout(500);

            // 验证最终状态：h1 和 h2 在弃牌堆，h3 在手牌
            const finalState = await readCoreState(hostPage);
            const p0Hand = finalState.players['0'].hand;
            const p0Discard = finalState.players['0'].discard;

            expect(p0Hand.some((c: any) => c.uid === 'h3')).toBe(true);
            expect(p0Discard.some((c: any) => c.uid === 'h1')).toBe(true);
            expect(p0Discard.some((c: any) => c.uid === 'h2')).toBe(true);

            console.log('✅ 测试通过：两次弃牌正确处理，不会选择同一张牌');
        } finally {
            // Fixture 会自动清理，但这里显式清理以确保
            await hostContext.close().catch(() => {});
            await guestContext.close().catch(() => {});
        }
    });
});
