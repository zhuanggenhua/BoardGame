import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { triggerBaseAbility, triggerExtendedBaseAbility } from '../../domain/baseAbilities';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import { getEffectiveBreakpoint, getEffectivePower, getPlayerEffectivePowerOnBase } from '../../domain/ongoingModifiers';
import { fireTriggerForSource } from '../../domain/ongoingEffects';
import {
    appendScoringFrameDeferredPayload,
    consumeScoringFrameDeferredPayload,
    createScoringSession,
    setScoringSession,
} from '../../domain/scoringSession';
import { SU_COMMANDS, SU_EVENTS, type TitanState } from '../../domain/types';
import {
    applyEvents,
    getPromptOptions,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    invokeRegisteredInteractionHandlerContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    respondToPromptOptions,
} from '../helpers';
import { runCommand } from '../testRunner';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

function makeMegabot(location: TitanState['location']): TitanState {
    return {
        uid: 'megabot',
        defId: 'mega_troopers_megabot',
        faction: SMASHUP_FACTION_IDS.MEGA_TROOPERS,
        ownerId: '0',
        controllerId: '0',
        powerCounters: 0,
        talentUsed: false,
        location,
    };
}

describe('Mega Troopers 代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('Form Megabot! 按牌文本可把牌库旁 Megabot 打到有至少两个己方随从的基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('form', 'mega_troopers_form_megabot', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar', [
                makeMinion('red', 'mega_troopers_red_trooper', '0', 5),
                makeMinion('beta', 'mega_troopers_beta_6', '0', 2),
            ])],
            titans: [makeMegabot({ zone: 'setaside' })],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'form', targetBaseIndex: 0 },
            timestamp: 10,
        }, FIXED_RANDOM);

        expect(play.success).toBe(true);
        expect(play.events.some(event => event.type === SU_EVENTS.TITAN_PLAYED)).toBe(true);
        expect(play.finalState.core.titans?.find(titan => titan.uid === 'megabot')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('Red Trooper 天赋可移动已在场 Megabot 到自身基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_moon_dumpster'),
                makeBase('base_juice_bar', [makeMinion('red', 'mega_troopers_red_trooper', '0', 5)]),
            ],
            titans: [makeMegabot({ zone: 'base', baseIndex: 0, enteredAt: 1 })],
        });

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'red', baseIndex: 1 },
            timestamp: 20,
        }, FIXED_RANDOM);

        expect(talent.success).toBe(true);
        expect(talent.events.some(event => event.type === SU_EVENTS.TITAN_MOVED)).toBe(true);
        expect(talent.finalState.core.titans?.find(titan => titan.uid === 'megabot')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('Form Megabot! 在 borrowed setaside Megabot 上仍应按当前控制者把泰坦打到合法基地，并保留真实 owner', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('form', 'mega_troopers_form_megabot', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar', [
                makeMinion('red', 'mega_troopers_red_trooper', '0', 5),
                makeMinion('beta', 'mega_troopers_beta_6', '0', 2),
            ])],
            titans: [{
                ...makeMegabot({ zone: 'setaside' }),
                uid: 'megabot-borrowed',
                ownerId: '1',
                controllerId: '0',
            }],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'form', targetBaseIndex: 0 },
            timestamp: 11,
        }, FIXED_RANDOM);

        expect(play.success).toBe(true);
        expect(play.events.some(event => event.type === SU_EVENTS.TITAN_PLAYED)).toBe(true);
        expect(play.finalState.core.titans?.find(titan => titan.uid === 'megabot-borrowed')).toMatchObject({
            ownerId: '1',
            controllerId: '0',
            location: {
                zone: 'base',
                baseIndex: 0,
            },
        });
    });

    it('Red Trooper 天赋在 borrowed live Megabot 上仍应按当前控制者移动泰坦，而不是被真实 owner 过滤掉', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_moon_dumpster'),
                makeBase('base_juice_bar', [makeMinion('red', 'mega_troopers_red_trooper', '0', 5)]),
            ],
            titans: [{
                ...makeMegabot({ zone: 'base', baseIndex: 0, enteredAt: 1 }),
                uid: 'megabot-borrowed-live',
                ownerId: '1',
                controllerId: '0',
            }],
        });

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'red', baseIndex: 1 },
            timestamp: 21,
        }, FIXED_RANDOM);

        expect(talent.success).toBe(true);
        expect(talent.events.some(event => event.type === SU_EVENTS.TITAN_MOVED)).toBe(true);
        expect(talent.finalState.core.titans?.find(titan => titan.uid === 'megabot-borrowed-live')).toMatchObject({
            ownerId: '1',
            controllerId: '0',
            location: {
                zone: 'base',
                baseIndex: 1,
            },
        });
    });

    it('Lightning Crystal 摧毁基地或随从上的行动牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('crystal', 'mega_troopers_lightning_crystal', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_juice_bar',
                ongoingActions: [{ uid: 'base-action', defId: 'kaiju_stomp', ownerId: '1' }],
                minions: [
                    makeMinion('host', 'mega_troopers_beta_6', '1', 2, {
                        attachedActions: [{ uid: 'attached-action', defId: 'magical_girls_magical_staff', ownerId: '1' }],
                    }),
                ],
            })],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'crystal' },
            timestamp: 30,
        }, FIXED_RANDOM);
        const prompt = getSimpleChoicePrompt(play.finalState, 'mega_troopers_lightning_crystal');
        expect(prompt.targetType).toBe('ongoing');
        expect(prompt.autoResolveIfSingle).toBe(false);
        const destroy = respondToPromptOption(
            play.finalState,
            option => option.value?.cardUid === 'attached-action',
            'attached action',
            '0',
            FIXED_RANDOM,
        );

        expect(destroy.events.some(event => event.type === SU_EVENTS.ONGOING_DETACHED)).toBe(true);
        expect(destroy.finalState.core.bases[0].minions[0].attachedActions).toEqual([]);
        expect(destroy.finalState.core.players['1'].discard.map(card => card.uid)).toContain('attached-action');
    });

    it('Lightning Crystal 只有一个行动牌候选也必须选择后才摧毁', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('crystal', 'mega_troopers_lightning_crystal', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_juice_bar',
                ongoingActions: [{ uid: 'base-action', defId: 'kaiju_stomp', ownerId: '1' }],
            })],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'crystal' },
            timestamp: 31,
        }, FIXED_RANDOM);
        const prompt = getSimpleChoicePrompt(play.finalState, 'mega_troopers_lightning_crystal');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(play.finalState.core.bases[0].ongoingActions.map(action => action.uid)).toContain('base-action');

        const destroy = respondToPromptOption(
            play.finalState,
            option => option.value?.cardUid === 'base-action',
            'single base action',
            '0',
            FIXED_RANDOM,
        );
        expect(destroy.events.some(event => event.type === SU_EVENTS.ONGOING_DETACHED)).toBe(true);
        expect(destroy.finalState.core.bases[0].ongoingActions).toEqual([]);
    });

    it('It’s Blitzin’ Time! 让己方随从直到回合结束 +3', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('blitz', 'mega_troopers_its_blitzin_time', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar', [makeMinion('ally', 'mega_troopers_beta_6', '0', 2)])],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'blitz', targetMinionUid: 'ally', targetBaseIndex: 0 },
            timestamp: 40,
        }, FIXED_RANDOM);

        expect(play.success).toBe(true);
        expect(getEffectivePower(play.finalState.core, play.finalState.core.bases[0].minions[0], 0)).toBe(5);
    });

    it('Mega Attack 消灭力量低于本基地己方随从总力量的随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('attack', 'mega_troopers_mega_attack', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar', [
                makeMinion('ally-a', 'mega_troopers_red_trooper', '0', 5),
                makeMinion('ally-b', 'mega_troopers_beta_6', '0', 2),
                makeMinion('target', 'kaiju_kaijookey', '1', 4),
                makeMinion('too-big', 'mega_troopers_red_trooper', '1', 8),
            ])],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'attack', targetBaseIndex: 0, targetMinionUid: 'target' },
            timestamp: 50,
        }, FIXED_RANDOM);

        expect(play.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(play.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['ally-a', 'ally-b', 'too-big']);
    });

    it('Mega Attack 拒绝力量不低于本基地己方随从总力量的目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('attack', 'mega_troopers_mega_attack', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar', [
                makeMinion('yellow-trooper', 'mega_troopers_yellow_trooper', '0', 4),
            ])],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'attack', targetBaseIndex: 0, targetMinionUid: 'yellow-trooper' },
            timestamp: 51,
        }, FIXED_RANDOM);

        expect(play.success).toBe(false);
        expect(play.error).toContain('暴力攻击只能选择力量低于你在该基地随从总力量的随从');
        expect(play.finalState.core.players['0'].hand.map(card => card.uid)).toContain('attack');
        expect(play.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['yellow-trooper']);
    });

    it('Plan For More! 展示牌库顶三张，拿走随从并可把其中一张作为额外随从打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('plan', 'mega_troopers_plan_for_more', 'action', '0')],
                    deck: [
                        makeCard('beta', 'mega_troopers_beta_6', 'minion', '0'),
                        makeCard('red', 'mega_troopers_red_trooper', 'minion', '0'),
                        makeCard('crystal', 'mega_troopers_lightning_crystal', 'action', '0'),
                        makeCard('later', 'mega_troopers_blue_trooper', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar')],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'plan' },
            timestamp: 60,
        }, FIXED_RANDOM);
        const promptOptions = getPromptOptions(getSimpleChoicePrompt(play.finalState, 'mega_troopers_plan_for_more'));
        const playBeta = promptOptions.find(option => option.value?.mode === 'take_and_play' && option.value?.cardUid === 'beta');
        const takeRed = promptOptions.find(option => option.value?.mode === 'take' && option.value?.cardUid === 'red');
        expect(playBeta).toBeDefined();
        expect(takeRed).toBeDefined();

        const resolved = respondToPromptOptions(play.finalState, [playBeta!.id, takeRed!.id], '0', FIXED_RANDOM);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('beta');
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('red');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['crystal', 'later']);
    });

    it('Plan For More! 允许把其余展示牌按玩家选择顺序放回牌库顶', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('plan', 'mega_troopers_plan_for_more', 'action', '0')],
                    deck: [
                        makeCard('beta', 'mega_troopers_beta_6', 'minion', '0'),
                        makeCard('crystal', 'mega_troopers_lightning_crystal', 'action', '0'),
                        makeCard('pose', 'mega_troopers_power_pose', 'action', '0'),
                        makeCard('later', 'mega_troopers_blue_trooper', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar')],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'plan' },
            timestamp: 61,
        }, FIXED_RANDOM);
        const pickPrompt = getSimpleChoicePrompt(play.finalState, 'mega_troopers_plan_for_more');
        const takeBeta = getPromptOptions(pickPrompt).find(option => option.value?.mode === 'take' && option.value?.cardUid === 'beta');
        expect(takeBeta).toBeDefined();

        const picked = respondToPromptOptions(play.finalState, [takeBeta!.id], '0', FIXED_RANDOM);
        expect(picked.finalState.core.players['0'].hand.map(card => card.uid)).toContain('beta');
        const orderPrompt = getSimpleChoicePrompt(picked.finalState, 'mega_troopers_plan_for_more_order');
        expect(getPromptOptions(orderPrompt).map(option => option.value?.cardUid)).toEqual(['crystal', 'pose']);

        const ordered = respondToPromptOption(
            picked.finalState,
            option => option.value?.cardUid === 'pose',
            'Power Pose first',
            '0',
            FIXED_RANDOM,
        );

        expect(ordered.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        expect(ordered.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['pose', 'crystal', 'later']);
    });

    it('Beta 6 / Blue Trooper 计分前 special 给自身临时力量，并触发 Black Trooper +1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar', [
                makeMinion('beta', 'mega_troopers_beta_6', '0', 2),
                makeMinion('black', 'mega_troopers_black_trooper', '0', 3),
                makeMinion('enemy', 'mega_troopers_red_trooper', '1', 20),
            ])],
        });
        const state = makeMatchState(core);
        state.sys.phase = 'scoreBases';

        const special = runCommand(state, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'beta', baseIndex: 0 },
            timestamp: 70,
        }, FIXED_RANDOM);

        expect(special.success).toBe(true);
        expect(special.events.some(event => event.type === SU_EVENTS.SPECIAL_LIMIT_USED)).toBe(true);
        expect(getEffectivePower(special.finalState.core, special.finalState.core.bases[0].minions.find(minion => minion.uid === 'beta')!, 0)).toBe(3);
        expect(getEffectivePower(special.finalState.core, special.finalState.core.bases[0].minions.find(minion => minion.uid === 'black')!, 0)).toBe(4);
    });

    it('Green Trooper 计分前 special 给本基地立即额外随从额度', () => {
        const core = makeState({
            bases: [makeBase('base_juice_bar', [makeMinion('green', 'mega_troopers_green_trooper', '0', 3)])],
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'scoreBases';
        const result = invokeRegisteredAbilityContract('mega_troopers_green_trooper', 'special', {
            state: core,
            matchState,
            playerId: '0',
            cardUid: 'green',
            defId: 'mega_troopers_green_trooper',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 80,
        });

        const limit = result.events.find(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limit?.payload).toMatchObject({
            playerId: '0',
            limitType: 'minion',
            restrictToBase: 0,
            playTiming: 'immediate',
        });
    });

    it('Yellow Trooper 计分前 special 把另一个己方随从移到这里', () => {
        const core = makeState({
            bases: [
                makeBase('base_moon_dumpster', [makeMinion('ally', 'mega_troopers_beta_6', '0', 2)]),
                makeBase('base_juice_bar', [makeMinion('yellow', 'mega_troopers_yellow_trooper', '0', 4)]),
            ],
        });
        const result = invokeRegisteredAbilityContract('mega_troopers_yellow_trooper', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'yellow',
            defId: 'mega_troopers_yellow_trooper',
            baseIndex: 1,
            random: FIXED_RANDOM,
            now: 90,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'mega_troopers_yellow_trooper');
        expect(prompt.autoResolveIfSingle).toBe(false);
        const moved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'ally',
            'Yellow Trooper 唯一随从',
            '0',
            FIXED_RANDOM,
        );

        expect(moved.finalState.core.bases[0].minions).toEqual([]);
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['yellow', 'ally']);
    });

    it('Pink Trooper 计分后 special 可让力量 3 或以下的己方随从回手，而不是进弃牌堆', () => {
        const core = makeState({
            bases: [makeBase('base_juice_bar', [
                makeMinion('pink', 'mega_troopers_pink_trooper', '0', 3),
                makeMinion('beta', 'mega_troopers_beta_6', '0', 2),
            ])],
        });
        const matchState = makeMatchState(core);
        const result = invokeRegisteredAbilityContract('mega_troopers_pink_trooper', 'special', {
            state: core,
            matchState,
            playerId: '0',
            cardUid: 'pink',
            defId: 'mega_troopers_pink_trooper',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 100,
        });
        const returned = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'beta',
            'beta',
            '0',
            FIXED_RANDOM,
        );

        expect(returned.finalState.core.players['0'].hand.map(card => card.uid)).toContain('beta');
        expect(returned.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('beta');
        expect(returned.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['pink']);
    });

    it('Lightning Rescue 计分前 special 可把一个行动作为额外行动打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('rescue', 'mega_troopers_lightning_rescue', 'action', '0'),
                        makeCard('conflict', 'kaiju_kaiju_conflict', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar')],
        });
        const result = invokeRegisteredAbilityContract('mega_troopers_lightning_rescue', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'rescue',
            defId: 'mega_troopers_lightning_rescue',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 110,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'conflict',
            'conflict',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('conflict');
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(3);
    });

    it('Blitzing Sword Attack 在有 Megabot 且自己不是第一名时消灭这里力量 4 或以下随从', () => {
        const core = makeState({
            bases: [makeBase('base_juice_bar', [
                makeMinion('ally', 'mega_troopers_beta_6', '0', 2),
                makeMinion('victim', 'kaiju_kaijookey', '1', 4),
                makeMinion('leader', 'mega_troopers_red_trooper', '1', 8),
            ])],
            titans: [makeMegabot({ zone: 'base', baseIndex: 0, enteredAt: 1 })],
        });
        const result = invokeRegisteredAbilityContract('mega_troopers_blitzing_sword_attack', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sword',
            defId: 'mega_troopers_blitzing_sword_attack',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 120,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'victim',
            'victim',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['ally', 'leader']);
    });

    it('Power Pose 在自己是第一名的基地计分后抽两张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'mega_troopers_beta_6', 'minion', '0'),
                        makeCard('draw-b', 'mega_troopers_blue_trooper', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar', [
                makeMinion('red', 'mega_troopers_red_trooper', '0', 5),
                makeMinion('enemy', 'mega_troopers_beta_6', '1', 2),
            ])],
        });
        const result = invokeRegisteredAbilityContract('mega_troopers_power_pose', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'pose',
            defId: 'mega_troopers_power_pose',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 130,
        });
        const drawn = applyEvents(core, result.events);

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(drawn.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b']);
    });

    it('蓝骑士 POD 在自己的回合发动 +2，应在下一个玩家回合开始时回滚', () => {
        const core = makeState({
            currentPlayer: '0',
            turnNumber: 7,
            turnOrder: ['0', '1'],
            bases: [makeBase('base_juice_bar_pod', [
                makeMinion('blue-pod', 'mega_troopers_blue_trooper_pod', '0', 4),
            ])],
        });
        const result = invokeRegisteredAbilityContract('mega_troopers_blue_trooper_pod', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'blue-pod',
            defId: 'mega_troopers_blue_trooper_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 131,
        });
        const powered = respondToPromptOption(
            result.matchState!,
            option => option.value?.mode === 'power',
            'power',
            '0',
            FIXED_RANDOM,
        );

        expect(powered.finalState.core.bases[0].minions[0].powerModifier).toBe(2);
        expect(powered.finalState.core.timedPowerModifiers).toEqual([
            expect.objectContaining({
                minionUid: 'blue-pod',
                amount: 2,
                expiresOnTurnNumber: 8,
                reason: 'mega_troopers_blue_trooper_pod',
            }),
        ]);

        const expired = applyEvents(powered.finalState.core, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 8 },
            timestamp: 132,
        }]);
        expect(expired.bases[0].minions[0].powerModifier).toBe(0);
        expect(expired.timedPowerModifiers).toBeUndefined();
    });

    it('蓝骑士 POD 在对手回合发动 +2，应持续经过自己的下个回合再回滚', () => {
        const core = makeState({
            currentPlayer: '1',
            turnNumber: 11,
            turnOrder: ['0', '1'],
            bases: [makeBase('base_juice_bar_pod', [
                makeMinion('blue-pod', 'mega_troopers_blue_trooper_pod', '0', 4),
            ])],
        });
        const result = invokeRegisteredAbilityContract('mega_troopers_blue_trooper_pod', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'blue-pod',
            defId: 'mega_troopers_blue_trooper_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 133,
        });
        const powered = respondToPromptOption(
            result.matchState!,
            option => option.value?.mode === 'power',
            'power',
            '0',
            FIXED_RANDOM,
        );

        const ownTurnStarted = applyEvents(powered.finalState.core, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 12 },
            timestamp: 134,
        }]);
        expect(ownTurnStarted.bases[0].minions[0].powerModifier).toBe(2);
        expect(ownTurnStarted.timedPowerModifiers?.[0]?.expiresOnTurnNumber).toBe(13);

        const ownTurnEnded = applyEvents(ownTurnStarted, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 13 },
            timestamp: 135,
        }]);
        expect(ownTurnEnded.bases[0].minions[0].powerModifier).toBe(0);
        expect(ownTurnEnded.timedPowerModifiers).toBeUndefined();
    });

    it.each([
        ['贝塔6号', 'mega_troopers_beta_6_pod', 'beta-pod'],
        ['蓝骑士', 'mega_troopers_blue_trooper_pod', 'blue-pod'],
    ])('%s POD 可在另一个基地计分前从非计分基地发动', (_name, defId, uid) => {
        const core = makeState({
            currentPlayer: '0',
            currentPlayerIndex: 0,
            scoringEligibleBaseIndices: [0],
            bases: [
                makeBase('base_moon_dumpster_pod', [
                    makeMinion('leader', 'mega_troopers_red_trooper_pod', '1', 20),
                ]),
                makeBase('base_juice_bar_pod', [
                    makeMinion(uid, defId, '0', defId === 'mega_troopers_beta_6_pod' ? 2 : 4),
                ]),
            ],
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'scoreBases';

        const activated = runCommand(matchState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: uid, baseIndex: 1 },
            timestamp: 136,
        }, FIXED_RANDOM);

        expect(activated.success).toBe(true);
        expect(getSimpleChoicePrompt(activated.finalState, defId).sourceId).toBe(defId);
    });

    it('合体超级佐德 POD 可移动任意数量己方随从，也允许合法空选', () => {
        const buildState = () => makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('form-pod', 'mega_troopers_form_megabot_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_moon_dumpster_pod'),
                makeBase('base_juice_bar_pod', [
                    makeMinion('ally-a', 'mega_troopers_beta_6_pod', '0', 2),
                    makeMinion('ally-b', 'mega_troopers_blue_trooper_pod', '0', 4),
                    makeMinion('enemy', 'mega_troopers_red_trooper_pod', '1', 5),
                ]),
            ],
            titans: [makeMegabot({ zone: 'base', baseIndex: 0, enteredAt: 1 })],
        });

        const movingPlay = runCommand(makeMatchState(buildState()), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'form-pod' },
            timestamp: 137,
        }, FIXED_RANDOM);
        const movePrompt = getSimpleChoicePrompt(movingPlay.finalState, 'mega_troopers_form_megabot_pod_move_minions');
        const moveOptions = getPromptOptions(movePrompt);
        const selected = moveOptions
            .filter(option => ['ally-a', 'ally-b'].includes(option.value?.minionUid))
            .map(option => option.id);
        const moved = respondToPromptOptions(movingPlay.finalState, selected, '0', FIXED_RANDOM);

        expect(moved.finalState.core.bases[0].minions.map(minion => minion.uid).sort()).toEqual(['ally-a', 'ally-b']);
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['enemy']);

        const skippedPlay = runCommand(makeMatchState(buildState()), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'form-pod' },
            timestamp: 138,
        }, FIXED_RANDOM);
        const skipped = respondToPromptOption(
            skippedPlay.finalState,
            option => option.value?.skip === true,
            'skip',
            '0',
            FIXED_RANDOM,
        );
        expect(skipped.finalState.core.bases[0].minions).toEqual([]);
        expect(skipped.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual([
            'ally-a',
            'ally-b',
            'enemy',
        ]);
    });

    it('闪电水晶 POD 可消灭在场泰坦并将其送回场外', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('crystal-pod', 'mega_troopers_lightning_crystal_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar_pod')],
            titans: [makeMegabot({ zone: 'base', baseIndex: 0, enteredAt: 1 })],
        });
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'crystal-pod' },
            timestamp: 139,
        }, FIXED_RANDOM);

        const prompt = getSimpleChoicePrompt(play.finalState, 'mega_troopers_lightning_crystal_pod');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(play.finalState.core.titans?.[0]?.location).toEqual({ zone: 'base', baseIndex: 0, enteredAt: 1 });
        const resolved = respondToPromptOption(
            play.finalState,
            option => option.value?.titanUid === 'megabot',
            'Lightning Crystal POD 唯一泰坦',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.events.some(event => event.type === SU_EVENTS.TITAN_REMOVED_FROM_PLAY)).toBe(true);
        expect(resolved.finalState.core.titans?.[0]?.location).toEqual({ zone: 'setaside' });
    });

    it('闪电时刻 POD 只给己方目标直到回合结束 +4，基础版仍保持 +3', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('blitz-pod', 'mega_troopers_its_blitzin_time_pod', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar_pod', [
                makeMinion('ally-pod', 'mega_troopers_beta_6_pod', '0', 2),
            ])],
        });
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'blitz-pod',
                targetMinionUid: 'ally-pod',
                targetBaseIndex: 0,
            },
            timestamp: 140,
        }, FIXED_RANDOM);

        expect(getEffectivePower(play.finalState.core, play.finalState.core.bases[0].minions[0], 0)).toBe(6);
    });

    it('谋划更多 POD 可抓一张并把其余牌分别按指定顺序放到牌库顶与牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('plan-pod', 'mega_troopers_plan_for_more_pod', 'action', '0')],
                    deck: [
                        makeCard('beta-pod', 'mega_troopers_beta_6_pod', 'minion', '0'),
                        makeCard('crystal-pod', 'mega_troopers_lightning_crystal_pod', 'action', '0'),
                        makeCard('red-pod', 'mega_troopers_red_trooper_pod', 'minion', '0'),
                        makeCard('later-pod', 'mega_troopers_blue_trooper_pod', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar_pod')],
        });
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'plan-pod' },
            timestamp: 141,
        }, FIXED_RANDOM);
        const drawn = respondToPromptOption(
            play.finalState,
            option => option.value?.mode === 'draw' && option.value?.cardUid === 'beta-pod',
            'draw beta',
            '0',
            FIXED_RANDOM,
        );
        expect(drawn.finalState.core.players['0'].hand.map(card => card.uid)).toContain('beta-pod');

        const ordered = respondToPromptOption(
            drawn.finalState,
            option =>
                option.value?.topUids?.length === 1
                && option.value.topUids[0] === 'red-pod'
                && option.value?.bottomUids?.length === 1
                && option.value.bottomUids[0] === 'crystal-pod',
            'red on top and crystal on bottom',
            '0',
            FIXED_RANDOM,
        );
        expect(ordered.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'red-pod',
            'later-pod',
            'crystal-pod',
        ]);
    });

    it('欧米伽协议 POD 只在其他玩家回合令所在基地临界点 -10', () => {
        const makeProtocolState = (currentPlayerIndex: number, withProtocol: boolean) => makeState({
            currentPlayerIndex,
            currentPlayer: currentPlayerIndex === 0 ? '0' : '1',
            bases: [makeBase({
                defId: 'base_juice_bar_pod',
                ongoingActions: withProtocol
                    ? [{ uid: 'omega', defId: 'mega_troopers_omega_protocol_pod', ownerId: '0' }]
                    : [],
            })],
        });

        const baseline = getEffectiveBreakpoint(makeProtocolState(1, false), 0);
        expect(getEffectiveBreakpoint(makeProtocolState(1, true), 0)).toBe(baseline - 10);
        expect(getEffectiveBreakpoint(makeProtocolState(0, true), 0)).toBe(baseline);
    });

    it('闪电救援 POD 满足条件时可额外打出行动，skip 后不改变手牌或行动额度', () => {
        const buildState = () => makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('rescue-pod', 'mega_troopers_lightning_rescue_pod', 'action', '0'),
                        makeCard('omega-pod', 'mega_troopers_omega_protocol_pod', 'action', '0'),
                    ],
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar_pod', [
                makeMinion('ally', 'mega_troopers_beta_6_pod', '0', 2),
                makeMinion('leader', 'mega_troopers_red_trooper_pod', '1', 5),
            ])],
        });

        const result = invokeRegisteredAbilityContract('mega_troopers_lightning_rescue_pod', 'special', {
            state: buildState(),
            matchState: makeMatchState(buildState()),
            playerId: '0',
            cardUid: 'rescue-pod',
            defId: 'mega_troopers_lightning_rescue_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 143,
        });
        const played = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'omega-pod',
            'play omega protocol',
            '0',
            FIXED_RANDOM,
        );
        expect(played.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('omega-pod');
        expect(played.finalState.core.players['0'].actionLimit).toBe(1);
        expect(played.finalState.core.bases[0].ongoingActions.map(action => action.uid)).toContain('omega-pod');

        const skipCore = buildState();
        const skipResult = invokeRegisteredAbilityContract('mega_troopers_lightning_rescue_pod', 'special', {
            state: skipCore,
            matchState: makeMatchState(skipCore),
            playerId: '0',
            cardUid: 'rescue-pod',
            defId: 'mega_troopers_lightning_rescue_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 144,
        });
        const skipped = respondToPromptOption(
            skipResult.matchState!,
            option => option.value?.skip === true,
            'skip rescue',
            '0',
            FIXED_RANDOM,
        );
        expect(skipped.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(false);
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'rescue-pod',
            'omega-pod',
        ]);
        expect(skipped.finalState.core.players['0'].actionLimit).toBe(1);
        expect(skipped.finalState.sys.interaction?.current).toBeUndefined();
    });

    it.each([
        ['没有己方随从', [makeMinion('leader', 'mega_troopers_red_trooper_pod', '1', 5)]],
        ['己方并列最高', [
            makeMinion('ally', 'mega_troopers_blue_trooper_pod', '0', 4),
            makeMinion('leader', 'mega_troopers_blue_trooper_pod', '1', 4),
        ]],
    ])('闪电救援 POD 在%s时不创建额外行动交互', (_reason, minions) => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('omega-pod', 'mega_troopers_omega_protocol_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar_pod', minions)],
        });
        const result = invokeRegisteredAbilityContract('mega_troopers_lightning_rescue_pod', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'rescue-pod',
            defId: 'mega_troopers_lightning_rescue_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 145,
        });

        expect(result.matchState).toBeUndefined();
        expect(result.events).toEqual([
            expect.objectContaining({ type: SU_EVENTS.SPECIAL_LIMIT_USED }),
        ]);
    });

    it('贝塔6号 POD 可给另一个基地的己方随从加指示物，skip 后不改变权威状态', () => {
        const buildState = () => makeState({
            bases: [
                makeBase('base_moon_dumpster_pod', [
                    makeMinion('beta-pod', 'mega_troopers_beta_6_pod', '0', 2),
                ]),
                makeBase('base_juice_bar_pod', [
                    makeMinion('target-pod', 'mega_troopers_blue_trooper_pod', '0', 4),
                ]),
            ],
        });
        const core = buildState();
        const result = invokeRegisteredAbilityContract('mega_troopers_beta_6_pod', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'beta-pod',
            defId: 'mega_troopers_beta_6_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 146,
        });
        const boosted = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'target-pod',
            'target on another base',
            '0',
            FIXED_RANDOM,
        );
        expect(boosted.finalState.core.bases[1].minions[0].powerCounters).toBe(1);

        const skipCore = buildState();
        const skipResult = invokeRegisteredAbilityContract('mega_troopers_beta_6_pod', 'special', {
            state: skipCore,
            matchState: makeMatchState(skipCore),
            playerId: '0',
            cardUid: 'beta-pod',
            defId: 'mega_troopers_beta_6_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 147,
        });
        const skipped = respondToPromptOption(
            skipResult.matchState!,
            option => option.value?.skip === true,
            'skip beta 6',
            '0',
            FIXED_RANDOM,
        );
        expect(skipped.finalState.core.bases[1].minions[0].powerCounters ?? 0).toBe(0);
        expect(skipped.finalState.sys.interaction?.current).toBeUndefined();
    });

    it('蓝骑士 POD 可抓一张牌，skip 后不抓牌也不获得力量', () => {
        const buildState = () => makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-pod', 'mega_troopers_beta_6_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar_pod', [
                makeMinion('blue-pod', 'mega_troopers_blue_trooper_pod', '0', 4),
            ])],
        });
        const core = buildState();
        const result = invokeRegisteredAbilityContract('mega_troopers_blue_trooper_pod', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'blue-pod',
            defId: 'mega_troopers_blue_trooper_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 148,
        });
        const drawn = respondToPromptOption(
            result.matchState!,
            option => option.value?.mode === 'draw',
            'draw one',
            '0',
            FIXED_RANDOM,
        );
        expect(drawn.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-pod']);
        expect(drawn.finalState.core.bases[0].minions[0].powerModifier).toBe(0);

        const skipCore = buildState();
        const skipResult = invokeRegisteredAbilityContract('mega_troopers_blue_trooper_pod', 'special', {
            state: skipCore,
            matchState: makeMatchState(skipCore),
            playerId: '0',
            cardUid: 'blue-pod',
            defId: 'mega_troopers_blue_trooper_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 149,
        });
        const skipped = respondToPromptOption(
            skipResult.matchState!,
            option => option.value?.skip === true,
            'skip blue trooper',
            '0',
            FIXED_RANDOM,
        );
        expect(skipped.finalState.core.players['0'].hand).toEqual([]);
        expect(skipped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['draw-pod']);
        expect(skipped.finalState.core.bases[0].minions[0].powerModifier).toBe(0);
        expect(skipped.finalState.sys.interaction?.current).toBeUndefined();
    });

    it('闪电剑攻击 POD 在己方并列最高时仍可消灭目标，基础版保持不能发动', () => {
        const makeSwordState = () => makeState({
            bases: [makeBase('base_juice_bar_pod', [
                makeMinion('ally', 'mega_troopers_blue_trooper_pod', '0', 4),
                makeMinion('victim', 'mega_troopers_blue_trooper_pod', '1', 4),
            ])],
            titans: [makeMegabot({ zone: 'base', baseIndex: 0, enteredAt: 1 })],
        });

        const baseCore = makeSwordState();
        const baseResult = invokeRegisteredAbilityContract('mega_troopers_blitzing_sword_attack', 'special', {
            state: baseCore,
            matchState: makeMatchState(baseCore),
            playerId: '0',
            cardUid: 'sword-base',
            defId: 'mega_troopers_blitzing_sword_attack',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 150,
        });
        expect(baseResult.matchState).toBeUndefined();
        expect(baseResult.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);

        const podCore = makeSwordState();
        const podResult = invokeRegisteredAbilityContract('mega_troopers_blitzing_sword_attack_pod', 'special', {
            state: podCore,
            matchState: makeMatchState(podCore),
            playerId: '0',
            cardUid: 'sword-pod',
            defId: 'mega_troopers_blitzing_sword_attack_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 151,
        });
        const destroyed = respondToPromptOption(
            podResult.matchState!,
            option => option.value?.minionUid === 'victim',
            'destroy tied victim',
            '0',
            FIXED_RANDOM,
        );
        expect(destroyed.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['ally']);
    });

    it('胜利姿态 POD 计分前落后时抓两张，并列最高时不抓牌', () => {
        const buildState = (enemyPower: number) => makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'mega_troopers_beta_6_pod', 'minion', '0'),
                        makeCard('draw-b', 'mega_troopers_blue_trooper_pod', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_juice_bar_pod',
                minions: [
                    makeMinion('ally', 'mega_troopers_blue_trooper_pod', '0', 4),
                    makeMinion('enemy', 'mega_troopers_red_trooper_pod', '1', enemyPower),
                ],
                ongoingActions: [{
                    uid: 'pose-pod',
                    defId: 'mega_troopers_power_pose_pod',
                    ownerId: '0',
                }],
            })],
        });

        const behindCore = buildState(5);
        const behind = fireTriggerForSource(behindCore, 'mega_troopers_power_pose_pod', 'beforeScoring', {
            state: behindCore,
            matchState: makeMatchState(behindCore),
            playerId: '0',
            baseIndex: 0,
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            sourceCardUid: 'pose-pod',
            sourceDefId: 'mega_troopers_power_pose_pod',
            random: FIXED_RANDOM,
            now: 152,
        });
        expect(applyEvents(behindCore, behind.events).players['0'].hand.map(card => card.uid)).toEqual([
            'draw-a',
            'draw-b',
        ]);

        const tiedCore = buildState(4);
        const tied = fireTriggerForSource(tiedCore, 'mega_troopers_power_pose_pod', 'beforeScoring', {
            state: tiedCore,
            matchState: makeMatchState(tiedCore),
            playerId: '0',
            baseIndex: 0,
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            sourceCardUid: 'pose-pod',
            sourceDefId: 'mega_troopers_power_pose_pod',
            random: FIXED_RANDOM,
            now: 153,
        });
        expect(tied.events).toEqual([]);
    });

    it('胜利姿态 POD 计分后获胜可预约手牌随从到替换基地，skip 不留 deferred action', () => {
        const buildMatchState = () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('beta-hand', 'mega_troopers_beta_6_pod', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase({
                    defId: 'base_juice_bar_pod',
                    ongoingActions: [{
                        uid: 'pose-pod',
                        defId: 'mega_troopers_power_pose_pod',
                        ownerId: '0',
                    }],
                })],
            });
            const session = createScoringSession(core, [0]);
            let state = setScoringSession(makeMatchState(core), {
                ...session,
                currentBaseRef: session.lockedBaseRefs[0],
                currentStep: 'awaiting-interactions',
            });
            state = appendScoringFrameDeferredPayload(state, {
                deferredEvents: [{
                    type: SU_EVENTS.BASE_REPLACED,
                    payload: {
                        baseIndex: 0,
                        oldBaseDefId: 'base_juice_bar_pod',
                        newBaseDefId: 'base_moon_dumpster_pod',
                    },
                    timestamp: 154,
                }],
            });
            return state;
        };

        const matchState = buildMatchState();
        const triggered = fireTriggerForSource(
            matchState.core,
            'mega_troopers_power_pose_pod',
            'afterScoring',
            {
                state: matchState.core,
                matchState,
                playerId: '0',
                baseIndex: 0,
                sourceBaseIndex: 0,
                sourceControllerId: '0',
                sourceCardUid: 'pose-pod',
                sourceDefId: 'mega_troopers_power_pose_pod',
                rankings: [
                    { playerId: '0', power: 7, vp: 4 },
                    { playerId: '1', power: 3, vp: 2 },
                ],
                random: FIXED_RANDOM,
                now: 155,
            },
        );
        const selected = respondToPromptOption(
            triggered.matchState!,
            option => option.value?.cardUid === 'beta-hand',
            'play beta on replacement base',
            '0',
            FIXED_RANDOM,
        );
        expect(consumeScoringFrameDeferredPayload(selected.finalState).deferredActions).toEqual([{
            kind: 'playMinionOnReplacementBase',
            playerId: '0',
            cardUid: 'beta-hand',
            defId: 'mega_troopers_beta_6_pod',
            ownerId: '0',
            fromZone: 'hand',
            baseIndex: 0,
            targetBaseDefId: 'base_moon_dumpster_pod',
            power: 2,
        }]);

        const skipMatchState = buildMatchState();
        const skipTriggered = fireTriggerForSource(
            skipMatchState.core,
            'mega_troopers_power_pose_pod',
            'afterScoring',
            {
                state: skipMatchState.core,
                matchState: skipMatchState,
                playerId: '0',
                baseIndex: 0,
                sourceBaseIndex: 0,
                sourceControllerId: '0',
                sourceCardUid: 'pose-pod',
                sourceDefId: 'mega_troopers_power_pose_pod',
                rankings: [
                    { playerId: '0', power: 7, vp: 4 },
                    { playerId: '1', power: 7, vp: 2 },
                ],
                random: FIXED_RANDOM,
                now: 156,
            },
        );
        const skipped = respondToPromptOption(
            skipTriggered.matchState!,
            option => option.value?.skip === true,
            'skip power pose',
            '0',
            FIXED_RANDOM,
        );
        expect(consumeScoringFrameDeferredPayload(skipped.finalState).deferredActions).toEqual([]);
        expect(skipped.finalState.sys.interaction?.current).toBeUndefined();
    });

    it('红骑士 POD 允许作为第二个己方泰坦的条件，并可把超级佐德打到另一基地', () => {
        const core = makeState({
            bases: [
                makeBase('base_moon_dumpster_pod', [
                    makeMinion('red-pod', 'mega_troopers_red_trooper_pod', '0', 5),
                ]),
                makeBase('base_juice_bar_pod'),
            ],
            titans: [
                {
                    uid: 'other-titan',
                    defId: 'shapeshifters_copycat_titan',
                    faction: 'shapeshifters',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
                makeMegabot({ zone: 'setaside' }),
            ],
        });
        const result = invokeRegisteredAbilityContract('mega_troopers_red_trooper_pod', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'red-pod',
            defId: 'mega_troopers_red_trooper_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 157,
        });
        const played = result.matchState
            ? respondToPromptOption(
                result.matchState,
                option => option.value?.baseIndex === 1,
                'play megabot on other base',
                '0',
                FIXED_RANDOM,
            )
            : {
                finalState: {
                    ...makeMatchState(core),
                    core: applyEvents(core, result.events),
                },
            };
        expect(played.finalState.core.titans?.find(titan => titan.uid === 'megabot')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });

        const noRedCore = makeState({
            bases: [
                makeBase('base_moon_dumpster_pod', [
                    makeMinion('ally-a', 'mega_troopers_beta_6_pod', '0', 2),
                    makeMinion('ally-b', 'mega_troopers_blue_trooper_pod', '0', 4),
                ]),
                makeBase('base_juice_bar_pod'),
            ],
            titans: [
                {
                    uid: 'other-titan',
                    defId: 'shapeshifters_copycat_titan',
                    faction: 'shapeshifters',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
                makeMegabot({ zone: 'setaside' }),
            ],
        });
        const blocked = invokeRegisteredAbilityContract('mega_troopers_form_megabot_pod', 'onPlay', {
            state: noRedCore,
            matchState: makeMatchState(noRedCore),
            playerId: '0',
            cardUid: 'form-pod',
            defId: 'mega_troopers_form_megabot_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 158,
        });
        expect(blocked.matchState).toBeUndefined();
        expect(blocked.events.some(event => event.type === SU_EVENTS.TITAN_PLAYED)).toBe(false);
    });

    it('胜利姿态 POD handler 缺少计分 session 或替换基地时不得伪造 deferred action', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('beta-hand', 'mega_troopers_beta_6_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const result = invokeRegisteredInteractionHandlerContract(
            'mega_troopers_power_pose_pod_after_scoring',
            makeMatchState(core),
            '0',
            { cardUid: 'beta-hand', defId: 'mega_troopers_beta_6_pod' },
            {
                continuationContext: {
                    scoringBaseIndex: 0,
                    controllerId: '0',
                },
            },
            159,
            FIXED_RANDOM,
        );
        expect(consumeScoringFrameDeferredPayload(result.state).deferredActions).toEqual([]);
    });

    it('Moon Dumpster 入场时展示每名玩家牌库顶，若是随从则额外打到这里', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('p0-minion', 'mega_troopers_beta_6', 'minion', '0')] }),
                '1': makePlayer('1', { deck: [makeCard('p1-action', 'mega_troopers_lightning_crystal', 'action', '1')] }),
            },
            bases: [makeBase('base_moon_dumpster')],
        });
        const result = triggerExtendedBaseAbility('base_moon_dumpster', 'onBaseRevealed', {
            state: core,
            matchState: makeMatchState(core),
            baseIndex: 0,
            baseDefId: 'base_moon_dumpster',
            playerId: '0',
            now: 140,
        });
        const resolved = applyEvents(core, result.events);

        expect(result.events.filter(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toHaveLength(2);
        expect(resolved.bases[0].minions.map(minion => minion.uid)).toEqual(['p0-minion']);
        expect(resolved.players['1'].deck.map(card => card.uid)).toEqual(['p1-action']);
    });

    it('Juice Bar 按本基地已使用 special 次数给一个随从 +2 倍数力量', () => {
        const core = makeState({
            bases: [makeBase('base_juice_bar', [
                makeMinion('target', 'mega_troopers_beta_6', '0', 2),
                makeMinion('other', 'mega_troopers_red_trooper', '1', 5),
            ])],
            specialLimitUsed: {
                mega_troopers_before_scoring_power: [0],
                mega_troopers_before_scoring_move: [0],
            },
        });
        const result = triggerBaseAbility('base_juice_bar', 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            baseIndex: 0,
            baseDefId: 'base_juice_bar',
            playerId: '0',
            now: 150,
        });
        const boosted = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'target',
            'target',
            '0',
            FIXED_RANDOM,
        );

        expect(getPlayerEffectivePowerOnBase(boosted.finalState.core, boosted.finalState.core.bases[0], 0, '0')).toBe(6);
    });

    it('Juice Bar 只有一个随从也必须选择后才加力量', () => {
        const core = makeState({
            bases: [makeBase('base_juice_bar', [
                makeMinion('target', 'mega_troopers_beta_6', '0', 2),
            ])],
            specialLimitUsed: {
                mega_troopers_before_scoring_power: [0],
            },
        });
        const result = triggerBaseAbility('base_juice_bar', 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            baseIndex: 0,
            baseDefId: 'base_juice_bar',
            playerId: '0',
            now: 151,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_juice_bar');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPlayerEffectivePowerOnBase(result.matchState!.core, result.matchState!.core.bases[0], 0, '0')).toBe(2);

        const boosted = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'target',
            'Juice Bar 唯一随从',
            '0',
            FIXED_RANDOM,
        );
        expect(getPlayerEffectivePowerOnBase(boosted.finalState.core, boosted.finalState.core.bases[0], 0, '0')).toBe(4);
    });
});
