/**
 * 大杀四方 (Smash Up) - 冒烟测试
 *
 * 覆盖：setup、派系选择、出牌、阶段推进
 */

import { describe, expect, it, beforeAll, vi } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { postProcessSystemEvents } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems, createInitialSystemState } from '../../../engine';
import { resolveNextLocalAiAction } from '../../../engine/ai';
import { resolveAiDifficultyProfile } from '../../../engine/ai/difficulty';
import { createSimpleChoice, INTERACTION_COMMANDS, INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import { executePipeline } from '../../../engine/pipeline';
import type { CardsDrawnEvent, SmashUpCore, SmashUpCommand, SmashUpEvent, SmashUpReactionSession } from '../domain/types';
import { MADNESS_CARD_DEF_ID, SU_COMMANDS, SU_EVENTS, TEAM_VP_TO_WIN_2V2, getCurrentPlayerId } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { getCardDef, getTitanDef } from '../data/cards';
import { TITAN_CARD_DEFS } from '../data/titans';
import { getPlayerEffectivePowerOnBase, getRegisteredModifierIds, getTitanPowerContribution } from '../domain/ongoingModifiers';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { addPowerCounter, buildMinionTargetOptions, buildPlayerTargetOptions } from '../domain/abilityHelpers';
import { uncoverBuriedCard } from '../domain/bury';
import { collectTriggers, fireTriggers, interceptEvent } from '../domain/ongoingEffects';
import { filterProtectedDestroyEvents, filterProtectedMoveEvents, filterProtectedReturnEvents, processAffectTriggers, processDestroyTriggers, processMoveTriggers, processReturnToHandTriggers } from '../domain/reducer';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { startSmashUpReactionSession } from '../domain/reactionSession';
import { initAllAbilities } from '../abilities';
import { createSmashUpEventSystem } from '../domain/systems';
import {
    appendScoringFrameDeferredPayload,
    consumeScoringFrameDeferredPayload,
    createScoringBaseRef,
    createScoringSession,
    setScoringSession,
} from '../domain/scoringSession';
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

function attachReactionSession(
    state: ReturnType<typeof makeMatchState>,
    reactionSession: SmashUpReactionSession,
    phase: 'playCards' | 'scoreBases' = 'scoreBases',
) {
    state.sys.phase = phase;
    return startSmashUpReactionSession(state, reactionSession);
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

    it('混合人机座位且未显式指定先手时，factionSelect 默认由真人先手', () => {
        const runner = createRunner({
            seatControllers: {
                '0': { type: 'local-ai' },
                '1': { type: 'human' },
            },
        });
        const result = runner.run({ name: 'mixed seats human first draft', commands: [] });
        const core = result.finalState.core;

        expect(core.turnOrder).toEqual(['1', '0']);
        expect(core.turnOrder[core.currentPlayerIndex]).toBe('1');
        expect(result.finalState.sys.phase).toBe('factionSelect');
    });

    it('显式 firstPlayerId/turnOrder 优先于混合人机默认先手策略', () => {
        const firstPlayerRunner = createRunner({
            firstPlayerId: '0',
            seatControllers: {
                '0': { type: 'local-ai' },
                '1': { type: 'human' },
            },
        });
        const firstPlayerResult = firstPlayerRunner.run({ name: 'explicit first player keeps priority', commands: [] });
        expect(firstPlayerResult.finalState.core.turnOrder).toEqual(['0', '1']);
        expect(firstPlayerResult.finalState.core.turnOrder[firstPlayerResult.finalState.core.currentPlayerIndex]).toBe('0');

        const turnOrderRunner = createRunner({
            turnOrder: ['0', '1'],
            seatControllers: {
                '0': { type: 'local-ai' },
                '1': { type: 'human' },
            },
        });
        const turnOrderResult = turnOrderRunner.run({ name: 'explicit turn order keeps priority', commands: [] });
        expect(turnOrderResult.finalState.core.turnOrder).toEqual(['0', '1']);
        expect(turnOrderResult.finalState.core.turnOrder[turnOrderResult.finalState.core.currentPlayerIndex]).toBe('0');
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

    it('4 人房间开启 2v2 后按团队模式初始化座位与规则', () => {
        const runner = createRunner(['0', '1', '2', '3'], {
            teamMode: '2v2',
            setupSelections: {
                expansions: ['titans'],
                teamMode: '2v2',
            },
        });

        const result = runner.run({
            name: '开启 2v2 团队模式',
            commands: [],
        });

        expect(result.finalState.core.teamMode).toBe('2v2');
        expect(result.finalState.core.seatOrder).toEqual(['0', '1', '2', '3']);
        expect(result.finalState.core.turnOrder).toHaveLength(4);
    });

    it('4 人 2v2 模式下 1/3 队总 VP 达到 25 时按团队获胜', () => {
        const runner = createRunner(['0', '1', '2', '3'], {
            teamMode: '2v2',
            setupSelections: {
                expansions: ['titans'],
                teamMode: '2v2',
            },
        });

        const state = SmashUpDomain.setup(['0', '1', '2', '3'], FIXED_RANDOM, {
            teamMode: '2v2',
            setupSelections: {
                expansions: ['titans'],
                teamMode: '2v2',
            },
        });

        state.players['0'] = {
            ...state.players['0'],
            vp: 13,
        };
        state.players['2'] = {
            ...state.players['2'],
            vp: 12,
        };

        const gameOver = SmashUpDomain.isGameOver!(state);
        expect(gameOver).toBeDefined();
        expect(gameOver!.winners).toEqual(['0', '2']);
        expect((gameOver!.scores?.['0'] ?? 0) + (gameOver!.scores?.['2'] ?? 0)).toBeGreaterThanOrEqual(TEAM_VP_TO_WIN_2V2);
        expect(runner).toBeDefined();
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

    it('同一玩家已有泰坦在场时，普通 TITAN_PLAYED 事件不会让第二个己方泰坦进场', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.PENGUINS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.GHOSTS],
                }),
            },
            titans: [
                {
                    uid: 'arcane-live',
                    defId: 'wizards_arcane_protector',
                    faction: SMASHUP_FACTION_IDS.WIZARDS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } satisfies TitanState,
                {
                    uid: 'emperor-setaside',
                    defId: 'penguins_emperor_penguin',
                    faction: SMASHUP_FACTION_IDS.PENGUINS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                } satisfies TitanState,
            ],
        });

        const next = SmashUpDomain.reduce(core, {
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: 'emperor-setaside',
                defId: 'penguins_emperor_penguin',
                ownerId: '0',
                controllerId: '0',
                baseIndex: 0,
                baseDefId: core.bases[0].defId,
                reason: 'test_illegal_second_owned_titan',
            },
            timestamp: 30,
        } as SmashUpEvent);

        const arcane = next.titans?.find(candidate => candidate.uid === 'arcane-live');
        const emperor = next.titans?.find(candidate => candidate.uid === 'emperor-setaside');
        expect(arcane?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(emperor?.location.zone).toBe('setaside');
        expect(next.players['0'].minionsPlayed).toBe(core.players['0'].minionsPlayed);
        expect(next.players['0'].actionsPlayed).toBe(core.players['0'].actionsPlayed);
    });

    it('泰坦进场交互在 resolve 时会再次检查己方是否已有泰坦在场', () => {
        const handler = getInteractionHandler('titan_penguins_emperor_penguin_play');
        expect(handler).toBeDefined();

        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.PENGUINS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.GHOSTS],
                }),
            },
            titans: [
                {
                    uid: 'arcane-live',
                    defId: 'wizards_arcane_protector',
                    faction: SMASHUP_FACTION_IDS.WIZARDS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } satisfies TitanState,
                {
                    uid: 'emperor-setaside',
                    defId: 'penguins_emperor_penguin',
                    faction: SMASHUP_FACTION_IDS.PENGUINS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                } satisfies TitanState,
            ],
        }));

        const result = handler!(
            state,
            '0',
            { baseIndex: 0, baseDefId: state.core.bases[0].defId },
            {
                continuationContext: {
                    titanUid: 'emperor-setaside',
                    titanDefId: 'penguins_emperor_penguin',
                },
            },
            FIXED_RANDOM,
            31,
        );

        expect(result.events).toEqual([]);
        expect(result.state).toBe(state);
    });

    it('丛林之灵输掉 titan clash 时可以改为移动到另一个基地', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-0', 'robot_microbot_alpha', '0', 2),
                        makeMinion('enemy-0', 'robot_microbot_alpha', '1', 4),
                    ],
                }),
                makeBase({ defId: 'base_b', minions: [] }),
            ],
            titans: [
                {
                    uid: 'spirit-1',
                    defId: 'fairies_spirit_of_the_forest',
                    faction: 'fairies',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as TitanState,
                {
                    uid: 'dagon-1',
                    defId: 'innsmouth_dagon',
                    faction: 'innsmouth',
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } as TitanState,
            ],
        });

        const post = postProcessSystemEvents(core, [{
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: 'dagon-1',
                defId: 'innsmouth_dagon',
                ownerId: '1',
                controllerId: '1',
                baseIndex: 0,
                baseDefId: 'base_a',
                reason: 'test_spirit_clash',
            },
            timestamp: 30,
        } as SmashUpEvent], FIXED_RANDOM, makeMatchState(core));

        expect(post.events.map(event => event.type)).not.toContain(SU_EVENTS.TITAN_REMOVED_FROM_PLAY);
        const prompt = getInteractionsFromMS(post.matchState!)[0] as any;
        expect(prompt?.data?.sourceId).toBe('titan_fairies_spirit_of_the_forest_clash_move');

        const moveOption = prompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        expect(moveOption).toBeDefined();

        const moved = runCommand(
            post.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: moveOption.id } } as any,
            FIXED_RANDOM,
        );

        const spirit = moved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1');
        const dagon = moved.finalState.core.titans?.find(titan => titan.uid === 'dagon-1');
        expect(spirit?.location).toMatchObject({ zone: 'base', baseIndex: 1 });
        expect(dagon?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
    });

    it('titan_fairies_spirit_of_the_forest_clash_move 的 source titan 若在响应前已离开原基地，不应继续沿旧 prompt 移除当前 live titan', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-0', 'robot_microbot_alpha', '0', 2),
                        makeMinion('enemy-0', 'robot_microbot_alpha', '1', 4),
                    ],
                }),
                makeBase({ defId: 'base_b', minions: [] }),
            ],
            titans: [
                {
                    uid: 'spirit-stale',
                    defId: 'fairies_spirit_of_the_forest',
                    faction: 'fairies',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as TitanState,
                {
                    uid: 'dagon-1',
                    defId: 'innsmouth_dagon',
                    faction: 'innsmouth',
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } as TitanState,
            ],
        });

        const post = postProcessSystemEvents(core, [{
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: 'dagon-1',
                defId: 'innsmouth_dagon',
                ownerId: '1',
                controllerId: '1',
                baseIndex: 0,
                baseDefId: 'base_a',
                reason: 'test_spirit_clash_stale',
            },
            timestamp: 31,
        } as SmashUpEvent], FIXED_RANDOM, makeMatchState(core));

        const prompt = getInteractionsFromMS(post.matchState!)[0] as any;
        expect(prompt?.data?.sourceId).toBe('titan_fairies_spirit_of_the_forest_clash_move');

        const handler = getInteractionHandler('titan_fairies_spirit_of_the_forest_clash_move');
        expect(handler).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...post.matchState!,
            core: {
                ...post.matchState!.core,
                titans: (post.matchState!.core.titans ?? []).map(titan => titan.uid === 'spirit-stale'
                    ? { ...titan, location: { zone: 'base', baseIndex: 1, enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = handler!(
            staleState,
            '0',
            { skip: true },
            prompt?.data as any,
            FIXED_RANDOM,
            32,
        );
        expect(resolved.events.filter(event =>
            event.type === SU_EVENTS.TITAN_REMOVED_FROM_PLAY || event.type === SU_EVENTS.TITAN_MOVED)).toHaveLength(0);
        expect((resolved.state.core.titans ?? []).find(titan => titan.uid === 'spirit-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
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

    it('titan_sphinx_start_turn 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 回手埋葬牌或进场', () => {
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
                    uid: 'sphinx-stale-buried',
                    defId: 'robot_warbot',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            })],
            titans: [{
                uid: 't-sphinx-stale',
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
            now: 82,
        });

        const prompt = result.matchState?.sys.interaction?.current as any;
        expect(prompt?.data?.sourceId).toBe('titan_sphinx_start_turn');
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'sphinx-stale-buried');
        expect(option).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...result.matchState!,
            core: {
                ...result.matchState!.core,
                titans: (result.matchState!.core.titans ?? []).map(titan => titan.uid === 't-sphinx-stale'
                    ? { ...titan, location: { zone: 'base', baseIndex: 0, enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            FIXED_RANDOM,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_PLAYED)).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'sphinx-stale-buried')).toBe(false);
        expect(resolved.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'sphinx-stale-buried') ?? false).toBe(true);
        expect((resolved.finalState.core.titans ?? []).find(candidate => candidate.uid === 't-sphinx-stale')?.location).toMatchObject({
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

    it('木乃伊在其他玩家的计分后触发时，埋葬选择权仍应交给木乃伊控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_pyramids',
                minions: [makeMinion('mummy-1', 'ancient_egyptians_mummy', '0', 2)],
                ongoingActions: [],
            })],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'mummy-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            rankings: [{ playerId: '1', power: 5, vp: 4 }],
            random: FIXED_RANDOM,
            now: 83,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('ancient_egyptians_mummy');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            FIXED_RANDOM,
            83,
        );
        const prompt = getInteractionsFromMS(prompted?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
        expect(prompt?.playerId).toBe('0');
    });

    it('法老在其他玩家的计分前触发时，翻牌选择权仍应交给法老控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_pyramids',
                minions: [makeMinion('pharaoh-1', 'ancient_egyptians_pharaoh', '0', 5)],
                buriedCards: [{
                    uid: 'buried-1',
                    defId: 'robot_zapbot',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            })],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'pharaoh-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            rankings: [{ playerId: '1', power: 8, vp: 4 }],
            random: FIXED_RANDOM,
            now: 84,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('ancient_egyptians_pharaoh');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            FIXED_RANDOM,
            84,
        );
        const prompt = getInteractionsFromMS(prompted?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
        expect(prompt?.playerId).toBe('0');
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

    it('titan_sphinx_talent 的 source titan 若在响应前已不在基地上，不应继续按过期 baseIndex 埋葬手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('stale-sphinx-hand-smoke', 'robot_warbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_a' }),
                makeBase({ defId: 'base_b' }),
            ],
            titans: [{
                uid: 'sphinx-stale-smoke',
                defId: 'sphinx',
                faction: SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const talent = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { titanUid: 'sphinx-stale-smoke', baseIndex: 0 } },
            FIXED_RANDOM,
        );
        const prompt = getInteractionsFromMS(talent.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('titan_sphinx_talent');
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'stale-sphinx-hand-smoke');
        expect(option).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...talent.finalState,
            core: {
                ...talent.finalState.core,
                titans: (talent.finalState.core.titans ?? []).map(titan => titan.uid === 'sphinx-stale-smoke'
                    ? { ...titan, location: { zone: 'setaside', enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            FIXED_RANDOM,
        );

        expect(resolved.events.filter(event => event.type === SU_EVENTS.CARD_BURIED)).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'stale-sphinx-hand-smoke')).toBe(true);
        expect(resolved.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'stale-sphinx-hand-smoke') ?? false).toBe(false);
        expect(resolved.finalState.core.bases[1].buriedCards?.some(card => card.uid === 'stale-sphinx-hand-smoke') ?? false).toBe(false);
    });

    it('狮身人面像天赋同回合只能使用一次', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'sphinx-limit-card', defId: 'robot_warbot', type: 'minion', owner: '0' }],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase()],
            titans: [{
                uid: 't-sphinx-limit',
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
            payload: { titanUid: 't-sphinx-limit', baseIndex: 0 },
            timestamp: 90,
        };

        const firstValidation = SmashUpDomain.validate(state, command);
        expect(firstValidation.valid).toBe(true);

        const firstEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(firstEvents.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);

        const coreAfterFirstUse = firstEvents.reduce(
            (acc, event) => SmashUpDomain.reduce(acc, event),
            core,
        );

        const secondValidation = SmashUpDomain.validate(
            { ...state, core: coreAfterFirstUse },
            command,
        );
        expect(secondValidation).toEqual({
            valid: false,
            error: '本回合天赋已使用',
        });
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

    it('翻开埋葬的远古诅咒在存在多个合法目标时，选择目标后应继续进入确认交互', () => {
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
                    minions: [
                        makeMinion('target-minion-a', 'killer_plant_water_lily_pod', '0', 3, { powerCounters: 1, tempPowerModifier: 0 }),
                        makeMinion('target-minion-b', 'killer_plant_water_lily_pod', '0', 4, { powerCounters: 2, tempPowerModifier: 0 }),
                    ],
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
            now: 201,
            reason: 'test_uncover_multi_target',
        });

        const targetPrompt = (uncovered.state.sys.interaction?.current
            ?? uncovered.state.sys.interaction?.queue?.[0]) as any;
        expect(targetPrompt?.data?.sourceId).toBe('bury_uncover_ongoing_target');
        const targetOption = targetPrompt?.data?.options?.find((entry: any) => entry.value?.minionUid === 'target-minion-b');
        expect(targetOption).toBeDefined();

        const resolved = runCommand(
            uncovered.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '1', payload: { optionId: targetOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(resolved.events.map(event => event.type)).toContain(SU_EVENTS.ONGOING_ATTACHED);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'buried-curse',
                defId: 'ancient_egyptians_ancient_curse_pod',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'target-minion-b',
            }),
        }));

        const confirmPrompt = (resolved.finalState.sys.interaction?.current
            ?? resolved.finalState.sys.interaction?.queue?.[0]) as any;
        expect(confirmPrompt?.data?.sourceId).toBe('ancient_egyptians_ancient_curse_confirm');
        const applyOption = confirmPrompt?.data?.options?.find((entry: any) => entry.id === 'apply');
        expect(applyOption?.value).toMatchObject({
            targetMinionUid: 'target-minion-b',
            baseIndex: 0,
            baseDefId: 'base_ninja_dojo',
        });
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
        expect(selectableFactionIds).not.toContain(SMASHUP_FACTION_IDS.ALIENS_POD);
    });

    it('Smash Up AI 第二次选派系时不会把自己已拿的普通版/POD 别名再次列为候选', () => {
        const runner = createRunner();
        const result = runner.run({
            name: 'AI 第二次选派系避开同阵营别名',
            commands: [
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
            ],
        });

        const actions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: result.finalState,
        });

        const selectableFactionIds = actions
            .filter((action) => action.kind === 'select-faction')
            .map((action) => action.metadata?.factionId);

        expect(selectableFactionIds.length).toBeGreaterThan(0);
        expect(selectableFactionIds).not.toContain(SMASHUP_FACTION_IDS.ALIENS);
        expect(selectableFactionIds).not.toContain(SMASHUP_FACTION_IDS.ALIENS_POD);
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

    it('Smash Up baseline AI 在 pirate_broadside 两步链里会先选基地，再优先点敌方目标', async () => {
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
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('pirate_broadside_choose_base');

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
        expect((chosenAction?.metadata?.optionValue as { baseIndex?: number } | undefined)?.baseIndex).toBe(0);

        const baseOption = findInteractionOption(
            state.sys.interaction?.current,
            option => option?.value?.baseIndex === 0,
        );
        expect(baseOption).toBeDefined();

        const baseRespondResult = runCommand(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: baseOption!.id },
            timestamp: 89,
        } as any, FIXED_RANDOM);
        const stateAfterChooseBase = baseRespondResult.finalState;

        expect(stateAfterChooseBase.sys.interaction?.current?.data?.sourceId).toBe('pirate_broadside_choose_player');

        const nextLegalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateAfterChooseBase,
        });
        const nextDecision = await smashUpAiRuntime.localPolicies!.baseline.decide({
            gameId: 'smashup',
            matchId: 'test-smashup-ai-pirate-broadside-target-player',
            playerId: '0',
            visibleState: stateAfterChooseBase,
            interaction: null,
            responseWindow: null,
            legalActions: nextLegalActions,
            rulesVersion: null,
            decisionBudgetMs: 250,
            difficulty: resolveAiDifficultyProfile('expert'),
            source: 'local',
        });
        const nextChosenAction = nextLegalActions.find((action) => action.actionId === nextDecision?.actionId);

        expect(nextChosenAction?.kind).toBe('interaction-choice');
        expect((nextChosenAction?.metadata?.optionValue as { targetPlayerId?: string } | undefined)?.targetPlayerId).toBe('1');
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

    it('高动作密度下应启用 candidate loop 批次搜索，并产出 lookahead 前瞻贡献', async () => {
        const stateForAi = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('wizard-summon-1', 'wizard_summon', 'action', '0'),
                        makeCard('wizard-summon-2', 'wizard_summon', 'action', '0'),
                        makeCard('robot-warbot-1', 'robot_warbot', 'minion', '0'),
                        makeCard('robot-warbot-2', 'robot_warbot', 'minion', '0'),
                        makeCard('pirate-first-mate-1', 'pirate_first_mate', 'minion', '0'),
                        makeCard('dino-armor-stego-1', 'dino_armor_stego', 'minion', '0'),
                        makeCard('robot-tech-center-1', 'robot_tech_center', 'action', '0'),
                        makeCard('wizard-enchantress-1', 'wizard_enchantress', 'minion', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.ROBOTS],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_jungle'),
                makeBase('base_the_mothership'),
                makeBase('base_tar_pits'),
            ],
        }));

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });
        expect(legalActions.length).toBeGreaterThan(15);

        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
            gameId: 'smashup',
            matchId: 'test-smashup-ai-candidate-loop-density',
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
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            searched?: boolean;
            contributions: Array<{ scorerId: string }>;
        }>;

        expect(evaluations.length).toBe(legalActions.length);
        expect(evaluations.some((item) => item.searched === true)).toBe(true);
        expect(evaluations.some((item) => item.searched === false)).toBe(true);
        expect(
            evaluations.some((item) => item.contributions.some((contribution) => contribution.scorerId === 'lookahead')),
        ).toBe(true);
        expect(
            evaluations.some((item) => item.contributions.some((contribution) => contribution.scorerId === 'assignment-first')),
        ).toBe(true);
        expect(
            evaluations.some((item) => item.contributions.some((contribution) => contribution.scorerId === 'relative-utility-smashup-limited')),
        ).toBe(true);
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
        const stateForAi = attachReactionSession(makeMatchState(core), {
            frameId: 'score-before:0:smoke-urgent-response',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });

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
        const stateForAi = attachReactionSession(makeMatchState(core), {
            frameId: 'score-before:0:smoke-calm-response',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });

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
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            actionId?: string;
            contributions: Array<{ scorerId: string }>;
        }>;

        expect(legalActions.some((action) => action.kind === 'response-pass')).toBe(true);
        expect(chosenAction?.kind).toBe('response-pass');
        expect(
            evaluations
                .flatMap((item) => item.contributions ?? [])
                .some((contribution) => contribution.scorerId === 'relative-utility-smashup-limited'),
        ).toBe(false);
    });

    it('Smash Up AI legal actions 在 legacy responderQueue 被 ghost 污染时，仍应按 live current player 生成响应动作', () => {
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
                    hand: [makeCard('card-1', 'giant_ant_under_pressure', 'action', '0')],
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
        const stateForAi = attachReactionSession(makeMatchState(core), {
            frameId: 'score-before:0:ghost-legacy-ai-response',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });

        stateForAi.sys.responseWindow = {
            ...(stateForAi.sys.responseWindow ?? {}),
            current: {
                ...(stateForAi.sys.responseWindow?.current ?? {}),
                id: 'legacy-window-ghost-ai',
                windowType: 'meFirst',
                sourceId: 'legacy_me_first',
                responderQueue: ['ghost', '1'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        } as any;

        const currentPlayerActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });
        const otherPlayerActions = buildSmashUpAiLegalActions({
            playerId: '1',
            state: stateForAi,
        });

        expect(currentPlayerActions.some((action) => action.kind === 'response-pass')).toBe(true);
        expect(currentPlayerActions.some((action) => action.kind === 'response-play-action')).toBe(true);
        expect(otherPlayerActions.some((action) => action.kind === 'response-pass')).toBe(false);
        expect(otherPlayerActions.some((action) => action.kind === 'response-play-action')).toBe(false);
    });

    it('Smash Up AI legal actions 在 legacy responseWindow 只剩空壳时，仍应给当前玩家 advance-phase', () => {
        const stateForAi = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 1,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_mothership')],
        }));

        stateForAi.sys.phase = 'playCards';
        stateForAi.sys.responseWindow = {
            current: {
                id: 'legacy-window-empty-shell',
                windowType: 'meFirst',
                sourceId: 'legacy_me_first',
                responderQueue: [],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
            history: [],
        } as any;

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });

        expect(legalActions.map((action) => action.kind)).toContain('advance-phase');
    });

    it('Smash Up baseline AI 在 legacy responseWindow 只剩空壳时，仍应启用 relative utility scorer', async () => {
        const stateForAi = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('wizard-summon-1', 'wizard_summon', 'action', '0'),
                        makeCard('wizard-summon-2', 'wizard_summon', 'action', '0'),
                        makeCard('robot-warbot-1', 'robot_warbot', 'minion', '0'),
                        makeCard('robot-warbot-2', 'robot_warbot', 'minion', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.ROBOTS],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_jungle'),
                makeBase('base_the_mothership'),
            ],
        }));

        stateForAi.sys.responseWindow = {
            current: {
                id: 'legacy-window-empty-shell-relative-utility',
                windowType: 'meFirst',
                sourceId: 'legacy_me_first',
                responderQueue: [],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
            history: [],
        } as any;

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });
        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
            gameId: 'smashup',
            matchId: 'test-smashup-ai-stale-legacy-window-relative-utility',
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
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            searched?: boolean;
            contributions: Array<{ scorerId: string }>;
        }>;

        expect(
            evaluations.some((item) => item.contributions.some((contribution) => contribution.scorerId === 'relative-utility-smashup-limited')),
        ).toBe(true);
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
                '0': makePlayer('0', { hand: [makeCard('tf1', 'alien_terraform', 'action', '0'), makeCard('h1', 'alien_invader', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            titans: [tricksterTitan],
            bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 3, { powerModifier: 0 })])],
            baseDeck: ['base_new', 'base_alt'],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'tf1', targetBaseIndex: 0 },
            } as any,
            FIXED_RANDOM,
        );
        const step1Current = (played.finalState.sys as any).interaction?.current;
        const replacementOption = step1Current?.data?.options?.find((entry: any) => entry.value?.newBaseDefId === 'base_new');
        expect(replacementOption).toBeDefined();
        const step2 = runCommand(
            played.finalState,
            {
                type: 'SYS_INTERACTION_RESPOND',
                playerId: '0',
                payload: { optionId: replacementOption.id },
            } as any,
            FIXED_RANDOM,
        );
        const step2Current = (step2.finalState.sys as any).interaction?.current;
        const titanOption = step2Current?.data?.options?.find((opt: any) => opt.value?.titanUid === 't1');
        expect(titanOption).toBeDefined();
        expect(titanOption.value).toMatchObject({
            titanUid: 't1',
            defId: 'tricksters_big_funny_giant',
            playKind: 'minion',
        });

        const step3 = runCommand(
            step2.finalState,
            {
                type: 'SYS_INTERACTION_RESPOND',
                playerId: '0',
                payload: { optionId: titanOption.id },
            } as any,
            FIXED_RANDOM,
        );
        const titanPlayed = step3.events.find(event => event.type === SU_EVENTS.TITAN_PLAYED);
        expect(titanPlayed).toBeDefined();
        expect((titanPlayed as any).payload).toMatchObject({
            titanUid: 't1',
            defId: 'tricksters_big_funny_giant',
            controllerId: '0',
            baseIndex: 0,
            baseDefId: 'base_new',
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

    it('titan_giant_ants_death_on_six_legs_special 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 弃牌或进场', () => {
        const initialState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('six-legs-discard', 'wizard_summon', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.WIZARDS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_jungle',
                minions: [makeMinion('ant-queen-live', 'giant_ant_queen', '0', 3, { powerCounters: 7 })],
                ongoingActions: [],
            })],
            titans: [{
                uid: 't-six-legs-stale',
                defId: 'giant_ants_death_on_six_legs',
                faction: SMASHUP_FACTION_IDS.GIANT_ANTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        }));

        const activated = runCommand(initialState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-six-legs-stale', baseIndex: 0 },
            timestamp: 54,
        } as any, FIXED_RANDOM);
        expect(activated.success).toBe(true);

        const specialPrompt = getInteractionsFromMS(activated.finalState)[0] as any;
        expect(specialPrompt?.data?.sourceId).toBe('titan_giant_ants_death_on_six_legs_special');
        const discardOption = findInteractionOption(
            specialPrompt,
            entry => entry?.value?.cardUid === 'six-legs-discard',
        );
        expect(discardOption).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...activated.finalState,
            core: {
                ...activated.finalState.core,
                titans: (activated.finalState.core.titans ?? []).map(titan => titan.uid === 't-six-legs-stale'
                    ? { ...titan, location: { zone: 'base', baseIndex: 0, enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: discardOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(resolved.events.filter(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_PLAYED)).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('six-legs-discard');
        expect((resolved.finalState.core.titans ?? []).find(titan => titan.uid === 't-six-legs-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
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

    it('titan_bear_cavalry_major_ursa_choose_destination 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 移动泰坦', () => {
        const core = makeState({
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-ursa-stale',
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
            payload: { titanUid: 't-ursa-stale', baseIndex: 0 },
            timestamp: 61,
        };

        const validation = SmashUpDomain.validate(state, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_bear_cavalry_major_ursa_choose_destination');

        const destinationHandler = getInteractionHandler('titan_bear_cavalry_major_ursa_choose_destination');
        expect(destinationHandler).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...state,
            core: {
                ...state.core,
                titans: (state.core.titans ?? []).map(titan => titan.uid === 't-ursa-stale'
                    ? { ...titan, location: { zone: 'setaside', enteredAt: 1 } }
                    : titan),
            },
        };

        const destinationResult = destinationHandler!(
            staleState,
            '0',
            { baseIndex: 1, baseDefId: core.bases[1].defId },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            62,
        );
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_POWER_COUNTER_ADDED);
        expect(destinationResult.events.filter(event => event.type === SU_EVENTS.TITAN_MOVED)).toHaveLength(0);
        expect((destinationResult.state.core.titans ?? []).find(candidate => candidate.uid === 't-ursa-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
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

    it('titan_bear_cavalry_major_ursa_choose_minion 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 进入目标基地选择', () => {
        const core = makeState({
            bases: [
                makeBase(),
                makeBase({
                    minions: [makeMinion('enemy-minion', 'ghosts_spectre', '1', 3)],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-ursa-first-stale',
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
        expect(destinationHandler).toBeDefined();
        expect(minionHandler).toBeDefined();

        const destinationResult = destinationHandler!(
            makeMatchState(core, 'playCards', '0'),
            '0',
            { baseIndex: 1, baseDefId: core.bases[1].defId },
            { continuationContext: { titanUid: 't-ursa-first-stale', fromBaseIndex: 0, titanDefId: 'bear_cavalry_major_ursa' } },
            FIXED_RANDOM,
            67,
        );
        expect(destinationResult.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_MOVED]);

        const post = postProcessSystemEvents(core, destinationResult.events, FIXED_RANDOM, destinationResult.state);
        const queuedState = post.matchState ?? destinationResult.state;
        let reactionState = queuedState;
        let currentInteraction = queuedState.sys.interaction?.current;

        const reactionPrompt = maybeResolveReactionQueue(queuedState, FIXED_RANDOM, 68);
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

        const staleState: MatchState<SmashUpCore> = {
            ...reactionState,
            core: {
                ...reactionState.core,
                titans: (reactionState.core.titans ?? []).map(titan => titan.uid === 't-ursa-first-stale'
                    ? { ...titan, location: { zone: 'setaside', enteredAt: 1 } }
                    : titan),
            },
        };
        const chooseMinionResult = minionHandler!(
            staleState,
            '0',
            { minionUid: 'enemy-minion', defId: 'ghosts_spectre', baseIndex: 1 },
            currentInteraction?.data,
            FIXED_RANDOM,
            69,
        );
        expect(chooseMinionResult.events).toEqual([]);
        expect(chooseMinionResult.state.sys.interaction?.queue?.some(interaction => interaction?.data?.sourceId === 'titan_bear_cavalry_major_ursa_choose_base')).toBe(false);
        expect(chooseMinionResult.state.sys.interaction?.current?.data?.sourceId).not.toBe('titan_bear_cavalry_major_ursa_choose_base');
        expect((chooseMinionResult.state.core.titans ?? []).find(titan => titan.uid === 't-ursa-first-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
    });

    it('同基地有两只大熊座时，若被选中的那只在第二步前离场，则不应继续移动目标随从', () => {
        const core = makeState({
            bases: [
                makeBase(),
                makeBase({
                    minions: [makeMinion('enemy-minion', 'ghosts_spectre', '1', 3)],
                }),
                makeBase(),
            ],
            titans: [
                {
                    uid: 'ursa-a',
                    defId: 'bear_cavalry_major_ursa',
                    faction: SMASHUP_FACTION_IDS.BEAR_CAVALRY,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                } satisfies TitanState,
                {
                    uid: 'ursa-b',
                    defId: 'bear_cavalry_major_ursa',
                    faction: SMASHUP_FACTION_IDS.BEAR_CAVALRY,
                    ownerId: '1',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 2 },
                } satisfies TitanState,
            ],
        });

        const minionHandler = getInteractionHandler('titan_bear_cavalry_major_ursa_choose_minion');
        const baseHandler = getInteractionHandler('titan_bear_cavalry_major_ursa_choose_base');
        expect(minionHandler).toBeDefined();
        expect(baseHandler).toBeDefined();

        const reactionState = makeMatchState(core, 'playCards', '0');
        reactionState.sys.interaction = {
            ...reactionState.sys.interaction,
            current: createSimpleChoice(
                'major-ursa-source-stale-minion',
                '0',
                '大熊座：选择一个对手战力≤3的随从移动',
                buildMinionTargetOptions([{ uid: 'enemy-minion', defId: 'ghosts_spectre', baseIndex: 1 }], {
                    state: reactionState.core,
                    sourcePlayerId: '0',
                    sourceDefId: 'bear_cavalry_major_ursa',
                    effectType: 'move',
                }),
                { sourceId: 'titan_bear_cavalry_major_ursa_choose_minion', targetType: 'minion' },
            ),
            queue: [],
        };
        (reactionState.sys.interaction.current!.data as any).continuationContext = {
            titanUid: 'ursa-b',
            fromBaseIndex: 1,
        };

        const chooseMinionResult = minionHandler!(
            reactionState,
            '0',
            { minionUid: 'enemy-minion', defId: 'ghosts_spectre', baseIndex: 1 },
            reactionState.sys.interaction.current?.data,
            FIXED_RANDOM,
            65,
        );
        const queuedChooseBase = chooseMinionResult.state.sys.interaction?.queue?.[0];
        expect(queuedChooseBase?.data?.sourceId).toBe('titan_bear_cavalry_major_ursa_choose_base');

        const sourceRemovedState = {
            ...chooseMinionResult.state,
            core: {
                ...chooseMinionResult.state.core,
                titans: (chooseMinionResult.state.core.titans ?? []).filter(titan => titan.uid !== 'ursa-b'),
            },
        };
        const chooseBaseResult = baseHandler!(
            sourceRemovedState,
            '0',
            { baseIndex: 2, baseDefId: core.bases[2].defId },
            queuedChooseBase?.data,
            FIXED_RANDOM,
            66,
        );
        expect(chooseBaseResult.events).toEqual([]);
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

    it('titan_changerbots_mergacon_play 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 进场', () => {
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
                uid: 't-mergacon-stale',
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
            now: 80,
        });
        const prompt = getInteractionsFromMS(triggerResult.matchState!)[0] as any;
        expect(prompt?.data?.sourceId).toBe('titan_changerbots_mergacon_play');

        const handler = getInteractionHandler('titan_changerbots_mergacon_play');
        expect(handler).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...triggerResult.matchState!,
            core: {
                ...triggerResult.matchState!.core,
                titans: (triggerResult.matchState!.core.titans ?? []).map(titan => titan.uid === 't-mergacon-stale'
                    ? { ...titan, location: { zone: 'base', baseIndex: 1, enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = handler!(
            staleState,
            '0',
            { baseIndex: 0, baseDefId: core.bases[0].defId },
            prompt?.data as any,
            FIXED_RANDOM,
            81,
        );
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_PLAYED)).toHaveLength(0);
        expect((resolved.state.core.titans ?? []).find(candidate => candidate.uid === 't-mergacon-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
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

    it('彩虹鸟的替换基地 special 会在 scoreBases 收尾时真正把泰坦落到新基地', () => {
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

        const baseRef = createScoringBaseRef(core, 0);
        if (!baseRef) {
            throw new Error('无法构造彩虹鸟替换基地 scoring base ref');
        }

        let state = makeMatchState(core, 'scoreBases', '0');
        state = setScoringSession(state, {
            ...createScoringSession(core, [0]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-interactions',
        });
        state = appendScoringFrameDeferredPayload(state, {
            deferredEvents: [
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
        });
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
                            scoringBaseIndex: 0,
                        },
                    },
                },
                timestamp: 85,
            } as any],
            random: FIXED_RANDOM,
        }) as any;

        const emittedEvents = hook?.events ?? [];
        expect(emittedEvents).toEqual([]);
        expect(hook?.state?.sys?.interaction?.current).toBeFalsy();

        const finalize = smashUpFlowHooks.onPhaseExit?.({
            state: hook?.state ?? state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined } as any,
            random: FIXED_RANDOM,
        });
        const finalizeEvents = Array.isArray(finalize) ? finalize : (finalize as any)?.events ?? [];
        expect(finalizeEvents.map((event: SmashUpEvent) => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
            SU_EVENTS.TITAN_PLAYED,
        ]);

        const finalCore = finalizeEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            (hook?.state ?? state).core,
        );
        expect(finalCore.titans?.find(candidate => candidate.uid === 't-rainboroc-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
        expect(finalCore.bases[0].defId).toBe('base_factory_436-1337');
    });

    it('titan_itty_critters_rainboroc_play_replacement 的 source titan 若在响应前已离开牌库旁，不应继续预约替换基地进场', () => {
        const core = makeState({
            bases: [makeBase({ defId: 'base_the_homeworld' })],
            titans: [{
                uid: 't-rainboroc-replacement-stale',
                defId: 'itty_critters_rainboroc',
                faction: SMASHUP_FACTION_IDS.ITTY_CRITTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const handler = getInteractionHandler('titan_itty_critters_rainboroc_play_replacement');
        expect(handler).toBeDefined();

        const baseRef = createScoringBaseRef(core, 0);
        if (!baseRef) {
            throw new Error('无法构造彩虹鸟 stale replacement scoring base ref');
        }

        let state = makeMatchState(core, 'scoreBases', '0');
        state = setScoringSession(state, {
            ...createScoringSession(core, [0]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-interactions',
        });
        state = appendScoringFrameDeferredPayload(state, {
            deferredEvents: [{
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: 0,
                    oldBaseDefId: core.bases[0].defId,
                    newBaseDefId: 'base_factory_436-1337',
                },
                timestamp: 86,
            }],
        });

        const staleState: ReturnType<typeof makeMatchState> = {
            ...state,
            core: {
                ...state.core,
                titans: (state.core.titans ?? []).map(titan => titan.uid === 't-rainboroc-replacement-stale'
                    ? { ...titan, location: { zone: 'base', baseIndex: 0, enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = handler!(
            staleState,
            '0',
            { play: true },
            {
                sourceId: 'titan_itty_critters_rainboroc_play_replacement',
                continuationContext: {
                    titanUid: 't-rainboroc-replacement-stale',
                    titanDefId: 'itty_critters_rainboroc',
                    scoringBaseIndex: 0,
                },
            } as any,
            FIXED_RANDOM,
            86,
        );

        const consumed = consumeScoringFrameDeferredPayload(resolved.state);
        expect(consumed.deferredActions).toEqual([]);
        expect((resolved.state.core.titans ?? []).find(titan => titan.uid === 't-rainboroc-replacement-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
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

    it('彩虹鸟天赋选择被他人拥有的弃牌随从时，仍应洗回其拥有者牌库而不是当前玩家牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('rain-borrowed-minion', 'pirate_first_mate', 'minion', '1')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('owner-deck-a', 'robot_microbot_alpha', 'minion', '1')],
                }),
            },
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-rainboroc-borrowed',
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
            payload: { titanUid: 't-rainboroc-borrowed', baseIndex: 0 },
            timestamp: 98,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_itty_critters_rainboroc_choose_discard');

        const chooseDiscardHandler = getInteractionHandler('titan_itty_critters_rainboroc_choose_discard');
        expect(chooseDiscardHandler).toBeDefined();

        const chooseDiscardResult = chooseDiscardHandler!(
            state,
            '0',
            { cardUid: 'rain-borrowed-minion', defId: 'pirate_first_mate' },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            99,
        );

        expect(chooseDiscardResult.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({
                playerId: '1',
                sourcePlayerId: '0',
            }),
        }));
        expect(chooseDiscardResult.state.sys.interaction?.queue?.[0]?.data?.sourceId).toBe(
            'titan_itty_critters_rainboroc_choose_base',
        );

        const afterShuffle = chooseDiscardResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(afterShuffle.players['1'].deck.map(card => card.uid)).toEqual(['owner-deck-a', 'rain-borrowed-minion']);
        expect(afterShuffle.players['0'].deck.map(card => card.uid)).not.toContain('rain-borrowed-minion');
        expect(afterShuffle.players['0'].discard.map(card => card.uid)).not.toContain('rain-borrowed-minion');
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

    it('borrowed 哥佐拉 special 应按控制者而不是真实 owner 统计本基地的基地与附着战术', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'test_base',
                    ongoingActions: [
                        {
                            uid: 'borrowed-gorg-base-action',
                            defId: 'trickster_hideout',
                            ownerId: '1',
                            talentUsed: false,
                            metadata: { sourceControllerId: '0' },
                        },
                    ],
                    minions: [
                        makeMinion('borrowed-gorg-host-minion', 'ghosts_spectre', '0', 2, {
                            attachedActions: [
                                {
                                    uid: 'borrowed-gorg-attached-action',
                                    defId: 'trickster_hideout',
                                    ownerId: '1',
                                    metadata: { sourceControllerId: '0' },
                                },
                            ],
                        }),
                    ],
                }),
            ],
            titans: [{
                uid: 't-borrowed-gorgodzolla',
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
        const command: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-borrowed-gorgodzolla', baseIndex: 0 },
            timestamp: 93,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);
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

    it('哥佐拉在其他玩家于本基地打出战术后，抽牌交互仍应归泰坦控制者', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('gorg-draw-card', 'ghosts_spectre', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('gorg-action', 'trickster_hideout', 'action', '1')],
                }),
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
                playerId: '1',
                payload: { cardUid: 'gorg-action', targetBaseIndex: 0 },
                timestamp: 96,
            },
            FIXED_RANDOM,
        );

        expect(result.success).toBe(true);
        expect(result.finalState.sys.interaction?.current?.data?.sourceId).toBe('titan_kaiju_gorgodzolla_draw');
        expect(result.finalState.sys.interaction?.current?.playerId).toBe('0');
        expect(result.finalState.core.titans?.find(candidate => candidate.uid === 't-gorgodzolla')?.powerCounters).toBe(1);

        const drawHandler = getInteractionHandler('titan_kaiju_gorgodzolla_draw');
        expect(drawHandler).toBeDefined();

        const drawResult = drawHandler!(
            result.finalState,
            '0',
            { draw: true },
            result.finalState.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            97,
        );

        expect(drawResult.events.map(event => event.type)).toEqual([SU_EVENTS.CARDS_DRAWN]);
        const resolved = drawResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            result.finalState.core,
        );
        expect(resolved.players['0'].hand.map(card => card.uid)).toContain('gorg-draw-card');
        expect(resolved.players['1'].hand.map(card => card.uid)).not.toContain('gorg-draw-card');
    });

    it('titan_kaiju_gorgodzolla_draw 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 抽牌', () => {
        const initialState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gorg-action', 'trickster_hideout', 'action', '0')],
                    deck: [makeCard('gorg-draw-card', 'ghosts_spectre', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'test_base' })],
            titans: [{
                uid: 't-gorgodzolla-stale',
                defId: 'kaiju_gorgodzolla',
                faction: SMASHUP_FACTION_IDS.KAIJU,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        }));

        const played = runCommand(initialState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'gorg-action', targetBaseIndex: 0 },
            timestamp: 98,
        }, FIXED_RANDOM);
        expect(played.success).toBe(true);

        const gorgPrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(gorgPrompt?.data?.sourceId).toBe('titan_kaiju_gorgodzolla_draw');
        const drawOption = findInteractionOption(gorgPrompt, entry => entry?.value?.draw === true);
        expect(drawOption).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                titans: (played.finalState.core.titans ?? []).map(titan => titan.uid === 't-gorgodzolla-stale'
                    ? { ...titan, location: { zone: 'setaside', enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: drawOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(resolved.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        expect((resolved.finalState.core.titans ?? []).find(titan => titan.uid === 't-gorgodzolla-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('gorg-draw-card');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toContain('gorg-draw-card');
    });

    it('titan_killer_plants_killer_kudzu_talent_base 的 source titan 若在响应前已离场，不应继续沿旧 prompt 移除泰坦或从弃牌堆打出随从', () => {
        const initialState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('kudzu-discard-minion', 'pirate_first_mate', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_the_jungle' }),
                makeBase({ defId: 'base_factory_436-1337' }),
            ],
            titans: [{
                uid: 't-kudzu-stale',
                defId: 'killer_plants_killer_kudzu',
                faction: SMASHUP_FACTION_IDS.KILLER_PLANTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 3,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        }));

        const activated = runCommand(initialState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-kudzu-stale', baseIndex: 0 },
            timestamp: 99,
        }, FIXED_RANDOM);
        expect(activated.success).toBe(true);

        const talentPrompt = getInteractionsFromMS(activated.finalState)[0] as any;
        expect(talentPrompt?.data?.sourceId).toBe('titan_killer_plants_killer_kudzu_talent');
        const cardOption = findInteractionOption(
            talentPrompt,
            entry => entry?.value?.cardUid === 'kudzu-discard-minion',
        );
        expect(cardOption).toBeDefined();

        const chooseBase = runCommand(
            activated.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: cardOption.id } } as any,
            FIXED_RANDOM,
        );
        expect(chooseBase.success).toBe(true);

        const basePrompt = getInteractionsFromMS(chooseBase.finalState)[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('titan_killer_plants_killer_kudzu_talent_base');
        const baseOption = findInteractionOption(
            basePrompt,
            entry => entry?.value?.baseIndex === 1,
        );
        expect(baseOption).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...chooseBase.finalState,
            core: {
                ...chooseBase.finalState.core,
                titans: (chooseBase.finalState.core.titans ?? []).map(titan => titan.uid === 't-kudzu-stale'
                    ? { ...titan, location: { zone: 'setaside' } }
                    : titan),
            },
        };

        const resolved = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: baseOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_REMOVED_FROM_PLAY)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.MINION_PLAYED)).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('kudzu-discard-minion');
        expect((resolved.finalState.core.titans ?? []).find(titan => titan.uid === 't-kudzu-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).not.toContain('kudzu-discard-minion');
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

    it('borrowed 移动城堡 special 也应按当前控制者而不是真实 owner 判断合法基地并保留真实 owner', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('castle-borrowed-own-a', 'ghosts_spectre', '0', 2, { owner: '1' }),
                        makeMinion('castle-borrowed-own-b', 'pirate_first_mate', '0', 2, { owner: '1' }),
                    ],
                }),
                makeBase({
                    minions: [makeMinion('castle-borrowed-only-one', 'ghosts_spectre', '0', 2, { owner: '1' })],
                }),
            ],
            titans: [{
                uid: 't-walking-castle-borrowed-setaside',
                defId: 'magical_girls_walking_castle',
                faction: SMASHUP_FACTION_IDS.MAGICAL_GIRLS,
                ownerId: '1',
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
            payload: { titanUid: 't-walking-castle-borrowed-setaside', baseIndex: 0 },
            timestamp: 99,
        };
        const invalidCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-walking-castle-borrowed-setaside', baseIndex: 1 },
            timestamp: 100,
        };

        expect(SmashUpDomain.validate(state, validCommand).valid).toBe(true);
        expect(SmashUpDomain.validate(state, invalidCommand).valid).toBe(false);

        const events = SmashUpDomain.execute(state, validCommand, FIXED_RANDOM);
        expect(events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TITAN_PLAYED,
            payload: expect.objectContaining({
                titanUid: 't-walking-castle-borrowed-setaside',
                ownerId: '1',
                controllerId: '0',
                baseIndex: 0,
            }),
        }));

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(resolved.titans?.find(candidate => candidate.uid === 't-walking-castle-borrowed-setaside')).toMatchObject({
            ownerId: '1',
            controllerId: '0',
            location: { zone: 'base', baseIndex: 0 },
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

    it('titan_explorers_very_large_boulder_move 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 移动泰坦', () => {
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
                uid: 't-boulder-stale',
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
                    reason: 'test_move_from_boulder_stale',
                },
                timestamp: 109,
            } as SmashUpEvent], state, '1', FIXED_RANDOM, 109);

        const queuedCore = moveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            state.core,
        );
        const queuedState = {
            ...(moveResult.matchState ?? state),
            core: queuedCore,
        };
        const reactionResult = maybeResolveReactionQueue(queuedState, FIXED_RANDOM, 109);
        const boulderInteraction =
            reactionResult?.state.sys.interaction?.current
            ?? reactionResult?.state.sys.interaction?.queue?.[0];

        expect((boulderInteraction?.data as any)?.sourceId).toBe('titan_explorers_very_large_boulder_move');
        const moveHandler = getInteractionHandler('titan_explorers_very_large_boulder_move');
        expect(moveHandler).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...reactionResult!.state,
            core: {
                ...reactionResult!.state.core,
                titans: (reactionResult!.state.core.titans ?? []).map(titan => titan.uid === 't-boulder-stale'
                    ? { ...titan, location: { zone: 'setaside', enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = moveHandler!(
            staleState,
            '0',
            { move: true },
            boulderInteraction?.data as any,
            FIXED_RANDOM,
            110,
        );

        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_MOVED)).toHaveLength(0);
        expect(resolved.state.sys.interaction?.current?.data?.sourceId).not.toBe('titan_explorers_very_large_boulder_destroy');
        expect((resolved.state.core.titans ?? []).find(titan => titan.uid === 't-boulder-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.state.core.bases[1].minions.map(minion => minion.uid)).toContain('boulder-target');
        expect(resolved.state.core.bases[1].minions.map(minion => minion.uid)).toContain('boulder-safe');
    });

    it('titan_explorers_very_large_boulder_destroy 的 source titan 若在响应前已离开目标基地，不应继续沿旧 prompt 消灭随从', () => {
        const core = makeState({
            turnNumber: 4,
            bases: [
                makeBase({
                    minions: [makeMinion('moved-away', 'trickster_gnome', '1', 3)],
                }),
                makeBase({
                    minions: [
                        makeMinion('boulder-target', 'robot_microbot_guard', '1', 1),
                        makeMinion('boulder-alt', 'ghosts_spectre', '1', 1),
                        makeMinion('boulder-safe', 'trickster_gnome', '1', 3),
                    ],
                }),
            ],
            titans: [{
                uid: 't-boulder-destroy-stale',
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
                    reason: 'test_move_from_boulder_destroy_stale',
                },
                timestamp: 111,
            } as SmashUpEvent], state, '1', FIXED_RANDOM, 111);

        const queuedCore = moveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            state.core,
        );
        const queuedState = {
            ...(moveResult.matchState ?? state),
            core: queuedCore,
        };
        const reactionResult = maybeResolveReactionQueue(queuedState, FIXED_RANDOM, 111);
        const boulderInteraction =
            reactionResult?.state.sys.interaction?.current
            ?? reactionResult?.state.sys.interaction?.queue?.[0];

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
            112,
        );
        const pendingDestroyInteraction = getInteractionsFromMS(chooseMoveResult.state).find(
            (interaction: any) => interaction?.data?.sourceId === 'titan_explorers_very_large_boulder_destroy',
        ) as any;
        expect(pendingDestroyInteraction?.data?.sourceId).toBe('titan_explorers_very_large_boulder_destroy');

        const movedCore = chooseMoveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            reactionResult!.state.core,
        );
        const staleState: MatchState<SmashUpCore> = {
            ...chooseMoveResult.state,
            core: {
                ...movedCore,
                titans: (movedCore.titans ?? []).map(titan => titan.uid === 't-boulder-destroy-stale'
                    ? { ...titan, location: { zone: 'setaside', enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = destroyHandler!(
            staleState,
            '0',
            { minionUid: 'boulder-target' },
            pendingDestroyInteraction.data as any,
            FIXED_RANDOM,
            113,
        );

        expect(resolved.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
        expect((resolved.state.core.titans ?? []).find(titan => titan.uid === 't-boulder-destroy-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.state.core.bases[1].minions.map(minion => minion.uid)).toContain('boulder-target');
        expect(resolved.state.core.bases[1].minions.map(minion => minion.uid)).toContain('boulder-alt');
        expect(resolved.state.core.bases[1].minions.map(minion => minion.uid)).toContain('boulder-safe');
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

    it('隐形忍者消灭对手随从后，抽牌反应归属于泰坦控制者并可正常抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('ninja-draw-a', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('ninja-draw-b', 'ghosts_spectre', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase(),
                makeBase({
                    minions: [makeMinion('enemy-victim', 'pirate_first_mate', '1', 2)],
                }),
            ],
            titans: [{
                uid: 't-invisible-ninja-live',
                defId: 'ninjas_invisible_ninja',
                faction: SMASHUP_FACTION_IDS.NINJAS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const matchState = makeMatchState(core, 'playCards', '0');
        const destroyEvent: SmashUpEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'enemy-victim',
                minionDefId: 'pirate_first_mate',
                fromBaseIndex: 1,
                ownerId: '1',
                destroyerId: '0',
                reason: 'invisible_ninja_smoke_destroy',
            },
            timestamp: 102,
        };

        const processed = processDestroyTriggers([destroyEvent], matchState, '0', FIXED_RANDOM, 102);
        let reactionState = processed.matchState ?? matchState;
        let currentInteraction = getInteractionsFromMS(reactionState)[0] as any;

        if (!currentInteraction) {
            const reactionResult = maybeResolveReactionQueue(reactionState, FIXED_RANDOM, 102);
            reactionState = reactionResult?.state ?? reactionState;
            currentInteraction = getInteractionsFromMS(reactionState)[0] as any;
        }

        if (currentInteraction?.data?.sourceId === 'smashup_reaction_choose') {
            const queueById = new Map(reactionState.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
            const ninjaOption = currentInteraction.data.options.find((option: any) => {
                const trigger = queueById.get(option.value?.triggerId) as any;
                return trigger?.sourceDefId === 'ninjas_invisible_ninja';
            }) ?? currentInteraction.data.options[0];

            const afterChooseTrigger = runCommand(
                reactionState,
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: ninjaOption.id } } as any,
                FIXED_RANDOM,
            );
            reactionState = afterChooseTrigger.finalState;
            currentInteraction = getInteractionsFromMS(reactionState)[0] as any;
        }

        expect(currentInteraction?.data?.sourceId).toBe('titan_ninjas_invisible_ninja_ongoing');
        expect(currentInteraction?.playerId).toBe('0');

        const drawOption = currentInteraction.data.options.find((option: any) => option.value?.cardUid === 'ninja-draw-a')
            ?? currentInteraction.data.options[0];
        const afterDraw = runCommand(
            reactionState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: drawOption.id } } as any,
            FIXED_RANDOM,
        );

        const drawEvent = afterDraw.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as CardsDrawnEvent | undefined;
        expect(drawEvent?.payload.playerId).toBe('0');
        expect(drawEvent?.payload.cardUids).toEqual([drawOption.value.cardUid]);

        const finalCore = afterDraw.events
            .filter(event => typeof event.type === 'string' && event.type.startsWith('su:'))
            .reduce((acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event), reactionState.core);
        expect(finalCore.players['0'].hand.map(card => card.uid)).toContain(drawOption.value.cardUid);
    });

    it('titan_ninjas_invisible_ninja_start_turn 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 自毁或授予额外随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase()],
            titans: [{
                uid: 't-invisible-ninja-start-stale',
                defId: 'ninjas_invisible_ninja',
                faction: SMASHUP_FACTION_IDS.NINJAS,
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
            now: 104,
        });
        const prompt = triggerResult.matchState?.sys.interaction?.current as any;
        expect(prompt?.data?.sourceId).toBe('titan_ninjas_invisible_ninja_start_turn');
        const destroyOption = findInteractionOption(prompt, entry => entry?.value?.destroyTitan === true);
        expect(destroyOption).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...triggerResult.matchState!,
            core: {
                ...triggerResult.matchState!.core,
                titans: (triggerResult.matchState!.core.titans ?? []).map(titan => titan.uid === 't-invisible-ninja-start-stale'
                    ? { ...titan, location: { zone: 'setaside' } }
                    : titan),
            },
        };

        const resolved = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: destroyOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_REMOVED_FROM_PLAY)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(0);
        expect((resolved.finalState.core.titans ?? []).find(titan => titan.uid === 't-invisible-ninja-start-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(1);
    });

    it('titan_ninjas_invisible_ninja_ongoing 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 抽牌、洗回剩余揭示牌或写 metadata', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('ninja-stale-draw-a', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('ninja-stale-draw-b', 'ghosts_spectre', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase(),
                makeBase({
                    minions: [makeMinion('enemy-victim-stale', 'pirate_first_mate', '1', 2)],
                }),
            ],
            titans: [{
                uid: 't-invisible-ninja-stale',
                defId: 'ninjas_invisible_ninja',
                faction: SMASHUP_FACTION_IDS.NINJAS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const matchState = makeMatchState(core, 'playCards', '0');
        const destroyEvent: SmashUpEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'enemy-victim-stale',
                minionDefId: 'pirate_first_mate',
                fromBaseIndex: 1,
                ownerId: '1',
                destroyerId: '0',
                reason: 'invisible_ninja_stale_source',
            },
            timestamp: 202,
        };

        const processed = processDestroyTriggers([destroyEvent], matchState, '0', FIXED_RANDOM, 202);
        let reactionState = processed.matchState ?? matchState;
        let currentInteraction = getInteractionsFromMS(reactionState)[0] as any;

        if (!currentInteraction) {
            const reactionResult = maybeResolveReactionQueue(reactionState, FIXED_RANDOM, 202);
            reactionState = reactionResult?.state ?? reactionState;
            currentInteraction = getInteractionsFromMS(reactionState)[0] as any;
        }

        if (currentInteraction?.data?.sourceId === 'smashup_reaction_choose') {
            const queueById = new Map(reactionState.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
            const ninjaOption = currentInteraction.data.options.find((option: any) => {
                const trigger = queueById.get(option.value?.triggerId) as any;
                return trigger?.sourceDefId === 'ninjas_invisible_ninja';
            }) ?? currentInteraction.data.options[0];

            const afterChooseTrigger = runCommand(
                reactionState,
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: ninjaOption.id } } as any,
                FIXED_RANDOM,
            );
            reactionState = afterChooseTrigger.finalState;
            currentInteraction = getInteractionsFromMS(reactionState)[0] as any;
        }

        expect(currentInteraction?.data?.sourceId).toBe('titan_ninjas_invisible_ninja_ongoing');
        const drawOption = currentInteraction.data.options.find((option: any) => option.value?.cardUid === 'ninja-stale-draw-a')
            ?? currentInteraction.data.options[0];

        const staleState: MatchState<SmashUpCore> = {
            ...reactionState,
            core: {
                ...reactionState.core,
                titans: (reactionState.core.titans ?? []).map(titan => titan.uid === 't-invisible-ninja-stale'
                    ? { ...titan, location: { zone: 'setaside' } }
                    : titan),
            },
        };

        const afterDraw = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: drawOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(afterDraw.success).toBe(true);
        expect(afterDraw.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        expect(afterDraw.events.filter(event => event.type === SU_EVENTS.DECK_REORDERED)).toHaveLength(0);
        expect(afterDraw.events.filter(event => event.type === SU_EVENTS.TITAN_METADATA_UPDATED)).toHaveLength(0);
        expect(afterDraw.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([]);
        expect(afterDraw.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['ninja-stale-draw-a', 'ninja-stale-draw-b']);
        expect((afterDraw.finalState.core.titans ?? []).find(titan => titan.uid === 't-invisible-ninja-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
    });

    it('titan_ninjas_invisible_ninja_special 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 弃牌或进场', () => {
        const initialState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ninja-special-discard', 'wizard_summon', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.NINJAS, SMASHUP_FACTION_IDS.WIZARDS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_jungle',
                minions: [makeMinion('ninja-special-host', 'ninja_tiger_assassin', '0', 4)],
                ongoingActions: [],
            })],
            titans: [{
                uid: 't-invisible-ninja-special-stale',
                defId: 'ninjas_invisible_ninja',
                faction: SMASHUP_FACTION_IDS.NINJAS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
                metadata: {
                    invisibleNinjaStartTurn: 1,
                    invisibleNinjaWasInPlayAtStart: false,
                },
            } satisfies TitanState],
        }));

        const activated = runCommand(initialState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-invisible-ninja-special-stale', baseIndex: 0 },
            timestamp: 203,
        } as any, FIXED_RANDOM);
        expect(activated.success).toBe(true);

        const specialPrompt = getInteractionsFromMS(activated.finalState)[0] as any;
        expect(specialPrompt?.data?.sourceId).toBe('titan_ninjas_invisible_ninja_special');
        const discardOption = findInteractionOption(
            specialPrompt,
            entry => entry?.value?.cardUid === 'ninja-special-discard',
        );
        expect(discardOption).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...activated.finalState,
            core: {
                ...activated.finalState.core,
                titans: (activated.finalState.core.titans ?? []).map(titan => titan.uid === 't-invisible-ninja-special-stale'
                    ? { ...titan, location: { zone: 'base', baseIndex: 0, enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: discardOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_PLAYED)).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('ninja-special-discard');
        expect((resolved.finalState.core.titans ?? []).find(titan => titan.uid === 't-invisible-ninja-special-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
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

    it('titan_ignobles_the_hill_that_strolls_counter 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 给随从加标记', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('hill-give-stale-target', 'ghosts_spectre', '0', 2)],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-hill-stale',
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
                    deck: [makeCard('hill-draw-card-stale', 'ghosts_spectre', 'minion')],
                }),
                '1': makePlayer('1'),
            },
        });

        const state = makeMatchState(core, 'playCards', '0');
        const giveMinionHandler = getInteractionHandler('titan_ignobles_the_hill_that_strolls_give_minion');
        expect(giveMinionHandler).toBeDefined();

        const talentCommand: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-hill-stale', baseIndex: 1 },
            timestamp: 110,
        };
        expect(SmashUpDomain.validate(state, talentCommand).valid).toBe(true);

        SmashUpDomain.execute(state, talentCommand, FIXED_RANDOM);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_ignobles_the_hill_that_strolls_give_minion');

        const giveResult = giveMinionHandler!(
            state,
            '0',
            { minionUid: 'hill-give-stale-target', baseIndex: 0, defId: 'ghosts_spectre' },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            111,
        );
        const giveResolvedCore = giveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        const cleanTriggerState = makeMatchState(giveResolvedCore, 'playCards', '0');
        const affectResult = processAffectTriggers(
            giveResult.events,
            cleanTriggerState,
            '0',
            FIXED_RANDOM,
            111,
        );
        const queuedCore = affectResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            giveResolvedCore,
        );
        const queuedState = { ...(affectResult.matchState ?? cleanTriggerState), core: queuedCore };
        const reactionResult = maybeResolveReactionQueue(queuedState, FIXED_RANDOM, 111);
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

        const staleState: MatchState<SmashUpCore> = {
            ...reactionState,
            core: {
                ...reactionState.core,
                titans: (reactionState.core.titans ?? []).map(titan => titan.uid === 't-hill-stale'
                    ? { ...titan, location: { zone: 'setaside' } }
                    : titan),
            },
        };

        const resolved = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'place' } } as any,
            FIXED_RANDOM,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toHaveLength(0);
        const transferredMinion = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'hill-give-stale-target');
        expect(transferredMinion?.controller).toBe('1');
        expect(transferredMinion?.powerCounters ?? 0).toBe(0);
        expect((resolved.finalState.core.titans ?? []).find(candidate => candidate.uid === 't-hill-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
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

    it('titan_time_travelers_time_box_play 的 source titan 若在响应前失去第 5 枚计数进场资格，不应继续沿旧 prompt 进场或清零计数', () => {
        const core = makeState({
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-time-box-stale',
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
            now: 114,
        });

        const currentInteraction = triggerResult.matchState?.sys.interaction?.current;
        expect(currentInteraction?.data?.sourceId).toBe('titan_time_travelers_time_box_play');

        const afterCounterCore = triggerResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        const handler = getInteractionHandler('titan_time_travelers_time_box_play');
        expect(handler).toBeDefined();

        const staleCore: SmashUpCore = {
            ...afterCounterCore,
            titans: (afterCounterCore.titans ?? []).map(titan => titan.uid === 't-time-box-stale'
                ? {
                    ...titan,
                    metadata: {
                        ...titan.metadata,
                        timeBoxCounters: 4,
                        timeBoxPlayArmed: false,
                    },
                }
                : titan),
        };
        const staleState: MatchState<SmashUpCore> = {
            ...(triggerResult.matchState ?? makeMatchState(core)),
            core: staleCore,
        };
        const resolved = handler!(
            staleState,
            '0',
            { baseIndex: 1, baseDefId: core.bases[1].defId },
            currentInteraction?.data as any,
            FIXED_RANDOM,
            115,
        );
        expect(resolved.events.filter(event =>
            event.type === SU_EVENTS.TITAN_PLAYED || event.type === SU_EVENTS.TITAN_METADATA_UPDATED)).toHaveLength(0);
        expect((resolved.state.core.titans ?? []).find(candidate => candidate.uid === 't-time-box-stale')).toMatchObject({
            location: { zone: 'setaside' },
            metadata: { timeBoxCounters: 4, timeBoxPlayArmed: false },
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

    it('borrowed 三号空间站 special 也应按当前控制者而不是真实 owner 判断合法基地并保留真实 owner', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('moon-borrowed-friendly', 'pirate_first_mate', '0', 2, { owner: '1' })],
                }),
                makeBase({
                    minions: [makeMinion('moon-enemy-controlled', 'robot_microbot_guard', '1', 1, { owner: '0' })],
                }),
            ],
            titans: [{
                uid: 't-moon-borrowed-setaside',
                defId: 'super_spies_moon_zero_three',
                faction: SMASHUP_FACTION_IDS.SUPER_SPIES,
                ownerId: '1',
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
            payload: { titanUid: 't-moon-borrowed-setaside', baseIndex: 0 },
            timestamp: 1181,
        };
        const invalidCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-moon-borrowed-setaside', baseIndex: 1 },
            timestamp: 1182,
        };

        expect(SmashUpDomain.validate(state, validCommand).valid).toBe(true);
        expect(SmashUpDomain.validate(state, invalidCommand)).toMatchObject({
            valid: false,
            error: expect.stringMatching(/Moon Zero Three|三号空间站|other players minions/i),
        });

        const events = SmashUpDomain.execute(state, validCommand, FIXED_RANDOM);
        expect(events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TITAN_PLAYED,
            payload: expect.objectContaining({
                titanUid: 't-moon-borrowed-setaside',
                ownerId: '1',
                controllerId: '0',
                baseIndex: 0,
            }),
        }));

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(resolved.titans?.find(candidate => candidate.uid === 't-moon-borrowed-setaside')).toMatchObject({
            ownerId: '1',
            controllerId: '0',
            location: { zone: 'base', baseIndex: 0 },
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

    it('titan_super_spies_moon_zero_three_choose_player 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 查看牌库顶', () => {
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
                uid: 't-moon-stale',
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
            payload: { titanUid: 't-moon-stale', baseIndex: 0 },
            timestamp: 125,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(commandEvents.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('titan_super_spies_moon_zero_three_choose_player');

        const choosePlayerHandler = getInteractionHandler('titan_super_spies_moon_zero_three_choose_player');
        expect(choosePlayerHandler).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...state,
            core: {
                ...state.core,
                titans: (state.core.titans ?? []).map(titan => titan.uid === 't-moon-stale'
                    ? { ...titan, location: { zone: 'setaside', enteredAt: 1 } }
                    : titan),
            },
        };

        const chooseResult = choosePlayerHandler!(
            staleState,
            '0',
            { targetPlayerId: '1' },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            126,
        );
        expect(chooseResult.events.filter(event => event.type === SU_EVENTS.DECK_INSPECTED)).toHaveLength(0);
        expect(chooseResult.state.sys.interaction?.queue?.some(interaction => interaction?.data?.sourceId === 'titan_super_spies_moon_zero_three_resolve')).toBe(false);
        expect((chooseResult.state.core.titans ?? []).find(candidate => candidate.uid === 't-moon-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
    });

    it('三号空间站天赋查看 borrowed 牌库顶并放到底部时，应进入其拥有者牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('p0-deck-a', 'ghosts_spectre', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('borrowed-moon-top', 'robot_microbot_guard', 'minion', '0'),
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

        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
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
        const queuedResolveInteraction = chooseResult.state.sys.interaction?.queue?.at(-1);
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
        const afterResolve = resolveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            afterChoose,
        );

        expect(afterResolve.players['0'].deck.map(card => card.uid)).toEqual(['p0-deck-a', 'borrowed-moon-top']);
        expect(afterResolve.players['1'].deck.map(card => card.uid)).toEqual(['moon-target-next']);
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

    it('titan_mega_troopers_megabot_move 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 移动泰坦', () => {
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
                uid: 't-megabot-stale',
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
            now: 101,
        });

        const currentInteraction = triggerResult.matchState?.sys.interaction?.current;
        expect(currentInteraction?.data?.sourceId).toBe('titan_mega_troopers_megabot_move');
        expect(currentInteraction?.playerId).toBe('0');

        const handler = getInteractionHandler('titan_mega_troopers_megabot_move');
        expect(handler).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...(triggerResult.matchState as MatchState<SmashUpCore>),
            core: {
                ...(triggerResult.matchState as MatchState<SmashUpCore>).core,
                titans: (((triggerResult.matchState as MatchState<SmashUpCore>).core.titans) ?? []).map(titan => titan.uid === 't-megabot-stale'
                    ? { ...titan, location: { zone: 'setaside', enteredAt: 1 } }
                    : titan),
            },
        };

        const moveResult = handler!(
            staleState,
            '0',
            { move: true },
            currentInteraction?.data as any,
            FIXED_RANDOM,
            102,
        );

        expect(moveResult.events.filter(event => event.type === SU_EVENTS.TITAN_MOVED)).toHaveLength(0);
        expect((moveResult.state.core.titans ?? []).find(candidate => candidate.uid === 't-megabot-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
    });

    it('cowboys_sheriff 在其他玩家的计分前触发时，决斗选择权仍应交给 Sheriff 控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_saloon',
                minions: [
                    makeMinion('sheriff-1', 'cowboys_sheriff', '0', 5),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2),
                ],
            })],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'sheriff-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            rankings: [
                { playerId: '1', power: 7, vp: 3 },
                { playerId: '0', power: 5, vp: 2 },
            ],
            random: FIXED_RANDOM,
            now: 100,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('cowboys_sheriff');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            FIXED_RANDOM,
            100,
        );
        const prompt = getInteractionsFromMS(prompted?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
        expect(prompt?.playerId).toBe('0');
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

    it('titan_penguins_emperor_penguin_play 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 进场', () => {
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
                uid: 't-emperor-stale',
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
            now: 103,
        });
        const prompt = triggerResult.matchState?.sys.interaction?.current as any;
        expect(prompt?.data?.sourceId).toBe('titan_penguins_emperor_penguin_play');

        const handler = getInteractionHandler('titan_penguins_emperor_penguin_play');
        expect(handler).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...triggerResult.matchState!,
            core: {
                ...triggerResult.matchState!.core,
                titans: (triggerResult.matchState!.core.titans ?? []).map(titan => titan.uid === 't-emperor-stale'
                    ? { ...titan, location: { zone: 'base', baseIndex: 1, enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = handler!(
            staleState,
            '0',
            { baseIndex: 0, baseDefId: core.bases[0].defId },
            prompt?.data as any,
            FIXED_RANDOM,
            104,
        );
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_PLAYED)).toHaveLength(0);
        expect((resolved.state.core.titans ?? []).find(candidate => candidate.uid === 't-emperor-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
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

    it('titan_penguins_emperor_penguin_talent 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 洗牌或给泰坦加标记', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('penguin-hand-minion-stale', 'pirate_first_mate', 'minion', '0')],
                    deck: [makeCard('penguin-existing-deck-stale', 'robot_microbot_guard', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-emperor-talent-stale',
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
            payload: { titanUid: 't-emperor-talent-stale', baseIndex: 0 },
            timestamp: 1061,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        const promptData = state.sys.interaction?.current?.data as any;
        expect(promptData?.sourceId).toBe('titan_penguins_emperor_penguin_talent');

        const handler = getInteractionHandler('titan_penguins_emperor_penguin_talent');
        expect(handler).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...state,
            core: {
                ...state.core,
                titans: (state.core.titans ?? []).map(titan => titan.uid === 't-emperor-talent-stale'
                    ? { ...titan, location: { zone: 'setaside' } }
                    : titan),
            },
        };

        const resolved = handler!(
            staleState,
            '0',
            { cardUid: 'penguin-hand-minion-stale', defId: 'pirate_first_mate', zone: 'hand' },
            promptData,
            FIXED_RANDOM,
            1062,
        );

        expect(resolved.events.filter(event => event.type === SU_EVENTS.REVEAL_HAND)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.CARD_TO_DECK_TOP)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.DECK_REORDERED)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_POWER_COUNTER_ADDED)).toHaveLength(0);

        const afterCommand = commandEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        const finalCore = resolved.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            afterCommand,
        );
        expect(finalCore.players['0'].hand.map(card => card.uid)).toContain('penguin-hand-minion-stale');
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['penguin-existing-deck-stale']);
        expect((resolved.state.core.titans ?? []).find(titan => titan.uid === 't-emperor-talent-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
    });

    it('第二只 Emperor Penguin 打开的天赋 prompt 结算时，应给 continuationContext.titanUid 那只加标记，而不是第一只 live titan', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('penguin-hand-minion-b', 'pirate_first_mate', 'minion', '0')],
                    deck: [makeCard('penguin-existing-deck-b', 'robot_microbot_guard', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
            titans: [
                {
                    uid: 't-emperor-a',
                    defId: 'penguins_emperor_penguin',
                    faction: SMASHUP_FACTION_IDS.PENGUINS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } satisfies TitanState,
                {
                    uid: 't-emperor-b',
                    defId: 'penguins_emperor_penguin',
                    faction: SMASHUP_FACTION_IDS.PENGUINS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 2 },
                } satisfies TitanState,
            ],
        });

        const state = makeMatchState(core);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-emperor-b', baseIndex: 1 },
            timestamp: 1051,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        const promptData = state.sys.interaction?.current?.data as any;
        expect(promptData?.sourceId).toBe('titan_penguins_emperor_penguin_talent');
        expect(promptData?.continuationContext?.titanUid).toBe('t-emperor-b');

        const handler = getInteractionHandler('titan_penguins_emperor_penguin_talent');
        expect(handler).toBeDefined();

        const resolved = handler!(
            state,
            '0',
            { cardUid: 'penguin-hand-minion-b', defId: 'pirate_first_mate', zone: 'hand' },
            promptData,
            FIXED_RANDOM,
            1052,
        );

        const afterCommand = commandEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        const finalCore = resolved.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            afterCommand,
        );

        expect(finalCore.titans?.find(candidate => candidate.uid === 't-emperor-a')?.powerCounters).toBe(0);
        expect(finalCore.titans?.find(candidate => candidate.uid === 't-emperor-b')?.powerCounters).toBe(1);
    });

    it('企鹅帝皇天赋选择被他人拥有的 borrowed 手牌随从时，仍应洗回其拥有者牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('penguin-borrowed-minion', 'pirate_first_mate', 'minion', '1')],
                    deck: [makeCard('penguin-existing-deck-0', 'robot_microbot_guard', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('penguin-existing-deck-1', 'ghosts_spectre', 'minion', '1')],
                }),
            },
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-emperor-borrowed',
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
            payload: { titanUid: 't-emperor-borrowed', baseIndex: 0 },
            timestamp: 107,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        const handler = getInteractionHandler('titan_penguins_emperor_penguin_talent');
        expect(handler).toBeDefined();

        const resolved = handler!(
            state,
            '0',
            { cardUid: 'penguin-borrowed-minion', defId: 'pirate_first_mate', zone: 'hand' },
            state.sys.interaction?.current?.data as any,
            FIXED_RANDOM,
            108,
        );

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_TOP,
            payload: expect.objectContaining({
                cardUid: 'penguin-borrowed-minion',
                ownerId: '1',
                sourcePlayerId: '0',
            }),
        }));
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({
                playerId: '1',
                sourcePlayerId: '0',
            }),
        }));

        const afterCommand = commandEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        const finalCore = resolved.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            afterCommand,
        );
        expect(finalCore.players['0'].hand.map(card => card.uid)).not.toContain('penguin-borrowed-minion');
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['penguin-existing-deck-0']);
        expect(finalCore.players['1'].deck.map(card => card.uid)).toEqual(
            expect.arrayContaining(['penguin-existing-deck-1', 'penguin-borrowed-minion']),
        );
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

    it('titan_pirates_the_kraken_choose_minion 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 进入目标基地选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('kraken-save-target-smoke', 'robot_microbot_alpha', '0', 2)],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                }),
            ],
            titans: [{
                uid: 'kraken-first-stale-smoke',
                defId: 'pirates_the_kraken',
                faction: SMASHUP_FACTION_IDS.PIRATES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', rank: 1, points: 3 }],
            random: FIXED_RANDOM,
            now: 79,
        }) as any;
        const chooseMinionPrompt = getInteractionsFromMS(triggered.matchState)[0] as any;
        expect(chooseMinionPrompt?.data?.sourceId).toBe('titan_pirates_the_kraken_choose_minion');
        const minionOption = chooseMinionPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'kraken-save-target-smoke');
        expect(minionOption).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...triggered.matchState,
            core: {
                ...triggered.matchState.core,
                titans: (triggered.matchState.core.titans ?? []).map(titan => titan.uid === 'kraken-first-stale-smoke'
                    ? { ...titan, location: { zone: 'setaside', enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: minionOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(getInteractionsFromMS(resolved.finalState).find((interaction: any) => interaction?.data?.sourceId === 'titan_pirates_the_kraken_choose_base')).toBeUndefined();
        expect(resolved.events.filter(event => event.type === SU_EVENTS.MINION_MOVED)).toHaveLength(0);
        expect(resolved.finalState.core.bases[0]?.minions.some(minion => minion.uid === 'kraken-save-target-smoke')).toBe(true);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'kraken-first-stale-smoke')?.location).toMatchObject({
            zone: 'setaside',
        });
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
        let stateAfterChooseFirstMateTrigger = firstPrompt!.state;
        if (firstPrompt?.state.sys.interaction.current?.data?.sourceId === 'smashup_reaction_choose') {
            const firstQueueById = new Map(firstPrompt.state.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
            const firstMateOption = (firstPrompt.state.sys.interaction.current as any).data.options.find((option: any) => {
                const trigger = firstQueueById.get(option.value.triggerId) as any;
                return trigger?.sourceDefId === 'pirate_first_mate';
            }) ?? (firstPrompt.state.sys.interaction.current as any).data.options[0];

            const afterChooseFirstMateTrigger = runCommand(
                firstPrompt.state,
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: firstMateOption.id } } as any,
                FIXED_RANDOM,
            );
            stateAfterChooseFirstMateTrigger = afterChooseFirstMateTrigger.finalState;
        }

        const firstMatePrompt = getInteractionsFromMS(stateAfterChooseFirstMateTrigger)[0] as any;
        expect(firstMatePrompt?.data?.sourceId).toBe('pirate_first_mate_choose_base');

        const moveMateOption = firstMatePrompt.data.options.find((option: any) => option.value?.baseIndex === 1)
            ?? firstMatePrompt.data.options.find((option: any) => option.value?.baseIndex === 2)
            ?? firstMatePrompt.data.options[0];

        const afterMoveFirstMate = runCommand(
            stateAfterChooseFirstMateTrigger,
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

        const baseRef = createScoringBaseRef(core, 0);
        if (!baseRef) {
            throw new Error('无法构造海怪克拉肯替换基地 scoring base ref');
        }

        let state = makeMatchState(core, 'scoreBases', '0');
        state = setScoringSession(state, {
            ...createScoringSession(core, [0]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-interactions',
        });
        state = appendScoringFrameDeferredPayload(state, {
            deferredEvents: [
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
        });
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
                        },
                    },
                },
                timestamp: 75,
            } as any],
            random: FIXED_RANDOM,
        }) as any;

        const emittedEvents = hook?.events ?? [];
        expect(emittedEvents).toEqual([]);
        expect(hook?.state?.sys?.interaction?.current).toBeFalsy();

        const finalize = smashUpFlowHooks.onPhaseExit?.({
            state: hook?.state ?? state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined } as any,
            random: FIXED_RANDOM,
        });
        const finalizeEvents = Array.isArray(finalize) ? finalize : (finalize as any)?.events ?? [];
        expect(finalizeEvents.map((event: SmashUpEvent) => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
            SU_EVENTS.TITAN_PLAYED,
        ]);

        const finalCore = finalizeEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            (hook?.state ?? state).core,
        );
        const kraken = (finalCore.titans ?? []).find(candidate => candidate.uid === 't-kraken-setaside');

        expect(kraken?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(finalCore.bases[0].defId).toBe('base_factory_436-1337');
    });

    it('titan_pirates_the_kraken_play_replacement 的 source titan 若在响应前已离开牌库旁，不应继续预约替换基地进场', () => {
        const core = makeState({
            bases: [makeBase({ defId: 'base_the_homeworld' })],
            titans: [{
                uid: 't-kraken-replacement-stale',
                defId: 'pirates_the_kraken',
                faction: SMASHUP_FACTION_IDS.PIRATES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const handler = getInteractionHandler('titan_pirates_the_kraken_play_replacement');
        expect(handler).toBeDefined();

        const baseRef = createScoringBaseRef(core, 0);
        if (!baseRef) {
            throw new Error('无法构造 Kraken stale replacement scoring base ref');
        }

        let state = makeMatchState(core, 'scoreBases', '0');
        state = setScoringSession(state, {
            ...createScoringSession(core, [0]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-interactions',
        });
        state = appendScoringFrameDeferredPayload(state, {
            deferredEvents: [{
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: 0,
                    oldBaseDefId: core.bases[0].defId,
                    newBaseDefId: 'base_factory_436-1337',
                },
                timestamp: 76,
            }],
        });

        const staleState: ReturnType<typeof makeMatchState> = {
            ...state,
            core: {
                ...state.core,
                titans: (state.core.titans ?? []).map(titan => titan.uid === 't-kraken-replacement-stale'
                    ? { ...titan, location: { zone: 'base', baseIndex: 0, enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = handler!(
            staleState,
            '0',
            { play: true },
            {
                sourceId: 'titan_pirates_the_kraken_play_replacement',
                continuationContext: {
                    titanUid: 't-kraken-replacement-stale',
                    titanDefId: 'pirates_the_kraken',
                    ownerId: '0',
                    controllerId: '0',
                    scoringBaseIndex: 0,
                },
            } as any,
            FIXED_RANDOM,
            76,
        );

        const consumed = consumeScoringFrameDeferredPayload(resolved.state);
        expect(consumed.deferredActions).toEqual([]);
        expect((resolved.state.core.titans ?? []).find(titan => titan.uid === 't-kraken-replacement-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('活动泰坦静态契约与当前已接入范围保持一致', () => {
        const currentTitanIds = TITAN_CARD_DEFS.map(def => def.id);
        expect(currentTitanIds).toEqual([
            'dinosaurs_fort_titanosaurus',
            'ninjas_invisible_ninja',
            'bear_cavalry_major_ursa',
            'ghosts_creampuff_man',
            'fairies_spirit_of_the_forest',
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
        expect(TITAN_CARD_DEFS).toHaveLength(27);
        expect(getTitanDef('fairies_spirit_of_the_forest')?.abilityTags).toEqual(['special', 'ongoing']);
        expect(getTitanDef('fairies_spirit_of_the_forest')?.previewRef).toEqual({
            type: 'atlas',
            atlasId: 'smashup:titans',
            index: 3,
        });
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

    it('世界冠军 cards7 图集索引应与 wangling 图集中的实际卡面一致', () => {
        expect(getCardDef('world_champs_rainbow_girl')?.previewRef).toEqual({
            type: 'atlas',
            atlasId: 'smashup:cards7',
            index: 24,
        });
        expect(getCardDef('world_champs_samurai_chan')?.previewRef).toEqual({
            type: 'atlas',
            atlasId: 'smashup:cards7',
            index: 27,
        });
        expect(getCardDef('world_champs_akye_the_turtle')?.previewRef).toEqual({
            type: 'atlas',
            atlasId: 'smashup:cards7',
            index: 29,
        });
        expect(getCardDef('world_champs_stoneford')?.previewRef).toEqual({
            type: 'atlas',
            atlasId: 'smashup:cards7',
            index: 31,
        });
        expect(getCardDef('world_champs_sheriff')?.previewRef).toEqual({
            type: 'atlas',
            atlasId: 'smashup:cards7',
            index: 33,
        });
        expect(getCardDef('world_champs_high_speed_chase')?.previewRef).toEqual({
            type: 'atlas',
            atlasId: 'smashup:cards7',
            index: 43,
        });
    });

    it('世界冠军关键中文卡名应与当前卡图重录口径一致', () => {
        expect(getCardDef('world_champs_calicoin')?.name).toBe('金币猫');
        expect(getCardDef('world_champs_samurai_chan')?.name).toBe('武士 陈');
        expect(getCardDef('world_champs_stoneford')?.name).toBe('斯坦福');
        expect(getCardDef('world_champs_sheriff')?.name).toBe('警长');
        expect(getCardDef('world_champs_bewitched')?.name).toBe('着魔');
        expect(getCardDef('world_champs_mouse_bird_and_sausage')?.name).toBe('老鼠、鸟和香肠');
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

    it('titan_frankenstein_the_bride_start_choose_target 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 结算首个效果或进入后续分支', () => {
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

        const branchHandler = getInteractionHandler('titan_frankenstein_the_bride_start_choose_branch');
        const targetHandler = getInteractionHandler('titan_frankenstein_the_bride_start_choose_target');
        expect(branchHandler).toBeDefined();
        expect(targetHandler).toBeDefined();

        const triggerResult = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 127,
        });

        const branchPrompt = triggerResult.matchState?.sys.interaction?.current as any;
        expect(branchPrompt?.data?.sourceId).toBe('titan_frankenstein_the_bride_start_choose_branch');

        const chooseBranchResult = branchHandler!(
            triggerResult.matchState!,
            '0',
            { kind: 'destroy' },
            branchPrompt?.data,
            FIXED_RANDOM,
            128,
        );
        const targetPrompt = chooseBranchResult.state.sys.interaction?.queue?.[0] as any;
        expect(targetPrompt?.data?.sourceId).toBe('titan_frankenstein_the_bride_start_choose_target');

        const staleState: MatchState<SmashUpCore> = {
            ...chooseBranchResult.state,
            core: {
                ...chooseBranchResult.state.core,
                titans: (chooseBranchResult.state.core.titans ?? []).map(titan => titan.uid === 'bride-1'
                    ? { ...titan, location: { zone: 'base', baseIndex: 0, enteredAt: 1 } }
                    : titan),
            },
        };
        const chooseTargetResult = targetHandler!(
            staleState,
            '0',
            { kind: 'destroy', targetUid: 'ally-1', defId: 'frankenstein_igor', baseIndex: 0 },
            targetPrompt?.data,
            FIXED_RANDOM,
            129,
        );

        expect(chooseTargetResult.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
        expect(chooseTargetResult.state.sys.interaction?.queue?.some(interaction =>
            interaction?.data?.sourceId === 'titan_frankenstein_the_bride_start_choose_branch'
            || interaction?.data?.sourceId === 'titan_frankenstein_the_bride_start_choose_base')).toBe(false);
        expect((chooseTargetResult.state.core.bases[0]?.minions ?? []).map(minion => minion.uid)).toContain('ally-1');
        expect((chooseTargetResult.state.core.titans ?? []).find(titan => titan.uid === 'bride-1')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('titan_frankenstein_the_bride_start_choose_branch 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 进入目标选择', () => {
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
                uid: 'bride-branch-stale',
                defId: 'frankenstein_the_bride',
                faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const branchHandler = getInteractionHandler('titan_frankenstein_the_bride_start_choose_branch');
        expect(branchHandler).toBeDefined();

        const triggerResult = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 130,
        });
        const branchPrompt = triggerResult.matchState?.sys.interaction?.current as any;
        expect(branchPrompt?.data?.sourceId).toBe('titan_frankenstein_the_bride_start_choose_branch');

        const staleState: MatchState<SmashUpCore> = {
            ...triggerResult.matchState!,
            core: {
                ...triggerResult.matchState!.core,
                titans: (triggerResult.matchState!.core.titans ?? []).map(titan => titan.uid === 'bride-branch-stale'
                    ? { ...titan, location: { zone: 'base', baseIndex: 0, enteredAt: 1 } }
                    : titan),
            },
        };

        const chooseBranchResult = branchHandler!(
            staleState,
            '0',
            { kind: 'destroy' },
            branchPrompt?.data,
            FIXED_RANDOM,
            131,
        );
        expect(chooseBranchResult.events).toEqual([]);
        expect(chooseBranchResult.state.sys.interaction?.queue?.some(interaction =>
            interaction?.data?.sourceId === 'titan_frankenstein_the_bride_start_choose_target')).toBe(false);
        expect((chooseBranchResult.state.core.titans ?? []).find(titan => titan.uid === 'bride-branch-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('titan_frankenstein_the_bride_start_choose_base 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 进场', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_the_factory' }), makeBase()],
            titans: [{
                uid: 'bride-base-stale',
                defId: 'frankenstein_the_bride',
                faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const handler = getInteractionHandler('titan_frankenstein_the_bride_start_choose_base');
        expect(handler).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...makeMatchState(core, 'startTurn', '0'),
            core: {
                ...core,
                titans: (core.titans ?? []).map(titan => titan.uid === 'bride-base-stale'
                    ? { ...titan, location: { zone: 'base', baseIndex: 0, enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = handler!(
            staleState,
            '0',
            { baseIndex: 1, baseDefId: core.bases[1].defId },
            { continuationContext: { titanUid: 'bride-base-stale', titanDefId: 'frankenstein_the_bride' } } as any,
            FIXED_RANDOM,
            132,
        );
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_PLAYED)).toHaveLength(0);
        expect((resolved.state.core.titans ?? []).find(titan => titan.uid === 'bride-base-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('The Bride 仅在己方随从新增 +1 指示物时抽牌，且同回合只触发一次', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.ALIENS],
                    deck: [makeCard('bride-draw-card-1', 'frankenstein_igor', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_factory',
                minions: [makeMinion('bride-target-1', 'robot_zapbot', '0', 2)],
                ongoingActions: [],
            })],
            titans: [{
                uid: 'bride-ongoing-1',
                defId: 'frankenstein_the_bride',
                faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0 },
            } satisfies TitanState],
            turnNumber: 5,
        });

        const triggerMinion = core.bases[0].minions.find(minion => minion.uid === 'bride-target-1');
        expect(triggerMinion).toBeDefined();

        const removed = fireTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '0'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'bride-target-1',
            triggerMinionDefId: triggerMinion!.defId,
            triggerMinion,
            affectType: 'power_change',
            counterChangeKind: 'removed',
            counterDelta: -1,
            reason: 'test_removed_counter',
            random: FIXED_RANDOM,
            now: 200,
        });
        expect(removed.events).toEqual([]);

        const first = fireTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '0'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'bride-target-1',
            triggerMinionDefId: triggerMinion!.defId,
            triggerMinion,
            affectType: 'power_change',
            counterChangeKind: 'added',
            counterDelta: 1,
            reason: 'frankenstein_uberserum_pod',
            random: FIXED_RANDOM,
            now: 201,
        });
        expect(first.events.map(event => event.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.TITAN_METADATA_UPDATED,
            SU_EVENTS.CARDS_DRAWN,
        ]));
        const drawEvent = first.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as CardsDrawnEvent | undefined;
        expect(drawEvent?.payload.playerId).toBe('0');

        const coreAfterFirst = first.events.reduce(
            (acc, event) => SmashUpDomain.reduce(acc, event),
            core,
        );
        const second = fireTriggers(coreAfterFirst, 'onMinionAffected', {
            state: coreAfterFirst,
            matchState: makeMatchState(coreAfterFirst, 'playCards', '0'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'bride-target-1',
            triggerMinionDefId: triggerMinion!.defId,
            triggerMinion: coreAfterFirst.bases[0].minions.find(minion => minion.uid === 'bride-target-1'),
            affectType: 'power_change',
            counterChangeKind: 'added',
            counterDelta: 1,
            reason: 'frankenstein_uberserum_pod',
            random: FIXED_RANDOM,
            now: 202,
        });
        expect(second.events).toEqual([]);
    });

    it('身体改造在回合开始给己方随从加指示物时应触发 The Bride 抽 1（线上反馈 69ec35a1）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'frankenstein_jolt_pod', 'action', '0')],
                    hand: [],
                    discard: [],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_great_library',
                minions: [{
                    ...makeMinion('locals-1', 'innsmouth_the_locals_pod', '0', 2),
                    powerCounters: 0,
                    attachedActions: [{
                        uid: 'attach-uberserum',
                        defId: 'frankenstein_uberserum_pod',
                        ownerId: '0',
                        talentUsed: false,
                    }],
                }],
                ongoingActions: [],
            })],
            titans: [{
                uid: 'bride-live-1',
                defId: 'frankenstein_the_bride',
                faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0 },
            } satisfies TitanState],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 7,
        });
        const matchState = makeMatchState(core, 'startTurn', '0');
        const queuedTurnStart = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState,
            playerId: '0',
            frameId: 'test-turn-start-uberserum',
            sourceEventId: 'test-turn-start-uberserum',
            random: FIXED_RANDOM,
            now: 901,
        });
        expect(queuedTurnStart).toBeDefined();

        const coreWithQueued = SmashUpDomain.reduce(core, queuedTurnStart as SmashUpEvent);
        const post = postProcessSystemEvents(
            coreWithQueued,
            [queuedTurnStart as SmashUpEvent],
            FIXED_RANDOM,
            makeMatchState(coreWithQueued, 'startTurn', '0'),
        );
        const runReactionChain = (preferSourceDefId: 'frankenstein_uberserum' | 'frankenstein_the_bride') => {
            const interactionResult = post.matchState
                ? resolveInteractionChain(post.matchState, (prompt) => {
                    const sourceId = prompt?.data?.sourceId as string | undefined;
                    if (sourceId === 'smashup_reaction_choose') {
                        const options = prompt?.data?.options ?? [];
                        const preferredTrigger = options.find((option: any) =>
                            option?.value?.kind === 'trigger'
                            && String(option?.value?.triggerId ?? '').includes(preferSourceDefId),
                        );
                        const genericTrigger = options.find((option: any) => option?.value?.kind === 'trigger');
                        const fallback = preferredTrigger ?? genericTrigger ?? options[0];
                        return { optionId: fallback.id };
                    }
                    return { optionId: prompt?.data?.options?.[0]?.id };
                }, FIXED_RANDOM)
                : { finalState: makeMatchState(coreWithQueued, 'startTurn', '0'), events: [] };

            const allEvents = [...post.events, ...interactionResult.events] as SmashUpEvent[];
            const cardsDrawnEvents = allEvents.filter(event => event.type === SU_EVENTS.CARDS_DRAWN) as CardsDrawnEvent[];
            const brideDraw = cardsDrawnEvents.find(event => event.payload.playerId === '0' && event.payload.count === 1);
            expect(brideDraw).toBeDefined();

            const resolved = allEvents.reduce((acc, event) => SmashUpDomain.reduce(acc, event), coreWithQueued);
            const localsAfter = resolved.bases[0]?.minions.find(minion => minion.uid === 'locals-1');
            expect(localsAfter?.powerCounters).toBe(1);
        };

        runReactionChain('frankenstein_uberserum');
        runReactionChain('frankenstein_the_bride');
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
            valid: false,
        });

        expect(SmashUpDomain.validate(state, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'sheriff-1', baseIndex: 0 },
        })).toMatchObject({
            valid: false,
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

    it('titan_pecos_bill_duel_start 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 弃牌、写 metadata 或进场', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('discard-stale', 'wizard_summon', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.COWBOYS_POD, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ALIENS],
                }),
            },
            bases: [makeBase({
                defId: 'base_saloon_pod',
                minions: [
                    makeMinion('ally-stale', 'cowboys_gunfighter_pod', '0', 4),
                    makeMinion('enemy-stale', 'robot_microbot_alpha', '1', 2),
                ],
                ongoingActions: [],
            })],
            titans: [{
                uid: 'pecos-stale',
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
                challengerMinionUid: 'ally-stale',
                challengedMinionUid: 'enemy-stale',
                outcome: 'destroy_loser',
            },
            1002,
        );

        const prompt = getInteractionsFromMS(started)[0] as any;
        expect(prompt?.data?.sourceId).toBe('titan_pecos_bill_duel_start');
        const discardOption = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'discard-stale');
        expect(discardOption).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...started,
            core: {
                ...started.core,
                titans: (started.core.titans ?? []).map(titan => titan.uid === 'pecos-stale'
                    ? { ...titan, location: { zone: 'base', baseIndex: 0, enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: discardOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_METADATA_UPDATED)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_PLAYED)).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('discard-stale');
        expect((resolved.finalState.core.titans ?? []).find(candidate => candidate.uid === 'pecos-stale')).toMatchObject({
            location: { zone: 'base', baseIndex: 0 },
        });
        expect(resolved.finalState.core.activeDuel?.challengerMinionUid).toBe('ally-stale');
    });

    it('borrowed pecos_bill 也应在当前控制者成为 challenger 时弹出弃牌进场 prompt，并保留真实 owner', () => {
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
                uid: 'pecos-borrowed-1',
                defId: 'pecos_bill',
                faction: SMASHUP_FACTION_IDS.COWBOYS,
                ownerId: '1',
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
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_pecos_bill_duel_start');

        const discardOption = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'discard-1');
        const deployed = runCommand(
            started,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: discardOption.id } } as any,
            FIXED_RANDOM,
        );

        const pecos = deployed.finalState.core.titans?.find(candidate => candidate.uid === 'pecos-borrowed-1');
        expect(pecos).toMatchObject({
            ownerId: '1',
            controllerId: '0',
            location: { zone: 'base', baseIndex: 0 },
        });
        expect(pecos?.metadata?.deferClashUntilDuelEnds).toBe(true);
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

    it('决斗里打出需要立即执行的行动若缺少声明会直接报错', async () => {
        vi.resetModules();
        vi.doMock('../data/cards', async () => {
            const actual = await vi.importActual<typeof import('../data/cards')>('../data/cards');
            return {
                ...actual,
                getCardDef: (defId: string) => {
                    if (defId === 'missing_duel_action') {
                        return {
                            id: defId,
                            name: '缺声明决斗行动',
                            type: 'action',
                            subtype: 'standard',
                        } as any;
                    }
                    return actual.getCardDef(defId);
                },
            };
        });

        const { startDuel: startDuelWithMock } = await import('../domain/duel');

        const duelState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('missing-duel-card', 'missing_duel_action', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'cowboys_gunfighter_pod', '0', 4),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2),
                ],
                ongoingActions: [],
            })],
        }));

        const started = startDuelWithMock(
            duelState,
            {
                sourceId: 'cowboys_high_noon_pod',
                sourcePlayerId: '0',
                challengerMinionUid: 'ally-1',
                challengedMinionUid: 'enemy-1',
                outcome: 'destroy_loser',
            },
            300,
        );

        expect(() => resolveDuelChain(started, {
            smashup_duel_card: (prompt) => {
                const missingActionOption = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'missing-duel-card');
                return { optionId: missingActionOption.id };
            },
        })).toThrowError(/SmashUp ability 缺少声明: missing_duel_action::onPlay \(duel\.playActionAsDuelCard\)/);

        vi.doUnmock('../data/cards');
        vi.resetModules();
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

    it('titan_werewolves_great_wolf_spirit_move 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 移动泰坦', () => {
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
                uid: 't-gws-stale',
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
            now: 73,
        });

        const currentInteraction = triggerResult.matchState?.sys.interaction?.current;
        expect(currentInteraction?.data?.sourceId).toBe('titan_werewolves_great_wolf_spirit_move');

        const handler = getInteractionHandler('titan_werewolves_great_wolf_spirit_move');
        expect(handler).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...(triggerResult.matchState as MatchState<SmashUpCore>),
            core: {
                ...(triggerResult.matchState as MatchState<SmashUpCore>).core,
                titans: (((triggerResult.matchState as MatchState<SmashUpCore>).core.titans) ?? []).map(titan => titan.uid === 't-gws-stale'
                    ? { ...titan, location: { zone: 'setaside', enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = handler!(
            staleState,
            '0',
            { baseIndex: 1, baseDefId: core.bases[1].defId },
            currentInteraction?.data as any,
            FIXED_RANDOM,
            74,
        );

        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_MOVED)).toHaveLength(0);
        expect((resolved.state.core.titans ?? []).find(titan => titan.uid === 't-gws-stale')?.location).toMatchObject({
            zone: 'setaside',
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

    it('titan_dinosaurs_fort_titanosaurus_ongoing 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 放置指示物或写 metadata', () => {
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
                uid: 't-fort-stale',
                defId: 'dinosaurs_fort_titanosaurus',
                faction: SMASHUP_FACTION_IDS.DINOSAURS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 3,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        }));

        const played = runCommand(initialState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'aug-1', targetBaseIndex: 0 },
            timestamp: 50,
        }, FIXED_RANDOM);
        expect(played.success).toBe(true);

        const augmentationPrompt = getInteractionsFromMS(played.finalState)[0] as any;
        expect(augmentationPrompt?.data?.sourceId).toBe('dino_augmentation');
        const augmentationOption = findInteractionOption(
            augmentationPrompt,
            entry => entry?.value?.minionUid === 'dino-target',
        );
        expect(augmentationOption).toBeDefined();

        const afterAugmentation = runCommand(
            played.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: augmentationOption.id } } as any,
            FIXED_RANDOM,
        );
        const nextPrompt = getInteractionsFromMS(afterAugmentation.finalState)[0] as any;
        let fortPromptState = afterAugmentation.finalState;
        let fortPrompt = nextPrompt;
        if (nextPrompt?.data?.sourceId === 'smashup_reaction_choose') {
            const triggerById = new Map(
                (nextPrompt?.state?.core?.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]),
            );
            const fortReactionOption = nextPrompt?.data?.options?.find((entry: any) => {
                const trigger = triggerById.get(entry?.value?.triggerId);
                return trigger?.sourceDefId === 'dinosaurs_fort_titanosaurus';
            });
            expect(fortReactionOption).toBeDefined();

            const afterReaction = runCommand(
                afterAugmentation.finalState,
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: fortReactionOption.id } } as any,
                FIXED_RANDOM,
            );
            fortPromptState = afterReaction.finalState;
            fortPrompt = getInteractionsFromMS(afterReaction.finalState)[0] as any;
        }
        expect(fortPrompt?.data?.sourceId).toBe('titan_dinosaurs_fort_titanosaurus_ongoing');
        const titanOnlyOption = findInteractionOption(fortPrompt, entry => entry?.value?.mode === 'titan');
        expect(titanOnlyOption).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...fortPromptState,
            core: {
                ...fortPromptState.core,
                titans: (fortPromptState.core.titans ?? []).map(titan => titan.uid === 't-fort-stale'
                    ? { ...titan, location: { zone: 'setaside', enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: titanOnlyOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_METADATA_UPDATED)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_POWER_COUNTER_ADDED)).toHaveLength(0);
        expect((resolved.finalState.core.titans ?? []).find(titan => titan.uid === 't-fort-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect((resolved.finalState.core.titans ?? []).find(titan => titan.uid === 't-fort-stale')?.powerCounters).toBe(3);
        expect(
            ((resolved.finalState.core.titans ?? []).find(titan => titan.uid === 't-fort-stale')?.metadata as {
                fortTitanosaurusTriggeredTurn?: number;
            } | undefined)?.fortTitanosaurusTriggeredTurn,
        ).toBeUndefined();
    });

    it('titan_dinosaurs_fort_titanosaurus_special 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 消灭随从或进场', () => {
        const initialState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.DINOSAURS, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_wizard_academy',
                minions: [
                    makeMinion('fort-special-food', 'dino_armor_stego_pod', '0', 4, { powerCounters: 1 }),
                ],
                ongoingActions: [],
            })],
            titans: [{
                uid: 't-fort-special-stale',
                defId: 'dinosaurs_fort_titanosaurus',
                faction: SMASHUP_FACTION_IDS.DINOSAURS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        }));

        const activated = runCommand(initialState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-fort-special-stale', baseIndex: 0 },
            timestamp: 61,
        } as any, FIXED_RANDOM);
        expect(activated.success).toBe(true);

        const specialPrompt = getInteractionsFromMS(activated.finalState)[0] as any;
        expect(specialPrompt?.data?.sourceId).toBe('titan_dinosaurs_fort_titanosaurus_special');
        const destroyOption = findInteractionOption(
            specialPrompt,
            entry => entry?.value?.minionUid === 'fort-special-food',
        );
        expect(destroyOption).toBeDefined();

        const staleState: MatchState<SmashUpCore> = {
            ...activated.finalState,
            core: {
                ...activated.finalState.core,
                titans: (activated.finalState.core.titans ?? []).map(titan => titan.uid === 't-fort-special-stale'
                    ? { ...titan, location: { zone: 'base', baseIndex: 0, enteredAt: 1 } }
                    : titan),
            },
        };

        const resolved = runCommand(
            staleState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: destroyOption.id } } as any,
            FIXED_RANDOM,
        );

        expect(resolved.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_PLAYED)).toHaveLength(0);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.TITAN_POWER_COUNTER_ADDED)).toHaveLength(0);
        expect((resolved.finalState.core.bases[0]?.minions ?? []).map(minion => minion.uid)).toContain('fort-special-food');
        expect((resolved.finalState.core.titans ?? []).find(titan => titan.uid === 't-fort-special-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
        expect((resolved.finalState.core.titans ?? []).find(titan => titan.uid === 't-fort-special-stale')?.powerCounters).toBe(0);
    });
});

