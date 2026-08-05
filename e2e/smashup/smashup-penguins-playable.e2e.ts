import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

type InteractionOption = {
    id: string;
    value?: {
        cardUid?: string;
        defId?: string;
        minionUid?: string;
        baseIndex?: number;
        mode?: string;
    };
};

async function dispatchSmashUpCommand(page: any, type: string, payload: Record<string, any>, playerId = '0'): Promise<void> {
    await page.evaluate(async ({ commandType, commandPayload, commandPlayerId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        await harness.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, { commandType: type, commandPayload: payload, commandPlayerId: playerId });
    await page.waitForTimeout(300);
}

async function respondCurrentInteractionWithOptionIds(page: any, optionIds: string[]): Promise<void> {
    await page.evaluate(async (ids) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        const interaction = state?.sys?.interaction?.current;
        if (!interaction?.id || !interaction?.playerId) {
            throw new Error('Current interaction not found');
        }

        await harness.command.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId: interaction.playerId,
            payload: {
                interactionId: interaction.id,
                optionIds: ids,
            },
        });
    }, optionIds);
    await page.waitForTimeout(300);
}

async function dismissRevealOverlayIfPresent(page: any): Promise<void> {
    const closeButton = page.getByRole('button', { name: /^关闭$/ }).last();
    if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click({ force: true });
        await page.waitForTimeout(300);
    }
}

async function passOpenResponseWindows(page: any, game: any, maxPasses = 8): Promise<void> {
    for (let attempt = 0; attempt < maxPasses; attempt += 1) {
        const state = await game.getState();
        if (!state.sys?.responseWindow?.current && !state.sys?.interaction?.current) {
            return;
        }

        const passButton = page.getByTestId('me-first-pass-button');
        if (await passButton.isVisible().catch(() => false)) {
            await passButton.click();
            await page.waitForTimeout(300);
            continue;
        }

        if (state.sys?.responseWindow?.current) {
            await game.passResponseWindow();
            continue;
        }

        const current = state.sys?.interaction?.current;
        const passOption = (current?.data?.options ?? []).find((option: any) => (
            option.id === 'pass'
            || option.id === 'skip'
            || option.value?.kind === 'pass'
            || option.value?.skip === true
        ));
        if (passOption) {
            await page.evaluate(async ({ optionId, playerId }) => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                await harness.command.dispatch({
                    type: 'SYS_INTERACTION_RESPOND',
                    playerId,
                    payload: { optionId },
                });
            }, { optionId: passOption.id, playerId: current.playerId });
            await page.waitForTimeout(300);
            continue;
        }

        await page.waitForTimeout(300);
    }
}

async function chooseMandatoryReactionBySource(page: any, game: any, sourceDefId: string, maxAttempts = 8): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const state = await game.getState();
        const current = state.sys?.interaction?.current;
        const option = (current?.data?.options ?? []).find((candidate: any) => (
            candidate.value?.kind === 'trigger'
            && candidate.value?.triggerId?.includes(sourceDefId)
        ));
        if (current?.id && current?.playerId && option) {
            await page.evaluate(async ({ interactionId, optionId, playerId }) => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                await harness.command.dispatch({
                    type: 'SYS_INTERACTION_RESPOND',
                    playerId,
                    payload: { interactionId, optionId },
                });
            }, { interactionId: current.id, optionId: option.id, playerId: current.playerId });
            await page.waitForTimeout(300);
            return;
        }

        await page.waitForTimeout(300);
    }

    throw new Error(`Mandatory reaction option not found for ${sourceDefId}`);
}

async function chooseReactionBySourceIfPresent(page: any, game: any, sourceDefId: string, maxAttempts = 4): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const state = await game.getState();
        const current = state.sys?.interaction?.current;
        const option = (current?.data?.options ?? []).find((candidate: any) => (
            candidate.value?.kind === 'trigger'
            && candidate.value?.triggerId?.includes(sourceDefId)
        ));
        if (current?.id && current?.playerId && option) {
            await page.evaluate(async ({ interactionId, optionId, playerId }) => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                await harness.command.dispatch({
                    type: 'SYS_INTERACTION_RESPOND',
                    playerId,
                    payload: { interactionId, optionId },
                });
            }, { interactionId: current.id, optionId: option.id, playerId: current.playerId });
            await page.waitForTimeout(300);
            return true;
        }

        await page.waitForTimeout(300);
    }

    return false;
}

async function continueResolvedScoreBases(page: any, game: any, maxAttempts = 4): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const state = await game.getState();
        if (state.sys?.phase !== 'scoreBases') {
            return;
        }
        if (state.sys?.interaction?.current || state.sys?.responseWindow?.current) {
            return;
        }

        await game.advancePhase();
        await page.waitForTimeout(300);

        const nextState = await game.getState();
        const delayUntil = nextState.sys?._smashupPostScoringBaseRevealDelayUntil;
        if (typeof delayUntil === 'number') {
            await page.waitForTimeout(Math.max(0, Math.min(delayUntil - Date.now() + 100, 2500)));
        }
    }
}

function optionIdByCardUid(options: InteractionOption[], cardUid: string): string {
    const option = options.find(candidate => candidate.value?.cardUid === cardUid);
    if (!option) {
        throw new Error(`Interaction option not found for card ${cardUid}`);
    }
    return option.id;
}

function optionIdByMinionUid(options: InteractionOption[], minionUid: string): string {
    const option = options.find(candidate => candidate.value?.minionUid === minionUid);
    if (!option) {
        throw new Error(`Interaction option not found for minion ${minionUid}`);
    }
    return option.id;
}

test.describe('SmashUp - 企鹅普通派系可玩入口验证', () => {
    test('冲浪企鹅、破壳而出与企鹅宝宝可经真实入口连续结算', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await setChineseLocale(page.context());

        await game.openTestGame('smashup', {
            p0: 'penguins,pirates',
            p1: 'robots,wizards',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 20260809,
        }, 45000);
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['penguins', 'pirates'],
                hand: [
                    { uid: 'p0-surf', defId: 'penguins_surfing_penguin', type: 'minion' },
                    { uid: 'p0-hatching', defId: 'penguins_the_hatching', type: 'action' },
                    { uid: 'p0-low', defId: 'penguins_disguise_penguin', type: 'minion' },
                ],
                deck: [
                    { uid: 'p0-baby', defId: 'penguins_baby_penguin', type: 'minion' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'wizards'],
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
                    defId: 'base_ice_floe',
                    minions: [
                        { uid: 'p0-ally', defId: 'penguins_regurgitating_penguin', owner: '0', controller: '0', baseIndex: 0 },
                        { uid: 'p1-rival', defId: 'robot_microbot_alpha', owner: '1', controller: '1', baseIndex: 0 },
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_the_colony', minions: [], ongoingActions: [] },
            ],
        });

        await game.waitForPhase('playCards');
        await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'p0-surf', baseIndex: 0 });
        await game.waitForInteraction('penguins_surfing_penguin', 10000);
        await game.screenshot('企鹅冲浪企鹅选择移动伙伴', testInfo);

        const surfingOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(surfingOptions.some(option => option.value?.minionUid === 'p0-ally')).toBe(true);
        expect(surfingOptions.some(option => option.value?.minionUid === 'p1-rival')).toBe(false);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.minionUid === 'p0-ally',
            '冲浪企鹅选择己方反刍企鹅',
        );
        await game.waitForInteraction('penguins_surfing_penguin_choose_base', 10000);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.baseIndex === 1,
            '冲浪企鹅选择目的基地',
        );
        await game.waitForNoInteraction(10000);

        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'p0-hatching', targetBaseIndex: 0 });
        await game.waitForInteraction('penguins_baby_penguin', 10000);
        await game.screenshot('企鹅破壳而出触发企鹅宝宝额外打出', testInfo);

        const babyOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(babyOptions.some(option => option.value?.cardUid === 'p0-low')).toBe(true);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.cardUid === 'p0-low',
            '企鹅宝宝选择乔装企鹅',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                base0Minions: state.core.bases[0].minions.map((minion: any) => minion.uid),
                base1Minions: state.core.bases[1].minions.map((minion: any) => minion.uid),
                hand: state.core.players['0'].hand.map((card: any) => card.uid),
                deck: state.core.players['0'].deck.map((card: any) => card.uid),
                minionsPlayed: state.core.players['0'].minionsPlayed,
                interactionOpen: Boolean(state.sys.interaction?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            base0Minions: ['p1-rival', 'p0-surf', 'p0-baby', 'p0-low'],
            base1Minions: ['p0-ally'],
            hand: [],
            deck: [],
            minionsPlayed: 1,
            interactionOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('企鹅冲浪破壳宝宝真实入口收口状态', testInfo);
    });

    test('企鹅司令、时髦企鹅与水晶礼品可在真实牌库顶打出链中抽牌收口', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await setChineseLocale(page.context());

        await game.openTestGame('smashup', {
            p0: 'penguins,pirates',
            p1: 'robots,wizards',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 20260810,
        }, 45000);
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['penguins', 'pirates'],
                hand: [
                    { uid: 'p0-command', defId: 'penguins_command_penguin', type: 'minion' },
                ],
                deck: [
                    { uid: 'p0-snazzy', defId: 'penguins_snazzy_penguin', type: 'minion' },
                    { uid: 'p0-draw-1', defId: 'penguins_secret_mission', type: 'action' },
                    { uid: 'p0-draw-2', defId: 'penguins_the_hatching', type: 'action' },
                    { uid: 'p0-draw-3', defId: 'penguins_under_the_ice', type: 'action' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'wizards'],
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
                    defId: 'base_ice_floe',
                    minions: [],
                    ongoingActions: [
                        { uid: 'p0-gift', defId: 'penguins_pebble_gift', ownerId: '0' },
                    ],
                },
                { defId: 'base_the_colony', minions: [], ongoingActions: [] },
            ],
        });

        await game.waitForPhase('playCards');
        await game.screenshot('企鹅司令水晶礼品牌库顶链就绪', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'p0-command', baseIndex: 0 });
        await chooseReactionBySourceIfPresent(page, game, 'penguins_pebble_gift');
        await passOpenResponseWindows(page, game);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                base0Minions: state.core.bases[0].minions.map((minion: any) => minion.uid),
                hand: state.core.players['0'].hand.map((card: any) => card.uid),
                deck: state.core.players['0'].deck.map((card: any) => card.uid),
                minionsPlayed: state.core.players['0'].minionsPlayed,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 15000 }).toEqual({
            base0Minions: ['p0-command', 'p0-snazzy'],
            hand: ['p0-draw-1', 'p0-draw-2', 'p0-draw-3'],
            deck: [],
            minionsPlayed: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('企鹅司令时髦水晶礼品收口状态', testInfo);
    });

    test('秘密任务真实入口会置底多张手牌、抽等量牌并清空交互', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await setChineseLocale(page.context());

        await game.openTestGame('smashup', {
            p0: 'penguins,pirates',
            p1: 'robots,wizards',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 20260811,
        }, 45000);
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['penguins', 'pirates'],
                hand: [
                    { uid: 'p0-mission', defId: 'penguins_secret_mission', type: 'action' },
                    { uid: 'p0-bottom-1', defId: 'penguins_surfing_penguin', type: 'minion' },
                    { uid: 'p0-bottom-2', defId: 'penguins_the_hatching', type: 'action' },
                    { uid: 'p0-keep', defId: 'penguins_under_the_ice', type: 'action' },
                ],
                deck: [
                    { uid: 'p0-draw-1', defId: 'penguins_baby_penguin', type: 'minion' },
                    { uid: 'p0-draw-2', defId: 'penguins_snazzy_penguin', type: 'minion' },
                    { uid: 'p0-stay', defId: 'penguins_command_penguin', type: 'minion' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'wizards'],
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_ice_floe', minions: [], ongoingActions: [] },
                { defId: 'base_the_colony', minions: [], ongoingActions: [] },
            ],
        });

        await game.waitForPhase('playCards');
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'p0-mission' });
        await game.waitForInteraction('penguins_secret_mission', 10000);
        await game.screenshot('企鹅秘密任务多选手牌置底', testInfo);

        const options = await game.getInteractionOptions() as InteractionOption[];
        await respondCurrentInteractionWithOptionIds(page, [
            optionIdByCardUid(options, 'p0-bottom-1'),
            optionIdByCardUid(options, 'p0-bottom-2'),
        ]);
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            const hand = state.core.players['0'].hand.map((card: any) => card.uid);
            const deck = state.core.players['0'].deck.map((card: any) => card.uid);
            return {
                hasKeep: hand.includes('p0-keep'),
                hasDraw1: hand.includes('p0-draw-1'),
                hasDraw2: hand.includes('p0-draw-2'),
                bottomCardsLeftHand: hand.includes('p0-bottom-1') || hand.includes('p0-bottom-2'),
                deckContainsStay: deck.includes('p0-stay'),
                deckContainsBottom1: deck.includes('p0-bottom-1'),
                deckContainsBottom2: deck.includes('p0-bottom-2'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            hasKeep: true,
            hasDraw1: true,
            hasDraw2: true,
            bottomCardsLeftHand: false,
            deckContainsStay: true,
            deckContainsBottom1: true,
            deckContainsBottom2: true,
            interactionOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('企鹅秘密任务结算后状态清空', testInfo);
    });

    test('在冰下、乔装企鹅与渴望飞翔的工作可经真实入口结算到权威状态', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await setChineseLocale(page.context());

        await game.openTestGame('smashup', {
            p0: 'penguins,pirates',
            p1: 'robots,wizards',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 20260812,
        }, 45000);
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['penguins', 'pirates'],
                hand: [
                    { uid: 'p0-under', defId: 'penguins_under_the_ice', type: 'action' },
                    { uid: 'p0-wish', defId: 'penguins_a_wish_for_wings_that_work', type: 'action' },
                ],
                deck: [
                    { uid: 'p0-under-action-a', defId: 'penguins_secret_mission', type: 'action' },
                    { uid: 'p0-under-minion', defId: 'penguins_baby_penguin', type: 'minion' },
                    { uid: 'p0-under-action-b', defId: 'penguins_the_hatching', type: 'action' },
                    { uid: 'p0-under-action-c', defId: 'penguins_i_cant_tell_them_apart', type: 'action' },
                    { uid: 'p0-under-action-d', defId: 'penguins_ice_slide', type: 'action' },
                    { uid: 'p0-disguise-top', defId: 'penguins_baby_penguin', type: 'minion' },
                    { uid: 'p0-rest', defId: 'penguins_command_penguin', type: 'minion' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 2,
            },
            player1: {
                factions: ['robots', 'wizards'],
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
                    defId: 'base_ice_floe',
                    minions: [
                        { uid: 'p0-disguise', defId: 'penguins_disguise_penguin', owner: '0', controller: '0', baseIndex: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_colony',
                    minions: [
                        { uid: 'p0-wish-anchor', defId: 'penguins_baby_penguin', owner: '0', controller: '0', baseIndex: 1 },
                    ],
                    ongoingActions: [],
                },
            ],
            extra: {
                core: {
                    titans: [{
                        uid: 'p0-emperor',
                        defId: 'penguins_emperor_penguin',
                        faction: 'penguins',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                    }],
                },
            },
        });

        await game.waitForPhase('playCards');
        await game.screenshot('企鹅在冰下乔装渴望链就绪', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'p0-under', targetBaseIndex: 0 });
        await dismissRevealOverlayIfPresent(page);
        await game.waitForNoInteraction(10000);

        await dispatchSmashUpCommand(page, 'su:use_talent', { minionUid: 'p0-disguise', baseIndex: 0 });
        await dismissRevealOverlayIfPresent(page);
        await game.waitForNoInteraction(10000);

        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'p0-wish', targetBaseIndex: 1 });
        await game.waitForInteraction('penguins_a_wish_for_wings_that_work', 10000);
        await game.screenshot('企鹅渴望飞翔选择企鹅帝皇', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.mode === 'titan',
            '渴望飞翔的工作选择企鹅帝皇',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            const player0 = state.core.players['0'];
            const base0 = state.core.bases[0];
            const titan = state.core.titans?.find((candidate: any) => candidate.uid === 'p0-emperor');
            return {
                base0Minions: base0.minions.map((minion: any) => minion.uid),
                underMinionStillInDeck: player0.deck.some((card: any) => card.uid === 'p0-under-minion'),
                disguiseStillOnBase: base0.minions.some((minion: any) => minion.uid === 'p0-disguise'),
                disguiseReturnedToDeck: player0.deck.some((card: any) => card.uid === 'p0-disguise'),
                titanLocation: titan?.location,
                base1Minions: state.core.bases[1].minions.map((minion: any) => minion.uid),
                interactionOpen: Boolean(state.sys.interaction?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            base0Minions: ['p0-under-minion', 'p0-disguise-top'],
            underMinionStillInDeck: false,
            disguiseStillOnBase: false,
            disguiseReturnedToDeck: true,
            titanLocation: { zone: 'base', baseIndex: 1, enteredAt: expect.any(Number) },
            base1Minions: ['p0-wish-anchor'],
            interactionOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('企鹅在冰下乔装渴望收口状态', testInfo);
    });

    test('反刍企鹅真实打出后可选择展示行动并排序剩余牌库顶', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await setChineseLocale(page.context());

        await game.openTestGame('smashup', {
            p0: 'penguins,pirates',
            p1: 'robots,wizards',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 20260806,
        }, 45000);
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['penguins', 'pirates'],
                hand: [
                    { uid: 'p0-regurgitating', defId: 'penguins_regurgitating_penguin', type: 'minion' },
                ],
                deck: [
                    { uid: 'p0-action-a', defId: 'penguins_secret_mission', type: 'action' },
                    { uid: 'p0-minion-b', defId: 'penguins_baby_penguin', type: 'minion' },
                    { uid: 'p0-action-c', defId: 'penguins_the_hatching', type: 'action' },
                    { uid: 'p0-rest', defId: 'penguins_command_penguin', type: 'minion' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'wizards'],
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_ice_floe', minions: [], ongoingActions: [] },
                { defId: 'base_the_colony', minions: [], ongoingActions: [] },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await expect(page.locator('[data-card-uid="p0-regurgitating"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-base-index="0"]')).toBeVisible({ timeout: 15000 });

        await game.playCard('penguins_regurgitating_penguin', { targetBaseIndex: 0 });
        await game.waitForInteraction('penguins_regurgitating_penguin', 10000);
        await game.screenshot('企鹅反刍企鹅展示行动选择', testInfo);

        const chooseOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(chooseOptions.some(option => option.value?.cardUid === 'p0-action-a')).toBe(true);
        expect(chooseOptions.some(option => option.value?.cardUid === 'p0-action-c')).toBe(true);
        expect(chooseOptions.some(option => option.value?.cardUid === 'p0-minion-b')).toBe(false);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.cardUid === 'p0-action-c',
            '反刍企鹅选择破壳而出加入手牌',
        );

        await game.waitForInteraction('penguins_regurgitating_penguin_order', 10000);
        await game.screenshot('企鹅反刍企鹅剩余牌排序', testInfo);

        const orderOptions = await game.getInteractionOptions() as InteractionOption[];
        await respondCurrentInteractionWithOptionIds(page, [
            optionIdByCardUid(orderOptions, 'p0-minion-b'),
            optionIdByCardUid(orderOptions, 'p0-action-a'),
        ]);

        await game.waitForNoInteraction(10000);
        await expect.poll(async () => {
            const state = await game.getState();
            const player0 = state.core.players['0'];
            const base0 = state.core.bases[0];
            return {
                hand: player0.hand.map((card: any) => card.uid),
                deck: player0.deck.map((card: any) => card.uid),
                base0Minions: base0.minions.map((minion: any) => minion.uid),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            hand: ['p0-action-c'],
            deck: ['p0-minion-b', 'p0-action-a', 'p0-rest'],
            base0Minions: ['p0-regurgitating'],
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('企鹅反刍企鹅结算后状态清空', testInfo);
    });

    test('浮冰真实基地能力会选择己方随从置底并打出牌库顶随从', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await setChineseLocale(page.context());

        await game.openTestGame('smashup', {
            p0: 'penguins,pirates',
            p1: 'robots,wizards',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 20260807,
        }, 45000);
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['penguins', 'pirates'],
                hand: [],
                deck: [
                    { uid: 'p0-top-baby', defId: 'penguins_baby_penguin', type: 'minion' },
                    { uid: 'p0-rest-action', defId: 'penguins_secret_mission', type: 'action' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'wizards'],
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
                    defId: 'base_ice_floe',
                    minions: [
                        { uid: 'p0-old-penguin', defId: 'penguins_surfing_penguin', owner: '0', controller: '0', baseIndex: 0 },
                        { uid: 'p1-rival', defId: 'robot_microbot_alpha', owner: '1', controller: '1', baseIndex: 0 },
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_the_colony', minions: [], ongoingActions: [] },
            ],
        });

        await game.waitForPhase('playCards');
        await dispatchSmashUpCommand(page, 'su:use_base_ability', { baseIndex: 0 });
        await game.waitForInteraction('base_ice_floe', 10000);
        await game.screenshot('企鹅浮冰选择置底随从', testInfo);

        const options = await game.getInteractionOptions() as InteractionOption[];
        expect(options.some(option => option.value?.minionUid === 'p0-old-penguin')).toBe(true);
        expect(options.some(option => option.value?.minionUid === 'p1-rival')).toBe(false);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.minionUid === 'p0-old-penguin',
            '浮冰置底己方冲浪企鹅',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            const player0 = state.core.players['0'];
            const base0 = state.core.bases[0];
            return {
                base0Minions: base0.minions.map((minion: any) => minion.uid),
                deck: player0.deck.map((card: any) => card.uid),
                usedBaseAbility: state.core.usedBaseAbilitiesThisTurn?.some((entry: any) => (
                    entry.playerId === '0'
                    && entry.baseIndex === 0
                    && entry.baseDefId === 'base_ice_floe'
                )) ?? false,
                interactionOpen: Boolean(state.sys.interaction?.current),
            };
        }, { timeout: 10000 }).toEqual({
            base0Minions: ['p1-rival', 'p0-top-baby'],
            deck: ['p0-rest-action', 'p0-old-penguin'],
            usedBaseAbility: true,
            interactionOpen: false,
        });

        await game.screenshot('企鹅浮冰结算后状态清空', testInfo);
    });

    test('跳上船与冰滑道会在真实计分后结算到替换基地并抽牌', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await setChineseLocale(page.context());

        await game.openTestGame('smashup', {
            p0: 'penguins,pirates',
            p1: 'robots,wizards',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 20260808,
        }, 45000);
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['penguins', 'pirates'],
                hand: [],
                deck: [
                    { uid: 'p0-leap-baby', defId: 'penguins_baby_penguin', type: 'minion' },
                    { uid: 'p0-slide-draw-1', defId: 'penguins_secret_mission', type: 'action' },
                    { uid: 'p0-slide-draw-2', defId: 'penguins_the_hatching', type: 'action' },
                    { uid: 'p0-rest', defId: 'penguins_command_penguin', type: 'minion' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'wizards'],
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
                    defId: 'base_ice_floe',
                    minions: [
                        { uid: 'p0-score-1', defId: 'penguins_surfing_penguin', owner: '0', controller: '0', baseIndex: 0, basePower: 10 },
                        { uid: 'p0-score-2', defId: 'penguins_command_penguin', owner: '0', controller: '0', baseIndex: 0, basePower: 10 },
                    ],
                    ongoingActions: [
                        { uid: 'p0-leaping', defId: 'penguins_leaping_aboard', ownerId: '0' },
                        { uid: 'p0-slide', defId: 'penguins_ice_slide', ownerId: '0' },
                    ],
                },
                { defId: 'base_the_colony', minions: [], ongoingActions: [] },
            ],
            extra: {
                core: {
                    baseDeck: ['base_the_colony'],
                    baseDiscard: [],
                },
            },
        });

        await game.waitForPhase('playCards');
        await game.screenshot('企鹅计分前跳上船与冰滑道就绪', testInfo);

        await game.advancePhase();
        await game.waitForPhase('scoreBases', 10000);
        await chooseMandatoryReactionBySource(page, game, 'penguins_leaping_aboard');
        await passOpenResponseWindows(page, game);
        await continueResolvedScoreBases(page, game);
        await passOpenResponseWindows(page, game);
        await continueResolvedScoreBases(page, game);

        await expect.poll(async () => {
            const state = await game.getState();
            const player0 = state.core.players['0'];
            const base0 = state.core.bases[0];
            const handUids = player0.hand.map((card: any) => card.uid);
            const deckUids = player0.deck.map((card: any) => card.uid);
            return {
                phase: state.sys.phase,
                base0DefId: base0.defId,
                base0Minions: base0.minions.map((minion: any) => minion.uid),
                iceSlideDrawsInHand: handUids.includes('p0-slide-draw-1') && handUids.includes('p0-slide-draw-2'),
                leapingBabyStillInDeck: deckUids.includes('p0-leap-baby'),
                leapingBabyStillInHand: handUids.includes('p0-leap-baby'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 20000 }).toEqual({
            phase: 'playCards',
            base0DefId: 'base_the_colony',
            base0Minions: ['p0-leap-baby'],
            iceSlideDrawsInHand: true,
            leapingBabyStillInDeck: false,
            leapingBabyStillInHand: false,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('企鹅计分后跳上船冰滑道收口状态', testInfo);
    });
});
