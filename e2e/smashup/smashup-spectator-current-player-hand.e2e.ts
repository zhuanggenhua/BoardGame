import { join } from 'node:path';
import { test, expect } from '../framework';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import {
    cleanupTwoPlayerMatch,
    initContext,
    setupTwoPlayerMatch,
    waitForHandArea,
} from './smashup-helpers';
import { completeFactionSelection as completeFactionSelectionById } from '../helpers/smashup';
import {
    createEvidenceScreenshotRun,
    promoteEvidenceScreenshotRun,
} from '../framework/evidenceScreenshots';

test.describe('Smash Up 观战当前回合玩家手牌', () => {
    test('预置代表态观战查看当前回合玩家完整手牌与只读检视', async ({ browser }, testInfo) => {
        test.setTimeout(180000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL, { skipImageGate: true });
        test.skip(!setup, '游戏服务器不可用或创建房间失败');
        if (!setup) return;

        const spectatorContext = await initContext(await browser.newContext({ baseURL }), { skipImageGate: true });
        const spectatorPage = await spectatorContext.newPage();

        try {
            await completeFactionSelectionById(
                setup.hostPage,
                setup.guestPage,
                ['pirates', 'aliens'],
                ['ninjas', 'dinosaurs'],
            );
            await Promise.all([
                waitForHandArea(setup.hostPage, 45000),
                waitForHandArea(setup.guestPage, 45000),
            ]);

            await spectatorPage.goto(`/play/smashup/match/${setup.matchId}?spectate=1`, { waitUntil: 'domcontentloaded' });
            await waitForHandArea(spectatorPage, 45000);

            const state = structuredClone(await getMatchState(setup.matchId, setup.hostPage)) as any;
            expect(state.core.players['0'].hand).toHaveLength(5);
            expect(state.core.players['1'].hand).toHaveLength(5);
            state.core.turnOrder = ['0', '1'];
            state.core.currentPlayerIndex = 1;
            state.core.activePlayerId = '1';
            state.core.phase = 'playCards';
            state.core.players['1'].hand = [
                { uid: 'spectator-current-player-card-1', defId: 'dino_laser_triceratops', type: 'minion', owner: '1' },
                { uid: 'spectator-current-player-card-2', defId: 'dino_armor_stego', type: 'minion', owner: '1' },
                { uid: 'spectator-current-player-card-3', defId: 'dino_war_raptor', type: 'minion', owner: '1' },
                { uid: 'spectator-current-player-card-4', defId: 'dino_natural_selection', type: 'action', owner: '1' },
                { uid: 'spectator-current-player-card-5', defId: 'dino_king_rex', type: 'minion', owner: '1' },
            ];
            const otherPlayerCardUid = state.core.players['0'].hand[0].uid;
            state.sys.turnOrder = ['0', '1'];
            state.sys.currentPlayerIndex = 1;
            state.sys.phase = 'playCards';

            await injectMatchState(setup.matchId, state, setup.hostPage);
            await spectatorPage.waitForFunction(() => {
                const runtimeState = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return runtimeState?.core?.activePlayerId === '1'
                    && runtimeState?.core?.currentPlayerIndex === 1
                    && runtimeState?.sys?.phase === 'playCards';
            }, undefined, { timeout: 15000, polling: 100 });

            const handArea = spectatorPage.getByTestId('su-hand-area');
            await expect(spectatorPage.getByTestId('su-turn-tracker')).toContainText('当前玩家');
            const activePlayerCard = handArea.locator('[data-card-uid="spectator-current-player-card-1"]');
            await expect(handArea.locator('[data-card-uid]')).toHaveCount(5);
            for (let index = 1; index <= 5; index += 1) {
                await expect(handArea.locator(`[data-card-uid="spectator-current-player-card-${index}"]`)).toBeVisible();
            }
            await expect(handArea.locator(`[data-card-uid="${otherPlayerCardUid}"]`)).toHaveCount(0);
            const visibleCardImages = handArea.locator('img[data-card-atlas-img="true"]');
            await expect(visibleCardImages).toHaveCount(5);
            for (let index = 0; index < 5; index += 1) {
                await expect.poll(async () => visibleCardImages.nth(index).evaluate((image: HTMLImageElement) => (
                    image.complete && image.naturalWidth > 100 && image.naturalHeight > 100
                ))).toBe(true);
            }
            const evidenceRun = await createEvidenceScreenshotRun(testInfo);
            await spectatorPage.screenshot({
                path: join(evidenceRun.stagingDir, '01-预置代表态观战显示当前回合玩家完整手牌.png'),
                fullPage: false,
            });

            await activePlayerCard.click({ position: { x: 70, y: 150 } });
            await expect(activePlayerCard).toHaveAttribute('data-selected', 'true');
            await expect(handArea.locator('[data-card-uid="spectator-current-player-card-2"]'))
                .toHaveAttribute('data-selected', 'false');
            expect((await getMatchState(setup.matchId, setup.hostPage)).core).toEqual(state.core);
            await spectatorPage.screenshot({
                path: join(evidenceRun.stagingDir, '02-预置代表态观战点选手牌仅显示本地状态.png'),
                fullPage: false,
            });

            await activePlayerCard.hover();
            const inspectButton = spectatorPage.getByTestId('su-hand-card-inspect-spectator-current-player-card-1');
            await expect(inspectButton).toBeVisible();
            await inspectButton.click();
            const magnifyOverlay = spectatorPage.getByTestId('su-card-magnify-overlay');
            await expect(magnifyOverlay).toBeVisible();
            await expect(spectatorPage.getByTestId('su-card-magnify-content'))
                .toHaveAttribute('data-card-def-id', 'dino_laser_triceratops');
            const magnifiedImage = spectatorPage.locator('[data-testid="su-card-magnify-content"] img[data-card-atlas-img="true"]');
            await expect.poll(async () => magnifiedImage.evaluate((image: HTMLImageElement) => (
                image.complete && image.naturalWidth > 100 && image.naturalHeight > 100
            ))).toBe(true);
            await spectatorPage.screenshot({
                path: join(evidenceRun.stagingDir, '03-预置代表态观战打开卡牌检视.png'),
                fullPage: false,
            });

            await spectatorPage.getByTestId('su-card-magnify-overlay-close').click();
            await expect(magnifyOverlay).toBeHidden();
            await expect(activePlayerCard).toBeVisible();
            await spectatorPage.screenshot({
                path: join(evidenceRun.stagingDir, '04-预置代表态观战关闭检视返回手牌.png'),
                fullPage: false,
            });

            const authoritativeStateAfterReadOnlyView = await getMatchState(setup.matchId, setup.hostPage);
            expect(authoritativeStateAfterReadOnlyView.core).toEqual(state.core);
            await promoteEvidenceScreenshotRun(evidenceRun, {
                gameId: 'smashup',
                evidenceCategory: 'independent',
                media: [
                    {
                        path: '01-预置代表态观战显示当前回合玩家完整手牌.png',
                        chainId: 'smashup-spectator-current-player-hand',
                        chainStep: 1,
                        stage: '前态',
                        description: '预置代表态中旁观者看见当前行动玩家的五张完整手牌。',
                    },
                    {
                        path: '02-预置代表态观战点选手牌仅显示本地状态.png',
                        chainId: 'smashup-spectator-current-player-hand',
                        chainStep: 2,
                        stage: '中态',
                        description: '预置代表态中旁观者点选手牌只显示本地反馈且对局未变。',
                    },
                    {
                        path: '03-预置代表态观战打开卡牌检视.png',
                        chainId: 'smashup-spectator-current-player-hand',
                        chainStep: 3,
                        stage: '中态',
                        description: '预置代表态中旁观者打开检视后卡面内容与关闭入口可见。',
                    },
                    {
                        path: '04-预置代表态观战关闭检视返回手牌.png',
                        chainId: 'smashup-spectator-current-player-hand',
                        chainStep: 4,
                        stage: '后态',
                        description: '预置代表态中关闭检视后返回同一组当前玩家手牌。',
                    },
                ],
            });
        } finally {
            await spectatorContext.close();
            await cleanupTwoPlayerMatch(setup);
        }
    });
});
