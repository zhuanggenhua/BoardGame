/**
 * 大杀四方 - 海盗派系能力
 *
 * 主题：移动随从、消灭低力量随从
 */

import { registerAbility, registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { addTempPower, getMinionPower, buildMinionTargetOptions, buildBaseTargetOptions, applySemanticMinionEffectBatch, buildAbilityFeedback, findMinionOnBases, buildPlayerTargetOptions, buildActionMinionTargetOptions, buildValidatedDestroyEvents, buildValidatedMoveEvents } from '../domain/abilityHelpers';
import type { SmashUpEvent, MinionCardDef, SmashUpCore } from '../domain/types';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import { getCardDef, getBaseDef } from '../data/cards';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { FACTION_DISPLAY_NAMES } from '../domain/ids';
import { getOpponentLabel, resolveLiveBaseIndex } from '../domain/utils';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';

type PiratePromptContext = {
    matchState: AbilityContext['matchState'];
    playerId: string;
    now: number;
};

type PirateBroadsidePlayerPromptContext = PiratePromptContext & {
    baseIndex: number;
};

type PirateCannonSecondPromptContext = PiratePromptContext & {
    firstTargetUid: string;
};

type PirateMoveBasePromptContext = PiratePromptContext & {
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
};

type PirateSeaDogsFromPromptContext = PiratePromptContext & {
    factionId: string;
};

type PirateSeaDogsToPromptContext = PirateSeaDogsFromPromptContext & {
    fromBase: number;
};

type PirateDinghySecondPromptContext = PiratePromptContext & {
    firstMovedUid: string;
};

type PirateFullSailChooseMinionPromptContext = PiratePromptContext & {
    movedUids: string[];
};

type PirateFullSailChooseBasePromptContext = PiratePromptContext & {
    movedUids: string[];
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
};

type PirateBuccaneerMovePromptContext = PiratePromptContext & {
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
    ownerId?: string;
    controllerId?: string;
};

type PirateKingMoveEntry = {
    uid: string;
    defId: string;
    fromBaseIndex: number;
    controller: string;
};

type PirateKingMovePromptContext = PiratePromptContext & {
    scoringBaseIndex: number;
    current: PirateKingMoveEntry;
    remaining: PirateKingMoveEntry[];
};

type PirateFirstMateChooseBasePromptContext = PiratePromptContext & {
    mateUid: string;
    mateDefId: string;
    mateBaseIndex?: number;
    scoringBaseIndex: number;
    ownerId?: string;
    controllerId?: string;
};

function createPiratePromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: AbilityContext['matchState'],
    playerId: string,
    now: number,
    extra?: TExtra,
): PiratePromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

/** 注册海盗派系所有能力*/
export function registerPirateAbilities(): void {
    registerAbilityProgram('pirate_saucy_wench', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(pirateSaucyWench) });
    registerAbilityProgram('pirate_broadside', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(pirateBroadside) });
    registerAbilityProgram('pirate_cannon', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(pirateCannon) });
    registerAbility('pirate_swashbuckling', 'onPlay', pirateSwashbuckling);
    // 炸药桶：消灭己方随从，然后消灭同基地所有力量≤被消灭随从的随从
    registerAbilityProgram('pirate_powderkeg', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(piratePowderkeg) });
    // 小艇（行动卡）：移动至多两个己方随从到其他基地
    registerAbilityProgram('pirate_dinghy', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(pirateDinghy) });
    // 全速航行（普通行动卡 + beforeScoring 响应窗口）：移动己方任意数量随从到其他基地
    registerAbility('pirate_full_sail', 'onPlay', pirateFullSail);
    registerAbility('pirate_full_sail', 'special', pirateFullSail);
    // 上海（行动卡）：移动一个对手随从到另一个基地
    registerAbilityProgram('pirate_shanghai', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(pirateShanghai) });
    // 海狗（行动卡）：移动一个随从到另一个基地
    registerAbilityProgram('pirate_sea_dogs', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(pirateSeaDogs) });

    // === ongoing 效果注册 ===
    // 海盗王：基地计分前可发动，移动到即将计分的基地
    registerTrigger('pirate_king', 'beforeScoring', pirateKingBeforeScoring, {
        playerContext: 'sourceController',
        canTrigger: canTriggerPirateKingBeforeScoring,
    });
    // 副官：基地计分后移动到其他基地（而非弃牌堆）
    registerTrigger('pirate_first_mate', 'afterScoring', pirateFirstMateAfterScoring, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    // 海盗（海盗）：被消灭时移动到其他基地而非进入弃牌堆
    registerTrigger('pirate_buccaneer', 'onMinionDestroyed', buccaneerOnDestroyed, {
        phase: 'replacement',
    });
}

function canTriggerPirateKingBeforeScoring(ctx: TriggerContext): boolean {
    return ctx.baseIndex !== undefined
        && ctx.sourceBaseIndex !== undefined
        && ctx.sourceBaseIndex !== ctx.baseIndex;
}

/** 粗鲁少妇 onPlay：消灭本基地一个力量≤2的随从*/
function pirateSaucyWench(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.minions.filter(
        m => m.uid !== ctx.cardUid && getMinionPower(ctx.state, m, ctx.baseIndex) <= 2
    );
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(
        pirateSaucyWenchPromptProgram,
        createPiratePromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            baseIndex: ctx.baseIndex,
            sourceCardUid: ctx.cardUid,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function collectPirateBroadsideTargetPlayers(
    state: SmashUpCore,
    playerId: string,
    baseIndex: number,
): Array<{ targetPlayerId: string; count: number; label: string }> {
    const base = state.bases[baseIndex];
    if (!base) return [];
    if (!base.minions.some(m => m.controller === playerId)) return [];

    const playerCounts = new Map<string, number>();
    for (const minion of base.minions) {
        if (getMinionPower(state, minion, baseIndex) <= 2) {
            playerCounts.set(minion.controller, (playerCounts.get(minion.controller) || 0) + 1);
        }
    }

    return Array.from(playerCounts.entries()).map(([targetPlayerId, count]) => ({
        targetPlayerId,
        count,
        label: `${targetPlayerId === playerId ? '你自己' : getOpponentLabel(targetPlayerId)}（${count}个弱随从）`,
    }));
}

/** 侧翼开炮 onPlay：先选一个你有随从的基地，再选该基地上的一个玩家，消灭其所有力量≤2的随从 */
function pirateBroadside(ctx: AbilityContext): AbilityResult {
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const playerCandidates = collectPirateBroadsideTargetPlayers(ctx.state, ctx.playerId, i);
        if (playerCandidates.length === 0) continue;

        const baseDef = getBaseDef(ctx.state.bases[i].defId);
        candidates.push({
            baseIndex: i,
            label: baseDef?.name ?? `基地 ${i + 1}`,
        });
    }

    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(
        pirateBroadsideChooseBasePromptProgram,
        createPiratePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

/** 加农炮 onPlay：消灭至多两个力量≤2的随从（点击式交互）*/
function pirateCannon(ctx: AbilityContext): AbilityResult {
    // 收集所有力量≤2的随从
    const allTargets: { uid: string; defId: string; baseIndex: number; owner: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (getMinionPower(ctx.state, m, i) <= 2) {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const baseDef = getBaseDef(ctx.state.bases[i].defId);
                const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                const power = getMinionPower(ctx.state, m, i);
                allTargets.push({ uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, label: `${name} (力量 ${power}) @ ${baseName}` });
            }
        }
    }
    if (allTargets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(
        pirateCannonChooseFirstPromptProgram,
        createPiratePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

/** 虚张声势 onPlay：你的每个随从+1力量直到回合结束 */
function pirateSwashbuckling(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            if (m.controller === ctx.playerId) {
                events.push(addTempPower(m.uid, i, 1, 'pirate_swashbuckling', ctx.now));
            }
        }
    }

    return { events };
}

/** 全速航行 onPlay：移动己方任意数量随从到其他基地 */
function pirateFullSail(ctx: AbilityContext): AbilityResult {
    const interaction = buildFullSailChooseMinionInteraction(ctx.state, ctx.playerId, ctx.now, []);
    if (!interaction) return { events: [] };
    const result = executeAbilityProgram(
        pirateFullSailChooseMinionPromptProgram,
        createPiratePromptContext(ctx.matchState, ctx.playerId, ctx.now, { movedUids: [] }),
    );
    return { events: result.events, matchState: result.matchState };
}

/** 构建 full_sail "选择随从" Interaction，movedUids 为已移动的随从 uid 列表 */
function buildFullSailChooseMinionInteraction(
    state: SmashUpCore,
    playerId: string,
    now: number,
    movedUids: string[],
): InteractionDescriptor | null {
    const myMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        for (const m of state.bases[i].minions) {
            if (m.controller === playerId && !movedUids.includes(m.uid)) {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const baseDef = getBaseDef(state.bases[i].defId);
                const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                const power = getMinionPower(state, m, i);
                myMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseName}` });
            }
        }
    }
    if (myMinions.length === 0) return null;
    const options = [
        ...buildMinionTargetOptions(myMinions, { state: state, sourcePlayerId: playerId }),
        { id: 'done', label: '完成移动', labelKey: 'ui.pirate_full_sail_done_option', value: { done: true }, displayMode: 'button' as const },
    ];
    const interaction = createSimpleChoice(
        `pirate_full_sail_minion_${now}`, playerId,
        '选择要移动的己方随从（或完成）',
        options as any[],
        { sourceId: 'pirate_full_sail_choose_minion', targetType: 'minion', titleKey: 'ui.pirate_full_sail_choose_minion_title' },
    );
    return { ...interaction, data: { ...interaction.data, continuationContext: { movedUids } } };
}

// Full Sail 是 special 行动卡，通过 Me First! 响应窗口在基地计分前打出
// onPlay 时机在 Me First! 窗口期间同样生效（commands.ts 允许 special 卡在响应窗口打出）

// ============================================================================
// 事件拦截器（替代效果）→ 已迁移为 onMinionDestroyed trigger
// ============================================================================

/**
 * 海盗 (Buccaneer) 替代效果：被消灭时移动到其他基地
 *
 * 通过 onMinionDestroyed trigger + pendingSaveMinionUids 机制实现：
 * 创建玩家选择交互让玩家选目标基地，暂缓消灭事件等待交互解决
 */
function buccaneerOnDestroyed(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    const { state, triggerMinionUid, triggerMinionDefId, baseIndex } = ctx;
    if (!triggerMinionUid || baseIndex === undefined) return [];

    // 支持基础版和小包版
    const isOriginal = triggerMinionDefId === 'pirate_buccaneer';
    const isPod = triggerMinionDefId === 'pirate_buccaneer_pod';
    if (!isOriginal && !isPod) return [];

    // POD 版限制：每个随从每回合只能触发一次移动（替代消灭）
    if (isPod && ctx.state.buccaneerPodUsedUids?.includes(triggerMinionUid)) {
        return [];
    }

    // 收集可用的其他基地
    const candidates: { baseIndex: number; label: string; baseDefId: string }[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        if (i === baseIndex) continue;
        const baseDef = getBaseDef(state.bases[i].defId);
        candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}`, baseDefId: state.bases[i].defId });
    }
    // 无其他基地可移→正常消灭
    if (candidates.length === 0) return [];
    const minion = state.bases[baseIndex]?.minions.find(m => m.uid === triggerMinionUid);
    const ownerId = minion?.owner ?? ctx.triggerMinion?.owner ?? ctx.playerId;
    const controllerId = minion?.controller ?? ctx.triggerMinion?.controller ?? ctx.playerId;

    // 只有一个基地时自动移动（无需交互）
    if (candidates.length === 1) {
        const reason = isPod ? 'pirate_buccaneer_pod' : 'pirate_buccaneer';
        return buildValidatedMoveEvents(state, {
            minionUid: triggerMinionUid,
            minionDefId: triggerMinionDefId,
            fromBaseIndex: baseIndex,
            toBaseIndex: candidates[0].baseIndex,
            reason,
            now: ctx.now,
            sourcePlayerId: controllerId,
            sourceDefId: triggerMinionDefId,
            sourceControllerId: controllerId,
            sourceBaseIndex: baseIndex,
            sourceKind: 'nonAction',
            targetSnapshot: { ownerId, controllerId },
        });
    }

    // 多个基地→创建玩家选择交互
    if (!ctx.matchState) {
        // 无 matchState 降级：自动选第一个
        const reason = isPod ? 'pirate_buccaneer_pod' : 'pirate_buccaneer';
        return buildValidatedMoveEvents(state, {
            minionUid: triggerMinionUid,
            minionDefId: triggerMinionDefId,
            fromBaseIndex: baseIndex,
            toBaseIndex: candidates[0].baseIndex,
            reason,
            now: ctx.now,
            sourcePlayerId: controllerId,
            sourceDefId: triggerMinionDefId,
            sourceControllerId: controllerId,
            sourceBaseIndex: baseIndex,
            sourceKind: 'nonAction',
            targetSnapshot: { ownerId, controllerId },
        });
    }

    const result = executeAbilityProgram(
        pirateBuccaneerMovePromptProgram,
        createPiratePromptContext(ctx.matchState, controllerId, ctx.now, {
            minionUid: triggerMinionUid,
            minionDefId: triggerMinionDefId,
            fromBaseIndex: baseIndex,
            ownerId,
            controllerId,
        }),
    );
    return { events: result.events, matchState: result.matchState ?? ctx.matchState };
}

// ============================================================================
// ongoing 效果触发器?
// ============================================================================

/** 海盗王 beforeScoring：可选移动到即将计分的基地
 *
 * 规则：所有玩家的 pirate_king 都可以在计分前移动（不限当前回合玩家）。
 * 交互发送给各 king 的 controller，而非 ctx.playerId。
 */
function pirateKingBeforeScoring(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    const scoringBaseIndex = ctx.baseIndex;
    if (scoringBaseIndex === undefined) return [];


    // 收集不在计分基地上的所有 pirate_king（不限当前回合玩家）
    const kings: { uid: string; defId: string; fromBaseIndex: number; controller: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (i === scoringBaseIndex) continue;
        for (const m of ctx.state.bases[i].minions) {
            if (m.defId === 'pirate_king' || m.defId === 'pirate_king_pod') {
                kings.push({ uid: m.uid, defId: m.defId, fromBaseIndex: i, controller: m.controller });
            }
        }
    }


    if (kings.length === 0) return [];
    const preferredKingIndex = ctx.sourceCardUid
        ? kings.findIndex(king => king.uid === ctx.sourceCardUid)
        : -1;
    const orderedKings = preferredKingIndex > 0
        ? [kings[preferredKingIndex], ...kings.slice(0, preferredKingIndex), ...kings.slice(preferredKingIndex + 1)]
        : kings;

    // 无 matchState 时回退自动移动
    if (!ctx.matchState) {
        return orderedKings.flatMap((k) => buildValidatedMoveEvents(ctx.state, {
            minionUid: k.uid,
            minionDefId: k.defId,
            fromBaseIndex: k.fromBaseIndex,
            toBaseIndex: scoringBaseIndex,
            reason: k.defId === 'pirate_king_pod' ? 'pirate_king_pod' : 'pirate_king',
            now: ctx.now,
            sourcePlayerId: k.controller,
            sourceDefId: k.defId,
            sourceControllerId: k.controller,
            sourceBaseIndex: k.fromBaseIndex,
            sourceKind: 'nonAction',
        }));
    }

    // 链式处理每个海盗王：创建确认交互（发送给各 king 的 controller）
    const result = executeAbilityProgram(
        pirateKingMovePromptProgram,
        createPiratePromptContext(ctx.matchState, orderedKings[0].controller, ctx.now, {
            scoringBaseIndex,
            current: orderedKings[0],
            remaining: orderedKings.slice(1),
        }),
    );
    return { events: result.events, matchState: result.matchState ?? ctx.matchState };
}

/**
 * 海盗副官 afterScoring：在本基地计分后，你可以移动本随从到其他基地而不是弃牌堆
 * 描述：「特殊：在本基地计分后，你可以移动本随从到其他基地而不是弃牌堆。」
 * 注意：只移动大副自身，不是其他随从
 *
 * 规则：所有玩家的 pirate_first_mate 都可以在计分后触发（不限当前回合玩家）。
 * 每个 first_mate 的 controller 独立选择是否移动及目标基地。
 */
function pirateFirstMateAfterScoring(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    const scoringBaseIndex = ctx.baseIndex;
    if (scoringBaseIndex === undefined) return [];

    const snapshotMate = ctx.triggerMinion;
    const mateUid = ctx.sourceCardUid ?? ctx.triggerMinionUid ?? snapshotMate?.uid;
    const locatedMate = mateUid
        ? findMinionOnBases(ctx.state, mateUid)
        : undefined;
    const ownerIdForZoneCheck = snapshotMate?.owner ?? ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId;
    const ownerZones = ownerIdForZoneCheck ? ctx.state.players[ownerIdForZoneCheck] : undefined;
    const sourceAlreadyInHandOrDeck = Boolean(
        mateUid
        && ownerZones
        && (ownerZones.hand.some(card => card.uid === mateUid) || ownerZones.deck.some(card => card.uid === mateUid)),
    );
    const wasDeckedByRitualSite = Boolean(
        mateUid && ctx.state.afterScoringRitualSiteDeckedMinionUids?.includes(mateUid),
    );
    if (!locatedMate && sourceAlreadyInHandOrDeck && !wasDeckedByRitualSite) return [];
    const mate = locatedMate?.minion ?? snapshotMate;
    const mateDefId = mate?.defId ?? ctx.triggerMinionDefId ?? ctx.sourceDefId;
    const mateBaseIndex = locatedMate?.baseIndex ?? ctx.sourceBaseIndex;
    if (!mateUid || !mateDefId || mateBaseIndex === undefined) return [];

    // 可用的其他基地
    const otherBases = ctx.state.bases
        .map((b, i) => ({ index: i, defId: b.defId }))
        .filter(b => b.index !== mateBaseIndex);
    if (otherBases.length === 0) return [];

    const controllerId = mate?.controller ?? ctx.sourceControllerId ?? ctx.playerId;
    const ownerId = mate?.owner ?? ctx.triggerMinion?.owner ?? controllerId;

    // 无 matchState 时回退自动移动 first_mate 自身到第一个可用基地
    if (!ctx.matchState) {
        return buildValidatedMoveEvents(ctx.state, {
            minionUid: mateUid,
            minionDefId: mateDefId,
            fromBaseIndex: mateBaseIndex,
            toBaseIndex: otherBases[0].index,
            reason: mateDefId === 'pirate_first_mate_pod' ? 'pirate_first_mate_pod' : 'pirate_first_mate',
            now: ctx.now,
            sourcePlayerId: controllerId,
            sourceDefId: mateDefId,
            sourceControllerId: controllerId,
            sourceBaseIndex: mateBaseIndex,
            sourceKind: 'nonAction',
            targetSnapshot: { ownerId, controllerId },
        });
    }

    const result = executeAbilityProgram(
        pirateFirstMateChooseBasePromptProgram,
        createPiratePromptContext(ctx.matchState, controllerId, ctx.now, {
            mateUid,
            mateDefId,
            mateBaseIndex,
            scoringBaseIndex,
            ownerId,
            controllerId,
        }),
    );
    return { events: result.events, matchState: result.matchState ?? ctx.matchState };
}

/** 小艇 onPlay：移动至多两个己方随从到其他基地 */
function pirateDinghy(ctx: AbilityContext): AbilityResult {
    // 收集所有己方随从
    const myMinions: { uid: string; defId: string; baseIndex: number; power: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                const power = getMinionPower(ctx.state, m, i);
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const baseDef = getBaseDef(ctx.state.bases[i].defId);
                const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                myMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, power, label: `${name} (力量 ${power}) @ ${baseName}` });
            }
        }
    }
    if (myMinions.length === 0) return { events: [] };
    const result = executeAbilityProgram(
        pirateDinghyChooseFirstPromptProgram,
        createPiratePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

/** 上海 onPlay：移动一个对手随从到另一个基地*/
function pirateShanghai(ctx: AbilityContext): AbilityResult {
    // 收集所有对手随从（保护检查在 buildMinionTargetOptions 中）
    const targets: { uid: string; defId: string; baseIndex: number; power: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) continue;
            const power = getMinionPower(ctx.state, m, i);
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, power, label: `${name} (力量 ${power}) @ ${baseName}` });
        }
    }
    if (targets.length === 0) return { events: [] };
    const options = buildActionMinionTargetOptions(
        targets.map(t => ({ uid: t.uid, defId: t.defId, baseIndex: t.baseIndex, label: t.label })),
        {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            effectType: 'affect',
        }
    );
    if (options.length === 0) {
        return {
            events: [
                buildAbilityFeedback(ctx.playerId, 'feedback.target_protected', ctx.now, undefined, 'warning'),
            ],
        };
    }
    const result = executeAbilityProgram(
        pirateShanghaiChooseMinionPromptProgram,
        createPiratePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

/**
 * 海狗 onPlay：指定一个派系，移动所有其他玩家该派系的随从从一个基地到另一个
 *
 * 流程：选择派系 → 选择来源基地 → 选择目标基地 → 批量移动
 */
function pirateSeaDogs(ctx: AbilityContext): AbilityResult {
    // 收集场上所有对手随从的派系（去重）
    const factionSet = new Map<string, string>(); // factionId → 派系中文名
    for (const base of ctx.state.bases) {
        for (const m of base.minions) {
            if (m.controller === ctx.playerId) continue;
            const def = getCardDef(m.defId);
            if (!def || !def.faction) continue;
            if (!factionSet.has(def.faction)) {
                factionSet.set(def.faction, def.faction);
            }
        }
    }
    if (factionSet.size === 0) return { events: [] };
    const result = executeAbilityProgram(
        pirateSeaDogsChooseFactionPromptProgram,
        createPiratePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function buildSeaDogsFactionSubtitle(factionId: string | undefined): string | undefined {
    if (!factionId) return undefined;
    const factionLabel = FACTION_DISPLAY_NAMES[factionId] || factionId;
    return `已选种族：${factionLabel}`;
}

const pirateSaucyWenchPromptProgram = createPromptProgram<PiratePromptContext & { baseIndex: number; sourceCardUid: string }, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_saucy_wench',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.baseIndex];
        const targets = base?.minions.filter(
            m => m.uid !== context.sourceCardUid && getMinionPower(context.matchState.core, m, context.baseIndex) <= 2,
        ) ?? [];
        const options = targets.map((target) => {
            const def = getCardDef(target.defId) as MinionCardDef | undefined;
            const name = def?.name ?? target.defId;
            const power = getMinionPower(context.matchState.core, target, context.baseIndex);
            return { uid: target.uid, defId: target.defId, baseIndex: context.baseIndex, label: `${name} (力量 ${power})` };
        });
        return createAbilityRuntimeSimpleChoice(
            `pirate_saucy_wench_${context.now}`,
            context.playerId,
            '你可以消灭本基地一个力量≤2的随从',
            [
                { id: 'skip', label: '跳过（不消灭随从）', labelKey: 'ui.pirate_saucy_wench_skip_option', value: { skip: true }, displayMode: 'button' as const },
                ...buildMinionTargetOptions(options, { state: context.matchState.core, sourcePlayerId: context.playerId, effectType: 'destroy' }),
            ],
            { sourceId: 'pirate_saucy_wench', targetType: 'minion', titleKey: 'ui.pirate_saucy_wench_title' },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number };
        if (selected.skip || selected.minionUid === undefined || selected.baseIndex === undefined) return { events: [] };
        const base = state.core.bases[selected.baseIndex];
        const target = base?.minions.find(m => m.uid === selected.minionUid);
        if (!target) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'pirate_saucy_wench',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'pirate_saucy_wench',
                sourceControllerId: playerId,
                sourceKind: 'action',
            }),
        };
    },
});

const pirateBroadsideChoosePlayerPromptProgram = createPromptProgram<PirateBroadsidePlayerPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_broadside_choose_player',
    buildInteraction: (context) => {
        const candidates = collectPirateBroadsideTargetPlayers(context.matchState.core, context.playerId, context.baseIndex);
        return createAbilityRuntimeSimpleChoice(
            `pirate_broadside_choose_player_${context.baseIndex}_${context.now}`,
            context.playerId,
            '选择该基地上的一个玩家，消灭其所有力量≤2的随从',
            buildPlayerTargetOptions(
                candidates.map((candidate, index) => ({
                    id: `target-player-${index}`,
                    label: candidate.label,
                    targetPlayerId: candidate.targetPlayerId,
                    value: { baseIndex: context.baseIndex },
                    displayMode: 'button' as const,
                })),
                {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    effectIntent: 'destroy',
                },
            ),
            { sourceId: 'pirate_broadside_choose_player', targetType: 'player', autoResolveIfSingle: false, titleKey: 'ui.pirate_broadside_choose_player_title' },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const { baseIndex, targetPlayerId } = value as { baseIndex?: number; targetPlayerId?: string };
        if (baseIndex === undefined || !targetPlayerId) return { events: [] };
        const base = state.core.bases[baseIndex];
        if (!base) return { events: [] };
        const events: SmashUpEvent[] = [];
        for (const minion of base.minions) {
            if (minion.controller === targetPlayerId && getMinionPower(state.core, minion, baseIndex) <= 2) {
                events.push(...buildValidatedDestroyEvents(state, {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    fromBaseIndex: baseIndex,
                    destroyerId: targetPlayerId,
                    reason: 'pirate_broadside',
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceDefId: 'pirate_broadside',
                    sourceControllerId: playerId,
                    sourceKind: 'action',
                }));
            }
        }
        return { events };
    },
});

const pirateBroadsideChooseBasePromptProgram = createPromptProgram<PiratePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_broadside_choose_base',
    buildInteraction: (context) => {
        const candidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            const playerCandidates = collectPirateBroadsideTargetPlayers(context.matchState.core, context.playerId, i);
            if (playerCandidates.length === 0) continue;
            const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
            candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        const title = '选择一个你有随从的基地';
        const interaction = createAbilityRuntimeSimpleChoice(
            `pirate_broadside_choose_base_${context.now}`,
            context.playerId,
            title,
            buildBaseTargetOptions(candidates, context.matchState.core),
            { sourceId: 'pirate_broadside_choose_base', targetType: 'base', autoResolveIfSingle: false, titleKey: 'ui.pirate_broadside_choose_base_title' },
        );
        return {
            ...interaction,
            data: {
                ...interaction.data,
                title,
            },
        };
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const { baseIndex } = value as { baseIndex?: number };
        if (baseIndex === undefined) return { events: [] };
        const next = collectPirateBroadsideTargetPlayers(state.core, playerId, baseIndex);
        if (next.length === 0) return { events: [] };
        return {
            events: [],
            context: createPiratePromptContext(state, playerId, timestamp, { baseIndex }),
            nextProgram: pirateBroadsideChoosePlayerPromptProgram,
        };
    },
});

const pirateCannonChooseSecondPromptProgram = createPromptProgram<PirateCannonSecondPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_cannon_choose_second',
    buildInteraction: (context) => {
        const remaining: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            for (const minion of context.matchState.core.bases[i].minions) {
                if (minion.uid === context.firstTargetUid) continue;
                if (getMinionPower(context.matchState.core, minion, i) <= 2) {
                    const def = getCardDef(minion.defId) as MinionCardDef | undefined;
                    const name = def?.name ?? minion.defId;
                    const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
                    const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                    const power = getMinionPower(context.matchState.core, minion, i);
                    remaining.push({ uid: minion.uid, defId: minion.defId, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseName}` });
                }
            }
        }
        return createAbilityRuntimeSimpleChoice(
            `pirate_cannon_second_${context.now}`,
            context.playerId,
            '加农炮：点击第二个要消灭的力量≤2的随从（可选）',
            [
                { id: 'skip', label: '跳过（不消灭第二个）', labelKey: 'ui.pirate_cannon_choose_second_skip_option', value: { skip: true }, displayMode: 'button' as const },
                ...buildMinionTargetOptions(remaining, { state: context.matchState.core, sourcePlayerId: context.playerId, effectType: 'destroy' }),
            ],
            { sourceId: 'pirate_cannon_choose_second', targetType: 'minion', titleKey: 'ui.pirate_cannon_choose_second_title' },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number };
        if (selected.skip || selected.minionUid === undefined || selected.baseIndex === undefined) return { events: [] };
        const base = state.core.bases[selected.baseIndex];
        const target = base?.minions.find(m => m.uid === selected.minionUid);
        if (!target) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'pirate_cannon',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'pirate_cannon',
                sourceControllerId: playerId,
                sourceKind: 'action',
            }),
        };
    },
});

const pirateCannonChooseFirstPromptProgram = createPromptProgram<PiratePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_cannon_choose_first',
    buildInteraction: (context) => {
        const allTargets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            for (const minion of context.matchState.core.bases[i].minions) {
                if (getMinionPower(context.matchState.core, minion, i) <= 2) {
                    const def = getCardDef(minion.defId) as MinionCardDef | undefined;
                    const name = def?.name ?? minion.defId;
                    const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
                    const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                    const power = getMinionPower(context.matchState.core, minion, i);
                    allTargets.push({ uid: minion.uid, defId: minion.defId, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseName}` });
                }
            }
        }
        return createAbilityRuntimeSimpleChoice(
            `pirate_cannon_first_${context.now}`,
            context.playerId,
            '加农炮：点击第一个要消灭的力量≤2的随从',
            buildMinionTargetOptions(allTargets, { state: context.matchState.core, sourcePlayerId: context.playerId, effectType: 'destroy' }),
            { sourceId: 'pirate_cannon_choose_first', targetType: 'minion', titleKey: 'ui.pirate_cannon_choose_first_title' },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const { minionUid, baseIndex } = value as { minionUid?: string; baseIndex?: number };
        if (minionUid === undefined || baseIndex === undefined) return { events: [] };
        const base = state.core.bases[baseIndex];
        const target = base?.minions.find(m => m.uid === minionUid);
        if (!target) return { events: [] };

        const events: SmashUpEvent[] = buildValidatedDestroyEvents(state, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: baseIndex,
            destroyerId: playerId,
            reason: 'pirate_cannon',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'pirate_cannon',
            sourceControllerId: playerId,
            sourceKind: 'action',
        });
        let remainingCount = 0;
        for (let i = 0; i < state.core.bases.length; i += 1) {
            for (const minion of state.core.bases[i].minions) {
                if (minion.uid === minionUid) continue;
                if (getMinionPower(state.core, minion, i) <= 2) remainingCount += 1;
            }
        }
        if (remainingCount === 0) return { events };
        return {
            events,
            context: createPiratePromptContext(state, playerId, timestamp, { firstTargetUid: minionUid }),
            nextProgram: pirateCannonChooseSecondPromptProgram,
        };
    },
});

const pirateShanghaiChooseBasePromptProgram = createPromptProgram<PirateMoveBasePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_shanghai_choose_base',
    buildInteraction: (context) => {
        const candidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            if (i === context.fromBaseIndex) continue;
            const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
            candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        return createAbilityRuntimeSimpleChoice(
            `pirate_shanghai_base_${context.now}`,
            context.playerId,
            '选择目标基地',
            buildBaseTargetOptions(candidates, context.matchState.core),
            { sourceId: 'pirate_shanghai_choose_base', targetType: 'base', titleKey: 'ui.pirate_shanghai_choose_base_title' },
        );
    },
    onResolve: ({ context, value, timestamp }) => {
        const { baseIndex } = value as { baseIndex?: number };
        if (baseIndex === undefined) return { events: [] };
        return {
            events: buildValidatedMoveEvents(context.matchState, {
                minionUid: context.minionUid,
                minionDefId: context.minionDefId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: baseIndex,
                reason: 'pirate_shanghai',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: 'pirate_shanghai',
                sourceControllerId: context.playerId,
                sourceKind: 'action',
            }),
        };
    },
});

const pirateShanghaiChooseMinionPromptProgram = createPromptProgram<PiratePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_shanghai_choose_minion',
    buildInteraction: (context) => {
        const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            for (const minion of context.matchState.core.bases[i].minions) {
                if (minion.controller === context.playerId) continue;
                const power = getMinionPower(context.matchState.core, minion, i);
                const def = getCardDef(minion.defId) as MinionCardDef | undefined;
                const name = def?.name ?? minion.defId;
                const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
                const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                targets.push({ uid: minion.uid, defId: minion.defId, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseName}` });
            }
        }
        return createAbilityRuntimeSimpleChoice(
            `pirate_shanghai_minion_${context.now}`,
            context.playerId,
            '选择要移动的对手随从',
            buildActionMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            }),
            { sourceId: 'pirate_shanghai_choose_minion', targetType: 'minion', titleKey: 'ui.pirate_shanghai_choose_minion_title' },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const { minionUid, baseIndex } = value as { minionUid?: string; baseIndex?: number };
        if (minionUid === undefined || baseIndex === undefined) return { events: [] };
        const base = state.core.bases[baseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        if (!minion) return { events: [] };
        return {
            events: [],
            context: createPiratePromptContext(state, playerId, timestamp, {
                minionUid,
                minionDefId: minion.defId,
                fromBaseIndex: baseIndex,
            }),
            nextProgram: pirateShanghaiChooseBasePromptProgram,
        };
    },
});

const pirateSeaDogsChooseToPromptProgram = createPromptProgram<PirateSeaDogsToPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_sea_dogs_choose_to',
    buildInteraction: (context) => {
        const destCandidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            if (i === context.fromBase) continue;
            const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
            destCandidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        return createAbilityRuntimeSimpleChoice(
            `pirate_sea_dogs_to_${context.now}`,
            context.playerId,
            '选择目标基地',
            buildBaseTargetOptions(destCandidates, context.matchState.core),
            {
                sourceId: 'pirate_sea_dogs_choose_to',
                targetType: 'base',
                subtitle: buildSeaDogsFactionSubtitle(context.factionId),
                titleKey: 'ui.pirate_sea_dogs_choose_to_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const { baseIndex: destBase } = value as { baseIndex?: number };
        if (destBase === undefined) return { events: [] };
        const base = state.core.bases[context.fromBase];
        if (!base) return { events: [] };
        return {
            events: applySemanticMinionEffectBatch(
                state,
                base.minions
                    .filter(minion => minion.controller !== context.playerId)
                    .filter(minion => getCardDef(minion.defId)?.faction === context.factionId)
                    .map(minion => ({ minion, baseIndex: context.fromBase })),
                {
                    sourcePlayerId: context.playerId,
                    sourceKind: 'action',
                    effectType: 'move',
                    respectActionProtection: true,
                    mode: 'apply',
                    feedbackPlayerId: context.playerId,
                    now: timestamp,
                    buildEvents: ({ minion }) => buildValidatedMoveEvents(state, {
                        minionUid: minion.uid,
                        minionDefId: minion.defId,
                        fromBaseIndex: context.fromBase,
                        toBaseIndex: destBase,
                        reason: 'pirate_sea_dogs',
                        now: timestamp,
                        sourcePlayerId: context.playerId,
                        sourceDefId: 'pirate_sea_dogs',
                        sourceControllerId: context.playerId,
                        sourceBaseIndex: context.fromBase,
                        sourceKind: 'action',
                    }),
                },
            ).events,
        };
    },
});

const pirateSeaDogsChooseFromPromptProgram = createPromptProgram<PirateSeaDogsFromPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_sea_dogs_choose_from',
    buildInteraction: (context) => {
        const candidates: { baseIndex: number; count: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            const count = context.matchState.core.bases[i].minions.filter((m) => {
                if (m.controller === context.playerId) return false;
                const def = getCardDef(m.defId);
                return def?.faction === context.factionId;
            }).length;
            if (count > 0) {
                const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
                candidates.push({ baseIndex: i, count, label: `${baseDef?.name ?? `基地 ${i + 1}`} (${count} 个该派系随从)` });
            }
        }
        return createAbilityRuntimeSimpleChoice(
            `pirate_sea_dogs_from_${context.now}`,
            context.playerId,
            '选择来源基地（移动该派系所有对手随从）',
            buildBaseTargetOptions(candidates, context.matchState.core),
            {
                sourceId: 'pirate_sea_dogs_choose_from',
                targetType: 'base',
                subtitle: buildSeaDogsFactionSubtitle(context.factionId),
                titleKey: 'ui.pirate_sea_dogs_choose_from_title',
            },
        );
    },
    onResolve: ({ state, playerId, value, timestamp, context }) => {
        const { baseIndex: fromBase } = value as { baseIndex?: number };
        if (fromBase === undefined) return { events: [] };
        const destCandidates = state.core.bases.filter((_, index) => index !== fromBase);
        if (destCandidates.length === 0) return { events: [] };
        return {
            events: [],
            context: createPiratePromptContext(state, playerId, timestamp, {
                factionId: context.factionId,
                fromBase,
            }),
            nextProgram: pirateSeaDogsChooseToPromptProgram,
        };
    },
});

const pirateSeaDogsChooseFactionPromptProgram = createPromptProgram<PiratePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_sea_dogs_choose_faction',
    buildInteraction: (context) => {
        const factionSet = new Map<string, string>();
        for (const base of context.matchState.core.bases) {
            for (const minion of base.minions) {
                if (minion.controller === context.playerId) continue;
                const def = getCardDef(minion.defId);
                if (def?.faction && !factionSet.has(def.faction)) {
                    factionSet.set(def.faction, def.faction);
                }
            }
        }
        const options = Array.from(factionSet.keys()).map((fid, index) => ({
            id: `faction-${index}`,
            label: FACTION_DISPLAY_NAMES[fid] || fid,
            value: { factionId: fid },
            displayMode: 'button' as const,
        }));
        return createAbilityRuntimeSimpleChoice(
            `pirate_sea_dogs_faction_${context.now}`,
            context.playerId,
            '水手：指定一个派系',
            options,
            { sourceId: 'pirate_sea_dogs_choose_faction', targetType: 'generic', titleKey: 'ui.pirate_sea_dogs_choose_faction_title' },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const { factionId } = value as { factionId?: string };
        if (!factionId) return { events: [] };
        let hasCandidate = false;
        for (let i = 0; i < state.core.bases.length; i += 1) {
            const count = state.core.bases[i].minions.filter((m) => {
                if (m.controller === playerId) return false;
                const def = getCardDef(m.defId);
                return def?.faction === factionId;
            }).length;
            if (count > 0) {
                hasCandidate = true;
                break;
            }
        }
        if (!hasCandidate) return { events: [] };
        return {
            events: [],
            context: createPiratePromptContext(state, playerId, timestamp, { factionId }),
            nextProgram: pirateSeaDogsChooseFromPromptProgram,
        };
    },
});

const pirateDinghySecondChooseBasePromptProgram = createPromptProgram<PirateMoveBasePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_dinghy_second_choose_base',
    buildInteraction: (context) => {
        const candidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            if (i === context.fromBaseIndex) continue;
            const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
            candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        return createAbilityRuntimeSimpleChoice(
            `pirate_dinghy_second_base_${context.now}`,
            context.playerId,
            '选择目标基地',
            buildBaseTargetOptions(candidates, context.matchState.core),
            { sourceId: 'pirate_dinghy_second_choose_base', targetType: 'base', titleKey: 'ui.pirate_dinghy_second_choose_base_title' },
        );
    },
    onResolve: ({ context, value, timestamp }) => {
        const { baseIndex } = value as { baseIndex?: number };
        if (baseIndex === undefined) return { events: [] };
        return {
            events: buildValidatedMoveEvents(context.matchState, {
                minionUid: context.minionUid,
                minionDefId: context.minionDefId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: baseIndex,
                reason: 'pirate_dinghy',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: 'pirate_dinghy',
                sourceControllerId: context.playerId,
                sourceKind: 'action',
            }),
        };
    },
});

const pirateDinghyChooseSecondPromptProgram = createPromptProgram<PirateDinghySecondPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_dinghy_choose_second',
    buildInteraction: (context) => {
        const remaining: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            for (const minion of context.matchState.core.bases[i].minions) {
                if (minion.controller === context.playerId && minion.uid !== context.firstMovedUid) {
                    const def = getCardDef(minion.defId) as MinionCardDef | undefined;
                    const name = def?.name ?? minion.defId;
                    const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
                    const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                    const power = getMinionPower(context.matchState.core, minion, i);
                    remaining.push({ uid: minion.uid, defId: minion.defId, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseName}` });
                }
            }
        }
        return createAbilityRuntimeSimpleChoice(
            `pirate_dinghy_second_${context.now}`,
            context.playerId,
            '选择第二个要移动的随从（可选）',
            [
                { id: 'skip', label: '跳过（不移动第二个）', labelKey: 'ui.pirate_dinghy_choose_second_skip_option', value: { skip: true }, displayMode: 'button' as const },
                ...buildMinionTargetOptions(remaining, { state: context.matchState.core, sourcePlayerId: context.playerId }),
            ],
            { sourceId: 'pirate_dinghy_choose_second', targetType: 'minion', titleKey: 'ui.pirate_dinghy_choose_second_title' },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number };
        if (selected.skip || selected.minionUid === undefined || selected.baseIndex === undefined) return { events: [] };
        const base = state.core.bases[selected.baseIndex];
        const minion = base?.minions.find(m => m.uid === selected.minionUid);
        if (!minion) return { events: [] };
        return {
            events: [],
            context: createPiratePromptContext(state, playerId, timestamp, {
                minionUid: selected.minionUid,
                minionDefId: minion.defId,
                fromBaseIndex: selected.baseIndex,
            }),
            nextProgram: pirateDinghySecondChooseBasePromptProgram,
        };
    },
});

const pirateDinghyFirstChooseBasePromptProgram = createPromptProgram<PirateMoveBasePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_dinghy_first_choose_base',
    buildInteraction: (context) => {
        const candidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            if (i === context.fromBaseIndex) continue;
            const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
            candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        return createAbilityRuntimeSimpleChoice(
            `pirate_dinghy_first_base_${context.now}`,
            context.playerId,
            '选择目标基地',
            buildBaseTargetOptions(candidates, context.matchState.core),
            { sourceId: 'pirate_dinghy_first_choose_base', targetType: 'base', titleKey: 'ui.pirate_dinghy_first_choose_base_title' },
        );
    },
    onResolve: ({ state, playerId, context, value, timestamp }) => {
        const { baseIndex } = value as { baseIndex?: number };
        if (baseIndex === undefined) return { events: [] };
        const events: SmashUpEvent[] = buildValidatedMoveEvents(state, {
            minionUid: context.minionUid,
            minionDefId: context.minionDefId,
            fromBaseIndex: context.fromBaseIndex,
            toBaseIndex: baseIndex,
            reason: 'pirate_dinghy',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'pirate_dinghy',
            sourceControllerId: playerId,
            sourceKind: 'action',
        });
        let remainingCount = 0;
        for (let i = 0; i < state.core.bases.length; i += 1) {
            for (const minion of state.core.bases[i].minions) {
                if (minion.controller === playerId && minion.uid !== context.minionUid) remainingCount += 1;
            }
        }
        if (remainingCount === 0) return { events };
        return {
            events,
            context: createPiratePromptContext(state, playerId, timestamp, { firstMovedUid: context.minionUid }),
            nextProgram: pirateDinghyChooseSecondPromptProgram,
        };
    },
});

const pirateDinghyChooseFirstPromptProgram = createPromptProgram<PiratePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_dinghy_choose_first',
    buildInteraction: (context) => {
        const myMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            for (const minion of context.matchState.core.bases[i].minions) {
                if (minion.controller === context.playerId) {
                    const power = getMinionPower(context.matchState.core, minion, i);
                    const def = getCardDef(minion.defId) as MinionCardDef | undefined;
                    const name = def?.name ?? minion.defId;
                    const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
                    const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                    myMinions.push({ uid: minion.uid, defId: minion.defId, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseName}` });
                }
            }
        }
        return createAbilityRuntimeSimpleChoice(
            `pirate_dinghy_first_${context.now}`,
            context.playerId,
            '选择要移动的己方随从（至多2个，第1个）',
            buildMinionTargetOptions(myMinions, { state: context.matchState.core, sourcePlayerId: context.playerId }),
            { sourceId: 'pirate_dinghy_choose_first', targetType: 'minion', titleKey: 'ui.pirate_dinghy_choose_first_title' },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const { minionUid, baseIndex } = value as { minionUid?: string; baseIndex?: number };
        if (minionUid === undefined || baseIndex === undefined) return { events: [] };
        const base = state.core.bases[baseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        if (!minion) return { events: [] };
        return {
            events: [],
            context: createPiratePromptContext(state, playerId, timestamp, {
                minionUid,
                minionDefId: minion.defId,
                fromBaseIndex: baseIndex,
            }),
            nextProgram: pirateDinghyFirstChooseBasePromptProgram,
        };
    },
});

const piratePowderkegPromptProgram = createPromptProgram<PiratePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_powderkeg',
    buildInteraction: (context) => {
        const myMinions: { uid: string; defId: string; power: number; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            for (const minion of context.matchState.core.bases[i].minions) {
                if (minion.controller !== context.playerId) continue;
                const power = getMinionPower(context.matchState.core, minion, i);
                const def = getCardDef(minion.defId) as MinionCardDef | undefined;
                const name = def?.name ?? minion.defId;
                const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
                const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                myMinions.push({ uid: minion.uid, defId: minion.defId, power, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseName}` });
            }
        }
        return createAbilityRuntimeSimpleChoice(
            `pirate_powderkeg_${context.now}`,
            context.playerId,
            '选择要牺牲的己方随从（同基地力量≤它的随从也会被消灭）',
            buildMinionTargetOptions(myMinions, { state: context.matchState.core, sourcePlayerId: context.playerId }),
            { sourceId: 'pirate_powderkeg', targetType: 'minion', titleKey: 'ui.pirate_powderkeg_title' },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const { minionUid, baseIndex } = value as { minionUid?: string; baseIndex?: number };
        if (minionUid === undefined || baseIndex === undefined) return { events: [] };
        const base = state.core.bases[baseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        if (!minion) return { events: [] };
        const power = getMinionPower(state.core, minion, baseIndex);
        const events: SmashUpEvent[] = buildValidatedDestroyEvents(state, {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            fromBaseIndex: baseIndex,
            destroyerId: playerId,
            reason: 'pirate_powderkeg',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'pirate_powderkeg',
            sourceControllerId: playerId,
            sourceKind: 'action',
        });
        for (const other of base.minions) {
            if (other.uid === minionUid) continue;
            if (getMinionPower(state.core, other, baseIndex) <= power) {
                events.push(...buildValidatedDestroyEvents(state, {
                    minionUid: other.uid,
                    minionDefId: other.defId,
                    fromBaseIndex: baseIndex,
                    destroyerId: playerId,
                    reason: 'pirate_powderkeg',
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceDefId: 'pirate_powderkeg',
                    sourceControllerId: playerId,
                    sourceKind: 'action',
                }));
            }
        }
        return { events };
    },
});

const pirateFullSailChooseBasePromptProgram = createPromptProgram<PirateFullSailChooseBasePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_full_sail_choose_base',
    buildInteraction: (context) => {
        const candidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            if (i === context.fromBaseIndex) continue;
            const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
            candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        return createAbilityRuntimeSimpleChoice(
            `pirate_full_sail_base_${context.minionUid}_${context.now}`,
            context.playerId,
            '选择目标基地',
            buildBaseTargetOptions(candidates, context.matchState.core),
            { sourceId: 'pirate_full_sail_choose_base', targetType: 'base', titleKey: 'ui.pirate_full_sail_choose_base_title' },
        );
    },
    onResolve: ({ state, context, value, playerId, timestamp }) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) return { events: [] };
        const events: SmashUpEvent[] = buildValidatedMoveEvents(state, {
            minionUid: context.minionUid,
            minionDefId: context.minionDefId,
            fromBaseIndex: context.fromBaseIndex,
            toBaseIndex: selected.baseIndex,
            reason: 'pirate_full_sail',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'pirate_full_sail',
            sourceControllerId: playerId,
            sourceKind: 'action',
        });
        const newMovedUids = [...context.movedUids, context.minionUid];
        const nextInteraction = buildFullSailChooseMinionInteraction(state.core, playerId, timestamp, newMovedUids);
        if (!nextInteraction) return { events };
        return {
            events,
            context: createPiratePromptContext(state, playerId, timestamp, { movedUids: newMovedUids }),
            nextProgram: pirateFullSailChooseMinionPromptProgram,
        };
    },
});

const pirateFullSailChooseMinionPromptProgram = createPromptProgram<PirateFullSailChooseMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_full_sail_choose_minion',
    buildInteraction: (context) => {
        const interaction = buildFullSailChooseMinionInteraction(
            context.matchState.core,
            context.playerId,
            context.now,
            context.movedUids,
        );
        if (!interaction) {
            throw new Error('pirate_full_sail_choose_minion 缺少可选交互');
        }
        return interaction;
    },
    onResolve: ({ state, context, value, playerId, timestamp }) => {
        const selected = value as { done?: boolean; minionUid?: string; baseIndex?: number } | undefined;
        if (selected?.done) return { events: [] };
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const base = state.core.bases[selected.baseIndex];
        const minion = base?.minions.find((m) => m.uid === selected.minionUid);
        if (!minion) return { events: [] };
        return {
            events: [],
            context: createPiratePromptContext(state, playerId, timestamp, {
                movedUids: context.movedUids,
                minionUid: selected.minionUid,
                minionDefId: minion.defId,
                fromBaseIndex: selected.baseIndex,
            }),
            nextProgram: pirateFullSailChooseBasePromptProgram,
        };
    },
});

const pirateBuccaneerMovePromptProgram = createPromptProgram<PirateBuccaneerMovePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_buccaneer_move',
    buildInteraction: (context) => {
        const candidates: { baseIndex: number; label: string; baseDefId: string }[] = [];
        for (let i = 0; i < context.matchState.core.bases.length; i += 1) {
            if (i === context.fromBaseIndex) continue;
            const baseDef = getBaseDef(context.matchState.core.bases[i].defId);
            candidates.push({
                baseIndex: i,
                label: baseDef?.name ?? `基地 ${i + 1}`,
                baseDefId: context.matchState.core.bases[i].defId,
            });
        }
        return createAbilityRuntimeSimpleChoice(
            `buccaneer_move_${context.minionUid}_${context.now}`,
            context.playerId,
            '海盗：选择移动到哪个基地',
            candidates.map((candidate) => ({
                id: `base_${candidate.baseIndex}`,
                label: candidate.label,
                value: { toBaseIndex: candidate.baseIndex, baseDefId: candidate.baseDefId },
                displayMode: 'button' as const,
            })),
            { sourceId: 'pirate_buccaneer_move', targetType: 'base', titleKey: 'ui.pirate_buccaneer_move_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as {
            minionUid?: string;
            minionDefId?: string;
            fromBaseIndex?: number;
            toBaseIndex?: number;
            baseDefId?: string;
        } | undefined;
        const resolvedToBaseIndex = resolveLiveBaseIndex(state.core, selected?.toBaseIndex, selected?.baseDefId);
        if (resolvedToBaseIndex === undefined) return { events: [] };
        const minionUid = context?.minionUid ?? selected?.minionUid;
        const minionDefId = context?.minionDefId ?? selected?.minionDefId;
        const fromBaseIndex = context?.fromBaseIndex ?? selected?.fromBaseIndex;
        const fallbackPlayerId = context?.playerId ?? state.sys.interaction?.current?.playerId;
        if (!minionUid || !minionDefId || fromBaseIndex === undefined) return { events: [] };
        return {
            events: buildValidatedMoveEvents(state, {
                minionUid,
                minionDefId,
                fromBaseIndex,
                toBaseIndex: resolvedToBaseIndex,
                reason: minionDefId === 'pirate_buccaneer_pod' ? 'pirate_buccaneer_pod' : 'pirate_buccaneer',
                now: timestamp,
                sourcePlayerId: fallbackPlayerId ?? '',
                sourceDefId: minionDefId,
                sourceControllerId: fallbackPlayerId ?? '',
                sourceBaseIndex: fromBaseIndex,
                sourceKind: 'nonAction',
                targetSnapshot: {
                    ownerId: context?.ownerId ?? fallbackPlayerId,
                    controllerId: context?.controllerId ?? fallbackPlayerId,
                },
            }),
        };
    },
});

const pirateKingMovePromptProgram = createPromptProgram<PirateKingMovePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_king_move',
    buildInteraction: (context) => {
        const baseDef = getBaseDef(context.matchState.core.bases[context.scoringBaseIndex]?.defId ?? '');
        const baseName = baseDef?.name ?? `基地 ${context.scoringBaseIndex + 1}`;
        return createAbilityRuntimeSimpleChoice(
            `pirate_king_move_${context.current.uid}_${context.now}`,
            context.current.controller,
            `海盗王可发动：点击海盗王移动到即将计分的「${baseName}」`,
            [
                {
                    id: 'yes',
                    label: '发动并移动',
                    labelKey: 'ui.pirate_king_move_option',
                    value: {
                        move: true,
                        minionUid: context.current.uid,
                        uid: context.current.uid,
                        minionDefId: context.current.defId,
                        defId: context.current.defId,
                        fromBaseIndex: context.current.fromBaseIndex,
                        baseIndex: context.scoringBaseIndex,
                        baseDefId: context.matchState.core.bases[context.scoringBaseIndex]?.defId,
                        fieldSourceTargetType: 'base',
                    },
                    displayMode: 'card' as const,
                },
                { id: 'no', label: '不发动', labelKey: 'ui.pirate_king_stay_option', value: { move: false }, displayMode: 'button' as const },
            ],
            {
                sourceId: 'pirate_king_move',
                targetType: 'minion',
                titleKey: 'ui.pirate_king_move_title',
                titleParams: { baseName },
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { move?: boolean; uid?: string; minionUid?: string; defId?: string; minionDefId?: string; fromBaseIndex?: number } | undefined;
        const events: SmashUpEvent[] = [];
        const current = context?.current ?? (
            (selected?.uid ?? selected?.minionUid) && (selected?.defId ?? selected?.minionDefId) && selected?.fromBaseIndex !== undefined
                ? {
                    uid: selected.uid ?? selected.minionUid!,
                    defId: selected.defId ?? selected.minionDefId!,
                    fromBaseIndex: selected.fromBaseIndex,
                    controller: context?.playerId ?? '',
                }
                : undefined
        );
        if (selected?.move) {
            if (!current) return { events: [] };
            events.push(...buildValidatedMoveEvents(state, {
                minionUid: current.uid,
                minionDefId: current.defId,
                fromBaseIndex: current.fromBaseIndex,
                toBaseIndex: context.scoringBaseIndex,
                reason: current.defId === 'pirate_king_pod' ? 'pirate_king_pod' : 'pirate_king',
                now: timestamp,
                sourcePlayerId: current.controller,
                sourceDefId: current.defId,
                sourceControllerId: current.controller,
                sourceBaseIndex: current.fromBaseIndex,
                sourceKind: 'nonAction',
            }));
        }
        if (context.remaining.length === 0) return { events };
        return {
            events,
            context: createPiratePromptContext(state, context.remaining[0].controller, timestamp, {
                scoringBaseIndex: context.scoringBaseIndex,
                current: context.remaining[0],
                remaining: context.remaining.slice(1),
            }),
            nextProgram: pirateKingMovePromptProgram,
        };
    },
});

const pirateFirstMateChooseBasePromptProgram = createPromptProgram<PirateFirstMateChooseBasePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pirate_first_mate_choose_base',
    buildInteraction: (context) => {
        const def = getCardDef(context.mateDefId) as MinionCardDef | undefined;
        const mateName = def?.name ?? '大副';
        const otherBases = context.matchState.core.bases
            .map((b, i) => ({ index: i, defId: b.defId }))
            .filter((b) => b.index !== context.mateBaseIndex);
        const baseOptions = otherBases.map((b) => {
            const baseDef = getBaseDef(b.defId);
            const baseName = baseDef?.name ?? `基地 ${b.index + 1}`;
            return {
                id: `base-${b.index}`,
                label: baseName,
                value: { baseIndex: b.index, baseDefId: b.defId },
                _source: 'base' as const,
                displayMode: 'card' as const,
            };
        });
        return createAbilityRuntimeSimpleChoice(
            `pirate_first_mate_choose_base_${context.mateUid}_${context.now}`,
            context.playerId,
            `${mateName}：你可以移动本随从到其他基地（而不是弃牌堆）`,
            [
                { id: 'skip', label: '跳过（不移动大副）', labelKey: 'ui.pirate_first_mate_skip_move_option', value: { skip: true }, displayMode: 'button' as const },
                ...baseOptions,
            ] as any[],
            {
                sourceId: 'pirate_first_mate_choose_base',
                targetType: 'base',
                titleKey: 'ui.pirate_first_mate_choose_base_title',
                titleParams: { mateName },
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { skip?: boolean; baseIndex?: number; baseDefId?: string } | undefined;

        if (selected?.skip) {
            return { events: [] };
        }

        const resolvedToBaseIndex = resolveLiveBaseIndex(state.core, selected?.baseIndex, selected?.baseDefId);
        if (resolvedToBaseIndex === undefined) return { events: [] };
        const destBase = resolvedToBaseIndex;
        const locatedMate = findMinionOnBases(state.core, context.mateUid);
        const events: SmashUpEvent[] = [];
        const fromBaseIndex = locatedMate?.baseIndex ?? context.mateBaseIndex ?? context.scoringBaseIndex;
        const mateDefId = locatedMate?.minion.defId ?? context.mateDefId;

        if (fromBaseIndex !== undefined && fromBaseIndex !== destBase) {
            events.push(...buildValidatedMoveEvents(state, {
                minionUid: context.mateUid,
                minionDefId: mateDefId,
                fromBaseIndex,
                toBaseIndex: destBase,
                reason: context.mateDefId === 'pirate_first_mate_pod' ? 'pirate_first_mate_pod' : 'pirate_first_mate',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: context.mateDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: fromBaseIndex,
                sourceKind: 'nonAction',
                targetSnapshot: {
                    ownerId: context.ownerId ?? context.playerId,
                    controllerId: context.controllerId ?? context.playerId,
                },
            }));
        }

        return { events };
    },
});

/** 炸药桶?onPlay：消灭己方随从，然后消灭同基地所有力量≤被消灭随从的随从 */
function piratePowderkeg(ctx: AbilityContext): AbilityResult {
    // 收集所有己方随从
    const myMinions: { uid: string; defId: string; power: number; baseIndex: number; owner: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            const power = getMinionPower(ctx.state, m, i);
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            myMinions.push({ uid: m.uid, defId: m.defId, power, baseIndex: i, owner: m.owner, label: `${name} (力量 ${power}) @ ${baseName}` });
        }
    }
    if (myMinions.length === 0) return { events: [] };
    const result = executeAbilityProgram(
        piratePowderkegPromptProgram,
        createPiratePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

// ============================================================================
// 交互解决处理函数（InteractionHandler）
// ============================================================================

export function registerPirateInteractionHandlers(): void {
    // 海盗派系交互已迁移到 ability runtime prompt program。
}
