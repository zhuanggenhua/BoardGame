/**
 * 大杀四方 - 扩展包基地能力（克苏鲁 / AL9000 / Pretty Pretty）
 *
 * 从 baseAbilities.ts 拆分，避免单文件超过 1000 行。
 * 在 registerBaseAbilities() 末尾调用 registerExpansionBaseAbilities()。
 * 在 registerBaseInteractionHandlers() 末尾调用 registerExpansionBaseInteractionHandlers()。
 */

import type {
    SmashUpEvent,
    MinionDestroyedEvent,
    CardsDrawnEvent,
    CardToDeckBottomEvent,
    MinionPlayedEvent,
} from './types';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from './types';
import { getEffectivePower } from './ongoingModifiers';
import {
    returnMadnessCard,
    moveMinion,
    destroyMinion,
    grantExtraMinion,
    grantExtraAction,
    recoverCardsFromDiscard,
} from './abilityHelpers';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import { registerBaseAbility, registerExtended as registerExtendedBase } from './baseAbilities';
import { registerProtection, registerTrigger } from './ongoingEffects';
import type { ProtectionCheckContext } from './ongoingEffects';
import { getCardDef, getMinionDef, getBaseDef } from '../data/cards';
import { getPlayerLabel } from './utils';

// ============================================================================
// 克苏鲁扩展基地能力
// ============================================================================

/** 注册扩展包基地能力*/
export function registerExpansionBaseAbilities(): void {

    // ── 疯人院（The Asylum）──────────────────────────────────────
    // "在一个玩家打出一个随从到这后，该玩家可以将一张疯狂卡从手牌或弃牌堆返回疯狂牌堆"
    // 疯狂卡都是同一张牌（special_madness），按来源分组显示，无需逐张列出
    registerBaseAbility('base_the_asylum', 'onMinionPlayed', (ctx) => {
        if (!ctx.state.madnessDeck) return { events: [] };
        const player = ctx.state.players[ctx.playerId];
        if (!player) return { events: [] };

        const handMadness = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID);
        const discardMadness = player.discard.filter(c => c.defId === MADNESS_CARD_DEF_ID);

        if (handMadness.length === 0 && discardMadness.length === 0) return { events: [] };

        // 按来源分组的按钮选项（返回1张）
        const options: any[] = [];
        if (handMadness.length > 0) {
            options.push({
                id: 'hand',
                label: `从手牌返回 (${handMadness.length}张)`,
                value: { source: 'hand' },
                displayMode: 'button' as const,
            });
        }
        if (discardMadness.length > 0) {
            options.push({
                id: 'discard',
                label: `从弃牌堆返回 (${discardMadness.length}张)`,
                value: { source: 'discard' },
                displayMode: 'button' as const,
            });
        }
        options.push({
            id: 'skip',
            label: '跳过',
            value: { skip: true },
            displayMode: 'button' as const,
        });

        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_the_asylum_${ctx.now}`, ctx.playerId,
            '疯人院：选择返回一张疯狂卡', options as any[], 'base_the_asylum',
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });

    // ── 印斯茅斯基地（Innsmouth Base）────────────────────────────
    // "在一个玩家打出一个随从到这后，该玩家可以将任意玩家弃牌堆中的一张卡放到其拥有者的牌库底?
    registerBaseAbility('base_innsmouth_base', 'onMinionPlayed', (ctx) => {
        // 收集所有玩家弃牌堆中的卡牌
        const discardCards: { uid: string; defId: string; ownerId: string; label: string }[] = [];
        for (const [pid, player] of Object.entries(ctx.state.players)) {
            for (const c of player.discard) {
                const def = getCardDef(c.defId);
                discardCards.push({
                    uid: c.uid,
                    defId: c.defId,
                    ownerId: pid,
                    label: `${def?.name ?? c.defId} (${getPlayerLabel(pid)}的弃牌堆)`,
                });
            }
        }

        if (discardCards.length === 0) return { events: [] };

        const options: { id: string; label: string; value: Record<string, unknown> }[] = [
            { id: 'skip', label: '跳过', value: { skip: true } },
            ...discardCards.map((c, i) => ({
                id: `card-${i}`,
                label: c.label,
                value: { cardUid: c.uid, defId: c.defId, ownerId: c.ownerId },
            })),
        ];

        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_innsmouth_base_${ctx.now}`, ctx.playerId,
            '印斯茅斯基地：选择一张弃牌堆卡放入牌库底', options as any[], 'base_innsmouth_base',
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });

    // ── 密斯卡托尼克大学基地（Miskatonic University Base）────────
    // "在这个基地计分后，冠军可以搜寻他的手牌和弃牌堆中任意数量的疯狂卡，然后返回到疯狂卡牌库。"
    // 疯狂卡都是同一张牌（special_madness），按来源+数量分组显示按钮，无需逐张列出
    registerBaseAbility('base_miskatonic_university_base', 'afterScoring', (ctx) => {
        if (!ctx.state.madnessDeck) return { events: [] };
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };

        // 只限冠军操作
        const winnerId = ctx.rankings[0].playerId;
        const winner = ctx.state.players[winnerId];
        if (!winner) return { events: [] };

        const handMadness = winner.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID);
        const discardMadness = winner.discard.filter(c => c.defId === MADNESS_CARD_DEF_ID);
        const totalCount = handMadness.length + discardMadness.length;

        // 无疯狂卡 → 跳过
        if (totalCount === 0) return { events: [] };

        // 按来源+数量分组的按钮选项
        const options: any[] = [];

        if (handMadness.length > 0) {
            for (let i = 1; i <= handMadness.length; i++) {
                options.push({
                    id: `hand-${i}`,
                    label: `从手牌返回 ${i} 张`,
                    value: { source: 'hand', count: i },
                    displayMode: 'button' as const,
                });
            }
        }

        if (discardMadness.length > 0) {
            for (let i = 1; i <= discardMadness.length; i++) {
                options.push({
                    id: `discard-${i}`,
                    label: `从弃牌堆返回 ${i} 张`,
                    value: { source: 'discard', count: i },
                    displayMode: 'button' as const,
                });
            }
        }

        // 两个来源都有时，添加"全部返回"选项
        if (handMadness.length > 0 && discardMadness.length > 0) {
            options.push({
                id: 'all',
                label: `全部返回 (手牌${handMadness.length}张 + 弃牌堆${discardMadness.length}张)`,
                value: { source: 'all', handCount: handMadness.length, discardCount: discardMadness.length },
                displayMode: 'button' as const,
            });
        }

        options.push({
            id: 'skip',
            label: '不返回',
            value: { skip: true },
            displayMode: 'button' as const,
        });

        if (ctx.matchState) {
            const interaction = createSimpleChoice(
                `base_miskatonic_university_base_${winnerId}_${ctx.now}`, winnerId,
                `密大基地：你有 ${totalCount} 张疯狂卡可以返回到疯狂牌库`, options as any[], 'base_miskatonic_university_base',
            );
            ctx.matchState = queueInteraction(ctx.matchState, interaction);
        }

        return { events: [], matchState: ctx.matchState };
    });

    // ── 冷原高地（Plateau of Leng）──────────────────────────────
    // "每回合玩家第一次打出一个随从到这里后，可以额外打出一张与其同名的随从到这里"
    registerBaseAbility('base_plateau_of_leng', 'onMinionPlayed', (ctx) => {
        if (!ctx.minionDefId) return { events: [] };
        const player = ctx.state.players[ctx.playerId];
        if (!player) return { events: [] };

        // 每回合只有第一次打出随从到此基地才触发
        // reduce 已执行，minionsPlayedPerBase 包含刚打出的随从，首次打出时值为 1
        const playedAtBase = player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
        if (playedAtBase !== 1) return { events: [] };

        // 检查手牌中是否有同名随从（相同 defId?
        const sameNameMinions = player.hand.filter(
            c => c.defId === ctx.minionDefId && c.type === 'minion'
        );

        // 无同名随从?不生成 Prompt
        if (sameNameMinions.length === 0) return { events: [] };

        const def = getCardDef(ctx.minionDefId);
        const minionName = def?.name ?? ctx.minionDefId;

        const options: { id: string; label: string; value: Record<string, unknown> }[] = [
            { id: 'skip', label: '跳过', value: { skip: true } },
            ...sameNameMinions.map((m, i) => ({
                id: `minion-${i}`,
                label: `打出 ${minionName}`,
                value: { cardUid: m.uid, defId: m.defId },
            })),
        ];

        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_plateau_of_leng_${ctx.now}`, ctx.playerId,
            `冷原高地：是否打出同名随从${minionName}？`, options as any[], 'base_plateau_of_leng',
        );
        (interaction.data as any).continuationContext = { baseIndex: ctx.baseIndex };
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });

    // ============================================================================
    // AL9000 扩展基地能力
    // ============================================================================

    // ── 温室（Greenhouse）──────────────────────────────────────
    // "在这个基地计分后，冠军可以从他的牌库中搜寻一张随从并将它打出到将替换本基地的基地上）?
    registerBaseAbility('base_greenhouse', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const winner = ctx.state.players[winnerId];
        if (!winner) return { events: [] };

        // 搜索冠军牌库中的随从?
        const minionsInDeck = winner.deck.filter(c => c.type === 'minion');
        if (minionsInDeck.length === 0) return { events: [] };

        const options: { id: string; label: string; value: Record<string, unknown> }[] = [
            { id: 'skip', label: '跳过', value: { skip: true } },
            ...minionsInDeck.map((c, i) => {
                const def = getMinionDef(c.defId);
                return {
                    id: `minion-${i}`,
                    label: `${def?.name ?? c.defId} (力量${def?.power ?? '?'})`,
                    value: { cardUid: c.uid, defId: c.defId, power: def?.power ?? 0 },
                };
            }),
        ];

        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_greenhouse_${ctx.now}`, winnerId,
            '温室：从牌库中选择一个随从打出到新基地', options as any[], 'base_greenhouse',
        );
        (interaction.data as any).continuationContext = { baseIndex: ctx.baseIndex };
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });

    // ── 神秘花园（Secret Garden）──────────────────────────────
    // "在你的回合，你可以额外打出一个力量为2或以下的随从到这里）?
    // 力量的 限制通过 BaseCardDef.restrictions ?extraPlayMinionPowerMax 数据驱动实现（同母星模式）
    registerBaseAbility('base_secret_garden', 'onTurnStart', (ctx) => {
        return {
            events: [grantExtraMinion(
                ctx.playerId,
                '神秘花园：额外打出力量≤2的随从',
                ctx.now,
                ctx.baseIndex,
            )],
        };
    });

    // ── 发明家沙龙（Inventor's Salon）──────────────────────────
    // "在这个基地计分后，冠军可以从他的弃牌堆中选取一张战术卡将其置入他的手牌堆?
    registerBaseAbility('base_inventors_salon', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const winner = ctx.state.players[winnerId];
        if (!winner) return { events: [] };

        // 搜索冠军弃牌堆中的行动卡
        const actionsInDiscard = winner.discard.filter(c => c.type === 'action');
        if (actionsInDiscard.length === 0) return { events: [] };

        const options: { id: string; label: string; value: Record<string, unknown> }[] = [
            { id: 'skip', label: '跳过', value: { skip: true } },
            ...actionsInDiscard.map((c, i) => {
                const def = getCardDef(c.defId);
                return {
                    id: `action-${i}`,
                    label: def?.name ?? c.defId,
                    value: { cardUid: c.uid, defId: c.defId },
                };
            }),
        ];

        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_inventors_salon_${ctx.now}`, winnerId,
            '发明家沙龙：从弃牌堆选择一张行动卡放入手牌', options as any[], 'base_inventors_salon',
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });

    // ============================================================================
    // Pretty Pretty 扩展基地能力
    // ============================================================================

    // ── 诡猫巷（Cat Fanciers' Alley）──────────────────────────
    // "你的回合中一次，你可以消灭这里你的一个随从来抽一张卡牌?
    // talent 能力：onTurnStart 生成 Prompt，每回合一次（Prompt 消费即完成）
    registerBaseAbility('base_cat_fanciers_alley', 'onTurnStart', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };

        // 收集当前玩家在此基地的随从
        const myMinions = base.minions.filter(m => m.controller === ctx.playerId);
        if (myMinions.length === 0) return { events: [] };

        const minionOptions = myMinions.map((m, i) => {
            const def = getCardDef(m.defId);
            return {
                id: `minion-${i}`,
                label: `${def?.name ?? m.defId} (力量${getEffectivePower(ctx.state, m, ctx.baseIndex)})`,
                value: { minionUid: m.uid, minionDefId: m.defId, owner: m.owner },
            };
        });
        const options: { id: string; label: string; value: Record<string, unknown> }[] = [
            { id: 'skip', label: '跳过', value: { skip: true } },
            ...minionOptions,
        ];

        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_cat_fanciers_alley_${ctx.now}`, ctx.playerId,
            '诡猫巷：消灭一个己方随从来抽一张卡牌', options as any[],
            { sourceId: 'base_cat_fanciers_alley', targetType: 'minion' },
        );
        (interaction.data as any).continuationContext = { baseIndex: ctx.baseIndex };
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });

    // ── 魔法林地（Enchanted Glade）──────────────────────────────
    // "在一个玩家打出一张附着行动卡到这里的一个随从上后，该玩家抽一张卡牌?
    registerBaseAbility('base_enchanted_glade', 'onActionPlayed', (ctx) => {
        // 只有附着到随从的行动卡才触发（actionTargetMinionUid 有值）
        if (!ctx.actionTargetMinionUid) return { events: [] };

        const player = ctx.state.players[ctx.playerId];
        if (!player || player.deck.length === 0) return { events: [] };

        return {
            events: [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: {
                    playerId: ctx.playerId,
                    count: 1,
                    cardUids: [player.deck[0].uid],
                },
                timestamp: ctx.now,
            } as CardsDrawnEvent],
        };
    });

    // ── 仙灵之环（Fairy Ring）──────────────────────────────────
    // "在一个玩家首次打出一个随从到这后，该玩家可以额外打出一个随从和一张行动卡牌"
    // 通过 minionsPlayedPerBase 追踪每回合每基地打出次数，reduce 已执行，首次打出时值为 1
    registerBaseAbility('base_fairy_ring', 'onMinionPlayed', (ctx) => {
        const player = ctx.state.players[ctx.playerId];
        if (!player) return { events: [] };

        // 每回合只有第一次打出随从到此基地才触发
        // reduce 已执行，minionsPlayedPerBase 包含刚打出的随从，首次打出时值为 1
        const playedAtBase = player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
        if (playedAtBase !== 1) return { events: [] };

        return {
            events: [
                grantExtraMinion(ctx.playerId, '仙灵之环：首次打出随从后额外随从机会', ctx.now, ctx.baseIndex),
                grantExtraAction(ctx.playerId, '仙灵之环：首次打出随从后额外行动机会', ctx.now),
            ],
        };
    });

    // ── 平衡之地（Land of Balance）──────────────────────────────
    // "在一个玩家打出一个随从到这后，该玩家可以将他在其他基地的一个随从移动到这里）?
    registerBaseAbility('base_land_of_balance', 'onMinionPlayed', (ctx) => {
        const balanceBaseIndex = ctx.baseIndex;

        // 收集该玩家在其他基地的随从
        const otherBaseMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            if (i === balanceBaseIndex) continue;
            const base = ctx.state.bases[i];
            const bDef = getBaseDef(base.defId);
            for (const m of base.minions) {
                if (m.controller !== ctx.playerId) continue;
                const def = getCardDef(m.defId);
                otherBaseMinions.push({
                    uid: m.uid,
                    defId: m.defId,
                    baseIndex: i,
                    label: `${def?.name ?? m.defId} (${bDef?.name ?? '基地'}, 力量${getEffectivePower(ctx.state, m, i)})`,
                });
            }
        }

        // 无其他基地随从?不生成 Prompt
        if (otherBaseMinions.length === 0) return { events: [] };

        const minionOptions = otherBaseMinions.map((m, i) => ({
            id: `minion-${i}`,
            label: m.label,
            value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.baseIndex },
        }));
        const options: { id: string; label: string; value: Record<string, unknown> }[] = [
            { id: 'skip', label: '跳过', value: { skip: true } },
            ...minionOptions,
        ];

        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_land_of_balance_${ctx.now}`, ctx.playerId,
            '平衡之地：选择一个己方随从移动到这里', options as any[],
            { sourceId: 'base_land_of_balance', targetType: 'minion' },
        );
        (interaction.data as any).continuationContext = { balanceBaseIndex };
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });

    // ── 九命之屋（House of Nine Lives）──────────────────────────
    // "当你的一个随从在其他基地被消灭时，你可以将它移动到这里"
    // 通过 registerTrigger(onMinionDestroyed) 注册，创建玩家选择交互
    // processDestroyTriggers 的 pendingSaveMinionUids 机制会暂缓消灭事件
    registerTrigger('base_house_of_nine_lives', 'onMinionDestroyed', (trigCtx) => {
        const { state, triggerMinionUid, triggerMinionDefId } = trigCtx;
        const baseIndex = trigCtx.baseIndex;
        if (!triggerMinionUid || !triggerMinionDefId || baseIndex === undefined) return [];

        // 找到九命之屋的基地索引
        let houseBaseIndex = -1;
        for (let i = 0; i < state.bases.length; i++) {
            if (state.bases[i].defId === 'base_house_of_nine_lives') {
                houseBaseIndex = i;
                break;
            }
        }
        // 九命之屋不在场→不触发
        if (houseBaseIndex === -1) return [];

        // 随从在九命之屋本身被消灭→不触发（只拦截其他基地）
        if (baseIndex === houseBaseIndex) return [];

        // 查找被消灭随从的拥有者
        const minion = state.bases[baseIndex]?.minions.find(m => m.uid === triggerMinionUid);
        const ownerId = minion?.owner ?? trigCtx.playerId;

        // 创建玩家选择交互：移动到九命之屋 or 正常消灭
        if (!trigCtx.matchState) return [];
        const interaction = createSimpleChoice(
            `nine_lives_${triggerMinionUid}_${trigCtx.now}`,
            ownerId,
            '九命之屋：是否将随从移动到九命之屋？',
            [
                { id: 'move', label: '移动到九命之屋', value: { move: true, minionUid: triggerMinionUid, minionDefId: triggerMinionDefId, fromBaseIndex: baseIndex, houseBaseIndex } },
                { id: 'skip', label: '不移动（正常消灭）', value: { move: false, minionUid: triggerMinionUid, minionDefId: triggerMinionDefId, fromBaseIndex: baseIndex, ownerId } },
            ],
            { sourceId: 'base_nine_lives_intercept', targetType: 'generic' },
        );
        const updatedMS = queueInteraction(trigCtx.matchState, interaction);
        // 返回空事件 + 更新后的 matchState（processDestroyTriggers 检测到 matchState 变化 → pendingSaveMinionUids）
        return { events: [], matchState: updatedMS };
    });

    // ── 被动保护类基地──────────────────────────────────────────

    // 美丽城堡（Beautiful Castle）：力量的 的随从免疫消灭、移动和影响
    // 保护检查时动态查找美丽城堡的基地索引，确保只保护该基地上的随从
    const beautifulCastleChecker = (ctx: ProtectionCheckContext): boolean => {
        // 动态查找美丽城堡所在基地索引?
        const castleIndex = ctx.state.bases.findIndex(b => b.defId === 'base_beautiful_castle');
        if (castleIndex === -1) return false;
        // 只保护美丽城堡上的随从
        if (ctx.targetBaseIndex !== castleIndex) return false;
        // 力量的 才受保护
        const power = getEffectivePower(ctx.state, ctx.targetMinion, ctx.targetBaseIndex);
        return power >= 5;
    };
    registerProtection('base_beautiful_castle', 'destroy', beautifulCastleChecker);
    registerProtection('base_beautiful_castle', 'move', beautifulCastleChecker);
    registerProtection('base_beautiful_castle', 'affect', beautifulCastleChecker);

    // 卵室（Egg Chamber）：这里有 +1 力量指示物的随从不能被消灭
    registerProtection('base_egg_chamber', 'destroy', (ctx: ProtectionCheckContext): boolean => {
        const eggIndex = ctx.state.bases.findIndex(b => b.defId === 'base_egg_chamber');
        if (eggIndex === -1) return false;
        if (ctx.targetBaseIndex !== eggIndex) return false;
        return (ctx.targetMinion.powerCounters ?? 0) > 0;
    });

    // 小马乐园（Pony Paradise）：拥有 2+ 随从的玩家，其随从免疫消灭
    // 保护检查时动态查找小马乐园的基地索引，并统计该玩家在此基地的随从数量
    registerProtection('base_pony_paradise', 'destroy', (ctx: ProtectionCheckContext): boolean => {
        // 动态查找小马乐园所在基地索引?
        const ponyIndex = ctx.state.bases.findIndex(b => b.defId === 'base_pony_paradise');
        if (ponyIndex === -1) return false;
        // 只保护小马乐园上的随从
        if (ctx.targetBaseIndex !== ponyIndex) return false;
        // 统计该随从控制者在此基地的随从数量
        const base = ctx.state.bases[ponyIndex];
        const ownerMinionCount = base.minions.filter(m => m.controller === ctx.targetMinion.controller).length;
        return ownerMinionCount >= 2;
    });


    // ============================================================================
    // 绵羊/牧场扩展基地能力
    // ============================================================================

    // ── 绵羊神社（Sheep Shrine）──────────────────────────────
    // "这张基地入场后，每位玩家可以移动一个他们的随从到这。"
    // 通过 onBaseRevealed 扩展时机触发，在 scoreOneBase 中 BASE_REPLACED 后调用
    registerExtendedBase('base_sheep_shrine', 'onBaseRevealed', (ctx) => {
        if (!ctx.matchState) return { events: [] };
        let ms = ctx.matchState;
        const turnOrder = ctx.state.turnOrder;

        for (const pid of turnOrder) {
            // 收集该玩家在其他基地的随从
            const otherMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
            for (let i = 0; i < ctx.state.bases.length; i++) {
                if (i === ctx.baseIndex) continue;
                const base = ctx.state.bases[i];
                const bDef = getBaseDef(base.defId);
                for (const m of base.minions) {
                    if (m.controller !== pid) continue;
                    const def = getCardDef(m.defId);
                    otherMinions.push({
                        uid: m.uid,
                        defId: m.defId,
                        baseIndex: i,
                        label: `${def?.name ?? m.defId} (${bDef?.name ?? '基地'}, 力量${getEffectivePower(ctx.state, m, i)})`,
                    });
                }
            }
            if (otherMinions.length === 0) continue;

            const minionOptions = otherMinions.map((m, i) => ({
                id: `minion-${i}`,
                label: m.label,
                value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.baseIndex },
            }));
            const options: { id: string; label: string; value: Record<string, unknown> }[] = [
                { id: 'skip', label: '跳过', value: { skip: true } },
                ...minionOptions,
            ];

            const interaction = createSimpleChoice(
                `base_sheep_shrine_${pid}_${ctx.now}`, pid,
                '绵羊神社：选择移动一个己方随从到此基地', options as any[],
                { sourceId: 'base_sheep_shrine', targetType: 'minion' },
            );
            (interaction.data as any).continuationContext = { targetBaseIndex: ctx.baseIndex };
            ms = queueInteraction(ms, interaction);
        }

        return { events: [], matchState: ms };
    });

    // ── 牧场（The Pasture）──────────────────────────────────
    // "每回合玩家第一次移动一个随从到这里后，移动另一基地的一个随从到这。"
    // 通过 onMinionMoved 扩展时机触发，在 processMoveTriggers 中调用
    registerExtendedBase('base_the_pasture', 'onMinionMoved', (ctx) => {
        // 检查是否为本回合该玩家首次移动到此基地
        // processMoveTriggers 在 execute 返回前调用，reducer 尚未处理 MINION_MOVED 事件
        // 所以 moveCount === 0 表示这是首次移动
        const moveCount = ctx.state.minionsMovedToBaseThisTurn?.[ctx.playerId]?.[ctx.baseIndex] ?? 0;
        if (moveCount > 0) return { events: [] };

        if (!ctx.matchState) return { events: [] };

        // 收集其他基地上的所有随从
        const otherMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            if (i === ctx.baseIndex) continue;
            const base = ctx.state.bases[i];
            const bDef = getBaseDef(base.defId);
            for (const m of base.minions) {
                // 排除刚移动过来的随从
                if (m.uid === ctx.minionUid) continue;
                const def = getCardDef(m.defId);
                otherMinions.push({
                    uid: m.uid,
                    defId: m.defId,
                    baseIndex: i,
                    label: `${def?.name ?? m.defId} (${bDef?.name ?? '基地'}, 力量${getEffectivePower(ctx.state, m, i)})`,
                });
            }
        }

        if (otherMinions.length === 0) return { events: [] };

        const minionOptions = otherMinions.map((m, i) => ({
            id: `minion-${i}`,
            label: m.label,
            value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.baseIndex },
        }));

        const interaction = createSimpleChoice(
            `base_the_pasture_${ctx.now}`, ctx.playerId,
            '牧场：选择另一基地的一个随从移动到这里', minionOptions as any[],
            { sourceId: 'base_the_pasture', targetType: 'minion' },
        );
        (interaction.data as any).continuationContext = { targetBaseIndex: ctx.baseIndex };
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });
}

// ============================================================================
// 扩展包基地交互解决处理函数
// ============================================================================

/** 注册扩展包基地能力的交互解决处理函数 */
export function registerExpansionBaseInteractionHandlers(): void {

    // 疯人院：按来源返回1张疯狂卡（可跳过）
    registerInteractionHandler('base_the_asylum', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; source?: 'hand' | 'discard' };
        if (selected.skip) return { state, events: [] };
        
        const player = state.core.players[playerId];
        const madnessCards = selected.source === 'hand' ? player.hand : player.discard;
        const madnessCard = madnessCards.find(c => c.defId === MADNESS_CARD_DEF_ID);
        
        if (!madnessCard) return { state, events: [] };
        return { state, events: [returnMadnessCard(playerId, madnessCard.uid, '疯人院：返回疯狂卡', timestamp)] };
    });

    registerInteractionHandler('base_innsmouth_base', (state, _playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string; ownerId?: string };
        if (selected.skip) return { state, events: [] };
        return { state, events: [({
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: { cardUid: selected.cardUid!, defId: selected.defId!, ownerId: selected.ownerId!, reason: '印斯茅斯基地：弃牌堆卡放入牌库底' },
            timestamp,
        } as CardToDeckBottomEvent)] };
    });

    // 密大基地：按来源+数量返回疯狂卡（按钮单选，和金克丝同模式）
    registerInteractionHandler('base_miskatonic_university_base', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { 
            skip?: boolean;
            source?: 'hand' | 'discard' | 'all';
            count?: number;
            handCount?: number;
            discardCount?: number;
        };
        if (selected.skip) return { state, events: [] };
        
        const player = state.core.players[playerId];
        const events: SmashUpEvent[] = [];
        
        if (selected.source === 'all') {
            const handMadness = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID);
            const discardMadness = player.discard.filter(c => c.defId === MADNESS_CARD_DEF_ID);
            for (const card of handMadness) {
                events.push(returnMadnessCard(playerId, card.uid, '密大基地：返回疯狂卡', timestamp));
            }
            for (const card of discardMadness) {
                events.push(returnMadnessCard(playerId, card.uid, '密大基地：返回疯狂卡', timestamp));
            }
        } else {
            const madnessCards = selected.source === 'hand' ? player.hand : player.discard;
            const toReturn = madnessCards.filter(c => c.defId === MADNESS_CARD_DEF_ID).slice(0, selected.count);
            for (const card of toReturn) {
                events.push(returnMadnessCard(playerId, card.uid, '密大基地：返回疯狂卡', timestamp));
            }
        }
        
        return { state, events };
    });

    registerInteractionHandler('base_plateau_of_leng', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string };
        if (selected.skip) return { state, events: [] };
        const ctx = (iData as any)?.continuationContext as { baseIndex: number };
        if (!ctx) return { state, events: [] };
        const mDef = getMinionDef(selected.defId!);
        const power = mDef?.power ?? 0;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid: selected.cardUid!, defId: selected.defId!, baseIndex: ctx.baseIndex, baseDefId: state.core.bases[ctx.baseIndex].defId, power },
            timestamp,
        };
        return { state, events: [playedEvt] };
    });

    registerInteractionHandler('base_greenhouse', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string; power?: number };
        if (selected.skip) return { state, events: [] };
        const ctx = (iData as any)?.continuationContext as { baseIndex: number };
        if (!ctx) return { state, events: [] };
        const power = selected.power ?? (getMinionDef(selected.defId!)?.power ?? 0);
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid: selected.cardUid!, defId: selected.defId!, baseIndex: ctx.baseIndex, baseDefId: state.core.bases[ctx.baseIndex].defId, power },
            timestamp,
        };
        return { state, events: [playedEvt] };
    });

    registerInteractionHandler('base_inventors_salon', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string };
        if (selected.skip) return { state, events: [] };
        return { state, events: [recoverCardsFromDiscard(playerId, [selected.cardUid!], '发明家沙龙：从弃牌堆取回行动卡', timestamp)] };
    });

    registerInteractionHandler('base_cat_fanciers_alley', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; owner?: string };
        if (selected.skip) return { state, events: [] };
        const ctx = (iData as any)?.continuationContext as { baseIndex: number };
        if (!ctx) return { state, events: [] };
        const events: SmashUpEvent[] = [];
        events.push(destroyMinion(selected.minionUid!, selected.minionDefId!, ctx.baseIndex, selected.owner!, undefined, '诡猫巷：消灭己方随从', timestamp));
        const player = state.core.players[playerId];
        if (player && player.deck.length > 0) {
            events.push({ type: SU_EVENTS.CARDS_DRAWN, payload: { playerId, count: 1, cardUids: [player.deck[0].uid] }, timestamp } as CardsDrawnEvent);
        }
        return { state, events };
    });

    registerInteractionHandler('base_land_of_balance', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const ctx = (iData as any)?.continuationContext as { balanceBaseIndex: number };
        if (!ctx) return { state, events: [] };
        return { state, events: [moveMinion(selected.minionUid!, selected.minionDefId!, selected.fromBaseIndex!, ctx.balanceBaseIndex, '平衡之地：移动己方随从到此', timestamp)] };
    });

    // 绵羊神社：移动己方随从到此基地
    registerInteractionHandler('base_sheep_shrine', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const ctx = (iData as any)?.continuationContext as { targetBaseIndex: number };
        if (!ctx) return { state, events: [] };
        return { state, events: [moveMinion(selected.minionUid!, selected.minionDefId!, selected.fromBaseIndex!, ctx.targetBaseIndex, '绵羊神社：移动随从到新基地', timestamp)] };
    });

    // 牧场：移动另一基地的随从到这里
    registerInteractionHandler('base_the_pasture', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        const ctx = (iData as any)?.continuationContext as { targetBaseIndex: number };
        if (!ctx) return { state, events: [] };
        return { state, events: [moveMinion(selected.minionUid!, selected.minionDefId!, selected.fromBaseIndex!, ctx.targetBaseIndex, '牧场：移动随从到牧场', timestamp)] };
    });

    // 九命之屋：玩家选择是否将随从移动到九命之屋
    registerInteractionHandler('base_nine_lives_intercept', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as {
            move: boolean;
            minionUid: string;
            minionDefId: string;
            fromBaseIndex: number;
            houseBaseIndex?: number;
            ownerId?: string;
        };
        if (selected.move && selected.houseBaseIndex !== undefined) {
            // 玩家选择移动到九命之屋
            return { state, events: [moveMinion(selected.minionUid, selected.minionDefId, selected.fromBaseIndex, selected.houseBaseIndex, '九命之屋：随从移动到九命之屋而非被消灭', timestamp)] };
        } else {
            // 玩家选择不移动→恢复消灭事件
            return { state, events: [{
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: selected.minionUid,
                    minionDefId: selected.minionDefId,
                    fromBaseIndex: selected.fromBaseIndex,
                    ownerId: selected.ownerId ?? playerId,
                    reason: '九命之屋：玩家选择不拯救',
                },
                timestamp,
            } as MinionDestroyedEvent] };
        }
    });
}
