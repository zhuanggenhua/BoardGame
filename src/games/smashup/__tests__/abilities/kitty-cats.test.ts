import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearRegistry, resolveSpecial } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { reduce } from '../../domain/reduce';
import { startSmashUpReactionSession } from '../../domain/reactionSession';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    resolveDestroyedMinions,
    respondToPrompt,
    respondToPromptOptions,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

function attachBeforeScoringReactionSession(
    matchState: ReturnType<typeof makeMatchState>,
    sourceBaseIndex: number,
): ReturnType<typeof makeMatchState> {
    matchState.sys.phase = 'scoreBases';
    return startSmashUpReactionSession(matchState, {
        frameId: `score-before:${sourceBaseIndex}:kitty-cats-test`,
        frameKind: 'score-before',
        phase: 'optional',
        activePlayerId: '0',
        currentPlayerId: '0',
        consecutivePasses: 0,
        sourceBaseIndex,
        responseWindowType: 'meFirst',
    });
}

describe('Kitty Cats abilities', () => {
    it('kitty_cats_mr_grumpers 打出后选择任意随从并给到回合临时 -2 力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('grumpers-1', 'kitty_cats_mr_grumpers', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 3)],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'grumpers-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(played.success, played.error).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'kitty_cats_mr_grumpers');
        const target = getPromptOption(prompt, option => option.value?.minionUid === 'enemy-1', 'enemy minion');
        const resolved = respondToPrompt(played.finalState, target.id, '0', defaultTestRandom);

        const enemy = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-1');
        expect(enemy).toBeDefined();
        expect(getEffectivePower(resolved.finalState.core, enemy!, 0)).toBe(1);
    });

    it('kitty_cats_cat_fight 会按所选己方随从有效力量抽牌并消灭它', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fight-1', 'kitty_cats_cat_fight', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('draw-3', 'wizard_summon', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 3)],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'fight-1' } },
            defaultTestRandom,
        );
        expect(played.success, played.error).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'kitty_cats_cat_fight');
        const target = getPromptOption(prompt, option => option.value?.minionUid === 'ally-1', 'own minion');
        const resolved = respondToPrompt(played.finalState, target.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('ally-1');
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2', 'draw-3']);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('kitty_cats_muffin 临时夺取力量 5 或以下对手随从，并在该玩家回合结束还原控制权', () => {
        const core = makeState({
            turnNumber: 7,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('muffin-1', 'kitty_cats_muffin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('enemy-small', 'pirate_first_mate', '1', 5),
                    makeMinion('enemy-big', 'dino_king_rex', '1', 7),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'muffin-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(played.success, played.error).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'kitty_cats_muffin');
        getPromptOption(prompt, option => option.value?.minionUid === 'enemy-small', 'eligible minion');
        expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-big')).toBe(false);

        const controlled = respondToPrompt(
            played.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'enemy-small').id,
            '0',
            defaultTestRandom,
        );
        expect(controlled.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-small')?.controller).toBe('0');

        const restored = reduce(controlled.finalState.core, {
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '0', nextPlayerIndex: 1 },
            timestamp: 2000,
        } as any);
        expect(restored.bases[0].minions.find(minion => minion.uid === 'enemy-small')?.controller).toBe('1');
    });

    it('kitty_cats_cats_paw 不会把受行动保护的对手随从放进可选目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('paw-1', 'kitty_cats_cats_paw', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('enemy-protected', 'pirate_first_mate', '1', 4)],
                    ongoingActions: [{ uid: 'wild-1', defId: 'dino_wildlife_preserve', ownerId: '1' }],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-open', 'pirate_first_mate', '1', 4)],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'paw-1' } },
            defaultTestRandom,
        );
        expect(played.success, played.error).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'kitty_cats_cats_paw');
        expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-protected')).toBe(false);
        expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-open')).toBe(true);
    });

    it('kitty_cats_nine_lives 消灭己方随从后授予额外行动额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('nine-1', 'kitty_cats_nine_lives', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 3)],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'nine-1' } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'kitty_cats_nine_lives');
        const target = getPromptOption(prompt, option => option.value?.minionUid === 'ally-1', 'own minion');
        const resolved = respondToPrompt(played.finalState, target.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('ally-1');
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
    });

    it('kitty_cats_whiskers 天赋先授予额外行动，再消灭一个己方随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('whiskers-1', 'kitty_cats_whiskers', '0', 4),
                    makeMinion('ally-1', 'pirate_first_mate', '0', 3),
                    makeMinion('enemy-1', 'robot_microbot_beta', '1', 2),
                ],
                ongoingActions: [],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'whiskers-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(used.success, used.error).toBe(true);
        expect(used.finalState.core.players['0'].actionLimit).toBe(2);

        const prompt = getSimpleChoicePrompt(used.finalState, 'kitty_cats_whiskers');
        expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-1')).toBe(false);
        const target = getPromptOption(prompt, option => option.value?.minionUid === 'ally-1', 'own minion');
        const resolved = respondToPrompt(used.finalState, target.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('ally-1');
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                sourceDefId: 'kitty_cats_whiskers',
                reason: 'kitty_cats_whiskers',
                sourceKind: 'nonAction',
            }),
        }));
    });

    it('kitty_cats_queen_fluffy 天赋临时控制力量 3 或以下随从', () => {
        const core = makeState({
            turnNumber: 3,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('queen-1', 'kitty_cats_queen_fluffy', '0', 5),
                    makeMinion('enemy-small', 'pirate_first_mate', '1', 3),
                    makeMinion('enemy-big', 'dino_king_rex', '1', 7),
                ],
                ongoingActions: [],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'queen-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(used.success, used.error).toBe(true);

        const prompt = getSimpleChoicePrompt(used.finalState, 'kitty_cats_queen_fluffy');
        getPromptOption(prompt, option => option.value?.minionUid === 'enemy-small', 'eligible minion');
        expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-big')).toBe(false);
        const resolved = respondToPrompt(
            used.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'enemy-small').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-small')?.controller).toBe('0');
    });

    it('kitty_cats_can_has_cheeseburger 在计分前只临时控制该基地力量 5 或以下随从', () => {
        const special = resolveSpecial('kitty_cats_can_has_cheeseburger');
        expect(special).toBeDefined();
        const core = makeState({
            turnNumber: 6,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('enemy-small', 'pirate_first_mate', '1', 5),
                        makeMinion('enemy-big', 'dino_king_rex', '1', 7),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('other-base', 'pirate_first_mate', '1', 5)],
                    ongoingActions: [],
                },
            ],
        });

        const result = special!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'cheese-1',
            defId: 'kitty_cats_can_has_cheeseburger',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 1000,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'kitty_cats_can_has_cheeseburger');
        getPromptOption(prompt, option => option.value?.minionUid === 'enemy-small', 'eligible scoring-base minion');
        expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-big')).toBe(false);
        expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'other-base')).toBe(false);

        const resolved = respondToPrompt(
            result.matchState!,
            getPromptOption(prompt, option => option.value?.minionUid === 'enemy-small').id,
            '0',
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-small')?.controller).toBe('0');
    });

    it('kitty_cats_can_has_cheeseburger 可在 Me First 计分前窗口从手牌打出并进入选择流程', () => {
        const core = makeState({
            scoringEligibleBaseIndices: [0],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cheese-1', 'kitty_cats_can_has_cheeseburger', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-small', 'pirate_first_mate', '1', 5)],
                ongoingActions: [],
            }],
        });
        const matchState = attachBeforeScoringReactionSession(makeMatchState(core), 0);

        const played = runCommand(
            matchState,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'cheese-1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );

        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'kitty_cats_can_has_cheeseburger');
        expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-small')).toBe(true);
        expect(played.finalState.core.specialLimitUsed?.kitty_cats_can_has_cheeseburger).toContain(0);
    });

    it('kitty_cats_invisible_bicycle 会多选同基地力量 2 或以下随从并移动到目标基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bike-1', 'kitty_cats_invisible_bicycle', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('small-1', 'robot_microbot_alpha', '0', 1),
                        makeMinion('small-2', 'robot_microbot_beta', '1', 2),
                        makeMinion('large-1', 'dino_king_rex', '1', 7),
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'bike-1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );
        const minionPrompt = getSimpleChoicePrompt(played.finalState, 'kitty_cats_invisible_bicycle_minions');
        const small1 = getPromptOption(minionPrompt, option => option.value?.minionUid === 'small-1', 'small minion 1');
        const small2 = getPromptOption(minionPrompt, option => option.value?.minionUid === 'small-2', 'small minion 2');
        expect(getPromptOptions(minionPrompt).some((option: any) => option.value?.minionUid === 'large-1')).toBe(false);

        const choseMinions = respondToPromptOptions(played.finalState, [small1.id, small2.id], '0', defaultTestRandom);
        const basePrompt = getSimpleChoicePrompt(choseMinions.finalState, 'kitty_cats_invisible_bicycle_base');
        const targetBase = getPromptOption(basePrompt, option => option.value?.baseIndex === 1, 'target base');
        const resolved = respondToPrompt(choseMinions.finalState, targetBase.id, '0', defaultTestRandom);

        expectNoPrompt(resolved.finalState);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['large-1']);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(expect.arrayContaining(['small-1', 'small-2']));
    });

    it('kitty_cats_hang_in_there 会在己方随从将被消灭时改为移动并弃掉本行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('victim-1', 'robot_microbot_alpha', '0', 2, {
                            attachedActions: [
                                { uid: 'hang-1', defId: 'kitty_cats_hang_in_there', ownerId: '0' },
                            ],
                        }),
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_b', minions: [], ongoingActions: [] },
                { defId: 'base_c', minions: [], ongoingActions: [] },
            ],
        });

        const intercepted = resolveDestroyedMinions(
            makeMatchState(core),
            '1',
            [{ minionUid: 'victim-1', minionDefId: 'robot_microbot_alpha', fromBaseIndex: 0, ownerId: '0', destroyerId: '1' }],
        );
        expect(intercepted.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const prompt = getSimpleChoicePrompt(intercepted.matchState!, 'kitty_cats_hang_in_there');
        const targetBase = getPromptOption(prompt, option => option.value?.baseIndex === 1, 'destination base');
        const resolved = respondToPrompt(intercepted.matchState!, targetBase.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['victim-1']);
        expect(resolved.finalState.core.bases[1].minions[0]?.attachedActions.map(action => action.uid)).toEqual([]);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('hang-1');
    });

    it('kitty_cats_muffin_pod 只临时夺取力量 3 或以下对手随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('muffin-pod-1', 'kitty_cats_muffin_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('enemy-small', 'pirate_first_mate', '1', 3),
                    makeMinion('enemy-big', 'dino_king_rex', '1', 7),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'muffin-pod-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'kitty_cats_muffin_pod');
        expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-small')).toBe(true);
        expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-big')).toBe(false);
    });

    it('kitty_cats_nine_lives_pod 消灭己方随从后授予额外随从额度而不是额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('nine-pod-1', 'kitty_cats_nine_lives_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('victim-1', 'robot_microbot_alpha', '0', 2)],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'nine-pod-1' } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'kitty_cats_nine_lives_pod');
        const victim = getPromptOption(prompt, option => option.value?.minionUid === 'victim-1', 'own minion');
        const resolved = respondToPrompt(played.finalState, victim.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('victim-1');
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(1);
    });

    it('kitty_cats_whiskers_pod 授予额外行动并消灭所选己方随从，不给 +1 力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('whiskers-pod-1', 'kitty_cats_whiskers_pod', '0', 4),
                    makeMinion('victim-1', 'robot_microbot_alpha', '0', 2),
                ],
                ongoingActions: [],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'whiskers-pod-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(used.finalState, 'kitty_cats_whiskers_pod');
        const victim = getPromptOption(prompt, option => option.value?.minionUid === 'victim-1', 'own minion');
        const resolved = respondToPrompt(used.finalState, victim.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('victim-1');
        const whiskers = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'whiskers-pod-1')!;
        expect(getEffectivePower(resolved.finalState.core, whiskers, 0)).toBe(4);
    });

    it('kitty_cats_can_has_cheeseburger_pod 计分前只临时控制该基地力量 3 或以下随从', () => {
        const special = resolveSpecial('kitty_cats_can_has_cheeseburger_pod');
        expect(special).toBeDefined();

        const core = makeState({
            scoringEligibleBaseIndices: [0],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cheese-pod-1', 'kitty_cats_can_has_cheeseburger_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('enemy-small', 'pirate_first_mate', '1', 3),
                    makeMinion('enemy-big', 'dino_king_rex', '1', 7),
                ],
                ongoingActions: [],
            }],
        });
        const matchState = attachBeforeScoringReactionSession(makeMatchState(core), 0);

        const result = special!({
            playerId: '0',
            state: core,
            matchState,
            random: defaultTestRandom,
            now: 1000,
            cardUid: 'cheese-pod-1',
            defId: 'kitty_cats_can_has_cheeseburger_pod',
            baseIndex: 0,
            targetBaseIndex: 0,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'kitty_cats_can_has_cheeseburger_pod');
        expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-small')).toBe(true);
        expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-big')).toBe(false);
    });
});
