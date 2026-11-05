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

test.describe('Smash Up 旁观者私有交互', () => {
    test('真实在线旁观入口查看预置私人提示与选项但不能响应', async ({ browser }, testInfo) => {
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

            const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
            await spectatorPage.screenshot({
                path: join(evidenceRun.stagingDir, '01-预置提示出现前旁观者看到牌桌.png'),
                fullPage: false,
            });

            const state = structuredClone(await getMatchState(setup.matchId, setup.hostPage)) as any;
            state.core.turnOrder = ['0', '1'];
            state.core.currentPlayerIndex = 0;
            state.core.activePlayerId = '0';
            state.core.phase = 'playCards';
            state.sys.turnOrder = ['0', '1'];
            state.sys.currentPlayerIndex = 0;
            state.sys.phase = 'playCards';
            const ownerHand = state.core.players['0'].hand.slice(0, 2);
            expect(ownerHand).toHaveLength(2);
            state.sys.interaction = {
                current: {
                    id: 'smashup-spectator-owner-prompt-e2e',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '选择一张手牌',
                        sourceId: 'super_spies_secret_agent_discard',
                        targetType: 'hand',
                        options: ownerHand.map((card: { uid: string }, index: number) => ({
                            id: `private-option-${index === 0 ? 'a' : 'b'}`,
                            label: index === 0 ? '可选手牌一' : '可选手牌二',
                            value: { cardUid: card.uid },
                            _source: 'hand',
                        })),
                    },
                },
                queue: [],
                isBlocked: false,
            };

            await injectMatchState(setup.matchId, state, setup.hostPage);
            await Promise.all([
                setup.hostPage.waitForFunction(() => (
                    (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.id
                    === 'smashup-spectator-owner-prompt-e2e'
                ), undefined, { timeout: 15000, polling: 100 }),
                spectatorPage.waitForFunction(() => (
                    (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.id
                    === 'smashup-spectator-owner-prompt-e2e'
                ), undefined, { timeout: 15000, polling: 100 }),
            ]);

            await expect(setup.hostPage.getByTestId('su-hand-area').locator('[data-card-uid]')).toHaveCount(2);

            const readonlyPrompt = spectatorPage.getByTestId('smashup-spectator-prompt-readonly');
            await expect(readonlyPrompt).toBeVisible();
            await expect(readonlyPrompt).toContainText('选择一张手牌');
            await expect(readonlyPrompt).toContainText('可选手牌一');
            await expect(readonlyPrompt).toContainText('可选手牌二');
            await expect(readonlyPrompt.locator('button')).toHaveCount(0);
            await expect(setup.guestPage.getByText('可选手牌一')).toHaveCount(0);
            await spectatorPage.screenshot({
                path: join(evidenceRun.stagingDir, '02-预置私人提示与全部选项只读显示.png'),
                fullPage: false,
            });

            await spectatorPage.getByTestId('smashup-spectator-prompt-option-private-option-a').click();
            await expect(readonlyPrompt).toBeVisible();
            const stateAfterReadOnlyClick = await getMatchState(setup.matchId, setup.hostPage) as any;
            expect(stateAfterReadOnlyClick.core).toEqual(state.core);
            expect(stateAfterReadOnlyClick.sys.interaction.current.id).toBe('smashup-spectator-owner-prompt-e2e');
            expect(stateAfterReadOnlyClick.sys.interaction.current.playerId).toBe('0');
            await spectatorPage.screenshot({
                path: join(evidenceRun.stagingDir, '03-预置提示下旁观点击候选后交互不变.png'),
                fullPage: false,
            });

            await promoteEvidenceScreenshotRun(evidenceRun, {
                gameId: 'smashup',
                evidenceCategory: 'independent',
                media: [
                    {
                        path: '01-预置提示出现前旁观者看到牌桌.png',
                        chainId: 'smashup-spectator-owner-prompt',
                        chainStep: 1,
                        stage: '前态',
                        description: '注入提示前旁观者在真实在线牌桌看见双方状态与当前行动玩家。',
                    },
                    {
                        path: '02-预置私人提示与全部选项只读显示.png',
                        chainId: 'smashup-spectator-owner-prompt',
                        chainStep: 2,
                        stage: '中态',
                        description: '预置交互提示出现后旁观者可读标题与全部候选但无响应控件。',
                    },
                    {
                        path: '03-预置提示下旁观点击候选后交互不变.png',
                        chainId: 'smashup-spectator-owner-prompt',
                        chainStep: 3,
                        stage: '后态',
                        description: '预置提示下旁观点击候选后提示仍在且权威交互未变。',
                    },
                ],
            });
        } finally {
            await spectatorContext.close();
            await cleanupTwoPlayerMatch(setup);
        }
    });
});
