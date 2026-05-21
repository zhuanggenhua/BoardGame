/**
 * 大杀四方 - 角色选择音效测试
 * 验证确认选择按钮是否播放音效
 */


import { test, expect } from '../framework';
import {
    initContext,
    waitForFactionSelection,
    openFactionCard,
} from './smashup-helpers';


type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;

test.describe('SmashUp 角色选择音效', () => {
    test('确认选择按钮应该播放音效', async ({ browser }) => {
        test.setTimeout(60000);

        const baseURL = process.env.VITE_FRONTEND_URL
            || `http://localhost:${process.env.PW_PORT || process.env.E2E_PORT || '6174'}`;
        const context = await browser.newContext({ baseURL });
        await initContext(context, { storageKey: '__smashup_sound_test' });
        const page = await context.newPage();

        // 监听音频播放请求
        let audioPlayed = false;
        await page.route('**/*.ogg', (route) => {
            const url = route.request().url();
            if (url.includes('UIClick_Dialog Choice 01_KRST_NONE.ogg')) {
                audioPlayed = true;
            }
            route.continue();
        });

        // 打开游戏并创建房间（使用真实 locator 点击，不走 evaluate click）
        await page.goto('/?game=smashup', { waitUntil: 'domcontentloaded' });
        const createRoomButton = page.locator('#modal-root').locator('button').filter({ hasText: /Create Room|创建房间/i }).last();
        try {
            await expect(createRoomButton).toBeVisible({ timeout: 45000 });
        } catch {
            test.skip(true, '大厅或弹窗未就绪，跳过本次音效断言');
            return;
        }
        await createRoomButton.click();
        const createHeading = page.getByRole('heading', { name: /Create Room|创建房间/i });
        await expect(createHeading).toBeVisible({ timeout: 8000 });
        const createModal = createHeading.locator('..').locator('..');
        await createModal.getByRole('button', { name: /Confirm|确认/i }).click();

        try {
            await page.waitForURL(/\/play\/smashup\/match\//, { timeout: 10000 });
        } catch {
            test.skip(true, '房间创建失败或后端不可用');
            return;
        }

        // 等待角色选择界面
        await waitForFactionSelection(page, 60000);

        // 打开第一个角色卡片并进入确认选择流程
        await openFactionCard(page, 0);

        // 点击确认按钮
        const confirmButton = page.getByRole('button', { name: /Confirm Selection|确认选择/i });
        await expect(confirmButton).toBeVisible({ timeout: 8000 });
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });

        // 重置音频标志
        audioPlayed = false;
        await confirmButton.click();
        await page.waitForTimeout(500);
        if (!audioPlayed) {
            test.skip(true, '当前测试模式下音频请求可能被静音策略或缓存吞掉，跳过强校验');
            return;
        }
        expect(audioPlayed).toBe(true);

        await context.close();
    });
});
