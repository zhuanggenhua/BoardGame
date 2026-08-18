import { describe, expect, it } from 'vitest';
import {
    buildAiLegalActionsFromInteractionDecision,
    type AiDecisionDescriptor,
} from '../../../engine/ai/decisionSemantics';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
import { MageWarsDomain, MAGE_WARS_COMMANDS } from '../domain';
import {
    getFormalArenaZonesFromConfig,
    getFormalStartingZoneIdFromConfig,
    getPresetSpellbookCardIdsFromConfig,
    getPresetSpellbookCountFromConfig,
} from '../data/configPackage';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { reduceEvent } from '../domain/reducer';
import {
    ARENA_ZONE_IDS,
    MAGE_IDS,
    MAGE_WARS_MAGE_ABILITY_IDS,
    MAGE_WARS_OBJECT_ABILITY_IDS,
    STATUS_TOKEN_IDS,
    type MageWarsObjectAbilityId,
} from '../domain/ids';
import type { MageWarsArenaObjectState, MageWarsCommand, MageWarsCore, MageWarsPhase } from '../domain/types';
import { getMageWarsPlayerDefenseProfiles } from '../domain/spellRules';
import { engineConfig } from '../game';

const playerIds = ['0', '1'];
const PLAYER_ZERO_START_ZONE = getFormalStartingZoneIdFromConfig(0);
const PLAYER_ONE_START_ZONE = getFormalStartingZoneIdFromConfig(1);

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 3,
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

const CAT_ATTACK_LINE = '利爪：快速近战 2 骰；冲锋+2';
const CAT_ATTACK_WITH_DEFENSE_LINE = '利爪：快速近战 2 骰；防御图标 `8+ / 1x`；冲锋+2';

const beastmasterSpellIds = (): number[] => getPresetSpellbookCardIdsFromConfig(MAGE_IDS.BEASTMASTER_APPRENTICE);

function setupState(phase?: MageWarsPhase): MatchState<MageWarsCore> {
    const sys = createInitialSystemState(playerIds, engineConfig.systems, 'local:mage-wars-domain-flow');
    const effectivePhase = phase ?? 'reset';
    const core = MageWarsDomain.setup(playerIds, fixedRandom);
    return {
        core: {
            ...core,
            // 单玩家领域夹具预先视为对手已完成当前准备阶段，保留既有单命令断言；正式联机仍要求双方真实点击完成。
            phaseReadyPlayerIds: effectivePhase === 'planning' ? [] : ['1'],
        },
        sys: phase ? { ...sys, phase } : sys,
    };
}

function withPlayerInZone(core: MageWarsCore, playerId: string, zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS]): MageWarsCore {
    return {
        ...core,
        players: {
            ...core.players,
            [playerId]: {
                ...core.players[playerId],
                mageZoneId: zoneId,
            },
        },
        arena: core.arena.map((zone) => {
            const withoutPlayer = zone.occupantIds.filter((occupantId) => occupantId !== playerId);
            return zone.id === zoneId
                ? { ...zone, occupantIds: [...withoutPlayer, playerId] }
                : { ...zone, occupantIds: withoutPlayer };
        }),
    };
}

function withArenaObject(core: MageWarsCore, object: MageWarsArenaObjectState): MageWarsCore {
    return {
        ...core,
        objects: {
            ...core.objects,
            [object.id]: object,
        },
        arena: core.arena.map((zone) => {
            if (zone.id !== object.zoneId) return zone;
            return {
                ...zone,
                objectIds: zone.objectIds.includes(object.id)
                    ? zone.objectIds
                    : [...zone.objectIds, object.id],
                conjurationIds: object.kind === 'conjuration' && !zone.conjurationIds.includes(object.id)
                    ? [...zone.conjurationIds, object.id]
                    : zone.conjurationIds,
            };
        }),
    };
}

function withArenaObjectDisplayText(
    core: MageWarsCore,
    objectId: string,
    rulesText: string,
): MageWarsCore {
    const object = core.objects[objectId];
    if (!object) return core;
    return {
        ...core,
        objects: {
            ...core.objects,
            [objectId]: {
                ...object,
                attackOrTraitLine: undefined,
                rulesText,
            },
        },
    };
}

function withCurrentPlayer(core: MageWarsCore, playerId: string): MageWarsCore {
    return {
        ...core,
        currentPlayerId: playerId,
    };
}

function withPlayerMage(
    core: MageWarsCore,
    playerId: string,
    mageId: typeof MAGE_IDS[keyof typeof MAGE_IDS],
): MageWarsCore {
    return {
        ...core,
        players: {
            ...core.players,
            [playerId]: {
                ...core.players[playerId],
                mageId,
                spellbookCount: getPresetSpellbookCountFromConfig(mageId),
            },
        },
    };
}

function makeArenaObject(
    id: string,
    ownerId: string,
    zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS],
    overrides: Partial<MageWarsArenaObjectState> = {},
): MageWarsArenaObjectState {
    return {
        id,
        kind: 'creature',
        ownerId,
        sourceSpellCardId: 2906,
        sourceObjectId: 'spell-card-2906',
        name: ownerId === '0' ? '野性山猫' : '敌方生物',
        zoneId,
        life: 4,
        damage: 0,
        armor: 0,
        actionReady: true,
        guarding: false,
        statusTokens: {},
        attackOrTraitLine: CAT_ATTACK_LINE,
        ...overrides,
    };
}

function makeVisibleEnchantmentObject(
    id: string,
    ownerId: string,
    zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS],
    overrides: Partial<MageWarsArenaObjectState> = {},
): MageWarsArenaObjectState {
    return makeArenaObject(id, ownerId, zoneId, {
        kind: 'enchantment',
        sourceSpellCardId: 1800,
        sourceObjectId: 'spell-card-1800',
        name: '剧痛难当',
        life: 1,
        damage: 0,
        armor: 0,
        actionReady: false,
        typeLine: '结界 / 诅咒',
        attackOrTraitLine: undefined,
        rulesText: '每当本生物进行非法术远程或近战攻击时，少投掷2颗攻击骰子。',
        revealed: true,
        ...overrides,
    });
}

function makeCounterstrikeEnchantmentObject(
    id: string,
    ownerId: string,
    zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS],
    anchoredToObjectId: string,
): MageWarsArenaObjectState {
    return makeVisibleEnchantmentObject(id, ownerId, zoneId, {
        sourceSpellCardId: 1903,
        sourceObjectId: 'spell-card-1903',
        name: '反戈一击',
        typeLine: '结界 / 战争图标',
        attackOrTraitLine: undefined,
        rulesText: undefined,
        anchoredToObjectId,
    });
}

function makeVampiricEnchantmentObject(
    id: string,
    ownerId: string,
    zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS],
    anchoredToObjectId: string,
): MageWarsArenaObjectState {
    return makeVisibleEnchantmentObject(id, ownerId, zoneId, {
        sourceSpellCardId: 1910,
        sourceObjectId: 'spell-card-1910',
        name: '鲜血贪噬',
        typeLine: '结界 / 吸血',
        attackOrTraitLine: undefined,
        rulesText: undefined,
        anchoredToObjectId,
    });
}

function makeMentalCalmEnchantmentObject(
    id: string,
    ownerId: string,
    zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS],
    anchoredToObjectId: string,
): MageWarsArenaObjectState {
    return makeVisibleEnchantmentObject(id, ownerId, zoneId, {
        sourceSpellCardId: 1912,
        sourceObjectId: 'spell-card-1912',
        name: '心灵安抚',
        typeLine: '结界 / 精神',
        attackOrTraitLine: undefined,
        rulesText: undefined,
        anchoredToObjectId,
    });
}

function makeSuppressionCloakEquipmentObject(
    id: string,
    ownerId: string,
    zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS],
): MageWarsArenaObjectState {
    return makeArenaObject(id, ownerId, zoneId, {
        kind: 'equipment',
        sourceSpellCardId: 3705,
        sourceObjectId: 'spell-card-3705',
        name: '抑制斗篷',
        actionReady: false,
        attackOrTraitLine: undefined,
        rulesText: undefined,
        combatTraitsSource: 'config',
        anchoredToPlayerId: ownerId,
    });
}

function makeDemonCuirassEquipmentObject(
    id: string,
    ownerId: string,
    zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS],
): MageWarsArenaObjectState {
    return makeArenaObject(id, ownerId, zoneId, {
        kind: 'equipment',
        sourceSpellCardId: 3700,
        sourceObjectId: 'spell-card-3700',
        name: '恶魔胸甲',
        actionReady: false,
        attackOrTraitLine: undefined,
        rulesText: undefined,
        combatTraitsSource: 'config',
        anchoredToPlayerId: ownerId,
    });
}

function runCommand(
    state: MatchState<MageWarsCore>,
    command: MageWarsCommand | Command<typeof FLOW_COMMANDS.ADVANCE_PHASE, Record<string, never>>,
    random: RandomFn = fixedRandom,
) {
    return executePipeline(
        {
            domain: engineConfig.domain,
            systems: engineConfig.systems,
            systemsConfig: engineConfig.systemsConfig,
        },
        state,
        command as unknown as MageWarsCommand,
        random,
        playerIds,
    );
}

function validateCommand(
    state: MatchState<MageWarsCore>,
    command: MageWarsCommand,
): string | undefined {
    return MageWarsDomain.validate(state, command).error;
}

function planCommand(spellCardIds: number[], playerId = '0'): MageWarsCommand {
    return {
        type: MAGE_WARS_COMMANDS.PLAN_SPELLS,
        playerId,
        payload: { spellCardIds },
    };
}

function actionLogKinds(state: MatchState<MageWarsCore>): string[] {
    return state.sys.actionLog.entries.map((entry) => entry.kind);
}

function withPreparedPlayerMage(
    core: MageWarsCore,
    playerId: string,
    mageId: typeof MAGE_IDS[keyof typeof MAGE_IDS],
    preparedSpellCardIds: number[],
    mana = 20,
): MageWarsCore {
    const mageCore = withPlayerMage(core, playerId, mageId);
    return {
        ...mageCore,
        players: {
            ...mageCore.players,
            [playerId]: {
                ...mageCore.players[playerId],
                mana,
                actionReady: true,
                quickcastReady: true,
                preparedSpellCardIds,
                preparedSpellSlots: preparedSpellCardIds.length,
            },
        },
    };
}

function castObjectSpellCommand(
    spellCardId: number,
    manaCost: number,
    targetObjectId: string,
): MageWarsCommand {
    return {
        type: MAGE_WARS_COMMANDS.CAST_SPELL,
        playerId: '0',
        payload: {
            spellCardId,
            manaCost,
            targetObjectId,
        },
    };
}

describe('mage-wars domain flow', () => {
    it('sets up mages in config-backed formal 4x3 diagonal starting zones', () => {
        const state = setupState();

        expect(PLAYER_ZERO_START_ZONE).toBe(ARENA_ZONE_IDS.A3);
        expect(PLAYER_ONE_START_ZONE).toBe(ARENA_ZONE_IDS.D1);
        expect(state.core.players['0'].mageZoneId).toBe(PLAYER_ZERO_START_ZONE);
        expect(state.core.players['1'].mageZoneId).toBe(PLAYER_ONE_START_ZONE);
        expect(state.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)?.occupantIds).toEqual(['0']);
        expect(state.core.arena.find((zone) => zone.id === PLAYER_ONE_START_ZONE)?.occupantIds).toEqual(['1']);
        expect(state.core.arena.filter((zone) => zone.occupantIds.length > 0)).toHaveLength(2);
        expect(state.core.arena.map(({ id, row, col }) => ({ id, row, col }))).toEqual(
            getFormalArenaZonesFromConfig().map(({ zoneId, rowIndex, colIndex }) => ({
                id: zoneId,
                row: rowIndex,
                col: colIndex,
            })),
        );
    });

    it('plans at most two spellbook cards for the current mage', () => {
        const state = setupState('planning');
        const spellIds = beastmasterSpellIds();

        const planned = runCommand(state, planCommand(spellIds.slice(0, 2)));

        expect(planned.success).toBe(true);
        expect(planned.state.core.players['0'].preparedSpellCardIds).toEqual(spellIds.slice(0, 2));
        expect(planned.state.core.players['0'].preparedSpellSlots).toBe(2);
        expect(planned.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.SPELLS_PLANNED);
        expect(planned.state.sys.undo.snapshots).toHaveLength(1);
        expect(actionLogKinds(planned.state)).toContain(MAGE_WARS_EVENTS.SPELLS_PLANNED);
        expect(planned.state.sys.actionLog.entries[0]?.segments).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'card', cardId: String(spellIds[0]) }),
            expect.objectContaining({ type: 'card', cardId: String(spellIds[1]) }),
        ]));

        expect(validateCommand(state, planCommand(spellIds.slice(0, 3)))).toBe('tooManyPreparedSpells');
        expect(validateCommand(state, planCommand([999999]))).toBe('spellNotInPresetSpellbook');
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.PLAN_SPELLS,
            playerId: '1',
            payload: { spellCardIds: [spellIds[0]] },
        })).toBe('spellNotInPresetSpellbook');
    });

    it('channels mana on channel phase entry and advances turn after final quickcast', () => {
        const resetState = setupState();
        const manaBefore = resetState.core.players['0'].mana;
        const channeling = resetState.core.players['0'].channeling;

        const channelResult = runCommand(resetState, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(channelResult.success).toBe(true);
        expect(channelResult.state.sys.phase).toBe('channel');
        expect(channelResult.state.core.players['0'].mana).toBe(manaBefore + channeling);
        expect(channelResult.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            'SYS_PHASE_CHANGED',
            MAGE_WARS_EVENTS.MANA_CHANNELED,
        ]));
        expect(actionLogKinds(channelResult.state)).toEqual(expect.arrayContaining([
            'SYS_PHASE_CHANGED',
            MAGE_WARS_EVENTS.MANA_CHANNELED,
        ]));

        const finalQuickcastState: MatchState<MageWarsCore> = {
            core: {
                ...channelResult.state.core,
                players: {
                    ...channelResult.state.core.players,
                    '1': {
                        ...channelResult.state.core.players['1'],
                        actionReady: false,
                        quickcastReady: false,
                        guarding: true,
                    },
                },
            },
            sys: { ...channelResult.state.sys, phase: 'finalQuickcast' },
        };

        const nextTurn = runCommand(finalQuickcastState, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(nextTurn.success).toBe(true);
        expect(nextTurn.state.sys.phase).toBe('reset');
        expect(nextTurn.state.core.currentPlayerId).toBe('1');
        expect(nextTurn.state.core.phaseActorId).toBe('1');
        expect(nextTurn.state.core.turnNumber).toBe(1);
        expect(nextTurn.state.core.players['1']).toMatchObject({
            actionReady: true,
            quickcastReady: true,
            guarding: false,
        });
        expect(nextTurn.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.TURN_ADVANCED,
            MAGE_WARS_EVENTS.ACTION_READINESS_RESET,
        ]));
        expect(actionLogKinds(nextTurn.state)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.TURN_ADVANCED,
            MAGE_WARS_EVENTS.ACTION_READINESS_RESET,
        ]));
    });

    it('moves only to adjacent arena zones and guard consumes the main action', () => {
        const state = setupState('creatureAction');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.MOVE_MAGE,
            playerId: '0',
            payload: { toZoneId: PLAYER_ONE_START_ZONE },
        })).toBe('zoneNotAdjacent');

        const moved = runCommand(state, {
            type: MAGE_WARS_COMMANDS.MOVE_MAGE,
            playerId: '0',
            payload: { toZoneId: ARENA_ZONE_IDS.A2 },
        });

        expect(moved.success).toBe(true);
        expect(moved.state.core.players['0']).toMatchObject({
            mageZoneId: ARENA_ZONE_IDS.A2,
            actionReady: false,
            guarding: false,
        });
        expect(moved.state.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)?.occupantIds).not.toContain('0');
        expect(moved.state.core.arena.find((zone) => zone.id === ARENA_ZONE_IDS.A2)?.occupantIds).toContain('0');

        const guarded = runCommand(setupState('creatureAction'), {
            type: MAGE_WARS_COMMANDS.GUARD,
            playerId: '0',
            payload: {},
        });

        expect(guarded.success).toBe(true);
        expect(guarded.state.core.players['0']).toMatchObject({
            actionReady: false,
            guarding: true,
        });
        expect(validateCommand(guarded.state, {
            type: MAGE_WARS_COMMANDS.GUARD,
            playerId: '0',
            payload: {},
        })).toBe('actionSpent');
    });

    it('casts attack spells from config cost, rolls spell dice, and consumes the matching readiness track', () => {
        const quickSpellId = 1710;
        const actionSpellId = 1711;
        const planned = runCommand(setupState('planning'), planCommand([quickSpellId, actionSpellId]));
        expect(planned.success).toBe(true);

        const quickcastCore = withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2);
        const quickcastState: MatchState<MageWarsCore> = {
            core: {
                ...quickcastCore,
                players: {
                    ...quickcastCore.players,
                    '0': {
                        ...quickcastCore.players['0'],
                        statusTokens: {
                            [STATUS_TOKEN_IDS.WEAK]: 5,
                        },
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };
        const quickcast = runCommand(quickcastState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: quickSpellId,
                manaCost: 4,
                targetPlayerId: '1',
            },
        });

        expect(quickcast.success).toBe(true);
        expect(quickcast.state.core.players['0']).toMatchObject({
            mana: planned.state.core.players['0'].mana - 4,
            quickcastReady: false,
            actionReady: true,
        });
        expect(quickcast.state.core.players['0'].statusTokens[STATUS_TOKEN_IDS.WEAK]).toBe(5);
        expect(quickcast.state.core.players['0'].preparedSpellCardIds).toEqual([actionSpellId]);
        expect(quickcast.state.core.players['0'].discardSpellCardIds).toEqual([quickSpellId]);
        expect(quickcast.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
            MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
            'DAMAGE_DEALT',
        ]));
        expect(quickcast.events.find((event) => event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED)).toMatchObject({
            payload: {
                spellCardId: quickSpellId,
                sourceAbilityId: 'mw.spell.1710',
                targetPlayerId: '1',
                diceResults: [3, 3, 3],
                baseDamage: 9,
            },
        });
        expect(quickcast.events.find((event) => event.type === 'DAMAGE_DEALT')).toMatchObject({
            payload: {
                targetId: '1',
                actualDamage: 9,
                sourceAbilityId: 'mw.spell.1710',
            },
        });
        expect(quickcast.state.core.players['1'].damage).toBe(9);
        expect(actionLogKinds(quickcast.state)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
            MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
            'DAMAGE_DEALT',
        ]));
        expect(quickcast.state.sys.actionLog.entries[0]?.segments).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'card', cardId: String(quickSpellId) }),
        ]));

        expect(validateCommand({
            core: withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2),
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 999999, manaCost: 1 },
        })).toBe('spellNotPrepared');
        expect(validateCommand({
            core: withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2),
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: actionSpellId, manaCost: 1, targetPlayerId: '1' },
        })).toBe('manaCostMismatch');

        const actionCast = runCommand({
            core: withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2),
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: actionSpellId,
                manaCost: 4,
                targetPlayerId: '1',
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
        });

        expect(actionCast.success).toBe(true);
        expect(actionCast.state.core.players['0']).toMatchObject({
            actionReady: false,
            quickcastReady: true,
        });
        expect(actionCast.state.core.players['0'].discardSpellCardIds).toEqual([actionSpellId]);
        expect(actionCast.state.core.players['1'].damage).toBe(6);
    });

    it('casts minor healing on a living arena object from config data', () => {
        const healingSpellId = 3402;
        const planned = runCommand(setupState('planning'), planCommand([healingSpellId]));
        const woundedCat = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE, {
            damage: 3,
        });

        const healed = runCommand({
            core: withArenaObject(planned.state.core, woundedCat),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: healingSpellId,
                manaCost: 5,
                targetObjectId: woundedCat.id,
            },
        });

        expect(healed.success).toBe(true);
        expect(healed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: expect.objectContaining({
                    spellCardId: healingSpellId,
                    sourceAbilityId: 'mw.spell.3402',
                    targetObjectId: woundedCat.id,
                    diceResults: [3, 3, 3, 3, 3],
                    healing: 15,
                    actualHealing: 3,
                }),
            }),
        ]));
        expect(healed.state.core.objects[woundedCat.id].damage).toBe(0);
        expect(healed.state.core.players['0']).toMatchObject({
            mana: planned.state.core.players['0'].mana - 5,
            quickcastReady: false,
            actionReady: true,
        });
        expect(healed.state.core.players['0'].discardSpellCardIds).toEqual([healingSpellId]);
        expect(actionLogKinds(healed.state)).toContain(MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED);
    });

    it('casts group healing only on friendly living targets in the selected zone', () => {
        const groupHealingSpellId = 3405;
        const planned = runCommand(setupState('planning'), planCommand([groupHealingSpellId]));
        const friendlyCat = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE, {
            damage: 2,
        });
        const enemyGuard = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            damage: 3,
            life: 6,
        });
        const friendlySkeleton = makeArenaObject('skeleton-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            damage: 3,
            life: 6,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });
        const coreWithEnemyMage = withPlayerInZone(planned.state.core, '1', PLAYER_ZERO_START_ZONE);
        const damagedCore: MageWarsCore = {
            ...coreWithEnemyMage,
            players: {
                ...coreWithEnemyMage.players,
                '0': {
                    ...coreWithEnemyMage.players['0'],
                    damage: 4,
                },
                '1': {
                    ...coreWithEnemyMage.players['1'],
                    damage: 7,
                },
            },
        };

        const healed = runCommand({
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(damagedCore, friendlyCat),
                    enemyGuard,
                ),
                friendlySkeleton,
            ),
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: groupHealingSpellId,
                manaCost: 9,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });

        expect(healed.success).toBe(true);
        expect(healed.events.filter((event) => event.type === MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED)).toHaveLength(2);
        expect(healed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: expect.objectContaining({
                    spellCardId: groupHealingSpellId,
                    targetPlayerId: '0',
                    targetZoneId: PLAYER_ZERO_START_ZONE,
                    diceResults: [3, 3, 3, 3, 3],
                    actualHealing: 4,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: expect.objectContaining({
                    spellCardId: groupHealingSpellId,
                    targetObjectId: friendlyCat.id,
                    targetZoneId: PLAYER_ZERO_START_ZONE,
                    diceResults: [3, 3, 3, 3, 3],
                    actualHealing: 2,
                }),
            }),
        ]));
        expect(healed.state.core.players['0'].damage).toBe(0);
        expect(healed.state.core.players['1'].damage).toBe(7);
        expect(healed.state.core.objects[friendlyCat.id].damage).toBe(0);
        expect(healed.state.core.objects[enemyGuard.id].damage).toBe(3);
        expect(healed.state.core.objects[friendlySkeleton.id].damage).toBe(3);
        expect(healed.state.core.players['0']).toMatchObject({
            actionReady: false,
            quickcastReady: true,
        });
    });

    it('rejects standard spells during quickcast phases', () => {
        const groupHealingSpellId = 3405;
        const planned = runCommand(setupState('planning'), planCommand([groupHealingSpellId]));

        expect(validateCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: groupHealingSpellId,
                manaCost: 9,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        })).toBe('spellNotQuick');
    });

    it('casts single healing from the priestess apprentice spellbook on a living creature', () => {
        const healingSpellId = 3408;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withCurrentPlayer(planningState.core, '1'),
            sys: planningState.sys,
        }, planCommand([healingSpellId], '1'));
        const woundedCleric = makeArenaObject('cleric-1', '1', PLAYER_ONE_START_ZONE, {
            sourceSpellCardId: 2907,
            sourceObjectId: 'spell-card-2907',
            name: '灰衣天使',
            damage: 7,
            life: 10,
            armor: 2,
            attackOrTraitLine: '利剑：快速近战 4 骰；飞行',
        });

        const healed = runCommand({
            core: withArenaObject(planned.state.core, woundedCleric),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '1',
            payload: {
                spellCardId: healingSpellId,
                manaCost: 9,
                targetObjectId: woundedCleric.id,
            },
        });

        expect(planned.success).toBe(true);
        expect(healed.success).toBe(true);
        expect(healed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: expect.objectContaining({
                    playerId: '1',
                    spellCardId: healingSpellId,
                    sourceAbilityId: 'mw.spell.3408',
                    targetObjectId: woundedCleric.id,
                    targetZoneId: PLAYER_ONE_START_ZONE,
                    diceResults: [3, 3, 3, 3, 3, 3, 3, 3],
                    healing: 24,
                    actualHealing: 7,
                }),
            }),
        ]));
        expect(healed.state.core.objects[woundedCleric.id].damage).toBe(0);
        expect(healed.state.core.players['1']).toMatchObject({
            mana: planned.state.core.players['1'].mana - 9,
            quickcastReady: false,
            actionReady: true,
        });
        expect(healed.state.core.players['1'].discardSpellCardIds).toEqual([healingSpellId]);
        expect(actionLogKinds(healed.state)).toContain(MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED);
    });

    it('uses priestess quick restoration to pay and remove all same-name status tokens from a creature', () => {
        const baseState = setupState('initiativeQuickcast');
        const burningCleric = makeArenaObject('burning-cleric-1', '1', PLAYER_ONE_START_ZONE, {
            sourceSpellCardId: 2907,
            sourceObjectId: 'spell-card-2907',
            name: '灰衣天使',
            life: 10,
            armor: 2,
            statusTokens: {
                [STATUS_TOKEN_IDS.BURN]: 2,
                [STATUS_TOKEN_IDS.DAZE]: 1,
            },
        });

        const restored = runCommand({
            core: withArenaObject(withCurrentPlayer(baseState.core, '1'), burningCleric),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.USE_MAGE_ABILITY,
            playerId: '1',
            payload: {
                abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK,
                targetObjectId: burningCleric.id,
                statusTokenIds: [STATUS_TOKEN_IDS.BURN],
                manaCost: 4,
            },
        });

        expect(restored.success).toBe(true);
        expect(restored.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MAGE_ABILITY_RESOLVED,
                payload: expect.objectContaining({
                    playerId: '1',
                    abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK,
                    manaCost: 4,
                    targetObjectId: burningCleric.id,
                    statusTokenIds: [STATUS_TOKEN_IDS.BURN],
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: expect.objectContaining({
                    targetObjectId: burningCleric.id,
                    statusTokenId: STATUS_TOKEN_IDS.BURN,
                    amount: 2,
                    sourceAbilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK,
                }),
            }),
        ]));
        expect(restored.state.core.objects[burningCleric.id].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.DAZE]: 1,
        });
        expect(restored.state.core.players['1']).toMatchObject({
            mana: baseState.core.players['1'].mana - 4,
            quickcastReady: false,
            actionReady: true,
            preparedSpellCardIds: [],
            discardSpellCardIds: [],
        });
        expect(actionLogKinds(restored.state)).toContain(MAGE_WARS_EVENTS.MAGE_ABILITY_RESOLVED);
        expect(actionLogKinds(restored.state)).toContain(MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED);
    });

    it('uses priestess standard restoration to remove multiple status types including sleep level cost', () => {
        const baseState = setupState('creatureAction');
        const afflictedAngel = makeArenaObject('afflicted-angel-1', '1', PLAYER_ONE_START_ZONE, {
            sourceSpellCardId: 2907,
            sourceObjectId: 'spell-card-2907',
            name: '灰衣天使',
            life: 10,
            armor: 2,
            statusTokens: {
                [STATUS_TOKEN_IDS.BURN]: 1,
                [STATUS_TOKEN_IDS.STUN]: 1,
                [STATUS_TOKEN_IDS.SLEEP]: 1,
            },
        });

        const restored = runCommand({
            core: withArenaObject(withCurrentPlayer(baseState.core, '1'), afflictedAngel),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.USE_MAGE_ABILITY,
            playerId: '1',
            payload: {
                abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_STANDARD,
                targetObjectId: afflictedAngel.id,
                statusTokenIds: [STATUS_TOKEN_IDS.BURN, STATUS_TOKEN_IDS.STUN, STATUS_TOKEN_IDS.SLEEP],
                manaCost: 9,
            },
        });

        expect(restored.success).toBe(true);
        expect(restored.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MAGE_ABILITY_RESOLVED,
                payload: expect.objectContaining({
                    playerId: '1',
                    abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_STANDARD,
                    manaCost: 9,
                    targetObjectId: afflictedAngel.id,
                    statusTokenIds: [STATUS_TOKEN_IDS.BURN, STATUS_TOKEN_IDS.STUN, STATUS_TOKEN_IDS.SLEEP],
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: expect.objectContaining({
                    targetObjectId: afflictedAngel.id,
                    statusTokenId: STATUS_TOKEN_IDS.BURN,
                    amount: 1,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: expect.objectContaining({
                    targetObjectId: afflictedAngel.id,
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 1,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: expect.objectContaining({
                    targetObjectId: afflictedAngel.id,
                    statusTokenId: STATUS_TOKEN_IDS.SLEEP,
                    amount: 1,
                }),
            }),
        ]));
        expect(restored.state.core.objects[afflictedAngel.id].statusTokens).toEqual({});
        expect(restored.state.core.players['1']).toMatchObject({
            mana: baseState.core.players['1'].mana - 9,
            quickcastReady: true,
            actionReady: false,
            preparedSpellCardIds: [],
            discardSpellCardIds: [],
        });
        expect(actionLogKinds(restored.state)).toContain(MAGE_WARS_EVENTS.MAGE_ABILITY_RESOLVED);
        expect(actionLogKinds(restored.state)).toContain(MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED);
    });

    it('casts Life Drain as direct damage and heals the warlock by actual damage dealt', () => {
        const lifeDrainSpellId = 3400;
        const planningState = setupState('planning');
        const warlockCore = withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE);
        const planned = runCommand({
            core: {
                ...warlockCore,
                players: {
                    ...warlockCore.players,
                    '0': {
                        ...warlockCore.players['0'],
                        mana: 20,
                        damage: 5,
                    },
                },
            },
            sys: planningState.sys,
        }, planCommand([lifeDrainSpellId]));
        const armoredLivingTarget = makeArenaObject('angel-1', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2907,
            sourceObjectId: 'spell-card-2907',
            name: '灰衣天使',
            life: 20,
            armor: 4,
            attackOrTraitLine: '利剑：快速近战 4 骰；飞行',
        });

        const drained = runCommand({
            core: withArenaObject(planned.state.core, armoredLivingTarget),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: lifeDrainSpellId,
                manaCost: 12,
                targetObjectId: armoredLivingTarget.id,
            },
        });

        const damageEvent = drained.events.find((event) => event.type === 'DAMAGE_DEALT');
        expect(planned.success).toBe(true);
        expect(drained.success).toBe(true);
        expect(drained.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_DIRECT_DAMAGE_ROLLED,
                payload: expect.objectContaining({
                    playerId: '0',
                    spellCardId: lifeDrainSpellId,
                    sourceAbilityId: 'mw.spell.3400',
                    targetObjectId: armoredLivingTarget.id,
                    targetZoneId: PLAYER_ZERO_START_ZONE,
                    diceResults: [3, 3, 3, 3, 3],
                    directDamage: 15,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: armoredLivingTarget.id,
                    actualDamage: 15,
                    sourceAbilityId: 'mw.spell.3400',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: expect.objectContaining({
                    playerId: '0',
                    spellCardId: lifeDrainSpellId,
                    sourceAbilityId: 'mw.spell.3400',
                    targetPlayerId: '0',
                    diceResults: [3, 3, 3, 3, 3],
                    healing: 15,
                    actualHealing: 5,
                }),
            }),
        ]));
        expect(JSON.stringify(damageEvent?.payload.breakdown)).not.toContain('mage-wars-object-armor');
        expect(drained.state.core.objects[armoredLivingTarget.id].damage).toBe(15);
        expect(drained.state.core.players['0']).toMatchObject({
            mana: 8,
            damage: 0,
            quickcastReady: false,
            actionReady: true,
        });
        expect(drained.state.core.players['0'].discardSpellCardIds).toEqual([lifeDrainSpellId]);
        expect(actionLogKinds(drained.state)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.SPELL_DIRECT_DAMAGE_ROLLED,
            MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
        ]));
    });

    it('rejects Life Drain on non-living arena objects', () => {
        const lifeDrainSpellId = 3400;
        const planningState = setupState('planning');
        const warlockCore = withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE);
        const planned = runCommand({
            core: {
                ...warlockCore,
                players: {
                    ...warlockCore.players,
                    '0': {
                        ...warlockCore.players['0'],
                        mana: 20,
                    },
                },
            },
            sys: planningState.sys,
        }, planCommand([lifeDrainSpellId]));
        const skeleton = makeArenaObject('skeleton-1', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            life: 6,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });

        expect(planned.success).toBe(true);
        expect(validateCommand({
            core: withArenaObject(planned.state.core, skeleton),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: lifeDrainSpellId,
                manaCost: 12,
                targetObjectId: skeleton.id,
            },
        })).toBe('invalidHealingTarget');
    });

    it('rejects direct healing on non-living arena objects', () => {
        const healingSpellId = 3402;
        const planned = runCommand(setupState('planning'), planCommand([healingSpellId]));
        const skeleton = makeArenaObject('skeleton-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            damage: 3,
            life: 6,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });

        expect(validateCommand({
            core: withArenaObject(planned.state.core, skeleton),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: healingSpellId,
                manaCost: 5,
                targetObjectId: skeleton.id,
            },
        })).toBe('invalidHealingTarget');
    });

    it('places status tokens from attack spell effect dice', () => {
        const spellCardId = 1710;
        const planned = runCommand(setupState('planning'), planCommand([spellCardId]));
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 5 : 3),
        };

        const result = runCommand({
            core: withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 4,
                targetPlayerId: '1',
            },
        }, statusRandom);

        expect(result.success).toBe(true);
        expect(result.events.find((event) => event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED)).toMatchObject({
            payload: {
                spellCardId,
                effectDieResult: 5,
            },
        });
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetPlayerId: '1',
                    statusTokenId: STATUS_TOKEN_IDS.DAZE,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.1710',
                }),
            }),
        ]));
        expect(result.state.core.players['1'].statusTokens[STATUS_TOKEN_IDS.DAZE]).toBe(1);
        expect(actionLogKinds(result.state)).toContain(MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED);
    });

    it('does not place daze or stun on conjurations', () => {
        const spellCardId = 1705;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const conjuration = makeArenaObject('vine-1', '1', ARENA_ZONE_IDS.A2, {
            kind: 'conjuration',
            sourceSpellCardId: 2224,
            sourceObjectId: 'spell-card-2224',
            name: '缠绕藤蔓',
            life: 30,
            attackOrTraitLine: '活体；火焰+2；水流免疫',
        });
        const stunRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 8 : 3),
        };

        const attacked = runCommand({
            core: withArenaObject(planned.state.core, conjuration),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 8,
                targetObjectId: conjuration.id,
            },
        }, stunRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    spellCardId,
                    effectDieResult: 8,
                    targetObjectId: conjuration.id,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: conjuration.id,
                    actualDamage: 15,
                }),
            }),
        ]));
        expect(attacked.events).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: conjuration.id,
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                }),
            }),
        ]));
        expect(attacked.state.core.objects[conjuration.id].statusTokens).toEqual({});
    });

    it('casts Flameblast from the warlock spellbook as a single-target burn attack', () => {
        const spellCardId = 1702;
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 11 : 3),
        };
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const target = makeArenaObject('guard-1', '1', ARENA_ZONE_IDS.A2, {
            life: 30,
            guarding: true,
        });

        const result = runCommand({
            core: withArenaObject(planned.state.core, target),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 5,
                targetObjectId: target.id,
            },
        }, statusRandom);

        expect(planned.success).toBe(true);
        expect(result.success).toBe(true);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    spellCardId,
                    sourceAbilityId: 'mw.spell.1702',
                    targetObjectId: target.id,
                    diceResults: [3, 3, 3, 3],
                    effectDieResult: 11,
                    baseDamage: 12,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 12,
                    sourceAbilityId: 'mw.spell.1702',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: target.id,
                    statusTokenId: STATUS_TOKEN_IDS.BURN,
                    amount: 2,
                    sourceAbilityId: 'mw.spell.1702',
                    spellCardId,
                }),
            }),
        ]));
        expect(result.state.core.objects[target.id]).toMatchObject({
            damage: 12,
            statusTokens: {
                [STATUS_TOKEN_IDS.BURN]: 2,
            },
        });
    });

    it('does not place burn on arena objects with cannot-burn traits', () => {
        const spellCardId = 1702;
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 11 : 3),
        };
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const target = makeArenaObject('cannot-burn-1', '1', ARENA_ZONE_IDS.A2, {
            life: 30,
            attackOrTraitLine: '短剑：快速近战 4 骰；无法燃烧',
        });

        const result = runCommand({
            core: withArenaObject(planned.state.core, target),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 5,
                targetObjectId: target.id,
            },
        }, statusRandom);

        expect(result.success).toBe(true);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    spellCardId,
                    effectDieResult: 11,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 12,
                }),
            }),
        ]));
        expect(result.events.some((event) => (
            event.type === MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED
            && event.payload.targetObjectId === target.id
            && event.payload.statusTokenId === STATUS_TOKEN_IDS.BURN
        ))).toBe(false);
        expect(result.state.core.objects[target.id].statusTokens[STATUS_TOKEN_IDS.BURN]).toBeUndefined();
    });

    it('casts Lightning Bolt from the wizard spellbook as a single-target stun attack', () => {
        const spellCardId = 1705;
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 8 : 3),
        };
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const target = makeArenaObject('guard-1', '1', ARENA_ZONE_IDS.A2, {
            life: 30,
        });

        const result = runCommand({
            core: withArenaObject(planned.state.core, target),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 8,
                targetObjectId: target.id,
            },
        }, statusRandom);

        expect(planned.success).toBe(true);
        expect(result.success).toBe(true);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    spellCardId,
                    sourceAbilityId: 'mw.spell.1705',
                    targetObjectId: target.id,
                    diceResults: [3, 3, 3, 3, 3],
                    effectDieResult: 8,
                    baseDamage: 15,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 15,
                    sourceAbilityId: 'mw.spell.1705',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: target.id,
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.1705',
                    spellCardId,
                }),
            }),
        ]));
        expect(result.state.core.objects[target.id]).toMatchObject({
            damage: 15,
            guarding: false,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });
    });

    it('applies target lightning weakness to spell attack dice and effect dice', () => {
        const spellCardId = 1705;
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 6 : 3),
        };
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const target = makeArenaObject('lightning-weak-1', '1', ARENA_ZONE_IDS.A2, {
            life: 30,
            attackOrTraitLine: '长剑：快速近战 5 骰；防御图标 `8+ / 1x`；闪电+2',
        });

        const result = runCommand({
            core: withArenaObject(planned.state.core, target),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 8,
                targetObjectId: target.id,
            },
        }, statusRandom);

        expect(planned.success).toBe(true);
        expect(result.success).toBe(true);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    spellCardId,
                    sourceAbilityId: 'mw.spell.1705',
                    targetObjectId: target.id,
                    diceResults: [3, 3, 3, 3, 3, 3, 3],
                    rawEffectDieResult: 6,
                    effectDieResult: 8,
                    baseDamage: 21,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 21,
                    sourceAbilityId: 'mw.spell.1705',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: target.id,
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.1705',
                    spellCardId,
                }),
            }),
        ]));
        expect(result.state.core.objects[target.id]).toMatchObject({
            damage: 21,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });
    });

    it('rejects targeted attack spells against matching damage type immunity', () => {
        const spellCardId = 1705;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const target = makeArenaObject('lightning-immune-1', '1', ARENA_ZONE_IDS.A2, {
            life: 30,
            attackOrTraitLine: '长剑：快速近战 5 骰；闪电免疫',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(planned.state.core, target),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 8,
                targetObjectId: target.id,
            },
        })).toBe('targetImmuneToDamageType');
    });

    it('applies target fire resistance to spell attack dice and effect dice', () => {
        const spellCardId = 1702;
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 11 : 3),
        };
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const target = makeArenaObject('fire-resistant-1', '1', ARENA_ZONE_IDS.A2, {
            life: 30,
            attackOrTraitLine: '狱火剑：快速近战 4 骰，穿刺+2；火焰-2',
        });

        const result = runCommand({
            core: withArenaObject(planned.state.core, target),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 5,
                targetObjectId: target.id,
            },
        }, statusRandom);

        expect(planned.success).toBe(true);
        expect(result.success).toBe(true);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    spellCardId,
                    sourceAbilityId: 'mw.spell.1702',
                    targetObjectId: target.id,
                    diceResults: [3, 3],
                    rawEffectDieResult: 11,
                    effectDieResult: 9,
                    baseDamage: 6,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 6,
                    sourceAbilityId: 'mw.spell.1702',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: target.id,
                    statusTokenId: STATUS_TOKEN_IDS.BURN,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.1702',
                    spellCardId,
                }),
            }),
        ]));
        expect(result.state.core.objects[target.id]).toMatchObject({
            damage: 6,
            statusTokens: {
                [STATUS_TOKEN_IDS.BURN]: 1,
            },
        });
    });

    it('cancels intermittent jet damage to remove all burn from a burning target', () => {
        const spellCardId = 1710;
        const planned = runCommand(setupState('planning'), planCommand([spellCardId]));
        const coreWithTarget = withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2);
        const burningCore: MageWarsCore = {
            ...coreWithTarget,
            players: {
                ...coreWithTarget.players,
                '1': {
                    ...coreWithTarget.players['1'],
                    damage: 5,
                    statusTokens: {
                        ...coreWithTarget.players['1'].statusTokens,
                        [STATUS_TOKEN_IDS.BURN]: 2,
                    },
                },
            },
        };

        const result = runCommand({
            core: burningCore,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 4,
                targetPlayerId: '1',
            },
        });

        expect(result.success).toBe(true);
        expect(result.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED);
        expect(result.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED);
        expect(result.events.map((event) => event.type)).not.toContain('DAMAGE_DEALT');
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: expect.objectContaining({
                    targetPlayerId: '1',
                    statusTokenId: STATUS_TOKEN_IDS.BURN,
                    amount: 2,
                    sourceAbilityId: 'mw.spell.1710',
                    spellCardId,
                }),
            }),
        ]));
        expect(result.state.core.players['1'].damage).toBe(5);
        expect(result.state.core.players['1'].statusTokens[STATUS_TOKEN_IDS.BURN]).toBeUndefined();
        expect(actionLogKinds(result.state)).toContain(MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED);
    });

    it('summons creature spells as arena objects that can be damaged by attack spells', () => {
        const creatureSpellId = 2906;
        const attackSpellId = 1710;
        const planned = runCommand(setupState('planning'), planCommand([creatureSpellId, attackSpellId]));

        const summoned = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 5,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });

        expect(summoned.success).toBe(true);
        expect(summoned.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
            MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
        ]));

        const objectId = Object.keys(summoned.state.core.objects)[0];
        expect(objectId).toBe('mwobj-0-2906-1');
        expect(summoned.state.core.objects[objectId]).toMatchObject({
            kind: 'creature',
            ownerId: '0',
            sourceSpellCardId: creatureSpellId,
            name: '野性山猫',
            zoneId: PLAYER_ZERO_START_ZONE,
            life: 4,
            armor: 0,
            actionReady: false,
        });
        expect(summoned.state.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)?.objectIds).toContain(objectId);
        expect(summoned.state.core.players['0']).toMatchObject({
            mana: planned.state.core.players['0'].mana - 5,
            actionReady: false,
            quickcastReady: true,
        });

        const attackedObject = runCommand({
            core: summoned.state.core,
            sys: { ...summoned.state.sys, phase: 'finalQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 4,
                targetObjectId: objectId,
            },
        });

        expect(attackedObject.success).toBe(true);
        expect(attackedObject.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    spellCardId: attackSpellId,
                    targetObjectId: objectId,
                    diceResults: [3, 3, 3],
                    baseDamage: 9,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: objectId,
                    actualDamage: 9,
                    sourceAbilityId: 'mw.spell.1710',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId,
                    ownerId: '0',
                }),
            }),
        ]));
        expect(attackedObject.state.core.objects[objectId]).toBeUndefined();
        expect(attackedObject.state.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)?.objectIds).not.toContain(objectId);
        expect(actionLogKinds(attackedObject.state)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
            MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
        ]));
    });

    it('summons a config-implemented plain creature spell with card stats and attack text', () => {
        const creatureSpellId = 2819;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([creatureSpellId]));

        const summoned = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 9,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });

        expect(summoned.success).toBe(true);
        expect(summoned.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
                payload: expect.objectContaining({
                    object: expect.objectContaining({
                        id: 'mwobj-0-2819-1',
                        kind: 'creature',
                        ownerId: '0',
                        sourceSpellCardId: creatureSpellId,
                        sourceObjectId: 'spell-2819',
                        name: '丛林灰狼',
                        zoneId: PLAYER_ZERO_START_ZONE,
                        life: 10,
                        armor: 2,
                        actionReady: false,
                        attackOrTraitLine: '噬咬：快速近战 4 骰',
                    }),
                }),
            }),
        ]));
        expect(summoned.state.core.objects['mwobj-0-2819-1']).toMatchObject({
            zoneId: PLAYER_ZERO_START_ZONE,
            life: 10,
            armor: 2,
            actionReady: false,
        });
        expect(summoned.state.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)?.objectIds).toContain('mwobj-0-2819-1');
        expect(summoned.state.core.players['0']).toMatchObject({
            mana: planned.state.core.players['0'].mana - 9,
            actionReady: false,
            quickcastReady: true,
        });
    });

    it('summons Skeleton Sentry from config with nonliving and mental immunity traits', () => {
        const creatureSpellId = 2826;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([creatureSpellId]));

        const summoned = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 8,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });

        expect(summoned.success).toBe(true);
        expect(summoned.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
                payload: expect.objectContaining({
                    object: expect.objectContaining({
                        id: 'mwobj-0-2826-1',
                        kind: 'creature',
                        ownerId: '0',
                        sourceSpellCardId: creatureSpellId,
                        sourceObjectId: 'spell-2826',
                        name: '骷髅哨兵',
                        zoneId: PLAYER_ZERO_START_ZONE,
                        life: 11,
                        armor: 0,
                        actionReady: false,
                        attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
                    }),
                }),
            }),
        ]));

        const skeleton = summoned.state.core.objects['mwobj-0-2826-1'];
        expect(skeleton).toMatchObject({
            zoneId: PLAYER_ZERO_START_ZONE,
            life: 11,
            armor: 0,
            actionReady: false,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });

        const sleepSpellId = 3411;
        const priestessPlanned = runCommand({
            core: withPlayerMage({
                ...summoned.state.core,
                currentPlayerId: '1',
                players: {
                    ...summoned.state.core.players,
                    '1': {
                        ...summoned.state.core.players['1'],
                        mana: 20,
                    },
                },
            }, '1', MAGE_IDS.PRIESTESS_APPRENTICE),
            sys: { ...summoned.state.sys, phase: 'planning' },
        }, planCommand([sleepSpellId], '1'));

        expect(validateCommand({
            core: priestessPlanned.state.core,
            sys: { ...priestessPlanned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '1',
            payload: {
                spellCardId: sleepSpellId,
                manaCost: 5,
                targetObjectId: skeleton.id,
            },
        })).toBe('invalidSleepTarget');
    });

    it('summons Royal Archer from config and consumes its ranged attack profile', () => {
        const creatureSpellId = 2816;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.PRIESTESS_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([creatureSpellId]));

        const summoned = runCommand({
            core: {
                ...planned.state.core,
                players: {
                    ...planned.state.core.players,
                    '0': {
                        ...planned.state.core.players['0'],
                        mana: 20,
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 12,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });

        const archer = summoned.state.core.objects['mwobj-0-2816-1'];
        expect(summoned.success).toBe(true);
        expect(archer).toMatchObject({
            kind: 'creature',
            ownerId: '0',
            sourceSpellCardId: creatureSpellId,
            sourceObjectId: 'spell-2816',
            name: '皇家箭手',
            zoneId: PLAYER_ZERO_START_ZONE,
            life: 9,
            armor: 1,
            actionReady: false,
            attackOrTraitLine: '长弓：完整行动远程 `1-2` 4 骰，穿刺+1；小刀：快速近战 2 骰',
        });

        const armoredTarget = makeArenaObject('armored-target-1', '1', ARENA_ZONE_IDS.B3, {
            life: 20,
            armor: 3,
        });
        const attackCore = withArenaObject(
            withPlayerInZone({
                ...summoned.state.core,
                objects: {
                    ...summoned.state.core.objects,
                    [archer.id]: {
                        ...archer,
                        actionReady: true,
                    },
                },
            }, '1', ARENA_ZONE_IDS.B3),
            armoredTarget,
        );

        const attacked = runCommand({
            core: attackCore,
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: archer.id,
                attackProfileId: 'attack-0',
                targetObjectId: armoredTarget.id,
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: archer.id,
                    attackProfileId: 'attack-0',
                    attackName: '长弓',
                    targetObjectId: armoredTarget.id,
                    diceResults: [3, 3, 3, 3],
                    baseDamage: 12,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: armoredTarget.id,
                    actualDamage: 10,
                    sourceAbilityId: 'mw.object.2816.attack-0',
                    breakdown: expect.objectContaining({
                        steps: expect.arrayContaining([
                            expect.objectContaining({
                                sourceId: 'mage-wars-object-armor',
                                value: -2,
                                runningTotal: 10,
                            }),
                        ]),
                    }),
                }),
            }),
        ]));
        expect(attacked.state.core.objects[armoredTarget.id]).toMatchObject({
            damage: 10,
            armor: 3,
        });
    });

    it('summons Royal Archer for player 1 in the priestess starting zone', () => {
        const creatureSpellId = 2816;
        const baseState = setupState('creatureAction');
        const readyToCast = {
            core: {
                ...withPreparedPlayerMage(
                    baseState.core,
                    '1',
                    MAGE_IDS.PRIESTESS_APPRENTICE,
                    [creatureSpellId],
                    20,
                ),
                currentPlayerId: '1',
                phaseActorId: '1',
            },
            sys: baseState.sys,
        };
        const command = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '1',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 12,
                targetZoneId: PLAYER_ONE_START_ZONE,
            },
        } satisfies MageWarsCommand;

        expect(validateCommand(readyToCast, command)).toBeUndefined();

        const summoned = runCommand(readyToCast, command);
        const archer = summoned.state.core.objects['mwobj-1-2816-1'];

        expect(summoned.success).toBe(true);
        expect(summoned.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    playerId: '1',
                    spellCardId: creatureSpellId,
                    manaCost: 12,
                    targetZoneId: PLAYER_ONE_START_ZONE,
                    castMode: 'action',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
                payload: expect.objectContaining({
                    object: expect.objectContaining({
                        id: 'mwobj-1-2816-1',
                        ownerId: '1',
                        sourceSpellCardId: creatureSpellId,
                        zoneId: PLAYER_ONE_START_ZONE,
                    }),
                }),
            }),
        ]));
        expect(archer).toMatchObject({
            kind: 'creature',
            ownerId: '1',
            sourceSpellCardId: creatureSpellId,
            sourceObjectId: 'spell-2816',
            name: '皇家箭手',
            zoneId: PLAYER_ONE_START_ZONE,
            life: 9,
            armor: 1,
            actionReady: false,
        });
        expect(summoned.state.core.arena.find((zone) => zone.id === PLAYER_ONE_START_ZONE)?.objectIds).toContain(archer.id);
        expect(summoned.state.core.players['1']).toMatchObject({
            mana: 8,
            actionReady: false,
            quickcastReady: true,
            preparedSpellCardIds: [],
            discardSpellCardIds: [creatureSpellId],
        });
    });

    it('summons Emerald Tegu from config and consumes its rot attack effect', () => {
        const creatureSpellId = 2808;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([creatureSpellId]));

        const summoned = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 9,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });

        const tegu = summoned.state.core.objects['mwobj-0-2808-1'];
        expect(summoned.success).toBe(true);
        expect(tegu).toMatchObject({
            kind: 'creature',
            ownerId: '0',
            sourceSpellCardId: creatureSpellId,
            sourceObjectId: 'spell-2808',
            name: '翠绿树蜥',
            zoneId: PLAYER_ZERO_START_ZONE,
            life: 8,
            armor: 3,
            actionReady: false,
            attackOrTraitLine: '剧毒噬咬：快速近战 3 骰，效果骰 `8+=腐化',
        });

        const livingTarget = makeArenaObject('living-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            armor: 0,
        });
        const attackCore = withArenaObject({
            ...summoned.state.core,
            objects: {
                ...summoned.state.core.objects,
                [tegu.id]: {
                    ...tegu,
                    actionReady: true,
                },
            },
        }, livingTarget);
        const rotRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 8 : fixedRandom.d(sides)),
        };

        const attacked = runCommand({
            core: attackCore,
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: tegu.id,
                attackProfileId: 'attack-0',
                targetObjectId: livingTarget.id,
            },
        }, rotRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: tegu.id,
                    attackProfileId: 'attack-0',
                    attackName: '剧毒噬咬',
                    targetObjectId: livingTarget.id,
                    diceResults: [3, 3, 3],
                    effectDieResult: 8,
                    baseDamage: 9,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: livingTarget.id,
                    statusTokenId: STATUS_TOKEN_IDS.ROT,
                    amount: 1,
                    sourceAbilityId: 'mw.object.2808.attack-0',
                    spellCardId: creatureSpellId,
                }),
            }),
        ]));
        expect(attacked.state.core.objects[livingTarget.id]).toMatchObject({
            damage: 9,
            statusTokens: {
                [STATUS_TOKEN_IDS.ROT]: 1,
            },
        });
    });

    it('summons passive creature cards whose current combat traits are config-consumable', () => {
        const cases = [
            {
                mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                spellCardId: 2909,
                manaCost: 13,
                objectId: 'mwobj-0-2909-1',
                name: '西锁骑士',
                life: 10,
                armor: 3,
                attackOrTraitLine: '长剑：快速近战 5 骰；防御图标 `8+ / 1x`；闪电+2',
            },
            {
                mageId: MAGE_IDS.WARLOCK_APPRENTICE,
                spellCardId: 2800,
                manaCost: 13,
                objectId: 'mwobj-0-2800-1',
                name: '暗契屠魔',
                life: 14,
                armor: 2,
                attackOrTraitLine: '狱火剑：快速近战 4 骰，穿刺+2；火焰-2',
            },
        ];

        for (const entry of cases) {
            const planningState = setupState('planning');
            const planned = runCommand({
                core: withPlayerMage(planningState.core, '0', entry.mageId),
                sys: planningState.sys,
            }, planCommand([entry.spellCardId]));
            const castState: MatchState<MageWarsCore> = {
                core: {
                    ...planned.state.core,
                    players: {
                        ...planned.state.core.players,
                        '0': {
                            ...planned.state.core.players['0'],
                            mana: 20,
                        },
                    },
                },
                sys: { ...planned.state.sys, phase: 'creatureAction' },
            };

            const summoned = runCommand(castState, {
                type: MAGE_WARS_COMMANDS.CAST_SPELL,
                playerId: '0',
                payload: {
                    spellCardId: entry.spellCardId,
                    manaCost: entry.manaCost,
                    targetZoneId: PLAYER_ZERO_START_ZONE,
                },
            });

            expect(summoned.success).toBe(true);
            expect(summoned.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
                    payload: expect.objectContaining({
                        object: expect.objectContaining({
                            id: entry.objectId,
                            sourceSpellCardId: entry.spellCardId,
                            sourceObjectId: `spell-${entry.spellCardId}`,
                            name: entry.name,
                            zoneId: PLAYER_ZERO_START_ZONE,
                            life: entry.life,
                            armor: entry.armor,
                            actionReady: false,
                            attackOrTraitLine: entry.attackOrTraitLine,
                        }),
                    }),
                }),
            ]));
            expect(summoned.state.core.objects[entry.objectId]).toMatchObject({
                name: entry.name,
                life: entry.life,
                armor: entry.armor,
                attackOrTraitLine: entry.attackOrTraitLine,
            });
            expect(summoned.state.core.players['0'].mana).toBe(20 - entry.manaCost);
        }
    });

    it('summons slow creature cards whose current combat traits are config-consumable', () => {
        const cases = [
            {
                spellCardId: 2809,
                manaCost: 12,
                objectId: 'mwobj-0-2809-1',
                name: '石目蛇蜥',
                life: 10,
                armor: 2,
                attackOrTraitLine: '麻痹光束：完整行动远程 `0-2` 2 骰，效果骰 `7+=残废`；噬咬：快速近战 4 骰；迟缓',
            },
            {
                spellCardId: 2810,
                manaCost: 16,
                objectId: 'mwobj-0-2810-1',
                name: '戈尔贡箭手',
                life: 13,
                armor: 1,
                attackOrTraitLine: '毒弓：完整行动远程 `1-2` 4 骰，效果骰 `4-9=虚弱`、`10+=虚弱x2`；利爪：快速近战 2 骰；重生2；迟缓',
            },
            {
                spellCardId: 2901,
                manaCost: 16,
                objectId: 'mwobj-0-2901-1',
                name: '暗沼九头蛇',
                life: 15,
                armor: 1,
                attackOrTraitLine: '猛力噬咬：快速近战 4 骰，反击；三重噬咬：完整行动近战 3 骰，三连击；重生2；迟缓',
            },
        ];

        for (const entry of cases) {
            const planningState = setupState('planning');
            const planned = runCommand({
                core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
                sys: planningState.sys,
            }, planCommand([entry.spellCardId]));
            const castState: MatchState<MageWarsCore> = {
                core: {
                    ...planned.state.core,
                    players: {
                        ...planned.state.core.players,
                        '0': {
                            ...planned.state.core.players['0'],
                            mana: 20,
                        },
                    },
                },
                sys: { ...planned.state.sys, phase: 'creatureAction' },
            };

            const summoned = runCommand(castState, {
                type: MAGE_WARS_COMMANDS.CAST_SPELL,
                playerId: '0',
                payload: {
                    spellCardId: entry.spellCardId,
                    manaCost: entry.manaCost,
                    targetZoneId: PLAYER_ZERO_START_ZONE,
                },
            });

            expect(summoned.success).toBe(true);
            expect(summoned.state.core.objects[entry.objectId]).toMatchObject({
                sourceSpellCardId: entry.spellCardId,
                sourceObjectId: `spell-${entry.spellCardId}`,
                name: entry.name,
                zoneId: PLAYER_ZERO_START_ZONE,
                life: entry.life,
                armor: entry.armor,
                actionReady: false,
                attackOrTraitLine: entry.attackOrTraitLine,
            });
            expect(summoned.state.core.players['0'].mana).toBe(20 - entry.manaCost);
        }
    });

    it('summons elemental and combat-profile creature cards whose current traits are config-consumable', () => {
        const cases = [
            {
                mageId: MAGE_IDS.WARLOCK_APPRENTICE,
                spellCardId: 2801,
                manaCost: 5,
                objectId: 'mwobj-0-2801-1',
                name: '火烙魔婴',
                life: 6,
                armor: 0,
                attackOrTraitLine: '狱火利爪：快速近战火焰 2 骰，效果骰 `8+=燃烧`，除霜；火焰免疫',
            },
            {
                mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                spellCardId: 2802,
                manaCost: 17,
                objectId: 'mwobj-0-2802-1',
                name: '钢爪灰熊',
                life: 15,
                armor: 3,
                attackOrTraitLine: '利爪：快速近战 5 骰，穿刺+1；重爪猛击：完整行动近战 7 骰，穿刺+1；霜冻-3',
            },
            {
                mageId: MAGE_IDS.WARLOCK_APPRENTICE,
                spellCardId: 2803,
                manaCost: 13,
                objectId: 'mwobj-0-2803-1',
                name: '烈焰狱鬼',
                life: 9,
                armor: 2,
                attackOrTraitLine: '烈焰爆弹：完整行动远程 `1-1` 火焰 3 骰，效果骰 `5-9=燃烧`、`10+=燃烧x2`，除霜；烈火三叉戟：快速近战火焰 4 骰，效果骰 `7-10=燃烧`、`11+=燃烧x2`，除霜；火焰免疫',
            },
            {
                mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                spellCardId: 2813,
                manaCost: 15,
                objectId: 'mwobj-0-2813-1',
                name: '布洛根·血石',
                life: 11,
                armor: 4,
                attackOrTraitLine: '斩首刃：快速近战 4 骰，无法回避，穿刺+3；闪电+2；传奇',
            },
        ];

        for (const entry of cases) {
            const planningState = setupState('planning');
            const planned = runCommand({
                core: withPlayerMage(planningState.core, '0', entry.mageId),
                sys: planningState.sys,
            }, planCommand([entry.spellCardId]));
            const castState: MatchState<MageWarsCore> = {
                core: {
                    ...planned.state.core,
                    players: {
                        ...planned.state.core.players,
                        '0': {
                            ...planned.state.core.players['0'],
                            mana: 20,
                        },
                    },
                },
                sys: { ...planned.state.sys, phase: 'creatureAction' },
            };

            const summoned = runCommand(castState, {
                type: MAGE_WARS_COMMANDS.CAST_SPELL,
                playerId: '0',
                payload: {
                    spellCardId: entry.spellCardId,
                    manaCost: entry.manaCost,
                    targetZoneId: PLAYER_ZERO_START_ZONE,
                },
            });

            expect(summoned.success).toBe(true);
            expect(summoned.state.core.objects[entry.objectId]).toMatchObject({
                sourceSpellCardId: entry.spellCardId,
                sourceObjectId: `spell-${entry.spellCardId}`,
                name: entry.name,
                zoneId: PLAYER_ZERO_START_ZONE,
                life: entry.life,
                armor: entry.armor,
                actionReady: false,
                attackOrTraitLine: entry.attackOrTraitLine,
            });
            expect(summoned.state.core.players['0'].mana).toBe(20 - entry.manaCost);
        }
    });

    it('applies Goran bloodthirst dice to wounded living melee targets only', () => {
        const goranSpellId = 2804;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([goranSpellId]));
        const summoned = runCommand({
            core: {
                ...planned.state.core,
                players: {
                    ...planned.state.core.players,
                    '0': {
                        ...planned.state.core.players['0'],
                        mana: 20,
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: goranSpellId,
                manaCost: 15,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const goran = summoned.state.core.objects['mwobj-0-2804-1'];

        expect(summoned.success).toBe(true);
        expect(goran).toMatchObject({
            sourceSpellCardId: goranSpellId,
            sourceObjectId: 'spell-2804',
            name: '狼人宠物戈伦',
            zoneId: PLAYER_ZERO_START_ZONE,
            life: 12,
            armor: 3,
            attackOrTraitLine: '尖牙：快速近战 4 骰；野性利爪：完整行动近战 3 骰，两连击；嗜血+1；传奇；限定邪术师',
            rulesText: '当狼人宠物戈伦与其控制方法师位于同一格区域时，其额外获得嗜血+1特性。',
        });

        const runGoranAttack = (
            target: MageWarsArenaObjectState,
            ownerMageZoneId = PLAYER_ZERO_START_ZONE,
            attackProfileId = 'attack-0',
        ) => {
            const readyGoran = { ...goran, actionReady: true };
            const core = withArenaObject(
                withArenaObject(
                    withPlayerInZone(summoned.state.core, '0', ownerMageZoneId),
                    readyGoran,
                ),
                target,
            );
            return runCommand({
                core,
                sys: { ...summoned.state.sys, phase: 'creatureAction' },
            }, {
                type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
                playerId: '0',
                payload: {
                    attackerObjectId: readyGoran.id,
                    attackProfileId,
                    targetObjectId: target.id,
                },
            });
        };

        const woundedLiving = makeArenaObject('wounded-living-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 40,
            damage: 1,
            armor: 0,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const freshLiving = makeArenaObject('fresh-living-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 40,
            damage: 0,
            armor: 0,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const woundedNonliving = makeArenaObject('wounded-nonliving-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 40,
            damage: 1,
            armor: 0,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });

        const sameZoneWounded = runGoranAttack(woundedLiving);
        const sameZoneWoundedRoll = sameZoneWounded.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));
        expect(sameZoneWounded.success).toBe(true);
        expect(sameZoneWoundedRoll).toEqual(expect.objectContaining({
            payload: expect.objectContaining({
                diceResults: [3, 3, 3, 3, 3, 3],
                baseDamage: 18,
                bloodthirstDiceModifier: 2,
            }),
        }));

        const differentZoneWounded = runGoranAttack(woundedLiving, ARENA_ZONE_IDS.B1);
        const differentZoneWoundedRoll = differentZoneWounded.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));
        expect(differentZoneWounded.success).toBe(true);
        expect(differentZoneWoundedRoll).toEqual(expect.objectContaining({
            payload: expect.objectContaining({
                diceResults: [3, 3, 3, 3, 3],
                baseDamage: 15,
                bloodthirstDiceModifier: 1,
            }),
        }));

        for (const target of [freshLiving, woundedNonliving]) {
            const result = runGoranAttack(target);
            const attackRoll = result.events.find((event) => (
                event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
            ));

            expect(result.success).toBe(true);
            expect(attackRoll).toEqual(expect.objectContaining({
                payload: expect.objectContaining({
                    diceResults: [3, 3, 3, 3],
                    baseDamage: 12,
                }),
            }));
            expect(attackRoll?.payload).not.toMatchObject({ bloodthirstDiceModifier: expect.any(Number) });
        }

        const doubleStrike = runGoranAttack(woundedLiving, PLAYER_ZERO_START_ZONE, 'attack-1');
        const doubleStrikeRolls = doubleStrike.events.filter((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));
        expect(doubleStrike.success).toBe(true);
        expect(doubleStrikeRolls).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    attackProfileId: 'attack-1',
                    attackName: '野性利爪',
                    diceResults: [3, 3, 3, 3, 3],
                    strikeIndex: 0,
                    strikeCount: 2,
                    baseDamage: 15,
                    bloodthirstDiceModifier: 2,
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    attackProfileId: 'attack-1',
                    attackName: '野性利爪',
                    diceResults: [3, 3, 3],
                    strikeIndex: 1,
                    strikeCount: 2,
                    baseDamage: 9,
                }),
            }),
        ]);
        expect(doubleStrikeRolls[1]?.payload).not.toMatchObject({ bloodthirstDiceModifier: expect.any(Number) });
    });

    it('moves ready arena creatures without consuming the mage action track', () => {
        const baseState = setupState('creatureAction');
        const object = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject({
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '0': {
                        ...baseState.core.players['0'],
                        actionReady: false,
                    },
                },
            }, object),
            sys: baseState.sys,
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: object.id, toZoneId: PLAYER_ONE_START_ZONE },
        })).toBe('zoneNotAdjacent');

        const crippledObject = makeArenaObject('crippled-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: {
                [STATUS_TOKEN_IDS.CRIPPLE]: 1,
            },
        });
        const crippledState: MatchState<MageWarsCore> = {
            core: withArenaObject(state.core, crippledObject),
            sys: state.sys,
        };

        expect(validateCommand(crippledState, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: crippledObject.id, toZoneId: ARENA_ZONE_IDS.A2 },
        })).toBe('objectCrippled');

        const blockedMove = runCommand(crippledState, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: crippledObject.id, toZoneId: ARENA_ZONE_IDS.A2 },
        });
        expect(blockedMove.success).toBe(false);
        expect(blockedMove.error).toBe('objectCrippled');
        expect(blockedMove.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED);
        expect(blockedMove.state.core.objects[crippledObject.id]).toMatchObject({
            zoneId: PLAYER_ZERO_START_ZONE,
            actionReady: true,
        });

        const moved = runCommand(state, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: object.id, toZoneId: ARENA_ZONE_IDS.A2 },
        });

        expect(moved.success).toBe(true);
        expect(moved.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED);
        expect(moved.state.core.players['0'].actionReady).toBe(false);
        expect(moved.state.core.objects[object.id]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A2,
            actionReady: false,
        });
        expect(moved.state.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)?.objectIds).not.toContain(object.id);
        expect(moved.state.core.arena.find((zone) => zone.id === ARENA_ZONE_IDS.A2)?.objectIds).toContain(object.id);
        expect(actionLogKinds(moved.state)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED);
    });

    it('rejects unknown arena object abilities before execution', () => {
        const state = setupState('creatureAction');
        const command: MageWarsCommand = {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: 'missing-object',
                abilityId: 'mw.object.unknown' as MageWarsObjectAbilityId,
                manaCost: 0,
            },
        };

        expect(validateCommand(state, command)).toBe('unknownArenaObjectAbility');
        const result = runCommand(state, command);
        expect(result.success).toBe(false);
        expect(result.events).toEqual([]);
    });

    it('lets Blue Gremlin pay for swift teleport movement until the creature action ends', () => {
        const creatureSpellId = 2822;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([creatureSpellId]));

        const summoned = runCommand({
            core: { ...planned.state.core, phaseReadyPlayerIds: ['1'] },
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 7,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const gremlinId = 'mwobj-0-2822-1';
        const gremlin = summoned.state.core.objects[gremlinId];

        expect(summoned.success).toBe(true);
        expect(gremlin).toMatchObject({
            sourceSpellCardId: creatureSpellId,
            name: '蓝色精怪',
            actionReady: false,
        });

        const readyState: MatchState<MageWarsCore> = {
            core: {
                ...summoned.state.core,
                players: {
                    ...summoned.state.core.players,
                    '0': {
                        ...summoned.state.core.players['0'],
                        mana: 3,
                    },
                },
                objects: {
                    ...summoned.state.core.objects,
                    [gremlinId]: {
                        ...gremlin,
                        actionReady: true,
                    },
                },
            },
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        };
        const nonGremlinState: MatchState<MageWarsCore> = {
            core: withArenaObject(readyState.core, makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE)),
            sys: readyState.sys,
        };

        expect(validateCommand(nonGremlinState, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: 'cat-0',
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                manaCost: 1,
            },
        })).toBe('invalidArenaObjectAbilitySource');
        expect(validateCommand(readyState, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: gremlinId,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                manaCost: 2,
            },
        })).toBe('manaCostMismatch');

        const activated = runCommand(readyState, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: gremlinId,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                manaCost: 1,
            },
        });

        expect(activated.success).toBe(true);
        expect(activated.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
                payload: expect.objectContaining({
                    objectId: gremlinId,
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                    manaCost: 1,
                    grants: ['swift', 'teleportMovement'],
                }),
            }),
        ]));
        expect(activated.state.core.players['0'].mana).toBe(2);
        expect(activated.state.core.objects[gremlinId]).toMatchObject({
            actionReady: true,
            temporaryTraits: {
                swift: true,
                teleportMovement: true,
                freeMoveUsedThisAction: false,
            },
        });
        expect(validateCommand(activated.state, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: gremlinId,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                manaCost: 1,
            },
        })).toBe('objectAbilityAlreadyActive');

        const slowActivatedState: MatchState<MageWarsCore> = {
            core: {
                ...activated.state.core,
                objects: {
                    ...activated.state.core.objects,
                    [gremlinId]: {
                        ...activated.state.core.objects[gremlinId],
                        attackOrTraitLine: '利爪：快速近战 2 骰；迟缓',
                    },
                },
            },
            sys: activated.state.sys,
        };
        const slowMove = runCommand(slowActivatedState, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: gremlinId, toZoneId: ARENA_ZONE_IDS.A2 },
        });

        expect(slowMove.success).toBe(true);
        expect(slowMove.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED,
                payload: expect.objectContaining({
                    objectId: gremlinId,
                    actionCost: 'normal',
                    movementMode: 'teleport',
                    sourceAbilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                }),
            }),
        ]));
        expect(slowMove.state.core.objects[gremlinId]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A2,
            actionReady: false,
            temporaryTraits: {
                swift: true,
                teleportMovement: true,
                freeMoveUsedThisAction: false,
            },
        });

        const firstMove = runCommand(activated.state, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: gremlinId, toZoneId: ARENA_ZONE_IDS.A2 },
        });

        expect(firstMove.success).toBe(true);
        expect(firstMove.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED,
                payload: expect.objectContaining({
                    objectId: gremlinId,
                    actionCost: 'none',
                    movementMode: 'teleport',
                    sourceAbilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                }),
            }),
        ]));
        expect(firstMove.state.core.objects[gremlinId]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A2,
            actionReady: true,
            temporaryTraits: {
                freeMoveUsedThisAction: true,
            },
        });

        const secondMove = runCommand(firstMove.state, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: gremlinId, toZoneId: ARENA_ZONE_IDS.A3 },
        });

        expect(secondMove.success).toBe(true);
        expect(secondMove.state.core.objects[gremlinId]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A3,
            actionReady: false,
        });

        const advanced = runCommand(secondMove.state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(advanced.success).toBe(true);
        expect(advanced.state.sys.phase).toBe('finalQuickcast');
        expect(advanced.state.core.objects[gremlinId].temporaryTraits).toBeUndefined();
        expect(advanced.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED,
                payload: expect.objectContaining({
                    objectId: gremlinId,
                    traitIds: expect.arrayContaining(['swift', 'teleportMovement']),
                }),
            }),
        ]));
        expect(actionLogKinds(advanced.state)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED);
    });

    it('uses Asyran Cleric healing light as a full-action arena object healing ability', () => {
        const baseState = setupState('creatureAction');
        const cleric = makeArenaObject('cleric-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2811,
            sourceObjectId: 'spell-card-2811',
            name: '阿希拉牧师',
            life: 6,
            armor: 1,
            attackOrTraitLine: '法杖：快速近战 2 骰；治疗之光：完整行动治疗 `0-1`，治疗目标活体生物，治疗效果等于掷骰的结果',
        });
        const woundedCat = makeArenaObject('wounded-cat-0', '0', ARENA_ZONE_IDS.A2, {
            life: 8,
            damage: 3,
        });
        const healingRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 3 ? 2 : fixedRandom.d(sides)),
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, cleric), woundedCat),
            sys: baseState.sys,
        };

        const healed = runCommand(state, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: cleric.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                manaCost: 0,
                targetObjectId: woundedCat.id,
            },
        }, healingRandom);

        expect(healed.success).toBe(true);
        expect(healed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
                payload: expect.objectContaining({
                    objectId: cleric.id,
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                    abilityName: '治疗之光',
                    manaCost: 0,
                    targetObjectId: woundedCat.id,
                    actionCost: 'normal',
                    grants: [],
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: expect.objectContaining({
                    spellCardId: 2811,
                    sourceAbilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                    targetObjectId: woundedCat.id,
                    targetZoneId: woundedCat.zoneId,
                    diceResults: [2],
                    healing: 2,
                    actualHealing: 2,
                }),
            }),
        ]));
        expect(healed.state.core.players['0'].mana).toBe(baseState.core.players['0'].mana);
        expect(healed.state.core.objects[cleric.id]).toMatchObject({
            actionReady: false,
        });
        expect(healed.state.core.objects[woundedCat.id]).toMatchObject({
            damage: 1,
        });
        expect(actionLogKinds(healed.state)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
            MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
        ]));
    });

    it('rejects Asyran Cleric healing light for nonliving or out-of-range targets', () => {
        const baseState = setupState('creatureAction');
        const cleric = makeArenaObject('cleric-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2811,
            sourceObjectId: 'spell-card-2811',
            name: '阿希拉牧师',
            attackOrTraitLine: '法杖：快速近战 2 骰；治疗之光：完整行动治疗 `0-1`，治疗目标活体生物，治疗效果等于掷骰的结果',
        });
        const nonlivingTarget = makeArenaObject('skeleton-1', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });
        const farTarget = makeArenaObject('far-cat-1', '1', PLAYER_ONE_START_ZONE);
        const wrongSource = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const state: MatchState<MageWarsCore> = {
            core: [cleric, nonlivingTarget, farTarget, wrongSource].reduce(
                (core, object) => withArenaObject(core, object),
                baseState.core,
            ),
            sys: baseState.sys,
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: cleric.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                manaCost: 0,
                targetObjectId: nonlivingTarget.id,
            },
        })).toBe('invalidTargetObject');
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: cleric.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                manaCost: 0,
                targetObjectId: farTarget.id,
            },
        })).toBe('targetOutOfRange');
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: wrongSource.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                manaCost: 0,
                targetObjectId: cleric.id,
            },
        })).toBe('invalidArenaObjectAbilitySource');
    });

    it('uses Grey Angel redemption sacrifice to heal any living arena creature and destroy itself', () => {
        const baseState = setupState('creatureAction');
        const greyAngel = makeArenaObject('grey-angel-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2907,
            sourceObjectId: 'spell-card-2907',
            name: '灰衣天使',
            life: 10,
            armor: 2,
            attackOrTraitLine: '利剑：快速近战 4 骰；救赎献祭：完整行动治疗 6 骰，治疗竞技场中任一活体生物，治疗效果等于掷骰结果，然后摧毁灰衣天使；飞行',
        });
        const distantWoundedCreature = makeArenaObject('distant-wounded-1', '1', PLAYER_ONE_START_ZONE, {
            life: 10,
            damage: 7,
        });
        const healingRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 3 ? 2 : fixedRandom.d(sides)),
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, greyAngel), distantWoundedCreature),
            sys: baseState.sys,
        };

        const healed = runCommand(state, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: greyAngel.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.GREY_ANGEL_REDEMPTION_SACRIFICE,
                manaCost: 0,
                targetObjectId: distantWoundedCreature.id,
            },
        }, healingRandom);

        expect(healed.success).toBe(true);
        expect(healed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
                payload: expect.objectContaining({
                    objectId: greyAngel.id,
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.GREY_ANGEL_REDEMPTION_SACRIFICE,
                    abilityName: '救赎献祭',
                    manaCost: 0,
                    targetObjectId: distantWoundedCreature.id,
                    actionCost: 'normal',
                    grants: [],
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: expect.objectContaining({
                    spellCardId: 2907,
                    sourceAbilityId: MAGE_WARS_OBJECT_ABILITY_IDS.GREY_ANGEL_REDEMPTION_SACRIFICE,
                    targetObjectId: distantWoundedCreature.id,
                    targetZoneId: distantWoundedCreature.zoneId,
                    diceResults: [2, 2, 2, 2, 2, 2],
                    healing: 12,
                    actualHealing: 7,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: greyAngel.id,
                    ownerId: '0',
                    sourceAbilityId: MAGE_WARS_OBJECT_ABILITY_IDS.GREY_ANGEL_REDEMPTION_SACRIFICE,
                    spellCardId: 2907,
                }),
            }),
        ]));
        expect(healed.state.core.players['0'].mana).toBe(baseState.core.players['0'].mana);
        expect(healed.state.core.objects[greyAngel.id]).toBeUndefined();
        expect(healed.state.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)?.objectIds).not.toContain(greyAngel.id);
        expect(healed.state.core.objects[distantWoundedCreature.id]).toMatchObject({
            damage: 0,
        });
        expect(actionLogKinds(healed.state)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
            MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
            MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
        ]));
    });

    it('rejects Grey Angel redemption sacrifice for nonliving targets or wrong sources', () => {
        const baseState = setupState('creatureAction');
        const greyAngel = makeArenaObject('grey-angel-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2907,
            sourceObjectId: 'spell-card-2907',
            name: '灰衣天使',
            attackOrTraitLine: '利剑：快速近战 4 骰；救赎献祭：完整行动治疗 6 骰，治疗竞技场中任一活体生物，治疗效果等于掷骰结果，然后摧毁灰衣天使；飞行',
        });
        const nonlivingTarget = makeArenaObject('skeleton-1', '1', PLAYER_ONE_START_ZONE, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });
        const wrongSource = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const state: MatchState<MageWarsCore> = {
            core: [greyAngel, nonlivingTarget, wrongSource].reduce(
                (core, object) => withArenaObject(core, object),
                baseState.core,
            ),
            sys: baseState.sys,
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: greyAngel.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.GREY_ANGEL_REDEMPTION_SACRIFICE,
                manaCost: 0,
                targetObjectId: nonlivingTarget.id,
            },
        })).toBe('invalidTargetObject');
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: wrongSource.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.GREY_ANGEL_REDEMPTION_SACRIFICE,
                manaCost: 0,
                targetObjectId: greyAngel.id,
            },
        })).toBe('invalidArenaObjectAbilitySource');
    });

    it('lets printed swift creatures use one free move before spending their action', () => {
        const creatureSpellId = 2812;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([creatureSpellId]));

        const summoned = runCommand({
            core: { ...planned.state.core, phaseReadyPlayerIds: [] },
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 5,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const foxId = 'mwobj-0-2812-1';

        expect(summoned.success).toBe(true);
        expect(summoned.state.core.objects[foxId]).toMatchObject({
            sourceSpellCardId: creatureSpellId,
            name: '苦木林狐',
            attackOrTraitLine: '噬咬：快速近战 3 骰；迅捷',
            actionReady: false,
        });

        const readyState: MatchState<MageWarsCore> = {
            core: {
                ...summoned.state.core,
                objects: {
                    ...summoned.state.core.objects,
                    [foxId]: {
                        ...summoned.state.core.objects[foxId],
                        actionReady: true,
                    },
                },
            },
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        };
        const firstMove = runCommand(readyState, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: foxId, toZoneId: ARENA_ZONE_IDS.A2 },
        });

        expect(firstMove.success).toBe(true);
        expect(firstMove.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED,
                payload: expect.objectContaining({
                    objectId: foxId,
                    actionCost: 'none',
                }),
            }),
        ]));
        const firstMoveEvent = firstMove.events.find((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED);
        expect(firstMoveEvent?.payload).not.toMatchObject({
            movementMode: 'teleport',
            sourceAbilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
        });
        expect(firstMove.state.core.objects[foxId]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A2,
            actionReady: true,
            temporaryTraits: {
                freeMoveUsedThisAction: true,
            },
        });

        const secondMove = runCommand(firstMove.state, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: foxId, toZoneId: ARENA_ZONE_IDS.A3 },
        });

        expect(secondMove.success).toBe(true);
        expect(secondMove.state.core.objects[foxId]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A3,
            actionReady: false,
            temporaryTraits: {
                freeMoveUsedThisAction: true,
            },
        });

        const advanced = runCommand(secondMove.state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(advanced.success).toBe(true);
        expect(advanced.state.core.objects[foxId].temporaryTraits).toBeUndefined();
        expect(advanced.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED,
                payload: expect.objectContaining({
                    objectId: foxId,
                    traitIds: expect.arrayContaining(['swiftFreeMove']),
                    sourceAbilityId: 'mw.trait.swift.printed',
                }),
            }),
        ]));
        expect(actionLogKinds(advanced.state)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED);
    });

    it('summons Thunderift Falcon with flying and printed swift traits from config', () => {
        const creatureSpellId = 2820;
        const jetStreamSpellId = 1711;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([creatureSpellId]));

        const summoned = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 6,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const falconId = 'mwobj-0-2820-1';

        expect(summoned.success).toBe(true);
        expect(summoned.state.core.objects[falconId]).toMatchObject({
            sourceSpellCardId: creatureSpellId,
            sourceObjectId: 'spell-2820',
            name: '雷隙猎鹰',
            life: 5,
            armor: 0,
            attackOrTraitLine: '剃刀鸟喙：快速近战 3 骰；飞行；迅捷',
            actionReady: false,
        });

        const readyState: MatchState<MageWarsCore> = {
            core: {
                ...summoned.state.core,
                objects: {
                    ...summoned.state.core.objects,
                    [falconId]: {
                        ...summoned.state.core.objects[falconId],
                        actionReady: true,
                    },
                },
            },
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        };
        const firstMove = runCommand(readyState, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: falconId, toZoneId: ARENA_ZONE_IDS.A2 },
        });

        expect(firstMove.success).toBe(true);
        expect(firstMove.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED,
                payload: expect.objectContaining({
                    objectId: falconId,
                    actionCost: 'none',
                    movementMode: 'normal',
                }),
            }),
        ]));
        expect(firstMove.state.core.objects[falconId]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A2,
            actionReady: true,
            temporaryTraits: {
                freeMoveUsedThisAction: true,
            },
        });

        const jetStreamRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 3 : 3),
        };
        const opponentBeastmasterCore = withPlayerMage(
            withPlayerInZone(withCurrentPlayer(firstMove.state.core, '1'), '1', ARENA_ZONE_IDS.B2),
            '1',
            MAGE_IDS.BEASTMASTER_APPRENTICE,
        );
        const jetStreamState: MatchState<MageWarsCore> = {
            core: {
                ...opponentBeastmasterCore,
                players: {
                    ...opponentBeastmasterCore.players,
                    '1': {
                        ...opponentBeastmasterCore.players['1'],
                        mana: 20,
                        quickcastReady: true,
                        preparedSpellCardIds: [jetStreamSpellId],
                    },
                },
            },
            sys: { ...firstMove.state.sys, phase: 'initiativeQuickcast' },
        };
        const jetStream = runCommand(jetStreamState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '1',
            payload: {
                spellCardId: jetStreamSpellId,
                manaCost: 4,
                targetObjectId: falconId,
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
        }, jetStreamRandom);

        const damageEvent = jetStream.events.find((event) => event.type === 'DAMAGE_DEALT');
        expect(jetStream.success).toBe(true);
        expect(damageEvent).toMatchObject({
            payload: {
                targetId: falconId,
                actualDamage: 8,
                sourceAbilityId: 'mw.spell.1711',
                breakdown: expect.objectContaining({
                    steps: expect.arrayContaining([
                        expect.objectContaining({
                            sourceId: 'mage-wars-flying-bonus',
                            sourceName: '对抗飞行',
                            value: 2,
                        }),
                    ]),
                }),
            },
        });
    });

    it('summons Deepwood Shadow and consumes its swift, elusive, legendary, and defense traits', () => {
        const creatureSpellId = 2824;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([creatureSpellId]));

        const summoned = runCommand({
            core: {
                ...planned.state.core,
                players: {
                    ...planned.state.core.players,
                    '0': {
                        ...planned.state.core.players['0'],
                        mana: 20,
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 15,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const shadowId = 'mwobj-0-2824-1';
        const shadow = summoned.state.core.objects[shadowId];

        expect(summoned.success).toBe(true);
        expect(shadow).toMatchObject({
            sourceSpellCardId: creatureSpellId,
            sourceObjectId: 'spell-2824',
            name: '深林幽影切维尔',
            life: 11,
            armor: 2,
            attackOrTraitLine: '利爪与噬咬：快速近战 4 骰；防御图标 `8+ / 1x`；迅捷；遁逸；传奇',
            actionReady: false,
        });

        const duplicateCastState: MatchState<MageWarsCore> = {
            core: {
                ...summoned.state.core,
                players: {
                    ...summoned.state.core.players,
                    '0': {
                        ...summoned.state.core.players['0'],
                        mana: 20,
                        actionReady: true,
                        preparedSpellCardIds: [creatureSpellId],
                    },
                },
            },
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        };
        expect(validateCommand(duplicateCastState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 15,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        })).toBe('legendaryObjectAlreadyInPlay');

        const afterShadowLeavesState: MatchState<MageWarsCore> = {
            core: {
                ...duplicateCastState.core,
                objects: {},
                arena: duplicateCastState.core.arena.map((zone) => ({
                    ...zone,
                    objectIds: zone.objectIds.filter((objectId) => objectId !== shadowId),
                    conjurationIds: zone.conjurationIds.filter((objectId) => objectId !== shadowId),
                })),
            },
            sys: duplicateCastState.sys,
        };
        expect(validateCommand(afterShadowLeavesState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 15,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        })).toBeUndefined();

        const enemyGuard = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            guarding: true,
            life: 20,
            attackOrTraitLine: '短剑：快速近战 4 骰',
        });
        const guardedMageCore = withPlayerInZone(
            withArenaObject({
                ...summoned.state.core,
                objects: {
                    ...summoned.state.core.objects,
                    [shadowId]: {
                        ...shadow,
                        actionReady: true,
                    },
                },
            }, enemyGuard),
            '1',
            PLAYER_ZERO_START_ZONE,
        );
        const attackMageState: MatchState<MageWarsCore> = {
            core: guardedMageCore,
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        };
        const attackEnemyMage = runCommand(attackMageState, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: shadowId,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(attackEnemyMage.success).toBe(true);
        expect(attackEnemyMage.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);
        expect(attackEnemyMage.state.core.objects[enemyGuard.id].guarding).toBe(true);

        const attackGuard = runCommand({
            core: guardedMageCore,
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: shadowId,
                attackProfileId: 'attack-0',
                targetObjectId: enemyGuard.id,
            },
        });
        expect(attackGuard.success).toBe(true);
        expect(attackGuard.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE);

        const enemyBlocker = makeArenaObject('blocker-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
        });
        const enemyDestinationBlocker = makeArenaObject('destination-blocker-1', '1', ARENA_ZONE_IDS.A2, {
            life: 20,
        });
        const readyShadowState: MatchState<MageWarsCore> = {
            core: [enemyBlocker, enemyDestinationBlocker].reduce(
                (core, object) => withArenaObject(core, object),
                {
                    ...summoned.state.core,
                    objects: {
                        ...summoned.state.core.objects,
                        [shadowId]: {
                            ...shadow,
                            actionReady: true,
                        },
                    },
                },
            ),
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        };
        const elusiveMove = runCommand(readyShadowState, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: shadowId, toZoneId: ARENA_ZONE_IDS.A2 },
        });
        expect(elusiveMove.success).toBe(true);
        expect(elusiveMove.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED,
                payload: expect.objectContaining({
                    objectId: shadowId,
                    actionCost: 'none',
                }),
            }),
        ]));
        expect(elusiveMove.state.core.objects[shadowId]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A2,
            actionReady: true,
        });

        const swiftFox = makeArenaObject('swift-fox-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '噬咬：快速近战 3 骰；迅捷',
        });
        const hinderedSwiftState: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(setupState('creatureAction').core, swiftFox), enemyBlocker),
            sys: readyShadowState.sys,
        };
        const hinderedSwiftMove = runCommand(hinderedSwiftState, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: swiftFox.id, toZoneId: ARENA_ZONE_IDS.A2 },
        });
        expect(hinderedSwiftMove.success).toBe(true);
        expect(hinderedSwiftMove.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED,
                payload: expect.objectContaining({
                    objectId: swiftFox.id,
                }),
            }),
        ]));
        const hinderedMoveEvent = hinderedSwiftMove.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED
        ));
        expect(hinderedMoveEvent?.payload).not.toMatchObject({ actionCost: 'none' });
        expect(hinderedSwiftMove.state.core.objects[swiftFox.id]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A2,
            actionReady: false,
        });
    });

    it('summons Tanglevine and consumes its attached conjuration restraint rules', () => {
        const conjurationSpellId = 2224;
        const forcePushSpellId = 3425;
        const planningState = setupState('planning');
        const target = makeArenaObject('target-wolf-1', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-2819',
            name: '目标丛林灰狼',
            life: 6,
            attackOrTraitLine: '噬咬：快速近战 3 骰',
        });
        const flyingTarget = makeArenaObject('flying-target-1', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2820,
            sourceObjectId: 'spell-2820',
            name: '雷隙猎鹰',
            attackOrTraitLine: '爪击：快速近战 3 骰；飞行；迅捷',
        });
        const uncontainableTarget = makeArenaObject('uncontainable-target-1', '1', ARENA_ZONE_IDS.A2, {
            attackOrTraitLine: '拳击：快速近战 3 骰；不羁',
        });
        const conjurationTarget = makeArenaObject('conjuration-target-1', '1', ARENA_ZONE_IDS.A2, {
            kind: 'conjuration',
            sourceSpellCardId: 2224,
            sourceObjectId: 'spell-2224',
            name: '已有魔物',
        });
        const planned = runCommand({
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(
                        withArenaObject(
                            withPlayerMage(planningState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE),
                            target,
                        ),
                        flyingTarget,
                    ),
                    uncontainableTarget,
                ),
                conjurationTarget,
            ),
            sys: planningState.sys,
        }, planCommand([conjurationSpellId]));
        const readyToCast: MatchState<MageWarsCore> = {
            core: {
                ...planned.state.core,
                players: {
                    ...planned.state.core.players,
                    '0': {
                        ...planned.state.core.players['0'],
                        mana: 10,
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        };

        expect(validateCommand(readyToCast, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: conjurationSpellId,
                manaCost: 5,
                targetPlayerId: '1',
            },
        })).toBe('invalidTargetMode');
        for (const invalidTarget of [flyingTarget, uncontainableTarget, conjurationTarget]) {
            expect(validateCommand(readyToCast, {
                type: MAGE_WARS_COMMANDS.CAST_SPELL,
                playerId: '0',
                payload: {
                    spellCardId: conjurationSpellId,
                    manaCost: 5,
                    targetObjectId: invalidTarget.id,
                },
            })).toBe('invalidTargetObject');
        }

        const summoned = runCommand(readyToCast, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: conjurationSpellId,
                manaCost: 5,
                targetObjectId: target.id,
            },
        });
        const tanglevineId = 'mwobj-0-2224-1';
        const tanglevine = summoned.state.core.objects[tanglevineId];

        expect(summoned.success).toBe(true);
        expect(summoned.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
            MAGE_WARS_EVENTS.ARENA_OBJECT_RESTRAINED,
        ]));
        expect(tanglevine).toMatchObject({
            kind: 'conjuration',
            ownerId: '0',
            sourceSpellCardId: conjurationSpellId,
            sourceObjectId: 'spell-2224',
            name: '缠绕藤蔓',
            zoneId: ARENA_ZONE_IDS.A2,
            life: 8,
            armor: 0,
            anchoredToObjectId: target.id,
            attackOrTraitLine: '活体；火焰+2；水流免疫',
            rulesText: '目标被束缚并且获得稳固特性。缠绕藤蔓不能将具有飞行或不羁特性的生物作为目标。远程攻击不能将缠绕藤蔓作为目标。',
        });
        expect(summoned.state.core.objects[target.id]).toMatchObject({
            restrainedByObjectId: tanglevineId,
        });
        expect(summoned.state.core.objects[target.id].statusTokens[STATUS_TOKEN_IDS.CRIPPLE]).toBeUndefined();
        expect(summoned.state.core.arena.find((zone) => zone.id === ARENA_ZONE_IDS.A2)?.conjurationIds).toContain(tanglevineId);

        expect(validateCommand({
            core: {
                ...summoned.state.core,
                currentPlayerId: '1',
            },
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '1',
            payload: { objectId: target.id, toZoneId: ARENA_ZONE_IDS.A3 },
        })).toBe('objectCrippled');

        const forcePushCore = withPlayerMage(summoned.state.core, '1', MAGE_IDS.WARLOCK_APPRENTICE);
        expect(validateCommand({
            core: {
                ...forcePushCore,
                currentPlayerId: '1',
                players: {
                    ...forcePushCore.players,
                    '1': {
                        ...forcePushCore.players['1'],
                        mana: 10,
                        actionReady: true,
                        preparedSpellCardIds: [forcePushSpellId],
                    },
                },
            },
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '1',
            payload: {
                spellCardId: forcePushSpellId,
                manaCost: 3,
                targetObjectId: target.id,
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
        })).toBe('targetUnmovable');

        expect(validateCommand({
            core: {
                ...summoned.state.core,
                players: {
                    ...summoned.state.core.players,
                    '0': {
                        ...summoned.state.core.players['0'],
                        mana: 10,
                        actionReady: true,
                        preparedSpellCardIds: [conjurationSpellId],
                    },
                },
            },
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: conjurationSpellId,
                manaCost: 5,
                targetObjectId: target.id,
            },
        })).toBe('conjurationAlreadyAttached');

        const rangedAttacker = makeArenaObject('ranged-attacker-1', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2816,
            sourceObjectId: 'spell-2816',
            name: '敌方皇家箭手',
            attackOrTraitLine: '长弓：完整行动远程 `0-2` 4 骰；小刀：快速近战 2 骰',
        });
        const meleeAttacker = makeArenaObject('melee-attacker-1', '1', ARENA_ZONE_IDS.A2, {
            attackOrTraitLine: '短剑：快速近战 3 骰',
        });
        const attackState: MatchState<MageWarsCore> = {
            core: [rangedAttacker, meleeAttacker].reduce(
                (core, object) => withArenaObject(core, object),
                {
                    ...summoned.state.core,
                    currentPlayerId: '1',
                },
            ),
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        };

        expect(validateCommand(attackState, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '1',
            payload: {
                attackerObjectId: rangedAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: tanglevineId,
            },
        })).toBe('rangedAttackForbiddenTarget');
        expect(validateCommand(attackState, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '1',
            payload: {
                attackerObjectId: meleeAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: tanglevineId,
            },
        })).toBeUndefined();
    });

    it('summons Darkfenne Bat with flying and rot attack traits from config', () => {
        const creatureSpellId = 2825;
        const jetStreamSpellId = 1711;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([creatureSpellId]));

        const summoned = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 5,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const batId = 'mwobj-0-2825-1';
        const bat = summoned.state.core.objects[batId];

        expect(summoned.success).toBe(true);
        expect(bat).toMatchObject({
            sourceSpellCardId: creatureSpellId,
            sourceObjectId: 'spell-2825',
            name: '暗沼蝙蝠',
            life: 4,
            armor: 0,
            attackOrTraitLine: '致病噬咬：快速近战 2 骰，效果骰 `9+=腐化`；飞行',
            actionReady: false,
        });

        const livingTarget = makeArenaObject('bat-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            armor: 0,
        });
        const attackCore = withArenaObject({
            ...summoned.state.core,
            objects: {
                ...summoned.state.core.objects,
                [batId]: {
                    ...bat,
                    actionReady: true,
                },
            },
        }, livingTarget);
        const rotRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 9 : fixedRandom.d(sides)),
        };

        const attacked = runCommand({
            core: attackCore,
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: batId,
                attackProfileId: 'attack-0',
                targetObjectId: livingTarget.id,
            },
        }, rotRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: batId,
                    attackName: '致病噬咬',
                    diceResults: [3, 3],
                    effectDieResult: 9,
                    baseDamage: 6,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: livingTarget.id,
                    statusTokenId: STATUS_TOKEN_IDS.ROT,
                    amount: 1,
                    sourceAbilityId: 'mw.object.2825.attack-0',
                    spellCardId: creatureSpellId,
                }),
            }),
        ]));
        expect(attacked.state.core.objects[livingTarget.id].statusTokens[STATUS_TOKEN_IDS.ROT]).toBe(1);

        const opponentBeastmasterCore = withPlayerInZone(
            withPlayerMage(withCurrentPlayer(attacked.state.core, '1'), '1', MAGE_IDS.BEASTMASTER_APPRENTICE),
            '1',
            ARENA_ZONE_IDS.A2,
        );
        const jetStreamState: MatchState<MageWarsCore> = {
            core: {
                ...opponentBeastmasterCore,
                players: {
                    ...opponentBeastmasterCore.players,
                    '1': {
                        ...opponentBeastmasterCore.players['1'],
                        mana: 20,
                        quickcastReady: true,
                        preparedSpellCardIds: [jetStreamSpellId],
                    },
                },
            },
            sys: { ...attacked.state.sys, phase: 'initiativeQuickcast' },
        };
        const jetStreamRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 3 : 3),
        };
        const jetStream = runCommand(jetStreamState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '1',
            payload: {
                spellCardId: jetStreamSpellId,
                manaCost: 4,
                targetObjectId: batId,
                pushToZoneId: ARENA_ZONE_IDS.A2,
            },
        }, jetStreamRandom);

        const damageEvent = jetStream.events.find((event) => event.type === 'DAMAGE_DEALT');
        expect(jetStream.success).toBe(true);
        expect(damageEvent).toMatchObject({
            payload: {
                targetId: batId,
                actualDamage: 8,
                sourceAbilityId: 'mw.spell.1711',
                breakdown: expect.objectContaining({
                    steps: expect.arrayContaining([
                        expect.objectContaining({
                            sourceId: 'mage-wars-flying-bonus',
                            sourceName: '对抗飞行',
                            value: 2,
                        }),
                    ]),
                }),
            },
        });
    });

    it('applies Charge after a creature moves and immediately makes a quick melee attack', () => {
        const baseState = setupState('creatureAction');
        const wildcat = makeArenaObject('wildcat-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-card-2906',
            name: '野性山猫',
            attackOrTraitLine: CAT_ATTACK_WITH_DEFENSE_LINE,
        });
        const target = makeArenaObject('target-1', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: '丛林灰狼',
            life: 20,
            attackOrTraitLine: '噬咬：快速近战 3 骰',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, wildcat), target),
            sys: baseState.sys,
        };

        const moved = runCommand(state, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: wildcat.id, toZoneId: ARENA_ZONE_IDS.A2 },
        });

        expect(moved.success).toBe(true);
        expect(moved.state.core.objects[wildcat.id]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A2,
            actionReady: false,
            temporaryTraits: {
                movedThisAction: true,
                quickActionAfterMoveAvailable: true,
            },
        });

        const attackCommand: MageWarsCommand = {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: wildcat.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        };

        expect(validateCommand(moved.state, attackCommand)).toBeUndefined();

        const attacked = runCommand(moved.state, attackCommand);
        const attackEvent = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));
        const damageEvent = attacked.events.find((event) => event.type === 'DAMAGE_DEALT');

        expect(attacked.success).toBe(true);
        expect(attackEvent).toMatchObject({
            payload: {
                attackerObjectId: wildcat.id,
                targetObjectId: target.id,
                diceResults: [3, 3, 3, 3],
                rawEffectDieResult: 3,
                effectDieResult: 3,
                chargeDiceModifier: 2,
                baseDamage: 12,
            },
        });
        expect(damageEvent).toMatchObject({
            payload: {
                targetId: target.id,
                actualDamage: 12,
            },
        });
        expect(attacked.state.core.objects[wildcat.id]).toMatchObject({
            actionReady: false,
        });
        expect(attacked.state.core.objects[wildcat.id].temporaryTraits).toBeUndefined();
    });

    it('lets Charge On grant swift and charge until the creature action ends', () => {
        const chargeOnSpellId = 3407;
        const planningState = setupState('planning');
        const casterCore = withPlayerMage(planningState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE);
        const creature = makeArenaObject('wolf-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: '丛林灰狼',
            attackOrTraitLine: '噬咬：快速近战 3 骰',
        });
        const target = makeArenaObject('target-1', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: '敌方丛林灰狼',
            life: 20,
            attackOrTraitLine: '噬咬：快速近战 3 骰',
        });
        const planned = runCommand({
            core: withArenaObject(withArenaObject(casterCore, creature), target),
            sys: planningState.sys,
        }, planCommand([chargeOnSpellId]));
        const readyToCast: MatchState<MageWarsCore> = {
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const cast = runCommand(readyToCast, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: chargeOnSpellId,
                manaCost: 4,
                targetObjectId: creature.id,
            },
        });

        expect(cast.success).toBe(true);
        expect(cast.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_GAINED,
                payload: expect.objectContaining({
                    objectId: creature.id,
                    spellCardId: chargeOnSpellId,
                    grants: ['swift'],
                    chargeDiceModifier: 1,
                }),
            }),
        ]));
        expect(cast.state.core.objects[creature.id].temporaryTraits).toMatchObject({
            swift: true,
            chargeDiceModifier: 1,
        });

        const creatureActionState: MatchState<MageWarsCore> = {
            core: { ...cast.state.core, phaseReadyPlayerIds: ['1'] },
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        };
        const moved = runCommand(creatureActionState, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: creature.id, toZoneId: ARENA_ZONE_IDS.A2 },
        });

        expect(moved.success).toBe(true);
        expect(moved.state.core.objects[creature.id]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A2,
            actionReady: true,
            temporaryTraits: {
                swift: true,
                freeMoveUsedThisAction: true,
                movedThisAction: true,
                chargeDiceModifier: 1,
            },
        });

        const attacked = runCommand(moved.state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: creature.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const attackEvent = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(attacked.success).toBe(true);
        expect(attackEvent).toMatchObject({
            payload: {
                attackerObjectId: creature.id,
                targetObjectId: target.id,
                diceResults: [3, 3, 3, 3],
                chargeDiceModifier: 1,
                baseDamage: 12,
            },
        });
        expect(attacked.state.core.objects[creature.id]).toMatchObject({
            actionReady: false,
            temporaryTraits: {
                swift: true,
                freeMoveUsedThisAction: true,
                chargeDiceModifier: 1,
            },
        });

        const advanced = runCommand(attacked.state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(advanced.success).toBe(true);
        expect(advanced.state.core.objects[creature.id].temporaryTraits).toBeUndefined();
        expect(advanced.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED,
                payload: expect.objectContaining({
                    objectId: creature.id,
                    traitIds: expect.arrayContaining(['swift', 'swiftFreeMove', 'charge']),
                    sourceAbilityId: 'mw.spell.3407',
                }),
            }),
        ]));
    });

    it('lets Call of the Wild grant friendly animal melee dice until the round ends', () => {
        const callOfTheWildSpellId = 3417;
        const planningState = setupState('planning');
        const casterCore = withPlayerMage(planningState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE);
        const friendlyWolf = makeArenaObject('wolf-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: '丛林灰狼',
            typeLine: '生物 / 动物、犬科',
            attackOrTraitLine: '噬咬：快速近战 3 骰',
        });
        const friendlyArcherAnimal = makeArenaObject('archer-animal-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2816,
            sourceObjectId: 'spell-card-2816',
            name: '动物射手',
            typeLine: '生物 / 动物',
            attackOrTraitLine: '短弓：快速远程 `0-1` 2 骰',
        });
        const friendlyNonAnimal = makeArenaObject('cleric-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2811,
            sourceObjectId: 'spell-card-2811',
            name: '阿希拉牧师',
            typeLine: '生物 / 牧师',
            attackOrTraitLine: '权杖：快速近战 2 骰',
        });
        const enemyWolf = makeArenaObject('wolf-1', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: '敌方丛林灰狼',
            typeLine: '生物 / 动物、犬科',
            attackOrTraitLine: '噬咬：快速近战 3 骰',
        });
        const target = makeArenaObject('target-1', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: '目标丛林灰狼',
            life: 30,
            attackOrTraitLine: '噬咬：快速近战 3 骰',
        });
        const planned = runCommand({
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(
                        withArenaObject(
                            withArenaObject(casterCore, friendlyWolf),
                            friendlyArcherAnimal,
                        ),
                        friendlyNonAnimal,
                    ),
                    enemyWolf,
                ),
                target,
            ),
            sys: planningState.sys,
        }, planCommand([callOfTheWildSpellId]));
        const readyToCast: MatchState<MageWarsCore> = {
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const cast = runCommand(readyToCast, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: callOfTheWildSpellId,
                manaCost: 4,
            },
        });

        expect(cast.success).toBe(true);
        expect(cast.events.filter((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_GAINED
        ))).toHaveLength(2);
        expect(cast.state.core.objects[friendlyWolf.id].temporaryTraits).toMatchObject({
            meleeDiceModifier: 1,
        });
        expect(cast.state.core.objects[friendlyArcherAnimal.id].temporaryTraits).toMatchObject({
            meleeDiceModifier: 1,
        });
        expect(cast.state.core.objects[friendlyNonAnimal.id].temporaryTraits).toBeUndefined();
        expect(cast.state.core.objects[enemyWolf.id].temporaryTraits).toBeUndefined();

        const creatureActionState: MatchState<MageWarsCore> = {
            core: { ...cast.state.core, phaseReadyPlayerIds: [] },
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        };
        const meleeAttack = runCommand(creatureActionState, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: friendlyWolf.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const meleeAttackEvent = meleeAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(meleeAttack.success).toBe(true);
        expect(meleeAttackEvent).toMatchObject({
            payload: {
                attackerObjectId: friendlyWolf.id,
                targetObjectId: target.id,
                diceResults: [3, 3, 3, 3],
                meleeDiceModifier: 1,
                baseDamage: 12,
            },
        });

        const rangedAttack = runCommand({
            core: {
                ...cast.state.core,
                objects: {
                    ...cast.state.core.objects,
                    [friendlyArcherAnimal.id]: {
                        ...cast.state.core.objects[friendlyArcherAnimal.id],
                        actionReady: true,
                    },
                },
            },
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: friendlyArcherAnimal.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const rangedAttackEvent = rangedAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(rangedAttack.success).toBe(true);
        expect(rangedAttackEvent).toMatchObject({
            payload: {
                attackerObjectId: friendlyArcherAnimal.id,
                diceResults: [3, 3],
                baseDamage: 6,
            },
        });
        expect(rangedAttackEvent?.payload).not.toHaveProperty('meleeDiceModifier');

        const advanced = runCommand({
            core: { ...cast.state.core, phaseReadyPlayerIds: ['1'] },
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(advanced.success).toBe(true);
        expect(advanced.state.core.objects[friendlyWolf.id].temporaryTraits).toMatchObject({
            meleeDiceModifier: 1,
            meleeDiceModifierUntilRoundNumber: cast.state.core.turnNumber,
        });
        expect(advanced.state.core.objects[friendlyArcherAnimal.id].temporaryTraits).toMatchObject({
            meleeDiceModifier: 1,
            meleeDiceModifierUntilRoundNumber: cast.state.core.turnNumber,
        });
    });

    it('lets Bloodstrike grant vampiric pierce to the target creature next melee attack', () => {
        const bloodstrikeSpellId = 3404;
        const planningState = setupState('planning');
        const warlockCore = withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE);
        const casterCore: MageWarsCore = {
            ...warlockCore,
            players: {
                ...warlockCore.players,
                '0': {
                    ...warlockCore.players['0'],
                    mana: 20,
                    damage: 7,
                },
            },
        };
        const attacker = makeArenaObject('blood-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-card-2906',
            name: '野性山猫',
            attackOrTraitLine: '利爪：快速近战 2 骰；短弓：快速远程 `0-1` 2 骰',
        });
        const armoredTarget = makeArenaObject('armored-target-1', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: '护甲目标',
            life: 20,
            armor: 2,
            attackOrTraitLine: '噬咬：快速近战 3 骰',
        });
        const planned = runCommand({
            core: withArenaObject(withArenaObject(casterCore, attacker), armoredTarget),
            sys: planningState.sys,
        }, planCommand([bloodstrikeSpellId]));
        const readyToCast: MatchState<MageWarsCore> = {
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const cast = runCommand(readyToCast, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: bloodstrikeSpellId,
                manaCost: 3,
                targetObjectId: attacker.id,
            },
        });

        expect(planned.success).toBe(true);
        expect(cast.success).toBe(true);
        expect(cast.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_GAINED,
                payload: expect.objectContaining({
                    objectId: attacker.id,
                    spellCardId: bloodstrikeSpellId,
                    vampiricNextMelee: true,
                    nextMeleePierceModifier: 1,
                }),
            }),
        ]));
        expect(cast.state.core.objects[attacker.id].temporaryTraits).toMatchObject({
            vampiricNextMelee: true,
            nextMeleePierceModifier: 1,
        });

        const attacked = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: armoredTarget.id,
            },
        });
        const attackEvent = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));
        const damageEvent = attacked.events.find((event) => event.type === 'DAMAGE_DEALT');
        const healingEvent = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED
        ));

        expect(attacked.success).toBe(true);
        expect(attackEvent).toMatchObject({
            payload: {
                attackerObjectId: attacker.id,
                targetObjectId: armoredTarget.id,
                diceResults: [3, 3],
                baseDamage: 6,
                vampiricNextMelee: true,
                pierceModifier: 1,
            },
        });
        expect(damageEvent).toMatchObject({
            payload: {
                targetId: armoredTarget.id,
                actualDamage: 5,
            },
        });
        expect(healingEvent).toMatchObject({
            payload: {
                playerId: '0',
                spellCardId: bloodstrikeSpellId,
                sourceAbilityId: 'mw.spell.3404',
                targetPlayerId: '0',
                diceResults: [],
                healing: 5,
                actualHealing: 5,
            },
        });
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED,
                payload: expect.objectContaining({
                    objectId: attacker.id,
                    traitIds: expect.arrayContaining(['vampiric', 'pierce']),
                    sourceAbilityId: 'mw.spell.3404',
                }),
            }),
        ]));
        expect(attacked.state.core.objects[attacker.id].temporaryTraits).toBeUndefined();
        expect(attacked.state.core.players['0'].damage).toBe(2);
    });

    it('keeps Bloodstrike through ranged attacks and clears it at creature action end', () => {
        const bloodstrikeSpellId = 3404;
        const planningState = setupState('planning');
        const warlockCore = withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE);
        const casterCore: MageWarsCore = {
            ...warlockCore,
            players: {
                ...warlockCore.players,
                '0': {
                    ...warlockCore.players['0'],
                    mana: 20,
                    damage: 4,
                },
            },
        };
        const attacker = makeArenaObject('blood-archer-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2816,
            sourceObjectId: 'spell-card-2816',
            name: '血击射手',
            attackOrTraitLine: '短刀：快速近战 1 骰；长弓：快速远程 `0-1` 2 骰',
        });
        const rangedTarget = makeArenaObject('ranged-target-1', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: '远程目标',
            life: 20,
            armor: 2,
        });
        const planned = runCommand({
            core: withArenaObject(withArenaObject(casterCore, attacker), rangedTarget),
            sys: planningState.sys,
        }, planCommand([bloodstrikeSpellId]));
        const cast = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: bloodstrikeSpellId,
                manaCost: 3,
                targetObjectId: attacker.id,
            },
        });

        expect(cast.success).toBe(true);
        const rangedAttack = runCommand({
            core: { ...cast.state.core, phaseReadyPlayerIds: [] },
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-1',
                targetObjectId: rangedTarget.id,
            },
        });
        const rangedAttackEvent = rangedAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(rangedAttack.success).toBe(true);
        expect(rangedAttackEvent).toMatchObject({
            payload: {
                attackerObjectId: attacker.id,
                diceResults: [3, 3],
                baseDamage: 6,
            },
        });
        expect(rangedAttackEvent?.payload).not.toHaveProperty('vampiricNextMelee');
        expect(rangedAttackEvent?.payload).not.toHaveProperty('pierceModifier');
        expect(rangedAttack.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED);
        expect(rangedAttack.state.core.objects[attacker.id].temporaryTraits).toMatchObject({
            vampiricNextMelee: true,
            nextMeleePierceModifier: 1,
        });

        const advanced = runCommand(rangedAttack.state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(advanced.success).toBe(true);
        expect(advanced.state.core.objects[attacker.id].temporaryTraits).toBeUndefined();
        expect(advanced.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED,
                payload: expect.objectContaining({
                    objectId: attacker.id,
                    traitIds: expect.arrayContaining(['vampiric', 'pierce']),
                    sourceAbilityId: 'mw.spell.3404',
                }),
            }),
        ]));
    });

    it('uses the structured Bloodthirst enchantment without reading its display text', () => {
        const spellCardId = 1910;
        const planningState = setupState('planning');
        const warlockCore = withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE);
        const casterCore: MageWarsCore = {
            ...warlockCore,
            players: {
                ...warlockCore.players,
                '0': {
                    ...warlockCore.players['0'],
                    mana: 20,
                    damage: 7,
                },
            },
        };
        const attacker = makeArenaObject('vampiric-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-card-2906',
            name: '野性山猫',
            combatProfilesSource: 'config',
            attackOrTraitLine: undefined,
        });
        const armoredTarget = makeArenaObject('vampiric-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            armor: 2,
        });
        const planned = runCommand({
            core: withArenaObject(withArenaObject(casterCore, attacker), armoredTarget),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const cast = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 6,
                targetObjectId: attacker.id,
            },
        });
        const enchantment = Object.values(cast.state.core.objects).find((object) => (
            object.sourceSpellCardId === spellCardId && object.anchoredToObjectId === attacker.id
        ));
        const castCoreWithoutDisplayText = enchantment
            ? withArenaObjectDisplayText(cast.state.core, enchantment.id, '')
            : cast.state.core;
        const attacked = runCommand({
            core: castCoreWithoutDisplayText,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: armoredTarget.id,
            },
        });
        const healingEvents = attacked.events.filter((event) => (
            event.type === MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED
        ));

        expect(cast.success).toBe(true);
        expect(enchantment).toMatchObject({
            sourceSpellCardId: spellCardId,
            anchoredToObjectId: attacker.id,
            attackOrTraitLine: undefined,
            rulesText: '本生物的近战攻击获得吸血特性。',
        });
        expect(castCoreWithoutDisplayText.objects[enchantment!.id]).toMatchObject({
            attackOrTraitLine: undefined,
            rulesText: '',
        });
        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: attacker.id,
                    targetObjectId: armoredTarget.id,
                    diceResults: [3, 3],
                    baseDamage: 6,
                    vampiric: true,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: armoredTarget.id,
                    actualDamage: 4,
                }),
            }),
        ]));
        expect(healingEvents).toHaveLength(1);
        expect(healingEvents[0]).toMatchObject({
            payload: {
                spellCardId,
                sourceAbilityId: 'mw.spell.1910',
                healing: 4,
                actualHealing: 4,
            },
        });
        expect(attacked.state.core.players['0'].damage).toBe(3);
        expect(attacked.state.core.objects[enchantment!.id]).toMatchObject({
            sourceSpellCardId: spellCardId,
            anchoredToObjectId: attacker.id,
        });
    });

    it('casts Saintly Territory as a revealed zone-anchored Aegis enchantment', () => {
        const baseState = setupState('planning');
        const coreWithMage = withPlayerMage(
            baseState.core,
            '0',
            MAGE_IDS.PRIESTESS_APPRENTICE,
        );
        const planned = runCommand({
            core: coreWithMage,
            sys: baseState.sys,
        }, planCommand([1913]));
        const cast = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 1913,
                manaCost: 6,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const enchantment = Object.values(cast.state.core.objects).find((object) => (
            object.sourceSpellCardId === 1913
        ));

        expect(planned.success).toBe(true);
        expect(cast.success).toBe(true);
        expect(enchantment).toMatchObject({
            kind: 'enchantment',
            ownerId: '0',
            revealed: true,
            zoneId: PLAYER_ZERO_START_ZONE,
            anchoredToZoneId: PLAYER_ZERO_START_ZONE,
        });
        expect(enchantment?.anchoredToObjectId).toBeUndefined();
    });

    it('applies area Aegis only to friendly living creatures in the anchored zone', () => {
        const baseState = setupState('planning');
        const coreWithMage = withPlayerMage(
            baseState.core,
            '0',
            MAGE_IDS.PRIESTESS_APPRENTICE,
        );
        const planned = runCommand({
            core: coreWithMage,
            sys: baseState.sys,
        }, planCommand([1913]));
        const friendlyTarget = makeArenaObject('area-aegis-friendly-0', '0', PLAYER_ZERO_START_ZONE, { life: 20 });
        const cast = runCommand({
            core: withArenaObject(planned.state.core, friendlyTarget),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 1913,
                manaCost: 6,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const areaState = {
            core: withCurrentPlayer(cast.state.core, '1'),
            sys: { ...cast.state.sys, phase: 'creatureAction' as const },
        };
        const attacker = makeArenaObject('area-aegis-attacker-1', '1', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 3 骰',
        });
        const attacked = runCommand({
            core: withArenaObject(areaState.core, attacker),
            sys: areaState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '1',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: friendlyTarget.id,
            },
        });
        const attackEvent = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(cast.success).toBe(true);
        expect(attacked.success).toBe(true);
        expect(attackEvent).toMatchObject({
            payload: {
                targetObjectId: friendlyTarget.id,
                diceResults: [3, 3],
                baseDamage: 6,
            },
        });
    });

    it('does not apply a zone Aegis source to enemies or creatures outside that zone', () => {
        const baseState = setupState('creatureAction');
        const enemyTarget = makeArenaObject('area-aegis-enemy-1', '1', PLAYER_ZERO_START_ZONE, { life: 20 });
        const outsideTarget = makeArenaObject('area-aegis-outside-1', '1', ARENA_ZONE_IDS.B1, { life: 20 });
        const area = makeVisibleEnchantmentObject('area-aegis-1913', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 1913,
            sourceObjectId: 'spell-1913',
            name: '圣佑领地',
            typeLine: '结界 / 加护、庇护',
            rulesText: undefined,
            anchoredToZoneId: PLAYER_ZERO_START_ZONE,
        });
        const attacker = makeArenaObject('area-aegis-enemy-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 3 骰',
        });
        const enemyAttack = runCommand({
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(withArenaObject(baseState.core, attacker), enemyTarget),
                    outsideTarget,
                ),
                area,
            ),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: enemyTarget.id,
            },
        });
        const enemyAttackEvent = enemyAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));
        const outsideAttacker = makeArenaObject('area-aegis-outside-attacker-0', '0', ARENA_ZONE_IDS.B1, {
            attackOrTraitLine: '利爪：快速近战 3 骰',
        });
        const outsideAttack = runCommand({
            core: withArenaObject(enemyAttack.state.core, outsideAttacker),
            sys: enemyAttack.state.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: outsideAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: outsideTarget.id,
            },
        });
        const outsideAttackEvent = outsideAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(enemyAttack.success).toBe(true);
        expect(enemyAttackEvent).toMatchObject({
            payload: { diceResults: [3, 3, 3], baseDamage: 9 },
        });
        expect(outsideAttack.success).toBe(true);
        expect(outsideAttackEvent).toMatchObject({
            payload: { diceResults: [3, 3, 3], baseDamage: 9 },
        });
    });

    it('consumes a friendly zone Aegis source for attack spells', () => {
        const spellCardId = 1702;
        const baseState = setupState('planning');
        const coreWithMage = withPlayerMage(
            baseState.core,
            '0',
            MAGE_IDS.WARLOCK_APPRENTICE,
        );
        const planned = runCommand({
            core: coreWithMage,
            sys: baseState.sys,
        }, planCommand([spellCardId]));
        const target = makeArenaObject('area-aegis-spell-target-1', '1', PLAYER_ZERO_START_ZONE, { life: 20 });
        const area = makeVisibleEnchantmentObject('area-aegis-spell-1913', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 1913,
            sourceObjectId: 'spell-1913',
            name: '圣佑领地',
            anchoredToZoneId: PLAYER_ZERO_START_ZONE,
        });
        const cast = runCommand({
            core: withArenaObject(withArenaObject(planned.state.core, target), area),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 5,
                targetObjectId: target.id,
            },
        });
        const attackEvent = cast.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED
        ));

        expect(cast.success).toBe(true);
        expect(attackEvent).toMatchObject({
            payload: {
                spellCardId,
                targetObjectId: target.id,
                diceResults: [3, 3, 3],
                baseDamage: 9,
            },
        });
    });

    it('removes area Aegis after a friendly creature moves out of the anchored zone', () => {
        const baseState = setupState('creatureAction');
        const target = makeArenaObject('area-aegis-moved-target-0', '0', PLAYER_ZERO_START_ZONE, { life: 20 });
        const area = makeVisibleEnchantmentObject('area-aegis-moved-1913', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 1913,
            sourceObjectId: 'spell-1913',
            name: '圣佑领地',
            anchoredToZoneId: PLAYER_ZERO_START_ZONE,
        });
        const moved = runCommand({
            core: withArenaObject(withArenaObject(baseState.core, target), area),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: {
                objectId: target.id,
                toZoneId: ARENA_ZONE_IDS.A2,
            },
        });
        const attacker = makeArenaObject('area-aegis-moved-attacker-1', '1', ARENA_ZONE_IDS.A2, {
            attackOrTraitLine: '利爪：快速近战 3 骰',
        });
        const attacked = runCommand({
            core: withCurrentPlayer(withArenaObject(moved.state.core, attacker), '1'),
            sys: moved.state.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '1',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const attackEvent = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(moved.success).toBe(true);
        expect(moved.state.core.objects[target.id]?.zoneId).toBe(ARENA_ZONE_IDS.A2);
        expect(attacked.success).toBe(true);
        expect(attackEvent).toMatchObject({
            payload: { diceResults: [3, 3, 3], baseDamage: 9 },
        });
    });

    it('takes the highest value when area and attached Aegis sources overlap', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('area-aegis-highest-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 3 骰',
        });
        const target = makeArenaObject('area-aegis-highest-target-1', '1', PLAYER_ZERO_START_ZONE, { life: 20 });
        const area = makeVisibleEnchantmentObject('area-aegis-highest-1913', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 1913,
            sourceObjectId: 'spell-1913',
            name: '圣佑领地',
            anchoredToZoneId: PLAYER_ZERO_START_ZONE,
        });
        const attached = makeVisibleEnchantmentObject('area-aegis-highest-1813', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 1813,
            sourceObjectId: 'spell-1813',
            name: '神力加护',
            anchoredToObjectId: target.id,
        });
        const attacked = runCommand({
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(withArenaObject(baseState.core, attacker), target),
                    area,
                ),
                attached,
            ),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const attackEvent = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(attacked.success).toBe(true);
        expect(attackEvent).toMatchObject({
            payload: { diceResults: [3, 3], baseDamage: 6 },
        });
    });

    it('keeps area Aegis active when its display text is removed', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('area-aegis-text-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 3 骰',
        });
        const target = makeArenaObject('area-aegis-text-target-1', '1', PLAYER_ZERO_START_ZONE, { life: 20 });
        let core = withArenaObject(withArenaObject(baseState.core, attacker), target);
        const area = makeVisibleEnchantmentObject('area-aegis-text-1913', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 1913,
            sourceObjectId: 'spell-1913',
            name: '圣佑领地',
            rulesText: undefined,
            attackOrTraitLine: undefined,
            anchoredToZoneId: PLAYER_ZERO_START_ZONE,
        });
        core = withArenaObject(core, area);
        core = withArenaObjectDisplayText(core, area.id, '');

        const attacked = runCommand({ core, sys: baseState.sys }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const attackEvent = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(attacked.success).toBe(true);
        expect(attackEvent).toMatchObject({
            payload: { diceResults: [3, 3], baseDamage: 6 },
        });
    });

    it('uses the highest attached Aegis value once for object attacks after display text is removed', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('aegis-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 3 骰',
        });
        const target = makeArenaObject('aegis-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
        });
        const aegis1813 = makeVisibleEnchantmentObject('aegis-1813', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 1813,
            sourceObjectId: 'spell-1813',
            name: '神力加护',
            anchoredToObjectId: target.id,
        });
        const aegis1911 = makeVisibleEnchantmentObject('aegis-1911', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 1911,
            sourceObjectId: 'spell-1911',
            name: '神力加护',
            anchoredToObjectId: target.id,
        });
        let core = withArenaObject(
            withArenaObject(
                withArenaObject(withArenaObject(baseState.core, attacker), target),
                aegis1813,
            ),
            aegis1911,
        );
        core = withArenaObjectDisplayText(core, aegis1813.id, '');
        core = withArenaObjectDisplayText(core, aegis1911.id, '');

        const attacked = runCommand({ core, sys: baseState.sys }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const attackEvent = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(attacked.success).toBe(true);
        expect(attackEvent).toMatchObject({
            payload: {
                attackerObjectId: attacker.id,
                targetObjectId: target.id,
                diceResults: [3, 3],
                baseDamage: 6,
            },
        });
    });

    it('keeps one attack die when Aegis reduces a one-die object attack', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('aegis-min-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 1 骰',
        });
        const target = makeArenaObject('aegis-min-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
        });
        const aegis = makeVisibleEnchantmentObject('aegis-min-1813', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 1813,
            sourceObjectId: 'spell-1813',
            anchoredToObjectId: target.id,
        });

        const attacked = runCommand({
            core: withArenaObject(withArenaObject(withArenaObject(baseState.core, attacker), target), aegis),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const attackEvent = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(attacked.success).toBe(true);
        expect(attackEvent).toMatchObject({
            payload: {
                diceResults: [3],
                baseDamage: 3,
            },
        });
    });

    it('applies Aegis to attack spells without reading the enchantment display text', () => {
        const spellCardId = 1702;
        const planningState = setupState('planning');
        const coreWithMage = withPlayerMage(
            planningState.core,
            '0',
            MAGE_IDS.WARLOCK_APPRENTICE,
        );
        const target = makeArenaObject('aegis-spell-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
        });
        const aegis = makeVisibleEnchantmentObject('aegis-spell-1813', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 1813,
            sourceObjectId: 'spell-1813',
            anchoredToObjectId: target.id,
        });
        const planned = runCommand({
            core: withArenaObject(withArenaObject(coreWithMage, target), aegis),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const coreWithoutDisplayText = withArenaObjectDisplayText(planned.state.core, aegis.id, '');
        const cast = runCommand({
            core: coreWithoutDisplayText,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 5,
                targetObjectId: target.id,
            },
        });
        const attackEvent = cast.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED
        ));

        expect(cast.success).toBe(true);
        expect(attackEvent).toMatchObject({
            payload: {
                spellCardId,
                targetObjectId: target.id,
                diceResults: [3, 3, 3],
                baseDamage: 9,
            },
        });
    });

    it('keeps the damage-type immunity branch before Aegis dice reduction for attack spells', () => {
        const spellCardId = 1702;
        const planningState = setupState('planning');
        const coreWithMage = withPlayerMage(
            planningState.core,
            '0',
            MAGE_IDS.WARLOCK_APPRENTICE,
        );
        const target = makeArenaObject('aegis-immune-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            attackOrTraitLine: '火焰免疫',
        });
        const aegis = makeVisibleEnchantmentObject('aegis-immune-1813', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 1813,
            sourceObjectId: 'spell-1813',
            anchoredToObjectId: target.id,
        });
        const planned = runCommand({
            core: withArenaObject(withArenaObject(coreWithMage, target), aegis),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const state = {
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' as const },
        };
        const events = MageWarsDomain.execute(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 5,
                targetObjectId: target.id,
            },
        }, fixedRandom);

        expect(events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ATTACK_MISSED);
        expect(events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED);
    });

    it('does not apply a persistent vampiric enchantment to ranged attacks', () => {
        const attacker = makeArenaObject('vampiric-archer-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2816,
            sourceObjectId: 'spell-card-2816',
            name: '皇家箭手',
            combatProfilesSource: 'config',
            attackOrTraitLine: undefined,
        });
        const enchantment = makeVampiricEnchantmentObject(
            'vampiric-enchantment-0',
            '0',
            PLAYER_ZERO_START_ZONE,
            attacker.id,
        );
        const target = makeArenaObject('vampiric-ranged-target-1', '1', ARENA_ZONE_IDS.A2, {
            life: 20,
            armor: 2,
        });
        const base = setupState('creatureAction');
        const core = withArenaObject(
            withArenaObject(withArenaObject(base.core, attacker), enchantment),
            target,
        );
        const attacked = runCommand({ core, sys: base.sys }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
            }),
        ]));
        expect(attacked.events.find((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED)?.payload)
            .not.toHaveProperty('vampiric');
        expect(attacked.state.core.objects[enchantment.id]).toBeDefined();
    });

    it('heals once from actual damage accumulated across a multi-strike melee attack', () => {
        const attacker = makeArenaObject('vampiric-hydra-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2901,
            sourceObjectId: 'spell-card-2901',
            name: '暗沼九头蛇',
            combatProfilesSource: 'config',
            attackOrTraitLine: undefined,
        });
        const enchantment = makeVampiricEnchantmentObject(
            'vampiric-enchantment-hydra',
            '0',
            PLAYER_ZERO_START_ZONE,
            attacker.id,
        );
        const target = makeArenaObject('vampiric-hydra-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 40,
            armor: 2,
        });
        const base = setupState('creatureAction');
        const core: MageWarsCore = {
            ...withArenaObject(
                withArenaObject(withArenaObject(base.core, attacker), enchantment),
                target,
            ),
            players: {
                ...base.core.players,
                '0': {
                    ...base.core.players['0'],
                    damage: 20,
                },
            },
        };
        const attacked = runCommand({ core, sys: base.sys }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-1',
                targetObjectId: target.id,
            },
        });
        const healingEvents = attacked.events.filter((event) => (
            event.type === MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED
        ));

        expect(attacked.success).toBe(true);
        expect(healingEvents).toHaveLength(1);
        expect(healingEvents[0]).toMatchObject({
            payload: {
                spellCardId: 1910,
                sourceAbilityId: 'mw.spell.1910',
                healing: 21,
                actualHealing: 20,
            },
        });
        expect(attacked.state.core.objects[target.id]).toMatchObject({ damage: 21 });
        expect(attacked.state.core.players['0'].damage).toBe(0);
        expect(attacked.state.core.objects[enchantment.id]).toBeDefined();
    });

    it('lets ready arena creatures guard without consuming the mage action track', () => {
        const baseState = setupState('creatureAction');
        const object = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject({
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '0': {
                        ...baseState.core.players['0'],
                        actionReady: false,
                    },
                },
            }, object),
            sys: baseState.sys,
        };

        const guarded = runCommand(state, {
            type: MAGE_WARS_COMMANDS.GUARD,
            playerId: '0',
            payload: {
                objectId: object.id,
            },
        });

        expect(guarded.success).toBe(true);
        expect(guarded.state.core.players['0']).toMatchObject({
            actionReady: false,
            guarding: false,
        });
        expect(guarded.state.core.objects[object.id]).toMatchObject({
            actionReady: false,
            guarding: true,
        });
        expect(guarded.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.GUARD_GAINED,
                payload: expect.objectContaining({
                    playerId: '0',
                    targetObjectId: object.id,
                }),
            }),
        ]));
        expect(actionLogKinds(guarded.state)).toContain(MAGE_WARS_EVENTS.GUARD_GAINED);
        expect(validateCommand(guarded.state, {
            type: MAGE_WARS_COMMANDS.GUARD,
            playerId: '0',
            payload: {
                objectId: object.id,
            },
        })).toBe('objectActionSpent');
    });

    it('lets ready arena creatures make same-zone quick melee attacks', () => {
        const baseState = setupState('creatureAction');
        const object = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withPlayerInZone(baseState.core, '1', PLAYER_ZERO_START_ZONE), object),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: object.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    ownerId: '0',
                    attackerObjectId: object.id,
                    attackProfileId: 'attack-0',
                    attackName: '利爪',
                    targetPlayerId: '1',
                    diceResults: [3, 3],
                    baseDamage: 6,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: '1',
                    actualDamage: 6,
                    sourceAbilityId: 'mw.object.2906.attack-0',
                }),
            }),
        ]));
        expect(attacked.state.core.objects[object.id].actionReady).toBe(false);
        expect(attacked.state.core.players['1'].damage).toBe(6);
        expect(actionLogKinds(attacked.state)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);

        expect(validateCommand(attacked.state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: { attackerObjectId: object.id, attackProfileId: 'attack-0', targetPlayerId: '1' },
        })).toBe('objectActionSpent');
    });

    it('requires same-zone melee object attacks to target enemy guarding creatures first', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const enemyGuard = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            guarding: true,
            life: 12,
        });
        const exposedTarget = makeArenaObject('target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 12,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(withPlayerInZone(baseState.core, '1', PLAYER_ZERO_START_ZONE), attacker),
                    enemyGuard,
                ),
                exposedTarget,
            ),
            sys: baseState.sys,
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        })).toBe('guardInterceptionRequired');
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: exposedTarget.id,
            },
        })).toBe('guardInterceptionRequired');
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: enemyGuard.id,
            },
        })).toBeUndefined();
    });

    it('ignores guards that cannot protect the zone for melee target interception', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const crippledGuard = makeArenaObject('crippled-guard-1', '1', PLAYER_ZERO_START_ZONE, {
            guarding: true,
            statusTokens: { [STATUS_TOKEN_IDS.CRIPPLE]: 1 },
        });
        const stunnedGuard = makeArenaObject('stunned-guard-1', '1', PLAYER_ZERO_START_ZONE, {
            guarding: true,
            statusTokens: { [STATUS_TOKEN_IDS.STUN]: 1 },
        });
        const smallGuard = makeArenaObject('small-guard-1', '1', PLAYER_ZERO_START_ZONE, {
            guarding: true,
            attackOrTraitLine: '小爪：快速近战 1 骰；小型',
        });
        const exposedTarget = makeArenaObject('target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 12,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(
                        withArenaObject(
                            withArenaObject(baseState.core, attacker),
                            crippledGuard,
                        ),
                        stunnedGuard,
                    ),
                    smallGuard,
                ),
                exposedTarget,
            ),
            sys: baseState.sys,
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: exposedTarget.id,
            },
        })).toBeUndefined();
    });

    it('does not apply guard interception to ranged arena object attacks', () => {
        const baseState = setupState('creatureAction');
        const archer = makeArenaObject('archer-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2816,
            sourceObjectId: 'spell-card-2816',
            name: '皇家箭手',
            attackOrTraitLine: '长弓：完整行动远程 `1-2` 4 骰，穿刺+1；小刀：快速近战 2 骰',
        });
        const enemyGuard = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            guarding: true,
            life: 12,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withArenaObject(withPlayerInZone(baseState.core, '1', ARENA_ZONE_IDS.B3), archer),
                enemyGuard,
            ),
            sys: baseState.sys,
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: archer.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        })).toBeUndefined();
    });

    it('removes guard from a guarding arena object after it is targeted by a melee attack', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const enemyGuard = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            guarding: true,
            life: 12,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), enemyGuard),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: enemyGuard.id,
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.state.core.objects[enemyGuard.id].guarding).toBe(false);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.GUARD_REMOVED,
                payload: expect.objectContaining({
                    targetObjectId: enemyGuard.id,
                    sourceAbilityId: 'mw.guard.melee-attack',
                }),
            }),
        ]));
        expect(actionLogKinds(attacked.state)).toContain(MAGE_WARS_EVENTS.GUARD_REMOVED);
    });

    it('offers a voluntary counterstrike opportunity when a guarding creature is targeted by a melee attack', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const enemyGuard = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            guarding: true,
            life: 12,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), enemyGuard),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: enemyGuard.id,
            },
        });

        const eventTypes = attacked.events.map((event) => event.type);
        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE,
                payload: expect.objectContaining({
                    ownerId: '1',
                    attackerObjectId: attacker.id,
                    defenderObjectId: enemyGuard.id,
                    counterstrikeAttackProfileId: 'attack-0',
                    sourceAbilityId: 'mw.guard.counterstrike',
                }),
            }),
        ]));
        expect(eventTypes.indexOf(MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE))
            .toBeLessThan(eventTypes.indexOf(MAGE_WARS_EVENTS.GUARD_REMOVED));
        expect(attacked.events.filter((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
            && event.payload.attackerObjectId === enemyGuard.id
        ))).toHaveLength(0);
        expect(actionLogKinds(attacked.state)).toContain(MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE);
    });

    it('queues a defender choice and allows passing on voluntary counterstrike', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const enemyGuard = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            guarding: true,
            life: 12,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), enemyGuard),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: enemyGuard.id,
            },
        });

        const interaction = attacked.state.sys.interaction.current;
        expect(interaction).toMatchObject({
            kind: 'simple-choice',
            playerId: '1',
            data: {
                sourceId: 'mw.counterstrike.choice',
                targetType: 'button',
            },
        });
        expect(interaction?.data).toMatchObject({
            options: expect.arrayContaining([
                expect.objectContaining({
                    id: 'counterstrike',
                    value: expect.objectContaining({
                        action: 'counterstrike',
                        attackerObjectId: attacker.id,
                        defenderObjectId: enemyGuard.id,
                        counterstrikeAttackProfileId: 'attack-0',
                    }),
                }),
                expect.objectContaining({
                    id: 'pass',
                    value: expect.objectContaining({
                        action: 'pass',
                        attackerObjectId: attacker.id,
                        defenderObjectId: enemyGuard.id,
                    }),
                }),
            ]),
        });
        expect(interaction?.data.ai).toMatchObject({ status: 'semantic' });
        const aiActions = buildAiLegalActionsFromInteractionDecision(
            interaction!.data.ai!.decisions![0] as AiDecisionDescriptor,
        );
        expect(aiActions.map((action) => (action.commands[0]?.payload as { optionId?: string }).optionId))
            .toEqual(expect.arrayContaining(['counterstrike', 'pass']));

        const passed = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: interaction?.id,
                optionId: 'pass',
            },
        } as Command);

        expect(passed.success).toBe(true);
        expect(passed.state.sys.interaction.current).toBeUndefined();
        expect(passed.events.map((event) => event.type)).toContain('SYS_INTERACTION_RESOLVED');
        expect(passed.events.filter((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
            && event.payload.attackerObjectId === enemyGuard.id
        ))).toHaveLength(0);
    });

    it('resolves selected counterstrike as a quick melee attack without spending the guarding creature action', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('counterable-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰，反击',
        });
        const enemyGuard = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            guarding: true,
            life: 20,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), enemyGuard),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: enemyGuard.id,
            },
        });
        const interaction = attacked.state.sys.interaction.current;

        const counterstruck = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: interaction?.id,
                optionId: 'counterstrike',
            },
        } as Command);

        expect(counterstruck.success).toBe(true);
        expect(counterstruck.state.sys.interaction.current).toBeUndefined();
        expect(counterstruck.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    ownerId: '1',
                    attackerObjectId: enemyGuard.id,
                    targetObjectId: attacker.id,
                    attackProfileId: 'attack-0',
                    attackName: '短剑',
                    diceResults: [3, 3, 3, 3],
                    baseDamage: 12,
                    actionCost: 'none',
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: attacker.id,
                    actualDamage: 12,
                    sourceAbilityId: 'mw.object.2906.attack-0',
                }),
            }),
        ]));
        expect(counterstruck.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE);
        expect(counterstruck.state.core.objects[enemyGuard.id].actionReady).toBe(true);
        expect(counterstruck.state.core.objects[attacker.id].damage).toBe(12);
    });

    it('offers configured 1903 counterstrike without reading the enchantment display text', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('enchantment-counter-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const target = makeArenaObject('enchantment-counter-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const enchantment = makeCounterstrikeEnchantmentObject(
            'counterstrike-enchantment-1903',
            '1',
            PLAYER_ZERO_START_ZONE,
            target.id,
        );
        const state: MatchState<MageWarsCore> = {
            core: [attacker, target, enchantment].reduce(withArenaObject, baseState.core),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE,
                payload: expect.objectContaining({
                    defenderObjectId: target.id,
                    sourceAbilityId: 'mw.trait.counterstrike',
                    counterstrikeSourceObjectId: enchantment.id,
                }),
            }),
        ]));
        expect(attacked.state.sys.interaction.current?.data).toMatchObject({
            sourceId: 'mw.counterstrike.choice',
            options: expect.arrayContaining([
                expect.objectContaining({
                    id: 'counterstrike',
                    value: expect.objectContaining({
                        counterstrikeSourceObjectId: enchantment.id,
                    }),
                }),
            ]),
        });

        const passed = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: attacked.state.sys.interaction.current?.id,
                optionId: 'pass',
            },
        } as Command);

        expect(passed.success).toBe(true);
        expect(passed.state.core.objects[enchantment.id]).toBeDefined();
    });

    it('consumes configured 1903 after its first selected counterstrike', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('consume-counter-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const target = makeArenaObject('consume-counter-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const enchantment = makeCounterstrikeEnchantmentObject(
            'consume-counter-enchantment-1903',
            '1',
            PLAYER_ZERO_START_ZONE,
            target.id,
        );
        const state: MatchState<MageWarsCore> = {
            core: [attacker, target, enchantment].reduce(withArenaObject, baseState.core),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const interaction = attacked.state.sys.interaction.current;
        const counterstruck = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: interaction?.id,
                optionId: 'counterstrike',
            },
        } as Command);

        expect(counterstruck.success).toBe(true);
        expect(counterstruck.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: enchantment.id,
                    sourceAbilityId: 'mw.enchantment.counterstrike.consume',
                    spellCardId: 1903,
                }),
            }),
        ]));
        expect(counterstruck.state.core.objects[enchantment.id]).toBeUndefined();
    });

    it('consumes configured 1903 after a successful defense against its counterstrike', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('defended-counter-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: CAT_ATTACK_WITH_DEFENSE_LINE,
        });
        const target = makeArenaObject('defended-counter-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const enchantment = makeCounterstrikeEnchantmentObject(
            'defended-counter-enchantment-1903',
            '1',
            PLAYER_ZERO_START_ZONE,
            target.id,
        );
        const state: MatchState<MageWarsCore> = {
            core: [attacker, target, enchantment].reduce(withArenaObject, baseState.core),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const counterstruck = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: attacked.state.sys.interaction.current?.id,
                optionId: 'counterstrike',
            },
        } as Command);
        const defenseInteraction = counterstruck.state.sys.interaction.current;

        expect(defenseInteraction?.data).toMatchObject({
            sourceId: 'mw.defense.choice',
            options: expect.arrayContaining([
                expect.objectContaining({ id: 'defend-defense-0' }),
            ]),
        });

        const defended = runCommand(counterstruck.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: defenseInteraction?.id,
                optionId: 'defend-defense-0',
            },
        } as Command, {
            ...fixedRandom,
            d: () => 8,
        });

        expect(defended.success).toBe(true);
        expect(defended.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: enchantment.id,
                    sourceAbilityId: 'mw.enchantment.counterstrike.consume',
                }),
            }),
        ]));
        expect(defended.state.core.objects[enchantment.id]).toBeUndefined();
    });

    it('does not offer counterstrike for ranged attacks or paralyzed defending creatures', () => {
        const baseState = setupState('creatureAction');
        const archer = makeArenaObject('archer-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2816,
            sourceObjectId: 'spell-card-2816',
            name: '皇家箭手',
            attackOrTraitLine: '长弓：完整行动远程 `1-2` 4 骰，穿刺+1；小刀：快速近战 2 骰',
        });
        const rangedTarget = makeArenaObject('ranged-guard-1', '1', ARENA_ZONE_IDS.B3, {
            guarding: true,
            life: 20,
            attackOrTraitLine: '短剑：快速近战 4 骰',
        });
        const meleeAttacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const stunnedGuard = makeArenaObject('stunned-guard-1', '1', PLAYER_ZERO_START_ZONE, {
            guarding: true,
            life: 12,
            attackOrTraitLine: '短剑：快速近战 4 骰',
            statusTokens: { [STATUS_TOKEN_IDS.STUN]: 1 },
        });

        const rangedAttack = runCommand({
            core: withArenaObject(withArenaObject(baseState.core, archer), rangedTarget),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: archer.id,
                attackProfileId: 'attack-0',
                targetObjectId: rangedTarget.id,
            },
        });
        const stunnedMeleeAttack = runCommand({
            core: withArenaObject(withArenaObject(baseState.core, meleeAttacker), stunnedGuard),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: meleeAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: stunnedGuard.id,
            },
        });

        expect(rangedAttack.success).toBe(true);
        expect(rangedAttack.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE);
        expect(rangedAttack.state.core.objects[rangedTarget.id].guarding).toBe(true);
        expect(stunnedMeleeAttack.success).toBe(true);
        expect(stunnedMeleeAttack.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE);
        expect(stunnedMeleeAttack.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.GUARD_REMOVED);
    });

    it('removes guard from a guarding arena object after a dazed melee attack misses it', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('dazed-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: {
                [STATUS_TOKEN_IDS.DAZE]: 1,
            },
        });
        const enemyGuard = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            guarding: true,
            life: 12,
        });
        const missRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 6 : 3),
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), enemyGuard),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: enemyGuard.id,
            },
        }, missRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.state.core.objects[enemyGuard.id].guarding).toBe(false);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: expect.objectContaining({
                    targetObjectId: enemyGuard.id,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.GUARD_REMOVED,
                payload: expect.objectContaining({
                    targetObjectId: enemyGuard.id,
                    sourceAbilityId: 'mw.guard.melee-attack',
                }),
            }),
        ]));
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE);
    });

    it('makes dazed arena creature attacks miss before damage is rolled', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('dazed-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: {
                [STATUS_TOKEN_IDS.DAZE]: 1,
            },
        });
        const target = makeArenaObject('target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 30,
        });
        const missRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 6 : 3),
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), target),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        }, missRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: attacker.id,
                    targetObjectId: target.id,
                    diceResults: [],
                    effectDieResult: 6,
                    baseDamage: 0,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: expect.objectContaining({
                    attackerObjectId: attacker.id,
                    targetObjectId: target.id,
                    statusTokenId: STATUS_TOKEN_IDS.DAZE,
                    effectDieResult: 6,
                }),
            }),
        ]));
        expect(attacked.events.map((event) => event.type)).not.toContain('DAMAGE_DEALT');
        expect(attacked.state.core.objects[attacker.id].actionReady).toBe(false);
        expect(attacked.state.core.objects[target.id].damage).toBe(0);
        expect(actionLogKinds(attacked.state)).toContain(MAGE_WARS_EVENTS.ATTACK_MISSED);
    });

    it('applies daze penalty to arena object defense dice without requiring the defender to be active player', () => {
        const baseState = setupState('creatureAction');
        const defendingCat = makeArenaObject('defending-cat-1', '1', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: CAT_ATTACK_WITH_DEFENSE_LINE,
            statusTokens: {
                [STATUS_TOKEN_IDS.DAZE]: 1,
            },
        });
        const clearCat = makeArenaObject('clear-cat-1', '1', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: CAT_ATTACK_WITH_DEFENSE_LINE,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, defendingCat), clearCat),
            sys: baseState.sys,
        };
        const rawNineRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 9 : fixedRandom.d(sides)),
        };

        const dazedDefense = runCommand(state, {
            type: MAGE_WARS_COMMANDS.ROLL_ARENA_OBJECT_DEFENSE,
            playerId: '1',
            payload: {
                defenderObjectId: defendingCat.id,
                defenseProfileId: 'defense-0',
            },
        }, rawNineRandom);
        const clearDefense = runCommand(state, {
            type: MAGE_WARS_COMMANDS.ROLL_ARENA_OBJECT_DEFENSE,
            playerId: '1',
            payload: {
                defenderObjectId: clearCat.id,
                defenseProfileId: 'defense-0',
            },
        }, rawNineRandom);

        expect(dazedDefense.success).toBe(true);
        expect(clearDefense.success).toBe(true);
        expect(dazedDefense.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED,
                payload: expect.objectContaining({
                    ownerId: '1',
                    defenderObjectId: defendingCat.id,
                    defenseProfileId: 'defense-0',
                    defenseMinRoll: 8,
                    rawEffectDieResult: 9,
                    defenseDieModifier: -2,
                    modifiedEffectDieResult: 7,
                    success: false,
                }),
            }),
        ]));
        expect(clearDefense.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED,
                payload: expect.objectContaining({
                    defenderObjectId: clearCat.id,
                    defenseMinRoll: 8,
                    rawEffectDieResult: 9,
                    defenseDieModifier: 0,
                    modifiedEffectDieResult: 9,
                    success: true,
                }),
            }),
        ]));
        expect(actionLogKinds(dazedDefense.state)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED);
    });

    it('applies restrained defense penalty to crippled arena creature defense dice', () => {
        const baseState = setupState('creatureAction');
        const crippledDefender = makeArenaObject('crippled-defender-1', '1', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: CAT_ATTACK_WITH_DEFENSE_LINE,
            statusTokens: {
                [STATUS_TOKEN_IDS.CRIPPLE]: 1,
            },
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(baseState.core, crippledDefender),
            sys: baseState.sys,
        };
        const rawNineRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 9 : fixedRandom.d(sides)),
        };

        const defense = runCommand(state, {
            type: MAGE_WARS_COMMANDS.ROLL_ARENA_OBJECT_DEFENSE,
            playerId: '1',
            payload: {
                defenderObjectId: crippledDefender.id,
                defenseProfileId: 'defense-0',
            },
        }, rawNineRandom);

        expect(defense.success).toBe(true);
        expect(defense.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED,
                payload: expect.objectContaining({
                    defenderObjectId: crippledDefender.id,
                    defenseMinRoll: 8,
                    rawEffectDieResult: 9,
                    defenseDieModifier: -2,
                    modifiedEffectDieResult: 7,
                    success: false,
                }),
            }),
        ]));
    });

    it('prevents stunned arena creatures from using defense profiles via the configured paralyze rule', () => {
        const baseState = setupState('creatureAction');
        const stunnedDefender = makeArenaObject('stunned-defender-1', '1', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: CAT_ATTACK_WITH_DEFENSE_LINE,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(baseState.core, stunnedDefender),
            sys: baseState.sys,
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.ROLL_ARENA_OBJECT_DEFENSE,
            playerId: '1',
            payload: {
                defenderObjectId: stunnedDefender.id,
                defenseProfileId: 'defense-0',
            },
        })).toBe('objectParalyzedCannotDefend');
    });

    it('queues a defender defense choice before attack dice and allows passing to continue the attack', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const defender = makeArenaObject('defending-cat-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰；防御图标 `8+ / 1x`；冲锋+2',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), defender),
            sys: baseState.sys,
        };

        const waitingForDefense = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: defender.id,
            },
        });

        const interaction = waitingForDefense.state.sys.interaction.current;
        expect(waitingForDefense.success).toBe(true);
        expect(waitingForDefense.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(waitingForDefense.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);
        expect(waitingForDefense.events.map((event) => event.type)).not.toContain('DAMAGE_DEALT');
        expect(waitingForDefense.state.core.objects[attacker.id].actionReady).toBe(false);
        expect(waitingForDefense.state.core.objects[defender.id].damage).toBe(0);
        expect(interaction).toMatchObject({
            kind: 'simple-choice',
            playerId: '1',
            data: {
                sourceId: 'mw.defense.choice',
                targetType: 'button',
            },
        });
        expect(interaction?.data).toMatchObject({
            options: expect.arrayContaining([
                expect.objectContaining({
                    id: 'defend-defense-0',
                    value: expect.objectContaining({
                        action: 'defend',
                        attackerObjectId: attacker.id,
                        defenderObjectId: defender.id,
                        defenseProfileId: 'defense-0',
                    }),
                }),
                expect.objectContaining({
                    id: 'pass',
                    value: expect.objectContaining({
                        action: 'pass',
                        attackerObjectId: attacker.id,
                        defenderObjectId: defender.id,
                    }),
                }),
            ]),
        });
        expect(interaction?.data.ai).toMatchObject({ status: 'semantic' });
        const aiActions = buildAiLegalActionsFromInteractionDecision(
            interaction!.data.ai!.decisions![0] as AiDecisionDescriptor,
        );
        expect(aiActions.map((action) => (action.commands[0]?.payload as { optionId?: string }).optionId))
            .toEqual(expect.arrayContaining(['defend-defense-0', 'pass']));

        const passed = runCommand(waitingForDefense.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: interaction?.id,
                optionId: 'pass',
            },
        } as Command);

        expect(passed.success).toBe(true);
        expect(passed.state.sys.interaction.current).toBeUndefined();
        expect(passed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: attacker.id,
                    targetObjectId: defender.id,
                    actionCost: 'none',
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: defender.id,
                    actualDamage: 6,
                }),
            }),
        ]));
        expect(passed.state.core.objects[attacker.id].actionReady).toBe(false);
        expect(passed.state.core.objects[defender.id].damage).toBe(6);
    });

    it('makes a successful arena object defense evade the incoming attack before damage', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const defender = makeArenaObject('defending-cat-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰；防御图标 `8+ / 1x`；冲锋+2',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), defender),
            sys: baseState.sys,
        };
        const rawNineRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 9 : fixedRandom.d(sides)),
        };

        const waitingForDefense = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: defender.id,
            },
        });
        const interaction = waitingForDefense.state.sys.interaction.current;

        const defended = runCommand(waitingForDefense.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: interaction?.id,
                optionId: 'defend-defense-0',
            },
        } as Command, rawNineRandom);

        expect(defended.success).toBe(true);
        expect(defended.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED,
                payload: expect.objectContaining({
                    defenderObjectId: defender.id,
                    defenseProfileId: 'defense-0',
                    rawEffectDieResult: 9,
                    success: true,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: expect.objectContaining({
                    attackerObjectId: attacker.id,
                    targetObjectId: defender.id,
                    defenseProfileId: 'defense-0',
                }),
            }),
        ]));
        expect(defended.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);
        expect(defended.events.map((event) => event.type)).not.toContain('DAMAGE_DEALT');
        expect(defended.state.core.objects[defender.id].damage).toBe(0);
    });

    it('continues the incoming attack when arena object defense fails', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const defender = makeArenaObject('defending-cat-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰；防御图标 `8+ / 1x`；冲锋+2',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), defender),
            sys: baseState.sys,
        };

        const waitingForDefense = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: defender.id,
            },
        });
        const interaction = waitingForDefense.state.sys.interaction.current;

        const defended = runCommand(waitingForDefense.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: interaction?.id,
                optionId: 'defend-defense-0',
            },
        } as Command);

        expect(defended.success).toBe(true);
        expect(defended.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED,
                payload: expect.objectContaining({
                    defenderObjectId: defender.id,
                    defenseProfileId: 'defense-0',
                    rawEffectDieResult: 3,
                    success: false,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: attacker.id,
                    targetObjectId: defender.id,
                    actionCost: 'none',
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: defender.id,
                    actualDamage: 6,
                }),
            }),
        ]));
        expect(defended.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(defended.state.core.objects[defender.id].damage).toBe(6);
    });

    it('spends one-use arena object defenses until their owner reset readies them', () => {
        const baseState = setupState('creatureAction');
        const firstAttacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const secondAttacker = makeArenaObject('wolf-0', '0', PLAYER_ZERO_START_ZONE);
        const defender = makeArenaObject('defending-cat-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 30,
            attackOrTraitLine: CAT_ATTACK_WITH_DEFENSE_LINE,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withArenaObject(withArenaObject(baseState.core, firstAttacker), secondAttacker),
                defender,
            ),
            sys: baseState.sys,
        };
        const rawNineRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 9 : fixedRandom.d(sides)),
        };

        const waitingForDefense = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: firstAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: defender.id,
            },
        });
        const defended = runCommand(waitingForDefense.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: waitingForDefense.state.sys.interaction.current?.id,
                optionId: 'defend-defense-0',
            },
        } as Command, rawNineRandom);

        expect(defended.success).toBe(true);
        expect(defended.state.core.objects[defender.id].defenseUsesThisRound).toMatchObject({
            'defense-0': 1,
        });
        expect(validateCommand(defended.state, {
            type: MAGE_WARS_COMMANDS.ROLL_ARENA_OBJECT_DEFENSE,
            playerId: '1',
            payload: {
                defenderObjectId: defender.id,
                defenseProfileId: 'defense-0',
            },
        })).toBe('defenseSpent');

        const spentDefenseAttack = runCommand(defended.state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: secondAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: defender.id,
            },
        });

        expect(spentDefenseAttack.success).toBe(true);
        expect(spentDefenseAttack.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(spentDefenseAttack.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);

        const finalQuickcastState: MatchState<MageWarsCore> = {
            core: {
                ...defended.state.core,
                currentPlayerId: '0',
            },
            sys: { ...baseState.sys, phase: 'finalQuickcast' },
        };
        const nextTurn = runCommand(finalQuickcastState, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const refreshedState: MatchState<MageWarsCore> = {
            core: {
                ...nextTurn.state.core,
                currentPlayerId: '0',
                phaseActorId: '0',
                objects: {
                    ...nextTurn.state.core.objects,
                    [secondAttacker.id]: {
                        ...nextTurn.state.core.objects[secondAttacker.id],
                        actionReady: true,
                    },
                },
            },
            sys: { ...nextTurn.state.sys, phase: 'creatureAction' },
        };
        const refreshedDefenseAttack = runCommand(refreshedState, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: secondAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: defender.id,
            },
        });

        expect(nextTurn.success).toBe(true);
        expect(nextTurn.state.core.objects[defender.id].defenseUsesThisRound).toBeUndefined();
        expect(refreshedDefenseAttack.success).toBe(true);
        expect(refreshedDefenseAttack.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
    });

    it('does not offer defense against unavoidable arena object attacks', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('brogan-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '斩首刃：快速近战 4 骰，无法回避，穿刺+3',
        });
        const defender = makeArenaObject('defending-cat-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰；防御图标 `8+ / 1x`；冲锋+2',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), defender),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: defender.id,
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);
        expect(attacked.state.sys.interaction.current).toBeUndefined();
        expect(attacked.state.core.objects[defender.id].damage).toBe(12);
    });

    it('prevents stunned arena creatures from moving or attacking', () => {
        const baseState = setupState('creatureAction');
        const stunnedCat = makeArenaObject('stunned-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });
        const target = makeArenaObject('target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 30,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, stunnedCat), target),
            sys: baseState.sys,
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: stunnedCat.id, toZoneId: ARENA_ZONE_IDS.A2 },
        })).toBe('objectStunned');
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: stunnedCat.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        })).toBe('objectStunned');
    });

    it('applies weak only to non-spell attack dice without reducing below one die', () => {
        const baseState = setupState('creatureAction');
        const weakenedCleric = makeArenaObject('cleric-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2907,
            sourceObjectId: 'spell-card-2907',
            name: '灰衣天使',
            attackOrTraitLine: '利剑：快速近战 4 骰；飞行',
            statusTokens: {
                [STATUS_TOKEN_IDS.WEAK]: 2,
            },
        });
        const overWeakenedCat = makeArenaObject('cat-weak-0', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: {
                [STATUS_TOKEN_IDS.WEAK]: 5,
            },
        });
        const target = makeArenaObject('target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 30,
        });
        const core = withArenaObject(
            withArenaObject(
                withArenaObject(baseState.core, weakenedCleric),
                overWeakenedCat,
            ),
            target,
        );

        const weakenedAttack = runCommand({
            core,
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: weakenedCleric.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const minimumAttack = runCommand({
            core,
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: overWeakenedCat.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });

        expect(weakenedAttack.success).toBe(true);
        expect(weakenedAttack.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: weakenedCleric.id,
                    diceResults: [3, 3],
                    baseDamage: 6,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 6,
                }),
            }),
        ]));
        expect(minimumAttack.success).toBe(true);
        expect(minimumAttack.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: overWeakenedCat.id,
                    diceResults: [3],
                    baseDamage: 3,
                }),
            }),
        ]));
        expect(minimumAttack.state.core.objects[target.id].damage).toBe(3);
    });

    it('resolves triple strike arena object attacks as three separate damage rolls with one action spend', () => {
        const baseState = setupState('creatureAction');
        const hydra = makeArenaObject('hydra-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2901,
            sourceObjectId: 'spell-card-2901',
            name: '暗沼九头蛇',
            life: 15,
            armor: 1,
            attackOrTraitLine: '猛力噬咬：快速近战 4 骰，反击；三重噬咬：完整行动近战 3 骰，三连击；重生2；迟缓',
        });
        const target = makeArenaObject('target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 40,
            armor: 0,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, hydra), target),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: hydra.id,
                attackProfileId: 'attack-1',
                targetObjectId: target.id,
            },
        });
        const attackRolls = attacked.events.filter((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);
        const damageEvents = attacked.events.filter((event) => event.type === 'DAMAGE_DEALT');

        expect(attacked.success).toBe(true);
        expect(attackRolls).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    attackerObjectId: hydra.id,
                    attackProfileId: 'attack-1',
                    attackName: '三重噬咬',
                    targetObjectId: target.id,
                    diceResults: [3, 3, 3],
                    strikeIndex: 0,
                    strikeCount: 3,
                    baseDamage: 9,
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetObjectId: target.id,
                    diceResults: [3, 3, 3],
                    strikeIndex: 1,
                    strikeCount: 3,
                    baseDamage: 9,
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetObjectId: target.id,
                    diceResults: [3, 3, 3],
                    strikeIndex: 2,
                    strikeCount: 3,
                    baseDamage: 9,
                }),
            }),
        ]);
        expect(damageEvents).toHaveLength(3);
        expect(damageEvents).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 9,
                    sourceAbilityId: 'mw.object.2901.attack-1',
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 9,
                    sourceAbilityId: 'mw.object.2901.attack-1',
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 9,
                    sourceAbilityId: 'mw.object.2901.attack-1',
                }),
            }),
        ]);
        expect(attacked.state.core.objects[hydra.id].actionReady).toBe(false);
        expect(attacked.state.core.objects[target.id].damage).toBe(27);
    });

    it('drains mana from the damaged target controller on the first mana-drain strike only', () => {
        const baseState = setupState('creatureAction');
        const manaLeech = makeArenaObject('mana-leech-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2807,
            sourceObjectId: 'spell-card-2807',
            name: '汲法水蛭',
            life: 8,
            armor: 1,
            attackOrTraitLine: '吸食噬咬：快速近战 2 骰，法力流失+1；吞食噬咬：完整行动近战 3 骰，法力流失+2；精神免疫',
        });
        const target = makeArenaObject('target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 30,
            armor: 0,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject({
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '1': {
                        ...baseState.core.players['1'],
                        mana: 1,
                    },
                },
            }, manaLeech), target),
            sys: baseState.sys,
        };

        const quickAttack = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: manaLeech.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });

        expect(quickAttack.success).toBe(true);
        expect(quickAttack.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MANA_DRAINED,
                payload: expect.objectContaining({
                    playerId: '1',
                    amount: 1,
                    requestedAmount: 1,
                    sourceAbilityId: 'mw.object.2807.attack-0',
                    spellCardId: 2807,
                    targetObjectId: target.id,
                }),
            }),
        ]));
        expect(quickAttack.state.core.players['1'].mana).toBe(0);
        expect(actionLogKinds(quickAttack.state)).toContain(MAGE_WARS_EVENTS.MANA_DRAINED);

        const multiStrikeLeech = makeArenaObject('multi-leech-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2807,
            sourceObjectId: 'spell-card-2807',
            name: '汲法水蛭',
            attackOrTraitLine: '吞食噬咬：完整行动近战 3 骰，法力流失+2，三连击',
        });
        const multiTarget = makeArenaObject('multi-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 40,
            armor: 0,
        });
        const multiStrikeState: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject({
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '1': {
                        ...baseState.core.players['1'],
                        mana: 5,
                    },
                },
            }, multiStrikeLeech), multiTarget),
            sys: baseState.sys,
        };

        const multiStrike = runCommand(multiStrikeState, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: multiStrikeLeech.id,
                attackProfileId: 'attack-0',
                targetObjectId: multiTarget.id,
            },
        });
        const manaDrainEvents = multiStrike.events.filter((event) => event.type === MAGE_WARS_EVENTS.MANA_DRAINED);

        expect(multiStrike.success).toBe(true);
        expect(manaDrainEvents).toHaveLength(1);
        expect(manaDrainEvents[0]).toMatchObject({
            payload: {
                playerId: '1',
                amount: 2,
                requestedAmount: 2,
                sourceAbilityId: 'mw.object.2807.attack-0',
                targetObjectId: multiTarget.id,
            },
        });
        expect(multiStrike.state.core.players['1'].mana).toBe(3);
    });

    it('requires explicit object attack profiles and supports ranged attack ranges', () => {
        const baseState = setupState('creatureAction');
        const archer = makeArenaObject('archer-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2816,
            sourceObjectId: 'spell-card-2816',
            name: '皇家箭手',
            attackOrTraitLine: '长弓：完整行动远程 `1-2` 4 骰，穿刺+1；小刀：快速近战 2 骰',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withPlayerInZone(baseState.core, '1', ARENA_ZONE_IDS.B3), archer),
            sys: baseState.sys,
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: archer.id,
                attackProfileId: 'missing',
                targetPlayerId: '1',
            },
        })).toBe('invalidAttackProfile');
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: archer.id,
                attackProfileId: 'attack-1',
                targetPlayerId: '1',
            },
        })).toBe('targetNotInSameZone');

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: archer.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: archer.id,
                    attackProfileId: 'attack-0',
                    attackName: '长弓',
                    targetPlayerId: '1',
                    diceResults: [3, 3, 3, 3],
                    baseDamage: 12,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: '1',
                    actualDamage: 12,
                    sourceAbilityId: 'mw.object.2816.attack-0',
                }),
            }),
        ]));
    });

    it('places status tokens from arena object attack effect dice', () => {
        const baseState = setupState('creatureAction');
        const imp = makeArenaObject('imp-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2801,
            sourceObjectId: 'spell-card-2801',
            name: '火烙魔婴',
            attackOrTraitLine: '狱火利爪：快速近战火焰 2 骰，效果骰 `8+=燃烧`，除霜；火焰免疫',
        });
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 8 : 3),
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withPlayerInZone(baseState.core, '1', PLAYER_ZERO_START_ZONE), imp),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: imp.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        }, statusRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: imp.id,
                    attackProfileId: 'attack-0',
                    effectDieResult: 8,
                    diceResults: [3, 3],
                    baseDamage: 6,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetPlayerId: '1',
                    statusTokenId: STATUS_TOKEN_IDS.BURN,
                    amount: 1,
                    sourceAbilityId: 'mw.object.2801.attack-0',
                }),
            }),
        ]));
        expect(attacked.state.core.players['1'].statusTokens[STATUS_TOKEN_IDS.BURN]).toBe(1);
    });

    it('does not place burn from arena object attacks on cannot-burn objects', () => {
        const baseState = setupState('creatureAction');
        const imp = makeArenaObject('imp-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2801,
            sourceObjectId: 'spell-card-2801',
            name: '火烙魔婴',
            attackOrTraitLine: '狱火利爪：快速近战火焰 2 骰，效果骰 `8+=燃烧`，除霜；火焰免疫',
        });
        const target = makeArenaObject('cannot-burn-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 30,
            attackOrTraitLine: '短剑：快速近战 4 骰；无法燃烧',
        });
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 8 : 3),
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, imp), target),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: imp.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        }, statusRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 6,
                    sourceAbilityId: 'mw.object.2801.attack-0',
                }),
            }),
        ]));
        expect(attacked.events.some((event) => (
            event.type === MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED
            && event.payload.targetObjectId === target.id
            && event.payload.statusTokenId === STATUS_TOKEN_IDS.BURN
        ))).toBe(false);
        expect(attacked.state.core.objects[target.id].statusTokens[STATUS_TOKEN_IDS.BURN]).toBeUndefined();
    });

    it('applies target fire resistance to arena object attack dice and effect dice', () => {
        const baseState = setupState('creatureAction');
        const imp = makeArenaObject('imp-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2801,
            sourceObjectId: 'spell-card-2801',
            name: '火烙魔婴',
            attackOrTraitLine: '狱火利爪：快速近战火焰 2 骰，效果骰 `8+=燃烧`，除霜；火焰免疫',
        });
        const target = makeArenaObject('fire-resistant-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 30,
            attackOrTraitLine: '狱火剑：快速近战 4 骰，穿刺+2；火焰-2',
        });
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 9 : 3),
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, imp), target),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: imp.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        }, statusRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: imp.id,
                    attackProfileId: 'attack-0',
                    targetObjectId: target.id,
                    rawEffectDieResult: 9,
                    effectDieResult: 7,
                    diceResults: [3],
                    baseDamage: 3,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 3,
                    sourceAbilityId: 'mw.object.2801.attack-0',
                }),
            }),
        ]));
        expect(attacked.events.some((event) => (
            event.type === MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED
            && event.payload.targetObjectId === target.id
            && event.payload.statusTokenId === STATUS_TOKEN_IDS.BURN
        ))).toBe(false);
        expect(attacked.state.core.objects[target.id]).toMatchObject({
            damage: 3,
            statusTokens: {},
        });
    });

    it('skips arena object attack dice and effects against matching damage type immunity', () => {
        const baseState = setupState('creatureAction');
        const imp = makeArenaObject('imp-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2801,
            sourceObjectId: 'spell-card-2801',
            name: '火烙魔婴',
            attackOrTraitLine: '狱火利爪：快速近战火焰 2 骰，效果骰 `8+=燃烧`，除霜；火焰免疫',
        });
        const target = makeArenaObject('fire-immune-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 30,
            attackOrTraitLine: '烈焰剑：快速近战火焰 4 骰；火焰免疫',
        });
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 9 : 3),
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, imp), target),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: imp.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        }, statusRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: imp.id,
                    attackProfileId: 'attack-0',
                    targetObjectId: target.id,
                    diceResults: [],
                    baseDamage: 0,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: expect.objectContaining({
                    attackerObjectId: imp.id,
                    targetObjectId: target.id,
                    sourceAbilityId: 'mw.object.2801.attack-0',
                    immunityDamageTypes: ['火焰'],
                }),
            }),
        ]));
        expect(attacked.events.map((event) => event.type)).not.toContain('DAMAGE_DEALT');
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED);
        expect(attacked.state.core.objects[imp.id].actionReady).toBe(false);
        expect(attacked.state.core.objects[target.id]).toMatchObject({
            damage: 0,
            statusTokens: {},
        });
        expect(actionLogKinds(attacked.state)).toContain(MAGE_WARS_EVENTS.ATTACK_MISSED);
    });

    it('places rot tokens from arena object attack effect dice', () => {
        const baseState = setupState('creatureAction');
        const basilisk = makeArenaObject('basilisk-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2808,
            sourceObjectId: 'spell-card-2808',
            name: '翠绿树蜥',
            attackOrTraitLine: '剧毒噬咬：快速近战 3 骰，效果骰 `8+=腐化`',
        });
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 8 : 3),
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withPlayerInZone(baseState.core, '1', PLAYER_ZERO_START_ZONE), basilisk),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: basilisk.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        }, statusRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetPlayerId: '1',
                    statusTokenId: STATUS_TOKEN_IDS.ROT,
                    amount: 1,
                    sourceAbilityId: 'mw.object.2808.attack-0',
                }),
            }),
        ]));
        expect(attacked.state.core.players['1'].statusTokens[STATUS_TOKEN_IDS.ROT]).toBe(1);
    });

    it('places weak and cripple tokens from object attack effect dice and respects toxin immunity', () => {
        const baseState = setupState('creatureAction');
        const gorgon = makeArenaObject('gorgon-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2810,
            sourceObjectId: 'spell-card-2810',
            name: '戈尔贡箭手',
            attackOrTraitLine: '毒弓：完整行动远程 `1-2` 4 骰，效果骰 `4-9=虚弱`、`10+=虚弱x2`；利爪：快速近战 2 骰；重生2；迟缓',
        });
        const basilisk = makeArenaObject('basilisk-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2809,
            sourceObjectId: 'spell-card-2809',
            name: '石目蛇蜥',
            attackOrTraitLine: '麻痹光束：完整行动远程 `0-2` 2 骰，效果骰 `7+=残废`；噬咬：快速近战 4 骰；迟缓',
        });
        const livingTarget = makeArenaObject('guard-1', '1', ARENA_ZONE_IDS.B3, {
            life: 30,
        });
        const nonlivingTarget = makeArenaObject('skeleton-1', '1', ARENA_ZONE_IDS.B3, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            life: 30,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });
        const uncontainableTarget = makeArenaObject('phase-1', '1', ARENA_ZONE_IDS.B3, {
            name: '不羁目标',
            life: 30,
            attackOrTraitLine: '利爪：快速近战 2 骰；不羁',
        });
        const weakRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 10 : 1),
        };
        const crippleRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 7 : 1),
        };
        const core = [gorgon, basilisk, livingTarget, nonlivingTarget, uncontainableTarget].reduce(
            (nextCore, object) => withArenaObject(nextCore, object),
            baseState.core,
        );

        const weakened = runCommand({
            core,
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: gorgon.id,
                attackProfileId: 'attack-0',
                targetObjectId: livingTarget.id,
            },
        }, weakRandom);

        const crippled = runCommand({
            core,
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: basilisk.id,
                attackProfileId: 'attack-0',
                targetObjectId: livingTarget.id,
            },
        }, crippleRandom);

        const toxinImmune = runCommand({
            core,
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: gorgon.id,
                attackProfileId: 'attack-0',
                targetObjectId: nonlivingTarget.id,
            },
        }, weakRandom);

        const uncontainableCrippleImmune = runCommand({
            core,
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: basilisk.id,
                attackProfileId: 'attack-0',
                targetObjectId: uncontainableTarget.id,
            },
        }, crippleRandom);

        expect(weakened.success).toBe(true);
        expect(weakened.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: livingTarget.id,
                    statusTokenId: STATUS_TOKEN_IDS.WEAK,
                    amount: 2,
                    sourceAbilityId: 'mw.object.2810.attack-0',
                }),
            }),
        ]));
        expect(weakened.state.core.objects[livingTarget.id].statusTokens[STATUS_TOKEN_IDS.WEAK]).toBe(2);

        expect(crippled.success).toBe(true);
        expect(crippled.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: livingTarget.id,
                    statusTokenId: STATUS_TOKEN_IDS.CRIPPLE,
                    amount: 1,
                    sourceAbilityId: 'mw.object.2809.attack-0',
                }),
            }),
        ]));
        expect(crippled.state.core.objects[livingTarget.id].statusTokens[STATUS_TOKEN_IDS.CRIPPLE]).toBe(1);

        expect(toxinImmune.success).toBe(true);
        expect(toxinImmune.events.some((event) => (
            event.type === MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED
            && event.payload.targetObjectId === nonlivingTarget.id
        ))).toBe(false);
        expect(toxinImmune.state.core.objects[nonlivingTarget.id].statusTokens[STATUS_TOKEN_IDS.WEAK]).toBeUndefined();

        expect(uncontainableCrippleImmune.success).toBe(true);
        expect(uncontainableCrippleImmune.events.some((event) => (
            event.type === MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED
            && event.payload.targetObjectId === uncontainableTarget.id
            && event.payload.statusTokenId === STATUS_TOKEN_IDS.CRIPPLE
        ))).toBe(false);
        expect(uncontainableCrippleImmune.state.core.objects[uncontainableTarget.id].statusTokens[STATUS_TOKEN_IDS.CRIPPLE]).toBeUndefined();
    });

    it('applies arena object armor through the damage pipeline', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const armoredDefender = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2909,
            sourceObjectId: 'spell-card-2909',
            name: '皇家弓手',
            life: 6,
            armor: 2,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), armoredDefender),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: armoredDefender.id,
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: armoredDefender.id,
                    actualDamage: 4,
                    sourceAbilityId: 'mw.object.2906.attack-0',
                    breakdown: expect.objectContaining({
                        steps: expect.arrayContaining([
                            expect.objectContaining({
                                sourceId: 'mage-wars-object-armor',
                                sourceName: '护甲',
                                value: -2,
                                runningTotal: 4,
                            }),
                        ]),
                    }),
                }),
            }),
        ]));
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(attacked.state.core.objects[armoredDefender.id]).toMatchObject({
            damage: 4,
            armor: 2,
        });
    });

    it('uses pierce to offset object armor without adding bonus damage', () => {
        const baseState = setupState('creatureAction');
        const archer = makeArenaObject('archer-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2816,
            sourceObjectId: 'spell-card-2816',
            name: '皇家箭手',
            attackOrTraitLine: '长弓：完整行动远程 `1-2` 4 骰，穿刺+1；小刀：快速近战 2 骰',
        });
        const armoredDefender = makeArenaObject('guard-1', '1', ARENA_ZONE_IDS.B3, {
            sourceSpellCardId: 2909,
            sourceObjectId: 'spell-card-2909',
            name: '皇家弓手',
            life: 20,
            armor: 3,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, archer), armoredDefender),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: archer.id,
                attackProfileId: 'attack-0',
                targetObjectId: armoredDefender.id,
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: armoredDefender.id,
                    actualDamage: 10,
                    sourceAbilityId: 'mw.object.2816.attack-0',
                    breakdown: expect.objectContaining({
                        steps: expect.arrayContaining([
                            expect.objectContaining({
                                sourceId: 'mage-wars-object-armor',
                                value: -2,
                                runningTotal: 10,
                            }),
                        ]),
                    }),
                }),
            }),
        ]));
        expect(attacked.state.core.objects[armoredDefender.id]).toMatchObject({
            damage: 10,
            armor: 3,
        });
    });

    it('does not reduce object attack damage when pierce fully offsets armor', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('warrior-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2811,
            sourceObjectId: 'spell-card-2811',
            name: '黑暗军团战士',
            attackOrTraitLine: '斩首刃：快速近战 4 骰，无法回避，穿刺+3',
        });
        const armoredDefender = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2909,
            sourceObjectId: 'spell-card-2909',
            name: '皇家弓手',
            life: 20,
            armor: 1,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), armoredDefender),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: armoredDefender.id,
            },
        });

        const damageEvent = attacked.events.find((event) => event.type === 'DAMAGE_DEALT');
        expect(attacked.success).toBe(true);
        expect(damageEvent).toMatchObject({
            payload: {
                targetId: armoredDefender.id,
                actualDamage: 12,
                sourceAbilityId: 'mw.object.2811.attack-0',
            },
        });
        expect(JSON.stringify(damageEvent?.payload.breakdown)).not.toContain('mage-wars-object-armor');
        expect(attacked.state.core.objects[armoredDefender.id]).toMatchObject({
            damage: 12,
            armor: 1,
        });
    });

    it('applies arena object armor to attack spells that target objects', () => {
        const attackSpellId = 1710;
        const planned = runCommand(setupState('planning'), planCommand([attackSpellId]));
        const armoredDefender = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2909,
            sourceObjectId: 'spell-card-2909',
            name: '皇家弓手',
            life: 10,
            armor: 2,
        });

        const attacked = runCommand({
            core: withArenaObject(planned.state.core, armoredDefender),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 4,
                targetObjectId: armoredDefender.id,
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: armoredDefender.id,
                    actualDamage: 7,
                    sourceAbilityId: 'mw.spell.1710',
                }),
            }),
        ]));
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(attacked.state.core.objects[armoredDefender.id]).toMatchObject({
            damage: 7,
            armor: 2,
        });
    });

    it('applies Pillar of Light nonliving bonus damage and status effect to non-living creatures', () => {
        const attackSpellId = 1706;
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 11 : 3),
        };
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withCurrentPlayer(planningState.core, '1'),
            sys: planningState.sys,
        }, planCommand([attackSpellId], '1'));
        const skeleton = makeArenaObject('skeleton-0', '0', ARENA_ZONE_IDS.C1, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            life: 11,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });

        const attacked = runCommand({
            core: withArenaObject(planned.state.core, skeleton),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '1',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 5,
                targetObjectId: skeleton.id,
            },
        }, statusRandom);

        expect(planned.success).toBe(true);
        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    playerId: '1',
                    spellCardId: attackSpellId,
                    sourceAbilityId: 'mw.spell.1706',
                    targetObjectId: skeleton.id,
                    targetZoneId: ARENA_ZONE_IDS.C1,
                    diceResults: [3, 3],
                    effectDieResult: 11,
                    baseDamage: 6,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: skeleton.id,
                    actualDamage: 8,
                    sourceAbilityId: 'mw.spell.1706',
                    breakdown: expect.objectContaining({
                        steps: expect.arrayContaining([
                            expect.objectContaining({
                                sourceId: 'mage-wars-nonliving-bonus',
                                sourceName: '对抗非活体生物',
                                value: 2,
                                runningTotal: 8,
                            }),
                        ]),
                    }),
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: skeleton.id,
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.1706',
                    spellCardId: attackSpellId,
                }),
            }),
        ]));
        expect(attacked.state.core.objects[skeleton.id]).toMatchObject({
            damage: 8,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });
    });

    it('does not apply Pillar of Light nonliving bonus to living creatures', () => {
        const attackSpellId = 1706;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withCurrentPlayer(planningState.core, '1'),
            sys: planningState.sys,
        }, planCommand([attackSpellId], '1'));
        const livingCat = makeArenaObject('cat-0', '0', ARENA_ZONE_IDS.C1, {
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-card-2906',
            name: '野性山猫',
            life: 10,
            attackOrTraitLine: '利爪：快速近战 2 骰；防御图标 `8+ / 1x`；冲锋+2',
        });

        const attacked = runCommand({
            core: withArenaObject(planned.state.core, livingCat),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '1',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 5,
                targetObjectId: livingCat.id,
            },
        });

        const damageEvent = attacked.events.find((event) => event.type === 'DAMAGE_DEALT');
        expect(attacked.success).toBe(true);
        expect(damageEvent).toMatchObject({
            payload: {
                targetId: livingCat.id,
                actualDamage: 6,
                sourceAbilityId: 'mw.spell.1706',
            },
        });
        expect(JSON.stringify(damageEvent?.payload.breakdown)).not.toContain('mage-wars-nonliving-bonus');
        expect(attacked.state.core.objects[livingCat.id].damage).toBe(6);
    });

    it('casts Jet Stream with flying bonus damage, push movement, and daze on 11+', () => {
        const attackSpellId = 1711;
        const pushRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 11 : 3),
        };
        const planned = runCommand(setupState('planning'), planCommand([attackSpellId]));
        const flyingAngel = makeArenaObject('angel-1', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2907,
            sourceObjectId: 'spell-card-2907',
            name: '灰衣天使',
            life: 12,
            armor: 0,
            attackOrTraitLine: '利剑：快速近战 4 骰；飞行',
        });

        const pushed = runCommand({
            core: withArenaObject(planned.state.core, flyingAngel),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 4,
                targetObjectId: flyingAngel.id,
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
        }, pushRandom);

        expect(pushed.success).toBe(true);
        expect(pushed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    spellCardId: attackSpellId,
                    sourceAbilityId: 'mw.spell.1711',
                    targetObjectId: flyingAngel.id,
                    diceResults: [3, 3],
                    effectDieResult: 11,
                    baseDamage: 6,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: flyingAngel.id,
                    actualDamage: 8,
                    sourceAbilityId: 'mw.spell.1711',
                    breakdown: expect.objectContaining({
                        steps: expect.arrayContaining([
                            expect.objectContaining({
                                sourceId: 'mage-wars-flying-bonus',
                                sourceName: '对抗飞行',
                                value: 2,
                                runningTotal: 8,
                            }),
                        ]),
                    }),
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: flyingAngel.id,
                    statusTokenId: STATUS_TOKEN_IDS.DAZE,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.1711',
                    spellCardId: attackSpellId,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED,
                payload: expect.objectContaining({
                    playerId: '0',
                    spellCardId: attackSpellId,
                    sourceAbilityId: 'mw.spell.1711',
                    targetObjectId: flyingAngel.id,
                    fromZoneId: ARENA_ZONE_IDS.A2,
                    toZoneId: ARENA_ZONE_IDS.A3,
                }),
            }),
        ]));
        expect(pushed.state.core.objects[flyingAngel.id]).toMatchObject({
            damage: 8,
            zoneId: ARENA_ZONE_IDS.A3,
            statusTokens: {
                [STATUS_TOKEN_IDS.DAZE]: 1,
            },
        });
        expect(pushed.state.core.arena.find((zone) => zone.id === ARENA_ZONE_IDS.A2)?.objectIds).not.toContain(flyingAngel.id);
        expect(pushed.state.core.arena.find((zone) => zone.id === ARENA_ZONE_IDS.A3)?.objectIds).toContain(flyingAngel.id);
    });

    it('does not treat crippled flying creatures as flying for Jet Stream bonus damage', () => {
        const attackSpellId = 1711;
        const pushRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 11 : 3),
        };
        const planned = runCommand(setupState('planning'), planCommand([attackSpellId]));
        const crippledFlyingAngel = makeArenaObject('crippled-angel-1', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2907,
            sourceObjectId: 'spell-card-2907',
            name: '灰衣天使',
            life: 12,
            armor: 0,
            attackOrTraitLine: '利剑：快速近战 4 骰；飞行',
            statusTokens: {
                [STATUS_TOKEN_IDS.CRIPPLE]: 1,
            },
        });

        const pushed = runCommand({
            core: withArenaObject(planned.state.core, crippledFlyingAngel),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 4,
                targetObjectId: crippledFlyingAngel.id,
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
        }, pushRandom);

        const damageEvent = pushed.events.find((event) => event.type === 'DAMAGE_DEALT');
        expect(pushed.success).toBe(true);
        expect(damageEvent).toMatchObject({
            payload: {
                targetId: crippledFlyingAngel.id,
                actualDamage: 6,
                sourceAbilityId: 'mw.spell.1711',
            },
        });
        expect(JSON.stringify(damageEvent?.payload.breakdown)).not.toContain('mage-wars-flying-bonus');
        expect(pushed.state.core.objects[crippledFlyingAngel.id]).toMatchObject({
            damage: 6,
            zoneId: ARENA_ZONE_IDS.A3,
            statusTokens: {
                [STATUS_TOKEN_IDS.CRIPPLE]: 1,
                [STATUS_TOKEN_IDS.DAZE]: 1,
            },
        });
    });

    it('requires Jet Stream push destination to be a legal adjacent zone', () => {
        const attackSpellId = 1711;
        const planned = runCommand(setupState('planning'), planCommand([attackSpellId]));
        const target = makeArenaObject('target-1', '1', ARENA_ZONE_IDS.A2);
        const state = {
            core: withArenaObject(planned.state.core, target),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 4,
                targetObjectId: target.id,
            },
        })).toBe('missingPushTargetZone');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 4,
                targetObjectId: target.id,
                pushToZoneId: PLAYER_ONE_START_ZONE,
            },
        })).toBe('pushTargetNotAdjacent');
    });

    it('casts Force Push as a quick incantation that pushes a target creature one adjacent zone', () => {
        const forcePushSpellId = 3425;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([forcePushSpellId]));
        const target = makeArenaObject('force-push-target', '1', ARENA_ZONE_IDS.A2);
        const state = {
            core: withArenaObject(planned.state.core, target),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const pushed = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: forcePushSpellId,
                manaCost: 3,
                targetObjectId: target.id,
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
        });

        expect(pushed.success).toBe(true);
        expect(pushed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    spellCardId: forcePushSpellId,
                    targetObjectId: target.id,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED,
                payload: {
                    playerId: '0',
                    spellCardId: forcePushSpellId,
                    sourceAbilityId: 'mw.spell.3425',
                    targetObjectId: target.id,
                    fromZoneId: ARENA_ZONE_IDS.A2,
                    toZoneId: ARENA_ZONE_IDS.A3,
                },
            }),
        ]));
        expect(pushed.state.core.players['0']).toMatchObject({
            quickcastReady: false,
            actionReady: true,
        });
        expect(pushed.state.core.players['0'].discardSpellCardIds).toEqual([forcePushSpellId]);
        expect(pushed.state.core.objects[target.id]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A3,
            actionReady: true,
        });
        expect(pushed.state.core.arena.find((zone) => zone.id === ARENA_ZONE_IDS.A2)?.objectIds).not.toContain(target.id);
        expect(pushed.state.core.arena.find((zone) => zone.id === ARENA_ZONE_IDS.A3)?.objectIds).toContain(target.id);
    });

    it('requires Force Push to target a creature and choose a legal adjacent destination', () => {
        const forcePushSpellId = 3523;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.PRIESTESS_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([forcePushSpellId]));
        const target = makeArenaObject('force-push-priestess-target', '1', ARENA_ZONE_IDS.A2);
        const state = {
            core: withArenaObject(planned.state.core, target),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: forcePushSpellId,
                manaCost: 3,
                targetObjectId: target.id,
            },
        })).toBe('missingPushTargetZone');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: forcePushSpellId,
                manaCost: 3,
                targetObjectId: target.id,
                pushToZoneId: PLAYER_ONE_START_ZONE,
            },
        })).toBe('pushTargetNotAdjacent');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: forcePushSpellId,
                manaCost: 3,
                targetPlayerId: '1',
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
        })).toBe('invalidTargetMode');
    });

    it('casts Teleport as a quick incantation that moves a target creature to the chosen zone', () => {
        const teleportSpellId = 3410;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([teleportSpellId]));
        const target = makeArenaObject('teleport-target-cat', '1', ARENA_ZONE_IDS.A2);
        const state = {
            core: withArenaObject(planned.state.core, target),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const teleported = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: teleportSpellId,
                manaCost: 6,
                targetObjectId: target.id,
                targetZoneId: ARENA_ZONE_IDS.B3,
            },
        });

        expect(teleported.success).toBe(true);
        expect(teleported.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    spellCardId: teleportSpellId,
                    manaCost: 6,
                    targetObjectId: target.id,
                    targetZoneId: ARENA_ZONE_IDS.B3,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED,
                payload: {
                    playerId: '0',
                    spellCardId: teleportSpellId,
                    sourceAbilityId: 'mw.spell.3410',
                    targetObjectId: target.id,
                    fromZoneId: ARENA_ZONE_IDS.A2,
                    toZoneId: ARENA_ZONE_IDS.B3,
                    distance: 2,
                },
            }),
        ]));
        expect(teleported.state.core.players['0']).toMatchObject({
            quickcastReady: false,
            actionReady: true,
        });
        expect(teleported.state.core.players['0'].discardSpellCardIds).toEqual([teleportSpellId]);
        expect(teleported.state.core.objects[target.id]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.B3,
            actionReady: true,
        });
        expect(teleported.state.core.arena.find((zone) => zone.id === ARENA_ZONE_IDS.A2)?.objectIds).not.toContain(target.id);
        expect(teleported.state.core.arena.find((zone) => zone.id === ARENA_ZONE_IDS.B3)?.objectIds).toContain(target.id);
    });

    it('requires Teleport to target a creature, choose a zone, and pay distance-based mana', () => {
        const teleportSpellId = 3410;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([teleportSpellId]));
        const target = makeArenaObject('teleport-validation-target', '1', ARENA_ZONE_IDS.A2);
        const outOfRangeTarget = makeArenaObject('teleport-out-of-range-target', '1', PLAYER_ONE_START_ZONE);
        const conjuration = makeArenaObject('teleport-conjuration-target', '1', ARENA_ZONE_IDS.A2, {
            kind: 'conjuration',
            sourceSpellCardId: 2224,
            sourceObjectId: 'spell-card-2224',
            name: '缠绕藤蔓',
        });
        const state = {
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(planned.state.core, target),
                    outOfRangeTarget,
                ),
                conjuration,
            ),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: teleportSpellId,
                manaCost: 3,
                targetObjectId: target.id,
            },
        })).toBe('missingTargetZone');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: teleportSpellId,
                manaCost: 3,
                targetPlayerId: '1',
                targetZoneId: PLAYER_ONE_START_ZONE,
            },
        })).toBe('invalidTargetMode');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: teleportSpellId,
                manaCost: 6,
                targetObjectId: conjuration.id,
                targetZoneId: PLAYER_ONE_START_ZONE,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: teleportSpellId,
                manaCost: 5,
                targetObjectId: target.id,
                targetZoneId: ARENA_ZONE_IDS.B3,
            },
        })).toBe('manaCostMismatch');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: teleportSpellId,
                manaCost: 3,
                targetObjectId: outOfRangeTarget.id,
                targetZoneId: ARENA_ZONE_IDS.B2,
            },
        })).toBe('targetOutOfRange');
    });

    it('casts Rouse the Beast to ready a creature summoned this turn', () => {
        const creatureSpellId = 2906;
        const rouseSpellId = 3403;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([creatureSpellId, rouseSpellId]));

        const summoned = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: creatureSpellId,
                manaCost: 5,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const objectId = 'mwobj-0-2906-1';

        expect(summoned.success).toBe(true);
        expect(summoned.state.core.objects[objectId]).toMatchObject({
            sourceSpellCardId: creatureSpellId,
            name: '野性山猫',
            actionReady: false,
            summonedTurnNumber: summoned.state.core.turnNumber,
        });

        const roused = runCommand({
            core: summoned.state.core,
            sys: { ...summoned.state.sys, phase: 'finalQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: rouseSpellId,
                manaCost: 1,
                targetObjectId: objectId,
            },
        });

        expect(roused.success).toBe(true);
        expect(roused.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    spellCardId: rouseSpellId,
                    manaCost: 1,
                    targetObjectId: objectId,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ROUSED,
                payload: expect.objectContaining({
                    ownerId: '0',
                    objectId,
                    sourceAbilityId: 'mw.spell.3403',
                    spellCardId: rouseSpellId,
                    turnNumber: roused.state.core.turnNumber,
                }),
            }),
        ]));
        expect(roused.state.core.objects[objectId]).toMatchObject({
            actionReady: true,
            rousedBySpellTurnNumber: roused.state.core.turnNumber,
        });
        expect(roused.state.core.players['0']).toMatchObject({
            mana: planned.state.core.players['0'].mana - 6,
            actionReady: false,
            quickcastReady: false,
        });
        expect(roused.state.core.players['0'].discardSpellCardIds).toEqual([rouseSpellId, creatureSpellId]);
    });

    it('requires Rouse the Beast to target a fresh living creature and pay its level', () => {
        const rouseSpellId = 3403;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([rouseSpellId]));
        const freshCat = makeArenaObject('fresh-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-card-2906',
            name: '野性山猫',
            actionReady: false,
            summonedTurnNumber: planned.state.core.turnNumber,
        });
        const oldCat = makeArenaObject('old-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-card-2906',
            name: '旧召唤野性山猫',
            actionReady: false,
            summonedTurnNumber: planned.state.core.turnNumber - 1,
        });
        const nonlivingTarget = makeArenaObject('nonliving-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            actionReady: false,
            summonedTurnNumber: planned.state.core.turnNumber,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });
        const conjurationTarget = makeArenaObject('conjuration-0', '0', PLAYER_ZERO_START_ZONE, {
            kind: 'conjuration',
            sourceSpellCardId: 2224,
            sourceObjectId: 'spell-card-2224',
            name: '缠绕藤蔓',
            actionReady: false,
            summonedTurnNumber: planned.state.core.turnNumber,
            attackOrTraitLine: '活体；火焰+2；水流免疫',
        });
        const alreadyRoused = makeArenaObject('already-roused-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-card-2906',
            name: '已觉醒野性山猫',
            actionReady: true,
            summonedTurnNumber: planned.state.core.turnNumber,
            rousedBySpellTurnNumber: planned.state.core.turnNumber,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(
                        withArenaObject(
                            withArenaObject(planned.state.core, freshCat),
                            oldCat,
                        ),
                        nonlivingTarget,
                    ),
                    conjurationTarget,
                ),
                alreadyRoused,
            ),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: rouseSpellId,
                manaCost: 2,
                targetObjectId: freshCat.id,
            },
        })).toBe('manaCostMismatch');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: rouseSpellId,
                manaCost: 1,
                targetObjectId: oldCat.id,
            },
        })).toBe('targetNotSummonedThisTurn');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: rouseSpellId,
                manaCost: 1,
                targetObjectId: nonlivingTarget.id,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: rouseSpellId,
                manaCost: 1,
                targetObjectId: conjurationTarget.id,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: rouseSpellId,
                manaCost: 1,
                targetObjectId: alreadyRoused.id,
            },
        })).toBe('targetAlreadyRousedThisTurn');

        expect(validateCommand({
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': {
                        ...state.core.players['0'],
                        mana: 0,
                    },
                },
            },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: rouseSpellId,
                manaCost: 1,
                targetObjectId: freshCat.id,
            },
        })).toBe('insufficientMana');
    });

    it('clears Rouse the Beast per-round marker when a new round starts', () => {
        const rousedCat = makeArenaObject('round-roused-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-card-2906',
            name: '已觉醒野性山猫',
            actionReady: true,
            summonedTurnNumber: 1,
            rousedBySpellTurnNumber: 1,
        });
        const state: MatchState<MageWarsCore> = {
            core: withCurrentPlayer({
                ...withArenaObject(setupState('finalQuickcast').core, rousedCat),
                phaseReadyPlayerIds: [],
            }, '1'),
            sys: setupState('finalQuickcast').sys,
        };

        const nextRound = runCommand(state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '1',
            payload: {},
        });

        expect(nextRound.success).toBe(true);
        expect(nextRound.state.core.turnNumber).toBe(2);
        expect(nextRound.state.core.currentPlayerId).toBe('0');
        expect(nextRound.state.core.objects[rousedCat.id]).toMatchObject({
            actionReady: true,
            summonedTurnNumber: 1,
        });
        expect(nextRound.state.core.objects[rousedCat.id].rousedBySpellTurnNumber).toBeUndefined();
    });

    it('casts Explode to destroy mage-attached equipment before resolving its fire attack', () => {
        const explodeSpellId = 3401;
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 6 : 3),
        };
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([explodeSpellId]));
        const coreWithEnemyInRange = withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2);
        const equipment = makeArenaObject('enemy-equipment-3703-explode', '1', ARENA_ZONE_IDS.A2, {
            kind: 'equipment',
            sourceSpellCardId: 3703,
            sourceObjectId: 'spell-card-3703',
            name: '龙鳞锁甲',
            life: 1,
            actionReady: false,
            typeLine: '装备 / 胸甲',
            attackOrTraitLine: '法师获得护甲+2和火焰-2特性',
            anchoredToPlayerId: '1',
        });
        const state: MatchState<MageWarsCore> = {
            core: {
                ...withArenaObject(coreWithEnemyInRange, equipment),
                players: {
                    ...coreWithEnemyInRange.players,
                    '0': {
                        ...coreWithEnemyInRange.players['0'],
                        mana: 20,
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const exploded = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: explodeSpellId,
                manaCost: 12,
                targetObjectId: equipment.id,
            },
        }, statusRandom);
        const damageEvent = exploded.events.find((event) => event.type === 'DAMAGE_DEALT');

        expect(exploded.success).toBe(true);
        expect(exploded.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    spellCardId: explodeSpellId,
                    manaCost: 12,
                    targetObjectId: equipment.id,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: equipment.id,
                    ownerId: '1',
                    sourceAbilityId: 'mw.spell.3401',
                    spellCardId: explodeSpellId,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    spellCardId: explodeSpellId,
                    sourceAbilityId: 'mw.spell.3401',
                    targetPlayerId: '1',
                    diceResults: [3, 3, 3, 3],
                    rawEffectDieResult: 6,
                    effectDieResult: 6,
                    baseDamage: 12,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: '1',
                    actualDamage: 12,
                    sourceAbilityId: 'mw.spell.3401',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetPlayerId: '1',
                    statusTokenId: STATUS_TOKEN_IDS.BURN,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.3401',
                    spellCardId: explodeSpellId,
                }),
            }),
        ]));
        expect(JSON.stringify(damageEvent?.payload.breakdown)).not.toContain('mage-wars-mage-equipment-armor');
        expect(exploded.state.core.objects[equipment.id]).toBeUndefined();
        expect(exploded.state.core.players['1'].damage).toBe(12);
        expect(exploded.state.core.players['1'].statusTokens[STATUS_TOKEN_IDS.BURN]).toBe(1);
        expect(exploded.state.core.players['0'].discardSpellCardIds).toEqual([explodeSpellId]);
        expect(exploded.state.core.players['0'].mana).toBe(8);
    });

    it('requires Explode to target mage-attached equipment and pay that equipment cost plus six', () => {
        const explodeSpellId = 3401;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([explodeSpellId]));
        const validEquipment = makeArenaObject('explode-equipment-in-range', '1', ARENA_ZONE_IDS.A2, {
            kind: 'equipment',
            sourceSpellCardId: 3703,
            sourceObjectId: 'spell-card-3703',
            name: '龙鳞锁甲',
            life: 1,
            actionReady: false,
            typeLine: '装备 / 胸甲',
            anchoredToPlayerId: '1',
        });
        const unattachedEquipment = makeArenaObject('explode-unattached-equipment', '1', ARENA_ZONE_IDS.A2, {
            kind: 'equipment',
            sourceSpellCardId: 3703,
            sourceObjectId: 'spell-card-3703',
            name: '未附属龙鳞锁甲',
            life: 1,
            actionReady: false,
            typeLine: '装备 / 胸甲',
        });
        const creature = makeArenaObject('explode-not-equipment', '1', ARENA_ZONE_IDS.A2);
        const outOfRangeEquipment = makeArenaObject('explode-equipment-out-of-range', '1', PLAYER_ONE_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: 3703,
            sourceObjectId: 'spell-card-3703',
            name: '远处龙鳞锁甲',
            life: 1,
            actionReady: false,
            typeLine: '装备 / 胸甲',
            anchoredToPlayerId: '1',
        });
        const coreWithObjects = withArenaObject(
            withArenaObject(
                withArenaObject(
                    withArenaObject(withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2), validEquipment),
                    unattachedEquipment,
                ),
                creature,
            ),
            outOfRangeEquipment,
        );
        const state: MatchState<MageWarsCore> = {
            core: {
                ...coreWithObjects,
                players: {
                    ...coreWithObjects.players,
                    '0': {
                        ...coreWithObjects.players['0'],
                        mana: 20,
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: explodeSpellId,
                manaCost: 11,
                targetObjectId: validEquipment.id,
            },
        })).toBe('manaCostMismatch');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: explodeSpellId,
                manaCost: 12,
                targetObjectId: unattachedEquipment.id,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: explodeSpellId,
                manaCost: 12,
                targetObjectId: creature.id,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand({
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': {
                        ...state.core.players['0'],
                        mana: 11,
                    },
                },
            },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: explodeSpellId,
                manaCost: 12,
                targetObjectId: validEquipment.id,
            },
        })).toBe('insufficientMana');

        expect(validateCommand({
            ...state,
            core: withPlayerInZone(state.core, '1', PLAYER_ONE_START_ZONE),
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: explodeSpellId,
                manaCost: 12,
                targetObjectId: outOfRangeEquipment.id,
            },
        })).toBe('targetOutOfRange');
    });

    it('casts Dissolve to destroy equipment attached to a target mage', () => {
        const dissolveSpellId = 3605;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([dissolveSpellId]));
        const coreWithEnemyInRange = withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2);
        const equipment = makeArenaObject('enemy-equipment-3703', '1', ARENA_ZONE_IDS.A2, {
            kind: 'equipment',
            sourceSpellCardId: 3703,
            sourceObjectId: 'spell-card-3703',
            name: '龙鳞锁甲',
            life: 1,
            actionReady: false,
            typeLine: '装备 / 胸甲',
            anchoredToPlayerId: '1',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(coreWithEnemyInRange, equipment),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const dissolved = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dissolveSpellId,
                manaCost: 6,
                targetObjectId: equipment.id,
            },
        });

        expect(dissolved.success).toBe(true);
        expect(dissolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    spellCardId: dissolveSpellId,
                    manaCost: 6,
                    targetObjectId: equipment.id,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: equipment.id,
                    ownerId: '1',
                    sourceAbilityId: 'mw.spell.3605',
                    spellCardId: dissolveSpellId,
                }),
            }),
        ]));
        expect(dissolved.state.core.objects[equipment.id]).toBeUndefined();
        expect(dissolved.state.core.players['0'].discardSpellCardIds).toEqual([dissolveSpellId]);
        expect(dissolved.state.core.players['0'].mana).toBe(state.core.players['0'].mana - 6);
    });

    it('executes alternate Dissolve 3406 with the same attached-equipment destruction rule', () => {
        const dissolveSpellId = 3406;
        const planningState = setupState('planning');
        expect(validateCommand(planningState, planCommand([dissolveSpellId]))).toBe('spellNotInPresetSpellbook');

        const coreWithEnemyInRange = withPlayerInZone(planningState.core, '1', ARENA_ZONE_IDS.A2);
        const equipment = makeArenaObject('enemy-equipment-3703-alt', '1', ARENA_ZONE_IDS.A2, {
            kind: 'equipment',
            sourceSpellCardId: 3703,
            sourceObjectId: 'spell-card-3703',
            name: '龙鳞锁甲',
            life: 1,
            actionReady: false,
            typeLine: '装备 / 胸甲',
            anchoredToPlayerId: '1',
        });
        const state: MatchState<MageWarsCore> = {
            core: {
                ...withArenaObject(coreWithEnemyInRange, equipment),
                players: {
                    ...coreWithEnemyInRange.players,
                    '0': {
                        ...coreWithEnemyInRange.players['0'],
                        preparedSpellCardIds: [dissolveSpellId],
                        preparedSpellSlots: 1,
                    },
                },
            },
            sys: { ...planningState.sys, phase: 'initiativeQuickcast' },
        };

        const events = MageWarsDomain.execute(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dissolveSpellId,
                manaCost: 6,
                targetObjectId: equipment.id,
            },
        }, fixedRandom);
        const nextCore = events.reduce((core, event) => MageWarsDomain.reduce(core, event), state.core);

        expect(events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    spellCardId: dissolveSpellId,
                    manaCost: 6,
                    targetObjectId: equipment.id,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: equipment.id,
                    ownerId: '1',
                    sourceAbilityId: 'mw.spell.3406',
                    spellCardId: dissolveSpellId,
                }),
            }),
        ]));
        expect(nextCore.objects[equipment.id]).toBeUndefined();
        expect(nextCore.players['0'].discardSpellCardIds).toEqual([dissolveSpellId]);
        expect(nextCore.players['0'].mana).toBe(state.core.players['0'].mana - 6);
    });

    it('requires Dissolve to target mage-attached equipment and pay that equipment cost', () => {
        const dissolveSpellId = 3605;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([dissolveSpellId]));
        const validEquipment = makeArenaObject('equipment-in-range', '1', ARENA_ZONE_IDS.A2, {
            kind: 'equipment',
            sourceSpellCardId: 3703,
            sourceObjectId: 'spell-card-3703',
            name: '龙鳞锁甲',
            life: 1,
            actionReady: false,
            typeLine: '装备 / 胸甲',
            anchoredToPlayerId: '1',
        });
        const unattachedEquipment = makeArenaObject('unattached-equipment', '1', ARENA_ZONE_IDS.A2, {
            kind: 'equipment',
            sourceSpellCardId: 3703,
            sourceObjectId: 'spell-card-3703',
            name: '未附属龙鳞锁甲',
            life: 1,
            actionReady: false,
            typeLine: '装备 / 胸甲',
        });
        const creature = makeArenaObject('not-equipment', '1', ARENA_ZONE_IDS.A2);
        const outOfRangeEquipment = makeArenaObject('equipment-out-of-range', '1', PLAYER_ONE_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: 3703,
            sourceObjectId: 'spell-card-3703',
            name: '远处龙鳞锁甲',
            life: 1,
            actionReady: false,
            typeLine: '装备 / 胸甲',
            anchoredToPlayerId: '1',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(
                        withArenaObject(withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2), validEquipment),
                        unattachedEquipment,
                    ),
                    creature,
                ),
                outOfRangeEquipment,
            ),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dissolveSpellId,
                manaCost: 5,
                targetObjectId: validEquipment.id,
            },
        })).toBe('manaCostMismatch');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dissolveSpellId,
                manaCost: 6,
                targetObjectId: unattachedEquipment.id,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dissolveSpellId,
                manaCost: 6,
                targetObjectId: creature.id,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand({
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': {
                        ...state.core.players['0'],
                        mana: 5,
                    },
                },
            },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dissolveSpellId,
                manaCost: 6,
                targetObjectId: validEquipment.id,
            },
        })).toBe('insufficientMana');

        expect(validateCommand({
            ...state,
            core: withPlayerInZone(state.core, '1', PLAYER_ONE_START_ZONE),
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dissolveSpellId,
                manaCost: 6,
                targetObjectId: outOfRangeEquipment.id,
            },
        })).toBe('targetOutOfRange');
    });

    it('casts Dispel to destroy a visible enchantment attached to a creature', () => {
        const dispelSpellId = 3606;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([dispelSpellId]));
        const enchantedCreature = makeArenaObject('enchanted-cat-1', '1', ARENA_ZONE_IDS.A2);
        const visibleEnchantment = makeVisibleEnchantmentObject('visible-enchantment-1800', '1', ARENA_ZONE_IDS.A2, {
            anchoredToObjectId: enchantedCreature.id,
        });
        const coreWithEnemyInRange = withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2);
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(coreWithEnemyInRange, enchantedCreature), visibleEnchantment),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const dispelled = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dispelSpellId,
                manaCost: 5,
                targetObjectId: visibleEnchantment.id,
            },
        });

        expect(dispelled.success).toBe(true);
        expect(dispelled.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    spellCardId: dispelSpellId,
                    manaCost: 5,
                    targetObjectId: visibleEnchantment.id,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: visibleEnchantment.id,
                    ownerId: '1',
                    sourceAbilityId: 'mw.spell.3606',
                    spellCardId: dispelSpellId,
                }),
            }),
        ]));
        expect(dispelled.state.core.objects[visibleEnchantment.id]).toBeUndefined();
        expect(dispelled.state.core.objects[enchantedCreature.id]).toBeDefined();
        expect(dispelled.state.core.players['0'].discardSpellCardIds).toEqual([dispelSpellId]);
        expect(dispelled.state.core.players['0'].mana).toBe(state.core.players['0'].mana - 5);
    });

    it('executes alternate Dispel 3419 with the same visible-enchantment destruction rule', () => {
        const dispelSpellId = 3419;
        const planningState = setupState('planning');
        expect(validateCommand(planningState, planCommand([dispelSpellId]))).toBe('spellNotInPresetSpellbook');

        const enchantedCreature = makeArenaObject('enchanted-cat-alt-1', '1', ARENA_ZONE_IDS.A2);
        const visibleEnchantment = makeVisibleEnchantmentObject('visible-enchantment-alt-1800', '1', ARENA_ZONE_IDS.A2, {
            anchoredToObjectId: enchantedCreature.id,
        });
        const coreWithEnemyInRange = withPlayerInZone(planningState.core, '1', ARENA_ZONE_IDS.A2);
        const state: MatchState<MageWarsCore> = {
            core: {
                ...withArenaObject(withArenaObject(coreWithEnemyInRange, enchantedCreature), visibleEnchantment),
                players: {
                    ...coreWithEnemyInRange.players,
                    '0': {
                        ...coreWithEnemyInRange.players['0'],
                        preparedSpellCardIds: [dispelSpellId],
                        preparedSpellSlots: 1,
                    },
                },
            },
            sys: { ...planningState.sys, phase: 'initiativeQuickcast' },
        };

        const events = MageWarsDomain.execute(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dispelSpellId,
                manaCost: 5,
                targetObjectId: visibleEnchantment.id,
            },
        }, fixedRandom);
        const nextCore = events.reduce((core, event) => MageWarsDomain.reduce(core, event), state.core);

        expect(events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    spellCardId: dispelSpellId,
                    manaCost: 5,
                    targetObjectId: visibleEnchantment.id,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: visibleEnchantment.id,
                    ownerId: '1',
                    sourceAbilityId: 'mw.spell.3419',
                    spellCardId: dispelSpellId,
                }),
            }),
        ]));
        expect(nextCore.objects[visibleEnchantment.id]).toBeUndefined();
        expect(nextCore.objects[enchantedCreature.id]).toBeDefined();
        expect(nextCore.players['0'].discardSpellCardIds).toEqual([dispelSpellId]);
        expect(nextCore.players['0'].mana).toBe(state.core.players['0'].mana - 5);
    });

    it('requires Dispel to target an attached visible enchantment and pay that enchantment total cost', () => {
        const dispelSpellId = 3606;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([dispelSpellId]));
        const enchantedCreature = makeArenaObject('dispel-enchanted-cat-1', '1', ARENA_ZONE_IDS.A2);
        const validEnchantment = makeVisibleEnchantmentObject('dispel-visible-enchantment', '1', ARENA_ZONE_IDS.A2, {
            anchoredToObjectId: enchantedCreature.id,
        });
        const hiddenEnchantment = makeVisibleEnchantmentObject('dispel-hidden-enchantment', '1', ARENA_ZONE_IDS.A2, {
            anchoredToObjectId: enchantedCreature.id,
            revealed: false,
        });
        const unattachedEnchantment = makeVisibleEnchantmentObject('dispel-unattached-enchantment', '1', ARENA_ZONE_IDS.A2);
        const equipment = makeArenaObject('dispel-not-enchantment', '1', ARENA_ZONE_IDS.A2, {
            kind: 'equipment',
            sourceSpellCardId: 3703,
            sourceObjectId: 'spell-card-3703',
            name: '龙鳞锁甲',
            life: 1,
            actionReady: false,
            typeLine: '装备 / 胸甲',
            anchoredToPlayerId: '1',
        });
        const farCreature = makeArenaObject('dispel-far-cat-1', '1', PLAYER_ONE_START_ZONE);
        const outOfRangeEnchantment = makeVisibleEnchantmentObject('dispel-far-enchantment', '1', PLAYER_ONE_START_ZONE, {
            anchoredToObjectId: farCreature.id,
        });
        const coreWithObjects = withArenaObject(
            withArenaObject(
                withArenaObject(
                    withArenaObject(
                        withArenaObject(
                            withArenaObject(
                                withArenaObject(withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2), enchantedCreature),
                                validEnchantment,
                            ),
                            hiddenEnchantment,
                        ),
                        unattachedEnchantment,
                    ),
                    equipment,
                ),
                farCreature,
            ),
            outOfRangeEnchantment,
        );
        const state: MatchState<MageWarsCore> = {
            core: {
                ...coreWithObjects,
                players: {
                    ...coreWithObjects.players,
                    '0': {
                        ...coreWithObjects.players['0'],
                        mana: 20,
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dispelSpellId,
                manaCost: 4,
                targetObjectId: validEnchantment.id,
            },
        })).toBe('manaCostMismatch');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dispelSpellId,
                manaCost: 5,
                targetObjectId: hiddenEnchantment.id,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dispelSpellId,
                manaCost: 5,
                targetObjectId: equipment.id,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dispelSpellId,
                manaCost: 5,
                targetObjectId: unattachedEnchantment.id,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand({
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': {
                        ...state.core.players['0'],
                        mana: 4,
                    },
                },
            },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dispelSpellId,
                manaCost: 5,
                targetObjectId: validEnchantment.id,
            },
        })).toBe('insufficientMana');

        expect(validateCommand({
            ...state,
            core: withPlayerInZone(state.core, '1', PLAYER_ONE_START_ZONE),
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: dispelSpellId,
                manaCost: 5,
                targetObjectId: outOfRangeEnchantment.id,
            },
        })).toBe('targetOutOfRange');
    });

    it('casts Steal Enchantment to move a visible enchantment to a new legal target under caster control', () => {
        const stealEnchantmentSpellId = 3409;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([stealEnchantmentSpellId]));
        const friendlyCreature = makeArenaObject('steal-new-friendly-cat', '0', PLAYER_ZERO_START_ZONE);
        const enchantedCreature = makeArenaObject('steal-enchanted-enemy-cat', '1', ARENA_ZONE_IDS.A2);
        const visibleEnchantment = makeVisibleEnchantmentObject('stolen-visible-enchantment-1800', '1', ARENA_ZONE_IDS.A2, {
            anchoredToObjectId: enchantedCreature.id,
        });
        const coreWithObjects = [friendlyCreature, enchantedCreature, visibleEnchantment].reduce(
            (core, object) => withArenaObject(core, object),
            withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2),
        );
        const state: MatchState<MageWarsCore> = {
            core: coreWithObjects,
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        };

        const stolen = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: stealEnchantmentSpellId,
                manaCost: 10,
                targetObjectId: visibleEnchantment.id,
                newTargetObjectId: friendlyCreature.id,
            },
        });

        const movedEnchantment = stolen.state.core.objects[visibleEnchantment.id];

        expect(stolen.success).toBe(true);
        expect(stolen.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    spellCardId: stealEnchantmentSpellId,
                    manaCost: 10,
                    targetObjectId: visibleEnchantment.id,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ENCHANTMENT_STOLEN,
                payload: expect.objectContaining({
                    objectId: visibleEnchantment.id,
                    previousOwnerId: '1',
                    ownerId: '0',
                    fromZoneId: ARENA_ZONE_IDS.A2,
                    toZoneId: PLAYER_ZERO_START_ZONE,
                    targetObjectId: friendlyCreature.id,
                    sourceAbilityId: 'mw.spell.3409',
                    spellCardId: stealEnchantmentSpellId,
                }),
            }),
        ]));
        expect(movedEnchantment).toMatchObject({
            ownerId: '0',
            anchoredToObjectId: friendlyCreature.id,
            zoneId: PLAYER_ZERO_START_ZONE,
        });
        expect(movedEnchantment.anchoredToPlayerId).toBeUndefined();
        expect(movedEnchantment.anchoredToZoneId).toBeUndefined();
        expect(stolen.state.core.arena.find((zone) => zone.id === ARENA_ZONE_IDS.A2)?.objectIds)
            .not.toContain(visibleEnchantment.id);
        expect(stolen.state.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)?.objectIds)
            .toContain(visibleEnchantment.id);
        expect(stolen.state.core.players['0'].discardSpellCardIds).toEqual([stealEnchantmentSpellId]);
        expect(stolen.state.core.players['0'].mana).toBe(state.core.players['0'].mana - 10);
    });

    it('requires Steal Enchantment to target a visible attached enchantment, a new legal target, and the doubled enchantment total cost', () => {
        const stealEnchantmentSpellId = 3409;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([stealEnchantmentSpellId]));
        const friendlyCreature = makeArenaObject('steal-validation-friendly-cat', '0', PLAYER_ZERO_START_ZONE);
        const enchantedCreature = makeArenaObject('steal-validation-enchanted-cat', '1', ARENA_ZONE_IDS.A2);
        const validEnchantment = makeVisibleEnchantmentObject('steal-visible-enchantment', '1', ARENA_ZONE_IDS.A2, {
            anchoredToObjectId: enchantedCreature.id,
        });
        const hiddenEnchantment = makeVisibleEnchantmentObject('steal-hidden-enchantment', '1', ARENA_ZONE_IDS.A2, {
            anchoredToObjectId: enchantedCreature.id,
            revealed: false,
        });
        const unattachedEnchantment = makeVisibleEnchantmentObject('steal-unattached-enchantment', '1', ARENA_ZONE_IDS.A2);
        const equipment = makeArenaObject('steal-not-enchantment', '1', ARENA_ZONE_IDS.A2, {
            kind: 'equipment',
            sourceSpellCardId: 3703,
            sourceObjectId: 'spell-card-3703',
            name: '龙鳞锁甲',
            life: 1,
            actionReady: false,
            typeLine: '装备 / 胸甲',
            anchoredToPlayerId: '1',
        });
        const farCreature = makeArenaObject('steal-far-cat', '1', PLAYER_ONE_START_ZONE);
        const outOfRangeEnchantment = makeVisibleEnchantmentObject('steal-far-enchantment', '1', PLAYER_ONE_START_ZONE, {
            anchoredToObjectId: farCreature.id,
        });
        const coreWithObjects = [
            friendlyCreature,
            enchantedCreature,
            validEnchantment,
            hiddenEnchantment,
            unattachedEnchantment,
            equipment,
            farCreature,
            outOfRangeEnchantment,
        ].reduce(
            (core, object) => withArenaObject(core, object),
            withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2),
        );
        const state: MatchState<MageWarsCore> = {
            core: {
                ...coreWithObjects,
                players: {
                    ...coreWithObjects.players,
                    '0': {
                        ...coreWithObjects.players['0'],
                        mana: 20,
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: stealEnchantmentSpellId,
                manaCost: 10,
                targetObjectId: validEnchantment.id,
            },
        })).toBe('missingNewTarget');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: stealEnchantmentSpellId,
                manaCost: 10,
                targetObjectId: validEnchantment.id,
                newTargetObjectId: friendlyCreature.id,
                newTargetPlayerId: '0',
            },
        })).toBe('invalidTargetMode');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: stealEnchantmentSpellId,
                manaCost: 9,
                targetObjectId: validEnchantment.id,
                newTargetObjectId: friendlyCreature.id,
            },
        })).toBe('manaCostMismatch');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: stealEnchantmentSpellId,
                manaCost: 10,
                targetObjectId: hiddenEnchantment.id,
                newTargetObjectId: friendlyCreature.id,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: stealEnchantmentSpellId,
                manaCost: 10,
                targetObjectId: equipment.id,
                newTargetObjectId: friendlyCreature.id,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: stealEnchantmentSpellId,
                manaCost: 10,
                targetObjectId: unattachedEnchantment.id,
                newTargetObjectId: friendlyCreature.id,
            },
        })).toBe('invalidTargetObject');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: stealEnchantmentSpellId,
                manaCost: 10,
                targetObjectId: validEnchantment.id,
                newTargetObjectId: equipment.id,
            },
        })).toBe('invalidNewTarget');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: stealEnchantmentSpellId,
                manaCost: 10,
                targetObjectId: validEnchantment.id,
                newTargetObjectId: enchantedCreature.id,
            },
        })).toBe('sameEnchantmentTarget');

        expect(validateCommand({
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': {
                        ...state.core.players['0'],
                        mana: 9,
                    },
                },
            },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: stealEnchantmentSpellId,
                manaCost: 10,
                targetObjectId: validEnchantment.id,
                newTargetObjectId: friendlyCreature.id,
            },
        })).toBe('insufficientMana');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: stealEnchantmentSpellId,
                manaCost: 10,
                targetObjectId: outOfRangeEnchantment.id,
                newTargetObjectId: friendlyCreature.id,
            },
        })).toBe('targetOutOfRange');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: stealEnchantmentSpellId,
                manaCost: 10,
                targetObjectId: validEnchantment.id,
                newTargetObjectId: farCreature.id,
            },
        })).toBe('newTargetOutOfRange');
    });

    it('casts visible object enchantments as attached revealed objects and applies their continuous traits', () => {
        const bearStrengthId = 1914;
        const regrowthId = 1916;
        const rhinoHideId = 1917;
        const bullEnduranceId = 1808;
        const enfeebleId = 1816;

        const buffedCat = makeArenaObject('bear-strength-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const meleeTarget = makeArenaObject('bear-strength-target-1', '1', PLAYER_ZERO_START_ZONE, { life: 30 });
        const bearState: MatchState<MageWarsCore> = {
            core: [buffedCat, meleeTarget].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [bearStrengthId]),
            ),
            sys: setupState('creatureAction').sys,
        };
        const bearCast = runCommand(bearState, castObjectSpellCommand(bearStrengthId, 5, buffedCat.id));
        const bearEnchantment = Object.values(bearCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === bearStrengthId);

        expect(bearCast.success).toBe(true);
        expect(bearEnchantment).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToObjectId: buffedCat.id,
            zoneId: PLAYER_ZERO_START_ZONE,
        });
        const bearCoreWithEditedEnchantmentText = withArenaObjectDisplayText(
            bearCast.state.core,
            bearEnchantment!.id,
            '展示文案改写后不包含任何近战加成。',
        );

        const bearAttack = runCommand({
            core: bearCoreWithEditedEnchantmentText,
            sys: { ...bearCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: buffedCat.id,
                attackProfileId: 'attack-0',
                targetObjectId: meleeTarget.id,
            },
        });
        const bearAttackEvent = bearAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));
        expect(bearAttack.success).toBe(true);
        expect(bearAttackEvent?.payload).toMatchObject({
            meleeDiceModifier: 2,
            diceResults: [3, 3, 3, 3],
        });

        const woundedCat = makeArenaObject('regrowth-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            damage: 3,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const regrowthState: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [regrowthId]),
                woundedCat,
            ),
            sys: setupState('creatureAction').sys,
        };
        const regrowthCast = runCommand(regrowthState, castObjectSpellCommand(regrowthId, 5, woundedCat.id));
        const regrowthEnchantment = Object.values(regrowthCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === regrowthId);
        const regrowthCoreWithEditedEnchantmentText = withArenaObjectDisplayText(
            regrowthCast.state.core,
            regrowthEnchantment!.id,
            '展示文案改写后不包含任何重生特性。',
        );
        const upkeep = runCommand({
            core: regrowthCoreWithEditedEnchantmentText,
            sys: { ...regrowthCast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const regenerationEvent = upkeep.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_REGENERATED
            && event.payload.objectId === woundedCat.id
        ));
        expect(regrowthCast.success).toBe(true);
        expect(regrowthEnchantment).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToObjectId: woundedCat.id,
        });
        expect(regenerationEvent?.payload).toMatchObject({
            regeneration: 2,
            actualHealing: 2,
        });
        expect(regenerationEvent?.payload.sourceObjectIds).toEqual(expect.arrayContaining([regrowthEnchantment?.id]));
        expect(upkeep.state.core.objects[woundedCat.id].damage).toBe(1);

        const armoredTarget = makeArenaObject('rhino-hide-target-1', '1', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '拳击：快速近战 2 骰',
            armor: 0,
            life: 20,
        });
        const armorAttacker = makeArenaObject('rhino-hide-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const rhinoState: MatchState<MageWarsCore> = {
            core: [armoredTarget, armorAttacker].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [rhinoHideId]),
            ),
            sys: setupState('creatureAction').sys,
        };
        const rhinoCast = runCommand(rhinoState, castObjectSpellCommand(rhinoHideId, 4, armoredTarget.id));
        const rhinoEnchantment = Object.values(rhinoCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === rhinoHideId);
        const rhinoCoreWithEditedEnchantmentText = withArenaObjectDisplayText(
            rhinoCast.state.core,
            rhinoEnchantment!.id,
            '展示文案改写后不包含任何护甲加成。',
        );
        const armoredAttack = runCommand({
            core: rhinoCoreWithEditedEnchantmentText,
            sys: { ...rhinoCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: armorAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: armoredTarget.id,
            },
        });
        const armoredDamageEvent = armoredAttack.events.find((event) => event.type === 'DAMAGE_DEALT');
        expect(rhinoCast.success).toBe(true);
        expect(armoredDamageEvent?.payload).toMatchObject({
            targetId: armoredTarget.id,
            actualDamage: 4,
        });
        expect(armoredAttack.state.core.objects[armoredTarget.id].damage).toBe(4);

        const enduranceTarget = makeArenaObject('bull-endurance-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 4,
            damage: 1,
            attackOrTraitLine: '拳击：快速近战 2 骰',
        });
        const enduranceAttacker = makeArenaObject('bull-endurance-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const enduranceState: MatchState<MageWarsCore> = {
            core: [enduranceTarget, enduranceAttacker].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.PRIESTESS_APPRENTICE, [bullEnduranceId]),
            ),
            sys: setupState('creatureAction').sys,
        };
        const enduranceCast = runCommand(enduranceState, castObjectSpellCommand(bullEnduranceId, 5, enduranceTarget.id));
        const enduranceEnchantment = Object.values(enduranceCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === bullEnduranceId);
        const enduranceCoreWithEditedEnchantmentText = withArenaObjectDisplayText(
            enduranceCast.state.core,
            enduranceEnchantment!.id,
            '展示文案改写后不包含任何生命加成。',
        );
        const enduranceAttack = runCommand({
            core: enduranceCoreWithEditedEnchantmentText,
            sys: { ...enduranceCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: enduranceAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: enduranceTarget.id,
            },
        });
        expect(enduranceCast.success).toBe(true);
        expect(enduranceAttack.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(enduranceAttack.state.core.objects[enduranceTarget.id].damage).toBe(7);

        const swiftTarget = makeArenaObject('enfeebled-swift-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰；迅捷',
        });
        const enfeebleState: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [enfeebleId]),
                swiftTarget,
            ),
            sys: setupState('creatureAction').sys,
        };
        const enfeebleCast = runCommand(enfeebleState, castObjectSpellCommand(enfeebleId, 6, swiftTarget.id));
        const enfeebleEnchantment = Object.values(enfeebleCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === enfeebleId);
        const enfeebleCoreWithEditedEnchantmentText = withArenaObjectDisplayText(
            enfeebleCast.state.core,
            enfeebleEnchantment!.id,
            '展示文案改写后不包含任何迟缓特性。',
        );
        const slowedMove = runCommand({
            core: enfeebleCoreWithEditedEnchantmentText,
            sys: { ...enfeebleCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: swiftTarget.id, toZoneId: ARENA_ZONE_IDS.A2 },
        });
        const slowedMoveEvent = slowedMove.events.find((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED);
        expect(enfeebleCast.success).toBe(true);
        expect(slowedMoveEvent?.payload).not.toMatchObject({ actionCost: 'none' });
        expect(slowedMove.state.core.objects[swiftTarget.id]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A2,
            actionReady: false,
        });
    });

    it('uses structured death mark for each creature first attack per round', () => {
        const deathMarkSpellId = 1826;
        const target = makeArenaObject('death-mark-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 50,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const firstAttacker = makeArenaObject('death-mark-attacker-a-0', '0', PLAYER_ZERO_START_ZONE);
        const secondAttacker = makeArenaObject('death-mark-attacker-b-0', '0', PLAYER_ZERO_START_ZONE);
        const baseCore = withPreparedPlayerMage(
            setupState('creatureAction').core,
            '0',
            MAGE_IDS.WARLOCK_APPRENTICE,
            [deathMarkSpellId],
        );
        const state: MatchState<MageWarsCore> = {
            core: [target, firstAttacker, secondAttacker].reduce(
                (core, object) => withArenaObject(core, object),
                baseCore,
            ),
            sys: setupState('creatureAction').sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(deathMarkSpellId, 4, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === deathMarkSpellId);
        const coreWithoutDisplayText = withArenaObjectDisplayText(
            cast.state.core,
            enchantment!.id,
            '展示文案改写后不包含任何首攻加骰。',
        );

        const firstAttack = runCommand({
            core: coreWithoutDisplayText,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: firstAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const firstAttackEvent = firstAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        const secondAttack = runCommand({
            core: firstAttack.state.core,
            sys: { ...firstAttack.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: secondAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const secondAttackEvent = secondAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        const repeatAttackCore = withArenaObject(secondAttack.state.core, {
            ...secondAttack.state.core.objects[firstAttacker.id],
            actionReady: true,
        });
        const repeatAttack = runCommand({
            core: repeatAttackCore,
            sys: { ...secondAttack.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: firstAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const repeatAttackEvent = repeatAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(cast.success).toBe(true);
        expect(firstAttack.success).toBe(true);
        expect(secondAttack.success).toBe(true);
        expect(repeatAttack.success).toBe(true);
        expect(firstAttackEvent).toMatchObject({
            payload: {
                diceResults: [3, 3, 3],
                deathMarkDiceModifier: 1,
                deathMarkSourceObjectIds: [enchantment!.id],
            },
        });
        expect(secondAttackEvent).toMatchObject({
            payload: {
                diceResults: [3, 3, 3],
                deathMarkDiceModifier: 1,
            },
        });
        expect(repeatAttackEvent?.payload.diceResults).toEqual([3, 3]);
        expect(repeatAttackEvent?.payload).not.toHaveProperty('deathMarkDiceModifier');
        expect(repeatAttack.state.core.objects[enchantment!.id]).toMatchObject({
            deathMarkRoundNumber: repeatAttack.state.core.turnNumber,
            deathMarkAttackerObjectIdsThisRound: [firstAttacker.id, secondAttacker.id],
        });

        const multiStrikeTarget = makeArenaObject('death-mark-multi-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 100,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const multiStrikeAttacker = makeArenaObject('death-mark-multi-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '猛力噬咬：快速近战 4 骰，反击；三重噬咬：完整行动近战 3 骰，三连击；重生2；迟缓',
        });
        const multiStrikeState: MatchState<MageWarsCore> = {
            core: [multiStrikeTarget, multiStrikeAttacker].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(
                    setupState('creatureAction').core,
                    '0',
                    MAGE_IDS.WARLOCK_APPRENTICE,
                    [deathMarkSpellId],
                ),
            ),
            sys: setupState('creatureAction').sys,
        };
        const multiStrikeCast = runCommand(
            multiStrikeState,
            castObjectSpellCommand(deathMarkSpellId, 4, multiStrikeTarget.id),
        );
        const multiStrikeEnchantment = Object.values(multiStrikeCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === deathMarkSpellId);
        const multiStrikeAttack = runCommand({
            core: multiStrikeCast.state.core,
            sys: { ...multiStrikeCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: multiStrikeAttacker.id,
                attackProfileId: 'attack-1',
                targetObjectId: multiStrikeTarget.id,
            },
        });
        const multiStrikeAttackEvents = multiStrikeAttack.events.filter((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(multiStrikeCast.success).toBe(true);
        expect(multiStrikeAttack.success).toBe(true);
        expect(multiStrikeAttackEvents).toHaveLength(3);
        expect(multiStrikeAttackEvents).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    diceResults: [3, 3, 3, 3],
                    strikeIndex: 0,
                    strikeCount: 3,
                    deathMarkDiceModifier: 1,
                    deathMarkSourceObjectIds: [multiStrikeEnchantment!.id],
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    diceResults: [3, 3, 3, 3],
                    strikeIndex: 1,
                    strikeCount: 3,
                    deathMarkDiceModifier: 1,
                    deathMarkSourceObjectIds: [multiStrikeEnchantment!.id],
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    diceResults: [3, 3, 3, 3],
                    strikeIndex: 2,
                    strikeCount: 3,
                    deathMarkDiceModifier: 1,
                    deathMarkSourceObjectIds: [multiStrikeEnchantment!.id],
                }),
            }),
        ]);
        expect(multiStrikeAttack.state.core.objects[multiStrikeEnchantment!.id]).toMatchObject({
            deathMarkRoundNumber: multiStrikeAttack.state.core.turnNumber,
            deathMarkAttackerObjectIdsThisRound: [multiStrikeAttacker.id],
        });
    });

    it('resolves structured toxic upkeep damage and stops after the enchantment is removed', () => {
        const toxicUpkeepSpellId = 1820;
        const dispelSpellId = 3606;
        const target = makeArenaObject('toxic-upkeep-target-1', '1', ARENA_ZONE_IDS.A2, {
            life: 20,
            damage: 3,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [toxicUpkeepSpellId]),
                target,
            ),
            sys: setupState('creatureAction').sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(toxicUpkeepSpellId, 6, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === toxicUpkeepSpellId);
        const coreWithoutDisplayText = withArenaObjectDisplayText(
            cast.state.core,
            enchantment!.id,
            '展示文案改写后不包含任何维持伤害。',
        );
        const upkeep = runCommand({
            core: coreWithoutDisplayText,
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const damageEvent = upkeep.events.find((event) => (
            event.type === 'DAMAGE_DEALT'
            && event.payload.targetId === target.id
            && event.payload.sourceAbilityId === 'mw.spell.1820.upkeep'
        ));

        expect(cast.success).toBe(true);
        expect(enchantment).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToObjectId: target.id,
        });
        expect(damageEvent?.payload).toMatchObject({
            amount: 2,
            actualDamage: 2,
        });
        expect(upkeep.state.core.objects[target.id].damage).toBe(5);

        const dispelCore = withPreparedPlayerMage(
            coreWithoutDisplayText,
            '0',
            MAGE_IDS.WARLOCK_APPRENTICE,
            [dispelSpellId],
        );
        const dispelled = runCommand({
            core: dispelCore,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, castObjectSpellCommand(dispelSpellId, 6, enchantment!.id));
        const laterUpkeep = runCommand({
            core: dispelled.state.core,
            sys: { ...dispelled.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(dispelled.success).toBe(true);
        expect(dispelled.state.core.objects[enchantment!.id]).toBeUndefined();
        expect(laterUpkeep.events).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    sourceAbilityId: 'mw.spell.1820.upkeep',
                }),
            }),
        ]));
    });

    it('offers Essence Drain upkeep payment to the creature controller and preserves the source when paid', () => {
        const essenceDrainSpellId = 1815;
        const target = makeArenaObject('essence-drain-target-1', '1', ARENA_ZONE_IDS.A2, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WIZARD_APPRENTICE, [essenceDrainSpellId]),
                target,
            ),
            sys: setupState('creatureAction').sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(essenceDrainSpellId, 6, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === essenceDrainSpellId);
        const upkeep = runCommand({
            core: withArenaObjectDisplayText(cast.state.core, enchantment!.id, '展示文案已移除。'),
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const interaction = upkeep.state.sys.interaction.current;
        const paid = runCommand(upkeep.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: interaction?.id,
                optionId: 'pay',
            },
        } as Command);

        expect(cast.success).toBe(true);
        expect(upkeep.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.UPKEEP_COST_AVAILABLE);
        expect(interaction).toMatchObject({
            playerId: '1',
            data: {
                sourceId: 'mw.upkeep-cost.choice',
                options: expect.arrayContaining([
                    expect.objectContaining({ id: 'pay' }),
                    expect.objectContaining({ id: 'destroy' }),
                ]),
            },
        });
        expect(interaction?.data.ai).toMatchObject({ status: 'semantic' });
        const aiActions = buildAiLegalActionsFromInteractionDecision(
            interaction!.data.ai!.decisions![0] as AiDecisionDescriptor,
        );
        expect(aiActions.map((action) => (action.commands[0]?.payload as { optionId?: string }).optionId))
            .toEqual(expect.arrayContaining(['pay', 'destroy']));
        expect(paid.success).toBe(true);
        expect(paid.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MANA_SPENT,
                payload: expect.objectContaining({
                    playerId: '1',
                    amount: 2,
                    spellCardId: essenceDrainSpellId,
                    targetObjectId: target.id,
                }),
            }),
        ]));
        expect(paid.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.MANA_DRAINED);
        expect(paid.state.core.players['1'].mana).toBe(8);
        expect(paid.state.core.objects[enchantment!.id]).toBeDefined();
    });

    it('forces Essence Drain destruction when the creature controller cannot pay', () => {
        const essenceDrainSpellId = 1815;
        const target = makeArenaObject('essence-drain-insufficient-target-1', '1', ARENA_ZONE_IDS.A2, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const base = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage({
                    ...base.core,
                    players: {
                        ...base.core.players,
                        '1': { ...base.core.players['1'], mana: 1 },
                    },
                }, '0', MAGE_IDS.WIZARD_APPRENTICE, [essenceDrainSpellId]),
                target,
            ),
            sys: base.sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(essenceDrainSpellId, 6, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === essenceDrainSpellId);
        const upkeep = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(upkeep.success).toBe(true);
        expect(upkeep.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.UPKEEP_COST_AVAILABLE);
        expect(upkeep.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(upkeep.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(upkeep.state.core.players['1'].mana).toBe(1);
        expect(upkeep.state.core.objects[enchantment!.id]).toBeUndefined();
    });

    it('ignores a stale Essence Drain upkeep response after the source was removed', () => {
        const essenceDrainSpellId = 1815;
        const target = makeArenaObject('essence-drain-stale-target-1', '1', ARENA_ZONE_IDS.A2, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const base = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.WIZARD_APPRENTICE, [essenceDrainSpellId]),
                target,
            ),
            sys: base.sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(essenceDrainSpellId, 6, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === essenceDrainSpellId);
        const upkeep = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const staleState: MatchState<MageWarsCore> = {
            ...upkeep.state,
            core: {
                ...upkeep.state.core,
                objects: Object.fromEntries(
                    Object.entries(upkeep.state.core.objects)
                        .filter(([objectId]) => objectId !== enchantment!.id),
                ),
            },
        };
        const responded = runCommand(staleState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: upkeep.state.sys.interaction.current?.id,
                optionId: 'pay',
            },
        } as Command);

        expect(responded.success).toBe(true);
        expect(responded.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(responded.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(responded.state.core.players['1'].mana).toBe(10);
    });

    it('does not resolve structured toxic upkeep damage against toxin-immune creatures', () => {
        const toxicUpkeepSpellId = 1820;
        const target = makeArenaObject('toxic-upkeep-immune-target-1', '1', ARENA_ZONE_IDS.A2, {
            typeLine: '生物；活体；毒素免疫',
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [toxicUpkeepSpellId]),
                target,
            ),
            sys: setupState('creatureAction').sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(toxicUpkeepSpellId, 6, target.id));
        const upkeep = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(cast.success).toBe(true);
        expect(upkeep.events).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({ targetId: target.id }),
            }),
        ]));
        expect(upkeep.state.core.objects[target.id].damage).toBe(0);
    });

    it('casts Force Grip from structured semantics and clears restraint when dispelled', () => {
        const forceGripSpellId = 1908;
        const forcePushSpellId = 3425;
        const teleportSpellId = 3410;
        const dispelSpellId = 3606;
        const base = setupState('creatureAction');
        const target = makeArenaObject('force-grip-target-1', '1', ARENA_ZONE_IDS.A2, {
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const uncontainableTarget = makeArenaObject('force-grip-uncontainable-1', '1', ARENA_ZONE_IDS.A2, {
            attackOrTraitLine: '利爪：快速近战 2 骰；不羁',
        });
        const preparedCore = withPreparedPlayerMage(
            withArenaObject(withArenaObject(base.core, target), uncontainableTarget),
            '0',
            MAGE_IDS.WIZARD_APPRENTICE,
            [forceGripSpellId],
        );
        const state: MatchState<MageWarsCore> = { core: preparedCore, sys: base.sys };

        expect(validateCommand(state, castObjectSpellCommand(forceGripSpellId, 4, uncontainableTarget.id)))
            .toBe('invalidTargetObject');
        const cast = runCommand(state, castObjectSpellCommand(forceGripSpellId, 4, target.id));
        const enchantment = Object.values(cast.state.core.objects).find((object) => (
            object.sourceSpellCardId === forceGripSpellId && object.anchoredToObjectId === target.id
        ));
        const coreWithoutDisplayText = withArenaObjectDisplayText(cast.state.core, enchantment!.id, '');

        expect(cast.success).toBe(true);
        expect(cast.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_RESTRAINED,
                payload: expect.objectContaining({
                    objectId: target.id,
                    restrainedByObjectId: enchantment!.id,
                    spellCardId: forceGripSpellId,
                }),
            }),
        ]));
        expect(coreWithoutDisplayText.objects[enchantment!.id]).toMatchObject({
            attackOrTraitLine: undefined,
            rulesText: '',
        });
        expect(coreWithoutDisplayText.objects[target.id]).toMatchObject({
            restrainedByObjectId: enchantment!.id,
        });

        expect(validateCommand({
            core: {
                ...coreWithoutDisplayText,
                currentPlayerId: '1',
            },
            sys: { ...base.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '1',
            payload: { objectId: target.id, toZoneId: ARENA_ZONE_IDS.A3 },
        })).toBe('objectCrippled');

        const forcePushCore = withPreparedPlayerMage(coreWithoutDisplayText, '0', MAGE_IDS.WARLOCK_APPRENTICE, [forcePushSpellId]);
        expect(validateCommand({
            core: forcePushCore,
            sys: { ...base.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: forcePushSpellId,
                manaCost: 3,
                targetObjectId: target.id,
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
        })).toBe('targetUnmovable');

        const teleportCore = withPreparedPlayerMage(coreWithoutDisplayText, '0', MAGE_IDS.WIZARD_APPRENTICE, [teleportSpellId]);
        expect(validateCommand({
            core: teleportCore,
            sys: { ...base.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: teleportSpellId,
                manaCost: 3,
                targetObjectId: target.id,
                targetZoneId: ARENA_ZONE_IDS.A3,
            },
        })).toBe('targetUnmovable');

        const dispelCore = withPreparedPlayerMage(coreWithoutDisplayText, '0', MAGE_IDS.WIZARD_APPRENTICE, [dispelSpellId]);
        const dispelled = runCommand({
            core: dispelCore,
            sys: { ...base.sys, phase: 'creatureAction' },
        }, castObjectSpellCommand(dispelSpellId, 4, enchantment!.id));

        expect(dispelled.success).toBe(true);
        expect(dispelled.state.core.objects[enchantment!.id]).toBeUndefined();
        expect(dispelled.state.core.objects[target.id]?.restrainedByObjectId).toBeUndefined();
    });

    it('uses a configured attached enchantment defense profile in the defense choice window', () => {
        const reflectionId = 1809;
        const target = makeArenaObject('reflection-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
        });
        const attacker = makeArenaObject('reflection-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const baseState = setupState('creatureAction');
        const preparedCore = withPreparedPlayerMage(
            baseState.core,
            '0',
            MAGE_IDS.BEASTMASTER_APPRENTICE,
            [reflectionId],
        );
        const cast = runCommand({
            core: withArenaObject(preparedCore, target),
            sys: baseState.sys,
        }, castObjectSpellCommand(reflectionId, 7, target.id));
        const attachedReflection = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === reflectionId);
        const coreWithEditedReflectionText = withArenaObjectDisplayText(
            cast.state.core,
            attachedReflection!.id,
            '展示文案改写后不包含防御图标。',
        );

        const attacked = runCommand({
            core: withArenaObject(coreWithEditedReflectionText, attacker),
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });

        expect(cast.success).toBe(true);
        expect(attachedReflection).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToObjectId: target.id,
            combatProfilesSource: 'config',
        });
        expect(attacked.success).toBe(true);
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);
        expect(attacked.state.sys.interaction.current?.data).toMatchObject({
            sourceId: 'mw.defense.choice',
            options: expect.arrayContaining([
                expect.objectContaining({
                    id: 'defend-defense-0',
                    value: expect.objectContaining({
                        defenseProfileId: 'defense-0',
                    }),
                }),
            ]),
        });
    });

    it('forces configured Block to evade and consume itself without a defense roll', () => {
        const blockId = 1806;
        const target = makeArenaObject('block-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
        });
        const attacker = makeArenaObject('block-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const baseState = setupState('creatureAction');
        const cast = runCommand({
            core: withArenaObject(
                withPreparedPlayerMage(baseState.core, '0', MAGE_IDS.WIZARD_APPRENTICE, [blockId]),
                target,
            ),
            sys: baseState.sys,
        }, castObjectSpellCommand(blockId, 4, target.id));
        const attachedBlock = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === blockId);
        const coreWithEditedBlockText = withArenaObjectDisplayText(
            cast.state.core,
            attachedBlock!.id,
            '展示文案改写后不包含自动回避规则。',
        );
        const attacked = runCommand({
            core: withArenaObject(coreWithEditedBlockText, attacker),
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const defenseAvailable = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.DEFENSE_AVAILABLE
        ));
        const defended = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: attacked.state.sys.interaction.current?.id,
                optionId: 'defend-defense-0',
            },
        } as Command);

        expect(cast.success).toBe(true);
        expect(attachedBlock).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToObjectId: target.id,
            combatProfilesSource: 'config',
        });
        expect(attacked.success).toBe(true);
        expect(defenseAvailable).toMatchObject({
            type: MAGE_WARS_EVENTS.DEFENSE_AVAILABLE,
            payload: {
                defenseProfileIds: ['defense-0'],
                requiredDefenseProfileId: 'defense-0',
            },
        });
        expect(attacked.state.sys.interaction.current?.data.options).toEqual([
            expect.objectContaining({ id: 'defend-defense-0' }),
        ]);
        expect(defended.success).toBe(true);
        expect(defended.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ATTACK_MISSED);
        expect(defended.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(defended.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED);
        expect(defended.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);
        expect(defended.state.core.objects[attachedBlock!.id]).toBeUndefined();
        expect(defended.state.core.objects[target.id].damage).toBe(0);
    });

    it('destroys Block against an unavoidable attack and continues the attack', () => {
        const blockId = 1806;
        const target = makeArenaObject('unavoidable-block-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
        });
        const attacker = makeArenaObject('unavoidable-block-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '斩首刃：快速近战 4 骰，无法回避',
        });
        const baseState = setupState('creatureAction');
        const cast = runCommand({
            core: withArenaObject(
                withPreparedPlayerMage(baseState.core, '0', MAGE_IDS.WIZARD_APPRENTICE, [blockId]),
                target,
            ),
            sys: baseState.sys,
        }, castObjectSpellCommand(blockId, 4, target.id));
        const attachedBlock = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === blockId);
        const attacked = runCommand({
            core: withArenaObject(cast.state.core, attacker),
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });

        expect(cast.success).toBe(true);
        expect(attacked.success).toBe(true);
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);
        expect(attacked.state.core.objects[attachedBlock!.id]).toBeUndefined();
        expect(attacked.state.core.objects[target.id].damage).toBe(12);
    });

    it('keeps Force Blade defense available through stun while retaining daze dice penalties', () => {
        const forceBladeId = 1818;
        const target = makeArenaObject('force-blade-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
                [STATUS_TOKEN_IDS.DAZE]: 1,
            },
        });
        const attacker = makeArenaObject('force-blade-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const baseState = setupState('creatureAction');
        const preparedCore = withPreparedPlayerMage(
            baseState.core,
            '0',
            MAGE_IDS.WIZARD_APPRENTICE,
            [forceBladeId],
        );
        const cast = runCommand({
            core: withArenaObject(preparedCore, target),
            sys: baseState.sys,
        }, castObjectSpellCommand(forceBladeId, 5, target.id));
        const attacked = runCommand({
            core: withArenaObject(cast.state.core, attacker),
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const rawNineRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 9 : fixedRandom.d(sides)),
        };
        const defended = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: attacked.state.sys.interaction.current?.id,
                optionId: 'defend-defense-0',
            },
        } as Command, rawNineRandom);
        const defenseRoll = defended.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED
        ));

        expect(cast.success).toBe(true);
        expect(attacked.success).toBe(true);
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(defended.success).toBe(true);
        expect(defenseRoll).toMatchObject({
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED,
            payload: {
                defenderObjectId: target.id,
                defenseProfileId: 'defense-0',
                defenseMinRoll: 8,
                rawEffectDieResult: 9,
                defenseDieModifier: -2,
                modifiedEffectDieResult: 7,
                success: false,
            },
        });
    });

    it('rejects visible object enchantments when the printed target rule is not met', () => {
        const bearStrengthId = 1914;
        const skeleton = makeArenaObject('bear-strength-skeleton-1', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [bearStrengthId]),
                skeleton,
            ),
            sys: setupState('creatureAction').sys,
        };

        expect(validateCommand(state, castObjectSpellCommand(bearStrengthId, 5, skeleton.id)))
            .toBe('invalidTargetObject');
        expect(validateCommand(state, castObjectSpellCommand(bearStrengthId, 4, makeArenaObject('missing', '1', PLAYER_ZERO_START_ZONE).id)))
            .toBe('invalidTargetObject');
    });

    it('casts Leather Gloves as mage-attached passive armor equipment', () => {
        const equipmentSpellId = 3702;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([equipmentSpellId]));
        const state: MatchState<MageWarsCore> = {
            core: withPlayerInZone(planned.state.core, '1', PLAYER_ZERO_START_ZONE),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const equipped = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: equipmentSpellId,
                manaCost: 2,
                targetPlayerId: '0',
            },
        });

        const equipment = Object.values(equipped.state.core.objects)
            .find((object) => object.sourceSpellCardId === equipmentSpellId);

        expect(equipped.success).toBe(true);
        expect(equipped.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    spellCardId: equipmentSpellId,
                    manaCost: 2,
                    targetPlayerId: '0',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
                payload: expect.objectContaining({
                    object: expect.objectContaining({
                        kind: 'equipment',
                        sourceSpellCardId: equipmentSpellId,
                        name: '皮革手套',
                        ownerId: '0',
                        zoneId: PLAYER_ZERO_START_ZONE,
                        anchoredToPlayerId: '0',
                        attackOrTraitLine: '法师获得护甲+1',
                    }),
                }),
            }),
        ]));
        expect(equipment).toMatchObject({
            kind: 'equipment',
            ownerId: '0',
            name: '皮革手套',
            zoneId: PLAYER_ZERO_START_ZONE,
            life: 1,
            armor: 0,
            anchoredToPlayerId: '0',
        });
        expect(equipped.state.core.players['0']).toMatchObject({
            mana: state.core.players['0'].mana - 2,
            quickcastReady: false,
            actionReady: true,
        });
        expect(equipped.state.core.players['0'].preparedSpellCardIds).toEqual([]);
        expect(equipped.state.core.players['0'].discardSpellCardIds).toEqual([equipmentSpellId]);
    });

    it('casts Dragon Scale Hauberk as mage-attached passive armor equipment with fire resistance text', () => {
        const equipmentSpellId = 3703;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([equipmentSpellId]));
        const state: MatchState<MageWarsCore> = {
            core: withPlayerInZone(planned.state.core, '1', PLAYER_ZERO_START_ZONE),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const equipped = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: equipmentSpellId,
                manaCost: 6,
                targetPlayerId: '0',
            },
        });

        const equipment = Object.values(equipped.state.core.objects)
            .find((object) => object.sourceSpellCardId === equipmentSpellId);

        expect(equipped.success).toBe(true);
        expect(equipped.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    spellCardId: equipmentSpellId,
                    manaCost: 6,
                    targetPlayerId: '0',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
                payload: expect.objectContaining({
                    object: expect.objectContaining({
                        kind: 'equipment',
                        sourceSpellCardId: equipmentSpellId,
                        name: '龙鳞锁甲',
                        ownerId: '0',
                        zoneId: PLAYER_ZERO_START_ZONE,
                        anchoredToPlayerId: '0',
                        attackOrTraitLine: '法师获得护甲+2和火焰-2特性',
                    }),
                }),
            }),
        ]));
        expect(equipment).toMatchObject({
            kind: 'equipment',
            ownerId: '0',
            name: '龙鳞锁甲',
            zoneId: PLAYER_ZERO_START_ZONE,
            life: 1,
            armor: 0,
            anchoredToPlayerId: '0',
            attackOrTraitLine: '法师获得护甲+2和火焰-2特性',
        });
        expect(equipped.state.core.players['0']).toMatchObject({
            mana: state.core.players['0'].mana - 6,
            quickcastReady: false,
            actionReady: true,
        });
        expect(equipped.state.core.players['0'].preparedSpellCardIds).toEqual([]);
        expect(equipped.state.core.players['0'].discardSpellCardIds).toEqual([equipmentSpellId]);
    });

    it('keeps mage-attached passive armor equipment with the mage and reduces incoming attack damage', () => {
        const equipmentSpellId = 3702;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([equipmentSpellId]));
        const equipped = runCommand({
            core: withPlayerInZone(planned.state.core, '1', PLAYER_ZERO_START_ZONE),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: equipmentSpellId,
                manaCost: 2,
                targetPlayerId: '0',
            },
        });
        const equipmentId = Object.values(equipped.state.core.objects)
            .find((object) => object.sourceSpellCardId === equipmentSpellId)?.id;
        expect(equipmentId).toBeDefined();

        const moved = runCommand({
            core: equipped.state.core,
            sys: { ...equipped.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_MAGE,
            playerId: '0',
            payload: { toZoneId: ARENA_ZONE_IDS.A2 },
        });

        expect(moved.success).toBe(true);
        expect(moved.state.core.objects[equipmentId!]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A2,
            anchoredToPlayerId: '0',
        });
        expect(moved.state.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)?.objectIds).not.toContain(equipmentId);
        expect(moved.state.core.arena.find((zone) => zone.id === ARENA_ZONE_IDS.A2)?.objectIds).toContain(equipmentId);

        const attackState: MatchState<MageWarsCore> = {
            core: withCurrentPlayer(withPlayerInZone(moved.state.core, '1', ARENA_ZONE_IDS.A2), '1'),
            sys: { ...moved.state.sys, phase: 'creatureAction' },
        };
        const attacked = runCommand(attackState, {
            type: MAGE_WARS_COMMANDS.DECLARE_ATTACK,
            playerId: '1',
            payload: { targetPlayerId: '0' },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerId: '1',
                    defenderId: '0',
                    diceResults: [3, 3, 3],
                    baseDamage: 9,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: '0',
                    actualDamage: 8,
                    sourceAbilityId: 'mage-basic-melee',
                    breakdown: expect.objectContaining({
                        steps: expect.arrayContaining([
                            expect.objectContaining({
                                sourceId: 'mage-wars-mage-equipment-armor',
                                sourceName: '装备护甲',
                                value: -1,
                                runningTotal: 8,
                            }),
                        ]),
                    }),
                }),
            }),
        ]));
        expect(attacked.state.core.players['0'].damage).toBe(8);
    });

    it('applies mage equipment fire resistance to attack spells and then reduces damage with armor', () => {
        const equipmentSpellId = 3703;
        const attackSpellId = 1702;
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 11 : 3),
        };
        const planningState = setupState('planning');
        const wizardPlanned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([equipmentSpellId]));
        const bothPlanned = runCommand({
            core: withCurrentPlayer(
                withPlayerMage(withPlayerInZone(wizardPlanned.state.core, '1', ARENA_ZONE_IDS.A2), '1', MAGE_IDS.WARLOCK_APPRENTICE),
                '1',
            ),
            sys: wizardPlanned.state.sys,
        }, planCommand([attackSpellId], '1'));
        const equipped = runCommand({
            core: {
                ...withCurrentPlayer(bothPlanned.state.core, '0'),
                phaseActorId: '0',
            },
            sys: { ...bothPlanned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: equipmentSpellId,
                manaCost: 6,
                targetPlayerId: '0',
            },
        });

        const attacked = runCommand({
            core: {
                ...withCurrentPlayer(equipped.state.core, '1'),
                phaseActorId: '1',
            },
            sys: { ...equipped.state.sys, phase: 'finalQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '1',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 5,
                targetPlayerId: '0',
            },
        }, statusRandom);

        expect(equipped.success).toBe(true);
        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    spellCardId: attackSpellId,
                    sourceAbilityId: 'mw.spell.1702',
                    targetPlayerId: '0',
                    diceResults: [3, 3],
                    rawEffectDieResult: 11,
                    effectDieResult: 9,
                    baseDamage: 6,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: '0',
                    actualDamage: 4,
                    sourceAbilityId: 'mw.spell.1702',
                    breakdown: expect.objectContaining({
                        steps: expect.arrayContaining([
                            expect.objectContaining({
                                sourceId: 'mage-wars-mage-equipment-armor',
                                sourceName: '装备护甲',
                                value: -2,
                                runningTotal: 4,
                            }),
                        ]),
                    }),
                }),
            }),
        ]));
        expect(attacked.state.core.players['0']).toMatchObject({
            damage: 4,
            statusTokens: {
                [STATUS_TOKEN_IDS.BURN]: 1,
            },
        });
    });

    it('applies Elemental Cloak lightning resistance to arena object attacks against a mage', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('storm-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2801,
            sourceObjectId: 'spell-card-2801',
            name: '风暴攻击者',
            attackOrTraitLine: '电爪：快速近战闪电 3 骰',
        });
        const equipment = makeArenaObject('elemental-cloak-1', '1', PLAYER_ZERO_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: 3709,
            sourceObjectId: 'spell-card-3709',
            name: '元素斗篷',
            life: 1,
            actionReady: false,
            typeLine: '装备 / 斗篷',
            attackOrTraitLine: '法师获得护甲+1、火焰-2、霜冻-2和闪电-2特性',
            anchoredToPlayerId: '1',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withArenaObject(withPlayerInZone(baseState.core, '1', PLAYER_ZERO_START_ZONE), attacker),
                equipment,
            ),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: attacker.id,
                    targetPlayerId: '1',
                    diceResults: [3],
                    baseDamage: 3,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: '1',
                    actualDamage: 2,
                    sourceAbilityId: 'mw.object.2801.attack-0',
                    breakdown: expect.objectContaining({
                        steps: expect.arrayContaining([
                            expect.objectContaining({
                                sourceId: 'mage-wars-mage-equipment-armor',
                                sourceName: '装备护甲',
                                value: -1,
                                runningTotal: 2,
                            }),
                        ]),
                    }),
                }),
            }),
        ]));
        expect(attacked.state.core.players['1'].damage).toBe(2);
    });

    it('casts Arcane Staff as mage-attached weapon equipment and resolves its melee mana drain attack', () => {
        const arcaneStaffId = 3704;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([arcaneStaffId]));
        const castState: MatchState<MageWarsCore> = {
            core: withPlayerInZone(planned.state.core, '1', PLAYER_ZERO_START_ZONE),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const equipped = runCommand(castState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: arcaneStaffId,
                manaCost: 8,
                targetPlayerId: '0',
            },
        });
        const equipment = Object.values(equipped.state.core.objects)
            .find((object) => object.sourceSpellCardId === arcaneStaffId);
        expect(equipment).toBeDefined();
        expect(equipped.success).toBe(true);
        expect(equipment).toMatchObject({
            kind: 'equipment',
            ownerId: '0',
            name: '奥秘法杖',
            zoneId: PLAYER_ZERO_START_ZONE,
            anchoredToPlayerId: '0',
            attackOrTraitLine: '奥术击打：快速近战 4 骰，以太，法力流失+1；奥术爆弹：完整行动远程 `1-1` 3 骰，以太，法力流失+1',
        });
        expect(equipped.state.core.players['0']).toMatchObject({
            mana: castState.core.players['0'].mana - 8,
            quickcastReady: false,
            actionReady: true,
        });

        const attacked = runCommand({
            core: equipped.state.core,
            sys: { ...equipped.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: {
                equipmentObjectId: equipment!.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    ownerId: '0',
                    attackerObjectId: equipment!.id,
                    attackProfileId: 'attack-0',
                    attackName: '奥术击打',
                    targetPlayerId: '1',
                    diceResults: [3, 3, 3, 3],
                    baseDamage: 12,
                    actionCost: 'normal',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MANA_DRAINED,
                payload: expect.objectContaining({
                    playerId: '1',
                    amount: 1,
                    requestedAmount: 1,
                    sourceAbilityId: 'mw.object.3704.attack-0',
                    spellCardId: arcaneStaffId,
                    targetPlayerId: '1',
                }),
            }),
        ]));
        expect(attacked.state.core.players['0'].actionReady).toBe(false);
        expect(attacked.state.core.objects[equipment!.id].actionReady).toBe(false);
        expect(attacked.state.core.players['1']).toMatchObject({
            damage: 12,
            mana: equipped.state.core.players['1'].mana - 1,
        });
        expect(actionLogKinds(attacked.state)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
            MAGE_WARS_EVENTS.MANA_DRAINED,
        ]));
    });

    it('uses Arcane Staff ranged profile only at printed range', () => {
        const arcaneStaffId = 3704;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([arcaneStaffId]));
        const equipped = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: arcaneStaffId,
                manaCost: 8,
                targetPlayerId: '0',
            },
        });
        const equipment = Object.values(equipped.state.core.objects)
            .find((object) => object.sourceSpellCardId === arcaneStaffId);
        expect(equipment).toBeDefined();

        const sameZoneState: MatchState<MageWarsCore> = {
            core: withPlayerInZone(equipped.state.core, '1', PLAYER_ZERO_START_ZONE),
            sys: { ...equipped.state.sys, phase: 'creatureAction' },
        };
        expect(validateCommand(sameZoneState, {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: {
                equipmentObjectId: equipment!.id,
                attackProfileId: 'attack-1',
                targetPlayerId: '1',
            },
        })).toBe('targetOutOfRange');

        const adjacentState: MatchState<MageWarsCore> = {
            core: withPlayerInZone(equipped.state.core, '1', ARENA_ZONE_IDS.A2),
            sys: { ...equipped.state.sys, phase: 'creatureAction' },
        };
        expect(validateCommand(adjacentState, {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: {
                equipmentObjectId: equipment!.id,
                attackProfileId: 'attack-1',
                targetPlayerId: '1',
            },
        })).toBeUndefined();

        const ranged = runCommand(adjacentState, {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: {
                equipmentObjectId: equipment!.id,
                attackProfileId: 'attack-1',
                targetPlayerId: '1',
            },
        });

        expect(ranged.success).toBe(true);
        expect(ranged.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: equipment!.id,
                    attackProfileId: 'attack-1',
                    attackName: '奥术爆弹',
                    targetPlayerId: '1',
                    diceResults: [3, 3, 3],
                    baseDamage: 9,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MANA_DRAINED,
                payload: expect.objectContaining({
                    playerId: '1',
                    amount: 1,
                    sourceAbilityId: 'mw.object.3704.attack-1',
                }),
            }),
        ]));
        expect(ranged.state.core.players['0'].actionReady).toBe(false);
        expect(validateCommand({
            core: equipped.state.core,
            sys: { ...equipped.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: {
                equipmentObjectId: equipment!.id,
                attackProfileId: 'attack-1',
                targetPlayerId: '1',
            },
        })).toBe('targetOutOfRange');
    });

    it('uses Asyra Staff status effects and nonliving bonus against object targets', () => {
        const asyraStaffId = 3706;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.PRIESTESS_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([asyraStaffId]));
        const equipped = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: asyraStaffId,
                manaCost: 9,
                targetPlayerId: '0',
            },
        });
        const equipment = Object.values(equipped.state.core.objects)
            .find((object) => object.sourceSpellCardId === asyraStaffId);
        expect(equipment).toBeDefined();

        const stunnedTarget = makeArenaObject('asyra-staff-skeleton-stun', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            life: 30,
            armor: 0,
            typeLine: '生物 / 骷髅',
            attackOrTraitLine: '短剑：快速近战 3 骰；非活体；精神免疫',
        });
        const stunAttack = runCommand({
            core: withArenaObject(equipped.state.core, stunnedTarget),
            sys: { ...equipped.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: {
                equipmentObjectId: equipment!.id,
                attackProfileId: 'attack-0',
                targetObjectId: stunnedTarget.id,
            },
        }, {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 11 : 3),
        });

        expect(stunAttack.success).toBe(true);
        expect(stunAttack.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: equipment!.id,
                    attackProfileId: 'attack-0',
                    attackName: '天界神击',
                    targetObjectId: stunnedTarget.id,
                    diceResults: [3, 3, 3, 3],
                    baseDamage: 12,
                    rawEffectDieResult: 11,
                    effectDieResult: 11,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: stunnedTarget.id,
                    actualDamage: 14,
                    sourceAbilityId: 'mw.object.3706.attack-0',
                    breakdown: expect.objectContaining({
                        steps: expect.arrayContaining([
                            expect.objectContaining({
                                sourceId: 'mage-wars-nonliving-bonus',
                                sourceName: '对抗非活体生物',
                                value: 2,
                            }),
                        ]),
                    }),
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: stunnedTarget.id,
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 1,
                    sourceAbilityId: 'mw.object.3706.attack-0',
                    spellCardId: asyraStaffId,
                }),
            }),
        ]));
        expect(stunAttack.state.core.objects[stunnedTarget.id].statusTokens[STATUS_TOKEN_IDS.STUN]).toBe(1);

        const dazedTarget = makeArenaObject('asyra-staff-skeleton-daze', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            life: 30,
            armor: 0,
            typeLine: '生物 / 骷髅',
            attackOrTraitLine: '短剑：快速近战 3 骰；非活体；精神免疫',
        });
        const dazeAttack = runCommand({
            core: withArenaObject(equipped.state.core, dazedTarget),
            sys: { ...equipped.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: {
                equipmentObjectId: equipment!.id,
                attackProfileId: 'attack-0',
                targetObjectId: dazedTarget.id,
            },
        }, {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 7 : 3),
        });

        expect(dazeAttack.success).toBe(true);
        expect(dazeAttack.state.core.objects[dazedTarget.id].statusTokens[STATUS_TOKEN_IDS.DAZE]).toBe(1);
    });

    it('uses Inferno Whip reach to attack a same-zone flying target and applies structured burn thresholds', () => {
        const infernoWhipId = 3701;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([infernoWhipId]));
        const equipped = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: infernoWhipId,
                manaCost: 8,
                targetPlayerId: '0',
            },
        });
        const equipment = Object.values(equipped.state.core.objects)
            .find((object) => object.sourceSpellCardId === infernoWhipId);
        const flyingTarget = makeArenaObject('inferno-whip-flying-target', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            typeLine: '生物 / 飞行',
            attackOrTraitLine: '利爪：快速近战 2 骰；飞行',
        });
        const attackState: MatchState<MageWarsCore> = {
            core: withArenaObject(equipped.state.core, flyingTarget),
            sys: { ...equipped.state.sys, phase: 'creatureAction' },
        };
        const attackCommand = {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: {
                equipmentObjectId: equipment!.id,
                attackProfileId: 'attack-0',
                targetObjectId: flyingTarget.id,
            },
        } as const;
        const rawElevenRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 11 : 3),
        };

        expect(equipped.success).toBe(true);
        expect(equipment).toMatchObject({
            kind: 'equipment',
            sourceSpellCardId: infernoWhipId,
            combatProfilesSource: 'config',
        });
        expect(validateCommand(attackState, attackCommand)).toBeUndefined();

        const attacked = runCommand(attackState, attackCommand, rawElevenRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: equipment!.id,
                    attackProfileId: 'attack-0',
                    attackName: '炽热鞭笞',
                    targetObjectId: flyingTarget.id,
                    diceResults: [3, 3, 3, 3],
                    rawEffectDieResult: 11,
                    effectDieResult: 11,
                    baseDamage: 12,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: flyingTarget.id,
                    statusTokenId: STATUS_TOKEN_IDS.BURN,
                    amount: 2,
                    sourceAbilityId: 'mw.object.3701.attack-0',
                    spellCardId: infernoWhipId,
                }),
            }),
        ]));
        expect(attacked.state.core.objects[flyingTarget.id].damage).toBe(12);
        expect(attacked.state.core.objects[flyingTarget.id].statusTokens[STATUS_TOKEN_IDS.BURN]).toBe(2);
    });

    it('limits equipment casts to self target and rejects invalid equipment attacks', () => {
        const leatherGlovesId = 3702;
        const arcaneStaffId = 3704;
        const lashId = 3701;
        const warlockPlanningState = setupState('planning');
        const warlockPlanned = runCommand({
            core: withPlayerMage(warlockPlanningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE),
            sys: warlockPlanningState.sys,
        }, planCommand([leatherGlovesId]));
        const warlockState: MatchState<MageWarsCore> = {
            core: warlockPlanned.state.core,
            sys: { ...warlockPlanned.state.sys, phase: 'initiativeQuickcast' },
        };

        expect(validateCommand(warlockState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: leatherGlovesId,
                manaCost: 2,
            },
        })).toBe('missingTarget');
        expect(validateCommand(warlockState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: leatherGlovesId,
                manaCost: 2,
                targetPlayerId: '1',
            },
        })).toBe('cannotTargetOpponent');
        expect(validateCommand(warlockState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: leatherGlovesId,
                manaCost: 2,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        })).toBe('invalidTargetMode');

        const wizardPlanningState = setupState('planning');
        const wizardPlanned = runCommand({
            core: withPlayerMage(wizardPlanningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: wizardPlanningState.sys,
        }, planCommand([arcaneStaffId]));
        const wizardState: MatchState<MageWarsCore> = {
            core: wizardPlanned.state.core,
            sys: { ...wizardPlanned.state.sys, phase: 'initiativeQuickcast' },
        };

        expect(validateCommand(wizardState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: arcaneStaffId,
                manaCost: 8,
                targetPlayerId: '0',
            },
        })).toBeUndefined();

        const baseState = setupState('creatureAction');
        const lash = makeArenaObject('lash-3701', '0', PLAYER_ZERO_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: lashId,
            sourceObjectId: 'spell-card-3701',
            name: '狱火长鞭',
            typeLine: '装备 / 武器',
            attackOrTraitLine: '炽热鞭笞：快速近战火焰 4 骰，效果骰 `7-10=燃烧`、`11+=燃烧x2`，远触，除霜',
            anchoredToPlayerId: '0',
        });
        const passiveArmor = makeArenaObject('passive-armor-3702', '0', PLAYER_ZERO_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: leatherGlovesId,
            sourceObjectId: 'spell-card-3702',
            name: '皮革手套',
            typeLine: '装备 / 手套',
            attackOrTraitLine: '法师获得护甲+1',
            anchoredToPlayerId: '0',
        });
        const unattachedStaff = makeArenaObject('unattached-staff-3704', '0', PLAYER_ZERO_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: arcaneStaffId,
            sourceObjectId: 'spell-card-3704',
            name: '奥秘法杖',
            typeLine: '装备 / 武器',
            attackOrTraitLine: '奥术击打：快速近战 4 骰，以太，法力流失+1',
        });
        const enemyStaff = makeArenaObject('enemy-staff-3704', '1', PLAYER_ZERO_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: arcaneStaffId,
            sourceObjectId: 'spell-card-3704',
            name: '敌方奥秘法杖',
            typeLine: '装备 / 武器',
            attackOrTraitLine: '奥术击打：快速近战 4 骰，以太，法力流失+1',
            anchoredToPlayerId: '1',
        });
        const target = makeArenaObject('equipment-attack-target', '1', PLAYER_ZERO_START_ZONE);
        const equipmentState: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(
                        withArenaObject(
                            withArenaObject(
                                withPlayerInZone(baseState.core, '1', PLAYER_ZERO_START_ZONE),
                                lash,
                            ),
                            passiveArmor,
                        ),
                        unattachedStaff,
                    ),
                    enemyStaff,
                ),
                target,
            ),
            sys: baseState.sys,
        };

        const attackPayload = (equipmentObjectId: string) => ({
            equipmentObjectId,
            attackProfileId: 'attack-0',
            targetObjectId: target.id,
        });
        expect(validateCommand(equipmentState, {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: attackPayload(lash.id),
        })).toBeUndefined();
        expect(validateCommand(equipmentState, {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: attackPayload(passiveArmor.id),
        })).toBe('equipmentCannotAttack');
        expect(validateCommand(equipmentState, {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: attackPayload(unattachedStaff.id),
        })).toBe('equipmentNotAttachedToMage');
        expect(validateCommand(equipmentState, {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: attackPayload(enemyStaff.id),
        })).toBe('notYourObject');
    });

    it('uses Beast Staff to grant a round-scoped melee bonus to a nearby friendly animal', () => {
        const beastStaffId = 3710;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([beastStaffId]));
        const animal = makeArenaObject('beast-staff-wolf', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: '丛林灰狼',
            typeLine: '生物 / 动物',
            life: 8,
        });
        const cast = runCommand({
            core: withArenaObject(planned.state.core, animal),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: beastStaffId,
                manaCost: 7,
                targetPlayerId: '0',
            },
        });
        const equipment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === beastStaffId);
        expect(cast.success).toBe(true);
        expect(equipment).toBeDefined();

        const used = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: equipment!.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                manaCost: 2,
                targetObjectId: animal.id,
                mode: 'melee-bonus',
            },
        });

        expect(used.success).toBe(true);
        expect(used.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
                payload: expect.objectContaining({
                    objectId: equipment!.id,
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                    mode: 'melee-bonus',
                    actionTrack: 'action',
                    roundNumber: cast.state.core.turnNumber,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_GAINED,
                payload: expect.objectContaining({
                    objectId: animal.id,
                    meleeDiceModifier: 2,
                    meleeDiceModifierUntilRoundNumber: cast.state.core.turnNumber,
                }),
            }),
        ]));
        expect(used.state.core.players['0']).toMatchObject({
            mana: cast.state.core.players['0'].mana - 2,
            actionReady: false,
            quickcastReady: false,
        });
        expect(used.state.core.objects[animal.id].temporaryTraits).toMatchObject({
            meleeDiceModifier: 2,
            meleeDiceModifierUntilRoundNumber: cast.state.core.turnNumber,
        });
        expect(used.state.core.objects[equipment!.id].abilityUseRoundNumbers).toMatchObject({
            [MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF]: cast.state.core.turnNumber,
        });

        const phaseAdvanced = runCommand({
            core: used.state.core,
            sys: { ...used.state.sys, phase: 'creatureAction' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        expect(phaseAdvanced.state.core.objects[animal.id].temporaryTraits).toMatchObject({
            meleeDiceModifier: 2,
        });

        const nextRound = reduceEvent(
            reduceEvent(phaseAdvanced.state.core, {
                type: MAGE_WARS_EVENTS.TURN_ADVANCED,
                payload: { fromPlayerId: '0', toPlayerId: '0', turnNumber: 2 },
                sourceCommandType: 'test',
                timestamp: 0,
            }),
            {
                type: MAGE_WARS_EVENTS.ACTION_READINESS_RESET,
                payload: { playerId: '0', objectIds: [animal.id] },
                sourceCommandType: 'test',
                timestamp: 0,
            },
        );
        expect(nextRound.objects[animal.id].temporaryTraits).toBeUndefined();
    });

    it('uses Beast Staff healing mode with exactly two attack dice and caps actual healing', () => {
        const beastStaffId = 3710;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([beastStaffId]));
        const animal = makeArenaObject('beast-staff-heal-target', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: '丛林灰狼',
            typeLine: '生物 / 动物',
            life: 8,
            damage: 5,
        });
        const cast = runCommand({
            core: withArenaObject(planned.state.core, animal),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: beastStaffId, manaCost: 7, targetPlayerId: '0' },
        });
        const equipment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === beastStaffId);
        const healed = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: equipment!.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                manaCost: 2,
                targetObjectId: animal.id,
                mode: 'heal',
            },
        });
        expect(healed.success).toBe(true);
        expect(healed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: expect.objectContaining({
                    sourceAbilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                    spellCardId: beastStaffId,
                    diceResults: [3, 3],
                    healing: 6,
                    actualHealing: 5,
                }),
            }),
        ]));
        expect(healed.state.core.objects[animal.id].damage).toBe(0);
        expect(healed.state.core.objects[equipment!.id].abilityUseRoundNumbers).toMatchObject({
            [MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF]: cast.state.core.turnNumber,
        });
    });

    it('rejects Beast Staff for the wrong mage, a distant target, or a second use in the same round', () => {
        const staff = makeArenaObject('beast-staff-source', '0', PLAYER_ZERO_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: 3710,
            sourceObjectId: 'spell-card-3710',
            name: '群兽法杖',
            typeLine: '装备 / 武器',
            attackOrTraitLine: '蛮力一击：快速近战 4 骰',
            combatProfilesSource: 'config',
            combatTraitsSource: 'config',
            anchoredToPlayerId: '0',
            actionReady: false,
        });
        const target = makeArenaObject('beast-staff-distant-target', '0', ARENA_ZONE_IDS.C3, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: '丛林灰狼',
            typeLine: '生物 / 动物',
        });
        const wrongMageState = setupState('creatureAction');
        const wrongMageCore = withArenaObject(
            withArenaObject(
                withPlayerMage(wrongMageState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
                staff,
            ),
            target,
        );
        const command = {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0' as const,
            payload: {
                objectId: staff.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                manaCost: 2,
                targetObjectId: target.id,
                mode: 'melee-bonus' as const,
            },
        };
        expect(validateCommand({ core: wrongMageCore, sys: wrongMageState.sys }, command)).toBe('invalidMageRestriction');

        const usedStaff = {
            ...staff,
            abilityUseRoundNumbers: { [MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF]: 1 },
        };
        const nearTarget = makeArenaObject('beast-staff-near-target', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: '丛林灰狼',
            typeLine: '生物 / 动物',
        });
        const beastmasterCore = withArenaObject(
            withArenaObject(
                withPlayerMage(wrongMageState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE),
                usedStaff,
            ),
            nearTarget,
        );
        expect(validateCommand({
            core: beastmasterCore,
            sys: wrongMageState.sys,
        }, {
            ...command,
            payload: { ...command.payload, targetObjectId: nearTarget.id },
        })).toBe('objectAbilityAlreadyUsedThisRound');

        const freshStaff = { ...staff, abilityUseRoundNumbers: undefined };
        const distantCore = withArenaObject(
            withArenaObject(
                withPlayerMage(wrongMageState.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE),
                freshStaff,
            ),
            target,
        );
        expect(validateCommand({ core: distantCore, sys: wrongMageState.sys }, command)).toBe('targetOutOfRange');
    });

    it('casts Sleep as a quick incantation that places sleep on a non-mage living creature', () => {
        const sleepSpellId = 3411;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.PRIESTESS_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([sleepSpellId]));
        const target = makeArenaObject('sleep-target-cat', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-card-2906',
            name: '野性山猫',
        });
        const state = {
            core: withArenaObject(planned.state.core, target),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const slept = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: sleepSpellId,
                manaCost: 4,
                targetObjectId: target.id,
            },
        });

        expect(slept.success).toBe(true);
        expect(slept.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    spellCardId: sleepSpellId,
                    manaCost: 4,
                    targetObjectId: target.id,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: target.id,
                    statusTokenId: STATUS_TOKEN_IDS.SLEEP,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.3411',
                    spellCardId: sleepSpellId,
                }),
            }),
        ]));
        expect(slept.state.core.players['0']).toMatchObject({
            quickcastReady: false,
            actionReady: true,
        });
        expect(slept.state.core.players['0'].discardSpellCardIds).toEqual([sleepSpellId]);
        expect(slept.state.core.objects[target.id].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.SLEEP]: 1,
        });
    });

    it('requires Sleep to pay target level cost and target only non-mage living non-mental-immune creatures', () => {
        const sleepSpellId = 3411;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([sleepSpellId]));
        const livingTarget = makeArenaObject('sleep-level-two-target', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2810,
            sourceObjectId: 'spell-card-2810',
            name: '戈尔贡箭手',
        });
        const mentalImmuneTarget = makeArenaObject('sleep-mental-immune-target', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2810,
            sourceObjectId: 'spell-card-2810',
            name: '精神免疫生物',
            attackOrTraitLine: '利爪：快速近战 2 骰；精神免疫',
        });
        const nonlivingTarget = makeArenaObject('sleep-nonliving-target', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });
        const state = {
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(planned.state.core, livingTarget),
                    mentalImmuneTarget,
                ),
                nonlivingTarget,
            ),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: sleepSpellId,
                manaCost: 4,
                targetObjectId: livingTarget.id,
            },
        })).toBe('manaCostMismatch');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: sleepSpellId,
                manaCost: 5,
                targetPlayerId: '1',
            },
        })).toBe('invalidTargetMode');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: sleepSpellId,
                manaCost: 8,
                targetObjectId: mentalImmuneTarget.id,
            },
        })).toBe('invalidSleepTarget');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: sleepSpellId,
                manaCost: 8,
                targetObjectId: nonlivingTarget.id,
            },
        })).toBe('invalidSleepTarget');
    });

    it('casts Chain Lightning through a legal object chain with shrinking dice and effect die penalties', () => {
        const attackSpellId = 1703;
        const chainRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 8 : 2),
        };
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([attackSpellId]));
        const firstTarget = makeArenaObject('chain-target-a1', '1', PLAYER_ZERO_START_ZONE, { life: 30 });
        const secondTarget = makeArenaObject('chain-target-b1', '1', ARENA_ZONE_IDS.B3, { life: 30 });
        const thirdTarget = makeArenaObject('chain-target-b2', '1', ARENA_ZONE_IDS.B2, { life: 30 });
        const aegis = makeVisibleEnchantmentObject('chain-aegis-1813', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 1813,
            sourceObjectId: 'spell-1813',
            anchoredToObjectId: firstTarget.id,
        });
        const castCore = {
            ...planned.state.core,
            players: {
                ...planned.state.core.players,
                '0': {
                    ...planned.state.core.players['0'],
                    mana: 20,
                },
            },
        };

        const chained = runCommand({
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(
                        withArenaObject(castCore, firstTarget),
                        secondTarget,
                    ),
                    thirdTarget,
                ),
                aegis,
            ),
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 12,
                targetObjectId: firstTarget.id,
                chainLightningTargets: [
                    { targetObjectId: secondTarget.id },
                    { targetObjectId: thirdTarget.id },
                ],
            },
        }, chainRandom);

        const attackRolls = chained.events.filter((event) => event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED);
        const damageEvents = chained.events.filter((event) => event.type === 'DAMAGE_DEALT');

        expect(planned.success).toBe(true);
        expect(chained.success).toBe(true);
        expect(attackRolls).toHaveLength(3);
        expect(damageEvents).toHaveLength(3);
        expect(attackRolls).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetObjectId: firstTarget.id,
                    diceResults: [2, 2, 2, 2],
                    rawEffectDieResult: 8,
                    effectDieResult: 8,
                    chainIndex: 0,
                    baseDamage: 8,
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetObjectId: secondTarget.id,
                    diceResults: [2, 2, 2, 2],
                    rawEffectDieResult: 8,
                    effectDieResult: 7,
                    chainIndex: 1,
                    chainSourceObjectId: firstTarget.id,
                    chainSourceZoneId: PLAYER_ZERO_START_ZONE,
                    baseDamage: 8,
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetObjectId: thirdTarget.id,
                    diceResults: [2, 2, 2],
                    rawEffectDieResult: 8,
                    effectDieResult: 6,
                    chainIndex: 2,
                    chainSourceObjectId: secondTarget.id,
                    chainSourceZoneId: ARENA_ZONE_IDS.B3,
                    baseDamage: 6,
                }),
            }),
        ]);
        expect(damageEvents).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetId: firstTarget.id,
                    actualDamage: 8,
                    sourceAbilityId: 'mw.spell.1703',
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetId: secondTarget.id,
                    actualDamage: 8,
                    sourceAbilityId: 'mw.spell.1703',
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetId: thirdTarget.id,
                    actualDamage: 6,
                    sourceAbilityId: 'mw.spell.1703',
                }),
            }),
        ]);
        expect(chained.state.core.objects[firstTarget.id]).toMatchObject({
            damage: 8,
            statusTokens: { [STATUS_TOKEN_IDS.STUN]: 1 },
        });
        expect(chained.state.core.objects[secondTarget.id]).toMatchObject({
            damage: 8,
            statusTokens: { [STATUS_TOKEN_IDS.DAZE]: 1 },
        });
        expect(chained.state.core.objects[thirdTarget.id]).toMatchObject({
            damage: 6,
            statusTokens: { [STATUS_TOKEN_IDS.DAZE]: 1 },
        });
    });

    it('requires Chain Lightning chain targets to be unique legal object targets within range of the previous target', () => {
        const attackSpellId = 1703;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([attackSpellId]));
        const firstTarget = makeArenaObject('chain-target-a1', '1', PLAYER_ZERO_START_ZONE);
        const farTarget = makeArenaObject('chain-target-b3', '1', PLAYER_ONE_START_ZONE);
        const castCore = {
            ...planned.state.core,
            players: {
                ...planned.state.core.players,
                '0': {
                    ...planned.state.core.players['0'],
                    mana: 20,
                },
            },
        };
        const state = {
            core: withArenaObject(withArenaObject(castCore, firstTarget), farTarget),
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 12,
                targetPlayerId: '1',
            },
        })).toBe('invalidTargetMode');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 12,
                targetObjectId: firstTarget.id,
                chainLightningTargets: [{ targetObjectId: farTarget.id }],
            },
        })).toBe('chainLightningTargetOutOfRange');

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 12,
                targetObjectId: firstTarget.id,
                chainLightningTargets: [{ targetObjectId: firstTarget.id }],
            },
        })).toBe('duplicateChainLightningTarget');
    });

    it('casts Dazzling Flash as a same-zone area attack excluding only the caster', () => {
        const attackSpellId = 1709;
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 10 : 3),
        };
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withCurrentPlayer(planningState.core, '1'),
            sys: planningState.sys,
        }, planCommand([attackSpellId], '1'));
        const friendlyCat = makeArenaObject('cat-1', '1', PLAYER_ONE_START_ZONE, {
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-card-2906',
            name: '野性山猫',
            life: 10,
            attackOrTraitLine: '利爪：快速近战 2 骰；防御图标 `8+ / 1x`；冲锋+2',
        });
        const skeleton = makeArenaObject('skeleton-0', '0', PLAYER_ONE_START_ZONE, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            life: 11,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        });
        const outsideCat = makeArenaObject('outside-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-card-2906',
            name: '区外野性山猫',
            life: 10,
        });
        const contestedZoneCore = withPlayerInZone(planned.state.core, '0', PLAYER_ONE_START_ZONE);

        const attacked = runCommand({
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(contestedZoneCore, friendlyCat),
                    skeleton,
                ),
                outsideCat,
            ),
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '1',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 7,
                targetZoneId: PLAYER_ONE_START_ZONE,
            },
        }, statusRandom);

        const attackRolls = attacked.events.filter((event) => event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED);
        const damageEvents = attacked.events.filter((event) => event.type === 'DAMAGE_DEALT');

        expect(planned.success).toBe(true);
        expect(attacked.success).toBe(true);
        expect(attackRolls).toHaveLength(3);
        expect(damageEvents).toHaveLength(3);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    playerId: '1',
                    spellCardId: attackSpellId,
                    sourceAbilityId: 'mw.spell.1709',
                    targetPlayerId: '0',
                    targetZoneId: PLAYER_ONE_START_ZONE,
                    diceResults: [3, 3],
                    effectDieResult: 10,
                    baseDamage: 6,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    targetObjectId: friendlyCat.id,
                    targetZoneId: PLAYER_ONE_START_ZONE,
                    diceResults: [3, 3],
                    effectDieResult: 10,
                    baseDamage: 6,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    targetObjectId: skeleton.id,
                    targetZoneId: PLAYER_ONE_START_ZONE,
                    diceResults: [3, 3],
                    effectDieResult: 10,
                    baseDamage: 6,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: '0',
                    actualDamage: 6,
                    sourceAbilityId: 'mw.spell.1709',
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: friendlyCat.id,
                    actualDamage: 6,
                    sourceAbilityId: 'mw.spell.1709',
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: skeleton.id,
                    actualDamage: 8,
                    sourceAbilityId: 'mw.spell.1709',
                    breakdown: expect.objectContaining({
                        steps: expect.arrayContaining([
                            expect.objectContaining({
                                sourceId: 'mage-wars-nonliving-bonus',
                                sourceName: '对抗非活体生物',
                                value: 2,
                                runningTotal: 8,
                            }),
                        ]),
                    }),
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetPlayerId: '0',
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.1709',
                    spellCardId: attackSpellId,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: friendlyCat.id,
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.1709',
                    spellCardId: attackSpellId,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: skeleton.id,
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.1709',
                    spellCardId: attackSpellId,
                }),
            }),
        ]));
        expect(attacked.state.core.players['1']).toMatchObject({
            damage: 0,
            statusTokens: {},
        });
        expect(attacked.state.core.players['0']).toMatchObject({
            damage: 6,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });
        expect(attacked.state.core.objects[friendlyCat.id]).toMatchObject({
            damage: 6,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });
        expect(attacked.state.core.objects[skeleton.id]).toMatchObject({
            damage: 8,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });
        expect(attacked.state.core.objects[outsideCat.id]).toMatchObject({
            damage: 0,
            statusTokens: {},
        });
        expect(attacked.state.core.players['1'].discardSpellCardIds).toEqual([attackSpellId]);
    });

    it('casts Lightning Ring from the wizard spellbook as a same-zone area stun attack', () => {
        const attackSpellId = 1704;
        const statusRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 9 : 3),
        };
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([attackSpellId]));
        const friendlyCat = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE, {
            life: 30,
        });
        const enemyGuard = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 30,
        });
        const lightningImmune = makeArenaObject('lightning-immune-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 30,
            attackOrTraitLine: '长剑：快速近战 5 骰；闪电免疫',
        });
        const contestedZoneCore = withPlayerInZone(planned.state.core, '1', PLAYER_ZERO_START_ZONE);

        const attacked = runCommand({
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(contestedZoneCore, friendlyCat),
                    lightningImmune,
                ),
                enemyGuard,
            ),
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 9,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        }, statusRandom);

        const attackRolls = attacked.events.filter((event) => event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED);
        const damageEvents = attacked.events.filter((event) => event.type === 'DAMAGE_DEALT');

        expect(planned.success).toBe(true);
        expect(attacked.success).toBe(true);
        expect(attackRolls).toHaveLength(3);
        expect(damageEvents).toHaveLength(3);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    spellCardId: attackSpellId,
                    sourceAbilityId: 'mw.spell.1704',
                    targetPlayerId: '1',
                    targetZoneId: PLAYER_ZERO_START_ZONE,
                    diceResults: [3, 3, 3, 3],
                    effectDieResult: 9,
                    baseDamage: 12,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    targetObjectId: friendlyCat.id,
                    targetZoneId: PLAYER_ZERO_START_ZONE,
                    diceResults: [3, 3, 3, 3],
                    effectDieResult: 9,
                    baseDamage: 12,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    targetObjectId: enemyGuard.id,
                    targetZoneId: PLAYER_ZERO_START_ZONE,
                    diceResults: [3, 3, 3, 3],
                    effectDieResult: 9,
                    baseDamage: 12,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetPlayerId: '1',
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.1704',
                    spellCardId: attackSpellId,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: friendlyCat.id,
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.1704',
                    spellCardId: attackSpellId,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: enemyGuard.id,
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 1,
                    sourceAbilityId: 'mw.spell.1704',
                    spellCardId: attackSpellId,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: expect.objectContaining({
                    targetObjectId: lightningImmune.id,
                    sourceAbilityId: 'mw.spell.1704',
                    immunityDamageTypes: ['闪电'],
                }),
            }),
        ]));
        expect(attacked.state.core.players['0'].damage).toBe(0);
        expect(attacked.state.core.players['1']).toMatchObject({
            damage: 12,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });
        expect(attacked.state.core.objects[friendlyCat.id]).toMatchObject({
            damage: 12,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });
        expect(attacked.state.core.objects[enemyGuard.id]).toMatchObject({
            damage: 12,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });
        expect(attacked.state.core.objects[lightningImmune.id]).toMatchObject({
            damage: 0,
            statusTokens: {},
        });
    });

    it('removes defeated arena objects and readies next player creatures on turn handoff', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const defender = makeArenaObject('guard-1', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2909,
            sourceObjectId: 'spell-card-2909',
            name: '皇家弓手',
            life: 6,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), defender),
            sys: baseState.sys,
        };

        const defeated = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: defender.id,
            },
        });

        expect(defeated.success).toBe(true);
        expect(defeated.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: defender.id,
                    ownerId: '1',
                    sourceAbilityId: 'mw.object.2906.attack-0',
                }),
            }),
        ]));
        expect(defeated.state.core.objects[defender.id]).toBeUndefined();
        expect(defeated.state.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)?.objectIds).not.toContain(defender.id);

        const nextPlayerObject = makeArenaObject('cleric-1', '1', PLAYER_ONE_START_ZONE, { actionReady: false });
        const finalQuickcastState: MatchState<MageWarsCore> = {
            core: withArenaObject({
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '1': {
                        ...baseState.core.players['1'],
                        actionReady: false,
                    },
                },
            }, nextPlayerObject),
            sys: { ...baseState.sys, phase: 'finalQuickcast' },
        };

        const nextTurn = runCommand(finalQuickcastState, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(nextTurn.success).toBe(true);
        expect(nextTurn.state.core.currentPlayerId).toBe('1');
        expect(nextTurn.state.core.players['1'].actionReady).toBe(true);
        expect(nextTurn.state.core.objects[nextPlayerObject.id].actionReady).toBe(true);
        expect(nextTurn.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ACTION_READINESS_RESET,
                payload: expect.objectContaining({
                    playerId: '1',
                    objectIds: [nextPlayerObject.id],
                }),
            }),
        ]));
    });

    it('regenerates damaged living arena objects during upkeep without stacking regeneration values', () => {
        const baseState = setupState('channel');
        const highlandUnicorn = makeArenaObject('unicorn-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2814,
            sourceObjectId: 'spell-card-2814',
            name: '高地独角兽',
            life: 9,
            damage: 4,
            armor: 2,
            attackOrTraitLine: '特角：快速近战 3 骰；重生2；冲锋+2',
            rulesText: '所有与高地独角兽位于同一格区域的友方活体生物获得重生1特性。',
        });
        const woundedCat = makeArenaObject('cat-ally', '0', PLAYER_ZERO_START_ZONE, {
            damage: 3,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const gorgonArcher = makeArenaObject('gorgon-ally', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2810,
            sourceObjectId: 'spell-card-2810',
            name: '戈尔贡箭手',
            life: 13,
            damage: 3,
            attackOrTraitLine: '毒弓：完整行动远程 `1-2` 4 骰，效果骰 `4-9=虚弱`、`10+=虚弱x2`；利爪：快速近战 2 骰；重生2；迟缓',
        });
        const nonlivingSkeleton = makeArenaObject('skeleton-ally', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            life: 11,
            damage: 4,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；重生2',
        });
        const state: MatchState<MageWarsCore> = {
            core: [highlandUnicorn, woundedCat, gorgonArcher, nonlivingSkeleton].reduce(
                (core, object) => withArenaObject(core, object),
                baseState.core,
            ),
            sys: baseState.sys,
        };

        const upkeep = runCommand(state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        const regenerationEvents = upkeep.events.filter((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_REGENERATED
        ));
        expect(upkeep.success).toBe(true);
        expect(regenerationEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                payload: expect.objectContaining({
                    objectId: highlandUnicorn.id,
                    regeneration: 2,
                    actualHealing: 2,
                    sourceObjectIds: [highlandUnicorn.id],
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    objectId: woundedCat.id,
                    regeneration: 1,
                    actualHealing: 1,
                    sourceObjectIds: [highlandUnicorn.id],
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    objectId: gorgonArcher.id,
                    regeneration: 2,
                    actualHealing: 2,
                    sourceObjectIds: [gorgonArcher.id],
                }),
            }),
        ]));
        expect(regenerationEvents).toHaveLength(3);
        expect(upkeep.state.core.objects[highlandUnicorn.id].damage).toBe(2);
        expect(upkeep.state.core.objects[woundedCat.id].damage).toBe(2);
        expect(upkeep.state.core.objects[gorgonArcher.id].damage).toBe(1);
        expect(upkeep.state.core.objects[nonlivingSkeleton.id].damage).toBe(4);
        expect(actionLogKinds(upkeep.state)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_REGENERATED);
    });

    it('deals direct rot damage to mages and living arena objects during upkeep', () => {
        const baseState = setupState('channel');
        const rottedCat = makeArenaObject('rotted-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            damage: 1,
            statusTokens: { [STATUS_TOKEN_IDS.ROT]: 1 },
        });
        const nonlivingSkeleton = makeArenaObject('rotted-skeleton-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            life: 11,
            damage: 4,
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；重生2',
            statusTokens: { [STATUS_TOKEN_IDS.ROT]: 1 },
        });
        const state: MatchState<MageWarsCore> = {
            core: [rottedCat, nonlivingSkeleton].reduce(
                (core, object) => withArenaObject(core, object),
                {
                    ...baseState.core,
                    players: {
                        ...baseState.core.players,
                        '0': {
                            ...baseState.core.players['0'],
                            damage: 2,
                            statusTokens: { [STATUS_TOKEN_IDS.ROT]: 1 },
                        },
                        '1': {
                            ...baseState.core.players['1'],
                            damage: 3,
                            statusTokens: { [STATUS_TOKEN_IDS.ROT]: 2 },
                        },
                    },
                },
            ),
            sys: baseState.sys,
        };

        const upkeep = runCommand(state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const rotDamageEvents = upkeep.events.filter((event) => (
            event.type === 'DAMAGE_DEALT'
            && event.payload.sourceAbilityId === 'mw.status.rot.upkeep'
        ));

        expect(upkeep.success).toBe(true);
        expect(rotDamageEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                payload: expect.objectContaining({ targetId: '0', actualDamage: 1 }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({ targetId: '1', actualDamage: 2 }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({ targetId: rottedCat.id, actualDamage: 1 }),
            }),
        ]));
        expect(rotDamageEvents).toHaveLength(3);
        expect(upkeep.state.core.players['0'].damage).toBe(3);
        expect(upkeep.state.core.players['1'].damage).toBe(5);
        expect(upkeep.state.core.objects[rottedCat.id].damage).toBe(2);
        expect(upkeep.state.core.objects[rottedCat.id].statusTokens[STATUS_TOKEN_IDS.ROT]).toBe(1);
        expect(upkeep.state.core.objects[nonlivingSkeleton.id].damage).toBe(4);
        expect(actionLogKinds(upkeep.state)).toContain('DAMAGE_DEALT');
    });

    it('rolls burn upkeep damage per burn token and removes tokens on blanks', () => {
        const baseState = setupState('channel');
        const burningCat = makeArenaObject('burning-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            damage: 1,
            statusTokens: { [STATUS_TOKEN_IDS.BURN]: 2 },
        });
        const burnRolls = [0, 2, 1, 0, 0];
        const burnRandom: RandomFn = {
            ...fixedRandom,
            range: (min: number, max: number) => {
                const next = burnRolls.shift();
                if (next === undefined) return min;
                return Math.max(min, Math.min(max, next));
            },
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject({
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '0': {
                        ...baseState.core.players['0'],
                        damage: 2,
                        statusTokens: { [STATUS_TOKEN_IDS.BURN]: 2 },
                    },
                    '1': {
                        ...baseState.core.players['1'],
                        damage: 3,
                        statusTokens: { [STATUS_TOKEN_IDS.BURN]: 1 },
                    },
                },
            }, burningCat),
            sys: baseState.sys,
        };

        const upkeep = runCommand(state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        }, burnRandom);
        const burnDamageEvents = upkeep.events.filter((event) => (
            event.type === 'DAMAGE_DEALT'
            && event.payload.sourceAbilityId === 'mw.status.burn.upkeep'
        ));
        const burnRemovalEvents = upkeep.events.filter((event) => (
            event.type === MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED
            && event.payload.statusTokenId === STATUS_TOKEN_IDS.BURN
        ));

        expect(upkeep.success).toBe(true);
        expect(burnDamageEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                payload: expect.objectContaining({ targetId: '0', actualDamage: 2 }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({ targetId: '1', actualDamage: 1 }),
            }),
        ]));
        expect(burnDamageEvents).toHaveLength(2);
        expect(burnRemovalEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetPlayerId: '0',
                    amount: 1,
                    sourceAbilityId: 'mw.status.burn.upkeep',
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetObjectId: burningCat.id,
                    amount: 2,
                    sourceAbilityId: 'mw.status.burn.upkeep',
                }),
            }),
        ]));
        expect(burnRemovalEvents).toHaveLength(2);
        expect(upkeep.state.core.players['0'].damage).toBe(4);
        expect(upkeep.state.core.players['0'].statusTokens[STATUS_TOKEN_IDS.BURN]).toBe(1);
        expect(upkeep.state.core.players['1'].damage).toBe(4);
        expect(upkeep.state.core.players['1'].statusTokens[STATUS_TOKEN_IDS.BURN]).toBe(1);
        expect(upkeep.state.core.objects[burningCat.id].damage).toBe(1);
        expect(upkeep.state.core.objects[burningCat.id].statusTokens[STATUS_TOKEN_IDS.BURN]).toBeUndefined();
        expect(actionLogKinds(upkeep.state)).toEqual(expect.arrayContaining([
            'DAMAGE_DEALT',
            MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
        ]));
    });

    it('replaces sleep with daze when a sleeping arena object takes damage', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const sleepingTarget = makeArenaObject('sleeping-cat-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 10,
            statusTokens: { [STATUS_TOKEN_IDS.SLEEP]: 1 },
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), sleepingTarget),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: sleepingTarget.id,
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: sleepingTarget.id,
                    actualDamage: 6,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: expect.objectContaining({
                    targetObjectId: sleepingTarget.id,
                    statusTokenId: STATUS_TOKEN_IDS.SLEEP,
                    amount: 1,
                    sourceAbilityId: 'mw.status.sleep.damage-replacement',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: expect.objectContaining({
                    targetObjectId: sleepingTarget.id,
                    statusTokenId: STATUS_TOKEN_IDS.DAZE,
                    amount: 1,
                    sourceAbilityId: 'mw.status.sleep.damage-replacement',
                }),
            }),
        ]));
        expect(attacked.state.core.objects[sleepingTarget.id].damage).toBe(6);
        expect(attacked.state.core.objects[sleepingTarget.id].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.DAZE]: 1,
        });
        expect(actionLogKinds(attacked.state)).toEqual(expect.arrayContaining([
            'DAMAGE_DEALT',
            MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
            MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
        ]));
    });

    it('keeps sleep when armor prevents all incoming damage', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE);
        const armoredSleeper = makeArenaObject('armored-sleeper-1', '1', PLAYER_ZERO_START_ZONE, {
            armor: 10,
            life: 10,
            statusTokens: { [STATUS_TOKEN_IDS.SLEEP]: 1 },
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, attacker), armoredSleeper),
            sys: baseState.sys,
        };

        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: armoredSleeper.id,
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: armoredSleeper.id,
                    actualDamage: 0,
                }),
            }),
        ]));
        expect(attacked.events.some((event) => (
            event.type === MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED
            && event.payload.statusTokenId === STATUS_TOKEN_IDS.SLEEP
        ))).toBe(false);
        expect(attacked.state.core.objects[armoredSleeper.id].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.SLEEP]: 1,
        });
    });

    it('applies weak to mage basic melee attacks', () => {
        const baseState = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            core: {
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '0': {
                        ...baseState.core.players['0'],
                        statusTokens: {
                            [STATUS_TOKEN_IDS.WEAK]: 5,
                        },
                    },
                    '1': {
                        ...baseState.core.players['1'],
                        mageZoneId: PLAYER_ZERO_START_ZONE,
                    },
                },
                arena: baseState.core.arena.map((zone) => {
                    if (zone.id === PLAYER_ZERO_START_ZONE) {
                        return { ...zone, occupantIds: ['0', '1'] };
                    }
                    if (zone.id === PLAYER_ONE_START_ZONE) {
                        return { ...zone, occupantIds: [] };
                    }
                    return zone;
                }),
            },
            sys: baseState.sys,
        };

        const attack = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_ATTACK,
            playerId: '0',
            payload: { targetPlayerId: '1' },
        });

        expect(attack.success).toBe(true);
        expect(attack.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerId: '0',
                    defenderId: '1',
                    diceResults: [3],
                    baseDamage: 3,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: '1',
                    actualDamage: 3,
                }),
            }),
        ]));
        expect(attack.state.core.players['1'].damage).toBe(3);
    });

    it('makes dazed mage basic melee attacks miss before damage is rolled', () => {
        const baseState = setupState('creatureAction');
        const missRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 6 : 3),
        };
        const state: MatchState<MageWarsCore> = {
            core: {
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '0': {
                        ...baseState.core.players['0'],
                        statusTokens: {
                            [STATUS_TOKEN_IDS.DAZE]: 1,
                        },
                    },
                    '1': {
                        ...baseState.core.players['1'],
                        mageZoneId: PLAYER_ZERO_START_ZONE,
                    },
                },
                arena: baseState.core.arena.map((zone) => {
                    if (zone.id === PLAYER_ZERO_START_ZONE) {
                        return { ...zone, occupantIds: ['0', '1'] };
                    }
                    if (zone.id === PLAYER_ONE_START_ZONE) {
                        return { ...zone, occupantIds: [] };
                    }
                    return zone;
                }),
            },
            sys: baseState.sys,
        };

        const attack = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_ATTACK,
            playerId: '0',
            payload: { targetPlayerId: '1' },
        }, missRandom);

        expect(attack.success).toBe(true);
        expect(attack.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerId: '0',
                    defenderId: '1',
                    diceResults: [],
                    effectDieResult: 6,
                    baseDamage: 0,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: expect.objectContaining({
                    attackerId: '0',
                    targetPlayerId: '1',
                    statusTokenId: STATUS_TOKEN_IDS.DAZE,
                    effectDieResult: 6,
                }),
            }),
        ]));
        expect(attack.events.map((event) => event.type)).not.toContain('DAMAGE_DEALT');
        expect(attack.state.core.players['0'].actionReady).toBe(false);
        expect(attack.state.core.players['1'].damage).toBe(0);
        expect(actionLogKinds(attack.state)).toContain(MAGE_WARS_EVENTS.ATTACK_MISSED);
    });

    it('removes all daze from the active mage and owned creatures when creature action ends', () => {
        const baseState = setupState('creatureAction');
        const activeCat = makeArenaObject('dazed-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: {
                [STATUS_TOKEN_IDS.DAZE]: 2,
                [STATUS_TOKEN_IDS.WEAK]: 1,
            },
        });
        const enemyCat = makeArenaObject('enemy-dazed-cat-1', '1', ARENA_ZONE_IDS.A2, {
            statusTokens: {
                [STATUS_TOKEN_IDS.DAZE]: 1,
            },
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject({
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '0': {
                        ...baseState.core.players['0'],
                        statusTokens: {
                            [STATUS_TOKEN_IDS.DAZE]: 1,
                            [STATUS_TOKEN_IDS.WEAK]: 1,
                        },
                    },
                    '1': {
                        ...baseState.core.players['1'],
                        statusTokens: {
                            [STATUS_TOKEN_IDS.DAZE]: 1,
                        },
                    },
                },
            }, activeCat), enemyCat),
            sys: baseState.sys,
        };

        const advanced = runCommand(state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(advanced.success).toBe(true);
        expect(advanced.state.sys.phase).toBe('finalQuickcast');
        expect(advanced.state.core.players['0'].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.WEAK]: 1,
        });
        expect(advanced.state.core.objects[activeCat.id].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.WEAK]: 1,
        });
        expect(advanced.state.core.players['1'].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.DAZE]: 1,
        });
        expect(advanced.state.core.objects[enemyCat.id].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.DAZE]: 1,
        });
        expect(advanced.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: expect.objectContaining({
                    targetPlayerId: '0',
                    statusTokenId: STATUS_TOKEN_IDS.DAZE,
                    amount: 1,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: expect.objectContaining({
                    targetObjectId: activeCat.id,
                    statusTokenId: STATUS_TOKEN_IDS.DAZE,
                    amount: 2,
                }),
            }),
        ]));
        expect(actionLogKinds(advanced.state)).toContain(MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED);
    });

    it('removes all stun from the active mage and owned creatures when creature action ends', () => {
        const baseState = setupState('creatureAction');
        const activeCat = makeArenaObject('stunned-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 2,
                [STATUS_TOKEN_IDS.WEAK]: 1,
            },
        });
        const enemyCat = makeArenaObject('enemy-stunned-cat-1', '1', ARENA_ZONE_IDS.A2, {
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject({
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '0': {
                        ...baseState.core.players['0'],
                        statusTokens: {
                            [STATUS_TOKEN_IDS.STUN]: 1,
                            [STATUS_TOKEN_IDS.WEAK]: 1,
                        },
                    },
                    '1': {
                        ...baseState.core.players['1'],
                        statusTokens: {
                            [STATUS_TOKEN_IDS.STUN]: 1,
                        },
                    },
                },
            }, activeCat), enemyCat),
            sys: baseState.sys,
        };

        const advanced = runCommand(state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(advanced.success).toBe(true);
        expect(advanced.state.sys.phase).toBe('finalQuickcast');
        expect(advanced.state.core.players['0'].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.WEAK]: 1,
        });
        expect(advanced.state.core.objects[activeCat.id].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.WEAK]: 1,
        });
        expect(advanced.state.core.players['1'].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.STUN]: 1,
        });
        expect(advanced.state.core.objects[enemyCat.id].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.STUN]: 1,
        });
        expect(advanced.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: expect.objectContaining({
                    targetPlayerId: '0',
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 1,
                    sourceAbilityId: 'mw.status.stun.end-creature-action',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: expect.objectContaining({
                    targetObjectId: activeCat.id,
                    statusTokenId: STATUS_TOKEN_IDS.STUN,
                    amount: 2,
                    sourceAbilityId: 'mw.status.stun.end-creature-action',
                }),
            }),
        ]));
        expect(actionLogKinds(advanced.state)).toContain(MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED);
    });

    it('removes cripple from current player creatures on a successful end-action escape check', () => {
        const baseState = setupState('creatureAction');
        const activeCat = makeArenaObject('crippled-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: {
                [STATUS_TOKEN_IDS.CRIPPLE]: 1,
                [STATUS_TOKEN_IDS.WEAK]: 1,
            },
        });
        const enemyCat = makeArenaObject('enemy-crippled-cat-1', '1', ARENA_ZONE_IDS.A2, {
            statusTokens: {
                [STATUS_TOKEN_IDS.CRIPPLE]: 1,
            },
        });
        const escapeRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 7 : 3),
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(withArenaObject(baseState.core, activeCat), enemyCat),
            sys: baseState.sys,
        };

        const advanced = runCommand(state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        }, escapeRandom);

        expect(advanced.success).toBe(true);
        expect(advanced.state.sys.phase).toBe('finalQuickcast');
        expect(advanced.state.core.objects[activeCat.id].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.WEAK]: 1,
        });
        expect(advanced.state.core.objects[enemyCat.id].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.CRIPPLE]: 1,
        });
        expect(advanced.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: expect.objectContaining({
                    targetObjectId: activeCat.id,
                    statusTokenId: STATUS_TOKEN_IDS.CRIPPLE,
                    amount: 1,
                    sourceAbilityId: 'mw.status.cripple.escape-check',
                    effectDieResult: 7,
                }),
            }),
        ]));
        expect(actionLogKinds(advanced.state)).toContain(MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED);
    });

    it('keeps cripple on current player creatures after a failed end-action escape check', () => {
        const baseState = setupState('creatureAction');
        const activeCat = makeArenaObject('failed-escape-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: {
                [STATUS_TOKEN_IDS.CRIPPLE]: 1,
            },
        });
        const escapeRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 6 : 3),
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(baseState.core, activeCat),
            sys: baseState.sys,
        };

        const advanced = runCommand(state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        }, escapeRandom);

        expect(advanced.success).toBe(true);
        expect(advanced.state.sys.phase).toBe('finalQuickcast');
        expect(advanced.state.core.objects[activeCat.id].statusTokens).toEqual({
            [STATUS_TOKEN_IDS.CRIPPLE]: 1,
        });
        expect(advanced.events.some((event) => (
            event.type === MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED
            && event.payload.statusTokenId === STATUS_TOKEN_IDS.CRIPPLE
        ))).toBe(false);
    });

    it('prevents stunned mages from moving, guarding, or making basic melee attacks', () => {
        const baseState = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            core: {
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '0': {
                        ...baseState.core.players['0'],
                        statusTokens: {
                            [STATUS_TOKEN_IDS.STUN]: 1,
                        },
                    },
                    '1': {
                        ...baseState.core.players['1'],
                        mageZoneId: PLAYER_ZERO_START_ZONE,
                    },
                },
                arena: baseState.core.arena.map((zone) => {
                    if (zone.id === PLAYER_ZERO_START_ZONE) {
                        return { ...zone, occupantIds: ['0', '1'] };
                    }
                    if (zone.id === PLAYER_ONE_START_ZONE) {
                        return { ...zone, occupantIds: [] };
                    }
                    return zone;
                }),
            },
            sys: baseState.sys,
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.MOVE_MAGE,
            playerId: '0',
            payload: { toZoneId: ARENA_ZONE_IDS.A2 },
        })).toBe('playerStunned');
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.GUARD,
            playerId: '0',
            payload: {},
        })).toBe('playerStunned');
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_ATTACK,
            playerId: '0',
            payload: { targetPlayerId: '1' },
        })).toBe('playerStunned');
    });

    it('prevents stunned mages from casting attack spells', () => {
        const attackSpellId = 1710;
        const planned = runCommand(setupState('planning'), planCommand([attackSpellId]));
        const state: MatchState<MageWarsCore> = {
            core: {
                ...withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.A2),
                players: {
                    ...planned.state.core.players,
                    '0': {
                        ...planned.state.core.players['0'],
                        statusTokens: {
                            [STATUS_TOKEN_IDS.STUN]: 1,
                        },
                    },
                    '1': {
                        ...planned.state.core.players['1'],
                        mageZoneId: ARENA_ZONE_IDS.A2,
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: attackSpellId,
                manaCost: 4,
                targetPlayerId: '1',
            },
        })).toBe('playerStunnedCannotCastAttackSpell');
    });

    it('allows stunned mages to use actions for non-attack quick spells but not standard spells', () => {
        const quickHealingSpellId = 3402;
        const standardHealingSpellId = 3405;
        const quickPlanned = runCommand(setupState('planning'), planCommand([quickHealingSpellId]));
        const woundedCat = makeArenaObject('cat-0', '0', PLAYER_ZERO_START_ZONE, {
            damage: 2,
        });
        const stunnedQuickState: MatchState<MageWarsCore> = {
            core: withArenaObject({
                ...quickPlanned.state.core,
                players: {
                    ...quickPlanned.state.core.players,
                    '0': {
                        ...quickPlanned.state.core.players['0'],
                        statusTokens: {
                            [STATUS_TOKEN_IDS.STUN]: 1,
                        },
                    },
                },
            }, woundedCat),
            sys: { ...quickPlanned.state.sys, phase: 'creatureAction' },
        };

        const quickCast = runCommand(stunnedQuickState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: quickHealingSpellId,
                manaCost: 5,
                targetObjectId: woundedCat.id,
            },
        });

        expect(quickCast.success).toBe(true);
        expect(quickCast.state.core.objects[woundedCat.id].damage).toBe(0);
        expect(quickCast.state.core.players['0']).toMatchObject({
            actionReady: false,
            quickcastReady: true,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });

        const standardPlanned = runCommand(setupState('planning'), planCommand([standardHealingSpellId]));
        const stunnedStandardState: MatchState<MageWarsCore> = {
            core: {
                ...standardPlanned.state.core,
                players: {
                    ...standardPlanned.state.core.players,
                    '0': {
                        ...standardPlanned.state.core.players['0'],
                        statusTokens: {
                            [STATUS_TOKEN_IDS.STUN]: 1,
                        },
                    },
                },
            },
            sys: { ...standardPlanned.state.sys, phase: 'creatureAction' },
        };

        expect(validateCommand(stunnedStandardState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: standardHealingSpellId,
                manaCost: 9,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        })).toBe('playerStunnedCannotCastStandardSpell');
    });

    it('declares same-zone melee attacks through the damage pipeline and closes gameover', () => {
        const baseState = setupState('creatureAction');
        const defenderLife = baseState.core.players['1'].life;
        const state: MatchState<MageWarsCore> = {
            core: {
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '1': {
                        ...baseState.core.players['1'],
                        mageZoneId: PLAYER_ZERO_START_ZONE,
                        damage: defenderLife - 8,
                    },
                },
                arena: baseState.core.arena.map((zone) => {
                    if (zone.id === PLAYER_ZERO_START_ZONE) {
                        return { ...zone, occupantIds: ['0', '1'] };
                    }
                    if (zone.id === PLAYER_ONE_START_ZONE) {
                        return { ...zone, occupantIds: [] };
                    }
                    return zone;
                }),
            },
            sys: baseState.sys,
        };

        expect(validateCommand(baseState, {
            type: MAGE_WARS_COMMANDS.DECLARE_ATTACK,
            playerId: '0',
            payload: { targetPlayerId: '1' },
        })).toBe('targetNotInSameZone');

        const attack = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_ATTACK,
            playerId: '0',
            payload: { targetPlayerId: '1' },
        });

        expect(attack.success).toBe(true);
        expect(attack.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.ATTACK_DECLARED,
            'DAMAGE_DEALT',
            MAGE_WARS_EVENTS.MAGE_DEFEATED,
        ]));
        expect(attack.state.core.players['0'].actionReady).toBe(false);
        expect(attack.state.core.players['1'].damage).toBe(defenderLife);
        expect(attack.state.core.gameResult).toEqual({ winner: '0' });
        expect(attack.state.sys.gameover).toEqual({ winner: '0' });
        expect(attack.state.sys.undo.snapshots).toHaveLength(1);
        expect(actionLogKinds(attack.state)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.ATTACK_DECLARED,
            'DAMAGE_DEALT',
            MAGE_WARS_EVENTS.MAGE_DEFEATED,
        ]));
    });

    it('charges Mental Calm before the defense window and records the source for the round', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('mental-calm-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const target = makeArenaObject('mental-calm-defense-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            attackOrTraitLine: CAT_ATTACK_WITH_DEFENSE_LINE,
        });
        const enchantment = makeMentalCalmEnchantmentObject(
            'mental-calm-enchantment-1912',
            '0',
            PLAYER_ZERO_START_ZONE,
            attacker.id,
        );
        const core = {
            ...baseState.core,
            players: {
                ...baseState.core.players,
                '0': { ...baseState.core.players['0'], mana: 5 },
            },
        };
        const attacked = runCommand({
            core: [attacker, target, enchantment].reduce(withArenaObject, core),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const eventTypes = attacked.events.map((event) => event.type);

        expect(attacked.success).toBe(true);
        expect(eventTypes).toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(eventTypes).toContain(MAGE_WARS_EVENTS.MENTAL_CALM_TRIGGERED);
        expect(eventTypes).toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(eventTypes.indexOf(MAGE_WARS_EVENTS.MANA_SPENT)).toBeLessThan(
            eventTypes.indexOf(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE),
        );
        expect(eventTypes.indexOf(MAGE_WARS_EVENTS.MENTAL_CALM_TRIGGERED)).toBeLessThan(
            eventTypes.indexOf(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE),
        );
        expect(attacked.state.core.players['0'].mana).toBe(3);
        expect(attacked.state.core.objects[enchantment.id]).toMatchObject({
            mentalCalmRoundNumber: attacked.state.core.turnNumber,
            mentalCalmAttackerObjectIdsThisRound: [attacker.id],
        });
        expect(attacked.state.core.objects[attacker.id].actionReady).toBe(false);
    });

    it('cancels Mental Calm attacks without enough mana while consuming the attack action', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('mental-calm-insufficient-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const target = makeArenaObject('mental-calm-insufficient-target-1', '1', PLAYER_ZERO_START_ZONE, { life: 20 });
        const enchantment = makeMentalCalmEnchantmentObject(
            'mental-calm-insufficient-enchantment-1912',
            '0',
            PLAYER_ZERO_START_ZONE,
            attacker.id,
        );
        const core = {
            ...baseState.core,
            players: {
                ...baseState.core.players,
                '0': { ...baseState.core.players['0'], mana: 1 },
            },
        };
        const attacked = runCommand({
            core: [attacker, target, enchantment].reduce(withArenaObject, core),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const attackEvent = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(attacked.success).toBe(true);
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.MENTAL_CALM_TRIGGERED);
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(attacked.events.map((event) => event.type)).not.toContain('DAMAGE_DEALT');
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ATTACK_MISSED);
        expect(attackEvent).toMatchObject({ payload: { diceResults: [], baseDamage: 0 } });
        expect(attacked.state.core.players['0'].mana).toBe(1);
        expect(attacked.state.core.objects[attacker.id].actionReady).toBe(false);
        expect(attacked.state.core.objects[enchantment.id].mentalCalmAttackerObjectIdsThisRound).toEqual([attacker.id]);
    });

    it('charges Mental Calm once per source and becomes available again in a new round', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('mental-calm-round-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const target = makeArenaObject('mental-calm-round-target-1', '1', PLAYER_ZERO_START_ZONE, { life: 40 });
        const enchantment = makeMentalCalmEnchantmentObject(
            'mental-calm-round-enchantment-1912',
            '0',
            PLAYER_ZERO_START_ZONE,
            attacker.id,
        );
        const secondEnchantment = makeMentalCalmEnchantmentObject(
            'mental-calm-round-enchantment-1912-second',
            '0',
            PLAYER_ZERO_START_ZONE,
            attacker.id,
        );
        const core = {
            ...baseState.core,
            players: {
                ...baseState.core.players,
                '0': { ...baseState.core.players['0'], mana: 8 },
            },
        };
        const first = runCommand({
            core: [attacker, target, enchantment, secondEnchantment].reduce(withArenaObject, core),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const sameRound = runCommand({
            core: {
                ...first.state.core,
                currentPlayerId: '0',
                objects: {
                    ...first.state.core.objects,
                    [attacker.id]: { ...first.state.core.objects[attacker.id], actionReady: true },
                },
            },
            sys: first.state.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const nextRoundCore = reduceEvent(first.state.core, {
            type: MAGE_WARS_EVENTS.TURN_ADVANCED,
            payload: { fromPlayerId: '0', toPlayerId: '0', turnNumber: first.state.core.turnNumber + 1 },
            sourceCommandType: 'test',
            timestamp: 1,
        });
        const nextRound = runCommand({
            core: {
                ...nextRoundCore,
                currentPlayerId: '0',
                objects: {
                    ...nextRoundCore.objects,
                    [attacker.id]: { ...nextRoundCore.objects[attacker.id], actionReady: true },
                },
            },
            sys: first.state.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });

        expect(first.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(first.state.core.players['0'].mana).toBe(4);
        expect(sameRound.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(sameRound.state.core.players['0'].mana).toBe(first.state.core.players['0'].mana);
        expect(nextRound.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(nextRound.state.core.players['0'].mana).toBe(first.state.core.players['0'].mana - 4);
    });

    it('applies Mental Calm to ranged attacks but excludes counterstrikes', () => {
        const baseState = setupState('creatureAction');
        const rangedAttacker = makeArenaObject('mental-calm-ranged-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2816,
            sourceObjectId: 'spell-card-2816',
            attackOrTraitLine: '长弓：完整行动远程 `0-2` 4 骰',
        });
        const rangedTarget = makeArenaObject('mental-calm-ranged-target-1', '1', ARENA_ZONE_IDS.B2, { life: 20 });
        const rangedEnchantment = makeMentalCalmEnchantmentObject(
            'mental-calm-ranged-enchantment-1912',
            '0',
            PLAYER_ZERO_START_ZONE,
            rangedAttacker.id,
        );
        const ranged = runCommand({
            core: [rangedAttacker, rangedTarget, rangedEnchantment].reduce(withArenaObject, {
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '0': { ...baseState.core.players['0'], mana: 4 },
                },
            }),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: rangedAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: rangedTarget.id,
            },
        });

        const counterAttacker = makeArenaObject('mental-calm-counter-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const counterTarget = makeArenaObject('mental-calm-counter-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const counterstrikeEnchantment = makeCounterstrikeEnchantmentObject(
            'mental-calm-counterstrike-1903',
            '1',
            PLAYER_ZERO_START_ZONE,
            counterTarget.id,
        );
        const counterMentalCalm = makeMentalCalmEnchantmentObject(
            'mental-calm-counter-1912',
            '1',
            PLAYER_ZERO_START_ZONE,
            counterTarget.id,
        );
        const incoming = runCommand({
            core: [counterAttacker, counterTarget, counterstrikeEnchantment, counterMentalCalm].reduce(withArenaObject, {
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '1': { ...baseState.core.players['1'], mana: 2 },
                },
            }),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: counterAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: counterTarget.id,
            },
        });
        const counterstruck = runCommand(incoming.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: incoming.state.sys.interaction.current?.id,
                optionId: 'counterstrike',
            },
        } as Command);

        expect(ranged.success).toBe(true);
        expect(ranged.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(counterstruck.success).toBe(true);
        expect(counterstruck.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(counterstruck.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.MENTAL_CALM_TRIGGERED);
        expect(counterstruck.state.core.players['1'].mana).toBe(2);
    });

    it('charges Suppression Cloak before a creature melee attack and only once per attacker each round', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('suppression-cloak-attacker-0', '0', PLAYER_ONE_START_ZONE);
        const cloak = makeSuppressionCloakEquipmentObject(
            'suppression-cloak-3705',
            '1',
            PLAYER_ONE_START_ZONE,
        );
        const core = {
            ...baseState.core,
            players: {
                ...baseState.core.players,
                '0': { ...baseState.core.players['0'], mana: 5 },
            },
        };
        const attacked = runCommand({
            core: [attacker, cloak].reduce(withArenaObject, core),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MANA_SPENT,
                payload: expect.objectContaining({ amount: 2, spellCardId: 3705 }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MELEE_ATTACK_MANA_TAX_TRIGGERED,
                payload: expect.objectContaining({
                    attackerObjectId: attacker.id,
                    targetPlayerId: '1',
                    sourceObjectIds: [cloak.id],
                    requiredMana: 2,
                }),
            }),
        ]));
        expect(attacked.state.core.players['0'].mana).toBe(3);
        expect(attacked.state.core.objects[cloak.id]).toMatchObject({
            meleeAttackManaTaxRoundNumber: attacked.state.core.turnNumber,
            meleeAttackManaTaxAttackerObjectIdsThisRound: [attacker.id],
        });

        const sameRound = runCommand({
            core: {
                ...attacked.state.core,
                objects: {
                    ...attacked.state.core.objects,
                    [attacker.id]: { ...attacked.state.core.objects[attacker.id], actionReady: true },
                },
            },
            sys: attacked.state.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(sameRound.success).toBe(true);
        expect(sameRound.events.map((event) => event.type)).not.toContain(
            MAGE_WARS_EVENTS.MELEE_ATTACK_MANA_TAX_TRIGGERED,
        );
        expect(sameRound.state.core.players['0'].mana).toBe(3);
    });

    it('charges every Suppression Cloak source, resets in a new round, and stops after removal', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('suppression-cloak-sources-attacker-0', '0', PLAYER_ONE_START_ZONE);
        const firstCloak = makeSuppressionCloakEquipmentObject(
            'suppression-cloak-sources-first-3705',
            '1',
            PLAYER_ONE_START_ZONE,
        );
        const secondCloak = makeSuppressionCloakEquipmentObject(
            'suppression-cloak-sources-second-3705',
            '1',
            PLAYER_ONE_START_ZONE,
        );
        const initial = runCommand({
            core: [attacker, firstCloak, secondCloak].reduce(withArenaObject, {
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '0': { ...baseState.core.players['0'], mana: 8 },
                },
            }),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });
        const initialPayments = initial.events.filter((event) => event.type === MAGE_WARS_EVENTS.MANA_SPENT);
        expect(initialPayments).toHaveLength(2);
        expect(initial.state.core.players['0'].mana).toBe(4);

        const nextRoundCore = reduceEvent(initial.state.core, {
            type: MAGE_WARS_EVENTS.TURN_ADVANCED,
            payload: {
                fromPlayerId: '0',
                toPlayerId: '0',
                turnNumber: initial.state.core.turnNumber + 1,
            },
            sourceCommandType: 'test',
            timestamp: 1,
        });
        const objectsWithoutSecondCloak = { ...nextRoundCore.objects };
        delete objectsWithoutSecondCloak[secondCloak.id];
        const nextRound = runCommand({
            core: {
                ...nextRoundCore,
                objects: {
                    ...objectsWithoutSecondCloak,
                    [attacker.id]: { ...objectsWithoutSecondCloak[attacker.id], actionReady: true },
                },
                currentPlayerId: '0',
            },
            sys: initial.state.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(nextRound.success).toBe(true);
        expect(nextRound.events.filter((event) => event.type === MAGE_WARS_EVENTS.MANA_SPENT)).toHaveLength(1);
        expect(nextRound.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MELEE_ATTACK_MANA_TAX_TRIGGERED,
                payload: expect.objectContaining({ sourceObjectIds: [firstCloak.id], requiredMana: 2 }),
            }),
        ]));
        expect(nextRound.state.core.players['0'].mana).toBe(2);
    });

    it('cancels a Suppression Cloak attack without enough mana and records the attempted creature', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('suppression-cloak-insufficient-attacker-0', '0', PLAYER_ONE_START_ZONE);
        const cloak = makeSuppressionCloakEquipmentObject(
            'suppression-cloak-insufficient-3705',
            '1',
            PLAYER_ONE_START_ZONE,
        );
        const attacked = runCommand({
            core: [attacker, cloak].reduce(withArenaObject, {
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '0': { ...baseState.core.players['0'], mana: 1 },
                },
            }),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events.map((event) => event.type)).toContain(
            MAGE_WARS_EVENTS.MELEE_ATTACK_MANA_TAX_TRIGGERED,
        );
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ATTACK_MISSED);
        expect(attacked.events.some((event) => event.type === 'DAMAGE_DEALT')).toBe(false);
        expect(attacked.state.core.players['0'].mana).toBe(1);
        expect(attacked.state.core.objects[attacker.id].actionReady).toBe(false);
        expect(attacked.state.core.objects[cloak.id].meleeAttackManaTaxAttackerObjectIdsThisRound).toEqual([
            attacker.id,
        ]);
    });

    it('does not partially pay when Suppression Cloak and Mental Calm exceed available mana', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('suppression-cloak-combined-attacker-0', '0', PLAYER_ONE_START_ZONE);
        const cloak = makeSuppressionCloakEquipmentObject(
            'suppression-cloak-combined-3705',
            '1',
            PLAYER_ONE_START_ZONE,
        );
        const mentalCalm = makeMentalCalmEnchantmentObject(
            'suppression-cloak-combined-1912',
            '1',
            PLAYER_ONE_START_ZONE,
            attacker.id,
        );
        const attacked = runCommand({
            core: [attacker, cloak, mentalCalm].reduce(withArenaObject, {
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '0': { ...baseState.core.players['0'], mana: 3 },
                },
            }),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(attacked.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.MENTAL_CALM_TRIGGERED,
            MAGE_WARS_EVENTS.MELEE_ATTACK_MANA_TAX_TRIGGERED,
            MAGE_WARS_EVENTS.ATTACK_MISSED,
        ]));
        expect(attacked.state.core.players['0'].mana).toBe(3);
    });

    it('offers Offset Bracers as a structured mage defense and avoids a successful attack', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('offset-bracers-attacker-0', '0', PLAYER_ONE_START_ZONE);
        const bracers = makeArenaObject('offset-bracers-3715', '1', PLAYER_ONE_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: 3715,
            sourceObjectId: 'spell-3715',
            name: '偏移护腕',
            actionReady: false,
            attackOrTraitLine: undefined,
            rulesText: undefined,
            combatProfilesSource: 'config',
            anchoredToPlayerId: '1',
        });
        const waiting = runCommand({
            core: [attacker, bracers].reduce(withArenaObject, baseState.core),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(waiting.success).toBe(true);
        expect(waiting.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.DEFENSE_AVAILABLE,
                payload: expect.objectContaining({
                    attackerObjectId: attacker.id,
                    defenderId: '1',
                    defenseProfileIds: ['equipment-offset-bracers-3715-defense-0'],
                }),
            }),
        ]));
        const defended = runCommand(waiting.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: waiting.state.sys.interaction.current?.id,
                optionId: 'defend-equipment-offset-bracers-3715-defense-0',
            },
        } as Command, {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 8 : fixedRandom.d(sides)),
        });

        expect(defended.success).toBe(true);
        expect(defended.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MAGE_DEFENSE_ROLLED,
                payload: expect.objectContaining({
                    defenderId: '1',
                    defenseMinRoll: 7,
                    success: true,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: expect.objectContaining({
                    targetPlayerId: '1',
                    defenseProfileId: 'equipment-offset-bracers-3715-defense-0',
                }),
            }),
        ]));
        expect(defended.events.some((event) => event.type === 'DAMAGE_DEALT')).toBe(false);
        expect(defended.state.core.players['1'].defenseUsesThisRound).toEqual({
            'equipment-offset-bracers-3715-defense-0': 1,
        });
        const objectsWithoutBracers = { ...defended.state.core.objects };
        delete objectsWithoutBracers[bracers.id];
        expect(getMageWarsPlayerDefenseProfiles(
            { ...defended.state.core, objects: objectsWithoutBracers },
            defended.state.core.players['1'],
        )).toEqual([]);
    });

    it('resumes the original attack after a failed Offset Bracers defense and resets it next round', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('offset-bracers-fail-attacker-0', '0', PLAYER_ONE_START_ZONE);
        const bracers = makeArenaObject('offset-bracers-fail-3715', '1', PLAYER_ONE_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: 3715,
            sourceObjectId: 'spell-3715',
            name: '偏移护腕',
            actionReady: false,
            attackOrTraitLine: undefined,
            rulesText: undefined,
            combatProfilesSource: 'config',
            anchoredToPlayerId: '1',
        });
        const waiting = runCommand({
            core: [attacker, bracers].reduce(withArenaObject, baseState.core),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });
        const failed = runCommand(waiting.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: waiting.state.sys.interaction.current?.id,
                optionId: 'defend-equipment-offset-bracers-fail-3715-defense-0',
            },
        } as Command);

        expect(failed.success).toBe(true);
        expect(failed.events.filter((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED)).toHaveLength(1);
        expect(failed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MAGE_DEFENSE_ROLLED,
                payload: expect.objectContaining({ success: false }),
            }),
            expect.objectContaining({ type: 'DAMAGE_DEALT' }),
        ]));
        expect(failed.state.core.players['1'].defenseUsesThisRound).toMatchObject({
            'equipment-offset-bracers-fail-3715-defense-0': 1,
        });

        const reset = reduceEvent(failed.state.core, {
            type: MAGE_WARS_EVENTS.ACTION_READINESS_RESET,
            payload: { playerId: '1' },
            sourceCommandType: 'test',
            timestamp: 1,
        });
        expect(reset.players['1'].defenseUsesThisRound).toBeUndefined();
    });

    it('uses the same mage defense window for a basic mage attack and an attack spell', () => {
        const baseState = setupState('creatureAction');
        const bracers = makeArenaObject('offset-bracers-shared-3715', '1', PLAYER_ONE_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: 3715,
            sourceObjectId: 'spell-3715',
            name: '偏移护腕',
            actionReady: false,
            attackOrTraitLine: undefined,
            rulesText: undefined,
            combatProfilesSource: 'config',
            anchoredToPlayerId: '1',
        });
        const basic = runCommand({
            core: withArenaObject(withPlayerInZone(baseState.core, '0', PLAYER_ONE_START_ZONE), bracers),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_ATTACK,
            playerId: '0',
            payload: { targetPlayerId: '1' },
        });
        expect(basic.success).toBe(true);
        expect(basic.state.sys.interaction.current?.data.sourceId).toBe('mw.defense.choice');
        expect(basic.state.sys.interaction.current?.data.options).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'defend-equipment-offset-bracers-shared-3715-defense-0' }),
        ]));

        const spellState = {
            core: withArenaObject(
                withPreparedPlayerMage(
                    withPlayerInZone(baseState.core, '0', ARENA_ZONE_IDS.C1),
                    '0',
                    MAGE_IDS.WIZARD_APPRENTICE,
                    [1705],
                    20,
                ),
                bracers,
            ),
            sys: { ...baseState.sys, phase: 'finalQuickcast' as const },
        };
        const spell = runCommand(spellState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 1705,
                manaCost: 8,
                targetPlayerId: '1',
            },
        });
        expect(spell.success).toBe(true);
        expect(spell.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.DEFENSE_AVAILABLE,
                payload: expect.objectContaining({
                    attackerId: '0',
                    defenderId: '1',
                    spellCardId: 1705,
                }),
            }),
        ]));
        const defendedSpell = runCommand(spell.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: spell.state.sys.interaction.current?.id,
                optionId: 'defend-equipment-offset-bracers-shared-3715-defense-0',
            },
        } as Command, {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 8 : fixedRandom.d(sides)),
        });
        expect(defendedSpell.success).toBe(true);
        expect(defendedSpell.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.MAGE_DEFENSE_ROLLED);
        expect(defendedSpell.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ATTACK_MISSED);
        expect(defendedSpell.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED);
        expect(defendedSpell.state.core.players['0'].mana).toBe(12);
    });

    it('triggers Demon Cuirass after an object melee attack and ignores attacker armor', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('demon-cuirass-object-attacker', '0', PLAYER_ONE_START_ZONE, {
            life: 10,
            armor: 5,
        });
        const cuirass = makeDemonCuirassEquipmentObject(
            'demon-cuirass-3700-object',
            '1',
            PLAYER_ONE_START_ZONE,
        );
        const attacked = runCommand({
            core: [attacker, cuirass].reduce(withArenaObject, baseState.core),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        const barrierDamage = attacked.events.find((event) => (
            event.type === 'DAMAGE_DEALT'
            && event.payload.sourceAbilityId === 'mw.equipment.3700.damage-barrier'
        ));
        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.DAMAGE_BARRIER_TRIGGERED,
                payload: expect.objectContaining({
                    sourceObjectId: cuirass.id,
                    attackerObjectId: attacker.id,
                    diceResults: [3],
                    damageTypes: ['aether'],
                    unavoidable: true,
                    lethal: true,
                }),
            }),
        ]));
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE);
        expect(barrierDamage).toMatchObject({
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: attacker.id,
                actualDamage: 3,
            },
        });
        expect(attacked.state.core.objects[attacker.id].damage).toBe(3);
        expect(attacked.state.core.players['1'].damage).toBe(6);
        expect(attacked.state.core.objects[cuirass.id]).toMatchObject({
            damageBarrierRoundNumber: attacked.state.core.turnNumber,
            damageBarrierAttackerIdsThisRound: [attacker.id],
        });
    });

    it('can defeat the attacking object with Demon Cuirass lethal damage', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('demon-cuirass-defeated-attacker', '0', PLAYER_ONE_START_ZONE, {
            life: 2,
        });
        const cuirass = makeDemonCuirassEquipmentObject(
            'demon-cuirass-3700-defeat',
            '1',
            PLAYER_ONE_START_ZONE,
        );
        const attacked = runCommand({
            core: [attacker, cuirass].reduce(withArenaObject, baseState.core),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: attacker.id,
                    sourceAbilityId: 'mw.equipment.3700.damage-barrier',
                }),
            }),
        ]));
        expect(attacked.state.core.objects[attacker.id]).toBeUndefined();
    });

    it('triggers Demon Cuirass after a successful mage basic melee attack', () => {
        const baseState = setupState('creatureAction');
        const cuirass = makeDemonCuirassEquipmentObject(
            'demon-cuirass-3700-mage',
            '1',
            PLAYER_ONE_START_ZONE,
        );
        const core = withArenaObject(
            withPlayerInZone(baseState.core, '0', PLAYER_ONE_START_ZONE),
            cuirass,
        );
        const attacked = runCommand({ core, sys: baseState.sys }, {
            type: MAGE_WARS_COMMANDS.DECLARE_ATTACK,
            playerId: '0',
            payload: { targetPlayerId: '1' },
        });

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.DAMAGE_BARRIER_TRIGGERED,
                payload: expect.objectContaining({
                    sourceObjectId: cuirass.id,
                    attackerId: '0',
                    diceResults: [3],
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: '0',
                    actualDamage: 3,
                    sourceAbilityId: 'mw.equipment.3700.damage-barrier',
                }),
            }),
        ]));
        expect(attacked.state.core.players['0'].damage).toBe(3);
        expect(attacked.state.core.players['1'].damage).toBe(9);
    });

    it('does not trigger Demon Cuirass for an attack spell', () => {
        const baseState = setupState('initiativeQuickcast');
        const cuirass = makeDemonCuirassEquipmentObject(
            'demon-cuirass-3700-spell',
            '1',
            PLAYER_ONE_START_ZONE,
        );
        const core = withArenaObject(
            withPreparedPlayerMage(
                withPlayerInZone(baseState.core, '0', PLAYER_ONE_START_ZONE),
                '0',
                MAGE_IDS.WARLOCK_APPRENTICE,
                [1702],
            ),
            cuirass,
        );
        const cast = runCommand({ core, sys: baseState.sys }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 1702,
                manaCost: 5,
                targetPlayerId: '1',
            },
        });

        expect(cast.success).toBe(true);
        expect(cast.events.map((event) => event.type)).not.toContain(
            MAGE_WARS_EVENTS.DAMAGE_BARRIER_TRIGGERED,
        );
        expect(cast.events.filter((event) => event.type === 'DAMAGE_DEALT')).toHaveLength(1);
    });

    it('uses a Demon Cuirass barrier once per attacker per round and restores it next round', () => {
        const baseState = setupState('creatureAction');
        const attacker = makeArenaObject('demon-cuirass-round-attacker', '0', PLAYER_ONE_START_ZONE, {
            life: 10,
        });
        const cuirass = makeDemonCuirassEquipmentObject(
            'demon-cuirass-3700-round',
            '1',
            PLAYER_ONE_START_ZONE,
        );
        const first = runCommand({
            core: [attacker, cuirass].reduce(withArenaObject, baseState.core),
            sys: baseState.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });
        const sameRound = runCommand({
            core: {
                ...first.state.core,
                objects: {
                    ...first.state.core.objects,
                    [attacker.id]: { ...first.state.core.objects[attacker.id], actionReady: true },
                },
            },
            sys: first.state.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });
        const nextRoundCore = reduceEvent(first.state.core, {
            type: MAGE_WARS_EVENTS.TURN_ADVANCED,
            payload: {
                fromPlayerId: '0',
                toPlayerId: '0',
                turnNumber: first.state.core.turnNumber + 1,
            },
            sourceCommandType: 'test',
            timestamp: 1,
        });
        const nextRound = runCommand({
            core: {
                ...nextRoundCore,
                objects: {
                    ...nextRoundCore.objects,
                    [attacker.id]: { ...nextRoundCore.objects[attacker.id], actionReady: true },
                },
            },
            sys: sameRound.state.sys,
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(first.events.filter((event) => event.type === MAGE_WARS_EVENTS.DAMAGE_BARRIER_TRIGGERED)).toHaveLength(1);
        expect(sameRound.events.filter((event) => event.type === MAGE_WARS_EVENTS.DAMAGE_BARRIER_TRIGGERED)).toHaveLength(0);
        expect(nextRound.events.filter((event) => event.type === MAGE_WARS_EVENTS.DAMAGE_BARRIER_TRIGGERED)).toHaveLength(1);
    });

    it('binds an attack spell when Elemental Staff is cast without mixing it into the discard pile', () => {
        const planningState = setupState('planning');
        const wizardState = {
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        };
        const planned = runCommand(wizardState, planCommand([3716]));
        const cast = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 3716,
                manaCost: 5,
                targetPlayerId: '0',
                boundSpellCardId: 1704,
            },
        });

        const staff = Object.values(cast.state.core.objects).find((object) => object.sourceSpellCardId === 3716);
        expect(planned.success).toBe(true);
        expect(cast.success).toBe(true);
        expect(staff).toMatchObject({
            kind: 'equipment',
            anchoredToPlayerId: '0',
            boundSpellCardId: 1704,
        });
        expect(cast.state.core.players['0'].discardSpellCardIds).toEqual([3716]);
        expect(cast.state.core.players['0'].discardSpellCardIds).not.toContain(1704);
    });

    it('allows Elemental Staff to enter play without a binding', () => {
        const planningState = setupState('planning');
        const wizardState = {
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.WIZARD_APPRENTICE),
            sys: planningState.sys,
        };
        const planned = runCommand(wizardState, planCommand([3716]));
        const cast = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 3716,
                manaCost: 5,
                targetPlayerId: '0',
            },
        });

        const staff = Object.values(cast.state.core.objects).find((object) => object.sourceSpellCardId === 3716);
        expect(cast.success).toBe(true);
        expect(staff?.boundSpellCardId).toBeUndefined();
    });

    it('replaces Elemental Staff binding as a quick spell and charges exactly three mana', () => {
        const baseState = setupState('finalQuickcast');
        const wizardCore = withPlayerMage(baseState.core, '0', MAGE_IDS.WIZARD_APPRENTICE);
        const staff = makeArenaObject('elemental-staff-0', '0', PLAYER_ZERO_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: 3716,
            sourceObjectId: 'spell-card-3716',
            name: '元素魔杖',
            actionReady: false,
            attackOrTraitLine: '法术绑定',
            rulesText: '你可以从你的法术书中绑定一个非史诗攻击类法术到元素魔杖上。',
            anchoredToPlayerId: '0',
            boundSpellCardId: 1704,
        });
        const core = withArenaObject({
            ...wizardCore,
            players: {
                ...wizardCore.players,
                '0': {
                    ...wizardCore.players['0'],
                    mana: 10,
                    quickcastReady: true,
                    discardSpellCardIds: [],
                },
            },
        }, staff);
        const replaced = runCommand({ core, sys: baseState.sys }, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: staff.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
                manaCost: 3,
                boundSpellCardId: 1705,
            },
        });

        expect(replaced.success).toBe(true);
        expect(replaced.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
                payload: expect.objectContaining({
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
                    boundSpellCardId: 1705,
                    manaCost: 3,
                    actionTrack: 'quickcast',
                }),
            }),
        ]));
        expect(replaced.state.core.objects[staff.id].boundSpellCardId).toBe(1705);
        expect(replaced.state.core.players['0'].mana).toBe(7);
        expect(replaced.state.core.players['0'].quickcastReady).toBe(false);
        expect(replaced.state.core.players['0'].discardSpellCardIds).toEqual([]);
    });

    it('rejects Elemental Staff binding for non-attack spells and outside the quickcast phase', () => {
        const baseState = setupState('creatureAction');
        const wizardCore = withPlayerMage(baseState.core, '0', MAGE_IDS.WIZARD_APPRENTICE);
        const staff = makeArenaObject('elemental-staff-invalid', '0', PLAYER_ZERO_START_ZONE, {
            kind: 'equipment',
            sourceSpellCardId: 3716,
            sourceObjectId: 'spell-card-3716',
            name: '元素魔杖',
            actionReady: false,
            anchoredToPlayerId: '0',
            boundSpellCardId: 1704,
        });
        const state = {
            core: withArenaObject({
                ...wizardCore,
                players: {
                    ...wizardCore.players,
                    '0': { ...wizardCore.players['0'], mana: 10, quickcastReady: true },
                },
            }, staff),
            sys: baseState.sys,
        };
        const command = {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: staff.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
                manaCost: 3,
                boundSpellCardId: 1806,
            },
        } satisfies MageWarsCommand;

        expect(validateCommand(state, command)).toBe('wrongPhase');
        expect(validateCommand({
            ...state,
            sys: { ...state.sys, phase: 'finalQuickcast' },
        }, command)).toBe('invalidBoundSpell');
        expect(validateCommand({
            ...state,
            sys: { ...state.sys, phase: 'finalQuickcast' },
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': { ...state.core.players['0'], mana: 2 },
                },
            },
        }, {
            ...command,
            payload: { ...command.payload, boundSpellCardId: 1705 },
        })).toBe('insufficientMana');
        expect(validateCommand({
            ...state,
            sys: { ...state.sys, phase: 'finalQuickcast' },
        }, {
            ...command,
            payload: { ...command.payload, objectId: 'not-my-staff', boundSpellCardId: 1705 },
        })).toBe('invalidArenaObjectAbilitySource');
        expect(validateCommand({
            ...state,
            sys: { ...state.sys, phase: 'finalQuickcast' },
        }, {
            ...command,
            payload: { ...command.payload, boundSpellCardId: 1704 },
        })).toBe('sameBoundSpell');
    });
});
