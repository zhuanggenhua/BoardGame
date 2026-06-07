import type { Page } from '@playwright/test';
import { expect, test } from '../framework';
import { hideSmashUpDebugPanelForEvidence } from '../helpers/smashup';

const FOUR_PLAYER_TEST_QUERY = {
    numPlayers: 4,
    skipInitialization: true,
} as const;

function buildHostOutlineScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'badge-host',
                        defId: 'pirate_first_mate',
                        owner: '1',
                        controller: '1',
                        basePower: 2,
                        powerCounters: 1,
                        powerModifier: 2,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [
                            { uid: 'host-attached-action-1', defId: 'werewolf_leader_of_the_pack', ownerId: '1', talentUsed: false },
                            { uid: 'host-attached-action-2', defId: 'fairies_daisy_chain', ownerId: '1', talentUsed: false },
                        ],
                    },
                    {
                        uid: 'neighbor-minion',
                        defId: 'alien_invader',
                        owner: '2',
                        controller: '2',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_jungle', minions: [], ongoingActions: [] },
            { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
            { defId: 'base_the_factory', minions: [], ongoingActions: [] },
            { defId: 'base_temple_of_goju', minions: [], ongoingActions: [] },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1', '2', '3'],
                currentPlayerIndex: 0,
                turnNumber: 7,
                nextUid: 1000,
                players: {
                    '0': {
                        id: '0',
                        vp: 5,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['robots', 'wizards'],
                    },
                    '1': {
                        id: '1',
                        vp: 7,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 1,
                        actionsPlayed: 1,
                        actionLimit: 1,
                        factions: ['pirates', 'werewolves'],
                    },
                    '2': {
                        id: '2',
                        vp: 4,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['aliens', 'dinosaurs'],
                    },
                    '3': {
                        id: '3',
                        vp: 3,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['ninjas', 'ghosts'],
                    },
                },
            },
            sys: {
                phase: 'playCards',
                interaction: {
                    current: undefined,
                    queue: [],
                },
            },
        },
    };
}

async function injectMinionSelectionPrompt(page: Page): Promise<void> {
    await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (!harness?.state?.patch) {
            throw new Error('TestHarness patch API 不可用');
        }

        harness.state.patch({
            sys: {
                phase: 'playCards',
                interaction: {
                    queue: [],
                    current: {
                        id: 'host-outline-selection',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            title: '选择随从（多选）',
                            sourceId: 'host_outline_selection',
                            targetType: 'minion',
                            multi: {
                                min: 1,
                                max: 2,
                            },
                            options: [
                                {
                                    id: 'select-badge-host',
                                    label: '选择大副',
                                    value: { minionUid: 'badge-host', baseIndex: 0 },
                                },
                                {
                                    id: 'select-neighbor-minion',
                                    label: '选择相邻随从',
                                    value: { minionUid: 'neighbor-minion', baseIndex: 0 },
                                },
                            ],
                        },
                    },
                },
            },
        });
    });
}

test.describe('大杀四方宿主随从描边取证', () => {
    test('宿主随从已选中时只有卡面描边，内部角标与附着预览不复用高亮', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await page.setViewportSize({ width: 1600, height: 1000 });
        await game.openTestGame('smashup', FOUR_PLAYER_TEST_QUERY, 45000);
        await game.setupScene(buildHostOutlineScene());
        await hideSmashUpDebugPanelForEvidence(page);

        const hostMinion = page.locator('[data-minion-uid="badge-host"]');
        await expect(hostMinion).toBeVisible({ timeout: 15000 });

        await game.screenshot('01-host-neutral-board', testInfo);

        await injectMinionSelectionPrompt(page);
        await expect
            .poll(async () => hostMinion.getAttribute('class'), { timeout: 5000 })
            .toContain('scale-[1.04]');

        await hostMinion.click();
        await expect
            .poll(async () => {
                const frameClass = await page.locator('[data-testid="su-minion-frame-badge-host"]').getAttribute('class');
                return frameClass ?? '';
            }, { timeout: 5000 })
            .toContain('0.72');

        await hostMinion.hover();
        await expect
            .poll(async () => hostMinion.getAttribute('data-attached-overlay-visible'), { timeout: 5000 })
            .toBe('true');

        const visualState = await page.evaluate(() => {
            const frame = document.querySelector('[data-testid="su-minion-frame-badge-host"]') as HTMLElement | null;
            const powerBadge = document.querySelector('[data-testid="su-minion-power-badge-badge-host"]') as HTMLElement | null;
            const attachedBadgeFace = document.querySelector('[data-testid="smashup-attached-badge-face"]') as HTMLElement | null;
            const attachedBadgeCountFace = document.querySelector('[data-testid="smashup-attached-badge-count-face"]') as HTMLElement | null;
            const attachedPreview = document.querySelector('[data-attached-action-uid="host-attached-action-1"]') as HTMLElement | null;
            return {
                frameClass: frame?.className ?? '',
                powerBadgeClass: powerBadge?.className ?? '',
                attachedBadgeFaceClass: attachedBadgeFace?.className ?? '',
                attachedBadgeCountFaceClass: attachedBadgeCountFace?.className ?? '',
                attachedPreviewClass: attachedPreview?.className ?? '',
            };
        });

        expect(visualState.frameClass).toContain('ring-green-400');
        expect(visualState.frameClass).toContain('0.72');
        expect(visualState.powerBadgeClass).toContain('border-0');
        expect(visualState.powerBadgeClass).toContain('shadow-none');
        expect(visualState.attachedBadgeFaceClass).toContain('border-0');
        expect(visualState.attachedBadgeFaceClass).toContain('shadow-none');
        expect(visualState.attachedBadgeCountFaceClass).toContain('border-0');
        expect(visualState.attachedPreviewClass).toContain('border-slate-200');
        expect(visualState.attachedPreviewClass).not.toContain('border-green-300');
        expect(visualState.attachedPreviewClass).not.toContain('ring-green-300');

        await game.screenshot('02-host-selected-board', testInfo);
    });

    test('持续行动卡和泰坦打出后进入可发动高亮时，只有宿主卡外层描边', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await page.setViewportSize({ width: 1600, height: 1000 });
        await game.openTestGame('smashup', FOUR_PLAYER_TEST_QUERY, 45000);
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        {
                            uid: 'deep-one-live',
                            defId: 'innsmouth_deep_one',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [
                        {
                            uid: 'oa1',
                            defId: 'innsmouth_sacred_circle',
                            ownerId: '0',
                            talentUsed: false,
                            metadata: { powerCounters: 2 },
                        },
                    ],
                },
                { defId: 'base_the_jungle', minions: [], ongoingActions: [] },
                { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
            ],
            extra: {
                core: {
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 0,
                    turnNumber: 3,
                    nextUid: 500,
                    players: {
                        '0': {
                            id: '0',
                            vp: 5,
                            hand: [
                                {
                                    uid: 'hand-deep-one',
                                    defId: 'innsmouth_deep_one',
                                    type: 'minion',
                                    owner: '0',
                                    faction: 'innsmouth',
                                },
                            ],
                            deck: [],
                            discard: [],
                            minionsPlayed: 0,
                            minionLimit: 1,
                            actionsPlayed: 0,
                            actionLimit: 1,
                            factions: ['miskatonic', 'time_travelers'],
                        },
                        '1': {
                            id: '1',
                            vp: 3,
                            hand: [],
                            deck: [],
                            discard: [],
                            minionsPlayed: 0,
                            minionLimit: 1,
                            actionsPlayed: 0,
                            actionLimit: 1,
                            factions: ['pirates', 'aliens'],
                        },
                    },
                    titans: [
                        {
                            uid: 'time-box-live',
                            defId: 'time_travelers_time_box',
                            faction: 'time_travelers',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 1,
                            talentUsed: false,
                            location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                            metadata: { timeBoxCounters: 5 },
                        },
                    ],
                },
                sys: {
                    phase: 'playCards',
                    interaction: {
                        current: undefined,
                        queue: [],
                    },
                },
            },
        });
        await hideSmashUpDebugPanelForEvidence(page);

        const ongoingFrame = page.locator('[data-ongoing-uid="oa1"] > div').first();
        const titanFrame = page.locator('[data-testid="su-base-titan-time-box-live"]');

        await expect
            .poll(async () => ongoingFrame.getAttribute('class'), { timeout: 5000 })
            .toContain('border-amber-400');
        await expect
            .poll(async () => ongoingFrame.getAttribute('class'), { timeout: 5000 })
            .toContain('ring-2');
        await expect
            .poll(async () => titanFrame.getAttribute('class'), { timeout: 5000 })
            .toContain('border-amber-400');
        await expect
            .poll(async () => titanFrame.getAttribute('class'), { timeout: 5000 })
            .toContain('ring-2');

        const visualState = await page.evaluate(() => {
            const ongoingFrame = document.querySelector('[data-ongoing-uid="oa1"] > div') as HTMLElement | null;
            const titanFrame = document.querySelector('[data-testid="su-base-titan-time-box-live"]') as HTMLElement | null;
            const ongoingCounter = document.querySelector('[data-testid="su-base-ongoing-power-counter-oa1"]') as HTMLElement | null;
            const titanTimebox = document.querySelector('[data-testid="su-base-titan-timebox-counter-time-box-live"]') as HTMLElement | null;
            const titanPowerCounter = document.querySelector('[data-testid="su-base-titan-power-counter-time-box-live"]') as HTMLElement | null;
            return {
                ongoingFrameClass: ongoingFrame?.className ?? '',
                titanFrameClass: titanFrame?.className ?? '',
                ongoingCounterClass: ongoingCounter?.className ?? '',
                titanTimeboxClass: titanTimebox?.className ?? '',
                titanPowerCounterClass: titanPowerCounter?.className ?? '',
            };
        });

        expect(visualState.ongoingFrameClass).toContain('border-amber-400');
        expect(visualState.ongoingFrameClass).toContain('ring-2');
        expect(visualState.titanFrameClass).toContain('border-amber-400');
        expect(visualState.titanFrameClass).toContain('ring-2');
        expect(visualState.ongoingCounterClass).toContain('border-0');
        expect(visualState.ongoingCounterClass).toContain('shadow-none');
        expect(visualState.ongoingCounterClass).toContain('bg-amber-400');
        expect(visualState.titanTimeboxClass).toContain('border-0');
        expect(visualState.titanTimeboxClass).toContain('shadow-none');
        expect(visualState.titanTimeboxClass).toContain('bg-sky-300');
        expect(visualState.titanPowerCounterClass).toContain('border-0');
        expect(visualState.titanPowerCounterClass).toContain('shadow-none');
        expect(visualState.titanPowerCounterClass).toContain('bg-amber-400');

        await game.screenshot('03-ongoing-titan-highlight-board', testInfo);
    });
});
