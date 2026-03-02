/**
 * 大杀四方 - 印斯茅斯派系能力
 *
 * 主题：同名随从联动、数量优势?
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { addTempPower, grantExtraMinion, drawMadnessCards, getMinionPower, revealAndPickFromDeck, buildAbilityFeedback } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, DeckReorderedEvent, CardsDrawnEvent, MinionReturnedEvent } from '../domain/types';
import { registerProtection } from '../domain/ongoingEffects';
import type { ProtectionCheckContext } from '../domain/ongoingEffects';
import { getCardDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';

/** 注册印斯茅斯派系所有能力*/
export function registerInnsmouthAbilities(): void {
    // 深潜者（行动卡）：力量≤2的己方随从各+1力量
    registerAbility('innsmouth_the_deep_ones', 'onPlay', innsmouthTheDeepOnes);
    // 新人（行动卡）：所有玩家将弃牌堆随从洗回牌堆?
    registerAbility('innsmouth_new_acolytes', 'onPlay', innsmouthNewAcolytes);
    // 招募（行动卡）：抽最?张疯狂卡，每?= 额外打出1个随从
    registerAbility('innsmouth_recruitment', 'onPlay', innsmouthRecruitment);
    // 本地人（随从 onPlay）：展示牌库底张，同名卡放手牌，其余放牌库底
    registerAbility('innsmouth_the_locals', 'onPlay', innsmouthTheLocals);
    // 回归大海（special）：计分后同名随从回手牌
    registerAbility('innsmouth_return_to_the_sea', 'special', innsmouthReturnToTheSea);
    // 深潜者的秘密（行动卡）：3+同名随从时抽牌，可选额外抽牌?疯狂卡?
    registerAbility('innsmouth_mysteries_of_the_deep', 'onPlay', innsmouthMysteriesOfTheDeep);
    // 宗教圆环（ongoing talent）：额外打出同名随从到此基地
    registerAbility('innsmouth_sacred_circle', 'talent', innsmouthSacredCircle);
    // 散播谣言（行动卡）：额外打出至多2个与场中同名的随从
    registerAbility('innsmouth_spreading_the_word', 'onPlay', innsmouthSpreadingTheWord);

    // === ongoing 效果注册 ===
    // in_plain_sight: 力量的随从不收回受其他玩家影响
    registerProtection('innsmouth_in_plain_sight', 'affect', innsmouthInPlainSightChecker);
}

/** 深潜者?onPlay：每个你的力量≤2的随从获得?1力量 */
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

/** 新人 onPlay：所有玩家将弃牌堆中的所有随从洗回牌堆?*/
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

/** 招募 onPlay：抽最?张疯狂卡，每张成功抽牌?= 额外打出1个随从（MVP：尽量抽牌?张） */
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
        });
    }
    const interaction = createSimpleChoice(
        `innsmouth_recruitment_${ctx.now}`, ctx.playerId,
        '选择抽取疯狂卡的数量（至多3张，每张获得1个额外随从额度）', options,
        'innsmouth_recruitment',
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
    const sight = base.ongoingActions.find(o => o.defId === 'innsmouth_in_plain_sight');
    if (!sight) return false;
    // 只保护?sight 拥有者的随从
    if (ctx.targetMinion.controller !== sight.ownerId) return false;
    // 只保护力量≤2的随从
    const power = getMinionPower(ctx.state, ctx.targetMinion, ctx.targetBaseIndex);
    return power <= 2 && ctx.sourcePlayerId !== sight.ownerId;
}

/**
 * 回归大海 special：计分后同名随从回手牌
 * MVP：将自己在被计分基地上的所有同 defId 随从回手牌
 */
function innsmouthReturnToTheSea(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    // 找触发随从（自身）
    const triggerMinion = base.minions.find(m => m.uid === ctx.cardUid);
    if (!triggerMinion) return { events: [] };

    // 找同基地上自己的同 defId 随从（包含触发随从自身）
    const sameDefMinions = base.minions.filter(
        m => m.controller === ctx.playerId && m.defId === triggerMinion.defId
    );
    if (sameDefMinions.length === 0) return { events: [] };

    // "任意数量"→创建多选交互让玩家选择返回哪些
    const options = sameDefMinions.map((m, i) => {
        const def = getCardDef(m.defId);
        const name = def?.name ?? m.defId;
        return { id: `minion-${i}`, label: name, value: { minionUid: m.uid, minionDefId: m.defId, owner: m.owner } };
    });
    const interaction = createSimpleChoice(
        `innsmouth_return_to_the_sea_${ctx.now}`, ctx.playerId,
        '选择要返回手牌的同名随从', options as any[], 'innsmouth_return_to_the_sea',
        undefined, { min: 0, max: sameDefMinions.length },
    );
    return { events: [], matchState: ctx.matchState ? queueInteraction(ctx.matchState, interaction) : undefined };
}

/**
 * 本地人 onPlay：展示牌库顶3张，将其中的"本地人"（同 defId）放入手牌，其余放牌库底
 */
function innsmouthTheLocals(ctx: AbilityContext): AbilityResult {
    const { events } = revealAndPickFromDeck({
        player: ctx.state.players[ctx.playerId],
        playerId: ctx.playerId,
        count: 3,
        predicate: card => card.defId === 'innsmouth_the_locals',
        maxPick: 3,
        revealTo: 'all', // 展示牌库顶给所有人看
        reason: 'innsmouth_the_locals',
        now: ctx.now,
    });
    return { events };
}

/**
 * 深潜者的秘密 onPlay：如果你在一个基地有3+同名随从，抽3张牌堆?
 * 之后可选额外抽2张牌堆?张疯狂卡牌?
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
    const options = [
        { id: 'yes', label: '是 - 额外抽2张牌+2张疯狂卡', value: { accept: true } },
        { id: 'no', label: '否 - 不收回额外抽牌', value: { accept: false } },
    ];
    const interaction = createSimpleChoice(
        `innsmouth_mysteries_of_the_deep_${ctx.now}`, ctx.playerId,
        '是否额外抽2张牌+2张疯狂卡？', options as any[], 'innsmouth_mysteries_of_the_deep',
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
    const interaction = createSimpleChoice(
        `innsmouth_spreading_the_word_${ctx.now}`, ctx.playerId,
        '选择一个随从名（额外打出至多2个同名随从）', options as any[], 'innsmouth_spreading_the_word',
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
    registerInteractionHandler('innsmouth_return_to_the_sea', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as Array<{ minionUid: string; minionDefId: string; owner: string }>;
        if (!Array.isArray(selected) || selected.length === 0) return { state, events: [] };
        const events: SmashUpEvent[] = [];
        for (const item of selected) {
            events.push({
                type: SU_EVENTS.MINION_RETURNED,
                payload: {
                    minionUid: item.minionUid,
                    minionDefId: item.minionDefId,
                    fromBaseIndex: -1, // 计分后基地已处理，baseIndex 不再关键
                    toPlayerId: item.owner,
                    reason: 'innsmouth_return_to_the_sea',
                },
                timestamp,
            } as MinionReturnedEvent);
        }
        return { state, events };
    });
}
