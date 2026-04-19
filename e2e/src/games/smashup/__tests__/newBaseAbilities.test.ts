/**
 * 大杀四方 - 新增基地能力测试
 *
 * 覆盖：
 * - base_haunted_house_al9000: onMinionPlayed 弃一张牌
 * - base_the_field_of_honor: onMinionDestroyed 消灭者获1VP
 * - base_the_workshop: onActionPlayed 额外行动额度
 * - base_crypt: onMinionDestroyed 控制者抽牌
 * - base_tar_pits: onMinionDestroyed 放入牌库底
 * - base_haunted_house: afterScoring 冠军弃手牌抽5
 * - base_temple_of_goju: afterScoring 最高力量随从放牌库底
 * - base_great_library: afterScoring 有随从的玩家抽牌
 * - base_ritual_site: afterScoring 随从洗回牌库
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { initAllAbilities } from '../abilities';
import {
    triggerBaseAbility,
    triggerExtendedBaseAbility,
} from '../domain/baseAbilities';
import { collectTriggers, fireTriggers } from '../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { processDestroyTriggers } from '../domain/reducer';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import type { MatchState, RandomFn } from '../../../engine/types';
import type { SmashUpCore, MinionOnBase, CardInstance, MinionDestroyedEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import {
    triggerBaseAbilityWithMS,
    getInteractionsFromMS,
    getInteractionsFromResult,
    makeMatchState,
    findInteractionOption,
    resolveInteractionChain,
} from './helpers';
import { buildBuryCardEvents } from '../domain/bury';
import { reduce } from '../domain/reduce';
import { runCommand, defaultTestRandom } from './testRunner';

const dummyRandom: RandomFn = defaultTestRandom;

beforeAll(() => {
    initAllAbilities();
});

function resolveDuelChain(
    initialState: ReturnType<typeof makeMatchState>,
    overrides: Partial<Record<string, (prompt: any, state: ReturnType<typeof makeMatchState>, step: number) => { optionId?: string; optionIds?: string[]; mergedValue?: unknown }>> = {},
) {
    return resolveInteractionChain(initialState, (prompt, state, step) => {
        const sourceId = prompt?.data?.sourceId as string | undefined;
        const custom = sourceId ? overrides[sourceId] : undefined;
        if (custom) return custom(prompt, state, step);

        if (sourceId === 'smashup_duel_pinkerton') {
            const option = findInteractionOption(prompt, entry => entry?.value?.amount === 0);
            if (!option) throw new Error('未找到 Pinkerton 的 0 指示物选项');
            return { optionId: option.id };
        }
        if (sourceId === 'smashup_duel_card' || sourceId === 'smashup_duel_deputy_card') {
            const option = findInteractionOption(prompt, entry => entry?.value?.skip === true);
            if (!option) throw new Error(`未找到 ${sourceId} 的跳过选项`);
            return { optionId: option.id };
        }
        if (sourceId === 'smashup_duel_run_em_off_move') {
            return { optionId: prompt.data.options[0].id };
        }

        throw new Error(`未处理的决斗交互 sourceId: ${sourceId ?? 'unknown'}`);
    }, dummyRandom);
}

describe('new base extra timing regression coverage', () => {
    it('base_the_workshop marks off-phase extra actions as immediate', () => {
        const core = makeState({
            bases: [{
                defId: 'base_the_workshop',
                minions: [],
                ongoingActions: [],
            }],
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'startTurn';

        const result = triggerBaseAbilityWithMS('base_the_workshop', 'onActionPlayed', {
            state: core,
            matchState: ms,
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            actionTargetBaseIndex: 0,
            now: 1000,
        } as BaseAbilityContext);

        expect((result.events[0] as any).payload.playTiming).toBe('immediate');
    });
});

/** 构造最小测试状态 */
function makeState(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    return {
        players: {},
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    } as SmashUpCore;
}

function makeMinion(uid: string, controller: string, power: number, defId = 'd1'): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
    };
}

function makeCard(uid: string, owner: string, defId = 'test_card'): CardInstance {
    return { uid, defId, type: 'minion', owner };
}

// ============================================================================
// base_haunted_house_al9000: 鬼屋 - 随从入场后弃一张牌
// ============================================================================

describe('base_haunted_house_al9000: 随从入场后弃牌', () => {
    it('打出随从后触发弃牌事件', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_haunted_house_al9000',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('h1', '0'), makeCard('h2', '0')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house_al9000',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'd1',
            minionPower: 3,
            now: 1000,
        };

        const result = triggerBaseAbilityWithMS('base_haunted_house_al9000', 'onMinionPlayed', ctx);
        expect(result.events.length).toBe(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions.length).toBe(1);
        expect(interactions[0].data.sourceId).toBe('base_haunted_house_al9000');
    });

    it('手牌为空时不触发弃牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_haunted_house_al9000',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house_al9000',
            playerId: '0',
            minionUid: 'm1',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', ctx);
        expect(events.length).toBe(0);
    });
});


// ============================================================================
// base_the_field_of_honor: 荣誉之地 - 消灭者获1VP
// ============================================================================

describe('base_the_field_of_honor: 消灭者获1VP', () => {
    it('有消灭者时触发VP奖励', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_field_of_honor',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_field_of_honor',
            playerId: '1', // 被消灭随从的拥有者
            destroyerId: '0', // 消灭者
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_the_field_of_honor', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.VP_AWARDED);
        expect((events[0] as any).payload.playerId).toBe('0'); // 消灭者获得VP
        expect((events[0] as any).payload.amount).toBe(1);
    });

    it('无消灭者时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_field_of_honor',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_field_of_honor',
            playerId: '1',
            // destroyerId 未设置
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_the_field_of_honor', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(0);
    });

    it('同一张牌一次性消灭多个随从只给 1VP（按 FAQ，管线层 batch）', () => {
        const core = makeState({
            bases: [{
                defId: 'base_the_field_of_honor',
                minions: [
                    { uid: 'victim-1', defId: 'v1', controller: '1', owner: '1', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    { uid: 'victim-2', defId: 'v2', controller: '1', owner: '1', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                ],
                ongoingActions: [],
            }],
            players: {
                '0': { id: '0', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
                '1': { id: '1', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            } as any,
        });
        const ms = makeMatchState(core);
        const events = [
            { type: SU_EVENTS.MINION_DESTROYED, payload: { minionUid: 'victim-1', minionDefId: 'v1', fromBaseIndex: 0, ownerId: '1', destroyerId: '0', reason: 'powderkeg' }, timestamp: 1000 },
            { type: SU_EVENTS.MINION_DESTROYED, payload: { minionUid: 'victim-2', minionDefId: 'v2', fromBaseIndex: 0, ownerId: '1', destroyerId: '0', reason: 'powderkeg' }, timestamp: 1000 },
        ] as any;
        const res = processDestroyTriggers(events, ms, '0', () => 0.5, 1000);
        const vpEvents = res.events.filter((e: any) => e.type === SU_EVENTS.VP_AWARDED);
        expect(vpEvents).toHaveLength(1);
        expect(vpEvents[0].payload.playerId).toBe('0');
        expect(vpEvents[0].payload.amount).toBe(1);
    });

    it('集成路径：destroyerId 缺失时，VP 仍应判给当前操作者控制的随从一侧', () => {
        const victim = {
            uid: 'victim',
            defId: 'victim_minion',
            controller: '1',
            owner: '0',
            basePower: 3,
            powerCounters: 0,
            powerModifier: 0,
            tempPowerModifier: 0,
            talentUsed: false,
            attachedActions: [],
        } as MinionOnBase;
        const core = makeState({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.BEAR_CAVALRY, SMASHUP_FACTION_IDS.NINJAS],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.BEAR_CAVALRY, SMASHUP_FACTION_IDS.NINJAS],
                },
            },
            bases: [{
                defId: 'base_the_field_of_honor',
                minions: [victim],
                ongoingActions: [],
            }],
        });
        const ms: MatchState<SmashUpCore> = makeMatchState(core);
        const destroyEvent: MinionDestroyedEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'victim',
                minionDefId: victim.defId,
                fromBaseIndex: 0,
                ownerId: '0',
                reason: 'integration_destroy',
            },
            timestamp: 1000,
        };

        const result = processDestroyTriggers([destroyEvent], ms, '1', dummyRandom, 1000);
        const vpEvents = result.events.filter(e => e.type === SU_EVENTS.VP_AWARDED);
        expect(vpEvents).toHaveLength(1);
        expect((vpEvents[0] as any).payload.playerId).toBe('1');
        expect((vpEvents[0] as any).payload.amount).toBe(1);
    });

    it('base_the_field_of_honor: destroy 自己的随从时仍应得分', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_field_of_honor',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_field_of_honor',
            playerId: '0',
            controllerId: '0',
            destroyerId: '0',
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_the_field_of_honor', 'onMinionDestroyed', ctx);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.VP_AWARDED);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.amount).toBe(1);
    });
});

describe('Oops Ancient Egyptians bases', () => {
    it('base_pyramids 在出牌阶段可主动使用，埋葬后同回合不能再用', () => {
        const core = makeState({
            bases: [{
                defId: 'base_pyramids',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [{ uid: 'h1', defId: 'ancient_egyptians_tomb_trap', type: 'action', owner: '0' }],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS],
                },
            } as any,
        });
        const initial = makeMatchState(core);

        const activated = runCommand(initial, {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 0 },
        } as any, defaultTestRandom);
        expect(activated.success).toBe(true);

        const prompt = activated.finalState.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('base_pyramids');
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'h1');
        expect(option).toBeDefined();

        const buried = runCommand(activated.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: option.id },
        } as any, defaultTestRandom);
        expect(buried.success).toBe(true);
        expect(buried.events.some(event => event.type === SU_EVENTS.BASE_ABILITY_USED)).toBe(true);
        expect(buried.events.some(event => event.type === SU_EVENTS.CARD_BURIED)).toBe(true);
        expect(buried.finalState.core.usedBaseAbilitiesThisTurn).toEqual([
            { playerId: '0', baseIndex: 0, baseDefId: 'base_pyramids' },
        ]);

        const secondUse = runCommand(buried.finalState, {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 0 },
        } as any, defaultTestRandom);
        expect(secondUse.success).toBe(false);
        expect(secondUse.error).toContain('本回合已使用');
    });

    it('base_star_portal 在行动牌打到此基地时让其控制者抽一张牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_star_portal',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0',
                        vp: 0,
                        hand: [],
                        deck: [{ uid: 'd1', defId: 'robot_warbot', type: 'minion', owner: '0' }],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.ALIENS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_star_portal',
            playerId: '0',
            actionTargetBaseIndex: 0,
            actionTargetType: 'base',
            now: 1001,
        };

        const result = triggerBaseAbility('base_star_portal', 'onActionPlayed', ctx);
        const drawEvent = result.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvent).toBeDefined();
        expect((drawEvent as any).payload.playerId).toBe('0');
        expect((drawEvent as any).payload.count).toBe(1);
    });

    it('base_pyramids_pod 在出牌阶段可主动使用并埋葬手牌', () => {
        const core = makeState({
            bases: [{
                defId: 'base_pyramids_pod',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [{ uid: 'h1', defId: 'ancient_egyptians_tomb_trap_pod', type: 'action', owner: '0' }],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.PIRATES],
                },
            } as any,
        });

        const activated = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 0 },
        } as any, defaultTestRandom);
        expect(activated.success).toBe(true);

        const prompt = activated.finalState.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('base_pyramids');

        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'h1');
        const buried = runCommand(activated.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: option.id },
        } as any, defaultTestRandom);

        expect(buried.success).toBe(true);
        expect(buried.events.some(event => event.type === SU_EVENTS.CARD_BURIED)).toBe(true);
        expect(buried.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'h1')).toBe(true);
    });

    it('base_star_portal_pod 在有牌被埋葬到这里时让埋葬者抽一张牌', () => {
        const core = makeState({
            bases: [{
                defId: 'base_star_portal_pod',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [{ uid: 'bury-me', defId: 'robot_warbot', type: 'minion', owner: '0' }],
                    deck: [{ uid: 'draw-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' }],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
            } as any,
        });

        const events = buildBuryCardEvents({
            core,
            playerId: '0',
            cardUid: 'bury-me',
            defId: 'robot_warbot',
            baseIndex: 0,
            trueOwnerId: '0',
            buriedFrom: 'hand',
            reason: 'test_star_portal_pod',
            random: defaultTestRandom,
            now: 1002,
        });

        expect(events.some(event => event.type === SU_EVENTS.CARD_BURIED)).toBe(true);
        expect(events.some(event => event.type === SU_EVENTS.TRIGGER_QUEUED)).toBe(true);

        const buriedCore = events.reduce((acc, event) => reduce(acc, event), core);
        const triggered = fireTriggers(buriedCore, 'onCardBuried', {
            state: buriedCore,
            playerId: '0',
            baseIndex: 0,
            buriedCardUid: 'bury-me',
            buriedCardDefId: 'robot_warbot',
            buriedCardControllerId: '0',
            buriedFrom: 'hand',
            random: defaultTestRandom,
            now: 1002,
        });

        const drawEvent = triggered.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(1);
    });
});

// ============================================================================
// base_the_workshop: 工坊 - 打出战术额外行动额度
// ============================================================================

describe('base_the_workshop: 额外行动额度', () => {
    it('打出战术到工坊时获得+1行动额度', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_workshop',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            actionTargetBaseIndex: 0,
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_the_workshop', 'onActionPlayed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.limitType).toBe('action');
        expect((events[0] as any).payload.delta).toBe(1);
    });

    it('打到工坊随从上的战术仍应给予额外战术额度', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_workshop',
                    minions: [makeMinion('m1', '0', 3)],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            actionTargetBaseIndex: 0,
            actionTargetMinionUid: 'm1',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_the_workshop', 'onActionPlayed', ctx);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.limitType).toBe('action');
        expect((events[0] as any).payload.delta).toBe(1);
    });
});

// ============================================================================
// base_crypt: 地窖 - 随从被消灭后消灭者在自己这里的随从上放 +1 指示物
// ============================================================================

describe('base_crypt: 消灭者放指示物', () => {
    it('消灭者在这里只有一个随从时自动放指示物', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_crypt',
                    minions: [
                        { uid: 'm_destroyer', defId: 'd1', controller: '1', owner: '1', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': { id: '0', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
                    '1': { id: '1', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_crypt',
            playerId: '0',
            minionUid: 'm_victim',
            destroyerId: '1',
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_crypt', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.POWER_COUNTER_ADDED);
        expect((events[0] as any).payload.minionUid).toBe('m_destroyer');
    });

    it('消灭者在这里没有随从时不放指示物', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_crypt',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': { id: '0', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
                    '1': { id: '1', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_crypt',
            playerId: '0',
            minionUid: 'm_victim',
            destroyerId: '1',
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_crypt', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(0);
    });

    it('同一张牌一次性消灭多个随从，只允许触发一次地窖（按 FAQ，管线层 batch）', () => {
        const core = makeState({
            bases: [{
                defId: 'base_crypt',
                minions: [
                    { uid: 'm_destroyer', defId: 'd1', controller: '1', owner: '1', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    { uid: 'victim-1', defId: 'v1', controller: '0', owner: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    { uid: 'victim-2', defId: 'v2', controller: '0', owner: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                ],
                ongoingActions: [],
            }],
            players: {
                '0': { id: '0', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
                '1': { id: '1', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            } as any,
        });
        const ms = makeMatchState(core);
        const events = [
            { type: SU_EVENTS.MINION_DESTROYED, payload: { minionUid: 'victim-1', minionDefId: 'v1', fromBaseIndex: 0, ownerId: '0', destroyerId: '1', reason: 'powderkeg' }, timestamp: 1000 },
            { type: SU_EVENTS.MINION_DESTROYED, payload: { minionUid: 'victim-2', minionDefId: 'v2', fromBaseIndex: 0, ownerId: '0', destroyerId: '1', reason: 'powderkeg' }, timestamp: 1000 },
        ] as any;
        const res = processDestroyTriggers(events, ms, '1', () => 0.5, 1000);
        // base_crypt 是 optional，且有 matchState 时会创建交互；batch 后只创建一次
        const queued = (res.matchState ?? ms).sys.interaction.queue;
        const current = (res.matchState ?? ms).sys.interaction.current;
        const all = [...queued, ...(current ? [current] : [])];
        expect(all.filter((i: any) => i.data?.sourceId === 'base_crypt')).toHaveLength(1);
    });
});


// ============================================================================
// base_tar_pits: 焦油坑 - 被消灭随从放入牌库底
// ============================================================================

describe('base_tar_pits: 被消灭随从放入牌库底', () => {
    it('随从在 Tar Pits 被消灭时，MINION_DESTROYED 归约会把它放到拥有者牌库底（仍算被消灭）', () => {
        const state = makeState({
            bases: [{
                defId: 'base_tar_pits',
                minions: [makeMinion('m1', '0', 3, 'test_minion')],
                ongoingActions: [],
            }],
            players: {
                '0': { id: '0', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            } as any,
        });

        const evt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'test_minion', fromBaseIndex: 0, ownerId: '0', reason: 'test' },
            timestamp: 1000,
        };

        const next = reduce(state, evt);
        expect(next.players['0'].discard.length).toBe(0);
        expect(next.players['0'].deck.map((c: any) => c.uid)).toEqual(['m1']);
        expect(next.bases[0].minions.length).toBe(0);
        expect((next.turnDestroyedMinions ?? []).some((r: any) => r.uid === 'm1')).toBe(true);
    });

});

// ============================================================================
// base_haunted_house: 伊万斯堡城镇公墓 - 冠军弃手牌抽5
// ============================================================================

describe('base_haunted_house: 冠军弃手牌抽5', () => {
    it('冠军弃掉所有手牌并抽5张', () => {
        const deckCards = Array.from({ length: 10 }, (_, i) =>
            makeCard(`d${i}`, '0', `card_${i}`)
        );
        const handCards = [makeCard('h1', '0'), makeCard('h2', '0'), makeCard('h3', '0')];

        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_haunted_house',
                    minions: [makeMinion('m1', '0', 5), makeMinion('m2', '1', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: handCards,
                        deck: deckCards,
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house',
            playerId: '0',
            rankings: [
                { playerId: '0', power: 5, vp: 5 },
                { playerId: '1', power: 3, vp: 3 },
            ],
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_haunted_house', 'afterScoring', ctx);
        expect(events.length).toBe(2); // 弃牌 + 抽牌

        // 第一个事件：弃掉所有手牌
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DISCARDED);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.cardUids).toEqual(['h1', 'h2', 'h3']);

        // 第二个事件：抽5张
        expect(events[1].type).toBe(SU_EVENTS.CARDS_DRAWN);
        expect((events[1] as any).payload.playerId).toBe('0');
        expect((events[1] as any).payload.count).toBe(5);
        expect((events[1] as any).payload.cardUids.length).toBe(5);
    });

    it('无排名信息时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState(),
            baseIndex: 0,
            baseDefId: 'base_haunted_house',
            playerId: '0',
            // rankings 未设置
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_haunted_house', 'afterScoring', ctx);
        expect(events.length).toBe(0);
    });

    it('冠军手牌为空时只抽牌不弃牌', () => {
        const deckCards = Array.from({ length: 10 }, (_, i) =>
            makeCard(`d${i}`, '0')
        );

        const ctx: BaseAbilityContext = {
            state: makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [],
                        deck: deckCards,
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 5 }],
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_haunted_house', 'afterScoring', ctx);
        expect(events.length).toBe(1); // 只有抽牌
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
    });
});

// ============================================================================
// base_temple_of_goju: 刚柔流寺庙 - 最高力量随从放牌库底
// ============================================================================

describe('base_temple_of_goju: 最高力量随从放牌库底', () => {
    it('每位玩家最高力量随从放入牌库底', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_temple_of_goju',
                    minions: [
                        makeMinion('m1', '0', 5),
                        makeMinion('m2', '0', 3),
                        makeMinion('m3', '1', 4),
                    ],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_temple_of_goju',
            playerId: '0',
            rankings: [
                { playerId: '0', power: 8, vp: 2 },
                { playerId: '1', power: 4, vp: 3 },
            ],
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_temple_of_goju', 'afterScoring', ctx);
        expect(events.length).toBe(2); // 每位玩家一个

        // P0 的最高力量随从 m1 (power 5)
        const p0Event = events.find(e => (e as any).payload.cardUid === 'm1');
        expect(p0Event).toBeDefined();
        expect(p0Event!.type).toBe(SU_EVENTS.CARD_TO_DECK_BOTTOM);
        expect((p0Event as any).payload.ownerId).toBe('0');

        // P1 的最高力量随从 m3 (power 4)
        const p1Event = events.find(e => (e as any).payload.cardUid === 'm3');
        expect(p1Event).toBeDefined();
        expect((p1Event as any).payload.ownerId).toBe('1');
    });

    it('基地无随从时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_temple_of_goju',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_temple_of_goju',
            playerId: '0',
            rankings: [],
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_temple_of_goju', 'afterScoring', ctx);
        expect(events.length).toBe(0);
    });
});


// ============================================================================
// base_great_library: 大图书馆 - 有随从的玩家抽牌
// ============================================================================

describe('base_great_library: 有随从的玩家抽牌', () => {
    it('每位有随从的玩家抽一张牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_great_library',
                    minions: [
                        makeMinion('m1', '0', 3),
                        makeMinion('m2', '1', 2),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c1', '0')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                    '1': {
                        id: '1', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c2', '1')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_great_library',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_great_library', 'afterScoring', ctx);
        expect(events.length).toBe(2);
        expect(events.every(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);

        const p0Draw = events.find(e => (e as any).payload.playerId === '0');
        const p1Draw = events.find(e => (e as any).payload.playerId === '1');
        expect(p0Draw).toBeDefined();
        expect(p1Draw).toBeDefined();
    });

    it('没有随从的玩家不抽牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_great_library',
                    minions: [makeMinion('m1', '0', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c1', '0')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                    '1': {
                        id: '1', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c2', '1')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_great_library',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_great_library', 'afterScoring', ctx);
        expect(events.length).toBe(1); // 只有 P0
        expect((events[0] as any).payload.playerId).toBe('0');
    });

    it('牌库为空的玩家不抽牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_great_library',
                    minions: [makeMinion('m1', '0', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [], // 空牌库
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_great_library',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_great_library', 'afterScoring', ctx);
        expect(events.length).toBe(0);
    });
});

// ============================================================================
// base_ritual_site: 仪式场所 - 随从洗回牌库
// ============================================================================

describe('base_ritual_site: 随从洗回牌库', () => {
    it('所有随从产生 CARD_TO_DECK_BOTTOM 事件', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_ritual_site',
                    minions: [
                        makeMinion('m1', '0', 3),
                        makeMinion('m2', '1', 4),
                        makeMinion('m3', '0', 2),
                    ],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_ritual_site',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_ritual_site', 'afterScoring', ctx);
        expect(events.length).toBe(3);
        expect(events.every(e => e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);

        // 验证每个随从都有对应事件
        const uids = events.map(e => (e as any).payload.cardUid);
        expect(uids).toContain('m1');
        expect(uids).toContain('m2');
        expect(uids).toContain('m3');

        // 验证 owner 正确
        const m2Event = events.find(e => (e as any).payload.cardUid === 'm2');
        expect((m2Event as any).payload.ownerId).toBe('1');
    });

    it('基地无随从时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_ritual_site',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_ritual_site',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_ritual_site', 'afterScoring', ctx);
        expect(events.length).toBe(0);
    });
});

// ============================================================================
// Monster Smash 新派系基地回归
// ============================================================================

describe('base_laboratorium: 实验工坊 - 当前玩家回合内基地全局首次随从', () => {
    it('当前玩家回合内首次打出到该基地时触发 +1 指示物', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{ defId: 'base_laboratorium', minions: [makeMinion('m1', '0', 3)], ongoingActions: [] }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.WEREWOLVES],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 0 },
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.VAMPIRES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_laboratorium',
            playerId: '0',
            minionUid: 'm1',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_laboratorium', 'onMinionPlayed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.POWER_COUNTER_ADDED);
    });

    it('同一回合内其他玩家已先打出到该基地时不应再次触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{ defId: 'base_laboratorium', minions: [makeMinion('m2', '1', 3)], ongoingActions: [] }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.WEREWOLVES],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.VAMPIRES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_laboratorium',
            playerId: '1',
            minionUid: 'm2',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_laboratorium', 'onMinionPlayed', ctx);
        expect(events.length).toBe(0);
    });

    it('同一玩家本回合第二次打出到该基地时不应触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{ defId: 'base_laboratorium', minions: [makeMinion('m3', '1', 3)], ongoingActions: [] }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 0 },
                        factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.WEREWOLVES],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 2, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 2 },
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.VAMPIRES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_laboratorium',
            playerId: '1',
            minionUid: 'm3',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_laboratorium', 'onMinionPlayed', ctx);
        expect(events.length).toBe(0);
    });
});

describe('base_moot_site: 集会场 - 当前玩家回合内基地全局首次随从', () => {
    it('当前玩家回合内首次打出到该基地时触发 +2 临时力量', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{ defId: 'base_moot_site', minions: [makeMinion('m1', '0', 3)], ongoingActions: [] }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.WEREWOLVES, SMASHUP_FACTION_IDS.FRANKENSTEIN],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 0 },
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.VAMPIRES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_moot_site',
            playerId: '0',
            minionUid: 'm1',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_moot_site', 'onMinionPlayed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.TEMP_POWER_ADDED);
    });

    it('同一回合内其他玩家已先打出到该基地时不应再次触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{ defId: 'base_moot_site', minions: [makeMinion('m2', '1', 3)], ongoingActions: [] }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.WEREWOLVES, SMASHUP_FACTION_IDS.FRANKENSTEIN],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.VAMPIRES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_moot_site',
            playerId: '1',
            minionUid: 'm2',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_moot_site', 'onMinionPlayed', ctx);
        expect(events.length).toBe(0);
    });

    it('同一玩家本回合第二次打出到该基地时不应触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{ defId: 'base_moot_site', minions: [makeMinion('m3', '1', 3)], ongoingActions: [] }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 0 },
                        factions: [SMASHUP_FACTION_IDS.WEREWOLVES, SMASHUP_FACTION_IDS.FRANKENSTEIN],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 2, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 2 },
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.VAMPIRES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_moot_site',
            playerId: '1',
            minionUid: 'm3',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_moot_site', 'onMinionPlayed', ctx);
        expect(events.length).toBe(0);
    });
});

describe('base_castle_blood: 血堡 - 可选触发', () => {
    it('满足条件时应创建可选交互（可跳过）', () => {
        const result = triggerBaseAbilityWithMS('base_castle_blood', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_castle_blood',
                    minions: [
                        makeMinion('m_me', '0', 2),
                        makeMinion('m_op', '1', 5),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.VAMPIRES, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.WEREWOLVES, SMASHUP_FACTION_IDS.PIRATES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_castle_blood',
            playerId: '0',
            minionUid: 'm_me',
            now: 1000,
        });

        expect(result.events.length).toBe(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions.length).toBe(1);
        expect(interactions[0].data.sourceId).toBe('base_castle_blood');
        expect(interactions[0].data.options.some((o: any) => o.id === 'skip')).toBe(true);
    });
});

describe('base_crypt: 地窖 - 可选触发', () => {
    it('单个可放置目标时也应创建可选交互（包含跳过）', () => {
        const state = makeState({
            bases: [{
                defId: 'base_crypt',
                minions: [
                    makeMinion('m_destroyer', '1', 4),
                ],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.VAMPIRES, SMASHUP_FACTION_IDS.WEREWOLVES],
                },
            } as any,
        });

        const result = triggerExtendedBaseAbility('base_crypt', 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_crypt',
            playerId: '0',
            minionUid: 'm_victim',
            destroyerId: '1',
            now: 1000,
        });

        expect(result.events.length).toBe(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions.length).toBe(1);
        expect(interactions[0].data.sourceId).toBe('base_crypt');
        expect(interactions[0].data.options.some((o: any) => o.id === 'skip')).toBe(true);
    });
});

describe('Oops Vikings bases', () => {
    it('base_drakkar 首次有随从打到这里时会提示选择另一位玩家并把合格牌抽到发动者手里', () => {
        const result = triggerBaseAbilityWithMS('base_drakkar', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_drakkar',
                    minions: [makeMinion('m1', '0', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.VIKINGS, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [{ uid: 'd1', defId: 'wizard_summon', type: 'action', owner: '1' }],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.PIRATES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_drakkar',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            minionPower: 3,
            now: 1000,
        });

        const prompt = getInteractionsFromResult(result)[0] as any;
        expect(prompt?.data?.sourceId).toBe('base_drakkar');
        expect(prompt.data.options.some((entry: any) => entry.value?.skip === true)).toBe(true);

        const option = prompt.data.options.find((entry: any) => entry.value?.targetPlayerId === '1');
        const resolved = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'd1')).toBe(true);
        expect(resolved.finalState.core.players['1'].hand.some(card => card.uid === 'd1')).toBe(false);
        expect(resolved.finalState.core.players['1'].deck).toHaveLength(0);
    });

    it('base_drakkar 会在目标牌库为空时先洗回弃牌堆再把揭示到的合格低力量随从拿到发动者手里', () => {
        const result = triggerBaseAbilityWithMS('base_drakkar', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_drakkar',
                    minions: [makeMinion('m1', '0', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.VIKINGS, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [],
                        discard: [{ uid: 'd2', defId: 'robot_microbot_alpha', type: 'minion', owner: '1' }],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.PIRATES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_drakkar',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            minionPower: 3,
            now: 1000,
        });

        const prompt = getInteractionsFromResult(result)[0] as any;
        const option = prompt.data.options.find((entry: any) => entry.value?.targetPlayerId === '1');
        const resolved = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'd2')).toBe(true);
        expect(resolved.finalState.core.players['1'].discard).toHaveLength(0);
        expect(resolved.finalState.core.players['1'].deck).toHaveLength(0);
    });

    it('base_longhouse 改为主动基地能力：使用后会把手牌置于牌库顶并给此基地己方随从 +2 力量', () => {
        const core = makeState({
            bases: [{
                defId: 'base_longhouse',
                minions: [makeMinion('m1', '0', 4)],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0', vp: 0,
                    hand: [makeCard('h1', '0', 'robot_microbot_alpha')],
                    deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.VIKINGS, SMASHUP_FACTION_IDS.ALIENS],
                },
            } as any,
        });

        const started = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_BASE_ABILITY, playerId: '0', payload: { baseIndex: 0 } } as any,
            defaultTestRandom,
        );

        const cardPrompt = getInteractionsFromMS(started.finalState)[0] as any;
        expect(cardPrompt?.data?.sourceId).toBe('base_longhouse_card');

        const chooseCard = cardPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'h1');
        const afterCard = runCommand(
            started.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseCard.id } } as any,
            defaultTestRandom,
        );

        const minionPrompt = (afterCard.finalState.sys.interaction.current as any);
        expect(minionPrompt?.data?.sourceId).toBe('base_longhouse_minion');

        const chooseMinion = minionPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'm1');
        const resolved = runCommand(
            afterCard.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseMinion.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].deck[0]?.uid).toBe('h1');
        expect(resolved.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(2);
    });
});

describe('Oops Cowboys bases', () => {
    it('base_saloon 在此处有随从被消灭后让场上留有随从的玩家各抽一张', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_saloon',
                    minions: [
                        makeMinion('m1', '0', 3),
                        makeMinion('m2', '1', 4),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [],
                        deck: [makeCard('d0', '0', 'robot_microbot_alpha')],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.COWBOYS, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0,
                        hand: [],
                        deck: [makeCard('d1', '1', 'robot_microbot_beta')],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.COWBOYS, SMASHUP_FACTION_IDS.PIRATES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_saloon',
            playerId: '0',
            minionUid: 'victim',
            destroyerId: '1',
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_saloon', 'onMinionDestroyed', ctx);
        const drawEvents = events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.some(event => (event as any).payload.playerId === '0')).toBe(true);
        expect(drawEvents.some(event => (event as any).payload.playerId === '1')).toBe(true);
    });

    it('base_so_so_corral 在打出随从后给出决斗提示并按结果消灭失败者', () => {
        const result = triggerBaseAbilityWithMS('base_so_so_corral', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_so_so_corral',
                    minions: [
                        makeMinion('ally-1', '0', 4, 'cowboys_gunfighter'),
                        makeMinion('enemy-1', '1', 2, 'robot_microbot_alpha'),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.COWBOYS, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_so_so_corral',
            playerId: '0',
            minionUid: 'ally-1',
            minionDefId: 'cowboys_gunfighter',
            minionPower: 4,
            now: 1001,
        });

        const prompt = getInteractionsFromResult(result)[0] as any;
        expect(prompt?.data?.sourceId).toBe('base_so_so_corral');

        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(resolved.finalState);
        expect(duelResolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(duelResolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
    });
});

describe('Oops Samurai bases', () => {
    it('base_shoguns_palace 在本回合首次打出随从到这里后给出决斗提示并让胜者抓两张', () => {
        const result = triggerBaseAbilityWithMS('base_shoguns_palace', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_shoguns_palace',
                    minions: [
                        makeMinion('ally-1', '0', 4, 'samurai_ronin'),
                        makeMinion('enemy-1', '1', 2, 'robot_microbot_alpha'),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [],
                        deck: [makeCard('d1', '0', 'robot_microbot_alpha'), makeCard('d2', '0', 'robot_microbot_beta')],
                        discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_shoguns_palace',
            playerId: '0',
            minionUid: 'ally-1',
            minionDefId: 'samurai_ronin',
            minionPower: 4,
            now: 1000,
        });

        const prompt = getInteractionsFromResult(result)[0] as any;
        expect(prompt?.data?.sourceId).toBe('base_shoguns_palace');

        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(resolved.finalState);
        const drawEvent = duelResolved.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(2);
        expect(duelResolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });

    it('base_shoguns_palace 平局时双方各抓两张牌', () => {
        const result = triggerBaseAbilityWithMS('base_shoguns_palace', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_shoguns_palace',
                    minions: [
                        makeMinion('ally-1', '0', 3, 'samurai_ronin'),
                        makeMinion('enemy-1', '1', 3, 'robot_microbot_alpha'),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [],
                        deck: [makeCard('d1', '0', 'robot_microbot_alpha'), makeCard('d2', '0', 'robot_microbot_beta')],
                        discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [],
                        deck: [makeCard('d3', '1', 'robot_microbot_alpha'), makeCard('d4', '1', 'robot_microbot_beta')],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_shoguns_palace',
            playerId: '0',
            minionUid: 'ally-1',
            minionDefId: 'samurai_ronin',
            minionPower: 3,
            now: 1000,
        });

        const prompt = getInteractionsFromResult(result)[0] as any;
        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const started = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(started.finalState);
        const drawEvents = duelResolved.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN) as any[];
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.some(event => event.payload.playerId === '0' && event.payload.count === 2)).toBe(true);
        expect(drawEvents.some(event => event.payload.playerId === '1' && event.payload.count === 2)).toBe(true);
    });

    it('base_sakura_garden 在本回合第一次有你的随从被消灭时让你抓一张牌', () => {
        const state = makeState({
            bases: [{
                defId: 'base_sakura_garden',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0', vp: 0, hand: [],
                    deck: [makeCard('draw-1', '0', 'robot_microbot_alpha')],
                    discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: {
                uid: 'dead-1',
                defId: 'samurai_ronin',
                controller: '0',
                owner: '0',
                basePower: 3,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                attachedActions: [],
            },
            triggerMinionUid: 'dead-1',
            triggerMinionDefId: 'samurai_ronin',
            destroyerId: '1',
            random: dummyRandom,
            now: 1001,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('base_sakura_garden 与 samurai_honor_the_fallen 同时触发时两者都会结算抓牌', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': {
                    id: '0', vp: 0, hand: [],
                    deck: [
                        makeCard('draw-1', '0', 'robot_microbot_alpha'),
                        makeCard('draw-2', '0', 'robot_microbot_alpha'),
                    ],
                    discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
            bases: [{
                defId: 'base_sakura_garden',
                minions: [makeMinion('dead-1', '0', 3, 'samurai_ronin')],
                ongoingActions: [{ uid: 'hof-1', defId: 'samurai_honor_the_fallen', ownerId: '0' } as any],
            }],
        });

        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: core.bases[0].minions[0],
            triggerMinionUid: 'dead-1',
            triggerMinionDefId: 'samurai_ronin',
            destroyerId: '1',
            random: dummyRandom,
            now: 1000,
        });

        expect(queued).toBeDefined();
        const queuedState = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
        const firstPrompt = maybeResolveReactionQueue(queuedState, dummyRandom, 1000);
        expect(firstPrompt?.state.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const firstQueueById = new Map(firstPrompt!.state.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
        const firstOption = (firstPrompt!.state.sys.interaction.current as any).data.options.find((option: any) => {
            const trigger = firstQueueById.get(option.value.triggerId) as any;
            return trigger?.sourceDefId === 'samurai_honor_the_fallen';
        }) ?? (firstPrompt!.state.sys.interaction.current as any).data.options[0];
        const firstResolved = runCommand(
            firstPrompt!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: firstOption.id } } as any,
            dummyRandom,
        );

        const secondPrompt = getInteractionsFromMS(firstResolved.finalState)[0] as any;
        const secondResolved = secondPrompt?.data?.sourceId === 'smashup_reaction_choose'
            ? (() => {
                const secondQueueById = new Map(firstResolved.finalState.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
                const secondOption = secondPrompt.data.options.find((option: any) => {
                    const trigger = secondQueueById.get(option.value.triggerId) as any;
                    return trigger?.sourceDefId === 'base_sakura_garden';
                }) ?? secondPrompt.data.options[0];
                return runCommand(
                    firstResolved.finalState,
                    { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: secondOption.id } } as any,
                    dummyRandom,
                );
            })()
            : { events: [], finalState: firstResolved.finalState };

        const drawEvents = [...firstResolved.events, ...secondResolved.events].filter(event => event.type === SU_EVENTS.CARDS_DRAWN) as any[];
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.every(event => event.payload.playerId === '0' && event.payload.count === 1)).toBe(true);
    });

    it('base_sakura_garden 与 samurai_samurai_chan_pod 同时触发时，先结算基地后仍会再结算武士酱抓牌', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': {
                    id: '0', vp: 0, hand: [],
                    deck: [
                        makeCard('draw-1', '0', 'robot_microbot_alpha'),
                        makeCard('draw-2', '0', 'robot_microbot_alpha'),
                    ],
                    discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
            bases: [{
                defId: 'base_sakura_garden_pod',
                minions: [makeMinion('chan-1', '0', 2, 'samurai_samurai_chan_pod')],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: core.bases[0].minions[0],
            triggerMinionUid: 'chan-1',
            triggerMinionDefId: 'samurai_samurai_chan_pod',
            destroyerId: '0',
            reason: 'samurai_yokai_attack',
            random: dummyRandom,
            now: 1000,
        });

        expect(queued).toBeDefined();
        const queuedState = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
        const firstPrompt = maybeResolveReactionQueue(queuedState, dummyRandom, 1000);
        expect(firstPrompt?.state.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const firstQueueById = new Map(firstPrompt!.state.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
        const firstOption = (firstPrompt!.state.sys.interaction.current as any).data.options.find((option: any) => {
            const trigger = firstQueueById.get(option.value.triggerId) as any;
            return trigger?.sourceDefId === 'base_sakura_garden_pod';
        }) ?? (firstPrompt!.state.sys.interaction.current as any).data.options[0];
        const firstResolved = runCommand(
            firstPrompt!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: firstOption.id } } as any,
            dummyRandom,
        );

        const secondPrompt = getInteractionsFromMS(firstResolved.finalState)[0] as any;
        const secondResolved = secondPrompt?.data?.sourceId === 'smashup_reaction_choose'
            ? (() => {
                const secondQueueById = new Map(firstResolved.finalState.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
                const secondOption = secondPrompt.data.options.find((option: any) => {
                    const trigger = secondQueueById.get(option.value.triggerId) as any;
                    return trigger?.sourceDefId === 'samurai_samurai_chan_pod';
                }) ?? secondPrompt.data.options[0];
                return runCommand(
                    firstResolved.finalState,
                    { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: secondOption.id } } as any,
                    dummyRandom,
                );
            })()
            : { events: [], finalState: firstResolved.finalState };

        const drawEvents = [...firstResolved.events, ...secondResolved.events].filter(event => event.type === SU_EVENTS.CARDS_DRAWN) as any[];
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.every(event => event.payload.playerId === '0' && event.payload.count === 1)).toBe(true);
    });

    it('base_sakura_garden_pod 与 samurai_samurai_chan_pod 同时触发时两者都会结算抓牌', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': {
                    id: '0', vp: 0, hand: [],
                    deck: [
                        makeCard('draw-1', '0', 'robot_microbot_alpha'),
                        makeCard('draw-2', '0', 'robot_microbot_alpha'),
                    ],
                    discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
            bases: [{
                defId: 'base_sakura_garden_pod',
                minions: [makeMinion('chan-pod-1', '0', 2, 'samurai_samurai_chan_pod')],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: core.bases[0].minions[0],
            triggerMinionUid: 'chan-pod-1',
            triggerMinionDefId: 'samurai_samurai_chan_pod',
            destroyerId: '1',
            random: dummyRandom,
            now: 1005,
        });

        expect(queued).toBeDefined();
        const queuedState = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
        const firstPrompt = maybeResolveReactionQueue(queuedState, dummyRandom, 1005);
        expect(firstPrompt?.state.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const firstQueueById = new Map(firstPrompt!.state.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
        const firstOption = (firstPrompt!.state.sys.interaction.current as any).data.options.find((option: any) => {
            const trigger = firstQueueById.get(option.value.triggerId) as any;
            return trigger?.sourceDefId === 'base_sakura_garden_pod';
        }) ?? (firstPrompt!.state.sys.interaction.current as any).data.options[0];
        const firstResolved = runCommand(
            firstPrompt!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: firstOption.id } } as any,
            dummyRandom,
        );

        const secondPrompt = getInteractionsFromMS(firstResolved.finalState)[0] as any;
        const secondResolved = secondPrompt?.data?.sourceId === 'smashup_reaction_choose'
            ? (() => {
                const secondQueueById = new Map(firstResolved.finalState.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
                const secondOption = secondPrompt.data.options.find((option: any) => {
                    const trigger = secondQueueById.get(option.value.triggerId) as any;
                    return trigger?.sourceDefId === 'samurai_samurai_chan_pod';
                }) ?? secondPrompt.data.options[0];
                return runCommand(
                    firstResolved.finalState,
                    { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: secondOption.id } } as any,
                    dummyRandom,
                );
            })()
            : { events: [], finalState: firstResolved.finalState };

        const drawEvents = [...firstResolved.events, ...secondResolved.events].filter(event => event.type === SU_EVENTS.CARDS_DRAWN) as any[];
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.every(event => event.payload.playerId === '0' && event.payload.count === 1)).toBe(true);
    });

    it('base_sakura_garden 同回合第二次有同一玩家的随从被消灭时不应再次抽牌', () => {
        const state = makeState({
            bases: [{
                defId: 'base_sakura_garden',
                minions: [],
                ongoingActions: [],
            }],
            turnDestroyedMinions: [{
                uid: 'prev-1',
                defId: 'samurai_samurai_chan',
                baseIndex: 0,
                owner: '0',
            }],
            players: {
                '0': {
                    id: '0', vp: 0, hand: [],
                    deck: [makeCard('draw-1', '0', 'robot_microbot_alpha')],
                    discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: {
                uid: 'dead-2',
                defId: 'samurai_bushi',
                controller: '0',
                owner: '0',
                basePower: 4,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                attachedActions: [],
            },
            triggerMinionUid: 'dead-2',
            triggerMinionDefId: 'samurai_bushi',
            destroyerId: '1',
            random: dummyRandom,
            now: 1002,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
    });

    it('base_shoguns_palace_pod reuses the duel-and-draw base ability', () => {
        const result = triggerBaseAbilityWithMS('base_shoguns_palace_pod', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_shoguns_palace_pod',
                    minions: [
                        makeMinion('ally-pod-1', '0', 4, 'samurai_ronin_pod'),
                        makeMinion('enemy-pod-1', '1', 2, 'robot_microbot_alpha'),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [],
                        deck: [makeCard('d1', '0', 'robot_microbot_alpha'), makeCard('d2', '0', 'robot_microbot_beta')],
                        discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_shoguns_palace_pod',
            playerId: '0',
            minionUid: 'ally-pod-1',
            minionDefId: 'samurai_ronin_pod',
            minionPower: 4,
            now: 1003,
        });

        const prompt = getInteractionsFromResult(result)[0] as any;
        expect(prompt?.data?.sourceId).toBe('base_shoguns_palace');

        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-pod-1');
        const resolved = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(resolved.finalState);
        const drawEvent = duelResolved.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(2);
    });

    it('base_sakura_garden_pod reuses the first discard draw trigger', () => {
        const state = makeState({
            bases: [{
                defId: 'base_sakura_garden_pod',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0', vp: 0, hand: [],
                    deck: [makeCard('draw-pod-1', '0', 'robot_microbot_alpha')],
                    discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
        });

        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: {
                uid: 'dead-pod-1',
                defId: 'samurai_ronin_pod',
                controller: '0',
                owner: '0',
                basePower: 3,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                attachedActions: [],
            },
            triggerMinionUid: 'dead-pod-1',
            triggerMinionDefId: 'samurai_ronin_pod',
            random: dummyRandom,
            now: 1004,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('base_saloon_pod reuses the destroyed-minion draw trigger', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_saloon_pod',
                    minions: [
                        makeMinion('m1', '0', 3, 'cowboys_gunfighter_pod'),
                        makeMinion('m2', '1', 4, 'robot_microbot_alpha'),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [],
                        deck: [makeCard('d0', '0', 'robot_microbot_alpha')],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.COWBOYS_POD, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0,
                        hand: [],
                        deck: [makeCard('d1', '1', 'robot_microbot_beta')],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_saloon_pod',
            playerId: '0',
            minionUid: 'victim',
            destroyerId: '1',
            now: 1005,
        };

        const { events } = triggerExtendedBaseAbility('base_saloon_pod', 'onMinionDestroyed', ctx);
        const drawEvents = events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.some(event => (event as any).payload.playerId === '0')).toBe(true);
        expect(drawEvents.some(event => (event as any).payload.playerId === '1')).toBe(true);
    });

    it('base_so_so_corral_pod reuses the duel-and-destroy base ability', () => {
        const result = triggerBaseAbilityWithMS('base_so_so_corral_pod', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_so_so_corral_pod',
                    minions: [
                        makeMinion('ally-pod-1', '0', 4, 'cowboys_gunfighter_pod'),
                        makeMinion('enemy-pod-1', '1', 2, 'robot_microbot_alpha'),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.COWBOYS_POD, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_so_so_corral_pod',
            playerId: '0',
            minionUid: 'ally-pod-1',
            minionDefId: 'cowboys_gunfighter_pod',
            minionPower: 4,
            now: 1006,
        });

        const prompt = getInteractionsFromResult(result)[0] as any;
        expect(prompt?.data?.sourceId).toBe('base_so_so_corral');

        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-pod-1');
        const resolved = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(resolved.finalState);
        expect(duelResolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(duelResolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-pod-1')).toBe(false);
    });

    it('base_drakkar_pod reuses the first-minion reveal-and-draw ability', () => {
        const result = triggerBaseAbilityWithMS('base_drakkar_pod', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_drakkar_pod',
                    minions: [makeMinion('m1', '0', 3, 'vikings_shield_maiden_pod')],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.VIKINGS_POD, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [{ uid: 'd1', defId: 'wizard_summon', type: 'action', owner: '1' }],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_drakkar_pod',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'vikings_shield_maiden_pod',
            minionPower: 3,
            now: 1007,
        });

        const prompt = getInteractionsFromResult(result)[0] as any;
        expect(prompt?.data?.sourceId).toBe('base_drakkar');

        const option = prompt.data.options.find((entry: any) => entry.value?.targetPlayerId === '1');
        const resolved = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'd1')).toBe(true);
        expect(resolved.finalState.core.players['1'].deck).toHaveLength(0);
    });

    it('base_longhouse_pod reuses the active base ability to topdeck and buff', () => {
        const core = makeState({
            bases: [{
                defId: 'base_longhouse_pod',
                minions: [makeMinion('m1', '0', 4, 'vikings_huscarl_pod')],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0', vp: 0,
                    hand: [makeCard('h1', '0', 'robot_microbot_alpha')],
                    deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.VIKINGS_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
            } as any,
        });

        const started = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_BASE_ABILITY, playerId: '0', payload: { baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        expect(started.success).toBe(true);

        const cardPrompt = started.finalState.sys.interaction.current as any;
        expect(cardPrompt?.data?.sourceId).toBe('base_longhouse_card');

        const chooseCard = cardPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'h1');
        const afterCard = runCommand(
            started.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseCard.id } } as any,
            defaultTestRandom,
        );

        const minionPrompt = afterCard.finalState.sys.interaction.current as any;
        expect(minionPrompt?.data?.sourceId).toBe('base_longhouse_minion');

        const chooseMinion = minionPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'm1');
        const resolved = runCommand(
            afterCard.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseMinion.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].deck[0]?.uid).toBe('h1');
        expect(resolved.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(2);
    });
});
