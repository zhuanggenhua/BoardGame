/**
 * 大杀四方 - 外星人派系能力
 *
 * 主题：干扰对手，将随从送回手牌，控制基地
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { SU_EVENTS } from '../domain/types';
import type {
    MinionReturnedEvent, VpAwardedEvent, SmashUpEvent,
    MinionCardDef, OngoingDetachedEvent, BaseReplacedEvent,
    CardToDeckBottomEvent,
    SmashUpCore,
    MinionPlayedEvent,
} from '../domain/types';
import {
    buildBaseTargetOptions, buildMinionTargetOptions, getMinionPower,
    grantExtraMinion, moveMinion, revealHand, shuffleBaseDeck,
    resolveOrPrompt, buildAbilityFeedback,
} from '../domain/abilityHelpers';
import { getBaseDef, getCardDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerTrigger, registerBaseAbilitySuppression, isMinionProtected } from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';

/** 注册外星人派系所有能力 */
export function registerAlienAbilities(): void {
    // --- 随从 ---
    registerAbility('alien_supreme_overlord', 'onPlay', alienSupremeOverlord);
    registerAbility('alien_collector', 'onPlay', alienCollector);
    registerAbility('alien_invader', 'onPlay', alienInvader);
    registerTrigger('alien_scout', 'afterScoring', alienScoutAfterScoring);
    // --- 行动卡 ---
    registerAbility('alien_invasion', 'onPlay', alienInvasion);
    registerAbility('alien_disintegrator', 'onPlay', alienDisintegrator);
    registerAbility('alien_beam_up', 'onPlay', alienBeamUp);
    registerAbility('alien_crop_circles', 'onPlay', alienCropCircles);
    registerAbility('alien_probe', 'onPlay', alienProbe);
    registerAbility('alien_terraform', 'onPlay', alienTerraform);
    registerAbility('alien_abduction', 'onPlay', alienAbduction);
    // 糟糕的信号：所有玩家无视此基地能力（ongoing 行动卡附着到基地）
    registerBaseAbilitySuppression('alien_jammed_signal', () => true);
}

// ============================================================================
// 随从能力
// ============================================================================

function alienSupremeOverlord(ctx: AbilityContext): AbilityResult {
    // 描述：你可以将一个随从返回到其拥有者的手上（任意基地，不限本基地）
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.uid === ctx.cardUid) continue; // 排除自身
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const power = getMinionPower(ctx.state, m, i);
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseDef?.name ?? `基地 ${i + 1}`}` });
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const minionOptions = buildMinionTargetOptions(targets);
    const options = [
        { id: 'skip', label: '跳过（不返回随从）', value: { skip: true } },
        ...minionOptions,
    ] as any[];
    return { events: [], matchState: queueInteraction(ctx.matchState, createSimpleChoice(
        `alien_supreme_overlord_${ctx.now}`, ctx.playerId,
        '你可以将一个随从返回到其拥有者的手上', options, 'alien_supreme_overlord',
    )) };
}

function alienCollector(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.minions.filter(
        m => getMinionPower(ctx.state, m, ctx.baseIndex) <= 3
    );
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const minionTargets = targets.map(t => {
        const def = getCardDef(t.defId) as MinionCardDef | undefined;
        const name = def?.name ?? t.defId;
        const power = getMinionPower(ctx.state, t, ctx.baseIndex);
        return { uid: t.uid, defId: t.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
    });
    const options = [
        { id: 'skip', label: '跳过（不收回随从）', value: { skip: true } },
        ...buildMinionTargetOptions(minionTargets),
    ] as any[];
    return { events: [], matchState: queueInteraction(ctx.matchState, createSimpleChoice(
        `alien_collector_${ctx.now}`, ctx.playerId,
        '你可以将这个基地的一个力量≤3的随从返回其拥有者的手上', options, 'alien_collector',
    )) };
}

function alienInvader(ctx: AbilityContext): AbilityResult {
    return { events: [{
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.playerId, amount: 1, reason: 'alien_invader' },
        timestamp: ctx.now,
    } as VpAwardedEvent] };
}

function alienScoutAfterScoring(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    if (ctx.baseIndex === undefined) return [];
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return [];
    // 规则：所有玩家的 alien_scout 都可以在计分后触发（不限当前回合玩家）
    const scouts = base.minions.filter(m => m.defId === 'alien_scout');
    if (scouts.length === 0) return [];
    if (!ctx.matchState) {
        // 无 matchState 时回退到自动回手
        return scouts.map(scout => ({
            type: SU_EVENTS.MINION_RETURNED,
            payload: { minionUid: scout.uid, minionDefId: scout.defId, fromBaseIndex: ctx.baseIndex!, toPlayerId: scout.owner, reason: 'alien_scout' },
            timestamp: ctx.now,
        } as MinionReturnedEvent));
    }
    // 创建交互让玩家选择是否回手（多个 scout 时链式处理）
    const scoutInfos = scouts.map(s => ({ uid: s.uid, defId: s.defId, owner: s.owner, controller: s.controller, baseIndex: ctx.baseIndex! }));
    const first = scoutInfos[0];
    const remaining = scoutInfos.slice(1);
    const interaction = createSimpleChoice(
        `alien_scout_return_${ctx.now}`, first.controller,
        '侦察兵：基地记分后，是否将此侦察兵返回手牌？',
        [
            { id: 'yes', label: '返回手牌', value: { returnIt: true, minionUid: first.uid, minionDefId: first.defId, owner: first.owner, baseIndex: first.baseIndex, baseDefId: base.defId } },
            { id: 'no', label: '留在基地', value: { returnIt: false } },
        ],
        'alien_scout_return',
    );
    const ms = queueInteraction(ctx.matchState, {
        ...interaction,
        data: { ...interaction.data, continuationContext: { remaining } },
    });
    return { events: [], matchState: ms };
}

// ============================================================================
// 行动卡能力
// ============================================================================

function alienInvasion(ctx: AbilityContext): AbilityResult {
    if (ctx.state.bases.length <= 1) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId} (力量 ${getMinionPower(ctx.state, m, i)}) @ ${baseDef?.name ?? `基地 ${i + 1}`}` });
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return { events: [], matchState: queueInteraction(ctx.matchState, createSimpleChoice(
        `alien_invasion_${ctx.now}`, ctx.playerId, '选择要移动的随从', buildMinionTargetOptions(targets), 'alien_invasion_choose_minion',
    )) };
}

function alienDisintegrator(ctx: AbilityContext): AbilityResult {
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (getMinionPower(ctx.state, m, i) <= 3) {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const baseDef = getBaseDef(ctx.state.bases[i].defId);
                targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId} (力量 ${getMinionPower(ctx.state, m, i)}) @ ${baseDef?.name ?? `基地 ${i + 1}`}` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return { events: [], matchState: queueInteraction(ctx.matchState, createSimpleChoice(
        `alien_disintegrator_${ctx.now}`, ctx.playerId, '选择要放到牌库底的力量≤3的随从', buildMinionTargetOptions(targets), 'alien_disintegrator',
    )) };
}

function alienBeamUp(ctx: AbilityContext): AbilityResult {
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId} (力量 ${getMinionPower(ctx.state, m, i)}) @ ${baseDef?.name ?? `基地 ${i + 1}`}` });
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return { events: [], matchState: queueInteraction(ctx.matchState, createSimpleChoice(
        `alien_beam_up_${ctx.now}`, ctx.playerId, '选择要返回手牌的随从', buildMinionTargetOptions(targets), 'alien_beam_up',
    )) };
}

function alienCropCircles(ctx: AbilityContext): AbilityResult {
    const baseCandidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (ctx.state.bases[i].minions.length > 0) {
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            baseCandidates.push({ baseIndex: i, label: `${baseDef?.name ?? `基地 ${i + 1}`} (${ctx.state.bases[i].minions.length} 个随从)` });
        }
    }
    if (baseCandidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return { events: [], matchState: queueInteraction(ctx.matchState, createSimpleChoice(
        `alien_crop_circles_${ctx.now}`, ctx.playerId, '选择一个基地，将随从返回手牌', buildBaseTargetOptions(baseCandidates, ctx.state), 'alien_crop_circles',
    )) };
}

function alienProbe(ctx: AbilityContext): AbilityResult {
    const opponents = Object.keys(ctx.state.players).filter(pid => pid !== ctx.playerId);
    if (opponents.length === 0) return { events: [] };
    // 数据驱动：强制效果，单对手自动执行
    const opOptions = opponents.map((pid, i) => ({
        id: `player-${i}`, label: `玩家 ${pid}`, value: { targetPlayerId: pid },
    }));
    return resolveOrPrompt(ctx, opOptions, {
        id: 'alien_probe_choose_target',
        title: '选择要查看手牌的玩家',
        sourceId: 'alien_probe_choose_target',
        targetType: 'generic',
    }, (value) => {
        const targetPid = value.targetPlayerId;
        const targetPlayer = ctx.state.players[targetPid];
        const handCards = targetPlayer.hand.map(c => ({ uid: c.uid, defId: c.defId }));
        const deckTopCard = targetPlayer.deck.length > 0 ? [{ uid: targetPlayer.deck[0].uid, defId: targetPlayer.deck[0].defId }] : [];
        // 展示手牌（纯展示，无后续交互冲突）
        const events: SmashUpEvent[] = [];
        if (handCards.length > 0) {
            events.push(revealHand(targetPid, ctx.playerId, handCards, 'alien_probe', ctx.now));
        }
        // 牌库顶不发 REVEAL_DECK_TOP（会和后续放置位置交互冲突卡死），
        // 在 Prompt 标题中包含卡牌名称让玩家知道在放什么
        const deckTopCardName = deckTopCard.length > 0
            ? (getCardDef(deckTopCard[0].defId)?.name ?? deckTopCard[0].defId)
            : '无';
        const interaction = createSimpleChoice(
            `alien_probe_${ctx.now}`, ctx.playerId,
            `牌库顶的牌是「${deckTopCardName}」，选择放回顶部还是底部`,
            [{ id: 'top', label: '放回牌库顶', value: { targetPlayerId: targetPid, placement: 'top' } },
             { id: 'bottom', label: '放到牌库底', value: { targetPlayerId: targetPid, placement: 'bottom' } }],
            'alien_probe',
        );
        return { events, matchState: queueInteraction(ctx.matchState, interaction) };
    });
}

function alienTerraform(ctx: AbilityContext): AbilityResult {
    console.log('[alien_terraform] onPlay triggered, playerId:', ctx.playerId);
    console.log('[alien_terraform] bases count:', ctx.state.bases.length);
    console.log('[alien_terraform] matchState exists:', !!ctx.matchState);
    const baseCandidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const baseDef = getBaseDef(ctx.state.bases[i].defId);
        baseCandidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
    }
    console.log('[alien_terraform] baseCandidates:', baseCandidates);
    if (baseCandidates.length === 0) {
        console.log('[alien_terraform] no base candidates, returning empty');
        return { events: [] };
    }
    const interaction = createSimpleChoice(
        `alien_terraform_${ctx.now}`, ctx.playerId, '选择要替换的基地', buildBaseTargetOptions(baseCandidates, ctx.state), 'alien_terraform',
    );
    console.log('[alien_terraform] created interaction:', interaction.id, 'kind:', interaction.kind, 'playerId:', interaction.playerId);
    const newMatchState = queueInteraction(ctx.matchState, interaction);
    console.log('[alien_terraform] queued interaction, current:', newMatchState.sys.interaction?.current?.id);
    return { events: [], matchState: newMatchState };
}

function alienAbduction(ctx: AbilityContext): AbilityResult {
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId} (力量 ${getMinionPower(ctx.state, m, i)}) @ ${baseDef?.name ?? `基地 ${i + 1}`}` });
        }
    }
    if (targets.length === 0) return { events: [grantExtraMinion(ctx.playerId, 'alien_abduction', ctx.now)] };
    return { events: [], matchState: queueInteraction(ctx.matchState, createSimpleChoice(
        `alien_abduction_${ctx.now}`, ctx.playerId, '选择要返回手牌的随从', buildMinionTargetOptions(targets), 'alien_abduction',
    )) };
}

function buildCropCirclesReturnEvents(
    core: SmashUpCore,
    baseIndex: number,
    selectedMinionUids: string[],
    timestamp: number,
    sourcePlayerId?: string,
): MinionReturnedEvent[] {
    if (selectedMinionUids.length === 0) return [];
    const base = core.bases[baseIndex];
    if (!base) return [];
    const selectedSet = new Set(selectedMinionUids);
    return base.minions
        .filter(m => selectedSet.has(m.uid))
        .filter(m => {
            // 跳过受保护的对手随从
            if (sourcePlayerId && m.controller !== sourcePlayerId && isMinionProtected(core, m, baseIndex, sourcePlayerId, 'affect')) {
                return false;
            }
            return true;
        })
        .map(m => ({
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: m.uid,
                minionDefId: m.defId,
                fromBaseIndex: baseIndex,
                toPlayerId: m.owner,
                reason: 'alien_crop_circles',
            },
            timestamp,
        } as MinionReturnedEvent));
}

// ============================================================================
// 交互处理函数注册
// ============================================================================

/** 注册外星人派系的交互解决处理函数 */
export function registerAlienInteractionHandlers(): void {
    // 至高霸主：选择目标后返回手牌（检查保护）
    registerInteractionHandler('alien_supreme_overlord', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number; defId?: string };
        if (selected.skip) return { state, events: [] };
        const { minionUid, baseIndex } = selected;
        if (minionUid === undefined || baseIndex === undefined) return undefined;
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        // 检查 affect 保护（只对对手随从检查）
        if (target.controller !== playerId && isMinionProtected(state.core, target, baseIndex, playerId, 'affect')) {
            return { state, events: [] }; // 被保护，无效果
        }
        return { state, events: [{
            type: SU_EVENTS.MINION_RETURNED,
            payload: { minionUid: target.uid, minionDefId: target.defId, fromBaseIndex: baseIndex, toPlayerId: target.owner, reason: 'alien_supreme_overlord' },
            timestamp,
        } as MinionReturnedEvent] };
    });

    // 收集者：选择力量≤3随从返回手牌（检查保护）
    registerInteractionHandler('alien_collector', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number; defId?: string };
        if (selected.skip) return { state, events: [] };
        const { minionUid, baseIndex } = selected;
        if (minionUid === undefined || baseIndex === undefined) return undefined;
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        if (target.controller !== playerId && isMinionProtected(state.core, target, baseIndex, playerId, 'affect')) {
            return { state, events: [] };
        }
        return { state, events: [{
            type: SU_EVENTS.MINION_RETURNED,
            payload: { minionUid: target.uid, minionDefId: target.defId, fromBaseIndex: baseIndex, toPlayerId: target.owner, reason: 'alien_collector' },
            timestamp,
        } as MinionReturnedEvent] };
    });

    // 入侵第一步：选择随从后，链式选择目标基地
    registerInteractionHandler('alien_invasion_choose_minion', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex: fromBaseIndex } = value as { minionUid: string; baseIndex: number; defId: string };
        const base = state.core.bases[fromBaseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        // 构建可移动到的基地列表（排除当前基地）
        const baseCandidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            if (i === fromBaseIndex) continue;
            const baseDef = getBaseDef(state.core.bases[i].defId);
            baseCandidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        if (baseCandidates.length === 0) return undefined;
        const next = createSimpleChoice(
            `alien_invasion_base_${timestamp}`, playerId,
            '选择要移动到的基地', buildBaseTargetOptions(baseCandidates, state.core), 'alien_invasion_choose_base',
        );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBaseIndex } } }), events: [] };
    });

    // 入侵第二步：移动随从到目标基地
    registerInteractionHandler('alien_invasion_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBaseIndex } = value as { baseIndex: number };
        const ctx = iData?.continuationContext as { minionUid: string; minionDefId: string; fromBaseIndex: number } | undefined;
        if (!ctx) return undefined;
        return { state, events: [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBaseIndex, toBaseIndex, 'alien_invasion', timestamp)] };
    });

    // 分解者：将力量≤3随从放到牌库底
    registerInteractionHandler('alien_disintegrator', (state, _playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex, defId } = value as { minionUid: string; baseIndex: number; defId: string };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return { state, events: [{
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: { cardUid: target.uid, defId, ownerId: target.owner, reason: 'alien_disintegrator' },
            timestamp,
        } as CardToDeckBottomEvent] };
    });

    // 光束传送：返回随从到手牌（检查保护）
    registerInteractionHandler('alien_beam_up', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number; defId: string };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        if (target.controller !== playerId && isMinionProtected(state.core, target, baseIndex, playerId, 'affect')) {
            return { state, events: [] };
        }
        return { state, events: [{
            type: SU_EVENTS.MINION_RETURNED,
            payload: { minionUid: target.uid, minionDefId: target.defId, fromBaseIndex: baseIndex, toPlayerId: target.owner, reason: 'alien_beam_up' },
            timestamp,
        } as MinionReturnedEvent] };
    });

    // 麦田怪圈：选择基地后，自动返回该基地所有随从（强制效果）
    registerInteractionHandler('alien_crop_circles', (state, playerId, value, _iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;

        // 直接返回该基地所有随从（强制效果："返回每个在这个基地上的随从"）
        const events = buildCropCirclesReturnEvents(state.core, baseIndex, base.minions.map(m => m.uid), timestamp, playerId);
        return { state, events };
    });

    // 探测第一步（多对手时）：选择目标玩家后，展示手牌，链式选择放置位置
    registerInteractionHandler('alien_probe_choose_target', (state, playerId, value, _iData, _random, timestamp) => {
        const { targetPlayerId } = value as { targetPlayerId: string };
        const targetPlayer = state.core.players[targetPlayerId];
        const events: SmashUpEvent[] = [];
        // 展示手牌（纯展示，后续放置交互是独立的文本选择不会冲突）
        if (targetPlayer) {
            const handCards = targetPlayer.hand.map(c => ({ uid: c.uid, defId: c.defId }));
            if (handCards.length > 0) {
                events.push(revealHand(targetPlayerId, playerId, handCards, 'alien_probe', timestamp));
            }
            // 牌库顶不发 REVEAL_DECK_TOP（会和后续放置位置交互冲突卡死）
        }
        const next = createSimpleChoice(
            `alien_probe_${timestamp}`, playerId,
            '查看对手手牌后，选择将牌库顶的牌放回顶部还是底部',
            [{ id: 'top', label: '放回牌库顶', value: { targetPlayerId, placement: 'top' } },
             { id: 'bottom', label: '放到牌库底', value: { targetPlayerId, placement: 'bottom' } }],
            'alien_probe',
        );
        return { state: queueInteraction(state, next), events };
    });

    // 探测最终步：执行放置
    registerInteractionHandler('alien_probe', (state, _playerId, value, _iData, _random, timestamp) => {
        const { targetPlayerId, placement } = value as { targetPlayerId: string; placement: 'top' | 'bottom' };
        if (placement === 'top') {
            // 放回顶部 = 无操作（牌本来就在顶部）
            return { state, events: [] };
        }
        // 放到底部
        const targetPlayer = state.core.players[targetPlayerId];
        if (!targetPlayer || targetPlayer.deck.length === 0) return { state, events: [] };
        const topCard = targetPlayer.deck[0];
        return { state, events: [{
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: { cardUid: topCard.uid, defId: topCard.defId, ownerId: targetPlayerId, reason: 'alien_probe' },
            timestamp,
        } as CardToDeckBottomEvent] };
    });

    // 地形改造：第一步选被替换基地，第二步从基地牌库选择替换目标
    registerInteractionHandler('alien_terraform', (state, playerId, value, _iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        if (state.core.baseDeck.length === 0) {
            // 基地牌库为空，无法替换，给出反馈
            return { state, events: [buildAbilityFeedback(playerId, 'feedback.base_deck_empty', timestamp)] };
        }

        const options = state.core.baseDeck.map((baseDefId, index) => {
            const baseDef = getBaseDef(baseDefId);
            return {
                id: `replacement-${index}`,
                label: baseDef?.name ?? baseDefId,
                value: { newBaseDefId: baseDefId, baseDefId }, // 添加 baseDefId 触发卡牌展示模式
            };
        });

        const next = createSimpleChoice(
            `alien_terraform_choose_replacement_${timestamp}`,
            playerId,
            '地形改造：从基地牌库中选择一张基地进行替换',
            options,
            'alien_terraform_choose_replacement',
        );

        return {
            state: queueInteraction(state, {
                ...next,
                data: {
                    ...next.data,
                    continuationContext: {
                        baseIndex,
                        oldBaseDefId: base.defId,
                    },
                },
            }),
            events: [],
        };
    });

    // 地形改造：第二步执行替换 + 洗混基地牌库 + 创建“在新基地额外打随从”交互
    registerInteractionHandler('alien_terraform_choose_replacement', (state, playerId, value, iData, random, timestamp) => {
        const { newBaseDefId } = value as { newBaseDefId?: string };
        const ctx = iData?.continuationContext as { baseIndex: number; oldBaseDefId: string } | undefined;
        if (!ctx || !newBaseDefId) return undefined;

        const base = state.core.bases[ctx.baseIndex];
        if (!base) return undefined;

        const events: SmashUpEvent[] = [];

        // 先分离该基地上所有 ongoing 行动卡
        for (const action of base.ongoingActions) {
            events.push({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: { cardUid: action.uid, defId: action.defId, ownerId: action.ownerId, reason: 'alien_terraform' },
                timestamp,
            } as OngoingDetachedEvent);
        }

        // 替换基地（保留随从，旧基地回牌库）
        events.push({
            type: SU_EVENTS.BASE_REPLACED,
            payload: {
                baseIndex: ctx.baseIndex,
                oldBaseDefId: ctx.oldBaseDefId,
                newBaseDefId,
                keepCards: true,
            },
            timestamp,
        } as BaseReplacedEvent);

        // 洗混基地牌库（BASE_REPLACED reducer 会把旧基地放回牌库并移除新基地）
        // 计算替换后的牌库内容：移除 newBaseDefId，加入 oldBaseDefId
        const remainingDeck = state.core.baseDeck.filter(id => id !== newBaseDefId);
        const deckWithOld = [...remainingDeck, ctx.oldBaseDefId];
        const shuffled = [...deckWithOld];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(random.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        events.push(shuffleBaseDeck(shuffled, 'alien_terraform', timestamp));

        // 可选：在新基地额外打出一个随从（通过链式交互固化基地限定，避免全局额度泄漏）
        const player = state.core.players[playerId];
        const minionCards = player.hand.filter(card => card.type === 'minion');
        if (minionCards.length === 0) {
            return { state, events };
        }

        const options: Array<{
            id: string;
            label: string;
            value: { skip: true } | { cardUid: string; defId: string };
        }> = [
            { id: 'skip', label: '跳过额外随从', value: { skip: true } },
            ...minionCards.map((card, index) => {
                const def = getCardDef(card.defId) as MinionCardDef | undefined;
                const power = def?.power ?? 0;
                return {
                    id: `hand-minion-${index}`,
                    label: `${def?.name ?? card.defId} (力量 ${power})`,
                    value: { cardUid: card.uid, defId: card.defId },
                };
            }),
        ];

        const interaction = createSimpleChoice(
            `alien_terraform_play_minion_${timestamp}`,
            playerId,
            '适居化：你可以在新基地上额外打出一个随从',
            options,
            'alien_terraform_play_minion',
        );

        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    continuationContext: { newBaseIndex: ctx.baseIndex },
                },
            }),
            events,
        };
    });

    // 地形改造：第三步在“新基地”可选打出一个手牌随从（原子发放额度并立即消耗）
    registerInteractionHandler('alien_terraform_play_minion', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string };
        if (selected.skip) return { state, events: [] };

        const ctx = iData?.continuationContext as { newBaseIndex: number } | undefined;
        if (!ctx) return { state, events: [] };
        const targetBase = state.core.bases[ctx.newBaseIndex];
        if (!targetBase) return { state, events: [] };

        const player = state.core.players[playerId];
        const selectedCard = player.hand.find(card =>
            card.uid === selected.cardUid &&
            card.defId === selected.defId &&
            card.type === 'minion',
        );
        if (!selectedCard) return { state, events: [] };

        const def = getCardDef(selectedCard.defId) as MinionCardDef | undefined;
        const power = def?.power ?? 0;

        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid: selectedCard.uid, defId: selectedCard.defId, baseIndex: ctx.newBaseIndex, power },
            timestamp,
        };
        return {
            state,
            events: [
                grantExtraMinion(playerId, 'alien_terraform', timestamp),
                playedEvt,
            ],
        };
    });

    // 侦察兵：基地记分后选择是否回手（链式处理多个侦察兵）
    registerInteractionHandler('alien_scout_return', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { returnIt: boolean; minionUid?: string; minionDefId?: string; owner?: string; baseIndex?: number };
        const ctx = iData?.continuationContext as { remaining: { uid: string; defId: string; owner: string; controller: string; baseIndex: number }[] } | undefined;
        const events: SmashUpEvent[] = [];

        if (selected.returnIt && selected.minionUid && selected.minionDefId && selected.owner !== undefined && selected.baseIndex !== undefined) {
            events.push({
                type: SU_EVENTS.MINION_RETURNED,
                payload: { minionUid: selected.minionUid, minionDefId: selected.minionDefId, fromBaseIndex: selected.baseIndex, toPlayerId: selected.owner, reason: 'alien_scout' },
                timestamp,
            } as MinionReturnedEvent);
        }

        const remaining = ctx?.remaining ?? [];
        if (remaining.length > 0) {
            const next = remaining[0];
            const rest = remaining.slice(1);
            const base = state.core.bases[next.baseIndex];
            const interaction = createSimpleChoice(
                `alien_scout_return_${timestamp}`, next.controller,
                '侦察兵：基地记分后，是否将此侦察兵返回手牌？',
                [
                    { id: 'yes', label: '返回手牌', value: { returnIt: true, minionUid: next.uid, minionDefId: next.defId, owner: next.owner, baseIndex: next.baseIndex, baseDefId: base.defId } },
                    { id: 'no', label: '留在基地', value: { returnIt: false } },
                ],
                'alien_scout_return',
            );
            return { state: queueInteraction(state, { ...interaction, data: { ...interaction.data, continuationContext: { remaining: rest } } }), events };
        }

        return { state, events };
    });

    // 绑架：返回随从到手牌 + 额外出一个随从（检查保护）
    registerInteractionHandler('alien_abduction', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number; defId: string };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const events: SmashUpEvent[] = [];
        // 检查保护（只对对手随从检查）
        const isProtected = target.controller !== playerId && isMinionProtected(state.core, target, baseIndex, playerId, 'affect');
        if (!isProtected) {
            events.push({
                type: SU_EVENTS.MINION_RETURNED,
                payload: { minionUid: target.uid, minionDefId: target.defId, fromBaseIndex: baseIndex, toPlayerId: target.owner, reason: 'alien_abduction' },
                timestamp,
            } as MinionReturnedEvent);
        }
        // 额外随从额度无论是否被保护都给
        events.push(grantExtraMinion(playerId, 'alien_abduction', timestamp));
        return { state, events };
    });
}
