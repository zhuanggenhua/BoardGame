/**
 * 大杀四方 - 诡术师派系能力
 *
 * 主题：陷阱、干扰对手、消灭随从
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { destroyMinion, getMinionPower, buildMinionTargetOptions, resolveOrPrompt, buildAbilityFeedback, createSkipOption } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { CardsDiscardedEvent, CardsDrawnEvent, OngoingDetachedEvent, SmashUpEvent, LimitModifiedEvent } from '../domain/types';
import type { MinionCardDef } from '../domain/types';
import { drawCards } from '../domain/utils';
import { registerProtection, registerRestriction, registerTrigger } from '../domain/ongoingEffects';
import { getCardDef, getBaseDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { FACTION_DISPLAY_NAMES } from '../domain/ids';
import { getOpponentLabel } from '../domain/utils';

/** 侏儒 onPlay：消灭力量低于己方随从数量的随从 */
function tricksterGnome(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const myMinionCount = base.minions.filter(m => m.controller === ctx.playerId).length + 1;
    const targets = base.minions.filter(
        m => m.uid !== ctx.cardUid && getMinionPower(ctx.state, m, ctx.baseIndex) < myMinionCount
    );
    const options = targets.map(t => {
        const def = getCardDef(t.defId) as MinionCardDef | undefined;
        const name = def?.name ?? t.defId;
        const power = getMinionPower(ctx.state, t, ctx.baseIndex);
        return { uid: t.uid, defId: t.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
    });
    // "你可以"效果：添加跳过选项
    const minionOptions = buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' });
    minionOptions.push(createSkipOption());
    return resolveOrPrompt(ctx, minionOptions, {
        id: 'trickster_gnome',
        title: '选择要消灭的随从（力量低于己方随从数量），或跳过',
        sourceId: 'trickster_gnome',
        targetType: 'minion',
        autoResolveIfSingle: false,
    }, (value) => {
        // 检查 skip 标记
        if ((value as any).skip) return { events: [] };
        
        const { minionUid } = value as { minionUid?: string };
        if (!minionUid) return { events: [] };
        
        const target = targets.find(t => t.uid === minionUid);
        if (!target) return { events: [] };
        return { events: [destroyMinion(target.uid, target.defId, ctx.baseIndex, target.owner, undefined, 'trickster_gnome', ctx.now)] };
    });
}

/** 带走宝物 onPlay：每个其他玩家随机弃两张手牌 */
function tricksterTakeTheShinies(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const player = ctx.state.players[pid];
        if (player.hand.length === 0) continue;

        // 随机选择至多2?
        const handCopy = [...player.hand];
        const discardUids: string[] = [];
        const count = Math.min(2, handCopy.length);
        for (let i = 0; i < count; i++) {
            const idx = Math.floor(ctx.random.random() * handCopy.length);
            discardUids.push(handCopy[idx].uid);
            handCopy.splice(idx, 1);
        }

        const evt: CardsDiscardedEvent = {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: pid, cardUids: discardUids },
            timestamp: ctx.now,
        };
        events.push(evt);
    }
    return { events };
}

/** 幻想破碎 onPlay：消灭一个已打出到随从或基地上的行动?*/
function tricksterDisenchant(ctx: AbilityContext): AbilityResult {
    // 收集所有已打出的持续行动卡（描述无"对手"限定，包含自己的）
    const targets: { uid: string; defId: string; ownerId: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const ongoing of base.ongoingActions) {
            const def = getCardDef(ongoing.defId);
            const name = def?.name ?? ongoing.defId;
            targets.push({ uid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId, label: `${name} (基地行动)` });
        }
        for (const m of base.minions) {
            for (const attached of m.attachedActions) {
                const def = getCardDef(attached.defId);
                const name = def?.name ?? attached.defId;
                targets.push({ uid: attached.uid, defId: attached.defId, ownerId: attached.ownerId, label: `${name} (附着行动)` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = targets.map((t, i) => ({
        id: `action-${i}`, label: t.label, value: { cardUid: t.uid, defId: t.defId, ownerId: t.ownerId }, _source: 'ongoing' as const,
    }));
    const interaction = createSimpleChoice(
        `trickster_disenchant_${ctx.now}`, ctx.playerId,
        '选择要消灭的行动牌', options as any[],
        { sourceId: 'trickster_disenchant', targetType: 'ongoing' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 隐蔽迷雾 onPlay：打出当回合给予额外随从（与大法师同理，ongoing 能力在进入场上时生效） */
function tricksterEnshroudingMistOnPlay(ctx: AbilityContext): AbilityResult {
    // 打出当回合立即给予额外随从（限定到此基地）
    return {
        events: [{
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                playerId: ctx.playerId,
                limitType: 'minion' as const,
                delta: 1,
                reason: 'trickster_enshrouding_mist',
                restrictToBase: ctx.baseIndex,
            },
            timestamp: ctx.now,
        } as LimitModifiedEvent],
    };
}

/** 注册诡术师派系所有能力*/
export function registerTricksterAbilities(): void {
    registerAbility('trickster_gnome', 'onPlay', tricksterGnome);
    // 带走宝物（行动卡）：每个对手随机弃两张手牌
    registerAbility('trickster_take_the_shinies', 'onPlay', tricksterTakeTheShinies);
    // 幻想破碎（行动卡）：消灭一个已打出的行动卡
    registerAbility('trickster_disenchant', 'onPlay', tricksterDisenchant);
    // 小妖精?onDestroy：被消灭后抽1张牌 + 对手随机?张牌
    registerAbility('trickster_gremlin', 'onDestroy', tricksterGremlinOnDestroy);
    // 沉睡印记（行动卡）：对手下回合不能打行动
    registerAbility('trickster_mark_of_sleep', 'onPlay', tricksterMarkOfSleep);
    // 封路（ongoing）：打出时选择一个派系
    registerAbility('trickster_block_the_path', 'onPlay', tricksterBlockThePath);
    // 隐蔽迷雾（ongoing）：打出当回合也给予额外随从（与大法师同理）
    registerAbility('trickster_enshrouding_mist', 'onPlay', tricksterEnshroudingMistOnPlay);

    // 注册 ongoing 拦截?
    registerTricksterOngoingEffects();
}

/** 注册诡术师派系的交互解决处理函数 */
export function registerTricksterInteractionHandlers(): void {
    // 侏儒：选择目标后消灭（支持跳过）
    registerInteractionHandler('trickster_gnome', (state, _playerId, value, _iData, _random, timestamp) => {
        // 统一检查 skip 标记
        if ((value as any).skip) return { state, events: [] };
        
        const { minionUid, baseIndex } = value as { minionUid?: string; baseIndex?: number };
        if (!minionUid || baseIndex === undefined) return { state, events: [] };
        
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return { state, events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'trickster_gnome', timestamp)] };
    });

    // 幻想破碎：选择行动卡后消灭
    registerInteractionHandler('trickster_disenchant', (state, _playerId, value, _iData, _random, timestamp) => {
        const { cardUid: ongoingUid, defId, ownerId } = value as { cardUid: string; defId: string; ownerId: string };
        return { state, events: [{ type: SU_EVENTS.ONGOING_DETACHED, payload: { cardUid: ongoingUid, defId, ownerId, reason: 'trickster_disenchant' }, timestamp }] };
    });

    // 沉睡印记：选择对手后标记（下回合生效）
    registerInteractionHandler('trickster_mark_of_sleep', (state, _playerId, value, _iData, _random, _timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { pid } = value as { pid: string };
        // 添加沉睡标记，在对手的下一个回合开始时生效
        const currentMarked = state.core.sleepMarkedPlayers ?? [];
        if (currentMarked.includes(pid)) return { state, events: [] };
        return {
            state: { ...state, core: { ...state.core, sleepMarkedPlayers: [...currentMarked, pid] } },
            events: [],
        };
    });

    // 封路：选择派系后，将派系信息存入 ongoing 的 metadata
    registerInteractionHandler('trickster_block_the_path', (state, _playerId, value, iData, _random, _timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { factionId } = value as { factionId: string };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; baseIndex: number };
        if (!ctx) return undefined;
        // 找到刚附着的 ongoing 并更新 metadata
        const newBases = state.core.bases.map((base, i) => {
            if (i !== ctx.baseIndex) return base;
            return {
                ...base,
                ongoingActions: base.ongoingActions.map(o => {
                    if (o.uid !== ctx.cardUid) return o;
                    return { ...o, metadata: { blockedFaction: factionId } };
                }),
            };
        });
        return { state: { ...state, core: { ...state.core, bases: newBases } }, events: [] };
    });
}

/** 小妖精?onDestroy：被消灭后抽1张牌 + 每个对手随机?张牌 */
function tricksterGremlinOnDestroy(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // ?张牌
    const player = ctx.state.players[ctx.playerId];
    if (player && player.deck.length > 0) {
        const { drawnUids } = drawCards(player, 1, ctx.random);
        if (drawnUids.length > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: ctx.playerId, count: 1, cardUids: drawnUids },
                timestamp: ctx.now,
            } as CardsDrawnEvent);
        }
    }

    // 每个对手随机?张牌
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];
        if (!opponent || opponent.hand.length === 0) continue;
        const idx = Math.floor(ctx.random.random() * opponent.hand.length);
        const discardUid = opponent.hand[idx].uid;
        events.push({
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: pid, cardUids: [discardUid] },
            timestamp: ctx.now,
        } as CardsDiscardedEvent);
    }

    return { events };
}

/** 封路 onPlay（ongoing）：选择一个派系，该派系随从不能被打出到此基地 */
function tricksterBlockThePath(ctx: AbilityContext): AbilityResult {
    // 收集场上所有派系
    const factionSet = new Set<string>();
    for (const base of ctx.state.bases) {
        for (const m of base.minions) {
            const def = getCardDef(m.defId);
            if (def?.faction) factionSet.add(def.faction);
        }
    }
    // 也从所有玩家手牌中收集派系
    for (const pid of ctx.state.turnOrder) {
        const player = ctx.state.players[pid];
        for (const c of player.hand) {
            const def = getCardDef(c.defId);
            if (def?.faction) factionSet.add(def.faction);
        }
    }
    if (factionSet.size === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = Array.from(factionSet).map((fid, i) => ({
        id: `faction-${i}`, label: FACTION_DISPLAY_NAMES[fid] || fid, value: { factionId: fid },
    }));
    const interaction = createSimpleChoice(
        `trickster_block_the_path_${ctx.now}`, ctx.playerId,
        '封路：选择一个派系（该派系随从不能被打出到此基地）', options as any[],
        { sourceId: 'trickster_block_the_path', autoCancelOption: true },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, { ...interaction, data: { ...interaction.data, continuationContext: { cardUid: ctx.cardUid, baseIndex: ctx.baseIndex } } }) };
}

/** 沉睡印记 onPlay：选择一个对手，其下回合不能打行动卡 */
function tricksterMarkOfSleep(ctx: AbilityContext): AbilityResult {
    // 可以选择任何玩家（包括自己）
    const allPlayers = ctx.state.turnOrder;
    const options = allPlayers.map((pid, i) => ({
        id: `player-${i}`, 
        label: pid === ctx.playerId ? '你自己' : getOpponentLabel(pid), 
        value: { pid },
    }));
    const interaction = createSimpleChoice(
        `trickster_mark_of_sleep_${ctx.now}`, ctx.playerId,
        '选择一个玩家（其下回合不能打行动卡）', options as any[],
        { sourceId: 'trickster_mark_of_sleep', autoCancelOption: true },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// executeMarkOfSleep 已移除，沉睡印记改为标记模式（在对手回合开始时生效）

// ============================================================================
// Ongoing 拦截器注册?
// ============================================================================

/** 注册诡术师派系的 ongoing 拦截?*/
function registerTricksterOngoingEffects(): void {
    // 小矮妖：其他玩家打出力量更低的随从到同基地时消灭该随从
    registerTrigger('trickster_leprechaun', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        // 找到 leprechaun 所在基地
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const leprechaun = base.minions.find(m => m.defId === 'trickster_leprechaun');
            if (!leprechaun) continue;
            // 只在同基地触?
            if (i !== trigCtx.baseIndex) continue;
            // 只对其他玩家触发
            if (leprechaun.controller === trigCtx.playerId) continue;
            // 检查打出的随从力量是否低于 leprechaun
            const lepPower = getMinionPower(trigCtx.state, leprechaun, i);
            const triggerMinion = base.minions.find(m => m.uid === trigCtx.triggerMinionUid);
            if (!triggerMinion) continue;
            const trigPower = getMinionPower(trigCtx.state, triggerMinion, i);
            if (trigPower < lepPower) {
                return [{
                    type: SU_EVENTS.MINION_DESTROYED,
                    payload: {
                        minionUid: trigCtx.triggerMinionUid,
                        minionDefId: trigCtx.triggerMinionDefId,
                        fromBaseIndex: i,
                        ownerId: trigCtx.playerId,
                        reason: 'trickster_leprechaun',
                    },
                    timestamp: trigCtx.now,
                }];
            }
        }
        return [];
    });

    // 布朗尼：被对手卡牌效果影响时，对手弃两张牌
    // "影响"包含：消灭、移动、负力量修改、附着对手行动卡（规则术语映射）
    registerTrigger('trickster_brownie', 'onMinionAffected', (trigCtx) => {
        if (!trigCtx.triggerMinionDefId || trigCtx.triggerMinionDefId !== 'trickster_brownie') return [];
        const brownieOwner = trigCtx.triggerMinion?.controller;
        if (!brownieOwner || brownieOwner === trigCtx.playerId) return [];
        // 对手（触发影响的玩家）弃两张牌
        const opponent = trigCtx.state.players[trigCtx.playerId];
        if (!opponent || opponent.hand.length === 0) return [];
        const discardCount = Math.min(2, opponent.hand.length);
        const discardUids: string[] = [];
        const handCopy = [...opponent.hand];
        for (let j = 0; j < discardCount; j++) {
            const idx = Math.floor(trigCtx.random.random() * handCopy.length);
            discardUids.push(handCopy[idx].uid);
            handCopy.splice(idx, 1);
        }
        return [{
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: trigCtx.playerId, cardUids: discardUids },
            timestamp: trigCtx.now,
        }];
    });

    // 迷雾笼罩：此基地上可额外打出一个随从到此基地（回合开始时给基地限定额度）
    registerTrigger('trickster_enshrouding_mist', 'onTurnStart', (trigCtx) => {
        for (let bi = 0; bi < trigCtx.state.bases.length; bi++) {
            const base = trigCtx.state.bases[bi];
            const mist = base.ongoingActions.find(o => o.defId === 'trickster_enshrouding_mist');
            if (!mist) continue;
            // 只在拥有者的回合触发
            if (mist.ownerId !== trigCtx.playerId) continue;
            return [{
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: {
                    playerId: mist.ownerId,
                    limitType: 'minion' as const,
                    delta: 1,
                    reason: 'trickster_enshrouding_mist',
                    restrictToBase: bi,
                },
                timestamp: trigCtx.now,
            }];
        }
        return [];
    });

    // 藏身处：保护同基地己方随从不受对手行动卡影响（消耗型：触发后自毁）
    registerProtection('trickster_hideout', 'action', (ctx) => {
        // 检查目标随从是否附着了 hideout（附着在随从上的情况）
        const attachedHideout = ctx.targetMinion.attachedActions.find(a => a.defId === 'trickster_hideout');
        if (attachedHideout) {
            // 只保护 Hideout 拥有者的随从，且行动卡来自对手
            return ctx.targetMinion.controller === attachedHideout.ownerId && ctx.sourcePlayerId !== attachedHideout.ownerId;
        }
        // 也检查基地上的 ongoing（打在基地上的情况）
        const base = ctx.state.bases[ctx.targetBaseIndex];
        const baseHideout = base?.ongoingActions.find(o => o.defId === 'trickster_hideout');
        if (baseHideout) {
            // 只保护 Hideout 拥有者的随从，且行动卡来自对手
            return ctx.targetMinion.controller === baseHideout.ownerId && ctx.sourcePlayerId !== baseHideout.ownerId;
        }
        return false;
    }, { consumable: true });

    // 火焰陷阱：其他玩家打出随从到此基地时消灭该随从
    registerTrigger('trickster_flame_trap', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const trap = base.ongoingActions.find(o => o.defId === 'trickster_flame_trap');
            if (!trap || i !== trigCtx.baseIndex) continue;
            // 只对其他玩家触发
            if (trap.ownerId === trigCtx.playerId) continue;
            return [
                // 消灭打出的随从
                {
                    type: SU_EVENTS.MINION_DESTROYED,
                    payload: {
                        minionUid: trigCtx.triggerMinionUid,
                        minionDefId: trigCtx.triggerMinionDefId,
                        fromBaseIndex: i,
                        ownerId: trigCtx.playerId,
                        reason: 'trickster_flame_trap',
                    },
                    timestamp: trigCtx.now,
                },
                // 消灭火焰陷阱本身
                {
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: {
                        cardUid: trap.uid,
                        defId: trap.defId,
                        ownerId: trap.ownerId,
                        reason: 'trickster_flame_trap_self_destruct',
                    },
                    timestamp: trigCtx.now,
                },
            ];
        }
        return [];
    });

    // 封路：指定派系不能打出随从到此基地（描述无"对手"限定，对所有玩家生效）
    registerRestriction('trickster_block_the_path', 'play_minion', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return false;
        const blockAction = base.ongoingActions.find(o => o.defId === 'trickster_block_the_path');
        if (!blockAction) return false;
        // 检查被限制的派系
        const blockedFaction = blockAction.metadata?.blockedFaction as string | undefined;
        if (!blockedFaction) return false;
        // 检查打出的随从是否属于被限制的派系
        const minionDefId = ctx.extra?.minionDefId as string | undefined;
        if (!minionDefId) return false;
        const def = getCardDef(minionDefId);
        return def?.faction === blockedFaction;
    });

    // 付笛手的钱：对手打出随从后弃一张牌
    registerTrigger('trickster_pay_the_piper', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || trigCtx.baseIndex === undefined) return [];
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const piper = base.ongoingActions.find(o => o.defId === 'trickster_pay_the_piper');
            if (!piper || i !== trigCtx.baseIndex) continue;
            // 只对其他玩家触发
            if (piper.ownerId === trigCtx.playerId) continue;
            // 对手随机弃一张牌
            const opponent = trigCtx.state.players[trigCtx.playerId];
            if (!opponent || opponent.hand.length === 0) continue;
            const idx = Math.floor(trigCtx.random.random() * opponent.hand.length);
            return [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: trigCtx.playerId, cardUids: [opponent.hand[idx].uid] },
                timestamp: trigCtx.now,
            }];
        }
        return [];
    });
}
