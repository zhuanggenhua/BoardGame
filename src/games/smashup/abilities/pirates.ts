/**
 * 大杀四方 - 海盗派系能力
 *
 * 主题：移动随从、消灭低力量随从
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { destroyMinion, addPowerCounter, moveMinion, getMinionPower, buildMinionTargetOptions, buildBaseTargetOptions, buildAbilityFeedback } from '../domain/abilityHelpers';
import type { SmashUpEvent, MinionCardDef, SmashUpCore } from '../domain/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { MatchState } from '../../../engine/types';
import { getCardDef, getBaseDef } from '../data/cards';
import { registerTrigger, isMinionProtected } from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { FACTION_DISPLAY_NAMES } from '../domain/ids';
import { getOpponentLabel } from '../domain/utils';

/** 注册海盗派系所有能力*/
export function registerPirateAbilities(): void {
    registerAbility('pirate_saucy_wench', 'onPlay', pirateSaucyWench);
    registerAbility('pirate_broadside', 'onPlay', pirateBroadside);
    registerAbility('pirate_cannon', 'onPlay', pirateCannon);
    registerAbility('pirate_swashbuckling', 'onPlay', pirateSwashbuckling);
    // 炸药桶：消灭己方随从，然后消灭同基地所有力量≤被消灭随从的随从
    registerAbility('pirate_powderkeg', 'onPlay', piratePowderkeg);
    // 小艇（行动卡）：移动至多两个己方随从到其他基地
    registerAbility('pirate_dinghy', 'onPlay', pirateDinghy);
    // 全速航行（特殊行动卡）：移动己方任意数量随从到其他基地
    registerAbility('pirate_full_sail', 'special', pirateFullSail);
    // 上海（行动卡）：移动一个对手随从到另一个基地
    registerAbility('pirate_shanghai', 'onPlay', pirateShanghai);
    // 海狗（行动卡）：移动一个随从到另一个基地
    registerAbility('pirate_sea_dogs', 'onPlay', pirateSeaDogs);

    // === ongoing 效果注册 ===
    // 海盗王：基地计分前移动到该基地
    registerTrigger('pirate_king', 'beforeScoring', pirateKingBeforeScoring);
    // 副官：基地计分后移动到其他基地（而非弃牌堆）
    registerTrigger('pirate_first_mate', 'afterScoring', pirateFirstMateAfterScoring);
    // 海盗（海盗）：被消灭时移动到其他基地而非进入弃牌堆
    registerTrigger('pirate_buccaneer', 'onMinionDestroyed', buccaneerOnDestroyed);
    registerInteractionHandler('pirate_buccaneer_move', buccaneerMoveHandler);
}

/** 粗鲁少妇 onPlay：消灭本基地一个力量≤2的随从*/
function pirateSaucyWench(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.minions.filter(
        m => m.uid !== ctx.cardUid && getMinionPower(ctx.state, m, ctx.baseIndex) <= 2
    );
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = targets.map(t => {
        const def = getCardDef(t.defId) as MinionCardDef | undefined;
        const name = def?.name ?? t.defId;
        const power = getMinionPower(ctx.state, t, ctx.baseIndex);
        return { uid: t.uid, defId: t.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
    });
    // "你可以"：添加跳过选项
    const allOptions = [
        { id: 'skip', label: '跳过（不消灭随从）', value: { skip: true } },
        ...buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
    ] as any[];
    const interaction = createSimpleChoice(
        `pirate_saucy_wench_${ctx.now}`, ctx.playerId,
        '你可以消灭本基地一个力量≤2的随从', allOptions, 'pirate_saucy_wench',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 侧翼开路?onPlay：选择一个效果对手?一个你有随从的基地，消灭该对手在该基地所有力量≤2的随从*/
function pirateBroadside(ctx: AbilityContext): AbilityResult {
    // 收集所有可能的 (基地, 对手) 组合
    const candidates: { baseIndex: number; opponentId: string; count: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        if (!base.minions.some(m => m.controller === ctx.playerId)) continue;
        const opponentCounts = new Map<string, number>();
        for (const m of base.minions) {
            if (m.controller !== ctx.playerId && getMinionPower(ctx.state, m, i) <= 2) {
                opponentCounts.set(m.controller, (opponentCounts.get(m.controller) || 0) + 1);
            }
        }
        const baseDef = getBaseDef(base.defId);
        const baseName = baseDef?.name ?? `基地 ${i + 1}`;
        for (const [pid, count] of opponentCounts) {
            candidates.push({ baseIndex: i, opponentId: pid, count, label: `${baseName}（${getOpponentLabel(pid)}，${count}个弱随从）` });
        }
    }
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = candidates.map((c, i) => ({ id: `target-${i}`, label: c.label, value: { baseIndex: c.baseIndex, opponentId: c.opponentId } }));
    const interaction = createSimpleChoice(
        `pirate_broadside_${ctx.now}`, ctx.playerId,
        '选择基地和对手，消灭该对手所有力量≤2的随从', options, 'pirate_broadside',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
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
    
    // 创建选择第一个目标的 Interaction（点击式）
    const options = allTargets.map(t => ({ uid: t.uid, defId: t.defId, baseIndex: t.baseIndex, label: t.label }));
    const interaction = createSimpleChoice(
        `pirate_cannon_first_${ctx.now}`, ctx.playerId,
        '加农炮：点击第一个要消灭的力量≤2的随从',
        buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
        { sourceId: 'pirate_cannon_choose_first', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 虚张声势 onPlay：你的每个随从1力量直到回合结束 */
function pirateSwashbuckling(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            if (m.controller === ctx.playerId) {
                events.push(addPowerCounter(m.uid, i, 1, 'pirate_swashbuckling', ctx.now));
            }
        }
    }

    return { events };
}

/** 全速航行 onPlay：移动己方任意数量随从到其他基地 */
function pirateFullSail(ctx: AbilityContext): AbilityResult {
    const interaction = buildFullSailChooseMinionInteraction(ctx.state, ctx.playerId, ctx.now, []);
    if (!interaction) return { events: [] };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
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
        { id: 'done', label: '完成移动', value: { done: true } },
    ];
    const interaction = createSimpleChoice(
        `pirate_full_sail_minion_${now}`, playerId,
        '选择要移动的己方随从（或完成）', options as any[], 'pirate_full_sail_choose_minion',
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
    if (!triggerMinionUid || triggerMinionDefId !== 'pirate_buccaneer' || baseIndex === undefined) return [];

    // 收集可用的其他基地
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        if (i === baseIndex) continue;
        const baseDef = getBaseDef(state.bases[i].defId);
        candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
    }
    // 无其他基地可移→正常消灭
    if (candidates.length === 0) return [];

    // 只有一个基地时自动移动（无需交互）
    if (candidates.length === 1) {
        return [moveMinion(triggerMinionUid, triggerMinionDefId, baseIndex, candidates[0].baseIndex, 'pirate_buccaneer', ctx.now)];
    }

    // 多个基地→创建玩家选择交互
    if (!ctx.matchState) {
        // 无 matchState 降级：自动选第一个
        return [moveMinion(triggerMinionUid, triggerMinionDefId, baseIndex, candidates[0].baseIndex, 'pirate_buccaneer', ctx.now)];
    }

    const minion = state.bases[baseIndex]?.minions.find(m => m.uid === triggerMinionUid);
    const ownerId = minion?.controller ?? ctx.playerId;

    const interaction = createSimpleChoice(
        `buccaneer_move_${triggerMinionUid}_${ctx.now}`,
        ownerId,
        '海盗：选择移动到哪个基地',
        candidates.map(c => ({
            id: `base_${c.baseIndex}`,
            label: c.label,
            value: { minionUid: triggerMinionUid, minionDefId: triggerMinionDefId, fromBaseIndex: baseIndex, toBaseIndex: c.baseIndex, baseDefId: c.baseDefId },
        })),
        { sourceId: 'pirate_buccaneer_move', targetType: 'generic' },
    );
    const updatedMS = queueInteraction(ctx.matchState, interaction);
    return { events: [], matchState: updatedMS };
}

/** 海盗 (Buccaneer) 交互处理：玩家选择目标基地后执行移动 */
function buccaneerMoveHandler(
    state: MatchState<SmashUpCore>,
    _playerId: string,
    value: unknown,
    _iData: Record<string, unknown> | undefined,
    _random: unknown,
    timestamp: number
) {
    const selected = value as {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        toBaseIndex: number;
    };
    return {
        state,
        events: [moveMinion(selected.minionUid, selected.minionDefId, selected.fromBaseIndex, selected.toBaseIndex, 'pirate_buccaneer', timestamp)],
    };
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
            if (m.defId === 'pirate_king') {
                kings.push({ uid: m.uid, defId: m.defId, fromBaseIndex: i, controller: m.controller });
            }
        }
    }
    if (kings.length === 0) return [];

    // 无 matchState 时回退自动移动
    if (!ctx.matchState) {
        return kings.map(k => moveMinion(k.uid, k.defId, k.fromBaseIndex, scoringBaseIndex, 'pirate_king', ctx.now));
    }

    // 链式处理每个海盗王：创建确认交互（发送给各 king 的 controller）
    const first = kings[0];
    const remaining = kings.slice(1);
    const baseDef = getBaseDef(ctx.state.bases[scoringBaseIndex].defId);
    const baseName = baseDef?.name ?? `基地 ${scoringBaseIndex + 1}`;
    const interaction = createSimpleChoice(
        `pirate_king_move_${ctx.now}`, first.controller,
        `海盗王：是否移动到即将计分的「${baseName}」？`,
        [
            { id: 'yes', label: '移动到该基地', value: { move: true, uid: first.uid, defId: first.defId, fromBaseIndex: first.fromBaseIndex } },
            { id: 'no', label: '留在原地', value: { move: false } },
        ],
        'pirate_king_move',
    );
    const ms = queueInteraction(ctx.matchState, {
        ...interaction,
        data: { ...interaction.data, continuationContext: { scoringBaseIndex, remaining } },
    });
    return { events: [], matchState: ms };
}

/**
 * 海盗副官 afterScoring：你可以移动你的两个随从到其他基地而不是弃牌堆
 * 描述：「特殊：在本基地计分后，你可以移动你的两个随从到其他基地而不是弃牌堆。」
 * 注意：描述说"你的两个随从"，不仅仅是 first_mate 自身
 *
 * 规则：所有玩家的 pirate_first_mate 都可以在计分后触发（不限当前回合玩家）。
 * 每个 first_mate 的 controller 独立处理自己的随从移动。
 */
function pirateFirstMateAfterScoring(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    const scoringBaseIndex = ctx.baseIndex;
    if (scoringBaseIndex === undefined) return [];

    const base = ctx.state.bases[scoringBaseIndex];
    if (!base) return [];

    // 收集计分基地上所有 first_mate（不限当前回合玩家）
    const firstMates = base.minions.filter(m => m.defId === 'pirate_first_mate');
    if (firstMates.length === 0) return [];

    // 无 matchState 时回退自动移动 first_mate 自身
    if (!ctx.matchState) {
        const events: SmashUpEvent[] = [];
        for (const m of firstMates) {
            for (let i = 0; i < ctx.state.bases.length; i++) {
                if (i === scoringBaseIndex) continue;
                events.push(moveMinion(m.uid, m.defId, scoringBaseIndex, i, 'pirate_first_mate', ctx.now));
                break;
            }
        }
        return events;
    }

    // 只有一个可用基地时自动选定目标
    const otherBases = ctx.state.bases
        .map((b, i) => ({ index: i, defId: b.defId }))
        .filter(b => b.index !== scoringBaseIndex);
    if (otherBases.length === 0) return [];

    // 为每个 first_mate 的 controller 创建交互（链式处理多个 first_mate）
    let ms = ctx.matchState;
    for (const mate of firstMates) {
        const controllerId = mate.controller;
        // 收集计分基地上该 controller 的随从
        const myMinions = base.minions.filter(m => m.controller === controllerId);
        if (myMinions.length === 0) continue;

        const options = myMinions.map(m => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const power = getMinionPower(ctx.state, m, scoringBaseIndex);
            return { uid: m.uid, defId: m.defId, baseIndex: scoringBaseIndex, label: `${name} (力量 ${power})` };
        });
        const allOptions = [
            { id: 'skip', label: '跳过（不移动随从）', value: { skip: true } },
            ...buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }),
        ] as any[];
        const interaction = createSimpleChoice(
            `pirate_first_mate_choose_first_${mate.uid}_${ctx.now}`, controllerId,
            '大副：你可以移动至多两个随从到其他基地（选择第1个）', allOptions, 'pirate_first_mate_choose_first',
        );
        ms = queueInteraction(ms, {
            ...interaction,
            data: { ...interaction.data, continuationContext: { scoringBaseIndex, movedCount: 0 } },
        });
    }
    return { events: [], matchState: ms };
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
    const options = myMinions.map(m => ({ uid: m.uid, defId: m.defId, baseIndex: m.baseIndex, label: m.label }));
    const interaction = createSimpleChoice(
        `pirate_dinghy_first_${ctx.now}`, ctx.playerId, '选择要移动的己方随从（至多2个，第1个）', buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }), { sourceId: 'pirate_dinghy_choose_first', targetType: 'minion' }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
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
    const options = buildMinionTargetOptions(
        targets.map(t => ({ uid: t.uid, defId: t.defId, baseIndex: t.baseIndex, label: t.label })),
        {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            effectType: 'affect',
        }
    );
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `pirate_shanghai_minion_${ctx.now}`, ctx.playerId,
        '选择要移动的对手随从', options, // ✅ 直接使用 options
        'pirate_shanghai_choose_minion',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
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

    const options = Array.from(factionSet.keys()).map((fid, i) => ({
        id: `faction-${i}`, label: FACTION_DISPLAY_NAMES[fid] || fid, value: { factionId: fid },
    }));
    const interaction = createSimpleChoice(
        `pirate_sea_dogs_faction_${ctx.now}`, ctx.playerId,
        '水手：指定一个派系', options as any[], 'pirate_sea_dogs_choose_faction',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

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
    const options = myMinions.map(m => ({ uid: m.uid, defId: m.defId, baseIndex: m.baseIndex, label: m.label }));
    const interaction = createSimpleChoice(
        `pirate_powderkeg_${ctx.now}`, ctx.playerId, '选择要牺牲的己方随从（同基地力量≤它的随从也会被消灭）', buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }), { sourceId: 'pirate_powderkeg', targetType: 'minion' }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// 交互解决处理函数（InteractionHandler）
// ============================================================================

/** 移动随从到目标基地的通用辅助：创建选择目标基地的 Interaction */
function buildMoveToBaseInteraction(
    state: SmashUpCore,
    minionUid: string,
    minionDefId: string,
    fromBaseIndex: number,
    interactionIdPrefix: string,
    sourceId: string,
    playerId: string,
    now: number,
    extraData?: Record<string, unknown>,
): InteractionDescriptor | null {
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        if (i === fromBaseIndex) continue;
        const baseDef = getBaseDef(state.bases[i].defId);
        candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
    }
    if (candidates.length === 0) return null;
    const interaction = createSimpleChoice(
        `${interactionIdPrefix}_base_${now}`, playerId, '选择目标基地', buildBaseTargetOptions(candidates, state), { sourceId, targetType: 'base' }
    );
    return {
        ...interaction,
        data: { ...interaction.data, continuationContext: { ...extraData, minionUid, minionDefId, fromBaseIndex } },
    };
}

/** 注册海盗派系的交互解决处理函数 */
export function registerPirateInteractionHandlers(): void {
    // 粗鲁少妇：选择目标后消灭（支持跳过）
    registerInteractionHandler('pirate_saucy_wench', (state, _playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const { minionUid, baseIndex } = selected;
        if (minionUid === undefined || baseIndex === undefined) return undefined;
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return { state, events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, 'pirate_saucy_wench', timestamp)] };
    });

    // 侧翼开炮：选择基地+对手后执行
    registerInteractionHandler('pirate_broadside', (state, _playerId, value, _iData, _random, timestamp) => {
        const { baseIndex, opponentId } = value as { baseIndex: number; opponentId: string };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const events: SmashUpEvent[] = [];
        for (const m of base.minions) {
            if (m.controller === opponentId && getMinionPower(state.core, m, baseIndex) <= 2) {
                events.push(destroyMinion(m.uid, m.defId, baseIndex, m.owner, 'pirate_broadside', timestamp));
            }
        }
        return { state, events };
    });

    // 加农炮第一步：消灭第一个目标，显示第二个选择（带跳过）
    registerInteractionHandler('pirate_cannon_choose_first', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        
        // 消灭第一个随从
        const events: SmashUpEvent[] = [destroyMinion(target.uid, target.defId, baseIndex, target.owner, 'pirate_cannon', timestamp)];
        
        // 收集剩余的力量≤2的随从（排除刚消灭的）
        const remaining: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            for (const m of state.core.bases[i].minions) {
                if (m.uid === minionUid) continue;
                if (getMinionPower(state.core, m, i) <= 2) {
                    const def = getCardDef(m.defId) as MinionCardDef | undefined;
                    const name = def?.name ?? m.defId;
                    const baseDef = getBaseDef(state.core.bases[i].defId);
                    const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                    const power = getMinionPower(state.core, m, i);
                    remaining.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseName}` });
                }
            }
        }
        
        // 没有剩余目标，直接结束
        if (remaining.length === 0) return { state, events };
        
        // 显示第二个选择（带跳过按钮）
        const next = createSimpleChoice(
            `pirate_cannon_second_${timestamp}`, playerId,
            '加农炮：点击第二个要消灭的力量≤2的随从（可选）',
            [
                { id: 'skip', label: '跳过（不消灭第二个）', value: { skip: true } },
                ...buildMinionTargetOptions(remaining, { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' }),
            ] as any[],
            'pirate_cannon_choose_second'
        );
        return { state: queueInteraction(state, next), events };
    });

    // 加农炮第二步：消灭第二个随从（支持跳过）
    registerInteractionHandler('pirate_cannon_choose_second', (state, _playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const { minionUid, baseIndex } = selected;
        if (minionUid === undefined || baseIndex === undefined) return undefined;
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return { state, events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, 'pirate_cannon', timestamp)] };
    });

    // 上海：选择随从后，链式选择目标基地
    registerInteractionHandler('pirate_shanghai_choose_minion', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const minion = base.minions.find(m => m.uid === minionUid);
        if (!minion) return undefined;
        const next = buildMoveToBaseInteraction(
            state.core,
            minionUid,
            minion.defId,
            baseIndex,
            'pirate_shanghai',
            'pirate_shanghai_choose_base',
            playerId,
            timestamp,
        );
        return next ? { state: queueInteraction(state, next), events: [] } : undefined;
    });

    // 上海：选择基地后移动
    registerInteractionHandler('pirate_shanghai_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: destBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBaseIndex: number };
        if (!ctx) return undefined;
        return { state, events: [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBaseIndex, destBase, 'pirate_shanghai', timestamp)] };
    });

    // 海狗第一步：选择派系后，链式选择来源基地
    registerInteractionHandler('pirate_sea_dogs_choose_faction', (state, playerId, value, _iData, _random, timestamp) => {
        const { factionId } = value as { factionId: string };
        // 找有该派系对手随从的基地
        const candidates: { baseIndex: number; count: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            const count = state.core.bases[i].minions.filter(m => {
                if (m.controller === playerId) return false;
                const def = getCardDef(m.defId);
                return def?.faction === factionId;
            }).length;
            if (count > 0) {
                const baseDef = getBaseDef(state.core.bases[i].defId);
                candidates.push({ baseIndex: i, count, label: `${baseDef?.name ?? `基地 ${i + 1}`} (${count} 个该派系随从)` });
            }
        }
        if (candidates.length === 0) return { state, events: [] };
        const next = createSimpleChoice(
            `pirate_sea_dogs_from_${timestamp}`, playerId, '选择来源基地（移动该派系所有对手随从）', buildBaseTargetOptions(candidates, state.core), { sourceId: 'pirate_sea_dogs_choose_from', targetType: 'base' }
        );
        (next.data as any).continuationContext = { factionId };
        return { state: queueInteraction(state, next), events: [] };
    });

    // 海狗第二步：选择来源基地后，链式选择目标基地
    registerInteractionHandler('pirate_sea_dogs_choose_from', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: fromBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { factionId: string };
        if (!ctx) return undefined;
        const destCandidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            if (i === fromBase) continue;
            const baseDef = getBaseDef(state.core.bases[i].defId);
            destCandidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        if (destCandidates.length === 0) return { state, events: [] };
        const next = createSimpleChoice(
            `pirate_sea_dogs_to_${timestamp}`, playerId, '选择目标基地', buildBaseTargetOptions(destCandidates, state.core), { sourceId: 'pirate_sea_dogs_choose_to', targetType: 'base' }
        );
        (next.data as any).continuationContext = { factionId: ctx.factionId, fromBase };
        return { state: queueInteraction(state, next), events: [] };
    });

    // 海狗第三步：选择目标基地后，批量移动（只移动不受保护的随从）
    registerInteractionHandler('pirate_sea_dogs_choose_to', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: destBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { factionId: string; fromBase: number };
        if (!ctx) return undefined;
        const base = state.core.bases[ctx.fromBase];
        if (!base) return { state, events: [] };
        const events: SmashUpEvent[] = [];
        for (const m of base.minions) {
            if (m.controller === playerId) continue;
            const def = getCardDef(m.defId);
            if (def?.faction !== ctx.factionId) continue;
            // 检查是否受保护（手动检查，因为这里是批量移动而非构建选项）
            if (isMinionProtected(state.core, m, ctx.fromBase, playerId, 'affect')) continue;
            events.push(moveMinion(m.uid, m.defId, ctx.fromBase, destBase, 'pirate_sea_dogs', timestamp));
        }
        return { state, events };
    });

    // 小艇第一步：选择随从后，链式选择目标基地
    registerInteractionHandler('pirate_dinghy_choose_first', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const minion = base.minions.find(m => m.uid === minionUid);
        if (!minion) return undefined;
        const next = buildMoveToBaseInteraction(
            state.core,
            minionUid,
            minion.defId,
            baseIndex,
            'pirate_dinghy_first',
            'pirate_dinghy_first_choose_base',
            playerId,
            timestamp,
        );
        return next ? { state: queueInteraction(state, next), events: [] } : undefined;
    });

    // 小艇第一步选基地后：移动，然后链式选第二个随从
    registerInteractionHandler('pirate_dinghy_first_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: destBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBaseIndex: number };
        if (!ctx) return undefined;
        const events: SmashUpEvent[] = [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBaseIndex, destBase, 'pirate_dinghy', timestamp)];
        const remaining: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            for (const m of state.core.bases[i].minions) {
                if (m.controller === playerId && m.uid !== ctx.minionUid) {
                    const def = getCardDef(m.defId) as MinionCardDef | undefined;
                    const name = def?.name ?? m.defId;
                    const baseDef = getBaseDef(state.core.bases[i].defId);
                    const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                    const power = getMinionPower(state.core, m, i);
                    remaining.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseName}` });
                }
            }
        }
        if (remaining.length === 0) return { state, events };
        const next = createSimpleChoice(
            `pirate_dinghy_second_${timestamp}`, playerId, '选择第二个要移动的随从（可选）',
            [
                { id: 'skip', label: '跳过（不移动第二个）', value: { skip: true } },
                ...buildMinionTargetOptions(remaining, { state: state.core, sourcePlayerId: playerId }),
            ] as any[],
            { sourceId: 'pirate_dinghy_choose_second', targetType: 'minion' }
        );
        return { state: queueInteraction(state, next), events };
    });

    // 小艇第二步：选择随从后，链式选择目标基地（支持跳过）
    registerInteractionHandler('pirate_dinghy_choose_second', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const { minionUid, baseIndex } = selected;
        if (minionUid === undefined || baseIndex === undefined) return undefined;
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const minion = base.minions.find(m => m.uid === minionUid);
        if (!minion) return undefined;
        const next = buildMoveToBaseInteraction(
            state.core,
            minionUid,
            minion.defId,
            baseIndex,
            'pirate_dinghy_second',
            'pirate_dinghy_second_choose_base',
            playerId,
            timestamp,
        );
        return next ? { state: queueInteraction(state, next), events: [] } : undefined;
    });

    // 小艇第二步选基地后：移动
    registerInteractionHandler('pirate_dinghy_second_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: destBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBaseIndex: number };
        if (!ctx) return undefined;
        return { state, events: [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBaseIndex, destBase, 'pirate_dinghy', timestamp)] };
    });

    // 全速航行：选择随从后，链式选择目标基地
    registerInteractionHandler('pirate_full_sail_choose_minion', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { done?: boolean; minionUid?: string; baseIndex?: number };
        if (selected.done) return { state, events: [] };
        const { minionUid, baseIndex } = selected as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex!];
        if (!base) return undefined;
        const minion = base.minions.find(m => m.uid === minionUid);
        if (!minion) return undefined;
        const movedUids = ((iData as any)?.continuationContext as { movedUids?: string[] })?.movedUids ?? [];
        const next = buildMoveToBaseInteraction(
            state.core,
            minionUid!,
            minion.defId,
            baseIndex!,
            'pirate_full_sail',
            'pirate_full_sail_choose_base',
            playerId,
            timestamp,
            { movedUids },
        );
        return next ? { state: queueInteraction(state, next), events: [] } : undefined;
    });

    // 全速航行：选择基地后移动，然后循环选择下一个
    registerInteractionHandler('pirate_full_sail_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: destBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBaseIndex: number; movedUids?: string[] };
        if (!ctx) return undefined;
        const events: SmashUpEvent[] = [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBaseIndex, destBase, 'pirate_full_sail', timestamp)];
        const newMovedUids = [...(ctx.movedUids ?? []), ctx.minionUid];
        const nextInteraction = buildFullSailChooseMinionInteraction(state.core, playerId, timestamp, newMovedUids);
        if (nextInteraction) {
            return { state: queueInteraction(state, nextInteraction), events };
        }
        return { state, events };
    });

    // 炸药桶：选择牺牲随从后执行
    registerInteractionHandler('pirate_powderkeg', (state, _playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const minion = base.minions.find(m => m.uid === minionUid);
        if (!minion) return undefined;
        const power = getMinionPower(state.core, minion, baseIndex);
        const events: SmashUpEvent[] = [];
        events.push(destroyMinion(minion.uid, minion.defId, baseIndex, minion.owner, 'pirate_powderkeg', timestamp));
        for (const m of base.minions) {
            if (m.uid === minionUid) continue;
            if (getMinionPower(state.core, m, baseIndex) <= power) {
                events.push(destroyMinion(m.uid, m.defId, baseIndex, m.owner, 'pirate_powderkeg', timestamp));
            }
        }
        return { state, events };
    });

    // 海盗王：确认是否移动到计分基地（链式处理多个海盗王）
    registerInteractionHandler('pirate_king_move', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { move: boolean; uid?: string; defId?: string; fromBaseIndex?: number };
        const ctx = iData?.continuationContext as { scoringBaseIndex: number; remaining: { uid: string; defId: string; fromBaseIndex: number; controller: string }[] } | undefined;
        if (!ctx) return undefined;
        const events: SmashUpEvent[] = [];

        if (selected.move && selected.uid && selected.defId !== undefined && selected.fromBaseIndex !== undefined) {
            events.push(moveMinion(selected.uid, selected.defId, selected.fromBaseIndex, ctx.scoringBaseIndex, 'pirate_king', timestamp));
        }

        // 处理剩余海盗王
        const remaining = ctx.remaining ?? [];
        if (remaining.length > 0) {
            const next = remaining[0];
            const rest = remaining.slice(1);
            const baseDef = getBaseDef(state.core.bases[ctx.scoringBaseIndex]?.defId ?? '');
            const baseName = baseDef?.name ?? `基地 ${ctx.scoringBaseIndex + 1}`;
            const interaction = createSimpleChoice(
                `pirate_king_move_${timestamp}`, next.controller,
                `海盗王：是否移动到即将计分的「${baseName}」？`,
                [
                    { id: 'yes', label: '移动到该基地', value: { move: true, uid: next.uid, defId: next.defId, fromBaseIndex: next.fromBaseIndex } },
                    { id: 'no', label: '留在原地', value: { move: false } },
                ],
                'pirate_king_move',
            );
            return { state: queueInteraction(state, { ...interaction, data: { ...interaction.data, continuationContext: { scoringBaseIndex: ctx.scoringBaseIndex, remaining: rest } } }), events };
        }

        return { state, events };
    });

    // 大副第一步：选择第一个随从后，选择目标基地
    registerInteractionHandler('pirate_first_mate_choose_first', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const { minionUid, baseIndex } = selected;
        if (minionUid === undefined || baseIndex === undefined) return undefined;
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const minion = base.minions.find(m => m.uid === minionUid);
        if (!minion) return undefined;
        const ctx = iData?.continuationContext as { scoringBaseIndex: number; movedCount: number } | undefined;
        if (!ctx) return undefined;
        const next = buildMoveToBaseInteraction(
            state.core, minionUid, minion.defId, baseIndex,
            'pirate_first_mate', 'pirate_first_mate_choose_base',
            playerId, timestamp,
            { scoringBaseIndex: ctx.scoringBaseIndex, movedCount: ctx.movedCount },
        );
        return next ? { state: queueInteraction(state, next), events: [] } : undefined;
    });

    // 大副选基地后：移动，如果还没移动第二个则链式选第二个
    registerInteractionHandler('pirate_first_mate_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: destBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBaseIndex: number; scoringBaseIndex: number; movedCount: number };
        if (!ctx) return undefined;
        const events: SmashUpEvent[] = [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBaseIndex, destBase, 'pirate_first_mate', timestamp)];
        const newMovedCount = ctx.movedCount + 1;

        // 最多移动两个随从
        if (newMovedCount >= 2) return { state, events };

        // 收集计分基地上剩余己方随从（排除已移动的）
        const scoringBase = state.core.bases[ctx.scoringBaseIndex];
        if (!scoringBase) return { state, events };
        const remaining = scoringBase.minions.filter(
            m => m.controller === playerId && m.uid !== ctx.minionUid
        );
        if (remaining.length === 0) return { state, events };

        const options = remaining.map(m => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const power = getMinionPower(state.core, m, ctx.scoringBaseIndex);
            return { uid: m.uid, defId: m.defId, baseIndex: ctx.scoringBaseIndex, label: `${name} (力量 ${power})` };
        });
        const allOptions = [
            { id: 'skip', label: '跳过（不移动第二个）', value: { skip: true } },
            ...buildMinionTargetOptions(options, { state: state.core, sourcePlayerId: playerId }),
        ] as any[];
        const interaction = createSimpleChoice(
            `pirate_first_mate_choose_second_${timestamp}`, playerId,
            '大副：选择第2个要移动的随从（可选）', allOptions, 'pirate_first_mate_choose_first',
        );
        return {
            state: queueInteraction(state, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { scoringBaseIndex: ctx.scoringBaseIndex, movedCount: newMovedCount } },
            }),
            events,
        };
    });
}
