/**
 * 大杀四方 - 诡术师派系能力
 *
 * 主题：陷阱、干扰对手、消灭随从
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    destroyMinion,
    getMinionPower,
    buildMinionTargetOptions,
    resolveOrPrompt,
    buildAbilityFeedback,
    createSkipOption,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type {
    CardsDiscardedEvent,
    CardsDrawnEvent,
    OngoingDetachedEvent,
    SmashUpEvent,
    LimitModifiedEvent,
    TriggerQueuedEvent,
    PowerCounterAddedEvent,
    BreakpointModifiedEvent,
} from '../domain/types';
import type { MinionCardDef } from '../domain/types';
import { drawCards, matchesDefId } from '../domain/utils';
import { registerInterceptor, registerProtection, registerRestriction, registerTrigger } from '../domain/ongoingEffects';
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
        displayMode: 'card' as const,
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
    registerTricksterPodAbilities();
}

function tricksterEnshroudingMistPodTalent(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                playerId: ctx.playerId,
                limitType: 'minion' as const,
                delta: 1,
                reason: 'trickster_enshrouding_mist_pod',
                restrictToBase: ctx.baseIndex,
            },
            timestamp: ctx.now,
        } as LimitModifiedEvent],
    };
}

function tricksterGnomePodSpecial(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const myCount = base.minions.filter(m => m.controller === ctx.playerId).length;
    if (myCount <= 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };

    const targets = base.minions.filter(m => getMinionPower(ctx.state, m, ctx.baseIndex) < myCount);
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const options = targets.map(t => {
        const def = getCardDef(t.defId) as MinionCardDef | undefined;
        const name = def?.name ?? t.defId;
        const power = getMinionPower(ctx.state, t, ctx.baseIndex);
        return { uid: t.uid, defId: t.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
    });
    const minionOptions = buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' });
    minionOptions.push(createSkipOption());

    return resolveOrPrompt(ctx, minionOptions, {
        id: 'trickster_gnome_pod',
        title: '侏儒：你可以消灭这里一个力量低于你在此基地随从数量的随从（或跳过）',
        sourceId: 'trickster_gnome_pod',
        targetType: 'minion',
        autoResolveIfSingle: false,
    }, (value) => {
        if ((value as any).skip) return { events: [] };
        const { minionUid } = value as { minionUid?: string };
        if (!minionUid) return { events: [] };
        const target = targets.find(m => m.uid === minionUid);
        if (!target) return { events: [] };
        return { events: [destroyMinion(target.uid, target.defId, ctx.baseIndex, target.owner, ctx.playerId, 'trickster_gnome_pod', ctx.now)] };
    });
}

function registerTricksterPodAbilities(): void {
    registerAbility('trickster_take_the_shinies_pod', 'onPlay', tricksterTakeTheShinies);
    registerAbility('trickster_mark_of_sleep_pod', 'onPlay', tricksterMarkOfSleepPod);
    registerAbility('trickster_pixie_pod', 'onPlay', tricksterPixiePodOnPlay);
    registerAbility('trickster_enshrouding_mist_pod', 'talent', tricksterEnshroudingMistPodTalent);
    registerAbility('trickster_hideout_pod', 'talent', tricksterHideoutPodTalent);
    registerAbility('trickster_gnome_pod', 'special', tricksterGnomePodSpecial);
    registerAbility('trickster_gremlin_pod', 'onDestroy', () => ({ events: [] }));
    registerTricksterPodOngoingEffects();
}

function tricksterHideoutPodTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const owner = ctx.state.players[ctx.playerId];
    if (!owner) return { events: [] };

    // 只允许与“打出到基地上”的持续战术交换（subtype=ongoing 且 ongoingTarget='base'）
    const isPlayOnBaseOngoing = (defId: string) => {
        const def = getCardDef(defId);
        return def?.type === 'action' && def.subtype === 'ongoing' && ((def.ongoingTarget ?? 'base') === 'base');
    };

    const handCandidates = owner.hand.filter(c => c.type === 'action' && isPlayOnBaseOngoing(c.defId));
    const deckCandidates = owner.deck.filter(c => c.type === 'action' && isPlayOnBaseOngoing(c.defId));

    if (handCandidates.length === 0 && deckCandidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }

    const options = [
        ...handCandidates.map((c, i) => {
            const def = getCardDef(c.defId);
            const name = def?.name ?? c.defId;
            return {
                id: `hand-${i}`,
                label: `手牌：${name}`,
                value: { zone: 'hand' as const, cardUid: c.uid, defId: c.defId },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            };
        }),
        ...deckCandidates.map((c, i) => {
            const def = getCardDef(c.defId);
            const name = def?.name ?? c.defId;
            return {
                id: `deck-${i}`,
                label: `牌库：${name}`,
                value: { zone: 'deck' as const, cardUid: c.uid, defId: c.defId },
                _source: 'deck' as const,
                displayMode: 'card' as const,
            };
        }),
        createSkipOption() as any,
    ];

    const interaction = createSimpleChoice(
        `trickster_hideout_pod_swap_${ctx.now}`,
        ctx.playerId,
        '藏身处：选择要交换进来的“打出到基地上”的持续战术（或跳过）',
        options as any[],
        { sourceId: 'trickster_hideout_pod_swap', targetType: 'hand' },
    );
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex, hideoutUid: ctx.cardUid } } as any,
        }),
    };
}

/** 注册诡术师派系的交互解决处理函数 */
export function registerTricksterInteractionHandlers(): void {
    // 侏儒：选择目标后消灭（支持跳过）
    registerInteractionHandler('trickster_gnome', (state, playerId, value, _iData, _random, timestamp) => {
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

    // POD 沉睡印记：一次性写入 noActions / noMove 标记，持续到施放者下回合开始
    registerInteractionHandler('trickster_mark_of_sleep_pod', (state, playerId, value, _iData, _random, _timestamp) => {
        if ((value as any).__cancel__) return { state, events: [] };
        const { noActions, noMove } = value as { noActions: string[]; noMove: string[] };
        const expiresOnTurnNumber = state.core.turnNumber + state.core.turnOrder.length;

        return {
            state: {
                ...state,
                core: {
                    ...state.core,
                    sleepMarkedPlayers: noActions.length ? noActions : undefined,
                    sleepMoveMarkedPlayers: noMove.length ? noMove : undefined,
                    sleepMarkExpiresOnTurnNumber: expiresOnTurnNumber,
                } as any,
            },
            events: [],
        };
    });

    // Pixie（战术）：先消灭一张已打出的战术，再选择 1-2 个己方随从分配两枚 +1 指示物
    registerInteractionHandler('trickster_pixie_pod_action_destroy', (state, playerId, value, _iData, random, timestamp) => {
        if ((value as any).__cancel__) return { state, events: [] };
        const { cardUid, defId, ownerId } = value as { cardUid: string; defId: string; ownerId: string };

        const myMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let bi = 0; bi < state.core.bases.length; bi++) {
            const base = state.core.bases[bi];
            for (const m of base.minions) {
                if (m.controller !== playerId) continue;
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const power = getMinionPower(state.core, m, bi);
                myMinions.push({ uid: m.uid, defId: m.defId, baseIndex: bi, label: `${name} (力量 ${power})` });
            }
        }
        if (myMinions.length === 0) {
            return {
                state,
                events: [{
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: { cardUid, defId, ownerId, reason: 'trickster_pixie_pod_action' },
                    timestamp,
                } as OngoingDetachedEvent],
            };
        }

        const options = myMinions.map((m, i) => ({
            id: `minion-${i}`,
            label: m.label,
            value: { minionUid: m.uid, baseIndex: m.baseIndex },
            _source: 'minion' as const,
            displayMode: 'card' as const,
        }));

        const next = createSimpleChoice(
            `trickster_pixie_pod_action_counters_${timestamp}`,
            playerId,
            '小精灵（战术）：选择 1-2 个己方随从放置两枚 +1 指示物',
            options as any[],
            { sourceId: 'trickster_pixie_pod_action_counters', targetType: 'minion' },
            undefined,
            { min: 1, max: Math.min(2, options.length) },
        );
        return {
            state: queueInteraction(state, {
                ...next,
                data: { ...next.data, continuationContext: { destroy: { cardUid, defId, ownerId } } } as any,
            }),
            events: [{
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: { cardUid, defId, ownerId, reason: 'trickster_pixie_pod_action' },
                timestamp,
            } as OngoingDetachedEvent],
        };
    });

    registerInteractionHandler('trickster_pixie_pod_action_counters', (state, playerId, value, _iData, _random, timestamp) => {
        const selections = (Array.isArray(value) ? value : [value]) as { minionUid?: string; baseIndex?: number }[];
        const valid = selections.filter(s => s.minionUid && s.baseIndex !== undefined) as { minionUid: string; baseIndex: number }[];
        if (valid.length === 0) return { state, events: [] };

        const events: SmashUpEvent[] = [];
        if (valid.length === 1) {
            events.push({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: { minionUid: valid[0].minionUid, baseIndex: valid[0].baseIndex, amount: 2, reason: 'trickster_pixie_pod_action' },
                timestamp,
            } as PowerCounterAddedEvent);
        } else {
            for (const s of valid.slice(0, 2)) {
                events.push({
                    type: SU_EVENTS.POWER_COUNTER_ADDED,
                    payload: { minionUid: s.minionUid, baseIndex: s.baseIndex, amount: 1, reason: 'trickster_pixie_pod_action' },
                    timestamp,
                } as PowerCounterAddedEvent);
            }
        }
        return { state, events };
    });

    registerInteractionHandler('trickster_pixie_pod_minion', (state, playerId, value, _iData, _random, timestamp) => {
        const selections = (Array.isArray(value) ? value : [value]) as { minionUid?: string; baseIndex?: number }[];
        const valid = selections.filter(s => s.minionUid && s.baseIndex !== undefined) as { minionUid: string; baseIndex: number }[];
        if (valid.length === 0) return { state, events: [] };
        const events: SmashUpEvent[] = valid.map(s => ({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: { minionUid: s.minionUid, baseIndex: s.baseIndex, amount: 1, reason: 'trickster_pixie_pod_minion' },
            timestamp,
        } as PowerCounterAddedEvent));
        return { state, events };
    });

    registerInteractionHandler('trickster_flame_trap_pod_bp', (state, _playerId, value, _iData, _random, timestamp) => {
        const yes = (value as any)?.yes === true;
        if (!yes) return { state, events: [] };
        // 选择窗口只会在拥有者回合开始时出现，因此直接定位该拥有者的第一张 trap
        const baseIndex = state.core.bases.findIndex(b => b.ongoingActions.some(o => o.defId === 'trickster_flame_trap_pod'));
        if (baseIndex < 0) return { state, events: [] };
        return {
            state,
            events: [{
                type: SU_EVENTS.BREAKPOINT_MODIFIED,
                payload: { baseIndex, delta: -4, reason: 'trickster_flame_trap_pod' },
                timestamp,
            } as BreakpointModifiedEvent],
        };
    });

    registerInteractionHandler('trickster_block_the_path_pod', (state, _playerId, value, iData, _random, _timestamp) => {
        if ((value as any).__cancel__) return { state, events: [] };
        const { blocked } = value as { blocked: Record<string, string> };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; baseIndex: number };
        if (!ctx) return undefined;
        const newBases = state.core.bases.map((b, i) => {
            if (i !== ctx.baseIndex) return b;
            return {
                ...b,
                ongoingActions: b.ongoingActions.map(o => {
                    if (o.uid !== ctx.cardUid) return o;
                    return { ...o, metadata: { ...(o.metadata ?? {}), blockedFactionsByPlayer: blocked } };
                }),
            };
        });
        return { state: { ...state, core: { ...state.core, bases: newBases } }, events: [] };
    });

    registerInteractionHandler('trickster_hideout_pod_swap', (state, playerId, value, iData, _random, timestamp) => {
        if ((value as any).skip) return { state, events: [] };
        if ((value as any).__cancel__) return { state, events: [] };
        const { zone, cardUid, defId } = value as { zone: 'hand' | 'deck'; cardUid: string; defId: string };
        const ctx = (iData as any)?.continuationContext as { baseIndex: number; hideoutUid: string };
        if (!ctx) return undefined;

        const base = state.core.bases[ctx.baseIndex];
        if (!base) return undefined;
        const hideout = base.ongoingActions.find(o => o.uid === ctx.hideoutUid);
        if (!hideout) return undefined;

        const player = state.core.players[playerId];
        if (!player) return undefined;

        // 1) 从手牌/牌库移除目标战术
        const fromHand = zone === 'hand' ? player.hand.filter(c => c.uid !== cardUid) : player.hand;
        const fromDeck = zone === 'deck' ? player.deck.filter(c => c.uid !== cardUid) : player.deck;

        // 2) 藏身处从基地离场进手牌（swap 的另一半）
        const hideoutCard: CardInstance = { uid: hideout.uid, defId: hideout.defId, type: 'action', owner: hideout.ownerId };

        // 3) 目标战术进入基地 ongoingActions（保持 cardUid）
        const newOngoing = { uid: cardUid, defId, ownerId: playerId, talentUsed: false };

        const newBases = state.core.bases.map((b, i) => {
            if (i !== ctx.baseIndex) return b;
            return {
                ...b,
                ongoingActions: [
                    ...b.ongoingActions.filter(o => o.uid !== hideout.uid),
                    newOngoing,
                ],
            };
        });

        let nextState = {
            ...state,
            core: {
                ...state.core,
                bases: newBases,
                players: {
                    ...state.core.players,
                    [playerId]: {
                        ...player,
                        hand: [...fromHand, hideoutCard],
                        deck: fromDeck,
                    },
                },
            },
        };

        // 4) 交换后：你可以消灭这里一个战斗力≤2的随从（可选）
        const updatedBase = nextState.core.bases[ctx.baseIndex];
        const candidates = updatedBase.minions.filter(m => getMinionPower(nextState.core, m, ctx.baseIndex) <= 2);
        if (candidates.length === 0) return { state: nextState, events: [] };
        const options = candidates.map((m, i) => {
            const mDef = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = mDef?.name ?? m.defId;
            const power = getMinionPower(nextState.core, m, ctx.baseIndex);
            return { id: `m-${i}`, label: `${name} (战斗力 ${power})`, value: { minionUid: m.uid, baseIndex: ctx.baseIndex }, _source: 'minion' as const, displayMode: 'card' as const };
        });
        options.push(createSkipOption() as any);

        const prompt = createSimpleChoice(
            `trickster_hideout_pod_destroy_${timestamp}`,
            playerId,
            '藏身处：你可以消灭这里一个战斗力≤2的随从（或跳过）',
            options as any[],
            { sourceId: 'trickster_hideout_pod_destroy', targetType: 'minion' },
        );
        nextState = queueInteraction(nextState, prompt);
        return { state: nextState, events: [] };
    });

    registerInteractionHandler('trickster_hideout_pod_destroy', (state, playerId, value, _iData, _random, timestamp) => {
        if ((value as any).skip) return { state, events: [] };
        const { minionUid, baseIndex } = value as { minionUid?: string; baseIndex?: number };
        if (!minionUid || baseIndex === undefined) return { state, events: [] };
        const base = state.core.bases[baseIndex];
        const target = base?.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return {
            state,
            events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'trickster_hideout_pod', timestamp)],
        };
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
        { sourceId: 'trickster_block_the_path', targetType: 'generic', autoCancelOption: true },
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
        { sourceId: 'trickster_mark_of_sleep', targetType: 'player', autoCancelOption: true },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** POD 沉睡印记：对每个其他玩家分别选择“不能打出战术”或“不能移动随从”，持续到你下回合开始 */
function tricksterMarkOfSleepPod(ctx: AbilityContext): AbilityResult {
    const otherPlayers = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
    if (otherPlayers.length === 0) return { events: [] };

    // 组合选项：每位对手二选一（最多 3 位对手 → 8 种组合）
    const combos: { noActions: string[]; noMove: string[]; label: string }[] = [];
    const total = 1 << otherPlayers.length;
    for (let mask = 0; mask < total; mask++) {
        const noActions: string[] = [];
        const noMove: string[] = [];
        const parts: string[] = [];
        for (let i = 0; i < otherPlayers.length; i++) {
            const pid = otherPlayers[i];
            const pickNoActions = ((mask >> i) & 1) === 1;
            if (pickNoActions) {
                noActions.push(pid);
                parts.push(`${getOpponentLabel(pid)}：不能打战术`);
            } else {
                noMove.push(pid);
                parts.push(`${getOpponentLabel(pid)}：不能移动随从`);
            }
        }
        combos.push({ noActions, noMove, label: parts.join('；') });
    }

    const options = combos.map((c, i) => ({
        id: `combo-${i}`,
        label: c.label,
        value: { noActions: c.noActions, noMove: c.noMove },
    }));
    const interaction = createSimpleChoice(
        `trickster_mark_of_sleep_pod_${ctx.now}`,
        ctx.playerId,
        '睡眠印记：为每个对手选择限制（持续到你下回合开始）',
        options as any[],
        { sourceId: 'trickster_mark_of_sleep_pod', targetType: 'player', autoCancelOption: true },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function tricksterPixiePodOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    // 判定当前 pixie 是否作为随从在该基地上（融合卡：通过 uid 在 minions 中存在来区分）
    const isPixieMinion = base.minions.some(m => m.uid === ctx.cardUid);
    if (isPixieMinion) {
        // 条件：手牌张数 > 至少一名其他玩家
        const me = ctx.state.players[ctx.playerId];
        if (!me) return { events: [] };
        const myHand = me.hand.length;
        const hasLessOpponent = ctx.state.turnOrder
            .filter(pid => pid !== ctx.playerId)
            .some(pid => (ctx.state.players[pid]?.hand.length ?? 0) < myHand);
        if (!hasLessOpponent) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
        }

        const myMinionsHere = base.minions.filter(m => m.controller === ctx.playerId);
        if (myMinionsHere.length === 0) return { events: [] };
        const options = myMinionsHere.map((m, i) => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const power = getMinionPower(ctx.state, m, ctx.baseIndex);
            return {
                id: `minion-${i}`,
                label: `${name} (力量 ${power})`,
                value: { minionUid: m.uid, baseIndex: ctx.baseIndex },
                _source: 'minion' as const,
                displayMode: 'card' as const,
            };
        });
        // any number（可 0 张）
        const interaction = createSimpleChoice(
            `trickster_pixie_pod_minion_${ctx.now}`,
            ctx.playerId,
            '小精灵：选择任意数量己方随从放置 +1 力量指示物（可不选）',
            options as any[],
            { sourceId: 'trickster_pixie_pod_minion', targetType: 'minion' },
            undefined,
            { min: 0, max: options.length },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }

    // Pixie as action: choose an action in play to destroy, then distribute two +1 counters among your minions
    const targets: { uid: string; defId: string; ownerId: string; label: string }[] = [];
    for (let bi = 0; bi < ctx.state.bases.length; bi++) {
        const b = ctx.state.bases[bi];
        for (const oa of b.ongoingActions) {
            const def = getCardDef(oa.defId);
            const name = def?.name ?? oa.defId;
            targets.push({ uid: oa.uid, defId: oa.defId, ownerId: oa.ownerId, label: `${name} (基地)` });
        }
        for (const m of b.minions) {
            for (const aa of m.attachedActions) {
                const def = getCardDef(aa.defId);
                const name = def?.name ?? aa.defId;
                targets.push({ uid: aa.uid, defId: aa.defId, ownerId: aa.ownerId, label: `${name} (附着)` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = targets.map((t, i) => ({
        id: `action-${i}`,
        label: t.label,
        value: { cardUid: t.uid, defId: t.defId, ownerId: t.ownerId },
        _source: 'ongoing' as const,
        displayMode: 'card' as const,
    }));
    const interaction = createSimpleChoice(
        `trickster_pixie_pod_action_destroy_${ctx.now}`,
        ctx.playerId,
        '小精灵（战术）：选择要消灭的已打出战术',
        options as any[],
        { sourceId: 'trickster_pixie_pod_action_destroy', targetType: 'ongoing', autoCancelOption: true },
    );
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex } } as any,
        }),
    };
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
            const leprechaun = base.minions.find(m => matchesDefId(m.defId, 'trickster_leprechaun'));
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
        if (trigCtx.triggerMinionDefId !== 'trickster_brownie') return [];
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
            const mist = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_enshrouding_mist'));
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
        const attachedHideout = ctx.targetMinion.attachedActions.find(a => matchesDefId(a.defId, 'trickster_hideout'));
        if (attachedHideout) {
            // 只保护 Hideout 拥有者的随从，且行动卡来自对手
            return ctx.targetMinion.controller === attachedHideout.ownerId && ctx.sourcePlayerId !== attachedHideout.ownerId;
        }
        // 也检查基地上的 ongoing（打在基地上的情况）
        const base = ctx.state.bases[ctx.targetBaseIndex];
        const baseHideout = base?.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_hideout'));
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
            const trap = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_flame_trap'));
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
        const blockAction = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_block_the_path'));
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
            const piper = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_pay_the_piper'));
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

function registerTricksterPodOngoingEffects(): void {
    registerTrigger('trickster_brownie_pod', 'onMinionAffected', () => []);
    registerTrigger('trickster_enshrouding_mist_pod', 'onTurnStart', () => []);
    registerProtection('trickster_hideout_pod', 'action', () => false);
    // Hideout POD：其他玩家不能将随从移动到此基地（用事件拦截器阻止移动）
    registerInterceptor('trickster_hideout_pod', (state, event) => {
        if (event.type !== SU_EVENTS.MINION_MOVED) return undefined;
        const { toBaseIndex, fromBaseIndex, minionUid } = (event as any).payload as { toBaseIndex: number; fromBaseIndex: number; minionUid: string };
        const toBase = state.bases[toBaseIndex];
        if (!toBase) return undefined;
        const hideout = toBase.ongoingActions.find(o => o.defId === 'trickster_hideout_pod');
        if (!hideout) return undefined;
        const fromBase = state.bases[fromBaseIndex];
        const moving = fromBase?.minions.find(m => m.uid === minionUid);
        if (!moving) return undefined;
        // 近似规则：移动者通常是该随从的控制者
        if (moving.controller !== hideout.ownerId) return null;
        return undefined;
    });

    // Leprechaun POD：每回合第一次“对手打出力量更低的随从到此基地（结算后仍在场）”时消灭之
    registerTrigger('trickster_leprechaun_pod', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        const baseIndex = trigCtx.baseIndex;
        const base = trigCtx.state.bases[baseIndex];
        if (!base) return [];

        // 找到该基地上的 leprechaun（可能多个）
        const leps = base.minions.filter(m => m.defId === 'trickster_leprechaun_pod');
        if (leps.length === 0) return [];

        // 触发的随从必须仍在该基地（避免 Twister 等在结算中移动）
        const playedMinion = base.minions.find(m => m.uid === trigCtx.triggerMinionUid);
        if (!playedMinion) return [];

        const events: SmashUpEvent[] = [];
        for (const lep of leps) {
            // 只对其他玩家触发
            if (lep.controller === trigCtx.playerId) continue;

            const used = (lep as any).metadata?.leprechaunPodLastTurnTriggered as number | undefined;
            if (used === trigCtx.state.turnNumber) continue;

            const lepPower = getMinionPower(trigCtx.state, lep, baseIndex);
            const playedPower = getMinionPower(trigCtx.state, playedMinion, baseIndex);
            if (playedPower >= lepPower) continue;

            events.push({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: playedMinion.uid,
                    minionDefId: playedMinion.defId,
                    fromBaseIndex: baseIndex,
                    ownerId: trigCtx.playerId,
                    reason: 'trickster_leprechaun_pod',
                },
                timestamp: trigCtx.now,
            });
            events.push({
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: {
                    minionUid: lep.uid,
                    baseIndex,
                    metadataUpdate: { leprechaunPodLastTurnTriggered: trigCtx.state.turnNumber },
                    reason: 'trickster_leprechaun_pod_once_per_turn',
                },
                timestamp: trigCtx.now,
            } as any);
            break;
        }
        return events;
    });

    // Brownie POD：每回合一次，当对手在另一基地打出随从后，你抽 1 张牌
    registerTrigger('trickster_brownie_pod', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || trigCtx.baseIndex === undefined) return [];
        // 对手打出的随从：playerId=打出者；需要找到所有 brownie_pod（可能多个）
        const events: SmashUpEvent[] = [];
        for (let bi = 0; bi < trigCtx.state.bases.length; bi++) {
            const base = trigCtx.state.bases[bi];
            for (const brownie of base.minions.filter(m => m.defId === 'trickster_brownie_pod')) {
                if (brownie.controller === trigCtx.playerId) continue;
                if (bi === trigCtx.baseIndex) continue; // 另一基地
                const ownerId = brownie.controller;
                const used = (brownie as any).metadata?.browniePodLastTurnTriggered as number | undefined;
                if (used === trigCtx.state.turnNumber) continue;

                // 抽 1
                const owner = trigCtx.state.players[ownerId];
                if (!owner) continue;
                const { drawnUids } = drawCards(owner, 1, trigCtx.random);
                if (drawnUids.length === 0) continue;
                events.push({
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId: ownerId, count: 1, cardUids: drawnUids },
                    timestamp: trigCtx.now,
                } as CardsDrawnEvent);
                events.push({
                    type: SU_EVENTS.MINION_METADATA_UPDATED,
                    payload: {
                        minionUid: brownie.uid,
                        baseIndex: bi,
                        metadataUpdate: { browniePodLastTurnTriggered: trigCtx.state.turnNumber },
                        reason: 'trickster_brownie_pod_once_per_turn',
                    },
                    timestamp: trigCtx.now,
                } as any);
            }
        }
        return events;
    });

    // Gremlin POD：被消灭进入弃牌堆后抽 1；若被消灭则每位对手随机弃 1
    registerTrigger('trickster_gremlin_pod', 'onMinionDestroyed', (trigCtx) => {
        if (trigCtx.triggerMinionDefId !== 'trickster_gremlin_pod') return [];
        const ownerId = trigCtx.triggerMinion?.owner ?? trigCtx.playerId;
        const player = trigCtx.state.players[ownerId];
        if (!player) return [];
        const events: SmashUpEvent[] = [];
        const { drawnUids } = drawCards(player, 1, trigCtx.random);
        if (drawnUids.length > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: ownerId, count: 1, cardUids: drawnUids },
                timestamp: trigCtx.now,
            } as CardsDrawnEvent);
        }
        for (const pid of trigCtx.state.turnOrder) {
            if (pid === ownerId) continue;
            const opp = trigCtx.state.players[pid];
            if (!opp || opp.hand.length === 0) continue;
            const idx = Math.floor(trigCtx.random.random() * opp.hand.length);
            events.push({
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: pid, cardUids: [opp.hand[idx].uid] },
                timestamp: trigCtx.now,
            } as CardsDiscardedEvent);
        }
        return events;
    });

    // Gremlin POD：基地计分清场时进入弃牌堆（非消灭）也抽 1
    registerTrigger('trickster_gremlin_pod', 'onMinionDiscardedFromBase', (trigCtx) => {
        if (trigCtx.triggerMinionDefId !== 'trickster_gremlin_pod') return [];
        const ownerId = trigCtx.triggerMinion?.owner ?? trigCtx.playerId;
        const player = trigCtx.state.players[ownerId];
        if (!player) return [];
        const { drawnUids } = drawCards(player, 1, trigCtx.random);
        if (drawnUids.length === 0) return [];
        return [{
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ownerId, count: 1, cardUids: drawnUids },
            timestamp: trigCtx.now,
        } as CardsDrawnEvent];
    });

    // Flame Trap POD：对手打出随从到此基地后，先自毁再尝试消灭该随从
    registerTrigger('trickster_flame_trap_pod', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        const bi = trigCtx.baseIndex;
        const base = trigCtx.state.bases[bi];
        if (!base) return [];
        const trap = base.ongoingActions.find(o => o.defId === 'trickster_flame_trap_pod');
        if (!trap) return [];
        if (trap.ownerId === trigCtx.playerId) return [];
        return [
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: { cardUid: trap.uid, defId: trap.defId, ownerId: trap.ownerId, reason: 'trickster_flame_trap_pod' },
                timestamp: trigCtx.now,
            } as OngoingDetachedEvent,
            {
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: trigCtx.triggerMinionUid,
                    minionDefId: trigCtx.triggerMinionDefId,
                    fromBaseIndex: bi,
                    ownerId: trigCtx.playerId,
                    reason: 'trickster_flame_trap_pod',
                },
                timestamp: trigCtx.now,
            },
        ];
    });

    // Flame Trap POD：你回合开始时，可以让此基地本回合 breakpoint -4
    registerTrigger('trickster_flame_trap_pod', 'onTurnStart', (trigCtx) => {
        for (let bi = 0; bi < trigCtx.state.bases.length; bi++) {
            const base = trigCtx.state.bases[bi];
            const trap = base.ongoingActions.find(o => o.defId === 'trickster_flame_trap_pod');
            if (!trap) continue;
            if (trap.ownerId !== trigCtx.playerId) continue;
            const options = [
                { id: 'yes', label: '是（本回合该基地 breakpoint -4）', value: { yes: true } },
                { id: 'no', label: '否', value: { yes: false } },
            ];
            const interaction = createSimpleChoice(
                `trickster_flame_trap_pod_bp_${trigCtx.now}`,
                trigCtx.playerId,
                '火焰陷阱：是否降低此基地爆分线？',
                options as any[],
                { sourceId: 'trickster_flame_trap_pod_bp', targetType: 'option', autoCancelOption: false },
            );
            return { events: [], matchState: queueInteraction(trigCtx.matchState as any, interaction) } as any;
        }
        return [];
    });

    // Pay the Piper POD：对手在此基地打出随从后，该玩家弃 1 张牌（先按随机实现，后续可升级为选择弃牌）
    registerTrigger('trickster_pay_the_piper_pod', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || trigCtx.baseIndex === undefined) return [];
        const bi = trigCtx.baseIndex;
        const base = trigCtx.state.bases[bi];
        if (!base) return [];
        const piper = base.ongoingActions.find(o => o.defId === 'trickster_pay_the_piper_pod');
        if (!piper) return [];
        if (piper.ownerId === trigCtx.playerId) return [];
        const opponent = trigCtx.state.players[trigCtx.playerId];
        if (!opponent || opponent.hand.length === 0) return [];
        const idx = Math.floor(trigCtx.random.random() * opponent.hand.length);
        return [{
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: trigCtx.playerId, cardUids: [opponent.hand[idx].uid] },
            timestamp: trigCtx.now,
        } as CardsDiscardedEvent];
    });

    // Block the Path POD：对每个对手指定其拥有的一个派系，阻止该对手派系随从打到此基地
    registerAbility('trickster_block_the_path_pod', 'onPlay', (ctx) => {
        const otherPlayers = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
        if (otherPlayers.length === 0) return { events: [] };
        const perOpponentFactions = otherPlayers.map(pid => ({
            pid,
            factions: (ctx.state.players[pid]?.factions ?? []).filter(Boolean) as string[],
        }));
        if (perOpponentFactions.some(x => x.factions.length === 0)) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
        }

        // 组合：每位对手在其两个派系中选一个（最多 3 位对手 → 2^3 = 8）
        const combos: { blocked: Record<string, string>; label: string }[] = [];
        const total = 1 << otherPlayers.length;
        for (let mask = 0; mask < total; mask++) {
            const blocked: Record<string, string> = {};
            const parts: string[] = [];
            for (let i = 0; i < otherPlayers.length; i++) {
                const { pid, factions } = perOpponentFactions[i];
                const pick = ((mask >> i) & 1) === 1 ? factions[1] : factions[0];
                blocked[pid] = pick;
                const name = FACTION_DISPLAY_NAMES[pick] ?? pick;
                parts.push(`${getOpponentLabel(pid)}：${name}`);
            }
            combos.push({ blocked, label: parts.join('；') });
        }
        const options = combos.map((c, i) => ({
            id: `combo-${i}`,
            label: c.label,
            value: { blocked },
        }));
        const interaction = createSimpleChoice(
            `trickster_block_the_path_pod_${ctx.now}`,
            ctx.playerId,
            '通路禁止：为每个对手指定一个派系',
            options as any[],
            { sourceId: 'trickster_block_the_path_pod', targetType: 'option', autoCancelOption: true },
        );
        // continuationContext 由 Board.tsx/InteractionHandlers 需要存 cardUid/baseIndex
        return { events: [], matchState: queueInteraction(ctx.matchState, { ...interaction, data: { ...interaction.data, continuationContext: { cardUid: ctx.cardUid, baseIndex: ctx.baseIndex } } as any }) };
    });

    registerRestriction('trickster_block_the_path_pod', 'play_minion', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return false;
        const block = base.ongoingActions.find(o => o.defId === 'trickster_block_the_path_pod');
        if (!block) return false;
        const per = block.metadata?.blockedFactionsByPlayer as Record<string, string> | undefined;
        const blockedFaction = per?.[ctx.playerId];
        if (!blockedFaction) return false;
        const minionDefId = ctx.extra?.minionDefId as string | undefined;
        if (!minionDefId) return false;
        const def = getCardDef(minionDefId);
        return def?.faction === blockedFaction;
    });

    // Mark of Sleep POD：限制“被标记者”的移动（用事件拦截器实现）
    registerInterceptor('trickster_mark_of_sleep_pod', (state, event) => {
        if (event.type !== SU_EVENTS.MINION_MOVED) return undefined;
        const marked = (state.sleepMoveMarkedPlayers ?? []) as string[];
        if (marked.length === 0) return undefined;
        const { fromBaseIndex, minionUid } = (event as any).payload as { fromBaseIndex: number; minionUid: string };
        const fromBase = state.bases[fromBaseIndex];
        const minion = fromBase?.minions.find(m => m.uid === minionUid);
        if (!minion) return undefined;
        const expires = (state.sleepMarkExpiresOnTurnNumber as number | undefined);
        if (expires !== undefined && state.turnNumber >= expires) return undefined;
        if (marked.includes(minion.controller)) return null;
        return undefined;
    });
}
