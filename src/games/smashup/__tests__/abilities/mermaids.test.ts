import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { reduce } from '../../domain/reduce';
import { validate } from '../../domain/commands';
import { getCardDef } from '../../data/cards';
import {
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    getSimpleChoicePrompt,
    getPromptOption,
    getPromptOptions,
    getReactionPrompt,
    respondToPrompt,
    expectNoPrompt,
} from '../helpers';
import { runCommand, defaultTestRandom } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('Mermaids abilities', () => {
    it('mermaids_charmer 可先移动自己，再把另一个玩家力量 3 或以下的随从移到这里', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('charmer-1', 'mermaids_charmer', '0', 3, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
                {
                    defId: 'base_c',
                    minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'charmer-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const movePrompt = getSimpleChoicePrompt(used.finalState, 'mermaids_charmer_move');
        const moveOption = getPromptOption(movePrompt, entry => entry.value?.baseIndex === 1, 'destination base');

        const afterMoveChoice = respondToPrompt(used.finalState, moveOption.id, '0', defaultTestRandom);
        const targetPrompt = getSimpleChoicePrompt(afterMoveChoice.finalState, 'mermaids_charmer_target');
        const targetOption = getPromptOption(targetPrompt, entry => entry.value?.minionUid === 'enemy-1', 'target minion');

        const resolved = respondToPrompt(afterMoveChoice.finalState, targetOption.id, '0', defaultTestRandom);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'charmer-1')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-1')).toBe(true);
    });

    it('mermaids_charmed 移动目标后应把压制 metadata 写到新基地上的目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('charmed-1', 'mermaids_charmed', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-1', 'robot_microbot_guard', '1', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'charmed-1' } as any },
            defaultTestRandom,
        );

        const targetPrompt = getSimpleChoicePrompt(played.finalState, 'mermaids_charmed');
        const targetOption = getPromptOption(targetPrompt, entry => entry.value?.minionUid === 'enemy-1', 'charmed target');

        const afterTarget = respondToPrompt(played.finalState, targetOption.id, '0', defaultTestRandom);
        const destinationPrompt = getSimpleChoicePrompt(afterTarget.finalState, 'mermaids_charmed_destination');
        const baseA = getPromptOption(destinationPrompt, entry => entry.value?.baseIndex === 0, 'destination base');

        const resolved = respondToPrompt(afterTarget.finalState, baseA.id, '0', defaultTestRandom);

        const movedTarget = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-1');
        expect(movedTarget).toBeDefined();
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
        expect(movedTarget?.metadata?.mermaidsCharmedSuppressedTurn).toBe(resolved.finalState.core.turnNumber);
    });

    it('mermaids_ultimate_song 会强制对手额外打出小随从，并跳过其 onPlay，然后给予施放者额外随从和额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('song-1', 'mermaids_ultimate_song', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('forced-1', 'cowboys_gunfighter', 'minion', '1')],
                }),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('other-1', 'robot_microbot_beta', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'song-1' } },
            defaultTestRandom,
        );
        const basePrompt = getSimpleChoicePrompt(played.finalState, 'mermaids_ultimate_song_base');
        expect(getPromptOptions(basePrompt).some(entry => entry.value?.baseIndex === 1)).toBe(false);
        const baseOption = getPromptOption(basePrompt, entry => entry.value?.baseIndex === 0, 'eligible base');

        const afterBase = respondToPrompt(played.finalState, baseOption.id, '0', defaultTestRandom);
        const handPrompt = getSimpleChoicePrompt(afterBase.finalState, 'mermaids_ultimate_song_hand');
        const handOption = getPromptOption(handPrompt, entry => entry.value?.cardUid === 'forced-1', 'forced minion');

        const resolved = respondToPrompt(afterBase.finalState, handOption.id, '1', defaultTestRandom);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'forced-1')).toBe(true);
        expectNoPrompt(resolved.finalState);
        expect(resolved.finalState.core.players['0'].minionLimit).toBeGreaterThanOrEqual(2);
        expect(resolved.finalState.core.players['0'].actionLimit).toBeGreaterThanOrEqual(2);
    });

    it('mermaids_mermaid_queen 可选择直到回合结束获得这里一个小随从的控制权，并在回合结束恢复', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('queen-1', 'mermaids_mermaid_queen', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('enemy-small', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-other', 'robot_microbot_beta', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'queen-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const modePrompt = getSimpleChoicePrompt(played.finalState, 'mermaids_mermaid_queen_mode');
        const controlMode = getPromptOption(modePrompt, entry => entry.value?.mode === 'control', 'control mode');

        const afterMode = respondToPrompt(played.finalState, controlMode.id, '0', defaultTestRandom);
        const controlPrompt = getSimpleChoicePrompt(afterMode.finalState, 'mermaids_mermaid_queen_control');
        const controlOption = getPromptOption(controlPrompt, entry => entry.value?.minionUid === 'enemy-small', 'control target');

        const resolved = respondToPrompt(afterMode.finalState, controlOption.id, '0', defaultTestRandom);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-small')?.controller).toBe('0');

        const afterTurnEnded = reduce(resolved.finalState.core, {
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '0', nextPlayerIndex: 1 },
            timestamp: 3701,
        } as any);
        expect(afterTurnEnded.bases[0].minions.find(minion => minion.uid === 'enemy-small')?.controller).toBe('1');
    });

    it('mermaids_mermaid_queen 控制一个已被借用的目标直到回合结束后，应恢复给夺控前的控制者而不是真实 owner', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('queen-1', 'mermaids_mermaid_queen', 'minion', '0')] }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('borrowed-small', 'robot_microbot_alpha', '1', 1, { owner: '2', powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-other', 'robot_microbot_beta', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'queen-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const modePrompt = getSimpleChoicePrompt(played.finalState, 'mermaids_mermaid_queen_mode');
        const controlMode = getPromptOption(modePrompt, entry => entry.value?.mode === 'control', 'control mode');

        const afterMode = respondToPrompt(played.finalState, controlMode.id, '0', defaultTestRandom);
        const controlPrompt = getSimpleChoicePrompt(afterMode.finalState, 'mermaids_mermaid_queen_control');
        const controlOption = getPromptOption(
            controlPrompt,
            entry => entry.value?.minionUid === 'borrowed-small',
            'borrowed control target',
        );

        const resolved = respondToPrompt(afterMode.finalState, controlOption.id, '0', defaultTestRandom);
        const controlled = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'borrowed-small');
        expect(controlled?.controller).toBe('0');
        expect(controlled?.owner).toBe('2');

        const afterTurnEnded = reduce(resolved.finalState.core, {
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '0', nextPlayerIndex: 1 },
            timestamp: 3702,
        } as any);
        const restored = afterTurnEnded.bases[0].minions.find(minion => minion.uid === 'borrowed-small');
        expect(restored?.controller).toBe('1');
        expect(restored?.owner).toBe('2');
    });

    it('mermaids_mermaid_queen 也可选择把其他玩家的一个仆从移到这里', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('queen-1', 'mermaids_mermaid_queen', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('enemy-small', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-other', 'robot_microbot_beta', '1', 4, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'queen-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const modePrompt = getSimpleChoicePrompt(played.finalState, 'mermaids_mermaid_queen_mode');
        const moveMode = getPromptOption(modePrompt, entry => entry.value?.mode === 'move', 'move mode');

        const afterMode = respondToPrompt(played.finalState, moveMode.id, '0', defaultTestRandom);
        const movePrompt = getSimpleChoicePrompt(afterMode.finalState, 'mermaids_mermaid_queen_move');
        const moveOption = getPromptOption(movePrompt, entry => entry.value?.minionUid === 'enemy-other', 'move target');
        expect(getPromptOptions(movePrompt).some(entry => entry.value?.minionUid === 'enemy-small')).toBe(false);

        const resolved = respondToPrompt(afterMode.finalState, moveOption.id, '0', defaultTestRandom);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-other')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-other')).toBe(false);
    });

    it('mermaids_captive_audience 会按目标基地不属于你的随从数量给你的随从加力量并额外打行动', () => {
        expect(getCardDef('mermaids_captive_audience')?.playNeedsBase).toBe(true);

        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('capt-1', 'mermaids_captive_audience', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 }),
                        makeMinion('enemy-2', 'robot_microbot_beta', '1', 2, { powerModifier: 0 }),
                        makeMinion('ally-1', 'robot_microbot_gamma', '0', 3, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('ally-2', 'robot_microbot_alpha', '0', 4, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'capt-1', targetBaseIndex: 0, targetType: 'base' } as any },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'mermaids_captive_audience');
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'ally-1', 'buff target');
        expect(getPromptOptions(prompt).some(entry => entry.value?.minionUid === 'ally-2')).toBe(false);

        const resolved = respondToPrompt(played.finalState, option.id, '0', defaultTestRandom);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1')?.tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'ally-2')?.tempPowerModifier ?? 0).toBe(0);
        expect(resolved.finalState.core.players['0'].actionLimit).toBeGreaterThanOrEqual(2);
    });

    it('mermaids_becalmed_shores 天赋会把这张持续行动移到另一个基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'becalm-1', defId: 'mermaids_becalmed_shores', ownerId: '0', talentUsed: false } as any],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { ongoingCardUid: 'becalm-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(used.finalState, 'mermaids_becalmed_shores');
        const option = getPromptOption(prompt, entry => entry.value?.baseIndex === 1, 'destination base');

        const resolved = respondToPrompt(used.finalState, option.id, '0', defaultTestRandom);
        expect(resolved.finalState.core.bases[0].ongoingActions.some(action => action.uid === 'becalm-1')).toBe(false);
        expect(resolved.finalState.core.bases[1].ongoingActions.some(action => action.uid === 'becalm-1')).toBe(true);
        expect(resolved.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'becalm-1')?.talentUsed).toBe(true);

        const reused = validate(resolved.finalState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'becalm-1', baseIndex: 1 },
        });
        expect(reused.valid).toBe(false);
        expect(reused.error).toBe('本回合天赋已使用');
    });

    it('borrowed mermaids_becalmed_shores 使用天赋移动到其他基地时，仍应保留真实 ownerId 与真正移动玩家的 sourcePlayerId', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{
                        uid: 'becalm-borrowed-1',
                        defId: 'mermaids_becalmed_shores',
                        ownerId: '1',
                        talentUsed: false,
                        metadata: { sourceControllerId: '0' },
                    } as any],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { ongoingCardUid: 'becalm-borrowed-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(used.finalState, 'mermaids_becalmed_shores');
        const option = getPromptOption(prompt, entry => entry.value?.baseIndex === 1, 'destination base');

        const resolved = respondToPrompt(used.finalState, option.id, '0', defaultTestRandom);
        const attachedEvent = resolved.events.find(event => event.type === SU_EVENTS.ONGOING_ATTACHED) as any;
        expect(attachedEvent?.payload?.ownerId).toBe('1');
        expect(attachedEvent?.payload?.sourcePlayerId).toBe('0');

        const moved = resolved.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'becalm-borrowed-1');
        expect(moved?.ownerId).toBe('1');
        expect(moved?.talentUsed).toBe(true);
        expect(moved?.metadata?.sourceControllerId).toBe('0');
    });

    it('mermaids_siren_song 会把每位其他玩家各一个随从移动到同一个你有随从的基地', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            players: {
                '0': makePlayer('0', { hand: [makeCard('song-1', 'mermaids_siren_song', 'action', '0')] }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 }),
                        makeMinion('enemy-2', 'robot_microbot_beta', '2', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('ally-1', 'robot_microbot_gamma', '0', 3, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'song-1' } },
            defaultTestRandom,
        );
        const sourcePrompt = getSimpleChoicePrompt(played.finalState, 'mermaids_siren_song_base');
        const sourceOption = getPromptOption(sourcePrompt, entry => entry.value?.baseIndex === 0, 'source base');

        const afterSource = respondToPrompt(played.finalState, sourceOption.id, '0', defaultTestRandom);
        const destinationPrompt = getSimpleChoicePrompt(afterSource.finalState, 'mermaids_siren_song_destination');
        const destinationOption = getPromptOption(destinationPrompt, entry => entry.value?.baseIndex === 1, 'destination base');

        const afterDestination = respondToPrompt(afterSource.finalState, destinationOption.id, '0', defaultTestRandom);
        const firstTargetPrompt = getSimpleChoicePrompt(afterDestination.finalState, 'mermaids_siren_song_target');
        const firstTargetOption = getPromptOption(firstTargetPrompt, entry => entry.value?.minionUid === 'enemy-1', 'first target');

        const afterFirstTarget = respondToPrompt(afterDestination.finalState, firstTargetOption.id, '0', defaultTestRandom);
        const secondTargetPrompt = getSimpleChoicePrompt(afterFirstTarget.finalState, 'mermaids_siren_song_target');
        const secondTargetOption = getPromptOption(secondTargetPrompt, entry => entry.value?.minionUid === 'enemy-2', 'second target');

        const resolved = respondToPrompt(afterFirstTarget.finalState, secondTargetOption.id, '0', defaultTestRandom);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-1')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-2')).toBe(true);
    });

    it('mermaids_siren_song 不应把没有其他己方基地可去的来源基地放进候选', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', { hand: [makeCard('song-1', 'mermaids_siren_song', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-anchor', 'robot_microbot_gamma', '0', 3, { powerModifier: 0 }),
                        makeMinion('enemy-stuck', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-movable', 'robot_microbot_beta', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'song-1' } },
            defaultTestRandom,
        );
        const sourcePrompt = getSimpleChoicePrompt(played.finalState, 'mermaids_siren_song_base');
        expect(getPromptOptions(sourcePrompt).some(entry => entry.value?.baseIndex === 0)).toBe(false);
        const sourceOption = getPromptOption(sourcePrompt, entry => entry.value?.baseIndex === 1, 'eligible source base');

        const afterSource = respondToPrompt(played.finalState, sourceOption.id, '0', defaultTestRandom);
        const destinationPrompt = getSimpleChoicePrompt(afterSource.finalState, 'mermaids_siren_song_destination');
        const destinationOption = getPromptOption(destinationPrompt, entry => entry.value?.baseIndex === 0, 'destination base');

        const afterDestination = respondToPrompt(afterSource.finalState, destinationOption.id, '0', defaultTestRandom);
        const targetPrompt = getSimpleChoicePrompt(afterDestination.finalState, 'mermaids_siren_song_target');
        getPromptOption(targetPrompt, entry => entry.value?.minionUid === 'enemy-movable', 'movable target');
    });

    it('mermaids_toll_bay 按目标基地其他玩家的仆从数量抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('toll-1', 'mermaids_toll_bay', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('draw-3', 'robot_microbot_gamma', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 }),
                    makeMinion('enemy-2', 'robot_microbot_beta', '1', 2, { powerModifier: 0 }),
                    makeMinion('ally-1', 'robot_microbot_gamma', '0', 3, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'toll-1', targetBaseIndex: 0, targetType: 'base' } as any },
            defaultTestRandom,
        );

        const drawEvent = played.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload?.count).toBe(2);
        expect(played.finalState.core.players['0'].hand.some(card => card.uid === 'draw-1')).toBe(true);
        expect(played.finalState.core.players['0'].hand.some(card => card.uid === 'draw-2')).toBe(true);
        expect(played.finalState.core.players['0'].deck.some(card => card.uid === 'draw-1')).toBe(false);
        expect(played.finalState.core.players['0'].deck.some(card => card.uid === 'draw-2')).toBe(false);
    });

    it('mermaids_shipwreck_cove 在计分后可把这张持续行动移到另一个基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ship-1', 'mermaids_shipwreck_cove', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'ship-1', targetBaseIndex: 0, targetType: 'base' } as any },
            defaultTestRandom,
        );
        const sourceCardUid = played.finalState.core.bases[0].ongoingActions.find(action => action.defId === 'mermaids_shipwreck_cove')?.uid;

        const triggered = fireTriggers(played.finalState.core, 'afterScoring', {
            state: played.finalState.core,
            matchState: played.finalState,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 0, vp: 0 }],
            sourceCardUid,
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 3801,
        });
        const promptState = triggered.matchState ?? played.finalState;
        const prompt = getSimpleChoicePrompt(promptState, 'mermaids_shipwreck_cove_after_scoring');
        expect(prompt.targetType).toBe('field-source-target');
        const option = getPromptOption(prompt, entry => entry.value?.baseIndex === 1, 'destination base');
        expect(option.value).toMatchObject({
            fieldInteractionType: 'source-target',
            fieldSourceType: 'ongoing',
            fieldTargetType: 'base',
            sourceUid: sourceCardUid,
            cardUid: sourceCardUid,
            ongoingUid: sourceCardUid,
            sourceBaseIndex: 0,
            targetBaseIndex: 1,
            baseIndex: 1,
        });

        const resolved = respondToPrompt(promptState, option.id, '0', defaultTestRandom);
        expect(resolved.finalState.core.bases[0].ongoingActions.some(action => action.uid === sourceCardUid)).toBe(false);
        expect(resolved.finalState.core.bases[1].ongoingActions.some(action => action.uid === sourceCardUid)).toBe(true);
    });

    it('mermaids_shipwreck_cove 在对手计分时仍应把 queued afterScoring 选择权交给持续行动控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'ship-1', defId: 'mermaids_shipwreck_cove', ownerId: '1' } as any],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 0, vp: 0 }],
            random: defaultTestRandom,
            now: 3902,
        });

        expect(queued).toBeDefined();
        const shipTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'ship-1');
        expect(shipTrigger).toBeDefined();
        expect(shipTrigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            3902,
        );
        expect(queuedState).toBeDefined();
        const reactionPrompt = getReactionPrompt(queuedState!.state);
        expect(reactionPrompt?.playerId).toBe('1');
    });
});
