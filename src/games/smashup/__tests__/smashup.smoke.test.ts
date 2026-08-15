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
import { resolveLocalAiActionVisibility } from '../../../engine/ai/actionVisibility';
import { resolveAiDifficultyProfile } from '../../../engine/ai/difficulty';
import { createSimpleChoice, INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import { executePipeline } from '../../../engine/pipeline';
import type { CardsDrawnEvent, SmashUpCore, SmashUpCommand, SmashUpEvent, SmashUpReactionSession } from '../domain/types';
import { MADNESS_CARD_DEF_ID, SU_COMMANDS, SU_EVENTS, TEAM_VP_TO_WIN_2V2, getCurrentPlayerId } from '../domain/types';
import { isSmashUpFactionImplementationInProgress, SMASHUP_FACTION_IDS } from '../domain/ids';
import { getBaseDef, getCardDef, getFactionCards, getTitanDef } from '../data/cards';
import { TITAN_CARD_DEFS } from '../data/titans';
import { getPlayerEffectivePowerOnBase, getRegisteredModifierIds, getTitanPowerContribution } from '../domain/ongoingModifiers';
import { addPowerCounter, buildPlayerTargetOptions } from '../domain/abilityHelpers';
import { uncoverBuriedCard } from '../domain/bury';
import { isAbilityRuntimeContinuationEvent, resumeAbilityRuntimeContinuationEvent } from '../domain/abilityRuntime';
import { collectTriggers, fireTriggers, interceptEvent } from '../domain/ongoingEffects';
import { filterProtectedDestroyEvents, filterProtectedMoveEvents, filterProtectedReturnEvents } from '../domain/reducer';
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
import {
    expectNoPrompt,
    getPromptHandlerData,
    getOptionalSimpleChoicePrompt,
    getPromptOption,
    getPromptOptions,
    getPromptPlayerId,
    getPromptSourceId,
    getPromptsBySourceId,
    getReactionPromptOptionBySourceDefId,
    getSimpleChoicePrompt,
    applyEvents,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    resolveCardsReturnedToHand,
    resolveDestroyedMinions,
    resolveInteractionChain,
    resolveMovedMinions,
    respondCommand,
    respondToPromptOption,
    respondToPromptOptions,
} from './helpers';
import { runCommand } from './testRunner';
import type { TitanState } from '../domain/types';
import { buildSmashUpAiLegalActions, smashUpAiRuntime } from '../ai';
import { startDuel } from '../domain/duel';
import { getSmashUpCardPreviewMeta } from '../ui/cardPreviewHelper';
import engineConfig from '../game';
import { readSmashUpRuntimeSetupConfig, SMASHUP_DECK_QUERY_SETUP_VALUE } from '../roomSetup';
import { hasCardActivatableAbility } from '../domain/activationMetadata';
import { resolveOngoingActivation, resolveSpecial, resolveTalent } from '../domain/abilityRegistry';
import { hasTitanSpecialValidator } from '../domain/titanAbilityValidators';

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
        const sourceId = getPromptSourceId(prompt);
        const custom = sourceId ? overrides[sourceId] : undefined;
        if (custom) return custom(prompt, state, step);

        if (sourceId === 'smashup_duel_pinkerton') {
            const option = getPromptOption(prompt, entry => entry?.value?.amount === 0, 'Pinkerton 的 0 指示物选项');
            return { optionId: option.id };
        }
        if (sourceId === 'smashup_duel_card' || sourceId === 'smashup_duel_deputy_card') {
            const option = getPromptOption(prompt, entry => entry?.value?.skip === true, `${sourceId} 的跳过选项`);
            return { optionId: option.id };
        }
        if (sourceId === 'smashup_duel_run_em_off_move') {
            return { optionId: getPromptOptions(prompt)[0].id };
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

    it('setup 基础牌堆不会包含实施中派系基地', () => {
        const runner = createRunner();
        const result = runner.run({ name: 'setup 基础牌堆过滤实施中派系', commands: [] });
        const allRuntimeBaseIds = [
            ...result.finalState.core.bases.map((base) => base.defId),
            ...result.finalState.core.baseDeck,
            ...result.finalState.core.baseDiscard,
        ];

        const leakedBaseIds = allRuntimeBaseIds.filter((baseId) => {
            const factionId = getBaseDef(baseId)?.faction;
            return factionId ? isSmashUpFactionImplementationInProgress(factionId) : false;
        });

        expect(leakedBaseIds).toEqual([]);
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

    it('房间关闭 diy 扩展后不会初始化 DIY 基地，也不能选择 DIY 派系', () => {
        const state = SmashUpDomain.setup(['0', '1'], FIXED_RANDOM, {
            expansions: ['titans'],
            setupSelections: {
                expansions: ['titans'],
            },
        });

        const setupBaseIds = [
            ...state.bases.map((base) => base.defId),
            ...state.baseDeck,
        ];
        expect(state.enabledExpansions).toEqual(['titans']);
        expect(setupBaseIds).not.toContain('base_huluwawa_mountain');
        expect(setupBaseIds).not.toContain('base_seven_colored_lotus');

        const matchState = makeMatchState(state);
        matchState.sys.phase = 'factionSelect';
        expect(SmashUpDomain.validate!(matchState, {
            type: SU_COMMANDS.SELECT_FACTION,
            playerId: '0',
            payload: { factionId: SMASHUP_FACTION_IDS.HULUWAWA },
        })).toMatchObject({
            valid: false,
            error: '该 DIY 派系未开启',
        });
    });

    it('余牌查询默认开启', () => {
        const state = SmashUpDomain.setup(['0', '1'], FIXED_RANDOM, {
            setupSelections: {
                expansions: ['titans', 'diy', 'deckQuery'],
            },
        });

        expect(state.deckQueryEnabled).toBe(true);
    });

    it('余牌查询关闭后不会进入运行时状态', () => {
        const state = SmashUpDomain.setup(['0', '1'], FIXED_RANDOM, {
            setupSelections: {
                expansions: ['titans', 'diy'],
            },
        });

        expect(state.deckQueryEnabled).toBe(false);
    });

    it('setup 会把统一房间配置桥接结果写入运行时状态', () => {
        const setupData = {
            setupSelections: {
                expansions: ['diy', 'titans', SMASHUP_DECK_QUERY_SETUP_VALUE],
                teamMode: '2v2',
            },
        } as const;

        const runtimeConfig = readSmashUpRuntimeSetupConfig(setupData, { playerCount: 4 });
        const state = SmashUpDomain.setup(['0', '1', '2', '3'], FIXED_RANDOM, setupData);

        expect(state).toMatchObject(runtimeConfig);
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
        const promptCore = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('prompt-penguin-a', 'ghosts_spectre', '0', 2),
                        makeMinion('prompt-penguin-b', 'pirate_first_mate', '0', 2),
                        makeMinion('prompt-penguin-c', 'robot_microbot_alpha', '0', 1),
                    ],
                }),
                makeBase(),
            ],
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

        const triggerResult = fireTriggers(promptCore, 'onTurnStart', {
            state: promptCore,
            matchState: makeMatchState(promptCore, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 31,
        });
        const prompt = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_penguins_emperor_penguin_play');
        expect(prompt).toBeDefined();

        const staleCore = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('stale-penguin-a', 'ghosts_spectre', '0', 2),
                        makeMinion('stale-penguin-b', 'pirate_first_mate', '0', 2),
                        makeMinion('stale-penguin-c', 'robot_microbot_alpha', '0', 1),
                    ],
                }),
                makeBase(),
            ],
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

        const result = respondToPromptOption(
            { ...triggerResult.matchState!, core: staleCore },
            entry => entry.value?.baseIndex === 0,
            'Emperor Penguin stale play base option',
            '0',
            FIXED_RANDOM,
        );
        expect(result.success, result.error).toBe(true);
        expect(result.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_PLAYED }),
        ]));
        expect(result.finalState.core.titans).toEqual(expect.arrayContaining([
            expect.objectContaining({
                uid: 'arcane-live',
                location: expect.objectContaining({ zone: 'base', baseIndex: 0 }),
            }),
            expect.objectContaining({
                uid: 'emperor-setaside',
                location: expect.objectContaining({ zone: 'setaside' }),
            }),
        ]));
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
        const prompt = getSimpleChoicePrompt(post.matchState!, 'titan_fairies_spirit_of_the_forest_clash_move');

        const moveOption = getPromptOption(prompt, entry => entry.value?.baseIndex === 1);

        const moved = runCommand(
            post.matchState!,
            respondCommand(moveOption.id, '0'),
            FIXED_RANDOM,
        );

        const spirit = moved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1');
        const dagon = moved.finalState.core.titans?.find(titan => titan.uid === 'dagon-1');
        expect(spirit?.location).toMatchObject({ zone: 'base', baseIndex: 1 });
        expect(dagon?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
    });

    it('丛林之灵输掉 titan clash 时可以移动到已有泰坦的基地，并继续按泰坦交锋收口', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-0', 'robot_microbot_alpha', '0', 2),
                        makeMinion('enemy-0', 'robot_microbot_alpha', '1', 4),
                    ],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [makeMinion('enemy-on-base-b', 'robot_microbot_alpha', '1', 4)],
                }),
                makeBase({ defId: 'base_c', minions: [] }),
            ],
            titans: [
                {
                    uid: 'spirit-loop',
                    defId: 'fairies_spirit_of_the_forest',
                    faction: 'fairies',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as TitanState,
                {
                    uid: 'dagon-loop',
                    defId: 'innsmouth_dagon',
                    faction: 'innsmouth',
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } as TitanState,
                {
                    uid: 'ancient-lord-loop',
                    defId: 'vampires_ancient_lord',
                    faction: 'vampires',
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 3 },
                } as TitanState,
            ],
        });

        const post = postProcessSystemEvents(core, [{
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: 'dagon-loop',
                defId: 'innsmouth_dagon',
                ownerId: '1',
                controllerId: '1',
                baseIndex: 0,
                baseDefId: 'base_a',
                reason: 'test_spirit_clash_follow_up_clash',
            },
            timestamp: 32,
        } as SmashUpEvent], FIXED_RANDOM, makeMatchState(core));

        const prompt = getSimpleChoicePrompt(post.matchState!, 'titan_fairies_spirit_of_the_forest_clash_move');
        const occupiedMoveOption = getPromptOption(prompt, entry => entry.value?.baseIndex === 1);
        expect(getPromptOptions(prompt).some(entry => entry.value?.baseIndex === 2)).toBe(true);

        const movedToOccupiedBase = runCommand(
            post.matchState!,
            respondCommand(occupiedMoveOption.id, '0'),
            FIXED_RANDOM,
        );

        expect(movedToOccupiedBase.finalState.core.titans?.find(titan => titan.uid === 'spirit-loop')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });

        const followUpPrompt = getSimpleChoicePrompt(
            movedToOccupiedBase.finalState,
            'titan_fairies_spirit_of_the_forest_clash_move',
        );
        expect(getPromptOption(followUpPrompt, entry => entry.value?.skip === true)).toBeDefined();
        const returnToPreviousBaseOption = getPromptOption(followUpPrompt, entry => entry.value?.baseIndex === 0);
        expect(returnToPreviousBaseOption).toBeDefined();
        expect(returnToPreviousBaseOption._ai?.forcedTargetPolicy).toBe('must-avoid');
        expect(getPromptOptions(followUpPrompt).some(entry => entry.value?.baseIndex === 2)).toBe(true);

        const removed = respondToPromptOption(
            movedToOccupiedBase.finalState,
            entry => entry.value?.baseIndex === 2,
            'Spirit of the Forest follow-up clash move to unvisited empty base option',
            '0',
            FIXED_RANDOM,
        );
        expect(removed.success, removed.error).toBe(true);
        expect(removed.finalState.core.titans?.find(titan => titan.uid === 'spirit-loop')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 2,
        });
        expect(removed.finalState.core.titans?.find(titan => titan.uid === 'ancient-lord-loop')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
        expect(getPromptsBySourceId(
            removed.finalState,
            'titan_fairies_spirit_of_the_forest_clash_move',
        )).toHaveLength(0);
    });

    it('丛林之灵输掉连续 titan clash 时，AI 不会在两个已有泰坦基地间无限往返', async () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-0', 'robot_microbot_alpha', '0', 2),
                        makeMinion('enemy-0', 'robot_microbot_alpha', '1', 4),
                    ],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [makeMinion('enemy-on-base-b', 'robot_microbot_alpha', '1', 4)],
                }),
            ],
            titans: [
                {
                    uid: 'spirit-two-base-loop',
                    defId: 'fairies_spirit_of_the_forest',
                    faction: 'fairies',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as TitanState,
                {
                    uid: 'dagon-two-base-loop',
                    defId: 'innsmouth_dagon',
                    faction: 'innsmouth',
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } as TitanState,
                {
                    uid: 'ancient-lord-two-base-loop',
                    defId: 'vampires_ancient_lord',
                    faction: 'vampires',
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 3 },
                } as TitanState,
            ],
        });

        const post = postProcessSystemEvents(core, [{
            type: SU_EVENTS.TITAN_PLAYED,
            payload: {
                titanUid: 'dagon-two-base-loop',
                defId: 'innsmouth_dagon',
                ownerId: '1',
                controllerId: '1',
                baseIndex: 0,
                baseDefId: 'base_a',
                reason: 'test_spirit_clash_two_base_loop',
            },
            timestamp: 33,
        } as SmashUpEvent], FIXED_RANDOM, makeMatchState(core));

        const prompt = getSimpleChoicePrompt(post.matchState!, 'titan_fairies_spirit_of_the_forest_clash_move');
        const moveToOccupiedBase = getPromptOption(prompt, entry => entry.value?.baseIndex === 1);

        const movedToOccupiedBase = runCommand(
            post.matchState!,
            respondCommand(moveToOccupiedBase.id, '0'),
            FIXED_RANDOM,
        );

        expect(movedToOccupiedBase.finalState.core.titans?.find(titan => titan.uid === 'spirit-two-base-loop')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });

        const followUpPrompt = getSimpleChoicePrompt(
            movedToOccupiedBase.finalState,
            'titan_fairies_spirit_of_the_forest_clash_move',
        );
        const returnToPreviousBaseOption = getPromptOption(followUpPrompt, entry => entry.value?.baseIndex === 0);
        expect(returnToPreviousBaseOption._ai?.forcedTargetPolicy).toBe('must-avoid');

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: movedToOccupiedBase.finalState,
        });
        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
            gameId: 'smashup',
            matchId: 'test-spirit-of-forest-ai-clash-loop',
            playerId: '0',
            visibleState: movedToOccupiedBase.finalState,
            interaction: {
                id: followUpPrompt.id,
                kind: 'simple-choice',
                sourceId: 'titan_fairies_spirit_of_the_forest_clash_move',
                playerId: '0',
                options: getPromptOptions(followUpPrompt),
            },
            responseWindow: null,
            legalActions,
            rulesVersion: null,
            decisionBudgetMs: 250,
            difficulty: resolveAiDifficultyProfile('normal'),
            source: 'local',
        });
        const chosenAction = legalActions.find((action) => action.actionId === decision?.actionId);
        expect(chosenAction).toBeDefined();
        const chosenOption = chosenAction?.metadata?.optionValue as { baseIndex?: number; skip?: boolean } | undefined;
        expect(chosenOption).not.toMatchObject({ baseIndex: 0 });

        const chosenCommand = chosenAction!.commands[0] as SmashUpCommand;
        const resolved = runCommand(
            movedToOccupiedBase.finalState,
            { ...chosenCommand, playerId: followUpPrompt.playerId } as SmashUpCommand,
            FIXED_RANDOM,
        );
        expect(resolved.success, resolved.error).toBe(true);
        const resolvedSpiritLocation = resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-two-base-loop')?.location;
        if (chosenOption?.skip === true) {
            expect(resolvedSpiritLocation).toMatchObject({ zone: 'setaside' });
        } else {
            expect(resolvedSpiritLocation).not.toMatchObject({ zone: 'base', baseIndex: 0 });
        }
        expect(getPromptsBySourceId(
            resolved.finalState,
            'titan_fairies_spirit_of_the_forest_clash_move',
        )).toHaveLength(0);
    });

    it('titan_fairies_spirit_of_the_forest_clash_move 的 source titan 若在响应前已离开原基地，不应继续沿旧 prompt 移除当前 live titan', () => {
        const promptCore = makeState({
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

        const post = postProcessSystemEvents(promptCore, [{
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
        } as SmashUpEvent], FIXED_RANDOM, makeMatchState(promptCore));

        const prompt = getSimpleChoicePrompt(post.matchState!, 'titan_fairies_spirit_of_the_forest_clash_move');
        expect(getPromptOption(prompt, entry => entry.value?.skip === true)).toBeDefined();

        const staleCore = makeState({
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
                    location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
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

        const resolved = respondToPromptOption(
            { ...post.matchState!, core: staleCore },
            entry => entry.value?.skip === true,
            'Spirit of the Forest stale clash skip option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_REMOVED_FROM_PLAY }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_MOVED }),
        ]));
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-stale')?.location).toMatchObject({
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
        const discardPrompt = getSimpleChoicePrompt(state, 'titan_ghosts_creampuff_man_discard');

        expect(getPromptOption(discardPrompt, entry => entry.value?.cardUid === 'ghost-cost')).toBeDefined();
        const discardResolved = respondToPromptOption(
            state,
            entry => entry.value?.cardUid === 'ghost-cost',
            'Creampuff discard option',
            '0',
            FIXED_RANDOM,
        );
        expect(discardResolved.events.some(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toBe(true);

        const stateAfterDiscard = discardResolved.finalState;
        const playPrompt = getSimpleChoicePrompt(stateAfterDiscard, 'titan_ghosts_creampuff_man_play');
        expect(getPromptOption(playPrompt, entry => entry.value?.cardUid === 'ghost-seance-discard')).toBeDefined();

        const playResolved = respondToPromptOption(
            stateAfterDiscard,
            entry => entry.value?.cardUid === 'ghost-seance-discard',
            'Creampuff play option',
            '0',
            FIXED_RANDOM,
        );

        expect(playResolved.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        expect(playResolved.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);

        const drawEvent = playResolved.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as CardsDrawnEvent | undefined;
        expect(drawEvent?.payload.count).toBe(4);

        const resolvedCore = playResolved.finalState.core;
        expect(resolvedCore.players['0'].discard.some(card => card.uid === 'ghost-seance-discard')).toBe(false);
        expect(resolvedCore.players['0'].deck[resolvedCore.players['0'].deck.length - 1]?.uid).toBe('ghost-seance-discard');
    });

    it('ghosts_creampuff_man 的 source titan 若在第二段响应前已离开基地，不应继续沿旧 play prompt 进入目标选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ghost-cost', 'ghost_ghost', 'minion', '0')],
                    discard: [makeCard('bananas-discard', 'cyborg_apes_going_bananas', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase(),
                makeBase({
                    ongoingActions: [{
                        uid: 'enemy-ongoing',
                        defId: 'time_travelers_stasis_field',
                        ownerId: '1',
                    } as any],
                }),
            ],
            titans: [{
                uid: 'cream-stale',
                defId: 'ghosts_creampuff_man',
                faction: SMASHUP_FACTION_IDS.GHOSTS,
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
            payload: { titanUid: 'cream-stale', baseIndex: 0 },
            timestamp: 65,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const discardPrompt = getSimpleChoicePrompt(state, 'titan_ghosts_creampuff_man_discard');
        expect(getPromptOption(discardPrompt, entry => entry.value?.cardUid === 'ghost-cost')).toBeDefined();

        const discardResolved = respondToPromptOption(
            state,
            entry => entry.value?.cardUid === 'ghost-cost',
            'Creampuff stale discard option',
            '0',
            FIXED_RANDOM,
        );

        const playPrompt = getSimpleChoicePrompt(discardResolved.finalState, 'titan_ghosts_creampuff_man_play');
        expect(getPromptOption(playPrompt, entry => entry.value?.cardUid === 'bananas-discard')).toBeDefined();

        const staleCore: SmashUpCore = {
            ...discardResolved.finalState.core,
            titans: (discardResolved.finalState.core.titans ?? []).map(titan => titan.uid !== 'cream-stale' ? titan : ({
                ...titan,
                location: { zone: 'setaside' },
            })),
        };

        const resolved = respondToPromptOption(
            { ...discardResolved.finalState, core: staleCore },
            entry => entry.value?.cardUid === 'bananas-discard',
            'Creampuff stale play option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: INTERACTION_EVENTS.INTERACTION_CREATED }),
            expect.objectContaining({ type: SU_EVENTS.ACTION_PLAYED }),
            expect.objectContaining({ type: SU_EVENTS.CARD_TO_DECK_BOTTOM }),
        ]));
        expect(getOptionalSimpleChoicePrompt(resolved.finalState, 'titan_ghosts_creampuff_man_action_target')).toBeUndefined();
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'bananas-discard')).toBe(true);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'cream-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
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

        const prompt = getSimpleChoicePrompt(result.matchState!, 'titan_sphinx_start_turn');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'sphinx-start-buried');
        expect(option.displayMode).toBe('card');

        const resolved = respondToPromptOption(
            result.matchState!,
            entry => entry.value?.cardUid === 'sphinx-start-buried',
            'Sphinx start-turn buried option',
            '0',
            FIXED_RANDOM,
        );
        const finalCore = resolved.finalState.core;

        expect(finalCore.players['0'].hand.some(card => card.uid === 'sphinx-start-buried')).toBe(true);
        expect(finalCore.bases[0].buriedCards?.some(card => card.uid === 'sphinx-start-buried') ?? false).toBe(false);
        expect((finalCore.titans ?? []).find(candidate => candidate.uid === 't-sphinx-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('titan_sphinx_start_turn 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 回手埋葬牌或进场', () => {
        const promptCore = makeState({
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

        const result = fireTriggers(promptCore, 'onTurnStart', {
            state: promptCore,
            matchState: makeMatchState(promptCore),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 81,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'titan_sphinx_start_turn');
        expect(getPromptOption(prompt, entry => entry.value?.cardUid === 'sphinx-stale-buried')).toBeDefined();

        const staleCore = makeState({
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
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const resolved = respondToPromptOption(
            { ...result.matchState!, core: staleCore },
            entry => entry.value?.cardUid === 'sphinx-stale-buried',
            'Sphinx stale start-turn buried option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_PLAYED }),
        ]));
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-sphinx-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
        expect(resolved.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'sphinx-stale-buried')).toBe(true);
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

        const prompt = getSimpleChoicePrompt(result.matchState!, 'titan_sphinx_after_scoring');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'sphinx-score-buried');
        expect(option.displayMode).toBe('card');

        const resolved = respondToPromptOption(
            result.matchState!,
            entry => entry.value?.cardUid === 'sphinx-score-buried',
            'Sphinx after-scoring buried option',
            '0',
            FIXED_RANDOM,
        );
        const finalCore = resolved.finalState.core;

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

        const prompt = getSimpleChoicePrompt(state, 'titan_sphinx_talent');
        expect(getPromptOption(prompt, entry => entry.value?.cardUid === 'sphinx-hand-card')).toBeDefined();

        const resolved = respondToPromptOption(
            state,
            entry => entry.value?.cardUid === 'sphinx-hand-card',
            'Sphinx talent buried option',
            '0',
            FIXED_RANDOM,
        );
        const finalCore = resolved.finalState.core;

        expect(finalCore.players['0'].hand.some(card => card.uid === 'sphinx-hand-card')).toBe(false);
        expect(finalCore.bases[0].buriedCards?.some(card => card.uid === 'sphinx-hand-card')).toBe(true);
    });

    it('titan_sphinx_talent 的 source titan 若在响应前已不在基地上，不应继续按过期 baseIndex 埋葬手牌', () => {
        const promptCore = makeState({
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
                uid: 't-sphinx-talent-stale',
                defId: 'sphinx',
                faction: SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(promptCore);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-sphinx-talent-stale', baseIndex: 0 },
            timestamp: 85,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const prompt = getSimpleChoicePrompt(state, 'titan_sphinx_talent');
        expect(getPromptOption(prompt, entry => entry.value?.cardUid === 'sphinx-hand-card')).toBeDefined();

        const staleCore = makeState({
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
                uid: 't-sphinx-talent-stale',
                defId: 'sphinx',
                faction: SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: true,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.cardUid === 'sphinx-hand-card',
            'Sphinx stale talent buried option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARD_BURIED }),
        ]));
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'sphinx-hand-card')).toBe(true);
        expect(resolved.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'sphinx-hand-card') ?? false).toBe(false);
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

    it('从手牌打出远古诅咒会附着到目标随从，不会进入弃牌堆', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('curse-hand', 'ancient_egyptians_ancient_curse_pod', 'action', '0')],
                    discard: [],
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.KILLER_PLANTS],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_ninja_dojo',
                    minions: [makeMinion('target-minion', 'killer_plant_water_lily_pod', '1', 3, { powerCounters: 0, tempPowerModifier: 0 })],
                }),
            ],
        });

        const result = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'curse-hand', targetBaseIndex: 0, targetMinionUid: 'target-minion' },
            },
            FIXED_RANDOM,
        );

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'curse-hand',
                defId: 'ancient_egyptians_ancient_curse_pod',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'target-minion',
            }),
        }));
        expect(result.finalState.core.players['0'].discard.some(card => card.uid === 'curse-hand')).toBe(false);
        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'target-minion')?.attachedActions).toContainEqual(
            expect.objectContaining({ uid: 'curse-hand', defId: 'ancient_egyptians_ancient_curse_pod', ownerId: '0' }),
        );
    });

    it('远古诅咒允许打到受保护随从，但效果会被拦截并给出友好提示', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('curse-protected', 'ancient_egyptians_ancient_curse_pod', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.KILLER_PLANTS],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_ninja_dojo',
                    minions: [
                        makeMinion('protected-minion', 'killer_plant_water_lily_pod', '1', 3, {
                            attachedActions: [{ uid: 'smoke', defId: 'ninja_smoke_bomb', ownerId: '1' }],
                        }),
                    ],
                }),
            ],
        });
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'curse-protected', targetBaseIndex: 0, targetMinionUid: 'protected-minion' },
        } as const;

        expect(SmashUpDomain.validate(makeMatchState(core), command)).toMatchObject({ valid: true });

        const result = runCommand(makeMatchState(core), command, FIXED_RANDOM);

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                playerId: '0',
                messageKey: 'feedback.target_protected',
                tone: 'warning',
            }),
        }));
        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'protected-minion')?.attachedActions).not.toContainEqual(
            expect.objectContaining({ uid: 'curse-protected' }),
        );
        expect(result.finalState.core.players['0'].discard).toContainEqual(
            expect.objectContaining({ uid: 'curse-protected', defId: 'ancient_egyptians_ancient_curse_pod' }),
        );
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

        const continuation = uncovered.events.find(event => isAbilityRuntimeContinuationEvent(event));
        expect(continuation).toBeDefined();
        const preContinuationEvents = uncovered.events.filter(event => !isAbilityRuntimeContinuationEvent(event)) as SmashUpEvent[];
        const afterActionState = {
            ...uncovered.state,
            core: applyEvents(uncovered.state.core, preContinuationEvents),
        };
        const resumed = resumeAbilityRuntimeContinuationEvent(
            afterActionState,
            continuation!,
            FIXED_RANDOM,
        );
        expect(resumed).toBeDefined();

        const prompt = getSimpleChoicePrompt(resumed!.state, 'ancient_egyptians_ancient_curse_confirm');
        const applyOption = getPromptOption(prompt, entry => entry.id === 'apply', 'Ancient Curse apply option');
        expect(applyOption?.value).toMatchObject({
            targetMinionUid: 'target-minion',
            baseIndex: 0,
            baseDefId: 'base_ninja_dojo',
        });
        const finalEvents = [...preContinuationEvents, ...(resumed!.events as SmashUpEvent[])];
        expect(finalEvents.map(event => event.type)).toContain(SU_EVENTS.ONGOING_ATTACHED);
        expect(finalEvents).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'buried-curse',
                defId: 'ancient_egyptians_ancient_curse_pod',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'target-minion',
            }),
        }));

        const finalCore = applyEvents(uncovered.state.core, finalEvents);

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

        const targetPrompt = getSimpleChoicePrompt(uncovered.state, 'bury_uncover_ongoing_target');
        const targetOption = getPromptOption(targetPrompt, entry => entry.value?.minionUid === 'target-minion-b', 'Ancient Curse target minion option');

        const resolved = runCommand(
            uncovered.state,
            respondCommand(targetOption.id, '1'),
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

        const confirmPrompt = getSimpleChoicePrompt(resolved.finalState, 'ancient_egyptians_ancient_curse_confirm');
        const applyOption = getPromptOption(confirmPrompt, entry => entry.id === 'apply', 'Ancient Curse confirm apply option');
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

    it('线上反馈 6a143f93：鲜血领主反应选项应携带目标 minionDefId 并可结算', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.VAMPIRES, SMASHUP_FACTION_IDS.WIZARDS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_factory',
                minions: [{
                    ...makeMinion('ancient-lord-target', 'vampire_the_count', '0', 5),
                    powerCounters: 1,
                }],
                ongoingActions: [],
            })],
            titans: [{
                uid: 'ancient-lord-setaside',
                defId: 'vampires_ancient_lord',
                faction: SMASHUP_FACTION_IDS.VAMPIRES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });
        const triggerMinion = core.bases[0].minions.find(minion => minion.uid === 'ancient-lord-target');
        expect(triggerMinion).toBeDefined();

        const triggered = fireTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '0'),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'ancient-lord-target',
            triggerMinionDefId: triggerMinion!.defId,
            triggerMinion,
            affectType: 'power_change',
            counterChangeKind: 'added',
            counterDelta: 1,
            reason: 'vampire_the_count',
            random: FIXED_RANDOM,
            now: 6_143_093,
        });
        const prompt = getSimpleChoicePrompt(triggered.matchState!, 'titan_vampires_ancient_lord_special');
        const storeOption = getPromptOption(prompt, option => option.id === 'store', 'Ancient Lord store option');
        expect(storeOption.value).toMatchObject({
            minionUid: 'ancient-lord-target',
            minionDefId: 'vampire_the_count',
            baseIndex: 0,
            titanUid: 'ancient-lord-setaside',
        });

        const resolved = respondToPromptOption(
            triggered.matchState!,
            option => option.id === 'store',
            'Ancient Lord store option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.events.map(event => event.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.POWER_COUNTER_REMOVED,
            SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
        ]));
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_REMOVED,
            payload: expect.objectContaining({
                minionUid: 'ancient-lord-target',
                baseIndex: 0,
                amount: 1,
            }),
        }));
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                titanUid: 'ancient-lord-setaside',
                amount: 1,
            }),
        }));
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
        const prompt = getSimpleChoicePrompt(state, 'titan_vampires_ancient_lord_talent');

        expect(getPromptOption(prompt, entry => entry.value?.minionUid === minion!.uid && entry.value?.baseIndex === 0)).toBeDefined();
        const resolvedInteraction = respondToPromptOption(
            state,
            entry => entry.value?.minionUid === minion!.uid && entry.value?.baseIndex === 0,
            'Ancient Lord talent target option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolvedInteraction.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);

        const afterCommand = events.reduce((acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event), core);
        const resolvedCore = resolvedInteraction.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), afterCommand);
        const targetMinion = resolvedCore.bases[0].minions.find(candidate => candidate.uid === minion!.uid);
        expect(targetMinion?.powerCounters).toBe(2);
    });

    it('titan_vampires_ancient_lord_talent 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 给随从加 +1 指示物', () => {
        const core = makeState({
            bases: [makeBase({
                minions: [makeMinion('ancient-target', 'ghosts_spectre', '0', 2, { powerCounters: 1 })],
            })],
            titans: [{
                uid: 't-ancient-stale',
                defId: 'vampires_ancient_lord',
                faction: SMASHUP_FACTION_IDS.VAMPIRES,
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
            payload: { titanUid: 't-ancient-stale', baseIndex: 0 },
            timestamp: 94,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const prompt = getSimpleChoicePrompt(state, 'titan_vampires_ancient_lord_talent');
        expect(getPromptOption(prompt, entry => entry.value?.minionUid === 'ancient-target' && entry.value?.baseIndex === 0)).toBeDefined();

        const staleCore: SmashUpCore = {
            ...state.core,
            titans: (state.core.titans ?? []).map(titan => titan.uid !== 't-ancient-stale' ? titan : {
                ...titan,
                talentUsed: true,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.minionUid === 'ancient-target' && entry.value?.baseIndex === 0,
            'Ancient Lord stale talent target option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.POWER_COUNTER_ADDED }),
        ]));
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 't-ancient-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ancient-target')?.powerCounters).toBe(1);
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

    it('Smash Up AI 自动选派系不应列出仍未正式接入的派系', () => {
        const runner = createRunner(['0', '1', '2', '3']);
        const result = runner.run({ name: '四人 setup', commands: [] });

        const factionIds = buildSmashUpAiLegalActions({
            playerId: '0',
            state: result.finalState,
        })
            .filter((action) => action.kind === 'select-faction')
            .map((action) => String(action.metadata?.factionId ?? ''));

        expect(factionIds.length).toBeGreaterThan(0);
        expect(factionIds.filter((factionId) => isSmashUpFactionImplementationInProgress(factionId))).toEqual([]);
        expect(factionIds.every((factionId) => getFactionCards(factionId as any).length > 0)).toBe(true);
    });

    it('Smash Up AI 的 select-faction 应走隐式交互，不吃 visible delay', () => {
        const runner = createRunner(['0', '1', '2', '3']);
        const result = runner.run({ name: '四人 setup', commands: [] });

        const currentPlayerActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: result.finalState,
        });

        expect(currentPlayerActions.length).toBeGreaterThan(0);
        expect(
            currentPlayerActions.every((action) => resolveLocalAiActionVisibility(action, smashUpAiRuntime) === 'hidden'),
        ).toBe(true);
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
        expect(chosenAction).toBeDefined();
        expect(chosenAction?.metadata?.factionId).not.toBe(SMASHUP_FACTION_IDS.ZOMBIES);
        expect(chosenAction?.metadata?.factionId).not.toBe(SMASHUP_FACTION_IDS.ZOMBIES_POD);
        expect(decision?.reasoningSummary).toContain('按派系组合选择');
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

    it('Smash Up 2v2 玩家目标交互会把队友标成 ally、把敌队标成 enemy', async () => {
        const buildTeamStateWithPlayerTargetInteraction = (effectIntent: 'buff' | 'debuff') => {
            const core = makeState({
                currentPlayerIndex: 0,
                teamMode: '2v2',
                seatOrder: ['0', '1', '2', '3'],
                turnOrder: ['0', '1', '2', '3'],
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                    '2': makePlayer('2'),
                    '3': makePlayer('3'),
                },
                bases: [makeBase('base_the_mothership')],
            });
            const stateForAi = makeMatchState(core);

            const options = buildPlayerTargetOptions(
                [
                    { id: 'ally', label: '队友', targetPlayerId: '2', displayMode: 'button' as const },
                    { id: 'enemy', label: '敌人', targetPlayerId: '1', displayMode: 'button' as const },
                ],
                {
                    state: core,
                    sourcePlayerId: '0',
                    effectIntent,
                },
            );

            expect(options.find((option) => option.value.targetPlayerId === '2')?._ai?.relationToActor).toBe('ally');
            expect(options.find((option) => option.value.targetPlayerId === '1')?._ai?.relationToActor).toBe('enemy');

            const interaction = createSimpleChoice(
                `smashup-ai-team-player-target-${effectIntent}`,
                '0',
                effectIntent === 'buff' ? '选择获得增益的队友' : '选择承受减益的敌人',
                options,
                {
                    sourceId: `smashup_ai_team_player_target_${effectIntent}`,
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

        for (const effectIntent of ['buff', 'debuff'] as const) {
            const stateForAi = buildTeamStateWithPlayerTargetInteraction(effectIntent);
            const legalActions = buildSmashUpAiLegalActions({
                playerId: '0',
                state: stateForAi,
            });
            const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
                gameId: 'smashup',
                matchId: `test-smashup-ai-team-player-target-${effectIntent}`,
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
            expect((chosenAction?.metadata?.optionValue as { targetPlayerId?: string } | undefined)?.targetPlayerId).toBe(
                effectIntent === 'buff' ? '2' : '1',
            );
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
        const broadsideBasePrompt = getSimpleChoicePrompt(state, 'pirate_broadside_choose_base');

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

        const baseOption = getPromptOption(broadsideBasePrompt, option => option?.value?.baseIndex === 0);

        const baseRespondResult = runCommand(state, {
            ...respondCommand(baseOption.id, '0'),
            timestamp: 89,
        } as any, FIXED_RANDOM);
        const stateAfterChooseBase = baseRespondResult.finalState;

        getSimpleChoicePrompt(stateAfterChooseBase, 'pirate_broadside_choose_player');

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

    it('线上高动作密度决策不跑全量相对效用投影，避免恢复链长时间占用服务端 CPU', async () => {
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
            matchId: 'test-smashup-online-ai-candidate-loop-density',
            playerId: '0',
            visibleState: stateForAi,
            interaction: null,
            responseWindow: null,
            legalActions,
            rulesVersion: null,
            decisionBudgetMs: 250,
            difficulty: resolveAiDifficultyProfile('expert'),
            source: 'online',
        });
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            searched?: boolean;
            contributions: Array<{ scorerId: string }>;
        }>;

        expect(evaluations.length).toBe(legalActions.length);
        expect(evaluations.some((item) => item.searched === true)).toBe(true);
        expect(
            evaluations.some((item) => item.contributions.some((contribution) => contribution.scorerId === 'relative-utility-smashup-limited')),
        ).toBe(false);
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
            responseWindow: null,
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
                ...respondCommand((resolution?.action.commands[0]?.payload as any)?.optionId, '0'),
                playerId: '0',
                payload: resolution?.action.commands[0]?.payload ?? {},
                timestamp: Date.now(),
            } as any,
            FIXED_RANDOM,
            PLAYER_IDS,
        );

        expect(followUp.success).toBe(true);
    });

    it('smashup_reaction_choose 只剩 legacy 空壳 mirror 时，AI 仍应暴露 advance-phase', () => {
        const stateForAi = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.DINOSAURS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase()],
        }), 'playCards', '0');

        stateForAi.sys.responseWindow = {
            current: {
                id: 'legacy-empty-shell-window',
                sourceId: 'smashup_reaction_choose',
                windowType: 'afterScoring',
                responderQueue: [],
                currentResponderIndex: 0,
            },
            history: [],
        } as any;

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });

        expect(legalActions.some((action) => action.kind === 'advance-phase')).toBe(true);
        expect(legalActions.some((action) => action.kind === 'response-pass')).toBe(false);
    });

    it('smashup_reaction_choose mirror 的 responderQueue 被 ghost 污染时，AI 仍应按 live reaction session 暴露 response-pass', () => {
        const core = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.DINOSAURS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_pirate_cove',
                minions: [],
            })],
        });
        const stateForAi = attachReactionSession(makeMatchState(core), {
            frameId: 'score-before:0:smoke-ghost-mirror-response-pass',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'afterScoring',
        });

        stateForAi.sys.responseWindow = {
            current: {
                id: 'ghost-polluted-mirror-window',
                sourceId: 'smashup_reaction_choose',
                windowType: 'afterScoring',
                responderQueue: ['ghost', '0', '1'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
            history: [],
        } as any;

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateForAi,
        });

        expect(legalActions.some((action) => action.kind === 'response-pass')).toBe(true);
        expect(legalActions.some((action) => action.kind === 'advance-phase')).toBe(false);
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
            responseWindow: null,
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
        const step1Prompt = getSimpleChoicePrompt(played.finalState);
        const replacementOption = getPromptOption(step1Prompt, entry => entry.value?.newBaseDefId === 'base_new');
        const step2 = runCommand(
            played.finalState,
            {
                ...respondCommand(replacementOption.id, '0'),
            } as any,
            FIXED_RANDOM,
        );
        const step2Prompt = getSimpleChoicePrompt(step2.finalState);
        const titanOption = getPromptOption(step2Prompt, opt => opt.value?.titanUid === 't1');
        expect(titanOption.value).toMatchObject({
            titanUid: 't1',
            defId: 'tricksters_big_funny_giant',
            playKind: 'minion',
        });

        const step3 = runCommand(
            step2.finalState,
            {
                ...respondCommand(titanOption.id, '0'),
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
        getSimpleChoicePrompt(playResult.finalState, 'dino_augmentation');

        const resolved = resolveInteractionChain(playResult.finalState, (prompt) => {
            const sourceId = getPromptSourceId(prompt);
            if (sourceId === 'dino_augmentation') {
                const option = getPromptOption(prompt, entry => entry?.value?.minionUid === 'dino-target');
                return { optionId: option.id };
            }
            if (sourceId === 'smashup_reaction_choose') {
                const triggerById = new Map(
                    (prompt?.state?.core?.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]),
                );
                const option = getPromptOptions(prompt).find((entry: any) => {
                    const trigger = triggerById.get(entry?.value?.triggerId);
                    return trigger?.sourceDefId === 'dinosaurs_fort_titanosaurus';
                }) ?? getPromptOptions(prompt)[0];
                expect(option).toBeDefined();
                return { optionId: option.id };
            }
            if (sourceId === 'titan_dinosaurs_fort_titanosaurus_ongoing') {
                const option = getPromptOption(
                    prompt,
                    entry => entry?.value?.mode === 'both' && entry?.value?.targetMinionUid === 'dino-target',
                );
                return { optionId: option.id };
            }
            throw new Error(`未处理的 Fort Titanosaurus 交互: ${sourceId ?? 'unknown'}`);
        }, FIXED_RANDOM);

        expectNoPrompt(resolved.finalState);

        const finalCore = resolved.finalState.core;
        const target = finalCore.bases[0].minions.find(minion => minion.uid === 'dino-target');
        const titan = (finalCore.titans ?? []).find(candidate => candidate.uid === 't-fort');

        expect(target?.tempPowerModifier).toBe(4);
        expect(target?.powerCounters).toBe(1);
        expect(titan?.powerCounters).toBe(4);
        expect((titan?.metadata as { fortTitanosaurusTriggeredTurn?: number } | undefined)?.fortTitanosaurusTriggeredTurn)
            .toBe(finalCore.turnNumber);
    });

    it('titan_dinosaurs_fort_titanosaurus_special 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 消灭随从或进场', () => {
        const promptCore = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.DINOSAURS, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    minions: [makeMinion('fort-special-food', 'dino_armor_stego', '0', 3)],
                }),
                makeBase(),
            ],
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
        });

        const state = makeMatchState(promptCore);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-fort-special-stale', baseIndex: 0 },
            timestamp: 50.2,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        expect(SmashUpDomain.execute(state, command, FIXED_RANDOM)).toEqual([]);

        const prompt = getSimpleChoicePrompt(state, 'titan_dinosaurs_fort_titanosaurus_special');
        expect(getPromptOption(prompt, entry => entry.value?.minionUid === 'fort-special-food')).toBeDefined();

        const staleCore: SmashUpCore = {
            ...state.core,
            titans: (state.core.titans ?? []).map(titan => titan.uid !== 't-fort-special-stale' ? titan : {
                ...titan,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            }),
        };

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.minionUid === 'fort-special-food',
            'Fort Titanosaurus stale special minion option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_DESTROYED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_PLAYED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED }),
        ]));
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('fort-special-food');
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-fort-special-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('titan_dinosaurs_fort_titanosaurus_ongoing 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 放置指示物或写 metadata', () => {
        const initial = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('action-stale', 'dino_augmentation_pod', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.DINOSAURS_POD, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_jungle',
                minions: [
                    makeMinion('dino-target', 'dino_war_raptor_pod', '0', 2),
                    makeMinion('dino-helper', 'dino_laser_triceratops_pod', '0', 4),
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

        const played = runCommand(initial, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'action-stale', targetBaseIndex: 0 },
            timestamp: 51,
        } as any, FIXED_RANDOM);

        expect(played.success).toBe(true);
        const chooseActionResult = respondToPromptOption(
            played.finalState,
            entry => entry?.value?.minionUid === 'dino-target',
            'Fort Titanosaurus stale dino augmentation target',
            '0',
            FIXED_RANDOM,
        );

        let ongoingState = chooseActionResult.finalState;
        const reactionChoicePrompt = getOptionalSimpleChoicePrompt(ongoingState, 'smashup_reaction_choose');
        if (reactionChoicePrompt) {
            const fortOption = getReactionPromptOptionBySourceDefId(
                ongoingState,
                reactionChoicePrompt,
                'dinosaurs_fort_titanosaurus',
            );
            const afterChoose = runCommand(
                ongoingState,
                respondCommand(fortOption.id, '0'),
                FIXED_RANDOM,
            );
            ongoingState = afterChoose.finalState;
        }

        const prompt = getSimpleChoicePrompt(ongoingState, 'titan_dinosaurs_fort_titanosaurus_ongoing');
        expect(getPromptOption(prompt, entry => entry?.value?.mode === 'titan')).toBeDefined();

        const staleCore = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.DINOSAURS_POD, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_jungle',
                minions: [
                    makeMinion('dino-target', 'dino_war_raptor_pod', '0', 2),
                    makeMinion('dino-helper', 'dino_laser_triceratops_pod', '0', 4),
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
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const resolved = respondToPromptOption(
            { ...ongoingState, core: staleCore },
            entry => entry?.value?.mode === 'titan',
            'Fort Titanosaurus stale titan-only option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_METADATA_UPDATED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED }),
        ]));
        expect((resolved.finalState.core.titans ?? []).find(candidate => candidate.uid === 't-fort-stale')).toMatchObject({
            location: { zone: 'setaside' },
            powerCounters: 3,
        });
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

        const current = getSimpleChoicePrompt(ms, 'titan_cthulhu_cthulhu_titan_talent_target');

        expect(getPromptOption(current, option => option?.value?.targetPlayerId === '1', 'Cthulhu Titan target player option')).toBeDefined();
        const response = respondToPromptOption(
            ms,
            option => option?.value?.targetPlayerId === '1',
            'Cthulhu Titan target player option',
            '0',
            FIXED_RANDOM,
        );
        expect(response.events.some(event => event.type === SU_EVENTS.CARD_TRANSFERRED)).toBe(true);

        const finalCore = response.finalState.core;
        const titan = (finalCore.titans ?? []).find(candidate => candidate.uid === 't-cthulhu');

        expect(finalCore.players['0'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(0);
        expect(finalCore.players['1'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(1);
        expect(titan?.powerCounters).toBe(0);
    });

    it('titan_cthulhu_cthulhu_titan_talent_target 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 把 Madness 交给对手', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('madness-hand', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 't-cthulhu-stale',
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

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-cthulhu-stale', baseIndex: 0 },
            timestamp: 44,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const prompt = getSimpleChoicePrompt(state, 'titan_cthulhu_cthulhu_titan_talent_target');
        expect(getPromptOption(prompt, entry => entry.value?.targetPlayerId === '1')).toBeDefined();

        const staleCore: SmashUpCore = {
            ...state.core,
            titans: (state.core.titans ?? []).map(titan => titan.uid !== 't-cthulhu-stale' ? titan : {
                ...titan,
                talentUsed: true,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.targetPlayerId === '1',
            'Cthulhu Titan stale target player option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARD_TRANSFERRED }),
        ]));
        expect(resolved.finalState.core.players['0'].hand.filter(card => card.uid === 'madness-hand')).toHaveLength(1);
        expect(resolved.finalState.core.players['1'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(0);
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
        expect(getPromptSourceId(getSimpleChoicePrompt(stateWithCounters, 'titan_giant_ants_death_on_six_legs_special')))
            .toBe('titan_giant_ants_death_on_six_legs_special');
    });

    it('titan_giant_ants_death_on_six_legs_special 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 弃牌或进场', () => {
        const promptCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('six-legs-discard', 'wizard_summon', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    minions: [
                        makeMinion('ant-queen', 'giant_ant_queen', '0', 3, { powerCounters: 7 }),
                    ],
                }),
                makeBase(),
            ],
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
        });

        const state = makeMatchState(promptCore);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-six-legs-stale', baseIndex: 0 },
            timestamp: 50.1,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        expect(SmashUpDomain.execute(state, command, FIXED_RANDOM)).toEqual([]);

        const prompt = getSimpleChoicePrompt(state, 'titan_giant_ants_death_on_six_legs_special');
        expect(getPromptOption(prompt, entry => entry.value?.cardUid === 'six-legs-discard')).toBeDefined();

        const staleCore: SmashUpCore = {
            ...state.core,
            titans: (state.core.titans ?? []).map(titan => titan.uid !== 't-six-legs-stale' ? titan : {
                ...titan,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            }),
        };

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.cardUid === 'six-legs-discard',
            'Six Legs stale discard option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARDS_DISCARDED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_PLAYED }),
        ]));
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('six-legs-discard');
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-six-legs-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
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
        expect(getSimpleChoicePrompt(state, 'titan_bear_cavalry_major_ursa_choose_destination')).toBeDefined();
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

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-ursa', baseIndex: 0 },
            timestamp: 62,
        };

        const validation = SmashUpDomain.validate(state, command);
        expect(validation.valid).toBe(true);

        const events = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_POWER_COUNTER_ADDED);

        expect(getPromptOption(
            getSimpleChoicePrompt(state, 'titan_bear_cavalry_major_ursa_choose_destination'),
            entry => entry.value?.baseIndex === 1,
            'Major Ursa destination option',
        )).toBeDefined();

        const destinationResult = respondToPromptOption(
            state,
            entry => entry.value?.baseIndex === 1,
            'Major Ursa destination option',
            '0',
            FIXED_RANDOM,
        );
        expect(destinationResult.events.some(event => event.type === SU_EVENTS.TITAN_MOVED)).toBe(true);
        let reactionState = destinationResult.finalState;

        const reactionChoicePrompt = getOptionalSimpleChoicePrompt(reactionState, 'smashup_reaction_choose');
        if (reactionChoicePrompt) {
            const ursaOption = getReactionPromptOptionBySourceDefId(reactionState, reactionChoicePrompt, 'bear_cavalry_major_ursa');

            const afterChoose = runCommand(
                reactionState,
                respondCommand(ursaOption.id, '0'),
                FIXED_RANDOM,
            );
            reactionState = afterChoose.finalState;
        }

        const minionPrompt = getSimpleChoicePrompt(reactionState, 'titan_bear_cavalry_major_ursa_choose_minion');
        expect(getPromptOption(minionPrompt, entry => entry.value?.minionUid === 'enemy-minion')).toBeDefined();

        const chooseMinionResult = respondToPromptOption(
            reactionState,
            entry => entry.value?.minionUid === 'enemy-minion',
            'Major Ursa moved-minion option',
            '0',
            FIXED_RANDOM,
        );
        const chooseBasePrompt = getSimpleChoicePrompt(chooseMinionResult.finalState, 'titan_bear_cavalry_major_ursa_choose_base');
        expect(getPromptOption(chooseBasePrompt, entry => entry.value?.baseIndex === 2)).toBeDefined();

        const chooseBaseResult = respondToPromptOption(
            chooseMinionResult.finalState,
            entry => entry.value?.baseIndex === 2,
            'Major Ursa choose-base option',
            '0',
            FIXED_RANDOM,
        );
        expect(chooseBaseResult.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(true);
        expect((chooseBaseResult.events.find(event => event.type === SU_EVENTS.MINION_MOVED) as any)?.payload).toMatchObject({
            minionUid: 'enemy-minion',
            fromBaseIndex: 1,
            toBaseIndex: 2,
        });

        const finalCore = chooseBaseResult.finalState.core;
        expect(finalCore.bases[2].minions.find(minion => minion.uid === 'enemy-minion')?.controller).toBe('1');
    });

    it('titan_bear_cavalry_major_ursa_choose_destination 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 移动泰坦', () => {
        const promptCore = makeState({
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

        const state = makeMatchState(promptCore, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-ursa-stale', baseIndex: 0 },
            timestamp: 63,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(commandEvents.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);

        const prompt = getSimpleChoicePrompt(state, 'titan_bear_cavalry_major_ursa_choose_destination');
        expect(getPromptOption(prompt, entry => entry.value?.baseIndex === 1)).toBeDefined();

        const staleCore = makeState({
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-ursa-stale',
                defId: 'bear_cavalry_major_ursa',
                faction: SMASHUP_FACTION_IDS.BEAR_CAVALRY,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 1,
                talentUsed: true,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const destinationResult = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.baseIndex === 1,
            'Major Ursa stale destination option',
            '0',
            FIXED_RANDOM,
        );

        expect(destinationResult.success, destinationResult.error).toBe(true);
        expect(destinationResult.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_MOVED }),
        ]));
        expect(destinationResult.finalState.core.titans?.find(candidate => candidate.uid === 't-ursa-stale')).toMatchObject({
            location: { zone: 'setaside' },
        });
    });

    it('titan_bear_cavalry_major_ursa_choose_minion 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 进入目标基地选择', () => {
        const promptCore = makeState({
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

        const state = makeMatchState(promptCore, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-ursa-first-stale', baseIndex: 0 },
            timestamp: 64,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(commandEvents.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);

        const destinationResult = respondToPromptOption(
            state,
            entry => entry.value?.baseIndex === 1,
            'Major Ursa stale first destination option',
            '0',
            FIXED_RANDOM,
        );
        let reactionState = destinationResult.finalState;

        const reactionChoicePrompt = getOptionalSimpleChoicePrompt(reactionState, 'smashup_reaction_choose');
        if (reactionChoicePrompt) {
            const ursaOption = getReactionPromptOptionBySourceDefId(reactionState, reactionChoicePrompt, 'bear_cavalry_major_ursa');
            const afterChoose = runCommand(
                reactionState,
                respondCommand(ursaOption.id, '0'),
                FIXED_RANDOM,
            );
            reactionState = afterChoose.finalState;
        }

        const prompt = getSimpleChoicePrompt(reactionState, 'titan_bear_cavalry_major_ursa_choose_minion');
        expect(getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-minion')).toBeDefined();

        const staleCore = makeState({
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
                powerCounters: 2,
                talentUsed: true,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const chooseMinionResult = respondToPromptOption(
            { ...reactionState, core: staleCore },
            entry => entry.value?.minionUid === 'enemy-minion',
            'Major Ursa stale moved-minion option',
            '0',
            FIXED_RANDOM,
        );

        expect(chooseMinionResult.success, chooseMinionResult.error).toBe(true);
        expect(getOptionalSimpleChoicePrompt(
            chooseMinionResult.finalState,
            'titan_bear_cavalry_major_ursa_choose_base',
        )).toBeUndefined();
        expect(chooseMinionResult.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_MOVED }),
        ]));
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

        expect(getPromptsBySourceId(triggerResult.matchState!, 'titan_changerbots_mergacon_play')).toHaveLength(1);
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

        const triggerResult = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            FIXED_RANDOM,
            now: 79,
        });
        const currentInteraction = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_changerbots_mergacon_play');
        expect(getPromptOption(currentInteraction, entry => entry.value?.baseIndex === 0)).toBeDefined();

        const resolved = respondToPromptOption(
            triggerResult.matchState!,
            entry => entry.value?.baseIndex === 0,
            'Mergacon play base option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.events.some(event => event.type === SU_EVENTS.TITAN_PLAYED)).toBe(true);

        const next = resolved.finalState.core;
        expect(next.titans?.find(candidate => candidate.uid === 't-mergacon-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('titan_changerbots_mergacon_play 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 进场', () => {
        const promptCore = makeState({
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
                uid: 't-mergacon-setaside-stale',
                defId: 'changerbots_mergacon',
                faction: SMASHUP_FACTION_IDS.CHANGERBOTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const triggerResult = fireTriggers(promptCore, 'onTurnStart', {
            state: promptCore,
            matchState: makeMatchState(promptCore, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 79.1,
        });
        const prompt = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_changerbots_mergacon_play');
        expect(getPromptOption(prompt, entry => entry.value?.baseIndex === 0)).toBeDefined();

        const staleCore: SmashUpCore = {
            ...triggerResult.matchState!.core,
            titans: (triggerResult.matchState!.core.titans ?? []).map(titan => titan.uid !== 't-mergacon-setaside-stale' ? titan : {
                ...titan,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }),
        };

        const resolved = respondToPromptOption(
            { ...triggerResult.matchState!, core: staleCore },
            entry => entry.value?.baseIndex === 0,
            'Mergacon stale play base option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_PLAYED }),
        ]));
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-mergacon-setaside-stale')?.location).toMatchObject({
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
        const prompt = getSimpleChoicePrompt(state, 'titan_changerbots_mergacon_talent');

        expect(getPromptOption(prompt, entry => entry.value?.baseIndex === 1)).toBeDefined();
        const resolved = respondToPromptOption(
            state,
            entry => entry.value?.baseIndex === 1,
            'Mergacon talent base option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.events.map(event => event.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.TITAN_ONGOING_SUPPRESSED,
            SU_EVENTS.TITAN_MOVED,
        ]));

        const next = resolved.finalState.core;
        expect(next.titanOngoingSuppressedUntilTurnEnd).toContain('t-mergacon');
        expect(next.titans?.find(candidate => candidate.uid === 't-mergacon')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('titan_changerbots_mergacon_talent 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 压制并移动泰坦', () => {
        const core = makeState({
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-mergacon-stale',
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
            payload: { titanUid: 't-mergacon-stale', baseIndex: 0 },
            timestamp: 83,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const prompt = getSimpleChoicePrompt(state, 'titan_changerbots_mergacon_talent');
        expect(getPromptOption(prompt, entry => entry.value?.baseIndex === 1)).toBeDefined();

        const staleCore: SmashUpCore = {
            ...state.core,
            titans: (state.core.titans ?? []).map(titan => titan.uid !== 't-mergacon-stale' ? titan : {
                ...titan,
                talentUsed: true,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.baseIndex === 1,
            'Mergacon stale talent base option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_ONGOING_SUPPRESSED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_MOVED }),
        ]));
        expect(resolved.finalState.core.titanOngoingSuppressedUntilTurnEnd ?? []).not.toContain('t-mergacon-stale');
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 't-mergacon-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
    });

    it('彩虹鸟的替换基地 special 会在 scoreBases 收尾时真正把泰坦落到新基地', () => {
        const core = makeState({
            bases: [
                makeBase({ defId: 'base_the_homeworld' }),
                makeBase({ defId: 'base_the_mothership' }),
            ],
            baseDeck: ['base_the_factory'],
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
                        newBaseDefId: 'base_the_factory',
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
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 85 } as any,
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
        expect(finalCore.bases[0].defId).toBe('base_the_factory');
    });

    it('titan_itty_critters_rainboroc_play_replacement 的 source titan 若在响应前已离开牌库旁，不应继续预约替换基地进场', () => {
        const core = makeState({
            bases: [
                makeBase({ defId: 'base_the_homeworld' }),
                makeBase({ defId: 'base_the_mothership' }),
            ],
            baseDeck: ['base_the_factory'],
            titans: [{
                uid: 't-rainboroc-setaside-stale',
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
            throw new Error('无法构造彩虹鸟 stale 替换基地 scoring base ref');
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
                    timestamp: 85.1,
                },
                {
                    type: SU_EVENTS.BASE_REPLACED,
                    payload: {
                        baseIndex: 0,
                        oldBaseDefId: core.bases[0].defId,
                        newBaseDefId: 'base_the_factory',
                    },
                    timestamp: 85.1,
                },
            ],
        });

        const staleState = {
            ...state,
            core: {
                ...state.core,
                titans: (state.core.titans ?? []).map(titan => titan.uid !== 't-rainboroc-setaside-stale' ? titan : {
                    ...titan,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                }),
            },
        };

        const smashUpEventSystem = createSmashUpEventSystem();
        const hook = smashUpEventSystem.afterEvents?.({
            state: staleState,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'test-rainboroc-play-stale',
                    playerId: '0',
                    optionId: 'play',
                    value: { play: true },
                    sourceId: 'titan_itty_critters_rainboroc_play_replacement',
                    interactionData: {
                        sourceId: 'titan_itty_critters_rainboroc_play_replacement',
                        continuationContext: {
                            titanUid: 't-rainboroc-setaside-stale',
                            titanDefId: 'itty_critters_rainboroc',
                            scoringBaseIndex: 0,
                        },
                    },
                },
                timestamp: 85.1,
            } as any],
            random: FIXED_RANDOM,
        }) as any;

        expect(hook?.events ?? []).toEqual([]);
        expect(consumeScoringFrameDeferredPayload(hook?.state ?? staleState).deferredActions).toEqual([]);

        const finalize = smashUpFlowHooks.onPhaseExit?.({
            state: hook?.state ?? staleState,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 85.1 } as any,
            random: FIXED_RANDOM,
        });
        const finalizeEvents = Array.isArray(finalize) ? finalize : (finalize as any)?.events ?? [];
        expect(finalizeEvents.map((event: SmashUpEvent) => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
        ]);

        const finalCore = finalizeEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            (hook?.state ?? staleState).core,
        );
        expect(finalCore.titans?.find(candidate => candidate.uid === 't-rainboroc-setaside-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
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
        const chooseDiscardPrompt = getSimpleChoicePrompt(state, 'titan_itty_critters_rainboroc_choose_discard');

        expect(getPromptOption(chooseDiscardPrompt, entry => entry.value?.cardUid === 'rain-discard-minion')).toBeDefined();
        const chooseDiscardResult = respondToPromptOption(
            state,
            entry => entry.value?.cardUid === 'rain-discard-minion',
            'Rainboroc discard option',
            '0',
            FIXED_RANDOM,
        );
        expect(chooseDiscardResult.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        const chooseBasePrompt = getSimpleChoicePrompt(chooseDiscardResult.finalState, 'titan_itty_critters_rainboroc_choose_base');

        const afterShuffle = chooseDiscardResult.finalState.core;
        expect(afterShuffle.players['0'].discard.map(card => card.uid)).not.toContain('rain-discard-minion');
        expect(afterShuffle.players['0'].deck.map(card => card.uid)).toContain('rain-discard-minion');

        expect(getPromptOption(chooseBasePrompt, entry => entry.value?.baseIndex === 1)).toBeDefined();
        const chooseBaseResult = respondToPromptOption(
            chooseDiscardResult.finalState,
            entry => entry.value?.baseIndex === 1,
            'Rainboroc choose-base option',
            '0',
            FIXED_RANDOM,
        );
        expect(chooseBaseResult.events.some(event => event.type === SU_EVENTS.TITAN_MOVED)).toBe(true);

        const resolved = chooseBaseResult.finalState.core;
        expect(resolved.titans?.find(candidate => candidate.uid === 't-rainboroc')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('彩虹鸟选择被他人拥有的弃牌随从时，仍应洗回其拥有者牌库而不是当前玩家牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('rain-borrowed-discard-minion', 'pirate_first_mate', 'minion', '1')],
                    deck: [makeCard('p0-deck-a', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-a', 'wizard_archmage', 'minion', '1')],
                }),
            },
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-rainboroc-borrowed-discard',
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
            payload: { titanUid: 't-rainboroc-borrowed-discard', baseIndex: 0 },
            timestamp: 88,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const chooseDiscardPrompt = getSimpleChoicePrompt(state, 'titan_itty_critters_rainboroc_choose_discard');
        const chooseDiscardResult = respondToPromptOption(
            state,
            entry => entry.value?.cardUid === 'rain-borrowed-discard-minion',
            'Rainboroc borrowed discard option',
            '0',
            FIXED_RANDOM,
        );

        expect(chooseDiscardResult.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({
                playerId: '1',
                sourcePlayerId: '0',
            }),
        }));

        const afterShuffle = chooseDiscardResult.finalState.core;
        expect(afterShuffle.players['0'].discard.map(card => card.uid)).not.toContain('rain-borrowed-discard-minion');
        expect(afterShuffle.players['0'].deck.map(card => card.uid)).not.toContain('rain-borrowed-discard-minion');
        expect(afterShuffle.players['1'].deck.map(card => card.uid)).toContain('rain-borrowed-discard-minion');
    });

    it('titan_itty_critters_rainboroc_choose_base 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 移动泰坦', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('rain-stale-card', 'pirate_first_mate', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-rainboroc-stale',
                defId: 'itty_critters_rainboroc',
                faction: SMASHUP_FACTION_IDS.ITTY_CRITTERS,
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
            payload: { titanUid: 't-rainboroc-stale', baseIndex: 0 },
            timestamp: 89,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const chooseDiscardResult = respondToPromptOption(
            state,
            entry => entry.value?.cardUid === 'rain-stale-card',
            'Rainboroc stale discard option',
            '0',
            FIXED_RANDOM,
        );
        expect(chooseDiscardResult.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);

        const chooseBasePrompt = getSimpleChoicePrompt(chooseDiscardResult.finalState, 'titan_itty_critters_rainboroc_choose_base');
        expect(getPromptOption(chooseBasePrompt, entry => entry.value?.baseIndex === 1)).toBeDefined();

        const staleCore: SmashUpCore = {
            ...chooseDiscardResult.finalState.core,
            titans: (chooseDiscardResult.finalState.core.titans ?? []).map(titan => titan.uid !== 't-rainboroc-stale' ? titan : {
                ...titan,
                talentUsed: true,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...chooseDiscardResult.finalState, core: staleCore },
            entry => entry.value?.baseIndex === 1,
            'Rainboroc stale choose-base option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_MOVED }),
        ]));
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 't-rainboroc-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
    });

    it('titan_killer_plants_killer_kudzu_talent_base 的 source titan 若在响应前已离场，不应继续沿旧 prompt 移除泰坦或从弃牌堆打出随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('kudzu-discard-minion', 'pirate_first_mate', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
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
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-kudzu-stale', baseIndex: 0 },
            timestamp: 89.5,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const chooseDiscardPrompt = getSimpleChoicePrompt(state, 'titan_killer_plants_killer_kudzu_talent');
        expect(getPromptOption(chooseDiscardPrompt, entry => entry.value?.cardUid === 'kudzu-discard-minion')).toBeDefined();

        const chooseDiscardResult = respondToPromptOption(
            state,
            entry => entry.value?.cardUid === 'kudzu-discard-minion',
            'Killer Kudzu stale discard option',
            '0',
            FIXED_RANDOM,
        );
        const chooseBasePrompt = getSimpleChoicePrompt(
            chooseDiscardResult.finalState,
            'titan_killer_plants_killer_kudzu_talent_base',
        );
        expect(getPromptOption(chooseBasePrompt, entry => entry.value?.baseIndex === 1)).toBeDefined();

        const staleCore: SmashUpCore = {
            ...chooseDiscardResult.finalState.core,
            titans: (chooseDiscardResult.finalState.core.titans ?? []).map(titan => titan.uid !== 't-kudzu-stale' ? titan : {
                ...titan,
                talentUsed: true,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...chooseDiscardResult.finalState, core: staleCore },
            entry => entry.value?.baseIndex === 1,
            'Killer Kudzu stale choose-base option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_REMOVED_FROM_PLAY }),
            expect.objectContaining({ type: SU_EVENTS.MINION_PLAYED }),
        ]));
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 't-kudzu-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('kudzu-discard-minion');
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
        const drawPrompt = getSimpleChoicePrompt(result.finalState, 'titan_kaiju_gorgodzolla_draw');
        expect(getPromptOption(drawPrompt, entry => entry.value?.draw === true)).toBeDefined();
        expect(result.finalState.core.titans?.find(candidate => candidate.uid === 't-gorgodzolla')?.powerCounters).toBe(1);

        const drawResult = respondToPromptOption(
            result.finalState,
            entry => entry.value?.draw === true,
            'Gorgodzolla draw option',
            '0',
            FIXED_RANDOM,
        );

        expect(drawResult.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        const resolved = drawResult.finalState.core;
        expect(resolved.players['0'].hand.map(card => card.uid)).toContain('gorg-draw-card');
    });

    it('titan_kaiju_gorgodzolla_draw 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 抽牌', () => {
        const promptCore = makeState({
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
        });

        const promptResult = runCommand(
            makeMatchState(promptCore),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'gorg-action', targetBaseIndex: 0 },
                timestamp: 95,
            },
            FIXED_RANDOM,
        );

        expect(promptResult.success).toBe(true);
        const drawPrompt = getSimpleChoicePrompt(promptResult.finalState, 'titan_kaiju_gorgodzolla_draw');
        expect(getPromptOption(drawPrompt, entry => entry.value?.draw === true)).toBeDefined();

        const staleCore = makeState({
            players: {
                '0': makePlayer('0', {
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
                powerCounters: 1,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const drawResult = respondToPromptOption(
            { ...promptResult.finalState, core: staleCore },
            entry => entry.value?.draw === true,
            'Gorgodzolla stale draw option',
            '0',
            FIXED_RANDOM,
        );

        expect(drawResult.success, drawResult.error).toBe(true);
        expect(drawResult.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN }),
        ]));
        expect(drawResult.finalState.core.titans?.find(candidate => candidate.uid === 't-gorgodzolla-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
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
                        makeMinion('castle-borrowed-a', 'ghosts_spectre', '0', 2, '1'),
                        makeMinion('castle-borrowed-b', 'pirate_first_mate', '0', 2, '1'),
                    ],
                }),
                makeBase({
                    minions: [makeMinion('castle-only-one', 'ghosts_spectre', '0', 2, '1')],
                }),
            ],
            titans: [{
                uid: 't-walking-castle-borrowed',
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
            payload: { titanUid: 't-walking-castle-borrowed', baseIndex: 0 },
            timestamp: 98,
        };
        const invalidCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-walking-castle-borrowed', baseIndex: 1 },
            timestamp: 99,
        };

        expect(SmashUpDomain.validate(state, validCommand).valid).toBe(true);
        expect(SmashUpDomain.validate(state, invalidCommand).valid).toBe(false);

        const events = SmashUpDomain.execute(state, validCommand, FIXED_RANDOM);
        expect(events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);

        const resolved = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        expect(resolved.titans?.find(candidate => candidate.uid === 't-walking-castle-borrowed')).toEqual(expect.objectContaining({
            ownerId: '1',
            controllerId: '0',
            location: expect.objectContaining({
                zone: 'base',
                baseIndex: 0,
            }),
        }));
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
        const moveResult = resolveMovedMinions(state, '1', [{
            minionUid: 'moved-away',
            minionDefId: 'trickster_gnome',
            fromBaseIndex: 0,
            toBaseIndex: 1,
            reason: 'test_move_from_boulder',
            timestamp: 99,
        }], FIXED_RANDOM, 99);

        const queuedCore = moveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            state.core,
        );
        const queuedState = {
            ...(moveResult.matchState ?? state),
            core: queuedCore,
        };
        const reactionResult = maybeResolveReactionQueue(queuedState, FIXED_RANDOM, 99);
        const boulderInteraction = getSimpleChoicePrompt(
            reactionResult!.state,
            'titan_explorers_very_large_boulder_move',
        );

        expect(reactionResult?.events.map(event => event.type)).toEqual([SU_EVENTS.TRIGGER_CONSUMED]);
        expect(getPromptSourceId(boulderInteraction)).toBe('titan_explorers_very_large_boulder_move');
        expect(getPromptPlayerId(boulderInteraction)).toBe('0');
        const reactionCommittedState = {
            ...reactionResult!.state,
            core: applyEvents(reactionResult!.state.core, reactionResult!.events),
        };
        expect(reactionCommittedState.core.veryLargeBoulderTriggeredTurnByTitan?.['t-boulder-live']).toBe(4);

        expect(getPromptOption(boulderInteraction, entry => entry.value?.move === true)).toBeDefined();
        const chooseMoveResult = respondToPromptOption(
            reactionCommittedState,
            entry => entry.value?.move === true,
            'Very Large Boulder move option',
            '0',
            FIXED_RANDOM,
        );
        expect(chooseMoveResult.events.some(event => event.type === SU_EVENTS.TITAN_MOVED)).toBe(true);

        const pendingDestroyInteraction = getOptionalSimpleChoicePrompt(
            chooseMoveResult.finalState,
            'titan_explorers_very_large_boulder_destroy',
        );
        const destroyResult =
            pendingDestroyInteraction
                ? respondToPromptOption(
                    chooseMoveResult.finalState,
                    entry => entry.value?.minionUid === 'boulder-target',
                    'Very Large Boulder destroy option',
                    '0',
                    FIXED_RANDOM,
                )
                : undefined;
        const destroyEvents = destroyResult?.events ?? [];
        const allEvents = [...chooseMoveResult.events, ...destroyEvents];
        expect(allEvents.map(event => event.type)).toContain(SU_EVENTS.MINION_DESTROYED);

        const resolved = destroyResult?.finalState.core ?? chooseMoveResult.finalState.core;
        expect(resolved.titans?.find(candidate => candidate.uid === 't-boulder-live')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
        expect(resolved.bases[1].minions.map(minion => minion.uid)).not.toContain('boulder-target');
        expect(resolved.bases[1].minions.map(minion => minion.uid)).toContain('boulder-safe');

        const secondMoveResult = resolveMovedMinions({ ...reactionResult!.state, core: resolved }, '1', [{
            minionUid: 'boulder-safe',
            minionDefId: 'trickster_gnome',
            fromBaseIndex: 1,
            toBaseIndex: 0,
            reason: 'test_move_same_turn_again',
            timestamp: 102,
        }], FIXED_RANDOM, 102);
        expect(secondMoveResult.events.map(event => event.type)).not.toContain(SU_EVENTS.TRIGGER_QUEUED);
    });

    it('titan_explorers_very_large_boulder_move 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 移动泰坦', () => {
        const promptCore = makeState({
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

        const state = makeMatchState(promptCore);
        const moveResult = resolveMovedMinions(state, '1', [{
            minionUid: 'moved-away',
            minionDefId: 'trickster_gnome',
            fromBaseIndex: 0,
            toBaseIndex: 1,
            reason: 'test_move_from_boulder_stale',
            timestamp: 100,
        }], FIXED_RANDOM, 100);

        const queuedCore = moveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            state.core,
        );
        const queuedState = {
            ...(moveResult.matchState ?? state),
            core: queuedCore,
        };
        const reactionResult = maybeResolveReactionQueue(queuedState, FIXED_RANDOM, 100);
        const prompt = getSimpleChoicePrompt(reactionResult!.state, 'titan_explorers_very_large_boulder_move');
        expect(getPromptOption(prompt, entry => entry.value?.move === true)).toBeDefined();

        const staleCore = makeState({
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
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const resolved = respondToPromptOption(
            { ...reactionResult!.state, core: staleCore },
            entry => entry.value?.move === true,
            'Very Large Boulder stale move option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_MOVED }),
        ]));
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-boulder-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
    });

    it('titan_explorers_very_large_boulder_destroy 的 source titan 若在响应前已离开目标基地，不应继续沿旧 prompt 消灭随从', () => {
        const promptCore = makeState({
            turnNumber: 4,
            bases: [
                makeBase({
                    minions: [makeMinion('moved-away', 'trickster_gnome', '1', 3)],
                }),
                makeBase({
                    minions: [
                        makeMinion('boulder-target-a', 'robot_microbot_guard', '1', 1),
                        makeMinion('boulder-target-b', 'ghosts_spectre', '1', 1),
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

        const state = makeMatchState(promptCore);
        const moveResult = resolveMovedMinions(state, '1', [{
            minionUid: 'moved-away',
            minionDefId: 'trickster_gnome',
            fromBaseIndex: 0,
            toBaseIndex: 1,
            reason: 'test_move_from_boulder_destroy_stale',
            timestamp: 101,
        }], FIXED_RANDOM, 101);

        const queuedCore = moveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            state.core,
        );
        const queuedState = {
            ...(moveResult.matchState ?? state),
            core: queuedCore,
        };
        const reactionResult = maybeResolveReactionQueue(queuedState, FIXED_RANDOM, 101);
        const chooseMoveResult = respondToPromptOption(
            reactionResult!.state,
            entry => entry.value?.move === true,
            'Very Large Boulder destroy-stale move option',
            '0',
            FIXED_RANDOM,
        );

        const destroyPrompt = getSimpleChoicePrompt(
            chooseMoveResult.finalState,
            'titan_explorers_very_large_boulder_destroy',
        );
        expect(getPromptOption(destroyPrompt, entry => entry.value?.minionUid === 'boulder-target-a')).toBeDefined();

        const staleCore = makeState({
            turnNumber: 4,
            bases: [
                makeBase({
                    minions: [makeMinion('moved-away', 'trickster_gnome', '1', 3)],
                }),
                makeBase({
                    minions: [
                        makeMinion('boulder-target-a', 'robot_microbot_guard', '1', 1),
                        makeMinion('boulder-target-b', 'ghosts_spectre', '1', 1),
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
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const resolved = respondToPromptOption(
            { ...chooseMoveResult.finalState, core: staleCore },
            entry => entry.value?.minionUid === 'boulder-target-a',
            'Very Large Boulder stale destroy option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_DESTROYED }),
        ]));
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toContain('boulder-target-a');
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

        const processed = resolveDestroyedMinions(matchState, '0', [destroyEvent], FIXED_RANDOM, 102);
        let reactionState = processed.matchState ?? matchState;

        if (!getOptionalSimpleChoicePrompt(reactionState)) {
            const reactionResult = maybeResolveReactionQueue(reactionState, FIXED_RANDOM, 102);
            reactionState = reactionResult?.state ?? reactionState;
        }

        const reactionChoicePrompt = getOptionalSimpleChoicePrompt(reactionState, 'smashup_reaction_choose');
        if (reactionChoicePrompt) {
            const ninjaOption = getReactionPromptOptionBySourceDefId(reactionState, reactionChoicePrompt, 'ninjas_invisible_ninja');

            const afterChooseTrigger = runCommand(
                reactionState,
                respondCommand(ninjaOption.id, '0'),
                FIXED_RANDOM,
            );
            reactionState = afterChooseTrigger.finalState;
        }

        const currentInteraction = getSimpleChoicePrompt(reactionState, 'titan_ninjas_invisible_ninja_ongoing');
        expect(getPromptPlayerId(currentInteraction)).toBe('0');

        const drawOption = getPromptOption(currentInteraction, option => option.value?.cardUid === 'ninja-draw-a', 'Invisible Ninja draw card option');
        const afterDraw = runCommand(
            reactionState,
            respondCommand(drawOption.id, '0'),
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

    it('titan_ninjas_invisible_ninja_ongoing 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 抽牌、洗回剩余揭示牌或写 metadata', () => {
        const promptCore = makeState({
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

        const matchState = makeMatchState(promptCore, 'playCards', '0');
        const destroyEvent: SmashUpEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'enemy-victim',
                minionDefId: 'pirate_first_mate',
                fromBaseIndex: 1,
                ownerId: '1',
                destroyerId: '0',
                reason: 'invisible_ninja_stale_destroy',
            },
            timestamp: 103,
        };

        const processed = resolveDestroyedMinions(matchState, '0', [destroyEvent], FIXED_RANDOM, 103);
        let reactionState = processed.matchState ?? matchState;

        if (!getOptionalSimpleChoicePrompt(reactionState)) {
            const reactionResult = maybeResolveReactionQueue(reactionState, FIXED_RANDOM, 103);
            reactionState = reactionResult?.state ?? reactionState;
        }

        const reactionChoicePrompt = getOptionalSimpleChoicePrompt(reactionState, 'smashup_reaction_choose');
        if (reactionChoicePrompt) {
            const ninjaOption = getReactionPromptOptionBySourceDefId(reactionState, reactionChoicePrompt, 'ninjas_invisible_ninja');
            const afterChooseTrigger = runCommand(
                reactionState,
                respondCommand(ninjaOption.id, '0'),
                FIXED_RANDOM,
            );
            reactionState = afterChooseTrigger.finalState;
        }

        const currentInteraction = getSimpleChoicePrompt(reactionState, 'titan_ninjas_invisible_ninja_ongoing');
        expect(getPromptOption(
            currentInteraction,
            option => option.value?.cardUid === 'ninja-draw-a',
            'Invisible Ninja stale draw card option',
        )).toBeDefined();

        const staleCore = makeState({
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
                uid: 't-invisible-ninja-stale',
                defId: 'ninjas_invisible_ninja',
                faction: SMASHUP_FACTION_IDS.NINJAS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const resolved = respondToPromptOption(
            { ...reactionState, core: staleCore },
            entry => entry.value?.cardUid === 'ninja-draw-a',
            'Invisible Ninja stale draw option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN }),
            expect.objectContaining({ type: SU_EVENTS.DECK_REORDERED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_METADATA_UPDATED }),
        ]));
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('ninja-draw-a');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['ninja-draw-a', 'ninja-draw-b']);
    });

    it('titan_ninjas_invisible_ninja_start_turn 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 自毁或授予额外随从额度', () => {
        const promptCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ninja-extra-minion', 'pirate_first_mate', 'minion', '0')],
                    minionLimit: 1,
                    minionsPlayed: 0,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                minions: [makeMinion('ninja-host', 'robot_microbot_alpha', '0', 2)],
            })],
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

        const triggerResult = fireTriggers(promptCore, 'onTurnStart', {
            state: promptCore,
            matchState: makeMatchState(promptCore, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 104,
        });

        const promptState = triggerResult.matchState!;
        const prompt = getSimpleChoicePrompt(promptState, 'titan_ninjas_invisible_ninja_start_turn');
        expect(getPromptOption(prompt, option => option.value?.destroyTitan === true, 'Invisible Ninja start-turn destroy option')).toBeDefined();

        const staleCore: SmashUpCore = {
            ...promptState.core,
            titans: (promptState.core.titans ?? []).map(titan => titan.uid !== 't-invisible-ninja-start-stale' ? titan : {
                ...titan,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...promptState, core: staleCore },
            entry => entry.value?.destroyTitan === true,
            'Invisible Ninja stale start-turn destroy option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_REMOVED_FROM_PLAY }),
            expect.objectContaining({ type: SU_EVENTS.LIMIT_MODIFIED }),
        ]));
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 't-invisible-ninja-start-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(promptState.core.players['0'].minionLimit);
        expect(resolved.finalState.core.players['0'].minionsPlayed).toBe(promptState.core.players['0'].minionsPlayed);
    });

    it('titan_ninjas_invisible_ninja_special 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 弃牌或进场', () => {
        const promptCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ninja-special-discard', 'wizard_summon', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                minions: [makeMinion('ninja-special-host', 'robot_microbot_alpha', '0', 1)],
            })],
            titans: [{
                uid: 't-invisible-ninja-special-stale',
                defId: 'ninjas_invisible_ninja',
                faction: SMASHUP_FACTION_IDS.NINJAS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                metadata: {
                    invisibleNinjaStartTurn: 1,
                    invisibleNinjaWasInPlayAtStart: false,
                },
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const state = makeMatchState(promptCore);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-invisible-ninja-special-stale', baseIndex: 0 },
            timestamp: 104,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(commandEvents).toEqual([]);

        const prompt = getSimpleChoicePrompt(state, 'titan_ninjas_invisible_ninja_special');
        expect(getPromptOption(prompt, entry => entry.value?.cardUid === 'ninja-special-discard')).toBeDefined();

        const staleCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ninja-special-discard', 'wizard_summon', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                minions: [makeMinion('ninja-special-host', 'robot_microbot_alpha', '0', 1)],
            })],
            titans: [{
                uid: 't-invisible-ninja-special-stale',
                defId: 'ninjas_invisible_ninja',
                faction: SMASHUP_FACTION_IDS.NINJAS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                metadata: {
                    invisibleNinjaStartTurn: 1,
                    invisibleNinjaWasInPlayAtStart: false,
                },
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.cardUid === 'ninja-special-discard',
            'Invisible Ninja stale special discard option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARDS_DISCARDED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_PLAYED }),
        ]));
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('ninja-special-discard');
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-invisible-ninja-special-stale')?.location).toMatchObject({
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
        const chooseBasePrompt = getSimpleChoicePrompt(state, 'titan_magical_girls_walking_castle_choose_base');

        expect(getPromptOption(chooseBasePrompt, entry => entry.value?.baseIndex === 1)).toBeDefined();
        const chooseBaseResult = respondToPromptOption(
            state,
            entry => entry.value?.baseIndex === 1,
            'Walking Castle choose-base option',
            '0',
            FIXED_RANDOM,
        );
        const chooseMinionsPrompt = getSimpleChoicePrompt(chooseBaseResult.finalState, 'titan_magical_girls_walking_castle_choose_minions');
        expect(getPromptOption(chooseMinionsPrompt, entry => entry.value?.minionUid === 'castle-move-a')).toBeDefined();
        expect(getPromptOption(chooseMinionsPrompt, entry => entry.value?.minionUid === 'castle-move-b')).toBeDefined();

        const chooseMinionsResult = respondToPromptOptions(
            chooseBaseResult.finalState,
            [
                getPromptOption(chooseMinionsPrompt, entry => entry.value?.minionUid === 'castle-move-a').id,
                getPromptOption(chooseMinionsPrompt, entry => entry.value?.minionUid === 'castle-move-b').id,
            ],
            '0',
            FIXED_RANDOM,
        );
        expect(chooseMinionsResult.events.map(event => event.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.TITAN_MOVED,
            SU_EVENTS.MINION_MOVED,
            SU_EVENTS.MINION_MOVED,
        ]));

        const resolved = chooseMinionsResult.finalState.core;
        expect(resolved.titans?.find(candidate => candidate.uid === 't-walking-castle-live')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
        expect(resolved.bases[1].minions.map(minion => minion.uid)).toEqual(
            expect.arrayContaining(['castle-move-a', 'castle-move-b']),
        );
        expect(resolved.bases[0].minions.map(minion => minion.uid)).toContain('castle-stay');
    });

    it('titan_magical_girls_walking_castle_choose_minions 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 移动泰坦与随从', () => {
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
                uid: 't-walking-castle-stale',
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
            payload: { titanUid: 't-walking-castle-stale', baseIndex: 0 },
            timestamp: 103,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const chooseBaseResult = respondToPromptOption(
            state,
            entry => entry.value?.baseIndex === 1,
            'Walking Castle stale choose-base option',
            '0',
            FIXED_RANDOM,
        );
        const chooseMinionsPrompt = getSimpleChoicePrompt(chooseBaseResult.finalState, 'titan_magical_girls_walking_castle_choose_minions');
        const moveA = getPromptOption(chooseMinionsPrompt, entry => entry.value?.minionUid === 'castle-move-a');
        const moveB = getPromptOption(chooseMinionsPrompt, entry => entry.value?.minionUid === 'castle-move-b');

        const staleCore: SmashUpCore = {
            ...chooseBaseResult.finalState.core,
            titans: (chooseBaseResult.finalState.core.titans ?? []).map(titan => titan.uid !== 't-walking-castle-stale' ? titan : {
                ...titan,
                talentUsed: true,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOptions(
            { ...chooseBaseResult.finalState, core: staleCore },
            [moveA.id, moveB.id],
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_MOVED }),
            expect.objectContaining({ type: SU_EVENTS.MINION_MOVED }),
        ]));
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 't-walking-castle-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(
            expect.arrayContaining(['castle-move-a', 'castle-move-b', 'castle-stay']),
        );
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
        const giveMinionPrompt = getSimpleChoicePrompt(state, 'titan_ignobles_the_hill_that_strolls_give_minion');

        expect(getPromptOption(giveMinionPrompt, entry => entry.value?.minionUid === 'hill-give-target')).toBeDefined();
        const giveResult = respondToPromptOption(
            state,
            entry => entry.value?.minionUid === 'hill-give-target',
            'Hill give-minion target option',
            '0',
            FIXED_RANDOM,
        );
        expect(giveResult.events.some(event => event.type === SU_EVENTS.MINION_CONTROL_CHANGED)).toBe(true);
        expect(giveResult.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);

        const giveResolvedCore = giveResult.finalState.core;
        expect(giveResolvedCore.bases[0].minions.find(minion => minion.uid === 'hill-give-target')?.controller).toBe('1');
        let reactionState = giveResult.finalState;

        const hillReactionPrompt = getOptionalSimpleChoicePrompt(reactionState, 'smashup_reaction_choose');
        if (hillReactionPrompt) {
            const hillOption = getReactionPromptOptionBySourceDefId(reactionState, hillReactionPrompt, 'ignobles_the_hill_that_strolls');

            const afterChoose = runCommand(
                reactionState,
                respondCommand(hillOption.id, '0'),
                FIXED_RANDOM,
            );
            reactionState = afterChoose.finalState;
        }

        const currentInteraction = getSimpleChoicePrompt(reactionState, 'titan_ignobles_the_hill_that_strolls_counter');

        expect(getPromptOption(currentInteraction, entry => entry.value?.place === true)).toBeDefined();
        const counterResult = respondToPromptOption(
            reactionState,
            entry => entry.value?.place === true,
            'Hill counter option',
            '0',
            FIXED_RANDOM,
        );
        expect(counterResult.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);

        const finalCore = counterResult.finalState.core;
        const transferredMinion = finalCore.bases[0].minions.find(minion => minion.uid === 'hill-give-target');
        expect(transferredMinion?.controller).toBe('1');
        expect(transferredMinion?.powerCounters).toBe(1);
    });

    it('titan_ignobles_the_hill_that_strolls_counter 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 给随从加标记', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('hill-give-target', 'ghosts_spectre', '0', 2)],
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
                    deck: [makeCard('hill-draw-card', 'ghosts_spectre', 'minion')],
                }),
                '1': makePlayer('1'),
            },
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-hill-stale', baseIndex: 1 },
            timestamp: 108,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const giveResult = respondToPromptOption(
            state,
            entry => entry.value?.minionUid === 'hill-give-target',
            'Hill stale give-minion target option',
            '0',
            FIXED_RANDOM,
        );
        expect(giveResult.events.some(event => event.type === SU_EVENTS.MINION_CONTROL_CHANGED)).toBe(true);

        let reactionState = giveResult.finalState;
        const hillReactionPrompt = getOptionalSimpleChoicePrompt(reactionState, 'smashup_reaction_choose');
        if (hillReactionPrompt) {
            const hillOption = getReactionPromptOptionBySourceDefId(reactionState, hillReactionPrompt, 'ignobles_the_hill_that_strolls');
            reactionState = runCommand(
                reactionState,
                respondCommand(hillOption.id, '0'),
                FIXED_RANDOM,
            ).finalState;
        }

        const counterPrompt = getSimpleChoicePrompt(reactionState, 'titan_ignobles_the_hill_that_strolls_counter');
        expect(getPromptOption(counterPrompt, entry => entry.value?.place === true)).toBeDefined();

        const staleCore: SmashUpCore = {
            ...reactionState.core,
            titans: (reactionState.core.titans ?? []).map(titan => titan.uid !== 't-hill-stale' ? titan : {
                ...titan,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...reactionState, core: staleCore },
            entry => entry.value?.place === true,
            'Hill stale counter option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.POWER_COUNTER_ADDED }),
        ]));
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 't-hill-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        const transferredMinion = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'hill-give-target');
        expect(transferredMinion?.controller).toBe('1');
        expect(transferredMinion?.powerCounters ?? 0).toBe(0);
    });

    it('titan_ignobles_the_hill_that_strolls_choose_player 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 交出随从控制权', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    minions: [makeMinion('hill-give-target-second', 'ghosts_spectre', '0', 2)],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-hill-stale-second',
                defId: 'ignobles_the_hill_that_strolls',
                faction: SMASHUP_FACTION_IDS.IGNOBLES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } satisfies TitanState],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-hill-stale-second', baseIndex: 1 },
            timestamp: 109,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const choosePlayerPromptState = respondToPromptOption(
            state,
            entry => entry.value?.minionUid === 'hill-give-target-second',
            'Hill stale choose-player minion option',
            '0',
            FIXED_RANDOM,
        ).finalState;
        const choosePlayerPrompt = getSimpleChoicePrompt(choosePlayerPromptState, 'titan_ignobles_the_hill_that_strolls_choose_player');
        expect(getPromptOption(choosePlayerPrompt, entry => entry.value?.targetPlayerId === '1')).toBeDefined();

        const staleCore: SmashUpCore = {
            ...choosePlayerPromptState.core,
            titans: (choosePlayerPromptState.core.titans ?? []).map(titan => titan.uid !== 't-hill-stale-second' ? titan : {
                ...titan,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...choosePlayerPromptState, core: staleCore },
            entry => entry.value?.targetPlayerId === '1',
            'Hill stale choose-player option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_CONTROL_CHANGED }),
            expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN }),
        ]));
        const minion = resolved.finalState.core.bases[0].minions.find(candidate => candidate.uid === 'hill-give-target-second');
        expect(minion?.controller).toBe('0');
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
        const reclaimPrompt = getSimpleChoicePrompt(state, 'titan_ignobles_the_hill_that_strolls_reclaim_minion');

        expect(getPromptOption(reclaimPrompt, entry => entry.value?.minionUid === 'hill-reclaim-target')).toBeDefined();
        const reclaimResult = respondToPromptOption(
            state,
            entry => entry.value?.minionUid === 'hill-reclaim-target',
            'Hill reclaim target option',
            '0',
            FIXED_RANDOM,
        );
        expect(reclaimResult.events.some(event => event.type === SU_EVENTS.MINION_CONTROL_CHANGED)).toBe(true);

        const resolved = reclaimResult.finalState.core;
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
        const afterCounterCore = triggerResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(afterCounterCore.titans?.find(candidate => candidate.uid === 't-time-box-setaside')?.metadata?.timeBoxCounters).toBe(5);

        const queuedState = { ...(triggerResult.matchState ?? makeMatchState(core)), core: afterCounterCore };
        const queuedPrompt = getSimpleChoicePrompt(queuedState, 'titan_time_travelers_time_box_play');
        expect(getPromptOption(queuedPrompt, entry => entry.value?.baseIndex === 1)).toBeDefined();
        const resolved = respondToPromptOption(
            queuedState,
            entry => entry.value?.baseIndex === 1,
            'Time Box play base option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.events.map(event => event.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.TITAN_METADATA_UPDATED,
            SU_EVENTS.TITAN_PLAYED,
        ]));

        const finalCore = resolved.finalState.core;
        expect(finalCore.titans?.find(candidate => candidate.uid === 't-time-box-setaside')).toMatchObject({
            location: { zone: 'base', baseIndex: 1 },
            metadata: { timeBoxCounters: 0 },
        });
    });

    it('titan_time_travelers_time_box_play 的 source titan 若在响应前失去第 5 枚计数进场资格，不应继续沿旧 prompt 进场或清零计数', () => {
        const promptCore = makeState({
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

        const triggerResult = fireTriggers(promptCore, 'onTurnStart', {
            state: promptCore,
            matchState: makeMatchState(promptCore, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 113,
        });

        const afterCounterCore = triggerResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            promptCore,
        );
        const queuedState = { ...(triggerResult.matchState ?? makeMatchState(promptCore)), core: afterCounterCore };
        const prompt = getSimpleChoicePrompt(queuedState, 'titan_time_travelers_time_box_play');
        expect(getPromptOption(prompt, entry => entry.value?.baseIndex === 1)).toBeDefined();

        const staleCore = makeState({
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-time-box-stale',
                defId: 'time_travelers_time_box',
                faction: SMASHUP_FACTION_IDS.TIME_TRAVELERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                metadata: { timeBoxCounters: 4, timeBoxPlayArmed: false },
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const resolved = respondToPromptOption(
            { ...queuedState, core: staleCore },
            entry => entry.value?.baseIndex === 1,
            'Time Box stale play base option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_METADATA_UPDATED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_PLAYED }),
        ]));
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-time-box-stale')).toMatchObject({
            location: { zone: 'setaside' },
            metadata: expect.objectContaining({ timeBoxCounters: 4, timeBoxPlayArmed: false }),
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
        const processed = resolveCardsReturnedToHand(matchState, '0', [recoveredEvent], FIXED_RANDOM, 114);

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

        const timeBoxReactionPrompt = getOptionalSimpleChoicePrompt(reactionState, 'smashup_reaction_choose');
        if (timeBoxReactionPrompt) {
            const timeBoxOption = getReactionPromptOptionBySourceDefId(reactionState, timeBoxReactionPrompt, 'time_travelers_time_box');

            const afterChoose = runCommand(
                reactionState,
                respondCommand(timeBoxOption.id, '0'),
                FIXED_RANDOM,
            );
            reactionState = afterChoose.finalState;
            resolvedEvents = afterChoose.events;
        }

        expect(resolvedEvents.map(event => event.type)).toContain(SU_EVENTS.TRIGGER_CONSUMED);
        expect(resolvedEvents.map(event => event.type)).toContain(SU_EVENTS.TITAN_METADATA_UPDATED);

        expect(getSimpleChoicePrompt(reactionState, 'titan_time_travelers_time_box_play')).toBeDefined();

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
        const choosePlayerPrompt = getSimpleChoicePrompt(state, 'titan_super_spies_moon_zero_three_choose_player');

        expect(getPromptOption(choosePlayerPrompt, entry => entry.value?.targetPlayerId === '1')).toBeDefined();
        const chooseResult = respondToPromptOption(
            state,
            entry => entry.value?.targetPlayerId === '1',
            'Moon Zero Three choose-player option',
            '0',
            FIXED_RANDOM,
        );
        expect(chooseResult.events.map(event => event.type)).toContain(SU_EVENTS.DECK_INSPECTED);
        const inspectedEvent = chooseResult.events.find(event => event.type === SU_EVENTS.DECK_INSPECTED) as SmashUpEvent | undefined;
        expect((inspectedEvent as any)?.payload?.inspectorPlayerId).toBe('0');
        const resolvePrompt = getSimpleChoicePrompt(chooseResult.finalState, 'titan_super_spies_moon_zero_three_resolve');
        expect(getPromptOption(resolvePrompt, entry => entry.value?.placement === 'bottom')).toBeDefined();

        const resolveResult = respondToPromptOption(
            chooseResult.finalState,
            entry => entry.value?.placement === 'bottom',
            'Moon Zero Three resolve-bottom option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolveResult.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);

        const afterResolve = resolveResult.finalState.core;
        expect(afterResolve.players['1'].deck.map(card => card.uid)).toEqual(['moon-target-next', 'moon-target-top']);
    });

    it('titan_super_spies_moon_zero_three_choose_player 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 查看牌库顶', () => {
        const promptCore = makeState({
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

        const state = makeMatchState(promptCore, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-moon-stale', baseIndex: 0 },
            timestamp: 123,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(commandEvents.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);

        const choosePlayerPrompt = getSimpleChoicePrompt(state, 'titan_super_spies_moon_zero_three_choose_player');
        expect(getPromptOption(choosePlayerPrompt, entry => entry.value?.targetPlayerId === '1')).toBeDefined();

        const staleCore = makeState({
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
                talentUsed: true,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.targetPlayerId === '1',
            'Moon Zero Three stale choose-player option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.DECK_INSPECTED }),
        ]));
        expect(getOptionalSimpleChoicePrompt(resolved.finalState, 'titan_super_spies_moon_zero_three_resolve')).toBeUndefined();
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-moon-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
    });

    it('titan_super_spies_moon_zero_three_resolve 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 把牌放到牌库底', () => {
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
                uid: 't-moon-resolve-stale',
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
            payload: { titanUid: 't-moon-resolve-stale', baseIndex: 0 },
            timestamp: 124,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const chooseResult = respondToPromptOption(
            state,
            entry => entry.value?.targetPlayerId === '1',
            'Moon Zero Three stale resolve choose-player option',
            '0',
            FIXED_RANDOM,
        );
        expect(chooseResult.events.map(event => event.type)).toContain(SU_EVENTS.DECK_INSPECTED);

        const resolvePrompt = getSimpleChoicePrompt(chooseResult.finalState, 'titan_super_spies_moon_zero_three_resolve');
        expect(getPromptOption(resolvePrompt, entry => entry.value?.placement === 'bottom')).toBeDefined();

        const staleCore: SmashUpCore = {
            ...chooseResult.finalState.core,
            titans: (chooseResult.finalState.core.titans ?? []).map(titan => titan.uid !== 't-moon-resolve-stale' ? titan : {
                ...titan,
                talentUsed: true,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...chooseResult.finalState, core: staleCore },
            entry => entry.value?.placement === 'bottom',
            'Moon Zero Three stale resolve-bottom option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARD_TO_DECK_BOTTOM }),
        ]));
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['moon-target-top', 'moon-target-next']);
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

        const currentInteraction = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_mega_troopers_megabot_move');
        expect(getPromptPlayerId(currentInteraction)).toBe('0');
        expect(getPromptOption(currentInteraction, entry => entry.value?.move === true)).toBeDefined();
        const moveResult = respondToPromptOption(
            triggerResult.matchState!,
            entry => entry.value?.move === true,
            'Megabot move option',
            '0',
            FIXED_RANDOM,
        );

        expect(moveResult.events.some(event => event.type === SU_EVENTS.TITAN_MOVED)).toBe(true);
        const resolved = moveResult.finalState.core;
        expect(resolved.titans?.find(candidate => candidate.uid === 't-megabot-live')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('titan_mega_troopers_megabot_move 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 移动泰坦', () => {
        const promptCore = makeState({
            currentPlayerIndex: 1,
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('megabot-home', 'ghosts_spectre', '0', 2)],
                }),
                makeBase({
                    defId: 'base_the_mothership',
                    minions: [makeMinion('megabot-scoring', 'robot_microbot_alpha', '1', 1)],
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

        const matchState = makeMatchState(promptCore);
        matchState.sys.phase = 'scoreBases';
        const triggerResult = fireTriggers(promptCore, 'beforeScoring', {
            state: promptCore,
            matchState,
            playerId: '1',
            baseIndex: 1,
            rankings: [
                { playerId: '1', power: 8, vp: 1 },
                { playerId: '0', power: 3, vp: 0 },
            ],
            random: FIXED_RANDOM,
            now: 100,
        });

        const prompt = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_mega_troopers_megabot_move');
        expect(getPromptOption(prompt, entry => entry.value?.move === true)).toBeDefined();

        const staleCore = makeState({
            currentPlayerIndex: 1,
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('megabot-home', 'ghosts_spectre', '0', 2)],
                }),
                makeBase({
                    defId: 'base_the_mothership',
                    minions: [makeMinion('megabot-scoring', 'robot_microbot_alpha', '1', 1)],
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
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const moveResult = respondToPromptOption(
            { ...triggerResult.matchState!, core: staleCore },
            entry => entry.value?.move === true,
            'Megabot stale move option',
            '0',
            FIXED_RANDOM,
        );

        expect(moveResult.success, moveResult.error).toBe(true);
        expect(moveResult.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_MOVED }),
        ]));
        expect(moveResult.finalState.core.titans?.find(candidate => candidate.uid === 't-megabot-stale')).toMatchObject({
            location: { zone: 'setaside' },
        });
    });

    it('旋齿鲨在回合开始得到第 4 枚计数后会创建进场交互，并在选择基地后清零计数并进场', () => {
        const core = makeState({
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-helicoprion-setaside',
                defId: 'sharks_helicoprion',
                faction: SMASHUP_FACTION_IDS.SHARKS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                metadata: { helicoprionCounters: 3 },
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

        expect(triggerResult.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_METADATA_UPDATED]);
        const afterCounterCore = triggerResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        expect(afterCounterCore.titans?.find(candidate => candidate.uid === 't-helicoprion-setaside')?.metadata?.helicoprionCounters).toBe(4);

        const queuedState = { ...(triggerResult.matchState ?? makeMatchState(core)), core: afterCounterCore };
        const prompt = getSimpleChoicePrompt(queuedState, 'titan_sharks_helicoprion_play');
        expect(getPromptOption(prompt, entry => entry.value?.baseIndex === 1)).toBeDefined();

        const resolved = respondToPromptOption(
            queuedState,
            entry => entry.value?.baseIndex === 1,
            'Helicoprion play base option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.events.map(event => event.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.TITAN_METADATA_UPDATED,
            SU_EVENTS.TITAN_PLAYED,
        ]));
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-helicoprion-setaside')).toMatchObject({
            location: { zone: 'base', baseIndex: 1 },
            metadata: { helicoprionCounters: 0 },
        });
    });

    it('旋齿鲨会在其他玩家回合中有随从在此处被消灭后，为控制者创建奖励反应入口', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('heli-mako-deck', 'sharks_mako', 'minion', '0'),
                        makeCard('heli-other-deck', 'ghosts_spectre', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                minions: [makeMinion('heli-victim', 'pirate_first_mate', '1', 2)],
            })],
            titans: [{
                uid: 't-helicoprion-live',
                defId: 'sharks_helicoprion',
                faction: SMASHUP_FACTION_IDS.SHARKS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const matchState = makeMatchState(core);
        const destroyEvent: SmashUpEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'heli-victim',
                minionDefId: 'pirate_first_mate',
                fromBaseIndex: 0,
                ownerId: '1',
                destroyerId: '1',
                reason: 'helicoprion_reward_smoke_destroy',
            },
            timestamp: 124,
        };
        const processed = resolveDestroyedMinions(matchState, '1', [destroyEvent], FIXED_RANDOM, 124);
        let reactionState = processed.matchState ?? matchState;

        if (!getOptionalSimpleChoicePrompt(reactionState)) {
            const reactionResult = maybeResolveReactionQueue(reactionState, FIXED_RANDOM, 124);
            reactionState = reactionResult?.state ?? reactionState;
        }

        if (!getOptionalSimpleChoicePrompt(reactionState, 'smashup_reaction_choose')) {
            const reactionResult = maybeResolveReactionQueue(reactionState, FIXED_RANDOM, 124);
            reactionState = reactionResult?.state ?? reactionState;
        }

        const reactionChoicePrompt = getOptionalSimpleChoicePrompt(reactionState, 'smashup_reaction_choose');
        if (reactionChoicePrompt) {
            const helicoprionOption = getReactionPromptOptionBySourceDefId(reactionState, reactionChoicePrompt, 'sharks_helicoprion');
            const afterChoose = runCommand(
                reactionState,
                respondCommand(helicoprionOption.id, '0'),
                FIXED_RANDOM,
            );
            reactionState = afterChoose.finalState;
        }

        expect(getOptionalSimpleChoicePrompt(reactionState, 'titan_sharks_helicoprion_reward')).toBeDefined();
    });

    it('全能手套满足 3 个高战力随从时可进场，天赋会给予额外低战力随从与战术额度，并保护此处己方随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('glove-low-minion', 'robot_microbot_guard', 'minion', '0'),
                        makeCard('glove-high-minion', 'trickster_gnome', 'minion', '0'),
                    ],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                minions: [
                    makeMinion('glove-five-a', 'ghosts_spectre', '0', 5),
                    makeMinion('glove-five-b', 'pirate_first_mate', '0', 5),
                    makeMinion('glove-five-c', 'trickster_gnome', '0', 5),
                    makeMinion('glove-protected', 'robot_microbot_guard', '0', 1),
                ],
            })],
            titans: [{
                uid: 't-everything-glove-setaside',
                defId: 'superheroes_the_everything_glove',
                faction: SMASHUP_FACTION_IDS.SUPERHEROES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const specialState = makeMatchState(core);
        const specialCommand: SmashUpCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-everything-glove-setaside', baseIndex: 0 },
            timestamp: 125,
        };
        expect(SmashUpDomain.validate(specialState, specialCommand).valid).toBe(true);
        const specialResult = runCommand(specialState, specialCommand, FIXED_RANDOM);
        expect(specialResult.events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);
        expect(specialResult.finalState.core.titans?.find(candidate => candidate.uid === 't-everything-glove-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });

        const talentCommand: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-everything-glove-setaside', baseIndex: 0 },
            timestamp: 126,
        };
        expect(SmashUpDomain.validate(specialResult.finalState, talentCommand).valid).toBe(true);
        const talentResult = runCommand(specialResult.finalState, talentCommand, FIXED_RANDOM);
        expect(talentResult.events.map(event => event.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.TALENT_USED,
            SU_EVENTS.LIMIT_MODIFIED,
        ]));
        expect(talentResult.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(talentResult.finalState.core.players['0'].baseLimitedMinionPowerCaps?.[0]).toEqual([2]);
        expect(talentResult.finalState.core.players['0'].actionLimit).toBe(2);

        const postTalentState = talentResult.finalState;
        expect(SmashUpDomain.validate(postTalentState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'glove-low-minion', baseIndex: 0 },
            timestamp: 127,
        }).valid).toBe(true);
        expect(SmashUpDomain.validate(postTalentState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'glove-high-minion', baseIndex: 0 },
            timestamp: 128,
        })).toMatchObject({
            valid: false,
            error: '额外出牌只能打出力量≤2的随从',
        });

        const filteredDestroy = filterProtectedDestroyEvents([{
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'glove-protected',
                minionDefId: 'robot_microbot_guard',
                fromBaseIndex: 0,
                ownerId: '0',
                destroyerId: '1',
                reason: 'enemy_superpower',
            },
            timestamp: 129,
        } as SmashUpEvent], talentResult.finalState.core, '1');
        expect(filteredDestroy).toEqual([]);
    });

    it('五级风暴会在本回合第 2 次移动后创建进场交互，且其战力加成等于本回合该基地的移动次数', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    minions: [
                        makeMinion('category5-move-a', 'ghosts_spectre', '0', 2),
                        makeMinion('category5-move-b', 'pirate_first_mate', '0', 2),
                    ],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-category5-setaside',
                defId: 'tornados_category_5',
                faction: SMASHUP_FACTION_IDS.TORNADOS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const initialState = makeMatchState(core);
        const firstMoveResult = resolveMovedMinions(initialState, '0', [{
            minionUid: 'category5-move-a',
            minionDefId: 'ghosts_spectre',
            fromBaseIndex: 0,
            toBaseIndex: 1,
            reason: 'category5_first_move',
            timestamp: 130,
        }], FIXED_RANDOM, 130);
        const afterFirstCore = firstMoveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        const afterFirstState = { ...(firstMoveResult.matchState ?? initialState), core: afterFirstCore };
        const firstReaction = maybeResolveReactionQueue(afterFirstState, FIXED_RANDOM, 130);
        expect(getOptionalSimpleChoicePrompt(firstReaction?.state ?? afterFirstState, 'titan_tornados_category_5_play')).toBeUndefined();

        const secondMoveResult = resolveMovedMinions(afterFirstState, '0', [{
            minionUid: 'category5-move-b',
            minionDefId: 'pirate_first_mate',
            fromBaseIndex: 0,
            toBaseIndex: 1,
            reason: 'category5_second_move',
            timestamp: 131,
        }], FIXED_RANDOM, 131);
        const afterSecondCore = secondMoveResult.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            afterFirstCore,
        );
        const afterSecondState = { ...(secondMoveResult.matchState ?? afterFirstState), core: afterSecondCore };
        const reactionResult = maybeResolveReactionQueue(afterSecondState, FIXED_RANDOM, 131)!;
        let reactionState = reactionResult.state;
        const reactionChoicePrompt = getOptionalSimpleChoicePrompt(reactionState, 'smashup_reaction_choose');
        if (reactionChoicePrompt) {
            const category5Option = getReactionPromptOptionBySourceDefId(reactionState, reactionChoicePrompt, 'tornados_category_5');
            const afterChoose = runCommand(
                reactionState,
                respondCommand(category5Option.id, '0'),
                FIXED_RANDOM,
            );
            reactionState = afterChoose.finalState;
        }

        expect(getPromptsBySourceId(reactionState, 'titan_tornados_category_5_play')).toHaveLength(1);
        const prompt = getSimpleChoicePrompt(reactionState, 'titan_tornados_category_5_play');
        expect(getPromptOption(prompt, entry => entry.value?.baseIndex === 1)).toBeDefined();
        const playResult = respondToPromptOption(
            reactionState,
            entry => entry.value?.baseIndex === 1,
            'Category 5 play base option',
            '0',
            FIXED_RANDOM,
        );
        expect(playResult.events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);
        expect(playResult.finalState.core.titans?.find(candidate => candidate.uid === 't-category5-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
        expect(getTitanPowerContribution(playResult.finalState.core, 1, '0')).toBe(2);
    });

    it('五级风暴会在另一基地计分前创建移动交互，并在选择后移动到计分基地', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('category5-scoring', 'robot_microbot_alpha', '1', 1)],
                }),
                makeBase({
                    defId: 'base_the_mothership',
                }),
            ],
            titans: [{
                uid: 't-category5-live',
                defId: 'tornados_category_5',
                faction: SMASHUP_FACTION_IDS.TORNADOS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } satisfies TitanState],
        });

        const matchState = makeMatchState(core);
        matchState.sys.phase = 'scoreBases';
        const triggerResult = fireTriggers(core, 'beforeScoring', {
            state: core,
            matchState,
            playerId: '1',
            baseIndex: 0,
            rankings: [
                { playerId: '1', power: 8, vp: 1 },
                { playerId: '0', power: 3, vp: 0 },
            ],
            random: FIXED_RANDOM,
            now: 132,
        });

        const prompt = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_tornados_category_5_move');
        expect(getPromptPlayerId(prompt)).toBe('0');
        const resolved = respondToPromptOption(
            triggerResult.matchState!,
            entry => entry.value?.move === true,
            'Category 5 move option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.events.map(event => event.type)).toContain(SU_EVENTS.TITAN_MOVED);
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-category5-live')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('titan_tornados_category_5_move 的 source titan 若在响应前已离开原基地，不应继续沿旧 prompt 移动泰坦', () => {
        const promptCore = makeState({
            currentPlayerIndex: 1,
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('category5-scoring', 'robot_microbot_alpha', '1', 1)],
                }),
                makeBase({
                    defId: 'base_the_mothership',
                }),
            ],
            titans: [{
                uid: 't-category5-stale',
                defId: 'tornados_category_5',
                faction: SMASHUP_FACTION_IDS.TORNADOS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } satisfies TitanState],
        });

        const promptMatchState = makeMatchState(promptCore);
        promptMatchState.sys.phase = 'scoreBases';
        const triggerResult = fireTriggers(promptCore, 'beforeScoring', {
            state: promptCore,
            matchState: promptMatchState,
            playerId: '1',
            baseIndex: 0,
            rankings: [
                { playerId: '1', power: 8, vp: 1 },
                { playerId: '0', power: 3, vp: 0 },
            ],
            random: FIXED_RANDOM,
            now: 133,
        });

        const prompt = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_tornados_category_5_move');
        expect(prompt).toBeDefined();

        const staleCore = makeState({
            currentPlayerIndex: 1,
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('category5-scoring', 'robot_microbot_alpha', '1', 1)],
                }),
                makeBase({
                    defId: 'base_the_mothership',
                }),
            ],
            titans: [{
                uid: 't-category5-stale',
                defId: 'tornados_category_5',
                faction: SMASHUP_FACTION_IDS.TORNADOS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const result = respondToPromptOption(
            { ...triggerResult.matchState!, core: staleCore },
            entry => entry.value?.move === true,
            'Category 5 stale move option',
            '0',
            FIXED_RANDOM,
        );
        expect(result.success, result.error).toBe(true);
        expect(result.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_MOVED }),
        ]));
        expect(result.finalState.core.titans?.find(candidate => candidate.uid === 't-category5-stale')?.location).toMatchObject({
            zone: 'setaside',
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

        const currentInteraction = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_penguins_emperor_penguin_play');
        expect(getPromptOption(currentInteraction, entry => entry.value?.baseIndex === 0)).toBeDefined();

        const resolved = respondToPromptOption(
            triggerResult.matchState!,
            entry => entry.value?.baseIndex === 0,
            'Emperor Penguin play base option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.events.some(event => event.type === SU_EVENTS.TITAN_PLAYED)).toBe(true);

        const next = resolved.finalState.core;
        expect(next.titans?.find(candidate => candidate.uid === 't-emperor-setaside')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('titan_penguins_emperor_penguin_play 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 进场', () => {
        const promptCore = makeState({
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
                uid: 't-emperor-setaside-stale',
                defId: 'penguins_emperor_penguin',
                faction: SMASHUP_FACTION_IDS.PENGUINS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const triggerResult = fireTriggers(promptCore, 'onTurnStart', {
            state: promptCore,
            matchState: makeMatchState(promptCore, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 101.1,
        });
        const prompt = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_penguins_emperor_penguin_play');
        expect(getPromptOption(prompt, entry => entry.value?.baseIndex === 0)).toBeDefined();

        const staleCore: SmashUpCore = {
            ...triggerResult.matchState!.core,
            titans: (triggerResult.matchState!.core.titans ?? []).map(titan => titan.uid !== 't-emperor-setaside-stale' ? titan : {
                ...titan,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }),
        };

        const resolved = respondToPromptOption(
            { ...triggerResult.matchState!, core: staleCore },
            entry => entry.value?.baseIndex === 0,
            'Emperor Penguin stale play base option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_PLAYED }),
        ]));
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-emperor-setaside-stale')?.location).toMatchObject({
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
        const prompt = getSimpleChoicePrompt(state, 'titan_penguins_emperor_penguin_talent');
        expect(getPromptOptions(prompt).every((option: any) => option.displayMode === 'card')).toBe(true);

        const resolved = respondToPromptOption(
            state,
            entry => entry.value?.cardUid === 'penguin-hand-minion' && entry.value?.zone === 'hand',
            'Emperor Penguin talent hand minion option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.events.map(event => event.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.REVEAL_HAND,
            SU_EVENTS.CARD_TO_DECK_TOP,
            SU_EVENTS.DECK_REORDERED,
            SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
        ]));

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
        const promptCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('penguin-hand-minion', 'pirate_first_mate', 'minion', '0')],
                    deck: [makeCard('penguin-existing-deck', 'robot_microbot_guard', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-emperor-stale',
                defId: 'penguins_emperor_penguin',
                faction: SMASHUP_FACTION_IDS.PENGUINS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(promptCore);
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-emperor-stale', baseIndex: 0 },
            timestamp: 106,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(commandEvents.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);

        const prompt = getSimpleChoicePrompt(state, 'titan_penguins_emperor_penguin_talent');
        expect(getPromptOption(
            prompt,
            entry => entry.value?.cardUid === 'penguin-hand-minion' && entry.value?.zone === 'hand',
            'Emperor Penguin stale talent hand minion option',
        )).toBeDefined();

        const staleCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('penguin-hand-minion', 'pirate_first_mate', 'minion', '0')],
                    deck: [makeCard('penguin-existing-deck', 'robot_microbot_guard', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
            titans: [{
                uid: 't-emperor-stale',
                defId: 'penguins_emperor_penguin',
                faction: SMASHUP_FACTION_IDS.PENGUINS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: true,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.cardUid === 'penguin-hand-minion' && entry.value?.zone === 'hand',
            'Emperor Penguin stale talent hand minion option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.REVEAL_HAND }),
            expect.objectContaining({ type: SU_EVENTS.CARD_TO_DECK_TOP }),
            expect.objectContaining({ type: SU_EVENTS.DECK_REORDERED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED }),
        ]));
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-emperor-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('penguin-hand-minion');
    });

    it('第二只 Emperor Penguin 打开的天赋 prompt 结算时，应给 continuationContext.titanUid 那只加标记，而不是第一只 live titan', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('penguin-hand-b', 'pirate_first_mate', 'minion', '0')],
                    deck: [makeCard('penguin-existing-deck', 'robot_microbot_guard', 'minion', '0')],
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
            timestamp: 107,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);

        const commandEvents = SmashUpDomain.execute(state, command, FIXED_RANDOM);
        expect(commandEvents.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);

        const prompt = getSimpleChoicePrompt(state, 'titan_penguins_emperor_penguin_talent');
        expect(getPromptHandlerData(prompt)?.continuationContext?.titanUid).toBe('t-emperor-b');

        const resolved = respondToPromptOption(
            state,
            entry => entry.value?.cardUid === 'penguin-hand-b' && entry.value?.zone === 'hand',
            'Second Emperor Penguin talent hand minion option',
            '0',
            FIXED_RANDOM,
        );

        const afterCommand = commandEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            core,
        );
        const finalCore = resolved.events.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            afterCommand,
        );

        expect(finalCore.titans?.find(candidate => candidate.uid === 't-emperor-a')?.powerCounters ?? 0).toBe(0);
        expect(finalCore.titans?.find(candidate => candidate.uid === 't-emperor-b')?.powerCounters ?? 0).toBe(1);
        expect(finalCore.players['0'].hand.map(card => card.uid)).not.toContain('penguin-hand-b');
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(
            expect.arrayContaining(['penguin-existing-deck', 'penguin-hand-b']),
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
    });

    it('titan_tricksters_big_funny_giant_choose_minion 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 进入目标基地选择', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('giant-target-first', 'ghosts_spectre', '1', 2),
                        makeMinion('giant-too-large', 'pirate_first_mate', '1', 3),
                    ],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-bfg-first-stale',
                defId: 'tricksters_big_funny_giant',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS,
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
            payload: { titanUid: 't-bfg-first-stale', baseIndex: 0 },
            timestamp: 70,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const prompt = getSimpleChoicePrompt(state, 'titan_tricksters_big_funny_giant_choose_minion');
        expect(getPromptOption(prompt, entry => entry.value?.minionUid === 'giant-target-first')).toBeDefined();

        const staleCore: SmashUpCore = {
            ...state.core,
            titans: (state.core.titans ?? []).map(titan => titan.uid !== 't-bfg-first-stale' ? titan : {
                ...titan,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.minionUid === 'giant-target-first',
            'Big Funny Giant stale choose-minion option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: INTERACTION_EVENTS.INTERACTION_CREATED }),
            expect.objectContaining({ type: SU_EVENTS.MINION_DESTROYED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_MOVED }),
        ]));
        expect(getOptionalSimpleChoicePrompt(resolved.finalState, 'titan_tricksters_big_funny_giant_choose_base')).toBeUndefined();
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'giant-target-first')).toBeDefined();
    });

    it('titan_tricksters_big_funny_giant_choose_base 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 消灭随从并移动泰坦', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('giant-target', 'ghosts_spectre', '1', 2)],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-bfg-stale',
                defId: 'tricksters_big_funny_giant',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS,
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
            payload: { titanUid: 't-bfg-stale', baseIndex: 0 },
            timestamp: 71,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const chooseMinionResult = respondToPromptOption(
            state,
            entry => entry.value?.minionUid === 'giant-target',
            'Big Funny Giant choose-minion option before source goes stale',
            '0',
            FIXED_RANDOM,
        );
        const chooseBasePrompt = getSimpleChoicePrompt(chooseMinionResult.finalState, 'titan_tricksters_big_funny_giant_choose_base');
        expect(getPromptOption(chooseBasePrompt, entry => entry.value?.baseIndex === 1)).toBeDefined();

        const staleCore: SmashUpCore = {
            ...chooseMinionResult.finalState.core,
            titans: (chooseMinionResult.finalState.core.titans ?? []).map(titan => titan.uid !== 't-bfg-stale' ? titan : {
                ...titan,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...chooseMinionResult.finalState, core: staleCore },
            entry => entry.value?.baseIndex === 1,
            'Big Funny Giant stale choose-base option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_DESTROYED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_MOVED }),
        ]));
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 't-bfg-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'giant-target')).toBeDefined();
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
        const prompt = getSimpleChoicePrompt(state, 'titan_pirates_the_kraken_talent');

        const chooseBaseOption = getPromptOption(prompt, option => option.value?.baseIndex === 1, 'Kraken target base option');

        const eventSystem = createSmashUpEventSystem();
        const hook = eventSystem.afterEvents?.({
            state,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: prompt.id,
                    playerId: '0',
                    optionId: chooseBaseOption.id,
                    value: chooseBaseOption.value,
                    sourceId: 'titan_pirates_the_kraken_talent',
                    interactionData: getPromptHandlerData(prompt),
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
        const prompt = getSimpleChoicePrompt(state, 'titan_werewolves_great_wolf_spirit_talent');

        expect(getPromptOption(prompt, entry => entry.value?.minionUid === 'wolf-target' && entry.value?.baseIndex === 0)).toBeDefined();
        const resolved = respondToPromptOption(
            state,
            entry => entry.value?.minionUid === 'wolf-target' && entry.value?.baseIndex === 0,
            'Great Wolf Spirit talent target option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.events.some(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(true);

        const afterCommand = events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), core);
        const boosted = resolved.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), afterCommand);
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
        const prompt = getSimpleChoicePrompt(state, 'titan_pirates_the_kraken_talent');

        expect(getPromptOption(prompt, entry => entry.value?.baseIndex === 1)).toBeDefined();
        const resolved = respondToPromptOption(
            state,
            entry => entry.value?.baseIndex === 1,
            'Kraken talent base option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.events.map(event => event.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.TITAN_MOVED,
            SU_EVENTS.PERMANENT_POWER_ADDED,
        ]));

        const afterTalentCore = resolved.finalState.core;
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

    it('titan_pirates_the_kraken_talent 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 移动泰坦并给敌方 -1 战力', () => {
        const core = makeState({
            turnNumber: 3,
            bases: [
                makeBase(),
                makeBase({
                    minions: [
                        makeMinion('kraken-enemy', 'ghosts_spectre', '1', 3),
                        makeMinion('kraken-ally', 'pirate_first_mate', '0', 2),
                    ],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-kraken-stale',
                defId: 'pirates_the_kraken',
                faction: SMASHUP_FACTION_IDS.PIRATES,
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
            payload: { titanUid: 't-kraken-stale', baseIndex: 0 },
            timestamp: 71,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const prompt = getSimpleChoicePrompt(state, 'titan_pirates_the_kraken_talent');
        expect(getPromptOption(prompt, entry => entry.value?.baseIndex === 1)).toBeDefined();

        const staleCore: SmashUpCore = {
            ...state.core,
            titans: (state.core.titans ?? []).map(titan => titan.uid !== 't-kraken-stale' ? titan : {
                ...titan,
                talentUsed: true,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.baseIndex === 1,
            'Kraken stale talent base option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_MOVED }),
            expect.objectContaining({ type: SU_EVENTS.PERMANENT_POWER_ADDED }),
        ]));
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 't-kraken-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'kraken-enemy')?.powerModifier ?? 0).toBe(0);
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

        expect(getPromptsBySourceId(triggerResult.matchState!, 'titan_pirates_the_kraken_play_replacement')).toHaveLength(1);
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

        expect(getPromptsBySourceId(triggerResult.matchState!, 'titan_pirates_the_kraken_choose_minion')).toHaveLength(1);
    });

    it('titan_pirates_the_kraken_choose_minion 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 进入目标基地选择', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('kraken-save-target', 'pirate_first_mate', '0', 2)],
                }),
                makeBase('base_the_mothership'),
            ],
            titans: [{
                uid: 'kraken-first-stale',
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
            now: 75,
        });

        const promptState = triggerResult.matchState!;
        const chooseMinionPrompt = getSimpleChoicePrompt(promptState, 'titan_pirates_the_kraken_choose_minion');
        const staleOption = getPromptOption(
            chooseMinionPrompt,
            entry => entry.value?.minionUid === 'kraken-save-target',
            'Kraken choose-minion option before source goes stale',
        );

        const staleCore: SmashUpCore = {
            ...promptState.core,
            titans: (promptState.core.titans ?? []).map(titan => titan.uid !== 'kraken-first-stale' ? titan : {
                ...titan,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = runCommand(
            { ...promptState, core: staleCore },
            respondCommand(staleOption.id, '0'),
            FIXED_RANDOM,
        );

        expect(resolved.success).toBe(false);
        expect(resolved.error).toBe('无效的选择');
        expect(getPromptsBySourceId(resolved.finalState, 'titan_pirates_the_kraken_choose_base')).toHaveLength(0);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: INTERACTION_EVENTS.INTERACTION_CREATED }),
            expect.objectContaining({ type: SU_EVENTS.MINION_MOVED }),
        ]));
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'kraken-first-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'kraken-save-target')).toBeDefined();
    });

    it('titan_pirates_the_kraken_choose_base 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 移动待救随从', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('kraken-save-target-second', 'pirate_first_mate', '0', 2)],
                }),
                makeBase('base_the_mothership'),
            ],
            titans: [{
                uid: 'kraken-second-stale',
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
            now: 76,
        });

        let promptState = triggerResult.matchState!;
        const reactionPrompt = getOptionalSimpleChoicePrompt(promptState, 'smashup_reaction_choose');
        if (reactionPrompt) {
            const krakenOption = getReactionPromptOptionBySourceDefId(promptState, reactionPrompt, 'pirates_the_kraken');
            const afterChooseKraken = runCommand(
                promptState,
                respondCommand(krakenOption.id, '0'),
                FIXED_RANDOM,
            );
            expect(afterChooseKraken.success, afterChooseKraken.error).toBe(true);
            promptState = afterChooseKraken.finalState;
        }

        const chooseMinionPrompt = getSimpleChoicePrompt(promptState, 'titan_pirates_the_kraken_choose_minion');
        const chooseMinionOption = getPromptOption(
            chooseMinionPrompt,
            entry => entry.value?.minionUid === 'kraken-save-target-second',
            'Kraken choose-base stale minion option',
        );
        const eventSystem = createSmashUpEventSystem();
        const chooseMinionHook = eventSystem.afterEvents?.({
            state: promptState,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: chooseMinionPrompt.id,
                    playerId: '0',
                    optionId: chooseMinionOption.id,
                    value: chooseMinionOption.value,
                    sourceId: 'titan_pirates_the_kraken_choose_minion',
                    interactionData: getPromptHandlerData(chooseMinionPrompt),
                },
                timestamp: 77,
            } as any],
            random: FIXED_RANDOM,
        }) as any;

        const chooseMinionState = chooseMinionHook?.state ?? promptState;
        const chooseBasePrompt = getSimpleChoicePrompt(chooseMinionState, 'titan_pirates_the_kraken_choose_base');
        expect(getPromptOption(chooseBasePrompt, entry => entry.value?.baseIndex === 1)).toBeDefined();

        const staleCore: SmashUpCore = {
            ...chooseMinionState.core,
            titans: (chooseMinionState.core.titans ?? []).map(titan => titan.uid !== 'kraken-second-stale' ? titan : {
                ...titan,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...chooseMinionState, core: staleCore },
            entry => entry.value?.baseIndex === 1,
            'Kraken stale choose-base option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_MOVED }),
        ]));
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'kraken-save-target-second')).toBeDefined();
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'kraken-save-target-second')).toBeUndefined();
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
                makeBase('base_the_factory'),
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
        const firstReactionPrompt = getOptionalSimpleChoicePrompt(firstPrompt!.state, 'smashup_reaction_choose');
        if (firstReactionPrompt) {
            const firstMateOption = getReactionPromptOptionBySourceDefId(firstPrompt!.state, firstReactionPrompt, 'pirate_first_mate');

            const afterChooseFirstMateTrigger = runCommand(
                firstPrompt.state,
                respondCommand(firstMateOption.id, '0'),
                FIXED_RANDOM,
            );
            stateAfterChooseFirstMateTrigger = afterChooseFirstMateTrigger.finalState;
        }

        const firstMatePrompt = getSimpleChoicePrompt(stateAfterChooseFirstMateTrigger, 'pirate_first_mate_choose_base');

        const moveMateOption = getPromptOption(
            firstMatePrompt,
            option => option.value?.baseIndex === 1 || option.value?.baseIndex === 2,
            'First Mate destination option',
        );

        const afterMoveFirstMate = runCommand(
            stateAfterChooseFirstMateTrigger,
            respondCommand(moveMateOption.id, '0'),
            FIXED_RANDOM,
        );

        let stateAfterKrakenTrigger = afterMoveFirstMate.finalState;
        if (!getOptionalSimpleChoicePrompt(stateAfterKrakenTrigger)) {
            const reactionPrompt = maybeResolveReactionQueue(stateAfterKrakenTrigger, FIXED_RANDOM, 76);
            if (reactionPrompt) {
                stateAfterKrakenTrigger = reactionPrompt.state;
            }
        }
        const nextReactionPrompt = getOptionalSimpleChoicePrompt(stateAfterKrakenTrigger, 'smashup_reaction_choose');
        if (nextReactionPrompt) {
            const krakenOption = getReactionPromptOptionBySourceDefId(stateAfterKrakenTrigger, nextReactionPrompt, 'pirates_the_kraken');

            const afterChooseKrakenTrigger = runCommand(
                stateAfterKrakenTrigger,
                respondCommand(krakenOption.id, '0'),
                FIXED_RANDOM,
            );
            stateAfterKrakenTrigger = afterChooseKrakenTrigger.finalState;
        }

        expect(getSimpleChoicePrompt(stateAfterKrakenTrigger, 'titan_pirates_the_kraken_play_replacement')).toBeDefined();
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
            baseDeck: ['base_the_factory'],
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
                        newBaseDefId: 'base_the_factory',
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
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 75 } as any,
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
        expect(finalCore.bases[0].defId).toBe('base_the_factory');
    });

    it('titan_pirates_the_kraken_play_replacement 的 source titan 若在响应前已离开牌库旁，不应继续预约替换基地进场', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [makeMinion('pirate-on-score', 'pirate_first_mate', '0', 2)],
                }),
                makeBase('base_the_mothership'),
            ],
            baseDeck: ['base_the_factory'],
            titans: [{
                uid: 't-kraken-setaside-stale',
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
            throw new Error('无法构造海怪克拉肯 stale 替换基地 scoring base ref');
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
                    timestamp: 75.1,
                },
                {
                    type: SU_EVENTS.BASE_REPLACED,
                    payload: {
                        baseIndex: 0,
                        oldBaseDefId: 'base_the_homeworld',
                        newBaseDefId: 'base_the_factory',
                    },
                    timestamp: 75.1,
                },
            ],
        });

        const staleState = {
            ...state,
            core: {
                ...state.core,
                titans: (state.core.titans ?? []).map(titan => titan.uid !== 't-kraken-setaside-stale' ? titan : {
                    ...titan,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                }),
            },
        };

        const smashUpEventSystem = createSmashUpEventSystem();
        const hook = smashUpEventSystem.afterEvents?.({
            state: staleState,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'test-kraken-play-stale',
                    playerId: '0',
                    optionId: 'play',
                    value: { play: true },
                    sourceId: 'titan_pirates_the_kraken_play_replacement',
                    interactionData: {
                        sourceId: 'titan_pirates_the_kraken_play_replacement',
                        continuationContext: {
                            titanUid: 't-kraken-setaside-stale',
                            titanDefId: 'pirates_the_kraken',
                            ownerId: '0',
                            controllerId: '0',
                            scoringBaseIndex: 0,
                        },
                    },
                },
                timestamp: 75.1,
            } as any],
            random: FIXED_RANDOM,
        }) as any;

        expect(hook?.events ?? []).toEqual([]);
        expect(consumeScoringFrameDeferredPayload(hook?.state ?? staleState).deferredActions).toEqual([]);

        const finalize = smashUpFlowHooks.onPhaseExit?.({
            state: hook?.state ?? staleState,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 75.1 } as any,
            random: FIXED_RANDOM,
        });
        const finalizeEvents = Array.isArray(finalize) ? finalize : (finalize as any)?.events ?? [];
        expect(finalizeEvents.map((event: SmashUpEvent) => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
        ]);

        const finalCore = finalizeEvents.reduce(
            (acc: SmashUpCore, event: SmashUpEvent) => SmashUpDomain.reduce(acc, event),
            (hook?.state ?? staleState).core,
        );
        expect(finalCore.titans?.find(candidate => candidate.uid === 't-kraken-setaside-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('活动泰坦静态契约与当前已接入范围保持一致', () => {
        const currentTitanIds = TITAN_CARD_DEFS.map(def => def.id);
        expect(currentTitanIds).toEqual([
            'huluwawa_little_king_kong',
            'paladins_seraphim',
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
            'sharks_helicoprion',
            'superheroes_the_everything_glove',
            'tornados_category_5',
            'cthulhu_cthulhu_titan',
            'penguins_emperor_penguin',
            'tricksters_big_funny_giant',
            'tricksters_big_funny_giant_pod',
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
        expect(TITAN_CARD_DEFS).toHaveLength(33);
        expect(getTitanDef('dinosaurs_fort_titanosaurus')?.abilityTags).toEqual(['special', 'ongoing', 'talent']);
        expect(getTitanDef('dinosaurs_fort_titanosaurus')?.activatableAbilities).toEqual([
            { kind: 'special', zone: 'setaside', window: 'playCards' },
            { kind: 'talent', zone: 'board', window: 'playCards' },
        ]);
        expect(getTitanDef('fairies_spirit_of_the_forest')?.abilityTags).toEqual(['special', 'ongoing']);
        expect(getTitanDef('fairies_spirit_of_the_forest')?.previewRef).toEqual({
            type: 'atlas',
            atlasId: 'smashup:titans',
            index: 3,
        });
        expect(getTitanDef('superheroes_the_everything_glove')?.name).toBe('全能手套');
        expect(getTitanDef('sphinx')?.id).toBe('sphinx');
        expect(getTitanDef('sphinx')?.abilityTags).toEqual(['special', 'talent']);
        expect(getTitanDef('sphinx')?.activatableAbilities).toEqual([
            { kind: 'talent', zone: 'board', window: 'playCards' },
        ]);
        expect(getTitanDef('sphinx')?.previewRef).toEqual({ type: 'atlas', atlasId: 'tts_atlas_8789f47742', index: 29 });
        expect(getTitanDef('pecos_bill')?.id).toBe('pecos_bill');
        expect(getTitanDef('pecos_bill')?.abilityTags).toEqual(['special', 'ongoing']);
        expect(getTitanDef('pecos_bill')?.activatableAbilities).toBeUndefined();
        expect(getTitanDef('pecos_bill')?.previewRef).toEqual({ type: 'atlas', atlasId: 'tts_atlas_8789f47742', index: 30 });
        expect(getTitanDef('bear_cavalry_major_ursa')?.activatableAbilities).toEqual([
            { kind: 'special', zone: 'setaside', window: 'playCards' },
            { kind: 'talent', zone: 'board', window: 'playCards' },
        ]);
        expect(getTitanDef('ghosts_creampuff_man')?.activatableAbilities).toEqual([
            { kind: 'special', zone: 'setaside', window: 'playCards' },
            { kind: 'talent', zone: 'board', window: 'playCards' },
        ]);
        expect(getTitanDef('giant_ants_death_on_six_legs')?.activatableAbilities).toEqual([
            { kind: 'special', zone: 'setaside', window: 'playCards' },
            { kind: 'talent', zone: 'board', window: 'playCards' },
        ]);
        expect(getTitanDef('tricksters_big_funny_giant')?.abilityTags).toEqual(['special', 'ongoing', 'talent']);
        expect(getTitanDef('tricksters_big_funny_giant_pod')?.abilityTags).toEqual(['special', 'ongoing']);
        expect(getTitanDef('tricksters_big_funny_giant_pod')?.previewRef).toEqual({ type: 'atlas', atlasId: 'tts_atlas_8789f47742', index: 3 });
        expect(getTitanDef('time_travelers_time_box')?.abilityTags).toEqual(['special', 'talent']);
        expect(getTitanDef('tornados_category_5')?.activatableAbilities).toEqual([
            { kind: 'special', zone: 'setaside', window: 'playCards' },
        ]);
        expect(getTitanDef('changerbots_mergacon')?.activatableAbilities).toEqual([
            { kind: 'talent', zone: 'board', window: 'playCards' },
        ]);
        expect(getTitanDef('itty_critters_rainboroc')?.activatableAbilities).toEqual([
            { kind: 'talent', zone: 'board', window: 'playCards' },
        ]);
        expect(getTitanDef('pirates_the_kraken')?.activatableAbilities).toEqual([
            { kind: 'talent', zone: 'board', window: 'playCards' },
        ]);
        expect(getTitanDef('frankenstein_the_bride')?.activatableAbilities).toEqual([
            { kind: 'talent', zone: 'board', window: 'playCards' },
        ]);
        expect(getSmashUpCardPreviewMeta('sphinx')).toEqual({
            name: getTitanDef('sphinx')?.name,
            previewRef: { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: 'sphinx' } },
        });
        expect(getSmashUpCardPreviewMeta('pecos_bill')).toEqual({
            name: getTitanDef('pecos_bill')?.name,
            previewRef: { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: 'pecos_bill' } },
        });
        expect(getSmashUpCardPreviewMeta('base_crypt')).toEqual({
            name: getBaseDef('base_crypt')?.name,
            previewRef: { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: 'base_crypt' } },
        });
        expect(hasCardActivatableAbility('sphinx', {
            kind: 'special',
            zone: 'setaside',
            window: 'playCards',
        })).toBe(false);
        expect(hasCardActivatableAbility('pecos_bill', {
            kind: 'special',
            zone: 'setaside',
            window: 'playCards',
        })).toBe(false);
        expect([
            'bear_cavalry_major_ursa',
            'ghosts_creampuff_man',
            'giant_ants_death_on_six_legs',
            'tornados_category_5',
        ].every((defId) => hasCardActivatableAbility(defId, {
            kind: 'special',
            zone: 'setaside',
            window: 'playCards',
        }))).toBe(true);
        expect([
            'sharks_helicoprion',
            'penguins_emperor_penguin',
            'sphinx',
            'pecos_bill',
            'changerbots_mergacon',
            'itty_critters_rainboroc',
            'pirates_the_kraken',
            'frankenstein_the_bride',
        ].every((defId) => !hasCardActivatableAbility(defId, {
            kind: 'special',
            zone: 'setaside',
            window: 'playCards',
        }))).toBe(true);
        expect(hasCardActivatableAbility('penguins_emperor_penguin', {
            kind: 'ongoing',
            zone: 'board',
            window: 'playCards',
        })).toBe(true);
        expect(hasCardActivatableAbility('dinosaurs_fort_titanosaurus', {
            kind: 'talent',
            zone: 'board',
            window: 'playCards',
        })).toBe(true);
        expect([
            'huluwawa_little_king_kong',
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
            'tricksters_big_funny_giant',
            'tricksters_big_funny_giant_pod',
            'cthulhu_cthulhu_titan',
            'vampires_ancient_lord',
            'werewolves_great_wolf_spirit',
            'wizards_arcane_protector',
            'pirates_the_kraken',
            'frankenstein_the_bride',
            'super_spies_moon_zero_three',
        ].every((defId) => !hasCardActivatableAbility(defId, {
            kind: 'ongoing',
            zone: 'board',
            window: 'playCards',
        }))).toBe(true);
        expect(
            TITAN_CARD_DEFS
                .filter(def => resolveTalent(def.id))
                .every(def =>
                    def.abilityTags?.includes('talent')
                    && hasCardActivatableAbility(def.id, {
                        kind: 'talent',
                        zone: 'board',
                        window: 'playCards',
                    }),
                ),
        ).toBe(true);
        expect(
            TITAN_CARD_DEFS
                .filter(def => resolveOngoingActivation(def.id))
                .every(def =>
                    hasCardActivatableAbility(def.id, {
                        kind: 'ongoing',
                        zone: 'board',
                        window: 'playCards',
                    }),
                ),
        ).toBe(true);
        const triggerOnlyTitanSpecialValidatorExceptions = [
            'sharks_helicoprion',
            'penguins_emperor_penguin',
            'changerbots_mergacon',
            'itty_critters_rainboroc',
        ];
        expect(
            TITAN_CARD_DEFS
                .filter(def => hasCardActivatableAbility(def.id, {
                    kind: 'special',
                    zone: 'setaside',
                    window: 'playCards',
                }))
                .every(def => hasTitanSpecialValidator(def.id) && Boolean(resolveSpecial(def.id))),
        ).toBe(true);
        expect(
            TITAN_CARD_DEFS
                .filter(def => hasTitanSpecialValidator(def.id))
                .filter(def => !hasCardActivatableAbility(def.id, {
                    kind: 'special',
                    zone: 'setaside',
                    window: 'playCards',
                }))
                .map(def => def.id)
                .sort(),
        ).toEqual(triggerOnlyTitanSpecialValidatorExceptions.sort());
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

        const currentInteraction = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_frankenstein_the_bride_start_choose_branch');
        expect(getPromptOptions(currentInteraction).some((option: any) => option.value?.skip === true)).toBe(true);
        expect(getPromptOptions(currentInteraction).map((option: any) => option.labelKey)).toEqual(expect.arrayContaining([
            'ui.titan_the_bride_effect_box',
            'ui.titan_the_bride_effect_destroy',
            'ui.titan_the_bride_effect_remove_counter',
            'ui.titan_the_bride_skip_start',
        ]));
    });

    it('titan_frankenstein_the_bride_start_choose_target 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 结算首个效果或进入后续分支', () => {
        const promptCore = makeState({
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
                uid: 'bride-target-stale',
                defId: 'frankenstein_the_bride',
                faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const triggerResult = fireTriggers(promptCore, 'onTurnStart', {
            state: promptCore,
            matchState: makeMatchState(promptCore, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 124,
        });

        const branchResult = respondToPromptOption(
            triggerResult.matchState!,
            entry => entry.value?.kind === 'destroy',
            'The Bride stale first branch option',
            '0',
            FIXED_RANDOM,
        );
        const targetPrompt = getSimpleChoicePrompt(
            branchResult.finalState,
            'titan_frankenstein_the_bride_start_choose_target',
        );
        expect(getPromptOption(targetPrompt, entry => entry.value?.targetUid === 'ally-1')).toBeDefined();

        const staleCore = makeState({
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
                uid: 'bride-target-stale',
                defId: 'frankenstein_the_bride',
                faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const resolved = respondToPromptOption(
            { ...branchResult.finalState, core: staleCore },
            entry => entry.value?.targetUid === 'ally-1',
            'The Bride stale target option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_DESTROYED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_PLAYED }),
        ]));
        expect(getOptionalSimpleChoicePrompt(
            resolved.finalState,
            'titan_frankenstein_the_bride_start_choose_branch',
        )).toBeUndefined();
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('ally-1');
    });

    it('titan_frankenstein_the_bride_start_choose_branch 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 进入目标选择', () => {
        const promptCore = makeState({
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
                    ...makeMinion('ally-branch-1', 'frankenstein_igor', '0', 2),
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

        const triggerResult = fireTriggers(promptCore, 'onTurnStart', {
            state: promptCore,
            matchState: makeMatchState(promptCore, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 124.1,
        });
        const branchPrompt = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_frankenstein_the_bride_start_choose_branch');
        expect(getPromptOption(branchPrompt, entry => entry.value?.kind === 'destroy')).toBeDefined();

        const staleCore: SmashUpCore = {
            ...triggerResult.matchState!.core,
            titans: (triggerResult.matchState!.core.titans ?? []).map(titan => titan.uid !== 'bride-branch-stale' ? titan : {
                ...titan,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }),
        };

        const resolved = respondToPromptOption(
            { ...triggerResult.matchState!, core: staleCore },
            entry => entry.value?.kind === 'destroy',
            'The Bride stale branch option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(getOptionalSimpleChoicePrompt(
            resolved.finalState,
            'titan_frankenstein_the_bride_start_choose_target',
        )).toBeUndefined();
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_DESTROYED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_PLAYED }),
        ]));
    });

    it('titan_frankenstein_the_bride_talent_add_counter 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 给随从加标记', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_factory',
                minions: [makeMinion('bride-target-counter', 'robot_zapbot', '0', 2)],
                ongoingActions: [],
            })],
            titans: [{
                uid: 'bride-talent-stale',
                defId: 'frankenstein_the_bride',
                faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
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
            payload: { titanUid: 'bride-talent-stale', baseIndex: 0 },
            timestamp: 125,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const prompt = getSimpleChoicePrompt(state, 'titan_frankenstein_the_bride_talent_add_counter');
        expect(getPromptOption(prompt, entry => entry.value?.minionUid === 'bride-target-counter' && entry.value?.baseIndex === 0)).toBeDefined();

        const staleCore: SmashUpCore = {
            ...state.core,
            titans: (state.core.titans ?? []).map(titan => titan.uid !== 'bride-talent-stale' ? titan : {
                ...titan,
                talentUsed: true,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.minionUid === 'bride-target-counter' && entry.value?.baseIndex === 0,
            'The Bride stale add-counter option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.POWER_COUNTER_ADDED }),
        ]));
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'bride-target-counter')?.powerCounters ?? 0).toBe(0);
    });

    it('titan_frankenstein_the_bride_start_choose_base 的 source titan 若在响应前已离开牌库旁，不应继续沿旧 prompt 进场', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-minion', 'frankenstein_igor', 'minion', '0')],
                    discard: [makeCard('discard-minion', 'frankenstein_lab_assistant', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_the_factory' }), makeBase({ defId: 'base_the_mothership' })],
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
        }), 'startTurn', '0');

        const prompt = createSimpleChoice(
            'test-bride-start-base-stale',
            '0',
            'The Bride：选择要打出的基地',
            [
                { id: 'base-0', label: '基地 0', value: { baseIndex: 0, baseDefId: 'base_the_factory' }, displayMode: 'button' as const },
                { id: 'base-1', label: '基地 1', value: { baseIndex: 1, baseDefId: 'base_the_mothership' }, displayMode: 'button' as const },
            ],
            {
                sourceId: 'titan_frankenstein_the_bride_start_choose_base',
                targetType: 'base',
            },
        );
        (prompt.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: 'bride-base-stale',
            titanDefId: 'frankenstein_the_bride',
        };
        state.sys.interaction.current = prompt as any;

        const staleCore: SmashUpCore = {
            ...state.core,
            titans: (state.core.titans ?? []).map(titan => titan.uid !== 'bride-base-stale' ? titan : {
                ...titan,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }),
        };

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.baseIndex === 1,
            'The Bride stale base option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_PLAYED }),
        ]));
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'bride-base-stale')?.location).toMatchObject({
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
            let currentState = post.matchState ?? makeMatchState(coreWithQueued, 'startTurn', '0');
            const allEvents: SmashUpEvent[] = [...post.events] as SmashUpEvent[];

            for (let step = 0; step < 4; step += 1) {
                const interactionResult = resolveInteractionChain(currentState, (prompt) => {
                    const sourceId = getPromptSourceId(prompt);
                    if (sourceId === 'smashup_reaction_choose') {
                        const options = getPromptOptions(prompt);
                        const preferredTrigger = options.find((option: any) =>
                            option?.value?.kind === 'trigger'
                            && String(option?.value?.triggerId ?? '').includes(preferSourceDefId),
                        );
                        const genericTrigger = options.find((option: any) => option?.value?.kind === 'trigger');
                        const fallback = preferredTrigger ?? genericTrigger ?? options[0];
                        return { optionId: fallback.id };
                    }
                    const options = getPromptOptions(prompt);
                    return { optionId: options[0]?.id };
                }, FIXED_RANDOM);

                allEvents.push(...interactionResult.events as SmashUpEvent[]);
                const committedCore = interactionResult.events.reduce(
                    (acc, event) => SmashUpDomain.reduce(acc, event as SmashUpEvent),
                    currentState.core,
                );
                const continued = postProcessSystemEvents(
                    committedCore,
                    interactionResult.events as SmashUpEvent[],
                    FIXED_RANDOM,
                    { ...interactionResult.finalState, core: committedCore },
                );
                allEvents.push(...continued.events as SmashUpEvent[]);
                currentState = continued.matchState ?? { ...interactionResult.finalState, core: committedCore };
                if (!getOptionalSimpleChoicePrompt(currentState)) {
                    break;
                }
            }

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

        const prompt = getSimpleChoicePrompt(started, 'titan_pecos_bill_duel_start');

        const discardOption = getPromptOption(prompt, entry => entry.value?.cardUid === 'discard-1', 'Pecos Bill duel discard option');
        const deployed = runCommand(
            started,
            respondCommand(discardOption.id, '0'),
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
            1001,
        );

        const prompt = getSimpleChoicePrompt(started, 'titan_pecos_bill_duel_start');
        expect(getPromptOption(prompt, entry => entry.value?.cardUid === 'discard-stale')).toBeDefined();

        const staleState = {
            ...started,
            core: {
                ...started.core,
                players: {
                    ...started.core.players,
                    '0': {
                        ...started.core.players['0'],
                        hand: [makeCard('discard-stale', 'wizard_summon', 'action', '0')],
                    },
                },
                titans: (started.core.titans ?? []).map((candidate) => candidate.uid === 'pecos-stale'
                    ? {
                        ...candidate,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    }
                    : candidate),
            },
        };

        const resolved = respondToPromptOption(
            staleState,
            entry => entry.value?.cardUid === 'discard-stale',
            'Pecos Bill stale duel discard option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARDS_DISCARDED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_METADATA_UPDATED }),
            expect.objectContaining({ type: SU_EVENTS.TITAN_PLAYED }),
        ]));
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('discard-stale');
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 'pecos-stale')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
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

    it('副警长指定目标后应弃置自己、给目标临时力量并继续结算决斗', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('deputy-1', 'cowboys_deputy', 'minion', '0')],
                    deck: [makeCard('draw-filler-1', 'robot_microbot_alpha', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.COWBOYS_POD, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ALIENS],
                }),
            },
            bases: [makeBase({
                defId: 'base_saloon_pod',
                minions: [
                    makeMinion('gun-1', 'cowboys_gunfighter_pod', '0', 4),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 5),
                ],
                ongoingActions: [],
            })],
        });

        const duelStarted = startDuel(
            makeMatchState(core),
            {
                sourceId: 'cowboys_high_noon_pod',
                sourcePlayerId: '0',
                challengerMinionUid: 'gun-1',
                challengedMinionUid: 'enemy-1',
                outcome: 'destroy_loser',
            },
            1004,
        );

        const resolved = resolveDuelChain(duelStarted, {
            smashup_duel_deputy_card: (prompt) => ({
                optionId: getPromptOption(prompt, entry => entry.value?.cardUid === 'deputy-1', '副警长弃置选项').id,
            }),
            smashup_duel_deputy_target: (prompt) => ({
                optionId: getPromptOption(prompt, entry => entry.value?.minionUid === 'gun-1', '副警长指定枪手选项').id,
            }),
        });

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'deputy-1')).toBe(false);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'deputy-1')).toBe(true);
        const gunfighter = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'gun-1');
        expect(gunfighter?.tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.activeDuel ?? null).toBeNull();
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
        const pecosPrompt = getSimpleChoicePrompt(duelStarted, 'titan_pecos_bill_duel_start');
        const discardOption = getPromptOption(pecosPrompt, entry => entry.value?.cardUid === 'discard-1', 'Pecos Bill clash discard option');
        const deployed = runCommand(
            duelStarted,
            respondCommand(discardOption.id, '0'),
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
                const missingActionOption = getPromptOption(prompt, entry => entry.value?.cardUid === 'missing-duel-card', 'missing duel card option');
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

        const currentInteraction = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_werewolves_great_wolf_spirit_move');
        expect(getPromptOptions(currentInteraction).some((option: any) => option.value?.skip === true)).toBe(true);
        expect(getPromptOptions(currentInteraction).some((option: any) => option.value?.baseIndex === 1)).toBe(true);
        expect(getPromptOptions(currentInteraction).some((option: any) => option.value?.baseIndex === 2)).toBe(false);

        expect(getPromptOption(currentInteraction, entry => entry.value?.baseIndex === 1)).toBeDefined();
        const resolved = respondToPromptOption(
            triggerResult.matchState!,
            entry => entry.value?.baseIndex === 1,
            'Great Wolf Spirit move base option',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.events.some(event => event.type === SU_EVENTS.TITAN_MOVED)).toBe(true);

        const moved = resolved.finalState.core;
        expect(moved.titans?.find(candidate => candidate.uid === 't-gws')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('titan_werewolves_great_wolf_spirit_move 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 移动泰坦', () => {
        const promptCore = makeState({
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

        const triggerResult = fireTriggers(promptCore, 'onTurnStart', {
            state: promptCore,
            matchState: makeMatchState(promptCore, 'startTurn', '0'),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 72,
        });

        const prompt = getSimpleChoicePrompt(triggerResult.matchState!, 'titan_werewolves_great_wolf_spirit_move');
        expect(getPromptOption(prompt, entry => entry.value?.baseIndex === 1)).toBeDefined();

        const staleCore = makeState({
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
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const resolved = respondToPromptOption(
            { ...triggerResult.matchState!, core: staleCore },
            entry => entry.value?.baseIndex === 1,
            'Great Wolf Spirit stale move option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TITAN_MOVED }),
        ]));
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 't-gws-stale')?.location).toMatchObject({
            zone: 'setaside',
        });
    });

    it('titan_werewolves_great_wolf_spirit_talent 的 source titan 若在响应前已离开基地，不应继续沿旧 prompt 给随从 +1 临时力量', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('wolf-target-stale', 'werewolf_teenage_wolf', '0', 2)],
                }),
                makeBase(),
            ],
            titans: [{
                uid: 't-gws-talent-stale',
                defId: 'werewolves_great_wolf_spirit',
                faction: SMASHUP_FACTION_IDS.WEREWOLVES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } satisfies TitanState],
        });

        const state = makeMatchState(core, 'playCards', '0');
        const command: SmashUpCommand = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-gws-talent-stale', baseIndex: 1 },
            timestamp: 70,
        };

        expect(SmashUpDomain.validate(state, command).valid).toBe(true);
        SmashUpDomain.execute(state, command, FIXED_RANDOM);

        const prompt = getSimpleChoicePrompt(state, 'titan_werewolves_great_wolf_spirit_talent');
        expect(getPromptOption(prompt, entry => entry.value?.minionUid === 'wolf-target-stale' && entry.value?.baseIndex === 0)).toBeDefined();

        const staleCore: SmashUpCore = {
            ...state.core,
            titans: (state.core.titans ?? []).map(titan => titan.uid !== 't-gws-talent-stale' ? titan : {
                ...titan,
                talentUsed: true,
                location: { zone: 'setaside' },
            }),
        };

        const resolved = respondToPromptOption(
            { ...state, core: staleCore },
            entry => entry.value?.minionUid === 'wolf-target-stale' && entry.value?.baseIndex === 0,
            'Great Wolf Spirit stale talent target option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TEMP_POWER_ADDED }),
        ]));
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'wolf-target-stale')?.tempPowerModifier ?? 0).toBe(0);
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
        const prompts = getPromptsBySourceId(played.finalState, 'titan_dinosaurs_fort_titanosaurus_ongoing');
        expect(prompts).toHaveLength(1);

        const fortPrompt = prompts[0] as any;
        expect(getPromptOptions(fortPrompt).filter((option: any) => option?.value?.mode === 'both')).toHaveLength(2);
        expect(getPromptOptions(fortPrompt).some((option: any) => option?.value?.targetMinionUid === 'ally-1')).toBe(true);
        expect(getPromptOptions(fortPrompt).some((option: any) => option?.value?.targetMinionUid === 'ally-2')).toBe(true);
    });
});

