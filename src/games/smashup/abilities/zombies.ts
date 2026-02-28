/**
 * 大杀四方 - 僵尸派系能力
 *
 * 主题：从弃牌堆复活随从、弃牌堆操作
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { SU_EVENTS } from '../domain/types';
import type {
    CardsDiscardedEvent,
    DeckReshuffledEvent,
    SmashUpEvent,
    MinionCardDef,
    MinionPlayedEvent,
} from '../domain/types';
import { recoverCardsFromDiscard, grantExtraMinion, buildBaseTargetOptions, buildAbilityFeedback } from '../domain/abilityHelpers';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerRestriction, registerTrigger } from '../domain/ongoingEffects';
import type { RestrictionCheckContext, TriggerContext } from '../domain/ongoingEffects';
import { getCardDef, getBaseDef } from '../data/cards';
import { registerDiscardPlayProvider } from '../domain/discardPlayability';

/** 注册僵尸派系所有能力*/
export function registerZombieAbilities(): void {
    registerAbility('zombie_grave_digger', 'onPlay', zombieGraveDigger);
    registerAbility('zombie_walker', 'onPlay', zombieWalker);
    registerAbility('zombie_grave_robbing', 'onPlay', zombieGraveRobbing);
    registerAbility('zombie_not_enough_bullets', 'onPlay', zombieNotEnoughBullets);
    registerAbility('zombie_lend_a_hand', 'onPlay', zombieLendAHand);
    registerAbility('zombie_outbreak', 'onPlay', zombieOutbreak);
    registerAbility('zombie_mall_crawl', 'onPlay', zombieMallCrawl);
    registerAbility('zombie_lord', 'onPlay', zombieLord);
    // 它们不断来临：从弃牌堆额外打出一个随从
    registerAbility('zombie_they_keep_coming', 'onPlay', zombieTheyKeepComing);
    registerAbility('zombie_they_keep_coming_pod', 'onPlay', zombieTheyKeepComing); // POD 规则没变

    // 常规行动/随从也映射 POD
    registerAbility('zombie_grave_digger_pod', 'onPlay', zombieGraveDigger);
    registerAbility('zombie_walker_pod', 'onPlay', zombieWalker);
    registerAbility('zombie_grave_robbing_pod', 'onPlay', zombieGraveRobbing);
    registerAbility('zombie_not_enough_bullets_pod', 'onPlay', zombieNotEnoughBullets);
    registerAbility('zombie_lend_a_hand_pod', 'onPlay', zombieLendAHand);
    registerAbility('zombie_outbreak_pod', 'onPlay', zombieOutbreak);
    registerAbility('zombie_mall_crawl_pod', 'onPlay', zombieMallCrawl);
    registerAbility('zombie_lord_pod', 'onPlay', zombieLord);

    // === ongoing 效果注册 ===
    // 泛滥横行：其他玩家不能打随从到此基地 + 回合开始自毁
    registerRestriction('zombie_overrun', 'play_minion', zombieOverrunRestriction);
    registerTrigger('zombie_overrun', 'onTurnStart', zombieOverrunSelfDestruct);

    registerRestriction('zombie_overrun_pod', 'play_minion', zombieOverrunRestriction);
    registerTrigger('zombie_overrun_pod', 'onTurnStart', zombieOverrunSelfDestruct);

    // === 弃牌堆出牌能力注册 ===
    // 顽强丧尸：被动，弃牌堆中可作为额外随从打出（每回合限一次）
    registerDiscardPlayProvider({
        id: 'zombie_tenacious_z',
        getPlayableCards(core, playerId) {
            const player = core.players[playerId];
            if (!player) return [];
            // 每回合限一次（能力级别限制，不是卡牌级别）
            if (player.usedDiscardPlayAbilities?.includes('zombie_tenacious_z')) return [];
            const cards = player.discard.filter(c => c.defId === 'zombie_tenacious_z' || c.defId === 'zombie_tenacious_z_pod');
            if (cards.length === 0) return [];
            // 返回所有同 defId 的卡牌，用户选哪张都行（同名卡无区别）
            return cards.map(card => {
                const def = getCardDef(card.defId) as MinionCardDef | undefined;
                return {
                    card,
                    allowedBaseIndices: 'all' as const,
                    consumesNormalLimit: false, // 额外打出，不消耗正常额度
                    sourceId: 'zombie_tenacious_z',
                    defId: card.defId,
                    power: def?.power ?? 0,
                    name: def?.name ?? card.defId,
                }
            });
        },
    });

    // 它们为你而来（ongoing 行动卡）：持续效果，可从弃牌堆打出随从到此基地（POD版为替代手牌）
    registerDiscardPlayProvider({
        id: 'zombie_theyre_coming_to_get_you',
        getPlayableCards(core, playerId) {
            const player = core.players[playerId];
            if (!player) return [];
            // 找到所有附着了此 ongoing 卡的基地
            const allowedBases: number[] = [];
            // 记录对应基地上提供此能力的具体Ongoing实例，判断它是原版还是POD版
            const podBases = new Set<number>();

            for (let i = 0; i < core.bases.length; i++) {
                const base = core.bases[i];
                for (const o of base.ongoingActions) {
                    if (o.ownerId === playerId && (o.defId === 'zombie_theyre_coming_to_get_you' || o.defId === 'zombie_theyre_coming_to_get_you_pod')) {
                        allowedBases.push(i);
                        if (o.defId === 'zombie_theyre_coming_to_get_you_pod') {
                            podBases.add(i);
                        }
                    }
                }
            }
            // 修正：原版“They're Coming To Get You”是“Play an extra minion here from your discard pile” -> 额外打出
            // POD版“They're Coming To Get You_pod”是 “Play a minion here from your discard pile instead of from your hand” -> 消耗正常额度

            if (allowedBases.length === 0) return [];
            // 弃牌堆中所有随从都可打出到这些基地
            const minions = player.discard.filter(c => c.type === 'minion');
            return minions.flatMap(card => {
                const def = getCardDef(card.defId) as MinionCardDef | undefined;
                const options = [];
                for (const bIndex of allowedBases) {
                    const isPod = podBases.has(bIndex);
                    options.push({
                        card,
                        allowedBaseIndices: [bIndex], // 每个基地由于可能额度消耗不同，必须拆分选项
                        consumesNormalLimit: isPod ? true : false, // POD 版消耗正常随从额度（代替手牌），原版不消耗（额外随从）
                        sourceId: 'zombie_theyre_coming_to_get_you',
                        defId: card.defId,
                        power: def?.power ?? 0,
                        name: def?.name ?? card.defId,
                    });
                }
                return options;
            });
        },
    });
}

/** 掘墓者 onPlay：从弃牌堆取回一个随从到手牌 */
function zombieGraveDigger(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minionsInDiscard = player.discard.filter(c => c.type === 'minion');
    if (minionsInDiscard.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    const options = minionsInDiscard.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } };
    });
    const skipOption = { id: 'skip', label: '跳过', value: { skip: true } };
    const interaction = createSimpleChoice(
        `zombie_grave_digger_${ctx.now}`, ctx.playerId,
        '选择要从弃牌堆取回的随从（可跳过）', [...options, skipOption] as any[], 'zombie_grave_digger',
    );
    // 手动提供 optionsGenerator：从弃牌堆过滤随从
    (interaction.data as any).optionsGenerator = (state: any) => {
        const p = state.core.players[ctx.playerId];
        const minions = p.discard.filter((c: any) => c.type === 'minion');
        const opts = minions.map((c: any, i: number) => {
            const def = getCardDef(c.defId);
            const name = def?.name ?? c.defId;
            return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } };
        });
        return [...opts, { id: 'skip', label: '跳过', value: { skip: true } }];
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 行尸 onPlay：查看牌库顶，选择弃掉或放回 */
function zombieWalker(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (player.deck.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    const topCard = player.deck[0];
    const def = getCardDef(topCard.defId);
    const cardName = def?.name ?? topCard.defId;
    const interaction = createSimpleChoice(
        `zombie_walker_${ctx.now}`, ctx.playerId,
        `牌库顶是「${cardName}」，选择处理方式`,
        [
            { id: 'discard', label: '弃掉', value: { action: 'discard' } },
            { id: 'keep', label: '放回牌库顶', value: { action: 'keep' } },
        ],
        'zombie_walker',
    );
    const extended = {
        ...interaction,
        data: { ...interaction.data, continuationContext: { cardUid: topCard.uid, defId: topCard.defId } },
    };
    // 私有查看，PromptOverlay 展示给操作者，不发 REVEAL_DECK_TOP
    return { events: [], matchState: queueInteraction(ctx.matchState, extended) };
}

/** 掘墓 onPlay：从弃牌堆取回一张卡到手牌 */
function zombieGraveRobbing(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (player.discard.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    const options = player.discard.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: `${name} (${c.type === 'minion' ? '随从' : '行动'})`, value: { cardUid: c.uid, defId: c.defId } };
    });
    const interaction = createSimpleChoice(
        `zombie_grave_robbing_${ctx.now}`, ctx.playerId,
        '选择要从弃牌堆取回的卡牌', options, 'zombie_grave_robbing',
    );
    // 手动提供 optionsGenerator：从弃牌堆获取所有卡牌
    (interaction.data as any).optionsGenerator = (state: any) => {
        const p = state.core.players[ctx.playerId];
        return p.discard.map((c: any, i: number) => {
            const def = getCardDef(c.defId);
            const name = def?.name ?? c.defId;
            return { id: `card-${i}`, label: `${name} (${c.type === 'minion' ? '随从' : '行动'})`, value: { cardUid: c.uid, defId: c.defId } };
        });
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 子弹不够 onPlay：选择一个随从名，取回弃牌堆中所有同名随从 */
function zombieNotEnoughBullets(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minionsInDiscard = player.discard.filter(c => c.type === 'minion');
    if (minionsInDiscard.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    // 按 defId 分组
    const groups = new Map<string, { defId: string; uids: string[]; name: string }>();
    for (const c of minionsInDiscard) {
        if (!groups.has(c.defId)) {
            const def = getCardDef(c.defId);
            groups.set(c.defId, { defId: c.defId, uids: [], name: def?.name ?? c.defId });
        }
        groups.get(c.defId)!.uids.push(c.uid);
    }
    const groupList = Array.from(groups.values());
    const options = groupList.map((g, i) => ({
        id: `group-${i}`, label: `${g.name} (×${g.uids.length})`, value: { defId: g.defId },
    }));
    const interaction = createSimpleChoice(
        `zombie_not_enough_bullets_${ctx.now}`, ctx.playerId,
        '选择要取回的随从名（取回所有同名随从）', options, 'zombie_not_enough_bullets',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 借把手 onPlay：将弃牌堆全部洗回牌库（MVP：全部洗回） */
/** 借把手 onPlay：选择任意数量的牌从弃牌堆洗回牌库 */
function zombieLendAHand(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (player.discard.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    const options = player.discard.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        const typeLabel = c.type === 'minion' ? '随从' : '行动';
        return { id: `card-${i}`, label: `${name} (${typeLabel})`, value: { cardUid: c.uid, defId: c.defId } };
    });
    const interaction = createSimpleChoice(
        `zombie_lend_a_hand_${ctx.now}`, ctx.playerId,
        '借把手：选择要洗回牌库的卡牌（任意数量，可不选）', options, 'zombie_lend_a_hand',
        undefined, { min: 0, max: player.discard.length },
    );
    // 手动提供 optionsGenerator：从弃牌堆获取所有卡牌
    (interaction.data as any).optionsGenerator = (state: any) => {
        const p = state.core.players[ctx.playerId];
        return p.discard.map((c: any, i: number) => {
            const def = getCardDef(c.defId);
            const name = def?.name ?? c.defId;
            const typeLabel = c.type === 'minion' ? '随从' : '行动';
            return { id: `card-${i}`, label: `${name} (${typeLabel})`, value: { cardUid: c.uid, defId: c.defId } };
        });
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 爆发 onPlay：在一个没有己方随从的基地额外打出一个随从（交互选择） */
function zombieOutbreak(ctx: AbilityContext): AbilityResult {
    // 找没有己方随从的基地
    const emptyBases: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (!ctx.state.bases[i].minions.some(m => m.controller === ctx.playerId)) {
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            emptyBases.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
    }
    if (emptyBases.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    // 检查手牌中是否有随从
    const player = ctx.state.players[ctx.playerId];
    const handMinions = player.hand.filter(c => c.type === 'minion' && c.uid !== ctx.cardUid);
    if (handMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };
    // 第一步：选择基地
    const baseOptions = buildBaseTargetOptions(emptyBases, ctx.state);
    const interaction = createSimpleChoice(
        `zombie_outbreak_base_${ctx.now}`, ctx.playerId,
        '爆发：选择一个没有你随从的基地', baseOptions as any[], 'zombie_outbreak_choose_base',
    );
    const extended = {
        ...interaction,
        data: { ...interaction.data, targetType: 'base', continuationContext: { emptyBases } },
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, extended) };
}

/** 僵尸领主 onPlay：在每个没有己方随从的基地从弃牌堆打出力量≤2的随从 */
function zombieLord(ctx: AbilityContext): AbilityResult {
    // 找空基地
    const emptyBases: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (!ctx.state.bases[i].minions.some(m => m.controller === ctx.playerId)) {
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            emptyBases.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
    }
    if (emptyBases.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    // 找弃牌堆中力量≤2的随从
    const player = ctx.state.players[ctx.playerId];
    const discardMinions = player.discard.filter(c => {
        if (c.type !== 'minion') return false;
        const def = getCardDef(c.defId) as MinionCardDef | undefined;
        return def != null && def.power <= 2;
    });
    if (discardMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    // 单步交互：展示弃牌堆可选随从，玩家选随从+点基地一起响应
    const interaction = zombieLordBuildInteraction(ctx.playerId, discardMinions, emptyBases, [], [], ctx.now);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 构建僵尸领主的单步交互（选随从+选基地合并） */
function zombieLordBuildInteraction(
    playerId: string,
    discardMinions: { uid: string; defId: string; type: string }[],
    emptyBases: { baseIndex: number; label: string }[],
    usedCardUids: string[],
    filledBases: number[],
    timestamp: number,
) {
    const options = discardMinions
        .filter(c => !usedCardUids.includes(c.uid))
        .map((c, i) => {
            const def = getCardDef(c.defId) as MinionCardDef | undefined;
            const name = def?.name ?? c.defId;
            const power = def?.power ?? 0;
            return { id: `card-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, power } };
        });
    options.push({ id: 'done', label: '完成', value: { done: true } } as any);
    const allowedBaseIndices = emptyBases.filter(b => !filledBases.includes(b.baseIndex)).map(b => b.baseIndex);
    const interaction = createSimpleChoice(
        `zombie_lord_${timestamp}`, playerId,
        '僵尸领主：选择弃牌堆中的随从，然后点击目标基地', options, 'zombie_lord_pick',
    );
    // 手动提供 optionsGenerator：从弃牌堆过滤力量≤2的随从
    (interaction.data as any).optionsGenerator = (state: any) => {
        const p = state.core.players[playerId];
        const minions = p.discard.filter((c: any) => {
            if (c.type !== 'minion') return false;
            const def = getCardDef(c.defId) as MinionCardDef | undefined;
            return def != null && def.power <= 2;
        }).filter((c: any) => !usedCardUids.includes(c.uid));
        const opts = minions.map((c: any, i: number) => {
            const def = getCardDef(c.defId) as MinionCardDef | undefined;
            const name = def?.name ?? c.defId;
            const power = def?.power ?? 0;
            return { id: `card-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, power } };
        });
        opts.push({ id: 'done', label: '完成', value: { done: true } } as any);
        return opts;
    };
    return {
        ...interaction,
        data: {
            ...interaction.data,
            targetType: 'discard_minion',
            allowedBaseIndices,
            continuationContext: { emptyBases, usedCardUids, filledBases },
        },
    };
}

/** 进发商场 onPlay：选择一个卡名，搜索牌库中所有同名卡放入弃牌堆 */
function zombieMallCrawl(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (player.deck.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    // 按 defId 分组
    const groups = new Map<string, { defId: string; uids: string[] }>();
    for (const c of player.deck) {
        if (!groups.has(c.defId)) {
            groups.set(c.defId, { defId: c.defId, uids: [] });
        }
        groups.get(c.defId)!.uids.push(c.uid);
    }
    const groupList = Array.from(groups.values());
    const options = groupList.map((g, i) => {
        const def = getCardDef(g.defId);
        // label 使用 i18n key，UI 层会通过 resolveI18nKeys 解析
        const nameKey = def?.name ?? g.defId;
        return {
            id: `group-${i}`,
            label: `${nameKey} (×${g.uids.length})`,
            value: { defId: g.defId },
            // 不设置 displayMode，让 UI 层根据 defId 和 previewRef 自动判断显示模式
        };
    });
    const interaction = createSimpleChoice(
        `zombie_mall_crawl_${ctx.now}`, ctx.playerId,
        '选择一个卡名，将牌库中所有同名卡放入弃牌堆', options, 'zombie_mall_crawl',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// 它们不收回断来临：从弃牌堆额外打出一个随从
// ============================================================================

/** 它们不断来临 onPlay：从弃牌堆额外打出一个随从 */
function zombieTheyKeepComing(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minionsInDiscard = player.discard.filter(c => c.type === 'minion');
    if (minionsInDiscard.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    const options = minionsInDiscard.map((c, i) => {
        const def = getCardDef(c.defId) as MinionCardDef | undefined;
        const name = def?.name ?? c.defId;
        const power = def?.power ?? 0;
        return { id: `card-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, power } };
    });
    const interaction = createSimpleChoice(
        `zombie_they_keep_coming_${ctx.now}`, ctx.playerId,
        '选择要从弃牌堆额外打出的随从', options, 'zombie_they_keep_coming',
    );
    // 手动提供 optionsGenerator：从弃牌堆过滤随从
    (interaction.data as any).optionsGenerator = (state: any) => {
        const p = state.core.players[ctx.playerId];
        const minions = p.discard.filter((c: any) => c.type === 'minion');
        return minions.map((c: any, i: number) => {
            const def = getCardDef(c.defId) as MinionCardDef | undefined;
            const name = def?.name ?? c.defId;
            const power = def?.power ?? 0;
            return { id: `card-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, power } };
        });
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// 泛滥横行 (ongoing)：其他玩家不收回能打随从到此基地 + 回合开始自毁
// ============================================================================

/** 泛滥横行限制：其他玩家不收回能打随从到此基地 */
function zombieOverrunRestriction(ctx: RestrictionCheckContext): boolean {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return false;
    const overrun = base.ongoingActions.find(o => o.defId === 'zombie_overrun' || o.defId === 'zombie_overrun_pod');
    if (!overrun) return false;
    // 只限制非拥有者?
    return ctx.playerId !== overrun.ownerId;
}

/** 泛滥横行触发：拥有者回合开始时自毁 */
function zombieOverrunSelfDestruct(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        const overrun = base.ongoingActions.find(o => o.defId === 'zombie_overrun' || o.defId === 'zombie_overrun_pod');
        if (!overrun) continue;
        if (overrun.ownerId !== ctx.playerId) continue;
        events.push({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: { cardUid: overrun.uid, defId: overrun.defId, ownerId: overrun.ownerId, reason: 'zombie_overrun_self_destruct' },
            timestamp: ctx.now,
        });
    }
    return events;
}

// ============================================================================
// 交互解决处理函数（InteractionHandler）
// ============================================================================

/** 注册僵尸派系的交互解决处理函数 */
export function registerZombieInteractionHandlers(): void {
    // 掘墓者：选择弃牌堆随从后取回（可跳过）
    registerInteractionHandler('zombie_grave_digger', (state, playerId, value, _iData, _random, timestamp) => {
        if (value && (value as any).skip) return { state, events: [] };
        const { cardUid } = value as { cardUid: string };
        return { state, events: [recoverCardsFromDiscard(playerId, [cardUid], 'zombie_grave_digger', timestamp)] };
    });

    // 掘墓：选择弃牌堆卡牌后取回
    registerInteractionHandler('zombie_grave_robbing', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as { cardUid: string };
        return { state, events: [recoverCardsFromDiscard(playerId, [cardUid], 'zombie_grave_robbing', timestamp)] };
    });

    // 借把手：多选弃牌堆卡牌后洗回牌库（可不选）
    registerInteractionHandler('zombie_lend_a_hand', (state, playerId, value, _iData, random, timestamp) => {
        const selections = (Array.isArray(value) ? value : [value]) as { cardUid: string }[];
        const selectedUids = new Set(selections.map(s => s.cardUid).filter(Boolean));
        if (selectedUids.size === 0) return { state, events: [] };
        const player = state.core.players[playerId];
        // 将选中的弃牌堆卡牌与现有牌库合并后洗牌
        const selectedCards = player.discard.filter(c => selectedUids.has(c.uid));
        const combined = [...player.deck, ...selectedCards];
        const shuffled = random.shuffle([...combined]);
        // DECK_REORDERED：包含弃牌堆中选中的卡 UID，reducer 会自动从弃牌堆移除
        return {
            state,
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId, deckUids: shuffled.map(c => c.uid) },
                timestamp,
            }],
        };
    });

    // 子弹不够：选择随从名后取回所有同名
    registerInteractionHandler('zombie_not_enough_bullets', (state, playerId, value, _iData, _random, timestamp) => {
        const { defId } = value as { defId: string };
        const player = state.core.players[playerId];
        const sameNameMinions = player.discard.filter(c => c.type === 'minion' && c.defId === defId);
        if (sameNameMinions.length === 0) return { state, events: [] };
        return { state, events: [recoverCardsFromDiscard(playerId, sameNameMinions.map(c => c.uid), 'zombie_not_enough_bullets', timestamp)] };
    });

    // 行尸：选择弃掉或保留
    registerInteractionHandler('zombie_walker', (state, playerId, value, iData, _random, timestamp) => {
        const { action } = value as { action: 'discard' | 'keep' };
        if (action === 'keep') return { state, events: [] };
        const contCtx = iData?.continuationContext as { cardUid: string } | undefined;
        if (!contCtx?.cardUid) return { state, events: [] };
        return {
            state,
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId, cardUids: [contCtx.cardUid] },
                timestamp,
            } as CardsDiscardedEvent],
        };
    });

    // 进发商场：选择卡名后搜索同名卡放入弃牌堆，之后重洗牌库
    // 事件顺序：先 DECK_RESHUFFLED（重建牌库，同名卡放在牌库顶部以便后续弃牌），
    // 再 CARDS_DISCARDED（从牌库中将同名卡移入弃牌堆）。
    registerInteractionHandler('zombie_mall_crawl', (state, playerId, value, _iData, random, timestamp) => {
        const { defId } = value as { defId: string };
        const player = state.core.players[playerId];
        const sameNameCards = player.deck.filter(c => c.defId === defId);
        if (sameNameCards.length === 0) {
            // 牌库中未找到同名卡（极端边缘情况），规则仍要求重洗牌库
            const shuffled = random.shuffle([...player.deck]);
            const deckUids = [...shuffled.map(c => c.uid), ...player.discard.map(c => c.uid)];
            return {
                state, events: [
                    { type: SU_EVENTS.DECK_RESHUFFLED, payload: { playerId, deckUids }, timestamp } as DeckReshuffledEvent,
                    buildAbilityFeedback(playerId, 'feedback.deck_search_no_match', timestamp),
                ]
            };
        }
        const uids = sameNameCards.map(c => c.uid);
        // 剩余牌库洗牌，同名卡放在最前面（它们会被后续 CARDS_DISCARDED 移走）
        const remainingDeck = player.deck.filter(c => c.defId !== defId);
        const shuffledRemaining = random.shuffle([...remainingDeck]);
        // deckUids = 同名卡 + 洗牌后的剩余牌库 + 当前弃牌堆（DECK_RESHUFFLED 会合并 deck+discard）
        const deckUids = [...uids, ...shuffledRemaining.map(c => c.uid), ...player.discard.map(c => c.uid)];
        return {
            state,
            events: [
                // 1. 重建牌库：合并 deck+discard，按 deckUids 排序，discard 清空
                //    同名卡在 deckUids 中所以会保留在新 deck 里，原 discard 的卡也合并进 deck
                { type: SU_EVENTS.DECK_RESHUFFLED, payload: { playerId, deckUids }, timestamp } as DeckReshuffledEvent,
                // 2. 弃牌：同名卡从 deck 移入 discard
                { type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId, cardUids: uids }, timestamp } as CardsDiscardedEvent,
            ],
        };
    });

    // 爆发第一步：选择空基地后 → 选择手牌随从
    registerInteractionHandler('zombie_outbreak_choose_base', (state, playerId, value, _iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const player = state.core.players[playerId];
        const handMinions = player.hand.filter(c => c.type === 'minion');
        if (handMinions.length === 0) return { state, events: [] };
        const options = handMinions.map((c, i) => {
            const def = getCardDef(c.defId) as MinionCardDef | undefined;
            const name = def?.name ?? c.defId;
            const power = def?.power ?? 0;
            return { id: `card-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, power } };
        });
        const next = createSimpleChoice(
            `zombie_outbreak_minion_${timestamp}`, playerId,
            '爆发：选择要打出的随从', options, 'zombie_outbreak_choose_minion',
        );
        return {
            state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { targetBaseIndex: baseIndex } } }),
            events: [grantExtraMinion(playerId, 'zombie_outbreak', timestamp)],
        };
    });

    // 爆发第二步：选择随从后打出到指定基地
    registerInteractionHandler('zombie_outbreak_choose_minion', (state, playerId, value, iData, _random, timestamp) => {
        const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
        const contCtx = iData?.continuationContext as { targetBaseIndex: number };
        if (!contCtx) return undefined;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid, defId, baseIndex: contCtx.targetBaseIndex, power },
            timestamp,
        };
        return { state, events: [playedEvt] };
    });

    // 僵尸领主：选随从+选基地合并为单步交互
    registerInteractionHandler('zombie_lord_pick', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { done?: boolean; cardUid?: string; defId?: string; power?: number; baseIndex?: number };
        if (selected.done) return { state, events: [] }; // 完成
        const { cardUid, defId, power, baseIndex } = selected as { cardUid: string; defId: string; power: number; baseIndex: number };
        const contCtx = iData?.continuationContext as { emptyBases: { baseIndex: number; label: string }[]; usedCardUids: string[]; filledBases: number[] };
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid, defId, baseIndex, power, fromDiscard: true },
            timestamp,
        };
        const events: SmashUpEvent[] = [playedEvt];
        // 更新已用列表
        const usedCardUids = [...contCtx.usedCardUids, cardUid];
        const filledBases = [...contCtx.filledBases, baseIndex];
        // 检查是否还有空基地和弃牌堆随从
        const remainingBases = contCtx.emptyBases.filter(b => !filledBases.includes(b.baseIndex));
        if (remainingBases.length === 0) return { state, events };
        const player = state.core.players[playerId];
        const remainingMinions = player.discard.filter(c => {
            if (c.type !== 'minion') return false;
            if (usedCardUids.includes(c.uid)) return false;
            const def = getCardDef(c.defId) as MinionCardDef | undefined;
            return def != null && def.power <= 2;
        });
        if (remainingMinions.length === 0) return { state, events };
        // 继续下一轮
        const next = zombieLordBuildInteraction(playerId, remainingMinions, contCtx.emptyBases, usedCardUids, filledBases, timestamp);
        return { state: queueInteraction(state, next), events };
    });

    // 它们不断来临：选弃牌堆随从后 → 链式选择基地
    registerInteractionHandler('zombie_they_keep_coming', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
        // 选择基地
        const candidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            const baseDef = getBaseDef(state.core.bases[i].defId);
            candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        if (candidates.length === 1) {
            // 只有一个基地直接打出
            const playedEvt: MinionPlayedEvent = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: { playerId, cardUid, defId, baseIndex: candidates[0].baseIndex, power, fromDiscard: true },
                timestamp,
            };
            return {
                state,
                events: [
                    grantExtraMinion(playerId, 'zombie_they_keep_coming', timestamp),
                    playedEvt,
                ],
            };
        }
        const next = createSimpleChoice(
            `zombie_they_keep_coming_base_${timestamp}`, playerId,
            '选择要打出随从的基地',
            buildBaseTargetOptions(candidates, state.core),
            { sourceId: 'zombie_they_keep_coming_choose_base', targetType: 'base' },
        );
        return {
            state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { cardUid, defId, power } } }),
            events: [grantExtraMinion(playerId, 'zombie_they_keep_coming', timestamp)],
        };
    });

    // 它们不断来临：选择基地后打出
    registerInteractionHandler('zombie_they_keep_coming_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; defId: string; power: number };
        if (!ctx) return undefined;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid: ctx.cardUid, defId: ctx.defId, baseIndex, power: ctx.power, fromDiscard: true },
            timestamp,
        };
        return { state, events: [playedEvt] };
    });

    // （已删除旧的"它们为你而来"交互处理器——现在通过 PLAY_MINION fromDiscard 命令直接打出）

    // （已删除旧的"顽强丧尸"交互处理器——现在通过 PLAY_MINION fromDiscard 命令直接打出）
}
