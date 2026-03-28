/**
 * 大杀四方 - 印斯茅斯派系能力
 *
 * 主题：同名随从联动、数量优势
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { addTempPower, grantExtraMinion, drawMadnessCards, getMinionPower, revealAndPickFromDeck, buildAbilityFeedback, buildValidatedReturnEvents } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, DeckReorderedEvent, CardsDrawnEvent } from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { getCardDef } from '../data/cards';
import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { matchesDefId, resolveLiveBaseIndex } from '../domain/utils';

type ReturnToSeaChoiceValue = {
    minionUid: string;
    minionDefId: string;
    owner: string;
    controller: string;
    baseIndex: number;
    baseDefId: string;
};

type ReturnToSeaNameChoiceValue = {
    cardUid: string;
    baseIndex: number;
    baseDefId: string;
    minionDefId: string;
};

/** 注册印斯茅斯派系所有能力*/
export function registerInnsmouthAbilities(): void {
    // 深潜者（行动卡）：力量≤2的己方随从各+1力量
    registerAbility('innsmouth_the_deep_ones', 'onPlay', innsmouthTheDeepOnes);
    // 新人（行动卡）：所有玩家将弃牌堆随从洗回牌堆
    registerAbility('innsmouth_new_acolytes', 'onPlay', innsmouthNewAcolytes);
    // 招募（行动卡）：抽若干张疯狂卡，每张可额外打出 1 个随从
    registerAbility('innsmouth_recruitment', 'onPlay', innsmouthRecruitment);
    // 本地人（随从 onPlay）：展示牌库底张，同名卡放手牌，其余放牌库底
    registerAbility('innsmouth_the_locals', 'onPlay', innsmouthTheLocals);
    // 回归大海（special）：计分后同名随从回手牌
    registerAbility('innsmouth_return_to_the_sea', 'special', innsmouthReturnToTheSea);
    registerTrigger('innsmouth_return_to_the_sea', 'afterScoring', innsmouthReturnToTheSeaAfterScoring, {
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    // 深潜者的秘密（行动卡）：3+同名随从时抽牌，可选额外抽牌并获得疯狂卡牌
    registerAbility('innsmouth_mysteries_of_the_deep', 'onPlay', innsmouthMysteriesOfTheDeep);
    // 宗教圆环（ongoing talent）：额外打出同名随从到此基地
    registerAbility('innsmouth_sacred_circle', 'talent', innsmouthSacredCircle);
    // 散播谣言（行动卡）：额外打出至多2个与场中同名的随从
    registerAbility('innsmouth_spreading_the_word', 'onPlay', innsmouthSpreadingTheWord);

    // === ongoing 效果注册 ===
    // in_plain_sight: 力量的随从不收回受其他玩家影响
    registerProtection('innsmouth_in_plain_sight', 'affect', innsmouthInPlainSightChecker);
    registerProtection('innsmouth_in_plain_sight_pod', 'affect', innsmouthInPlainSightChecker);
}

/** 深潜者 onPlay：每个你的力量 ≤ 2 的随从获得 +1 力量 */
function innsmouthTheDeepOnes(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            if (m.controller === ctx.playerId && getMinionPower(ctx.state, m, i) <= 2) {
                events.push(addTempPower(m.uid, i, 1, 'innsmouth_the_deep_ones', ctx.now));
            }
        }
    }
    return { events };
}

/** 新人 onPlay：所有玩家将弃牌堆中的所有随从洗回牌堆 */
function innsmouthNewAcolytes(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        const player = ctx.state.players[pid];
        const minionsInDiscard = player.discard.filter(c => c.type === 'minion');
        if (minionsInDiscard.length === 0) continue;
        // 合并牌库 + 弃牌堆随从，洗牌
        const newDeckCards = [...player.deck, ...minionsInDiscard];
        const shuffled = ctx.random.shuffle([...newDeckCards]);
        const evt: DeckReorderedEvent = {
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: pid,
                deckUids: shuffled.map(c => c.uid),
            },
            timestamp: ctx.now,
        };
        events.push(evt);
    }
    return { events };
}

/** 招募 onPlay：抽至多 3 张疯狂卡，每张成功抽取可额外打出 1 个随从 */
function innsmouthRecruitment(ctx: AbilityContext): AbilityResult {
    // "至多三张疯狂卡"：玩家选择抽取 0-3 张
    const available = ctx.state.madnessDeck?.length ?? 0;
    if (available === 0) return { events: [] };
    const maxDraw = Math.min(3, available);
    const options = [];
    for (let i = 0; i <= maxDraw; i++) {
        options.push({
            id: `draw-${i}`,
            label: i === 0 ? '不抽取' : `抽取 ${i} 张疯狂卡（获得 ${i} 个额外随从额度）`,
            value: { count: i },
            displayMode: 'button' as const,
        });
    }
    const interaction = createSimpleChoice(
        `innsmouth_recruitment_${ctx.now}`, ctx.playerId,
        '选择抽取疯狂卡的数量（至多3张，每张获得1个额外随从额度）', options,
        { sourceId: 'innsmouth_recruitment', targetType: 'button' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// innsmouth_in_plain_sight (ongoing) - 通过 ongoing 效果系统实现（注册在 registerInnsmouthAbilities 中）

// ============================================================================
// ongoing 效果检查器
// ============================================================================

/**
 * in_plain_sight 保护检查：力量的的己方随从不收回受其他玩家影响?
 */
function innsmouthInPlainSightChecker(ctx: ProtectionCheckContext): boolean {
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    // 检查基地上是否?in_plain_sight ongoing 行动?
    const sight = base.ongoingActions.find(o => matchesDefId(o.defId, 'innsmouth_in_plain_sight'));
    if (!sight) return false;
    // 只保护?sight 拥有者的随从
    if (ctx.targetMinion.controller !== sight.ownerId) return false;
    // POD 版按印刷力量（basePower）判断；原版按当前有效力量判断
    const isPodVersion = sight.defId.endsWith('_pod');
    const protectedByPower =
        isPodVersion
            ? ctx.targetMinion.basePower <= 2
            : getMinionPower(ctx.state, ctx.targetMinion, ctx.targetBaseIndex) <= 2;
    return protectedByPower && ctx.sourcePlayerId !== sight.ownerId;
}

function buildReturnToSeaInteractionId(ctx: Pick<AbilityContext, 'cardUid' | 'now'>, suffix: 'choose' | 'choose_name' = 'choose'): string {
    return `innsmouth_return_to_the_sea_${suffix}_${ctx.cardUid}_${ctx.now}`;
}

function buildReturnToSeaMinionPrompt(
    ctx: AbilityContext,
    baseIndex: number,
    minionDefId: string,
): AbilityResult {
    const base = ctx.state.bases[baseIndex];
    if (!base) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const sameDefMinions = base.minions.filter(
        m => m.controller === ctx.playerId && m.defId === minionDefId,
    );
    if (sameDefMinions.length === 0) return { events: [] };

    const options = sameDefMinions.map((minion, i) => {
        const def = getCardDef(minion.defId);
        const name = def?.name ?? minion.defId;
        return {
            id: `minion-${i}`,
            label: name,
            value: {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                owner: minion.owner,
                controller: minion.controller,
                baseIndex,
                baseDefId: base.defId,
            },
            _source: 'field' as const,
            displayMode: 'card' as const,
        };
    });

    const interaction = createSimpleChoice<ReturnToSeaChoiceValue>(
        buildReturnToSeaInteractionId(ctx), ctx.playerId,
        '选择要返回的随从', options,
        { sourceId: 'innsmouth_return_to_the_sea', targetType: 'minion', multi: { min: 0, max: sameDefMinions.length } },
    );
    return { events: [], matchState: ctx.matchState ? queueInteraction(ctx.matchState, interaction) : undefined };
}

/**
 * 回归大海 special：计分后同名随从回手牌
 * MVP：将自己在被计分基地上的所有同 defId 随从回手牌
 */
function innsmouthReturnToTheSea(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };

    // 找触发随从（自身）
    const myMinions = base.minions.filter(m => m.controller === ctx.playerId);
    if (myMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    // 找同基地上自己的同 defId 随从（包含触发随从自身）
    const grouped = new Map<string, typeof myMinions>();
    for (const minion of myMinions) {
        const existing = grouped.get(minion.defId);
        if (existing) {
            existing.push(minion);
        } else {
            grouped.set(minion.defId, [minion]);
        }
    }

    if (grouped.size === 1) {
        const [minionDefId] = grouped.keys();
        return buildReturnToSeaMinionPrompt(ctx, baseIndex, minionDefId);
    }

    // "任意数量"→创建多选交互让玩家选择返回哪些
    const options = Array.from(grouped.entries()).map(([minionDefId, minions], i) => {
        const def = getCardDef(minionDefId);
        const name = def?.name ?? minionDefId;
        return {
            id: `name-${i}`,
            label: `${name} x${minions.length}`,
            value: {
                cardUid: ctx.cardUid,
                baseIndex,
                baseDefId: base.defId,
                minionDefId,
            },
            _source: 'field' as const,
            displayMode: 'card' as const,
        };
    });
    const interaction = createSimpleChoice<ReturnToSeaNameChoiceValue>(
        buildReturnToSeaInteractionId(ctx, 'choose_name'), ctx.playerId,
        '选择要返回手牌的同名随从', options,
        { sourceId: 'innsmouth_return_to_the_sea_choose_name', targetType: 'generic' },
    );
    return { events: [], matchState: ctx.matchState ? queueInteraction(ctx.matchState, interaction) : undefined };
}

function innsmouthReturnToTheSeaAfterScoring(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    const { state, baseIndex, now, sourceCardUid } = ctx;
    if (baseIndex === undefined || !sourceCardUid) return [];

    const armedEntry = (state.pendingAfterScoringSpecials ?? []).find(
        special => matchesDefId(special.sourceDefId, 'innsmouth_return_to_the_sea')
            && special.baseIndex === baseIndex
            && special.cardUid === sourceCardUid,
    );
    if (!armedEntry) return [];

    const consumedEvent = {
        type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED,
        payload: {
            sourceDefId: armedEntry.sourceDefId,
            playerId: armedEntry.playerId,
            baseIndex: armedEntry.baseIndex,
            cardUid: armedEntry.cardUid,
        },
        timestamp: now,
    } as SmashUpEvent;

    const abilityResult = innsmouthReturnToTheSea({
        state,
        matchState: ctx.matchState,
        playerId: armedEntry.playerId,
        cardUid: armedEntry.cardUid ?? sourceCardUid,
        defId: armedEntry.sourceDefId,
        baseIndex: armedEntry.baseIndex,
        random: ctx.random,
        now,
    });

    return {
        events: [consumedEvent, ...abilityResult.events],
        matchState: abilityResult.matchState,
    };
}

/**
 * 本地人 onPlay：展示牌库顶3张，将其中的"本地人"（同 defId）放入手牌，其余放牌库底
 */
function innsmouthTheLocals(ctx: AbilityContext): AbilityResult {
    const { events } = revealAndPickFromDeck({
        state: ctx.state,
        random: ctx.random,
        playerId: ctx.playerId,
        count: 3,
        predicate: card => matchesDefId(card.defId, 'innsmouth_the_locals'),
        maxPick: 3,
        revealTo: 'all', // 展示牌库顶给所有人看
        reason: 'innsmouth_the_locals',
        now: ctx.now,
    });
    
    return { events };
}

/**
 * 深潜者的秘密 onPlay：如果你在一个基地有 3+ 同名随从，抽 3 张牌
 * 之后可选额外抽 2 张牌并获得 1 张疯狂卡牌
 */
function innsmouthMysteriesOfTheDeep(ctx: AbilityContext): AbilityResult {
    // 检查是否有基地上有3+同名己方随从
    let hasTriple = false;
    for (const base of ctx.state.bases) {
        const myMinions = base.minions.filter(m => m.controller === ctx.playerId);
        const nameCount: Record<string, number> = {};
        for (const m of myMinions) {
            nameCount[m.defId] = (nameCount[m.defId] || 0) + 1;
        }
        if (Object.values(nameCount).some(c => c >= 3)) {
            hasTriple = true;
            break;
        }
    }
    if (!hasTriple) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };

    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];

    // ?张牌
    const topThree = player.deck.slice(0, 3);
    if (topThree.length > 0) {
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: topThree.length, cardUids: topThree.map(c => c.uid) },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }

    // 提示：是否额外抽2张牌+2张疯狂卡
    const options: PromptOption<{ accept: boolean }>[] = [
        { id: 'yes', label: '是 - 额外抽2张牌+2张疯狂卡', value: { accept: true }, displayMode: 'button' as const },
        { id: 'no', label: '否 - 不收回额外抽牌', value: { accept: false }, displayMode: 'button' as const },
    ];
    const interaction = createSimpleChoice<{ accept: boolean }>(
        `innsmouth_mysteries_of_the_deep_${ctx.now}`, ctx.playerId,
        '是否额外抽2张牌+2张疯狂卡？', options,
        { sourceId: 'innsmouth_mysteries_of_the_deep', targetType: 'button' },
    );
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 宗教圆环 talent：额外打出一个与此基地上随从同名的随从到这里
 * MVP：检查手牌是否有匹配随从，如有则授予1个额外随从额度?
 */
function innsmouthSacredCircle(ctx: AbilityContext): AbilityResult {
    // 找到 sacred_circle 所在基地
    let sacredBaseIndex = -1;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (ctx.state.bases[i].ongoingActions.some(o => o.uid === ctx.cardUid)) {
            sacredBaseIndex = i;
            break;
        }
    }
    if (sacredBaseIndex === -1) return { events: [] };

    const base = ctx.state.bases[sacredBaseIndex];
    const minionDefIds = new Set(base.minions.map(m => m.defId));
    if (minionDefIds.size === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    // 检查手牌是否有同名随从
    const player = ctx.state.players[ctx.playerId];
    const hasMatch = player.hand.some(c => c.type === 'minion' && minionDefIds.has(c.defId));
    if (!hasMatch) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    return { events: [grantExtraMinion(ctx.playerId, 'innsmouth_sacred_circle', ctx.now, sacredBaseIndex, { sameNameOnly: true })] };
}

/**
 * 散播谣言 onPlay：额外打出至多两个与场中一个随从同名的随从。
 * "一个随从" → 玩家先选择场上一个随从名，然后可打出至多2个同名随从
 */
function innsmouthSpreadingTheWord(ctx: AbilityContext): AbilityResult {
    // 收集所有在场随从的 defId（去重）
    const inPlayDefIds = new Set<string>();
    for (const base of ctx.state.bases) {
        for (const m of base.minions) {
            inPlayDefIds.add(m.defId);
        }
    }
    if (inPlayDefIds.size === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    // 检查手牌中有哪些 defId 匹配在场随从
    const player = ctx.state.players[ctx.playerId];
    const matchingDefIds = new Set<string>();
    for (const c of player.hand) {
        if (c.type === 'minion' && inPlayDefIds.has(c.defId)) {
            matchingDefIds.add(c.defId);
        }
    }
    if (matchingDefIds.size === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    // 只有一个匹配名称时自动选择，多个时让玩家选
    const defIdArray = Array.from(matchingDefIds);
    if (defIdArray.length === 1) {
        const chosenDefId = defIdArray[0];
        const matchCount = player.hand.filter(c => c.type === 'minion' && c.defId === chosenDefId).length;
        const grantCount = Math.min(2, matchCount);
        const events: SmashUpEvent[] = [];
        for (let i = 0; i < grantCount; i++) {
            events.push(grantExtraMinion(ctx.playerId, 'innsmouth_spreading_the_word', ctx.now, undefined, { sameNameOnly: true, sameNameDefId: chosenDefId }));
        }
        return { events };
    }

    // 多个匹配名称：让玩家选择一个
    const options = defIdArray.map((defId, i) => {
        const def = getCardDef(defId);
        const name = def?.name ?? defId;
        const count = player.hand.filter(c => c.type === 'minion' && c.defId === defId).length;
        return { id: `name-${i}`, label: `${name}（手牌中有 ${count} 张）`, value: { defId } };
    });
    const interaction = createSimpleChoice<{ defId: string }>(
        `innsmouth_spreading_the_word_${ctx.now}`, ctx.playerId,
        '选择一个随从名（额外打出至多2个同名随从）', options,
        { sourceId: 'innsmouth_spreading_the_word', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// Prompt 继续函数
// ============================================================================

/** 注册印斯茅斯派系的交互解决处理函数 */
export function registerInnsmouthInteractionHandlers(): void {
    // 散播谣言：玩家选择一个随从名后，授予额外同名随从额度
    registerInteractionHandler('innsmouth_spreading_the_word', (state, playerId, value, _iData, _random, timestamp) => {
        const { defId } = value as { defId: string };
        const player = state.core.players[playerId];
        const matchCount = player.hand.filter(c => c.type === 'minion' && c.defId === defId).length;
        const grantCount = Math.min(2, matchCount);
        const events: SmashUpEvent[] = [];
        for (let i = 0; i < grantCount; i++) {
            events.push(grantExtraMinion(playerId, 'innsmouth_spreading_the_word', timestamp, undefined, { sameNameOnly: true, sameNameDefId: defId }));
        }
        return { state, events };
    });

    // 招募：玩家选择抽取 0-3 张疯狂卡
    registerInteractionHandler('innsmouth_recruitment', (state, playerId, value, _iData, _random, timestamp) => {
        const { count } = value as { count: number };
        if (!count || count <= 0) return { state, events: [] };
        const events: SmashUpEvent[] = [];
        const madnessEvt = drawMadnessCards(playerId, count, state.core, 'innsmouth_recruitment', timestamp);
        if (madnessEvt) {
            events.push(madnessEvt);
            const actualDrawn = madnessEvt.payload.cardUids.length;
            for (let i = 0; i < actualDrawn; i++) {
                events.push(grantExtraMinion(playerId, 'innsmouth_recruitment', timestamp));
            }
        }
        return { state, events };
    });

    registerInteractionHandler('innsmouth_mysteries_of_the_deep', (state, playerId, value, _iData, _random, timestamp) => {
        const { accept } = value as { accept: boolean };
        if (!accept) return { state, events: [] };
        const events: SmashUpEvent[] = [];
        const player = state.core.players[playerId];
        const topTwo = player.deck.slice(0, 2);
        if (topTwo.length > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId, count: topTwo.length, cardUids: topTwo.map(c => c.uid) },
                timestamp,
            } as CardsDrawnEvent);
        }
        const madnessEvt = drawMadnessCards(playerId, 2, state.core, 'innsmouth_mysteries_of_the_deep', timestamp);
        if (madnessEvt) events.push(madnessEvt);
        return { state, events };
    });

    // 重返深海：玩家选择返回手牌的同名随从
    registerInteractionHandler('innsmouth_return_to_the_sea_choose_name', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as ReturnToSeaNameChoiceValue;
        if (!selected?.minionDefId) return { state, events: [] };

        const baseIndex = resolveLiveBaseIndex(state.core, selected.baseIndex, selected.baseDefId);
        if (baseIndex === undefined) return { state, events: [] };

        const base = state.core.bases[baseIndex];
        const sameDefMinions = base?.minions.filter(
            minion => minion.controller === playerId && minion.defId === selected.minionDefId,
        ) ?? [];
        if (sameDefMinions.length === 0) return { state, events: [] };

        const options = sameDefMinions.map((minion, i) => {
            const def = getCardDef(minion.defId);
            const name = def?.name ?? minion.defId;
            return {
                id: `minion-${i}`,
                label: name,
                value: {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    owner: minion.owner,
                    controller: minion.controller,
                    baseIndex,
                    baseDefId: base.defId,
                },
                _source: 'field' as const,
                displayMode: 'card' as const,
            };
        });

        const interaction = createSimpleChoice<ReturnToSeaChoiceValue>(
            `innsmouth_return_to_the_sea_choose_${selected.cardUid}_${timestamp}`, playerId,
            '选择要返回手牌的同名随从', options,
            { sourceId: 'innsmouth_return_to_the_sea', targetType: 'minion', multi: { min: 0, max: sameDefMinions.length } },
        );
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('innsmouth_return_to_the_sea', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as ReturnToSeaChoiceValue[];
        if (!Array.isArray(selected) || selected.length === 0) return { state, events: [] };
        const events: SmashUpEvent[] = [];
        for (const item of selected) {
            const core = state.core;
            const resolvedBaseIndex = resolveLiveBaseIndex(core, item.baseIndex, item.baseDefId);
            if (resolvedBaseIndex === undefined) continue;
            const base = core.bases[resolvedBaseIndex];
            const minion = base?.minions.find(m => m.uid === item.minionUid);
            const targetPlayerId = minion?.controller ?? item.controller ?? playerId;
            events.push(...buildValidatedReturnEvents(state, {
                minionUid: item.minionUid,
                minionDefId: item.minionDefId,
                fromBaseIndex: resolvedBaseIndex,
                toPlayerId: targetPlayerId,
                reason: 'innsmouth_return_to_the_sea',
                now: timestamp,
                sourcePlayerId: playerId,
            }));
        }
        return { state, events };
    });
}
