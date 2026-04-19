/**
 * 盘旋机器人链式打出 E2E 测试
 * 
 * 使用新的 GameTestContext API 验证：
 * 1. 连续打出两个盘旋机器人
 * 2. 第二个盘旋看到新的牌库顶（不是自己）
 * 3. 不会出现无限循环
 * 
 * 核心验证：
 * - _source: 'static' 修复生效
 * - optionsGenerator + continuationContext 正确工作
 * - 交互解决器的校验机制生效
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../framework';

const SMASHUP_TEST_QUERY = {
    p0: 'robots,pirates',
    p1: 'ninjas,dinosaurs',
    skipFactionSelect: true,
    skipInitialization: false,
};

const GIANT_ANT_TEST_QUERY = {
    p0: 'giant_ants,frankenstein',
    p1: 'robots,wizards',
    skipFactionSelect: true,
    skipInitialization: false,
};

async function waitForSelectableMinion(page: Page, minionUid: string) {
    await expect.poll(async () => {
        return page.evaluate((uid) => {
            const node = document.querySelector(`[data-minion-uid="${uid}"]`);
            if (!(node instanceof HTMLElement)) return { exists: false, selectable: false, className: '' };
            return {
                exists: true,
                selectable: node.className.includes('ring-purple-400'),
                className: node.className,
            };
        }, minionUid);
    }).toMatchObject({
        exists: true,
        selectable: true,
    });
}

async function clickSelectableMinion(page: Page, minionUid: string) {
    await waitForSelectableMinion(page, minionUid);
    await page.evaluate((uid) => {
        const node = document.querySelector(`[data-minion-uid="${uid}"]`);
        if (!(node instanceof HTMLElement)) {
            throw new Error(`minion ${uid} not found`);
        }
        node.click();
    }, minionUid);
    await page.waitForTimeout(200);
}

async function clickCurrentInteractionButton(page: Page, optionId: string) {
    const label = await page.evaluate((id) => {
        const harness = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        sys?: {
                            interaction?: {
                                current?: {
                                    data?: {
                                        options?: Array<{ id: string; label: string }>;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__;
        const options = harness?.state?.get?.()?.sys?.interaction?.current?.data?.options ?? [];
        const option = options.find((entry) => entry.id === id);
        return typeof option?.label === 'string' ? option.label : null;
    }, optionId);

    if (!label) {
        throw new Error(`interaction option ${optionId} not found`);
    }

    await expect(page.getByRole('button', { name: label }).first()).toBeVisible();
    await page.evaluate((text) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const target = buttons.find((button) => button.textContent?.trim() === text.trim());
        if (!(target instanceof HTMLButtonElement)) {
            throw new Error(`button "${text}" not found`);
        }
        target.click();
    }, label);
    await page.waitForTimeout(200);
}

test.describe('盘旋机器人链式打出', () => {
    test('应该正确处理连续打出两个盘旋机器人', async ({ game }, testInfo) => {
        await game.openTestGame('smashup', SMASHUP_TEST_QUERY);

        // 3. 快速场景构建：手牌有第一个盘旋，牌库顶是第二个盘旋和 zapbot
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: [
                    'robot_hoverbot',  // 牌库顶：第二个盘旋
                    'robot_zapbot',    // 第三张：zapbot
                ],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 2. 打出第一个盘旋机器人
        await game.playCard('robot_hoverbot', { targetBaseIndex: 0 });

        // 3. 等待交互：应该看到第二个盘旋机器人
        await game.waitForInteraction('robot_hoverbot');

        // 4. 验证选项引用第二个盘旋机器人
        const options1 = await game.getInteractionOptions();
        expect(options1.length).toBeGreaterThanOrEqual(2); // play + skip
        const playOption1 = options1.find(opt => opt.id === 'play');
        expect(playOption1).toBeDefined();
        expect(playOption1?.value?.defId).toBe('robot_hoverbot');

        // 5. 选择打出第二个盘旋机器人
        await game.selectOption('play');
        await game.waitForInteraction('robot_hoverbot_base');
        await game.selectBase(0);

        // 6. 等待新的交互：应该看到 zapbot（新的牌库顶）
        await game.waitForInteraction('robot_hoverbot');

        // 7. 验证选项引用 zapbot（不是第二个盘旋机器人）
        const options2 = await game.getInteractionOptions();
        expect(options2.length).toBeGreaterThanOrEqual(2);
        const playOption2 = options2.find(opt => opt.id === 'play');
        expect(playOption2).toBeDefined();
        expect(playOption2?.value?.defId).toBe('robot_zapbot');

        // 8. 选择打出 zapbot
        await game.selectOption('play');
        await game.waitForInteraction('robot_hoverbot_base');
        await game.selectBase(0);

        // 9. 验证最终状态：三个随从都在场上
        const finalState = await game.getState();
        const base0Minions = finalState.core.bases[0].minions.filter((m: any) => m.controller === '0');
        
        expect(base0Minions.length).toBe(3);
        expect(base0Minions.some((m: any) => m.defId === 'robot_hoverbot')).toBe(true);
        expect(base0Minions.filter((m: any) => m.defId === 'robot_hoverbot').length).toBe(2); // 两个盘旋
        expect(base0Minions.some((m: any) => m.defId === 'robot_zapbot')).toBe(true);

        // 10. 验证牌库已空
        expect(finalState.core.players['0'].deck.length).toBe(0);

        // 11. 截图保存
        await game.screenshot('final-state', testInfo);

        console.log('[E2E] ✅ 测试通过：连续打出两个盘旋机器人，第二个盘旋看到新的牌库顶');
    });

    test('第二个盘旋应该看到新的牌库顶（不是自己）', async ({ game }, testInfo) => {
        await game.openTestGame('smashup', SMASHUP_TEST_QUERY);

        // 2. 场景构建
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: ['robot_hoverbot', 'robot_zapbot'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 2. 打出第一个盘旋
        await game.playCard('robot_hoverbot', { targetBaseIndex: 0 });
        await game.waitForInteraction('robot_hoverbot');

        // 3. 选择打出第二个盘旋
        await game.selectOption('play');
        await game.waitForInteraction('robot_hoverbot_base');
        await game.selectBase(0);

        // 4. 等待新的交互
        await game.waitForInteraction('robot_hoverbot');

        // 5. 验证选项引用 zapbot（不是第二个盘旋）
        const options = await game.getInteractionOptions();
        const playOption = options.find(opt => opt.id === 'play');
        expect(playOption?.value?.defId).toBe('robot_zapbot');

        // 6. 验证牌库顶确实是 zapbot
        const state = await game.getState();
        expect(state.core.players['0'].deck[0]?.defId).toBe('robot_zapbot');

        // 7. 验证第二个盘旋已在场上
        const base0Minions = state.core.bases[0].minions.filter((m: any) => m.controller === '0');
        expect(base0Minions.some((m: any) => m.defId === 'robot_hoverbot')).toBe(true);
        expect(base0Minions.filter((m: any) => m.defId === 'robot_hoverbot').length).toBe(2);

        await game.screenshot('second-hoverbot-sees-new-deck-top', testInfo);

        console.log('[E2E] ✅ 测试通过：第二个盘旋看到新的牌库顶（zapbot）');
    });

    test('交互不应该一闪而过', async ({ game, page }, testInfo) => {
        await game.openTestGame('smashup', SMASHUP_TEST_QUERY);

        // 2. 场景构建
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: ['robot_zapbot'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 2. 打出盘旋机器人
        await game.playCard('robot_hoverbot', { targetBaseIndex: 0 });

        // 3. 等待交互出现
        await game.waitForInteraction('robot_hoverbot');

        // 4. 等待 2 秒，确认交互仍然存在
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 5. 再次检查交互是否仍然存在
        const stillExists = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state.get();
            const current = state?.sys?.interaction?.current;
            return current?.data?.sourceId === 'robot_hoverbot';
        });

        expect(stillExists).toBe(true);

        // 6. 验证选项仍然可见
        const options = await game.getInteractionOptions();
        expect(options.length).toBeGreaterThanOrEqual(2);

        await game.screenshot('interaction-persists', testInfo);

        console.log('[E2E] ✅ 测试通过：交互不会一闪而过');
    });

    test('应该允许选择"跳过"', async ({ game }, testInfo) => {
        await game.openTestGame('smashup', SMASHUP_TEST_QUERY);

        // 2. 场景构建
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: ['robot_zapbot'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 2. 打出盘旋机器人
        await game.playCard('robot_hoverbot', { targetBaseIndex: 0 });
        await game.waitForInteraction('robot_hoverbot');

        // 3. 选择"跳过"
        await game.selectOption('skip');

        // 4. 验证交互已消失
        const state = await game.getState();
        expect(state.sys.interaction?.current).toBeUndefined();

        // 5. 验证 zapbot 仍在牌库顶（未打出）
        expect(state.core.players['0'].deck[0]?.defId).toBe('robot_zapbot');

        // 6. 验证只有盘旋机器人在场上
        const base0Minions = state.core.bases[0].minions.filter((m: any) => m.controller === '0');
        expect(base0Minions.length).toBe(1);
        expect(base0Minions[0].defId).toBe('robot_hoverbot');

        await game.screenshot('skip-option', testInfo);

        console.log('[E2E] ✅ 测试通过：跳过功能正常工作');
    });

    test('牌库顶是行动卡时不应该创建交互', async ({ game }, testInfo) => {
        await game.openTestGame('smashup', SMASHUP_TEST_QUERY);

        // 2. 场景构建：牌库顶是行动卡
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: ['robot_tech_center'], // 行动卡
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 2. 打出盘旋机器人
        await game.playCard('robot_hoverbot', { targetBaseIndex: 0 });

        // 3. 等待 2 秒，确认不会出现交互
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 4. 验证没有交互
        const state = await game.getState();
        expect(state.sys.interaction?.current).toBeUndefined();

        // 5. 验证只有盘旋机器人在场上
        const base0Minions = state.core.bases[0].minions.filter((m: any) => m.controller === '0');
        expect(base0Minions.length).toBe(1);
        expect(base0Minions[0].defId).toBe('robot_hoverbot');

        await game.screenshot('action-card-no-interaction', testInfo);

        console.log('[E2E] ✅ 测试通过：牌库顶是行动卡时不创建交互');
    });
});

test.describe('SmashUp 交互时序回归', () => {
    test('无人想要永生：正常流程应完成移除指示物并抽牌', async ({ game, page }, testInfo) => {
        await game.openTestGame('smashup', GIANT_ANT_TEST_QUERY);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['giant_ant_who_wants_to_live_forever'],
                deck: ['wizard_sacrifice', 'wizard_mass_enchantment'],
                field: [
                    {
                        uid: 'm1',
                        defId: 'giant_ant_worker',
                        owner: '0',
                        controller: '0',
                        baseIndex: 0,
                        powerCounters: 2,
                    },
                ],
                factions: ['giant_ants', 'frankenstein'],
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'wizards'],
            },
            bases: [
                { defId: 'base_laboratorium', breakpoint: 20, minions: [] },
                { defId: 'base_great_library', breakpoint: 20, minions: [] },
                { defId: 'base_the_hill', breakpoint: 20, minions: [] },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.playCard('giant_ant_who_wants_to_live_forever');
        await game.waitForInteraction('giant_ant_who_wants_to_live_forever');

        const minionTarget = page.locator('[data-minion-uid="m1"]').first();
        await expect(minionTarget).toBeVisible();
        await clickSelectableMinion(page, 'm1');
        await game.waitForInteraction('giant_ant_who_wants_to_live_forever');

        await expect.poll(async () => {
            const state = await game.getState();
            const minion = state.core.bases[0].minions.find((entry: { uid: string }) => entry.uid === 'm1');
            return minion?.powerCounters ?? null;
        }).toBe(1);

        await clickSelectableMinion(page, 'm1');
        await game.waitForInteraction('giant_ant_who_wants_to_live_forever');

        await expect.poll(async () => {
            const state = await game.getState();
            const current = state.sys.interaction?.current;
            const minion = state.core.bases[0].minions.find((entry: { uid: string }) => entry.uid === 'm1');
            return {
                sourceId: current?.data?.sourceId ?? null,
                optionIds: (current?.data?.options ?? []).map((option: { id: string }) => option.id).sort(),
                powerCounters: minion?.powerCounters ?? null,
            };
        }).toEqual({
            sourceId: 'giant_ant_who_wants_to_live_forever',
            optionIds: ['cancel', 'confirm'],
            powerCounters: 0,
        });

        await game.screenshot('who-wants-to-live-forever-before-confirm', testInfo);
        await clickCurrentInteractionButton(page, 'confirm');

        await expect.poll(async () => {
            const state = await game.getState();
            return state.sys.interaction?.current?.data?.sourceId ?? null;
        }).toBeNull();

        const finalState = await game.getState();
        const handDefIds = finalState.core.players['0'].hand.map((card: { defId: string }) => card.defId);
        const discardDefIds = finalState.core.players['0'].discard.map((card: { defId: string }) => card.defId);
        const worker = finalState.core.bases[0].minions.find((entry: { uid: string }) => entry.uid === 'm1');

        expect(handDefIds).toEqual(['wizard_sacrifice', 'wizard_mass_enchantment']);
        expect(discardDefIds).toContain('giant_ant_who_wants_to_live_forever');
        expect(worker?.powerCounters).toBe(0);

        await game.screenshot('who-wants-to-live-forever-final', testInfo);
    });

    test('无人想要永生：快速双击最后一个指示物目标时交互不应自动关闭', async ({ game, page }, testInfo) => {
        await game.openTestGame('smashup', GIANT_ANT_TEST_QUERY);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['giant_ant_who_wants_to_live_forever'],
                deck: ['wizard_sacrifice'],
                field: [
                    {
                        uid: 'm1',
                        defId: 'giant_ant_worker',
                        owner: '0',
                        controller: '0',
                        baseIndex: 0,
                        powerCounters: 1,
                    },
                ],
                factions: ['giant_ants', 'frankenstein'],
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'wizards'],
            },
            bases: [
                { defId: 'base_laboratorium', breakpoint: 20, minions: [] },
                { defId: 'base_great_library', breakpoint: 20, minions: [] },
                { defId: 'base_the_hill', breakpoint: 20, minions: [] },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.playCard('giant_ant_who_wants_to_live_forever');
        await game.waitForInteraction('giant_ant_who_wants_to_live_forever');

        const minionTarget = page.locator('[data-minion-uid="m1"]').first();
        await expect(minionTarget).toBeVisible();
        await waitForSelectableMinion(page, 'm1');
        await minionTarget.click({ clickCount: 2, delay: 20, force: true });

        await expect.poll(async () => {
            const state = await game.getState();
            const current = state.sys.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                optionIds: (current?.data?.options ?? []).map((option: { id: string }) => option.id).sort(),
            };
        }).toEqual({
            sourceId: 'giant_ant_who_wants_to_live_forever',
            optionIds: ['cancel', 'confirm'],
        });

        await expect(page.getByRole('button', { name: /确认并抽 1 张牌|确认并抽 1 张/i })).toBeVisible();
        await game.screenshot('who-wants-to-live-forever-double-click-still-open', testInfo);

        await clickCurrentInteractionButton(page, 'confirm');

        await expect.poll(async () => {
            const state = await game.getState();
            return state.sys.interaction?.current?.data?.sourceId ?? null;
        }).toBeNull();

        const finalState = await game.getState();
        const handDefIds = finalState.core.players['0'].hand.map((card: { defId: string }) => card.defId);
        const discardDefIds = finalState.core.players['0'].discard.map((card: { defId: string }) => card.defId);

        expect(finalState.sys.interaction?.current).toBeUndefined();
        expect(handDefIds).toEqual(['wizard_sacrifice']);
        expect(discardDefIds).toContain('giant_ant_who_wants_to_live_forever');

        await game.screenshot('who-wants-to-live-forever-double-click-final', testInfo);
    });
});
