import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { fireTriggers, isCardSuppressed, isMinionProtected } from '../../domain/ongoingEffects';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import { startSmashUpReactionSession } from '../../domain/reactionSession';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    isAbilityRuntimeContinuationEvent,
    resumeAbilityRuntimeContinuationEvent,
} from '../../domain/abilityRuntime';
import { SHIELD_CARDS } from '../../data/factions/shield';
import { SPIDER_VERSE_CARDS } from '../../data/factions/spider_verse';
import { ULTIMATES_CARDS } from '../../data/factions/ultimates';
import {
    applyEvents,
    expectRegisteredAbilityContract,
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

function attachBeforeScoringReactionSession(
    matchState: ReturnType<typeof makeMatchState>,
    sourceBaseIndex: number,
): ReturnType<typeof makeMatchState> {
    matchState.sys.phase = 'scoreBases';
    return startSmashUpReactionSession(matchState, {
        frameId: `score-before:${sourceBaseIndex}:great-power-test`,
        frameKind: 'score-before',
        phase: 'optional',
        activePlayerId: '0',
        currentPlayerId: '0',
        consecutivePasses: 0,
        sourceBaseIndex,
        responseWindowType: 'meFirst',
    });
}

describe('漫威第一波新增派系代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('神盾局、蜘蛛宇宙、终极战队静态牌数和代表能力入口已注册', () => {
        expect(SHIELD_CARDS).toHaveLength(12);
        expect(SHIELD_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(SHIELD_CARDS.map(card => card.previewRef?.index)).toEqual(
            Array.from({ length: 12 }, (_, index) => index + 18),
        );

        expect(SPIDER_VERSE_CARDS).toHaveLength(12);
        expect(SPIDER_VERSE_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(SPIDER_VERSE_CARDS.map(card => card.previewRef?.index)).toEqual(
            Array.from({ length: 12 }, (_, index) => index + 30),
        );

        expect(ULTIMATES_CARDS).toHaveLength(12);
        expect(ULTIMATES_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(ULTIMATES_CARDS.map(card => card.previewRef?.index)).toEqual(
            Array.from({ length: 12 }, (_, index) => index + 42),
        );

        const registrations = [
            ['shield_nick_fury', 'onPlay'],
            ['shield_mission_debriefing', 'onPlay'],
            ['shield_rescue_mission', 'special'],
            ['spider_verse_friendly_neighborhood_hero', 'special'],
            ['spider_verse_spider_sense', 'special'],
            ['spider_verse_with_great_power', 'onPlay'],
            ['ultimates_captain_marvel', 'talent'],
            ['ultimates_heroic_landing', 'onPlay'],
            ['ultimates_power_and_speed', 'onPlay'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('尼克-弗瑞、菲尔-科尔森、进入点、试验场和空投部队授予限定额外角色额度', () => {
        const core = makeState({
            bases: [makeBase('base_juice_bar')],
        });
        const baseCtx = {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'source',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        };

        const nick = invokeRegisteredAbilityContract('shield_nick_fury', 'onPlay', {
            ...baseCtx,
            defId: 'shield_nick_fury',
        });
        expect(nick.events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    limitType: 'minion',
                    restrictToBase: 0,
                    reason: 'shield_nick_fury',
                }),
            }),
        ]);

        const coulson = invokeRegisteredAbilityContract('shield_phil_coulson', 'onPlay', {
            ...baseCtx,
            defId: 'shield_phil_coulson',
        });
        expect(coulson.events[0]).toMatchObject({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: { limitType: 'minion', restrictToBase: 0, powerMax: 2 },
        });

        const entryPoint = invokeRegisteredAbilityContract('shield_entry_point', 'onPlay', {
            ...baseCtx,
            defId: 'shield_entry_point',
        });
        expect(entryPoint.events[0]).toMatchObject({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                limitType: 'minion',
                reason: 'shield_entry_point',
            },
        });
        expect(entryPoint.events[0]?.payload).not.toHaveProperty('restrictToBase');
        expect(entryPoint.events[0]?.payload).not.toHaveProperty('powerMax');

        const provingGround = invokeRegisteredAbilityContract('shield_proving_ground', 'talent', {
            ...baseCtx,
            cardUid: 'proving-ground',
            defId: 'shield_proving_ground',
        });
        expect(provingGround.events[0]).toMatchObject({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: { limitType: 'minion', restrictToBase: 0, powerMax: 3 },
        });

        const troopDrop = invokeRegisteredAbilityContract('shield_troop_drop', 'onPlay', {
            ...baseCtx,
            defId: 'shield_troop_drop',
        });
        expect(troopDrop.events[0]).toMatchObject({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: { limitType: 'minion', powerMax: 3 },
        });
    });

    it('神盾局调任可移动至多两个己方其他基地角色到目标基地', () => {
        const core = makeState({
            bases: [
                makeBase('base_juice_bar', [makeMinion('target-base-ally', 'shield_agent', '0', 2)]),
                makeBase('base_moon_dumpster', [
                    makeMinion('agent-a', 'shield_agent', '0', 2),
                    makeMinion('agent-b', 'shield_phil_coulson', '0', 3),
                    makeMinion('enemy', 'spider_verse_spider_man_2099', '1', 2),
                ]),
            ],
        });
        const result = invokeRegisteredAbilityContract('shield_reassignment', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'reassignment',
            defId: 'shield_reassignment',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'shield_reassignment');
        const optionIds = prompt.options
            .filter((option: any) => ['agent-a', 'agent-b'].includes(option.value?.minionUid))
            .map((option: any) => option.id);
        const moved = respondToPromptOption(
            result.matchState!,
            (option: any) => optionIds.includes(option.id),
            'move the first selected agent',
            '0',
            FIXED_RANDOM,
        );

        expect(moved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'agent-a',
                    fromBaseIndex: 1,
                    toBaseIndex: 0,
                }),
            }),
        ]));
    });

    it('强大的火力可消灭低力量角色或基地神器', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base_juice_bar',
                minions: [
                    makeMinion('small-target', 'shield_agent', '1', 2),
                    makeMinion('big-target', 'shield_nick_fury', '1', 5),
                ],
                ongoingActions: [{ uid: 'proving-ground', defId: 'shield_proving_ground', ownerId: '1' }],
            })],
        });

        const destroyMinion = invokeRegisteredAbilityContract('shield_superior_firepower', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'firepower-minion',
            defId: 'shield_superior_firepower',
            baseIndex: 0,
            targetMinionUid: 'small-target',
            random: FIXED_RANDOM,
            now: 25,
        });
        expect(destroyMinion.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: expect.objectContaining({ minionUid: 'small-target' }),
            }),
        ]));

        const chooseTarget = invokeRegisteredAbilityContract('shield_superior_firepower', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'firepower-ongoing',
            defId: 'shield_superior_firepower',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 26,
        });
        const prompt = getSimpleChoicePrompt(chooseTarget.matchState!, 'shield_superior_firepower');
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'big-target')).toBe(false);
        const detached = respondToPromptOption(
            chooseTarget.matchState!,
            (option: any) => option.value?.cardUid === 'proving-ground',
            'destroy Proving Ground',
            '0',
            FIXED_RANDOM,
        );
        expect(detached.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: expect.objectContaining({
                    cardUid: 'proving-ground',
                    defId: 'shield_proving_ground',
                    ownerId: '1',
                    reason: 'shield_superior_firepower',
                }),
            }),
        ]));
    });

    it('任务汇报按目标基地己方角色数量抽牌，空基地不会抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'shield_agent', 'minion', '0'),
                        makeCard('draw-b', 'shield_together', 'action', '0'),
                        makeCard('draw-c', 'shield_entry_point', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('ally-a', 'shield_agent', '0', 2),
                    makeMinion('ally-b', 'shield_phil_coulson', '0', 3),
                    makeMinion('enemy', 'spider_verse_spider_man_2099', '1', 2),
                ]),
                makeBase('base_moon_dumpster', [
                    makeMinion('enemy-only', 'spider_verse_spider_man_2099', '1', 2),
                ]),
            ],
        });
        const mission = invokeRegisteredAbilityContract('shield_mission_debriefing', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mission',
            defId: 'shield_mission_debriefing',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        });
        expect(mission.events[0]).toMatchObject({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: '0', count: 2, cardUids: ['draw-a', 'draw-b'] },
        });

        const emptyMission = invokeRegisteredAbilityContract('shield_mission_debriefing', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mission-empty',
            defId: 'shield_mission_debriefing',
            baseIndex: 0,
            targetBaseIndex: 1,
            random: FIXED_RANDOM,
            now: 31,
        });
        expect(emptyMission.events).toEqual([]);
    });

    it('神盾局探员、玛丽亚-希尔和并肩作战正确提供临时力量', () => {
        const core = makeState({
            bases: [makeBase('base_juice_bar', [
                makeMinion('agent', 'shield_agent', '0', 2),
                makeMinion('maria', 'shield_maria_hill', '0', 4),
                makeMinion('ally', 'shield_phil_coulson', '0', 3),
                makeMinion('enemy', 'shield_agent', '1', 2),
            ])],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(3);
        expect(getEffectivePower(core, core.bases[0].minions[3], 0)).toBe(2);

        const together = invokeRegisteredAbilityContract('shield_together', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'together',
            defId: 'shield_together',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        });
        expect(together.events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toHaveLength(3);

        const mariaTrigger = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            sourceCardUid: 'maria',
            sourceDefId: 'shield_maria_hill',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            triggerMinionUid: 'new-agent',
            triggerMinionDefId: 'shield_agent',
            triggerMinion: makeMinion('new-agent', 'shield_agent', '0', 2),
            random: FIXED_RANDOM,
            now: 31,
        });
        expect(mariaTrigger.events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({ minionUid: 'maria', amount: 1 }),
            }),
        ]);
    });

    it('救援任务和你的好邻居英雄把己方角色放回牌库顶并继续抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'shield_agent', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar', [
                makeMinion('ally-a', 'shield_agent', '0', 2),
                makeMinion('ally-b', 'shield_phil_coulson', '0', 3),
                makeMinion('enemy', 'spider_verse_spider_man_2099', '1', 2),
            ])],
        });
        const rescue = invokeRegisteredAbilityContract('shield_rescue_mission', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'rescue',
            defId: 'shield_rescue_mission',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 40,
        });
        const rescueTopEvents = rescue.events.filter(event => event.type === SU_EVENTS.CARD_TO_DECK_TOP);
        const rescueContinuation = rescue.events.find(event => isAbilityRuntimeContinuationEvent(event as any));
        expect(rescueTopEvents).toHaveLength(2);
        expect(rescueContinuation).toBeTruthy();
        expect(rescue.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        const resumedRescue = resumeAbilityRuntimeContinuationEvent(
            makeMatchState(applyEvents(core, rescueTopEvents as any)),
            rescueContinuation as any,
            FIXED_RANDOM,
        );
        expect(resumedRescue?.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', count: 1 }),
            }),
        ]));

        const hero = invokeRegisteredAbilityContract('spider_verse_friendly_neighborhood_hero', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'hero',
            defId: 'spider_verse_friendly_neighborhood_hero',
            baseIndex: 0,
            targetBaseIndex: 0,
            targetMinionUid: 'ally-b',
            random: FIXED_RANDOM,
            now: 41,
        });
        expect(hero.events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.CARD_TO_DECK_TOP,
                payload: expect.objectContaining({ cardUid: 'ally-b' }),
            }),
        ]);
    });

    it('蜘蛛宇宙的抽牌、特殊加力、附着力量修正和 2099 保护生效', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-a', 'spider_verse_spider_reflexes', 'action', '0'),
                        makeCard('deck-b', 'spider_verse_spider_sense', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar', [
                makeMinion('spider-2099', 'spider_verse_spider_man_2099', '0', 2, {
                    attachedActions: [{ uid: 'bond', defId: 'spider_verse_bond', ownerId: '0' }],
                }),
                makeMinion('ally', 'spider_verse_ghost_spider', '0', 4),
                makeMinion('enemy', 'shield_agent', '1', 2, {
                    attachedActions: [{ uid: 'webbed', defId: 'spider_verse_webbed_up', ownerId: '0' }],
                }),
            ])],
        });

        const sense = invokeRegisteredAbilityContract('spider_verse_spider_sense', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sense',
            defId: 'spider_verse_spider_sense',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 50,
        });
        expect(sense.events[0]).toMatchObject({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: '0', count: 2, cardUids: ['deck-a', 'deck-b'] },
        });

        const greatPower = invokeRegisteredAbilityContract('spider_verse_with_great_power', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'great-power',
            defId: 'spider_verse_with_great_power',
            baseIndex: 0,
            targetMinionUid: 'spider-2099',
            random: FIXED_RANDOM,
            now: 51,
        });
        expect(greatPower.events[0]).toMatchObject({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: { minionUid: 'spider-2099', amount: 2 },
        });

        const promptedGreatPower = invokeRegisteredAbilityContract('spider_verse_with_great_power', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'great-power-prompt',
            defId: 'spider_verse_with_great_power',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 52,
        });
        const prompt = getSimpleChoicePrompt(promptedGreatPower.matchState!, 'spider_verse_with_great_power');
        expect(getPromptOptions(prompt).some(option => option.value?.minionUid === 'spider-2099')).toBe(true);
        expect(getPromptOptions(prompt).some(option => option.value?.minionUid === 'enemy')).toBe(true);

        const promptedOtherBaseCore = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('here', 'spider_verse_spider_man_2099', '0', 2),
                ]),
                makeBase('base_moon_dumpster', [
                    makeMinion('there', 'shield_agent', '1', 2),
                ]),
            ],
        });
        const specialPrompt = invokeRegisteredAbilityContract('spider_verse_with_great_power', 'special', {
            state: promptedOtherBaseCore,
            matchState: makeMatchState(promptedOtherBaseCore),
            playerId: '0',
            cardUid: 'great-power-special',
            defId: 'spider_verse_with_great_power',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 53,
        });
        const specialOptions = getPromptOptions(getSimpleChoicePrompt(specialPrompt.matchState!, 'spider_verse_with_great_power'));
        expect(specialOptions.some(option => option.value?.minionUid === 'here')).toBe(true);
        expect(specialOptions.some(option => option.value?.minionUid === 'there')).toBe(false);

        const specialResolved = respondToPromptOption(
            specialPrompt.matchState!,
            option => option.value?.minionUid === 'here',
            '能力越大特殊目标',
            '0',
            FIXED_RANDOM,
        );
        expect(specialResolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'here', amount: 2 }),
        }));

        const responseWindowCore = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('response-here', 'spider_verse_spider_man_2099', '0', 2),
                    makeMinion('response-enemy-here', 'shield_agent', '1', 2),
                ]),
                makeBase('base_moon_dumpster', [
                    makeMinion('response-there', 'shield_agent', '1', 2),
                ]),
            ],
        });
        const responseWindowPlayed = invokeRegisteredAbilityContract('spider_verse_with_great_power', 'onPlay', {
            state: responseWindowCore,
            matchState: attachBeforeScoringReactionSession(makeMatchState(responseWindowCore), 0),
            playerId: '0',
            cardUid: 'great-power-response',
            defId: 'spider_verse_with_great_power',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 54,
        });
        const responseOptions = getPromptOptions(
            getSimpleChoicePrompt(responseWindowPlayed.matchState!, 'spider_verse_with_great_power'),
        );
        expect(responseOptions.some(option => option.value?.minionUid === 'response-here')).toBe(true);
        expect(responseOptions.some(option => option.value?.minionUid === 'response-enemy-here')).toBe(true);
        expect(responseOptions.some(option => option.value?.minionUid === 'response-there')).toBe(false);

        const responseResolved = respondToPromptOption(
            responseWindowPlayed.matchState!,
            option => option.value?.minionUid === 'response-here',
            '能力越大响应窗口目标',
            '0',
            FIXED_RANDOM,
        );
        expect(responseResolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'response-here', amount: 2, sourceBaseIndex: 0 }),
        }));

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(3);
        expect(getEffectivePower(core, core.bases[0].minions[2], 0)).toBe(0);
        expect(isCardSuppressed(core, 'enemy')).toBe(true);
        expect(isCardSuppressed(core, 'ally')).toBe(false);
        expect(isMinionProtected(core, core.bases[0].minions[0], 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, core.bases[0].minions[0], 0, '0', 'destroy')).toBe(false);
    });

    it('蜘蛛侠-平行宇宙和束缚分别修正力量并压制敌方卡牌能力', () => {
        const core = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('bonded', 'spider_verse_miles_morales', '0', 2, {
                        attachedActions: [{ uid: 'bond', defId: 'spider_verse_bond', ownerId: '0' }],
                    }),
                    makeMinion('webbed-enemy', 'shield_agent', '1', 2, {
                        attachedActions: [{ uid: 'webbed-enemy-action', defId: 'spider_verse_webbed_up', ownerId: '0' }],
                    }),
                    makeMinion('same-base-ally', 'spider_verse_ghost_spider', '0', 4),
                ]),
                makeBase('base_moon_dumpster', [
                    makeMinion('unwebbed-ally', 'shield_agent', '0', 2),
                ]),
            ],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(3);
        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(0);
        expect(getEffectivePower(core, core.bases[1].minions[0], 1)).toBe(2);
        expect(isCardSuppressed(core, 'webbed-enemy')).toBe(true);
        expect(isCardSuppressed(core, 'unwebbed-ally')).toBe(false);
        expect(isCardSuppressed(core, 'same-base-ally')).toBe(false);
        expect(isCardSuppressed(core, 'bonded')).toBe(false);
    });

    it('蜘蛛反应、幽灵蜘蛛侠和高处不胜寒会检查牌库并抽取命中的牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-a', 'spider_verse_spider_sense', 'action', '0'),
                        makeCard('deck-b', 'spider_verse_spider_man', 'minion', '0'),
                        makeCard('deck-c', 'shield_agent', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar')],
        });

        const reflexes = invokeRegisteredAbilityContract('spider_verse_spider_reflexes', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'reflexes',
            defId: 'spider_verse_spider_reflexes',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 52,
        });
        expect(reflexes.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.DECK_INSPECTED }),
            expect.objectContaining({ type: SU_EVENTS.REVEAL_DECK_TOP }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({ limitType: 'action', reason: 'spider_verse_spider_reflexes' }),
            }),
        ]));
        const reflexesPickPrompt = getSimpleChoicePrompt(reflexes.matchState!, 'spider_verse_spider_reflexes_pick');
        const pickedReflexes = respondToPromptOption(
            reflexes.matchState!,
            (option: any) => option.value?.cardUid === 'deck-a',
            'spider reflexes deck-a option',
            '0',
            FIXED_RANDOM,
        );
        expect(pickedReflexes.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', count: 1, cardUids: ['deck-a'] }),
            }),
        ]));
        expect(reflexesPickPrompt.options.map((option: any) => option.value?.cardUid)).toEqual([
            'deck-a',
            'deck-b',
            'deck-c',
        ]);
        const reflexesOrderPrompt = getSimpleChoicePrompt(pickedReflexes.finalState, 'spider_verse_spider_reflexes_order');
        expect(reflexesOrderPrompt.options).not.toHaveLength(0);
        const reflexesOrder = respondToPromptOption(
            pickedReflexes.finalState,
            (option: any) =>
                option.value?.topUids?.join(',') === 'deck-b'
                && option.value?.bottomUids?.join(',') === 'deck-c',
            'spider reflexes remaining top/bottom order',
            '0',
            FIXED_RANDOM,
        );
        expect(reflexesOrder.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.DECK_REORDERED,
                payload: expect.objectContaining({ playerId: '0', deckUids: ['deck-b', 'deck-c'] }),
            }),
        ]));

        const ghost = invokeRegisteredAbilityContract('spider_verse_ghost_spider', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'ghost',
            defId: 'spider_verse_ghost_spider',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 53,
        });
        expect(ghost.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.DECK_INSPECTED }),
        ]));
        const ghostPickPrompt = getSimpleChoicePrompt(ghost.matchState!, 'spider_verse_ghost_spider_pick');
        expect(ghostPickPrompt.options.map((option: any) => option.value?.cardUid)).toEqual([
            'deck-a',
            'deck-b',
            'deck-c',
        ]);
        const pickedGhost = respondToPromptOption(
            ghost.matchState!,
            (option: any) => option.value?.cardUid === 'deck-b',
            'ghost spider deck-b option',
            '0',
            FIXED_RANDOM,
        );
        expect(pickedGhost.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', count: 1, cardUids: ['deck-b'] }),
            }),
        ]));
        const ghostOrderPrompt = getSimpleChoicePrompt(pickedGhost.finalState, 'spider_verse_ghost_spider_order');
        expect(ghostOrderPrompt.options).not.toHaveLength(0);
        const orderedGhost = respondToPromptOption(
            pickedGhost.finalState,
            (option: any) =>
                option.value?.topUids?.join(',') === 'deck-c,deck-a'
                && option.value?.bottomUids?.length === 0,
            'ghost spider remaining deck top order',
            '0',
            FIXED_RANDOM,
        );
        expect(orderedGhost.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.DECK_REORDERED,
                payload: expect.objectContaining({ playerId: '0', deckUids: ['deck-c', 'deck-a'] }),
            }),
        ]));

        const view = invokeRegisteredAbilityContract('spider_verse_view_from_above', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'view',
            defId: 'spider_verse_view_from_above',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 54,
        });
        expect(view.events).toEqual([]);
        const viewPrompt = getSimpleChoicePrompt(view.matchState!, 'spider_verse_view_from_above');
        expect(viewPrompt.options.map((option: any) => option.label)).toEqual([
            'ui.spider_verse_view_from_above_minion_option',
            'ui.spider_verse_view_from_above_action_option',
        ]);
        expect(viewPrompt.options.map((option: any) => option.value?.cardType)).toEqual(['minion', 'action']);
        const declaredMinion = respondToPromptOption(
            view.matchState!,
            (option: any) => option.value?.cardType === 'minion',
            'view from above declares minion',
            '0',
            FIXED_RANDOM,
        );
        expect(declaredMinion.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.DECK_INSPECTED }),
            expect.objectContaining({ type: SU_EVENTS.REVEAL_DECK_TOP }),
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', count: 1, cardUids: ['deck-b'] }),
            }),
        ]));
        expect(declaredMinion.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.DECK_REORDERED,
                payload: expect.objectContaining({ playerId: '0', deckUids: ['deck-c', 'deck-b', 'deck-a'] }),
            }),
        ]));
        expect(declaredMinion.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-c', 'deck-a']);

        const declaredAction = respondToPromptOption(
            view.matchState!,
            (option: any) => option.value?.cardType === 'action',
            'view from above declares action',
            '0',
            FIXED_RANDOM,
        );
        expect(declaredAction.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', count: 1, cardUids: ['deck-a'] }),
            }),
        ]));
    });

    it('蜘蛛侠在己方打出有特殊能力的牌后获得 +1 力量直到回合结束', () => {
        const core = makeState({
            bases: [makeBase('base_juice_bar', [
                makeMinion('spider-man', 'spider_verse_spider_man', '0', 5),
            ])],
        });

        const ownSpecialAction = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            sourceCardUid: 'spider-man',
            sourceDefId: 'spider_verse_spider_man',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            triggerCardUid: 'sense',
            triggerCardDefId: 'spider_verse_spider_sense',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 55,
        });
        expect(ownSpecialAction.events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({ minionUid: 'spider-man', amount: 1 }),
            }),
        ]);

        const ordinaryAction = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            sourceCardUid: 'spider-man',
            sourceDefId: 'spider_verse_spider_man',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            triggerCardUid: 'ordinary',
            triggerCardDefId: 'shield_together',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 56,
        });
        expect(ordinaryAction.events).toEqual([]);

        const opponentSpecialAction = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            sourceCardUid: 'spider-man',
            sourceDefId: 'spider_verse_spider_man',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            triggerCardUid: 'enemy-sense',
            triggerCardDefId: 'spider_verse_spider_sense',
            triggerCardOwnerId: '1',
            random: FIXED_RANDOM,
            now: 57,
        });
        expect(opponentSpecialAction.events).toEqual([]);
    });

    it('迈尔斯·莫拉莱斯只在计分前特殊进场时给自己 -1 力量', () => {
        const core = makeState({
            bases: [makeBase('base_juice_bar', [
                makeMinion('ally', 'spider_verse_ghost_spider', '0', 4),
            ])],
        });
        const meFirstState = makeMatchState(core);
        meFirstState.sys.phase = 'scoreBases';
        (meFirstState.sys as any).responseWindow = {
            current: {
                windowType: 'meFirst',
                responderQueue: ['0', '1'],
                currentResponderIndex: 0,
                sourceBaseIndex: 0,
                passedPlayers: [],
            },
        };

        const specialPlayed = invokeRegisteredAbilityContract('spider_verse_miles_morales', 'onPlay', {
            state: core,
            matchState: meFirstState,
            playerId: '0',
            cardUid: 'miles',
            defId: 'spider_verse_miles_morales',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 58,
        });
        expect(specialPlayed.events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({
                    minionUid: 'miles',
                    baseIndex: 0,
                    amount: -1,
                    reason: 'spider_verse_miles_morales',
                }),
            }),
        ]);

        const ordinaryPlayed = invokeRegisteredAbilityContract('spider_verse_miles_morales', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'miles',
            defId: 'spider_verse_miles_morales',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 59,
        });
        expect(ordinaryPlayed.events).toEqual([]);
    });

    it('…责任越大会让额外打出的角色 -1 力量直到回合结束', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('responsibility', 'spider_verse_great_responsibility', 'action', '0'),
                        makeCard('extra-minion', 'spider_verse_ghost_spider', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar')],
        });

        const playedAction = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'responsibility' } },
            FIXED_RANDOM,
        );
        expect(playedAction.success, playedAction.error).toBe(true);
        expect(playedAction.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    limitType: 'minion',
                    reason: 'spider_verse_great_responsibility',
                }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.MINION_PLAY_EFFECT_QUEUED,
                payload: expect.objectContaining({
                    effect: 'addTempPower',
                    amount: -1,
                    reason: 'spider_verse_great_responsibility',
                }),
            }),
        ]));

        const playedExtraMinion = runCommand(
            playedAction.finalState,
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'extra-minion', baseIndex: 0 } },
            FIXED_RANDOM,
        );
        expect(playedExtraMinion.success, playedExtraMinion.error).toBe(true);
        expect(playedExtraMinion.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({
                    minionUid: 'extra-minion',
                    amount: -1,
                    reason: 'spider_verse_great_responsibility',
                }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.MINION_PLAY_EFFECT_CONSUMED,
                payload: expect.objectContaining({ playerId: '0' }),
            }),
        ]));
        expect(playedExtraMinion.finalState.core.players['0'].pendingMinionPlayEffects ?? []).toHaveLength(0);
    });

    it('惊奇队长移动自身后只给目标基地原有其他己方角色 +1', () => {
        const core = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('captain', 'ultimates_captain_marvel', '0', 5),
                    makeMinion('left-behind', 'ultimates_spectrum', '0', 4),
                ]),
                makeBase('base_moon_dumpster', [
                    makeMinion('destination-ally', 'ultimates_blue_marvel', '0', 2),
                    makeMinion('destination-enemy', 'shield_agent', '1', 2),
                ]),
            ],
        });
        const talent = invokeRegisteredAbilityContract('ultimates_captain_marvel', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'captain',
            defId: 'ultimates_captain_marvel',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 60,
        });
        const moved = respondToPromptOption(
            talent.matchState!,
            (option: any) => option.value?.baseIndex === 1,
            'move Captain Marvel',
            '0',
            FIXED_RANDOM,
        );

        expect(moved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({ minionUid: 'captain', toBaseIndex: 1 }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({ minionUid: 'destination-ally', amount: 1 }),
            }),
        ]));
        expect(moved.events.some(
            event => event.type === SU_EVENTS.TEMP_POWER_ADDED
                && (event as any).payload.minionUid === 'captain',
        )).toBe(false);
    });

    it('终极战队移动与抽换牌代表能力按当前状态生成事件', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('hand-a', 'ultimates_power_and_speed', 'action', '0'),
                        makeCard('hand-b', 'ultimates_first_to_arrive', 'action', '0'),
                    ],
                    deck: [
                        makeCard('deck-a', 'ultimates_spectrum', 'minion', '0'),
                        makeCard('deck-b', 'ultimates_blue_marvel', 'minion', '0'),
                        makeCard('deck-c', 'ultimates_america_chavez', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('ally-a', 'ultimates_spectrum', '0', 4),
                    makeMinion('target', 'ultimates_america_chavez', '0', 3),
                ]),
                makeBase('base_moon_dumpster', [makeMinion('ally-b', 'ultimates_blue_marvel', '0', 2)]),
                makeBase('base_tar_pits'),
            ],
        });

        const coordinated = invokeRegisteredAbilityContract('ultimates_coordinated_attack', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'coordinated',
            defId: 'ultimates_coordinated_attack',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 70,
        });
        expect(coordinated.events).toHaveLength(0);
        const coordinatedPrompt = getSimpleChoicePrompt(coordinated.matchState!, 'ultimates_coordinated_attack');
        const coordinatedOptionIds = coordinatedPrompt.options
            .filter((option: any) => ['ally-b'].includes(option.value?.minionUid))
            .map((option: any) => option.id);
        const resolvedCoordinated = respondToPromptOptions(
            coordinated.matchState!,
            coordinatedOptionIds,
            '0',
            FIXED_RANDOM,
        );
        expect(resolvedCoordinated.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({ minionUid: 'ally-b', toBaseIndex: 0 }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({ minionUid: 'ally-b', amount: 1 }),
            }),
        ]));
        expect(resolvedCoordinated.events.some(
            event => event.type === SU_EVENTS.MINION_MOVED
                && (event as any).payload.minionUid === 'ally-a',
        )).toBe(false);

        const knowledge = invokeRegisteredAbilityContract('ultimates_cosmic_knowledge', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'knowledge',
            defId: 'ultimates_cosmic_knowledge',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 71,
        });
        const knowledgePrompt = getSimpleChoicePrompt(knowledge.matchState!, 'ultimates_cosmic_knowledge');
        const selectedHandOptionIds = knowledgePrompt.options
            .filter((option: any) => ['hand-a', 'hand-b'].includes(option.value?.cardUid))
            .map((option: any) => option.id);
        const resolvedKnowledge = respondToPromptOptions(
            knowledge.matchState!,
            selectedHandOptionIds,
            '0',
            FIXED_RANDOM,
        );
        expect(resolvedKnowledge.events.filter(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toHaveLength(2);
        expect(resolvedKnowledge.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ count: 3, cardUids: ['deck-a', 'deck-b', 'deck-c'] }),
            }),
        ]));

        const powerAndSpeed = invokeRegisteredAbilityContract('ultimates_power_and_speed', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'power-speed',
            defId: 'ultimates_power_and_speed',
            baseIndex: 0,
            targetMinionUid: 'target',
            random: FIXED_RANDOM,
            now: 72,
        });
        expect(powerAndSpeed.events[0]).toMatchObject({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: { minionUid: 'target', amount: 2 },
        });
        expect(getSimpleChoicePrompt(powerAndSpeed.matchState!, 'ultimates_power_and_speed_move')).toBeDefined();
    });

    it('举起搬运可移动任意目标角色，打乱普通/特殊模式只移动己方角色', () => {
        const core = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('enemy-target', 'shield_agent', '1', 2),
                    makeMinion('own-first', 'ultimates_spectrum', '0', 4),
                    makeMinion('own-second', 'ultimates_blue_marvel', '0', 2),
                ]),
                makeBase('base_moon_dumpster'),
            ],
        });
        const baseCtx = {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'source',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 120,
        };

        const lift = invokeRegisteredAbilityContract('ultimates_lift_and_carry', 'onPlay', {
            ...baseCtx,
            cardUid: 'lift',
            defId: 'ultimates_lift_and_carry',
            targetMinionUid: 'enemy-target',
        });
        const lifted = respondToPromptOption(
            lift.matchState!,
            option => option.value?.baseIndex === 1,
            'move enemy target with Lift and Carry',
            '0',
            FIXED_RANDOM,
        );
        expect(lifted.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'enemy-target',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'ultimates_lift_and_carry',
                }),
            }),
        ]));
        expect(lifted.finalState.core.bases[1].minions.map(minion => minion.uid)).toContain('enemy-target');

        const invalidScramble = invokeRegisteredAbilityContract('ultimates_scramble', 'onPlay', {
            ...baseCtx,
            cardUid: 'invalid-scramble',
            defId: 'ultimates_scramble',
            targetMinionUid: 'enemy-target',
            now: 121,
        });
        expect(invalidScramble.events).toEqual([]);
        expect(invalidScramble.matchState).toBeUndefined();

        const scramble = invokeRegisteredAbilityContract('ultimates_scramble', 'onPlay', {
            ...baseCtx,
            cardUid: 'scramble',
            defId: 'ultimates_scramble',
            targetMinionUid: 'own-first',
            now: 122,
        });
        const scrambled = respondToPromptOption(
            scramble.matchState!,
            option => option.value?.baseIndex === 1,
            'move default own minion with Scramble',
            '0',
            FIXED_RANDOM,
        );
        expect(scrambled.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'own-first',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'ultimates_scramble',
                }),
            }),
        ]));
        expect(scrambled.finalState.core.bases[1].minions.map(minion => minion.uid)).toContain('own-first');

        const specialScramble = invokeRegisteredAbilityContract('ultimates_scramble', 'special', {
            ...baseCtx,
            cardUid: 'scramble-special',
            defId: 'ultimates_scramble',
            targetMinionUid: 'own-second',
            now: 123,
        });
        const resolvedSpecial = respondToPromptOption(
            specialScramble.matchState!,
            option => option.value?.baseIndex === 1,
            'move selected own minion with special Scramble',
            '0',
            FIXED_RANDOM,
        );
        expect(resolvedSpecial.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'own-second',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'ultimates_scramble',
                }),
            }),
        ]));
        expect(resolvedSpecial.finalState.core.bases[1].minions.map(minion => minion.uid)).toContain('own-second');
    });

    it('搬运从真实出牌命令进入目标随从选择后的目标基地交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('lift', 'ultimates_lift_and_carry', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_juice_bar', [makeMinion('target', 'shield_agent', '1', 2)]),
                makeBase('base_moon_dumpster'),
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'lift', targetMinionUid: 'target' },
            },
            FIXED_RANDOM,
        );

        expect(played.success, played.error).toBe(true);
        expect(getSimpleChoicePrompt(played.finalState, 'ultimates_lift_and_carry_destination')).toBeDefined();
    });

    it('最先到达只给没有己方角色的基地额外角色额度，英雄登场可连续移动并跳过收口', () => {
        const firstCore = makeState({
            bases: [
                makeBase('base_juice_bar', [makeMinion('ally', 'ultimates_spectrum', '0', 4)]),
                makeBase('base_moon_dumpster', [makeMinion('enemy', 'shield_agent', '1', 2)]),
            ],
        });
        const first = invokeRegisteredAbilityContract('ultimates_first_to_arrive', 'onPlay', {
            state: firstCore,
            matchState: makeMatchState(firstCore),
            playerId: '0',
            cardUid: 'first',
            defId: 'ultimates_first_to_arrive',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 130,
        });
        expect(first.events[0]).toMatchObject({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                limitType: 'minion',
                restrictToBase: 1,
                reason: 'ultimates_first_to_arrive',
            },
        });

        const multipleCore = makeState({
            bases: [
                makeBase('base_juice_bar', [makeMinion('enemy-a', 'shield_agent', '1', 2)]),
                makeBase('base_moon_dumpster', [makeMinion('enemy-b', 'shield_agent', '1', 2)]),
            ],
        });
        const multiple = invokeRegisteredAbilityContract('ultimates_first_to_arrive', 'onPlay', {
            state: multipleCore,
            matchState: makeMatchState(multipleCore),
            playerId: '0',
            cardUid: 'first-choice',
            defId: 'ultimates_first_to_arrive',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 1301,
        });
        expect(multiple.events).toEqual([]);
        const firstPrompt = getSimpleChoicePrompt(multiple.matchState!, 'ultimates_first_to_arrive');
        expect(getPromptOptions(firstPrompt).map(option => option.value?.baseIndex)).toEqual([0, 1]);
        const selectedSecondBase = respondToPromptOption(
            multiple.matchState!,
            option => option.value?.baseIndex === 1,
            'second legal base for First to Arrive',
            '0',
            FIXED_RANDOM,
        );
        expect(selectedSecondBase.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    limitType: 'minion',
                    restrictToBase: 1,
                    reason: 'ultimates_first_to_arrive',
                }),
            }),
        ]));

        const fullCore = makeState({
            bases: [
                makeBase('base_juice_bar', [makeMinion('ally-a', 'ultimates_spectrum', '0', 4)]),
                makeBase('base_moon_dumpster', [makeMinion('ally-b', 'ultimates_blue_marvel', '0', 2)]),
            ],
        });
        const noFirst = invokeRegisteredAbilityContract('ultimates_first_to_arrive', 'onPlay', {
            state: fullCore,
            matchState: makeMatchState(fullCore),
            playerId: '0',
            cardUid: 'first-none',
            defId: 'ultimates_first_to_arrive',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 131,
        });
        expect(noFirst.events).toEqual([]);

        const landingCore = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('move-a', 'ultimates_spectrum', '0', 4),
                    makeMinion('move-b', 'ultimates_blue_marvel', '0', 2),
                ]),
                makeBase('base_moon_dumpster'),
            ],
        });
        const landing = invokeRegisteredAbilityContract('ultimates_heroic_landing', 'onPlay', {
            state: landingCore,
            matchState: makeMatchState(landingCore),
            playerId: '0',
            cardUid: 'landing',
            defId: 'ultimates_heroic_landing',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 132,
        });
        const selectedFirst = respondToPromptOption(
            landing.matchState!,
            option => option.value?.minionUid === 'move-a',
            'choose first heroic landing minion',
            '0',
            FIXED_RANDOM,
        );
        const movedFirst = respondToPromptOption(
            selectedFirst.finalState,
            option => option.value?.baseIndex === 1,
            'move first heroic landing minion',
            '0',
            FIXED_RANDOM,
        );
        expect(movedFirst.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'move-a',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'ultimates_heroic_landing',
                }),
            }),
        ]));
        const sourcePrompt = getSimpleChoicePrompt(movedFirst.finalState, 'ultimates_heroic_landing_source');
        expect(sourcePrompt.options.some(option => option.value?.minionUid === 'move-a')).toBe(false);
        expect(sourcePrompt.options.some(option => option.value?.minionUid === 'move-b')).toBe(true);
        const skipped = respondToPromptOption(
            movedFirst.finalState,
            option => option.value?.skip === true,
            'skip remaining heroic landing moves',
            '0',
            FIXED_RANDOM,
        );
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['move-b']);
        expect(skipped.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['move-a']);
    });

    it('美国小姐和蓝奇响应移动持续获得临时力量', () => {
        const core = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('america', 'ultimates_america_chavez', '0', 3),
                    makeMinion('blue', 'ultimates_blue_marvel', '0', 2),
                    makeMinion('ally', 'ultimates_spectrum', '0', 4),
                ]),
                makeBase('base_moon_dumpster'),
            ],
        });

        const america = fireTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            sourceCardUid: 'america',
            sourceDefId: 'ultimates_america_chavez',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            moveFromBaseIndex: 0,
            moveToBaseIndex: 1,
            triggerMinionUid: 'ally',
            triggerMinionDefId: 'ultimates_spectrum',
            triggerMinion: core.bases[0].minions[2],
            random: FIXED_RANDOM,
            now: 80,
        });
        expect(america.events[0]).toMatchObject({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: { minionUid: 'america', amount: 1 },
        });

        const blue = fireTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            sourceCardUid: 'blue',
            sourceDefId: 'ultimates_blue_marvel',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            moveFromBaseIndex: 0,
            moveToBaseIndex: 1,
            triggerMinionUid: 'blue',
            triggerMinionDefId: 'ultimates_blue_marvel',
            triggerMinion: core.bases[0].minions[1],
            random: FIXED_RANDOM,
            now: 81,
        });
        expect(blue.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({ minionUid: 'blue', baseIndex: 1, amount: 1 }),
            }),
        ]));
    });

    it('盟国的援助在己方角色移动到所在基地后每个移动批次抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-a', 'ultimates_spectrum', 'minion', '0'),
                        makeCard('deck-b', 'ultimates_blue_marvel', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_juice_bar',
                    minions: [],
                    ongoingActions: [{ uid: 'aid', defId: 'ultimates_aid_from_allies', ownerId: '0' }],
                }),
                makeBase('base_moon_dumpster', [
                    makeMinion('ally-a', 'ultimates_spectrum', '0', 4),
                    makeMinion('ally-b', 'ultimates_blue_marvel', '0', 2),
                    makeMinion('enemy', 'shield_agent', '1', 2),
                ]),
            ],
        });

        const firstBatch = fireTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            sourceCardUid: 'aid',
            sourceDefId: 'ultimates_aid_from_allies',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            moveFromBaseIndex: 1,
            moveToBaseIndex: 0,
            simultaneousMoveBatchMinionUids: ['ally-a', 'ally-b'],
            sourceEventId: 'move-batch-1',
            triggerMinionUid: 'ally-a',
            triggerMinionDefId: 'ultimates_spectrum',
            triggerMinion: core.bases[1].minions[0],
            random: FIXED_RANDOM,
            now: 82,
        });
        expect(firstBatch.events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', count: 1, cardUids: ['deck-a'] }),
            }),
        ]);

        const opponentMove = fireTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            sourceCardUid: 'aid',
            sourceDefId: 'ultimates_aid_from_allies',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            moveFromBaseIndex: 1,
            moveToBaseIndex: 0,
            sourceEventId: 'move-batch-2',
            triggerMinionUid: 'enemy',
            triggerMinionDefId: 'shield_agent',
            triggerMinion: core.bases[1].minions[2],
            random: FIXED_RANDOM,
            now: 83,
        });
        expect(opponentMove.events).toEqual([]);
    });
});
