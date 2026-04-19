/**
 * 大杀四方 (Smash Up) - 冒烟测试
 *
 * 覆盖：setup、派系选择、出牌、阶段推进
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { postProcessSystemEvents } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems, createInitialSystemState } from '../../../engine';
import { resolveNextLocalAiAction } from '../../../engine/ai';
import { resolveAiDifficultyProfile } from '../../../engine/ai/difficulty';
import { createSimpleChoice, INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import { executePipeline } from '../../../engine/pipeline';
import type { CardsDrawnEvent, SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { MADNESS_CARD_DEF_ID, SU_COMMANDS, SU_EVENTS, getCurrentPlayerId } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { getTitanDef } from '../data/cards';
import { TITAN_CARD_DEFS } from '../data/titans';
import { getPlayerEffectivePowerOnBase, getRegisteredModifierIds, getTitanPowerContribution } from '../domain/ongoingModifiers';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { addPowerCounter, buildPlayerTargetOptions } from '../domain/abilityHelpers';
import { uncoverBuriedCard } from '../domain/bury';
import { collectTriggers, fireTriggers, interceptEvent } from '../domain/ongoingEffects';
import { getTriggerExecutor } from '../domain/triggerExecutors';
import { filterProtectedDestroyEvents, filterProtectedMoveEvents, filterProtectedReturnEvents, processAffectTriggers, processMoveTriggers, processReturnToHandTriggers } from '../domain/reducer';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { initAllAbilities } from '../abilities';
import { createSmashUpEventSystem } from '../domain/systems';
import { findInteractionOption, getInteractionsFromMS, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState, resolveInteractionChain } from './helpers';
import { runCommand } from './testRunner';
import type { TitanState } from '../domain/types';
import { buildSmashUpAiLegalActions, smashUpAiRuntime } from '../ai';
import { startDuel } from '../domain/duel';
import { getSmashUpCardPreviewMeta } from '../ui/cardPreviewHelper';
import engineConfig from '../game';

const PLAYER_IDS = ['0', '1'];
const FIXED_RANDOM = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

beforeAll(() => {
    initAllAbilities();
});

function createRunner(
    playerIdsOrSetupData: string[] | Record<string, unknown> = PLAYER_IDS,
    maybeSetupData?: Record<string, unknown>,
) {
    const playerIds = Array.isArray(playerIdsOrSetupData) ? playerIdsOrSetupData : PLAYER_IDS;
    const setupData = Array.isArray(playerIdsOrSetupData) ? maybeSetupData : playerIdsOrSetupData;
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
    ];
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems,
        playerIds,
        setup: (playerIds, random) => ({
            core: SmashUpDomain.setup(playerIds, random, setupData),
            sys: createInitialSystemState(playerIds, systems, undefined),
        }),
        silent: true,
    });
}

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
    }, FIXED_RANDOM);
}

/** 蛇形选秀命令序列（多轮 afterEvents 会自动推进 factionSelect → startTurn → playCards） */
const DRAFT_COMMANDS = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
];

describe('smashup', () => {
    it('setup 初始化正确（派系选择阶段）', () => {
        const runner = createRunner();
        const result = runner.run({ name: 'setup 验证', commands: [] });
        const core = result.finalState.core;

        expect(core.turnOrder).toEqual(PLAYER_IDS);
        expect(core.currentPlayerIndex).toBe(0);
        expect(core.turnNumber).toBe(1);
        expect(result.finalState.sys.phase).toBe('factionSelect');
        expect(core.factionSelection).toBeDefined();
        for (const pid of PLAYER_IDS) {
            expect(core.players[pid].hand.length).toBe(0);
            expect(core.players[pid].vp).toBe(0);
        }
        expect(core.bases.length).toBe(PLAYER_IDS.length + 1);
    });

    it('派系选择完成后初始化正确', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '派系选择 + 开始',
            commands: DRAFT_COMMANDS,
        });
        const core = result.finalState.core;

        for (const step of result.steps) {
            expect(step.success).toBe(true);
        }

        expect(result.finalState.sys.phase).toBe('playCards');
        expect(core.factionSelection).toBeUndefined();

        for (const pid of PLAYER_IDS) {
            expect(core.players[pid].hand.length).toBe(5);
        }

        expect(core.players['0'].factions).toEqual([SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS]);
        expect(core.players['1'].factions).toEqual([SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]);
    });

    it('选择带泰坦的派系后会初始化 set-aside 泰坦', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '带泰坦派系选秀',
            commands: titanDraft,
        });
        const titans = result.finalState.core.titans ?? [];

        expect(titans.map(titan => titan.defId).sort()).toEqual([
            'ghosts_creampuff_man',
            'tricksters_big_funny_giant',
            'vampires_ancient_lord',
            'wizards_arcane_protector',
        ].sort());
        expect(titans.every(titan => titan.location.zone === 'setaside')).toBe(true);
        expect(result.finalState.core.players['0'].deck.some(card => card.defId === 'wizards_arcane_protector')).toBe(false);
        expect(result.finalState.core.players['0'].hand.some(card => card.defId === 'wizards_arcane_protector')).toBe(false);
    });

    it('房间关闭 titans 扩展后不会初始化任何泰坦', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
        ];

        const runner = createRunner({
            expansions: [],
            setupSelections: {
                expansions: [],
            },
        });
        const result = runner.run({
            name: '关闭 titans 扩展后选秀',
            commands: titanDraft,
        });

        expect(result.finalState.core.enabledExpansions).toEqual([]);
        expect(result.finalState.core.titans ?? []).toEqual([]);
    });

    it('基地清场时泰坦回到牌库旁并清空指示物', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '为清场准备泰坦',
            commands: titanDraft,
        });

        const core = result.finalState.core;
        const targetTitan = (core.titans ?? []).find(titan => titan.defId === 'wizards_arcane_protector');
        expect(targetTitan).toBeDefined();

        const titanInPlayCore: SmashUpCore = {
            ...core,
            titans: (core.titans ?? []).map(titan => titan.uid !== targetTitan!.uid ? titan : ({
                ...titan,
                controllerId: '0',
                powerCounters: 3,
                talentUsed: true,
                location: { zone: 'base', baseIndex: 0, enteredAt: 42 },
            })),
        };

        const cleared = SmashUpDomain.reduce(titanInPlayCore, {
            type: SU_EVENTS.BASE_CLEARED,
            payload: {
                baseIndex: 0,
                baseDefId: titanInPlayCore.bases[0].defId,
            },
            timestamp: 100,
        } as SmashUpEvent);

        const clearedTitan = (cleared.titans ?? []).find(titan => titan.uid === targetTitan!.uid);
        expect(clearedTitan?.location.zone).toBe('setaside');
        expect(clearedTitan?.controllerId).toBe('0');
        expect(clearedTitan?.powerCounters).toBe(0);
        expect(clearedTitan?.talentUsed).toBe(false);
    });

    it('第二个泰坦进入标准基地时触发 clash，平局保留先在场者', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '为 clash 准备泰坦',
            commands: titanDraft,
        });
        const core = result.finalState.core;
        const firstTitan = (core.titans ?? []).find(titan => titan.defId === 'wizards_arcane_protector');
        const secondTitan = (core.titans ?? []).find(titan => titan.defId === 'ghosts_creampuff_man');
        expect(firstTitan).toBeDefined();
        expect(secondTitan).toBeDefined();

        const withFirstTitan = SmashUpDomain.reduce(core, {
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: firstTitan!.uid,
                defId: firstTitan!.defId,
                ownerId: firstTitan!.ownerId,
                controllerId: firstTitan!.controllerId,
                baseIndex: 0,
                baseDefId: core.bases[0].defId,
                reason: 'test_first_titan',
            },
            timestamp: 10,
        } as SmashUpEvent);

        const secondTitanPlayed: SmashUpEvent = {
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: secondTitan!.uid,
                defId: secondTitan!.defId,
                ownerId: secondTitan!.ownerId,
                controllerId: secondTitan!.controllerId,
                baseIndex: 0,
                baseDefId: core.bases[0].defId,
                reason: 'test_second_titan',
            },
            timestamp: 20,
        } as SmashUpEvent;

        const post = postProcessSystemEvents(withFirstTitan, [secondTitanPlayed], FIXED_RANDOM);
        expect(post.events.map(event => event.type)).toContain(SU_EVENTS.TITAN_REMOVED_FROM_PLAY);

        const resolved = post.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), withFirstTitan);
        const firstAfter = (resolved.titans ?? []).find(titan => titan.uid === firstTitan!.uid);
        const secondAfter = (resolved.titans ?? []).find(titan => titan.uid === secondTitan!.uid);

        expect(firstAfter?.location.zone).toBe('base');
        expect(secondAfter?.location.zone).toBe('setaside');
    });

    it('奥术守护者满足条件后可通过 special 从牌库旁进场', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '奥术守护者进场',
            commands: titanDraft,
        });

        const core: SmashUpCore = {
            ...result.finalState.core,
            cardsPlayedThisTurn: 5,
        };
        const titan = (core.titans ?? []).find(candidate => candidate.defId === 'wizards_arcane_protector');
        expect(titan).toBeDefined();

        const command: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: titan!.uid, baseIndex: 0 },
            timestamp: 30,
        };

        const validation = SmashUpDomain.validate({ ...result.finalState, core }, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute({ ...result.finalState, core }, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        const playedTitan = (resolved.titans ?? []).find(candidate => candidate.uid === titan!.uid);
        expect(playedTitan?.location).toEqual({
            zone: 'base',
            baseIndex: 0,
            enteredAt: 30,
        });
    });

    it('奥术守护者在基地按手牌数量提供力量', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '奥术守护者力量贡献',
            commands: titanDraft,
        });
        const titan = (result.finalState.core.titans ?? []).find(candidate => candidate.defId === 'wizards_arcane_protector');
        expect(titan).toBeDefined();

        const onBase = SmashUpDomain.reduce(result.finalState.core, {
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: titan!.uid,
                defId: titan!.defId,
                ownerId: titan!.ownerId,
                controllerId: titan!.controllerId,
                baseIndex: 0,
                baseDefId: result.finalState.core.bases[0].defId,
                reason: 'test_arcane_protector_power',
            },
            timestamp: 40,
        } as SmashUpEvent);

        const withSevenCards: SmashUpCore = {
            ...onBase,
            players: {
                ...onBase.players,
                '0': {
                    ...onBase.players['0'],
                    hand: [
                        ...onBase.players['0'].hand,
                        { uid: 'extra-card-1', defId: onBase.players['0'].deck[0]?.defId ?? onBase.players['0'].hand[0].defId, type: 'action', owner: '0' },
                        { uid: 'extra-card-2', defId: onBase.players['0'].deck[1]?.defId ?? onBase.players['0'].hand[0].defId, type: 'action', owner: '0' },
                    ],
                },
            },
        };
        const withSixCards: SmashUpCore = {
            ...withSevenCards,
            players: {
                ...withSevenCards.players,
                '0': {
                    ...withSevenCards.players['0'],
                    hand: withSevenCards.players['0'].hand.slice(0, 6),
                },
            },
        };

        expect(getPlayerEffectivePowerOnBase(withSixCards, withSixCards.bases[0], 0, '0')).toBe(3);
        expect(getPlayerEffectivePowerOnBase(withSevenCards, withSevenCards.bases[0], 0, '0')).toBe(3);
    });

    it('奥术守护者使用天赋后抽 1 张牌并标记已使用', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '奥术守护者天赋',
            commands: titanDraft,
        });
        const titan = (result.finalState.core.titans ?? []).find(candidate => candidate.defId === 'wizards_arcane_protector');
        expect(titan).toBeDefined();

        const core = SmashUpDomain.reduce(result.finalState.core, {
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: titan!.uid,
                defId: titan!.defId,
                ownerId: titan!.ownerId,
                controllerId: titan!.controllerId,
                baseIndex: 0,
                baseDefId: result.finalState.core.bases[0].defId,
                reason: 'test_arcane_protector_talent_setup',
            },
            timestamp: 50,
        } as SmashUpEvent);

        const state = { ...result.finalState, core };
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: titan!.uid, baseIndex: 0 },
            timestamp: 60,
        };

        const validation = SmashUpDomain.validate(state, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.CARDS_DRAWN);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        const usedTitan = (resolved.titans ?? []).find(candidate => candidate.uid === titan!.uid);
        expect(usedTitan?.talentUsed).toBe(true);
        expect(resolved.players['0'].hand.length).toBe(core.players['0'].hand.length + 1);
        expect(resolved.players['0'].deck.length).toBe(core.players['0'].deck.length - 1);

        const secondValidation = SmashUpDomain.validate({ ...state, core: resolved }, command);
        expect(secondValidation).toEqual({
            valid: false,
            error: '本回合天赋已使用',
        });
    });

    it('奶油泡芙美人在你没有手牌时可通过 special 从牌库旁进场', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '奶油泡芙美人进场',
            commands: titanDraft,
        });

        const titan = (result.finalState.core.titans ?? []).find(candidate => candidate.defId === 'ghosts_creampuff_man');
        expect(titan).toBeDefined();

        const core: SmashUpCore = {
            ...result.finalState.core,
            players: {
                ...result.finalState.core.players,
                '0': {
                    ...result.finalState.core.players['0'],
                    hand: [],
                },
            },
        };

        const command: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: titan!.uid, baseIndex: 0 },
            timestamp: 61,
        };

        const validation = SmashUpDomain.validate({ ...result.finalState, core }, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute({ ...result.finalState, core }, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        const playedTitan = (resolved.titans ?? []).find(candidate => candidate.uid === titan!.uid);
        expect(playedTitan?.location).toEqual({
            zone: 'base',
            baseIndex: 0,
            enteredAt: 61,
        });
    });

    it('奶油泡芙美人在基地按手牌数提供力量，最低为 0', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '奶油泡芙美人力量修正',
            commands: titanDraft,
        });

        const titan = (result.finalState.core.titans ?? []).find(candidate => candidate.defId === 'ghosts_creampuff_man');
        expect(titan).toBeDefined();

        let core = SmashUpDomain.reduce(result.finalState.core, {
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: titan!.uid,
                defId: titan!.defId,
                ownerId: titan!.ownerId,
                controllerId: titan!.controllerId,
                baseIndex: 0,
                baseDefId: result.finalState.core.bases[0].defId,
                reason: 'test_creampuff_power_setup',
            },
            timestamp: 62,
        } as SmashUpEvent);

        core = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    hand: core.players['0'].hand.slice(0, 2),
                },
            },
        };
        expect(getPlayerEffectivePowerOnBase(core, core.bases[0], 0, '0')).toBe(3);

        const withLargeHand: SmashUpCore = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    hand: Array.from({ length: 6 }, (_, i) => ({
                        uid: `ghost-hand-${i}`,
                        defId: 'ghost_seance',
                        type: 'action' as const,
                        owner: '0' as const,
                    })),
                },
            },
        };
        expect(getPlayerEffectivePowerOnBase(withLargeHand, withLargeHand.bases[0], 0, '0')).toBe(0);
    });

    it('奶油泡芙美人天赋会弃 1 张牌，额外打出弃牌堆标准战术，并改放牌库底', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '奶油泡芙美人天赋',
            commands: titanDraft,
        });

        const titan = (result.finalState.core.titans ?? []).find(candidate => candidate.defId === 'ghosts_creampuff_man');
        expect(titan).toBeDefined();

        const preparedCore: SmashUpCore = {
            ...result.finalState.core,
            players: {
                ...result.finalState.core.players,
                '0': {
                    ...result.finalState.core.players['0'],
                    hand: [
                        { uid: 'ghost-cost', defId: 'ghost_ghost', type: 'minion', owner: '0' },
                        { uid: 'ghost-keep', defId: 'ghost_haunting', type: 'minion', owner: '0' },
                    ],
                    discard: [
                        ...result.finalState.core.players['0'].discard,
                        { uid: 'ghost-seance-discard', defId: 'ghost_seance', type: 'action', owner: '0' },
                    ],
                },
            },
            titans: (result.finalState.core.titans ?? []).map(candidate => candidate.uid !== titan!.uid ? candidate : ({
                ...candidate,
                controllerId: '0',
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 63 },
            })),
        };

        const state = { ...result.finalState, core: preparedCore };
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: titan!.uid, baseIndex: 0 },
            timestamp: 64,
        };

        const validation = SmashUpDomain.validate(state, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect((state.sys.interaction.current?.data as any)?.sourceId).toBe('titan_ghosts_creampuff_man_discard');

        const discardHandler = getInteractionHandler('titan_ghosts_creampuff_man_discard');
        expect(discardHandler).toBeDefined();
        const discardResolved = discardHandler!(
            state,
            '0',
            { cardUid: 'ghost-cost' },
            state.sys.interaction.current?.data as any,
            FIXED_RANDOM,
            65,
        );
        expect(discardResolved?.events.map(event => event.type)).toContain(SU_EVENTS.CARDS_DISCARDED);

        const coreAfterDiscard = (discardResolved?.events ?? []).reduce((acc, event) => SmashUpDomain.reduce(acc, event), preparedCore);
        const queuedPlayInteraction = discardResolved?.state.sys.interaction.queue?.[0];
        expect((queuedPlayInteraction?.data as any)?.sourceId).toBe('titan_ghosts_creampuff_man_play');
        const stateAfterDiscard = {
            ...discardResolved!.state,
            core: coreAfterDiscard,
            sys: {
                ...discardResolved!.state.sys,
                interaction: {
                    ...discardResolved!.state.sys.interaction,
                    current: queuedPlayInteraction,
                    queue: [],
                },
            },
        };

        const playHandler = getInteractionHandler('titan_ghosts_creampuff_man_play');
        expect(playHandler).toBeDefined();
        const playResolved = playHandler!(
            stateAfterDiscard,
            '0',
            { cardUid: 'ghost-seance-discard', defId: 'ghost_seance' },
            stateAfterDiscard.sys.interaction.current?.data as any,
            FIXED_RANDOM,
            66,
        );

        expect(playResolved?.events.map(event => event.type)).toContain(SU_EVENTS.ACTION_PLAYED);
        expect(playResolved?.events.map(event => event.type)).toContain(SU_EVENTS.CARD_TO_DECK_BOTTOM);

        const drawEvent = playResolved?.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as CardsDrawnEvent | undefined;
        expect(drawEvent?.payload.count).toBe(4);

        const resolvedCore = (playResolved?.events ?? []).reduce((acc, event) => SmashUpDomain.reduce(acc, event), coreAfterDiscard);
        expect(resolvedCore.players['0'].discard.some(card => card.uid === 'ghost-seance-discard')).toBe(false);
        expect(resolvedCore.players['0'].deck[resolvedCore.players['0'].deck.length - 1]?.uid).toBe('ghost-seance-discard');
    });

    it('狮身人面像会在你的回合开始时创建回收埋葬牌并进场的交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_pyramids',
                buriedCards: [{
                    uid: 'sphinx-start-buried',
                    defId: 'robot_warbot',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            })],
            titans: [{
                uid: 't-sphinx-setaside',
                defId: 'sphinx',
                faction: SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const result = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 80,
        });

        const prompt = result.matchState?.sys.interaction?.current as any;
        expect(prompt?.data?.sourceId).toBe('titan_sphinx_start_turn');
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'sphinx-start-buried');
        expect(option).toBeDefined();
        expect(option.displayMode).toBe('card');

        const handler = getInteractionHandler('titan_sphinx_start_turn');
        expect(handler).toBeDefined();
        const resolved = handler!(result.matchState!, '0', option.value, prompt.data, FIXED_RANDOM, 81);
        const finalCore = (resolved?.events ?? []).reduce(
            (acc, event) => SmashUpDomain.reduce(acc, event),
            resolved?.state.core ?? result.matchState!.core,
        );

        expect(finalCore.players['0'].hand.some(card => card.uid === 'sphinx-start-buried')).toBe(true);
        expect(finalCore.bases[0].buriedCards?.some(card => card.uid === 'sphinx-start-buried') ?? false).toBe(false);
        expect((finalCore.titans ?? []).find(candidate => candidate.uid === 't-sphinx-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('狮身人面像在其所在基地计分后会创建回收该基地埋葬牌的交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_pyramids',
                minions: [makeMinion('ally-score', 'ancient_egyptians_pharaoh', '0', 5)],
                buriedCards: [{
                    uid: 'sphinx-score-buried',
                    defId: 'robot_zapbot',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            })],
            titans: [{
                uid: 't-sphinx-live',
                defId: 'sphinx',
                faction: SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const result = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
            random: FIXED_RANDOM,
            now: 82,
        });

        const prompt = result.matchState?.sys.interaction?.current as any;
        expect(prompt?.data?.sourceId).toBe('titan_sphinx_after_scoring');
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'sphinx-score-buried');
        expect(option).toBeDefined();
        expect(option.displayMode).toBe('card');

        const handler = getInteractionHandler('titan_sphinx_after_scoring');
        expect(handler).toBeDefined();
        const resolved = handler!(result.matchState!, '0', option.value, prompt.data, FIXED_RANDOM, 83);
        const finalCore = (resolved?.events ?? []).reduce(
            (acc, event) => SmashUpDomain.reduce(acc, event),
            resolved?.state.core ?? result.matchState!.core,
        );

        expect(finalCore.players['0'].hand.some(card => card.uid === 'sphinx-score-buried')).toBe(true);
        expect(finalCore.bases[0].buriedCards?.some(card => card.uid === 'sphinx-score-buried') ?? false).toBe(false);
    });

    it('狮身人面像天赋会把一张手牌埋葬到它所在的基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'sphinx-hand-card', defId: 'robot_warbot', type: 'minion', owner: '0' }],
                    deck: [],
                    discard: [],
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_pyramids' })],
            titans: [{
                uid: 't-sphinx-talent',
                defId: 'sphinx',
                faction: SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-sphinx-talent', baseIndex: 0 },
            timestamp: 84,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map((event) => event.type)).toContain(SU_EVENTS.TALENT_USED);

        const prompt = state.sys.interaction?.current as any;
        expect(prompt?.data?.sourceId).toBe('titan_sphinx_talent');
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'sphinx-hand-card');
        expect(option).toBeDefined();

        const handler = getInteractionHandler('titan_sphinx_talent');
        expect(handler).toBeDefined();
        const resolved = handler!(state, '0', option.value, prompt.data, FIXED_RANDOM, 85);
        const finalCore = (resolved?.events ?? []).reduce(
            (acc, event) => SmashUpDomain.reduce(acc, event),
            resolved?.state.core ?? state.core,
        );

        expect(finalCore.players['0'].hand.some(card => card.uid === 'sphinx-hand-card')).toBe(false);
        expect(finalCore.bases[0].buriedCards?.some(card => card.uid === 'sphinx-hand-card')).toBe(true);
    });

    it('翻开埋葬的远古诅咒在仅有一个跨基地合法目标时会自动附着，并进入远古诅咒确认交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.KILLER_PLANTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_ninja_dojo',
                    // 远古诅咒：只有目标随从存在 +1 力量指示物时才会进入确认交互
                    minions: [makeMinion('target-minion', 'killer_plant_water_lily_pod', '0', 3, { powerCounters: 1, tempPowerModifier: 0 })],
                }),
                makeBase({
                    defId: 'base_greenhouse',
                    buriedCards: [{
                        uid: 'buried-curse',
                        defId: 'ancient_egyptians_ancient_curse_pod',
                        trueOwnerId: '1',
                        controllerId: '1',
                        buriedFrom: 'play',
                    }],
                }),
            ],
        });

        const uncovered = uncoverBuriedCard({
            matchState: makeMatchState(core),
            playerId: '1',
            cardUid: 'buried-curse',
            baseIndex: 1,
            random: FIXED_RANDOM,
            now: 101,
            reason: 'test_uncover_cross_base_target',
        });

        const prompt = (uncovered.state.sys.interaction?.current
            ?? uncovered.state.sys.interaction?.queue?.[0]) as any;
        expect(prompt?.data?.sourceId).toBe('ancient_egyptians_ancient_curse_confirm');
        const applyOption = prompt?.data?.options?.find((entry: any) => entry.id === 'apply');
        expect(applyOption?.value).toMatchObject({
            targetMinionUid: 'target-minion',
            baseIndex: 0,
            baseDefId: 'base_ninja_dojo',
        });
        expect(uncovered.events.map(event => event.type)).toContain(SU_EVENTS.ONGOING_ATTACHED);
        expect(uncovered.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'buried-curse',
                defId: 'ancient_egyptians_ancient_curse_pod',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'target-minion',
            }),
        }));

        const finalCore = uncovered.events.reduce(
            (acc, event) => SmashUpDomain.reduce(acc, event),
            uncovered.state.core,
        );

        expect(finalCore.bases[1].buriedCards?.some(card => card.uid === 'buried-curse') ?? false).toBe(false);
        expect(finalCore.bases[0].minions.find(minion => minion.uid === 'target-minion')?.attachedActions).toContainEqual(
            expect.objectContaining({ uid: 'buried-curse', defId: 'ancient_egyptians_ancient_curse_pod', ownerId: '1' }),
        );
        expect(finalCore.players['1'].discard.some(card => card.uid === 'buried-curse')).toBe(false);
    });

    it('翻开埋葬的远古诅咒在没有合法随从目标时会弃置，不会从状态里消失', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.KILLER_PLANTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_greenhouse',
                    buriedCards: [{
                        uid: 'buried-curse-no-target',
                        defId: 'ancient_egyptians_ancient_curse_pod',
                        trueOwnerId: '1',
                        controllerId: '1',
                        buriedFrom: 'play',
                    }],
                }),
                makeBase({ defId: 'base_secret_garden' }),
            ],
        });

        const uncovered = uncoverBuriedCard({
            matchState: makeMatchState(core),
            playerId: '1',
            cardUid: 'buried-curse-no-target',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 103,
            reason: 'test_uncover_no_target',
        });

        expect(uncovered.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BURIED_CARD_UNCOVERED,
            payload: expect.objectContaining({
                cardUid: 'buried-curse-no-target',
                baseIndex: 0,
                discardWithoutPlay: true,
            }),
        }));
        expect(uncovered.events.map(event => event.type)).not.toContain(SU_EVENTS.ACTION_PLAYED);

        const finalCore = uncovered.events.reduce(
            (acc, event) => SmashUpDomain.reduce(acc, event),
            uncovered.state.core,
        );

        expect(finalCore.bases[0].buriedCards?.some(card => card.uid === 'buried-curse-no-target') ?? false).toBe(false);
        expect(finalCore.players['1'].discard).toContainEqual(
            expect.objectContaining({ uid: 'buried-curse-no-target', defId: 'ancient_egyptians_ancient_curse_pod' }),
        );
        expect(finalCore.bases.every(base => !base.ongoingActions.some(card => card.uid === 'buried-curse-no-target'))).toBe(true);
        expect(finalCore.bases.every(base => !base.minions.some(minion => minion.attachedActions.some(card => card.uid === 'buried-curse-no-target')))).toBe(true);
    });

    it('鲜血领主满足条件可手动发动 special 进场', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '鲜血领主进场',
            commands: titanDraft,
        });

        const core: SmashUpCore = {
            ...result.finalState.core,
            powerCountersPlacedOnMinionsThisTurn: 2,
        };
        const titan = (core.titans ?? []).find(candidate => candidate.defId === 'vampires_ancient_lord');
        expect(titan).toBeDefined();

        const command: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: titan!.uid, baseIndex: 0 },
            timestamp: 70,
        };

        const validation = SmashUpDomain.validate({ ...result.finalState, core }, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute({ ...result.finalState, core }, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);
    });

    it('鲜血领主在你给无标记目标放置力量标记后会额外再放 1 枚', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '鲜血领主持续效果',
            commands: titanDraft,
        });

        const titan = (result.finalState.core.titans ?? []).find(candidate => candidate.defId === 'vampires_ancient_lord');
        expect(titan).toBeDefined();

        const core = SmashUpDomain.reduce(result.finalState.core, {
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: titan!.uid,
                defId: titan!.defId,
                ownerId: titan!.ownerId,
                controllerId: titan!.controllerId,
                baseIndex: 0,
                baseDefId: result.finalState.core.bases[0].defId,
                reason: 'test_ancient_lord_ongoing',
            },
            timestamp: 80,
        } as SmashUpEvent);

        const minion = core.players['0'].hand.find(card => card.type === 'minion');
        expect(minion).toBeDefined();

        const withMinion = SmashUpDomain.reduce(core, {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId: '0',
                cardUid: minion!.uid,
                defId: minion!.defId,
                baseIndex: 0,
                baseDefId: core.bases[0].defId,
                power: 2,
            },
            timestamp: 81,
        } as SmashUpEvent);

        const firstCounter = addPowerCounter(minion!.uid, 0, 1, 'test_counter', 82);
        const intercepted = interceptEvent(withMinion, firstCounter);
        const events = Array.isArray(intercepted) ? intercepted : [intercepted ?? firstCounter];

        expect(events.map(event => event.type)).toEqual([
            SU_EVENTS.POWER_COUNTER_ADDED,
            SU_EVENTS.POWER_COUNTER_ADDED,
        ]);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), withMinion);
        const targetMinion = resolved.bases[0].minions.find(candidate => candidate.uid === minion!.uid);
        expect(targetMinion?.powerCounters).toBe(2);
    });

    it('鲜血领主天赋会创建目标选择，并为已有标记的己方随从再放 1 枚', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VAMPIRES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '鲜血领主天赋',
            commands: titanDraft,
        });

        const titan = (result.finalState.core.titans ?? []).find(candidate => candidate.defId === 'vampires_ancient_lord');
        expect(titan).toBeDefined();
        const minion = result.finalState.core.players['0'].hand.find(card => card.type === 'minion');
        expect(minion).toBeDefined();

        let core = SmashUpDomain.reduce(result.finalState.core, {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId: '0',
                cardUid: minion!.uid,
                defId: minion!.defId,
                baseIndex: 0,
                baseDefId: result.finalState.core.bases[0].defId,
                power: 2,
            },
            timestamp: 90,
        } as SmashUpEvent);
        core = SmashUpDomain.reduce(core, addPowerCounter(minion!.uid, 0, 1, 'setup_counter', 91));
        core = SmashUpDomain.reduce(core, {
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: titan!.uid,
                defId: titan!.defId,
                ownerId: titan!.ownerId,
                controllerId: titan!.controllerId,
                baseIndex: 0,
                baseDefId: core.bases[0].defId,
                reason: 'test_ancient_lord_talent_setup',
            },
            timestamp: 92,
        } as SmashUpEvent);

        const state = { ...result.finalState, core };
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: titan!.uid, baseIndex: 0 },
            timestamp: 93,
        };

        const validation = SmashUpDomain.validate(state, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction.current).toBeDefined();

        const sourceId = (state.sys.interaction.current?.data as any)?.sourceId;
        expect(sourceId).toBe('titan_vampires_ancient_lord_talent');

        const handler = getInteractionHandler('titan_vampires_ancient_lord_talent');
        expect(handler).toBeDefined();
        const resolvedInteraction = handler!(
            state,
            '0',
            { minionUid: minion!.uid, baseIndex: 0 },
            state.sys.interaction.current?.data as any,
            FIXED_RANDOM,
            94,
        );
        expect(resolvedInteraction?.events.map(event => event.type)).toContain(SU_EVENTS.POWER_COUNTER_ADDED);

        const resolvedCore = (resolvedInteraction?.events ?? []).reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        const targetMinion = resolvedCore.bases[0].minions.find(candidate => candidate.uid === minion!.uid);
        expect(targetMinion?.powerCounters).toBe(2);
    });

    it('派系互斥选择', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '派系互斥',
            commands: [
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
            ],
        });
        expect(result.steps[0]?.success).toBe(true);
        expect(result.steps[1]?.success).toBe(true);
        expect(result.steps[2]?.success).toBe(false);
        expect(result.steps[2]?.error).toContain('已被选择');
    });

    it('出牌阶段可以打出随从', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '选秀+出牌',
            commands: DRAFT_COMMANDS,
        });
        const core = result.finalState.core;
        const pid = getCurrentPlayerId(core);
        const player = core.players[pid];
        const minionCard = player.hand.find(c => c.type === 'minion');
        if (!minionCard) return;

        expect(result.finalState.sys.phase).toBe('playCards');

        const runner2 = createRunner();
        const result2 = runner2.run({
            name: '选秀+出牌执行',
            commands: [
                ...DRAFT_COMMANDS,
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: pid,
                    payload: { cardUid: minionCard.uid, baseIndex: 0 },
                },
            ],
        });

        const playStep = result2.steps[result2.steps.length - 1];
        expect(playStep?.success).toBe(true);
        expect(playStep?.events).toContain(SU_EVENTS.MINION_PLAYED);

        const newPlayer = result2.finalState.core.players[pid];
        expect(newPlayer.hand.length).toBe(4);
        expect(newPlayer.minionsPlayed).toBe(1);
        const base = result2.finalState.core.bases[0];
        expect(base.minions.length).toBe(1);
        expect(base.minions[0].uid).toBe(minionCard.uid);
    });

    it('非当前玩家不能出牌', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '选秀',
            commands: DRAFT_COMMANDS,
        });
        const core = result.finalState.core;
        const otherPid = PLAYER_IDS.find(p => p !== getCurrentPlayerId(core))!;
        const otherPlayer = core.players[otherPid];
        const card = otherPlayer.hand[0];
        if (!card) return;

        const runner2 = createRunner();
        const result2 = runner2.run({
            name: '非当前玩家出牌',
            commands: [
                ...DRAFT_COMMANDS,
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: otherPid,
                    payload: { cardUid: card.uid, baseIndex: 0 },
                },
            ],
        });
        const playStep = result2.steps[result2.steps.length - 1];
        expect(playStep?.success).toBe(false);
    });

    it('ADVANCE_PHASE 推进阶段', () => {
        const runner = createRunner();
        const pid = PLAYER_IDS[0];

        const result = runner.run({
            name: '阶段推进',
            commands: [
                ...DRAFT_COMMANDS,
                // playCards → scoreBases(auto) → draw(auto) → endTurn(auto) → startTurn(P1, auto) → playCards(P1)
                // 多轮 afterEvents 会自动推进整个链条
                { type: 'ADVANCE_PHASE', playerId: pid, payload: undefined },
            ],
        });

        // 多轮 afterEvents 自动推进到 P1 的 playCards
        expect(result.finalState.sys.phase).toBe('playCards');
        // 当前玩家切换到 P1
        expect(result.finalState.core.currentPlayerIndex).toBe(1);
        // P0 在 draw 阶段抽了 2 张牌（5+2=7）
        expect(result.finalState.core.players['0'].hand.length).toBe(7);
        // ADVANCE_PHASE 步骤成功
        const advanceStep = result.steps[DRAFT_COMMANDS.length];
        expect(advanceStep?.success).toBe(true);
    });

    it('AI legal actions 支持四人局派系选择', () => {
        const runner = createRunner(['0', '1', '2', '3']);
        const result = runner.run({ name: '四人 setup', commands: [] });

        const currentPlayerActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: result.finalState,
        });
        const waitingPlayerActions = buildSmashUpAiLegalActions({
            playerId: '1',
            state: result.finalState,
        });

        expect(currentPlayerActions.length).toBeGreaterThan(10);
        expect(currentPlayerActions.every((action) => action.kind === 'select-faction')).toBe(true);
        expect(waitingPlayerActions).toHaveLength(0);
    });

    it('Smash Up AI 选派系会避开已被拿走的派系', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '已选一派系后 AI 候选去重',
            commands: [
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
            ],
        });

        const actions = buildSmashUpAiLegalActions({
            playerId: '1',
            state: result.finalState,
        });

        const selectableFactionIds = actions
            .filter((action) => action.kind === 'select-faction')
            .map((action) => action.metadata?.factionId);

        expect(selectableFactionIds.length).toBeGreaterThan(0);
        expect(selectableFactionIds).not.toContain(SMASHUP_FACTION_IDS.ALIENS);
    });

    it('Smash Up baseline AI 第二次选派系时会参考已选派系协同，而不是只按静态优先级', async () => {
        const runner = createRunner();
        const result = runner.run({
            name: 'AI 第二次选派系看协同',
            commands: [
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ZOMBIES } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
            ],
        });

        expect(result.finalState.core.factionSelection?.playerSelections['0']).toEqual([SMASHUP_FACTION_IDS.ZOMBIES]);

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: result.finalState,
        });
        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
            gameId: 'smashup',
            matchId: 'test-smashup-ai-faction-synergy',
            playerId: '0',
            visibleState: result.finalState,
            interaction: null,
            responseWindow: null,
            legalActions,
            rulesVersion: null,
            decisionBudgetMs: 250,
            difficulty: resolveAiDifficultyProfile('expert'),
            source: 'local',
        });
        const chosenAction = legalActions.find((action) => action.actionId === decision?.actionId);

        expect(legalActions.some((action) => action.metadata?.factionId === SMASHUP_FACTION_IDS.ROBOTS)).toBe(true);
        expect(legalActions.some((action) => action.metadata?.factionId === SMASHUP_FACTION_IDS.WIZARDS)).toBe(true);
        expect(chosenAction?.metadata?.factionId).toBe(SMASHUP_FACTION_IDS.WIZARDS);
    });

    it('Smash Up AI legal action 会自动附带 strategy tags，供通用风格评分复用', () => {
        const stateForAi = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('wizard-summon-1', 'wizard_summon', 'action', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_mothership'),
            ],
        }));

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });
        const summonAction = legalActions.find((action) =>
            action.kind === 'play-action' && action.metadata?.defId === 'wizard_summon',
        );

        expect(summonAction).toBeDefined();
        expect(summonAction?.metadata?.strategyTags).toContain('action-chain');
        expect(summonAction?.metadata?.cardStrategyTags).toContain('action-chain');
    });

    it('Smash Up baseline AI 在玩家目标交互里会把增益留给自己', async () => {
        const stateForAi = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_mothership')],
        }));

        const interaction = createSimpleChoice(
            'smashup-ai-player-target-buff',
            '0',
            '选择获得增益的玩家',
            buildPlayerTargetOptions(
                [
                    { id: 'self', label: '自己', targetPlayerId: '0', displayMode: 'button' as const },
                    { id: 'enemy', label: '对手', targetPlayerId: '1', displayMode: 'button' as const },
                ],
                {
                    sourcePlayerId: '0',
                    effectIntent: 'buff',
                },
            ),
            { sourceId: 'smashup_ai_player_target_buff', targetType: 'player' },
        );
        stateForAi.sys.interaction = {
            ...stateForAi.sys.interaction,
            current: interaction,
            queue: [],
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });
        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
            gameId: 'smashup',
            matchId: 'test-smashup-ai-player-target-buff',
            playerId: '0',
            visibleState: stateForAi,
            interaction: null,
            responseWindow: null,
            legalActions,
            rulesVersion: null,
            decisionBudgetMs: 250,
            difficulty: resolveAiDifficultyProfile('expert'),
            source: 'local',
        });
        const chosenAction = legalActions.find((action) => action.actionId === decision?.actionId);

        expect(chosenAction?.kind).toBe('interaction-choice');
        expect((chosenAction?.metadata?.optionValue as { targetPlayerId?: string } | undefined)?.targetPlayerId).toBe('0');
    });

    it('Smash Up baseline AI 在玩家目标交互里会把减益或侦察指向对手', async () => {
        const buildStateWithPlayerTargetInteraction = (effectIntent: 'debuff' | 'inspect') => {
            const stateForAi = makeMatchState(makeState({
                currentPlayerIndex: 0,
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                bases: [makeBase('base_the_mothership')],
            }));

            const interaction = createSimpleChoice(
                `smashup-ai-player-target-${effectIntent}`,
                '0',
                effectIntent === 'debuff' ? '选择承受减益的玩家' : '选择要侦察的玩家',
                buildPlayerTargetOptions(
                    [
                        { id: 'self', label: '自己', targetPlayerId: '0', displayMode: 'button' as const },
                        { id: 'enemy', label: '对手', targetPlayerId: '1', displayMode: 'button' as const },
                    ],
                    {
                        sourcePlayerId: '0',
                        effectIntent,
                    },
                ),
                {
                    sourceId: `smashup_ai_player_target_${effectIntent}`,
                    targetType: 'player',
                },
            );
            stateForAi.sys.interaction = {
                ...stateForAi.sys.interaction,
                current: interaction,
                queue: [],
            };
            return stateForAi;
        };

        for (const effectIntent of ['debuff', 'inspect'] as const) {
            const stateForAi = buildStateWithPlayerTargetInteraction(effectIntent);
            const legalActions = buildSmashUpAiLegalActions({
                playerId: '0',
                state: stateForAi,
            });
            const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
                gameId: 'smashup',
                matchId: `test-smashup-ai-player-target-${effectIntent}`,
                playerId: '0',
                visibleState: stateForAi,
                interaction: null,
                responseWindow: null,
                legalActions,
                rulesVersion: null,
                decisionBudgetMs: 250,
                difficulty: resolveAiDifficultyProfile('expert'),
                source: 'local',
            });
            const chosenAction = legalActions.find((action) => action.actionId === decision?.actionId);

            expect(chosenAction?.kind).toBe('interaction-choice');
            expect((chosenAction?.metadata?.optionValue as { targetPlayerId?: string } | undefined)?.targetPlayerId).toBe('1');
        }
    });

    it('Smash Up baseline AI 在 pirate_broadside 这类基地+玩家复合目标里会优先点敌方目标', async () => {
        const core = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('broadside-1', 'pirate_broadside', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_pirate_cove',
                    minions: [
                        makeMinion('ally-strong', 'pirate_first_mate', '0', 4, { owner: '0', tempPowerModifier: 0 }),
                        makeMinion('ally-weak', 'test_minion', '0', 1, { owner: '0', tempPowerModifier: 0 }),
                        makeMinion('enemy-weak-a', 'test_minion', '1', 2, { owner: '1', tempPowerModifier: 0 }),
                        makeMinion('enemy-weak-b', 'test_minion', '1', 1, { owner: '1', tempPowerModifier: 0 }),
                    ],
                }),
            ],
        });
        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'broadside-1', targetBaseIndex: 0 },
            timestamp: 88,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('pirate_broadside');

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state,
        });
        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
            gameId: 'smashup',
            matchId: 'test-smashup-ai-pirate-broadside-target',
            playerId: '0',
            visibleState: state,
            interaction: null,
            responseWindow: null,
            legalActions,
            rulesVersion: null,
            decisionBudgetMs: 250,
            difficulty: resolveAiDifficultyProfile('expert'),
            source: 'local',
        });
        const chosenAction = legalActions.find((action) => action.actionId === decision?.actionId);

        expect(chosenAction?.kind).toBe('interaction-choice');
        expect((chosenAction?.metadata?.optionValue as { targetPlayerId?: string } | undefined)?.targetPlayerId).toBe('1');
    });

    it('Smash Up baseline AI 在基础出牌阶段优先打随从', async () => {
        const runner = createRunner();
        const drafted = runner.run({
            name: '选秀供 AI 使用',
            commands: DRAFT_COMMANDS,
        });

        const pid = getCurrentPlayerId(drafted.finalState.core);
        const player = drafted.finalState.core.players[pid];
        const fallbackCards = [...player.hand, ...player.deck];
        const minionCard = fallbackCards.find((card) => card.type === 'minion' || card.type === 'fusion');
        const actionCard = fallbackCards.find((card) => card.type === 'action' || card.type === 'fusion');

        if (!minionCard) {
            throw new Error('测试缺少可用随从，无法验证 baseline AI');
        }

        const stateForAi = {
            ...drafted.finalState,
            core: {
                ...drafted.finalState.core,
                players: {
                    ...drafted.finalState.core.players,
                    [pid]: {
                        ...player,
                        hand: actionCard ? [minionCard, actionCard] : [minionCard],
                        minionsPlayed: 0,
                        actionsPlayed: 0,
                    },
                },
            },
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: pid,
            state: stateForAi,
        });
        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
            gameId: 'smashup',
            matchId: 'test-smashup-ai',
            playerId: pid,
            visibleState: stateForAi,
            interaction: null,
            responseWindow: null,
            legalActions,
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
        });
        const chosenAction = legalActions.find((action) => action.actionId === decision?.actionId);

        expect(legalActions.some((action) => action.kind === 'play-minion')).toBe(true);
        expect(chosenAction?.kind).toBe('play-minion');
    });

    it('Smash Up baseline AI 会优先把随从投向能直接改写高价值评分的关键基地', async () => {
        const stateForAi = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('warbot-1', 'robot_warbot', 'minion', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.WIZARDS],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_mothership',
                    minions: [
                        makeMinion('ally-pressure-a', 'robot_hoverbot', '0', 3, { owner: '0', tempPowerModifier: 0 }),
                        makeMinion('ally-pressure-b', 'robot_microbot_guard', '0', 3, { owner: '0', tempPowerModifier: 0 }),
                        makeMinion('enemy-pressure', 'test_minion', '1', 10, { owner: '1', tempPowerModifier: 0 }),
                    ],
                }),
                makeBase({
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('ally-calm', 'wizard_enchantress', '0', 2, { owner: '0', tempPowerModifier: 0 }),
                        makeMinion('enemy-calm', 'test_minion', '1', 2, { owner: '1', tempPowerModifier: 0 }),
                    ],
                }),
            ],
        }));

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });
        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
            gameId: 'smashup',
            matchId: 'test-smashup-ai-critical-base',
            playerId: '0',
            visibleState: stateForAi,
            interaction: null,
            responseWindow: null,
            legalActions,
            rulesVersion: null,
            decisionBudgetMs: 250,
            difficulty: resolveAiDifficultyProfile('expert'),
            source: 'local',
        });
        const chosenAction = legalActions.find((action) => action.actionId === decision?.actionId);

        expect(legalActions.filter((action) => action.kind === 'play-minion')).toHaveLength(2);
        expect(chosenAction?.kind).toBe('play-minion');
        expect(chosenAction?.metadata).toMatchObject({
            baseIndex: 0,
        });
    });

    it('Smash Up baseline AI 会结合牌组风格优先选择 action-chain 组件，而不是无标签的泛用行动', async () => {
        const stateForAi = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('wizard-summon-1', 'wizard_summon', 'action', '0'),
                        makeCard('robot-tech-center-1', 'robot_tech_center', 'action', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.ROBOTS],
                    minionsPlayed: 1,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_jungle'),
            ],
        }));

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });
        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
            gameId: 'smashup',
            matchId: 'test-smashup-ai-profile-action-choice',
            playerId: '0',
            visibleState: stateForAi,
            interaction: null,
            responseWindow: null,
            legalActions,
            rulesVersion: null,
            decisionBudgetMs: 250,
            difficulty: resolveAiDifficultyProfile('expert'),
            source: 'local',
        });
        const chosenAction = legalActions.find((action) => action.actionId === decision?.actionId);

        expect(legalActions.filter((action) => action.kind === 'play-action').length).toBeGreaterThanOrEqual(2);
        expect(chosenAction?.kind).toBe('play-action');
        expect(chosenAction?.metadata?.defId).toBe('wizard_summon');
    });

    it('Smash Up baseline AI 在高压评分响应窗口应优先响应，而不是直接 response-pass', async () => {
        const pressuredMinion = makeMinion('minion-1', 'giant_ant_soldier', '0', 3, {
            owner: '0',
            powerCounters: 2,
            tempPowerModifier: 0,
        });
        const enemyMinions = Array.from({ length: 4 }, (_, index) => makeMinion(
            `enemy-${index}`,
            'test_minion',
            '1',
            5,
            {
                owner: '1',
                tempPowerModifier: 0,
            },
        ));

        const core = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('card-1', 'giant_ant_under_pressure', 'action', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_mothership',
                    minions: [pressuredMinion, ...enemyMinions],
                }),
            ],
        });
        const stateForAi = makeMatchState(core);
        stateForAi.sys.responseWindow = {
            current: {
                id: 'rw-ai-urgent-base',
                windowType: 'meFirst',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });
        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
            gameId: 'smashup',
            matchId: 'test-smashup-ai-response',
            playerId: '0',
            visibleState: stateForAi,
            interaction: null,
            responseWindow: stateForAi.sys.responseWindow?.current ?? null,
            legalActions,
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
        });
        const chosenAction = legalActions.find((action) => action.actionId === decision?.actionId);

        expect(legalActions.some((action) => action.kind === 'response-pass')).toBe(true);
        expect(legalActions.some((action) => action.kind === 'response-play-action')).toBe(true);
        expect(chosenAction?.kind).toBe('response-play-action');
        expect(chosenAction?.metadata).toMatchObject({
            targetBaseIndex: 0,
        });
    });

    it('Smash Up baseline AI 处理 reaction_queue 单选交互时，不应提交会被系统判非法的 mergedValue', async () => {
        const stateForAi = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('card-1', 'wizard_summon', 'action', '0'),
                        makeCard('card-2', 'ninja_acolyte', 'minion', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.NINJAS],
                }),
                '1': makePlayer('1'),
            },
        }));

        stateForAi.sys.phase = 'scoreBases';
        stateForAi.sys.turnNumber = 1;
        stateForAi.sys.interaction = {
            current: {
                id: 'reaction-order-choice',
                playerId: '0',
                kind: 'simple-choice',
                data: {
                    sourceId: 'smashup_reaction_choose',
                    options: [
                        {
                            id: 'trigger-a',
                            label: '先结算触发 A',
                            displayMode: 'button',
                            value: { triggerId: 'afterScoring:base_a:1:0' },
                        },
                        {
                            id: 'trigger-b',
                            label: '先结算触发 B',
                            displayMode: 'button',
                            value: { triggerId: 'afterScoring:base_b:1:0' },
                        },
                    ],
                },
            },
            queue: [],
        } as any;
        stateForAi.sys.responseWindow = {
            current: {
                id: 'afterscoring-window',
                windowType: 'afterScoring',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
            history: [],
        } as any;
        stateForAi.sys.eventStream = { nextId: 30, entries: [] } as any;

        const resolution = await resolveNextLocalAiAction({
            engineConfig: engineConfig as any,
            state: stateForAi,
            matchId: 'smashup-reaction-queue-ai-regression',
            seatControllers: { '0': { type: 'local-ai' } },
        });

        expect(resolution?.action.kind).toBe('interaction-choice');
        expect((resolution?.action.commands[0]?.payload as { mergedValue?: unknown } | undefined)?.mergedValue).toBeUndefined();

        const followUp = executePipeline(
            {
                domain: engineConfig.domain,
                systems: engineConfig.systems,
                systemsConfig: engineConfig.systemsConfig,
            },
            stateForAi,
            {
                type: 'SYS_INTERACTION_RESPOND',
                playerId: '0',
                payload: resolution?.action.commands[0]?.payload ?? {},
                timestamp: Date.now(),
            } as any,
            FIXED_RANDOM,
            PLAYER_IDS,
        );

        expect(followUp.success).toBe(true);
    });

    it('Smash Up baseline AI 在非紧急响应窗口会选择 response-pass，避免空耗响应牌', async () => {
        const core = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('card-lost-knowledge', 'ancient_egyptians_lost_knowledge', 'action', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.DINOSAURS],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_pirate_cove',
                    minions: [
                        makeMinion('ally-1', 'pirate_first_mate', '0', 2, { owner: '0' }),
                        makeMinion('enemy-1', 'test_minion', '1', 2, { owner: '1' }),
                    ],
                }),
            ],
        });
        const stateForAi = makeMatchState(core);
        stateForAi.sys.responseWindow = {
            current: {
                id: 'rw-ai-calm-window',
                windowType: 'meFirst',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });
        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
            gameId: 'smashup',
            matchId: 'test-smashup-ai-calm-response',
            playerId: '0',
            visibleState: stateForAi,
            interaction: null,
            responseWindow: stateForAi.sys.responseWindow?.current ?? null,
            legalActions,
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
        });
        const chosenAction = legalActions.find((action) => action.actionId === decision?.actionId);

        expect(legalActions.some((action) => action.kind === 'response-pass')).toBe(true);
        expect(chosenAction?.kind).toBe('response-pass');
    });

    it('Smash Up baseline AI 在同一局面下重复决策应保持稳定，不应表现为完全随机', async () => {
        const runner = createRunner();
        const drafted = runner.run({
            name: '选秀供稳定性 AI 使用',
            commands: DRAFT_COMMANDS,
        });

        const pid = getCurrentPlayerId(drafted.finalState.core);
        const player = drafted.finalState.core.players[pid];
        const fallbackCards = [...player.hand, ...player.deck];
        const minionCard = fallbackCards.find((card) => card.type === 'minion' || card.type === 'fusion');
        const actionCard = fallbackCards.find((card) => card.type === 'action' || card.type === 'fusion');
        if (!minionCard) {
            throw new Error('测试缺少可用随从，无法验证稳定性');
        }

        const stateForAi = {
            ...drafted.finalState,
            core: {
                ...drafted.finalState.core,
                players: {
                    ...drafted.finalState.core.players,
                    [pid]: {
                        ...player,
                        hand: actionCard ? [minionCard, actionCard] : [minionCard],
                        minionsPlayed: 0,
                        actionsPlayed: 0,
                    },
                },
            },
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: pid,
            state: stateForAi,
        });

        const decisions = await Promise.all(
            Array.from({ length: 5 }, async (_, index) => {
                const decision = await Promise.resolve(smashUpAiRuntime.localPolicies!.baseline.decide({
                    gameId: 'smashup',
                    matchId: 'test-smashup-ai-stable-repeat',
                    playerId: pid,
                    visibleState: stateForAi,
                    interaction: null,
                    responseWindow: null,
                    legalActions,
                    rulesVersion: null,
                    decisionBudgetMs: 250,
                    source: 'local',
                }));
                return { index, actionId: decision?.actionId };
            }),
        );

        const uniqueActionIds = new Set(decisions.map((decision) => decision.actionId));
        expect(uniqueActionIds.size).toBe(1);
        expect(legalActions.some((action) => action.actionId === decisions[0]?.actionId)).toBe(true);
    });

    it('domain 注册表加载正确', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '注册表验证',
            commands: DRAFT_COMMANDS,
        });
        const core = result.finalState.core;
        for (const pid of PLAYER_IDS) {
            for (const card of core.players[pid].hand) {
                expect(card.defId).toBeTruthy();
                expect(card.uid).toBeTruthy();
                expect(card.owner).toBe(pid);
            }
        }
    });

    it('alien_terraform 第三步允许选择可视作随从打出的 set-aside 泰坦', () => {
        const tricksterTitan: TitanState = {
            uid: 't1',
            defId: 'tricksters_big_funny_giant',
            faction: 'tricksters',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'setaside' },
        };
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('h1', 'alien_invader', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            titans: [tricksterTitan],
            bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 3, { powerModifier: 0 })])],
            baseDeck: ['base_new', 'base_alt'],
        });

        const handler1 = getInteractionHandler('alien_terraform');
        const handler2 = getInteractionHandler('alien_terraform_choose_replacement');
        const handler3 = getInteractionHandler('alien_terraform_play_minion');
        expect(handler1).toBeDefined();
        expect(handler2).toBeDefined();
        expect(handler3).toBeDefined();

        const step1 = handler1!(makeMatchState(core), '0', { baseIndex: 0 }, undefined, FIXED_RANDOM, 3020);
        const step1Current = (step1!.state.sys as any).interaction?.current;
        const step2 = handler2!(
            makeMatchState(core),
            '0',
            { newBaseDefId: 'base_new' },
            step1Current?.data,
            FIXED_RANDOM,
            3021,
        );
        const step2Current = (step2!.state.sys as any).interaction?.current;
        const titanOption = step2Current?.data?.options?.find((opt: any) => opt.value?.titanUid === 't1');
        expect(titanOption).toBeDefined();
        expect(titanOption.value).toMatchObject({
            titanUid: 't1',
            defId: 'tricksters_big_funny_giant',
            playKind: 'minion',
        });

        const step3 = handler3!(
            makeMatchState(core),
            '0',
            titanOption.value,
            step2Current?.data,
            FIXED_RANDOM,
            3022,
        );
        const titanPlayed = step3!.events.find(event => event.type === SU_EVENTS.TITAN_PLAYED);
        expect(titanPlayed).toBeDefined();
        expect((titanPlayed as any).payload).toMatchObject({
            titanUid: 't1',
            defId: 'tricksters_big_funny_giant',
            controllerId: '0',
            baseIndex: 0,
            baseDefId: 'base_old',
            reason: 'alien_terraform',
        });
    });

    it('克苏鲁泰坦在常规行动额度可用时可从牌库旁进场', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '克苏鲁泰坦进场',
            commands: titanDraft,
        });

        const titan = (result.finalState.core.titans ?? []).find(candidate => candidate.defId === 'cthulhu_cthulhu_titan');
        expect(titan).toBeDefined();

        const stateWithMinion = {
            ...result.finalState,
            core: {
                ...result.finalState.core,
                bases: result.finalState.core.bases.map((base, index) => index === 0 ? {
                    ...base,
                    minions: [
                        ...base.minions,
                        {
                            uid: 'cthulhu-base-minion',
                            defId: 'cthulhu_star_spawn',
                            owner: '0',
                            controller: '0',
                            basePower: 5,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                } : base),
            },
        };

        const command: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: titan!.uid, baseIndex: 0 },
            timestamp: 31,
        };

        const validation = SmashUpDomain.validate(stateWithMinion, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(stateWithMinion, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.MADNESS_DRAWN);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), stateWithMinion.core);
        const playedTitan = (resolved.titans ?? []).find(candidate => candidate.uid === titan!.uid);
        expect(playedTitan?.location).toEqual({
            zone: 'base',
            baseIndex: 0,
            enteredAt: 31,
        });
    });

    it('Fort Titanosaurus 会在 dino_augmentation 交互选中己方随从后起持续交互', () => {
        const initialState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('aug-1', 'dino_augmentation_pod', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.DINOSAURS, SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY_POD],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_wizard_academy',
                minions: [
                    makeMinion('dino-target', 'dino_armor_stego_pod', '0', 4, { tempPowerModifier: 0, powerCounters: 0 }),
                ],
                ongoingActions: [],
            })],
            titans: [{
                uid: 't-fort',
                defId: 'dinosaurs_fort_titanosaurus',
                faction: SMASHUP_FACTION_IDS.DINOSAURS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 3,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        }));

        const playResult = runCommand(initialState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'aug-1', targetBaseIndex: 0 },
            timestamp: 50,
        }, FIXED_RANDOM);

        expect(playResult.success).toBe(true);
        expect(getInteractionsFromMS(playResult.finalState)[0]?.data?.sourceId).toBe('dino_augmentation');

        const resolved = resolveInteractionChain(playResult.finalState, (prompt) => {
            const sourceId = prompt?.data?.sourceId as string | undefined;
            if (sourceId === 'dino_augmentation') {
                const option = findInteractionOption(prompt, entry => entry?.value?.minionUid === 'dino-target');
                expect(option).toBeDefined();
                return { optionId: option.id };
            }
            if (sourceId === 'smashup_reaction_choose') {
                const triggerById = new Map(
                    (prompt?.state?.core?.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]),
                );
                const option = prompt?.data?.options?.find((entry: any) => {
                    const trigger = triggerById.get(entry?.value?.triggerId);
                    return trigger?.sourceDefId === 'dinosaurs_fort_titanosaurus';
                }) ?? prompt?.data?.options?.[0];
                expect(option).toBeDefined();
                return { optionId: option.id };
            }
            if (sourceId === 'titan_dinosaurs_fort_titanosaurus_ongoing') {
                const option = findInteractionOption(
                    prompt,
                    entry => entry?.value?.mode === 'both' && entry?.value?.targetMinionUid === 'dino-target',
                );
                expect(option).toBeDefined();
                return { optionId: option.id };
            }
            throw new Error(`未处理的 Fort Titanosaurus 交互: ${sourceId ?? 'unknown'}`);
        }, FIXED_RANDOM);

        expect(getInteractionsFromMS(resolved.finalState)).toHaveLength(0);

        const finalCore = resolved.finalState.core;
        const target = finalCore.bases[0].minions.find(minion => minion.uid === 'dino-target');
        const titan = (finalCore.titans ?? []).find(candidate => candidate.uid === 't-fort');

        expect(target?.tempPowerModifier).toBe(4);
        expect(target?.powerCounters).toBe(1);
        expect(titan?.powerCounters).toBe(4);
        expect((titan?.metadata as { fortTitanosaurusTriggeredTurn?: number } | undefined)?.fortTitanosaurusTriggeredTurn)
            .toBe(finalCore.turnNumber);
    });

    it('克苏鲁在场时你抽疯狂卡后按抽取数量获得力量标记', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 't-cthulhu',
                defId: 'cthulhu_cthulhu_titan',
                faction: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
            madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
        });

        const intercepted = interceptEvent(core, {
            type: SU_EVENTS.MADNESS_DRAWN,
            payload: {
                playerId: '0',
                count: 2,
                cardUids: ['madness_101', 'madness_102'],
                reason: 'cthulhu_test',
            },
            timestamp: 40,
        } as SmashUpEvent);
        const events = Array.isArray(intercepted) ? intercepted : intercepted ? [intercepted] : [];

        expect(events.map(event => event.type)).toEqual([
            SU_EVENTS.MADNESS_DRAWN,
            SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
        ]);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        const titan = (resolved.titans ?? []).find(candidate => candidate.uid === 't-cthulhu');
        expect(titan?.powerCounters).toBe(2);
        expect(resolved.players['0'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(2);
    });

    it('克苏鲁在场时你打出疯狂卡后获得 1 枚力量标记', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('madness-play', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 't-cthulhu',
                defId: 'cthulhu_cthulhu_titan',
                faction: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
            madnessDeck: [MADNESS_CARD_DEF_ID],
        });

        const intercepted = interceptEvent(core, {
            type: SU_EVENTS.ACTION_PLAYED,
            payload: {
                playerId: '0',
                cardUid: 'madness-play',
                defId: MADNESS_CARD_DEF_ID,
                isExtraAction: false,
            },
            timestamp: 41,
        } as SmashUpEvent);
        const events = Array.isArray(intercepted) ? intercepted : intercepted ? [intercepted] : [];

        expect(events.map(event => event.type)).toEqual([
            SU_EVENTS.ACTION_PLAYED,
            SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
        ]);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        const titan = (resolved.titans ?? []).find(candidate => candidate.uid === 't-cthulhu');
        expect(titan?.powerCounters).toBe(1);
    });

    it('克苏鲁泰坦天赋在只有抽疯狂卡分支时直接抽 1 张疯狂卡', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 't-cthulhu',
                defId: 'cthulhu_cthulhu_titan',
                faction: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
            madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
        });

        const ms = makeMatchState(core);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-cthulhu', baseIndex: 0 },
            timestamp: 42,
        };

        const validation = SmashUpDomain.validate(ms, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(ms, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toEqual([
            SU_EVENTS.TALENT_USED,
            SU_EVENTS.MADNESS_DRAWN,
        ]);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(resolved.players['0'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(1);
        const titan = (resolved.titans ?? []).find(candidate => candidate.uid === 't-cthulhu');
        expect(titan?.talentUsed).toBe(true);
    });

    it('克苏鲁泰坦天赋在只有转交分支时会起目标交互并把疯狂卡交给对手', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('madness-hand', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 't-cthulhu',
                defId: 'cthulhu_cthulhu_titan',
                faction: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
            madnessDeck: [],
        });

        const ms = makeMatchState(core);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-cthulhu', baseIndex: 0 },
            timestamp: 43,
        };

        const validation = SmashUpDomain.validate(ms, command);
        expect(validation.valid).toBe(true);

        const talentEvents = SmashUpDomain.execute(ms, command, FIXED_RANDOM);
        expect(talentEvents.map(event => event.type)).toEqual([SU_EVENTS.TALENT_USED]);

        const interactions = getInteractionsFromMS(ms);
        expect(interactions).toHaveLength(1);
        const current = interactions[0];
        expect(current?.data?.sourceId).toBe('titan_cthulhu_cthulhu_titan_talent_target');

        const targetOption = current.data.options.find((option: any) => option?.value?.targetPlayerId === '1');
        expect(targetOption).toBeDefined();

        const handler = getInteractionHandler('titan_cthulhu_cthulhu_titan_talent_target');
        const response = handler!(
            ms,
            '0',
            targetOption.value,
            current.data,
            FIXED_RANDOM,
            44,
        );
        expect(response.events.map(event => event.type)).toEqual([SU_EVENTS.CARD_TRANSFERRED]);

        const afterTalent = talentEvents.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        const finalCore = response.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), afterTalent);
        const titan = (finalCore.titans ?? []).find(candidate => candidate.uid === 't-cthulhu');

        expect(finalCore.players['0'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(0);
        expect(finalCore.players['1'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(1);
        expect(titan?.powerCounters).toBe(0);
    });

    it('大衮满足同名随从条件后可通过 special 从牌库旁进场', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.INNSMOUTH } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '大衮进场',
            commands: titanDraft,
        });

        const titan = (result.finalState.core.titans ?? []).find(candidate => candidate.defId === 'innsmouth_dagon');
        expect(titan).toBeDefined();

        const stateWithDuplicates = {
            ...result.finalState,
            core: {
                ...result.finalState.core,
                bases: result.finalState.core.bases.map((base, index) => index === 0 ? {
                    ...base,
                    minions: [
                        makeMinion('dagon-local-1', 'innsmouth_the_locals', '0', 2),
                        makeMinion('dagon-local-2', 'innsmouth_the_locals', '0', 2),
                        makeMinion('dagon-scout', 'pirate_first_mate', '0', 2),
                    ],
                } : base),
            },
        };

        const command: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: titan!.uid, baseIndex: 0 },
            timestamp: 32,
        };

        const validation = SmashUpDomain.validate(stateWithDuplicates, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(stateWithDuplicates, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), stateWithDuplicates.core);
        const playedTitan = (resolved.titans ?? []).find(candidate => candidate.uid === titan!.uid);
        expect(playedTitan?.location).toEqual({
            zone: 'base',
            baseIndex: 0,
            enteredAt: 32,
        });
    });

    it('大衮在基地上只为你成组同名的随从提供力量', () => {
        const core = makeState({
            bases: [makeBase({
                minions: [
                    makeMinion('dagon-local-1', 'innsmouth_the_locals', '0', 2),
                    makeMinion('dagon-local-2', 'innsmouth_the_locals', '0', 2),
                    makeMinion('dagon-solo', 'pirate_first_mate', '0', 2),
                    makeMinion('enemy-local', 'innsmouth_the_locals', '1', 2),
                    makeMinion('enemy-solo', 'ghosts_spectre', '1', 2),
                ],
            })],
            titans: [{
                uid: 't-dagon',
                defId: 'innsmouth_dagon',
                faction: SMASHUP_FACTION_IDS.INNSMOUTH,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        expect(getRegisteredModifierIds().powerModifierIds.has('innsmouth_dagon')).toBe(true);
        expect(getTitanPowerContribution(core, 0, '0')).toBe(2);
        expect(getPlayerEffectivePowerOnBase(core, core.bases[0], 0, '0')).toBe(8);
    });

    it('大衮天赋会授予“额外打出一个随从到这里”的基地限定额度', () => {
        const core = makeState({
            bases: [makeBase({ minions: [makeMinion('local-1', 'innsmouth_the_locals', '0', 2)] })],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-minion', 'pirate_first_mate', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.INNSMOUTH, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            titans: [{
                uid: 't-dagon',
                defId: 'innsmouth_dagon',
                faction: SMASHUP_FACTION_IDS.INNSMOUTH,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-dagon', baseIndex: 0 },
            timestamp: 40,
        };

        const validation = SmashUpDomain.validate(state, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        const limitEvent = events.find(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvent).toBeDefined();
        expect((limitEvent as any).payload.restrictToBase).toBe(0);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(resolved.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
    });

    it('六足死神在你的随从上共有 6 枚或更多 +1 标记时可弃 1 张牌进场', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.GIANT_ANTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '六足死神进场',
            commands: titanDraft,
        });

        const titan = (result.finalState.core.titans ?? []).find(candidate => candidate.defId === 'giant_ants_death_on_six_legs');
        expect(titan).toBeDefined();

        const stateWithCounters = {
            ...result.finalState,
            core: {
                ...result.finalState.core,
                bases: result.finalState.core.bases.map((base, index) => index === 0 ? {
                    ...base,
                    minions: [
                        makeMinion('ant-queen', 'giant_ant_queen', '0', 3, { powerCounters: 7 }),
                    ],
                } : base),
            },
        };

        const command: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: titan!.uid, baseIndex: 0 },
            timestamp: 50,
        };

        const validation = SmashUpDomain.validate(stateWithCounters, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(stateWithCounters, command, FIXED_RANDOM);
        // PR64+：该泰坦 special 需要弃 1 张牌，会创建交互，不会直接打出
        expect(events.map(event => event.type)).toEqual([]);
        expect((stateWithCounters.sys.interaction?.current?.data as any)?.sourceId)
            .toBe('titan_giant_ants_death_on_six_legs_special');
    });

    it('六足死神在随从将被消灭进弃牌堆前可选择转移 1 枚 +1 标记', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('victim', 'giant_ant_worker', '0', 2, { powerCounters: 2 })],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-six-legs',
                defId: 'giant_ants_death_on_six_legs',
                faction: SMASHUP_FACTION_IDS.GIANT_ANTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } satisfies TitanState],
        });

        const destroyEvent: SmashUpEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'victim',
                minionDefId: 'giant_ant_worker',
                fromBaseIndex: 0,
                ownerId: '0',
                reason: 'test_destroy',
            },
            timestamp: 51,
        };

        const matchState = makeMatchState(core, 'playCards', '0');
        const victim = core.bases[0]?.minions.find(minion => minion.uid === 'victim');
        expect(victim).toBeDefined();

        const triggerResult = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'victim',
            triggerMinionDefId: 'giant_ant_worker',
            triggerMinion: victim!,
            reason: 'test_destroy',
            random: FIXED_RANDOM,
            now: 51,
        });

        expect(triggerResult.events.map(event => event.type)).toEqual([
            SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
        ]);

        const resolved = [destroyEvent, ...triggerResult.events]
            .reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        const titan = (resolved.titans ?? []).find(candidate => candidate.uid === 't-six-legs');
        expect(titan?.powerCounters).toBe(1);
    });

    it('六足死神在基地计分弃置随从前也可选择转移 1 枚 +1 标记', () => {
        const scoredMinion = makeMinion('scored-ant', 'giant_ant_worker', '0', 2, { powerCounters: 3 });
        const core = makeState({
            bases: [
                makeBase({ minions: [scoredMinion] }),
                makeBase(),
            ],
            titans: [{
                uid: 't-six-legs',
                defId: 'giant_ants_death_on_six_legs',
                faction: SMASHUP_FACTION_IDS.GIANT_ANTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } satisfies TitanState],
        });

        const matchState = makeMatchState(core, 'playCards', '0');
        const triggerResult = fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'scored-ant',
            triggerMinionDefId: 'giant_ant_worker',
            triggerMinion: scoredMinion,
            random: FIXED_RANDOM,
            now: 52,
        });

        expect(triggerResult.events.map(event => event.type)).toEqual([
            SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
        ]);
        const resolved = triggerResult.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        const titan = (resolved.titans ?? []).find(candidate => candidate.uid === 't-six-legs');
        expect(titan?.powerCounters).toBe(1);
    });

    it('六足死神天赋会授予额外行动额度', () => {
        const core = makeState({
            bases: [makeBase()],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('extra-action', 'ghostly_arrival', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.GHOSTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            titans: [{
                uid: 't-six-legs',
                defId: 'giant_ants_death_on_six_legs',
                faction: SMASHUP_FACTION_IDS.GIANT_ANTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-six-legs', baseIndex: 0 },
            timestamp: 53,
        };

        const validation = SmashUpDomain.validate(state, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        const limitEvent = events.find(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvent).toBeDefined();
        expect((limitEvent as any).payload.limitType).toBe('action');
        expect((limitEvent as any).payload.delta).toBe(1);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(resolved.players['0'].actionLimit).toBe(2);
    });
    it('大熊座满足条件后可通过 special 从牌库旁进场', () => {
        const titanDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.BEAR_CAVALRY } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.TRICKSTERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: '大熊座进场',
            commands: titanDraft,
        });

        const titan = (result.finalState.core.titans ?? []).find(candidate => candidate.defId === 'bear_cavalry_major_ursa');
        expect(titan).toBeDefined();

        const stateWithOwnMinion = {
            ...result.finalState,
            core: {
                ...result.finalState.core,
                bases: result.finalState.core.bases.map((base, index) => index === 0 ? {
                    ...base,
                    minions: [makeMinion('ursa-scout', 'bear_cavalry_cub_scout', '0', 2)],
                } : base),
            },
        };

        const command: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: titan!.uid, baseIndex: 0 },
            timestamp: 60,
        };

        const validation = SmashUpDomain.validate(stateWithOwnMinion, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(stateWithOwnMinion, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), stateWithOwnMinion.core);
        const playedTitan = (resolved.titans ?? []).find(candidate => candidate.uid === titan!.uid);
        expect(playedTitan?.location).toEqual({
            zone: 'base',
            baseIndex: 0,
            enteredAt: 60,
        });
    });

    it('大熊座天赋会先加 1 枚 +1 标记再要求选择新基地', () => {
        const core = makeState({
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-ursa',
                defId: 'bear_cavalry_major_ursa',
                faction: SMASHUP_FACTION_IDS.BEAR_CAVALRY,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-ursa', baseIndex: 0 },
            timestamp: 61,
        };

        const validation = SmashUpDomain.validate(state, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_POWER_COUNTER_ADDED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        const titan = (resolved.titans ?? []).find(candidate => candidate.uid === 't-ursa');
        expect(titan?.powerCounters).toBe(1);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_bear_cavalry_major_ursa_choose_destination');
    });

    it('大熊座移动后可继续选择对手 3 或更低随从并移动到其他基地', () => {
        const core = makeState({
            bases: [
                makeBase(),
                makeBase({
                    minions: [makeMinion('enemy-minion', 'ghosts_spectre', '1', 3)],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-ursa',
                defId: 'bear_cavalry_major_ursa',
                faction: SMASHUP_FACTION_IDS.BEAR_CAVALRY,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 1,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const destinationHandler = getInteractionHandler('titan_bear_cavalry_major_ursa_choose_destination');
        const minionHandler = getInteractionHandler('titan_bear_cavalry_major_ursa_choose_minion');
        const baseHandler = getInteractionHandler('titan_bear_cavalry_major_ursa_choose_base');
        expect(destinationHandler).toBeDefined();
        expect(minionHandler).toBeDefined();
        expect(baseHandler).toBeDefined();

        const destinationResult = destinationHandler!(
            makeMatchState(core, 'playCards', '0'),
            '0',
            { baseIndex: 1, baseDefId: core.bases[1].defId },
            { continuationContext: { titanUid: 't-ursa', fromBaseIndex: 0, titanDefId: 'bear_cavalry_major_ursa' } },
            FIXED_RANDOM,
            62,
        );
        expect(destinationResult.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_MOVED]);

        const post = postProcessSystemEvents(core, destinationResult.events, FIXED_RANDOM, destinationResult.state);
        const queuedState = post.matchState ?? destinationResult.state;
        let reactionState = queuedState;
        let currentInteraction = queuedState.sys.interaction?.current;

        const reactionPrompt = maybeResolveReactionQueue(queuedState, FIXED_RANDOM, 63);
        if (reactionPrompt) {
            reactionState = reactionPrompt.state;
            currentInteraction = reactionPrompt.state.sys.interaction?.current ?? currentInteraction;
        }

        if (currentInteraction?.data?.sourceId === 'smashup_reaction_choose') {
            const triggerById = new Map(reactionState.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
            const ursaOption = currentInteraction.data.options.find((option: any) => {
                const trigger = triggerById.get(option.value?.triggerId);
                return trigger?.sourceDefId === 'bear_cavalry_major_ursa';
            }) ?? currentInteraction.data.options[0];

            const afterChoose = runCommand(
                reactionState,
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: ursaOption.id } } as any,
                FIXED_RANDOM,
            );
            reactionState = afterChoose.finalState;
            currentInteraction = getInteractionsFromMS(reactionState)[0] as any;
        }

        expect(currentInteraction?.data?.sourceId).toBe('titan_bear_cavalry_major_ursa_choose_minion');

        const chooseMinionResult = minionHandler!(
            reactionState,
            '0',
            { minionUid: 'enemy-minion', defId: 'ghosts_spectre', baseIndex: 1 },
            currentInteraction?.data,
            FIXED_RANDOM,
            63,
        );
        const queuedChooseBase = chooseMinionResult.state.sys.interaction?.queue?.[0];
        expect(queuedChooseBase?.data?.sourceId).toBe('titan_bear_cavalry_major_ursa_choose_base');

        const chooseBaseResult = baseHandler!(
            chooseMinionResult.state,
            '0',
            { baseIndex: 2, baseDefId: core.bases[2].defId },
            queuedChooseBase?.data,
            FIXED_RANDOM,
            64,
        );
        expect(chooseBaseResult.events.map(event => event.type)).toEqual([SU_EVENTS.MINION_MOVED]);
        expect((chooseBaseResult.events[0] as any).payload).toMatchObject({
            minionUid: 'enemy-minion',
            fromBaseIndex: 1,
            toBaseIndex: 2,
        });
    });

    it('合体机器人会在你的回合开始时，为满足条件的 set-aside 泰坦创建进场交互', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('merge-a', 'robot_microbot_alpha', '0', 1),
                        makeMinion('merge-b', 'robot_microbot_beta', '0', 2),
                    ],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-mergacon-setaside',
                defId: 'changerbots_mergacon',
                faction: SMASHUP_FACTION_IDS.CHANGERBOTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const triggerResult = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 78,
        });

        const interactions = getInteractionsFromMS(triggerResult.matchState!);
        expect(interactions.map(interaction => interaction.data?.sourceId)).toContain('titan_changerbots_mergacon_play');
    });

    it('合体机器人的进场交互解决后会把泰坦打到所选基地', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('merge-a', 'robot_microbot_alpha', '0', 1),
                        makeMinion('merge-b', 'robot_microbot_beta', '0', 2),
                    ],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-mergacon-setaside',
                defId: 'changerbots_mergacon',
                faction: SMASHUP_FACTION_IDS.CHANGERBOTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const handler = getInteractionHandler('titan_changerbots_mergacon_play');
        expect(handler).toBeDefined();

        const resolved = handler!(
            makeMatchState(core, 'startTurn', '0'),
            '0',
            { baseIndex: 0, baseDefId: core.bases[0].defId },
            { continuationContext: { titanUid: 't-mergacon-setaside', titanDefId: 'changerbots_mergacon' } },
            FIXED_RANDOM,
            79,
        );
        expect(resolved.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_PLAYED]);

        const next = resolved.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(next.titans?.find(candidate => candidate.uid === 't-mergacon-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('合体机器人在未被压制时提供 +3 战力，被天赋压制后直到回合结束失效', () => {
        const core = makeState({
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-mergacon',
                defId: 'changerbots_mergacon',
                faction: SMASHUP_FACTION_IDS.CHANGERBOTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        expect(getTitanPowerContribution(core, 0, '0')).toBe(3);

        const suppressed = SmashUpDomain.reduce(core, {
            type: SU_EVENTS.TITAN_ONGOING_SUPPRESSED,
            payload: { titanUid: 't-mergacon', reason: 'test' },
            timestamp: 80,
        } as SmashUpEvent);
        expect(getTitanPowerContribution(suppressed, 0, '0')).toBe(0);

        const cleared = SmashUpDomain.reduce(suppressed, {
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '0', nextPlayerIndex: 1 },
            timestamp: 81,
        } as SmashUpEvent);
        expect(getTitanPowerContribution(cleared, 0, '0')).toBe(3);
    });

    it('合体机器人天赋会移动泰坦并写入本回合 ongoing 压制标记', () => {
        const core = makeState({
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-mergacon',
                defId: 'changerbots_mergacon',
                faction: SMASHUP_FACTION_IDS.CHANGERBOTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-mergacon', baseIndex: 0 },
            timestamp: 82,
        };

        const validation = SmashUpDomain.validate(state, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_changerbots_mergacon_talent');

        const handler = getInteractionHandler('titan_changerbots_mergacon_talent');
        expect(handler).toBeDefined();
        const resolved = handler!(
            state,
            '0',
            { baseIndex: 1, baseDefId: core.bases[1].defId },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            83,
        );
        expect(resolved.events.map(event => event.type)).toEqual([
            SU_EVENTS.TITAN_ONGOING_SUPPRESSED,
            SU_EVENTS.TITAN_MOVED,
        ]);

        const next = resolved.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(next.titanOngoingSuppressedUntilTurnEnd).toContain('t-mergacon');
        expect(next.titans?.find(candidate => candidate.uid === 't-mergacon')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('彩虹鸟在你赢得基地后会创建打到替换基地的 special 交互', () => {
        const core = makeState({
            bases: [
                makeBase({ defId: 'base_the_homeworld' }),
                makeBase({ defId: 'base_the_mothership' }),
            ],
            baseDeck: ['base_factory_436-1337'],
            titans: [{
                uid: 't-rainboroc-setaside',
                defId: 'itty_critters_rainboroc',
                faction: SMASHUP_FACTION_IDS.ITTY_CRITTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const triggerResult = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [
                { playerId: '0', power: 10, vp: 1 },
                { playerId: '1', power: 6, vp: 0 },
            ],
            random: FIXED_RANDOM,
            now: 84,
        });

        expect(getInteractionsFromMS(triggerResult.matchState!).map(interaction => interaction.data?.sourceId)).toContain(
            'titan_itty_critters_rainboroc_play_replacement',
        );

        const state = makeMatchState(core);
        const smashUpEventSystem = createSmashUpEventSystem();
        const hook = smashUpEventSystem.afterEvents?.({
            state,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'test-rainboroc-play',
                    playerId: '0',
                    optionId: 'play',
                    value: { play: true },
                    sourceId: 'titan_itty_critters_rainboroc_play_replacement',
                    interactionData: {
                        sourceId: 'titan_itty_critters_rainboroc_play_replacement',
                        continuationContext: {
                            titanUid: 't-rainboroc-setaside',
                            titanDefId: 'itty_critters_rainboroc',
                            _deferredPostScoringEvents: [
                                {
                                    type: SU_EVENTS.BASE_CLEARED,
                                    payload: { baseIndex: 0, baseDefId: core.bases[0].defId },
                                    timestamp: 85,
                                },
                                {
                                    type: SU_EVENTS.BASE_REPLACED,
                                    payload: {
                                        baseIndex: 0,
                                        oldBaseDefId: core.bases[0].defId,
                                        newBaseDefId: 'base_factory_436-1337',
                                    },
                                    timestamp: 85,
                                },
                            ],
                        },
                    },
                },
                timestamp: 85,
            } as any],
            random: FIXED_RANDOM,
        }) as any;

        const emittedEvents = hook?.events ?? [];
        expect(emittedEvents.map((event: SmashUpEvent) => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
            SU_EVENTS.TITAN_PLAYED,
        ]);

        const postSystemState = hook?.state ?? state;
        const finalCore = emittedEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            postSystemState.core,
        );
        expect(finalCore.titans?.find(candidate => candidate.uid === 't-rainboroc-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
        expect(finalCore.bases[0].defId).toBe('base_factory_436-1337');
    });

    it('彩虹鸟只会在每回合第一次你在这里打出战力 2 或更低的随从后获得 1 枚力量指示物', () => {
        const firstMinion = makeMinion('rain-first', 'ghosts_spectre', '0', 2, { playedThisTurn: true });
        const core = makeState({
            bases: [makeBase({ minions: [firstMinion] })],
            titans: [{
                uid: 't-rainboroc',
                defId: 'itty_critters_rainboroc',
                faction: SMASHUP_FACTION_IDS.ITTY_CRITTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const firstTrigger = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'rain-first',
            random: FIXED_RANDOM,
            now: 86,
        });
        expect(firstTrigger.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_POWER_COUNTER_ADDED]);

        const afterFirst = firstTrigger.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(afterFirst.titans?.find(candidate => candidate.uid === 't-rainboroc')?.powerCounters).toBe(1);

        const secondCore: SmashUpCore = {
            ...afterFirst,
            bases: [
                {
                    ...afterFirst.bases[0],
                    minions: [
                        ...afterFirst.bases[0].minions,
                        makeMinion('rain-second', 'trickster_gnome', '0', 2, { playedThisTurn: true }),
                    ],
                },
            ],
        };

        const secondTrigger = fireTriggers(secondCore, 'onMinionPlayed', {
            state: secondCore,
            matchState: makeMatchState(secondCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'rain-second',
            random: FIXED_RANDOM,
            now: 87,
        });
        expect(secondTrigger.events).toEqual([]);
    });

    it('彩虹鸟天赋会把低战力随从从弃牌堆洗回牌库，并可继续移动到其他基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('rain-discard-minion', 'pirate_first_mate', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-rainboroc',
                defId: 'itty_critters_rainboroc',
                faction: SMASHUP_FACTION_IDS.ITTY_CRITTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-rainboroc', baseIndex: 0 },
            timestamp: 88,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_itty_critters_rainboroc_choose_discard');

        const chooseDiscardHandler = getInteractionHandler('titan_itty_critters_rainboroc_choose_discard');
        const chooseBaseHandler = getInteractionHandler('titan_itty_critters_rainboroc_choose_base');
        expect(chooseDiscardHandler).toBeDefined();
        expect(chooseBaseHandler).toBeDefined();

        const chooseDiscardResult = chooseDiscardHandler!(
            state,
            '0',
            { cardUid: 'rain-discard-minion', defId: 'pirate_first_mate' },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            89,
        );
        expect(chooseDiscardResult.events.map(event => event.type)).toEqual([SU_EVENTS.DECK_REORDERED]);
        expect(chooseDiscardResult.state.sys.interaction?.queue?.[0]?.data?.sourceId).toBe(
            'titan_itty_critters_rainboroc_choose_base',
        );

        const afterShuffle = chooseDiscardResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(afterShuffle.players['0'].discard.map(card => card.uid)).not.toContain('rain-discard-minion');
        expect(afterShuffle.players['0'].deck.map(card => card.uid)).toContain('rain-discard-minion');

        const chooseBaseResult = chooseBaseHandler!(
            chooseDiscardResult.state,
            '0',
            { baseIndex: 1, baseDefId: core.bases[1].defId },
            chooseDiscardResult.state.sys.interaction?.queue?.[0]?.data as any,
            FIXED_RANDOM,
            90,
        );
        expect(chooseBaseResult.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_MOVED]);

        const resolved = chooseBaseResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            afterShuffle,
        );
        expect(resolved.titans?.find(candidate => candidate.uid === 't-rainboroc')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('哥佐拉满足本基地有你至少两个战术后可通过 special 从牌库旁进场，并统计附着战术', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'test_base',
                    ongoingActions: [
                        { uid: 'gorg-base-action', defId: 'trickster_hideout', ownerId: '0', talentUsed: false },
                    ],
                    minions: [
                        makeMinion('gorg-host-minion', 'ghosts_spectre', '0', 2, {
                            attachedActions: [
                                { uid: 'gorg-attached-action', defId: 'trickster_hideout', ownerId: '0' },
                            ],
                        }),
                    ],
                }),
                makeBase({
                    defId: 'base_other',
                    ongoingActions: [
                        { uid: 'gorg-single-action', defId: 'trickster_hideout', ownerId: '0', talentUsed: false },
                    ],
                }),
            ],
            titans: [{
                uid: 't-gorgodzolla',
                defId: 'kaiju_gorgodzolla',
                faction: SMASHUP_FACTION_IDS.KAIJU,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const validCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-gorgodzolla', baseIndex: 0 },
            timestamp: 91,
        };
        const invalidCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-gorgodzolla', baseIndex: 1 },
            timestamp: 92,
        };

        expect(SmashUpDomain.validate(state, validCommand).valid).toBe(true);
        expect(SmashUpDomain.validate(state, invalidCommand).valid).toBe(false);

        const events = SmashUpDomain.execute(state, validCommand, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(resolved.titans?.find(candidate => candidate.uid === 't-gorgodzolla')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('哥佐拉在你于本基地打出随从后会获得 1 枚力量指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gorg-minion', 'ghosts_spectre', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'test_base' })],
            titans: [{
                uid: 't-gorgodzolla',
                defId: 'kaiju_gorgodzolla',
                faction: SMASHUP_FACTION_IDS.KAIJU,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const result = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'gorg-minion', baseIndex: 0, fromDiscard: false },
                timestamp: 93,
            },
            FIXED_RANDOM,
        );

        expect(result.success).toBe(true);
        expect(result.events.map(event => event.type)).toContain(SU_EVENTS.TITAN_POWER_COUNTER_ADDED);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('gorg-minion');
        expect(result.finalState.core.titans?.find(candidate => candidate.uid === 't-gorgodzolla')?.powerCounters).toBe(1);
    });

    it('哥佐拉在你于本基地打出战术后会获得指示物，并可通过交互抽 1 张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gorg-action', 'trickster_hideout', 'action', '0')],
                    deck: [makeCard('gorg-draw-card', 'ghosts_spectre', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'test_base' })],
            titans: [{
                uid: 't-gorgodzolla',
                defId: 'kaiju_gorgodzolla',
                faction: SMASHUP_FACTION_IDS.KAIJU,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const result = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'gorg-action', targetBaseIndex: 0 },
                timestamp: 94,
            },
            FIXED_RANDOM,
        );

        expect(result.success).toBe(true);
        expect(result.events.map(event => event.type)).toContain(SU_EVENTS.TRIGGER_QUEUED);
        const drawHandler = getInteractionHandler('titan_kaiju_gorgodzolla_draw');
        expect(drawHandler).toBeDefined();
        expect(result.finalState.sys.interaction?.current?.data?.sourceId).toBe('titan_kaiju_gorgodzolla_draw');
        expect(result.finalState.core.titans?.find(candidate => candidate.uid === 't-gorgodzolla')?.powerCounters).toBe(1);

        const drawResult = drawHandler!(
            result.finalState,
            '0',
            { draw: true },
            result.finalState.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            95,
        );

        expect(drawResult.events.map(event => event.type)).toEqual([SU_EVENTS.CARDS_DRAWN]);
        const resolved = drawResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            result.finalState.core,
        );
        expect(resolved.players['0'].hand.map(card => card.uid)).toContain('gorg-draw-card');
    });

    it('移动城堡满足本基地有你至少 2 个随从后可通过 special 从牌库旁进场', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('castle-own-a', 'ghosts_spectre', '0', 2),
                        makeMinion('castle-own-b', 'pirate_first_mate', '0', 2),
                    ],
                }),
                makeBase({
                    minions: [makeMinion('castle-only-one', 'ghosts_spectre', '0', 2)],
                }),
            ],
            titans: [{
                uid: 't-walking-castle-setaside',
                defId: 'magical_girls_walking_castle',
                faction: SMASHUP_FACTION_IDS.MAGICAL_GIRLS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const validCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-walking-castle-setaside', baseIndex: 0 },
            timestamp: 97,
        };
        const invalidCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-walking-castle-setaside', baseIndex: 1 },
            timestamp: 98,
        };

        expect(SmashUpDomain.validate(state, validCommand).valid).toBe(true);
        expect(SmashUpDomain.validate(state, invalidCommand).valid).toBe(false);

        const events = SmashUpDomain.execute(state, validCommand, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(resolved.titans?.find(candidate => candidate.uid === 't-walking-castle-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('硕大圆石满足目标基地没有玩家随从后可通过 special 从牌库旁进场', () => {
        const core = makeState({
            bases: [
                makeBase(),
                makeBase({
                    minions: [makeMinion('boulder-blocker', 'ghosts_spectre', '0', 2)],
                }),
            ],
            titans: [{
                uid: 't-boulder-setaside',
                defId: 'explorers_very_large_boulder',
                faction: SMASHUP_FACTION_IDS.EXPLORERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const validCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-boulder-setaside', baseIndex: 0 },
            timestamp: 97,
        };
        const invalidCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-boulder-setaside', baseIndex: 1 },
            timestamp: 98,
        };

        expect(SmashUpDomain.validate(state, validCommand).valid).toBe(true);
        expect(SmashUpDomain.validate(state, invalidCommand).valid).toBe(false);

        const events = SmashUpDomain.execute(state, validCommand, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(resolved.titans?.find(candidate => candidate.uid === 't-boulder-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('硕大圆石会在随从从本基地移走后由泰坦控制者触发一次，并在移动后消灭低于标记数的随从', () => {
        const core = makeState({
            turnNumber: 4,
            bases: [
                makeBase({
                    minions: [makeMinion('moved-away', 'trickster_gnome', '1', 3)],
                }),
                makeBase({
                    minions: [
                        makeMinion('boulder-target', 'robot_microbot_guard', '1', 1),
                        makeMinion('boulder-safe', 'trickster_gnome', '1', 3),
                    ],
                }),
            ],
            titans: [{
                uid: 't-boulder-live',
                defId: 'explorers_very_large_boulder',
                faction: SMASHUP_FACTION_IDS.EXPLORERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 2,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const moveResult = processMoveTriggers([{
                type: SU_EVENTS.MINION_MOVED,
                payload: {
                    minionUid: 'moved-away',
                    minionDefId: 'trickster_gnome',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'test_move_from_boulder',
            },
            timestamp: 99,
        } as SmashUpEvent], state, '1', FIXED_RANDOM, 99);

        const queuedCore = moveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            state.core,
        );
        const queuedState = {
            ...(moveResult.matchState ?? state),
            core: queuedCore,
        };
        const reactionResult = maybeResolveReactionQueue(queuedState, FIXED_RANDOM, 99);
        const boulderInteraction =
            reactionResult?.state.sys.interaction?.current
            ?? reactionResult?.state.sys.interaction?.queue?.[0];

        expect(reactionResult?.events.map(event => event.type)).toEqual([SU_EVENTS.TRIGGER_CONSUMED]);
        expect((boulderInteraction?.data as any)?.sourceId).toBe('titan_explorers_very_large_boulder_move');
        expect(boulderInteraction?.playerId).toBe('0');
        expect(reactionResult?.state.core.veryLargeBoulderTriggeredTurnByTitan?.['t-boulder-live']).toBe(4);

        const moveHandler = getInteractionHandler('titan_explorers_very_large_boulder_move');
        const destroyHandler = getInteractionHandler('titan_explorers_very_large_boulder_destroy');
        expect(moveHandler).toBeDefined();
        expect(destroyHandler).toBeDefined();

        const chooseMoveResult = moveHandler!(
            reactionResult!.state,
            '0',
            { move: true },
            boulderInteraction?.data as any,
            FIXED_RANDOM,
            100,
        );
        expect(chooseMoveResult.events.map(event => event.type)).toContain(SU_EVENTS.TITAN_MOVED);

        const pendingDestroyInteraction =
            chooseMoveResult.state.sys.interaction?.current
            ?? chooseMoveResult.state.sys.interaction?.queue?.[0];
        const destroyEvents =
            (pendingDestroyInteraction?.data as any)?.sourceId === 'titan_explorers_very_large_boulder_destroy'
                ? destroyHandler!(
                    chooseMoveResult.state,
                    '0',
                    { minionUid: 'boulder-target' },
                    pendingDestroyInteraction.data as any,
                    FIXED_RANDOM,
                    101,
                ).events
                : [];
        const allEvents = [...chooseMoveResult.events, ...destroyEvents];
        expect(allEvents.map(event => event.type)).toContain(SU_EVENTS.MINION_DESTROYED);

        const resolved = allEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            reactionResult!.state.core,
        );
        expect(resolved.titans?.find(candidate => candidate.uid === 't-boulder-live')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
        expect(resolved.bases[1].minions.map(minion => minion.uid)).not.toContain('boulder-target');
        expect(resolved.bases[1].minions.map(minion => minion.uid)).toContain('boulder-safe');

        const secondMoveResult = processMoveTriggers([{
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'boulder-safe',
                minionDefId: 'trickster_gnome',
                fromBaseIndex: 1,
                toBaseIndex: 0,
                reason: 'test_move_same_turn_again',
            },
            timestamp: 102,
        } as SmashUpEvent], { ...reactionResult!.state, core: resolved }, '1', FIXED_RANDOM, 102);
        expect(secondMoveResult.events.map(event => event.type)).not.toContain(SU_EVENTS.TRIGGER_QUEUED);
    });

    it('硕大圆石会在你的回合结束时仅在本回合未移动过的情况下获得 1 枚力量标记', () => {
        const idleCore = makeState({
            turnNumber: 6,
            titans: [{
                uid: 't-boulder-idle',
                defId: 'explorers_very_large_boulder',
                faction: SMASHUP_FACTION_IDS.EXPLORERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 1,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });
        const movedCore = {
            ...idleCore,
            titans: [{
                uid: 't-boulder-moved',
                defId: 'explorers_very_large_boulder',
                faction: SMASHUP_FACTION_IDS.EXPLORERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 1,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
            titanMovedTurnByTitanUid: { 't-boulder-moved': 6 },
        };

        const idleResult = fireTriggers(idleCore, 'onTurnEnd', {
            state: idleCore,
            matchState: makeMatchState(idleCore, 'endTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 102,
        }, { phase: 'reaction' });
        expect(idleResult.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_POWER_COUNTER_ADDED]);

        const movedResult = fireTriggers(movedCore, 'onTurnEnd', {
            state: movedCore,
            matchState: makeMatchState(movedCore, 'endTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 103,
        }, { phase: 'reaction' });
        expect(movedResult.events).toEqual([]);
    });

    it('移动城堡会保护同基地己方随从免受其他玩家卡牌效果消灭，但不会拦自己的效果或基地效果', () => {
        const protectedMinion = makeMinion('castle-ally', 'ghosts_spectre', '0', 2);
        const core = makeState({
            bases: [makeBase({
                minions: [protectedMinion],
            })],
            titans: [{
                uid: 't-walking-castle-live',
                defId: 'magical_girls_walking_castle',
                faction: SMASHUP_FACTION_IDS.MAGICAL_GIRLS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const enemyDestroy = filterProtectedDestroyEvents([
            {
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: 'castle-ally',
                    minionDefId: 'ghosts_spectre',
                    fromBaseIndex: 0,
                    ownerId: '0',
                    destroyerId: '1',
                    reason: 'magical_girls_enemy_spell',
                },
                timestamp: 99,
            } as SmashUpEvent,
        ], core, '1');
        expect(enemyDestroy).toEqual([]);

        const selfDestroy = filterProtectedDestroyEvents([
            {
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: 'castle-ally',
                    minionDefId: 'ghosts_spectre',
                    fromBaseIndex: 0,
                    ownerId: '0',
                    destroyerId: '0',
                    reason: 'magical_girls_self_effect',
                },
                timestamp: 100,
            } as SmashUpEvent,
        ], core, '0');
        expect(selfDestroy.map(event => event.type)).toEqual([SU_EVENTS.MINION_DESTROYED]);

        const baseDestroy = filterProtectedDestroyEvents([
            {
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: 'castle-ally',
                    minionDefId: 'ghosts_spectre',
                    fromBaseIndex: 0,
                    ownerId: '0',
                    destroyerId: '1',
                    reason: 'base_rlyeh',
                },
                timestamp: 101,
            } as SmashUpEvent,
        ], core, '1');
        expect(baseDestroy.map(event => event.type)).toEqual([SU_EVENTS.MINION_DESTROYED]);
    });

    it('移动城堡天赋会先选择目标基地，再选择至多 3 个己方随从一起移动过去', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('castle-move-a', 'ghosts_spectre', '0', 2),
                        makeMinion('castle-move-b', 'pirate_first_mate', '0', 2),
                        makeMinion('castle-stay', 'robot_microbot_alpha', '0', 1),
                    ],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-walking-castle-live',
                defId: 'magical_girls_walking_castle',
                faction: SMASHUP_FACTION_IDS.MAGICAL_GIRLS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-walking-castle-live', baseIndex: 0 },
            timestamp: 102,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_magical_girls_walking_castle_choose_base');

        const chooseMinionsHandler = getInteractionHandler('titan_magical_girls_walking_castle_choose_minions');
        const chooseBaseHandler = getInteractionHandler('titan_magical_girls_walking_castle_choose_base');
        expect(chooseMinionsHandler).toBeDefined();
        expect(chooseBaseHandler).toBeDefined();

        const chooseBaseResult = chooseBaseHandler!(
            state,
            '0',
            { baseIndex: 1, baseDefId: core.bases[1].defId },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            103,
        );
        expect(chooseBaseResult.state.sys.interaction?.queue?.[0]?.data?.sourceId).toBe(
            'titan_magical_girls_walking_castle_choose_minions',
        );

        const chooseMinionsResult = chooseMinionsHandler!(
            chooseBaseResult.state,
            '0',
            [
                { minionUid: 'castle-move-a', baseIndex: 0 },
                { minionUid: 'castle-move-b', baseIndex: 0 },
            ],
            chooseBaseResult.state.sys.interaction?.queue?.[0]?.data as any,
            FIXED_RANDOM,
            104,
        );
        expect(chooseMinionsResult.events.map(event => event.type)).toEqual([
            SU_EVENTS.TITAN_MOVED,
            SU_EVENTS.MINION_MOVED,
            SU_EVENTS.MINION_MOVED,
        ]);

        const resolved = chooseMinionsResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(resolved.titans?.find(candidate => candidate.uid === 't-walking-castle-live')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
        expect(resolved.bases[1].minions.map(minion => minion.uid)).toEqual(
            expect.arrayContaining(['castle-move-a', 'castle-move-b']),
        );
        expect(resolved.bases[0].minions.map(minion => minion.uid)).toContain('castle-stay');
    });

    it('漫游山岭巨人在至少 2 个你拥有的随从正被其他玩家控制时可通过 special 进场', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('hill-stolen-a', 'ghosts_spectre', '1', 2, { owner: '0' }),
                        makeMinion('hill-stolen-b', 'pirate_first_mate', '1', 2, { owner: '0' }),
                    ],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-hill-setaside',
                defId: 'ignobles_the_hill_that_strolls',
                faction: SMASHUP_FACTION_IDS.IGNOBLES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const validCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-hill-setaside', baseIndex: 1 },
            timestamp: 105,
        };
        const invalidCore = makeState({
            ...core,
            bases: [
                makeBase({
                    minions: [makeMinion('hill-stolen-only', 'ghosts_spectre', '1', 2, { owner: '0' })],
                }),
                makeBase(),
            ],
        });
        const invalidState = makeMatchState(invalidCore);
        const invalidCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-hill-setaside', baseIndex: 1 },
            timestamp: 106,
        };

        expect(SmashUpDomain.validate(state, validCommand).valid).toBe(true);
        expect(SmashUpDomain.validate(invalidState, invalidCommand).valid).toBe(false);

        const events = SmashUpDomain.execute(state, validCommand, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);
    });

    it('漫游山岭巨人交出己方随从控制权抽牌后，会通过 ongoing 交互给该随从放置 1 枚力量标记', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('hill-give-target', 'ghosts_spectre', '0', 2)],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-hill-live',
                defId: 'ignobles_the_hill_that_strolls',
                faction: SMASHUP_FACTION_IDS.IGNOBLES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } satisfies TitanState],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('hill-draw-card', 'ghosts_spectre', 'minion')],
                }),
                '1': makePlayer('1'),
            },
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-hill-live', baseIndex: 1 },
            timestamp: 107,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_ignobles_the_hill_that_strolls_give_minion');

        const giveMinionHandler = getInteractionHandler('titan_ignobles_the_hill_that_strolls_give_minion');
        const counterHandler = getInteractionHandler('titan_ignobles_the_hill_that_strolls_counter');
        expect(giveMinionHandler).toBeDefined();
        expect(counterHandler).toBeDefined();

        const giveResult = giveMinionHandler!(
            state,
            '0',
            { minionUid: 'hill-give-target', baseIndex: 0, defId: 'ghosts_spectre' },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            108,
        );
        expect(giveResult.events.map(event => event.type)).toEqual([
            SU_EVENTS.MINION_CONTROL_CHANGED,
            SU_EVENTS.CARDS_DRAWN,
        ]);

        const giveResolvedCore = giveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(giveResolvedCore.bases[0].minions.find(minion => minion.uid === 'hill-give-target')?.controller).toBe('1');
        const cleanTriggerState = makeMatchState(giveResolvedCore, 'playCards', '0');

        const affectResult = processAffectTriggers(
            giveResult.events,
            cleanTriggerState,
            '0',
            FIXED_RANDOM,
            108,
        );
        const queuedCore = affectResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            giveResolvedCore,
        );
        const queuedState = { ...(affectResult.matchState ?? cleanTriggerState), core: queuedCore };
        const reactionResult = maybeResolveReactionQueue(queuedState, FIXED_RANDOM, 108);
        let reactionState = reactionResult?.state ?? queuedState;
        let currentInteraction =
            reactionState.sys.interaction?.current
            ?? reactionState.sys.interaction?.queue?.[0];

        if (currentInteraction?.data?.sourceId === 'smashup_reaction_choose') {
            const triggerById = new Map(reactionState.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
            const hillOption = currentInteraction.data.options.find((option: any) => {
                const trigger = triggerById.get(option.value?.triggerId);
                return trigger?.sourceDefId === 'ignobles_the_hill_that_strolls';
            }) ?? currentInteraction.data.options[0];

            const afterChoose = runCommand(
                reactionState,
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: hillOption.id } } as any,
                FIXED_RANDOM,
            );
            reactionState = afterChoose.finalState;
            currentInteraction = getInteractionsFromMS(reactionState)[0] as any;
        }

        expect(currentInteraction?.data?.sourceId).toBe('titan_ignobles_the_hill_that_strolls_counter');

        const counterResult = counterHandler!(
            reactionState,
            '0',
            { place: true },
            currentInteraction?.data as any,
            FIXED_RANDOM,
            109,
        );
        expect(counterResult.events.map(event => event.type)).toEqual([SU_EVENTS.POWER_COUNTER_ADDED]);

        const finalCore = counterResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            queuedCore,
        );
        const transferredMinion = finalCore.bases[0].minions.find(minion => minion.uid === 'hill-give-target');
        expect(transferredMinion?.controller).toBe('1');
        expect(transferredMinion?.powerCounters).toBe(1);
    });

    it('漫游山岭巨人可通过 talent 夺回这里一个你拥有但被其他玩家控制的随从', () => {
        const core = makeState({
            bases: [makeBase({
                minions: [makeMinion('hill-reclaim-target', 'pirate_first_mate', '1', 2, { owner: '0' })],
            })],
            titans: [{
                uid: 't-hill-live',
                defId: 'ignobles_the_hill_that_strolls',
                faction: SMASHUP_FACTION_IDS.IGNOBLES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-hill-live', baseIndex: 0 },
            timestamp: 110,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_ignobles_the_hill_that_strolls_reclaim_minion');

        const reclaimHandler = getInteractionHandler('titan_ignobles_the_hill_that_strolls_reclaim_minion');
        expect(reclaimHandler).toBeDefined();

        const reclaimResult = reclaimHandler!(
            state,
            '0',
            { minionUid: 'hill-reclaim-target', baseIndex: 0, defId: 'pirate_first_mate' },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            111,
        );
        expect(reclaimResult.events.map(event => event.type)).toEqual([SU_EVENTS.MINION_CONTROL_CHANGED]);

        const resolved = reclaimResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(resolved.bases[0].minions.find(minion => minion.uid === 'hill-reclaim-target')?.controller).toBe('0');
    });

    it('时间盒子在回合开始得到第 5 枚计数后会创建进场交互，并在选择基地后清零计数并进场', () => {
        const core = makeState({
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-time-box-setaside',
                defId: 'time_travelers_time_box',
                faction: SMASHUP_FACTION_IDS.TIME_TRAVELERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                metadata: { timeBoxCounters: 4 },
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const triggerResult = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 112,
        });

        expect(triggerResult.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_METADATA_UPDATED]);
        const currentInteraction = triggerResult.matchState?.sys.interaction?.current;
        expect(currentInteraction?.data?.sourceId).toBe('titan_time_travelers_time_box_play');

        const afterCounterCore = triggerResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(afterCounterCore.titans?.find(candidate => candidate.uid === 't-time-box-setaside')?.metadata?.timeBoxCounters).toBe(5);

        const handler = getInteractionHandler('titan_time_travelers_time_box_play');
        expect(handler).toBeDefined();

        const queuedState = { ...(triggerResult.matchState ?? makeMatchState(core)), core: afterCounterCore };
        const resolved = handler!(
            queuedState,
            '0',
            { baseIndex: 1, baseDefId: core.bases[1].defId },
            currentInteraction?.data as any,
            FIXED_RANDOM,
            113,
        );
        expect(resolved.events.map(event => event.type)).toEqual([
            SU_EVENTS.TITAN_METADATA_UPDATED,
            SU_EVENTS.TITAN_PLAYED,
        ]);

        const finalCore = resolved.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            afterCounterCore,
        );
        expect(finalCore.titans?.find(candidate => candidate.uid === 't-time-box-setaside')).toMatchObject({
            location: { zone: 'base', baseIndex: 1, enteredAt: 113 },
            metadata: { timeBoxCounters: 0 },
        });
    });

    it('时间盒子会在有牌从弃牌堆回到你的手牌时增加计数，并在达到阈值后起进场交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('time-box-recovered-card', 'pirate_first_mate', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-time-box-discard',
                defId: 'time_travelers_time_box',
                faction: SMASHUP_FACTION_IDS.TIME_TRAVELERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                metadata: { timeBoxCounters: 4 },
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const recoveredEvent: SmashUpEvent = {
            type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            payload: {
                playerId: '0',
                cardUids: ['time-box-recovered-card'],
                reason: 'time_box_smoke_recover',
            },
            timestamp: 114,
        };
        const matchState = makeMatchState(core, 'playCards', '0');
        const processed = processReturnToHandTriggers([recoveredEvent], matchState, '0', FIXED_RANDOM, 114);

        expect(processed.events.map(event => event.type)).toEqual([
            SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            SU_EVENTS.TRIGGER_QUEUED,
        ]);
        const queuedCore = processed.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        const queuedState = { ...(processed.matchState ?? matchState), core: queuedCore };
        const reactionResult = maybeResolveReactionQueue(queuedState, FIXED_RANDOM, 114);
        let reactionState = reactionResult?.state ?? queuedState;
        let resolvedEvents = reactionResult?.events ?? [];
        let currentInteraction = reactionState.sys.interaction?.current;

        if (currentInteraction?.data?.sourceId === 'smashup_reaction_choose') {
            const triggerById = new Map(reactionState.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
            const timeBoxOption = currentInteraction.data.options.find((option: any) => {
                const trigger = triggerById.get(option.value?.triggerId);
                return trigger?.sourceDefId === 'time_travelers_time_box';
            }) ?? currentInteraction.data.options[0];

            const afterChoose = runCommand(
                reactionState,
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: timeBoxOption.id } } as any,
                FIXED_RANDOM,
            );
            reactionState = afterChoose.finalState;
            resolvedEvents = afterChoose.events;
            currentInteraction = getInteractionsFromMS(reactionState)[0] as any;
        }

        expect(resolvedEvents.map(event => event.type)).toContain(SU_EVENTS.TRIGGER_CONSUMED);
        expect(resolvedEvents.map(event => event.type)).toContain(SU_EVENTS.TITAN_METADATA_UPDATED);

        expect(currentInteraction?.data?.sourceId).toBe('titan_time_travelers_time_box_play');

        const domainEvents = resolvedEvents.filter(event => typeof event.type === 'string' && event.type.startsWith('su:'));
        const finalCore = domainEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            queuedCore,
        );
        expect(finalCore.titans?.find(candidate => candidate.uid === 't-time-box-discard')?.metadata?.timeBoxCounters).toBe(5);
    });

    it('时间盒子天赋会给予所在基地额外低战力随从额度，并额外给予 1 次战术额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('time-box-low-minion', 'pirate_first_mate', 'minion', '0'),
                        makeCard('time-box-high-minion', 'trickster_gnome', 'minion', '0'),
                    ],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-time-box-live',
                defId: 'time_travelers_time_box',
                faction: SMASHUP_FACTION_IDS.TIME_TRAVELERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-time-box-live', baseIndex: 0 },
            timestamp: 115,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toEqual([
            SU_EVENTS.TALENT_USED,
            SU_EVENTS.LIMIT_MODIFIED,
            SU_EVENTS.LIMIT_MODIFIED,
        ]);

        const minionLimitEvent = events.find(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED && (event as any).payload.limitType === 'minion',
        ) as any;
        const actionLimitEvent = events.find(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED && (event as any).payload.limitType === 'action',
        ) as any;
        expect(minionLimitEvent).toBeDefined();
        expect(minionLimitEvent.payload.restrictToBase).toBe(0);
        expect(minionLimitEvent.payload.powerMax).toBe(2);
        expect(actionLimitEvent).toBeDefined();
        expect(actionLimitEvent.payload.delta).toBe(1);

        const resolved = events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(resolved.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(resolved.players['0'].baseLimitedMinionPowerCaps?.[0]).toEqual([2]);
        expect(resolved.players['0'].actionLimit).toBe(2);
        expect(resolved.players['0'].minionLimit).toBe(1);

        const postTalentState = makeMatchState(resolved, 'playCards', '0');
        const lowPowerCommand: SmashUpCommand = {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'time-box-low-minion', baseIndex: 0 },
            timestamp: 116,
        };
        const highPowerCommand: SmashUpCommand = {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'time-box-high-minion', baseIndex: 0 },
            timestamp: 117,
        };

        expect(SmashUpDomain.validate(postTalentState, lowPowerCommand).valid).toBe(true);
        expect(SmashUpDomain.validate(postTalentState, highPowerCommand)).toMatchObject({
            valid: false,
            error: '额外出牌只能打出力量≤2的随从',
        });

        const lowPowerEvents = SmashUpDomain.execute(postTalentState, lowPowerCommand, FIXED_RANDOM);
        const afterLowPowerPlay = lowPowerEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            resolved,
        );
        expect(afterLowPowerPlay.players['0'].baseLimitedMinionQuota?.[0]).toBe(0);
        expect(afterLowPowerPlay.players['0'].baseLimitedMinionPowerCaps).toBeUndefined();
    });

    it('三号空间站满足基地没有其他玩家随从后可通过 special 从牌库旁进场', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('moon-own-minion', 'pirate_first_mate', '0', 2)],
                }),
                makeBase({
                    minions: [makeMinion('moon-enemy-minion', 'robot_microbot_guard', '1', 1)],
                }),
            ],
            titans: [{
                uid: 't-moon-setaside',
                defId: 'super_spies_moon_zero_three',
                faction: SMASHUP_FACTION_IDS.SUPER_SPIES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const validCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-moon-setaside', baseIndex: 0 },
            timestamp: 118,
        };
        const invalidCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-moon-setaside', baseIndex: 1 },
            timestamp: 119,
        };

        expect(SmashUpDomain.validate(state, validCommand).valid).toBe(true);
        const invalidValidation = SmashUpDomain.validate(state, invalidCommand);
        expect(invalidValidation.valid).toBe(false);
        expect(invalidValidation.error).toMatch(/Moon Zero Three|三号空间站|other players minions/i);

        const events = SmashUpDomain.execute(state, validCommand, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(resolved.titans?.find(candidate => candidate.uid === 't-moon-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('三号空间站每回合第一次查看牌库后才会获得 1 个标记', () => {
        const core = makeState({
            turnNumber: 4,
            titans: [{
                uid: 't-moon-live',
                defId: 'super_spies_moon_zero_three',
                faction: SMASHUP_FACTION_IDS.SUPER_SPIES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const firstPost = postProcessSystemEvents(
            core,
            [{
                type: SU_EVENTS.DECK_INSPECTED,
                payload: {
                    targetPlayerId: '1',
                    inspectorPlayerId: '0',
                    count: 1,
                    reason: 'moon-zero-first-look',
                },
                timestamp: 120,
            } as SmashUpEvent],
            FIXED_RANDOM,
            makeMatchState(core),
        );
        expect(firstPost.events.map(event => event.type)).toContain(SU_EVENTS.TITAN_POWER_COUNTER_ADDED);

        const afterFirst = firstPost.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(afterFirst.titans?.find(candidate => candidate.uid === 't-moon-live')?.powerCounters).toBe(1);
        expect(afterFirst.moonZeroThreeTriggeredTurnByTitan?.['t-moon-live']).toBe(4);

        const secondPost = postProcessSystemEvents(
            afterFirst,
            [{
                type: SU_EVENTS.DECK_INSPECTED,
                payload: {
                    targetPlayerId: '1',
                    inspectorPlayerId: '0',
                    count: 2,
                    reason: 'moon-zero-second-look',
                },
                timestamp: 121,
            } as SmashUpEvent],
            FIXED_RANDOM,
            makeMatchState(afterFirst),
        );
        expect(secondPost.events.map(event => event.type)).not.toContain(SU_EVENTS.TITAN_POWER_COUNTER_ADDED);
    });

    it('三号空间站天赋会查看任一牌库顶并可将其放到牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('moon-target-top', 'robot_microbot_guard', 'minion', '1'),
                        makeCard('moon-target-next', 'ghosts_spectre', 'minion', '1'),
                    ],
                }),
            },
            titans: [{
                uid: 't-moon-talent',
                defId: 'super_spies_moon_zero_three',
                faction: SMASHUP_FACTION_IDS.SUPER_SPIES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-moon-talent', baseIndex: 0 },
            timestamp: 122,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(commandEvents.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_super_spies_moon_zero_three_choose_player');

        const choosePlayerHandler = getInteractionHandler('titan_super_spies_moon_zero_three_choose_player');
        const resolveHandler = getInteractionHandler('titan_super_spies_moon_zero_three_resolve');
        expect(choosePlayerHandler).toBeDefined();
        expect(resolveHandler).toBeDefined();

        const chooseResult = choosePlayerHandler!(
            state,
            '0',
            { targetPlayerId: '1' },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            123,
        );
        expect(chooseResult.events.map(event => event.type)).toContain(SU_EVENTS.DECK_INSPECTED);
        const inspectedEvent = chooseResult.events.find(event => event.type === SU_EVENTS.DECK_INSPECTED) as SmashUpEvent | undefined;
        expect((inspectedEvent as any)?.payload?.inspectorPlayerId).toBe('0');
        const queuedResolveInteraction = chooseResult.state.sys.interaction?.queue?.at(-1);
        expect(queuedResolveInteraction?.data?.sourceId).toBe('titan_super_spies_moon_zero_three_resolve');

        const afterCommand = commandEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        const choosePost = postProcessSystemEvents(afterCommand, chooseResult.events, FIXED_RANDOM, chooseResult.state);
        const afterChoose = choosePost.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            afterCommand,
        );

        const resolveResult = resolveHandler!(
            { ...(choosePost.matchState ?? chooseResult.state), core: afterChoose },
            '0',
            { placement: 'bottom' },
            queuedResolveInteraction?.data as any,
            FIXED_RANDOM,
            124,
        );
        expect(resolveResult.events.map(event => event.type)).toEqual([SU_EVENTS.CARD_TO_DECK_BOTTOM]);

        const afterResolve = resolveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            afterChoose,
        );
        expect(afterResolve.players['1'].deck.map(card => card.uid)).toEqual(['moon-target-next', 'moon-target-top']);
    });

    it('超级佐德满足本基地有你至少 3 个随从后可通过 special 从牌库旁进场', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('megabot-a', 'ghosts_spectre', '0', 2),
                        makeMinion('megabot-b', 'pirate_first_mate', '0', 2),
                        makeMinion('megabot-c', 'trickster_gnome', '0', 3),
                    ],
                }),
                makeBase({
                    minions: [
                        makeMinion('too-few-a', 'ghosts_spectre', '0', 2),
                        makeMinion('too-few-b', 'pirate_first_mate', '0', 2),
                    ],
                }),
            ],
            titans: [{
                uid: 't-megabot-setaside',
                defId: 'mega_troopers_megabot',
                faction: SMASHUP_FACTION_IDS.MEGA_TROOPERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const validCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-megabot-setaside', baseIndex: 0 },
            timestamp: 97,
        };
        const invalidCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-megabot-setaside', baseIndex: 1 },
            timestamp: 98,
        };

        expect(SmashUpDomain.validate(state, validCommand).valid).toBe(true);
        expect(SmashUpDomain.validate(state, invalidCommand).valid).toBe(false);

        const events = SmashUpDomain.execute(state, validCommand, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(resolved.titans?.find(candidate => candidate.uid === 't-megabot-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('超级佐德在所在基地为你提供等同于你随从数量的额外战力', () => {
        const core = makeState({
            bases: [makeBase({
                minions: [
                    makeMinion('megabot-own-a', 'ghosts_spectre', '0', 2),
                    makeMinion('megabot-own-b', 'pirate_first_mate', '0', 2),
                    makeMinion('megabot-enemy', 'robot_microbot_alpha', '1', 1),
                ],
            })],
            titans: [{
                uid: 't-megabot-live',
                defId: 'mega_troopers_megabot',
                faction: SMASHUP_FACTION_IDS.MEGA_TROOPERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        expect(getTitanPowerContribution(core, 0, '0')).toBe(2);
        expect(getTitanPowerContribution(core, 0, '1')).toBe(0);
    });

    it('超级佐德会在另一基地计分前创建移动交互，并在选择后移动到计分基地', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('megabot-own-a', 'ghosts_spectre', '0', 2)],
                }),
                makeBase({
                    defId: 'base_the_mothership',
                    minions: [makeMinion('scoring-minion', 'robot_microbot_alpha', '1', 1)],
                }),
            ],
            titans: [{
                uid: 't-megabot-live',
                defId: 'mega_troopers_megabot',
                faction: SMASHUP_FACTION_IDS.MEGA_TROOPERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const matchState = makeMatchState(core);
        matchState.sys.phase = 'scoreBases';
        const triggerResult = fireTriggers(core, 'beforeScoring', {
            state: core,
            matchState,
            playerId: '1',
            baseIndex: 1,
            rankings: [
                { playerId: '1', power: 8, vp: 1 },
                { playerId: '0', power: 3, vp: 0 },
            ],
            random: FIXED_RANDOM,
            now: 99,
        });

        const currentInteraction = triggerResult.matchState?.sys.interaction?.current;
        expect(currentInteraction?.data?.sourceId).toBe('titan_mega_troopers_megabot_move');
        expect(currentInteraction?.playerId).toBe('0');

        const handler = getInteractionHandler('titan_mega_troopers_megabot_move');
        expect(handler).toBeDefined();

        const moveResult = handler!(
            triggerResult.matchState!,
            '0',
            { move: true },
            currentInteraction?.data as any,
            FIXED_RANDOM,
            100,
        );

        expect(moveResult.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_MOVED]);
        const resolved = moveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(resolved.titans?.find(candidate => candidate.uid === 't-megabot-live')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('企鹅帝皇会在你的回合开始时创建 special 进场交互，并在选择后打到目标基地', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('penguin-a', 'ghosts_spectre', '0', 2),
                        makeMinion('penguin-b', 'pirate_first_mate', '0', 2),
                        makeMinion('penguin-c', 'robot_microbot_alpha', '0', 1),
                    ],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-emperor-setaside',
                defId: 'penguins_emperor_penguin',
                faction: SMASHUP_FACTION_IDS.PENGUINS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const triggerResult = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 101,
        });

        const currentInteraction = triggerResult.matchState?.sys.interaction?.current;
        expect(currentInteraction?.data?.sourceId).toBe('titan_penguins_emperor_penguin_play');

        const handler = getInteractionHandler('titan_penguins_emperor_penguin_play');
        expect(handler).toBeDefined();

        const resolved = handler!(
            triggerResult.matchState!,
            '0',
            { baseIndex: 0, baseDefId: core.bases[0].defId },
            currentInteraction?.data as any,
            FIXED_RANDOM,
            102,
        );
        expect(resolved.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_PLAYED]);

        const next = resolved.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(next.titans?.find(candidate => candidate.uid === 't-emperor-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('企鹅帝皇的持续主动能力会把牌库顶随从按通常随从额度打到本基地，并消耗本回合随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('penguin-top-minion', 'robot_microbot_guard', 'minion', '0')],
                    discard: [makeCard('penguin-discard-minion', 'pirate_first_mate', 'minion', '0')],
                    minionsPlayed: 0,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-emperor-live',
                defId: 'penguins_emperor_penguin',
                faction: SMASHUP_FACTION_IDS.PENGUINS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const ongoingCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_TITAN_ONGOING,
            playerId: '0',
            payload: { titanUid: 't-emperor-live', baseIndex: 0 },
            timestamp: 103,
        };
        const talentCommand: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-emperor-live', baseIndex: 0 },
            timestamp: 104,
        };

        expect(SmashUpDomain.validate(state, ongoingCommand).valid).toBe(true);
        expect(SmashUpDomain.validate(state, talentCommand).valid).toBe(true);

        const events = SmashUpDomain.execute(state, ongoingCommand, FIXED_RANDOM);
        expect(events.map(event => event.type)).toEqual([SU_EVENTS.MINION_PLAYED]);

        const resolved = events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(resolved.players['0'].minionsPlayed).toBe(1);
        expect(resolved.players['0'].deck).toHaveLength(0);
        expect(resolved.bases[0].minions.find(candidate => candidate.uid === 'penguin-top-minion')?.defId).toBe('robot_microbot_guard');

        const blockedState = makeMatchState(resolved);
        expect(SmashUpDomain.validate(blockedState, ongoingCommand).valid).toBe(false);
    });

    it('企鹅帝皇天赋会把手中的低战力随从洗回牌库，并为泰坦增加 1 枚力量指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('penguin-hand-minion', 'pirate_first_mate', 'minion', '0')],
                    deck: [makeCard('penguin-existing-deck', 'robot_microbot_guard', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-emperor-talent',
                defId: 'penguins_emperor_penguin',
                faction: SMASHUP_FACTION_IDS.PENGUINS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-emperor-talent', baseIndex: 0 },
            timestamp: 105,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(commandEvents.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_penguins_emperor_penguin_talent');
        expect(
            state.sys.interaction?.current?.data?.options?.every((option: any) => option.displayMode === 'card'),
        ).toBe(true);

        const handler = getInteractionHandler('titan_penguins_emperor_penguin_talent');
        expect(handler).toBeDefined();

        const resolved = handler!(
            state,
            '0',
            { cardUid: 'penguin-hand-minion', defId: 'pirate_first_mate', zone: 'hand' },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            106,
        );
        expect(resolved.events.map(event => event.type)).toEqual([
            SU_EVENTS.REVEAL_HAND,
            SU_EVENTS.CARD_TO_DECK_TOP,
            SU_EVENTS.DECK_REORDERED,
            SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
        ]);

        const afterCommand = commandEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        const finalCore = resolved.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            afterCommand,
        );
        expect(finalCore.players['0'].hand.map(card => card.uid)).not.toContain('penguin-hand-minion');
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(
            expect.arrayContaining(['penguin-existing-deck', 'penguin-hand-minion']),
        );
        expect(finalCore.titans?.find(candidate => candidate.uid === 't-emperor-talent')).toMatchObject({
            powerCounters: 1,
            talentUsed: true,
        });
    });

    it('滑稽巨人 special 只能进空基地', () => {
        const core = makeState({
            bases: [
                makeBase(),
                makeBase({
                    minions: [makeMinion('occupied', 'ghosts_spectre', '1', 2)],
                }),
            ],
            titans: [{
                uid: 't-bfg',
                defId: 'tricksters_big_funny_giant',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const validCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-bfg', baseIndex: 0 },
            timestamp: 64,
        };
        const occupiedBaseCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-bfg', baseIndex: 1 },
            timestamp: 65,
        };

        expect(SmashUpDomain.validate(state, validCommand).valid).toBe(true);
        expect(SmashUpDomain.validate(state, occupiedBaseCommand).valid).toBe(false);

        const events = SmashUpDomain.execute(state, validCommand, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect((resolved.titans ?? []).find(candidate => candidate.uid === 't-bfg')?.location).toEqual({
            zone: 'base',
            baseIndex: 0,
            enteredAt: 64,
        });

    });

    it('滑稽巨人在场时，对手没有额外手牌则不能打出随从到此基地', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('enemy-only-minion', 'ghosts_spectre', 'minion', '1')],
                }),
            },
            bases: [makeBase()],
            titans: [{
                uid: 't-bfg',
                defId: 'tricksters_big_funny_giant',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'enemy-only-minion', baseIndex: 0, fromDiscard: false },
            timestamp: 66,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(false);
    });

    it('滑稽巨人在场时，对手把随从打到此基地后会被迫弃置 1 张剩余手牌', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('enemy-played-minion', 'ghosts_spectre', 'minion', '1'),
                        makeCard('enemy-discarded-card', 'ghosts_lantern_ghost', 'minion', '1'),
                    ],
                }),
            },
            bases: [makeBase()],
            titans: [{
                uid: 't-bfg',
                defId: 'tricksters_big_funny_giant',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const result = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '1',
                payload: { cardUid: 'enemy-played-minion', baseIndex: 0, fromDiscard: false },
                timestamp: 67,
            },
            FIXED_RANDOM,
        );

        expect(result.success).toBe(true);
        expect(result.events.map(event => event.type)).toContain(SU_EVENTS.CARDS_DISCARDED);
        expect(result.finalState.core.players['1'].hand).toEqual([]);
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toContain('enemy-discarded-card');
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('enemy-played-minion');
    });

    it('滑稽巨人在拥有者回合结束且此基地没有其他玩家随从时获得 1 枚力量指示物', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('friendly-minion', 'trickster_gnome', '0', 2)],
                }),
            ],
            titans: [{
                uid: 't-bfg',
                defId: 'tricksters_big_funny_giant',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const triggerResult = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '0',
            random: FIXED_RANDOM,
            now: 68,
        });

        expect(triggerResult.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_POWER_COUNTER_ADDED]);
        const resolved = triggerResult.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect((resolved.titans ?? []).find(candidate => candidate.uid === 't-bfg')?.powerCounters).toBe(1);
    });

    it('滑稽巨人提供 talent 入口并暴露对应交互处理器', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('target-low-power', 'ghosts_spectre', '1', 2),
                        makeMinion('too-large', 'pirate_first_mate', '1', 3),
                    ],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-bfg',
                defId: 'tricksters_big_funny_giant',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-bfg', baseIndex: 0 },
            timestamp: 69,
        };

        const validation = SmashUpDomain.validate(state, command);
        expect(validation.valid).toBe(true);
        expect(getTitanDef('tricksters_big_funny_giant')?.abilityTags).toEqual(['special', 'ongoing', 'talent']);
        expect(getInteractionHandler('titan_tricksters_big_funny_giant_choose_minion')).toBeDefined();
        expect(getInteractionHandler('titan_tricksters_big_funny_giant_choose_base')).toBeDefined();
    });

    it('交互解决产生的泰坦移动进入已有其他泰坦的标准基地时，会继续触发泰坦冲突', () => {
        const core = makeState({
            bases: [
                makeBase(),
                makeBase({
                    minions: [makeMinion('enemy-on-target', 'ghosts_spectre', '1', 3)],
                }),
            ],
            titans: [
                {
                    uid: 't-kraken',
                    defId: 'pirates_the_kraken',
                    faction: SMASHUP_FACTION_IDS.PIRATES,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } satisfies TitanState,
                {
                    uid: 't-bfg',
                    defId: 'tricksters_big_funny_giant',
                    faction: SMASHUP_FACTION_IDS.TRICKSTERS,
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                } satisfies TitanState,
            ],
        });

        const state = makeMatchState(core);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-kraken', baseIndex: 0 },
            timestamp: 70,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_pirates_the_kraken_talent');

        const chooseBaseOption = (state.sys.interaction.current as any).data.options.find((option: any) => option.value?.baseIndex === 1)
            ?? (state.sys.interaction.current as any).data.options[0];

        const eventSystem = createSmashUpEventSystem();
        const hook = eventSystem.afterEvents?.({
            state,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: state.sys.interaction.current?.id,
                    playerId: '0',
                    optionId: chooseBaseOption.id,
                    value: chooseBaseOption.value,
                    sourceId: 'titan_pirates_the_kraken_talent',
                    interactionData: state.sys.interaction.current?.data,
                },
                timestamp: 71,
            } as any],
            random: FIXED_RANDOM,
        }) as any;

        const emittedEvents = hook?.events ?? [];

        // 注意：泰坦 clash / 冲突属于 postProcessSystemEvents 的派生事件（afterEvents 轮统一处理），
        // eventSystem.afterEvents 本身只负责从 interaction handler 拉取领域事件。
        const postSystemState = hook?.state ?? state;
        const postProcessed = SmashUpDomain.postProcessSystemEvents(
            postSystemState.core,
            emittedEvents,
            FIXED_RANDOM,
            postSystemState as any,
        ) as any;
        const processedEvents: SmashUpEvent[] = Array.isArray(postProcessed)
            ? postProcessed
            : (postProcessed.events ?? []);
        const processedState = !Array.isArray(postProcessed) && postProcessed.matchState
            ? ({ ...postSystemState, sys: postProcessed.matchState.sys } as typeof postSystemState)
            : postSystemState;

        expect(processedEvents.some((event: SmashUpEvent) => event.type === SU_EVENTS.TITAN_REMOVED_FROM_PLAY)).toBe(true);

        const finalCore = processedEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            processedState.core,
        );
        const titansOnBaseOne = (finalCore.titans ?? [])
            .filter(candidate => candidate.location.zone === 'base' && candidate.location.baseIndex === 1);
        expect(titansOnBaseOne.map(candidate => candidate.uid)).toEqual(['t-bfg']);
        expect((finalCore.titans ?? []).find(candidate => candidate.uid === 't-kraken')?.location.zone).toBe('setaside');
    });

    it('巨狼之灵满足你在 2 个或更多基地拥有最高战力后可通过 special 从牌库旁进场', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('wolf-lead-a', 'werewolf_howler', '0', 3),
                        makeMinion('enemy-a', 'ghosts_spectre', '1', 2),
                    ],
                }),
                makeBase({
                    minions: [
                        makeMinion('wolf-lead-b', 'werewolf_teenage_wolf', '0', 4),
                        makeMinion('enemy-b', 'ghosts_spectre', '1', 4),
                    ],
                }),
                makeBase({
                    minions: [
                        makeMinion('wolf-trail', 'werewolf_howler', '0', 1),
                        makeMinion('enemy-c', 'ghosts_spectre', '1', 2),
                    ],
                }),
            ],
            titans: [{
                uid: 't-gws',
                defId: 'werewolves_great_wolf_spirit',
                faction: SMASHUP_FACTION_IDS.WEREWOLVES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const validCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-gws', baseIndex: 1 },
            timestamp: 65,
        };
        const invalidCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-gws', baseIndex: 2 },
            timestamp: 66,
        };

        expect(SmashUpDomain.validate(state, validCommand).valid).toBe(true);
        expect(SmashUpDomain.validate(state, invalidCommand).valid).toBe(false);

        const events = SmashUpDomain.execute(state, validCommand, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        const titan = (resolved.titans ?? []).find(candidate => candidate.uid === 't-gws');
        expect(titan?.location).toEqual({
            zone: 'base',
            baseIndex: 1,
            enteredAt: 65,
        });
    });

    it('巨狼之灵在场时允许本回合额外一次第二次 talent，并在消费后阻止第三次重复使用', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('wolf-outside', 'werewolf_teenage_wolf', '0', 2, { talentUsed: true }),
                    ],
                }),
                makeBase({
                    minions: [
                        makeMinion('wolf-gws-a', 'werewolf_teenage_wolf', '0', 2, { talentUsed: true }),
                        makeMinion('wolf-gws-b', 'werewolf_teenage_wolf', '0', 2, { talentUsed: true }),
                    ],
                }),
            ],
            titans: [{
                uid: 't-gws',
                defId: 'werewolves_great_wolf_spirit',
                faction: SMASHUP_FACTION_IDS.WEREWOLVES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const sameBaseSecondUse: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'wolf-gws-a', baseIndex: 1 },
            timestamp: 67,
        };
        const outsideBaseSecondUse: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'wolf-outside', baseIndex: 0 },
            timestamp: 68,
        };

        expect(SmashUpDomain.validate(state, sameBaseSecondUse).valid).toBe(true);
        expect(SmashUpDomain.validate(state, outsideBaseSecondUse).valid).toBe(false);
        const events = SmashUpDomain.execute(state, sameBaseSecondUse, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TEMP_POWER_ADDED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(resolved.greatWolfSpiritDoubleTalentCardUids).toContain('wolf-gws-a');

        const afterFirstSecondUse = makeMatchState(resolved);
        const otherCardSecondUse: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'wolf-gws-b', baseIndex: 1 },
            timestamp: 69,
        };
        const thirdUseAttempt: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'wolf-gws-a', baseIndex: 1 },
            timestamp: 70,
        };

        expect(SmashUpDomain.validate(afterFirstSecondUse, otherCardSecondUse).valid).toBe(true);
        expect(SmashUpDomain.validate(afterFirstSecondUse, thirdUseAttempt).valid).toBe(false);
    });

    it('巨狼之灵天赋会创建己方随从目标选择，并让目标直到回合结束获得 +1 战力', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('wolf-target', 'werewolf_teenage_wolf', '0', 2)],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-gws',
                defId: 'werewolves_great_wolf_spirit',
                faction: SMASHUP_FACTION_IDS.WEREWOLVES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-gws', baseIndex: 1 },
            timestamp: 69,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_werewolves_great_wolf_spirit_talent');

        const handler = getInteractionHandler('titan_werewolves_great_wolf_spirit_talent');
        expect(handler).toBeDefined();
        const resolved = handler!(
            state,
            '0',
            { minionUid: 'wolf-target', defId: 'werewolf_teenage_wolf', baseIndex: 0 },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            70,
        );
        expect(resolved.events.map(event => event.type)).toEqual([SU_EVENTS.TEMP_POWER_ADDED]);

        const boosted = resolved.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(boosted.bases[0].minions.find(candidate => candidate.uid === 'wolf-target')?.tempPowerModifier).toBe(1);
    });

    it('海怪克拉肯天赋会移动泰坦，并让目标基地敌方随从直到你下回合开始时 -1 战力', () => {
        const core = makeState({
            turnNumber: 3,
            bases: [
                makeBase(),
                makeBase({
                    minions: [
                        makeMinion('enemy-on-target', 'ghosts_spectre', '1', 3),
                        makeMinion('ally-on-target', 'pirate_first_mate', '0', 2),
                    ],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-kraken',
                defId: 'pirates_the_kraken',
                faction: SMASHUP_FACTION_IDS.PIRATES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-kraken', baseIndex: 0 },
            timestamp: 70,
        };

        const validation = SmashUpDomain.validate(state, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_pirates_the_kraken_talent');

        const handler = getInteractionHandler('titan_pirates_the_kraken_talent');
        expect(handler).toBeDefined();
        const resolved = handler!(
            state,
            '0',
            { baseIndex: 1, baseDefId: core.bases[1].defId },
            state.sys.interaction.current?.data as any,
            FIXED_RANDOM,
            71,
        );

        expect(resolved?.events.map(event => event.type)).toEqual([
            SU_EVENTS.TITAN_MOVED,
            SU_EVENTS.PERMANENT_POWER_ADDED,
        ]);

        const afterTalentCore = (resolved?.events ?? []).reduce(
            (acc, event) => SmashUpDomain.reduce(acc, event),
            resolved?.state.core ?? core,
        );
        const kraken = (afterTalentCore.titans ?? []).find(candidate => candidate.uid === 't-kraken');
        const enemyMinion = afterTalentCore.bases[1].minions.find(candidate => candidate.uid === 'enemy-on-target');
        const allyMinion = afterTalentCore.bases[1].minions.find(candidate => candidate.uid === 'ally-on-target');

        expect(kraken?.location).toMatchObject({ zone: 'base', baseIndex: 1 });
        expect(enemyMinion?.powerModifier).toBe(-1);
        expect(allyMinion?.powerModifier).toBe(0);

        const reverted = SmashUpDomain.reduce(afterTalentCore, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 5 },
            timestamp: 72,
        } as SmashUpEvent);
        const revertedEnemy = reverted.bases[1].minions.find(candidate => candidate.uid === 'enemy-on-target');
        expect(revertedEnemy?.powerModifier).toBe(0);
    });

    it('海怪克拉肯不在场时，计分后会为有己方随从的玩家创建进替换基地交互', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('pirate-on-score', 'pirate_first_mate', '0', 2)],
                }),
                makeBase('base_the_mothership'),
            ],
            titans: [{
                uid: 't-kraken-setaside',
                defId: 'pirates_the_kraken',
                faction: SMASHUP_FACTION_IDS.PIRATES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const triggerResult = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', rank: 1, points: 3 }],
            random: FIXED_RANDOM,
            now: 73,
        });

        const interactions = getInteractionsFromMS(triggerResult.matchState!);
        expect(interactions.map(interaction => interaction.data?.sourceId)).toContain('titan_pirates_the_kraken_play_replacement');
    });

    it('海怪克拉肯在本基地计分后会创建救出己方随从的交互', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('pirate-to-save', 'pirate_first_mate', '0', 2)],
                }),
                makeBase('base_the_mothership'),
            ],
            titans: [{
                uid: 't-kraken-on-base',
                defId: 'pirates_the_kraken',
                faction: SMASHUP_FACTION_IDS.PIRATES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const triggerResult = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', rank: 1, points: 3 }],
            random: FIXED_RANDOM,
            now: 74,
        });

        const interactions = getInteractionsFromMS(triggerResult.matchState!);
        expect(interactions.map(interaction => interaction.data?.sourceId)).toContain('titan_pirates_the_kraken_choose_minion');
    });

    it('大副先结算移动后，海怪克拉肯仍应保留替换基地进场交互', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('pirate-on-score', 'pirate_first_mate', '0', 2)],
                }),
                makeBase('base_the_mothership'),
                makeBase('base_factory_436-1337'),
            ],
            titans: [{
                uid: 't-kraken-setaside',
                defId: 'pirates_the_kraken',
                faction: SMASHUP_FACTION_IDS.PIRATES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 3 }],
            random: FIXED_RANDOM,
            now: 75,
        });

        expect(queued).toBeDefined();

        const queuedState = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
        const firstPrompt = maybeResolveReactionQueue(queuedState, FIXED_RANDOM, 75);
        expect(firstPrompt?.state.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const firstQueueById = new Map(firstPrompt!.state.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
        const firstMateOption = (firstPrompt!.state.sys.interaction.current as any).data.options.find((option: any) => {
            const trigger = firstQueueById.get(option.value.triggerId) as any;
            return trigger?.sourceDefId === 'pirate_first_mate';
        }) ?? (firstPrompt!.state.sys.interaction.current as any).data.options[0];

        const afterChooseFirstMateTrigger = runCommand(
            firstPrompt!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: firstMateOption.id } } as any,
            FIXED_RANDOM,
        );

        const firstMatePrompt = getInteractionsFromMS(afterChooseFirstMateTrigger.finalState)[0] as any;
        expect(firstMatePrompt?.data?.sourceId).toBe('pirate_first_mate_choose_base');

        const moveMateOption = firstMatePrompt.data.options.find((option: any) => option.value?.baseIndex === 1)
            ?? firstMatePrompt.data.options.find((option: any) => option.value?.baseIndex === 2)
            ?? firstMatePrompt.data.options[0];

        const afterMoveFirstMate = runCommand(
            afterChooseFirstMateTrigger.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: moveMateOption.id } } as any,
            FIXED_RANDOM,
        );

        let nextPrompt = getInteractionsFromMS(afterMoveFirstMate.finalState)[0] as any;
        let stateAfterKrakenTrigger = afterMoveFirstMate.finalState;
        if (!nextPrompt) {
            const reactionPrompt = maybeResolveReactionQueue(stateAfterKrakenTrigger, FIXED_RANDOM, 76);
            if (reactionPrompt) {
                stateAfterKrakenTrigger = reactionPrompt.state;
                nextPrompt = getInteractionsFromMS(stateAfterKrakenTrigger)[0] as any;
            }
        }
        if (nextPrompt?.data?.sourceId === 'smashup_reaction_choose') {
            const secondQueueById = new Map(stateAfterKrakenTrigger.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
            const krakenOption = nextPrompt.data.options.find((option: any) => {
                const trigger = secondQueueById.get(option.value.triggerId) as any;
                return trigger?.sourceDefId === 'pirates_the_kraken';
            }) ?? nextPrompt.data.options[0];

            const afterChooseKrakenTrigger = runCommand(
                stateAfterKrakenTrigger,
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: krakenOption.id } } as any,
                FIXED_RANDOM,
            );
            stateAfterKrakenTrigger = afterChooseKrakenTrigger.finalState;
            nextPrompt = getInteractionsFromMS(stateAfterKrakenTrigger)[0] as any;
        }

        expect(nextPrompt?.data?.sourceId).toBe('titan_pirates_the_kraken_play_replacement');
    });

    it('全速航行POD 作为标准行动卡，在普通出牌阶段也应允许直接打出', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('full-sail-1', 'pirate_full_sail_pod', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.GHOSTS_POD, SMASHUP_FACTION_IDS.PIRATES_POD],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.WIZARDS],
                }),
            },
            currentPlayerIndex: 0,
            turnOrder: ['0', '1'],
            bases: [
                makeBase('base_the_factory'),
                makeBase('base_tortuga'),
            ],
        }));

        expect(SmashUpDomain.validate(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'full-sail-1' },
        })).toMatchObject({ valid: true });
    });

    it('海怪克拉肯的替换基地进场交互在补发计分后事件时会真正把泰坦落到新基地', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('pirate-on-score', 'pirate_first_mate', '0', 2)],
                }),
                makeBase('base_the_mothership'),
            ],
            baseDeck: ['base_factory_436-1337'],
            titans: [{
                uid: 't-kraken-setaside',
                defId: 'pirates_the_kraken',
                faction: SMASHUP_FACTION_IDS.PIRATES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const state = makeMatchState(core);
        const smashUpEventSystem = createSmashUpEventSystem();
        const hook = smashUpEventSystem.afterEvents?.({
            state,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'test-kraken-play',
                    playerId: '0',
                    optionId: 'play',
                    value: { play: true },
                    sourceId: 'titan_pirates_the_kraken_play_replacement',
                    interactionData: {
                        sourceId: 'titan_pirates_the_kraken_play_replacement',
                        continuationContext: {
                            titanUid: 't-kraken-setaside',
                            titanDefId: 'pirates_the_kraken',
                            ownerId: '0',
                            controllerId: '0',
                            scoringBaseIndex: 0,
                            _deferredPostScoringEvents: [
                                {
                                    type: SU_EVENTS.BASE_CLEARED,
                                    payload: { baseIndex: 0, baseDefId: 'base_the_homeworld' },
                                    timestamp: 75,
                                },
                                {
                                    type: SU_EVENTS.BASE_REPLACED,
                                    payload: {
                                        baseIndex: 0,
                                        oldBaseDefId: 'base_the_homeworld',
                                        newBaseDefId: 'base_factory_436-1337',
                                    },
                                    timestamp: 75,
                                },
                            ],
                        },
                    },
                },
                timestamp: 75,
            } as any],
            random: FIXED_RANDOM,
        }) as any;

        const emittedEvents = hook?.events ?? [];
        expect(emittedEvents.map((event: SmashUpEvent) => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
            SU_EVENTS.TITAN_PLAYED,
        ]);

        const postSystemState = hook?.state ?? state;
        const finalCore = emittedEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            postSystemState.core,
        );
        const kraken = (finalCore.titans ?? []).find(candidate => candidate.uid === 't-kraken-setaside');

        expect(kraken?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(finalCore.bases[0].defId).toBe('base_factory_436-1337');
    });

    it('活动泰坦静态契约与当前已接入范围保持一致', () => {
        const currentTitanIds = TITAN_CARD_DEFS.map(def => def.id);
        expect(currentTitanIds).toEqual([
            'dinosaurs_fort_titanosaurus',
            'ninjas_invisible_ninja',
            'bear_cavalry_major_ursa',
            'ghosts_creampuff_man',
            'changerbots_mergacon',
            'explorers_very_large_boulder',
            'giant_ants_death_on_six_legs',
            'innsmouth_dagon',
            'ignobles_the_hill_that_strolls',
            'itty_critters_rainboroc',
            'killer_plants_killer_kudzu',
            'kaiju_gorgodzolla',
            'magical_girls_walking_castle',
            'mega_troopers_megabot',
            'cthulhu_cthulhu_titan',
            'penguins_emperor_penguin',
            'tricksters_big_funny_giant',
            'vampires_ancient_lord',
            'werewolves_great_wolf_spirit',
            'wizards_arcane_protector',
            'pirates_the_kraken',
            'frankenstein_the_bride',
            'super_spies_moon_zero_three',
            'time_travelers_time_box',
            'sphinx',
            'pecos_bill',
        ]);
        expect(TITAN_CARD_DEFS).toHaveLength(26);
        expect(getTitanDef('sphinx')?.id).toBe('sphinx');
        expect(getTitanDef('sphinx')?.abilityTags).toEqual(['special', 'talent']);
        expect(getTitanDef('sphinx')?.previewRef).toEqual({ type: 'atlas', atlasId: 'tts_atlas_8789f47742', index: 29 });
        expect(getTitanDef('pecos_bill')?.id).toBe('pecos_bill');
        expect(getTitanDef('pecos_bill')?.abilityTags).toEqual(['special', 'ongoing']);
        expect(getTitanDef('pecos_bill')?.previewRef).toEqual({ type: 'atlas', atlasId: 'tts_atlas_8789f47742', index: 30 });
        expect(getTitanDef('tricksters_big_funny_giant')?.abilityTags).toEqual(['special', 'ongoing', 'talent']);
        expect(getTitanDef('time_travelers_time_box')?.abilityTags).toEqual(['special', 'talent']);
        expect(getSmashUpCardPreviewMeta('sphinx')).toEqual({
            name: getTitanDef('sphinx')?.name,
            previewRef: { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: 'sphinx' } },
        });
        expect(getSmashUpCardPreviewMeta('pecos_bill')).toEqual({
            name: getTitanDef('pecos_bill')?.name,
            previewRef: { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: 'pecos_bill' } },
        });
    });

    it('同时消耗通常随从与通常战术额度的泰坦打出事件会正确结算两种额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 0,
                    actionsPlayed: 0,
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 't-dual-consume',
                defId: 'test_dual_consume_titan',
                faction: SMASHUP_FACTION_IDS.WIZARDS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const next = SmashUpDomain.reduce(core, {
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: 't-dual-consume',
                defId: 'test_dual_consume_titan',
                ownerId: '0',
                controllerId: '0',
                baseIndex: 0,
                consumesRegularPlayKinds: ['minion', 'action'],
                reason: 'test',
            },
            timestamp: 77,
        } as SmashUpEvent);

        expect(next.players['0'].minionsPlayed).toBe(1);
        expect(next.players['0'].actionsPlayed).toBe(1);
        expect(next.titans?.find(candidate => candidate.uid === 't-dual-consume')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('Samurai POD 可进入选秀并完成开局链路', () => {
        const samuraiPodDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.SAMURAI_POD } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ROBOTS } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: 'Samurai POD 开局 smoke',
            commands: samuraiPodDraft,
        });
        const core = result.finalState.core;

        for (const step of result.steps) {
            expect(step.success).toBe(true);
        }

        expect(result.finalState.sys.phase).toBe('playCards');
        expect(core.players['0'].factions).toEqual([SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ROBOTS]);
        expect(core.players['1'].factions).toEqual([SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ALIENS]);
        expect(core.players['0'].hand.length).toBe(5);
    });

    it('Cowboys POD 可进入选秀并完成开局链路', () => {
        const cowboysPodDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.COWBOYS_POD } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ROBOTS } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: 'Cowboys POD 开局 smoke',
            commands: cowboysPodDraft,
        });
        const core = result.finalState.core;

        for (const step of result.steps) {
            expect(step.success).toBe(true);
        }

        expect(result.finalState.sys.phase).toBe('playCards');
        expect(core.players['0'].factions).toEqual([SMASHUP_FACTION_IDS.COWBOYS_POD, SMASHUP_FACTION_IDS.ROBOTS]);
        expect(core.players['1'].factions).toEqual([SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ALIENS]);
        expect(core.players['0'].hand.length).toBe(5);
    });

    it('Vikings POD 可进入选秀并完成开局链路', () => {
        const vikingsPodDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VIKINGS_POD } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ROBOTS } },
        ];

        const runner = createRunner();
        const result = runner.run({
            name: 'Vikings POD 开局 smoke',
            commands: vikingsPodDraft,
        });
        const core = result.finalState.core;

        for (const step of result.steps) {
            expect(step.success).toBe(true);
        }

        expect(result.finalState.sys.phase).toBe('playCards');
        expect(core.players['0'].factions).toEqual([SMASHUP_FACTION_IDS.VIKINGS_POD, SMASHUP_FACTION_IDS.ROBOTS]);
        expect(core.players['1'].factions).toEqual([SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ALIENS]);
        expect(core.players['0'].hand.length).toBe(5);
    });

    it('The Bride 开始回合 special 应提供跳过，并显示可读的分支文案', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-minion', 'frankenstein_igor', 'minion', '0')],
                    discard: [makeCard('discard-minion', 'frankenstein_lab_assistant', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_factory',
                minions: [{
                    ...makeMinion('ally-1', 'frankenstein_igor', '0', 2),
                    powerCounters: 1,
                }],
                ongoingActions: [],
            })],
            titans: [{
                uid: 'bride-1',
                defId: 'frankenstein_the_bride',
                faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const triggerResult = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 123,
        });

        const currentInteraction = triggerResult.matchState?.sys.interaction?.current as any;
        expect(currentInteraction?.data?.sourceId).toBe('titan_frankenstein_the_bride_start_choose_branch');
        expect(currentInteraction?.data?.options.some((option: any) => option.value?.skip === true)).toBe(true);
        expect(currentInteraction?.data?.options.map((option: any) => option.label)).toEqual(expect.arrayContaining([
            '放进盒中',
            '消灭己方随从',
            '移除 +1 指示物',
        ]));
    });

    it('pecos_bill 未进入决斗触发链时不应被当成可手动打出的泰坦', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.COWBOYS_POD, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ALIENS],
                }),
            },
            bases: [makeBase({ defId: 'base_saloon_pod', minions: [], ongoingActions: [] })],
            titans: [{
                uid: 'pecos-1',
                defId: 'pecos_bill',
                faction: SMASHUP_FACTION_IDS.COWBOYS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
        }));

        expect(SmashUpDomain.validate(state, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'pecos-1', baseIndex: 0 },
        })).toMatchObject({
            valid: false,
            error: '该泰坦的特殊能力不能手动激活',
        });
    });

    it('副警长和警长不应被当成可手动点按的随从 special', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.COWBOYS, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ALIENS],
                }),
            },
            bases: [makeBase({
                defId: 'base_saloon',
                minions: [
                    makeMinion('deputy-1', 'cowboys_deputy', '0', 2),
                    makeMinion('sheriff-1', 'cowboys_sheriff', '0', 5),
                ],
                ongoingActions: [],
            })],
        }));

        expect(SmashUpDomain.validate(state, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'deputy-1', baseIndex: 0 },
        })).toMatchObject({
            valid: true,
        });

        expect(SmashUpDomain.validate(state, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'sheriff-1', baseIndex: 0 },
        })).toMatchObject({
            valid: true,
        });
    });

    it('pecos_bill 可在你成为 challenger 时弃 1 张牌部署到该决斗基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('discard-1', 'wizard_summon', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.COWBOYS_POD, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ALIENS],
                }),
            },
            bases: [makeBase({
                defId: 'base_saloon_pod',
                minions: [
                    makeMinion('ally-1', 'cowboys_gunfighter_pod', '0', 4),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2),
                ],
                ongoingActions: [],
            })],
            titans: [{
                uid: 'pecos-1',
                defId: 'pecos_bill',
                faction: SMASHUP_FACTION_IDS.COWBOYS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
        });

        const started = startDuel(
            makeMatchState(core),
            {
                sourceId: 'cowboys_gunfighter_pod',
                sourcePlayerId: '0',
                challengerMinionUid: 'ally-1',
                challengedMinionUid: 'enemy-1',
                outcome: 'destroy_loser',
            },
            1000,
        );

        const prompt = getInteractionsFromMS(started)[0] as any;
        expect(prompt?.data?.sourceId).toBe('titan_pecos_bill_duel_start');

        const discardOption = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'discard-1');
        const deployed = runCommand(
            started,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: discardOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(deployed.events.map(event => event.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.CARDS_DISCARDED,
            SU_EVENTS.TITAN_METADATA_UPDATED,
            SU_EVENTS.TITAN_PLAYED,
        ]));
        const pecos = deployed.finalState.core.titans?.find(candidate => candidate.uid === 'pecos-1');
        expect(pecos?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(pecos?.metadata?.deferClashUntilDuelEnds).toBe(true);
        expect(deployed.finalState.core.activeDuel?.baseIndex).toBe(0);
    });

    it('pecos_bill 在决斗中会阻止其他玩家把该基地随从移走或回手', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.COWBOYS_POD, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ALIENS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_saloon_pod',
                    minions: [
                        makeMinion('ally-1', 'cowboys_gunfighter_pod', '0', 4),
                        makeMinion('enemy-1', 'robot_microbot_alpha', '1', 3),
                    ],
                    ongoingActions: [],
                }),
                makeBase('base_b', []),
            ],
            activeDuel: {
                id: 'pecos-duel',
                baseIndex: 0,
                sourceId: 'test_duel',
                sourcePlayerId: '0',
                challengerPlayerId: '0',
                challengerMinionUid: 'ally-1',
                challengedPlayerId: '1',
                challengedMinionUid: 'enemy-1',
                outcome: 'destroy_loser',
            },
            titans: [{
                uid: 'pecos-1',
                defId: 'pecos_bill',
                faction: SMASHUP_FACTION_IDS.COWBOYS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
        });

        const moveEvents = filterProtectedMoveEvents([{
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'ally-1',
                minionDefId: 'cowboys_gunfighter_pod',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                ownerId: '0',
                controllerId: '0',
                reason: 'enemy_move',
            },
            timestamp: 1001,
        } as SmashUpEvent], core, '1');
        expect(moveEvents).toEqual([]);

        const returnEvents = filterProtectedReturnEvents([{
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: 'ally-1',
                minionDefId: 'cowboys_gunfighter_pod',
                fromBaseIndex: 0,
                ownerId: '0',
                controllerId: '0',
                reason: 'enemy_return',
            },
            timestamp: 1002,
        } as SmashUpEvent], core, '1');
        expect(returnEvents).toEqual([]);
    });

    it('pecos_bill 在你赢得决斗后会摸 1 张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', '0')],
                    factions: [SMASHUP_FACTION_IDS.COWBOYS_POD, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_saloon_pod',
                minions: [
                    makeMinion('ally-1', 'cowboys_gunfighter_pod', '0', 4),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2),
                ],
                ongoingActions: [],
            })],
            titans: [{
                uid: 'pecos-1',
                defId: 'pecos_bill',
                faction: SMASHUP_FACTION_IDS.COWBOYS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
        });

        const duelStarted = startDuel(
            makeMatchState(core),
            {
                sourceId: 'cowboys_high_noon_pod',
                sourcePlayerId: '0',
                challengerMinionUid: 'ally-1',
                challengedMinionUid: 'enemy-1',
                outcome: 'destroy_loser',
            },
            1003,
        );
        const duelResolved = resolveDuelChain(duelStarted);

        expect(duelResolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(duelResolved.finalState.core.players['0'].hand.some(card => card.uid === 'draw-1')).toBe(true);
    });

    it('pecos_bill 若在决斗中进入已有泰坦的基地，会把 clash 延后到决斗结束后处理', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('discard-1', 'wizard_summon', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.COWBOYS_POD, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.ALIENS],
                }),
            },
            bases: [makeBase({
                defId: 'base_saloon_pod',
                minions: [
                    makeMinion('ally-1', 'cowboys_gunfighter_pod', '0', 4),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2),
                ],
                ongoingActions: [],
            })],
            titans: [
                {
                    uid: 'pecos-1',
                    defId: 'pecos_bill',
                    faction: SMASHUP_FACTION_IDS.COWBOYS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
                {
                    uid: 'arcane-1',
                    defId: 'wizards_arcane_protector',
                    faction: SMASHUP_FACTION_IDS.WIZARDS,
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        });

        const duelStarted = startDuel(
            makeMatchState(core),
            {
                sourceId: 'cowboys_high_noon_pod',
                sourcePlayerId: '0',
                challengerMinionUid: 'ally-1',
                challengedMinionUid: 'enemy-1',
                outcome: 'destroy_loser',
            },
            1004,
        );
        const pecosPrompt = getInteractionsFromMS(duelStarted)[0] as any;
        const discardOption = pecosPrompt.data.options.find((entry: any) => entry.value?.cardUid === 'discard-1');
        const deployed = runCommand(
            duelStarted,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: discardOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(deployed.events.some(event => event.type === SU_EVENTS.TITAN_REMOVED_FROM_PLAY)).toBe(false);
        const withBothTitans = deployed.finalState.core.titans?.filter(candidate => candidate.location.zone === 'base') ?? [];
        expect(withBothTitans.map(candidate => candidate.uid).sort()).toEqual(['arcane-1', 'pecos-1']);

        const duelResolved = resolveDuelChain(deployed.finalState);
        expect(duelResolved.events.some(event => event.type === SU_EVENTS.TITAN_REMOVED_FROM_PLAY)).toBe(true);
        expect(duelResolved.events.some(event =>
            event.type === SU_EVENTS.TITAN_METADATA_UPDATED
            && (event as any).payload.reason === 'pecos_bill_duel_end',
        )).toBe(true);

        const finalPecos = duelResolved.finalState.core.titans?.find(candidate => candidate.uid === 'pecos-1');
        const finalArcane = duelResolved.finalState.core.titans?.find(candidate => candidate.uid === 'arcane-1');
        expect(finalPecos?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(finalPecos?.metadata?.deferClashUntilDuelEnds).toBe(false);
        expect(finalArcane?.location.zone).toBe('setaside');
    });
    it('Great Wolf Spirit creates a start-of-turn move interaction and only offers bases where you are strictly ahead', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('wolf-home', 'werewolf_teenage_wolf', '0', 3),
                        makeMinion('enemy-home', 'ghosts_spectre', '1', 1),
                    ],
                }),
                makeBase({
                    minions: [
                        makeMinion('wolf-destination', 'werewolf_howler', '0', 4),
                        makeMinion('enemy-destination', 'ghosts_spectre', '1', 2),
                    ],
                }),
                makeBase({
                    minions: [
                        makeMinion('wolf-tied', 'werewolf_howler', '0', 2),
                        makeMinion('enemy-tied', 'ghosts_spectre', '1', 2),
                    ],
                }),
            ],
            titans: [{
                uid: 't-gws',
                defId: 'werewolves_great_wolf_spirit',
                faction: SMASHUP_FACTION_IDS.WEREWOLVES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const triggerResult = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 71,
        });

        const currentInteraction = triggerResult.matchState?.sys.interaction?.current;
        expect(currentInteraction?.data?.sourceId).toBe('titan_werewolves_great_wolf_spirit_move');
        expect(currentInteraction?.data?.options.some((option: any) => option.value?.skip === true)).toBe(true);
        expect(currentInteraction?.data?.options.some((option: any) => option.value?.baseIndex === 1)).toBe(true);
        expect(currentInteraction?.data?.options.some((option: any) => option.value?.baseIndex === 2)).toBe(false);

        const handler = getInteractionHandler('titan_werewolves_great_wolf_spirit_move');
        expect(handler).toBeDefined();

        const resolved = handler!(
            triggerResult.matchState!,
            '0',
            { baseIndex: 1, baseDefId: core.bases[1].defId },
            currentInteraction?.data as any,
            FIXED_RANDOM,
            72,
        );
        expect(resolved.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_MOVED]);

        const moved = resolved.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(moved.titans?.find(candidate => candidate.uid === 't-gws')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('Fort Titanosaurus 会在 dino_howl 影响多个己方随从时只创建一个选择提示', () => {
        const initial = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('action-1', 'dino_howl_pod', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.DINOSAURS_POD, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_jungle',
                minions: [
                    makeMinion('ally-1', 'dino_war_raptor_pod', '0', 2),
                    makeMinion('ally-2', 'dino_laser_triceratops_pod', '0', 4),
                ],
                ongoingActions: [],
            })],
            titans: [{
                uid: 'fort-1',
                defId: 'dinosaurs_fort_titanosaurus',
                faction: SMASHUP_FACTION_IDS.DINOSAURS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
        }));

        const played = runCommand(initial, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'action-1', targetBaseIndex: 0 },
        } as any, FIXED_RANDOM);

        expect(played.success).toBe(true);
        const prompts = getInteractionsFromMS(played.finalState);
        expect(prompts).toHaveLength(1);

        const fortPrompt = prompts[0] as any;
        expect(fortPrompt?.data?.sourceId).toBe('titan_dinosaurs_fort_titanosaurus_ongoing');
        expect(fortPrompt?.data?.options.filter((option: any) => option?.value?.mode === 'both')).toHaveLength(2);
        expect(fortPrompt?.data?.options.some((option: any) => option?.value?.targetMinionUid === 'ally-1')).toBe(true);
        expect(fortPrompt?.data?.options.some((option: any) => option?.value?.targetMinionUid === 'ally-2')).toBe(true);
    });
});

