/**
 * 大杀四方 - 忍者派系能力
 *
 * 主题：消灭随从、潜入基地
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { destroyMinion, moveMinion, getMinionPower, grantExtraMinion, buildMinionTargetOptions, buildBaseTargetOptions, isSpecialLimitBlocked, emitSpecialLimitUsed, buildAbilityFeedback } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, MinionReturnedEvent, OngoingDetachedEvent, MinionPlayedEvent } from '../domain/types';
import { getCardDef, getBaseDef } from '../data/cards';
import type { MinionCardDef } from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';

/** 注册忍者派系所有能力*/
export function registerNinjaAbilities(): void {
    // 忍者大师：消灭本基地一个随从
    registerAbility('ninja_master', 'onPlay', ninjaMaster);
    // 猛虎刺客：消灭本基地一个力量≤3的随从
    registerAbility('ninja_tiger_assassin', 'onPlay', ninjaTigerAssassin);
    // 手里剑（行动卡）：消灭一个力量≤3的随从（任意基地）
    registerAbility('ninja_seeing_stars', 'onPlay', ninjaSeeingStars);
    // 欺骗之道（行动卡）：移动己方一个随从到另一个基地
    registerAbility('ninja_way_of_deception', 'onPlay', ninjaWayOfDeception);
    // 伪装（行动卡）：将己方一个随从返回手牌，然后打出一个随从到该基地
    registerAbility('ninja_disguise', 'onPlay', ninjaDisguise);
    // 渗透（ongoing 行动卡）：onPlay 消灭基地上一个已有的战术
    registerAbility('ninja_infiltrate', 'onPlay', ninjaInfiltrateOnPlay);
    // 忍（special）：基地计分前打出到该基地
    registerAbility('ninja_shinobi', 'special', ninjaShinobi);
    // 侍僧（special）：回手并额外打出随从
    registerAbility('ninja_acolyte', 'special', ninjaAcolyte);
    // 隐忍（special action）：基地计分前打出手牌中的随从到该基地
    registerAbility('ninja_hidden_ninja', 'special', ninjaHiddenNinja);

    // 注册 ongoing 拦截器
    registerNinjaOngoingEffects();
}

/** 忍者大师?onPlay：消灭本基地一个随从*/
function ninjaMaster(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.minions.filter(m => m.uid !== ctx.cardUid);
    if (targets.length === 0) return { events: [] };
    const options = targets.map(t => {
        const def = getCardDef(t.defId) as MinionCardDef | undefined;
        const name = def?.name ?? t.defId;
        const power = getMinionPower(ctx.state, t, ctx.baseIndex);
        return { uid: t.uid, defId: t.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
    });
    const skipOption = { id: 'skip', label: '跳过', value: { skip: true } };
    const interaction = createSimpleChoice(
        `ninja_master_${ctx.now}`, ctx.playerId,
        '选择要消灭的随从（可跳过）',
        [...buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }), skipOption] as any[],
        { sourceId: 'ninja_master', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 猛虎刺客 onPlay：消灭本基地一个力量≤3的随从*/
function ninjaTigerAssassin(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.minions.filter(
        m => m.uid !== ctx.cardUid && getMinionPower(ctx.state, m, ctx.baseIndex) <= 3
    );
    if (targets.length === 0) return { events: [] };
    const options = targets.map(t => {
        const def = getCardDef(t.defId) as MinionCardDef | undefined;
        const name = def?.name ?? t.defId;
        const power = getMinionPower(ctx.state, t, ctx.baseIndex);
        return { uid: t.uid, defId: t.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
    });
    const skipOption = { id: 'skip', label: '跳过', value: { skip: true } };
    const interaction = createSimpleChoice(
        `ninja_tiger_assassin_${ctx.now}`, ctx.playerId, '选择要消灭的力量≤3的随从（可跳过）', [...buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }), skipOption] as any[], { sourceId: 'ninja_tiger_assassin', targetType: 'minion' }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 手里剑 onPlay：消灭一个力量≤3的随从（任意基地，包含己方） */
function ninjaSeeingStars(ctx: AbilityContext): AbilityResult {
    const targets: { uid: string; defId: string; baseIndex: number; owner: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (getMinionPower(ctx.state, m, i) <= 3) {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const baseDef = getBaseDef(ctx.state.bases[i].defId);
                const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                const power = getMinionPower(ctx.state, m, i);
                targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, label: `${name} (力量 ${power}) @ ${baseName}` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = targets.map(t => ({ uid: t.uid, defId: t.defId, baseIndex: t.baseIndex, label: t.label }));
    const interaction = createSimpleChoice(
        `ninja_seeing_stars_${ctx.now}`, ctx.playerId, '选择要消灭的力量≤3的随从', buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }), { sourceId: 'ninja_seeing_stars', targetType: 'minion' }
        );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ninja_poison (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（-4力量）
// onPlay 效果：消灭目标随从身上的所有战术（附着的行动卡）
registerAbility('ninja_poison', 'onPlay', ninjaPoisonOnPlay);

/**
 * 下毒 onPlay：消灭目标随从身上的所有战术（附着的行动卡）
 * 描述："打出到一个随从上。消灭在它身上的任意数量的战术。"
 */
function ninjaPoisonOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const events: SmashUpEvent[] = [];

    // 找到目标随从
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events };
    const target = base.minions.find(m => m.uid === ctx.targetMinionUid);
    if (!target) return { events };

    // 消灭目标随从身上所有附着的行动卡（排除刚附着的 ninja_poison 自身）
    for (const a of target.attachedActions) {
        if (a.uid === ctx.cardUid) continue;
        events.push({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: a.uid,
                defId: a.defId,
                ownerId: a.ownerId,
                reason: 'ninja_poison_destroy',
            },
            timestamp: ctx.now,
        } as OngoingDetachedEvent);
    }

    return { events };
}

/**
 * 渗透 onPlay：消灭基地上一个已有的战术（ongoing 行动卡）
 * 描述："打出到一个基地上。消灭一个已经被打出到这的战术。"
 */
function ninjaInfiltrateOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    // 收集基地上的 ongoing 行动卡（排除刚打出的渗透自身）
    // 基地上的 ongoing：base.ongoingActions + 随从身上的 attachedActions
    const targets: { uid: string; defId: string; ownerId: string; label: string; onMinion?: boolean }[] = [];
    for (const o of base.ongoingActions) {
        if (o.uid === ctx.cardUid) continue; // 排除自身
        const def = getCardDef(o.defId);
        targets.push({ uid: o.uid, defId: o.defId, ownerId: o.ownerId, label: def?.name ?? o.defId });
    }
    for (const m of base.minions) {
        for (const a of m.attachedActions) {
            if (a.uid === ctx.cardUid) continue;
            const def = getCardDef(a.defId);
            const mDef = getCardDef(m.defId);
            targets.push({ uid: a.uid, defId: a.defId, ownerId: a.ownerId, label: `${def?.name ?? a.defId}（附着在 ${mDef?.name ?? m.defId} 上）`, onMinion: true });
        }
    }

    if (targets.length === 0) return { events: [] };

    // 只有一个目标时自动消灭
    if (targets.length === 1) {
        return {
            events: [{
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: { cardUid: targets[0].uid, defId: targets[0].defId, ownerId: targets[0].ownerId, reason: 'ninja_infiltrate_destroy' },
                timestamp: ctx.now,
            } as OngoingDetachedEvent],
        };
    }

    // 多个目标时创建选择交互
    const options = targets.map((t, i) => ({
        id: `tactic-${i}`,
        label: t.label,
        value: { cardUid: t.uid, defId: t.defId, ownerId: t.ownerId },
        _source: 'ongoing' as const,
    }));
    const interaction = createSimpleChoice(
        `ninja_infiltrate_${ctx.now}`, ctx.playerId,
        '选择要消灭的战术', options as any[],
        { sourceId: 'ninja_infiltrate_destroy', targetType: 'ongoing' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 欺骗之道 onPlay：选择己方一个随从移动到另一个基地*/
function ninjaWayOfDeception(ctx: AbilityContext): AbilityResult {
    const myMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            const power = getMinionPower(ctx.state, m, i);
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            myMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseName}` });
        }
    }
    if (myMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = myMinions.map(m => ({ uid: m.uid, defId: m.defId, baseIndex: m.baseIndex, label: m.label }));
    const interaction = createSimpleChoice(
        `ninja_way_of_deception_${ctx.now}`, ctx.playerId, '选择要移动的己方随从', buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }), { sourceId: 'ninja_way_of_deception_choose_minion', targetType: 'minion' }
        );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 伪装 onPlay：选择一个基地里的1-2个己方随从，打出等量手牌随从到该基地，再将选中随从收回手牌
 *
 * 流程：选择基地 → 多选1-2个随从 → 逐个选手牌随从打出 → 收回旧随从
 */
function ninjaDisguise(ctx: AbilityContext): AbilityResult {
    // 找出有己方随从的基地
    const baseCandidates: { baseIndex: number; count: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const count = ctx.state.bases[i].minions.filter(m => m.controller === ctx.playerId).length;
        if (count === 0) continue;
        const baseDef = getBaseDef(ctx.state.bases[i].defId);
        baseCandidates.push({ baseIndex: i, count, label: `${baseDef?.name ?? `基地 ${i + 1}`} (${count} 个己方随从)` });
    }
    if (baseCandidates.length === 0) return { events: [] };

    // 只有一个基地时直接跳到选随从
    if (baseCandidates.length === 1) {
        return ninjaDisguiseSelectMinions(ctx, baseCandidates[0].baseIndex);
    }

    const interaction = createSimpleChoice(
        `ninja_disguise_base_${ctx.now}`, ctx.playerId,
        '伪装：选择一个基地', buildBaseTargetOptions(baseCandidates, ctx.state),
        { sourceId: 'ninja_disguise_choose_base', targetType: 'base', autoCancelOption: true }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, { ...interaction, data: { ...interaction.data, continuationContext: { cardUid: ctx.cardUid } } }) };
}

/** 伪装：在指定基地多选1-2个己方随从 */
function ninjaDisguiseSelectMinions(ctx: AbilityContext, baseIndex: number): AbilityResult {
    const base = ctx.state.bases[baseIndex];
    const myMinions = base.minions.filter(m => m.controller === ctx.playerId);
    if (myMinions.length === 0) return { events: [] };

    // 手牌中可打出的随从数量决定最多能选几个
    const player = ctx.state.players[ctx.playerId];
    const handMinions = player.hand.filter(c => c.type === 'minion' && c.uid !== ctx.cardUid);
    const maxSelect = Math.min(2, myMinions.length, handMinions.length);
    if (maxSelect === 0) return { events: [] };

    const options = myMinions.map(m => {
        const def = getCardDef(m.defId) as MinionCardDef | undefined;
        const name = def?.name ?? m.defId;
        const power = getMinionPower(ctx.state, m, baseIndex);
        return { uid: m.uid, defId: m.defId, baseIndex, label: `${name} (力量 ${power})` };
    });
    const interaction = createSimpleChoice(
        `ninja_disguise_select_${ctx.now}`, ctx.playerId,
        `伪装：选择 1-${maxSelect} 个己方随从`, buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }), { sourceId: 'ninja_disguise_choose_minions', targetType: 'minion' }, undefined, { min: 1, max: maxSelect }
        );
    return { events: [], matchState: queueInteraction(ctx.matchState, { ...interaction, data: { ...interaction.data, continuationContext: { cardUid: ctx.cardUid, baseIndex } } }) };
}

// ============================================================================
// Special 时机能力
// ============================================================================

/**
 * 影舞者 special：基地计分前，可以从手牌打出到该基地
 * 限制：每个基地只能使用一次忍者的能力（通过 specialLimitGroup 数据驱动）
 */
function ninjaShinobi(ctx: AbilityContext): AbilityResult {
    // 限制组检查：该基地本回合是否已使用过同组 special 能力
    if (isSpecialLimitBlocked(ctx.state, 'ninja_shinobi', ctx.baseIndex)) return { events: [] };

    // 检查该随从是否在手牌中
    const player = ctx.state.players[ctx.playerId];
    const inHand = player.hand.find(c => c.defId === 'ninja_shinobi');
    if (!inHand) return { events: [] };

    const def = getCardDef('ninja_shinobi');
    if (!def || def.type !== 'minion') return { events: [] };

    const events: SmashUpEvent[] = [];

    // 记录限制组使用
    const limitEvt = emitSpecialLimitUsed(ctx.playerId, 'ninja_shinobi', ctx.baseIndex, ctx.now);
    if (limitEvt) events.push(limitEvt);

    const playedEvt: MinionPlayedEvent = {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId: ctx.playerId,
            cardUid: inHand.uid,
            defId: 'ninja_shinobi',
            baseIndex: ctx.baseIndex,
            power: (def as MinionCardDef).power,
        },
        timestamp: ctx.now,
    };
    events.push(playedEvt);
    return { events };
}

/**
 * 侍僧 special：将此随从从基地返回手牌，然后额外打出一个随从
 * 前置条件：如果你还未打出随从卡
 * 限制：每个基地只能使用一次忍者的能力（通过 specialLimitGroup 数据驱动）
 */
function ninjaAcolyte(ctx: AbilityContext): AbilityResult {
    // 限制组检查
    if (isSpecialLimitBlocked(ctx.state, 'ninja_acolyte', ctx.baseIndex)) return { events: [] };

    // 前置条件：本回合还未打出随从
    const player = ctx.state.players[ctx.playerId];
    if (player.minionsPlayed > 0) return { events: [] };

    const events: SmashUpEvent[] = [];

    // 记录限制组使用
    const limitEvt = emitSpecialLimitUsed(ctx.playerId, 'ninja_acolyte', ctx.baseIndex, ctx.now);
    if (limitEvt) events.push(limitEvt);

    // 返回手牌
    const returnEvt: MinionReturnedEvent = {
        type: SU_EVENTS.MINION_RETURNED,
        payload: {
            minionUid: ctx.cardUid,
            minionDefId: ctx.defId,
            fromBaseIndex: ctx.baseIndex,
            toPlayerId: ctx.playerId,
            reason: 'ninja_acolyte',
        },
        timestamp: ctx.now,
    };
    events.push(returnEvt);

    // 额外打出一个随从到这个基地
    events.push(grantExtraMinion(ctx.playerId, 'ninja_acolyte', ctx.now, ctx.baseIndex));

    return { events };
}

/**
 * 隐忍 special action：基地计分前，选择手牌中一个随从打出到该基地
 * 限制：每个基地只能使用一次忍者的能力（通过 specialLimitGroup 数据驱动）
 */
function ninjaHiddenNinja(ctx: AbilityContext): AbilityResult {
    // 限制组检查
    if (isSpecialLimitBlocked(ctx.state, 'ninja_hidden_ninja', ctx.baseIndex)) return { events: [] };

    const player = ctx.state.players[ctx.playerId];
    const minionCards = player.hand.filter(c => c.type === 'minion');
    if (minionCards.length === 0) return { events: [] };

    // 记录限制组使用
    const limitEvt = emitSpecialLimitUsed(ctx.playerId, 'ninja_hidden_ninja', ctx.baseIndex, ctx.now);
    const events: SmashUpEvent[] = limitEvt ? [limitEvt] : [];

    const options = minionCards.map((c, i) => {
        const def = getCardDef(c.defId) as MinionCardDef | undefined;
        const name = def?.name ?? c.defId;
        const power = def?.power ?? 0;
        return { id: `hand-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, power }, _source: 'hand' as const };
    });
    const interaction = createSimpleChoice(
        `ninja_hidden_ninja_${ctx.now}`, ctx.playerId,
        '选择要打出到该基地的随从', options as any[], 'ninja_hidden_ninja',
    );
    return { events, matchState: queueInteraction(ctx.matchState, { ...interaction, data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex } } }) };
}

// ============================================================================
// Ongoing 拦截器注册?
// ============================================================================

/** 注册忍者派系的 ongoing 拦截?*/
function registerNinjaOngoingEffects(): void {
    // 烟雾弹：保护同基地己方随从不受对手行动卡影响
    registerProtection('ninja_smoke_bomb', 'action', (ctx) => {
        // 只保护烟雾弹所在基地的、烟雾弹拥有者的随从
        for (const base of ctx.state.bases) {
            const bomb = base.ongoingActions.find(o => o.defId === 'ninja_smoke_bomb');
            if (!bomb) continue;
            const baseIdx = ctx.state.bases.indexOf(base);
            if (baseIdx !== ctx.targetBaseIndex) continue;
            // 只保护烟雾弹拥有者的随从，且来源是对手?
            return ctx.targetMinion.controller === bomb.ownerId && ctx.sourcePlayerId !== bomb.ownerId;
        }
        return false;
    });

    // 烟雾弹：拥有者回合开始时自毁
    registerTrigger('ninja_smoke_bomb', 'onTurnStart', (trigCtx) => {
        const events: SmashUpEvent[] = [];
        for (const base of trigCtx.state.bases) {
            for (const ongoing of base.ongoingActions) {
                if (ongoing.defId !== 'ninja_smoke_bomb') continue;
                if (ongoing.ownerId !== trigCtx.playerId) continue;
                events.push({
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: {
                        cardUid: ongoing.uid,
                        defId: ongoing.defId,
                        ownerId: ongoing.ownerId,
                        reason: 'ninja_smoke_bomb_self_destruct',
                    },
                    timestamp: trigCtx.now,
                });
            }
        }
        return events;
    });

    // 暗杀：回合结束时消灭目标随从（附着在随从上）?ongoing?
    registerTrigger('ninja_assassination', 'onTurnEnd', (trigCtx) => {
        const events: SmashUpEvent[] = [];
        // 查找所有附着了?assassination 的随从
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            for (const m of base.minions) {
                const hasAssassination = m.attachedActions.some(a => a.defId === 'ninja_assassination');
                if (hasAssassination) {
                    events.push({
                        type: SU_EVENTS.MINION_DESTROYED,
                        payload: {
                            minionUid: m.uid,
                            minionDefId: m.defId,
                            fromBaseIndex: i,
                            ownerId: m.owner,
                            reason: 'ninja_assassination',
                        },
                        timestamp: trigCtx.now,
                    });
                }
            }
        }
        return events;
    });

    // 渗透：附着此卡的随从不受基地能力影响（广义保护）?
    registerProtection('ninja_infiltrate', 'affect', (ctx) => {
        // 检查目标随从是否附着了?infiltrate
        return ctx.targetMinion.attachedActions.some(a => a.defId === 'ninja_infiltrate');
    });
    // 渗透：拥有者下回合开始时自毁
    registerTrigger('ninja_infiltrate', 'onTurnStart', (trigCtx) => {
        const events: SmashUpEvent[] = [];
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            for (const m of trigCtx.state.bases[i].minions) {
                for (const a of m.attachedActions) {
                    if (a.defId !== 'ninja_infiltrate') continue;
                    if (a.ownerId !== trigCtx.playerId) continue;
                    events.push({
                        type: SU_EVENTS.ONGOING_DETACHED,
                        payload: {
                            cardUid: a.uid,
                            defId: a.defId,
                            ownerId: a.ownerId,
                            reason: 'ninja_infiltrate_expired',
                        },
                        timestamp: trigCtx.now,
                    });
                }
            }
        }
        return events;
    });
}

// ============================================================================
// 交互解决处理函数（InteractionHandler）
// ============================================================================

/** 注册忍者派系的交互解决处理函数 */
export function registerNinjaInteractionHandlers(): void {
    // 忍者大师：选择目标后消灭（可跳过）
    registerInteractionHandler('ninja_master', (state, _playerId, value, _iData, _random, timestamp) => {
        if (value && (value as any).skip) return { state, events: [] };
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return { state, events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, 'ninja_master', timestamp)] };
    });

    // 猛虎刺客：选择目标后消灭（可跳过）
    registerInteractionHandler('ninja_tiger_assassin', (state, _playerId, value, _iData, _random, timestamp) => {
        if (value && (value as any).skip) return { state, events: [] };
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return { state, events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, 'ninja_tiger_assassin', timestamp)] };
    });

    // 手里剑：选择目标后消灭
    registerInteractionHandler('ninja_seeing_stars', (state, _playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return { state, events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, 'ninja_seeing_stars', timestamp)] };
    });

    // 欺骗之道：选择随从后，链式选择目标基地
    registerInteractionHandler('ninja_way_of_deception_choose_minion', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const minion = base.minions.find(m => m.uid === minionUid);
        if (!minion) return undefined;
        const candidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            if (i === baseIndex) continue;
            const baseDef = getBaseDef(state.core.bases[i].defId);
            candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        if (candidates.length === 0) return undefined;
        const next = createSimpleChoice(
            `ninja_way_of_deception_base_${timestamp}`, playerId, '选择目标基地', buildBaseTargetOptions(candidates, state.core), { sourceId: 'ninja_way_of_deception_choose_base', targetType: 'base' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: minion.defId, fromBaseIndex: baseIndex } } }), events: [] };
    });

    // 欺骗之道：选择基地后移动
    registerInteractionHandler('ninja_way_of_deception_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: destBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBaseIndex: number };
        if (!ctx) return undefined;
        return { state, events: [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBaseIndex, destBase, 'ninja_way_of_deception', timestamp)] };
    });

    // 伪装：选择基地后，链式选择随从
    registerInteractionHandler('ninja_disguise_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { baseIndex } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { cardUid: string };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const myMinions = base.minions.filter(m => m.controller === playerId);
        if (myMinions.length === 0) return { state, events: [] };
        const player = state.core.players[playerId];
        const handMinions = player.hand.filter(c => c.type === 'minion' && c.uid !== ctx?.cardUid);
        const maxSelect = Math.min(2, myMinions.length, handMinions.length);
        if (maxSelect === 0) return { state, events: [] };
        const options = myMinions.map(m => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const power = getMinionPower(state.core, m, baseIndex);
            return { uid: m.uid, defId: m.defId, baseIndex, label: `${name} (力量 ${power})` };
        });
        const next = createSimpleChoice(
            `ninja_disguise_select_${timestamp}`, playerId,
            `伪装：选择 1-${maxSelect} 个己方随从`, buildMinionTargetOptions(options, { state: state.core, sourcePlayerId: playerId }), { sourceId: 'ninja_disguise_choose_minions', targetType: 'minion' }, undefined, { min: 1, max: maxSelect }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { cardUid: ctx?.cardUid, baseIndex } } }), events: [] };
    });

    // 伪装：多选随从后，链式选择手牌随从打出（第一个）
    registerInteractionHandler('ninja_disguise_choose_minions', (state, playerId, value, iData, _random, timestamp) => {
        // 多选时 value 是数组
        const selections = (Array.isArray(value) ? value : [value]) as { minionUid: string; baseIndex: number }[];
        const ctx = (iData as any)?.continuationContext as { cardUid: string; baseIndex: number };
        if (!ctx) return undefined;
        const returnUids = selections.map(s => s.minionUid);
        // 选择第一个手牌随从打出
        const player = state.core.players[playerId];
        const handMinions = player.hand.filter(c => c.type === 'minion' && c.uid !== ctx.cardUid);
        if (handMinions.length === 0) return { state, events: [] };
        const handOptions = handMinions.map((c, i) => {
            const def = getCardDef(c.defId) as MinionCardDef | undefined;
            const name = def?.name ?? c.defId;
            const power = def?.power ?? 0;
            return { id: `hand-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, power }, _source: 'hand' as const };
        });
        const next = createSimpleChoice(
            `ninja_disguise_play1_${timestamp}`, playerId,
            '伪装：选择要打出的手牌随从', handOptions as any[], 'ninja_disguise_choose_play1',
        );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { baseIndex: ctx.baseIndex, returnUids, totalToPlay: returnUids.length, playedUids: [] } } }), events: [] };
    });

    // 伪装：选择第一个打出的随从后
    registerInteractionHandler('ninja_disguise_choose_play1', (state, playerId, value, iData, _random, timestamp) => {
        const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
        const ctx = (iData as any)?.continuationContext as { baseIndex: number; returnUids: string[]; totalToPlay: number; playedUids: string[] };
        if (!ctx) return undefined;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid, defId, baseIndex: ctx.baseIndex, power },
            timestamp,
        };
        const events: SmashUpEvent[] = [playedEvt];
        const playedUids = [...ctx.playedUids, cardUid];
        // 如果还需要打出第二个
        if (playedUids.length < ctx.totalToPlay) {
            const player = state.core.players[playerId];
            const handMinions = player.hand.filter(c => c.type === 'minion' && !playedUids.includes(c.uid));
            if (handMinions.length > 0) {
                const handOptions = handMinions.map((c, i) => {
                    const def = getCardDef(c.defId) as MinionCardDef | undefined;
                    const name = def?.name ?? c.defId;
                    const pw = def?.power ?? 0;
                    return { id: `hand-${i}`, label: `${name} (力量 ${pw})`, value: { cardUid: c.uid, defId: c.defId, power: pw }, _source: 'hand' as const };
                });
                const next = createSimpleChoice(
                    `ninja_disguise_play2_${timestamp}`, playerId,
                    '伪装：选择第二个要打出的手牌随从', handOptions as any[], 'ninja_disguise_choose_play2',
                );
                return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { baseIndex: ctx.baseIndex, returnUids: ctx.returnUids } } }), events };
            }
        }
        // 打出完毕，收回旧随从
        for (const uid of ctx.returnUids) {
            const base = state.core.bases[ctx.baseIndex];
            const minion = base?.minions.find(m => m.uid === uid);
            if (minion) {
                events.push({
                    type: SU_EVENTS.MINION_RETURNED,
                    payload: { minionUid: uid, minionDefId: minion.defId, fromBaseIndex: ctx.baseIndex, toPlayerId: minion.owner, reason: 'ninja_disguise' },
                    timestamp,
                } as MinionReturnedEvent);
            }
        }
        return { state, events };
    });

    // 伪装：选择第二个打出的随从后，收回旧随从
    registerInteractionHandler('ninja_disguise_choose_play2', (state, playerId, value, iData, _random, timestamp) => {
        const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
        const ctx = (iData as any)?.continuationContext as { baseIndex: number; returnUids: string[] };
        if (!ctx) return undefined;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid, defId, baseIndex: ctx.baseIndex, power },
            timestamp,
        };
        const events: SmashUpEvent[] = [playedEvt];
        // 收回旧随从
        for (const uid of ctx.returnUids) {
            const base = state.core.bases[ctx.baseIndex];
            const minion = base?.minions.find(m => m.uid === uid);
            if (minion) {
                events.push({
                    type: SU_EVENTS.MINION_RETURNED,
                    payload: { minionUid: uid, minionDefId: minion.defId, fromBaseIndex: ctx.baseIndex, toPlayerId: minion.owner, reason: 'ninja_disguise' },
                    timestamp,
                } as MinionReturnedEvent);
            }
        }
        return { state, events };
    });

    // 隐忍：选择手牌随从打出到基地
    registerInteractionHandler('ninja_hidden_ninja', (state, playerId, value, iData, _random, timestamp) => {
        const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
        const baseIndex = ((iData as any)?.continuationContext as { baseIndex: number })?.baseIndex;
        if (baseIndex === undefined) return undefined;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid, defId, baseIndex, power },
            timestamp,
        };
        return { state, events: [playedEvt] };
    });

    // 渗透：选择要消灭的战术
    registerInteractionHandler('ninja_infiltrate_destroy', (state, _playerId, value, _iData, _random, timestamp) => {
        const { cardUid: ongoingUid, defId, ownerId } = value as { cardUid: string; defId: string; ownerId: string };
        return {
            state,
            events: [{
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: { cardUid: ongoingUid, defId, ownerId, reason: 'ninja_infiltrate_destroy' },
                timestamp,
            } as OngoingDetachedEvent],
        };
    });
}
