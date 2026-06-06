import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { triggerBaseAbility, triggerExtendedBaseAbility } from '../../domain/baseAbilities';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import { getEffectivePower, getPlayerEffectivePowerOnBase } from '../../domain/ongoingModifiers';
import { SU_COMMANDS, SU_EVENTS, type TitanState } from '../../domain/types';
import {
    applyEvents,
    getPromptOptions,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
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
        const moved = applyEvents(core, result.events);

        expect(moved.bases[0].minions).toEqual([]);
        expect(moved.bases[1].minions.map(minion => minion.uid)).toEqual(['yellow', 'ally']);
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
});
