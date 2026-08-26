import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SU_COMMANDS } from '../../domain/types';
import {
    getPromptOption,
    getPromptOptions,
    getPromptPlayerId,
    getReactionPromptOptionBySourceDefId,
    getReactionPromptSourceDefIds,
    getPromptSourceId,
    getPromptsBySourceId,
    getSimpleChoicePrompt,
    invokeRegisteredInteractionHandlerContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    resolveDestroyedMinions,
    resolveInteractionChain,
} from '../helpers';
import { runCommand } from '../testRunner';

function chooseOptionBySource(prompt: any, sourceId: string, predicate: (option: any) => boolean) {
    expect(getPromptSourceId(prompt)).toBe(sourceId);
    const option = getPromptOption(prompt, predicate, `option for ${sourceId}`);
    return { optionId: option.id };
}

describe('鲨鱼代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('撕裂可通过真实行动入口消灭低力量随从并抽牌，锤头鲨获得指示物', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-torn', 'sharks_torn_apart', 'action', '0')],
                    deck: [makeCard('draw-1', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [
                makeMinion('hammer', 'sharks_hammerhead', '0', 3),
                makeMinion('victim', 'tornados_dust_devil', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-torn' },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const target = getPromptOptions(prompt).find((option: any) => option.value?.minionUid === 'victim');
            if (target) return { optionId: target.id };
            const skip = getPromptOptions(prompt).find((option: any) => option.value?.skip);
            return { optionId: skip.id };
        });
        const final = resolved.finalState.core;
        expect(final.bases[0].minions.some(minion => minion.uid === 'victim')).toBe(false);
        expect(final.players['0'].hand.some(card => card.uid === 'draw-1')).toBe(true);
        expect(final.bases[0].minions.find(minion => minion.uid === 'hammer')?.powerCounters).toBe(1);
    });

    it('疯狂进食按玩家多选消灭任意数量低力量随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('a-feed', 'sharks_feeding_frenzy', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [
                makeMinion('low-a', 'tornados_dust_devil', '1', 2),
                makeMinion('low-b', 'sharks_mako', '1', 2),
                makeMinion('high', 'sharks_hammerhead', '1', 3),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-feed', targetBaseIndex: 0 },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const lowA = getPromptOption(prompt, option => option.value?.minionUid === 'low-a', 'Feeding Frenzy low minion option');
            return { optionIds: [lowA.id] };
        });
        const minionUids = resolved.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(minionUids).not.toContain('low-a');
        expect(minionUids).toContain('low-b');
        expect(minionUids).toContain('high');
    });

    it('疯狂进食一次消灭多个随从时，锤头鲨会按被消灭数量分别获得指示物', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('a-feed', 'sharks_feeding_frenzy', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [
                makeMinion('hammer', 'sharks_hammerhead', '0', 3),
                makeMinion('low-a', 'tornados_dust_devil', '1', 2),
                makeMinion('low-b', 'sharks_mako', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-feed', targetBaseIndex: 0 },
        } as any);
        expect(play.success).toBe(true);

        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const lowA = getPromptOption(prompt, option => option.value?.minionUid === 'low-a', 'Feeding Frenzy low-a option');
            const lowB = getPromptOption(prompt, option => option.value?.minionUid === 'low-b', 'Feeding Frenzy low-b option');
            return { optionIds: [lowA.id, lowB.id] };
        });

        const hammer = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'hammer');
        expect(hammer?.powerCounters).toBe(2);
    });

    it('旋齿鲨奖励交互可从牌库拿 1 张鲭鲨进手牌，并重排剩余牌库', () => {
        const state = makeMatchState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('mako-top', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-rest', 'ghosts_spectre', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_the_deep')],
            baseDeck: [],
            turnNumber: 3,
            nextUid: 100,
        } as any);

        const result = invokeRegisteredInteractionHandlerContract(
            'titan_sharks_helicoprion_reward',
            state,
            '0',
            {
                action: 'take_mako',
                cardUid: 'mako-top',
                defId: 'sharks_mako',
                sourceZone: 'deck',
            },
            {},
            200,
        );

        expect(result.events.map(event => event.type)).toEqual([
            'su:card_transferred',
            'su:deck_reordered',
        ]);
        expect(result.events[0]).toMatchObject({
            payload: {
                cardUid: 'mako-top',
                defId: 'sharks_mako',
                fromPlayerId: '0',
                toPlayerId: '0',
                reason: 'sharks_helicoprion_reward',
            },
        });
        expect(result.events[1]).toMatchObject({
            payload: {
                playerId: '0',
                deckUids: ['deck-rest'],
            },
        });
    });

    it('旋齿鲨奖励交互可从弃牌堆拿 1 张鲭鲨回手，且不会错误重排牌库', () => {
        const state = makeMatchState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-rest', 'ghosts_spectre', 'minion', '0')],
                    discard: [makeCard('mako-discard', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_the_deep')],
            baseDeck: [],
            turnNumber: 3,
            nextUid: 100,
        } as any);

        const result = invokeRegisteredInteractionHandlerContract(
            'titan_sharks_helicoprion_reward',
            state,
            '0',
            {
                action: 'take_mako',
                cardUid: 'mako-discard',
                defId: 'sharks_mako',
                sourceZone: 'discard',
            },
            {},
            200,
        );

        expect(result.events).toHaveLength(1);
        expect(result.events[0]).toMatchObject({
            type: 'su:card_recovered_from_discard',
            payload: {
                reason: 'sharks_helicoprion_reward',
            },
        });
        expect(result.events.map(event => event.type)).not.toContain('su:deck_reordered');
    });

    it('旋齿鲨奖励交互选择抽牌时，会为控制者抽 1 张牌', () => {
        const state = makeMatchState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-top', 'ghosts_spectre', 'minion', '0'),
                        makeCard('draw-rest', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_the_deep')],
            baseDeck: [],
            turnNumber: 3,
            nextUid: 100,
        } as any);

        const result = invokeRegisteredInteractionHandlerContract(
            'titan_sharks_helicoprion_reward',
            state,
            '0',
            {
                action: 'draw',
            },
            {},
            200,
        );

        expect(result.events).toHaveLength(1);
        expect(result.events[0]).toMatchObject({
            type: 'su:cards_drawn',
            payload: {
                playerId: '0',
                count: 1,
            },
        });
    });

    it('旋齿鲨奖励交互选择跳过时，不会产生任何事件', () => {
        const state = makeMatchState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-top', 'ghosts_spectre', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_the_deep')],
            baseDeck: [],
            turnNumber: 3,
            nextUid: 100,
        } as any);

        const result = invokeRegisteredInteractionHandlerContract(
            'titan_sharks_helicoprion_reward',
            state,
            '0',
            {
                action: 'skip',
            },
            {},
            200,
        );

        expect(result.events).toEqual([]);
    });

    it('飞鲨通过真实行动入口先选择己方随从，再选择另一个基地并消灭低力量随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('a-air', 'sharks_air_jaws', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_the_deep', [makeMinion('own-shark', 'sharks_mako', '0', 2)]),
                makeBase('base_trailer_park', [makeMinion('victim', 'tornados_dust_devil', '1', 2)]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-air', targetBaseIndex: 0, targetMinionUid: 'own-shark' },
        } as any);
        expect(play.success).toBe(true);
        const airJawsPrompt = getSimpleChoicePrompt(play.finalState, 'sharks_air_jaws_destination');
        expect(airJawsPrompt.targetType).toBe('base');

        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const targetBase = getPromptOption(prompt, option => option.value?.baseIndex === 1, 'Air Jaws destination base option');
            return { optionId: targetBase.id };
        });
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'own-shark')).toBe(false);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'own-shark')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'victim')).toBe(false);
    });

    it('激光束第一入口只能选择己方随从，合法后再消灭同基地低战力目标', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('a-laser', 'sharks_freakin_laser_beam', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [
                makeMinion('own-source', 'sharks_hammerhead', '0', 3),
                makeMinion('enemy-source', 'sharks_mako', '1', 2),
                makeMinion('victim-low', 'tornados_dust_devil', '1', 2),
                makeMinion('victim-high', 'tornados_twister', '1', 4),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const illegal = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-laser', targetBaseIndex: 0, targetMinionUid: 'enemy-source' },
        } as any);
        expect(illegal.success).toBe(false);

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-laser', targetBaseIndex: 0, targetMinionUid: 'own-source' },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const low = getPromptOptions(prompt).find((option: any) => option.value?.minionUid === 'victim-low');
            const high = getPromptOptions(prompt).find((option: any) => option.value?.minionUid === 'victim-high');
            expect(low).toBeTruthy();
            expect(high).toBeFalsy();
            return { optionId: low.id };
        });
        const minionUids = resolved.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(minionUids).not.toContain('victim-low');
        expect(minionUids).toContain('victim-high');
        expect(minionUids).toContain('own-source');
    });

    it('鲨鱼周在回合结束只按拥有者触发一次额外抽牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'sharks_mako', 'minion', '0'),
                        makeCard('draw-b', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_the_deep',
                    minions: [makeMinion('own-a', 'sharks_mako', '0', 2)],
                    ongoingActions: [{ uid: 'week-a', defId: 'sharks_week_of_sharks', ownerId: '0' }],
                }),
                makeBase({
                    defId: 'base_trailer_park',
                    minions: [makeMinion('own-b', 'sharks_mako', '0', 2)],
                    ongoingActions: [{ uid: 'week-b', defId: 'sharks_week_of_sharks', ownerId: '0' }],
                }),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const state = makeMatchState(core);
        state.sys.phase = 'endTurn';
        const result = runCommand(state, { type: 'ADVANCE_PHASE' as any, playerId: '0', payload: undefined } as any);
        expect(result.success).toBe(true);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a']);
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['draw-b']);
    });

    it('鲨鱼周跨到下一次自己回合结束时仍可再次额外抽牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'sharks_mako', 'minion', '0'),
                        makeCard('draw-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('draw-c', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_the_deep',
                    minions: [makeMinion('own-a', 'sharks_mako', '0', 2)],
                    ongoingActions: [{ uid: 'week-a', defId: 'sharks_week_of_sharks', ownerId: '0' }],
                }),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const firstEndTurnState = makeMatchState(core);
        firstEndTurnState.sys.phase = 'endTurn';
        const firstEndTurn = runCommand(firstEndTurnState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '0',
            payload: undefined,
        } as any);
        expect(firstEndTurn.success).toBe(true);
        expect(firstEndTurn.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a']);

        const backToPlayerZero = runCommand(firstEndTurn.finalState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
        } as any);
        expect(backToPlayerZero.success).toBe(true);
        expect(backToPlayerZero.finalState.core.currentPlayerIndex).toBe(0);

        const secondEndTurnState = {
            ...backToPlayerZero.finalState,
            sys: { ...backToPlayerZero.finalState.sys, phase: 'endTurn' as const },
        };
        const secondEndTurn = runCommand(secondEndTurnState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '0',
            payload: undefined,
        } as any);

        expect(secondEndTurn.success).toBe(true);
        expect(secondEndTurn.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b']);
        expect(secondEndTurn.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['draw-c']);
    });

    it('危险水域天赋只影响其附着基地的随从', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_the_deep',
                    minions: [makeMinion('same-base-target', 'tornados_dust_devil', '1', 2)],
                    ongoingActions: [{ uid: 'dangerous', defId: 'sharks_dangerous_waters', ownerId: '0' }],
                }),
                makeBase('base_wooden_horse', [makeMinion('other-base-target', 'sharks_mako', '1', 2)]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'dangerous', baseIndex: 0 },
        } as any);
        expect(talent.success).toBe(true);
        const dangerousPrompt = getSimpleChoicePrompt(talent.finalState, 'sharks_dangerous_waters');
        expect(getPromptOptions(dangerousPrompt).some((option: any) => option.value?.minionUid === 'other-base-target')).toBe(false);

        const resolved = resolveInteractionChain(talent.finalState, (prompt) => {
            const target = getPromptOption(prompt, option => option.value?.minionUid === 'same-base-target', 'Dangerous Waters same-base target option');
            return { optionId: target.id };
        });

        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'same-base-target')?.tempPowerModifier).toBe(-2);
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'other-base-target')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('巨齿鲨从真实随从入口打出后，可选择消灭同基地力量≤4随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('mega', 'sharks_megalodon', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_wooden_horse', [
                makeMinion('low-target', 'tornados_twister', '1', 4),
                makeMinion('high-target', 'tornados_monster_tornado', '1', 5),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'mega', baseIndex: 0 },
        } as any);

        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'high-target')).toBe(false);
            return chooseOptionBySource(prompt, 'sharks_megalodon', option => option.value?.minionUid === 'low-target');
        });

        const minions = resolved.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(minions).toContain('mega');
        expect(minions).not.toContain('low-target');
        expect(minions).toContain('high-target');
    });

    it('大白鲨天赋移动自身到另一个基地，并只消灭移动后基地力量≤2目标', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_shark_reef', [makeMinion('great-white', 'sharks_great_white', '0', 4)]),
                makeBase('base_the_deep', [
                    makeMinion('low-target', 'tornados_dust_devil', '1', 2),
                    makeMinion('high-target', 'tornados_twister', '1', 4),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'great-white', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(true);
        const resolved = resolveInteractionChain(talent.finalState, (prompt) => {
            const sourceId = getPromptSourceId(prompt);
            if (sourceId === 'sharks_great_white') {
                return chooseOptionBySource(prompt, 'sharks_great_white', option => option.value?.baseIndex === 1);
            }
            if (sourceId === 'sharks_great_white_destroy') {
                return chooseOptionBySource(prompt, 'sharks_great_white_destroy', option => option.value?.minionUid === 'low-target');
            }
            throw new Error(`unexpected prompt source: ${String(sourceId)}`);
        });

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'great-white')).toBe(false);
        const targetBaseMinions = resolved.finalState.core.bases[1].minions.map(minion => minion.uid);
        expect(targetBaseMinions).toContain('great-white');
        expect(targetBaseMinions).not.toContain('low-target');
        expect(targetBaseMinions).toContain('high-target');
    });

    it('灰鲭鲨在你消灭随从后，只允许立即额外打出手牌中的灰鲭鲨到该基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('torn', 'sharks_torn_apart', 'action', '0'),
                        makeCard('mako-extra', 'sharks_mako', 'minion', '0'),
                        makeCard('other-minion', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_shark_reef', [makeMinion('victim', 'tornados_dust_devil', '1', 2)]),
                makeBase('base_the_deep', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'torn' },
        } as any);

        expect(play.success).toBe(true);
        let chosenExtra = false;
        const resolved = resolveInteractionChain(play.finalState, (prompt, state) => {
            const sourceId = getPromptSourceId(prompt);
            if (sourceId === 'sharks_torn_apart') {
                return chooseOptionBySource(prompt, 'sharks_torn_apart', option => option.value?.minionUid === 'victim');
            }
            if (sourceId === 'smashup_reaction_choose') {
                const sourceDefIds = getReactionPromptSourceDefIds(state, prompt);
                if (sourceDefIds.includes('base_shark_reef')) {
                    const reactionOption = getReactionPromptOptionBySourceDefId(state, prompt, 'base_shark_reef');
                    return { optionId: reactionOption.id };
                }
                expect(sourceDefIds).toContain('sharks_mako');
                const reactionOption = getReactionPromptOptionBySourceDefId(state, prompt, 'sharks_mako');
                return { optionId: reactionOption.id };
            }
            if (sourceId === 'base_shark_reef') {
                return { optionId: getPromptOption(prompt, (option: any) => option.value?.skip, 'skip shark reef option').id };
            }
            if (sourceId === 'smashup_immediate_extra_minion_base') {
                expect(getPromptOptions(prompt).some((option: any) => option.value?.baseIndex === 1)).toBe(false);
                return chooseOptionBySource(prompt, 'smashup_immediate_extra_minion_base', option => option.value?.baseIndex === 0);
            }
            expect(sourceId).toBe('smashup_immediate_extra_minion');
            if (chosenExtra) {
                return { optionId: getPromptOption(prompt, (option: any) => option.value?.skip, 'skip extra minion option').id };
            }
            chosenExtra = true;
            expect(getPromptOptions(prompt).some((option: any) => option.value?.cardUid === 'other-minion')).toBe(false);
            const mako = getPromptOption(prompt, (option: any) => option.value?.cardUid === 'mako-extra', 'Mako extra minion option');
            return { optionId: mako.id };
        });

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'mako-extra')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'mako-extra')).toBe(false);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'other-minion')).toBe(true);
    });

    it('灰鲭鲨在消灭被防止时不会错误出现额外打出提示', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('torn', 'sharks_torn_apart', 'action', '0'),
                        makeCard('mako-extra', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_shark_reef', [makeMinion('warbot', 'robot_warbot', '1', 4)])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'torn' },
        } as any);

        expect(play.success).toBe(true);
        let makoTriggered = false;
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const sourceId = getPromptSourceId(prompt);
            if (sourceId === 'sharks_torn_apart') {
                return chooseOptionBySource(prompt, 'sharks_torn_apart', option => option.value?.minionUid === 'warbot');
            }
            if (sourceId === 'smashup_immediate_extra_minion') {
                makoTriggered = true;
                const skip = getPromptOption(prompt, (option: any) => option.value?.skip, 'unexpected mako skip option');
                return { optionId: skip.id };
            }
            throw new Error(`unexpected prompt source: ${String(sourceId)}`);
        });

        expect(makoTriggered).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'warbot')).toBe(true);
        expect(getPromptsBySourceId(resolved.finalState, 'smashup_immediate_extra_minion')).toHaveLength(0);
    });

    it('灰鲭鲨不会把缺少 destroyerId 的消灭事件默认算成当前玩家消灭', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mako-extra', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_shark_reef', [makeMinion('victim', 'tornados_dust_devil', '1', 2)])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = resolveDestroyedMinions(makeMatchState(core), '0', [{
            minionUid: 'victim',
            minionDefId: 'tornados_dust_devil',
            fromBaseIndex: 0,
            ownerId: '1',
            reason: 'neutral_destroy_without_destroyer',
        }]);

        expect(getPromptsBySourceId(result.matchState ?? makeMatchState(core), 'smashup_immediate_extra_minion')).toHaveLength(0);
    });

    it('血腥水域在该基地有随从被消灭后，只允许立即额外打出力量≤3随从到该基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('torn', 'sharks_torn_apart', 'action', '0'),
                        makeCard('small-extra', 'mythic_greeks_spartan', 'minion', '0'),
                        makeCard('big-extra', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_shark_reef',
                    minions: [makeMinion('victim', 'tornados_dust_devil', '1', 2)],
                    ongoingActions: [{ uid: 'blood', defId: 'sharks_blood_in_the_water', ownerId: '0' }],
                }),
                makeBase('base_the_deep', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'torn' },
        } as any);

        expect(play.success).toBe(true);
        let chosenExtra = false;
        const resolved = resolveInteractionChain(play.finalState, (prompt, state) => {
            const sourceId = getPromptSourceId(prompt);
            if (sourceId === 'sharks_torn_apart') {
                return chooseOptionBySource(prompt, 'sharks_torn_apart', option => option.value?.minionUid === 'victim');
            }
            if (sourceId === 'smashup_reaction_choose') {
                const sourceDefIds = getReactionPromptSourceDefIds(state, prompt);
                if (sourceDefIds.includes('base_shark_reef')) {
                    const reactionOption = getReactionPromptOptionBySourceDefId(state, prompt, 'base_shark_reef');
                    return { optionId: reactionOption.id };
                }
                expect(sourceDefIds).toContain('sharks_blood_in_the_water');
                const reactionOption = getReactionPromptOptionBySourceDefId(state, prompt, 'sharks_blood_in_the_water');
                return { optionId: reactionOption.id };
            }
            if (sourceId === 'base_shark_reef') {
                return { optionId: getPromptOption(prompt, (option: any) => option.value?.skip, 'skip shark reef option').id };
            }
            if (sourceId === 'smashup_immediate_extra_minion_base') {
                expect(getPromptOptions(prompt).some((option: any) => option.value?.baseIndex === 1)).toBe(false);
                return chooseOptionBySource(prompt, 'smashup_immediate_extra_minion_base', option => option.value?.baseIndex === 0);
            }
            expect(sourceId).toBe('smashup_immediate_extra_minion');
            if (chosenExtra) {
                return { optionId: getPromptOption(prompt, (option: any) => option.value?.skip, 'skip extra minion option').id };
            }
            chosenExtra = true;
            expect(getPromptOptions(prompt).some((option: any) => option.value?.cardUid === 'big-extra')).toBe(false);
            const small = getPromptOption(prompt, (option: any) => option.value?.cardUid === 'small-extra', 'small extra minion option');
            return { optionId: small.id };
        });

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'small-extra')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'small-extra')).toBe(false);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'big-extra')).toBe(true);
    });

    it('鲨鱼领地不会把缺少 destroyerId 的消灭事件默认算成当前玩家触发', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_shark_reef', [makeMinion('victim', 'tornados_dust_devil', '1', 2)]),
                makeBase('base_the_deep', [makeMinion('destroyer-minion', 'sharks_hammerhead', '0', 3)]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = resolveDestroyedMinions(makeMatchState(core), '0', [{
            minionUid: 'victim',
            minionDefId: 'tornados_dust_devil',
            fromBaseIndex: 0,
            ownerId: '1',
            reason: 'neutral_destroy_without_destroyer',
        }]);

        expect(getPromptsBySourceId(result.matchState ?? makeMatchState(core), 'base_shark_reef')).toHaveLength(0);
    });

    it('鲨鱼领地按 destroyerId 让消灭者给自己的任意随从放置指示物', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('torn', 'sharks_torn_apart', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_shark_reef', [
                    makeMinion('victim', 'tornados_dust_devil', '1', 2),
                    makeMinion('enemy-other', 'sharks_mako', '1', 2),
                ]),
                makeBase('base_the_deep', [makeMinion('destroyer-minion', 'sharks_hammerhead', '0', 3)]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'torn' },
        } as any);

        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt, state) => {
            const triggerOption = getPromptOptions(prompt).find((option: any) => {
                const triggerId = option.value?.triggerId;
                return triggerId && state.core.triggerQueue?.some(trigger => trigger.id === triggerId);
            });
            if (triggerOption) return { optionId: triggerOption.id };

            if (getPromptSourceId(prompt) === 'sharks_torn_apart') {
                return chooseOptionBySource(prompt, 'sharks_torn_apart', option => option.value?.minionUid === 'victim');
            }

            expect(getPromptSourceId(prompt)).toBe('base_shark_reef');
            expect(getPromptPlayerId(prompt)).toBe('0');
            expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-other')).toBe(false);
            return chooseOptionBySource(prompt, 'base_shark_reef', option => option.value?.minionUid === 'destroyer-minion');
        });

        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'destroyer-minion')?.powerCounters).toBe(1);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-other')?.powerCounters ?? 0).toBe(0);
    });

    it('鲨鱼诱饵附着随从后，该基地任意随从被消灭会给附着随从+1', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('torn', 'sharks_torn_apart', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [
                makeMinion('baited', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'chum', defId: 'sharks_chum', ownerId: '0' }],
                }),
                makeMinion('victim', 'tornados_dust_devil', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'torn' },
        } as any);

        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            if (getPromptSourceId(prompt) === 'sharks_torn_apart') {
                return chooseOptionBySource(prompt, 'sharks_torn_apart', option => option.value?.minionUid === 'victim');
            }
            const skip = getPromptOption(prompt, (option: any) => option.value?.skip, 'skip option');
            return { optionId: skip.id };
        });

        const base = resolved.finalState.core.bases[0];
        expect(base.minions.some(minion => minion.uid === 'victim')).toBe(false);
        expect(base.minions.find(minion => minion.uid === 'baited')?.powerCounters).toBe(1);
    });
});
