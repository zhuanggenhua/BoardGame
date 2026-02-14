/**
 * 大杀四方 - 海盗派系能力
 *
 * 主题：移动随从、消灭低力量随从
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { destroyMinion, addPowerCounter, moveMinion, getMinionPower, buildMinionTargetOptions, buildBaseTargetOptions } from '../domain/abilityHelpers';
import type { SmashUpEvent, MinionCardDef, SmashUpCore, MinionDestroyedEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { MatchState } from '../../../engine/types';
import { getCardDef, getBaseDef } from '../data/cards';
import { registerTrigger, registerInterceptor } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';

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
    // 海盗（海盗）：被消灭时移动到其他基地而非进入弃牌堆?
    registerInterceptor('pirate_buccaneer', buccaneerDestroyInterceptor);
}

/** 粗鲁少妇 onPlay：消灭本基地一个力量≤2的随从*/
function pirateSaucyWench(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.minions.filter(
        m => m.uid !== ctx.cardUid && getMinionPower(ctx.state, m, ctx.baseIndex) <= 2
    );
    if (targets.length === 0) return { events: [] };
    const options = targets.map(t => {
        const def = getCardDef(t.defId) as MinionCardDef | undefined;
        const name = def?.name ?? t.defId;
        const power = getMinionPower(ctx.state, t, ctx.baseIndex);
        return { uid: t.uid, defId: t.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
    });
    const interaction = createSimpleChoice(
        `pirate_saucy_wench_${ctx.now}`, ctx.playerId,
        '选择要消灭的力量≤2的随从', buildMinionTargetOptions(options), 'pirate_saucy_wench',
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
            candidates.push({ baseIndex: i, opponentId: pid, count, label: `${baseName}（对手 ${pid}，${count}个弱随从）` });
        }
    }
    if (candidates.length === 0) return { events: [] };
    const options = candidates.map((c, i) => ({ id: `target-${i}`, label: c.label, value: { baseIndex: c.baseIndex, opponentId: c.opponentId } }));
    const interaction = createSimpleChoice(
        `pirate_broadside_${ctx.now}`, ctx.playerId,
        '选择基地和对手，消灭该对手所有力量≤2的随从', options, 'pirate_broadside',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 加农炮 onPlay：消灭至多两个力量≤2的随从 */
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
    if (allTargets.length === 0) return { events: [] };
    // 创建选择第一个目标的 Interaction
    const options = allTargets.map(t => ({ uid: t.uid, defId: t.defId, baseIndex: t.baseIndex, label: t.label }));
    const interaction = createSimpleChoice(
        `pirate_cannon_first_${ctx.now}`, ctx.playerId,
        '选择第一个要消灭的力量≤2的随从（至多2个）', buildMinionTargetOptions(options), 'pirate_cannon_choose_first',
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
        ...buildMinionTargetOptions(myMinions),
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
// 事件拦截器（替代效果）?
// ============================================================================

/**
 * 海盗 (Buccaneer) 替代效果：被消灭时移动到其他基地
 *
 * MVP：自动选择第一个可用的其他基地。无其他基地时正常消灭?
 */
function buccaneerDestroyInterceptor(
    state: SmashUpCore,
    event: SmashUpEvent
): SmashUpEvent | undefined {
    if (event.type !== SU_EVENTS.MINION_DESTROYED) return undefined;
    const { minionUid, minionDefId, fromBaseIndex } = (event as MinionDestroyedEvent).payload;
    if (minionDefId !== 'pirate_buccaneer') return undefined;

    // 找到第一个可用的其他基地
    for (let i = 0; i < state.bases.length; i++) {
        if (i === fromBaseIndex) continue;
        return moveMinion(minionUid, minionDefId, fromBaseIndex, i, 'pirate_buccaneer', event.timestamp);
    }
    // 无其他基地可移，不收回拦截（正常消灭?
    return undefined;
}

// ============================================================================
// ongoing 效果触发器?
// ============================================================================

/** 海盗船?beforeScoring：自动移动到即将计分的基地（MVP：自动执行，不收回询问） */
function pirateKingBeforeScoring(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const scoringBaseIndex = ctx.baseIndex;
    if (scoringBaseIndex === undefined) return events;

    // 遍历所有基地，找到不收回在计分基地上的 pirate_king 并移过去
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (i === scoringBaseIndex) continue;
        for (const m of ctx.state.bases[i].minions) {
            if (m.defId === 'pirate_king') {
                events.push(moveMinion(m.uid, m.defId, i, scoringBaseIndex, 'pirate_king', ctx.now));
            }
        }
    }
    return events;
}

/** 海盗副官 afterScoring：移动到其他基地而非进入弃牌堆（MVP：自动选第一个其他基地） */
function pirateFirstMateAfterScoring(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const scoringBaseIndex = ctx.baseIndex;
    if (scoringBaseIndex === undefined) return events;

    const base = ctx.state.bases[scoringBaseIndex];
    if (!base) return events;

    for (const m of base.minions) {
        if (m.defId !== 'pirate_first_mate') continue;
        // 选择第一个可用的其他基地
        for (let i = 0; i < ctx.state.bases.length; i++) {
            if (i === scoringBaseIndex) continue;
            events.push(moveMinion(m.uid, m.defId, scoringBaseIndex, i, 'pirate_first_mate', ctx.now));
            break;
        }
    }
    return events;
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
        `pirate_dinghy_first_${ctx.now}`, ctx.playerId,
        '选择要移动的己方随从（至多2个，第1个）', buildMinionTargetOptions(options), 'pirate_dinghy_choose_first',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 上海 onPlay：移动一个对手随从到另一个基地*/
function pirateShanghai(ctx: AbilityContext): AbilityResult {
    // 收集所有对手随从
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
    const options = targets.map(t => ({ uid: t.uid, defId: t.defId, baseIndex: t.baseIndex, label: t.label }));
    const interaction = createSimpleChoice(
        `pirate_shanghai_minion_${ctx.now}`, ctx.playerId,
        '选择要移动的对手随从', buildMinionTargetOptions(options), 'pirate_shanghai_choose_minion',
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
        id: `faction-${i}`, label: fid, value: { factionId: fid },
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
        `pirate_powderkeg_${ctx.now}`, ctx.playerId,
        '选择要牺牲的己方随从（同基地力量≤它的随从也会被消灭）', buildMinionTargetOptions(options), 'pirate_powderkeg',
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
        `${interactionIdPrefix}_base_${now}`, playerId,
        '选择目标基地', buildBaseTargetOptions(candidates), sourceId,
    );
    return {
        ...interaction,
        data: { ...interaction.data, continuationContext: { ...extraData, minionUid, minionDefId, fromBaseIndex } },
    };
}

/** 注册海盗派系的交互解决处理函数 */
export function registerPirateInteractionHandlers(): void {
    // 粗鲁少妇：选择目标后消灭
    registerInteractionHandler('pirate_saucy_wench', (state, _playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
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

    // 加农炮第一步：消灭第一个目标，如有剩余则链式选第二个
    registerInteractionHandler('pirate_cannon_choose_first', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const events: SmashUpEvent[] = [destroyMinion(target.uid, target.defId, baseIndex, target.owner, 'pirate_cannon', timestamp)];
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
        if (remaining.length === 0) return { state, events };
        const next = createSimpleChoice(
            `pirate_cannon_second_${timestamp}`, playerId,
            '选择第二个要消灭的力量≤2的随从（可选）', buildMinionTargetOptions(remaining), 'pirate_cannon_choose_second',
        );
        return { state: queueInteraction(state, next), events };
    });

    // 加农炮第二步
    registerInteractionHandler('pirate_cannon_choose_second', (state, _playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
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
            `pirate_sea_dogs_from_${timestamp}`, playerId,
            '选择来源基地（移动该派系所有对手随从）', buildBaseTargetOptions(candidates), 'pirate_sea_dogs_choose_from',
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
            `pirate_sea_dogs_to_${timestamp}`, playerId,
            '选择目标基地', buildBaseTargetOptions(destCandidates), 'pirate_sea_dogs_choose_to',
        );
        (next.data as any).continuationContext = { factionId: ctx.factionId, fromBase };
        return { state: queueInteraction(state, next), events: [] };
    });

    // 海狗第三步：选择目标基地后，批量移动
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
            `pirate_dinghy_second_${timestamp}`, playerId,
            '选择第二个要移动的随从（可选）', buildMinionTargetOptions(remaining), 'pirate_dinghy_choose_second',
        );
        return { state: queueInteraction(state, next), events };
    });

    // 小艇第二步：选择随从后，链式选择目标基地
    registerInteractionHandler('pirate_dinghy_choose_second', (state, playerId, value, _iData, _random, timestamp) => {
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
}
