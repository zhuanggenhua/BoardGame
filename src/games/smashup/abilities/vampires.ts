/**
 * 大杀四方 - 吸血鬼派系能力
 *
 * 主题：消灭低力量随从获取+1力量指示物
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter, addOngoingCardCounter, destroyMinion,
    buildMinionTargetOptions,
    resolveOrPrompt, findMinionOnBases, buildAbilityFeedback,
    buildBaseTargetOptions,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, SmashUpCore } from '../domain/types';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { getCardDef, getMinionDef, getBaseDef } from '../data/cards';
import { getEffectivePower } from '../domain/ongoingModifiers';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { MinionPlayedEvent } from '../domain/types';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';

// ============================================================================
// 注册入口
// ============================================================================

export function registerVampireAbilities(): void {
    // 随从
    registerAbility('vampire_fledgling_vampire', 'onPlay', vampireFledgling);
    registerAbility('vampire_heavy_drinker', 'onPlay', vampireHeavyDrinker);
    registerAbility('vampire_nightstalker', 'onPlay', vampireNightstalker);

    // 行动卡
    registerAbility('vampire_buffet', 'special', vampireBuffetSpecial);
    registerAbility('vampire_dinner_date', 'onPlay', vampireDinnerDate);
    registerAbility('vampire_big_gulp', 'onPlay', vampireBigGulp);
    registerAbility('vampire_mad_monster_party', 'onPlay', vampireMadMonsterParty);
    registerAbility('vampire_cull_the_weak', 'onPlay', vampireCullTheWeak);
    registerAbility('vampire_crack_of_dusk', 'onPlay', vampireCrackOfDusk);

    // ongoing 效果
    registerVampireOngoingEffects();
}

export function registerVampireInteractionHandlers(): void {
    registerInteractionHandler('vampire_heavy_drinker', handleHeavyDrinkerChoice);
    registerInteractionHandler('vampire_nightstalker', handleNightstalkerChoice);
    registerInteractionHandler('vampire_dinner_date', handleDinnerDateChooseMinion);
    registerInteractionHandler('vampire_dinner_date_target', handleDinnerDateChooseTarget);
    registerInteractionHandler('vampire_big_gulp', handleBigGulpChoice);
    registerInteractionHandler('vampire_cull_the_weak', handleCullTheWeakChooseMinion);
    registerInteractionHandler('vampire_cull_the_weak_choose_card', handleCullTheWeakChooseCard);
    registerInteractionHandler('vampire_crack_of_dusk', handleCrackOfDuskChoice);
    registerInteractionHandler('vampire_crack_of_dusk_base', handleCrackOfDuskChooseBase);
}

// ============================================================================
// 随从能力
// ============================================================================

/** 新生吸血鬼 onPlay：如果对手在这里力量更高，本随从+1指示物 */
function vampireFledgling(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    let myTotal = 0, maxOpponent = 0;
    for (const m of ctx.state.bases[found.baseIndex].minions) {
        const power = getEffectivePower(ctx.state, m, found.baseIndex);
        if (m.controller === ctx.playerId) myTotal += power;
    }
    const opponentTotals = new Map<string, number>();
    for (const m of ctx.state.bases[found.baseIndex].minions) {
        if (m.controller === ctx.playerId) continue;
        opponentTotals.set(m.controller, (opponentTotals.get(m.controller) ?? 0) + getEffectivePower(ctx.state, m, found.baseIndex));
    }
    for (const total of opponentTotals.values()) {
        if (total > maxOpponent) maxOpponent = total;
    }
    if (maxOpponent > myTotal) {
        return { events: [addPowerCounter(found.minion.uid, found.baseIndex, 1, 'vampire_fledgling_vampire', ctx.now)] };
    }
    return { events: [] };
}

/** 渴血鬼 talent：消灭己方一个随从来给自己+1指示物 */
function vampireHeavyDrinker(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId && m.uid !== ctx.cardUid) {
                const def = getCardDef(m.defId);
                targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId}` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options: any[] = targets.map((t, i) => ({
        id: `minion-${i}`, label: `消灭 ${t.label}`,
        value: {
            minionUid: t.uid,
            defId: t.defId,
            baseIndex: t.baseIndex,
            sourceMinionUid: found.minion.uid,
            sourceBaseIndex: found.baseIndex,
        },
    }));
    options.push({ id: 'skip', label: '跳过（不消灭）', value: { skip: true }, displayMode: 'button' as const });
    return resolveOrPrompt(ctx, options, {
        id: 'vampire_heavy_drinker', title: '选择要消灭的己方随从（本随从+1指示物）',
        sourceId: 'vampire_heavy_drinker', targetType: 'minion' as const,
    }, (rawVal) => {
        const val = rawVal as any;
        if (val.skip) return { events: [] };
        return {
            events: [
                destroyMinion(val.minionUid, val.defId, val.baseIndex, ctx.playerId, ctx.playerId, 'vampire_heavy_drinker', ctx.now),
                addPowerCounter(val.sourceMinionUid, val.sourceBaseIndex, 1, 'vampire_heavy_drinker', ctx.now),
            ],
        };
    });
}

/** 夜行者 onPlay：消灭同基地力量≤2的随从，本随从+1指示物 */
function vampireNightstalker(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (const m of ctx.state.bases[found.baseIndex].minions) {
        if (m.uid === ctx.cardUid) continue;
        const power = getEffectivePower(ctx.state, m, found.baseIndex);
        if (power <= 2) {
            const def = getCardDef(m.defId);
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: found.baseIndex, label: `${def?.name ?? m.defId} (力量 ${power})` });
        }
    }
    if (targets.length === 0) return { events: [] };
    const minionOptions = buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' });
    if (minionOptions.length === 0) return { events: [] };
    const nsOptions: any[] = [...minionOptions];
    for (const option of nsOptions) {
        if (!option?.value) continue;
        option.value = {
            ...option.value,
            sourceMinionUid: found.minion.uid,
            sourceBaseIndex: found.baseIndex,
        };
    }
    nsOptions.push({ id: 'skip', label: '跳过（不消灭）', value: { skip: true }, displayMode: 'button' as const });
    return resolveOrPrompt(ctx, nsOptions, {
        id: 'vampire_nightstalker', title: '选择要消灭的力量≤2随从（本随从+1指示物）',
        sourceId: 'vampire_nightstalker', targetType: 'minion' as const,
    }, (rawVal) => {
        const val = rawVal as any;
        if (val.skip) return { events: [] };
        return {
            events: [
                destroyMinion(val.minionUid, val.defId, val.baseIndex, ctx.state.bases[val.baseIndex]?.minions.find((m: any) => m.uid === val.minionUid)?.owner ?? ctx.playerId, ctx.playerId, 'vampire_nightstalker', ctx.now),
                addPowerCounter(val.sourceMinionUid, val.sourceBaseIndex, 1, 'vampire_nightstalker', ctx.now),
            ],
        };
    });
}

// ============================================================================
// 行动卡能力
// ============================================================================

/** 自助餐 special：ARM 延迟到计分后触发 */
function vampireBuffetSpecial(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
            payload: {
                sourceDefId: 'vampire_buffet',
                playerId: ctx.playerId,
                baseIndex: ctx.baseIndex,
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

/** 晚餐约会 onPlay：选己方随从+1指示物，然后消灭同基地力量≤2随从 */
function vampireDinnerDate(ctx: AbilityContext): AbilityResult {
    const ownMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                const def = getCardDef(m.defId);
                ownMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId}` });
            }
        }
    }
    if (ownMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = ownMinions.map((c, i) => ({
        id: `minion-${i}`, label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex },
    }));
    return resolveOrPrompt(ctx, options, {
        id: 'vampire_dinner_date', title: '选择你的随从放置+1指示物（然后消灭同基地力量≤2随从）',
        sourceId: 'vampire_dinner_date', targetType: 'minion' as const,
    }, (val) => {
        const handled = handleDinnerDateChooseMinion(
            ctx.matchState,
            ctx.playerId,
            { minionUid: val.minionUid, baseIndex: val.baseIndex },
            undefined,
            ctx.random,
            ctx.now,
        );
        if (!handled) return { events: [] };
        return {
            events: handled.events,
            matchState: handled.state,
        };
    });
}

/** 一大口 onPlay：消灭一个力量≤4的随从 */
function vampireBigGulp(ctx: AbilityContext): AbilityResult {
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const power = getEffectivePower(ctx.state, m, i);
            if (power <= 4) {
                const def = getCardDef(m.defId);
                targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId} (力量 ${power})` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' });
    if (options.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.all_protected', ctx.now)] };
    return resolveOrPrompt(ctx, options, {
        id: 'vampire_big_gulp', title: '选择要消灭的力量≤4随从',
        sourceId: 'vampire_big_gulp', targetType: 'minion' as const,
    }, (val) => {
        const minion = ctx.state.bases[val.baseIndex]?.minions.find(m => m.uid === val.minionUid);
        if (!minion) {
            console.error(`[vampire_big_gulp] minion ${val.minionUid} not found at base ${val.baseIndex}`);
            return { events: [] };
        }
        return {
            events: [destroyMinion(val.minionUid, val.defId, val.baseIndex, minion.owner, ctx.playerId, 'vampire_big_gulp', ctx.now)],
        };
    });
}

/** 疯狂怪物派对 onPlay：没有+1指示物的己方随从各放一个 */
function vampireMadMonsterParty(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId && m.powerModifier === 0) {
                events.push(addPowerCounter(m.uid, i, 1, 'vampire_mad_monster_party', ctx.now));
            }
        }
    }
    return { events };
}

/** 剔除弱者 onPlay：选己方随从，弃手牌随从卡，每弃1张+1指示物 */
function vampireCullTheWeak(ctx: AbilityContext): AbilityResult {
    const ownMinions: { uid: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                const def = getCardDef(m.defId);
                ownMinions.push({ uid: m.uid, baseIndex: i, label: `${def?.name ?? m.defId}` });
            }
        }
    }
    if (ownMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const player = ctx.state.players[ctx.playerId];
    const minionCardsInHand = player.hand.filter(c => c.type === 'minion');
    if (minionCardsInHand.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_minion_cards_in_hand', ctx.now)] };
    const options = ownMinions.map((c, i) => ({
        id: `minion-${i}`, label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex },
    }));
    return resolveOrPrompt(ctx, options, {
        id: 'vampire_cull_the_weak', title: '选择你的随从（弃手牌随从卡来放指示物）',
        sourceId: 'vampire_cull_the_weak', targetType: 'minion' as const,
    }, (val) => {
        const interaction = createCullTheWeakCardInteraction(
            ctx.matchState,
            ctx.playerId,
            { minionUid: val.minionUid, baseIndex: val.baseIndex },
            ctx.now,
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });
}

/** 破晓 onPlay：从弃牌堆打出力量≤2随从并+1指示物 */
function vampireCrackOfDusk(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const candidates = player.discard.filter(c => {
        if (c.type !== 'minion') return false;
        const def = getCardDef(c.defId);
        return def && def.type === 'minion' && (def as { power: number }).power <= 2;
    });
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = candidates.map((c, i) => {
        const def = getCardDef(c.defId);
        return { id: `card-${i}`, label: `${def?.name ?? c.defId}`, value: { cardUid: c.uid, defId: c.defId } };
    });
    return resolveOrPrompt(ctx, options, {
        id: 'vampire_crack_of_dusk', title: '从弃牌堆选择力量≤2的随从打出（+1指示物）',
        sourceId: 'vampire_crack_of_dusk', targetType: 'generic' as const,
    }, (val) => {
        // 选完随从后，创建基地选择交互
        return crackOfDuskCreateBaseSelect(ctx.matchState, ctx.playerId, val.cardUid, val.defId, ctx.now);
    });
}

function crackOfDuskCreateBaseSelect(state: MatchState<SmashUpCore>, playerId: string, cardUid: string, defId: string, now: number): AbilityResult {
    const core = state.core;
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < core.bases.length; i++) {
        const baseDef = getBaseDef(core.bases[i].defId);
        candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 #${i + 1}` });
    }
    if (candidates.length === 0) return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_bases', now)] };
    const baseOptions = buildBaseTargetOptions(candidates, core);
    const interaction = createSimpleChoice(
        `vampire_crack_of_dusk_base_${now}`, playerId,
        '选择要打出随从的基地', baseOptions,
        { sourceId: 'vampire_crack_of_dusk_base', targetType: 'base' },
    );
    // 将选中的随从信息写入 continuationContext
    const enriched = {
        ...interaction,
        data: { ...interaction.data, continuationContext: { cardUid, defId } },
    };
    return {
        matchState: queueInteraction(state, enriched),
        events: [],
    };
}

// 剔除弱者 多选辅助
// ============================================================================

interface CullTheWeakCardContext {
    minionUid: string;
    baseIndex: number;
}

function buildCullTheWeakCardOptions(core: SmashUpCore, playerId: string) {
    const player = core.players[playerId];
    if (!player) return [];
    const cardOptions = player.hand
        .filter(c => c.type === 'minion')
        .map((c, i) => {
            const def = getCardDef(c.defId);
            return {
                id: `card-${i}`,
                label: `${def?.name ?? c.defId}`,
                value: { cardUid: c.uid, defId: c.defId },
            };
        });
    return [
        ...cardOptions,
        { id: 'stop', label: '停止弃置并结算', value: { stop: true }, displayMode: 'button' as const },
    ];
}

function createCullTheWeakCardInteraction(
    ms: MatchState<SmashUpCore>,
    playerId: string,
    context: CullTheWeakCardContext,
    now: number,
) {
    const options = buildCullTheWeakCardOptions(ms.core, playerId);
    const interaction = createSimpleChoice<any>(
        `vampire_cull_the_weak_choose_card_${now}`,
        playerId,
        '剔除弱者：点击手牌中的随从卡弃置（每弃一张+1指示物），或点击停止结算',
        options,
        {
            sourceId: 'vampire_cull_the_weak_choose_card',
            targetType: 'hand' as const,
            autoResolveIfSingle: false,
        },
    );

    return {
        ...interaction,
        data: {
            ...interaction.data,
            continuationContext: context,
            optionsGenerator: (nextState: { core: SmashUpCore }) => buildCullTheWeakCardOptions(nextState.core, playerId),
        },
    };
}

// ============================================================================
// 交互处理函数
// ============================================================================

type IH = (
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number
) => { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined;

const handleHeavyDrinkerChoice: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as {
        minionUid?: string;
        defId?: string;
        baseIndex?: number;
        skip?: boolean;
        sourceMinionUid?: string;
        sourceBaseIndex?: number;
    };

    if (v.skip) return { state, events: [] };
    if (!v.minionUid || !v.defId || v.baseIndex === undefined) return undefined;
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!target) return undefined;
    let hdUid = v.sourceMinionUid ?? '';
    let hdBase = v.sourceBaseIndex ?? -1;
    if (!hdUid || hdBase < 0) {
        for (let i = 0; i < state.core.bases.length; i++) {
            const found = state.core.bases[i].minions.find(m => m.defId === 'vampire_heavy_drinker' && m.controller === playerId);
            if (found) {
                hdUid = found.uid;
                hdBase = i;
                break;
            }
        }
    }

    if (!hdUid) return undefined;
    return {
        state,
        events: [
            destroyMinion(v.minionUid, v.defId, v.baseIndex, state.core.bases[v.baseIndex]?.minions.find((m: any) => m.uid === v.minionUid)?.owner ?? playerId, playerId, 'vampire_heavy_drinker', now),
            addPowerCounter(hdUid, hdBase, 1, 'vampire_heavy_drinker', now),
        ],
    };
};

const handleNightstalkerChoice: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as {
        minionUid?: string;
        defId?: string;
        baseIndex?: number;
        skip?: boolean;
        sourceMinionUid?: string;
        sourceBaseIndex?: number;
    };

    if (v.skip) return { state, events: [] };
    if (!v.minionUid || !v.defId || v.baseIndex === undefined) return undefined;
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!target) return undefined;

    let nsUid = v.sourceMinionUid ?? '';
    let nsBase = v.sourceBaseIndex ?? -1;
    if (!nsUid || nsBase < 0) {
        for (let i = 0; i < state.core.bases.length; i++) {
            const found = state.core.bases[i].minions.find(m => m.defId === 'vampire_nightstalker' && m.controller === playerId);
            if (found) {
                nsUid = found.uid;
                nsBase = i;
                break;
            }
        }
    }

    if (!nsUid) return undefined;
    return {
        state,
        events: [
            destroyMinion(v.minionUid, v.defId, v.baseIndex, target.owner, playerId, 'vampire_nightstalker', now),
            addPowerCounter(nsUid, nsBase, 1, 'vampire_nightstalker', now),
        ],
    };
};

const handleDinnerDateChooseMinion: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number };
    const events: SmashUpEvent[] = [addPowerCounter(v.minionUid, v.baseIndex, 1, 'vampire_dinner_date', now)];
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (const m of state.core.bases[v.baseIndex].minions) {
        if (m.uid === v.minionUid) continue;
        const power = getEffectivePower(state.core, m, v.baseIndex);
        if (power <= 2) {
            const def = getCardDef(m.defId);
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: v.baseIndex, label: `${def?.name ?? m.defId} (力量 ${power})` });
        }
    }
    if (targets.length === 0) return { state, events };
    const options = buildMinionTargetOptions(targets, { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' });
    if (options.length === 0) return { state, events };
    const interaction = createSimpleChoice(
        `vampire_dinner_date_target_${now}`, playerId,
        '选择要消灭的力量≤2随从', options,
        { sourceId: 'vampire_dinner_date_target', targetType: 'minion' },
    );
    return { state: queueInteraction(state, interaction), events };
};

const handleDinnerDateChooseTarget: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; defId: string; baseIndex: number };
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!target) {
        console.error(`[handleDinnerDateChooseTarget] minion ${v.minionUid} not found at base ${v.baseIndex}`);
        return { state, events: [] };
    }
    return {
        state,
        events: [destroyMinion(v.minionUid, v.defId, v.baseIndex, target.owner, playerId, 'vampire_dinner_date', now)],
    };
};

const handleBigGulpChoice: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; defId: string; baseIndex: number };
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!target) {
        console.error(`[handleBigGulpChoice] minion ${v.minionUid} not found at base ${v.baseIndex}`);
        return { state, events: [] };
    }
    return {
        state,
        events: [destroyMinion(v.minionUid, v.defId, v.baseIndex, target.owner, playerId, 'vampire_big_gulp', now)],
    };
};

const handleCullTheWeakChooseMinion: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number };
    const player = state.core.players[playerId];
    if (!player) return undefined;
    const minionCards = player.hand.filter(c => c.type === 'minion');
    if (minionCards.length === 0) return { state, events: [] };
    const interaction = createCullTheWeakCardInteraction(
        state, playerId, { minionUid: v.minionUid, baseIndex: v.baseIndex }, now,
    );
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleCullTheWeakChooseCard: IH = (state, playerId, value, interactionData, _random, now) => {
    const context = interactionData?.continuationContext as CullTheWeakCardContext | undefined;
    if (!context) return undefined;
    const v = value as { cardUid?: string; defId?: string; stop?: boolean };
    if (v.stop) return { state, events: [] };
    if (!v.cardUid) return undefined;
    const events: SmashUpEvent[] = [
        {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: [v.cardUid] },
            timestamp: now,
        } as SmashUpEvent,
        addPowerCounter(context.minionUid, context.baseIndex, 1, 'vampire_cull_the_weak', now),
    ];
    const player = state.core.players[playerId];
    const remainingMinions = player
        ? player.hand.filter(c => c.type === 'minion' && c.uid !== v.cardUid).length
        : 0;
    if (remainingMinions <= 0) return { state, events };
    const nextInteraction = createCullTheWeakCardInteraction(state, playerId, context, now);
    return { state: queueInteraction(state, nextInteraction), events };
};

const handleCrackOfDuskChoice: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { cardUid: string; defId: string };
    // 选完随从后，创建基地选择交互
    const result = crackOfDuskCreateBaseSelect(state, playerId, v.cardUid, v.defId, now);
    return { state: result.matchState ?? state, events: result.events };
};

const handleCrackOfDuskChooseBase: IH = (state, playerId, value, interactionData, _random, now) => {
    const context = interactionData?.continuationContext as { cardUid: string; defId: string } | undefined;
    if (!context) return undefined;
    const v = value as { baseIndex: number };
    const minionDef = getMinionDef(context.defId);
    const playedEvt: MinionPlayedEvent = {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId,
            cardUid: context.cardUid,
            defId: context.defId,
            baseIndex: v.baseIndex,
            power: minionDef?.power ?? 0,
            fromDiscard: true,
        },
        timestamp: now,
    };
    return {
        state,
        events: [
            playedEvt,
            addPowerCounter(context.cardUid, v.baseIndex, 1, 'vampire_crack_of_dusk', now),
        ],
    };
};

// ============================================================================
// Ongoing 效果注册
// ============================================================================

function registerVampireOngoingEffects(): void {
    // 吸血鬼伯爵 ongoing：对手随从被消灭后+1指示物
    registerTrigger('vampire_the_count', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, playerId: destroyedOwnerId, triggerMinionUid, now } = ctx;
        if (!triggerMinionUid) return [];
        const events: SmashUpEvent[] = [];
        for (let i = 0; i < state.bases.length; i++) {
            for (const m of state.bases[i].minions) {
                if (m.defId === 'vampire_the_count' && m.controller !== destroyedOwnerId) {
                    events.push(addPowerCounter(m.uid, i, 1, 'vampire_the_count', now));
                }
            }
        }
        return events;
    });

    // 投机主义 ongoing(minion)：对手随从被消灭后+1指示物
    registerTrigger('vampire_opportunist', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, playerId: destroyedOwnerId, now } = ctx;
        const events: SmashUpEvent[] = [];
        for (let i = 0; i < state.bases.length; i++) {
            for (const m of state.bases[i].minions) {
                if (m.controller === destroyedOwnerId) continue;
                if (m.attachedActions.some(a => a.defId === 'vampire_opportunist')) {
                    events.push(addPowerCounter(m.uid, i, 1, 'vampire_opportunist', now));
                }
            }
        }
        return events;
    });

    // 召唤狼群 ongoing(base)：回合开始在本卡上放+1力量指示物
    registerTrigger('vampire_summon_wolves', 'onTurnStart', (ctx: TriggerContext) => {
        const { state, playerId, now } = ctx;
        const events: SmashUpEvent[] = [];
        for (let i = 0; i < state.bases.length; i++) {
            for (const oa of state.bases[i].ongoingActions) {
                if (oa.defId === 'vampire_summon_wolves' && oa.ownerId === playerId) {
                    events.push(addOngoingCardCounter(oa.uid, i, 1, 'vampire_summon_wolves', now) as unknown as SmashUpEvent);
                }
            }
        }
        return events;
    });

    // 自助餐 special：基地计分后如果打出者是赢家（排名第一），己方所有随从+1指示物
    // 使用 ARMED → afterScoring 延迟触发机制
    registerTrigger('vampire_buffet', 'afterScoring', (ctx: TriggerContext) => {
        const { state, baseIndex, rankings, now } = ctx;
        if (baseIndex === undefined || !rankings || rankings.length === 0) return [];

        const armed = (state.pendingAfterScoringSpecials ?? []).filter(
            s => s.sourceDefId === 'vampire_buffet' && s.baseIndex === baseIndex,
        );
        if (armed.length === 0) return [];

        const events: SmashUpEvent[] = armed.map(s => ({
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED,
            payload: { sourceDefId: s.sourceDefId, playerId: s.playerId, baseIndex: s.baseIndex },
            timestamp: now,
        } as SmashUpEvent));

        for (const entry of armed) {
            // 只有排名第一（赢家）才触发效果
            if (rankings[0].playerId !== entry.playerId) continue;
            
            // 给所有基地上的己方随从加指示物（包括计分基地）
            for (let i = 0; i < state.bases.length; i++) {
                for (const m of state.bases[i].minions) {
                    if (m.controller === entry.playerId) {
                        events.push(addPowerCounter(m.uid, i, 1, 'vampire_buffet', now));
                    }
                }
            }
        }
        return events;
    });
}