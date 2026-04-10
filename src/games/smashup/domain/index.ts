/**
 * 澶ф潃鍥涙柟 (Smash Up) - 棰嗗煙鍐呮牳缁勮
 *
 * 鑱岃矗锛歴etup 鍒濆鍖栥€丗lowSystem 閽╁瓙銆乸layerView銆乮sGameOver
 */

import type { DomainCore, GameEvent, GameOverResult, PlayerId, RandomFn, MatchState } from '../../../engine/types';
import { processDestroyMoveCycle, processAffectTriggers, processDeckInspectionTriggers, filterProtectedAffectEvents } from './reducer';
import type { FlowHooks, PhaseEnterResult } from '../../../engine/systems/FlowSystem';
import type {
    SmashUpCommand,
    SmashUpCore,
    SmashUpEvent,
    AbilityFeedbackEvent,
    GamePhase,
    PlayerState,
    BaseInPlay,
    TurnStartedEvent,
    TurnEndedEvent,
    CardsDrawnEvent,
    BaseScoredEvent,
    BaseClearedEvent,
    BaseReplacedEvent,
    DeckReshuffledEvent,
    MinionPlayedEvent,
    MinionPowerBreakdown,
    MinionOnBase,
} from './types';
import {
    PHASE_ORDER,
    SU_EVENTS,
    SU_EVENT_TYPES,
    SU_COMMANDS,
    DRAW_PER_TURN,
    HAND_LIMIT,
    VP_TO_WIN,
    getCurrentPlayerId,
} from './types';
import { getEffectivePower, getTotalEffectivePowerOnBase, getEffectiveBreakpoint, getEffectivePowerBreakdown, getPlayerEffectivePowerOnBase, getScoringEligibleBaseIndices } from './ongoingModifiers';
import { collectTriggers, fireTriggerForSource, fireTriggers, hasRegisteredTrigger, interceptEvent as ongoingInterceptEvent } from './ongoingEffects';
import { maybeResolveReactionQueue } from './reactionQueue';
import { validate } from './commands';
import { execute, reduce } from './reducer';
import { getAllBaseDefIds, getBaseDef, getCardDef } from '../data/cards';
import { drawCards } from './utils';
import {
    countMadnessCardsForPlayer,
    madnessVpPenalty,
    fireMinionPlayedTriggers,
    getTitanByUid,
    getTitansOnBase,
    removeTitanFromPlay,
} from './abilityHelpers';
import { triggerAllBaseAbilities, triggerBaseAbility, triggerExtendedBaseAbility, hasBaseAbility } from './baseAbilities';
import { collectBaseAbilityTriggers, collectExtendedBaseAbilityTriggers } from './baseAbilityQueue';
import { openMeFirstWindow, openAfterScoringWindow, buildBaseTargetOptions, isSpecialLimitBlocked } from './abilityHelpers';
import type { PhaseExitResult } from '../../../engine/systems/FlowSystem';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { RESPONSE_WINDOW_EVENTS } from '../../../engine/systems/ResponseWindowSystem';
import type { SpecialAfterScoringConsumedEvent } from './types';
import {
    buildPendingPostScoringActionEvents,
    clearScoringSession,
    createScoringBaseRef,
    createScoringSession,
    getRemainingScoringBaseRefs,
    getScoringSession,
    markScoringBaseCompleted,
    resolveScoringBaseRefSlotIndex,
    serializePostScoringEvents,
    setScoringSession,
    updateScoringSession,
    type SmashUpScoringBaseRef,
} from './scoringSession';

// ============================================================================
// 鍩哄湴璁板垎杈呭姪鍑芥暟锛堜緵 FlowHooks 鍜?Prompt 缁х画鍑芥暟鍏辩敤锛?
// ============================================================================

function collectQualifiedPlayerPowers(
    core: SmashUpCore,
    base: BaseInPlay,
    baseIndex: number,
): Map<PlayerId, number> {
    const playersWithMinions = new Set<PlayerId>(
        base.minions.map(minion => minion.controller),
    );
    const playerPowers = new Map<PlayerId, number>();

    for (const playerId of Object.keys(core.players) as PlayerId[]) {
        const power = getPlayerEffectivePowerOnBase(core, base, baseIndex, playerId);
        if (power > 0 || playersWithMinions.has(playerId)) {
            playerPowers.set(playerId, power);
        }
    }

    return playerPowers;
}

function hasPendingScoreBasesSpecialActivation(state: MatchState<SmashUpCore>): boolean {
    const playerId = getCurrentPlayerId(state.core);
    if (!playerId) return false;

    for (const baseIndex of getScoringEligibleBaseIndices(state.core)) {
        const base = state.core.bases[baseIndex];
        if (!base) continue;

        for (const minion of base.minions) {
            if (minion.controller !== playerId) continue;
            const result = validate(state, {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId,
                payload: { minionUid: minion.uid, baseIndex },
            });
            if (result.valid) return true;
        }

        for (const titan of state.core.titans ?? []) {
            const result = validate(state, {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId,
                payload: { titanUid: titan.uid, baseIndex },
            });
            if (result.valid) return true;
        }
    }

    return false;
}

function getPlayersWithPlayableAfterScoringResponses(state: MatchState<SmashUpCore>, now: number): PlayerId[] {
    const eligibleBaseIndices = getScoringEligibleBaseIndices(state.core);
    const playablePlayers: PlayerId[] = [];

    for (const playerId of Object.keys(state.core.players) as PlayerId[]) {
        const player = state.core.players[playerId];
        if (!player) continue;

        const probeState: MatchState<SmashUpCore> = {
            ...state,
            sys: {
                ...state.sys,
                responseWindow: {
                    ...state.sys.responseWindow,
                    current: {
                        id: `afterScoring_probe_${playerId}_${now}`,
                        windowType: 'afterScoring',
                        sourceId: 'scoreBases',
                        responderQueue: [playerId],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
            },
        };

        const hasPlayableResponse = player.hand.some(card => {
            const baseCandidates = [undefined, ...eligibleBaseIndices];
            return baseCandidates.some(targetBaseIndex => {
                const result = validate(probeState, {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId,
                    payload: {
                        cardUid: card.uid,
                        ...(targetBaseIndex !== undefined ? { targetBaseIndex } : {}),
                    },
                });
                return result.valid;
            });
        });

        if (hasPlayableResponse) {
            playablePlayers.push(playerId);
        }
    }

    return playablePlayers;
}

function buildBaseRankings(
    baseDef: { vpAwards: number[] },
    playerPowers: Map<PlayerId, number>,
): { playerId: PlayerId; power: number; vp: number }[] {
    const sorted = Array.from(playerPowers.entries())
        .sort((a, b) => b[1] - a[1]);
    const rankings: { playerId: PlayerId; power: number; vp: number }[] = [];
    let rankSlot = 0;

    for (let i = 0; i < sorted.length; i++) {
        const [playerId, power] = sorted[i];
        if (i > 0 && power < sorted[i - 1][1]) {
            rankSlot = i;
        }
        rankings.push({
            playerId,
            power,
            vp: rankSlot < 3 ? baseDef.vpAwards[rankSlot] : 0,
        });
    }

    return rankings;
}

function getLockedScoringBaseIndices(core: SmashUpCore): number[] {
    return core.scoringEligibleBaseIndices ?? getScoringEligibleBaseIndices(core);
}

function ensureScoreBasesSession(state: MatchState<SmashUpCore>): MatchState<SmashUpCore> {
    if (getScoringSession(state)) {
        return state;
    }
    const lockedIndices = getLockedScoringBaseIndices(state.core);
    if (lockedIndices.length === 0) {
        return state;
    }
    return setScoringSession(state, createScoringSession(state.core, lockedIndices));
}

function buildMultiBaseScoringInteraction(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    baseRefs: SmashUpScoringBaseRef[],
) {
    const candidates = baseRefs
        .map((ref) => {
            const baseIndex = resolveScoringBaseRefSlotIndex(state, ref);
            if (baseIndex === undefined) return null;
            const base = state.core.bases[baseIndex];
            if (!base) return null;
            const baseDef = getBaseDef(base.defId);
            const totalPower = getTotalEffectivePowerOnBase(state.core, base, baseIndex);
            return {
                baseIndex,
                label: `${baseDef?.name ?? `基地 ${baseIndex + 1}`} (力量 ${totalPower}/${baseDef?.breakpoint ?? '?'})`,
            };
        })
        .filter(Boolean) as Array<{ baseIndex: number; label: string }>;

    if (candidates.length === 0) {
        return undefined;
    }

    return createSimpleChoice(
        `multi_base_scoring_${now}`,
        playerId,
        candidates.length === 1 ? '计分最后一个基地' : '选择先计分的基地',
        buildBaseTargetOptions(candidates, state.core) as any[],
        { sourceId: 'multi_base_scoring', targetType: 'base' },
    );
}

function buildRescoredBaseEvent(
    state: MatchState<SmashUpCore>,
    baseIndex: number,
    now: number,
): BaseScoredEvent | undefined {
    const currentBase = state.core.bases[baseIndex];
    if (!currentBase) {
        return undefined;
    }
    const playerPowers = collectQualifiedPlayerPowers(state.core, currentBase, baseIndex);
    const baseDef = getBaseDef(currentBase.defId);
    if (!baseDef) {
        return undefined;
    }
    const rankings = buildBaseRankings(baseDef, playerPowers);
    const minionBreakdowns: Record<PlayerId, MinionPowerBreakdown[]> = {};

    for (const minion of currentBase.minions) {
        const breakdown = getEffectivePowerBreakdown(state.core, minion, baseIndex);
        if (!minionBreakdowns[minion.controller]) {
            minionBreakdowns[minion.controller] = [];
        }
        minionBreakdowns[minion.controller].push({
            defId: minion.defId,
            basePower: breakdown.basePower,
            finalPower: breakdown.finalPower,
            modifiers: [
                ...(breakdown.permanentModifier !== 0
                    ? [{ sourceDefId: minion.defId, sourceName: 'actionLog.powerModifier.permanent', value: breakdown.permanentModifier }]
                    : []),
                ...(breakdown.tempModifier !== 0
                    ? [{ sourceDefId: minion.defId, sourceName: 'actionLog.powerModifier.temp', value: breakdown.tempModifier }]
                    : []),
                ...breakdown.ongoingDetails.map(detail => ({
                    sourceDefId: detail.sourceDefId,
                    sourceName: detail.sourceName,
                    value: detail.value,
                })),
            ],
        });
    }

    return {
        type: SU_EVENTS.BASE_SCORED,
        payload: {
            baseIndex,
            baseDefId: currentBase.defId,
            rankings,
            minionBreakdowns,
        },
        timestamp: now,
    };
}

function finalizeCurrentScoringBase(
    state: MatchState<SmashUpCore>,
    now: number,
): { updatedState: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const session = getScoringSession(state);
    const currentBaseRef = session?.currentBaseRef;
    if (!session || !currentBaseRef) {
        return { updatedState: state, events: [] };
    }

    const events: SmashUpEvent[] = [];
    const baseIndex = resolveScoringBaseRefSlotIndex(state, currentBaseRef);
    const initialPowers = session.afterScoringInitialPowers;
    if (baseIndex !== undefined && initialPowers && initialPowers.baseRef.baseDefId === currentBaseRef.baseDefId) {
        const currentBase = state.core.bases[baseIndex];
        const currentPowers = currentBase
            ? collectQualifiedPlayerPowers(state.core, currentBase, baseIndex)
            : new Map<PlayerId, number>();
        const comparedPlayerIds = new Set<PlayerId>([
            ...(Object.keys(initialPowers.powers) as PlayerId[]),
            ...currentPowers.keys(),
        ]);
        let powerChanged = false;
        for (const playerId of comparedPlayerIds) {
            const hadInitialEntry = Object.prototype.hasOwnProperty.call(initialPowers.powers, playerId);
            const hasCurrentEntry = currentPowers.has(playerId);
            if (hadInitialEntry !== hasCurrentEntry) {
                powerChanged = true;
                break;
            }
            if ((initialPowers.powers[playerId] ?? 0) !== (currentPowers.get(playerId) ?? 0)) {
                powerChanged = true;
                break;
            }
        }
        if (powerChanged) {
            const rescoredEvent = buildRescoredBaseEvent(state, baseIndex, now);
            if (rescoredEvent) {
                events.push(rescoredEvent);
            }
        }
    }

    if (session.deferredPostScoringEvents?.length) {
        events.push(...session.deferredPostScoringEvents.map((event) => ({
            type: event.type,
            payload: event.payload,
            timestamp: event.timestamp,
        })) as SmashUpEvent[]);
    }

    events.push(
        ...buildPendingPostScoringActionEvents(
            { core: state.core },
            session.pendingPostScoringActions,
            now,
        ),
    );

    const completedState = updateScoringSession(
        markScoringBaseCompleted(state, currentBaseRef),
        (currentSession) => currentSession
            ? {
                ...currentSession,
                currentStep: 'awaiting-post-reduce',
            }
            : currentSession,
    );

    return {
        updatedState: completedState,
        events,
    };
}

/**
 * 瀵规寚瀹氬熀鍦版墽琛岃鍒嗛€昏緫锛岃繑鍥炴墍鏈夌浉鍏充簨浠?
 * 
 * 鍖呭惈锛歜eforeScoring 鍩哄湴鑳藉姏 鈫?鎺掑悕璁＄畻 鈫?BASE_SCORED 鈫?afterScoring 鍩哄湴鑳藉姏 鈫?BASE_REPLACED
 */
export function scoreOneBase(
    core: SmashUpCore,
    baseIndex: number,
    baseDeck: string[],
    pid: PlayerId,
    now: number,
    random?: RandomFn,
    matchState?: MatchState<SmashUpCore>,
): { events: SmashUpEvent[]; newBaseDeck: string[]; matchState?: MatchState<SmashUpCore> } {
    // 榛樿 random锛堢‘瀹氭€у洖閫€锛岃鍒嗕腑澶у鏁?trigger 涓嶉渶瑕侀殢鏈猴級
    const rng: RandomFn = random ?? {
        random: () => 0.5,
        d: () => 1,
        range: (min: number) => min,
        shuffle: <T>(arr: T[]) => [...arr],
    };
    const events: SmashUpEvent[] = [];
    let ms = matchState;
    const base = core.bases[baseIndex];
    const baseDef = getBaseDef(base.defId)!;
    const currentBaseRef = createScoringBaseRef(core, baseIndex);

    if (ms && currentBaseRef) {
        ms = updateScoringSession(ms, (session) => session
            ? {
                ...session,
                currentBaseRef,
                currentStep: 'resolving-base',
            }
            : session,
        );
    }
    
    // 銆愪慨澶嶃€憂ewBaseDeck 蹇呴』鍦ㄥ嚱鏁伴《閮ㄥ０鏄庯紝閬垮厤 TDZ 閿欒
    // 闂锛氫箣鍓嶅湪涓や釜涓嶅悓鐨勪綔鐢ㄥ煙涓０鏄庝簡 newBaseDeck锛坙ine 454 鍜?line 476锛?
    // 褰撳嚱鏁板湪 afterScoring 绐楀彛鎵撳紑鍚庢彁鍓嶈繑鍥烇紝鍐嶆璋冪敤鏃朵細璁块棶鏈垵濮嬪寲鐨勫灞?newBaseDeck
    let newBaseDeck = baseDeck;
    // 瑙﹀彂 ongoing beforeScoring锛堝 pirate_king 绉诲姩鍒拌鍩哄湴銆乧thulhu_chosen +2鍔涢噺锛?
    // 鍏堜簬鍩哄湴鑳藉姏鎵ц锛岀‘淇濆熀鍦拌兘鍔涜兘鐪嬪埌 ongoing 鏁堟灉鐨勭粨鏋?
    
    // 妫€鏌ユ槸鍚﹀凡缁忚Е鍙戣繃 beforeScoring锛堥槻姝氦浜掕В鍐冲悗閲嶅瑙﹀彂锛?
    const alreadyTriggeredBeforeScoring = core.beforeScoringTriggeredBases?.includes(baseIndex) ?? false;
    
    
    if (!alreadyTriggeredBeforeScoring) {
        const queuedBefore = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: ms,
            playerId: pid,
            baseIndex,
            random: rng,
            now,
        });
        if (queuedBefore) {
            events.push(queuedBefore);
            core = reduce(core, queuedBefore as unknown as SmashUpEvent);
        }

        // Try to resolve reaction queue now so scoreOneBase can halt on interactions.
        const rq0 = maybeResolveReactionQueue(ms ? { ...ms, core } : ({ core, sys: { interaction: { current: undefined, queue: [] } } } as any), rng, now);
        if (rq0) {
            events.push(...rq0.events);
            ms = rq0.state;
            core = rq0.state.core;
        }
        
        // 鍙戝皠浜嬩欢鏍囪姝ゅ熀鍦板凡瑙﹀彂杩?beforeScoring
        const markEvent = {
            type: SU_EVENT_TYPES.BEFORE_SCORING_TRIGGERED,
            payload: { baseIndex },
            timestamp: now,
        };
        events.push(markEvent as unknown as SmashUpEvent);
        
        // 鉁?鍏抽敭淇锛氱珛鍗冲皢鏍囪浜嬩欢 reduce 鍒版湰鍦?core 鍓湰
        // 
        // 闂锛氫簨浠堕┍鍔ㄦ灦鏋勪腑锛屼簨浠剁殑鍙戝皠锛坋mit锛夊拰褰掔害锛坮educe锛夋槸鍒嗙鐨勶細
        // 1. scoreOneBase 鍙戝皠浜嬩欢鍚庣珛鍗宠繑鍥?
        // 2. 杩欎簺浜嬩欢瑕佺瓑鍒版暣涓?onPhaseExit 杩斿洖鍚庯紝鎵嶄細琚?pipeline 閫愪釜 reduce
        // 3. 浣?FlowSystem 鍦ㄤ氦浜掕В鍐冲悗浼氶噸鏂拌繘鍏?onPhaseExit锛屾鏃朵娇鐢ㄧ殑 core 杩樻病鏈夊寘鍚涓€娆″彂灏勭殑鏍囪浜嬩欢
        // 
        // 瑙ｅ喅鏂规锛氬彂灏勬爣璁颁簨浠跺悗绔嬪嵆 reduce 鍒版湰鍦?core 鍓湰锛岀‘淇濆悗缁皟鐢?scoreOneBase 鏃惰兘鐪嬪埌"宸茶Е鍙?鏍囪
        // 
        // 绀轰緥鍦烘櫙锛堟捣鐩楃帇绉诲姩 bug锛夛細
        // - 绗竴娆¤皟鐢細妫€鏌?beforeScoringTriggeredBases 鈫?undefined 鈫?瑙﹀彂 beforeScoring 鈫?鍒涘缓娴风洍鐜嬩氦浜?鈫?halt
        // - 鐢ㄦ埛鐐瑰嚮"绉诲姩鍒拌鍩哄湴" 鈫?浜や簰瑙ｅ喅
        // - 绗簩娆¤皟鐢細濡傛灉娌℃湁绔嬪嵆 reduce锛宐eforeScoringTriggeredBases 浠嶆槸 undefined 鈫?鍙堝垱寤虹浉鍚?ID 鐨勪氦浜?鈫?UI 鍗′綇
        core = reduce(core, markEvent as unknown as SmashUpEvent);

        // beforeScoring 鍙兘鍒涘缓浜嗕氦浜掞紙濡傛捣鐩楃帇绉诲姩纭锛?
        // 蹇呴』鍏?halt 绛変氦浜掕В鍐炽€佷簨浠?reduce 鍒?core 鍚庯紝鍐嶇户缁?
        if (ms?.sys?.interaction?.current) {
            return { events, newBaseDeck: baseDeck, matchState: ms };
        }
    }

    // 灏?ongoing beforeScoring 浜х敓鐨勪簨浠讹紙濡?TEMP_POWER_ADDED銆丮INION_MOVED锛塺educe 鍒?core锛?
    // 纭繚鍚庣画鍩哄湴鑳藉姏鍜屾帓鍚嶈绠椾娇鐢ㄦ渶鏂扮姸鎬?
    let updatedCore = core;
    for (const evt of events) {
        updatedCore = reduce(updatedCore, evt as SmashUpEvent);
    }

    // 瑙﹀彂 beforeScoring 鍩哄湴鑳藉姏锛堝叆闃燂紝鎸?Wiki 鍚屾椂瑙﹀彂鎺掑簭瑙ｅ喅锛?
    const queuedBeforeBase = collectBaseAbilityTriggers({
        core: updatedCore,
        timing: 'beforeScoring',
        ownerPlayerId: pid,
        baseIndex,
        now,
    });
    if (queuedBeforeBase) {
        events.push(queuedBeforeBase as unknown as SmashUpEvent);
        updatedCore = reduce(updatedCore, queuedBeforeBase as unknown as SmashUpEvent);
        if (ms) ms = { ...ms, core: updatedCore };
        const rq = maybeResolveReactionQueue(ms ? ms : ({ core: updatedCore, sys: { interaction: { current: undefined, queue: [] } } } as any), rng, now);
        if (rq) {
            events.push(...rq.events);
            ms = rq.state;
            updatedCore = rq.state.core;
        }
        if (ms?.sys?.interaction?.current) {
            return { events, newBaseDeck: baseDeck, matchState: ms };
        }
    }

    // 璁＄畻鎺掑悕锛堜娇鐢?reduce 鍚庣殑 core锛屽寘鍚?beforeScoring 鐨勪复鏃跺姏閲忎慨姝?+ ongoing 鍗″姏閲忚础鐚級
    const updatedBase = updatedCore.bases[baseIndex];
    const playerPowers = collectQualifiedPlayerPowers(updatedCore, updatedBase, baseIndex);
    const rankings = buildBaseRankings(baseDef, playerPowers);

    // 鏀堕泦姣忎綅鐜╁鐨勯殢浠庡姏閲?breakdown锛堢敤浜?ActionLog 灞曠ず锛?
    const minionBreakdowns: Record<PlayerId, MinionPowerBreakdown[]> = {};
    for (const m of updatedBase.minions) {
        const bd = getEffectivePowerBreakdown(updatedCore, m, baseIndex);
        if (!minionBreakdowns[m.controller]) minionBreakdowns[m.controller] = [];
        minionBreakdowns[m.controller].push({
            defId: m.defId,
            basePower: bd.basePower,
            finalPower: bd.finalPower,
            modifiers: [
                ...(bd.permanentModifier !== 0 ? [{ sourceDefId: m.defId, sourceName: 'actionLog.powerModifier.permanent', value: bd.permanentModifier }] : []),
                ...(bd.tempModifier !== 0 ? [{ sourceDefId: m.defId, sourceName: 'actionLog.powerModifier.temp', value: bd.tempModifier }] : []),
                ...bd.ongoingDetails.map(d => ({ sourceDefId: d.sourceDefId, sourceName: d.sourceName, value: d.value })),
            ],
        });
    }

    const scoreEvt: BaseScoredEvent = {
        type: SU_EVENTS.BASE_SCORED,
        payload: { baseIndex, baseDefId: base.defId, rankings, minionBreakdowns },
        timestamp: now,
    };
    events.push(scoreEvt);

    // 瑙﹀彂 onMinionDiscardedFromBase锛堝熀鍦扮粨绠楀純缃紝闈炴秷鐏級
    // 鍦?BASE_SCORED 鍚庛€乤fterScoring 鍓嶈Е鍙戯紝姝ゆ椂闅忎粠浠嶅湪 core 涓紙reducer 灏氭湭鎵ц锛?
    for (const m of base.minions) {
        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: ms,
            playerId: m.controller,
            baseIndex,
            triggerMinionUid: m.uid,
            triggerMinionDefId: m.defId,
            triggerMinionPower: getEffectivePower(core, m, baseIndex),
            triggerMinion: m,
            random: rng,
            now,
        });
        if (queued) {
            events.push(queued);
            updatedCore = reduce(updatedCore, queued as unknown as SmashUpEvent);
            if (ms) ms = { ...ms, core: updatedCore };
            const rq = maybeResolveReactionQueue(ms ? ms : ({ core: updatedCore, sys: { interaction: { current: undefined, queue: [] } } } as any), rng, now);
            if (rq) {
                events.push(...rq.events);
                ms = rq.state;
                updatedCore = rq.state.core;
            }
        }
    }

    // 璁板綍 afterScoring 鍓嶇殑浜や簰鐘舵€侊紝鐢ㄤ簬鍒ゆ柇 afterScoring 鏄惁鏂板浜嗕氦浜?
    const interactionBeforeAfterScoring = ms?.sys?.interaction?.current?.id ?? null;
    const queueLenBeforeAfterScoring = ms?.sys?.interaction?.queue?.length ?? 0;

    // 妫€鏌ユ槸鍚﹀凡缁忚Е鍙戣繃 afterScoring锛堥槻姝氦浜掕В鍐冲悗閲嶅瑙﹀彂锛?
    const alreadyTriggeredAfterScoring = updatedCore.afterScoringTriggeredBases?.includes(baseIndex) ?? false;

    let afterResult: BaseAbilityResult = { events: [] };
    if (!alreadyTriggeredAfterScoring) {
        // 统一 afterScoring special 已迁到 trigger 模型；这里只对漏注册条目做反馈并清理。
        const armedSpecials = (updatedCore.pendingAfterScoringSpecials ?? []).filter(
            s => s.baseIndex === baseIndex
        );
        
        for (const armed of armedSpecials) {
            if (hasRegisteredTrigger(armed.sourceDefId, 'afterScoring')) {
                continue;
            }
            const feedbackEvt: AbilityFeedbackEvent = {
                type: SU_EVENT_TYPES.ABILITY_FEEDBACK,
                payload: {
                    playerId: armed.playerId,
                    sourceDefId: armed.sourceDefId,
                    message: 'actionLog.ability_not_implemented',
                },
                timestamp: now,
            };
            events.push(feedbackEvt);
            
            // 鏍囪涓哄凡娑堣垂
            const consumedEvt: SpecialAfterScoringConsumedEvent = {
                type: SU_EVENT_TYPES.SPECIAL_AFTER_SCORING_CONSUMED,
                payload: {
                    sourceDefId: armed.sourceDefId,
                    playerId: armed.playerId,
                    baseIndex,
                    cardUid: armed.cardUid,
                },
                timestamp: now,
            };
            events.push(consumedEvt);
            updatedCore = reduce(updatedCore, consumedEvt);
        }
        
        // Queue afterScoring base ability + ongoing afterScoring triggers into the same reaction window,
        // so moving/destroying one trigger's source doesn't prevent the others from being queued.
        const queuedAfterBase = collectBaseAbilityTriggers({
            core: updatedCore,
            timing: 'afterScoring',
            ownerPlayerId: pid,
            baseIndex,
            rankings,
            now,
        });
        if (queuedAfterBase) {
            events.push(queuedAfterBase as unknown as SmashUpEvent);
            updatedCore = reduce(updatedCore, queuedAfterBase as unknown as SmashUpEvent);
            if (ms) ms = { ...ms, core: updatedCore };
        }

        const queuedAfterOngoing = collectTriggers(updatedCore, 'afterScoring', {
            state: updatedCore,
            playerId: pid,
            baseIndex,
            rankings,
            matchState: ms,
            random: rng,
            now,
        });
        if (queuedAfterOngoing) {
            events.push(queuedAfterOngoing);
            updatedCore = reduce(updatedCore, queuedAfterOngoing as unknown as SmashUpEvent);
            if (ms) ms = { ...ms, core: updatedCore };
        }

        // Mark afterScoring as triggered immediately (even if it creates an interaction),
        // so re-entering scoreOneBase after resolving an interaction won't re-queue it.
        const markEvent = {
            type: SU_EVENT_TYPES.AFTER_SCORING_TRIGGERED,
            payload: { baseIndex },
            timestamp: now,
        };
        events.push(markEvent as unknown as SmashUpEvent);
        updatedCore = reduce(updatedCore, markEvent as unknown as SmashUpEvent);
        if (ms) ms = { ...ms, core: updatedCore };

        const rq = maybeResolveReactionQueue(ms ? ms : ({ core: updatedCore, sys: { interaction: { current: undefined, queue: [] } } } as any), rng, now);
        if (rq) {
            events.push(...rq.events);
            ms = rq.state;
            updatedCore = rq.state.core;
        }
        // NOTE: If an interaction was created here (e.g. reaction_queue_choose_next),
        // we must still continue so scoreOneBase can defer BASE_CLEARED/BASE_REPLACED into continuationContext.
    }
    const afterScoringCore = updatedCore;

    // 鍒ゆ柇 afterScoring 鏄惁鏂板浜嗕氦浜?
    const interactionAfter = ms?.sys?.interaction?.current?.id ?? null;
    const queueLenAfter = ms?.sys?.interaction?.queue?.length ?? 0;
    const afterScoringCreatedInteraction =
        (interactionAfter !== null && interactionAfter !== interactionBeforeAfterScoring) ||
        (queueLenAfter > queueLenBeforeAfterScoring);

    // 銆愭柊澧炪€戞鏌ユ槸鍚﹂渶瑕佹墦寮€ afterScoring 鍝嶅簲绐楀彛
    // 娉ㄦ剰锛歛fterScoring 鍝嶅簲绐楀彛鍦?BASE_SCORED 涔嬪悗銆丅ASE_CLEARED 涔嬪墠鎵撳紑
    // 杩欐牱鐜╁鎵撳嚭鐨?afterScoring 鍗＄墝鍙互褰卞搷璇ュ熀鍦扮殑鍔涢噺锛屽苟鍙兘瀵艰嚧閲嶆柊璁″垎
    // 
    // 鈿狅笍 銆愬叧閿慨澶嶃€戞棤璁哄熀鍦拌兘鍔涙槸鍚﹀垱寤轰簡浜や簰锛岄兘瑕佹鏌ユ槸鍚︽湁 afterScoring 鍗＄墝
    // 鍘熷洜锛氬熀鍦拌兘鍔涘垱寤轰氦浜掞紙濡傛捣鐩楁咕绉诲姩闅忎粠锛夊拰鍝嶅簲绐楀彛锛堣鐜╁鎵撳嚭 afterScoring 鍗＄墝锛?
    // 鏄袱涓嫭绔嬬殑鏈哄埗锛屽簲璇ュ悓鏃跺瓨鍦?
    // 妫€鏌ユ槸鍚︽湁鐜╁鎵嬬墝涓湁 afterScoring 鍗＄墝
    const playersWithAfterScoringCards = ms
        ? getPlayersWithPlayableAfterScoringResponses({ ...ms, core: afterScoringCore }, now)
        : [];

    // 构建清场 + 换基地 + onBaseRevealed 触发队列（延迟到当前基地彻底结算后再补发）
    const postScoringEvents: SmashUpEvent[] = [];
    const clearEvt: BaseClearedEvent = {
        type: SU_EVENTS.BASE_CLEARED,
        payload: { baseIndex, baseDefId: base.defId },
        timestamp: now,
    };
    postScoringEvents.push(clearEvt);

    if (newBaseDeck.length === 0) {
        const pool = [...(core.baseDiscard ?? []), base.defId];
        const rebuiltDeck = (random?.shuffle ? random.shuffle(pool) : [...pool]);
        const shuffleEvt: BaseDeckShuffledEvent = {
            type: SU_EVENTS.BASE_DECK_SHUFFLED,
            payload: {
                newBaseDeckDefIds: rebuiltDeck,
                reason: 'base_deck_empty_reshuffle_discard',
                clearBaseDiscard: true,
            },
            timestamp: now,
        };
        postScoringEvents.push(shuffleEvt);
        newBaseDeck = rebuiltDeck;
    }

    if (newBaseDeck.length > 0) {
        const newBaseDefId = newBaseDeck[0];
        const replaceEvt: BaseReplacedEvent = {
            type: SU_EVENTS.BASE_REPLACED,
            payload: {
                baseIndex,
                oldBaseDefId: base.defId,
                newBaseDefId,
            },
            timestamp: now,
        };
        postScoringEvents.push(replaceEvt);
        newBaseDeck = newBaseDeck.slice(1);

        const queuedReveal = collectExtendedBaseAbilityTriggers({
            core,
            timing: 'onBaseRevealed',
            ownerPlayerId: pid,
            baseIndex,
            now,
        });
        if (queuedReveal) {
            postScoringEvents.push(queuedReveal as unknown as SmashUpEvent);
        }
    }

    if (playersWithAfterScoringCards.length > 0) {
        const currentBase = afterScoringCore.bases[baseIndex];
        const initialPowers = collectQualifiedPlayerPowers(afterScoringCore, currentBase, baseIndex);
        const serializedDeferredEvents = serializePostScoringEvents(postScoringEvents);

        if (ms && currentBaseRef) {
            ms = updateScoringSession(ms, (session) => session
                ? {
                    ...session,
                    currentBaseRef,
                    currentStep: 'awaiting-response-window',
                    deferredPostScoringEvents: serializedDeferredEvents,
                    afterScoringInitialPowers: {
                        baseRef: currentBaseRef,
                        powers: Object.fromEntries(initialPowers.entries()),
                    },
                }
                : session,
            );
            const firstInteraction = ms.sys.interaction?.current ?? ms.sys.interaction?.queue?.[0];
            if (firstInteraction?.data) {
                const data = firstInteraction.data as Record<string, unknown>;
                const continuationContext = (data.continuationContext ?? {}) as Record<string, unknown>;
                continuationContext._deferredPostScoringEvents = serializedDeferredEvents;
                data.continuationContext = continuationContext;
            }
        }

        const afterScoringWindowEvt = openAfterScoringWindow('scoreBases', pid, afterScoringCore.turnOrder, now);
        events.push(afterScoringWindowEvt);
        return { events, newBaseDeck, matchState: ms };
    }

    if (afterScoringCreatedInteraction) {
        const serializedDeferredEvents = serializePostScoringEvents(postScoringEvents);
        if (ms && currentBaseRef) {
            ms = updateScoringSession(ms, (session) => session
                ? {
                    ...session,
                    currentBaseRef,
                    currentStep: 'awaiting-interactions',
                    deferredPostScoringEvents: serializedDeferredEvents,
                }
                : session,
            );
            const firstInteraction = ms.sys.interaction?.current ?? ms.sys.interaction?.queue?.[0];
            if (firstInteraction?.data) {
                const data = firstInteraction.data as Record<string, unknown>;
                const continuationContext = (data.continuationContext ?? {}) as Record<string, unknown>;
                continuationContext._deferredPostScoringEvents = serializedDeferredEvents;
                data.continuationContext = continuationContext;
            }
        }
        return { events, newBaseDeck, matchState: ms };
    }

    events.push(...postScoringEvents);
    return { events, newBaseDeck, matchState: ms };
}

/** 娉ㄥ唽澶氬熀鍦拌鍒嗙殑浜や簰瑙ｅ喅澶勭悊鍑芥暟 */
export function registerMultiBaseScoringInteractionHandler(): void {
    registerInteractionHandler('multi_base_scoring', (state, _playerId, value) => {
        const { baseIndex } = value as { baseIndex?: number };
        if (baseIndex === undefined) {
            return { state, events: [] };
        }

        const baseRef = createScoringBaseRef(state.core, baseIndex);
        if (!baseRef) {
            return { state, events: [] };
        }

        const nextState = ensureScoreBasesSession(state);
        return {
            state: updateScoringSession(nextState, (session) => session
                ? {
                    ...session,
                    currentBaseRef: baseRef,
                    currentStep: 'resolving-base',
                }
                : session,
            ),
            events: [],
        };
    });
}

function applyEventsForStartTurnSimulation(
    core: SmashUpCore,
    events: SmashUpEvent[],
): SmashUpCore {
    let nextCore = core;
    for (const event of events) {
        const intercepted = domainInterceptEvent(nextCore, event);
        if (intercepted === null) continue;

        const appliedEvents = Array.isArray(intercepted) ? intercepted : [intercepted];
        for (const appliedEvent of appliedEvents) {
            nextCore = reduce(nextCore, appliedEvent);
        }
    }
    return nextCore;
}

function findMinionOnBaseByUid(
    core: SmashUpCore,
    minionUid: string,
): { baseIndex: number; minion: MinionOnBase } | undefined {
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        const minion = core.bases[baseIndex].minions.find(entry => entry.uid === minionUid);
        if (minion) {
            return { baseIndex, minion };
        }
    }
    return undefined;
}

function processImmediateStartTurnMinionTriggers(
    startTurnCore: SmashUpCore,
    events: SmashUpEvent[],
    currentPlayerId: PlayerId,
    random: RandomFn,
    matchState?: MatchState<SmashUpCore>,
    processedPlayedUids: Set<string> = new Set(),
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const finalEvents: SmashUpEvent[] = [];
    let simulatedCore = startTurnCore;
    let currentMatchState = matchState ? { ...matchState, core: startTurnCore } : undefined;

    for (const event of events) {
        finalEvents.push(event);
        simulatedCore = applyEventsForStartTurnSimulation(simulatedCore, [event]);
        if (currentMatchState) {
            currentMatchState = { ...currentMatchState, core: simulatedCore };
        }

        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const returnedEvent = event as SmashUpEvent & { payload: { minionUid: string } };
            processedPlayedUids.delete(returnedEvent.payload.minionUid);
            continue;
        }

        if (event.type === SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND) {
            const returnedEvent = event as SmashUpEvent & { payload: { cardUid: string } };
            processedPlayedUids.delete(returnedEvent.payload.cardUid);
            continue;
        }

        if (event.type !== SU_EVENTS.MINION_PLAYED) continue;

        const playedEvent = event as MinionPlayedEvent;
        if (playedEvent.payload.playerId !== currentPlayerId) continue;
        if (processedPlayedUids.has(playedEvent.payload.cardUid)) continue;
        processedPlayedUids.add(playedEvent.payload.cardUid);

        const playedMinion = findMinionOnBaseByUid(simulatedCore, playedEvent.payload.cardUid);
        if (!playedMinion || playedMinion.minion.controller !== currentPlayerId) continue;

        const immediateResult = fireTriggerForSource(
            simulatedCore,
            playedEvent.payload.defId,
            'onTurnStart',
            {
                state: simulatedCore,
                matchState: currentMatchState,
                playerId: currentPlayerId,
                baseIndex: playedMinion.baseIndex,
                triggerMinion: playedMinion.minion,
                triggerMinionUid: playedMinion.minion.uid,
                triggerMinionDefId: playedMinion.minion.defId,
                random,
                now: event.timestamp,
            },
        );

        if (immediateResult.matchState) {
            currentMatchState = { ...immediateResult.matchState, core: simulatedCore };
        }
        if (immediateResult.events.length === 0) continue;

        const processedImmediate = postProcessSystemEvents(
            simulatedCore,
            immediateResult.events,
            random,
            currentMatchState,
            { skipImmediateStartTurnMinionTriggers: true },
        );
        const processedImmediateMatchState = processedImmediate.matchState
            ? { ...processedImmediate.matchState, core: simulatedCore }
            : currentMatchState;

        const recursiveResult = processImmediateStartTurnMinionTriggers(
            simulatedCore,
            processedImmediate.events,
            currentPlayerId,
            random,
            processedImmediateMatchState,
            processedPlayedUids,
        );

        finalEvents.push(...recursiveResult.events);
        simulatedCore = applyEventsForStartTurnSimulation(simulatedCore, recursiveResult.events);
        if (recursiveResult.matchState) {
            currentMatchState = { ...recursiveResult.matchState, core: simulatedCore };
        } else if (currentMatchState) {
            currentMatchState = { ...currentMatchState, core: simulatedCore };
        }
    }

    return currentMatchState
        ? { events: finalEvents, matchState: currentMatchState }
        : { events: finalEvents };
}

// ============================================================================
// Setup
// ============================================================================

const DEFAULT_SMASHUP_EXPANSIONS = ['titans'];

function readEnabledExpansions(setupData?: Record<string, unknown>): string[] {
    if (Array.isArray(setupData?.expansions)) {
        return setupData.expansions.filter((value): value is string => typeof value === 'string');
    }

    const setupSelections = setupData?.setupSelections;
    if (
        setupSelections
        && typeof setupSelections === 'object'
        && !Array.isArray(setupSelections)
        && Array.isArray((setupSelections as Record<string, unknown>).expansions)
    ) {
        return ((setupSelections as Record<string, unknown>).expansions as unknown[])
            .filter((value): value is string => typeof value === 'string');
    }

    return [...DEFAULT_SMASHUP_EXPANSIONS];
}

function setup(playerIds: PlayerId[], random: RandomFn, setupData?: Record<string, unknown>): SmashUpCore {
    const nextUid = 1;
    const enabledExpansions = readEnabledExpansions(setupData);

    const players: Record<PlayerId, PlayerState> = {};
    const playerSelections: Record<PlayerId, string[]> = {};
    for (const pid of playerIds) {
        players[pid] = {
            id: pid,
            vp: 0,
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            factions: ['', ''],
        };
        playerSelections[pid] = [];
    }

    let shuffledBaseIds = random.shuffle(getAllBaseDefIds());
    const baseCount = playerIds.length + 1;
    const activeBases: BaseInPlay[] = [];

    while (activeBases.length < baseCount && shuffledBaseIds.length > 0) {
        const defId = shuffledBaseIds.shift()!;
        const def = getBaseDef(defId);
        if (def?.replaceOnSetup) {
            shuffledBaseIds.push(defId);
            shuffledBaseIds = random.shuffle(shuffledBaseIds);
            continue;
        }
        activeBases.push({ defId, minions: [], ongoingActions: [] });
    }
    const baseDeck = shuffledBaseIds;

    let initialTurnOrder = [...playerIds];
    if (
        Array.isArray(setupData?.turnOrder)
        && setupData.turnOrder.length === playerIds.length
        && setupData.turnOrder.every((id: unknown) => typeof id === 'string' && playerIds.includes(id as PlayerId))
    ) {
        initialTurnOrder = setupData.turnOrder as PlayerId[];
    } else if (typeof setupData?.firstPlayerId === 'string' && playerIds.includes(setupData.firstPlayerId)) {
        const first = setupData.firstPlayerId;
        initialTurnOrder = [first, ...playerIds.filter(id => id !== first)];
    }

    return {
        players,
        turnOrder: initialTurnOrder,
        currentPlayerIndex: 0,
        bases: activeBases,
        titans: [],
        enabledExpansions,
        baseDeck,
        baseDiscard: [],
        triggerQueue: undefined,
        turnNumber: 1,
        nextUid,
        gameResult: undefined,
        factionSelection: {
            takenFactions: [],
            playerSelections,
            completedPlayers: [],
        },
        cardsPlayedThisTurn: 0,
        powerCountersPlacedOnMinionsThisTurn: 0,
    };
}

export const smashUpFlowHooks: FlowHooks<SmashUpCore> = {
    initialPhase: 'factionSelect',

    getNextPhase({ from }): string {
        const idx = PHASE_ORDER.indexOf(from as GamePhase);
        if (idx === -1 || idx >= PHASE_ORDER.length - 1) {
            // endTurn 鍚庡洖鍒?startTurn锛堣烦杩?factionSelect锛屽畠鍙湪娓告垙寮€濮嬫椂浣跨敤涓€娆★級
            return 'startTurn';
        }
        return PHASE_ORDER[idx + 1];
    },

    getActivePlayerId({ state }): PlayerId {
        return getCurrentPlayerId(state.core);
    },

    onPhaseExit({ state, from, command, random }): GameEvent[] | PhaseExitResult {
        const core = state.core;
        const pid = getCurrentPlayerId(core);
        const now = typeof command.timestamp === 'number' ? command.timestamp : 0;

        if (from === 'endTurn') {
            const events: SmashUpEvent[] = [];

            // 瑙﹀彂 ongoing 鏁堟灉 onTurnEnd锛堟敼涓哄叆闃燂紝鎸?Wiki 鍚屾椂瑙﹀彂鎺掑簭瑙ｅ喅锛?
            const queuedTurnEnd = collectTriggers(core, 'onTurnEnd', {
                state: core,
                matchState: state,
                playerId: pid,
                random,
                now,
            });
            if (queuedTurnEnd) {
                events.push(queuedTurnEnd);
                // Reduce queued event into a temporary core view so the resolver can see the pending queue immediately.
                const coreForQueue = reduce(core, queuedTurnEnd as unknown as SmashUpEvent);
                const msForQueue = { ...state, core: coreForQueue };
                const rq = maybeResolveReactionQueue(msForQueue, random, now);
                if (rq) {
                    // 鍏抽敭锛歰nTurnEnd 瑙﹀彂鍣ㄥ彲鑳戒骇鐢?MINION_DESTROYED 绛夛紝闇€瑕佺粡杩?destroy鈫抦ove 寰幆鍚庡鐞?
                    const afterDestroyMove = processDestroyMoveCycle(rq.events, rq.state, pid, random, now);
                    events.push(...afterDestroyMove.events);
                }
            }

            // 鍒囨崲鍒颁笅涓€涓帺瀹?
            const nextIndex = (core.currentPlayerIndex + 1) % core.turnOrder.length;
            const evt: TurnEndedEvent = {
                type: SU_EVENTS.TURN_ENDED,
                payload: { playerId: pid, nextPlayerIndex: nextIndex },
                timestamp: now,
            };
            events.push(evt);
            return events;
        }

        if (from === 'scoreBases') {
            const events: SmashUpEvent[] = [];
            let currentState = ensureScoreBasesSession(state);

            if (currentState.sys.flowHalted) {
                if (currentState.sys.interaction.current) {
                    return { events: [], halt: true, updatedState: currentState } as PhaseExitResult;
                }
                currentState = {
                    ...currentState,
                    sys: {
                        ...currentState.sys,
                        flowHalted: false,
                    },
                };
            }

            const currentSession = getScoringSession(currentState);
            if (!currentSession) {
                return events;
            }

            if (currentState.sys.responseWindow?.current || currentState.sys.interaction?.current) {
                return { events: [], halt: true, updatedState: currentState } as PhaseExitResult;
            }

            if (currentSession.currentStep === 'awaiting-post-reduce') {
                return { events: [], halt: true, updatedState: currentState } as PhaseExitResult;
            }

            if (currentSession.currentBaseRef && (
                currentSession.currentStep === 'awaiting-interactions'
                || currentSession.currentStep === 'awaiting-response-window'
            )) {
                const finalized = finalizeCurrentScoringBase(currentState, now);
                return { events: finalized.events, updatedState: finalized.updatedState } as PhaseExitResult;
            }

            if (!currentSession.currentBaseRef) {
                const remainingBaseRefs = getRemainingScoringBaseRefs(currentState);

                if (remainingBaseRefs.length === 0) {
                    const cleanedState = clearScoringSession(currentState);
                    events.push({
                        type: SU_EVENT_TYPES.BEFORE_SCORING_CLEARED,
                        payload: {},
                        timestamp: now,
                    } as SmashUpEvent);
                    events.push({
                        type: SU_EVENT_TYPES.AFTER_SCORING_CLEARED,
                        payload: {},
                        timestamp: now,
                    } as SmashUpEvent);
                    return { events, updatedState: cleanedState } as PhaseExitResult;
                }

                if (remainingBaseRefs.length > 1) {
                    const currentIsMultiBaseScoring =
                        (currentState.sys.interaction.current?.data as { sourceId?: string } | undefined)?.sourceId === 'multi_base_scoring';
                    const hasMultiBaseScoringInQueue = currentState.sys.interaction.queue.some(
                        (interaction: { data?: { sourceId?: string } }) => interaction.data?.sourceId === 'multi_base_scoring',
                    );
                    if (!currentIsMultiBaseScoring && !hasMultiBaseScoringInQueue) {
                        const interaction = buildMultiBaseScoringInteraction(currentState, pid, now, remainingBaseRefs);
                        if (interaction) {
                            return {
                                events: [],
                                halt: true,
                                updatedState: queueInteraction(currentState, interaction),
                            } as PhaseExitResult;
                        }
                    }
                    return { events: [], halt: true, updatedState: currentState } as PhaseExitResult;
                }

                currentState = updateScoringSession(currentState, (session) => session
                    ? {
                        ...session,
                        currentBaseRef: remainingBaseRefs[0],
                        currentStep: 'resolving-base',
                    }
                    : session,
                );
            }

            const activeBaseRef = getScoringSession(currentState)?.currentBaseRef;
            const activeBaseIndex = resolveScoringBaseRefSlotIndex(currentState, activeBaseRef);
            if (!activeBaseRef || activeBaseIndex === undefined) {
                if (activeBaseRef) {
                    const missingBaseState = updateScoringSession(
                        markScoringBaseCompleted(currentState, activeBaseRef),
                        (session) => session ? { ...session, currentStep: 'awaiting-post-reduce' } : session,
                    );
                    return { events: [], updatedState: missingBaseState } as PhaseExitResult;
                }
                return events;
            }

            const result = scoreOneBase(
                currentState.core,
                activeBaseIndex,
                currentState.core.baseDeck,
                pid,
                now,
                random,
                currentState,
            );
            const nextState = result.matchState ?? currentState;
            const openedAfterScoringWindow = result.events.some((event) =>
                event.type === RESPONSE_WINDOW_EVENTS.OPENED
                && (event.payload as { windowType?: string } | undefined)?.windowType === 'afterScoring',
            );

            if (nextState.sys.interaction?.current || nextState.sys.responseWindow?.current || openedAfterScoringWindow) {
                return { events: result.events, halt: true, updatedState: nextState } as PhaseExitResult;
            }

            const completedState = updateScoringSession(
                markScoringBaseCompleted(nextState, activeBaseRef),
                (session) => session ? { ...session, currentStep: 'awaiting-post-reduce' } : session,
            );
            return { events: result.events, updatedState: completedState } as PhaseExitResult;
        }

        return [];
    },

    onPhaseEnter({ state, from, to, random, command, exitEvents }): GameEvent[] | PhaseEnterResult {
        let core = state.core;
        const pid = getCurrentPlayerId(core);
        const now = typeof command.timestamp === 'number' ? command.timestamp : 0;
        const events: GameEvent[] = [];
        // 杩借釜 sys 鍙樻洿锛堝熀鍦拌兘鍔?ongoing 鍙兘鍒涘缓 Interaction锛?
        let currentMatchState: MatchState<SmashUpCore> = state;
        let hasSysUpdate = false;

        if (to === 'startTurn') {
            // Safety: afterScoringInitialPowers is only meaningful immediately after closing the afterScoring window.
            // If it ever leaks across turns, it can cause unintended base clear/replace on later scoreBases exits.
            if ((currentMatchState.sys as any).afterScoringInitialPowers) {
                currentMatchState = {
                    ...currentMatchState,
                    sys: {
                        ...currentMatchState.sys,
                        afterScoringInitialPowers: undefined,
                    } as any,
                };
                hasSysUpdate = true;
            }
            let nextPlayerId = pid;
            let nextTurnNumber = core.turnNumber;
            if (from === 'endTurn') {
                const nextIndex = (core.currentPlayerIndex + 1) % core.turnOrder.length;
                nextPlayerId = core.turnOrder[nextIndex];
                if (nextIndex === 0) {
                    nextTurnNumber = core.turnNumber + 1;
                }
            }
            currentMatchState = {
                ...currentMatchState,
                sys: {
                    ...currentMatchState.sys,
                    _smashupStartTurnWindowActive: true,
                } as any,
            };
            hasSysUpdate = true;
            const turnStarted: TurnStartedEvent = {
                type: SU_EVENTS.TURN_STARTED,
                payload: {
                    playerId: nextPlayerId,
                    turnNumber: nextTurnNumber,
                },
                timestamp: now,
            };
            events.push(turnStarted);
            const startTurnCore = reduce(core, turnStarted);
            currentMatchState = { ...currentMatchState, core: startTurnCore };

            const startTurnTriggeredEvents: SmashUpEvent[] = [];

            // 瑙﹀彂鍩哄湴 onTurnStart 鑳藉姏锛堟敼涓哄叆闃燂紝鎸?Wiki 鍚屾椂瑙﹀彂鎺掑簭瑙ｅ喅锛?
            const baseResult = triggerAllBaseAbilities('onTurnStart', startTurnCore, nextPlayerId, now, undefined, currentMatchState, random);
            startTurnTriggeredEvents.push(...baseResult.events);
            if (baseResult.matchState) {
                hasSysUpdate = hasSysUpdate || baseResult.matchState.sys !== currentMatchState.sys;
                currentMatchState = { ...baseResult.matchState, core: startTurnCore };
            }

            // 瑙﹀彂 ongoing 鏁堟灉 onTurnStart锛堟敼涓哄叆闃燂紝鎸?Wiki 鍚屾椂瑙﹀彂鎺掑簭瑙ｅ喅锛?
            const onTurnStartEvents = fireTriggers(startTurnCore, 'onTurnStart', {
                state: startTurnCore,
                matchState: currentMatchState,
                playerId: nextPlayerId,
                random,
                now,
            });
            startTurnTriggeredEvents.push(...onTurnStartEvents.events);
            if (onTurnStartEvents.matchState) {
                hasSysUpdate = hasSysUpdate || onTurnStartEvents.matchState.sys !== currentMatchState.sys;
                currentMatchState = { ...onTurnStartEvents.matchState, core: startTurnCore };
            }

            if (startTurnTriggeredEvents.length > 0) {
                const processedStartTurn = postProcessSystemEvents(
                    startTurnCore,
                    startTurnTriggeredEvents,
                    random,
                    currentMatchState,
                );
                if (processedStartTurn.matchState) {
                    hasSysUpdate = hasSysUpdate || processedStartTurn.matchState.sys !== currentMatchState.sys;
                    currentMatchState = { ...processedStartTurn.matchState, core: startTurnCore };
                }

                const immediateStartTurn = processImmediateStartTurnMinionTriggers(
                    startTurnCore,
                    processedStartTurn.events,
                    nextPlayerId,
                    random,
                    currentMatchState,
                );
                if (immediateStartTurn.matchState) {
                    hasSysUpdate = hasSysUpdate || immediateStartTurn.matchState.sys !== currentMatchState.sys;
                    currentMatchState = immediateStartTurn.matchState;
                }

                events.push(...immediateStartTurn.events);
            }

            // Wiki: Start Turn 鏃跺彲鍏嶈垂鎻紑涓€寮犺嚜宸辨帶鍒剁殑鍩嬭懍鍗★紙鍙€夛紝涓旀瘡鍥炲悎浠呬竴娆★級
            const coreForUncover = currentMatchState.core;
            const buriedChoices: { cardUid: string; baseIndex: number; label: string }[] = [];
            for (let bi = 0; bi < coreForUncover.bases.length; bi++) {
                const b = coreForUncover.bases[bi];
                const buried = (b.buriedCards ?? []).filter(c => c.controllerId === nextPlayerId);
                for (const bc of buried) {
                    const def = getCardDef(bc.defId);
                    buriedChoices.push({
                        cardUid: bc.uid,
                        baseIndex: bi,
                        label: `${def?.name ?? bc.defId} @ ${(getBaseDef(b.defId)?.name ?? ('基地 #' + (bi + 1)))}`,
                    });
                }
            }
            if (buriedChoices.length > 0) {
                const options = buriedChoices.map((c, i) => ({
                    id: `u-${i}`,
                    label: c.label,
                    value: { cardUid: c.cardUid, baseIndex: c.baseIndex },
                    displayMode: 'button' as const,
                }));
                options.push({ id: 'skip', label: '跳过（不揭开）', value: { skip: true }, displayMode: 'button' as const });
                const interaction = createSimpleChoice(
                    `bury_uncover_start_turn_${now}`,
                    nextPlayerId,
                    '你可以揭开一张你控制的埋葬牌，并立刻作为额外牌打出',
                    options as any[],
                    { sourceId: 'bury_uncover_start_turn', targetType: 'generic', autoRefresh: 'buried', responseValidationMode: 'live' },
                );
                currentMatchState = queueInteraction(currentMatchState, interaction);
                hasSysUpdate = true;
            }

            // 鏈?sys 鍙樻洿鏃惰繑鍥?PhaseEnterResult锛屽惁鍒欒繑鍥炵函浜嬩欢鏁扮粍
            if (hasSysUpdate) {
                return { events, updatedState: currentMatchState } as PhaseEnterResult;
            }
            return events;
        }

        if (to === 'scoreBases') {
            events.push({
                type: SU_EVENT_TYPES.BEFORE_SCORING_CLEARED,
                payload: {},
                timestamp: now,
            } as GameEvent);
            events.push({
                type: SU_EVENT_TYPES.AFTER_SCORING_CLEARED,
                payload: {},
                timestamp: now,
            } as GameEvent);

            const eligibleIndices = getScoringEligibleBaseIndices(core);
            currentMatchState = eligibleIndices.length > 0
                ? setScoringSession(currentMatchState, createScoringSession(core, eligibleIndices))
                : clearScoringSession(currentMatchState);
            hasSysUpdate = true;

            if (eligibleIndices.length > 0) {
                events.push({
                    type: SU_EVENTS.SCORING_ELIGIBLE_BASES_LOCKED,
                    payload: { baseIndices: eligibleIndices },
                    timestamp: now,
                } as GameEvent);
                const meFirstEvt = openMeFirstWindow('scoreBases', pid, core.turnOrder, now);
                events.push(meFirstEvt);
            }

            return { events, updatedState: currentMatchState } as PhaseEnterResult;
        }

        if (to === 'draw') {
            if (from === 'scoreBases' && exitEvents && exitEvents.length > 0) {
                core = exitEvents.reduce(
                    (currentCore, event) => reduce(currentCore, event as SmashUpEvent),
                    core,
                );
            }
            const player = core.players[pid];
            if (player) {
                const { drawnUids, reshuffledDeckUids } = drawCards(player, DRAW_PER_TURN, random);
                if (drawnUids.length > 0) {
                    if (reshuffledDeckUids && reshuffledDeckUids.length > 0) {
                        const reshuffleEvt: DeckReshuffledEvent = {
                            type: SU_EVENTS.DECK_RESHUFFLED,
                            payload: { playerId: pid, deckUids: reshuffledDeckUids },
                            timestamp: now,
                        };
                        events.push(reshuffleEvt);
                    }
                    const drawEvt: CardsDrawnEvent = {
                        type: SU_EVENTS.CARDS_DRAWN,
                        payload: { playerId: pid, count: drawnUids.length, cardUids: drawnUids },
                        timestamp: now,
                    };
                    events.push(drawEvt);
                }
            }
        }

        if (to === 'playCards' && from === 'startTurn' && (state.sys as any)._smashupStartTurnWindowActive) {
            return {
                events,
                updatedState: {
                    ...state,
                    sys: {
                        ...state.sys,
                        _smashupStartTurnWindowActive: undefined,
                        _waitForStartTurnInteractionReduce: undefined,
                    } as any,
                },
            } as PhaseEnterResult;
        }

        return events;
    },

    onAutoContinueCheck({ state }): { autoContinue: boolean; playerId: PlayerId } | void {
        const core = state.core;
        const pid = getCurrentPlayerId(core);
        const phase = state.sys.phase as GamePhase;

        if (phase === 'factionSelect' && !core.factionSelection) {
            return { autoContinue: true, playerId: pid };
        }

        // 閫氱敤瀹堝崼锛氫换浣曢樁娈垫湁寰呭鐞嗙殑 Interaction 鏃堕兘涓嶈嚜鍔ㄦ帹杩?
        // 锛堝熀鍦拌兘鍔涘鎷夎幈鑰?onTurnStart銆佹墭灏斿浘鍔?afterScoring 绛夊彲鑳藉湪浠绘剰闃舵鍒涘缓 Interaction锛?
        if (state.sys.interaction?.current) {
            return undefined;
        }

        // factionSelect 鑷姩鎺ㄨ繘 check
        if (phase === 'factionSelect') {
            // 濡傛灉鎵€鏈変汉閮介€夊畬浜嗭紙reducer鎶妔election缃┖浜嗭級锛屽垯鑷姩杩涘叆涓嬩竴闃舵
            if (!core.factionSelection) {
                return { autoContinue: true, playerId: pid };
            }
        }

        // startTurn 鑷姩鎺ㄨ繘鍒?playCards
        if (phase === 'startTurn') {
            if ((state.sys as any)._waitForStartTurnInteractionReduce) {
                return undefined;
            }
            return { autoContinue: true, playerId: pid };
        }

        // scoreBases 闃舵锛氭潯浠舵€ц嚜鍔ㄦ帹杩?
        // 
        // 銆愪慨澶嶉€昏緫銆?
        // 1. 濡傛灉 flowHalted=true 涓斾氦浜掑凡瑙ｅ喅 鈫?鑷姩鎺ㄨ繘锛堟竻鐞?halt 鐘舵€侊級
        // 2. 濡傛灉娌℃湁 eligible 鍩哄湴 鈫?鑷姩鎺ㄨ繘锛堟棤闇€璁″垎锛?
        // 3. 濡傛灉鏈?eligible 鍩哄湴涓斿搷搴旂獥鍙ｅ凡鍏抽棴 鈫?鑷姩鎺ㄨ繘锛堣Е鍙戣鍒嗭級
        // 4. 鍏朵粬鎯呭喌锛堝搷搴旂獥鍙ｄ粛鎵撳紑锛夆啋 涓嶈嚜鍔ㄦ帹杩涳紙绛夊緟鍝嶅簲锛?
        // 
        // 杩欐牱鍙互閬垮厤鏃犻檺寰幆锛屽悓鏃跺湪鍝嶅簲绐楀彛鍏抽棴鍚庤嚜鍔ㄦ帹杩涜Е鍙戣鍒嗐€?
        if (phase === 'scoreBases') {
            if (state.sys.responseWindow?.current) {
                return undefined;
            }

            if ((state.sys as any)._waitForPostScoringReduce) {
                return undefined;
            }

            const scoringSession = getScoringSession(state);
            if (scoringSession?.currentStep === 'awaiting-post-reduce') {
                return undefined;
            }

            if (state.sys.flowHalted && !state.sys.interaction.current && !state.sys.responseWindow?.current) {
                return { autoContinue: true, playerId: pid };
            }

            if (hasPendingScoreBasesSpecialActivation(state)) {
                return undefined;
            }

            if (scoringSession) {
                const hasRemainingWork = !!scoringSession.currentBaseRef || getRemainingScoringBaseRefs(state).length > 0;
                if (hasRemainingWork) {
                    return { autoContinue: true, playerId: pid };
                }
                return { autoContinue: true, playerId: pid };
            }

            const eligibleIndices = getLockedScoringBaseIndices(core);
            if (eligibleIndices.length === 0) {
                return { autoContinue: true, playerId: pid };
            }

            return { autoContinue: true, playerId: pid };
        }

        if (phase === 'draw') {
            const player = core.players[pid];
            if (player && player.hand.length <= HAND_LIMIT) {
                return { autoContinue: true, playerId: pid };
            }
        }

        // endTurn 鑷姩鎺ㄨ繘鍒?startTurn锛堝垏鎹㈢帺瀹跺悗锛?
        if (phase === 'endTurn') {
            return { autoContinue: true, playerId: pid };
        }
    },
};

// ============================================================================
// playerView锛氫笉鍐嶉殣钘忔墜鐗?鐗屽簱锛岀洿鎺ュ彂閫佸畬鏁存暟鎹紙涓嶉渶瑕侀槻浣滃紛锛?
// ============================================================================

function playerView(state: SmashUpCore, playerId: PlayerId): Partial<SmashUpCore> {
    // 榛樿涓嶉殣钘忎换浣曚俊鎭紙椤圭洰鍐呬笉闃蹭綔寮婏級锛屼絾鍩嬭懍鍗￠渶瑕侀伒寰?Wiki锛氫粠鎵嬬墝鍩嬭懍榛樿涓嶅叕寮€銆?
    // 鍥犳瀵归潪鎺у埗鑰呴殣钘?buriedCards 鐨?defId 绛変俊鎭紝浠呬繚鐣欌€滄湁澶氬皯寮犮€佺敱璋佹帶鍒躲€佸湪鍝釜鍩哄湴鈥濈殑鍙鎬с€?
    const maskedBases = state.bases.map(b => {
        if (!b.buriedCards || b.buriedCards.length === 0) return b;
        return {
            ...b,
            buriedCards: b.buriedCards.map(c => {
                if (c.controllerId === playerId) return c;
                return {
                    uid: c.uid,
                    defId: 'buried_unknown',
                    trueOwnerId: c.controllerId,
                    controllerId: c.controllerId,
                    buriedFrom: c.buriedFrom,
                };
            }),
        };
    });
    return { bases: maskedBases };
}


// ============================================================================
// isGameOver
// ============================================================================

function isGameOver(state: SmashUpCore): GameOverResult | undefined {
    if (state.gameResult) return state.gameResult;

    // 鍥炲悎缁撴潫鏃舵鏌ワ細鏈夌帺瀹?>= 15 VP锛堝師濮?VP锛屾儵缃氬湪鏈€缁堝垎鏁颁腑浣撶幇锛?
    const winners = state.turnOrder.filter(pid => state.players[pid]?.vp >= VP_TO_WIN);
    if (winners.length === 0) return undefined;

    // 璁＄畻鍚柉鐙傚崱鎯╃綒鐨勬渶缁堝垎鏁?
    const scores = getScores(state);

    if (winners.length === 1) {
        return { winner: winners[0], scores };
    }
    // 澶氫汉杈炬爣锛氭渶缁堝垎鏁版渶楂樿€呰儨
    const sorted = winners.sort((a, b) => scores[b] - scores[a]);
    if (scores[sorted[0]] > scores[sorted[1]]) {
        return { winner: sorted[0], scores };
    }
    // 骞冲眬锛氱柉鐙傚崱杈冨皯鑰呰儨锛堝厠鑻忛瞾鎵╁睍瑙勫垯锛?
    if (state.madnessDeck !== undefined) {
        const madnessA = countMadnessCardsForPlayer(state, sorted[0]);
        const madnessB = countMadnessCardsForPlayer(state, sorted[1]);
        if (madnessA !== madnessB) {
            return { winner: madnessA < madnessB ? sorted[0] : sorted[1], scores };
        }
    }
    // 浠嶇劧骞冲眬锛氱户缁父鎴?
    return undefined;
}

export function getScores(state: SmashUpCore): Record<PlayerId, number> {
    const scores: Record<PlayerId, number> = {};
    for (const pid of state.turnOrder) {
        const player = state.players[pid];
        if (!player) continue;
        let vp = player.vp;
        // P19: 鐤媯鍗?VP 鎯╃綒锛堟瘡 2 寮犳墸 1 VP锛?
        if (state.madnessDeck !== undefined) {
            vp -= madnessVpPenalty(countMadnessCardsForPlayer(state, pid));
        }
        scores[pid] = vp;
    }
    return scores;
}

// ============================================================================
// 浜嬩欢鎷︽埅锛氭浛浠ｆ晥鏋滐紙Replacement Effects锛?
// ============================================================================

/** 灏嗛鍩熷眰鎷︽埅鍣ㄦ敞鍐岃〃濮旀墭缁欏紩鎿?interceptEvent 閽╁瓙 */
function domainInterceptEvent(
    state: SmashUpCore,
    event: SmashUpEvent
): SmashUpEvent | SmashUpEvent[] | null {
    const result = ongoingInterceptEvent(state, event);
    if (result !== undefined) return result;
    return event; // 鏃犳嫤鎴櫒鍖归厤锛岃繑鍥炲師浜嬩欢
}

function resolveTitanClashEventsOnBase(
    state: SmashUpCore,
    baseIndex: number,
    now: number,
): SmashUpEvent[] {
    const base = state.bases[baseIndex];
    const baseDef = base ? getBaseDef(base.defId) : undefined;
    if (!base || baseDef?.allowMultipleTitans) return [];

    const titansOnBase = getTitansOnBase(state, baseIndex);
    if (titansOnBase.length <= 1) return [];

    const ranked = titansOnBase
        .map(titan => ({
            titan,
            power: getPlayerEffectivePowerOnBase(state, base, baseIndex, titan.controllerId),
            enteredAt: titan.location.zone === 'base' ? titan.location.enteredAt : Number.MAX_SAFE_INTEGER,
        }))
        .sort((a, b) => {
            if (b.power !== a.power) return b.power - a.power;
            return a.enteredAt - b.enteredAt;
        });

    const winner = ranked[0]?.titan;
    if (!winner) return [];

    return ranked
        .slice(1)
        .map(({ titan }) => removeTitanFromPlay(titan, 'titan_clash', now));
}

function shouldDeferTitanClashForEvent(
    state: SmashUpCore,
    event: SmashUpEvent,
    baseIndex: number,
): boolean {
    if (!state.activeDuel || state.activeDuel.baseIndex !== baseIndex) return false;
    if (event.type !== SU_EVENT_TYPES.TITAN_PLAYED && event.type !== SU_EVENT_TYPES.TITAN_MOVED) return false;

    const titan = getTitanByUid(state, event.payload.titanUid);
    return titan?.defId === 'pecos_bill'
        && titan.location.zone === 'base'
        && titan.location.baseIndex === baseIndex
        && titan.metadata?.deferClashUntilDuelEnds === true;
}

function resolveTitanClashEvents(
    state: SmashUpCore,
    event: SmashUpEvent,
): SmashUpEvent[] {
    if (event.type !== SU_EVENT_TYPES.TITAN_PLAYED && event.type !== SU_EVENT_TYPES.TITAN_MOVED) {
        return [];
    }

    const baseIndex = event.type === SU_EVENT_TYPES.TITAN_PLAYED
        ? event.payload.baseIndex
        : event.payload.toBaseIndex;
    if (shouldDeferTitanClashForEvent(state, event, baseIndex)) {
        return [];
    }

    return resolveTitanClashEventsOnBase(state, baseIndex, event.timestamp ?? 0);
}

function resolveDeferredPecosBillClashEvents(
    state: SmashUpCore,
    now: number,
): SmashUpEvent[] {
    if (state.activeDuel) return [];

    const events: SmashUpEvent[] = [];
    let workingState = state;
    const processedBases = new Set<number>();
    const deferredTitans = (state.titans ?? []).filter((titan) =>
        titan.defId === 'pecos_bill'
        && titan.location.zone === 'base'
        && titan.metadata?.deferClashUntilDuelEnds === true,
    );

    for (const titan of deferredTitans) {
        if (titan.location.zone !== 'base' || processedBases.has(titan.location.baseIndex)) continue;
        processedBases.add(titan.location.baseIndex);

        const clashEvents = resolveTitanClashEventsOnBase(workingState, titan.location.baseIndex, now);
        if (clashEvents.length > 0) {
            events.push(...clashEvents);
            for (const clashEvent of clashEvents) {
                workingState = reduce(workingState, clashEvent);
            }
        }

        const pecosAfterClash = getTitanByUid(workingState, titan.uid);
        if (pecosAfterClash?.location.zone === 'base' && pecosAfterClash.metadata?.deferClashUntilDuelEnds === true) {
            const clearedEvent: SmashUpEvent = {
                type: SU_EVENTS.TITAN_METADATA_UPDATED,
                payload: {
                    titanUid: pecosAfterClash.uid,
                    metadataUpdate: { deferClashUntilDuelEnds: false },
                    reason: 'pecos_bill_duel_end',
                },
                timestamp: now,
            };
            events.push(clearedEvent);
            workingState = reduce(workingState, clearedEvent);
        }
    }

    return events;
}

// ============================================================================
// 绯荤粺浜嬩欢鍚庡鐞嗭細Prompt bridge 绛夌郴缁熶骇鐢熺殑棰嗗煙浜嬩欢闇€瑕佽Е鍙?ongoing trigger
// ============================================================================

function postProcessSystemEvents(
    state: SmashUpCore,
    events: SmashUpEvent[],
    random: RandomFn,
    matchState?: MatchState<SmashUpCore>,
    options?: { skipImmediateStartTurnMinionTriggers?: boolean },
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    // 鎻愬彇鏃堕棿鎴筹紙鍙栫涓€涓簨浠剁殑 timestamp锛?
    const now = events.length > 0 && typeof events[0].timestamp === 'number' ? events[0].timestamp : 0;
    // 褰撳墠鐜╁浣滀负 trigger 鐨?sourcePlayerId
    const pid = getCurrentPlayerId(state);
    // 浣跨敤 pipeline 浼犲叆鐨?matchState锛堝寘鍚湡瀹?sys锛夛紝鎴栨瀯閫犳渶灏忓寘瑁?
    let ms = matchState ?? { core: state, sys: { interaction: { current: undefined, queue: [] } } } as unknown as MatchState<SmashUpCore>;
    const inputEventsAlreadyReduced = !!(ms.sys as any)?._ppseInputEventsReduced;
    if (inputEventsAlreadyReduced) {
        ms = {
            ...ms,
            sys: {
                ...ms.sys,
                _ppseInputEventsReduced: undefined,
            } as typeof ms.sys,
        };
    }

    // 渚濇鎵ц淇濇姢杩囨护 + trigger 鍚庡鐞嗭紙閾惧紡浼犻€?matchState锛?
    // destroy 鈫?move 寰幆鐩村埌绋冲畾锛坢ove 瑙﹀彂鍣ㄥ彲鑳戒骇鐢熸柊鐨?MINION_DESTROYED锛?
    const afterDestroyMove = processDestroyMoveCycle(events, ms, pid, random, now);
    if (afterDestroyMove.matchState) ms = afterDestroyMove.matchState;
    // 杩斿洖鎵嬬墝/鏀剧墝搴撳簳淇濇姢杩囨护锛堜笌 execute() 鍚庡鐞嗗榻愶級
    const afterProtectedAffect = filterProtectedAffectEvents(afterDestroyMove.events, ms.core, pid);
    const afterAffect = processAffectTriggers(afterProtectedAffect, ms, pid, random, now);
    if (afterAffect.matchState) ms = afterAffect.matchState;
    const afterDeckInspection = processDeckInspectionTriggers(afterAffect.events, ms, pid, random, now);
    if (afterDeckInspection.matchState) ms = afterDeckInspection.matchState;

    // 妫€娴?MINION_PLAYED 浜嬩欢锛岃嚜鍔ㄨ拷鍔犺Е鍙戦摼锛坥nPlay + 鍩哄湴鑳藉姏 + ongoing锛?
    // 鍏抽敭锛氬繀椤诲厛鎶?MINION_PLAYED 涔嬪墠鐨勪簨浠?reduce 鍒?core 涓紝
    // 鍚﹀垯 onPlay 澶╄祴璇诲彇鐨勭墝搴?鎵嬬墝绛夌姸鎬佹槸鏃х殑锛堝缁寸撼鏂崟椋熻€呬粠鐗屽簱鎼滅储鎵撳嚭琛屽案锛?
    // 琛屽案 onPlay 璇诲彇 deck[0] 鏃?CARDS_DRAWN 杩樻病 reduce锛岀墝搴撴湭鏇存柊锛夈€?
    //
    // 淇绛栫暐锛氬湪閬囧埌 MINION_PLAYED 鏃讹紝鍏堟妸瀹冧箣鍓嶇殑闈?MINION_PLAYED 浜嬩欢
    // reduce 鍒颁复鏃?core 涓紝璁?fireMinionPlayedTriggers 鎷垮埌鏈€鏂扮殑鐗屽簱/鎵嬬墝鐘舵€併€?
    // 涓?reduce MINION_PLAYED 鏈韩锛屽洜涓哄湪 execute 璺緞锛堟楠?4.5锛変腑 state 宸茬粡
    // 鍖呭惈浜嗘墍鏈変簨浠剁殑 reduce 缁撴灉锛屽啀 reduce 浼氬鑷?minionsPlayed 绛夊瓧娈甸噸澶嶈绠椼€?
    //
    // 鍘婚噸閫昏緫锛圖45 缁村害锛夛細postProcessSystemEvents 鍦?pipeline 涓璋冪敤涓ゆ锛堟楠?4.5 鍜屾楠?5锛夛紝
    // 蹇呴』闃叉鍚屼竴涓?MINION_PLAYED 浜嬩欢琚噸澶嶅鐞嗐€傚幓閲嶇瓥鐣ワ細
    // 1. 浼樺厛妫€鏌?sourceCommandType锛氭潵鑷懡浠ょ殑浜嬩欢锛堟湁 sourceCommandType锛夊彧鍦ㄦ楠?4.5 澶勭悊
    // 2. 瀵逛簬娲剧敓浜嬩欢锛堟棤 sourceCommandType锛夛紝閫氳繃 cardUid+baseIndex 鍘婚噸锛岄伩鍏嶉噸澶嶅鐞?
    // 3. 浣跨敤 matchState.sys._processedMinionPlayed 闆嗗悎璁板綍宸插鐞嗙殑浜嬩欢锛堟牸寮忥細`${cardUid}@${baseIndex}`锛?
    const derivedEvents: SmashUpEvent[] = [];
    // 鏀堕泦 MINION_PLAYED 涔嬪墠鐨勯潪 MINION_PLAYED 浜嬩欢锛岀敤浜庝复鏃?reduce
    const prePlayEvents: SmashUpEvent[] = [];
    
    // 鍒濆鍖栧凡澶勭悊浜嬩欢闆嗗悎锛堝鏋滀笉瀛樺湪锛?
    // 浣跨敤 any 绫诲瀷鏂█缁曡繃 SystemState 绫诲瀷闄愬埗锛堣繖鏄父鎴忕壒瀹氱殑涓存椂鐘舵€侊級
    // 銆怐45 淇銆戠粺涓€澶勭悊 MINION_PLAYED 鍜?ACTION_PLAYED 鐨勫幓閲?
    const sysAny = ms.sys as any;
    if (!sysAny._processedPlayedEvents || !(sysAny._processedPlayedEvents instanceof Set)) {
        sysAny._processedPlayedEvents = new Set<string>();
    }
    const processedSet = sysAny._processedPlayedEvents as Set<string>;
    
    // 【修复】清理返回手牌的随从的去重标记
    // 当随从返回手牌后再次打出时，应该重新触发 onPlay 能力
    for (const event of afterDeckInspection.events) {
        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const returnedEvt = event as { type: string; payload: { minionUid: string; fromBaseIndex: number } };
            const eventKey = `MINION:${returnedEvt.payload.minionUid}@${returnedEvt.payload.fromBaseIndex}`;
            processedSet.delete(eventKey);
        }
        if (event.type === SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND) {
            const returnedEvt = event as { type: string; payload: { cardUid: string; baseIndex: number } };
            const eventKey = `MINION:${returnedEvt.payload.cardUid}@${returnedEvt.payload.baseIndex}`;
            processedSet.delete(eventKey);
        }
    }
    
    for (const event of afterDeckInspection.events) {
        if (event.type === SU_EVENTS.CARDS_DISCARDED) {
            const discardEvt = event as { type: string; payload: { playerId: PlayerId; cardUids: string[] }; timestamp: number };
            const tempCore = prePlayEvents.reduce((acc, preEvt) => reduce(acc, preEvt), state);
            const queued = collectTriggers(tempCore, 'onCardsDiscarded', {
                state: tempCore,
                matchState: ms,
                playerId: discardEvt.payload.playerId,
                random,
                now: event.timestamp,
            });
            if (queued) {
                derivedEvents.push(queued);
            }
            prePlayEvents.push(event);
        } else if (event.type === SU_EVENTS.MINION_PLAYED) {
            const playedEvt = event as MinionPlayedEvent;
            
            // 鍘婚噸妫€鏌ワ細鏋勯€犱簨浠跺敮涓€鏍囪瘑锛圡INION: + cardUid + baseIndex锛?
            const eventKey = `MINION:${playedEvt.payload.cardUid}@${playedEvt.payload.baseIndex}`;
            
            // 濡傛灉宸插鐞嗚繃锛岃烦杩囷紙闃叉姝ラ 4.5 鍜屾楠?5 閲嶅澶勭悊锛?
            if (processedSet.has(eventKey)) {
                prePlayEvents.push(event);
                continue;
            }
            
            // 鏍囪涓哄凡澶勭悊
            processedSet.add(eventKey);
            
            // 灏嗕箣鍓嶇Н绱殑浜嬩欢 reduce 鍒颁复鏃?core
            // 纭繚 onPlay 瑙﹀彂鏃剁湅鍒扮殑鏄渶鏂扮姸鎬侊紙闅忎粠宸插湪鍦轰笂锛岀墝搴?鎵嬬墝宸叉洿鏂帮級
            let tempCore = state;
            for (const preEvt of prePlayEvents) {
                tempCore = reduce(tempCore, preEvt);
            }
            // 銆愰噸瑕併€戝浜庝粠闈炴墜鐗屾潵婧愨€滈澶栨墦鍑衡€濈殑闅忎粠锛坒romDeck / fromDiscard / fromBuried锛夛紝
            // 蹇呴』鍦ㄨ繖閲?reduce 褰撳墠 MINION_PLAYED 浜嬩欢锛岀‘淇?onPlay 瑙﹀彂鍣ㄨ兘鍦?core 涓壘鍒拌闅忎粠锛?
            // 骞惰鍒版纭殑 metadata.playedFrom锛堜緥濡傜炕鍑哄煁钁墝鏃讹級銆?
            const payload = event.payload;
            if (payload.fromDeck || payload.fromDiscard || payload.fromBuried) {
                tempCore = reduce(tempCore, event);
            }
            
            const triggers = fireMinionPlayedTriggers({
                core: tempCore,
                matchState: ms,
                playerId: payload.playerId,
                cardUid: payload.cardUid,
                defId: payload.defId,
                baseIndex: payload.baseIndex,
                power: payload.power,
                random,
                now: event.timestamp,
                playedEvt: event as MinionPlayedEvent,
            });
            derivedEvents.push(...triggers.events);
            if (triggers.matchState) ms = triggers.matchState;
        } else if (event.type === SU_EVENTS.ACTION_PLAYED) {
            // 銆怐45 淇銆慉CTION_PLAYED 浜嬩欢涔熼渶瑕佸幓閲嶏紝闃叉琛屽姩鍗?onPlay 鑳藉姏琚Е鍙戜袱娆?
            // 鍏稿瀷鍦烘櫙锛氫紶閫侀棬鍒涘缓浜や簰锛屼氦浜掕В鍐冲悗 pipeline 閲嶆柊杩涘叆 postProcessSystemEvents
            const playedEvt = event as { type: string; payload: { playerId: string; cardUid: string; defId: string }; timestamp: number };
            
            // 鍘婚噸妫€鏌ワ細鏋勯€犱簨浠跺敮涓€鏍囪瘑锛圓CTION: + cardUid + playerId锛?
            const eventKey = `ACTION:${playedEvt.payload.cardUid}@${playedEvt.payload.playerId}`;
            
            // 濡傛灉宸插鐞嗚繃锛岃烦杩囷紙闃叉姝ラ 4.5 鍜屾楠?5 閲嶅澶勭悊锛?
            if (processedSet.has(eventKey)) {
                prePlayEvents.push(event);
                continue;
            }
            
            // 鏍囪涓哄凡澶勭悊
            processedSet.add(eventKey);
            
            // ACTION_PLAYED 鐨?onPlay 瑙﹀彂宸插湪 execute() 涓鐞嗭紝杩欓噷鍙渶瑕佹爣璁板幓閲?
            // 涓嶉渶瑕侀澶栬Е鍙戦€昏緫锛堜笌 MINION_PLAYED 涓嶅悓锛?
            prePlayEvents.push(event);
        } else {
            prePlayEvents.push(event);
        }
    }

    // 瀵?derived events 閫掑綊鎵ц trigger 鍚庡鐞嗭紙onPlay 浜х敓鐨?MINION_DESTROYED 绛夐渶瑕佽Е鍙?onDestroy 閾撅級
    let finalDerived = derivedEvents;
    if (derivedEvents.length > 0) {
        const afterDerivedDestroyMove = processDestroyMoveCycle(derivedEvents, ms, pid, random, now);
        if (afterDerivedDestroyMove.matchState) ms = afterDerivedDestroyMove.matchState;
        // 杩斿洖鎵嬬墝/鏀剧墝搴撳簳淇濇姢杩囨护锛堜笌 execute() 鍚庡鐞嗗榻愶級
        const afterDerivedProtectedAffect = filterProtectedAffectEvents(afterDerivedDestroyMove.events, ms.core, pid);
        const afterDerivedAffect = processAffectTriggers(afterDerivedProtectedAffect, ms, pid, random, now);
        if (afterDerivedAffect.matchState) ms = afterDerivedAffect.matchState;
        const afterDerivedDeckInspection = processDeckInspectionTriggers(afterDerivedAffect.events, ms, pid, random, now);
        if (afterDerivedDeckInspection.matchState) ms = afterDerivedDeckInspection.matchState;
        finalDerived = afterDerivedDeckInspection.events;
    }

    const combined = [...afterDeckInspection.events, ...finalDerived];
    const alreadyReducedEventCount = inputEventsAlreadyReduced ? afterDeckInspection.events.length : 0;

    // 泰坦位置事件后处理：标准基地双泰坦自动 clash。
    // 使用 sys 上的去重集合，避免 pipeline 多次调用 postProcessSystemEvents 时重复追加同一批 clash 结果。
    const titanSysAny = ms.sys as any;
    if (!titanSysAny._processedTitanPositionEvents || !(titanSysAny._processedTitanPositionEvents instanceof Set)) {
        titanSysAny._processedTitanPositionEvents = new Set<string>();
    }
    const processedTitanPositionEvents = titanSysAny._processedTitanPositionEvents as Set<string>;

    const titanDerived: SmashUpEvent[] = [];
    let titanCore = state;
    for (let eventIndex = 0; eventIndex < combined.length; eventIndex++) {
        const event = combined[eventIndex];
        // state 已经包含了本轮原始领域事件（afterDeckInspection.events）的 reduce 结果；
        // 这里只需要把新增的派生事件继续 reduce 进临时 core，避免原始事件被重复结算。
        if (eventIndex >= alreadyReducedEventCount) {
            titanCore = reduce(titanCore, event);
        }
        if (event.type !== SU_EVENT_TYPES.TITAN_PLAYED && event.type !== SU_EVENT_TYPES.TITAN_MOVED) continue;

        const eventBaseIndex = event.type === SU_EVENT_TYPES.TITAN_PLAYED
            ? event.payload.baseIndex
            : event.payload.toBaseIndex;
        const eventKey = `${event.type}:${event.payload.titanUid}@${eventBaseIndex}`;
        if (processedTitanPositionEvents.has(eventKey)) continue;
        processedTitanPositionEvents.add(eventKey);

        const clashEvents = resolveTitanClashEvents(titanCore, event);
        if (clashEvents.length > 0) {
            titanDerived.push(...clashEvents);
            for (const clashEvent of clashEvents) {
                titanCore = reduce(titanCore, clashEvent);
            }
        }

        if (event.type === SU_EVENT_TYPES.TITAN_MOVED) {
            const movedTitan = getTitanByUid(titanCore, event.payload.titanUid);
            if (movedTitan?.location.zone === 'base' && movedTitan.location.baseIndex === event.payload.toBaseIndex) {
                const queuedTitanMove = collectTriggers(titanCore, 'onTitanMoved', {
                    state: titanCore,
                    matchState: ms,
                    playerId: movedTitan.controllerId,
                    baseIndex: event.payload.toBaseIndex,
                    reason: event.payload.reason,
                    random,
                    now,
                });
                if (queuedTitanMove) {
                    titanDerived.push(queuedTitanMove);
                    titanCore = reduce(titanCore, queuedTitanMove);
                }
            }
        }
    }

    const deferredClashEvents = resolveDeferredPecosBillClashEvents(titanCore, now);
    if (deferredClashEvents.length > 0) {
        titanDerived.push(...deferredClashEvents);
        for (const deferredEvent of deferredClashEvents) {
            titanCore = reduce(titanCore, deferredEvent);
        }
    }

    // === Global reaction queue resolution (Wiki simultaneous ordering) ===
    // Important: the resolver must see the latest temporary core, including
    // movement/position events that happened in this post-process pass.
    // Otherwise a queued trigger like onTitanMoved still executes against the
    // old base position and silently fizzles.
    const msForQueue = titanCore === ms.core ? ms : { ...ms, core: titanCore };

    const rq = maybeResolveReactionQueue(msForQueue, random, now);
    let finalEvents = [...combined, ...titanDerived];
    if (rq) {
        finalEvents = [...finalEvents, ...rq.events];
        ms = rq.state;
    }

    const startTurnWindowActive = ms.sys.phase === 'startTurn' || Boolean((ms.sys as any)._smashupStartTurnWindowActive);
    if (!options?.skipImmediateStartTurnMinionTriggers && startTurnWindowActive) {
        const immediate = processImmediateStartTurnMinionTriggers(
            state,
            finalEvents,
            pid,
            random,
            ms,
        );
        finalEvents = immediate.events;
        if (immediate.matchState) {
            ms = immediate.matchState;
        }
    }

    if ((ms.sys as any)._smashupStartTurnWindowActive && ms.sys.phase !== 'startTurn' && ms.sys.interaction?.current) {
        ms = {
            ...ms,
            sys: {
                ...ms.sys,
                phase: 'startTurn',
            },
        };
    }

    if ((ms.sys as any)._smashupStartTurnWindowActive && ms.sys.phase !== 'startTurn' && !ms.sys.interaction?.current) {
        ms = {
            ...ms,
            sys: {
                ...ms.sys,
                _smashupStartTurnWindowActive: undefined,
            } as any,
        };
    }

    return { events: finalEvents, matchState: ms };
}

// ============================================================================
// 棰嗗煙鍐呮牳瀵煎嚭
// ============================================================================

export const SmashUpDomain: DomainCore<SmashUpCore, SmashUpCommand, SmashUpEvent> = {
    gameId: 'smashup',
    setup,
    validate,
    execute,
    reduce,
    interceptEvent: domainInterceptEvent,
    postProcessSystemEvents,
    playerView,
    isGameOver,
};

export type { SmashUpCommand, SmashUpCore, SmashUpEvent } from './types';
export { SU_COMMANDS, SU_EVENTS } from './types';
export { registerAbility, resolveAbility, resolveOnPlay, resolveTalent, resolveSpecial, resolveOngoingActivation, resolveOnDestroy, clearRegistry } from './abilityRegistry';
export type { AbilityContext, AbilityResult, AbilityExecutor } from './abilityRegistry';
export {
    registerBaseAbility,
    triggerBaseAbility,
    triggerAllBaseAbilities,
    hasBaseAbility,
    clearBaseAbilityRegistry,
    registerBaseAbilities,
    triggerExtendedBaseAbility,
} from './baseAbilities';
export type { BaseTriggerTiming, BaseAbilityContext, BaseAbilityResult, BaseAbilityExecutor } from './baseAbilities';
export {
    registerPowerModifier,
    clearPowerModifierRegistry,
    getOngoingPowerModifier,
    getEffectivePower,
    getPlayerEffectivePowerOnBase,
    getTotalEffectivePowerOnBase,
} from './ongoingModifiers';
export type { PowerModifierFn, PowerModifierContext } from './ongoingModifiers';

// Export postProcessSystemEvents for tests
export { postProcessSystemEvents };
