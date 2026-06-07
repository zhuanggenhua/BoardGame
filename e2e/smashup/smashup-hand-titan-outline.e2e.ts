import { test, expect } from '../framework';
import { hideSmashUpDebugPanelForEvidence } from '../helpers/smashup';

const SMASHUP_TEST_QUERY = {
    skipInitialization: true,
} as const;

function buildHandInspectScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0',
        phase: 'playCards',
        player0: {
            id: '0',
            factions: ['geeks', 'time_travelers'],
            hand: [
                { uid: 'hand-outline-minion', defId: 'geeks_fan', type: 'minion', owner: '0' },
                { uid: 'hand-outline-action', defId: 'time_travelers_time_flies_like_an_arrow', type: 'action', owner: '0' },
            ],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            id: '1',
            factions: ['pirates', 'dinosaurs'],
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'board-minion-1',
                        defId: 'pirate_first_mate',
                        owner: '1',
                        controller: '1',
                        basePower: 2,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                turnNumber: 4,
                nextUid: 200,
            },
        },
    };
}

function buildTitanRailScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0',
        phase: 'startTurn',
        player0: {
            id: '0',
            factions: ['time_travelers', 'dinosaurs'],
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            id: '1',
            factions: ['pirates', 'aliens'],
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        bases: [
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                turnNumber: 6,
                nextUid: 400,
                titans: [
                    {
                        uid: 'titan-time-box-setaside',
                        defId: 'time_travelers_time_box',
                        faction: 'time_travelers',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        metadata: { timeBoxCounters: 4, timeBoxPlayArmed: true },
                        location: { zone: 'setaside' },
                    },
                ],
            },
            sys: {
                phase: 'startTurn',
                interaction: {
                    current: {
                        id: 'titan-time-box-outline',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            title: '时间盒子：是否移除全部计数器并打出到一个基地？',
                            sourceId: 'titan_time_travelers_time_box_play',
                            targetType: 'base',
                            options: [
                                {
                                    id: 'base-0',
                                    label: '家园',
                                    value: { baseIndex: 0, baseDefId: 'base_the_homeworld' },
                                    _source: 'base',
                                },
                                {
                                    id: 'base-1',
                                    label: '母舰',
                                    value: { baseIndex: 1, baseDefId: 'base_the_mothership' },
                                    _source: 'base',
                                },
                                {
                                    id: 'skip',
                                    label: '跳过',
                                    value: { skip: true },
                                    displayMode: 'button',
                                },
                            ],
                            continuationContext: {
                                titanUid: 'titan-time-box-setaside',
                                titanDefId: 'time_travelers_time_box',
                            },
                        },
                    },
                    queue: [],
                },
            },
        },
    };
}

test.describe('大杀四方手牌与泰坦 rail 描边取证', () => {
    test('手牌选中并悬浮放大镜时，放大镜不参与卡面描边', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await page.setViewportSize({ width: 1600, height: 1000 });
        await game.openTestGame('smashup', SMASHUP_TEST_QUERY, 45000);
        await game.setupScene(buildHandInspectScene());
        await hideSmashUpDebugPanelForEvidence(page);

        const handCard = page.locator('[data-testid="su-hand-area"] [data-card-uid="hand-outline-minion"]');
        await expect(handCard).toBeVisible({ timeout: 15000 });

        await handCard.click();
        await expect
            .poll(async () => {
                const frame = await handCard.locator(':scope > div').getAttribute('class');
                return frame ?? '';
            }, { timeout: 5000 })
            .toContain('ring-4 ring-green-400');

        await handCard.hover();
        await expect(page.getByTestId('su-hand-card-inspect-hand-outline-minion')).toBeVisible({ timeout: 5000 });

        await game.screenshot('01-hand-selected-inspect-board', testInfo);
    });

    test('牌堆区泰坦 rail 选中时，时间盒子计数和提示条不复用宿主描边', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await page.setViewportSize({ width: 1600, height: 1000 });
        await game.openTestGame('smashup', SMASHUP_TEST_QUERY, 45000);
        await game.setupScene(buildTitanRailScene());
        await hideSmashUpDebugPanelForEvidence(page);

        const titanRailCard = page.getByTestId('su-rail-titan-titan-time-box-setaside');
        await expect(titanRailCard).toBeVisible({ timeout: 15000 });

        await titanRailCard.click();
        await expect
            .poll(async () => titanRailCard.getAttribute('class'), { timeout: 5000 })
            .toContain('border-purple-400 ring-2 ring-purple-400');

        await expect
            .poll(async () => page.getByTestId('su-rail-titan-timebox-counter-titan-time-box-setaside').getAttribute('class'), { timeout: 5000 })
            .toContain('border-transparent');
        await expect
            .poll(async () => page.getByTestId('su-rail-titan-badge-titan-time-box-setaside').getAttribute('class'), { timeout: 5000 })
            .toContain('border-transparent');

        await game.screenshot('02-titan-rail-selected-board', testInfo);
    });
});
