import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { completeFactionSelection } from '../helpers/smashup';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { cleanupTwoPlayerMatch, setupTwoPlayerMatch, waitForHandArea } from './smashup-helpers';

test('微型机存储者在樱花花园被消灭后，真人结算时恰好抓两张', async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    const match = await setupTwoPlayerMatch(browser, testInfo.project.use.baseURL as string | undefined, { skipImageGate: true });
    expect(match).not.toBeNull();
    if (!match) return;
    const { hostPage, guestPage, matchId } = match;
    const pageErrors: string[] = [];
    hostPage.on('pageerror', error => pageErrors.push(error.message));
    try {
        await completeFactionSelection(hostPage, guestPage, ['robots', 'aliens'], ['samurai', 'dinosaurs']);
        await Promise.all([waitForHandArea(hostPage, 45_000), waitForHandArea(guestPage, 45_000)]);
        const state = structuredClone(await getMatchState(matchId, hostPage)) as any;
        state.core.turnOrder = ['0', '1'];
        state.core.currentPlayerIndex = 0;
        state.core.activePlayerId = '0';
        state.core.phase = 'playCards';
        state.core.turnDestroyedMinions = [];
        state.sys.turnOrder = ['0', '1'];
        state.sys.currentPlayerIndex = 0;
        state.sys.phase = 'playCards';
        state.sys.interaction = { current: null, queue: [], isBlocked: false };
        const player = state.core.players['0'];
        player.hand = [{ uid: 'guard-draw-feedback', defId: 'robot_microbot_guard', type: 'minion', owner: '0' }];
        player.deck = ['robot_microbot_alpha', 'robot_zapbot', 'robot_microbot_reclaimer']
            .map((defId, index) => ({ uid: `draw-feedback-${index}`, defId, type: 'minion', owner: '0' }));
        player.minionsPlayed = 0;
        player.minionLimit = 1;
        state.core.bases[0] = {
            ...state.core.bases[0],
            defId: 'base_sakura_garden',
            minions: [{ uid: 'archive-draw-feedback', defId: 'robot_microbot_archive', owner: '0', controller: '0',
                basePower: 1, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }],
            ongoingActions: [],
        };
        state.core.bases[1] = { defId: 'base_the_factory', minions: [], ongoingActions: [] };
        state.core.bases[2] = { defId: 'base_the_jungle', minions: [], ongoingActions: [] };
        await injectMatchState(matchId, state, hostPage);
        await expect(hostPage.locator('[data-card-uid="guard-draw-feedback"]').first()).toBeVisible();
        // 从守护者打出后的原始目标选择开始验证真实玩家操作。
        await hostPage.evaluate(async () => {
            await (window as any).__BG_TEST_HARNESS__.command.dispatch({
                type: 'su:play_minion', playerId: '0', payload: { cardUid: 'guard-draw-feedback', baseIndex: 0 },
            });
        });
        const archive = hostPage.locator('[data-minion-uid="archive-draw-feedback"]');
        await expect(archive).toBeVisible();
        await expect(archive).toHaveAttribute('data-highlighted', 'true');
        await archive.click();
        const readOutcome = async () => {
            const actual = await getMatchState(matchId, hostPage) as any;
            return {
                hand: actual.core.players['0'].hand.map((card: any) => card.uid),
                deck: actual.core.players['0'].deck.map((card: any) => card.uid),
                discarded: actual.core.players['0'].discard.some((card: any) => card.uid === 'archive-draw-feedback'),
                interaction: actual.sys.interaction.current?.data?.sourceId ?? null,
            };
        };
        // 两项反应若分别进入真人选择，按页面提供的按钮逐项结算。
        for (let remaining = 2; remaining > 0; remaining--) {
            const reaction = hostPage.getByRole('button', { name: /^(微型机存储者|樱花花园)$/ }).first();
            await expect.poll(async () => (await readOutcome()).interaction === null || await reaction.isVisible()).toBe(true);
            if ((await readOutcome()).interaction === null) break;
            await reaction.click();
        }
        await expect.poll(readOutcome, { timeout: 15_000 }).toEqual({
            hand: ['draw-feedback-0', 'draw-feedback-1'],
            deck: ['draw-feedback-2'],
            discarded: true,
            interaction: null,
        });
        await expect(hostPage.locator('[data-card-uid="draw-feedback-0"]').first()).toBeVisible();
        await expect(hostPage.locator('[data-card-uid="draw-feedback-1"]').first()).toBeVisible();
        const evidencePath = getEvidenceScreenshotPath(testInfo, '微型机存储者和樱花花园各抓一张');
        await mkdir(dirname(evidencePath), { recursive: true });
        await hostPage.screenshot({ path: evidencePath });
        expect(pageErrors).toEqual([]);
    } finally {
        await cleanupTwoPlayerMatch(match);
    }
});
