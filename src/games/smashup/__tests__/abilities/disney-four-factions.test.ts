import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { BIG_HERO_6_CARDS } from '../../data/factions/big_hero_6';
import { FROZEN_CARDS } from '../../data/factions/frozen';
import { LION_KING_CARDS } from '../../data/factions/lion_king';
import { MULAN_CARDS } from '../../data/factions/mulan';
import { getEffectivePower, getPlayerEffectivePowerOnBase } from '../../domain/ongoingModifiers';
import { isMinionProtected } from '../../domain/ongoingEffects';
import type { AbilityTag } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { runCommand } from '../testRunner';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    getPromptOption,
    getPromptOptions,
    getReactionPrompt,
    getReactionPromptOptionBySourceDefId,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
    respondToPromptOption,
} from '../helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

const EXECUTABLE_TAGS = new Set<AbilityTag>(['onPlay', 'talent', 'special', 'onDestroy']);
const DISNEY_CARDS = [
    ...BIG_HERO_6_CARDS,
    ...FROZEN_CARDS,
    ...LION_KING_CARDS,
    ...MULAN_CARDS,
];

describe('迪士尼四派系代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('四派系代表性主动能力入口已注册', () => {
        for (const card of DISNEY_CARDS) {
            for (const tag of card.abilityTags ?? []) {
                if (!EXECUTABLE_TAGS.has(tag)) continue;
                expect(expectRegisteredAbilityContract(card.id, tag), `${card.name}（${card.id}）::${tag}`).toBeTypeOf('function');
            }
        }
    });

    it('超能陆战队：微型机器群、新来的学生、升级、团队的努力按指示物/额外出牌结算', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'frozen_snowgie', 'minion', '0'),
                        makeCard('draw-2', 'frozen_snowgie', 'minion', '0'),
                    ],
                    discard: [makeCard('discarded-swarm', 'big_hero_6_microbot_swarm', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_sfit_robotics_lab', [
                makeMinion('swarm', 'big_hero_6_microbot_swarm', '0', 2),
                makeMinion('baymax', 'big_hero_6_baymax', '0', 3, { powerCounters: 1 }),
                makeMinion('enemy', 'frozen_snowgie', '1', 2),
            ])],
        });

        const recovered = invokeRegisteredAbilityContract('big_hero_6_microbot_swarm', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'swarm',
            defId: 'big_hero_6_microbot_swarm',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        expect(recovered.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            payload: expect.objectContaining({ cardUids: ['discarded-swarm'] }),
        }));

        const talent = invokeRegisteredAbilityContract('big_hero_6_microbot_swarm', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'swarm',
            defId: 'big_hero_6_microbot_swarm',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 11,
        });
        const afterTalent = applyEvents(core, talent.events);
        expect(afterTalent.bases[0].minions.find(minion => minion.uid === 'swarm')?.powerCounters).toBe(1);

        const newStudent = invokeRegisteredAbilityContract('big_hero_6_new_student', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'new-student',
            defId: 'big_hero_6_new_student',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 12,
        });
        expect(newStudent.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_PLAY_EFFECT_QUEUED,
            payload: expect.objectContaining({ playerId: '0', effect: 'addPowerCounter', amount: 1 }),
        }));
        expect(newStudent.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ playerId: '0', limitType: 'minion', powerMax: 3 }),
        }));

        const upgrades = invokeRegisteredAbilityContract('big_hero_6_upgrades', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'upgrades',
            defId: 'big_hero_6_upgrades',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 13,
        });
        expect(upgrades.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ playerId: '0', limitType: 'action' }),
        }));
        const upgradesPrompt = getSimpleChoicePrompt(upgrades.matchState!, 'disney_four_factions_prompt');
        const upgradesTarget = getPromptOption(upgradesPrompt, option => option.value?.minionUid === 'swarm', '升级目标');
        const upgraded = respondToPromptOption(upgrades.matchState!, option => option.id === upgradesTarget.id, 'resolve upgrades', '0', FIXED_RANDOM);
        expect(upgraded.finalState.core.bases[0].minions.find(minion => minion.uid === 'swarm')?.powerCounters).toBe(2);

        const teamEffort = invokeRegisteredAbilityContract('big_hero_6_team_effort', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'team-effort',
            defId: 'big_hero_6_team_effort',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 14,
        });
        const teamPrompt = getSimpleChoicePrompt(teamEffort.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(teamPrompt)).toHaveLength(1);
        const drawn = respondToPromptOption(teamEffort.matchState!, option => option.value?.baseIndex === 0, '团队的努力基地', '0', FIXED_RANDOM);
        expect(drawn.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ playerId: '0', count: 1, cardUids: ['draw-1'] }),
        }));
    });

    it('超能陆战队：升级从真实出牌管线打开选择后，应离开手牌并进入弃牌堆', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-upgrades', 'big_hero_6_upgrades', 'action', '0')],
                    deck: [makeCard('draw-after-counter', 'frozen_snowgie', 'minion', '0')],
                    actionLimit: 1,
                    actionsPlayed: 0,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_sfit_robotics_lab', [
                makeMinion('microbot-target', 'big_hero_6_microbot_swarm', '0', 2),
            ])],
        });

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'hand-upgrades' },
        });

        expect(played.success).toBe(true);
        expect(played.finalState.core.players['0'].hand.some(card => card.uid === 'hand-upgrades')).toBe(false);
        expect(played.finalState.core.players['0'].discard.some(card => card.uid === 'hand-upgrades')).toBe(true);
        expect(played.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(getSimpleChoicePrompt(played.finalState, 'disney_four_factions_prompt')).toBeTruthy();

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.minionUid === 'microbot-target',
            '升级目标微型机器群',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success).toBe(true);
        const player0 = resolved.finalState.core.players['0'];
        expect(player0.hand.some(card => card.uid === 'hand-upgrades')).toBe(false);
        expect(player0.hand.some(card => card.uid === 'draw-after-counter')).toBe(true);
        expect(player0.discard.some(card => card.uid === 'hand-upgrades')).toBe(true);
        expect(player0.actionsPlayed).toBe(1);
        expect(player0.actionLimit).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'microbot-target')?.powerCounters).toBe(2);
        expect(resolved.finalState.sys.interaction?.current).toBeUndefined();
    });

    it('冰雪奇缘：棉花糖只压制同基地敌方角色，真爱的行为先抽牌再给所选角色临时保护', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('love-draw', 'frozen_snowgie', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('test_base', [
                    makeMinion('marshmallow', 'frozen_marshmallow', '0', 3),
                    makeMinion('ally', 'frozen_snowgie', '0', 2),
                    makeMinion('enemy', 'frozen_snowgie', '1', 2),
                ]),
                makeBase('test_base_2', [
                    makeMinion('away-enemy', 'frozen_snowgie', '1', 2),
                ]),
            ],
        });

        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(2);
        expect(getEffectivePower(core, core.bases[0].minions[2], 0)).toBe(1);
        expect(getEffectivePower(core, core.bases[1].minions[0], 1)).toBe(2);

        const love = invokeRegisteredAbilityContract('frozen_act_of_true_love', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'love',
            defId: 'frozen_act_of_true_love',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        expect(love.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ playerId: '0', cardUids: ['love-draw'] }),
        }));
        const lovePrompt = getSimpleChoicePrompt(love.matchState!, 'disney_four_factions_prompt');
        expect(lovePrompt.targetType).toBe('minion');
        const protectedResult = respondToPromptOption(love.matchState!, option => option.value?.minionUid === 'ally', '真爱的行为目标', '0', FIXED_RANDOM);
        const protectedAlly = protectedResult.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally');
        expect(protectedAlly?.metadata).toMatchObject({
            tempProtectAffectUntilTurnNumber: 1,
            tempProtectSourcePlayerId: '0',
        });
    });

    it('狮子王：木法沙在弃牌堆时触发弃牌条件，并让荣耀石给玩家额外力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('mufasa-discard', 'lion_king_mufasa', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_pride_rock', [
                makeMinion('nala', 'lion_king_nala', '0', 4),
                makeMinion('cub', 'lion_king_lion_cub', '0', 2),
            ])],
        });

        const nala = invokeRegisteredAbilityContract('lion_king_nala', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'nala',
            defId: 'lion_king_nala',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        });
        expect(nala.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({ minionUid: 'nala', amount: 1, reason: 'lion_king_nala' }),
        }));
        expect(getPlayerEffectivePowerOnBase(core, core.bases[0], 0, '0')).toBe(8);
    });

    it('狮子王：刀疤按目标所在基地计算有效力量，跨基地持续修正不会漏算', () => {
        const core = makeState({
            bases: [
                makeBase('test_base', [
                    makeMinion('scar', 'lion_king_scar', '0', 5),
                    makeMinion('enemy-six-here', 'frozen_snowgie', '1', 6),
                ]),
                makeBase('base_ice_palace', [
                    makeMinion('ally-at-palace', 'lion_king_lion_cub', '0', 2),
                    makeMinion('enemy-six-at-palace', 'frozen_snowgie', '1', 6),
                ]),
            ],
        });
        const palaceEnemy = core.bases[1].minions.find(minion => minion.uid === 'enemy-six-at-palace');
        expect(palaceEnemy ? getEffectivePower(core, palaceEnemy, 1) : undefined).toBe(5);

        const result = invokeRegisteredAbilityContract('lion_king_scar', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'scar',
            defId: 'lion_king_scar',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 35,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'disney_four_factions_prompt');
        const targetUids = getPromptOptions(prompt).map(option => option.value?.minionUid);
        expect(targetUids).toContain('scar');
        expect(targetUids).toContain('ally-at-palace');
        expect(targetUids).toContain('enemy-six-at-palace');
        expect(targetUids).not.toContain('enemy-six-here');
    });

    it('狮子王：刀疤消灭己方角色后按消灭前有效力量摸牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'frozen_snowgie', 'minion', '0'),
                        makeCard('draw-b', 'lion_king_zazu', 'minion', '0'),
                        makeCard('draw-c', 'lion_king_lion_cub', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [
                makeMinion('scar', 'lion_king_scar', '0', 5),
                makeMinion('own-target', 'frozen_snowgie', '0', 2, { powerCounters: 1 }),
                makeMinion('enemy-target', 'frozen_snowgie', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('lion_king_scar', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'scar',
            defId: 'lion_king_scar',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 36,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'own-target',
            '刀疤消灭己方角色',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['scar', 'enemy-target']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['own-target']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b', 'draw-c']);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ playerId: '0', count: 3, cardUids: ['draw-a', 'draw-b', 'draw-c'] }),
        }));
    });

    it('狮子王：幼狮从基地进入弃牌堆后可触发搜寻力量不超过 4 的角色', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('scar-draw-a', 'frozen_snowgie', 'minion', '0'),
                        makeCard('scar-draw-b', 'lion_king_zazu', 'minion', '0'),
                        makeCard('eligible-minion', 'frozen_snowgie', 'minion', '0'),
                        makeCard('too-large', 'lion_king_mufasa', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [
                makeMinion('scar', 'lion_king_scar', '0', 5),
                makeMinion('cub', 'lion_king_lion_cub', '0', 2),
                makeMinion('other-cub', 'lion_king_lion_cub', '0', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('lion_king_scar', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'scar',
            defId: 'lion_king_scar',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 37,
        });
        const destroyed = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'cub',
            '刀疤消灭幼狮',
            '0',
            FIXED_RANDOM,
        );
        const reactionPrompt = getReactionPrompt(destroyed.finalState);
        const cubOption = getReactionPromptOptionBySourceDefId(destroyed.finalState, reactionPrompt, 'lion_king_lion_cub');
        const searched = respondToPrompt(destroyed.finalState, cubOption.id, '0', FIXED_RANDOM);

        expect(searched.success).toBe(true);
        expect(searched.finalState.core.players['0'].hand.map(card => card.uid)).toContain('eligible-minion');
        expect(searched.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['too-large']);
        expect(searched.finalState.core.triggerQueue).toBeUndefined();
        expect(searched.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ playerId: '0', cardUids: ['eligible-minion'] }),
        }));
    });

    it('花木兰：集体训练给己方全场角色放指示物，金宝保护己方角色不受敌方影响', () => {
        const core = makeState({
            bases: [
                makeBase('base_training_camp', [
                    makeMinion('chien-po', 'mulan_chien_po', '0', 3),
                    makeMinion('ally', 'mulan_mushu', '0', 2),
                    makeMinion('enemy', 'frozen_snowgie', '1', 2),
                ]),
                makeBase('base_forbidden_city', [
                    makeMinion('mulan', 'mulan_mulan', '0', 5),
                ]),
            ],
        });

        const groupTraining = invokeRegisteredAbilityContract('mulan_group_training', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'group-training',
            defId: 'mulan_group_training',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 40,
        });
        const trained = applyEvents(core, groupTraining.events);
        expect(trained.bases.flatMap(base => base.minions)
            .filter(minion => minion.controller === '0')
            .map(minion => [minion.uid, minion.powerCounters ?? 0]))
            .toEqual([
                ['chien-po', 1],
                ['ally', 1],
                ['mulan', 1],
            ]);
        expect(trained.bases[0].minions.find(minion => minion.uid === 'enemy')?.powerCounters ?? 0).toBe(0);

        expect(isMinionProtected(core, core.bases[0].minions[1], 0, '1', 'affect', { sourceKind: 'action' })).toBe(true);
        expect(isMinionProtected(core, core.bases[0].minions[1], 0, '0', 'affect', { sourceKind: 'action' })).toBe(false);
    });
});
