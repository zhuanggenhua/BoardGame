/**
 * 大杀四方 (Smash Up) - 测试辅助函数
 *
 * 所有测试文件共用的 makeMinion / makePlayer / makeState / makeMatchState 等工厂函数。
 * 消除 16+ 个测试文件中的重复定义。
 */

import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import type {
    AbilityTag,
    SmashUpCore,
    SmashUpEvent,
    PlayerState,
    MinionOnBase,
    BaseInPlay,
    CardInstance,
    MinionDestroyedEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import {
    processAffectTriggers,
    processDestroyTriggers,
    processMoveTriggers,
    processReturnToHandTriggers,
    reduce,
} from '../domain/reducer';
import { resolveAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { createInitialSystemState } from '../../../engine/pipeline';
import { smashUpTestSystems } from './testRunner';
import { createScoringBaseRef, createScoringSession, getScoringSession, setScoringSession } from '../domain/scoringSession';
import { getSmashUpReactionSession } from '../domain/reactionSession';

// ============================================================================
// 随从工厂
// ============================================================================

/** 创建基地上的随从实例（常用签名） */
export function makeMinion(
    uid: string,
    defId: string,
    controller: string,
    power: number,
    ownerOrOpts?: string | Partial<MinionOnBase>,
): MinionOnBase {
    const base: MinionOnBase = {
        uid,
        defId,
        controller,
        owner: typeof ownerOrOpts === 'string' ? ownerOrOpts : controller,
        basePower: power,
        powerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
    if (typeof ownerOrOpts === 'object') {
        return { ...base, ...ownerOrOpts };
    }
    return base;
}

/** 创建基地上的随从实例（overrides 签名，用于 ongoingEffects/baseFactionOngoing/expansionOngoing 等） */
export function makeMinionFromOverrides(overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid: 'minion-1',
        defId: 'test_minion',
        controller: '0',
        owner: '0',
        basePower: 3,
        powerModifier: 0,
        talentUsed: false,
        attachedActions: [],
        ...overrides,
    };
}


// ============================================================================
// 玩家工厂
// ============================================================================

/** 创建玩家状态（通用签名） */
export function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id,
        vp: 0,
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ALIENS],
        ...overrides,
    };
}

/** 创建玩家状态（带自定义派系签名） */
export function makePlayerWithFactions(
    id: string,
    factions: [string, string],
    overrides?: Partial<PlayerState>,
): PlayerState {
    return makePlayer(id, { factions, ...overrides });
}

// ============================================================================
// 卡牌实例工厂
// ============================================================================

/** 创建卡牌实例（4 参数签名：uid, defId, type, owner） */
export function makeCard(
    uid: string,
    defId: string,
    type: 'minion' | 'action',
    owner: string,
): CardInstance;
/** 创建卡牌实例（3 参数签名：uid, defId, owner，默认 type='minion'） */
export function makeCard(
    uid: string,
    defId: string,
    owner: string,
): CardInstance;
/** 创建卡牌实例实现 */
export function makeCard(
    uid: string,
    defId: string,
    typeOrOwner: 'minion' | 'action' | string,
    owner?: string,
): CardInstance {
    // 3 参数：uid, defId, owner（type 默认为 'minion'）
    if (owner === undefined) {
        return { uid, defId, owner: typeOrOwner, type: 'minion' };
    }
    // 4 参数：uid, defId, type, owner
    return { uid, defId, owner, type: typeOrOwner as 'minion' | 'action' };
}

// ============================================================================
// 基地工厂
// ============================================================================

/** 创建空基地 */
export function makeBase(defId: string, minions?: MinionOnBase[]): BaseInPlay;
export function makeBase(overrides: Partial<BaseInPlay>): BaseInPlay;
export function makeBase(
    defIdOrOverrides: string | Partial<BaseInPlay>,
    minions: MinionOnBase[] = [],
): BaseInPlay {
    if (typeof defIdOrOverrides === 'string') {
        return { defId: defIdOrOverrides, minions, ongoingActions: [] };
    }

    return {
        defId: 'test_base',
        minions: [],
        ongoingActions: [],
        ...defIdOrOverrides,
    };
}

// ============================================================================
// 状态工厂
// ============================================================================

/** 创建最小可用的 SmashUpCore（双人） */
export function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [{ defId: 'test_base', minions: [], ongoingActions: [] }],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

/** 创建带基地列表的 SmashUpCore */
export function makeStateWithBases(
    bases: BaseInPlay[],
    overrides?: Partial<SmashUpCore>,
): SmashUpCore {
    return makeState({ bases, ...overrides });
}

/** 创建带疯狂牌库的 SmashUpCore */
export function makeStateWithMadness(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return makeState({
        madnessDeck: Array.from({ length: 30 }, (_, i) => `madness_${i}`),
        ...overrides,
    });
}

/** 包装为 MatchState（用于 validate/execute 测试） */
export function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    const playerIds = Object.keys(core.players);
    const sys = createInitialSystemState(playerIds, smashUpTestSystems, undefined);
    // 测试默认在出牌阶段
    sys.phase = 'playCards';
    return { core, sys };
}

export function scoreBaseViaFlow(
    core: SmashUpCore,
    baseIndex: number,
    baseDeck: string[],
    playerId: string,
    now: number,
    random: RandomFn = defaultTestRandom,
    matchState?: MatchState<SmashUpCore>,
): { events: SmashUpEvent[]; newBaseDeck: string[]; matchState?: MatchState<SmashUpCore> } {
    const scoringCore: SmashUpCore = {
        ...(matchState?.core ?? core),
        baseDeck: [...baseDeck],
    };
    let state: MatchState<SmashUpCore> = matchState
        ? { ...matchState, core: scoringCore }
        : makeMatchState(scoringCore);
    state = {
        ...state,
        sys: {
            ...state.sys,
            phase: 'scoreBases',
            flowHalted: false,
        } as typeof state.sys,
    };

    const baseRef = createScoringBaseRef(state.core, baseIndex);
    if (baseRef) {
        state = setScoringSession(state, {
            ...createScoringSession(state.core, [baseIndex]),
            lockedBaseRefs: [baseRef],
            currentBaseRef: baseRef,
            currentStep: 'resolving-base',
        });
    }

    const allEvents: SmashUpEvent[] = [];
    let currentState = state;

    for (let step = 0; step < 20; step += 1) {
        const result = runCommand(
            currentState,
            {
                type: 'ADVANCE_PHASE',
                playerId,
                payload: undefined,
                timestamp: now + step,
            } as any,
            random,
        );
        allEvents.push(...result.events as SmashUpEvent[]);
        currentState = result.finalState;

        if (!result.success) {
            break;
        }
        if (currentState.sys.interaction?.current || getSmashUpReactionSession(currentState)) {
            break;
        }
        const session = getScoringSession(currentState);
        if (currentState.sys.phase !== 'scoreBases' || !session) {
            break;
        }
        if (result.events.length === 0 && !currentState.sys.flowHalted) {
            break;
        }
    }

    const phaseChangedAfterScoreIndex = allEvents.findIndex((event) =>
        event.type === 'SYS_PHASE_CHANGED'
        && (event as GameEvent<{ from?: string }>).payload?.from === 'scoreBases',
    );
    const scoringEvents = phaseChangedAfterScoreIndex >= 0
        ? allEvents.slice(0, phaseChangedAfterScoreIndex)
        : allEvents;

    return {
        events: scoringEvents,
        newBaseDeck: currentState.core.baseDeck,
        matchState: currentState,
    };
}

export interface DestroyedMinionInput {
    minionUid: string;
    minionDefId: string;
    fromBaseIndex?: number;
    ownerId: string;
    destroyerId?: string;
    reason?: string;
    timestamp?: number;
}

type DestroyedMinionLike = DestroyedMinionInput | MinionDestroyedEvent;

export function makeMinionDestroyedEvent(input: DestroyedMinionLike): MinionDestroyedEvent {
    if ('payload' in input) {
        return input;
    }

    return {
        type: 'su:minion_destroyed',
        payload: {
            minionUid: input.minionUid,
            minionDefId: input.minionDefId,
            fromBaseIndex: input.fromBaseIndex ?? 0,
            ownerId: input.ownerId,
            destroyerId: input.destroyerId,
            reason: input.reason ?? 'test_destroy',
        },
        timestamp: input.timestamp ?? 1000,
    } as MinionDestroyedEvent;
}

export function resolveDestroyedMinions(
    state: MatchState<SmashUpCore>,
    currentPlayerId: string,
    destroyed: DestroyedMinionLike[],
    random: RandomFn = defaultTestRandom,
    now = 1000,
    options?: { skipDestroyEventKeys?: Set<string> },
) {
    return processDestroyTriggers(
        destroyed.map(makeMinionDestroyedEvent),
        state,
        currentPlayerId,
        random,
        now,
        options,
    );
}

export interface MovedMinionInput {
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
    toBaseIndex: number;
    reason?: string;
    timestamp?: number;
}

type MovedMinionLike = MovedMinionInput | SmashUpEvent;

export function makeMinionMovedEvent(input: MovedMinionLike): SmashUpEvent {
    if ('type' in input) {
        return input;
    }

    return {
        type: SU_EVENTS.MINION_MOVED,
        payload: {
            minionUid: input.minionUid,
            minionDefId: input.minionDefId,
            fromBaseIndex: input.fromBaseIndex,
            toBaseIndex: input.toBaseIndex,
            reason: input.reason ?? 'test_move',
        },
        timestamp: input.timestamp ?? 1000,
    } as SmashUpEvent;
}

export function resolveMovedMinions(
    state: MatchState<SmashUpCore>,
    currentPlayerId: string,
    moved: MovedMinionLike[],
    random: RandomFn = defaultTestRandom,
    now = 1000,
) {
    return processMoveTriggers(
        moved.map(makeMinionMovedEvent),
        state,
        currentPlayerId,
        random,
        now,
    );
}

export function resolveAffectedMinions(
    state: MatchState<SmashUpCore>,
    currentPlayerId: string,
    events: SmashUpEvent[],
    random: RandomFn = defaultTestRandom,
    now = 1000,
) {
    return processAffectTriggers(events, state, currentPlayerId, random, now);
}

export function resolveCardsReturnedToHand(
    state: MatchState<SmashUpCore>,
    currentPlayerId: string,
    events: SmashUpEvent[],
    random: RandomFn = defaultTestRandom,
    now = 1000,
) {
    return processReturnToHandTriggers(events, state, currentPlayerId, random, now);
}

// ============================================================================
// 事件应用工具
// ============================================================================

/** 应用事件列表到状态（通过 reduce） */
export function applyEvents(state: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((s, e) => reduce(s, e), state);
}

// ============================================================================
// 测试 helper / 注册表合同工具
// ============================================================================

import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { getAbilityRuntimePromptHandler } from '../domain/abilityRuntime';
import { defaultTestRandom, runCommand } from './testRunner';
import { INTERACTION_COMMANDS, asSimpleChoice } from '../../../engine/systems/InteractionSystem';

import type { BaseAbilityContext, BaseAbilityResult } from '../domain/baseAbilities';
import { triggerBaseAbility as _triggerBaseAbility } from '../domain/baseAbilities';

/**
 * 基地能力测试桥接：自动注入 matchState 到 ctx
 *
 * 旧测试不传 matchState，但新能力实现需要它来调用 queueInteraction。
 * 返回 BaseAbilityResult（含 events 和 matchState）。
 */
export function triggerBaseAbilityWithMS(
    baseDefId: string,
    timing: 'onMinionPlayed' | 'onMinionDestroyed' | 'onTurnStart' | 'whenScoring' | 'afterScoring' | 'onActionPlayed',
    ctx: BaseAbilityContext,
): BaseAbilityResult {
    const ctxWithMS: BaseAbilityContext = {
        ...ctx,
        matchState: ctx.matchState ?? makeMatchState(ctx.state),
    };
    return _triggerBaseAbility(baseDefId, timing, ctxWithMS);
}

/**
 * 获取 BaseAbilityResult 中的所有 interaction（current + queue）
 * 用于替代旧的 CHOICE_REQUESTED 事件检查
 */
export function getInteractionsFromResult(result: BaseAbilityResult): any[] {
    const interaction = (result.matchState?.sys as any)?.interaction;
    if (!interaction) return [];
    const list: any[] = [];
    if (interaction.current) list.push(interaction.current);
    if (interaction.queue?.length) list.push(...interaction.queue);
    return list;
}


/**
 * 从 MatchState 中获取所有 interaction（current + queue）
 * 用于 execute() 后检查是否创建了交互
 */
export function getInteractionsFromMS(ms: MatchState<SmashUpCore>): any[] {
    const interaction = (ms.sys as any)?.interaction;
    if (!interaction) return [];
    const list: any[] = [];
    if (interaction.current) list.push(interaction.current);
    if (interaction.queue?.length) list.push(...interaction.queue);
    return list;
}

export function findInteractionOption(
    prompt: any,
    predicate: (option: any) => boolean,
): any | undefined {
    const options = prompt?.options ?? prompt?.data?.options;
    return options?.find((option: any) => predicate(option));
}

/**
 * 行为级 prompt facade：测试用例不应散落直读 sys.interaction.current。
 * 若未来 InteractionSystem 内部结构变化，优先改这里，而不是批量改用例。
 */
export function getFirstPrompt(ms: MatchState<SmashUpCore>): any | undefined {
    return getInteractionsFromMS(ms)[0];
}

export function getOptionalSimpleChoicePrompt(
    ms: MatchState<SmashUpCore>,
    expectedSourceId?: string,
): any | undefined {
    const prompts = getInteractionsFromMS(ms);
    const rawPrompt = expectedSourceId === undefined
        ? prompts[0]
        : prompts.find((entry: any) => (entry?.sourceId ?? entry?.data?.sourceId) === expectedSourceId);
    return asSimpleChoice(rawPrompt) ?? undefined;
}

export function getSimpleChoicePrompt(
    ms: MatchState<SmashUpCore>,
    expectedSourceId?: string,
): any {
    const prompt = getOptionalSimpleChoicePrompt(ms, expectedSourceId);
    if (!prompt) {
        const prompts = getInteractionsFromMS(ms);
        const availableSourceIds = prompts
            .map((entry: any) => entry?.sourceId ?? entry?.data?.sourceId ?? 'unknown')
            .join(', ');
        throw new Error(
            expectedSourceId === undefined
                ? 'Expected a simple choice prompt, but no prompt was available.'
                : `Expected a simple choice prompt with sourceId "${expectedSourceId}", available prompts: ${availableSourceIds || 'none'}.`,
        );
    }
    if (expectedSourceId !== undefined && prompt.sourceId !== expectedSourceId) {
        throw new Error(`Expected prompt sourceId "${expectedSourceId}", got "${prompt.sourceId}".`);
    }
    return prompt;
}

export function getPromptOptionById(prompt: any, optionId: string): any | undefined {
    return prompt?.options?.find((option: any) => option.id === optionId);
}

export function getPromptOptions(prompt: any): any[] {
    return prompt?.options ?? prompt?.data?.options ?? [];
}

export function getPromptMultiMin(prompt: any): number | undefined {
    return prompt?.multi?.min ?? prompt?.data?.multi?.min;
}

export function getPromptMulti(prompt: any): any {
    return prompt?.multi ?? prompt?.data?.multi;
}

export function getPromptOptionsGenerator(prompt: any): ((state: MatchState<SmashUpCore>, data: any) => any[]) | undefined {
    return prompt?.optionsGenerator ?? prompt?.data?.optionsGenerator;
}

export function getPromptTitle(prompt: any): string | undefined {
    return prompt?.title ?? prompt?.data?.title;
}

export function getPromptSourceId(prompt: any): string | undefined {
    return prompt?.sourceId ?? prompt?.data?.sourceId;
}

export function getPromptPlayerId(prompt: any): string | undefined {
    return prompt?.playerId ?? prompt?.data?.playerId;
}

export function getPromptTargetType(prompt: any): string | undefined {
    return prompt?.targetType ?? prompt?.data?.targetType;
}

export function getPromptHandlerData(prompt: any): any {
    return prompt?.data ?? prompt;
}

export function withPromptHandlerData(prompt: any, handlerData: Record<string, unknown>): any {
    return {
        ...prompt,
        data: {
            ...(prompt?.data ?? {}),
            ...handlerData,
        },
    };
}

export function withPromptResolutionFrameId(prompt: any, resolutionFrameId: string): any {
    return {
        ...prompt,
        resolutionFrameId,
    };
}

export function getPromptSliderMax(prompt: any): number | undefined {
    return prompt?.slider?.max ?? prompt?.data?.slider?.max;
}

export function getPromptRuntimeContinuationContext(prompt: any): any {
    return prompt?.runtimePrompt?.continuation?.context
        ?? prompt?.data?.runtimePrompt?.continuation?.context;
}

export function getCurrentPromptResolutionFrameId(
    state: MatchState<SmashUpCore>,
    expectedSourceId?: string,
): string | undefined {
    const prompt = getFirstPrompt(state);
    if (!prompt) {
        throw new Error('Expected a prompt with a resolution frame, but no prompt was available.');
    }
    const sourceId = prompt?.data?.sourceId ?? prompt?.sourceId;
    if (expectedSourceId !== undefined && sourceId !== expectedSourceId) {
        throw new Error(`Expected prompt sourceId "${expectedSourceId}", got "${sourceId}".`);
    }
    return prompt?.resolutionFrameId;
}

export function getPromptOption(
    prompt: any,
    predicate: (option: any) => boolean,
    description = 'matching prompt option',
): any {
    const option = getPromptOptions(prompt).find((entry: any) => predicate(entry));
    if (!option) {
        throw new Error(`Expected ${description}, but it was not available.`);
    }
    return option;
}

export function getPromptOptionByCardUid(prompt: any, cardUid: string): any | undefined {
    return prompt?.options?.find((option: any) => option.value?.cardUid === cardUid);
}

export function respondToPrompt(
    state: MatchState<SmashUpCore>,
    optionId: string,
    playerId?: string,
    random: RandomFn = defaultTestRandom,
) {
    const prompt = getFirstPrompt(state);
    if (!prompt) {
        throw new Error('Expected a prompt to respond to, but no prompt was available.');
    }
    return runCommand(
        state,
        {
            type: INTERACTION_COMMANDS.RESPOND as any,
            playerId: playerId ?? prompt.playerId,
            payload: { optionId },
        } as any,
        random,
    );
}

export function respondToPromptOption(
    state: MatchState<SmashUpCore>,
    predicate: (option: any) => boolean,
    description = 'matching prompt option',
    playerId?: string,
    random: RandomFn = defaultTestRandom,
) {
    const prompt = getFirstPrompt(state);
    if (!prompt) {
        throw new Error('Expected a prompt to respond to, but no prompt was available.');
    }
    const option = getPromptOption(prompt, predicate, description);
    return respondToPrompt(state, option.id, playerId, random);
}

export function respondCommand(optionId: string, playerId?: string): any {
    return {
        type: INTERACTION_COMMANDS.RESPOND as any,
        ...(playerId === undefined ? {} : { playerId }),
        payload: { optionId },
    };
}

export function respondOptionsCommand(optionIds: string[], playerId?: string): any {
    return {
        type: INTERACTION_COMMANDS.RESPOND as any,
        ...(playerId === undefined ? {} : { playerId }),
        payload: { optionIds },
    };
}

export function getRespondCommandOptionId(command: any): string | undefined {
    if (command?.type !== INTERACTION_COMMANDS.RESPOND) {
        throw new Error(`Expected an interaction respond command, got ${command?.type ?? 'unknown'}.`);
    }
    return command?.payload?.optionId;
}

export function respondToPromptOptions(
    state: MatchState<SmashUpCore>,
    optionIds: string[],
    playerId?: string,
    random: RandomFn = defaultTestRandom,
) {
    const prompt = getFirstPrompt(state);
    if (!prompt) {
        throw new Error('Expected a prompt to respond to, but no prompt was available.');
    }
    return runCommand(
        state,
        {
            type: INTERACTION_COMMANDS.RESPOND as any,
            playerId: playerId ?? prompt.playerId,
            payload: { optionIds },
        } as any,
        random,
    );
}

export function respondToPromptWithMergedValue(
    state: MatchState<SmashUpCore>,
    optionId: string,
    mergedValue: unknown,
    playerId?: string,
    random: RandomFn = defaultTestRandom,
) {
    const prompt = getFirstPrompt(state);
    if (!prompt) {
        throw new Error('Expected a prompt to respond to, but no prompt was available.');
    }
    return runCommand(
        state,
        {
            type: INTERACTION_COMMANDS.RESPOND as any,
            playerId: playerId ?? prompt.playerId,
            payload: { optionId, mergedValue },
        } as any,
        random,
    );
}

export function cancelPrompt(
    state: MatchState<SmashUpCore>,
    playerId?: string,
    reason = 'test-cancel',
    random: RandomFn = defaultTestRandom,
) {
    const prompt = getFirstPrompt(state);
    if (!prompt) {
        throw new Error('Expected a prompt to cancel, but no prompt was available.');
    }
    return runCommand(
        state,
        {
            type: INTERACTION_COMMANDS.CANCEL as any,
            playerId: playerId ?? prompt.playerId,
            payload: { reason },
        } as any,
        random,
    );
}

export function getPromptCountBySourceId(
    state: MatchState<SmashUpCore>,
    sourceId: string,
): number {
    return getPromptsBySourceId(state, sourceId).length;
}

export function getPromptsBySourceId(
    state: MatchState<SmashUpCore>,
    sourceId: string,
): any[] {
    return getInteractionsFromMS(state)
        .filter(prompt => (prompt?.sourceId ?? prompt?.data?.sourceId) === sourceId);
}

export function expectNoPrompt(state: MatchState<SmashUpCore>): void {
    const prompts = getInteractionsFromMS(state);
    if (prompts.length !== 0) {
        const sourceIds = prompts
            .map((prompt: any) => prompt?.sourceId ?? prompt?.data?.sourceId ?? 'unknown')
            .join(', ');
        throw new Error(`Expected no prompt, but found ${prompts.length}: ${sourceIds}`);
    }
}

export function withoutCurrentPrompt(state: MatchState<SmashUpCore>): MatchState<SmashUpCore> {
    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...(state.sys as any).interaction,
                current: undefined,
            },
        },
    } as MatchState<SmashUpCore>;
}

export function withCurrentPrompt(
    state: MatchState<SmashUpCore>,
    prompt: any,
): MatchState<SmashUpCore> {
    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...(state.sys as any).interaction,
                current: prompt,
            },
        },
    } as MatchState<SmashUpCore>;
}

export function withoutQueuedPrompts(state: MatchState<SmashUpCore>): MatchState<SmashUpCore> {
    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...(state.sys as any).interaction,
                queue: [],
            },
        },
    } as MatchState<SmashUpCore>;
}

export function withOnlyCurrentPrompt(
    state: MatchState<SmashUpCore>,
    prompt: any,
): MatchState<SmashUpCore> {
    return withoutQueuedPrompts(withCurrentPrompt(state, prompt));
}

export function invokeRegisteredAbilityContract(
    defId: string,
    tag: AbilityTag,
    ctx: AbilityContext,
): AbilityResult {
    return expectRegisteredAbilityContract(defId, tag)(ctx);
}

export function expectRegisteredAbilityContract(
    defId: string,
    tag: AbilityTag,
) {
    const executor = resolveAbility(defId, tag);
    if (!executor) {
        throw new Error(`Expected registered Smash Up ability contract for ${defId}::${tag}.`);
    }
    return executor;
}

export function invokeRegisteredInteractionHandlerContract(
    sourceId: string,
    state: MatchState<SmashUpCore>,
    playerId: string,
    selectedValue: unknown,
    data: unknown,
    now: number,
    random: RandomFn = defaultTestRandom,
) {
    const handler = lookupRegisteredInteractionHandler(sourceId);
    if (!handler) {
        throw new Error(`Expected registered interaction handler for sourceId "${sourceId}".`);
    }
    return handler(
        state,
        playerId,
        selectedValue,
        data,
        random,
        now,
    );
}

export function invokeRegisteredRuntimePromptHandlerContract(
    sourceId: string,
    state: MatchState<SmashUpCore>,
    playerId: string,
    selectedValue: unknown,
    data: unknown,
    now: number,
    random: RandomFn = defaultTestRandom,
) {
    const handler = lookupRegisteredRuntimePromptHandler(sourceId);
    if (!handler) {
        throw new Error(`Expected registered runtime prompt handler for sourceId "${sourceId}".`);
    }
    return handler(
        state,
        playerId,
        selectedValue,
        data,
        random,
        now,
    );
}

export function findRegisteredPromptContinuationContract(sourceId: string) {
    return lookupRegisteredInteractionHandler(sourceId) ?? lookupRegisteredRuntimePromptHandler(sourceId);
}

export function expectRegisteredInteractionHandlerContract(sourceId: string) {
    const handler = lookupRegisteredInteractionHandler(sourceId);
    if (!handler) {
        throw new Error(`Expected registered interaction handler for sourceId "${sourceId}".`);
    }
    return handler;
}

export function expectRegisteredRuntimePromptHandlerContract(sourceId: string) {
    const handler = lookupRegisteredRuntimePromptHandler(sourceId);
    if (!handler) {
        throw new Error(`Expected registered runtime prompt handler for sourceId "${sourceId}".`);
    }
    return handler;
}

export function expectRegisteredPromptContinuationContract(sourceId: string) {
    const handler = findRegisteredPromptContinuationContract(sourceId);
    if (!handler) {
        throw new Error(`Expected registered prompt continuation contract for sourceId "${sourceId}".`);
    }
    return handler;
}

function lookupRegisteredInteractionHandler(sourceId: string) {
    return getInteractionHandler(sourceId);
}

function lookupRegisteredRuntimePromptHandler(sourceId: string) {
    return getAbilityRuntimePromptHandler(sourceId);
}

export function getReactionPrompt(state: MatchState<SmashUpCore>): any {
    return getSimpleChoicePrompt(state, 'smashup_reaction_choose');
}

export function getReactionPromptOptionBySourceDefId(
    state: MatchState<SmashUpCore>,
    prompt: any,
    sourceDefId: string,
): any {
    const queueById = new Map((state.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
    return getPromptOption(
        prompt,
        (option: any) => queueById.get(option.value?.triggerId)?.sourceDefId === sourceDefId,
        `reaction option for ${sourceDefId}`,
    );
}

export function getReactionPromptSourceDefIds(
    state: MatchState<SmashUpCore>,
    prompt: any,
): string[] {
    const queueById = new Map((state.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
    return getPromptOptions(prompt)
        .map((option: any) => queueById.get(option.value?.triggerId)?.sourceDefId)
        .filter(Boolean);
}

export function resolveInteractionChain(
    initialState: MatchState<SmashUpCore>,
    resolver: (
        prompt: any,
        state: MatchState<SmashUpCore>,
        step: number,
    ) => { optionId?: string; optionIds?: string[]; mergedValue?: unknown },
    random: RandomFn = defaultTestRandom,
    maxSteps = 20,
): { finalState: MatchState<SmashUpCore>; events: GameEvent[] } {
    let state = initialState;
    const events: GameEvent[] = [];

    for (let step = 0; step < maxSteps; step += 1) {
        const prompt = getFirstPrompt(state);
        if (!prompt) {
            return { finalState: state, events };
        }

        const payload = resolver(prompt, state, step);
        const result = runCommand(
            state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: prompt.playerId,
                payload,
            } as any,
            random,
        );
        events.push(...result.events);
        state = result.finalState;
    }

    throw new Error(`交互链在 ${maxSteps} 步内未完成`);
}
