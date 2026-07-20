import { test, expect } from '../framework';
import { clickHandCard } from './smashup-helpers';

type InteractionSnapshot = {
    sourceId: string;
    playerId: string;
    options: Array<{ id: string; label?: string; value?: Record<string, any> }>;
};

async function openBaokemengScene(game: any, scene: Record<string, any>): Promise<void> {
    await game.openTestGame('smashup', {
        p0: 'itty_critters,kaiju',
        p1: 'magical_girls,mega_troopers',
        skipFactionSelect: true,
    }, 30000);
    await game.setupScene({
        gameId: 'smashup',
        currentPlayer: '0',
        phase: 'playCards',
        player0: {
            hand: [],
            deck: [],
            discard: [],
            factions: ['itty_critters', 'kaiju'],
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
            factions: ['magical_girls', 'mega_troopers'],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            ...(scene.player1 ?? {}),
        },
        bases: scene.bases ?? [
            { defId: 'base_critter_combat_club', minions: [] },
            { defId: 'base_tokyo', minions: [] },
            { defId: 'base_q_point', minions: [] },
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
    matcher: (option: { id: string; label?: string; value?: Record<string, any> }) => boolean,
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

async function chooseReactionTrigger(page: any, matcher: (option: { label?: string; value?: Record<string, any> }) => boolean): Promise<void> {
    await chooseOption(page, (option) => (
        option.id !== 'skip'
        && option.id !== 'pass'
        && matcher(option)
    ), 'reaction trigger');
}

async function chooseMultipleOptions(
    page: any,
    matchers: Array<(option: { id: string; label?: string; value?: Record<string, any> }) => boolean>,
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

async function getBaokemengEvidenceState(game: any): Promise<Record<string, any>> {
    const state = await game.getState();
    return {
        phase: state?.sys?.phase,
        responseWindow: state?.sys?.responseWindow?.current ?? null,
        interactionSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
        triggerQueue: state?.core?.triggerQueue ?? [],
        reactionSession: state?.sys?.smashupReactionSession ?? null,
        eventTypes: (state?.sys?.eventStream?.entries ?? []).slice(-20).map((entry: any) => entry.event?.type),
        bases: state?.core?.bases?.map((base: any) => ({
            defId: base.defId,
            minions: (base.minions ?? []).map((minion: any) => ({
                uid: minion.uid,
                defId: minion.defId,
                controller: minion.controller,
                owner: minion.owner,
                powerCounters: minion.powerCounters,
                tempPowerModifier: minion.tempPowerModifier,
                talentUsed: minion.talentUsed,
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
        titans: (state?.core?.titans ?? []).map((titan: any) => ({
            uid: titan.uid,
            defId: titan.defId,
            ownerId: titan.ownerId,
            controllerId: titan.controllerId,
            location: titan.location,
        })),
    };
}

async function playHandCardByDoubleClick(page: any, handIndex = 0): Promise<void> {
    await clickHandCard(page, handIndex);
    await clickHandCard(page, handIndex);
    await page.waitForTimeout(500);
    const spotlightQueue = page.getByTestId('card-spotlight-queue');
    if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
        await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
        await expect(spotlightQueue).toBeHidden({ timeout: 5000 });
    }
}

test.describe('SmashUp baokemeng / Big in Japan L3-L4 真实入口', () => {
    test('Itty Critters: Critter Combat Club 主动基地能力从手牌额外打出并在回合结束回底', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'itty-small', defId: 'itty_critters_tadpour', type: 'minion', owner: '0' }],
            },
            bases: [
                { defId: 'base_critter_combat_club', minions: [] },
                { defId: 'base_tokyo', minions: [] },
                { defId: 'base_q_point', minions: [] },
            ],
        });

        await game.screenshot('itty-critter-combat-club-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:use_base_ability', { baseIndex: 0 });
        await game.waitForInteraction('base_critter_combat_club', 10000);
        await game.screenshot('itty-critter-combat-club-02-prompt', testInfo);

        await chooseOption(page, option => option.value?.cardUid === 'itty-small', 'Itty Critters 小随从');
        await game.waitForNoInteraction(10000);

        let state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toContain('itty-small');
        expect(state.players['0'].hand.map((card: any) => card.uid)).not.toContain('itty-small');
        await game.screenshot('itty-critter-combat-club-03-played', testInfo);

        await game.advancePhase();
        await expect.poll(async () => {
            const next = await getBaokemengEvidenceState(game);
            return {
                onBase: next.bases[0].minions.some((minion: any) => minion.uid === 'itty-small'),
                deckBottom: next.players['0'].deck.at(-1)?.uid,
            };
        }, { timeout: 10000 }).toEqual({
            onBase: false,
            deckBottom: 'itty-small',
        });

        state = await getBaokemengEvidenceState(game);
        expect(state.interactionSourceId).toBeNull();
        await game.screenshot('itty-critter-combat-club-04-returned-bottom', testInfo);
    });

    test('Itty Critters: I Select You! 从真实手牌行动经两段交互额外打出牌库随从并在回合结束回底', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'itty-select', defId: 'itty_critters_i_select_you', type: 'action', owner: '0' }],
                deck: [
                    { uid: 'itty-small-deck', defId: 'itty_critters_flooffairy', type: 'minion', owner: '0' },
                    { uid: 'itty-big-deck', defId: 'itty_critters_critter_coach', type: 'minion', owner: '0' },
                ],
            },
            bases: [
                { defId: 'base_itty_city', minions: [] },
                { defId: 'base_critter_combat_club', minions: [] },
            ],
        });

        await game.screenshot('itty-i-select-you-01-ready', testInfo);
        await game.playCard('itty_critters_i_select_you');
        await game.waitForInteraction('itty_critters_i_select_you', 10000);
        await game.screenshot('itty-i-select-you-02-minion-prompt', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'itty-small-deck', 'I Select You 牌库小随从');

        await game.waitForInteraction('itty_critters_i_select_you_base', 10000);
        await game.screenshot('itty-i-select-you-03-base-prompt', testInfo);
        await chooseOption(page, option => option.value?.baseIndex === 1, 'I Select You 目标基地');

        await game.waitForInteraction('itty_critters_flooffairy', 10000);
        await chooseOption(page, option => option.label === '跳过', 'Flooffairy 跳过');
        await game.waitForNoInteraction(10000);

        let state = await getBaokemengEvidenceState(game);
        expect(state.bases[1].minions.map((minion: any) => minion.uid)).toContain('itty-small-deck');
        expect(state.players['0'].deck.map((card: any) => card.uid)).not.toContain('itty-small-deck');
        await game.screenshot('itty-i-select-you-04-played', testInfo);

        await game.advancePhase();
        await expect.poll(async () => {
            const next = await getBaokemengEvidenceState(game);
            return {
                onBase: next.bases[1].minions.some((minion: any) => minion.uid === 'itty-small-deck'),
                deckBottom: next.players['0'].deck.at(-1)?.uid,
            };
        }, { timeout: 10000 }).toEqual({
            onBase: false,
            deckBottom: 'itty-small-deck',
        });

        state = await getBaokemengEvidenceState(game);
        expect(state.interactionSourceId).toBeNull();
        await game.screenshot('itty-i-select-you-05-returned-bottom', testInfo);
    });

    test('Itty Critters: Evolution 从真实手牌行动消灭己方随从并把 Rainboroc 打到原基地', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'itty-evolution', defId: 'itty_critters_evolution', type: 'action', owner: '0' }],
            },
            bases: [
                {
                    defId: 'base_itty_city',
                    minions: [{ uid: 'itty-source', defId: 'itty_critters_leafaroo', owner: '0', controller: '0', basePower: 2 }],
                },
                { defId: 'base_critter_combat_club', minions: [] },
            ],
            extra: {
                core: {
                    titans: [{
                        uid: 'rainboroc',
                        defId: 'itty_critters_rainboroc',
                        faction: 'itty_critters',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                    }],
                    enabledExpansions: ['titans'],
                },
            },
        });

        await game.screenshot('itty-evolution-01-ready', testInfo);
        await game.playCard('itty_critters_evolution', { targetBaseIndex: 0, targetMinionUid: 'itty-source' });
        await game.waitForInteraction('itty_critters_evolution', 10000);
        await game.screenshot('itty-evolution-02-choice-prompt', testInfo);
        await chooseOption(page, option => option.value?.titanUid === 'rainboroc', 'Evolution Rainboroc');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).not.toContain('itty-source');
        expect(state.players['0'].discard.map((card: any) => card.uid)).toContain('itty-source');
        expect(state.titans.find((titan: any) => titan.uid === 'rainboroc')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
        await game.screenshot('itty-evolution-03-rainboroc-played', testInfo);
    });

    test('Itty Critters: Super Effective! 从真实手牌行动选择并消灭附着行动牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'itty-super', defId: 'itty_critters_super_effective', type: 'action', owner: '0' }],
            },
            bases: [{
                defId: 'base_itty_city',
                minions: [{
                    uid: 'host',
                    defId: 'itty_critters_flooffairy',
                    owner: '1',
                    controller: '1',
                    basePower: 2,
                    attachedActions: [{ uid: 'attached', defId: 'trickster_hideout', ownerId: '1' }],
                }],
                ongoingActions: [{ uid: 'ongoing', defId: 'zombie_overrun', ownerId: '1' }],
            }],
        });

        await game.screenshot('itty-super-effective-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'itty-super' });
        await game.waitForInteraction('itty_critters_super_effective', 10000);
        await game.screenshot('itty-super-effective-02-prompt', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'attached', 'Super Effective 选择附着行动');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.players['1'].discard.map((card: any) => card.uid)).toContain('attached');
        expect(state.bases[0].ongoingActions.map((action: any) => action.uid)).toContain('ongoing');
        expect(state.bases[0].minions[0].uid).toBe('host');
        await game.screenshot('itty-super-effective-03-resolved', testInfo);
    });

    test('Itty Critters: Leafaroo 从真实打出入口选择弃牌堆卡洗回牌库', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'leaf', defId: 'itty_critters_leafaroo', type: 'minion', owner: '0' }],
                deck: [{ uid: 'deck-1', defId: 'itty_critters_flooffairy', type: 'minion', owner: '0' }],
                discard: [{ uid: 'discard-1', defId: 'itty_critters_calicoin', type: 'minion', owner: '0' }],
            },
            bases: [{ defId: 'base_critter_combat_club', minions: [] }],
        });

        await game.screenshot('itty-leafaroo-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'leaf', baseIndex: 0 });
        await game.waitForInteraction('itty_critters_leafaroo', 10000);
        await game.screenshot('itty-leafaroo-02-prompt', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'discard-1', 'Leafaroo 选择弃牌');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.players['0'].discard.map((card: any) => card.uid)).not.toContain('discard-1');
        expect(state.players['0'].deck.map((card: any) => card.uid)).toContain('discard-1');
        await game.screenshot('itty-leafaroo-03-resolved', testInfo);
    });

    test('Itty Critters: Calicoin 在有合法目标时可以从真实打出入口选择跳过', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'calicoin', defId: 'itty_critters_calicoin', type: 'minion', owner: '0' }],
            },
            bases: [{
                defId: 'base_itty_city',
                minions: [{ uid: 'other', defId: 'itty_critters_flooffairy', owner: '0', controller: '0', basePower: 2 }],
            }],
        });

        await game.screenshot('itty-calicoin-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'calicoin', baseIndex: 0 });
        await game.waitForInteraction('itty_critters_calicoin', 10000);
        await game.screenshot('itty-calicoin-02-prompt', testInfo);
        await chooseOption(page, option => option.label === '跳过', 'Calicoin 跳过');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        const other = state.bases[0].minions.find((minion: any) => minion.uid === 'other');
        expect(other?.tempPowerModifier ?? 0).toBe(0);
        await game.screenshot('itty-calicoin-03-skipped', testInfo);
    });

    test('Itty Critters: Tadpour 从真实打出入口经两段交互移动另一个随从', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'tad', defId: 'itty_critters_tadpour', type: 'minion', owner: '0' }],
            },
            bases: [
                {
                    defId: 'base_itty_city',
                    minions: [{ uid: 'move-me', defId: 'itty_critters_flooffairy', owner: '0', controller: '0', basePower: 2 }],
                },
                { defId: 'base_critter_combat_club', minions: [] },
            ],
        });

        await game.screenshot('itty-tadpour-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'tad', baseIndex: 0 });
        await game.waitForInteraction('itty_critters_tadpour', 10000);
        await game.screenshot('itty-tadpour-02-minion-prompt', testInfo);
        await chooseOption(page, option => option.value?.minionUid === 'move-me', 'Tadpour 选择随从');

        await game.waitForInteraction('itty_critters_tadpour_dest', 10000);
        await game.screenshot('itty-tadpour-03-base-prompt', testInfo);
        await chooseOption(page, option => option.value?.baseIndex === 1, 'Tadpour 目标基地');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).not.toContain('move-me');
        expect(state.bases[1].minions.map((minion: any) => minion.uid)).toContain('move-me');
        await game.screenshot('itty-tadpour-04-moved', testInfo);
    });

    test('Itty Critters: Itty City 在这里首次打出随从后可通过真实基地 prompt 洗回一个弃牌堆随从', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'play-me', defId: 'itty_critters_flooffairy', type: 'minion', owner: '0' }],
                discard: [{ uid: 'discard-minion', defId: 'itty_critters_leafaroo', type: 'minion', owner: '0' }],
            },
            bases: [
                { defId: 'base_itty_city', minions: [] },
                { defId: 'base_tokyo', minions: [] },
                { defId: 'base_q_point', minions: [] },
            ],
        });

        await game.screenshot('itty-city-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'play-me', baseIndex: 0 });
        await game.waitForInteraction('itty_critters_flooffairy', 10000);
        await game.screenshot('itty-city-02-flooffairy-prompt', testInfo);
        await chooseOption(page, option => option.id === 'skip', 'Flooffairy 跳过抽牌');
        await game.waitForInteraction('smashup_reaction_choose', 10000);
        await game.screenshot('itty-city-03-reaction-queue', testInfo);
        await chooseReactionTrigger(page, () => true);
        await game.waitForInteraction('base_itty_city', 10000);
        await game.screenshot('itty-city-04-base-prompt', testInfo);
        await chooseOption(page, option => option.value?.choice === 'shuffle', 'Itty City 洗回一个弃牌堆随从');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toContain('play-me');
        expect(state.players['0'].discard.map((card: any) => card.uid)).not.toContain('discard-minion');
        expect(state.players['0'].deck.map((card: any) => card.uid)).toContain('discard-minion');
        await game.screenshot('itty-city-05-shuffled', testInfo);
    });

    test('Kaiju: Tokyo 在手牌行动打到本基地后给本基地临时总力量', async ({ game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'kaiju-stomp', defId: 'kaiju_stomp', type: 'action', owner: '0' }],
            },
            bases: [
                { defId: 'base_tokyo', minions: [{ uid: 'kaijookey', defId: 'kaiju_kaijookey', owner: '0', controller: '0', basePower: 4 }] },
                { defId: 'base_kaiju_island', minions: [] },
            ],
        });

        await game.screenshot('kaiju-tokyo-01-ready', testInfo);
        await game.playCard('kaiju_stomp', { targetBaseIndex: 0 });
        await game.screenshot('kaiju-tokyo-02-action-played', testInfo);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].ongoingActions.map((card: any) => card.uid)).toContain('kaiju-stomp');
        expect(state.tempBasePowerModifiers?.['0']?.['0']).toBe(3);
        expect(state.eventTypes).toContain('su:temp_base_power_modified');
    });

    test('Kaiju: Johnny 从真实打出入口回手基地行动并立刻仅在自己基地重打', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [
                    { uid: 'johnny-hand', defId: 'kaiju_johnny', type: 'minion', owner: '0' },
                    { uid: 'other-hand-action', defId: 'kaiju_kaiju_alliance', type: 'action', owner: '0' },
                ],
            },
            bases: [
                { defId: 'base_tokyo', minions: [], ongoingActions: [{ uid: 'stomp-field', defId: 'kaiju_stomp', ownerId: '0' }] },
                { defId: 'base_kaiju_island', minions: [] },
            ],
        });

        await game.screenshot('kaiju-johnny-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'johnny-hand', baseIndex: 1 });
        await game.waitForInteraction('kaiju_johnny', 10000);
        await game.screenshot('kaiju-johnny-02-return-prompt', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'stomp-field', 'Johnny 选择回手基地行动');

        await game.waitForInteraction('smashup_immediate_extra_action', 10000);
        await game.screenshot('kaiju-johnny-03-immediate-action', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'stomp-field', 'Johnny 立刻重打 Stomp');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].ongoingActions.map((action: any) => action.uid)).not.toContain('stomp-field');
        expect(state.bases[1].ongoingActions.map((action: any) => action.uid)).toContain('stomp-field');
        expect(state.interactionSourceId).toBeNull();
        await game.screenshot('kaiju-johnny-04-replayed', testInfo);
    });

    test('Kaiju: There Goes Tokyo 从真实手牌行动移动 Gorgodzolla 并替换原基地', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'tokyo-goes', defId: 'kaiju_there_goes_tokyo', type: 'action', owner: '0' }],
            },
            bases: [
                {
                    defId: 'base_tokyo',
                    minions: [{ uid: 'doomed', defId: 'itty_critters_leafaroo', owner: '0', controller: '0', basePower: 2 }],
                },
                { defId: 'base_itty_city', minions: [] },
            ],
            extra: {
                core: {
                    baseDeck: ['base_kaiju_island'],
                    titans: [{
                        uid: 'gorgodzolla',
                        defId: 'kaiju_gorgodzolla',
                        faction: 'kaiju',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    }],
                    enabledExpansions: ['titans'],
                },
            },
        });

        await game.screenshot('kaiju-there-goes-tokyo-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'tokyo-goes' });
        await game.waitForInteraction('kaiju_there_goes_tokyo_choose_base', 10000);
        await game.screenshot('kaiju-there-goes-tokyo-02-base-prompt', testInfo);
        await chooseOption(page, option => option.value?.baseIndex === 1, 'There Goes Tokyo 目标基地');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].defId).toBe('base_kaiju_island');
        expect(state.bases[1].defId).toBe('base_itty_city');
        expect(state.players['0'].discard.map((card: any) => card.uid)).toContain('doomed');
        expect(state.titans.find((titan: any) => titan.uid === 'gorgodzolla')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
        await game.screenshot('kaiju-there-goes-tokyo-03-replaced', testInfo);
    });

    test('Kaiju: Pick Up a Bus 从真实手牌行动在多目标中回收一张基地行动', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'bus', defId: 'kaiju_pick_up_a_bus', type: 'action', owner: '0' }],
                discard: [
                    { uid: 'recover-me', defId: 'kaiju_stomp', type: 'action', owner: '0' },
                    { uid: 'recover-other', defId: 'kaiju_oh_no', type: 'action', owner: '0' },
                ],
            },
        });

        await game.screenshot('kaiju-pick-up-a-bus-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'bus' });
        await game.waitForInteraction('kaiju_pick_up_a_bus', 10000);
        await game.screenshot('kaiju-pick-up-a-bus-02-prompt', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'recover-me', 'Pick Up a Bus 选择回收行动');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.players['0'].hand.map((card: any) => card.uid)).toContain('recover-me');
        expect(state.players['0'].discard.map((card: any) => card.uid)).toContain('recover-other');
        expect(state.players['0'].discard.map((card: any) => card.uid)).not.toContain('recover-me');
        await game.screenshot('kaiju-pick-up-a-bus-03-recovered', testInfo);
    });

    test('Kaiju: They Say He’s Got to Go 从真实手牌行动先选泰坦再选目标基地', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'go', defId: 'kaiju_they_say_hes_got_to_go', type: 'action', owner: '0' }],
            },
            bases: [
                { defId: 'base_tokyo', minions: [] },
                { defId: 'base_itty_city', minions: [] },
                { defId: 'base_q_point', minions: [] },
            ],
            extra: {
                core: {
                    titans: [
                        {
                            uid: 'gorgodzolla',
                            defId: 'kaiju_gorgodzolla',
                            faction: 'kaiju',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 0,
                            talentUsed: false,
                            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                        },
                        {
                            uid: 'rainboroc',
                            defId: 'itty_critters_rainboroc',
                            faction: 'itty_critters',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 0,
                            talentUsed: false,
                            location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                        },
                    ],
                    enabledExpansions: ['titans'],
                },
            },
        });

        await game.screenshot('kaiju-they-say-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'go', targetBaseIndex: 0 });
        await game.waitForInteraction('kaiju_they_say_hes_got_to_go_choose_titan', 10000);
        await game.screenshot('kaiju-they-say-02-titan-prompt', testInfo);
        await chooseOption(page, option => option.value?.titanUid === 'rainboroc', 'They Say He’s Got to Go 选择 Rainboroc');

        await game.waitForInteraction('kaiju_they_say_hes_got_to_go_choose_base', 10000);
        await game.screenshot('kaiju-they-say-03-base-prompt', testInfo);
        await chooseOption(page, option => option.value?.baseIndex === 2, 'They Say He’s Got to Go 目标基地');
        await game.waitForInteraction('titan_kaiju_gorgodzolla_draw', 10000);
        await game.screenshot('kaiju-they-say-04-gorgodzolla-followup', testInfo);
        await chooseOption(page, option => option.id === 'skip', '哥佐拉后续抽牌跳过');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.titans.find((titan: any) => titan.uid === 'rainboroc')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 2,
        });
        expect(state.titans.find((titan: any) => titan.uid === 'gorgodzolla')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
        await game.screenshot('kaiju-they-say-05-moved', testInfo);
    });

    test('Kaiju: Radioactive Breath 从真实手牌行动多选消灭多个敌方低力量随从', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'breath', defId: 'kaiju_radioactive_breath', type: 'action', owner: '0' }],
            },
            bases: [{
                defId: 'base_tokyo',
                minions: [
                    { uid: 'enemy-low-1', defId: 'itty_critters_leafaroo', owner: '1', controller: '1', basePower: 2 },
                    { uid: 'enemy-low-2', defId: 'itty_critters_flooffairy', owner: '1', controller: '1', basePower: 2 },
                    { uid: 'enemy-high', defId: 'kaiju_kaijookey', owner: '1', controller: '1', basePower: 4 },
                    { uid: 'own-low', defId: 'itty_critters_tadpour', owner: '0', controller: '0', basePower: 2 },
                ],
            }],
        });

        await game.screenshot('kaiju-radioactive-breath-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'breath', targetBaseIndex: 0 });
        await game.waitForInteraction('kaiju_radioactive_breath', 10000);
        await game.screenshot('kaiju-radioactive-breath-02-prompt', testInfo);
        await chooseMultipleOptions(page, [
            option => option.value?.minionUid === 'enemy-low-1',
            option => option.value?.minionUid === 'enemy-low-2',
        ]);
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toEqual(['enemy-high', 'own-low']);
        await game.screenshot('kaiju-radioactive-breath-03-resolved', testInfo);
    });

    test('Kaiju: Tail Smash 从真实手牌行动在多个候选中选择一个消灭', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'tail-smash', defId: 'kaiju_tail_smash', type: 'action', owner: '0' }],
            },
            bases: [{
                defId: 'base_tokyo',
                minions: [
                    { uid: 'enemy-target', defId: 'mega_troopers_beta_6', owner: '1', controller: '1', basePower: 2 },
                    { uid: 'enemy-target-2', defId: 'itty_critters_flooffairy', owner: '1', controller: '1', basePower: 2 },
                    { uid: 'enemy-high', defId: 'kaiju_kaijookey', owner: '1', controller: '1', basePower: 4 },
                ],
            }],
        });

        await game.screenshot('kaiju-tail-smash-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'tail-smash', targetBaseIndex: 0 });
        await game.waitForInteraction('kaiju_tail_smash', 10000);
        await game.screenshot('kaiju-tail-smash-02-prompt', testInfo);
        await chooseOption(page, option => option.value?.minionUid === 'enemy-target', 'Tail Smash 选择目标');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toEqual(['enemy-target-2', 'enemy-high']);
        await game.screenshot('kaiju-tail-smash-03-resolved', testInfo);
    });

    test('Magical Girls: Lunar Healing Love Spell 从真实手牌行动按玩家分组多选弃牌堆随从回手', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'love-spell', defId: 'magical_girls_lunar_healing_love_spell', type: 'action', owner: '0' }],
                discard: [
                    { uid: 'p0-minion-discard', defId: 'magical_girls_power_maid', type: 'minion', owner: '0' },
                    { uid: 'p0-action-discard', defId: 'kaiju_stomp', type: 'action', owner: '0' },
                ],
            },
            player1: {
                discard: [
                    { uid: 'p1-minion-discard', defId: 'mega_troopers_beta_6', type: 'minion', owner: '1' },
                ],
            },
        });

        await game.screenshot('magical-love-spell-01-ready', testInfo);
        await game.playCard('magical_girls_lunar_healing_love_spell');
        await game.waitForInteraction('magical_girls_lunar_healing_love_spell', 10000);
        await game.screenshot('magical-love-spell-02-multi-prompt', testInfo);
        await chooseMultipleOptions(page, [
            option => option.value?.cardUid === 'p0-minion-discard',
            option => option.value?.cardUid === 'p1-minion-discard',
        ]);
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.players['0'].hand.map((card: any) => card.uid)).toContain('p0-minion-discard');
        expect(state.players['1'].hand.map((card: any) => card.uid)).toContain('p1-minion-discard');
        expect(state.players['0'].discard.map((card: any) => card.uid)).not.toContain('p0-minion-discard');
        expect(state.players['1'].discard.map((card: any) => card.uid)).not.toContain('p1-minion-discard');
        expect(state.players['0'].discard.map((card: any) => card.uid)).toContain('p0-action-discard');
        await game.screenshot('magical-love-spell-03-recovered', testInfo);
    });

    test('Magical Girls: Coronet Attack 从真实手牌行动在多个合法敌方目标中选择并消灭一个', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'coronet', defId: 'magical_girls_coronet_attack', type: 'action', owner: '0' }],
            },
            bases: [{
                defId: 'base_akihabara_high',
                minions: [
                    { uid: 'ally-1', defId: 'magical_girls_power_maid', owner: '0', controller: '0', basePower: 3 },
                    { uid: 'ally-2', defId: 'magical_girls_white_magicat', owner: '0', controller: '0', basePower: 1 },
                    { uid: 'enemy-a', defId: 'itty_critters_flooffairy', owner: '1', controller: '1', basePower: 2 },
                    { uid: 'enemy-b', defId: 'itty_critters_tadpour', owner: '1', controller: '1', basePower: 2 },
                    { uid: 'enemy-high', defId: 'kaiju_kaijookey', owner: '1', controller: '1', basePower: 4 },
                ],
            }],
        });

        await game.screenshot('magical-coronet-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'coronet', targetBaseIndex: 0, targetMinionUid: 'enemy-b' });
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toEqual(['ally-1', 'ally-2', 'enemy-a', 'enemy-high']);
        expect(state.players['1'].discard.map((card: any) => card.uid)).toContain('enemy-b');
        await game.screenshot('magical-coronet-02-destroyed', testInfo);
    });

    test('Magical Girls: Kiss the Sky Spell 从真实手牌行动在多张弃牌堆随从中选择一张回手并获得额外行动', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'kiss', defId: 'magical_girls_kiss_the_sky_spell', type: 'action', owner: '0' }],
                discard: [
                    { uid: 'maid', defId: 'magical_girls_power_maid', type: 'minion', owner: '0' },
                    { uid: 'captain', defId: 'magical_girls_lunar_captain', type: 'minion', owner: '0' },
                ],
            },
        });

        await game.screenshot('magical-kiss-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'kiss' });
        await game.waitForInteraction('magical_girls_kiss_the_sky_spell', 10000);
        await game.screenshot('magical-kiss-02-prompt', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'maid', 'Kiss the Sky Spell 选择 Power Maid');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.players['0'].hand.map((card: any) => card.uid)).toContain('maid');
        expect(state.players['0'].discard.map((card: any) => card.uid)).toContain('captain');
        expect(state.players['0'].discard.map((card: any) => card.uid)).not.toContain('maid');
        expect(state.players['0'].actionLimit).toBe(2);
        await game.screenshot('magical-kiss-03-recovered', testInfo);
    });

    test('Magical Girls: Purge the Demon 从真实手牌行动选择移除一张卡上的全部力量指示物', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'purge', defId: 'magical_girls_purge_the_demon', type: 'action', owner: '0' }],
            },
            bases: [{
                defId: 'base_q_point',
                ongoingActions: [{ uid: 'enemy-action', defId: 'kaiju_stomp', ownerId: '1' }],
                minions: [{ uid: 'countered', defId: 'magical_girls_power_maid', owner: '0', controller: '0', basePower: 3, powerCounters: 2 }],
            }],
        });

        await game.screenshot('magical-purge-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'purge' });
        await game.waitForInteraction('magical_girls_purge_the_demon', 10000);
        await game.screenshot('magical-purge-02-prompt', testInfo);
        await chooseOption(page, option => option.value?.minionUid === 'countered', 'Purge the Demon 选择 countered');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.find((minion: any) => minion.uid === 'countered')?.powerCounters).toBe(0);
        expect(state.bases[0].ongoingActions.map((action: any) => action.uid)).toContain('enemy-action');
        await game.screenshot('magical-purge-03-counters-cleared', testInfo);
    });

    test('Magical Girls: Celestial Teleport 从真实手牌行动移动己方随从到另一基地', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'teleport', defId: 'magical_girls_celestial_teleport', type: 'action', owner: '0' }],
            },
            bases: [
                {
                    defId: 'base_akihabara_high',
                    minions: [{ uid: 'maid', defId: 'magical_girls_power_maid', owner: '0', controller: '0', basePower: 3 }],
                },
                { defId: 'base_q_point', minions: [] },
            ],
        });

        await game.screenshot('magical-teleport-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'teleport', targetBaseIndex: 0, targetMinionUid: 'maid' });
        await game.waitForInteraction('magical_girls_celestial_teleport_destination', 10000);
        await game.screenshot('magical-teleport-02-destination-prompt', testInfo);
        await chooseOption(page, option => option.value?.baseIndex === 1, 'Celestial Teleport 目标基地');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).not.toContain('maid');
        expect(state.bases[1].minions.map((minion: any) => minion.uid)).toContain('maid');
        await game.screenshot('magical-teleport-03-moved', testInfo);
    });

    test('Magical Girls: Coordination 从真实手牌行动选择直接打出 Walking Castle', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'coordination', defId: 'magical_girls_coordination', type: 'action', owner: '0' }],
            },
            bases: [{
                defId: 'base_akihabara_high',
                minions: [{ uid: 'maid', defId: 'magical_girls_power_maid', owner: '0', controller: '0', basePower: 3 }],
            }],
            extra: {
                core: {
                    titans: [{
                        uid: 'walking-castle',
                        defId: 'magical_girls_walking_castle',
                        faction: 'magical_girls',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                    }],
                    enabledExpansions: ['titans'],
                },
            },
        });

        await game.screenshot('magical-coordination-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'coordination' });
        await game.waitForInteraction('magical_girls_coordination', 10000);
        await game.screenshot('magical-coordination-02-choice', testInfo);
        await chooseOption(page, option => option.value?.choice === 'walking_castle', 'Coordination 选择 Walking Castle');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.titans.find((titan: any) => titan.uid === 'walking-castle')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
        await game.screenshot('magical-coordination-03-played-titan', testInfo);
    });

    test('Magical Girls: White Magicat 从真实打出入口在牌库与弃牌堆的同名目标之间选择一张加入手牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'white', defId: 'magical_girls_white_magicat', type: 'minion', owner: '0' }],
                deck: [{ uid: 'maid-deck', defId: 'magical_girls_power_maid', type: 'minion', owner: '0' }],
                discard: [{ uid: 'maid-discard', defId: 'magical_girls_power_maid', type: 'minion', owner: '0' }],
            },
            bases: [{ defId: 'base_akihabara_high', minions: [] }],
        });

        await game.screenshot('magical-white-magicat-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_minion', { cardUid: 'white', baseIndex: 0 });
        await game.waitForInteraction('magical_girls_white_magicat', 10000);
        await game.screenshot('magical-white-magicat-02-prompt', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'maid-discard', 'White Magicat 选择弃牌堆中的 Power Maid');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.players['0'].hand.map((card: any) => card.uid)).toContain('maid-discard');
        expect(state.players['0'].discard.map((card: any) => card.uid)).not.toContain('maid-discard');
        expect(state.players['0'].deck.map((card: any) => card.uid)).toContain('maid-deck');
        await game.screenshot('magical-white-magicat-03-recovered', testInfo);
    });

    test('Magical Girls: Power Maid 从真实天赋入口把另一个低力量随从移入自己的基地', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            bases: [
                {
                    defId: 'base_akihabara_high',
                    minions: [
                        { uid: 'maid', defId: 'magical_girls_power_maid', owner: '0', controller: '0', basePower: 3 },
                        { uid: 'ally', defId: 'magical_girls_white_magicat', owner: '0', controller: '0', basePower: 1 },
                    ],
                },
                {
                    defId: 'base_q_point',
                    minions: [{ uid: 'target', defId: 'itty_critters_flooffairy', owner: '1', controller: '1', basePower: 2 }],
                },
            ],
        });

        await game.screenshot('magical-power-maid-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:use_talent', { minionUid: 'maid', baseIndex: 0 });
        await game.waitForInteraction('magical_girls_power_maid', 10000);
        await game.screenshot('magical-power-maid-02-prompt', testInfo);
        await chooseOption(page, option => option.value?.minionUid === 'target', 'Power Maid 选择 target');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toContain('target');
        expect(state.bases[1].minions.map((minion: any) => minion.uid)).not.toContain('target');
        await game.screenshot('magical-power-maid-03-moved', testInfo);
    });

    test('Magical Girls: Q Point 计分前经 reaction session 逐玩家保留一张并摧毁其余牌', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await openBaokemengScene(game, {
            player0: { factions: ['magical_girls', 'itty_critters'] },
            player1: { factions: ['mega_troopers', 'kaiju'] },
            bases: [
                {
                    defId: 'base_q_point',
                    minions: [
                        { uid: 'p0-keep', defId: 'magical_girls_power_maid', owner: '0', controller: '0', basePower: 4 },
                        { uid: 'p0-destroy', defId: 'itty_critters_leafaroo', owner: '0', controller: '0', basePower: 8 },
                        { uid: 'p1-keep', defId: 'mega_troopers_beta_6', owner: '1', controller: '1', basePower: 2 },
                        { uid: 'p1-destroy', defId: 'kaiju_kaijookey', owner: '1', controller: '1', basePower: 10 },
                    ],
                    ongoingActions: [{ uid: 'p0-action-destroy', defId: 'kaiju_stomp', ownerId: '0' }],
                },
            ],
            extra: {
                core: {
                    baseDeck: ['base_tokyo'],
                },
            },
        });

        await game.screenshot('magical-q-point-01-ready', testInfo);
        await game.advancePhase();
        await game.waitForInteraction('base_q_point', 10000);
        await game.screenshot('magical-q-point-02-p0-keep-prompt', testInfo);
        await chooseOption(page, option => option.value?.uid === 'p0-keep', 'P0 保留 Power Maid');

        await game.waitForInteraction('base_q_point', 10000);
        await game.screenshot('magical-q-point-03-p1-keep-prompt', testInfo);
        await chooseOption(page, option => option.value?.uid === 'p1-keep', 'P1 保留 Beta 6');

        await expect.poll(async () => {
            const current = await getBaokemengEvidenceState(game);
            return {
                minions: current.bases[0]?.minions.map((minion: any) => minion.uid) ?? [],
                discardedP0: current.players['0'].discard.map((card: any) => card.uid),
                discardedP1: current.players['1'].discard.map((card: any) => card.uid),
            };
        }, { timeout: 15000 }).toEqual({
            minions: ['p0-keep', 'p1-keep'],
            discardedP0: expect.arrayContaining(['p0-destroy', 'p0-action-destroy']),
            discardedP1: expect.arrayContaining(['p1-destroy']),
        });

        const state = await getBaokemengEvidenceState(game);
        expect(state.triggerQueue).toEqual([]);
        expect(state.reactionSession).toBeNull();
        await game.screenshot('magical-q-point-04-kept-and-destroyed', testInfo);
    });

    test('Mega Troopers: Plan For More! 从真实手牌行动展示顶三、额外打出并排序回顶', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'plan', defId: 'mega_troopers_plan_for_more', type: 'action', owner: '0' }],
                deck: [
                    { uid: 'plan-beta', defId: 'mega_troopers_beta_6', type: 'minion', owner: '0' },
                    { uid: 'plan-red', defId: 'mega_troopers_red_trooper', type: 'minion', owner: '0' },
                    { uid: 'plan-action', defId: 'mega_troopers_lightning_crystal', type: 'action', owner: '0' },
                    { uid: 'plan-later', defId: 'mega_troopers_blue_trooper', type: 'minion', owner: '0' },
                ],
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_juice_bar', minions: [] },
                { defId: 'base_moon_dumpster', minions: [] },
            ],
        });

        await game.screenshot('mega-plan-for-more-01-ready', testInfo);
        await game.playCard('mega_troopers_plan_for_more');
        await game.waitForInteraction('mega_troopers_plan_for_more', 10000);
        await game.screenshot('mega-plan-for-more-02-prompt', testInfo);

        await chooseMultipleOptions(page, [
            option => option.value?.mode === 'take_and_play' && option.value?.cardUid === 'plan-beta' && option.value?.baseIndex === 0,
        ]);
        await game.waitForInteraction('mega_troopers_plan_for_more_order', 10000);
        await game.screenshot('mega-plan-for-more-03-order-prompt', testInfo);

        await chooseOption(page, option => option.value?.cardUid === 'plan-action', 'Plan For More! 行动牌先放回');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toContain('plan-beta');
        expect(state.players['0'].hand.map((card: any) => card.uid)).not.toContain('plan-red');
        expect(state.players['0'].deck.map((card: any) => card.uid)).toEqual(['plan-action', 'plan-red', 'plan-later']);
        expect(state.eventTypes).toContain('su:reveal_deck_top');
        expect(state.eventTypes).toContain('su:deck_reordered');
        await game.screenshot('mega-plan-for-more-04-resolved', testInfo);
    });

    test('Mega Troopers: Lightning Crystal 从真实手牌行动在多个行动牌目标中选择并摧毁一个附着行动', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'crystal', defId: 'mega_troopers_lightning_crystal', type: 'action', owner: '0' }],
            },
            bases: [({
                defId: 'base_juice_bar',
                ongoingActions: [{ uid: 'base-action', defId: 'kaiju_stomp', ownerId: '1' }],
                minions: [{
                    uid: 'host',
                    defId: 'mega_troopers_beta_6',
                    owner: '1',
                    controller: '1',
                    basePower: 2,
                    attachedActions: [{ uid: 'attached-action', defId: 'magical_girls_magical_staff', ownerId: '1' }],
                }],
            } as any)],
        });

        await game.screenshot('mega-lightning-crystal-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'crystal' });
        await game.waitForInteraction('mega_troopers_lightning_crystal', 10000);
        await game.screenshot('mega-lightning-crystal-02-prompt', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'attached-action', 'Lightning Crystal 选择 attached-action');
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.find((minion: any) => minion.uid === 'host')?.attachedActions).toEqual([]);
        expect(state.bases[0].ongoingActions.map((action: any) => action.uid)).toContain('base-action');
        expect(state.players['1'].discard.map((card: any) => card.uid)).toContain('attached-action');
        await game.screenshot('mega-lightning-crystal-03-destroyed', testInfo);
    });

    test('Mega Troopers: It’s Blitzin’ Time! 从真实手牌行动选择一个己方随从直到回合结束 +3 力量', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'blitz', defId: 'mega_troopers_its_blitzin_time', type: 'action', owner: '0' }],
            },
            bases: [{
                defId: 'base_juice_bar',
                minions: [
                    { uid: 'ally-a', defId: 'mega_troopers_beta_6', owner: '0', controller: '0', basePower: 2 },
                    { uid: 'ally-b', defId: 'mega_troopers_red_trooper', owner: '0', controller: '0', basePower: 5 },
                ],
            }],
        });

        await game.screenshot('mega-blitzin-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'blitz', targetBaseIndex: 0, targetMinionUid: 'ally-b' });
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.find((minion: any) => minion.uid === 'ally-b')?.tempPowerModifier).toBe(3);
        expect(state.bases[0].minions.find((minion: any) => minion.uid === 'ally-a')?.tempPowerModifier ?? 0).toBe(0);
        await game.screenshot('mega-blitzin-02-boosted', testInfo);
    });

    test('Mega Troopers: Mega Attack 从真实手牌行动在多个候选中选择并消灭一个低力量随从', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'attack', defId: 'mega_troopers_mega_attack', type: 'action', owner: '0' }],
            },
            bases: [{
                defId: 'base_juice_bar',
                minions: [
                    { uid: 'ally-a', defId: 'mega_troopers_red_trooper', owner: '0', controller: '0', basePower: 5 },
                    { uid: 'ally-b', defId: 'mega_troopers_beta_6', owner: '0', controller: '0', basePower: 2 },
                    { uid: 'enemy-a', defId: 'kaiju_kaijookey', owner: '1', controller: '1', basePower: 4 },
                    { uid: 'enemy-b', defId: 'itty_critters_flooffairy', owner: '1', controller: '1', basePower: 2 },
                    { uid: 'enemy-big', defId: 'mega_troopers_red_trooper', owner: '1', controller: '1', basePower: 8 },
                ],
            }],
        });

        await game.screenshot('mega-attack-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'attack', targetBaseIndex: 0, targetMinionUid: 'enemy-a' });
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).toEqual(['ally-a', 'ally-b', 'enemy-b', 'enemy-big']);
        expect(state.players['1'].discard.map((card: any) => card.uid)).toContain('enemy-a');
        await game.screenshot('mega-attack-02-destroyed', testInfo);
    });

    test('Mega Troopers: Form Megabot! 从真实手牌行动把 Megabot 打到合格基地', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await openBaokemengScene(game, {
            player0: {
                hand: [{ uid: 'form-megabot', defId: 'mega_troopers_form_megabot', type: 'action', owner: '0' }],
            },
            bases: [
                {
                    defId: 'base_juice_bar',
                    minions: [
                        { uid: 'p0-a', defId: 'mega_troopers_beta_6', owner: '0', controller: '0', basePower: 2 },
                        { uid: 'p0-b', defId: 'mega_troopers_red_trooper', owner: '0', controller: '0', basePower: 3 },
                    ],
                },
                {
                    defId: 'base_moon_dumpster',
                    minions: [
                        { uid: 'p0-c', defId: 'mega_troopers_blue_trooper', owner: '0', controller: '0', basePower: 3 },
                        { uid: 'p0-d', defId: 'mega_troopers_green_trooper', owner: '0', controller: '0', basePower: 4 },
                    ],
                },
            ],
            extra: {
                core: {
                    titans: [{
                        uid: 'megabot',
                        defId: 'mega_troopers_megabot',
                        faction: 'mega_troopers',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                    }],
                    enabledExpansions: ['titans'],
                },
            },
        });

        await game.screenshot('mega-form-megabot-01-ready', testInfo);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'form-megabot', targetBaseIndex: 1 });
        await game.waitForNoInteraction(10000);

        const state = await getBaokemengEvidenceState(game);
        expect(state.titans.find((titan: any) => titan.uid === 'megabot')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
        await game.screenshot('mega-form-megabot-02-played', testInfo);
    });

    test('Mega Troopers: Beta 6 计分前 special 通过 reaction 入口触发并记录限制组', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await openBaokemengScene(game, {
            player0: { factions: ['mega_troopers', 'magical_girls'] },
            player1: { factions: ['kaiju', 'itty_critters'] },
            bases: [
                {
                    defId: 'base_juice_bar',
                    minions: [
                        { uid: 'beta-special', defId: 'mega_troopers_beta_6', owner: '0', controller: '0', basePower: 2 },
                        { uid: 'ally-heavy', defId: 'mega_troopers_red_trooper', owner: '0', controller: '0', basePower: 12 },
                        { uid: 'enemy-heavy', defId: 'kaiju_kaijookey', owner: '1', controller: '1', basePower: 10 },
                    ],
                },
            ],
            extra: {
                core: {
                    baseDeck: ['base_critter_combat_club'],
                },
            },
        });

        await game.screenshot('mega-beta-special-01-ready', testInfo);
        await game.advancePhase();
        await game.waitForInteraction('smashup_reaction_choose', 20000);
        await game.screenshot('mega-beta-special-02-reaction-open', testInfo);
        const reactionState = await getBaokemengEvidenceState(game);
        expect(reactionState.interactionSourceId).toBe('smashup_reaction_choose');
        expect(reactionState.reactionSession ?? reactionState.responseWindow).toBeTruthy();

        await chooseReactionTrigger(page, option => /Beta 6|beta_6|贝塔/i.test(String(option.label ?? '')));
        await expect.poll(async () => {
            const state = await getBaokemengEvidenceState(game);
            return {
                betaTemp: state.bases[0].minions.find((minion: any) => minion.uid === 'beta-special')?.tempPowerModifier ?? 0,
                limitUsed: state.specialLimitUsed?.mega_troopers_before_scoring_power?.includes(0) ?? false,
            };
        }, { timeout: 10000 }).toEqual({
            betaTemp: 1,
            limitUsed: true,
        });

        const state = await getBaokemengEvidenceState(game);
        expect(state.eventTypes).toContain('su:special_limit_used');
        await game.screenshot('mega-beta-special-03-resolved', testInfo);
    });

    test('Mega Troopers: Lightning Rescue 计分前 special 经 reaction 入口选择手牌行动作为额外行动打出', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await openBaokemengScene(game, {
            player0: {
                factions: ['mega_troopers', 'kaiju'],
                hand: [
                    { uid: 'rescue', defId: 'mega_troopers_lightning_rescue', type: 'action', owner: '0' },
                    { uid: 'conflict', defId: 'kaiju_kaiju_conflict', type: 'action', owner: '0' },
                ],
            },
            player1: { factions: ['magical_girls', 'itty_critters'] },
            bases: [{
                defId: 'base_juice_bar',
                minions: [
                    { uid: 'ally-a', defId: 'mega_troopers_red_trooper', owner: '0', controller: '0', basePower: 10 },
                    { uid: 'enemy-a', defId: 'itty_critters_flooffairy', owner: '1', controller: '1', basePower: 10 },
                ],
            }],
            extra: {
                core: {
                    baseDeck: ['base_q_point'],
                },
            },
        });

        await game.screenshot('mega-lightning-rescue-01-ready', testInfo);
        await game.advancePhase();
        await game.waitForInteraction('smashup_reaction_choose', 20000);
        await game.screenshot('mega-lightning-rescue-02-reaction-open', testInfo);
        await chooseReactionTrigger(page, option => /闪电救援|Lightning Rescue|lightning_rescue/i.test(String(option.label ?? '')));
        await game.waitForInteraction('mega_troopers_lightning_rescue', 10000);
        await game.screenshot('mega-lightning-rescue-03-card-prompt', testInfo);
        await chooseOption(page, option => option.value?.cardUid === 'conflict', 'Lightning Rescue 选择 Kaiju Conflict');
        await game.waitForInteraction('smashup_immediate_extra_action', 10000);
        await game.screenshot('mega-lightning-rescue-04-immediate-extra-action', testInfo);

        const state = await getBaokemengEvidenceState(game);
        expect(state.players['0'].hand.map((card: any) => card.uid)).not.toContain('conflict');
        expect(state.interactionSourceId).toBe('smashup_immediate_extra_action');
        expect(state.eventTypes).toContain('su:special_limit_used');
        await game.screenshot('mega-lightning-rescue-05-resolved', testInfo);
    });

    test('Mega Troopers: Blitzing Sword Attack 计分前 special 经 reaction 入口消灭这里一个力量 4 或以下随从', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await openBaokemengScene(game, {
            player0: {
                factions: ['mega_troopers', 'magical_girls'],
                hand: [{ uid: 'sword', defId: 'mega_troopers_blitzing_sword_attack', type: 'action', owner: '0' }],
            },
            player1: { factions: ['kaiju', 'itty_critters'] },
            bases: [{
                defId: 'base_juice_bar',
                minions: [
                    { uid: 'ally', defId: 'mega_troopers_beta_6', owner: '0', controller: '0', basePower: 2 },
                    { uid: 'victim-a', defId: 'kaiju_kaijookey', owner: '1', controller: '1', basePower: 4 },
                    { uid: 'victim-b', defId: 'itty_critters_flooffairy', owner: '1', controller: '1', basePower: 2 },
                    { uid: 'enemy-leader', defId: 'mega_troopers_red_trooper', owner: '1', controller: '1', basePower: 14 },
                ],
            }],
            extra: {
                core: {
                    baseDeck: ['base_tokyo'],
                    titans: [{
                        uid: 'megabot',
                        defId: 'mega_troopers_megabot',
                        faction: 'mega_troopers',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    }],
                    enabledExpansions: ['titans'],
                },
            },
        });

        await game.screenshot('mega-blitzing-sword-01-ready', testInfo);
        await game.advancePhase();
        await game.waitForInteraction('smashup_reaction_choose', 20000);
        await game.screenshot('mega-blitzing-sword-02-reaction-open', testInfo);
        await chooseReactionTrigger(page, option => /一瞬千击|Blitzing Sword Attack|blitzing_sword_attack/i.test(String(option.label ?? '')));
        await game.waitForInteraction('mega_troopers_blitzing_sword_attack', 10000);
        await game.screenshot('mega-blitzing-sword-03-target-prompt', testInfo);
        await chooseOption(page, option => option.value?.minionUid === 'victim-a', 'Blitzing Sword Attack 选择 victim-a');
        let state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.map((minion: any) => minion.uid)).not.toContain('victim-a');
        expect(state.players['1'].discard.map((card: any) => card.uid)).toContain('victim-a');
        await game.screenshot('mega-blitzing-sword-04-destroyed-before-cleanup', testInfo);
    });

    test('Mega Troopers: Yellow Trooper 计分前 special 经 reaction 入口在多个己方候选中选择一个移到这里', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await openBaokemengScene(game, {
            player0: { factions: ['mega_troopers', 'magical_girls'] },
            player1: { factions: ['kaiju', 'itty_critters'] },
            bases: [
                {
                    defId: 'base_moon_dumpster',
                    minions: [{ uid: 'move-a', defId: 'mega_troopers_beta_6', owner: '0', controller: '0', basePower: 2 }],
                },
                {
                    defId: 'base_juice_bar',
                    minions: [
                        { uid: 'yellow', defId: 'mega_troopers_yellow_trooper', owner: '0', controller: '0', basePower: 4 },
                        { uid: 'enemy-big', defId: 'mega_troopers_red_trooper', owner: '1', controller: '1', basePower: 16 },
                    ],
                },
                {
                    defId: 'base_q_point',
                    minions: [{ uid: 'move-b', defId: 'magical_girls_white_magicat', owner: '0', controller: '0', basePower: 1 }],
                },
            ],
            extra: {
                core: {
                    baseDeck: ['base_tokyo'],
                },
            },
        });

        await game.screenshot('mega-yellow-01-ready', testInfo);
        await game.advancePhase();
        await game.waitForInteraction('smashup_reaction_choose', 20000);
        await game.screenshot('mega-yellow-02-reaction-open', testInfo);
        await chooseReactionTrigger(page, option => /黄骑士|Yellow Trooper|yellow_trooper/i.test(String(option.label ?? '')));
        await game.waitForInteraction('mega_troopers_yellow_trooper', 10000);
        await game.screenshot('mega-yellow-03-target-prompt', testInfo);
        await chooseOption(page, option => option.value?.minionUid === 'move-b', 'Yellow Trooper 选择 move-b');
        let state = await getBaokemengEvidenceState(game);
        expect(state.bases[1].minions.map((minion: any) => minion.uid)).toContain('move-b');
        expect(state.bases[2].minions.map((minion: any) => minion.uid)).not.toContain('move-b');
        await game.screenshot('mega-yellow-04-moved-before-scoring', testInfo);
    });

    test('Mega Troopers: Pink Trooper 计分后 special 经 reaction 入口选择一个小随从回手', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await openBaokemengScene(game, {
            player0: { factions: ['mega_troopers', 'magical_girls'] },
            player1: { factions: ['kaiju', 'itty_critters'] },
            bases: [{
                defId: 'base_juice_bar',
                minions: [
                    { uid: 'pink', defId: 'mega_troopers_pink_trooper', owner: '0', controller: '0', basePower: 3 },
                    { uid: 'beta', defId: 'mega_troopers_beta_6', owner: '0', controller: '0', basePower: 2 },
                    { uid: 'enemy-heavy', defId: 'mega_troopers_red_trooper', owner: '1', controller: '1', basePower: 15 },
                ],
            }],
            extra: {
                core: {
                    baseDeck: ['base_tokyo'],
                },
            },
        });

        await game.screenshot('mega-pink-01-ready', testInfo);
        await game.advancePhase();
        await game.waitForInteraction('smashup_reaction_choose', 20000);
        await game.screenshot('mega-pink-02-reaction-open', testInfo);
        await chooseOption(page, option => option.id === 'pass' || option.label === '让过', 'Pink Trooper 前置 beforeScoring 让过');
        await expect.poll(async () => {
            const interaction = await readInteraction(page);
            return (interaction?.options ?? []).map(option => String(option.label ?? '')).join('|');
        }, { timeout: 10000 }).toMatch(/粉骑士|Pink Trooper|pink_trooper/i);
        await game.screenshot('mega-pink-03-afterscoring-open', testInfo);
        await chooseReactionTrigger(page, option => /粉骑士|Pink Trooper|pink_trooper/i.test(String(option.label ?? '')));
        await game.waitForInteraction('mega_troopers_pink_trooper', 10000);
        await game.screenshot('mega-pink-04-target-prompt', testInfo);
        await chooseOption(page, option => option.value?.minionUid === 'beta', 'Pink Trooper 选择 beta');
        let state = await getBaokemengEvidenceState(game);
        expect(state.players['0'].hand.map((card: any) => card.uid)).toContain('beta');
        expect(state.players['0'].discard.map((card: any) => card.uid)).not.toContain('beta');
        expect(state.eventTypes).toContain('su:special_limit_used');
        await game.screenshot('mega-pink-05-returned-before-cleanup', testInfo);
    });

    test('Mega Troopers: Juice Bar 计分前基地能力按已用 special 次数为一个随从提供对应力量', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await openBaokemengScene(game, {
            player0: { factions: ['mega_troopers', 'magical_girls'] },
            player1: { factions: ['kaiju', 'itty_critters'] },
            bases: [{
                defId: 'base_juice_bar',
                minions: [
                    { uid: 'target', defId: 'mega_troopers_beta_6', owner: '0', controller: '0', basePower: 2 },
                    { uid: 'other', defId: 'mega_troopers_red_trooper', owner: '1', controller: '1', basePower: 18 },
                ],
            }],
            extra: {
                core: {
                    baseDeck: ['base_tokyo'],
                    specialLimitUsed: {
                        mega_troopers_before_scoring_power: [0],
                        mega_troopers_before_scoring_move: [0],
                    },
                },
            },
        });

        await game.screenshot('mega-juice-bar-01-ready', testInfo);
        await game.advancePhase();
        await game.waitForInteraction('base_juice_bar', 20000);
        await game.screenshot('mega-juice-bar-02-prompt', testInfo);
        await chooseOption(page, option => option.value?.minionUid === 'target', 'Juice Bar 选择 target');
        let state = await getBaokemengEvidenceState(game);
        expect(state.bases[0].minions.find((minion: any) => minion.uid === 'target')?.tempPowerModifier).toBe(4);
        await game.screenshot('mega-juice-bar-03-boosted-before-scoring', testInfo);
    });
});
