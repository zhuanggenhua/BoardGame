/**
 * E2E：山屋惊魂终局页的「重赛」是否真的接通
 *
 * 背景：终局页是游戏自研的 endgameScreen（endgame-style-b 基线），
 * 历史版本里三个按钮只有样式没有 onClick，看着能点其实是装饰。
 * 这里直接注入 endgame 阶段的 core，绕开长剧本流程，只验证按钮行为：
 * 可见 → 可点（非 disabled）→ 点击后终局页真正消失并回到对局。
 */

import { expect, test, type Locator } from '@playwright/test';
import {
    createFirstScenarioReadyToTraitorVictoryRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReadyWithoutReload,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-endgame-rematch';
const VIEWPORTS = [
    { name: '桌面', viewport: { width: 1600, height: 900 }, hasTouch: false, path: EVIDENCE_DIR },
    { name: '手机横屏', viewport: { width: 936, height: 432 }, hasTouch: true, path: EVIDENCE_DIR + '/landscape' },
];

for (const { name, viewport, hasTouch, path } of VIEWPORTS) {
    test.describe('山屋惊魂终局重赛按钮 · ' + name, () => {
        test.use({ viewport, hasTouch });

        test('预置终局后可打开结果报告并重开', async ({ page, context }) => {
            test.setTimeout(120000);
            await initBetrayalContext(context);

            await page.goto(
                '/play/betrayal?players=3&playerID=2&seat0=human&seat1=human&seat2=human',
                { waitUntil: 'domcontentloaded' },
            );
            await waitForBetrayalPageReadyWithoutReload(page, 60000);
            const activate = (button: Locator) => hasTouch ? button.tap() : button.click();

            // 直接进入 endgame 阶段：Board 的 isGameOver 判定同时接受 sys.gameover 与 phase === 'endgame'。
            const core = createFirstScenarioReadyToTraitorVictoryRuntimeCore();
            await injectCore(page, { ...core, phase: 'endgame' as const });

            const endgameScreen = page.getByTestId('betrayal-endgame-screen');
            await expect(endgameScreen).toBeVisible({ timeout: 30000 });

            // 终局页是两阶段的：先「结局朗读」，点「查看结果报告」才进入带操作按钮的报告页。
            await expect(
                endgameScreen.getByTestId('betrayal-endgame-ending-narration'),
                '终局应先进入结局朗读阶段',
            ).toBeVisible({ timeout: 15000 });
            await activate(endgameScreen.getByTestId('betrayal-endgame-ending-continue'));
            await expect(
                endgameScreen.getByTestId('betrayal-endgame-result-report'),
                '应能进入结局报告阶段',
            ).toBeVisible({ timeout: 20000 });

            const rematchButton = endgameScreen.getByRole('button', { name: /重赛|再来一局/ });
            await expect(rematchButton, '终局页必须提供重赛入口').toBeVisible();
            await expect(rematchButton).toBeInViewport({ ratio: 1 });
            if (hasTouch) {
                const hitArea = await rematchButton.boundingBox();
                expect(hitArea?.height, '重赛按钮缩放后的实际触控高度').toBeGreaterThanOrEqual(43.9);
            }
            await expect(rematchButton, '重赛按钮不能是 disabled 装饰').toBeEnabled();
            await expect(endgameScreen.getByRole('button', { name: /大厅|返回大厅/ }), '终局页必须提供返回大厅').toBeVisible();

            await saveScreenshot(page, path + '/01-终局页-重赛按钮可点.png');

            await activate(rematchButton);
            await expect(endgameScreen, '点击重赛后终局页应真正消失').toHaveCount(0, { timeout: 30000 });
            // 山屋重开后会从角色选择开始新一轮，而不是直接回到棋盘
            await expect(
                page.getByTestId('betrayal-character-select-screen'),
                '重赛后应进入新一局的角色选择',
            ).toBeVisible({ timeout: 30000 });

            await saveScreenshot(page, path + '/02-重赛-回到对局.png');
        });
    });
}
