import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { BIG_HERO_6_CARDS } from '../../data/factions/big_hero_6';
import { FROZEN_CARDS } from '../../data/factions/frozen';
import { LION_KING_CARDS } from '../../data/factions/lion_king';
import { MULAN_CARDS } from '../../data/factions/mulan';
import { getEffectivePower, getPlayerEffectivePowerOnBase } from '../../domain/ongoingModifiers';
import { getModifiedBaseVp, isMinionProtected } from '../../domain/ongoingEffects';
import type { AbilityTag } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { runCommand } from '../testRunner';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    getPromptOption,
    getPromptHandlerData,
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
    respondToPromptOptions,
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
                    discard: [
                        makeCard('discarded-swarm-a', 'big_hero_6_microbot_swarm', 'minion', '0'),
                        makeCard('discarded-swarm-b', 'big_hero_6_microbot_swarm', 'minion', '0'),
                    ],
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
        expect(recovered.events).toEqual([]);
        const recoveredPrompt = getSimpleChoicePrompt(recovered.matchState!, 'disney_four_factions_prompt');
        expect(recoveredPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(recoveredPrompt).map(option => option.value?.cardUid)).toEqual(['discarded-swarm-a', 'discarded-swarm-b']);
        const recoveredSwarm = respondToPromptOption(
            recovered.matchState!,
            option => option.value?.cardUid === 'discarded-swarm-b',
            '微型机器群弃牌堆目标',
            '0',
            FIXED_RANDOM,
        );
        expect(recoveredSwarm.success, recoveredSwarm.error).toBe(true);
        expect(recoveredSwarm.finalState.core.players['0'].hand.map(card => card.uid)).toContain('discarded-swarm-b');
        expect(recoveredSwarm.finalState.core.players['0'].discard.map(card => card.uid)).toContain('discarded-swarm-a');

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

    it('超能陆战队：控制面具搜微型机器群时由玩家选择，不自动拿第一张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('swarm-first', 'big_hero_6_microbot_swarm', 'minion', '0'),
                        makeCard('swarm-chosen', 'big_hero_6_microbot_swarm', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('big_hero_6_control_mask', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'control-mask',
            defId: 'big_hero_6_control_mask',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 15,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'disney_four_factions_prompt');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual(['swarm-first', 'swarm-chosen']);

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'swarm-chosen',
            '控制面具选择第二张微型机器群',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('swarm-chosen');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toContain('swarm-first');
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

    it('超能陆战队：大白计分后必须选择要移动的己方角色和目标基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_sfit_robotics_lab', [
                    makeMinion('baymax', 'big_hero_6_baymax', '0', 3, { powerCounters: 1 }),
                    makeMinion('first-ally', 'big_hero_6_microbot_swarm', '0', 2),
                    makeMinion('chosen-ally', 'big_hero_6_hiro_hamada', '0', 2),
                ]),
                makeBase('base_arendelle'),
            ],
        });

        const result = invokeRegisteredAbilityContract('big_hero_6_baymax', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'baymax',
            defId: 'big_hero_6_baymax',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 16,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        const targetPrompt = getSimpleChoicePrompt(result.matchState!, 'disney_four_factions_prompt');
        expect(targetPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(targetPrompt).map(option => option.value?.minionUid)).toEqual(['first-ally', 'chosen-ally']);

        const choseTarget = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'chosen-ally',
            '大白移动目标',
            '0',
            FIXED_RANDOM,
        );
        const destinationPrompt = getSimpleChoicePrompt(choseTarget.finalState, 'disney_four_factions_prompt');
        const moved = respondToPromptOption(
            choseTarget.finalState,
            option => option.value?.baseIndex === 1,
            '大白目标基地',
            '0',
            FIXED_RANDOM,
        );

        expect(destinationPrompt.targetType).toBe('base');
        expect(moved.success, moved.error).toBe(true);
        expect(moved.finalState.core.bases[0].minions.some(minion => minion.uid === 'first-ally')).toBe(true);
        expect(moved.finalState.core.bases[0].minions.some(minion => minion.uid === 'chosen-ally')).toBe(false);
        expect(moved.finalState.core.bases[1].minions.some(minion => minion.uid === 'chosen-ally')).toBe(true);
    });

    it('超能陆战队：妖怪计分后必须选择是否和谁接收力量标记', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_sfit_robotics_lab', [
                    makeMinion('yokai', 'big_hero_6_yokai', '0', 4, { powerCounters: 1 }),
                    makeMinion('source-ally', 'big_hero_6_microbot_swarm', '0', 2, { powerCounters: 1 }),
                ]),
                makeBase('base_arendelle', [
                    makeMinion('first-receiver', 'frozen_snowgie', '0', 2),
                    makeMinion('chosen-receiver', 'frozen_olaf', '0', 3),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('big_hero_6_yokai', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'yokai',
            defId: 'big_hero_6_yokai',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 17,
        });

        expect(result.events).toEqual([]);
        const receiverPrompt = getSimpleChoicePrompt(result.matchState!, 'disney_four_factions_prompt');
        expect(receiverPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(receiverPrompt).map(option => option.value?.minionUid ?? option.id)).toEqual(['first-receiver', 'chosen-receiver', 'skip']);

        const movedCounters = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'chosen-receiver',
            '妖怪接收者',
            '0',
            FIXED_RANDOM,
        );

        expect(movedCounters.success, movedCounters.error).toBe(true);
        expect(movedCounters.finalState.core.bases[0].minions.find(minion => minion.uid === 'yokai')?.powerCounters ?? 0).toBe(0);
        expect(movedCounters.finalState.core.bases[0].minions.find(minion => minion.uid === 'source-ally')?.powerCounters ?? 0).toBe(0);
        expect(movedCounters.finalState.core.bases[1].minions.find(minion => minion.uid === 'first-receiver')?.powerCounters ?? 0).toBe(0);
        expect(movedCounters.finalState.core.bases[1].minions.find(minion => minion.uid === 'chosen-receiver')?.powerCounters ?? 0).toBe(2);
    });

    it('冰雪奇缘：雪宝必须先选择要移动的己方角色，不能自动移动第一个角色', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('olaf-draw', 'frozen_snowgie', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_arendelle', [
                    makeMinion('first-ally', 'frozen_snowgie', '0', 2),
                    makeMinion('chosen-ally', 'frozen_olaf', '0', 3),
                ]),
                makeBase('base_ice_palace'),
            ],
        });

        const olaf = invokeRegisteredAbilityContract('frozen_olaf', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'olaf',
            defId: 'frozen_olaf',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 24,
        });

        expect(olaf.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        const targetPrompt = getSimpleChoicePrompt(olaf.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(targetPrompt).map(option => option.value?.minionUid)).toEqual(['first-ally', 'chosen-ally']);

        const choseTarget = respondToPromptOption(
            olaf.matchState!,
            option => option.value?.minionUid === 'chosen-ally',
            '雪宝移动目标',
            '0',
            FIXED_RANDOM,
        );
        const destinationPrompt = getSimpleChoicePrompt(choseTarget.finalState, 'disney_four_factions_prompt');
        const moved = respondToPromptOption(
            choseTarget.finalState,
            option => option.value?.baseIndex === 1,
            '雪宝目标基地',
            '0',
            FIXED_RANDOM,
        );

        expect(destinationPrompt.targetType).toBe('base');
        expect(moved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({ minionUid: 'chosen-ally', fromBaseIndex: 0, toBaseIndex: 1 }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['olaf-draw'] }),
            }),
        ]));
        expect(moved.finalState.core.bases[0].minions.some(minion => minion.uid === 'first-ally')).toBe(true);
        expect(moved.finalState.core.bases[1].minions.some(minion => minion.uid === 'chosen-ally')).toBe(true);
    });

    it('冰雪奇缘：斯文可跳过弃牌堆回收，不应自动拿第一张合格角色', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('first-low-power', 'frozen_snowgie', 'minion', '0'),
                        makeCard('second-low-power', 'frozen_olaf', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('frozen_sven', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sven',
            defId: 'frozen_sven',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 26,
        });

        expect(result.events).toEqual([]);
        const promptedAfterDraw = { ...result.matchState!, core: applyEvents(core, result.events) };
        const prompt = getSimpleChoicePrompt(promptedAfterDraw, 'disney_four_factions_prompt');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptHandlerData(prompt).multi).toEqual({ min: 0, max: 1 });
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid ?? option.id)).toEqual(['first-low-power', 'second-low-power', 'skip']);

        const skipped = respondToPromptOption(
            promptedAfterDraw,
            option => option.id === 'skip',
            '斯文跳过',
            '0',
            FIXED_RANDOM,
        );
        expect(skipped.success, skipped.error).toBe(true);
        expect(skipped.finalState.core.players['0'].hand).toEqual([]);
        expect(skipped.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['first-low-power', 'second-low-power']);
    });

    it('冰雪奇缘：你想堆雪人吗必须从牌库和弃牌堆合并候选中选择至多两张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-snowgie', 'frozen_snowgie', 'minion', '0'),
                        makeCard('deck-other', 'frozen_olaf', 'minion', '0'),
                    ],
                    discard: [
                        makeCard('discard-snowgie-a', 'frozen_snowgie', 'minion', '0'),
                        makeCard('discard-snowgie-b', 'frozen_snowgie', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('frozen_do_you_want_to_build_a_snowman', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'snowman',
            defId: 'frozen_do_you_want_to_build_a_snowman',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 27,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'disney_four_factions_prompt');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(prompt.targetType).toBe('generic');
        expect(getPromptHandlerData(prompt).genericIntent).toBe('card-pool');
        expect(getPromptHandlerData(prompt).multi).toEqual({ min: 0, max: 2 });
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid ?? option.id)).toEqual(['discard-snowgie-a', 'discard-snowgie-b', 'deck-snowgie', 'skip']);

        const selected = getPromptOptions(prompt)
            .filter(option => ['discard-snowgie-b', 'deck-snowgie'].includes(option.value?.cardUid))
            .map(option => option.id);
        const resolved = respondToPromptOptions(result.matchState!, selected, '0', FIXED_RANDOM);

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['discard-snowgie-b', 'deck-snowgie']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-snowgie-a']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-other']);

        const noInteractionResult = invokeRegisteredAbilityContract('frozen_do_you_want_to_build_a_snowman', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'snowman',
            defId: 'frozen_do_you_want_to_build_a_snowman',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 28,
        });
        expect(noInteractionResult.events).toEqual([]);
    });

    it('冰雪奇缘：放手吧必须选择要返回的己方角色，不能自动返回第一个角色', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_arendelle', [
                makeMinion('first-ally', 'frozen_snowgie', '0', 2),
                makeMinion('chosen-ally', 'frozen_olaf', '0', 3),
            ])],
        });

        const letItGo = invokeRegisteredAbilityContract('frozen_let_it_go', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'let-it-go',
            defId: 'frozen_let_it_go',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 25,
        });

        expect(letItGo.events.some(event => event.type === SU_EVENTS.MINION_RETURNED)).toBe(false);
        const targetPrompt = getSimpleChoicePrompt(letItGo.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(targetPrompt).map(option => option.value?.minionUid)).toEqual(['first-ally', 'chosen-ally']);

        const resolved = respondToPromptOption(
            letItGo.matchState!,
            option => option.value?.minionUid === 'chosen-ally',
            '放手吧返回目标',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_RETURNED,
                payload: expect.objectContaining({ minionUid: 'chosen-ally', fromBaseIndex: 0 }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({ playerId: '0', limitType: 'action' }),
            }),
        ]));
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'first-ally')).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'chosen-ally')).toBe(false);
    });

    it('冰雪奇缘：冻结的港口不阻止打出角色，冰宫减力和安娜保护按同基地条件生效', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('saucy', 'pirate_saucy_wench', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_ice_palace',
                minions: [
                    makeMinion('anna', 'frozen_anna', '1', 4),
                ],
                ongoingActions: [{ uid: 'port', defId: 'frozen_frozen_port', ownerId: '1' }],
            })],
        });
        const anna = core.bases[0].minions[0];

        expect(isMinionProtected(core, anna, 0, '0', 'affect', { sourceKind: 'action' })).toBe(false);
        expect(isMinionProtected(core, anna, 0, '0', 'move', { sourceKind: 'action' })).toBe(true);

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'saucy', baseIndex: 0 },
        } as any, FIXED_RANDOM);

        expect(played.success, played.error).toBe(true);
        const after = played.finalState.core;
        const playedAnna = after.bases[0].minions.find(minion => minion.uid === 'anna');
        const saucy = after.bases[0].minions.find(minion => minion.uid === 'saucy');
        expect(saucy).toBeTruthy();
        expect(playedAnna ? getEffectivePower(after, playedAnna, 0) : undefined).toBe(3);
        expect(saucy ? getEffectivePower(after, saucy, 0) : undefined).toBe(2);

        const withKristoff = makeState({
            bases: [makeBase('base_ice_palace', [
                makeMinion('protected-anna', 'frozen_anna', '1', 4),
                makeMinion('kristoff', 'frozen_kristoff', '1', 4),
                makeMinion('enemy', 'pirate_saucy_wench', '0', 3),
            ])],
        });
        const protectedAnna = withKristoff.bases[0].minions[0];
        expect(isMinionProtected(withKristoff, protectedAnna, 0, '0', 'affect', { sourceKind: 'action' })).toBe(true);
        expect(isMinionProtected(withKristoff, protectedAnna, 0, '1', 'affect', { sourceKind: 'action' })).toBe(false);
    });

    it('冰雪奇缘：阿伦黛尔只在基地计分 VP 奖励时给最多角色玩家额外 1 VP', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_arendelle', [
                makeMinion('first-mate', 'pirate_first_mate', '0', 2),
                makeMinion('anna', 'frozen_anna', '1', 4),
                makeMinion('snowgie', 'frozen_snowgie', '1', 2),
            ])],
        });

        expect(getModifiedBaseVp(core, 0, '0', 3)).toBe(3);
        expect(getModifiedBaseVp(core, 0, '1', 2)).toBe(3);
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

    it('狮子王：拉飞奇必须选择力量 2 或更低的弃牌堆角色，不能自动拿第一张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('first-cub', 'lion_king_lion_cub', 'minion', '0'),
                        makeCard('chosen-snowgie', 'frozen_snowgie', 'minion', '0'),
                        makeCard('too-strong', 'frozen_olaf', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('lion_king_rafiki', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'rafiki',
            defId: 'lion_king_rafiki',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 32,
        });

        expect(result.events).toEqual([]);
        const promptedAfterDraw = { ...result.matchState!, core: applyEvents(core, result.events) };
        const prompt = getSimpleChoicePrompt(promptedAfterDraw, 'disney_four_factions_prompt');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual(['first-cub', 'chosen-snowgie']);

        const resolved = respondToPromptOption(
            promptedAfterDraw,
            option => option.value?.cardUid === 'chosen-snowgie',
            '拉飞奇回收目标',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['chosen-snowgie']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['first-cub', 'too-strong']);
    });

    it('狮子王：哈库那玛塔塔先抽两张，再让玩家选择是否回收丁满和彭彭', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'frozen_snowgie', 'minion', '0'),
                        makeCard('draw-b', 'lion_king_zazu', 'minion', '0'),
                    ],
                    discard: [
                        makeCard('timon-first', 'lion_king_timon_and_pumbaa', 'minion', '0'),
                        makeCard('timon-chosen', 'lion_king_timon_and_pumbaa', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('lion_king_hakuna_matata', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'hakuna',
            defId: 'lion_king_hakuna_matata',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 33,
        });

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ playerId: '0', cardUids: ['draw-a', 'draw-b'] }),
        }));
        expect(result.events.some(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(false);
        const promptedAfterDraw = { ...result.matchState!, core: applyEvents(core, result.events) };
        const prompt = getSimpleChoicePrompt(promptedAfterDraw, 'disney_four_factions_prompt');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptHandlerData(prompt).multi).toEqual({ min: 0, max: 1 });
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid ?? option.id)).toEqual(['timon-first', 'timon-chosen', 'skip']);

        const recovered = respondToPromptOption(
            promptedAfterDraw,
            option => option.value?.cardUid === 'timon-chosen',
            '哈库那玛塔塔回收目标',
            '0',
            FIXED_RANDOM,
        );

        expect(recovered.success, recovered.error).toBe(true);
        expect(recovered.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b', 'timon-chosen']);
        expect(recovered.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['timon-first']);
    });

    it('狮子王：鬣狗巢穴计分后必须选择要移动的己方角色', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('mufasa-discard', 'lion_king_mufasa', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_pride_rock',
                    minions: [
                        makeMinion('first-ally', 'lion_king_zazu', '0', 2),
                        makeMinion('chosen-ally', 'lion_king_nala', '0', 4),
                    ],
                    ongoingActions: [{ uid: 'hyenas-den', defId: 'lion_king_hyenas_den', ownerId: '0' }],
                }),
                makeBase('base_elephant_graveyard'),
            ],
        });

        const hyenasDen = invokeRegisteredAbilityContract('lion_king_hyenas_den', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'hyenas-den',
            defId: 'lion_king_hyenas_den',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 31,
        });

        expect(hyenasDen.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        const targetPrompt = getSimpleChoicePrompt(hyenasDen.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(targetPrompt).map(option => option.value?.minionUid)).toEqual(['first-ally', 'chosen-ally']);

        const choseTarget = respondToPromptOption(
            hyenasDen.matchState!,
            option => option.value?.minionUid === 'chosen-ally',
            '鬣狗巢穴移动目标',
            '0',
            FIXED_RANDOM,
        );
        const moved = respondToPromptOption(
            choseTarget.finalState,
            option => option.value?.baseIndex === 1,
            '鬣狗巢穴目标基地',
            '0',
            FIXED_RANDOM,
        );

        expect(moved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({ minionUid: 'chosen-ally', fromBaseIndex: 0, toBaseIndex: 1 }),
        }));
        expect(moved.finalState.core.bases[0].minions.some(minion => minion.uid === 'first-ally')).toBe(true);
        expect(moved.finalState.core.bases[1].minions.some(minion => minion.uid === 'chosen-ally')).toBe(true);
    });

    it('狮子王：牛羚踩踏必须选择要摧毁的己方角色，再选择牌库角色', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-first', 'lion_king_zazu', 'minion', '0'),
                        makeCard('deck-second', 'lion_king_lion_cub', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_pride_rock', [
                makeMinion('first-ally', 'lion_king_zazu', '0', 2),
                makeMinion('chosen-ally', 'lion_king_nala', '0', 4),
            ])],
        });

        const stampede = invokeRegisteredAbilityContract('lion_king_wildebeest_stampede', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'stampede',
            defId: 'lion_king_wildebeest_stampede',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 35,
        });

        expect(stampede.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const destroyPrompt = getSimpleChoicePrompt(stampede.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(destroyPrompt).map(option => option.value?.minionUid)).toEqual(['first-ally', 'chosen-ally']);

        const destroyed = respondToPromptOption(
            stampede.matchState!,
            option => option.value?.minionUid === 'chosen-ally',
            '牛羚踩踏摧毁目标',
            '0',
            FIXED_RANDOM,
        );

        expect(destroyed.finalState.core.bases[0].minions.some(minion => minion.uid === 'first-ally')).toBe(true);
        expect(destroyed.finalState.core.bases[0].minions.some(minion => minion.uid === 'chosen-ally')).toBe(false);

        const deckPrompt = getSimpleChoicePrompt(destroyed.finalState, 'disney_four_factions_prompt');
        expect(getPromptOptions(deckPrompt).map(option => option.value?.cardUid)).toEqual(['deck-first', 'deck-second']);
        const played = respondToPromptOption(
            destroyed.finalState,
            option => option.value?.cardUid === 'deck-second',
            '牛羚踩踏牌库角色',
            '0',
            FIXED_RANDOM,
        );

        expect(played.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_PLAYED,
            payload: expect.objectContaining({ cardUid: 'deck-second', defId: 'lion_king_lion_cub', baseIndex: 0 }),
        }));
    });

    it('狮子王：幼狮搜牌库时由玩家选择力量不超过 4 的角色，不自动拿第一张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('first-eligible', 'lion_king_zazu', 'minion', '0'),
                        makeCard('chosen-eligible', 'frozen_snowgie', 'minion', '0'),
                        makeCard('too-large', 'lion_king_mufasa', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('lion_king_lion_cub', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'cub',
            defId: 'lion_king_lion_cub',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 35,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'disney_four_factions_prompt');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual(['first-eligible', 'chosen-eligible']);

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'chosen-eligible',
            '幼狮牌库目标',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['chosen-eligible']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['first-eligible', 'too-large']);
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
                        makeCard('first-eligible-minion', 'lion_king_zazu', 'minion', '0'),
                        makeCard('chosen-eligible-minion', 'frozen_snowgie', 'minion', '0'),
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
        const prompted = respondToPrompt(destroyed.finalState, cubOption.id, '0', FIXED_RANDOM);

        expect(prompted.success, prompted.error).toBe(true);
        const searchPrompt = getSimpleChoicePrompt(prompted.finalState, 'disney_four_factions_prompt');
        expect(searchPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(searchPrompt).map(option => option.value?.cardUid)).toEqual(['first-eligible-minion', 'chosen-eligible-minion']);

        const searched = respondToPromptOption(
            prompted.finalState,
            option => option.value?.cardUid === 'chosen-eligible-minion',
            '幼狮触发牌库目标',
            '0',
            FIXED_RANDOM,
        );

        expect(searched.success, searched.error).toBe(true);
        expect(searched.finalState.core.players['0'].hand.map(card => card.uid)).toContain('chosen-eligible-minion');
        expect(searched.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['first-eligible-minion', 'too-large']);
        expect(searched.finalState.core.triggerQueue).toBeUndefined();
        expect(searched.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ playerId: '0', cardUids: ['chosen-eligible-minion'] }),
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

    it('花木兰：成为一个男人和木兰本人都通过每回合天赋入口结算', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'frozen_snowgie', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_training_camp',
                minions: [
                    makeMinion('mulan', 'mulan_mulan', '0', 5),
                    makeMinion('ally', 'mulan_mushu', '0', 2),
                    makeMinion('enemy', 'frozen_snowgie', '1', 2),
                ],
                ongoingActions: [{ uid: 'be-a-man', defId: 'mulan_be_a_man', ownerId: '0' }],
            })],
        });

        const beAMan = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'be-a-man', baseIndex: 0 },
        } as any, FIXED_RANDOM);
        expect(beAMan.success, beAMan.error).toBe(true);
        const counterPrompt = getSimpleChoicePrompt(beAMan.finalState, 'disney_four_factions_prompt');
        expect(counterPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(counterPrompt).map(option => option.value?.minionUid)).toEqual(['mulan', 'ally']);
        const selectedOptionIds = getPromptOptions(counterPrompt)
            .filter(option => ['mulan', 'ally'].includes(option.value?.minionUid))
            .map(option => option.id);
        const countered = respondToPromptOptions(beAMan.finalState, selectedOptionIds, '0', FIXED_RANDOM);
        expect(countered.success, countered.error).toBe(true);
        expect(countered.finalState.core.bases[0].minions.find(minion => minion.uid === 'mulan')?.powerCounters).toBe(1);
        expect(countered.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally')?.powerCounters).toBe(1);
        expect(countered.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy')?.powerCounters ?? 0).toBe(0);

        const mulanTalent = runCommand(countered.finalState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'mulan', baseIndex: 0 },
        } as any, FIXED_RANDOM);
        expect(mulanTalent.success, mulanTalent.error).toBe(true);
        const modePrompt = getSimpleChoicePrompt(mulanTalent.finalState, 'disney_four_factions_prompt');
        expect(modePrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(modePrompt).map(option => option.value?.mode)).toEqual(['extra_action', 'draw_card']);
        const extraAction = respondToPromptOption(
            mulanTalent.finalState,
            option => option.value?.mode === 'extra_action',
            '木兰额外行动',
            '0',
            FIXED_RANDOM,
        );
        expect(extraAction.success, extraAction.error).toBe(true);
        expect(extraAction.events).toContainEqual(expect.objectContaining({
            type: 'su:limit_modified',
            payload: expect.objectContaining({ playerId: '0', limitType: 'action', delta: 1 }),
        }));
    });

    it('花木兰：二选一效果保留玩家选择，并可结算抽牌分支和额外角色分支', () => {
        const mulanCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('mulan-draw', 'frozen_snowgie', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_training_camp', [
                makeMinion('mulan', 'mulan_mulan', '0', 5, {
                    powerCounters: 1,
                    metadata: { mulan_mulan_power_counter_turn: 1 },
                }),
            ])],
        });

        const mulanTalent = runCommand(makeMatchState(mulanCore), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'mulan', baseIndex: 0 },
        } as any, FIXED_RANDOM);
        expect(mulanTalent.success, mulanTalent.error).toBe(true);
        const mulanPrompt = getSimpleChoicePrompt(mulanTalent.finalState, 'disney_four_factions_prompt');
        expect(mulanPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(mulanPrompt).map(option => option.value?.mode)).toEqual(['extra_action', 'draw_card']);

        const drawn = respondToPromptOption(
            mulanTalent.finalState,
            option => option.value?.mode === 'draw_card',
            '木兰选择抽牌',
            '0',
            FIXED_RANDOM,
        );
        expect(drawn.success, drawn.error).toBe(true);
        expect(drawn.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['mulan-draw']);
        expect(drawn.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);

        const recruitsCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('recruit-draw-a', 'frozen_snowgie', 'minion', '0'),
                        makeCard('recruit-draw-b', 'lion_king_zazu', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const recruits = invokeRegisteredAbilityContract('mulan_call_up_new_recruits', 'onPlay', {
            state: recruitsCore,
            matchState: makeMatchState(recruitsCore),
            playerId: '0',
            cardUid: 'call-up',
            defId: 'mulan_call_up_new_recruits',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 41,
        });
        const recruitsPrompt = getSimpleChoicePrompt(recruits.matchState!, 'disney_four_factions_prompt');
        expect(recruitsPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(recruitsPrompt).map(option => option.value?.mode)).toEqual(['extra_minion_power_4', 'draw_two']);

        const drewTwo = respondToPromptOption(
            recruits.matchState!,
            option => option.value?.mode === 'draw_two',
            '招收新兵选择抽两张',
            '0',
            FIXED_RANDOM,
        );
        expect(drewTwo.success, drewTwo.error).toBe(true);
        expect(drewTwo.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['recruit-draw-a', 'recruit-draw-b']);
        expect(drewTwo.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);

        const extraRecruits = invokeRegisteredAbilityContract('mulan_call_up_new_recruits', 'onPlay', {
            state: recruitsCore,
            matchState: makeMatchState(recruitsCore),
            playerId: '0',
            cardUid: 'call-up',
            defId: 'mulan_call_up_new_recruits',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 42,
        });
        const extraMinion = respondToPromptOption(
            extraRecruits.matchState!,
            option => option.value?.mode === 'extra_minion_power_4',
            '招收新兵选择额外角色',
            '0',
            FIXED_RANDOM,
        );
        expect(extraMinion.success, extraMinion.error).toBe(true);
        expect(extraMinion.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'minion',
                powerMax: 4,
            }),
        }));
        expect(extraMinion.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
    });
});
