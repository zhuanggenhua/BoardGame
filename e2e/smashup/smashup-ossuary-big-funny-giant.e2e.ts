import { test, expect } from '../framework';

function makeTitan() {
    return {
        uid: 'giant-1',
        defId: 'tricksters_big_funny_giant',
        faction: 'tricksters',
        ownerId: '1',
        controllerId: '1',
        powerCounters: 0,
        talentUsed: false,
        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
    };
}

test.describe('SmashUp 埋骨堂与滑稽巨人', () => {
    test('埋骨堂埋葬随从不应触发滑稽巨人弃牌', async ({ game, page }, testInfo) => {
        test.setTimeout(180000);

        await page.goto('/play/smashup', { waitUntil: 'commit', timeout: 60000 });
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 60000, polling: 200 },
        );

        await game.setupScene({
            gameId: 'smashup',
            phase: 'playCards',
            currentPlayer: '1',
            player0: {
                hand: [{ uid: 'p0-hand-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' }],
                discard: [{ uid: 'bury-target-1', defId: 'fairies_puck', type: 'minion', owner: '0' }],
                factions: ['fairies', 'skeletons'],
            },
            player1: {
                hand: [],
                factions: ['tricksters', 'pirates'],
            },
            bases: [
                {
                    defId: 'base_ossuary',
                    minions: [],
                    ongoingActions: [],
                },
                {
                    defId: 'base_secret_garden',
                    minions: [],
                    ongoingActions: [],
                },
                {
                    defId: 'base_central_brain',
                    minions: [],
                    ongoingActions: [],
                },
            ],
            extra: {
                core: {
                    titans: [makeTitan()],
                },
            },
        });

        await game.waitForPhase('playCards', 10000);
        await game.waitForCurrentPlayer('1', 10000);
        await game.screenshot('ossuary-big-funny-giant-01-scene-ready', testInfo);

        await game.advancePhase();
        await game.waitForCurrentPlayer('0', 10000);
        await game.waitForInteraction('base_ossuary', 10000);

        const promptState = await game.getState();
        const prompt = promptState?.sys?.interaction?.current;
        expect(prompt?.data?.sourceId).toBe('base_ossuary');
        expect((prompt?.data?.options ?? []).some((option: any) => option.value?.cardUid === 'bury-target-1')).toBe(true);

        await game.screenshot('ossuary-big-funny-giant-02-ossuary-prompt', testInfo);
        await game.selectInteractionOptionBy(
            (option: any) => option.value?.cardUid === 'bury-target-1',
            '埋骨堂埋葬 Puck',
        );

        await page.waitForTimeout(800);
        const afterBury = await game.getState();
        const currentSourceId = afterBury?.sys?.interaction?.current?.data?.sourceId ?? null;
        const responseWindow = afterBury?.sys?.responseWindow?.current?.windowType ?? null;
        const player0Hand = afterBury?.core?.players?.['0']?.hand ?? [];
        const buriedCards = afterBury?.core?.bases?.[0]?.buriedCards ?? [];

        expect(currentSourceId).not.toBe('titan_tricksters_big_funny_giant_discard_to_play');
        expect(responseWindow).toBeFalsy();
        expect(player0Hand.map((card: any) => card.uid)).toEqual(['p0-hand-1']);
        expect(buriedCards.some((card: any) => card.uid === 'bury-target-1')).toBe(true);

        await game.screenshot('ossuary-big-funny-giant-03-after-bury', testInfo);
    });
});
