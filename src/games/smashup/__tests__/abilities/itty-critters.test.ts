import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SU_COMMANDS } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    resolveInteractionChain,
} from '../helpers';
import { runCommand } from '../testRunner';

describe('Itty Critters 代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('Calicoin 是可选效果：有合法目标时也可以跳过且状态不变', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('calicoin', 'itty_critters_calicoin', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_itty_city', [makeMinion('ally', 'itty_critters_flooffairy', '0', 2)])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'calicoin', baseIndex: 0 },
        } as any);

        expect(play.success).toBe(true);
        const prompt = getSimpleChoicePrompt(play.finalState, 'itty_critters_calicoin');
        expect(getPromptOptions(prompt).some(option => option.value?.skip)).toBe(true);

        const skipped = resolveInteractionChain(play.finalState, (currentPrompt) => {
            const skip = getPromptOption(currentPrompt, option => option.value?.skip, 'Calicoin skip option');
            return { optionId: skip.id };
        });

        const ally = skipped.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally');
        expect(ally?.powerCounters ?? 0).toBe(0);
        expectNoPrompt(skipped.finalState);
    });

    it('Calicoin 可以给这里另一个随从放置 +1 指示物', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('calicoin', 'itty_critters_calicoin', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_itty_city', [makeMinion('ally', 'itty_critters_flooffairy', '0', 2)])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'calicoin', baseIndex: 0 },
        } as any);
        expect(play.success).toBe(true);

        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const target = getPromptOption(prompt, option => option.value?.minionUid === 'ally', 'Calicoin target option');
            return { optionId: target.id };
        });

        const ally = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally');
        expect(ally?.powerCounters).toBe(1);
    });

    it('Flooffairy 可选择抽牌或跳过', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('floof', 'itty_critters_flooffairy', 'minion', '0')],
                    deck: [makeCard('drawn', 'itty_critters_leafaroo', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_itty_city', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'floof', baseIndex: 0 },
        } as any);
        expect(play.success).toBe(true);

        const skipped = resolveInteractionChain(play.finalState, (prompt) => {
            const skip = getPromptOption(prompt, option => option.value?.skip, 'Flooffairy skip option');
            return { optionId: skip.id };
        });
        expect(skipped.finalState.core.players['0'].hand.some(card => card.uid === 'drawn')).toBe(false);

        const playAgain = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'floof', baseIndex: 0 },
        } as any);
        const drawn = resolveInteractionChain(playAgain.finalState, (prompt) => {
            const draw = getPromptOption(prompt, option => option.value?.choice === 'draw', 'Flooffairy draw option');
            return { optionId: draw.id };
        });
        expect(drawn.finalState.core.players['0'].hand.some(card => card.uid === 'drawn')).toBe(true);
    });

    it('I Select You 从牌库打出力量≤3的额外随从，并在回合结束仍控制时放回牌库底', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('select', 'itty_critters_i_select_you', 'action', '0')],
                    deck: [
                        makeCard('small', 'itty_critters_flooffairy', 'minion', '0'),
                        makeCard('big', 'itty_critters_critter_coach', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_itty_city', []),
                makeBase('base_critter_combat_club', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'select' },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt, _state, step) => {
            if (step === 0) {
                expect(getPromptOptions(prompt).some(option => option.value?.cardUid === 'big')).toBe(false);
                const small = getPromptOption(prompt, option => option.value?.cardUid === 'small', 'I Select You small minion');
                return { optionId: small.id };
            }
            if (getPromptOptions(prompt).some(option => option.value?.skip)) {
                const skip = getPromptOption(prompt, option => option.value?.skip, 'I Select You played minion optional onPlay skip');
                return { optionId: skip.id };
            }
            const base = getPromptOption(prompt, option => option.value?.baseIndex === 1, 'I Select You destination');
            return { optionId: base.id };
        });
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'small')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'small')?.metadata?.ittyCrittersReturnToDeckBottomPlayerId).toBe('0');

        const endTurnState = { ...resolved.finalState, sys: { ...resolved.finalState.sys, phase: 'endTurn' } };
        const endTurn = runCommand(endTurnState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '0',
            payload: undefined,
        } as any);
        expect(endTurn.success).toBe(true);
        expect(endTurn.finalState.core.bases[1].minions.some(minion => minion.uid === 'small')).toBe(false);
        expect(endTurn.finalState.core.players['0'].deck.at(-1)?.uid).toBe('small');
    });

    it('Itty 临时随从回合结束时若已被对手控制，不会回到牌库底，并兼容临时控制恢复', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_itty_city', [
                makeMinion('borrowed', 'itty_critters_flooffairy', '0', 2, {
                    owner: '0',
                    controller: '0',
                    metadata: {
                        ittyCrittersReturnToDeckBottomPlayerId: '0',
                        mermaidsTemporaryControlPlayerId: '0',
                        mermaidsTemporaryControlTurn: 1,
                        mermaidsTemporaryControlOriginalController: '1',
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const endTurnState = { ...makeMatchState(core), sys: { ...makeMatchState(core).sys, phase: 'endTurn' } };
        const endTurn = runCommand(endTurnState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '0',
            payload: undefined,
        } as any);

        const minion = endTurn.finalState.core.bases[0].minions.find(candidate => candidate.uid === 'borrowed');
        expect(minion?.controller).toBe('1');
        expect(endTurn.finalState.core.players['0'].deck.some(card => card.uid === 'borrowed')).toBe(false);
    });

    it('Itty 临时随从回牌库底时，附着行动进入各自拥有者弃牌堆', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_itty_city', [
                makeMinion('temp', 'itty_critters_shellshock', '0', 2, {
                    metadata: { ittyCrittersReturnToDeckBottomPlayerId: '0' },
                    attachedActions: [{ uid: 'attached', defId: 'trickster_hideout', ownerId: '1' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const match = makeMatchState(core);
        const endTurn = runCommand({ ...match, sys: { ...match.sys, phase: 'endTurn' } }, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '0',
            payload: undefined,
        } as any);

        expect(endTurn.finalState.core.bases[0].minions.some(minion => minion.uid === 'temp')).toBe(false);
        expect(endTurn.finalState.core.players['0'].deck.at(-1)?.uid).toBe('temp');
        expect(endTurn.finalState.core.players['1'].discard.some(card => card.uid === 'attached')).toBe(true);
    });

    it('Evolution 消灭己方随从后，可从牌库打出力量至多高 1 的额外随从到原基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('evo', 'itty_critters_evolution', 'action', '0')],
                    deck: [
                        makeCard('small', 'itty_critters_flooffairy', 'minion', '0'),
                        makeCard('too-big', 'itty_critters_critter_coach', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_critter_combat_club', [makeMinion('source', 'itty_critters_leafaroo', '0', 2)])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'evo', targetBaseIndex: 0, targetMinionUid: 'source' },
        } as any);
        expect(play.success).toBe(true);

        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            if (getPromptOptions(prompt).some(option => option.value?.skip)) {
                const skip = getPromptOption(prompt, option => option.value?.skip, 'Evolution played Flooffairy skip');
                return { optionId: skip.id };
            }
            expect(getPromptOptions(prompt).some(option => option.value?.cardUid === 'too-big')).toBe(false);
            const small = getPromptOption(prompt, option => option.value?.cardUid === 'small', 'Evolution deck minion');
            return { optionId: small.id };
        });

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'source')).toBe(false);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'source')).toBe(true);
        const evolved = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'small');
        expect(evolved?.metadata?.ittyCrittersReturnToDeckBottomPlayerId).toBe('0');
    });

    it('Evolution 可消灭己方随从并把 setaside 的 Rainboroc 打到原基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('evo', 'itty_critters_evolution', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_itty_city', [makeMinion('source', 'itty_critters_leafaroo', '0', 2)])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
            titans: [{
                uid: 'rain',
                defId: 'itty_critters_rainboroc',
                faction: 'itty_critters',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'evo', targetBaseIndex: 0, targetMinionUid: 'source' },
        } as any);
        expect(play.success).toBe(true);

        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const rainboroc = getPromptOption(prompt, option => option.value?.titanUid === 'rain', 'Evolution Rainboroc option');
            return { optionId: rainboroc.id };
        });

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'source')).toBe(false);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'rain')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('Critter Cube 将任意玩家拥有的在场力量≤3随从洗入当前玩家牌库', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cube', 'itty_critters_critter_cube', 'action', '0')],
                    deck: [makeCard('deck-card', 'itty_critters_calicoin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_itty_city', [
                makeMinion('target', 'itty_critters_shellshock', '1', 2),
                makeMinion('too-big', 'itty_critters_critter_coach', '1', 4),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'cube', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);

        expect(play.success).toBe(true);
        expect(play.finalState.core.bases[0].minions.some(minion => minion.uid === 'target')).toBe(false);
        expect(play.finalState.core.players['0'].deck.some(card => card.uid === 'target')).toBe(true);
        expect(play.finalState.core.bases[0].minions.some(minion => minion.uid === 'too-big')).toBe(true);
    });

    it('Critter Combat Club 主动基地能力可额外打出力量≤2随从到这里，并沿用回底合同', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('small', 'itty_critters_flooffairy', 'minion', '0'),
                        makeCard('big', 'itty_critters_critter_coach', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_critter_combat_club', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const useBase = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 0 },
        } as any);
        expect(useBase.success).toBe(true);

        const prompt = getSimpleChoicePrompt(useBase.finalState, 'base_critter_combat_club');
        expect(getPromptOptions(prompt).some(option => option.value?.cardUid === 'big')).toBe(false);

        const resolved = resolveInteractionChain(useBase.finalState, (currentPrompt) => {
            if (getPromptOptions(currentPrompt).some(option => option.value?.skip)) {
                const skip = getPromptOption(currentPrompt, option => option.value?.skip, 'Critter Combat Club Flooffairy skip');
                return { optionId: skip.id };
            }
            const small = getPromptOption(currentPrompt, option => option.value?.cardUid === 'small', 'Critter Combat Club small minion');
            return { optionId: small.id };
        });

        const played = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'small');
        expect(played?.metadata?.ittyCrittersReturnToDeckBottomPlayerId).toBe('0');

        const match = { ...resolved.finalState, sys: { ...resolved.finalState.sys, phase: 'endTurn' } };
        const endTurn = runCommand(match, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '0',
            payload: undefined,
        } as any);
        expect(endTurn.finalState.core.bases[0].minions.some(minion => minion.uid === 'small')).toBe(false);
        expect(endTurn.finalState.core.players['0'].deck.at(-1)?.uid).toBe('small');
    });

    it('Itty City 首次在这里打出随从后，可选择是否随机洗回弃牌堆随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('played', 'pirate_first_mate', 'minion', '0')],
                    discard: [
                        makeCard('discard-minion', 'itty_critters_shellshock', 'minion', '0'),
                        makeCard('discard-action', 'itty_critters_super_effective', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_itty_city', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'played', baseIndex: 0 },
        } as any);
        expect(play.success).toBe(true);

        const skipped = resolveInteractionChain(play.finalState, (prompt) => {
            if (getPromptOptions(prompt).some(option => option.value?.kind === 'trigger')) {
                const trigger = getPromptOption(prompt, option => option.value?.kind === 'trigger', 'Itty City trigger');
                return { optionId: trigger.id };
            }
            const skip = getPromptOption(prompt, option => option.value?.skip, 'Itty City skip');
            return { optionId: skip.id };
        });
        expect(skipped.finalState.core.players['0'].deck.some(card => card.uid === 'discard-minion')).toBe(false);

        const playAgain = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'played', baseIndex: 0 },
        } as any);
        const shuffled = resolveInteractionChain(playAgain.finalState, (prompt) => {
            if (getPromptOptions(prompt).some(option => option.value?.kind === 'trigger')) {
                const trigger = getPromptOption(prompt, option => option.value?.kind === 'trigger', 'Itty City trigger');
                return { optionId: trigger.id };
            }
            const shuffle = getPromptOption(prompt, option => option.value?.choice === 'shuffle', 'Itty City shuffle');
            return { optionId: shuffle.id };
        });

        expect(shuffled.finalState.core.players['0'].deck.some(card => card.uid === 'discard-minion')).toBe(true);
        expect(shuffled.finalState.core.players['0'].discard.some(card => card.uid === 'discard-minion')).toBe(false);
        expect(shuffled.finalState.core.players['0'].discard.some(card => card.uid === 'discard-action')).toBe(true);
    });

    it('Critter Coach 可以跳过牌库额外随从，Recall Critter 可从弃牌堆额外打出力量≤2随从', () => {
        const coachCore = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('coach', 'itty_critters_critter_coach', 'minion', '0')],
                    deck: [makeCard('small', 'itty_critters_flooffairy', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_critter_combat_club', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const coach = runCommand(makeMatchState(coachCore), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'coach', baseIndex: 0 },
        } as any);
        const skipped = resolveInteractionChain(coach.finalState, (prompt) => {
            const skip = getPromptOption(prompt, option => option.value?.skip, 'Critter Coach skip option');
            return { optionId: skip.id };
        });
        expect(skipped.finalState.core.players['0'].deck.some(card => card.uid === 'small')).toBe(true);

        const recallCore = {
            ...coachCore,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('recall', 'itty_critters_recall_critter', 'action', '0')],
                    discard: [
                        makeCard('small-discard', 'itty_critters_shellshock', 'minion', '0'),
                        makeCard('large-discard', 'itty_critters_critter_coach', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_itty_city', []), makeBase('base_critter_combat_club', [])],
        };
        const recall = runCommand(makeMatchState(recallCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'recall' },
        } as any);
        expect(recall.success).toBe(true);
        const resolved = resolveInteractionChain(recall.finalState, (prompt, _state, step) => {
            if (step === 0) {
                expect(getPromptOptions(prompt).some(option => option.value?.cardUid === 'large-discard')).toBe(false);
                const card = getPromptOption(prompt, option => option.value?.cardUid === 'small-discard', 'Recall Critter discard minion');
                return { optionId: card.id };
            }
            const base = getPromptOption(prompt, option => option.value?.baseIndex === 1, 'Recall Critter destination');
            return { optionId: base.id };
        });
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'small-discard')).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'small-discard')).toBe(false);
    });

    it('Tadpour 可选移动这里另一个随从到另一个基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('tad', 'itty_critters_tadpour', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_itty_city', [makeMinion('move-me', 'itty_critters_flooffairy', '0', 2)]),
                makeBase('base_critter_combat_club', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'tad', baseIndex: 0 },
        } as any);
        expect(play.success).toBe(true);

        const resolved = resolveInteractionChain(play.finalState, (prompt, _state, step) => {
            if (step === 0) {
                const minion = getPromptOption(prompt, option => option.value?.minionUid === 'move-me', 'Tadpour minion option');
                return { optionId: minion.id };
            }
            const base = getPromptOption(prompt, option => option.value?.baseIndex === 1, 'Tadpour destination option');
            return { optionId: base.id };
        });

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'move-me')).toBe(false);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'move-me')).toBe(true);
    });

    it('Shellshock 只消灭这里另一个力量不超过 2 的随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('shell', 'itty_critters_shellshock', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_itty_city', [
                makeMinion('low', 'itty_critters_flooffairy', '1', 2),
                makeMinion('high', 'itty_critters_critter_coach', '1', 4),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'shell', baseIndex: 0 },
        } as any);
        expect(play.success).toBe(true);

        const prompt = getSimpleChoicePrompt(play.finalState, 'itty_critters_shellshock');
        expect(getPromptOptions(prompt).some(option => option.value?.minionUid === 'high')).toBe(false);

        const resolved = resolveInteractionChain(play.finalState, () => {
            const low = getPromptOption(prompt, option => option.value?.minionUid === 'low', 'Shellshock low target');
            return { optionId: low.id };
        });

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'low')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'high')).toBe(true);
    });

    it('Leafaroo 可将弃牌堆一张牌洗入牌库，Gotta Get Em All 每种随从名各洗一张', () => {
        const leafCore = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('leaf', 'itty_critters_leafaroo', 'minion', '0')],
                    deck: [makeCard('deck-1', 'itty_critters_flooffairy', 'minion', '0')],
                    discard: [makeCard('discard-1', 'itty_critters_calicoin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_critter_combat_club', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const leafPlay = runCommand(makeMatchState(leafCore), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'leaf', baseIndex: 0 },
        } as any);
        const leafPrompt = getSimpleChoicePrompt(leafPlay.finalState, 'itty_critters_leafaroo');
        expect(leafPrompt.targetType).toBe('discard');
        const leafPromptOption = getPromptOption(
            leafPrompt,
            option => option.value?.cardUid === 'discard-1',
            'Leafaroo discard option',
        );
        expect(leafPromptOption._source).toBe('discard');

        const leafResolved = resolveInteractionChain(leafPlay.finalState, (prompt) => {
            const card = getPromptOption(prompt, option => option.value?.cardUid === 'discard-1', 'Leafaroo discard option');
            return { optionId: card.id };
        });
        expect(leafResolved.finalState.core.players['0'].deck.some(card => card.uid === 'discard-1')).toBe(true);
        expect(leafResolved.finalState.core.players['0'].discard.some(card => card.uid === 'discard-1')).toBe(false);

        const gottaCore = {
            ...leafCore,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gotta', 'itty_critters_gotta_get_em_all', 'action', '0')],
                    deck: [],
                    discard: [
                        makeCard('a1', 'itty_critters_calicoin', 'minion', '0'),
                        makeCard('a2', 'itty_critters_calicoin', 'minion', '0'),
                        makeCard('b1', 'itty_critters_shellshock', 'minion', '0'),
                        makeCard('act', 'itty_critters_super_effective', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        };
        const gotta = runCommand(makeMatchState(gottaCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'gotta' },
        } as any);
        expect(gotta.success).toBe(true);
        const deckUids = gotta.finalState.core.players['0'].deck.map(card => card.uid);
        expect(deckUids).toHaveLength(2);
        expect(deckUids).toContain('a1');
        expect(deckUids).toContain('b1');
        expect(gotta.finalState.core.players['0'].discard.some(card => card.uid === 'a2')).toBe(true);
        expect(gotta.finalState.core.players['0'].discard.some(card => card.uid === 'act')).toBe(true);
    });

    it('Super Effective 可以消灭基地或随从上的行动牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('super', 'itty_critters_super_effective', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_itty_city',
                ongoingActions: [{ uid: 'ongoing', defId: 'zombie_overrun', ownerId: '1' }],
                minions: [
                    makeMinion('host', 'itty_critters_flooffairy', '1', 2, {
                        attachedActions: [{ uid: 'attached', defId: 'trickster_hideout', ownerId: '1' }],
                    }),
                ],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'super' },
        } as any);
        expect(play.success).toBe(true);

        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const attached = getPromptOption(prompt, option => option.value?.cardUid === 'attached', 'Super Effective attached action');
            return { optionId: attached.id };
        });

        const host = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'host');
        expect(host?.attachedActions.some(action => action.uid === 'attached')).toBe(false);
        expect(resolved.finalState.core.players['1'].discard.some(card => card.uid === 'attached')).toBe(true);
        expect(resolved.finalState.core.bases[0].ongoingActions.some(action => action.uid === 'ongoing')).toBe(true);
    });

    it('Ittypedia 在同基地打出自己随从后给予 +1 临时力量', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('floof', 'itty_critters_flooffairy', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_itty_city',
                ongoingActions: [{ uid: 'pedia', defId: 'itty_critters_ittypedia', ownerId: '0' }],
                minions: [],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'floof', baseIndex: 0 },
        } as any);
        expect(play.success).toBe(true);
        const floof = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'floof');
        expect(floof?.tempPowerModifier).toBe(1);
    });
});
