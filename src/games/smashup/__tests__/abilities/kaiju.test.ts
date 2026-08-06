import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { triggerBaseAbility } from '../../domain/baseAbilities';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import { getEffectiveBreakpoint, getEffectivePower, getPlayerEffectivePowerOnBase } from '../../domain/ongoingModifiers';
import { reduce } from '../../domain/reduce';
import { filterProtectedDestroyEvents } from '../../domain/reducer';
import { SU_COMMANDS, SU_EVENTS, type TitanState } from '../../domain/types';
import {
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    respondToPromptOptions,
    resolveInteractionChain,
} from '../helpers';
import { runCommand } from '../testRunner';

const FIXED_RANDOM = { random: () => 0 };

function makeGorgodzolla(location: TitanState['location']): TitanState {
    return {
        uid: 'gorgodzolla',
        defId: 'kaiju_gorgodzolla',
        faction: SMASHUP_FACTION_IDS.KAIJU,
        ownerId: '0',
        controllerId: '0',
        powerCounters: 0,
        talentUsed: false,
        location,
    };
}

describe('Kaiju 代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('Kaiju Conflict 给予两个额外行动额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('conflict', 'kaiju_kaiju_conflict', 'action', '0')] }),
                '1': makePlayer('1'),
            },
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'conflict' },
            timestamp: 10,
        }, FIXED_RANDOM);

        expect(play.success).toBe(true);
        expect(play.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(2);
        expect(play.finalState.core.players['0'].actionLimit).toBe(3);
    });

    it('Kaiju Alliance 会让所有当前基地临界点本回合 -4', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('alliance', 'kaiju_kaiju_alliance', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tokyo'), makeBase('base_itty_city')],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'alliance' },
            timestamp: 15,
        }, FIXED_RANDOM);

        expect(play.finalState.core.tempBreakpointModifiers).toEqual({ 0: -4, 1: -4 });
        expect(getEffectiveBreakpoint(play.finalState.core, 0)).toBe(21);
        expect(getEffectiveBreakpoint(play.finalState.core, 1)).toBe(16);
    });

    it('Stomp 降低目标基地临界点，持续给拥有者在该基地 +2 总力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('stomp', 'kaiju_stomp', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_kaiju_island', [makeMinion('kaijookey', 'kaiju_kaijookey', '0', 4)])],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'stomp', targetBaseIndex: 0 },
            timestamp: 20,
        }, FIXED_RANDOM);

        expect(play.success).toBe(true);
        expect(play.finalState.core.tempBreakpointModifiers?.[0]).toBe(-3);
        expect(getEffectiveBreakpoint(play.finalState.core, 0)).toBe(19);
        expect(play.finalState.core.bases[0].ongoingActions.map(action => action.defId)).toContain('kaiju_stomp');
        expect(getPlayerEffectivePowerOnBase(play.finalState.core, play.finalState.core.bases[0], 0, '0')).toBe(7);
    });

    it('Kaijookey 按本基地己方行动牌数量获得持续力量', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_tokyo',
                    ongoingActions: [
                        { uid: 'stomp', defId: 'kaiju_stomp', ownerId: '0' },
                        { uid: 'enemy-action', defId: 'kaiju_tail_smash', ownerId: '1' },
                    ],
                    minions: [
                        makeMinion('kaijookey', 'kaiju_kaijookey', '0', 4, {
                            attachedActions: [{ uid: 'attached', defId: 'kaiju_oh_no', ownerId: '0' }],
                        }),
                    ],
                }),
            ],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(6);
    });

    it('Tokyo 在行动牌打到这里后给该玩家本基地 +3 总力量直到下回合开始', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tokyo', [makeMinion('ally', 'kaiju_kaijookey', '0', 4)])],
            turnNumber: 7,
        });

        const result = triggerBaseAbility('base_tokyo', 'onActionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_tokyo',
            playerId: '0',
            actionTargetBaseIndex: 0,
            actionTargetType: 'base',
            now: 70,
        });
        const event = result.events.find(candidate => candidate.type === SU_EVENTS.TEMP_BASE_POWER_MODIFIED);
        const boosted = event ? reduce(core, event) : core;

        expect(event).toBeDefined();
        expect(boosted.tempBasePowerModifiers).toEqual({ 0: { '0': 3 } });
        expect(getPlayerEffectivePowerOnBase(boosted, boosted.bases[0], 0, '0')).toBe(7);

        const nextTurn = reduce(boosted, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 8 },
            timestamp: 80,
        } as any);
        expect(nextTurn.tempBasePowerModifiers).toBeUndefined();
        expect(getPlayerEffectivePowerOnBase(nextTurn, nextTurn.bases[0], 0, '0')).toBe(4);
    });

    it('The Folly of Men 阻止其他玩家跨派系行动摧毁己方随从，但不阻止非行动摧毁', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_tokyo',
                    ongoingActions: [{ uid: 'folly', defId: 'kaiju_the_folly_of_men', ownerId: '0' }],
                    minions: [makeMinion('protected', 'kaiju_kaijookey', '0', 4)],
                }),
            ],
        });
        const actionDestroy = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'protected',
                minionDefId: 'kaiju_kaijookey',
                fromBaseIndex: 0,
                ownerId: '0',
                destroyerId: '1',
                reason: 'itty_critters_super_effective',
            },
            timestamp: 90,
        } as any;
        const nonActionDestroy = {
            ...actionDestroy,
            payload: {
                ...actionDestroy.payload,
                reason: 'kaiju_gorgodzolla',
            },
            timestamp: 91,
        };

        expect(filterProtectedDestroyEvents([actionDestroy], core, '1')).toHaveLength(0);
        expect(filterProtectedDestroyEvents([nonActionDestroy], core, '1')).toEqual([nonActionDestroy]);
    });

    it('Radioactive Breath 可选消灭任意数量不由你控制的力量 2 或以下随从，并持续给你在这里 +3 总力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('breath', 'kaiju_radioactive_breath', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_itty_city', [
                makeMinion('enemy-low-1', 'itty_critters_leafaroo', '1', 2),
                makeMinion('enemy-low-2', 'itty_critters_flooffairy', '1', 2),
                makeMinion('enemy-high', 'kaiju_kaijookey', '1', 4),
                makeMinion('own-low', 'itty_critters_tadpour', '0', 2),
            ])],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'breath', targetBaseIndex: 0 },
            timestamp: 30,
        }, FIXED_RANDOM);

        const prompt = getSimpleChoicePrompt(play.finalState, 'kaiju_radioactive_breath');
        const optionIds = getPromptOptions(prompt)
            .filter(option => ['enemy-low-1', 'enemy-low-2'].includes(option.value?.minionUid))
            .map(option => option.id);
        expect(optionIds).toHaveLength(2);
        expect(play.finalState.core.bases[0].ongoingActions.map(action => action.defId)).toContain('kaiju_radioactive_breath');
        expect(getPlayerEffectivePowerOnBase(play.finalState.core, play.finalState.core.bases[0], 0, '0')).toBe(5);
        expect(getPromptOptions(prompt).some(option => option.value?.minionUid === 'enemy-high')).toBe(false);
        expect(getPromptOptions(prompt).some(option => option.value?.minionUid === 'own-low')).toBe(false);

        const destroy = respondToPromptOptions(play.finalState, optionIds, '0', FIXED_RANDOM);
        expect(destroy.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(2);
        expect(destroy.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['enemy-high', 'own-low']);
        expect(getPlayerEffectivePowerOnBase(destroy.finalState.core, destroy.finalState.core.bases[0], 0, '0')).toBe(5);
    });

    it('Tail Smash 强制消灭这里一个不由你控制的力量 3 或以下随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('tail-smash', 'kaiju_tail_smash', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tokyo', [
                makeMinion('enemy-target', 'mega_troopers_beta_6', '1', 2),
                makeMinion('enemy-high', 'kaiju_kaijookey', '1', 4),
            ])],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'tail-smash', targetBaseIndex: 0 },
            timestamp: 35,
        }, FIXED_RANDOM);

        expect(play.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(play.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['enemy-high']);
    });

    it('Wade Through the Buildings 会摧毁这里所有其他玩家行动牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('wade', 'kaiju_wade_through_the_buildings', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_tokyo',
                    ongoingActions: [
                        { uid: 'own-ongoing', defId: 'kaiju_stomp', ownerId: '0' },
                        { uid: 'enemy-ongoing', defId: 'kaiju_tail_smash', ownerId: '1' },
                    ],
                    minions: [
                        makeMinion('host', 'kaiju_kaijookey', '1', 4, {
                            attachedActions: [{ uid: 'enemy-attached', defId: 'kaiju_oh_no', ownerId: '1' }],
                        }),
                    ],
                }),
            ],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'wade', targetBaseIndex: 0 },
            timestamp: 36,
        }, FIXED_RANDOM);

        expect(play.events.filter(event => event.type === SU_EVENTS.ONGOING_DETACHED)).toHaveLength(2);
        expect(play.finalState.core.bases[0].ongoingActions.map(action => action.uid)).toEqual(['own-ongoing', 'wade']);
        expect(play.finalState.core.bases[0].minions[0].attachedActions).toEqual([]);
        expect(play.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['enemy-ongoing', 'enemy-attached']);
    });

    it('Oh, No! 可把牌库旁的 Gorgodzolla 打到目标基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('oh-no', 'kaiju_oh_no', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tokyo')],
            titans: [makeGorgodzolla({ zone: 'setaside' })],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'oh-no', targetBaseIndex: 0 },
            timestamp: 40,
        }, FIXED_RANDOM);

        expect(play.events.some(event => event.type === SU_EVENTS.TITAN_PLAYED)).toBe(true);
        expect(play.finalState.core.titans?.find(titan => titan.uid === 'gorgodzolla')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('Tiny Priestesses 可把已在场的 Gorgodzolla 移到自身基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('priestesses', 'kaiju_tiny_priestesses', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tokyo'), makeBase('base_itty_city')],
            titans: [makeGorgodzolla({ zone: 'base', baseIndex: 0, enteredAt: 1 })],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'priestesses', baseIndex: 1 },
            timestamp: 45,
        }, FIXED_RANDOM);

        expect(play.events.some(event => event.type === SU_EVENTS.TITAN_MOVED)).toBe(true);
        expect(play.finalState.core.titans?.find(titan => titan.uid === 'gorgodzolla')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('Oh, No! 与 Tiny Priestesses 在 borrowed Gorgodzolla 上仍应按当前控制者打出或移动泰坦，并保留真实 owner', () => {
        const setasideCore = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('oh-no', 'kaiju_oh_no', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tokyo')],
            titans: [{
                ...makeGorgodzolla({ zone: 'setaside' }),
                uid: 'borrowed-gorgodzolla-setaside',
                ownerId: '1',
                controllerId: '0',
            }],
        });
        const playFromSetaside = runCommand(makeMatchState(setasideCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'oh-no', targetBaseIndex: 0 },
            timestamp: 41,
        }, FIXED_RANDOM);
        expect(playFromSetaside.events.some(event => event.type === SU_EVENTS.TITAN_PLAYED)).toBe(true);
        expect(playFromSetaside.finalState.core.titans?.find(titan => titan.uid === 'borrowed-gorgodzolla-setaside')).toMatchObject({
            ownerId: '1',
            controllerId: '0',
            location: {
                zone: 'base',
                baseIndex: 0,
            },
        });

        const liveCore = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('priestesses', 'kaiju_tiny_priestesses', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tokyo'), makeBase('base_itty_city')],
            titans: [{
                ...makeGorgodzolla({ zone: 'base', baseIndex: 0, enteredAt: 1 }),
                uid: 'borrowed-gorgodzolla-live',
                ownerId: '1',
                controllerId: '0',
            }],
        });
        const moveLiveTitan = runCommand(makeMatchState(liveCore), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'priestesses', baseIndex: 1 },
            timestamp: 46,
        }, FIXED_RANDOM);
        expect(moveLiveTitan.events.some(event => event.type === SU_EVENTS.TITAN_MOVED)).toBe(true);
        expect(moveLiveTitan.finalState.core.titans?.find(titan => titan.uid === 'borrowed-gorgodzolla-live')).toMatchObject({
            ownerId: '1',
            controllerId: '0',
            location: {
                zone: 'base',
                baseIndex: 1,
            },
        });
    });

    it('Johnny 可选将己方基地行动回手，并立刻只把该行动额外打到 Johnny 所在基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('johnny', 'kaiju_johnny', 'minion', '0'),
                        makeCard('other-hand-action', 'kaiju_kaiju_alliance', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_tokyo',
                    ongoingActions: [{ uid: 'stomp-field', defId: 'kaiju_stomp', ownerId: '0' }],
                }),
                makeBase('base_kaiju_island'),
            ],
        });

        const playJohnny = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'johnny', baseIndex: 1 },
            timestamp: 51,
        }, FIXED_RANDOM);
        const johnnyPrompt = getSimpleChoicePrompt(playJohnny.finalState, 'kaiju_johnny');
        expect(johnnyPrompt.targetType).toBe('ongoing');

        const chooseAction = respondToPromptOption(
            playJohnny.finalState,
            option => option.value?.cardUid === 'stomp-field' && option.value?.fromBaseIndex === 0,
            'Johnny action option',
            '0',
            FIXED_RANDOM,
        );
        const immediatePrompt = getSimpleChoicePrompt(chooseAction.finalState, 'smashup_immediate_extra_action');
        const immediateOptions = getPromptOptions(immediatePrompt);
        expect(immediateOptions.some(option => option.value?.cardUid === 'stomp-field')).toBe(true);
        expect(immediateOptions.some(option => option.value?.cardUid === 'other-hand-action')).toBe(false);

        const replayed = resolveInteractionChain(
            chooseAction.finalState,
            prompt => {
                if (getPromptSourceId(prompt) === 'smashup_immediate_extra_action_base') {
                    const targetBase = getPromptOption(
                        prompt,
                        candidate => candidate.value?.baseIndex === 1,
                        'returned Stomp immediate action target base',
                    );
                    return { optionId: targetBase.id };
                }
                const option = getPromptOption(
                    prompt,
                    candidate => candidate.value?.cardUid === 'stomp-field',
                    'returned Stomp immediate action option',
                );
                return { optionId: option.id };
            },
            FIXED_RANDOM,
        );

        expect(replayed.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('stomp-field');
        expect(replayed.finalState.core.bases[0].ongoingActions.map(action => action.uid)).not.toContain('stomp-field');
        expect(replayed.finalState.core.bases[1].ongoingActions.map(action => action.uid)).toContain('stomp-field');
        expect(replayed.finalState.core.tempBreakpointModifiers?.[1]).toBe(-3);
    });

    it('Johnny 可在有合法行动时跳过，场上行动和额度不变', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('johnny', 'kaiju_johnny', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_tokyo',
                    ongoingActions: [{ uid: 'stomp-field', defId: 'kaiju_stomp', ownerId: '0' }],
                }),
            ],
        });

        const playJohnny = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'johnny', baseIndex: 0 },
            timestamp: 52,
        }, FIXED_RANDOM);
        const skipped = respondToPromptOption(
            playJohnny.finalState,
            option => option.value?.skip === true,
            'Johnny skip option',
            '0',
            FIXED_RANDOM,
        );

        expect(skipped.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('stomp-field');
        expect(skipped.finalState.core.bases[0].ongoingActions.map(action => action.uid)).toContain('stomp-field');
        expect(skipped.finalState.sys.interaction.current).toBeUndefined();
    });

    it('Pick Up a Bus 会从弃牌堆回收可打在基地上的行动牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bus', 'kaiju_pick_up_a_bus', 'action', '0')],
                    discard: [
                        makeCard('recover-me', 'kaiju_stomp', 'action', '0'),
                        makeCard('ignore-minion', 'kaiju_kaijookey', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bus' },
            timestamp: 46,
        }, FIXED_RANDOM);

        expect(play.events.some(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(true);
        expect(play.finalState.core.players['0'].hand.map(card => card.uid)).toContain('recover-me');
        expect(play.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('recover-me');
    });

    it('They Say He’s Got to Go 会移动一个泰坦到另一个基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('go', 'kaiju_they_say_hes_got_to_go', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tokyo'), makeBase('base_itty_city')],
            titans: [makeGorgodzolla({ zone: 'base', baseIndex: 0, enteredAt: 1 })],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'go', targetBaseIndex: 0 },
            timestamp: 47,
        }, FIXED_RANDOM);

        expect(play.events.some(event => event.type === SU_EVENTS.TITAN_MOVED)).toBe(true);
        expect(play.finalState.core.titans?.find(titan => titan.uid === 'gorgodzolla')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('There Goes Tokyo 移动 Gorgodzolla、清掉原基地并正常替换新基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('tokyo-goes', 'kaiju_there_goes_tokyo', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tokyo', [makeMinion('doomed', 'itty_critters_leafaroo', '0', 2)]),
                makeBase('base_itty_city'),
            ],
            baseDeck: ['base_kaiju_island'],
            titans: [makeGorgodzolla({ zone: 'base', baseIndex: 0, enteredAt: 1 })],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'tokyo-goes' },
            timestamp: 50,
        }, FIXED_RANDOM);
        const prompt = getSimpleChoicePrompt(play.finalState, 'kaiju_there_goes_tokyo_choose_base');
        const moved = respondToPromptOption(play.finalState, option => option.value?.baseIndex === 1, 'destination base', '0', FIXED_RANDOM);

        expect(getPromptOption(prompt, option => option.value?.baseIndex === 1)).toBeDefined();
        expect(moved.events.map(event => event.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.TITAN_MOVED,
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
        ]));
        expect(moved.finalState.core.bases.map(base => base.defId)).toEqual(['base_kaiju_island', 'base_itty_city']);
        expect(moved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('doomed');
        expect(moved.finalState.core.titans?.find(titan => titan.uid === 'gorgodzolla')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('Kaiju Island 上每个泰坦给控制者 +3 总力量', () => {
        const core = makeState({
            bases: [makeBase('base_kaiju_island')],
            titans: [makeGorgodzolla({ zone: 'base', baseIndex: 0, enteredAt: 1 })],
        });

        expect(getPlayerEffectivePowerOnBase(core, core.bases[0], 0, '0')).toBe(3);
    });
});
