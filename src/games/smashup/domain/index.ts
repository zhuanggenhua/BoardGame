/**
 * 澶ф潃鍥涙柟 (Smash Up) - 棰嗗煙鍐呮牳缁勮
 *
 * 鑱岃矗锛歴etup 鍒濆鍖栥€丗lowSystem 閽╁瓙銆乸layerView銆乮sGameOver
 */

import type { DomainCore, GameEvent, GameOverResult, PlayerId, RandomFn, MatchState } from '../../../engine/types';
import { processDestroyMoveCycle, processAffectTriggers, filterProtectedReturnEvents, filterProtectedDeckBottomEvents } from './reducer';
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
import { countMadnessCards, madnessVpPenalty, fireMinionPlayedTriggers } from './abilityHelpers';
import { triggerAllBaseAbilities, triggerBaseAbility, triggerExtendedBaseAbility, hasBaseAbility } from './baseAbilities';
import { collectBaseAbilityTriggers, collectExtendedBaseAbilityTriggers } from './baseAbilityQueue';
import { openMeFirstWindow, openAfterScoringWindow, buildBaseTargetOptions, isSpecialLimitBlocked } from './abilityHelpers';
import type { PhaseExitResult } from '../../../engine/systems/FlowSystem';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { RESPONSE_WINDOW_EVENTS } from '../../../engine/systems/ResponseWindowSystem';
import type { SpecialAfterScoringConsumedEvent } from './types';

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
            const result = validate(state, {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId,
                payload: { minionUid: minion.uid, baseIndex },
            });
            if (result.valid) return true;
        }
    }

    return false;
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
    const playersWithAfterScoringCards: PlayerId[] = [];
    for (const [playerId, player] of Object.entries(afterScoringCore.players)) {
        const hasAfterScoringCard = player.hand.some(c => {
            if (c.type !== 'action') return false;
            const def = getCardDef(c.defId) as ActionCardDef | undefined;
            return def?.subtype === 'special' && def.specialTiming === 'afterScoring';
        });
        if (hasAfterScoringCard) {
            playersWithAfterScoringCards.push(playerId);
        }
    }

    // 濡傛灉鏈夌帺瀹舵湁 afterScoring 鍗＄墝锛屾墦寮€ afterScoring 鍝嶅簲绐楀彛
    if (playersWithAfterScoringCards.length > 0) {
        // 銆愰噸鏂拌鍒嗚鍒欍€戣褰曞垵濮嬪姏閲忥紙鐢ㄤ簬鍝嶅簲绐楀彛鍏抽棴鍚庡姣旓級
        // 瑙勫垯锛歛fterScoring 鍗＄墝鍙互褰卞搷璇ュ熀鍦扮殑鍔涢噺锛屽鏋滃姏閲忓彉鍖栧垯闇€瑕侀噸鏂拌鍒?
        const currentBase = afterScoringCore.bases[baseIndex];
        const initialPowers = collectQualifiedPlayerPowers(afterScoringCore, currentBase, baseIndex);
        
        // 灏嗗垵濮嬪姏閲忓瓨鍌ㄥ埌 matchState.sys锛堢敤浜庡搷搴旂獥鍙ｅ叧闂悗瀵规瘮锛?
        // 娉ㄦ剰锛氫笉鑳藉瓨鍒板搷搴旂獥鍙ｇ殑 continuationContext 涓紝鍥犱负鍝嶅簲绐楀彛涓嶆槸浜や簰
        if (ms) {
            ms = {
                ...ms,
                sys: {
                    ...ms.sys,
                    afterScoringInitialPowers: {
                        baseIndex,
                        powers: Object.fromEntries(initialPowers.entries()),
                    } as any,
                },
            };
        }
        
        // 鎵撳紑 afterScoring 鍝嶅簲绐楀彛锛堝湪 BASE_CLEARED 涔嬪墠锛?
        const afterScoringWindowEvt = openAfterScoringWindow('scoreBases', pid, afterScoringCore.turnOrder, now);
        events.push(afterScoringWindowEvt);
        
        // 寤惰繜鍙戝嚭 postScoringEvents锛堢瓑鍝嶅簲绐楀彛鍏抽棴鍚庡啀鍙戯級
        // 灏?postScoringEvents 瀛樺埌鍝嶅簲绐楀彛鐨?continuationContext 涓?
        // 娉ㄦ剰锛氬搷搴旂獥鍙ｅ叧闂悗锛岄渶瑕佹鏌ュ熀鍦板姏閲忔槸鍚﹀彉鍖栵紝濡傛灉鍙樺寲鍒欓噸鏂拌鍒?
        // 杩欎釜閫昏緫闇€瑕佸湪 onPhaseExit 涓鐞?
        
        // 銆愪慨澶嶃€戜笉闇€瑕佸湪杩欓噷淇敼 newBaseDeck锛屽洜涓鸿繕娌℃湁鍙戝嚭 BASE_REPLACED 浜嬩欢
        // BASE_REPLACED 浜嬩欢浼氬湪鍝嶅簲绐楀彛鍏抽棴鍚庛€乸ostScoringEvents 涓彂鍑?
        
        return { events, newBaseDeck, matchState: ms };
    }

    // 鏋勫缓娓呴櫎+鏇挎崲浜嬩欢
    const postScoringEvents: SmashUpEvent[] = [];
    const clearEvt: BaseClearedEvent = {
        type: SU_EVENTS.BASE_CLEARED,
        payload: { baseIndex, baseDefId: base.defId },
        timestamp: now,
    };
    postScoringEvents.push(clearEvt);

    // 鏇挎崲鍩哄湴
    if (newBaseDeck.length === 0) {
        // 鍩哄湴鐗屽簱瑙佸簳锛氬皢鍩哄湴寮冪墝鍫嗘礂鍥炵墝搴擄紙骞舵妸鏈璁″垎鐨勬棫鍩哄湴涔熻鍏ュ純鐗屽爢鍚庝竴璧锋礂鍥烇級
        // 娉ㄦ剰锛氭澶勫皻鏈?reduce BASE_CLEARED锛屾墍浠?core.baseDiscard 閲屼笉鍖呭惈 base.defId锛岄渶瑕佹墜鍔ㄥ姞鍏ャ€?
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

        // 瑙﹀彂鏂板熀鍦扮殑 onBaseRevealed 鎵╁睍鏃舵満锛堝缁电緤绁炵ぞ锛氭瘡浣嶇帺瀹跺彲绉诲姩涓€涓殢浠庡埌姝わ級
        // 鏀逛负鍏ラ槦锛屽厑璁镐笌鍏朵粬鍚屾椂瑙﹀彂鍙嶅簲缁熶竴鎺掑簭锛坥ptional 鎸夐『鏃堕拡锛?
        const queuedReveal = collectExtendedBaseAbilityTriggers({
            core,
            timing: 'onBaseRevealed',
            ownerPlayerId: pid,
            baseIndex,
            now,
        });
        if (queuedReveal) {
            postScoringEvents.push(queuedReveal as unknown as SmashUpEvent);
            const coreForQueue = reduce(core, queuedReveal as unknown as SmashUpEvent);
            const msForQueue = ms ? { ...ms, core: coreForQueue } : ({ core: coreForQueue, sys: { interaction: { current: undefined, queue: [] } } } as any);
            const rq = maybeResolveReactionQueue(msForQueue, rng, now);
            if (rq) {
                postScoringEvents.push(...rq.events);
                ms = rq.state;
            } else {
                ms = msForQueue;
            }
        }
    }

    // 鍏抽敭锛氫粎褰?afterScoring 鏂板浜嗕氦浜掓椂锛堝鍒氭煍娴佸搴欏钩灞€閫夋嫨銆佸繊鑰呴亾鍦烘秷鐏殢浠庣瓑锛夛紝
    // 鎵嶅欢杩熷彂鍑?BASE_CLEARED/BASE_REPLACED锛岀‘淇?targetType: 'minion' 鐨勫満涓婄偣閫変氦浜掕兘鐪嬪埌闅忎粠銆?
    // 涓嶅奖鍝?beforeScoring/onBaseRevealed 绛夊叾浠栨潵婧愮殑浜や簰銆?
    
    if (afterScoringCreatedInteraction) {
        // 鎶?postScoringEvents 搴忓垪鍖栧瓨鍒颁氦浜掔殑 continuationContext 涓?
        // 銆愪慨澶嶃€戝鏋滄湁澶氫釜 afterScoring 浜や簰锛堝姣嶈埌 + 渚﹀療鍏碉級锛屽繀椤诲瓨鍒扮涓€涓氦浜掍腑
        // 杩欐牱绗竴涓氦浜掕В鍐虫椂浼氫紶閫掔粰涓嬩竴涓紝鏈€鍚庝竴涓В鍐虫椂鎵嶄細琛ュ彂 BASE_CLEARED
        const firstInteraction = ms!.sys.interaction!.current ?? ms!.sys.interaction!.queue[0];
        if (firstInteraction?.data) {
            const data = firstInteraction.data as Record<string, unknown>;
            const ctx = (data.continuationContext ?? {}) as Record<string, unknown>;
            ctx._deferredPostScoringEvents = postScoringEvents.map(e => ({
                type: e.type,
                payload: (e as GameEvent).payload,
                timestamp: (e as GameEvent).timestamp,
            }));
            data.continuationContext = ctx;
        }
        return { events, newBaseDeck, matchState: ms };
    }

    // 鏃?afterScoring 浜や簰锛氭甯稿彂鍑烘竻闄?鏇挎崲浜嬩欢
    events.push(...postScoringEvents);
    return { events, newBaseDeck, matchState: ms };
}

/** 娉ㄥ唽澶氬熀鍦拌鍒嗙殑浜や簰瑙ｅ喅澶勭悊鍑芥暟 */
export function registerMultiBaseScoringInteractionHandler(): void {
    registerInteractionHandler('multi_base_scoring', (state, playerId, value, _iData, random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const events: SmashUpEvent[] = [];
        let currentState = state;
        let currentBaseDeck = state.core.baseDeck;

        // 鈿狅笍 娉ㄦ剰锛氫笉闇€瑕佹竻闄?current锛屽洜涓?SimpleChoiceSystem 宸茬粡鍦?beforeCommand 涓皟鐢ㄤ簡 resolveInteraction
        // resolveInteraction 浼氬脊鍑轰笅涓€涓氦浜掞紝鎵€浠?current 宸茬粡鏄笅涓€涓氦浜掍簡锛堝鏋滄湁鐨勮瘽锛?

        // 銆愪慨澶嶃€戞彁鍙栧欢杩熺殑 BASE_CLEARED/BASE_REPLACED 浜嬩欢锛堜絾涓嶇珛鍗宠ˉ鍙戯級
        const deferredEvents = (_iData?.continuationContext as any)?._deferredPostScoringEvents as 
            { type: string; payload: unknown; timestamp: number }[] | undefined;
        
        // 1. 璁″垎鐜╁閫夋嫨鐨勫熀鍦?
        // 鈿狅笍 銆愬叧閿慨澶嶃€慴eforeScoring 浜や簰瑙ｅ喅鍚庯紝闇€瑕侀噸鏂拌皟鐢?scoreOneBase 缁х画鎵ц璁″垎閫昏緫
        // 闂锛歴coreOneBase 鍦?beforeScoring 鍒涘缓浜や簰鍚庝細绔嬪嵆杩斿洖锛屼氦浜掕В鍐冲悗涓嶄細鑷姩缁х画
        // 瑙ｅ喅鏂规锛氭鏌ユ槸鍚﹀彧瑙﹀彂浜?beforeScoring 浣嗘病鏈夊畬鎴愯鍒嗭紙娌℃湁 BASE_SCORED 浜嬩欢锛夛紝
        // 濡傛灉鏄紝鍒欓噸鏂拌皟鐢?scoreOneBase 缁х画鎵ц
        let result = scoreOneBase(currentState.core, baseIndex, currentBaseDeck, playerId, timestamp, random, currentState);
        events.push(...result.events);
        currentBaseDeck = result.newBaseDeck;
        if (result.matchState) currentState = result.matchState;
        
        // 妫€鏌ユ槸鍚﹀彧瑙﹀彂浜?beforeScoring 浣嗘病鏈夊畬鎴愯鍒?
        const hasBaseScored = result.events.some((evt: SmashUpEvent) => evt.type === SU_EVENTS.BASE_SCORED);
        const hasBeforeScoringTriggered = result.events.some((evt: SmashUpEvent) => 
            evt.type === SU_EVENT_TYPES.BEFORE_SCORING_TRIGGERED
        );
        
        
        // 濡傛灉鍙Е鍙戜簡 beforeScoring 浣嗘病鏈?BASE_SCORED锛岃鏄?beforeScoring 鍒涘缓浜嗕氦浜掑苟鎻愬墠杩斿洖
        // 浜や簰宸茬粡琚В鍐充簡锛堝洜涓烘垜浠湪 handler 涓級锛屾墍浠ラ渶瑕侀噸鏂拌皟鐢?scoreOneBase 缁х画鎵ц
        if (hasBeforeScoringTriggered && !hasBaseScored && !currentState.sys.interaction?.current) {
            
            // 鉁?鍏抽敭淇锛氬皢绗竴娆¤皟鐢ㄧ殑浜嬩欢 reduce 鍒?currentState.core
            // 闂锛歴coreOneBase 鍐呴儴浼氬皢 BEFORE_SCORING_TRIGGERED 浜嬩欢 reduce 鍒版湰鍦?core 鍓湰锛?
            // 浣?handler 浼犲叆鐨?currentState.core 娌℃湁琚洿鏂帮紝瀵艰嚧绗簩娆¤皟鐢ㄦ椂 alreadyTriggeredBeforeScoring 浠嶄负 false
            // 瑙ｅ喅鏂规锛氬湪閲嶆柊璋冪敤鍓嶏紝鍏堝皢绗竴娆＄殑浜嬩欢 reduce 鍒?currentState.core
            let updatedCore = currentState.core;
            for (const evt of events) {
                updatedCore = reduce(updatedCore, evt as SmashUpEvent);
            }
            currentState = {
                ...currentState,
                core: updatedCore,
            };
            
            // 鈿狅笍 娉ㄦ剰锛氫笉闇€瑕佹竻闄?current锛屽洜涓?SimpleChoiceSystem 宸茬粡鍦?beforeCommand 涓皟鐢ㄤ簡 resolveInteraction
            // resolveInteraction 浼氬脊鍑轰笅涓€涓氦浜掞紝鎵€浠?current 宸茬粡鏄笅涓€涓氦浜掍簡锛堝鏋滄湁鐨勮瘽锛?
            
            // 閲嶆柊璋冪敤 scoreOneBase锛坆eforeScoring 宸茬粡瑙﹀彂杩囷紝涓嶄細閲嶅瑙﹀彂锛?
            result = scoreOneBase(currentState.core, baseIndex, currentBaseDeck, playerId, timestamp, random, currentState);
            events.push(...result.events);
            currentBaseDeck = result.newBaseDeck;
            if (result.matchState) currentState = result.matchState;
        }

        if (!currentState.sys.scoredBaseIndices) {
            currentState = {
                ...currentState,
                sys: { ...currentState.sys, scoredBaseIndices: [] },
            };
        }

        // 2. 灏嗗凡浜х敓鐨勪簨浠?reduce 鍒版湰鍦?core 鍓湰锛岃幏鍙栨渶鏂扮姸鎬?
        let updatedCore = currentState.core;
        for (const evt of events) {
            updatedCore = reduce(updatedCore, evt as SmashUpEvent);
        }

        const currentBaseCompleted = events.some((evt: SmashUpEvent) =>
                evt.type === SU_EVENTS.BASE_SCORED
                && (evt.payload as { baseIndex?: number } | undefined)?.baseIndex === baseIndex
            );

        if (currentBaseCompleted && !currentState.sys.scoredBaseIndices.includes(baseIndex)) {
            currentState = {
                ...currentState,
                sys: {
                    ...currentState.sys,
                    scoredBaseIndices: [...currentState.sys.scoredBaseIndices, baseIndex],
                },
            };
        }

        // 3. 妫€鏌ュ墿浣?eligible 鍩哄湴锛堟帓闄ゅ綋鍓嶆鍦ㄥ鐞嗙殑鍩哄湴锛屽彧鎶婄湡姝ｅ畬鎴愮殑鍩哄湴瑙嗕负宸茶鍒嗭級
        const allEligibleIndices = getScoringEligibleBaseIndices(updatedCore);
        const remainingIndices = allEligibleIndices.filter(
            i => i !== baseIndex && !currentState.sys.scoredBaseIndices?.includes(i)
        );

        // 濡傛灉 beforeScoring/afterScoring 鍒涘缓浜嗕氦浜?鈫?鍏堝鐞嗕氦浜掞紝鍓╀綑鍩哄湴鍚庣画鍐嶈鍒?
        if (currentState.sys.interaction?.current) {
            // 銆愪慨澶嶃€戝鏋滆繕鏈夊墿浣欏熀鍦伴渶瑕佽鍒嗭紝鍒涘缓鏂扮殑 multi_base_scoring 浜や簰骞跺姞鍏ラ槦鍒?
            // 杩欐牱 afterScoring 浜や簰瑙ｅ喅鍚庯紝闃熷垪涓殑 multi_base_scoring 浼氳嚜鍔ㄥ脊鍑猴紝缁х画璁″垎娴佺▼
            if (remainingIndices.length >= 1) {
                const candidates = remainingIndices.map(i => {
                    const base = updatedCore.bases[i];
                    if (!base) return null;
                    const baseDef = getBaseDef(base.defId);
                    const totalPower = getTotalEffectivePowerOnBase(updatedCore, base, i);
                    return {
                        baseIndex: i,
                        label: `${baseDef?.name ?? `鍩哄湴 ${i + 1}`} (鍔涢噺 ${totalPower}/${baseDef?.breakpoint ?? '?'})`,
                    };
                }).filter(Boolean) as { baseIndex: number; label: string }[];

                if (candidates.length >= 1) {
                    const interaction = createSimpleChoice(
                        `multi_base_scoring_${timestamp}_remaining`, playerId,
                        remainingIndices.length === 1 ? '计分最后一个基地' : '选择先计分的基地',
                        buildBaseTargetOptions(candidates, updatedCore) as any[],
                        { sourceId: 'multi_base_scoring', targetType: 'base' },
                    );
                    
                    // 銆愬叧閿慨澶嶃€戜紶閫掑欢杩熶簨浠跺埌涓嬩竴涓氦浜?
                    // 濡傛灉褰撳墠浜や簰鏈夊欢杩熶簨浠讹紝闇€瑕佷紶閫掔粰鏂板垱寤虹殑 multi_base_scoring 浜や簰
                    // 杩欐牱寤惰繜浜嬩欢浼氬湪鎵€鏈夊熀鍦拌鍒嗗畬鎴愬悗缁熶竴琛ュ彂
                    if (deferredEvents && deferredEvents.length > 0) {
                        const iData = interaction.data as Record<string, unknown>;
                        const ctx = (iData.continuationContext ?? {}) as Record<string, unknown>;
                        ctx._deferredPostScoringEvents = deferredEvents;
                        iData.continuationContext = ctx;
                    }
                    
                    currentState = queueInteraction(currentState, interaction);

                    for (const idx of remainingIndices) {
                        if (!currentState.sys.scoredBaseIndices!.includes(idx)) {
                            currentState = {
                                ...currentState,
                                sys: {
                                    ...currentState.sys,
                                    scoredBaseIndices: [...currentState.sys.scoredBaseIndices!, idx],
                                },
                            };
                        }
                    }
                }
            }

            return { state: currentState, events };
        }

        // 4. 娌℃湁 afterScoring 浜や簰锛岀户缁鐞嗗墿浣欏熀鍦?
        if (remainingIndices.length >= 2) {
            // 2+ 鍓╀綑 鈫?鍒涘缓鏂扮殑澶氬熀鍦伴€夋嫨浜や簰
            const candidates = remainingIndices.map(i => {
                const base = updatedCore.bases[i];
                if (!base) return null;
                const baseDef = getBaseDef(base.defId);
                const totalPower = getTotalEffectivePowerOnBase(updatedCore, base, i);
                return {
                    baseIndex: i,
                    label: `${baseDef?.name ?? `鍩哄湴 ${i + 1}`} (鍔涢噺 ${totalPower}/${baseDef?.breakpoint ?? '?'})`,
                };
            }).filter(Boolean) as { baseIndex: number; label: string }[];

            if (candidates.length >= 2) {
                const interaction = createSimpleChoice(
                    `multi_base_scoring_${timestamp}`, playerId,
                    '閫夋嫨鍏堣鍒嗙殑鍩哄湴', buildBaseTargetOptions(candidates, updatedCore) as any[],
                    { sourceId: 'multi_base_scoring', targetType: 'base' },
                );
                currentState = queueInteraction(currentState, interaction);

                return { state: currentState, events };
            }
        }

        // 1 涓垨 0 涓墿浣?鈫?閫愪釜鐩存帴璁″垎
        for (const idx of remainingIndices) {
            const base = updatedCore.bases[idx];
            if (!base) continue;
            const r = scoreOneBase(updatedCore, idx, currentBaseDeck, playerId, timestamp, random, currentState);
            events.push(...r.events);
            currentBaseDeck = r.newBaseDeck;
            if (r.matchState) currentState = r.matchState;
            // 鍩哄湴鑳藉姏鍒涘缓浜嗕氦浜?鈫?halt锛屽墿浣欏熀鍦板悗缁鐞?
            if (currentState.sys.interaction?.current) {
                // 銆愬叧閿慨澶嶃€戝皢寤惰繜浜嬩欢浼犻€掔粰鏂板垱寤虹殑浜や簰
                // 濡傛灉 scoreOneBase 鍒涘缓浜嗕氦浜掞紙濡?beforeScoring/afterScoring锛夛紝
                // 闇€瑕佸皢寤惰繜浜嬩欢浼犻€掔粰鏂颁氦浜掞紝纭繚浜や簰瑙ｅ喅鍚庤兘琛ュ彂寤惰繜浜嬩欢
                if (deferredEvents && deferredEvents.length > 0) {
                    const newInteraction = currentState.sys.interaction.current;
                    if (newInteraction?.data) {
                        const iData = newInteraction.data as Record<string, unknown>;
                        const ctx = (iData.continuationContext ?? {}) as Record<string, unknown>;
                        // 鍚堝苟寤惰繜浜嬩欢锛堝彲鑳藉凡缁忔湁涓€浜涘欢杩熶簨浠朵簡锛?
                        const existingDeferred = (ctx._deferredPostScoringEvents ?? []) as { type: string; payload: unknown; timestamp: number }[];
                        ctx._deferredPostScoringEvents = [...existingDeferred, ...deferredEvents];
                        iData.continuationContext = ctx;
                    }
                }

                return { state: currentState, events };
            }
            // 鏇存柊鏈湴 core 鍓湰
            for (const evt of r.events) {
                updatedCore = reduce(updatedCore, evt as SmashUpEvent);
            }

            if (!currentState.sys.scoredBaseIndices) {
                currentState = {
                    ...currentState,
                    sys: { ...currentState.sys, scoredBaseIndices: [] },
                };
            }
            if (!currentState.sys.scoredBaseIndices.includes(idx)) {
                currentState = {
                    ...currentState,
                    sys: {
                        ...currentState.sys,
                        scoredBaseIndices: [...currentState.sys.scoredBaseIndices, idx],
                    },
                };
            }
        }

        // 銆愬叧閿慨澶嶃€戞墍鏈夊熀鍦拌鍒嗗畬鎴愬悗锛岃ˉ鍙戝欢杩熶簨浠?
        // 鍙湁褰?remainingIndices 涓虹┖鏃讹紙鎵€鏈夊熀鍦伴兘璁″垎瀹屼簡锛夛紝鎵嶈ˉ鍙戝欢杩熶簨浠?
        // 杩欐牱鍙互閬垮厤鍦ㄤ腑闂存楠ら噸澶嶈ˉ鍙?
        if (deferredEvents && deferredEvents.length > 0) {
            events.push(...deferredEvents as SmashUpEvent[]);
        }

        return { state: currentState, events };
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

function setup(playerIds: PlayerId[], random: RandomFn, setupData?: Record<string, unknown>): SmashUpCore {
    const nextUid = 1;

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
            factions: ['', ''],  // 鍗犱綅锛屽緟 ALL_FACTIONS_SELECTED 浜嬩欢濉厖
        };
        playerSelections[pid] = [];
    }

    // 缈诲紑 鐜╁鏁?1 寮犲熀鍦帮紙璁剧疆鏈熼棿缈诲埌 replaceOnSetup 鐨勫熀鍦版椂鏇挎崲骞堕噸娲楋級
    let shuffledBaseIds = random.shuffle(getAllBaseDefIds());
    const baseCount = playerIds.length + 1;
    const activeBases: BaseInPlay[] = [];

    while (activeBases.length < baseCount && shuffledBaseIds.length > 0) {
        const defId = shuffledBaseIds.shift()!;
        const def = getBaseDef(defId);
        if (def?.replaceOnSetup) {
            // 鏀惧洖鐗屽簱骞堕噸娲?
            shuffledBaseIds.push(defId);
            shuffledBaseIds = random.shuffle(shuffledBaseIds);
            continue;
        }
        activeBases.push({ defId, minions: [], ongoingActions: [] });
    }
    const baseDeck = shuffledBaseIds;

    // 閲嶈禌鍏堟墜杞崲锛氬弻浜虹敤 firstPlayerId 杞崲锛屽浜虹敤 turnOrder 闅忔満
    let initialTurnOrder = [...playerIds];
    if (Array.isArray(setupData?.turnOrder) && setupData.turnOrder.length === playerIds.length
        && setupData.turnOrder.every((id: unknown) => typeof id === 'string' && playerIds.includes(id as PlayerId))) {
        // 澶氫汉锛氫娇鐢ㄦ湇鍔＄闅忔満鎵撲贡鐨勯『搴?
        initialTurnOrder = setupData.turnOrder as PlayerId[];
    } else if (typeof setupData?.firstPlayerId === 'string' && playerIds.includes(setupData.firstPlayerId)) {
        // 鍙屼汉锛氬厛鎵嬬帺瀹舵帓绗竴
        const first = setupData.firstPlayerId;
        initialTurnOrder = [first, ...playerIds.filter(id => id !== first)];
    }

    return {
        players,
        turnOrder: initialTurnOrder,
        currentPlayerIndex: 0,
        bases: activeBases,
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
        }
    };
}

// ============================================================================
// FlowSystem 閽╁瓙
// ============================================================================

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
            // Me First! 鍝嶅簲瀹屾垚鍚庯紝鎵ц瀹為檯鍩哄湴璁板垎
            const events: GameEvent[] = [];

            // 銆愰噸鏂拌鍒嗚鍒欍€戞鏌ユ槸鍚﹀垰鍏抽棴浜?afterScoring 鍝嶅簲绐楀彛
            // 濡傛灉鍔涢噺鍙樺寲锛岄渶瑕侀噸鏂拌鍒嗚鍩哄湴锛堝嵆浣挎病鏈夎揪鍒颁复鐣屽€硷級
            if (state.sys.afterScoringInitialPowers) {
                const { baseIndex: scoredBaseIndex, powers: initialPowers } = state.sys.afterScoringInitialPowers as any;
                
                
                // 璁＄畻褰撳墠鍔涢噺
                const currentBase = core.bases[scoredBaseIndex];
                const currentPowers = currentBase
                    ? collectQualifiedPlayerPowers(core, currentBase, scoredBaseIndex)
                    : new Map<PlayerId, number>();
                
                // 妫€鏌ユ槸鍚︽湁鍔涢噺鍙樺寲
                let powerChanged = false;
                const comparedPlayerIds = new Set<PlayerId>([
                    ...(Object.keys(initialPowers) as PlayerId[]),
                    ...currentPowers.keys(),
                ]);
                for (const playerId of comparedPlayerIds) {
                    const hadInitialEntry = Object.prototype.hasOwnProperty.call(initialPowers, playerId);
                    const hasCurrentEntry = currentPowers.has(playerId);
                    if (hadInitialEntry !== hasCurrentEntry) {
                        powerChanged = true;
                        break;
                    }
                    const initialPower = (initialPowers as Record<string, number>)[playerId] ?? 0;
                    const currentPower = currentPowers.get(playerId) ?? 0;
                    if (currentPower !== initialPower) {
                        powerChanged = true;
                        break;
                    }
                }
                
                // 濡傛灉鍔涢噺鍙樺寲锛岄噸鏂拌鍒嗚鍩哄湴
                if (powerChanged && currentBase) {
                    const playerPowers = collectQualifiedPlayerPowers(core, currentBase, scoredBaseIndex);
                    const baseDef = getBaseDef(currentBase.defId)!;
                    const rankings = buildBaseRankings(baseDef, playerPowers);
                    
                    // 鏀堕泦姣忎綅鐜╁鐨勯殢浠庡姏閲?breakdown锛堢敤浜?ActionLog 灞曠ず锛?
                    const minionBreakdowns: Record<PlayerId, MinionPowerBreakdown[]> = {};
                    for (const m of currentBase.minions) {
                        const bd = getEffectivePowerBreakdown(core, m, scoredBaseIndex);
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
                    
                    // 鍙戝嚭鏂扮殑 BASE_SCORED 浜嬩欢锛堥噸鏂拌鍒嗙粨鏋滐級
                    const scoreEvt: BaseScoredEvent = {
                        type: SU_EVENTS.BASE_SCORED,
                        payload: { baseIndex: scoredBaseIndex, baseDefId: currentBase.defId, rankings, minionBreakdowns },
                        timestamp: now,
                    };
                    events.push(scoreEvt);
                    
                }
                
                // 鈿狅笍 鍏抽敭淇锛氭棤璁哄姏閲忔槸鍚﹀彉鍖栵紝閮介渶瑕佸彂鍑?BASE_CLEARED 鍜?BASE_REPLACED 浜嬩欢
                // 鍘熷洜锛歛fterScoring 鍝嶅簲绐楀彛鎵撳紑鏃讹紝杩欎簺浜嬩欢琚欢杩熷彂鍑?
                // 鍝嶅簲绐楀彛鍏抽棴鍚庯紝蹇呴』琛ュ彂杩欎簺浜嬩欢锛屽惁鍒欏熀鍦颁笉浼氳娓呴櫎鍜屾浛鎹?
                if (currentBase) {
                    // 鍙戝嚭 BASE_CLEARED 浜嬩欢
                    const clearEvt: BaseClearedEvent = {
                        type: SU_EVENTS.BASE_CLEARED,
                        payload: { baseIndex: scoredBaseIndex, baseDefId: currentBase.defId },
                        timestamp: now,
                    };
                    events.push(clearEvt);
                    
                    // 鏇挎崲鍩哄湴
                    const coreNow = state.core;
                    let deckForReplacement = coreNow.baseDeck;
                    if (deckForReplacement.length === 0) {
                        const pool = [...(coreNow.baseDiscard ?? []), currentBase.defId];
                        deckForReplacement = (random?.shuffle ? random.shuffle(pool) : [...pool]);
                        const shuffleEvt: BaseDeckShuffledEvent = {
                            type: SU_EVENTS.BASE_DECK_SHUFFLED,
                            payload: {
                                newBaseDeckDefIds: deckForReplacement,
                                reason: 'base_deck_empty_reshuffle_discard',
                                clearBaseDiscard: true,
                            },
                            timestamp: now,
                        };
                        events.push(shuffleEvt);
                    }

                    if (deckForReplacement.length > 0) {
                        const newBaseDefId = deckForReplacement[0];
                        const replaceEvt: BaseReplacedEvent = {
                            type: SU_EVENTS.BASE_REPLACED,
                            payload: {
                                baseIndex: scoredBaseIndex,
                                oldBaseDefId: currentBase.defId,
                                newBaseDefId,
                            },
                            timestamp: now,
                        };
                        events.push(replaceEvt);
                        
                        // 瑙﹀彂鏂板熀鍦扮殑 onBaseRevealed 鎵╁睍鏃舵満锛堝缁电緤绁炵ぞ锛氭瘡浣嶇帺瀹跺彲绉诲姩涓€涓殢浠庡埌姝わ級
                        const revealCtx = {
                            state: coreNow,
                            matchState: state,
                            baseIndex: scoredBaseIndex,
                            baseDefId: newBaseDefId,
                            playerId: pid,
                            now,
                        };
                        const revealResult = triggerExtendedBaseAbility(newBaseDefId, 'onBaseRevealed', revealCtx);
                        events.push(...revealResult.events);
                        if (revealResult.matchState) state = revealResult.matchState;
                    }
                    
                }
                
                // 鏍囪璇ュ熀鍦板凡璁板垎锛岄槻姝㈠悗缁甯歌鍒嗗惊鐜噸澶嶈鍒?
                if (!state.sys.scoredBaseIndices) {
                    state = {
                        ...state,
                        sys: { ...state.sys, scoredBaseIndices: [scoredBaseIndex] },
                    };
                } else if (!state.sys.scoredBaseIndices.includes(scoredBaseIndex)) {
                    state = {
                        ...state,
                        sys: {
                            ...state.sys,
                            scoredBaseIndices: [...state.sys.scoredBaseIndices, scoredBaseIndex],
                        },
                    };
                }
                
                // 娓呯悊鐘舵€侊紙涓嶅彲鍙樻洿鏂帮級
                state = {
                    ...state,
                    sys: {
                        ...state.sys,
                        afterScoringInitialPowers: undefined,
                    },
                };
            }

            // 浣跨敤缁熶竴鏌ヨ鍑芥暟锛堜紭鍏堥攣瀹氬垪琛紝鍥為€€瀹炴椂璁＄畻锛?
            // Wiki Phase 3 Step 4锛氫竴鏃﹀熀鍦板湪杩涘叆璁″垎闃舵鏃惰揪鍒?breakpoint锛屽繀瀹氳鍒?
            const lockedIndices = getScoringEligibleBaseIndices(core);
            // 鏋勫缓 eligible 鍩哄湴淇℃伅锛堢敤浜庡鍩哄湴閫夋嫨 UI锛?
            const eligibleBases: { baseIndex: number; defId: string; totalPower: number }[] = [];
            for (const i of lockedIndices) {
                const base = core.bases[i];
                if (!base) continue;
                const totalPower = getTotalEffectivePowerOnBase(core, base, i);
                eligibleBases.push({ baseIndex: i, defId: base.defId, totalPower });
            }

            // 鏃犲熀鍦拌揪鏍?鈫?姝ｅ父鎺ㄨ繘
            if (eligibleBases.length === 0) {
                return events;
            }

            // 銆愬叧閿畧鍗€慺lowHalted=true 琛ㄧず涓婁竴杞?onPhaseExit 杩斿洖浜?halt锛?
            // 姝ゆ椂 FlowSystem(priority=25) 鍦?SmashUpEventSystem(priority=50) 涔嬪墠鎵ц锛?
            // core 灏氭湭琚氦浜掑鐞嗗櫒鐨勮鍒嗕簨浠舵洿鏂帮紝eligible 鍒楄〃鏄繃鏃剁殑銆?
            // 蹇呴』 halt 绛夊緟 SmashUpEventSystem 澶勭悊瀹屼氦浜掕В鍐充簨浠躲€乧ore 鏇存柊鍚庯紝
            // 涓嬩竴杞?afterEvents 鍐嶉噸鏂拌繘鍏?onPhaseExit 浣跨敤鏈€鏂?core銆?
            // 
            // 淇锛氬彧鏈夋爣蹇楀瓨鍦ㄤ笖浜や簰浠嶅湪杩涜鏃舵墠 halt锛屼氦浜掑畬鎴愬悗鑷姩娓呴櫎鏍囧織
            if (state.sys.flowHalted) {
                if (state.sys.interaction.current) {
                    return { events: [], halt: true } as PhaseExitResult;
                }
                // 浜や簰宸茶В鍐筹紝娓呴櫎 flowHalted 鏍囧織锛堜笉鍙彉鏇存柊锛?
                state = {
                    ...state,
                    sys: { ...state.sys, flowHalted: false },
                };
            }

            // 銆愬叧閿慨澶嶃€戜娇鐢?sys 鐘舵€佽窡韪凡璁板垎鐨勫熀鍦帮紝闃叉 halt 鍚庨噸澶嶈鍒?
            // 鍒濆鍖栨垨鑾峰彇宸茶鍒嗗熀鍦板垪琛紙涓嶅彲鍙樻洿鏂帮級
            if (!state.sys.scoredBaseIndices) {
                state = {
                    ...state,
                    sys: { ...state.sys, scoredBaseIndices: [] },
                };
            }
            // 杩囨护鎺夊凡璁板垎鐨勫熀鍦?
            const remainingIndices = lockedIndices.filter(i => !state.sys.scoredBaseIndices!.includes(i));

            // 鎵€鏈夊熀鍦伴兘宸茶鍒?鈫?娓呯悊鐘舵€佸苟姝ｅ父鎺ㄨ繘锛堜笉鍙彉鏇存柊锛?
            if (remainingIndices.length === 0) {
                // 鍒涘缓鏂?state 娓呯悊 scoredBaseIndices
                const cleanedState: MatchState<SmashUpCore> = {
                    ...state,
                    sys: { ...state.sys, scoredBaseIndices: [] },
                };
                // 杩斿洖娓呯悊鍚庣殑 state锛堥€氳繃 updatedState 浼犳挱锛?
                return { events, updatedState: cleanedState } as PhaseExitResult;
            }

            // 1 涓熀鍦拌揪鏍?鈫?妫€鏌ュ綋鍓嶄氦浜掓垨闃熷垪涓槸鍚﹀凡鏈?multi_base_scoring 浜や簰
            const currentIsMultiBaseScoring = 
                (state.sys.interaction.current?.data as any)?.sourceId === 'multi_base_scoring';
            const hasMultiBaseScoringInQueue = state.sys.interaction.queue.some(
                (i: any) => (i.data as any)?.sourceId === 'multi_base_scoring'
            );
            // Property 14: 2+ 鍩哄湴杈炬爣 鈫?閫氳繃 InteractionSystem(simple-choice) 璁╁綋鍓嶇帺瀹堕€夋嫨璁″垎椤哄簭
            if (remainingIndices.length >= 2 && !currentIsMultiBaseScoring && !hasMultiBaseScoringInQueue) {
                const candidates = remainingIndices.map(i => {
                    const base = core.bases[i];
                    const totalPower = getTotalEffectivePowerOnBase(core, base, i);
                    const baseDef = getBaseDef(base.defId);
                    return {
                        baseIndex: i,
                        label: `${baseDef?.name ?? `鍩哄湴 ${i + 1}`} (鍔涢噺 ${totalPower}/${baseDef?.breakpoint ?? '?'})`,
                    };
                });

                const interaction = createSimpleChoice(
                    `multi_base_scoring_${now}`, pid,
                    '閫夋嫨鍏堣鍒嗙殑鍩哄湴', buildBaseTargetOptions(candidates, core) as any[],
                    { sourceId: 'multi_base_scoring', targetType: 'base' },
                );
                const updatedState = queueInteraction(state, interaction);

                // halt=true锛氫笉鍒囨崲闃舵锛岀瓑寰呬氦浜掕В鍐冲悗鍐嶇户缁?
                return { events: [], halt: true, updatedState } as PhaseExitResult;
            }

            // 1 涓熀鍦拌揪鏍?鈫?妫€鏌ュ綋鍓嶄氦浜掓垨闃熷垪涓槸鍚﹀凡鏈?multi_base_scoring 浜や簰
            // 濡傛灉鏈夛紝璇存槑涔嬪墠宸茬粡鍒涘缓浜嗕氦浜掞紝涓嶅簲璇ラ噸澶嶈鍒?
            // 浣跨敤 remainingIndices锛堝凡杩囨护宸茶鍒嗗熀鍦帮級锛屾寜椤哄簭閫愪釜璁″垎
            if (currentIsMultiBaseScoring || hasMultiBaseScoringInQueue) {
                // 褰撳墠浜や簰鎴栭槦鍒椾腑宸叉湁 multi_base_scoring 浜や簰锛屼笉閲嶅璁″垎
                // halt=true锛氱瓑寰呬氦浜掕В鍐?
                return { events: [], halt: true } as PhaseExitResult;
            }
            
            let currentBaseDeck = core.baseDeck;
            let currentMatchState: MatchState<SmashUpCore> = state;
            let currentCore = core;  // 鉁?淇锛氱淮鎶や竴涓湰鍦?core 鍓湰锛屾瘡娆¤鍒嗗悗鏇存柊

            const maxIterations = remainingIndices.length;
            for (let iter = 0; iter < maxIterations; iter++) {
                if (iter >= remainingIndices.length) break;
                const foundIndex = remainingIndices[iter];

                const result = scoreOneBase(currentCore, foundIndex, currentBaseDeck, pid, now, random, currentMatchState);
                
                // 鈿狅笍 銆愬叧閿慨澶嶃€戠珛鍗虫鏌ユ槸鍚︽墦寮€浜嗗搷搴旂獥鍙ｏ紝濡傛灉鎵撳紑浜嗗氨绔嬪嵆 halt
                // 闂锛氫箣鍓嶇殑浠ｇ爜鍏?push 鎵€鏈変簨浠讹紝鍐嶆鏌ュ搷搴旂獥鍙ｏ紝瀵艰嚧澶氫釜鍩哄湴鍚屾椂璁″垎鏃讹紝
                // 绗竴涓熀鍦版墦寮€鍝嶅簲绐楀彛鍚庯紝寰幆缁х画璁″垎绗簩涓熀鍦帮紝绗簩涓熀鍦扮殑 BASE_CLEARED 琚彂閫?
                // 淇锛氬湪 push 浜嬩欢涔嬪墠鍏堟鏌ュ搷搴旂獥鍙ｏ紝濡傛灉鎵撳紑浜嗗氨绔嬪嵆 halt锛屼笉 push 浜嬩欢锛屼笉缁х画寰幆
                const hasResponseWindowOpened = result.events.some(
                    (evt: SmashUpEvent) => evt.type === 'RESPONSE_WINDOW_OPENED'
                );
                if (hasResponseWindowOpened) {
                    // 鈿狅笍 鍏抽敭锛氬繀椤讳繚鐣?scoreOneBase 鍦ㄦ墦寮€鍝嶅簲绐楀彛鍓嶅凡缁忕敓鎴愮殑浜嬩欢锛?
                    // 鍖呮嫭 BASE_SCORED / BEFORE_SCORING_TRIGGERED / AFTER_SCORING_TRIGGERED銆?
                    // 鍝嶅簲绐楀彛鍏抽棴鍚庡彧琛ュ彂 BASE_CLEARED / BASE_REPLACED锛屽苟鍦ㄥ姏閲忓彉鍖栨椂杩藉姞鏂扮殑 BASE_SCORED锛?
                    // 涓嶈兘鎶婇娆¤鍒嗙粨鏋滄暣浣撲涪鎺夛紝鍚﹀垯 reducer銆丄ctionLog銆佺壒鏁堝拰瑙﹀彂鏍囪閮戒細寤跺悗鎴栭噸澶嶃€?
                    
                    // 銆愬叧閿慨澶嶃€戞爣璁拌鍩哄湴宸茶鍒嗭紝閬垮厤鍝嶅簲绐楀彛鍏抽棴鍚庨噸澶嶈鍒?
                    if (!currentMatchState.sys.scoredBaseIndices) {
                        currentMatchState = {
                            ...currentMatchState,
                            sys: { ...currentMatchState.sys, scoredBaseIndices: [] },
                        };
                    }
                    currentMatchState = {
                        ...currentMatchState,
                        sys: {
                            ...currentMatchState.sys,
                            scoredBaseIndices: [...(currentMatchState.sys.scoredBaseIndices || []), foundIndex],
                        },
                    };
                    
                    const baseState = result.matchState ?? currentMatchState;
                    const haltedState: MatchState<SmashUpCore> = {
                        ...baseState,
                        sys: {
                            ...baseState.sys,
                            scoredBaseIndices: [...(currentMatchState.sys.scoredBaseIndices || [])],
                        },
                    };

                    return {
                        events: [...events, ...result.events],
                        halt: true,
                        updatedState: haltedState,
                    } as PhaseExitResult;
                }
                
                // 娌℃湁鎵撳紑鍝嶅簲绐楀彛锛屾甯?push 浜嬩欢
                events.push(...result.events);
                currentBaseDeck = result.newBaseDeck;
                // 涓嶅彲鍙樹紶鎾?matchState锛坅fterScoring 鍩哄湴鑳藉姏鍙兘鍒涘缓 Interaction锛?
                if (result.matchState) {
                    currentMatchState = result.matchState;
                }

                // 鉁?淇锛氬皢鏈璁″垎鐨勪簨浠?reduce 鍒?currentCore锛岀‘淇濅笅娆¤鍒嗕娇鐢ㄦ渶鏂扮姸鎬?
                for (const evt of result.events) {
                    currentCore = reduce(currentCore, evt as SmashUpEvent);
                }

                // beforeScoring 鍒涘缓浜嗕氦浜掞紙濡傛捣鐩楃帇绉诲姩纭锛夆啋 halt 绛変氦浜掕В鍐冲悗閲嶆柊璁″垎
                if (currentMatchState.sys.interaction?.current) {
                    return { events, halt: true, updatedState: currentMatchState } as PhaseExitResult;
                }

                const openedAfterScoringWindow = result.events.some((evt) =>
                    evt.type === RESPONSE_WINDOW_EVENTS.OPENED
                    && (evt.payload as { windowType?: string } | undefined)?.windowType === 'afterScoring',
                );
                if (openedAfterScoringWindow) {
                    return { events, halt: true, updatedState: currentMatchState } as PhaseExitResult;
                }

                // 鏍囪璇ュ熀鍦板凡璁板垎锛堜笉鍙彉鏇存柊锛?
                // 鈿狅笍 鍙湁鍦?scoreOneBase 鎴愬姛瀹屾垚锛堟病鏈夋墦寮€鍝嶅簲绐楀彛锛夊悗锛屾墠鏍囪涓?宸茶鍒?
                if (!currentMatchState.sys.scoredBaseIndices) {
                    currentMatchState = {
                        ...currentMatchState,
                        sys: { ...currentMatchState.sys, scoredBaseIndices: [] },
                    };
                }
                // 銆愬叧閿€戜笉鍙彉鏇存柊锛氬垱寤烘柊鏁扮粍鑰屼笉鏄洿鎺?push
                currentMatchState = {
                    ...currentMatchState,
                    sys: {
                        ...currentMatchState.sys,
                        scoredBaseIndices: [...(currentMatchState.sys.scoredBaseIndices || []), foundIndex],
                    },
                };
            }

            // 濡傛灉鍩哄湴鑳藉姏鍒涘缓浜?Interaction锛堝鎵樺皵鍥惧姞 afterScoring锛夛紝
            // 闇€瑕?halt 绛夊緟鐜╁鍝嶅簲锛屼笉鑳界洿鎺ユ帹杩涘埌涓嬩竴闃舵
            if (currentMatchState.sys.interaction?.current) {
                return { events, halt: true, updatedState: currentMatchState } as PhaseExitResult;
            }

            // 鎵€鏈夊熀鍦拌鍒嗗畬鎴愶紝娓呯悊鐘舵€侊紙涓嶅彲鍙樻洿鏂帮級
            currentMatchState = {
                ...currentMatchState,
                sys: { ...currentMatchState.sys, scoredBaseIndices: [] },
            };

            // 娓呯┖ beforeScoring 鍜?afterScoring 瑙﹀彂鏍囪锛堣鍒嗛樁娈电粨鏉燂級
            events.push({
                type: SU_EVENT_TYPES.BEFORE_SCORING_CLEARED,
                payload: {},
                timestamp: now,
            } as unknown as SmashUpEvent);
            events.push({
                type: SU_EVENT_TYPES.AFTER_SCORING_CLEARED,
                payload: {},
                timestamp: now,
            } as unknown as SmashUpEvent);

            // 杩斿洖鏇存柊鍚庣殑 matchState锛堝寘鍚竻鐞嗗悗鐨?scoredBaseIndices锛?
            return { events, updatedState: currentMatchState } as PhaseExitResult;

            return events;
        }

        return [];
    },

    onPhaseEnter({ state, from, to, random, command }): GameEvent[] | PhaseEnterResult {
        const core = state.core;
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
            const baseResult = triggerAllBaseAbilities('onTurnStart', startTurnCore, nextPlayerId, now, undefined, currentMatchState);
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
                    { sourceId: 'bury_uncover_start_turn', targetType: 'generic' },
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
            // 娓呯悊涓婁竴杞殑瑙﹀彂鏍囪锛堥槻姝㈠紓甯搁€€鍑哄鑷存爣璁版畫鐣欙級
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

            // 妫€鏌ユ槸鍚︽湁鍩哄湴杈惧埌涓寸晫鐐癸紝娌℃湁鍒欒烦杩?Me First! 鍝嶅簲绐楀彛
            const eligibleIndices = getScoringEligibleBaseIndices(core);

            if (eligibleIndices.length > 0) {
                // 閿佸畾 eligible 鍩哄湴鍒楄〃鍒?core 鐘舵€?
                // 瑙勫垯锛氫竴鏃﹀熀鍦板湪杩涘叆璁″垎闃舵鏃惰揪鍒?breakpoint锛屽嵆浣?Me First! 鍝嶅簲绐楀彛涓?
                // 鍔涢噺琚檷浣庡埌 breakpoint 浠ヤ笅锛岃鍩哄湴浠嶇劧蹇呭畾璁″垎锛圵iki Phase 3 Step 4锛?
                events.push({
                    type: SU_EVENTS.SCORING_ELIGIBLE_BASES_LOCKED,
                    payload: { baseIndices: eligibleIndices },
                    timestamp: now,
                } as GameEvent);
                // 鎵撳紑 Me First! 鍝嶅簲绐楀彛锛岀瓑寰呮墍鏈夌帺瀹跺搷搴?
                // 瀹為檯璁板垎鍦?onPhaseExit('scoreBases') 涓墽琛?
                const meFirstEvt = openMeFirstWindow('scoreBases', pid, core.turnOrder, now);
                events.push(meFirstEvt);
            }
            // 鏃犲熀鍦拌揪鏍囨椂涓嶆墦寮€绐楀彛锛宱nAutoContinueCheck 浼氳嚜鍔ㄦ帹杩涘埌 draw
            return events;
        }

        if (to === 'draw') {
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

        return events;
    },

    onAutoContinueCheck({ state }): { autoContinue: boolean; playerId: PlayerId } | void {
        const core = state.core;
        const pid = getCurrentPlayerId(core);
        const phase = state.sys.phase as GamePhase;

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
            console.log('[onAutoContinueCheck] scoreBases 闃舵妫€鏌?', {
                flowHalted: state.sys.flowHalted,
                hasInteraction: !!state.sys.interaction.current,
                interactionId: state.sys.interaction.current?.id,
                hasResponseWindow: !!state.sys.responseWindow?.current,
            });

            // 鍏抽敭瀹堝崼锛氬彧瑕佸搷搴旂獥鍙ｄ粛鐒舵墦寮€锛屽氨蹇呴』缁х画鍋滃湪 scoreBases 绛夊緟鐜╁鍝嶅簲銆?
            // 涓嶈兘鍏堢湅 eligibleIndices锛屽洜涓?afterScoring 绐楀彛鎵撳紑鍚庡熀鍦板彲鑳藉凡缁忚娓呴櫎/鏇挎崲锛?
            // 姝ゆ椂 eligibleIndices 浼氬彉鎴愮┖鏁扮粍锛涘鏋滃厛鎸夆€滄棤 eligible 鍩哄湴鈥濊嚜鍔ㄦ帹杩涳紝
            // 灏变細閿欒鍦板甫鐫€浠嶇劧鎵撳紑鐨?afterScoring 绐楀彛涓€璺帹杩涘埌鍚庣画闃舵銆?
            if (state.sys.responseWindow?.current) {
                console.log('[onAutoContinueCheck] scoreBases: 响应窗口仍打开，等待响应');
                return undefined;
            }

            // 鏈€鍚庝竴涓?afterScoring 浜や簰鍒氳ˉ鍙戞竻鍦?鎹㈠熀鍦颁簨浠舵椂锛?
            // 杩欎簺浜嬩欢瑕佺瓑鏈疆 afterEvents 缁撴潫鍚庢墠浼氳 reduce 鍒?core銆?
            // 杩欓噷蹇呴』鍏堝仠涓€杞紝閬垮厤 FlowSystem 鐢ㄦ棫 core 閲嶆柊杩涘叆 scoreBases锛屽鑷撮噸澶嶈鍒嗐€?
            if ((state.sys as any)._waitForPostScoringReduce) {
                console.log('[onAutoContinueCheck] scoreBases: 绛夊緟寤惰繜鐨勮鍒嗗悗浜嬩欢 reduce 鍒?core');
                return undefined;
            }
            
            // 鎯呭喌1锛歠lowHalted=true 涓斾氦浜掑凡瑙ｅ喅涓斿搷搴旂獥鍙ｅ凡鍏抽棴 鈫?鑷姩鎺ㄨ繘
            if (state.sys.flowHalted && !state.sys.interaction.current && !state.sys.responseWindow?.current) {
                // 銆愬叧閿慨澶嶃€戝鏋滄鍦ㄦ墽琛?multi_base_scoring handler锛屼笉瑕佽嚜鍔ㄦ帹杩?
                // 闂锛歨andler 鎵ц鏈熼棿锛宱nAutoContinueCheck 浼氭娴嬪埌浜や簰宸茶В鍐筹紝
                // 鐒跺悗瑙﹀彂 ADVANCE_PHASE锛屽鑷撮噸鏂拌繘鍏?onPhaseExit锛屽張鍒涘缓鏂扮殑浜や簰
                // 瑙ｅ喅鏂规锛氭鏌ユ爣蹇楋紝濡傛灉 handler 姝ｅ湪鎵ц锛屼笉瑕佹帹杩?
                
                // 銆愪慨澶嶃€戝鏋滃瓨鍦?afterScoringInitialPowers锛岃鏄庨渶瑕侀噸鏂拌鍒?
                // 杩斿洖 autoContinue: true锛岃Е鍙?ADVANCE_PHASE锛岃繖浼氬啀娆¤皟鐢?onPhaseExit
                // onPhaseExit 寮€澶寸殑閲嶆柊璁″垎閫昏緫浼氭墽琛岋紝鐒跺悗鎺ㄨ繘鍒?draw 闃舵
                if ((state.sys as any).afterScoringInitialPowers) {
                    console.log('[onAutoContinueCheck] scoreBases: 检测到 afterScoringInitialPowers，自动推进触发重新计分');
                    return { autoContinue: true, playerId: pid };
                }
                
                console.log('[onAutoContinueCheck] scoreBases: flowHalted=true 且交互已解决且响应窗口已关闭，自动推进');
                return { autoContinue: true, playerId: pid };
            }
            
            // 鎯呭喌2锛氭病鏈?eligible 鍩哄湴 鈫?鑷姩鎺ㄨ繘
            const eligibleIndices = getScoringEligibleBaseIndices(core);
            console.log('[onAutoContinueCheck] scoreBases: eligibleIndices =', eligibleIndices);
            if (eligibleIndices.length === 0) {
                console.log('[onAutoContinueCheck] scoreBases: 无 eligible 基地，自动推进');
                return { autoContinue: true, playerId: pid };
            }

            if (hasPendingScoreBasesSpecialActivation(state)) {
                console.log('[onAutoContinueCheck] scoreBases: 当前玩家还有可激活的 special，暂停自动推进');
                return undefined;
            }

            console.log('[onAutoContinueCheck] scoreBases: 鍝嶅簲绐楀彛宸插叧闂紝鑷姩鎺ㄨ繘瑙﹀彂璁″垎');
            return { autoContinue: true, playerId: pid };
        }

        // draw 闃舵锛氭墜鐗屼笉瓒呴檺鍒欒嚜鍔ㄦ帹杩涘埌 endTurn
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
        const madnessA = countMadnessCards(state.players[sorted[0]]);
        const madnessB = countMadnessCards(state.players[sorted[1]]);
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
            vp -= madnessVpPenalty(countMadnessCards(player));
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

    // 渚濇鎵ц淇濇姢杩囨护 + trigger 鍚庡鐞嗭紙閾惧紡浼犻€?matchState锛?
    // destroy 鈫?move 寰幆鐩村埌绋冲畾锛坢ove 瑙﹀彂鍣ㄥ彲鑳戒骇鐢熸柊鐨?MINION_DESTROYED锛?
    const afterDestroyMove = processDestroyMoveCycle(events, ms, pid, random, now);
    if (afterDestroyMove.matchState) ms = afterDestroyMove.matchState;
    // 杩斿洖鎵嬬墝/鏀剧墝搴撳簳淇濇姢杩囨护锛堜笌 execute() 鍚庡鐞嗗榻愶級
    const afterReturn = filterProtectedReturnEvents(afterDestroyMove.events, ms.core, pid);
    const afterDeckBottom = filterProtectedDeckBottomEvents(afterReturn, ms.core, pid);
    const afterAffect = processAffectTriggers(afterDeckBottom, ms, pid, random, now);
    if (afterAffect.matchState) ms = afterAffect.matchState;

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
    
    // 銆愪慨澶嶃€戞竻鐞嗚繑鍥炴墜鐗岀殑闅忎粠鐨勫幓閲嶆爣璁?
    // 褰撻殢浠庤繑鍥炴墜鐗屽悗鍐嶆鎵撳嚭鏃讹紝搴旇閲嶆柊瑙﹀彂 onPlay 鑳藉姏
    for (const event of afterAffect.events) {
        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const returnedEvt = event as { type: string; payload: { minionUid: string; fromBaseIndex: number } };
            const eventKey = `MINION:${returnedEvt.payload.minionUid}@${returnedEvt.payload.fromBaseIndex}`;
            processedSet.delete(eventKey);
        }
    }
    
    for (const event of afterAffect.events) {
        if (event.type === SU_EVENTS.MINION_PLAYED) {
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
        const afterDerivedReturn = filterProtectedReturnEvents(afterDerivedDestroyMove.events, ms.core, pid);
        const afterDerivedDeckBottom = filterProtectedDeckBottomEvents(afterDerivedReturn, ms.core, pid);
        const afterDerivedAffect = processAffectTriggers(afterDerivedDeckBottom, ms, pid, random, now);
        if (afterDerivedAffect.matchState) ms = afterDerivedAffect.matchState;
        finalDerived = afterDerivedAffect.events;
    }

    let combined = [...afterAffect.events, ...finalDerived];

    const startTurnWindowActive = ms.sys.phase === 'startTurn' || Boolean((ms.sys as any)._smashupStartTurnWindowActive);
    if (!options?.skipImmediateStartTurnMinionTriggers && startTurnWindowActive) {
        const immediate = processImmediateStartTurnMinionTriggers(
            state,
            combined,
            pid,
            random,
            ms,
        );
        combined = immediate.events;
        if (immediate.matchState) {
            ms = immediate.matchState;
        }
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

    // === Global reaction queue resolution (Wiki simultaneous ordering) ===
    // Important: TRIGGER_QUEUED/CONSUMED are domain events; they are not reduced into ms.core yet at this stage.
    // We must apply them to a temporary core view so the resolver can see the pending queue immediately.
    let coreForQueue = ms.core;
    for (const e of combined) {
        if (e.type === SU_EVENTS.TRIGGER_QUEUED || e.type === SU_EVENTS.TRIGGER_CONSUMED) {
            coreForQueue = reduce(coreForQueue, e);
        }
    }
    const msForQueue = coreForQueue === ms.core ? ms : { ...ms, core: coreForQueue };

    const rq = maybeResolveReactionQueue(msForQueue, random, now);
    if (rq) {
        return { events: [...combined, ...rq.events], matchState: rq.state };
    }

    return { events: combined, matchState: ms };
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
export { registerAbility, resolveAbility, resolveOnPlay, resolveTalent, resolveSpecial, resolveOnDestroy, clearRegistry } from './abilityRegistry';
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
