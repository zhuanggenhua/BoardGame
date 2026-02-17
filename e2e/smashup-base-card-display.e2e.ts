/**
 * 大杀四方 - 基地选择卡牌展示模式测试
 * 验证选择基地时是否正确显示基地卡牌而不是按钮
 */

import { test, expect } from '@playwright/test';
import { setupTwoPlayerMatch as setupOnlineMatch } from './smashup-helpers';
import { readFullState as readCoreState, applyCoreStateDirect } from './smashup-debug-helpers';

test.describe('大杀四方 - 基地选择卡牌展示', () => {
    test('麦田怪圈：选择基地时显示基地卡牌', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupOnlineMatch(browser, baseURL);
        
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        
        const { hostPage: p0Page, guestPage: p1Page } = setup;

        // 设置初始状态：两个基地都有随从
        const initialState = await readCoreState(p0Page);
        const modifiedState = {
            ...initialState,
            bases: initialState.bases.map((base, idx) => ({
                ...base,
                minions: idx < 2 ? [{
                    uid: `minion-${idx}`,
                    defId: 'alien_invader',
                    controller: 'p0',
                    owner: 'p0',
                    attachedActions: [],
                    powerCounters: 0,
                }] : [],
            })),
            players: {
                ...initialState.players,
                p0: {
                    ...initialState.players.p0,
                    hand: [
                        { uid: 'crop-circles-1', defId: 'alien_crop_circles', type: 'action' },
                    ],
                },
            },
        };

        await applyCoreStateDirect(p0Page, modifiedState);

        // P0 打出麦田怪圈
        await p0Page.click('[data-testid="hand-card-crop-circles-1"]');

        // 等待基地选择界面出现
        await p0Page.waitForSelector('[data-testid="prompt-overlay"]', { timeout: 3000 });

        // 验证标题
        const title = await p0Page.textContent('h2');
        expect(title).toContain('选择一个基地');

        // 验证显示的是卡牌而不是按钮
        // 卡牌模式会使用 CardPreview 组件，按钮模式会使用 GameButton
        const cardPreviews = await p0Page.locator('[data-testid^="card-preview"]').count();
        const gameButtons = await p0Page.locator('button:has-text("基地")').count();

        console.log(`卡牌数量: ${cardPreviews}, 按钮数量: ${gameButtons}`);

        // 应该显示卡牌，不显示按钮
        expect(cardPreviews).toBeGreaterThan(0);
        expect(gameButtons).toBe(0);

        // 验证卡牌尺寸（基地卡牌应该是横向的）
        const firstCard = p0Page.locator('[data-testid^="card-preview"]').first();
        const boundingBox = await firstCard.boundingBox();
        
        if (boundingBox) {
            // 基地卡牌应该是横向的（宽度 > 高度）
            expect(boundingBox.width).toBeGreaterThan(boundingBox.height);
            console.log(`基地卡牌尺寸: ${boundingBox.width}x${boundingBox.height}`);
        }
    });
});
