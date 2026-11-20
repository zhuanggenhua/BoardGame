import { beforeAll, describe, expect, it } from 'vitest';
import { extractAiInteractionSnapshot } from '../../../../engine/ai';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { buildSmashUpAiLegalActions } from '../../ai';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { getSmashUpReactionSession } from '../../domain/reactionSession';
import { SU_COMMANDS } from '../../domain/types';
import { getSimpleChoicePrompt, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState, respondToPromptOption } from '../helpers';
import { runCommand } from '../testRunner';

const actionId = 'diy_killers_cha_cha_cha_ha_ha_ha';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('杀人狂恰恰恰移动与后续选择', () => {
    it('移动杰森触发反应时，AI 能完成后续选择和反应', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('chacha', actionId, 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('jason', 'diy_killers_jason', '0', 5)]),
                makeBase('base_b', [makeMinion('target', 'pirate_first_mate', '1', 2)]),
            ],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'chacha' } });
        expect(played.success, played.error).toBe(true);
        const select = (current: typeof state, predicate: (value: any) => boolean) => {
            const actions = buildSmashUpAiLegalActions({ playerId: '0', state: current });
            expect(actions.every(candidate => candidate.kind === 'interaction-choice')).toBe(true);
            expect(buildSmashUpAiLegalActions({ playerId: '1', state: current })).toEqual([]);
            const action = actions.find(candidate => predicate(candidate.metadata?.optionValue));
            expect(action, JSON.stringify({ prompt: current.sys.interaction?.current, actions })).toBeDefined();
            const result = runCommand(current, { ...action!.commands[0], playerId: '0' } as any);
            expect(result.success, result.error).toBe(true);
            return result.finalState;
        };
        const selected = select(played.finalState, value => value?.minionUid === 'jason');
        const moved = select(selected, value => value?.baseIndex === 1);
        const followed = select(moved, value => value?.mode === 'deckTop');
        const reacted = select(followed, value => value?.triggerId?.includes('diy_killers_jason'));
        const finished = select(reacted, value => value?.minionUid === 'target');
        expect(finished.core.bases[1].minions.map(minion => minion.uid)).toEqual(['jason']);
        expect(finished.core.players['1'].discard.some(card => card.uid === 'target')).toBe(true);
        expect(finished.core.players['0'].deck[0]?.uid).toBe('chacha');
        expect(finished.sys.interaction?.current).toBeUndefined();
        expect(finished.sys.interaction?.queue ?? []).toHaveLength(0);
        expect(finished.core.triggerQueue ?? []).toHaveLength(0);
        expect(getSmashUpReactionSession(finished)).toBeUndefined();
    });

    it('AI 每一步重算合法动作并完成随从、基地与后续选择', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('chacha', actionId, 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('own', 'pirate_buccaneer', '0', 4)]), makeBase('base_b', [])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'chacha' } });
        expect(played.success, played.error).toBe(true);
        const minionAction = buildSmashUpAiLegalActions({ playerId: '0', state: played.finalState })
            .find(action => (action.metadata?.optionValue as { minionUid?: string } | undefined)?.minionUid === 'own');
        expect(minionAction).toBeDefined();
        const chosenMinion = runCommand(played.finalState, { ...minionAction!.commands[0], playerId: '0' } as any);
        expect(chosenMinion.success, chosenMinion.error).toBe(true);
        const baseActions = buildSmashUpAiLegalActions({ playerId: '0', state: chosenMinion.finalState });
        expect(baseActions.every(action => action.kind === 'interaction-choice')).toBe(true);
        const baseAction = baseActions.find(action => (action.metadata?.optionValue as { baseIndex?: number } | undefined)?.baseIndex === 1);
        expect(baseAction).toBeDefined();
        const chosenBase = runCommand(chosenMinion.finalState, { ...baseAction!.commands[0], playerId: '0' } as any);
        expect(chosenBase.success, chosenBase.error).toBe(true);
        const followups = buildSmashUpAiLegalActions({ playerId: '0', state: chosenBase.finalState });
        expect(extractAiInteractionSnapshot(chosenBase.finalState)?.choiceRequest).toMatchObject({
            sourceId: `${actionId}_followup`, aiDiagnosticStatus: 'ok', projectedLegalActionCount: 3,
        });
        expect(followups.map(action => (action.commands[0] as { payload?: { optionId?: string } }).payload?.optionId).sort())
            .toEqual(['deck-top', 'extra-action', 'skip']);
        expect(buildSmashUpAiLegalActions({ playerId: '1', state: chosenBase.finalState })).toEqual([]);
        const skip = followups.find(action => (action.commands[0] as { payload?: { optionId?: string } }).payload?.optionId === 'skip');
        const finished = runCommand(chosenBase.finalState, { ...skip!.commands[0], playerId: '0' } as any);
        expect(finished.success, finished.error).toBe(true);
        expect(finished.finalState.core.bases[1].minions.some(minion => minion.uid === 'own')).toBe(true);
        expect(finished.finalState.core.players['0'].discard.some(card => card.uid === 'chacha')).toBe(true);
        expect(finished.finalState.sys.interaction?.current).toBeUndefined();
        expect(finished.finalState.core.triggerQueue ?? []).toHaveLength(0);
    });

    it('己方随从被藤蔓缠绕禁止移动时仍可跳过后续，不应卡在空目标', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('chacha', actionId, 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    minions: [makeMinion('own', 'pirate_buccaneer', '0', 4)],
                    ongoingActions: [{ uid: 'entangled', defId: 'killer_plant_entangled', ownerId: '0' }],
                }),
                makeBase('base_b', []),
            ],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'chacha' } });
        expect(played.success, played.error).toBe(true);
        getSimpleChoicePrompt(played.finalState, `${actionId}_followup`);
        const skipped = respondToPromptOption(played.finalState, option => option.value?.skip === true, '跳过可选后续');
        expect(skipped.success, skipped.error).toBe(true);
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['own']);
        expect(skipped.finalState.core.players['0'].discard.some(card => card.uid === 'chacha')).toBe(true);
        expect(skipped.finalState.sys.interaction?.current).toBeUndefined();
    });

    it('部分随从受移动保护时只提供可移动的己方随从', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('chacha', actionId, 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    minions: [makeMinion('protected', 'pirate_buccaneer', '0', 4)],
                    ongoingActions: [{ uid: 'entangled', defId: 'killer_plant_entangled', ownerId: '0' }],
                }),
                makeBase('base_b', [makeMinion('movable', 'ninja_acolyte', '0', 2)]),
            ],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'chacha' } });
        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, actionId);
        expect(prompt.options.some(option => option.value?.minionUid === 'protected')).toBe(false);
        expect(prompt.options.some(option => option.value?.minionUid === 'movable')).toBe(true);
    });

    it('没有己方随从可移动时仍可选择跳过后续，并保留对手随从', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('chacha', actionId, 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('enemy', 'pirate_buccaneer', '1', 4)]), makeBase('base_b', [])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'chacha' } });
        expect(played.success, played.error).toBe(true);
        const skipped = respondToPromptOption(played.finalState, option => option.value?.skip === true, '跳过可选后续');
        expect(skipped.success, skipped.error).toBe(true);
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['enemy']);
        expect(skipped.finalState.core.players['0'].discard.some(card => card.uid === 'chacha')).toBe(true);
        expect(skipped.finalState.core.players['0'].actionLimit).toBe(1);
        expect(skipped.finalState.sys.interaction?.current).toBeUndefined();
    });

    it.each(['deckTop', 'extraAction', 'skip'])('移动己方随从后选择 %s 并结算牌区与额度', mode => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('chacha', actionId, 'action', '0')],
                    deck: [makeCard('existing-top', 'pirate_first_mate', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('own', 'pirate_first_mate', '0', 2), makeMinion('enemy', 'pirate_buccaneer', '1', 4)]),
                makeBase('base_b', []),
            ],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'chacha' } });
        expect(played.success, played.error).toBe(true);
        const choice = getSimpleChoicePrompt(played.finalState, actionId);
        expect(choice.options.some(option => option.value?.minionUid === 'own')).toBe(true);
        expect(choice.options.some(option => option.value?.minionUid === 'enemy')).toBe(false);
        const selected = respondToPromptOption(played.finalState, option => option.value?.minionUid === 'own', '选择己方随从');
        expect(selected.success, selected.error).toBe(true);
        const moved = respondToPromptOption(selected.finalState, option => option.value?.baseIndex === 1, '选择另一基地');
        expect(moved.success, moved.error).toBe(true);
        expect(moved.finalState.core.bases[0].minions.some(minion => minion.uid === 'own')).toBe(false);
        expect(moved.finalState.core.bases[1].minions.some(minion => minion.uid === 'own')).toBe(true);
        if (mode === 'skip') {
            const actions = buildSmashUpAiLegalActions({ playerId: '0', state: moved.finalState });
            const skipAction = actions.find(action =>
                action.kind === 'interaction-choice'
                && (action.commands[0] as { payload?: { optionId?: string } })?.payload?.optionId === 'skip',
            );
            expect(skipAction).toBeDefined();
            expect(buildSmashUpAiLegalActions({ playerId: '1', state: moved.finalState })).toEqual([]);
            const aiSkipped = runCommand(moved.finalState, { ...skipAction!.commands[0], playerId: '0' } as any);
            expect(aiSkipped.success, aiSkipped.error).toBe(true);
            expect(aiSkipped.finalState.sys.interaction?.current).toBeUndefined();
            expect(aiSkipped.finalState.core.players['0'].discard.some(card => card.uid === 'chacha')).toBe(true);
        }
        const resolved = respondToPromptOption(moved.finalState, option => mode === 'skip' ? option.value?.skip === true : option.value?.mode === mode, '选择后续效果或跳过');
        expect(resolved.success, resolved.error).toBe(true);
        const player = resolved.finalState.core.players['0'];
        expect(player.deck.some(card => card.uid === 'chacha')).toBe(mode === 'deckTop');
        expect(player.deck[0]?.uid).toBe(mode === 'deckTop' ? 'chacha' : 'existing-top');
        expect(player.discard.some(card => card.uid === 'chacha')).toBe(mode !== 'deckTop');
        expect(player.actionLimit).toBe(mode === 'extraAction' ? 2 : 1);
        expect(resolved.finalState.sys.interaction?.current).toBeUndefined();
    });
});
