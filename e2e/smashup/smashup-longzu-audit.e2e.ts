import { test, expect } from '../framework';

type InteractionOption = {
    id: string;
    label?: string;
    value?: Record<string, any>;
};

type InteractionSnapshot = {
    sourceId: string;
    playerId: string;
    options: InteractionOption[];
};

async function openLongzuScene(game: any, scene: Record<string, any>): Promise<void> {
    const rawPage = (game as { page?: { goto?: (...args: any[]) => Promise<unknown> } }).page;
    if (rawPage?.goto) {
        await rawPage.goto('about:blank', { waitUntil: 'commit', timeout: 15000 }).catch(() => undefined);
    }
    await game.openTestGame('smashup', {
        p0: 'pirates,ninjas',
        p1: 'aliens,robots',
        skipFactionSelect: true,
    }, 90000);
    await game.setupScene({
        gameId: 'smashup',
        currentPlayer: scene.currentPlayer ?? '0',
        phase: scene.phase ?? 'playCards',
        player0: {
            hand: [],
            deck: [],
            discard: [],
            factions: ['dragons', 'superheroes'],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            ...(scene.player0 ?? {}),
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
            factions: ['geeks', 'aliens'],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            ...(scene.player1 ?? {}),
        },
        bases: scene.bases ?? [
            { defId: 'base_dragons_lair', minions: [] },
            { defId: 'base_converted_cave', minions: [] },
            { defId: 'base_tabletop', minions: [] },
        ],
        extra: scene.extra,
    });
}

async function dispatchSmashUpCommand(page: any, type: string, payload: Record<string, any>, playerId = '0'): Promise<void> {
    await page.evaluate(({ commandType, commandPayload, commandPlayerId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        harness.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, { commandType: type, commandPayload: payload, commandPlayerId: playerId });
    await page.waitForTimeout(300);
}

async function readInteraction(page: any): Promise<InteractionSnapshot | null> {
    return page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const current = state?.sys?.interaction?.current;
        if (!current) return null;
        return {
            sourceId: current.data?.sourceId ?? '',
            playerId: current.playerId,
            options: (current.data?.options ?? []).map((option: any) => ({
                id: option.id,
                label: option.label,
                value: option.value,
            })),
        };
    });
}

async function chooseOption(
    page: any,
    matcher: (option: InteractionOption) => boolean,
    description: string,
): Promise<void> {
    const current = await readInteraction(page);
    const option = current?.options.find(matcher);
    expect(option, `未找到交互选项：${description}`).toBeTruthy();
    await page.evaluate(({ optionId, playerId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        harness.command.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId,
            payload: { optionId },
        });
    }, { optionId: option!.id, playerId: current!.playerId });
    await page.waitForTimeout(300);
}

async function chooseMultipleOptions(
    page: any,
    matchers: Array<(option: InteractionOption) => boolean>,
): Promise<void> {
    const current = await readInteraction(page);
    expect(current, '当前没有可提交的多选交互').toBeTruthy();
    const optionIds = matchers.map((matcher, index) => {
        const option = current!.options.find(matcher);
        expect(option, `未找到第 ${index + 1} 个多选选项`).toBeTruthy();
        return option!.id;
    });
    await page.evaluate(({ playerId, selectedOptionIds }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        harness.command.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId,
            payload: { optionIds: selectedOptionIds },
        });
    }, { playerId: current!.playerId, selectedOptionIds: optionIds });
    await page.waitForTimeout(300);
}

async function chooseReactionTrigger(page: any, matcher: (option: InteractionOption) => boolean): Promise<void> {
    await chooseOption(page, (option) => option.id !== 'skip' && option.id !== 'pass' && matcher(option), 'reaction trigger');
}

async function getLongzuEvidenceState(game: any): Promise<Record<string, any>> {
    const state = await game.getState();
    return {
        phase: state?.sys?.phase,
        responseWindow: state?.sys?.responseWindow?.current ?? null,
        interactionSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
        triggerQueue: state?.core?.triggerQueue ?? [],
        reactionSession: state?.sys?.smashupReactionSession ?? null,
        eventTypes: (state?.sys?.eventStream?.entries ?? []).slice(-30).map((entry: any) => entry.event?.type),
        baseDeck: state?.core?.baseDeck ?? [],
        baseDiscard: state?.core?.baseDiscard ?? [],
        bases: state?.core?.bases?.map((base: any) => ({
            defId: base.defId,
            minions: (base.minions ?? []).map((minion: any) => ({
                uid: minion.uid,
                defId: minion.defId,
                controller: minion.controller,
                owner: minion.owner,
                basePower: minion.basePower,
                powerCounters: minion.powerCounters,
                powerModifier: minion.powerModifier,
                tempPowerModifier: minion.tempPowerModifier,
                effectivePower: (minion.basePower ?? 0)
                    + (minion.powerCounters ?? 0)
                    + (minion.powerModifier ?? 0)
                    + (minion.tempPowerModifier ?? 0),
                attachedActions: (minion.attachedActions ?? []).map((action: any) => ({
                    uid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                })),
            })),
            ongoingActions: (base.ongoingActions ?? []).map((action: any) => ({
                uid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
            })),
        })),
        players: Object.fromEntries(Object.entries(state?.core?.players ?? {}).map(([playerId, player]: [string, any]) => [
            playerId,
            {
                hand: (player.hand ?? []).map((card: any) => ({ uid: card.uid, defId: card.defId })),
                deck: (player.deck ?? []).map((card: any) => ({ uid: card.uid, defId: card.defId })),
                discard: (player.discard ?? []).map((card: any) => ({ uid: card.uid, defId: card.defId })),
                actionLimit: player.actionLimit,
                actionsPlayed: player.actionsPlayed,
                minionLimit: player.minionLimit,
                minionsPlayed: player.minionsPlayed,
                vp: player.vp,
            },
        ])),
        tempBasePowerModifiers: state?.core?.tempBasePowerModifiers ?? [],
        specialLimitUsed: state?.core?.specialLimitUsed ?? null,
    };
}

test.describe('SmashUp longzu 三派系 L3-L4 真实入口', () => {
    test('龙：侧翼攻击从真实手牌行动经三段交互打出额外基地行动', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            player0: {
                hand: [{ uid: 'flank', defId: 'dragons_flank_attack', type: 'action', owner: '0' }],
                deck: [{ uid: 'deck-lands', defId: 'dragons_dragon_lands', type: 'action', owner: '0' }],
                discard: [{ uid: 'discard-raze', defId: 'dragons_raze', type: 'action', owner: '0' }],
            },
            bases: [
                { defId: 'base_dragons_lair', minions: [{ uid: 'ally', defId: 'dragons_imperial_dragon', owner: '0', controller: '0', basePower: 3 }] },
                { defId: 'base_converted_cave', minions: [{ uid: 'enemy', defId: 'geeks_game_guru', owner: '1', controller: '1', basePower: 3 }] },
            ],
        });

        await game.screenshot('dragons-flank-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'flank' });
        await game.waitForInteraction('dragons_flank_attack_source', 10000);
        await game.screenshot('dragons-flank-02-source', testInfo);
        await chooseOption(page, option => option.value?.searchScope === 'both', '侧翼攻击选择牌库+弃牌堆');

        await game.waitForInteraction('dragons_flank_attack_card', 10000);
        await game.screenshot('dragons-flank-03-card', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'discard-raze', '侧翼攻击选择弃牌堆里的夷平');

        await game.waitForInteraction('dragons_flank_attack_base', 10000);
        await game.screenshot('dragons-flank-04-base', testInfo);
        await chooseOption(page, option => option.value?.baseIndex === 1, '侧翼攻击选择目标基地');
        await game.waitForNoInteraction(10000);

        const state = await getLongzuEvidenceState(game);
        expect(state.bases[1].ongoingActions.map((action: any) => action.uid)).toContain('discard-raze');
        expect(state.players['0'].discard.map((card: any) => card.uid)).not.toContain('discard-raze');
        expect(state.players['0'].deck.map((card: any) => card.uid)).toContain('deck-lands');
        await game.screenshot('dragons-flank-05-resolved', testInfo);
    });

    test('龙：烧毁它从真实手牌行动选择基地弃牌堆替换基地并保留原基地随从', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            player0: {
                hand: [{ uid: 'burn', defId: 'dragons_burn_it_down', type: 'action', owner: '0' }],
            },
            bases: [{
                defId: 'base_dragons_lair',
                minions: [
                    { uid: 'ally', defId: 'dragons_imperial_dragon', owner: '0', controller: '0', basePower: 3 },
                    { uid: 'enemy', defId: 'geeks_game_guru', owner: '1', controller: '1', basePower: 3 },
                ],
                ongoingActions: [{ uid: 'ground', defId: 'dragons_dangerous_ground', ownerId: '1' }],
            }],
            extra: {
                core: {
                    baseDeck: ['base_converted_cave'],
                    baseDiscard: ['base_tabletop'],
                },
            },
        });

        await game.screenshot('dragons-burn-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'burn', targetBaseIndex: 0 });
        await game.waitForInteraction('dragons_burn_it_down', 10000);
        await game.screenshot('dragons-burn-02-base-choice', testInfo);
        await chooseOption(page, option => option.value?.baseDefId === 'base_tabletop', '烧毁它选择桌游桌');
        await game.waitForNoInteraction(10000);

        const state = await getLongzuEvidenceState(game);
        expect(state.bases[0].defId).toBe('base_tabletop');
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toEqual(['ally', 'enemy']);
        expect(state.players['1'].discard.map((card: any) => card.uid)).toContain('ground');
        expect(state.baseDiscard).toContain('base_dragons_lair');
        await game.screenshot('dragons-burn-03-replaced', testInfo);
    });

    test('龙：险地在对手把随从打到该基地后创建强制弃牌交互', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            currentPlayer: '1',
            player0: {
                factions: ['dragons', 'superheroes'],
            },
            player1: {
                factions: ['geeks', 'aliens'],
                hand: [
                    { uid: 'play-minion', defId: 'geeks_game_guru', type: 'minion', owner: '1' },
                    { uid: 'discard-a', defId: 'geeks_fan', type: 'minion', owner: '1' },
                    { uid: 'discard-b', defId: 'geeks_force_of_wil', type: 'action', owner: '1' },
                ],
            },
            bases: [{
                defId: 'base_dragons_lair',
                minions: [],
                ongoingActions: [{ uid: 'dangerous', defId: 'dragons_dangerous_ground', ownerId: '0' }],
            }],
        });

        await game.screenshot('dragons-dangerous-ground-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'play-minion', baseIndex: 0 }, '1');
        await game.waitForInteraction('dragons_dangerous_ground', 10000);
        await game.screenshot('dragons-dangerous-ground-02-discard-prompt', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'discard-b', '险地弃掉维尔的力量');
        await game.waitForNoInteraction(10000);

        const state = await getLongzuEvidenceState(game);
        expect(state.players['1'].discard.map((card: any) => card.uid)).toContain('discard-b');
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toContain('play-minion');
        await game.screenshot('dragons-dangerous-ground-03-resolved', testInfo);
    });

    test('龙：幼龙会让对手通过卷走移入本基地的随从本回合 -1 力量', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            currentPlayer: '1',
            player0: {
                factions: ['dragons', 'superheroes'],
            },
            player1: {
                factions: ['tornados', 'aliens'],
                hand: [{ uid: 'carried-away', defId: 'tornados_carried_away', type: 'action', owner: '1' }],
            },
            bases: [
                {
                    defId: 'base_dragons_lair',
                    minions: [{ uid: 'hatchling', defId: 'dragons_hatchling', owner: '0', controller: '0', basePower: 2 }],
                },
                {
                    defId: 'base_converted_cave',
                    minions: [{ uid: 'moving-fan', defId: 'geeks_fan', owner: '1', controller: '1', basePower: 2 }],
                },
            ],
        });

        await game.screenshot('dragons-hatchling-carried-away-01-before-move', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', {
            cardUid: 'carried-away',
            targetBaseIndex: 1,
            targetMinionUid: 'moving-fan',
        }, '1');
        await game.waitForInteraction('tornados_carried_away_dest', 10000);
        await game.screenshot('dragons-hatchling-carried-away-02-destination-choice', testInfo);
        await chooseOption(page, option => option.value?.baseIndex === 0, '卷走选择有幼龙的龙穴');
        await game.waitForNoInteraction(10000);

        const state = await getLongzuEvidenceState(game);
        const targetBase = state.bases[0];
        const movedMinion = targetBase.minions.find((minion: any) => minion.uid === 'moving-fan');
        expect(targetBase.minions.map((minion: any) => minion.uid)).toContain('hatchling');
        expect(movedMinion?.tempPowerModifier).toBe(-1);
        expect(movedMinion?.effectivePower).toBe(1);
        await game.screenshot('dragons-hatchling-carried-away-03-after-move-minus-one', testInfo);
    });

    test('龙：推倒城墙在计分前 reaction 入口授予该基地额外随从', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            player0: {
                hand: [{ uid: 'extra-minion', defId: 'dragons_hatchling', type: 'minion', owner: '0' }],
            },
            player1: {
                factions: ['geeks', 'aliens'],
            },
            bases: [{
                defId: 'base_dragons_lair',
                minions: [
                    { uid: 'ally-heavy', defId: 'dragons_imperial_dragon', owner: '0', controller: '0', basePower: 16 },
                    { uid: 'enemy-heavy', defId: 'geeks_game_guru', owner: '1', controller: '1', basePower: 3 },
                ],
                ongoingActions: [{ uid: 'walls', defId: 'dragons_bring_down_the_walls', ownerId: '0' }],
            }],
            extra: {
                core: {
                    baseDeck: ['base_converted_cave'],
                },
            },
        });

        await game.screenshot('dragons-bring-down-01-ready', testInfo);
        await game.advancePhase();
        await game.waitForInteraction('smashup_immediate_extra_minion', 20000);
        await game.screenshot('dragons-bring-down-02-extra-minion', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'extra-minion', '额外打出幼龙');
        await expect.poll(async () => {
            const next = await getLongzuEvidenceState(game);
            return {
                hasExtraMinion: next.bases[0]?.minions?.some((minion: any) => minion.uid === 'extra-minion') ?? false,
                interactionSourceId: next.interactionSourceId,
            };
        }, { timeout: 10000 }).toMatchObject({
            hasExtraMinion: true,
            interactionSourceId: expect.not.stringMatching(/^smashup_immediate_extra_minion$/),
        });

        const state = await getLongzuEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toContain('extra-minion');
        expect(state.specialLimitUsed).toBeNull();
        await game.screenshot('dragons-bring-down-04-resolved', testInfo);
    });

    test('超级英雄：心灵女士从真实打出入口选择敌方随从并压制其能力', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            player0: {
                hand: [{ uid: 'mind-lady', defId: 'superheroes_mind_lady', type: 'minion', owner: '0' }],
            },
            player1: {
                hand: [],
            },
            bases: [{
                defId: 'base_converted_cave',
                minions: [
                    { uid: 'target', defId: 'geeks_fan', owner: '1', controller: '1', basePower: 2 },
                    { uid: 'other-target', defId: 'superheroes_captain_amazing', owner: '1', controller: '1', basePower: 5 },
                ],
            }],
        });

        await game.screenshot('superheroes-mind-lady-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'mind-lady', baseIndex: 0 });
        await game.waitForInteraction('superheroes_mind_lady', 10000);
        await game.screenshot('superheroes-mind-lady-02-target', testInfo);
        await chooseOption(page, option => option.value?.minionUid === 'target', '心灵女士选择游戏专家');
        await game.waitForNoInteraction(10000);

        const state = await getLongzuEvidenceState(game);
        expect(state.eventTypes).toContain('su:card_suppressed');
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toContain('mind-lady');
        await game.screenshot('superheroes-mind-lady-03-suppressed', testInfo);
    });

    test('超级英雄：温和市民在回合开始时确认自毁并检索更强随从额外进场', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            currentPlayer: '1',
            phase: 'playCards',
            player0: {
                deck: [
                    { uid: 'captain-deck', defId: 'superheroes_captain_amazing', type: 'minion', owner: '0' },
                    { uid: 'burst-deck', defId: 'superheroes_the_burst', type: 'minion', owner: '0' },
                    { uid: 'small-deck', defId: 'geeks_fan', type: 'minion', owner: '0' },
                ],
            },
            bases: [{
                defId: 'base_converted_cave',
                minions: [{ uid: 'citizen', defId: 'superheroes_mild_mannered_citizen', owner: '0', controller: '0', basePower: 2 }],
            }],
        });

        await game.screenshot('superheroes-citizen-01-ready', testInfo);
        await game.advancePhase();
        await expect.poll(async () => {
            const next = await getLongzuEvidenceState(game);
            if (next.interactionSourceId) return next.interactionSourceId;
            return next.bases[0]?.minions?.some((minion: any) => minion.uid === 'captain-deck' || minion.uid === 'burst-deck')
                ? 'resolved'
                : null;
        }, { timeout: 10000 }).not.toBeNull();

        let state = await getLongzuEvidenceState(game);
        if (state.interactionSourceId === 'superheroes_mild_mannered_citizen') {
            await game.screenshot('superheroes-citizen-02-confirm', testInfo);
            await chooseOption(page, option => option.id === 'destroy' || option.value?.destroy === true, '温和市民确认自毁');
            state = await getLongzuEvidenceState(game);
        }
        if (state.interactionSourceId === 'superheroes_mild_mannered_citizen_search') {
            await game.screenshot('superheroes-citizen-03-search', testInfo);
            await chooseOption(page, option => option.value?.cardUid === 'captain-deck', '温和市民选择惊奇队长');
        }

        await expect.poll(async () => {
            const next = await getLongzuEvidenceState(game);
            return {
                hasCaptain: next.bases[0]?.minions?.some((minion: any) => minion.uid === 'captain-deck') ?? false,
                citizenDiscarded: next.players['0']?.discard?.some((card: any) => card.uid === 'citizen') ?? false,
            };
        }, { timeout: 10000 }).toEqual({
            hasCaptain: true,
            citizenDiscarded: true,
        });

        state = await getLongzuEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toContain('captain-deck');
        expect(state.players['0'].discard.map((card: any) => card.uid)).toContain('citizen');
        await game.screenshot('superheroes-citizen-04-replaced', testInfo);
    });

    test('超级英雄：放射暴露从真实手牌行动消灭己方随从并检索更高力量随从', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            player0: {
                hand: [{ uid: 'radio', defId: 'superheroes_radioactive_exposure', type: 'action', owner: '0' }],
                deck: [
                    { uid: 'higher', defId: 'superheroes_captain_amazing', type: 'minion', owner: '0' },
                    { uid: 'same', defId: 'superheroes_the_burst', type: 'minion', owner: '0' },
                ],
            },
            bases: [{
                defId: 'base_converted_cave',
                minions: [{ uid: 'target', defId: 'superheroes_mild_mannered_citizen', owner: '0', controller: '0', basePower: 2 }],
            }],
        });

        await game.screenshot('superheroes-radioactive-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'radio', targetBaseIndex: 0, targetMinionUid: 'target' });
        await game.waitForInteraction('superheroes_radioactive_exposure_search', 10000);
        await game.screenshot('superheroes-radioactive-02-search', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'higher', '放射暴露选择更高力量随从');
        await game.waitForNoInteraction(10000);

        const state = await getLongzuEvidenceState(game);
        expect(state.players['0'].discard.map((card: any) => card.uid)).toContain('target');
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toContain('higher');
        await game.screenshot('superheroes-radioactive-03-resolved', testInfo);
    });

    test('超级英雄：水晶堡垒在这里打出随从后可把弃牌堆随从放到牌库底', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            player0: {
                hand: [{ uid: 'captain', defId: 'superheroes_captain_amazing', type: 'minion', owner: '0' }],
                discard: [{ uid: 'fan-discard', defId: 'geeks_fan', type: 'minion', owner: '0' }],
                deck: [{ uid: 'deck-1', defId: 'dragons_hatchling', type: 'minion', owner: '0' }],
            },
            bases: [{ defId: 'base_crystal_fortress', minions: [] }],
        });

        await game.screenshot('superheroes-crystal-fortress-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'captain', baseIndex: 0 });
        await game.waitForInteraction('base_crystal_fortress', 10000);
        await game.screenshot('superheroes-crystal-fortress-02-prompt', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'fan-discard', '水晶堡垒选择弃牌堆随从');
        await game.waitForNoInteraction(10000);

        const state = await getLongzuEvidenceState(game);
        expect(state.players['0'].discard.map((card: any) => card.uid)).not.toContain('fan-discard');
        expect(state.players['0'].deck.at(-1)?.uid).toBe('fan-discard');
        await game.screenshot('superheroes-crystal-fortress-03-resolved', testInfo);
    });

    test('极客：维尔的力量通过 reaction 入口反制对手行动并阻止其结算', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            currentPlayer: '1',
            player0: {
                factions: ['geeks', 'dragons'],
                hand: [{ uid: 'force', defId: 'geeks_force_of_wil', type: 'action', owner: '0' }],
            },
            player1: {
                factions: ['superheroes', 'aliens'],
                hand: [{ uid: 'justice', defId: 'superheroes_justice_friends', type: 'action', owner: '1' }],
            },
            bases: [{
                defId: 'base_tabletop',
                minions: [
                    { uid: 'ally-heavy', defId: 'superheroes_captain_amazing', owner: '1', controller: '1', basePower: 5 },
                    { uid: 'enemy-small', defId: 'geeks_fan', owner: '0', controller: '0', basePower: 2 },
                ],
            }],
        });

        await game.screenshot('geeks-force-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'justice' }, '1');
        await game.waitForInteraction('smashup_action_counter_choose', 20000);
        await game.screenshot('geeks-force-02-counter', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'force', '维尔的力量选择自身反制');
        await game.waitForNoInteraction(10000);

        const state = await getLongzuEvidenceState(game);
        expect(state.players['1'].discard.map((card: any) => card.uid)).toContain('justice');
        expect(state.players['0'].discard.map((card: any) => card.uid)).toContain('force');
        expect(state.bases[0].minions.find((minion: any) => minion.uid === 'ally-heavy')?.tempPowerModifier ?? 0).toBe(0);
        expect(state.eventTypes).toContain('su:action_countered');
        await game.screenshot('geeks-force-03-countered', testInfo);
    });

    test('极客：维尔通过 reaction 入口打到基地并反制对手行动', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            currentPlayer: '1',
            player0: {
                factions: ['geeks', 'dragons'],
                hand: [{ uid: 'wil', defId: 'geeks_wil_wheaton', type: 'minion', owner: '0' }],
            },
            player1: {
                factions: ['superheroes', 'aliens'],
                hand: [{ uid: 'justice', defId: 'superheroes_justice_friends', type: 'action', owner: '1' }],
            },
            bases: [
                { defId: 'base_tabletop', minions: [] },
                { defId: 'base_dragons_lair', minions: [] },
            ],
        });

        await game.screenshot('geeks-wil-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'justice' }, '1');
        await game.waitForInteraction('smashup_action_counter_choose', 20000);
        await game.screenshot('geeks-wil-02-counter', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'wil', '维尔选择自身反制');
        await game.waitForInteraction('smashup_action_counter_wil_base', 10000);
        await game.screenshot('geeks-wil-03-base-choice', testInfo);
        await chooseOption(page, option => option.value?.baseIndex === 1, '维尔选择龙穴');
        await game.waitForNoInteraction(10000);

        const state = await getLongzuEvidenceState(game);
        expect(state.bases[1].minions.map((minion: any) => minion.uid)).toContain('wil');
        expect(state.players['1'].discard.map((card: any) => card.uid)).toContain('justice');
        expect(state.eventTypes).toContain('su:action_countered');
        await game.screenshot('geeks-wil-04-resolved', testInfo);
    });

    test('极客：控制仆从通过 triggered special 入口夺取新打出随从直到回合结束', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            currentPlayer: '1',
            player0: {
                factions: ['geeks', 'dragons'],
                hand: [{ uid: 'control', defId: 'geeks_control_minion', type: 'action', owner: '0' }],
            },
            player1: {
                factions: ['superheroes', 'aliens'],
                hand: [{ uid: 'play-captain', defId: 'superheroes_captain_amazing', type: 'minion', owner: '1' }],
            },
            bases: [{ defId: 'base_tabletop', minions: [] }],
        });

        await game.screenshot('geeks-control-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'play-captain', baseIndex: 0 }, '1');
        await game.waitForInteraction('smashup_reaction_choose', 20000);
        await game.screenshot('geeks-control-02-reaction', testInfo);
        await chooseReactionTrigger(page, option => /控制仆从|Control Minion|control_minion/i.test(String(option.label ?? '')));
        await game.waitForInteraction('geeks_control_minion_triggered', 10000);
        await game.screenshot('geeks-control-03-confirm', testInfo);
        await chooseOption(page, option => option.id === 'play' || option.value?.play === true, '控制仆从确认打出');
        await game.waitForNoInteraction(10000);

        let state = await getLongzuEvidenceState(game);
        expect(state.bases[0].minions.find((minion: any) => minion.uid === 'play-captain')?.controller).toBe('0');
        await game.screenshot('geeks-control-04-stolen', testInfo);

        await game.advancePhase();
        await game.advancePhase();
        await game.advancePhase();
        await expect.poll(async () => {
            const next = await getLongzuEvidenceState(game);
            return next.bases[0].minions.find((minion: any) => minion.uid === 'play-captain')?.controller ?? null;
        }, { timeout: 10000 }).toBe('1');

        state = await getLongzuEvidenceState(game);
        expect(state.interactionSourceId).toBeNull();
        await game.screenshot('geeks-control-05-restored', testInfo);
    });

    test('极客：无限循环重放禁卡表时先完成被重放行动交互，再出现回手提示', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            player0: {
                factions: ['geeks', 'dragons'],
                hand: [
                    { uid: 'loop', defId: 'geeks_non_infinite_loop', type: 'action', owner: '0' },
                    { uid: 'banned', defId: 'geeks_banned_list', type: 'action', owner: '0' },
                ],
            },
            player1: {
                hand: [
                    { uid: 'enemy-fan', defId: 'geeks_fan', type: 'minion', owner: '1' },
                    { uid: 'enemy-guru', defId: 'geeks_game_guru', type: 'minion', owner: '1' },
                ],
            },
        });

        await game.screenshot('geeks-loop-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'loop' });
        await game.waitForInteraction('geeks_non_infinite_loop_action', 10000);
        await game.screenshot('geeks-loop-02-action-choice', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'banned', '无限循环选择禁卡表');

        await game.waitForInteraction('geeks_banned_list', 10000);
        await game.screenshot('geeks-loop-03-banned-list-first', testInfo);
        await chooseOption(page, option => option.value?.defId === 'geeks_fan', '禁卡表点名粉丝');

        await game.waitForInteraction('geeks_non_infinite_loop_return', 10000);
        await game.screenshot('geeks-loop-04-return-prompt', testInfo);
        await chooseOption(page, option => option.id === 'return' || option.value?.returnToHand === true, '无限循环选择回手');
        await game.waitForNoInteraction(10000);

        const state = await getLongzuEvidenceState(game);
        expect(state.players['1'].deck.at(-1)?.uid).toBe('enemy-fan');
        expect(state.players['0'].hand.map((card: any) => card.uid)).toContain('banned');
        await game.screenshot('geeks-loop-05-returned', testInfo);
    });

    test('极客：规则咬定者从真实手牌行动把基地持续行动移到另一基地', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            player0: {
                hand: [{ uid: 'lawyer', defId: 'geeks_rules_lawyer', type: 'action', owner: '0' }],
            },
            bases: [
                { defId: 'base_tabletop', ongoingActions: [{ uid: 'lands', defId: 'dragons_dragon_lands', ownerId: '0' }], minions: [] },
                { defId: 'base_dragons_lair', minions: [] },
            ],
        });

        await game.screenshot('geeks-lawyer-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'lawyer' });
        await game.waitForInteraction('geeks_rules_lawyer_action', 10000);
        await game.screenshot('geeks-lawyer-02-action-choice', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'lands', '规则咬定者选择龙之领地');
        await game.waitForInteraction('geeks_rules_lawyer_target_base', 10000);
        await game.screenshot('geeks-lawyer-03-base-choice', testInfo);
        await chooseOption(page, option => option.value?.baseIndex === 1, '规则咬定者选择龙穴');
        await game.waitForNoInteraction(10000);

        const state = await getLongzuEvidenceState(game);
        expect(state.bases[0].ongoingActions.map((action: any) => action.uid)).not.toContain('lands');
        expect(state.bases[1].ongoingActions.map((action: any) => action.uid)).toContain('lands');
        await game.screenshot('geeks-lawyer-04-moved', testInfo);
    });

    test('极客：妙力一击从真实手牌行动查看顶五并选择全部拿进手牌', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            player0: {
                hand: [
                    { uid: 'mulligan', defId: 'geeks_mulligan', type: 'action', owner: '0' },
                    { uid: 'hand-keep', defId: 'dragons_hatchling', type: 'minion', owner: '0' },
                ],
                deck: [
                    { uid: 'top-1', defId: 'geeks_fan', type: 'minion', owner: '0' },
                    { uid: 'top-2', defId: 'superheroes_sidekick', type: 'action', owner: '0' },
                    { uid: 'top-3', defId: 'dragons_ruins', type: 'action', owner: '0' },
                    { uid: 'top-4', defId: 'superheroes_captain_amazing', type: 'minion', owner: '0' },
                    { uid: 'top-5', defId: 'geeks_game_guru', type: 'minion', owner: '0' },
                ],
            },
        });

        await game.screenshot('geeks-mulligan-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'mulligan' });
        await game.waitForInteraction('geeks_mulligan', 10000);
        await game.screenshot('geeks-mulligan-02-choice', testInfo);
        await chooseOption(page, option => option.id === 'draw' || option.value?.action === 'draw', '妙力一击选择全部拿到手牌');
        await game.waitForNoInteraction(10000);

        const state = await getLongzuEvidenceState(game);
        expect(state.players['0'].hand.map((card: any) => card.uid)).toEqual(expect.arrayContaining(['top-1', 'top-2', 'top-3', 'top-4', 'top-5']));
        expect(state.players['0'].deck.map((card: any) => card.uid)).toContain('hand-keep');
        await game.screenshot('geeks-mulligan-03-resolved', testInfo);
    });

    test('极客：桌游桌在计分后先摸三再强制弃二', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await openLongzuScene(game, {
            player0: {
                hand: [{ uid: 'hand-a', defId: 'dragons_hatchling', type: 'minion', owner: '0' }],
                deck: [
                    { uid: 'draw-1', defId: 'geeks_game_guru', type: 'minion', owner: '0' },
                    { uid: 'draw-2', defId: 'superheroes_sidekick', type: 'action', owner: '0' },
                    { uid: 'draw-3', defId: 'dragons_ruins', type: 'action', owner: '0' },
                ],
            },
            player1: {
                hand: [],
            },
            bases: [{
                defId: 'base_tabletop',
                minions: [
                    { uid: 'ally-heavy', defId: 'dragons_great_wyrm', owner: '0', controller: '0', basePower: 20 },
                    { uid: 'enemy', defId: 'geeks_fan', owner: '1', controller: '1', basePower: 2 },
                ],
            }],
            extra: {
                core: {
                    baseDeck: ['base_dragons_lair'],
                },
            },
        });

        await game.screenshot('geeks-tabletop-01-ready', testInfo);
        await game.advancePhase();
        await game.waitForInteraction('base_tabletop', 20000);
        await game.screenshot('geeks-tabletop-02-discard-prompt', testInfo);
        await chooseMultipleOptions(page, [
            option => option.value?.cardUid === 'hand-a',
            option => option.value?.cardUid === 'draw-3',
        ]);
        await expect.poll(async () => {
            const next = await getLongzuEvidenceState(game);
            return {
                interactionSourceId: next.interactionSourceId,
                discarded: next.players['0']?.discard?.map((card: any) => card.uid) ?? [],
                hand: next.players['0']?.hand?.map((card: any) => card.uid) ?? [],
            };
        }, { timeout: 10000 }).toMatchObject({
            interactionSourceId: expect.not.stringMatching(/^base_tabletop$/),
            discarded: expect.arrayContaining(['hand-a', 'draw-3']),
            hand: expect.arrayContaining(['draw-1', 'draw-2']),
        });

        const state = await getLongzuEvidenceState(game);
        expect(state.players['0'].discard.map((card: any) => card.uid)).toEqual(expect.arrayContaining(['hand-a', 'draw-3']));
        expect(state.players['0'].hand.map((card: any) => card.uid)).toEqual(expect.arrayContaining(['draw-1', 'draw-2']));
        await game.screenshot('geeks-tabletop-03-resolved', testInfo);
    });
});
