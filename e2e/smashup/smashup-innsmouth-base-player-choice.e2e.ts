/**
 * 印斯茅斯基地 E2E 测试 - 玩家选择修复
 * 
 * 测试场景：
 * 1. 玩家 0 打出随从到印斯茅斯基地
 * 2. 第一步：选择从哪个玩家的弃牌堆选卡（自己或对手）
 * 3. 第二步：从该玩家的弃牌堆选择一张卡
 * 4. 验证卡牌被放入牌库底
 */

import { test, expect } from '../fixtures';

test.describe('印斯茅斯基地 - 玩家选择修复', () => {
    test('场景1：选择从自己的弃牌堆选卡', async ({ smashupMatch }) => {
        const { hostPage: page } = smashupMatch;

        // 注入状态：玩家 0 有弃牌堆卡牌，玩家 1 弃牌堆为空
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.state.patch({
                'core.bases.0.defId': 'base_innsmouth_base',
                'core.bases.0.breakpoint': 20,
                'core.players.0.hand': [
                    { uid: 'minion-1', defId: 'ninja_shinobi', type: 'minion', owner: '0' }
                ],
                'core.players.0.discard': [
                    { uid: 'discard-1', defId: 'ninja_infiltrate', type: 'action', owner: '0' },
                    { uid: 'discard-2', defId: 'alien_abduction', type: 'action', owner: '0' }
                ],
                'core.players.0.deck': [],
                'core.players.1.discard': [], // 对手弃牌堆为空
                'core.currentPlayer': '0',
                'core.phase': 'playCards'
            });
        });

        // 玩家 0 打出随从到基地 0
        await page.click('button:has-text("打出随从")');
        await page.click('[data-card-uid="minion-1"]');
        await page.click('[data-base-index="0"]');

        // 等待第一步交互出现
        await page.waitForSelector('text=印斯茅斯基地：选择从哪个玩家的弃牌堆选卡', { timeout: 5000 });

        // 截图：第一步交互（选择玩家）
        await page.screenshot({ path: 'test-results/innsmouth-step1-choose-player.png' });

        // 验证：应该显示"你自己的弃牌堆"选项（对手弃牌堆为空，不显示）
        await expect(page.locator('text=你自己的弃牌堆')).toBeVisible();
        await expect(page.locator('text=玩家二的弃牌堆')).not.toBeVisible(); // 对手弃牌堆为空，不显示

        // 选择"你自己的弃牌堆"
        await page.click('button:has-text("你自己的弃牌堆")');

        // 等待第二步交互出现
        await page.waitForSelector('text=印斯茅斯基地：从你的弃牌堆选择一张卡', { timeout: 5000 });

        // 截图：第二步交互（选择卡牌）
        await page.screenshot({ path: 'test-results/innsmouth-step2-choose-card.png' });

        // 验证：应该显示自己弃牌堆的卡牌
        await expect(page.locator('text=潜行')).toBeVisible(); // ninja_infiltrate
        await expect(page.locator('text=绑架')).toBeVisible(); // alien_abduction

        // 选择一张卡
        await page.click('button:has-text("潜行")');

        // 验证：卡牌被放入牌库底
        const state = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.read();
        });

        expect(state.core.players['0'].deck).toHaveLength(1);
        expect(state.core.players['0'].deck[0].defId).toBe('ninja_infiltrate');
        expect(state.core.players['0'].discard).toHaveLength(1); // 只剩一张
    });

    test('场景2：选择从对手的弃牌堆选卡', async ({ smashupMatch }) => {
        const { hostPage: page } = smashupMatch;

        // 注入状态：玩家 0 和玩家 1 都有弃牌堆卡牌
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.state.patch({
                'core.bases.0.defId': 'base_innsmouth_base',
                'core.bases.0.breakpoint': 20,
                'core.players.0.hand': [
                    { uid: 'minion-1', defId: 'ninja_shinobi', type: 'minion', owner: '0' }
                ],
                'core.players.0.discard': [
                    { uid: 'discard-1', defId: 'ninja_infiltrate', type: 'action', owner: '0' }
                ],
                'core.players.0.deck': [],
                'core.players.1.discard': [
                    { uid: 'discard-2', defId: 'dinosaur_king_rex', type: 'minion', owner: '1' },
                    { uid: 'discard-3', defId: 'robot_microbot_alpha', type: 'minion', owner: '1' }
                ],
                'core.players.1.deck': [],
                'core.currentPlayer': '0',
                'core.phase': 'playCards'
            });
        });

        // 玩家 0 打出随从到基地 0
        await page.click('button:has-text("打出随从")');
        await page.click('[data-card-uid="minion-1"]');
        await page.click('[data-base-index="0"]');

        // 等待第一步交互出现
        await page.waitForSelector('text=印斯茅斯基地：选择从哪个玩家的弃牌堆选卡', { timeout: 5000 });

        // 截图：第一步交互（选择玩家）
        await page.screenshot({ path: 'test-results/innsmouth-step1-both-players.png' });

        // 验证：应该显示两个选项
        await expect(page.locator('text=你自己的弃牌堆')).toBeVisible();
        await expect(page.locator('text=玩家二的弃牌堆')).toBeVisible();

        // 选择"玩家二的弃牌堆"
        await page.click('button:has-text("玩家二的弃牌堆")');

        // 等待第二步交互出现
        await page.waitForSelector('text=印斯茅斯基地：从玩家二的弃牌堆选择一张卡', { timeout: 5000 });

        // 截图：第二步交互（选择卡牌）
        await page.screenshot({ path: 'test-results/innsmouth-step2-opponent-cards.png' });

        // 验证：应该显示对手弃牌堆的卡牌
        await expect(page.locator('text=霸王龙')).toBeVisible(); // dinosaur_king_rex
        await expect(page.locator('text=微型机器人阿尔法')).toBeVisible(); // robot_microbot_alpha

        // 选择一张卡
        await page.click('button:has-text("霸王龙")');

        // 验证：卡牌被放入对手的牌库底
        const state = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.read();
        });

        expect(state.core.players['1'].deck).toHaveLength(1);
        expect(state.core.players['1'].deck[0].defId).toBe('dinosaur_king_rex');
        expect(state.core.players['1'].discard).toHaveLength(1); // 只剩一张
    });

    test('场景3：跳过选择', async ({ smashupMatch }) => {
        const { hostPage: page } = smashupMatch;

        // 注入状态
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.state.patch({
                'core.bases.0.defId': 'base_innsmouth_base',
                'core.bases.0.breakpoint': 20,
                'core.players.0.hand': [
                    { uid: 'minion-1', defId: 'ninja_shinobi', type: 'minion', owner: '0' }
                ],
                'core.players.0.discard': [
                    { uid: 'discard-1', defId: 'ninja_infiltrate', type: 'action', owner: '0' }
                ],
                'core.players.0.deck': [],
                'core.currentPlayer': '0',
                'core.phase': 'playCards'
            });
        });

        // 玩家 0 打出随从到基地 0
        await page.click('button:has-text("打出随从")');
        await page.click('[data-card-uid="minion-1"]');
        await page.click('[data-base-index="0"]');

        // 等待第一步交互出现
        await page.waitForSelector('text=印斯茅斯基地：选择从哪个玩家的弃牌堆选卡', { timeout: 5000 });

        // 截图：第一步交互
        await page.screenshot({ path: 'test-results/innsmouth-step1-skip.png' });

        // 选择"跳过"
        await page.click('button:has-text("跳过")');

        // 验证：没有卡牌被移动
        const state = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.read();
        });

        expect(state.core.players['0'].deck).toHaveLength(0);
        expect(state.core.players['0'].discard).toHaveLength(1); // 没有变化
    });
});
