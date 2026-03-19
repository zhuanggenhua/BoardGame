/**
 * 大杀四方 - 黑熊骑兵派系能力
 *
 * 主题：消灭对手最弱随从、移动对手随从
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    destroyMinion,
    grantExtraMinion,
    moveMinion,
    getMinionPower,
    buildMinionTargetOptions,
    buildBaseTargetOptions,
    resolveOrPrompt,
    buildAbilityFeedback,
    createSkipOption,
    addTempPower,
    addPowerCounter,
    grantExtraAction,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
} from '../domain/abilityHelpers';
import { SU_EVENT_TYPES } from '../domain/events';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, MinionOnBase, OngoingDetachedEvent, MinionPlayedEvent } from '../domain/types';
import type { MinionCardDef } from '../domain/types';
import { getCardDef, getBaseDef } from '../data/cards';
import { registerProtection, registerTrigger, isMinionProtected } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, TriggerContext } from '../domain/ongoingEffects';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { PlayerId } from '../../../engine/types';

// 本文件中使用的 defId 匹配工具：基础版 + `_pod` 版本都视为同一张牌
function matchesDefId(defId: string | undefined | null, baseDefId: string): boolean {
    return defId === baseDefId || defId === `${baseDefId}_pod`;
}

/** 注册黑熊骑兵派系所有能力*/
export function registerBearCavalryAbilities(): void {
    // 黑熊擒抱（行动卡）：每位对手消灭自己最弱随从
    registerAbility('bear_cavalry_bear_hug', 'onPlay', bearCavalryBearHug);
    registerAbility('bear_cavalry_bear_hug_pod', 'onPlay', bearCavalryBearHug);  // POD版相同
    // 委任（行动卡）：额外打出一个随从
    registerAbility('bear_cavalry_commission', 'onPlay', bearCavalryCommission);
    registerAbility('bear_cavalry_commission_pod', 'onPlay', bearCavalryCommission);  // POD版相同
    // 黑熊骑兵（随从onPlay）：移动对手在本基地的一个随从到另一个基地
    registerAbility('bear_cavalry_bear_cavalry', 'onPlay', bearCavalryBearCavalryAbility);
    // 你们已经完蛋（行动卡）：选择有己方随从的基地，移动对手随从
    registerAbility('bear_cavalry_youre_screwed', 'onPlay', bearCavalryYoureScrewed);
    // 与熊同行（行动卡）：移动己方一个随从到其他基地
    registerAbility('bear_cavalry_bear_rides_you', 'onPlay', bearCavalryBearRidesYou);
    // 你们都是美食（行动卡）：移动一个基地上所有对手随从到其他基地
    registerAbility('bear_cavalry_youre_pretty_much_borscht', 'onPlay', bearCavalryYourePrettyMuchBorscht);
    registerAbility('bear_cavalry_youre_pretty_much_borscht_pod', 'onPlay', bearCavalryYourePrettyMuchBorscht);  // POD版相同
    // 黑熊口粮（行动卡）：消灭一个随从或一个已打出的行动卡
    registerAbility('bear_cavalry_bear_necessities', 'onPlay', bearCavalryBearNecessities);

    // === ongoing 效果注册 ===
    // 伊万将军：己方随从不收回能被消灭
    registerProtection('bear_cavalry_general_ivan', 'destroy', bearCavalryGeneralIvanChecker);
    // 极地突击队员：唯一随从时不收回可消灭（+2力量的ongoingModifiers 中注册）
    registerProtection('bear_cavalry_polar_commando', 'destroy', bearCavalryPolarCommandoChecker);
    // 全面优势：保护己方随从不收回被消灭移动/影响
    registerProtection('bear_cavalry_superiority', 'destroy', bearCavalrySuperiorityChecker);
    registerProtection('bear_cavalry_superiority', 'move', bearCavalrySuperiorityChecker);
    registerProtection('bear_cavalry_superiority', 'affect', bearCavalrySuperiorityChecker);
    // 幼熊斥候：对手随从移入时消灭弱?
    registerTrigger('bear_cavalry_cub_scout', 'onMinionMoved', bearCavalryCubScoutTrigger);
    // 制高点：消灭移入的对手随从
    registerTrigger('bear_cavalry_high_ground', 'onMinionMoved', bearCavalryHighGroundTrigger);

    // === POD 版本能力注册 ===
    // 伊万将军 POD: 保护 + 响应式加力
    registerProtection('bear_cavalry_general_ivan_pod', 'destroy', bearCavalryGeneralIvanPodProtection);
    registerTrigger('bear_cavalry_general_ivan_pod', 'onMinionMoved', bearCavalryGeneralIvanPodTrigger);
    // 极地突击队员 POD: 天赋放置指示物
    registerAbility('bear_cavalry_polar_commando_pod', 'talent', bearCavalryPolarCommandoPodTalent);
    // 黑熊骑兵 POD: 入场移动
    registerAbility('bear_cavalry_bear_cavalry_pod', 'onPlay', bearCavalryBearCavalryPodAbility);
    // 幼熊斥候 POD: 响应式消灭
    registerTrigger('bear_cavalry_cub_scout_pod', 'onMinionMoved', bearCavalryCubScoutPodTrigger);
    // 黑熊擒抱 POD: 全球最弱消灭（与原版相同，已在上方注册）
    // 你们已经完蛋 POD: 降低临界点 或 +2 力量
    registerAbility('bear_cavalry_youre_screwed_pod', 'onPlay', bearCavalryYoureScrewedPodAbility);
    // 黑熊口粮 POD: 压制天赋 + 回合开始自毁
    registerAbility('bear_cavalry_bear_necessities_pod', 'talent', bearCavalryBearNecessitiesPodTalent);
    registerTrigger('bear_cavalry_bear_necessities_pod', 'onTurnStart', bearCavalryBearNecessitiesPodTurnStart);
    // 你们都是美食 POD: 批量移动（与原版相同，已在上方注册）
    // 与熊同行 POD: 移动 + 压制能力
    registerAbility('bear_cavalry_bear_rides_you_pod', 'onPlay', bearCavalryBearRidesYouPod);
    // 委任 POD: 额外随从 + 移动（与原版相同，已在上方注册）
    // 全面优势 POD: 保护 + 抽牌天赋
    registerProtection('bear_cavalry_superiority_pod', 'destroy', bearCavalrySuperiorityPodProtection);
    registerProtection('bear_cavalry_superiority_pod', 'move', bearCavalrySuperiorityPodProtection);
    registerProtection('bear_cavalry_superiority_pod', 'affect', bearCavalrySuperiorityPodProtection);
    registerAbility('bear_cavalry_superiority_pod', 'talent', bearCavalrySuperiorityPodTalent);
    // 制高点 POD: 响应式消灭并抽牌
    registerTrigger('bear_cavalry_high_ground_pod', 'onMinionMoved', bearCavalryHighGroundPodTrigger);
}

/** 黑熊擒抱 onPlay：每位其他玩家消灭自己战斗力最低的随从（平局则由拥有者选择） */
function bearCavalryBearHug(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
    // 收集需要交互选择的对手（有平局的）
    const needsChoice: string[] = [];

    for (const opId of opponents) {
        // 收集该对手在所有基地上的随从及力量
        const minions: { minion: MinionOnBase; baseIndex: number; power: number }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            for (const m of ctx.state.bases[i].minions) {
                if (m.controller !== opId) continue;
                minions.push({ minion: m, baseIndex: i, power: getMinionPower(ctx.state, m, i) });
            }
        }
        if (minions.length === 0) continue;

        const minPower = Math.min(...minions.map(m => m.power));
        const weakest = minions.filter(m => m.power === minPower);

        if (weakest.length === 1) {
            // 唯一最弱，直接消灭
            events.push(destroyMinion(
                weakest[0].minion.uid, weakest[0].minion.defId, weakest[0].baseIndex, weakest[0].minion.owner, undefined, 'bear_cavalry_bear_hug', ctx.now
            ));
        } else {
            // 平局：由拥有者选择
            needsChoice.push(opId);
        }
    }

    if (needsChoice.length === 0) return { events };

    // 链式处理：第一个需要选择的对手
    return bearHugProcessNext(ctx, events, needsChoice, 0);
}


/** 黑熊擒抱 POD onPlay：每位对手消灭最弱随从 */
function bearHugProcessNext(
    ctx: AbilityContext,
    events: SmashUpEvent[],
    opponents: string[],
    idx: number,
): AbilityResult {
    while (idx < opponents.length) {
        const opId = opponents[idx];
        const minions: { uid: string; defId: string; baseIndex: number; owner: string; power: number; label: string }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            for (const m of ctx.state.bases[i].minions) {
                if (m.controller !== opId) continue;
                const power = getMinionPower(ctx.state, m, i);
                minions.push({ uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, power, label: '' });
            }
        }
        if (minions.length === 0) { idx++; continue; }
        const minPower = Math.min(...minions.map(m => m.power));
        const weakest = minions.filter(m => m.power === minPower);
        if (weakest.length <= 1) {
            if (weakest.length === 1) {
                events.push(destroyMinion(weakest[0].uid, weakest[0].defId, weakest[0].baseIndex, weakest[0].owner, undefined, 'bear_cavalry_bear_hug', ctx.now));
            }
            idx++;
            continue;
        }
        // 多个平局：让拥有者选择
        const options = weakest.map(m => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(ctx.state.bases[m.baseIndex].defId);
            const baseName = baseDef?.name ?? `基地 ${m.baseIndex + 1}`;
            return { uid: m.uid, defId: m.defId, baseIndex: m.baseIndex, label: `${name} (力量 ${m.power}) @ ${baseName}` };
        });
        const interaction = createSimpleChoice(
            `bear_cavalry_bear_hug_${opId}_${ctx.now}`, opId,
            '黑熊擒抱：选择要消灭的最弱随从',
            buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }),
            { sourceId: 'bear_cavalry_bear_hug', targetType: 'minion', autoCancelOption: true },
        );
        (interaction.data as any).continuationContext = { opponents, opponentIdx: idx };
        return { events, matchState: queueInteraction(ctx.matchState, interaction) };
    }
    return { events };
}

/** 委任 onPlay：给予额外随从额度，并选择手牌随从打出到基地，然后移动该基地上对手随从 */
function bearCavalryCommission(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const handMinions = player.hand.filter(c => c.type === 'minion');
    const events: SmashUpEvent[] = [grantExtraMinion(ctx.playerId, 'bear_cavalry_commission', ctx.now)];
    if (handMinions.length === 0) {
        // 原版语义：即使当前没有可打出的随从，也先给予额外随从额度
        return { events };
    }

    // 让玩家选择要打出的手牌随从
    const options = handMinions.map((c, i) => {
        const def = getCardDef(c.defId) as MinionCardDef | undefined;
        const name = def?.name ?? c.defId;
        const power = def?.power ?? 0;
        return { id: `hand-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, power }, _source: 'hand' as const, displayMode: 'card' as const };
    });
    const interaction = createSimpleChoice(
        `bear_cavalry_commission_choose_minion_${ctx.now}`, ctx.playerId,
        '委任：选择要额外打出的随从', options as any[],
        { sourceId: 'bear_cavalry_commission_choose_minion', targetType: 'hand' },
    );
    // 标记是否为 POD 版本，用于后续交互链区分“必须移动”与“可以跳过”
    (interaction.data as any).isPod = ctx.defId === 'bear_cavalry_commission_pod';
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}


/** 委任 POD onPlay：额外随从+移动 */
// ============================================================================
// ongoing 效果检查器与触发器
// ============================================================================

/** 伊万将军保护检查：你控制的所有随从（含伊万自身）不能被消灭 */
function bearCavalryGeneralIvanChecker(ctx: ProtectionCheckContext): boolean {
    for (const base of ctx.state.bases) {
        const ivan = base.minions.find(m => matchesDefId(m.defId, 'bear_cavalry_general_ivan'));
        if (ivan && ivan.controller === ctx.targetMinion.controller) {
            // 原版文本：Your minions cannot be destroyed.
            // FAQ 指明不区分来源，因此同控制者的所有随从（包括伊万自己）一律保护。
            return true;
        }
    }
    return false;
}


/** 伊万将军 POD 保护检查：你的随从不可被消灭 */
function bearCavalryGeneralIvanPodProtection(ctx: ProtectionCheckContext): boolean {
    // 检查是否有伊万将军 POD 在场
    for (const base of ctx.state.bases) {
        const ivan = base.minions.find(m => m.defId === 'bear_cavalry_general_ivan_pod');
        if (ivan && ivan.controller === ctx.targetMinion.controller) {
            // 保护同控制者的所有随从（包括伊万自己）
            // POD 文本：Your minions cannot be destroyed.（不区分来源）
            return true;
        }
    }
    return false;
}


/** 伊万将军 POD 触发器：其他玩家随从移动后可选择给己方随从+1力量（每回合限一次） */
function bearCavalryGeneralIvanPodTrigger(ctx: TriggerContext): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: any } {
    const events: SmashUpEvent[] = [];
    
    if (!ctx.triggerMinionUid) return events;
    
    // 找到被移动的随从
    let movedMinion: MinionOnBase | undefined;
    let movedToBaseIndex = -1;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const found = ctx.state.bases[i].minions.find(m => m.uid === ctx.triggerMinionUid);
        if (found) { 
            movedMinion = found; 
            movedToBaseIndex = i;
            break;
        }
    }
    if (!movedMinion || movedToBaseIndex === -1) return events;
    
    // 找到所有场上的伊万将军 POD
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex++) {
        const base = ctx.state.bases[baseIndex];
        const ivan = base.minions.find(m => m.defId === 'bear_cavalry_general_ivan_pod');
        if (!ivan) continue;
        
        // 检查是否是其他玩家移动的随从
        if (movedMinion.controller === ivan.controller) continue;

        // “there”：移动到的基地上必须有伊万控制者的随从，否则触发也不会产生效果
        const movedToBase = ctx.state.bases[movedToBaseIndex];
        const hasMyMinionThere = movedToBase?.minions.some(m => m.controller === ivan.controller) ?? false;
        if (!hasMyMinionThere) continue;
        
        // 检查是否已经在本回合使用过（每回合限一次）
        const limitKey = `bear_cavalry_general_ivan_pod_${ivan.controller}`;
        if (ctx.state.specialLimitUsed?.[limitKey]?.length) continue;
        
        // 去重检查：检查交互队列中是否已存在相同的确认交互
        if (ctx.matchState) {
            const queue = ctx.matchState.sys.interaction.queue;
            const current = ctx.matchState.sys.interaction.current;
            const allInteractions = current ? [current, ...queue] : queue;
            
            const existingInteraction = allInteractions.find(
                (i: any) => i.data?.sourceId === 'bear_cavalry_general_ivan_pod_trigger' &&
                            i.data?.ivanController === ivan.controller &&
                            i.data?.turnNumber === ctx.state.turnNumber
            );
            
            if (existingInteraction) {
                continue; // 已存在相同的交互，跳过（去重）
            }
        }
        
        // 创建交互：询问是否给己方随从+1力量（"you may"）
        const interaction = createSimpleChoice(
            `bear_cavalry_general_ivan_pod_trigger_${ctx.now}_${ivan.uid}`,
            ivan.controller,
            '伊万将军：是否给对手随从移动到的基地上你的随从+1力量直到回合结束？（每回合限一次）',
            [
                { id: 'yes', label: '是（给己方随从+1力量）', value: 'yes' as any },
                { id: 'no', label: '否', value: 'no' as any }
            ],
            { sourceId: 'bear_cavalry_general_ivan_pod_trigger', targetType: 'generic' }
        );
        (interaction.data as any).baseIndex = movedToBaseIndex;
        (interaction.data as any).ivanController = ivan.controller;
        (interaction.data as any).turnNumber = ctx.state.turnNumber;
        (interaction.data as any).limitKey = limitKey;
        
        // 调用 queueInteraction 并返回 matchState
        if (!ctx.matchState) return events;
        return {
            events,
            matchState: queueInteraction(ctx.matchState, interaction)
        };
    }
    
    return events;
}

/** 极地突击队员保护检查：基地上唯一己方随从时不收回可消灭*/
function bearCavalryPolarCommandoChecker(ctx: ProtectionCheckContext): boolean {
    if (!matchesDefId(ctx.targetMinion.defId, 'bear_cavalry_polar_commando')) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    const myMinionCount = base.minions.filter(m => m.controller === ctx.targetMinion.controller).length;
    return myMinionCount === 1;
}


/** 极地突击队员 POD 天赋：放置+1力量标记 */
function bearCavalryPolarCommandoPodTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    // 找到极地突击队员（在当前 baseIndex 上发动天赋）
    const commando = base.minions.find(m => m.uid === ctx.cardUid);
    if (!commando) return { events: [] };

    const commandoPower = getMinionPower(ctx.state, commando, ctx.baseIndex);

    // POD 文本：this minion 或 “a minion with less power than this minion”
    // 目标范围：任意基地上的己方随从（不限同基地）
    const targets: Array<{ minion: MinionOnBase; baseIndex: number; power: number }> = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const b = ctx.state.bases[i];
        for (const m of b.minions) {
            if (m.controller !== ctx.playerId) continue;
            if (m.uid === ctx.cardUid) {
                targets.push({ minion: m, baseIndex: i, power: commandoPower });
                continue;
            }
            const power = getMinionPower(ctx.state, m, i);
            if (power < commandoPower) {
                targets.push({ minion: m, baseIndex: i, power });
            }
        }
    }

    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const options = targets.map(t => {
        const def = getCardDef(t.minion.defId) as MinionCardDef | undefined;
        const name = def?.name ?? t.minion.defId;
        return { uid: t.minion.uid, defId: t.minion.defId, baseIndex: t.baseIndex, label: `${name} (力量 ${t.power})` };
    });
    
    return resolveOrPrompt(ctx, buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }), {
        id: 'bear_cavalry_polar_commando_pod_talent',
        title: '选择放置+1力量标记的随从',
        sourceId: 'bear_cavalry_polar_commando_pod',
        targetType: 'minion',
    }, (value) => ({
        events: [addPowerCounter(value.minionUid, value.baseIndex, 1, 'bear_cavalry_polar_commando_pod', ctx.now)],
    }));
}

/** 全面优势保护检查：保护基地上己方随从不收回被其他玩家消灭移动/影响 */
function bearCavalrySuperiorityChecker(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.ongoingActions.some(
        a => matchesDefId(a.defId, 'bear_cavalry_superiority') && a.ownerId === ctx.targetMinion.controller
    );
}


/** 全面优势 POD 保护检查：保护己方随从 */
function bearCavalrySuperiorityPodProtection(ctx: ProtectionCheckContext): boolean {
    // POD 版本的保护效果需要通过天赋激活
    // 保护模式通过事件写入 metadata.superiorityProtect，避免“抽牌分支”也触发 TALENT_USED 导致误开启
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.ongoingActions.some(
        a => a.defId === 'bear_cavalry_superiority_pod' &&
             a.ownerId === ctx.targetMinion.controller &&
             a.talentUsed === true &&
             (a.metadata as any)?.superiorityProtect === true
    );
}


/** 全面优势 POD 天赋：摸牌或保护 */
function bearCavalrySuperiorityPodTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    
    // 检查是否在该基地战力最高
    const playerPowers: { [pid: string]: number } = {};
    for (const m of base.minions) {
        playerPowers[m.controller] = (playerPowers[m.controller] || 0) + getMinionPower(ctx.state, m, ctx.baseIndex);
    }
    
    const myPower = playerPowers[ctx.playerId] || 0;
    const isHighest = Object.entries(playerPowers).every(([pid, power]) => pid === ctx.playerId || power < myPower);
    
    if (!isHighest) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    
    // 创建选择交互：摸牌或保护
    const interaction = createSimpleChoice(
        `bear_cavalry_superiority_pod_talent_${ctx.now}`,
        ctx.playerId,
        '全面优势：选择一项',
        [
            { id: 'draw', label: '摸一张牌', value: 'draw' as any },
            { id: 'protect', label: '保护随从直到下回合', value: 'protect' as any }
        ],
        { sourceId: 'bear_cavalry_superiority_pod_talent', targetType: 'generic' }
    );
    // handler 需要知道是哪一张 ongoing 在开启保护模式
    (interaction.data as any).cardUid = ctx.cardUid;
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 幼熊斥候触发：对手随从移入时，若力量低于斥候则消灭 */
function bearCavalryCubScoutTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const destBaseIndex = ctx.baseIndex;
    if (destBaseIndex === undefined || !ctx.triggerMinionUid) return events;
    const destBase = ctx.state.bases[destBaseIndex];
    if (!destBase) return events;

    // 找到被移动的随从（还在原基地上）
    let movedMinion: MinionOnBase | undefined;
    let movedBaseIndex = -1;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const found = ctx.state.bases[i].minions.find(m => m.uid === ctx.triggerMinionUid);
        if (found) { movedMinion = found; movedBaseIndex = i; break; }
    }
    if (!movedMinion) return events;

    for (const scout of destBase.minions) {
        if (!matchesDefId(scout.defId, 'bear_cavalry_cub_scout')) continue;
        if (scout.controller === movedMinion.controller) continue;
        const scoutPower = getMinionPower(ctx.state, scout, destBaseIndex);
        const movedPower = getMinionPower(ctx.state, movedMinion, destBaseIndex);
        if (movedPower < scoutPower) {
            events.push(destroyMinion(
                movedMinion.uid,
                movedMinion.defId,
                destBaseIndex,
                movedMinion.owner,
                undefined,
                'bear_cavalry_cub_scout',
                ctx.now,
            ));
            break;
        }
    }
    return events;
}


/** 幼熊斥候 POD 触发器：移动后消灭弱随从 */
function bearCavalryCubScoutPodTrigger(ctx: TriggerContext): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: any } {
    const events: SmashUpEvent[] = [];
    const destBaseIndex = ctx.baseIndex;
    if (destBaseIndex === undefined || !ctx.triggerMinionUid) {
        return events;
    }
    
    // 去重检查：检查交互队列中是否已存在相同的消灭确认交互
    if (ctx.matchState) {
        const queue = ctx.matchState.sys.interaction.queue;
        const current = ctx.matchState.sys.interaction.current;
        const allInteractions = current ? [current, ...queue] : queue;
        
        const existingInteraction = allInteractions.find(
            (i: any) => i.data?.sourceId === 'bear_cavalry_cub_scout_pod_destroy' &&
                        i.data?.minionUid === ctx.triggerMinionUid
        );
        
        if (existingInteraction) {
            return events;
        }
    }
    
    const destBase = ctx.state.bases[destBaseIndex];
    if (!destBase) {
        return events;
    }
    
    // 找到被移动的随从
    let movedMinion: MinionOnBase | undefined;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const found = ctx.state.bases[i].minions.find(m => m.uid === ctx.triggerMinionUid);
        if (found) { movedMinion = found; break; }
    }
    if (!movedMinion) return events;
    
    // 找到幼熊斥候
    for (const scout of destBase.minions) {
        if (scout.defId !== 'bear_cavalry_cub_scout_pod') continue;
        if (scout.controller === movedMinion.controller) continue;

        const scoutPower = getMinionPower(ctx.state, scout, destBaseIndex);
        const movedPower = getMinionPower(ctx.state, movedMinion, destBaseIndex);

        if (movedPower < scoutPower) {
            // 无 matchState：自动执行“是”分支（消灭），不创建交互
            if (!ctx.matchState) {
                events.push(
                    destroyMinion(
                        movedMinion.uid,
                        movedMinion.defId,
                        destBaseIndex,
                        movedMinion.owner,
                        scout.controller,
                        'bear_cavalry_cub_scout_pod',
                        ctx.now,
                    ),
                );
                return events;
            }

            // 有 matchState：创建交互，询问是否消灭并后续可移动己方小随从
            const interaction = createSimpleChoice(
                `bear_cavalry_cub_scout_pod_destroy_${ctx.now}_${scout.uid}`,
                scout.controller,
                `幼熊斥候：是否消灭 ${getCardDef(movedMinion.defId)?.name ?? movedMinion.defId}？`,
                [
                    { id: 'yes', label: '是（消灭并移动己方小随从）', value: 'yes' as any },
                    { id: 'no', label: '否', value: 'no' as any },
                ],
                { sourceId: 'bear_cavalry_cub_scout_pod_destroy', targetType: 'generic' },
            );
            (interaction.data as any).minionUid = movedMinion.uid;
            (interaction.data as any).minionDefId = movedMinion.defId;
            (interaction.data as any).baseIndex = destBaseIndex;
            (interaction.data as any).ownerId = movedMinion.owner;
            (interaction.data as any).scoutUid = scout.uid;
            (interaction.data as any).scoutBaseIndex = destBaseIndex;

            return {
                events,
                matchState: queueInteraction(ctx.matchState, interaction),
            };
        }
    }
    
    return events;
}

/** 制高点触发：有己方随从时消灭移入的对手随从*/
function bearCavalryHighGroundTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const destBaseIndex = ctx.baseIndex;
    if (destBaseIndex === undefined || !ctx.triggerMinionUid) return events;
    const destBase = ctx.state.bases[destBaseIndex];
    if (!destBase) return events;

    let movedMinion: MinionOnBase | undefined;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const found = ctx.state.bases[i].minions.find(m => m.uid === ctx.triggerMinionUid);
        if (found) { movedMinion = found; break; }
    }
    if (!movedMinion) return events;

    for (const ongoing of destBase.ongoingActions) {
        if (!matchesDefId(ongoing.defId, 'bear_cavalry_high_ground')) continue;
        if (ongoing.ownerId === movedMinion.controller) continue;
        const ownerHasMinion = destBase.minions.some(m => m.controller === ongoing.ownerId);
        if (!ownerHasMinion) continue;
        events.push(
            destroyMinion(
                movedMinion.uid,
                movedMinion.defId,
                destBaseIndex,
                movedMinion.owner,
                undefined,
                'bear_cavalry_high_ground',
                ctx.now,
            ),
        );
        break;
    }
    return events;
}


/** 制高点 POD 触发器：移动后消灭或摸牌打战术 */
function bearCavalryHighGroundPodTrigger(ctx: TriggerContext): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: any } {
    const events: SmashUpEvent[] = [];
    const destBaseIndex = ctx.baseIndex;
    if (destBaseIndex === undefined || !ctx.triggerMinionUid) return events;
    
    const destBase = ctx.state.bases[destBaseIndex];
    if (!destBase) return events;
    
    // 找到被移动的随从
    let movedMinion: MinionOnBase | undefined;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const found = ctx.state.bases[i].minions.find(m => m.uid === ctx.triggerMinionUid);
        if (found) { movedMinion = found; break; }
    }
    if (!movedMinion) return events;
    
    // 找到制高点 POD
    for (const ongoing of destBase.ongoingActions) {
        if (ongoing.defId !== 'bear_cavalry_high_ground_pod') continue;
        if (ongoing.ownerId === movedMinion.controller) continue;

        const ownerHasMinion = destBase.minions.some(m => m.controller === ongoing.ownerId);
        if (!ownerHasMinion) continue;

        // 无 matchState：自动选择“destroy”分支
        if (!ctx.matchState) {
            events.push({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: ongoing.uid,
                    defId: 'bear_cavalry_high_ground_pod',
                    ownerId: ongoing.ownerId,
                    reason: 'bear_cavalry_high_ground_pod',
                },
                timestamp: ctx.now,
            } as OngoingDetachedEvent);

            events.push(
                destroyMinion(
                    movedMinion.uid,
                    movedMinion.defId,
                    destBaseIndex,
                    movedMinion.owner,
                    ongoing.ownerId,
                    'bear_cavalry_high_ground_pod',
                    ctx.now,
                ),
            );
            return events;
        }

        // 有 matchState：创建交互，选择“消灭或摸牌打战术”
        // 去重检查：检查交互队列中是否已存在相同的交互
        const queue = ctx.matchState.sys.interaction.queue;
        const current = ctx.matchState.sys.interaction.current;
        const allInteractions = current ? [current, ...queue] : queue;

        const existingInteraction = allInteractions.find(
            (i: any) =>
                i.data?.sourceId === 'bear_cavalry_high_ground_pod_trigger' &&
                i.data?.ongoingUid === ongoing.uid &&
                i.data?.minionUid === movedMinion.uid,
        );

        if (existingInteraction) {
            continue; // 已存在相同的交互，跳过（去重）
        }

        const interaction = createSimpleChoice(
            `bear_cavalry_high_ground_pod_trigger_${ctx.now}_${ongoing.uid}`,
            ongoing.ownerId,
            '制高点：选择一项',
            [
                {
                    id: 'destroy',
                    label: '消灭制高点并消灭该随从',
                    value: {
                        action: 'destroy',
                        minionUid: movedMinion.uid,
                        minionDefId: movedMinion.defId,
                        baseIndex: destBaseIndex,
                        ownerId: movedMinion.owner,
                        ongoingUid: ongoing.uid,
                    } as any,
                },
                { id: 'draw', label: '摸一张牌并打出一张战术', value: { action: 'draw', ongoingUid: ongoing.uid } as any },
            ],
            { sourceId: 'bear_cavalry_high_ground_pod_trigger', targetType: 'generic' },
        );
        (interaction.data as any).ongoingUid = ongoing.uid;
        (interaction.data as any).minionUid = movedMinion.uid;

        return {
            events,
            matchState: queueInteraction(ctx.matchState, interaction),
        };
    }
    
    return events;
}

/** 黑熊骑兵 onPlay：移动对手在本基地的一个随从到另一个基地*/
function bearCavalryBearCavalryAbility(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const opponentMinions = base.minions.filter(m => {
        // 过滤：1) 不是自己的随从 2) 不是自己
        if (m.controller === ctx.playerId || m.uid === ctx.cardUid) return false;
        return true;
    });
    if (opponentMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    // 找目标基地
    const otherBases = ctx.state.bases.map((b, i) => i).filter(i => i !== ctx.baseIndex);
    if (otherBases.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    // 选择随从（第一步）- buildMinionTargetOptions 会自动过滤受保护的随从
    const options = buildMinionTargetOptions(
        opponentMinions.map(m => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const power = getMinionPower(ctx.state, m, ctx.baseIndex);
            return { uid: m.uid, defId: m.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
        }),
        {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            effectType: 'affect', // 移动效果属于 'affect' 类型
        }
    );
    if (options.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    
    const interaction = createSimpleChoice(
        `bear_cavalry_bear_cavalry_choose_minion_${ctx.now}`, ctx.playerId,
        '选择要移动的对手随从', options,
        { sourceId: 'bear_cavalry_bear_cavalry_choose_minion', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = { fromBaseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}


/** 黑熊骑兵 POD onPlay：你可以移动对手随从 */
function bearCavalryBearCavalryPodAbility(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    
    const opponentMinions = base.minions.filter(m => m.controller !== ctx.playerId && m.uid !== ctx.cardUid);
    if (opponentMinions.length === 0) return { events: [] };
    
    const otherBases = ctx.state.bases.map((b, i) => i).filter(i => i !== ctx.baseIndex);
    if (otherBases.length === 0) return { events: [] };
    
    // 可选效果：添加跳过选项
    const options = buildMinionTargetOptions(
        opponentMinions.map(m => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const power = getMinionPower(ctx.state, m, ctx.baseIndex);
            return { uid: m.uid, defId: m.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
        }),
        { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'affect' }
    );
    
    if (options.length === 0) return { events: [] };
    
    const interaction = createSimpleChoice(
        `bear_cavalry_bear_cavalry_pod_choose_minion_${ctx.now}`,
        ctx.playerId,
        '黑熊骑兵：选择要移动的对手随从（可跳过）',
        [...options, createSkipOption()],
        { sourceId: 'bear_cavalry_bear_cavalry_pod_choose_minion', targetType: 'minion' }
    );
    (interaction.data as any).continuationContext = { fromBaseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 你们已经完蛋 onPlay：选择有己方随从的基地→选择对手随从→移动到其他基地 */
function bearCavalryYoureScrewed(ctx: AbilityContext): AbilityResult {
    // 找有己方随从且有对手随从的基地
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const hasMyMinion = ctx.state.bases[i].minions.some(m => m.controller === ctx.playerId);
        // 检查是否有对手随从（保护检查延迟到 buildMinionTargetOptions）
        const hasOpponentMinion = ctx.state.bases[i].minions.some(m => m.controller !== ctx.playerId);
        if (hasMyMinion && hasOpponentMinion) {
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
    }
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const interaction = createSimpleChoice(
        `bear_cavalry_youre_screwed_choose_base_${ctx.now}`, ctx.playerId,
        '选择有己方随从的基地', buildBaseTargetOptions(candidates, ctx.state),
        { sourceId: 'bear_cavalry_youre_screwed_choose_base', targetType: 'base', autoCancelOption: true }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}


/** 你们已经完蛋 POD onPlay：ongoing 效果（动态调整爆破点） */
function bearCavalryYoureScrewedPodAbility(ctx: AbilityContext): AbilityResult {
    // POD 版本是 ongoing 卡，效果在 ongoingModifiers 中实现
    // onPlay 时不产生事件
    return { events: [] };
}

/** 与熊同行 onPlay：选择己方一个随从移动到其他基地 */
function bearCavalryBearRidesYou(ctx: AbilityContext): AbilityResult {
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
        `bear_cavalry_bear_rides_you_choose_minion_${ctx.now}`, ctx.playerId, '选择要移动的己方随从', buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }), { sourceId: 'bear_cavalry_bear_rides_you_choose_minion', targetType: 'minion' }
        );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}


/** 与熊同行 POD onPlay：移动随从+压制能力 */
function bearCavalryBearRidesYouPod(ctx: AbilityContext): AbilityResult {
    // 收集所有随从（己方和对手）
    const allMinions: { uid: string; defId: string; baseIndex: number; controller: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const power = getMinionPower(ctx.state, m, i);
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            const owner = m.controller === ctx.playerId ? '(己方)' : '(对手)';
            allMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, controller: m.controller, label: `${name} ${owner} (力量 ${power}) @ ${baseName}` });
        }
    }
    
    if (allMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    
    const options = allMinions.map(m => ({ uid: m.uid, defId: m.defId, baseIndex: m.baseIndex, label: m.label }));
    const interaction = createSimpleChoice(
        `bear_cavalry_bear_rides_you_pod_choose_minion_${ctx.now}`,
        ctx.playerId,
        '与熊同行：选择要移动的随从',
        buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }),
        { sourceId: 'bear_cavalry_bear_rides_you_pod_choose_minion', targetType: 'minion' }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

type BearRidesYouPodSuppressTarget =
    | { kind: 'skip' }
    | { kind: 'base'; baseIndex: number };

/** 你们都是美食 onPlay：选择有己方随从的基地→选择目标基地，移动所有对手随从*/
function bearCavalryYourePrettyMuchBorscht(ctx: AbilityContext): AbilityResult {
    // 找有己方随从的基地（POD 文本：Choose a base where you have a minion.）
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const hasMyMinion = ctx.state.bases[i].minions.some(m => m.controller === ctx.playerId);
        if (hasMyMinion) {
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
    }
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const interaction = createSimpleChoice(
        `bear_cavalry_borscht_choose_from_${ctx.now}`, ctx.playerId,
        '选择基地（移动所有对手随从）', buildBaseTargetOptions(candidates, ctx.state),
        { sourceId: 'bear_cavalry_borscht_choose_from', targetType: 'base', autoCancelOption: true }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}


/** 你们都是美食 POD onPlay：批量移动 */
/** 黑熊口粮 onPlay：消灭一个随从或一个已打出的行动卡 */
function bearCavalryBearNecessities(ctx: AbilityContext): AbilityResult {
    // 收集所有可消灭的对手随从
    const minionTargets: { uid: string; defId: string; baseIndex: number; owner: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) continue;
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const power = getMinionPower(ctx.state, m, i);
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            minionTargets.push({ uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, label: `[随从] ${name} (力量 ${power}) @ ${baseName}` });
        }
    }
    // 收集所有可消灭的对手行动卡
    const actionTargets: { uid: string; defId: string; ownerId: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        const baseDef = getBaseDef(base.defId);
        const baseName = baseDef?.name ?? `基地 ${i + 1}`;
        for (const o of base.ongoingActions) {
            if (o.ownerId !== ctx.playerId) {
                const def = getCardDef(o.defId);
                const name = def?.name ?? o.defId;
                actionTargets.push({ uid: o.uid, defId: o.defId, ownerId: o.ownerId, label: `[行动] ${name} @ ${baseName}` });
            }
        }
        for (const m of base.minions) {
            for (const a of m.attachedActions) {
                if (a.ownerId !== ctx.playerId) {
                    const def = getCardDef(a.defId);
                    const name = def?.name ?? a.defId;
                    actionTargets.push({ uid: a.uid, defId: a.defId, ownerId: a.ownerId, label: `[行动] ${name}` });
                }
            }
        }
    }
    const allTargets = [...minionTargets, ...actionTargets];
    if (allTargets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    // 数据驱动：强制效果，单候选自动执行（混合随从和行动卡，用 generic）
    type BearNecessitiesValue = { type: 'minion'; uid: string; defId: string; baseIndex: number; owner: string } | { type: 'action'; uid: string; defId: string; ownerId: string };
    const options = allTargets.map((t, i) => ({
        id: `target-${i}`,
        label: t.label,
        value: ('owner' in t
            ? { type: 'minion' as const, uid: t.uid, defId: t.defId, baseIndex: (t as typeof minionTargets[0]).baseIndex, owner: (t as typeof minionTargets[0]).owner }
            : { type: 'action' as const, uid: t.uid, defId: t.defId, ownerId: (t as typeof actionTargets[0]).ownerId }) as BearNecessitiesValue,
    }));
    return resolveOrPrompt<BearNecessitiesValue>(ctx, options, {
        id: 'bear_cavalry_bear_necessities',
        title: '选择要消灭的随从或行动卡',
        sourceId: 'bear_cavalry_bear_necessities',
        targetType: 'generic',
    }, (value) => {
        if (value.type === 'minion') {
            return {
                events: buildValidatedDestroyEvents(ctx.state, {
                    minionUid: value.uid,
                    minionDefId: value.defId,
                    fromBaseIndex: value.baseIndex,
                    reason: 'bear_cavalry_bear_necessities',
                    now: ctx.now,
                }),
            };
        }
        return { events: [{ type: SU_EVENTS.ONGOING_DETACHED, payload: { cardUid: value.uid, defId: value.defId, ownerId: value.ownerId, reason: 'bear_cavalry_bear_necessities' }, timestamp: ctx.now } as OngoingDetachedEvent] };
    });
}


/** 黑熊口粮 POD 天赋：压制其他玩家打额外牌 */
function bearCavalryBearNecessitiesPodTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    
    // 天赋能力不需要生成额外事件，reducer 会自动生成 TALENT_USED 事件并设置 talentUsed 标志
    // 压制效果通过 commands.ts 中的验证逻辑实现（检查 ongoing.talentUsed 标志）
    return { events: [] };
}

/** 黑熊口粮 POD 回合开始触发器：自毁 */
function bearCavalryBearNecessitiesPodTurnStart(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    
    // 检查是否是卡牌拥有者的回合
    // onTurnStart 的 ctx.playerId 就是当前回合玩家
    
    // 找到黑熊口粮 POD 卡牌（必须已激活天赋）
    for (const base of ctx.state.bases) {
        const cards = base.ongoingActions.filter(
            a => a.defId === 'bear_cavalry_bear_necessities_pod'
                && a.ownerId === ctx.playerId
                && a.talentUsed === true
        );
        for (const card of cards) {
            events.push({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: { cardUid: card.uid, defId: card.defId, ownerId: card.ownerId, reason: 'bear_cavalry_bear_necessities_pod' },
                timestamp: ctx.now
            } as OngoingDetachedEvent);
        }
    }
    
    return events;
}


// ============================================================================
// POD 版本能力实现
// ============================================================================

// ============================================================================
// Prompt 继续函数
// ============================================================================

/** 注册黑熊骑兵派系的交互解决处理函数 */
export function registerBearCavalryInteractionHandlers(): void {
    // 黑熊擒抱：平局时拥有者选择消灭哪个（链式处理多个对手）
    registerInteractionHandler('bear_cavalry_bear_hug', (state, playerId, value, iData, _random, timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return { state, events: [] };
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return { state, events: [] };
        const events: SmashUpEvent[] = [destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'bear_cavalry_bear_hug', timestamp)];

        // 链式处理下一个对手
        const ctx = (iData as any)?.continuationContext as { opponents: string[]; opponentIdx: number } | undefined;
        if (!ctx) return { state, events };
        const nextIdx = ctx.opponentIdx + 1;
        if (nextIdx >= ctx.opponents.length) return { state, events };

        // 查找下一个需要选择的对手
        for (let i = nextIdx; i < ctx.opponents.length; i++) {
            const opId = ctx.opponents[i];
            const minions: { uid: string; defId: string; baseIndex: number; owner: string; power: number }[] = [];
            for (let bi = 0; bi < state.core.bases.length; bi++) {
                for (const m of state.core.bases[bi].minions) {
                    if (m.controller !== opId) continue;
                    minions.push({ uid: m.uid, defId: m.defId, baseIndex: bi, owner: m.owner, power: getMinionPower(state.core, m, bi) });
                }
            }
            if (minions.length === 0) continue;
            const minPower = Math.min(...minions.map(m => m.power));
            const weakest = minions.filter(m => m.power === minPower);
            if (weakest.length <= 1) {
                if (weakest.length === 1) {
                    events.push(destroyMinion(weakest[0].uid, weakest[0].defId, weakest[0].baseIndex, weakest[0].owner, playerId, 'bear_cavalry_bear_hug', timestamp));
                }
                continue;
            }
            // 多个平局：创建交互
            const options = weakest.map(m => {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const baseDef = getBaseDef(state.core.bases[m.baseIndex].defId);
                const baseName = baseDef?.name ?? `基地 ${m.baseIndex + 1}`;
                return { uid: m.uid, defId: m.defId, baseIndex: m.baseIndex, label: `${name} (力量 ${m.power}) @ ${baseName}` };
            });
            const interaction = createSimpleChoice(
                `bear_cavalry_bear_hug_${opId}_${timestamp}`, opId,
                '黑熊擒抱：选择要消灭的最弱随从', buildMinionTargetOptions(options, { state: state.core, sourcePlayerId: opId }),
                { sourceId: 'bear_cavalry_bear_hug', targetType: 'minion', autoCancelOption: true }
            );
            (interaction.data as any).continuationContext = { opponents: ctx.opponents, opponentIdx: i };
            return { state: queueInteraction(state, interaction), events };
        }

        return { state, events };
    });

    // 委任第一步：选择手牌随从后→选择目标基地
    registerInteractionHandler('bear_cavalry_commission_choose_minion', (state, playerId, value, iData, _random, timestamp) => {
        const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
        const isPod = (iData as any)?.isPod === true;
        const baseCandidates = state.core.bases.map((b, i) => {
            const baseDef = getBaseDef(b.defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        if (baseCandidates.length === 1) {
            // 只有一个基地，直接打出并进入移动步骤
            const baseIndex = baseCandidates[0].baseIndex;
            const playedEvt: MinionPlayedEvent = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: { playerId, cardUid, defId, baseIndex, baseDefId: state.core.bases[baseIndex].defId, power, consumesNormalLimit: false },
                timestamp,
            };
            // 检查该基地是否有对手随从可移动（保护检查在 buildMinionTargetOptions 中）
            const opponentMinions = state.core.bases[baseIndex].minions.filter(m => m.controller !== playerId);
            if (opponentMinions.length === 0) {
                return { state, events: [playedEvt] };
            }
            // 创建移动交互
            const moveOptions = buildMinionTargetOptions(
                opponentMinions.map(m => {
                    const mDef = getCardDef(m.defId) as MinionCardDef | undefined;
                    const name = mDef?.name ?? m.defId;
                    const pw = getMinionPower(state.core, m, baseIndex);
                    return { uid: m.uid, defId: m.defId, baseIndex, label: `${name} (力量 ${pw})` };
                }),
                {
                    state: state.core,
                    sourcePlayerId: playerId,
                    effectType: 'affect',
                }
            );
            if (moveOptions.length === 0) {
                return { state, events: [playedEvt] };
            }
            // POD 版文本为 “you may move”，允许跳过；基础版则必须移动（若有合法目标）
            if (isPod) {
                moveOptions.unshift({ id: 'skip', label: '跳过（不移动）', value: { minionUid: '__skip__', baseIndex } as any });
            }
            const next = createSimpleChoice(
                `bear_cavalry_commission_move_minion_${timestamp}`, playerId,
                '委任：选择要移动的对手随从', moveOptions,
                { sourceId: 'bear_cavalry_commission_move_minion', targetType: 'minion' },
            );
            return {
                state: queueInteraction(state, {
                    ...next,
                    data: { ...next.data, continuationContext: { fromBaseIndex: baseIndex }, isPod },
                }),
                events: [playedEvt],
            };
        }
        const next = createSimpleChoice(
            `bear_cavalry_commission_choose_base_${timestamp}`, playerId, '委任：选择打出随从的基地', buildBaseTargetOptions(baseCandidates, state.core), { sourceId: 'bear_cavalry_commission_choose_base', targetType: 'base' }
            );
        return {
            state: queueInteraction(state, {
                ...next,
                data: { ...next.data, continuationContext: { cardUid, defId, power }, isPod },
            }),
            events: [],
        };
    });

    // 委任第二步：选择基地后打出随从并进入移动步骤
    registerInteractionHandler('bear_cavalry_commission_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; defId: string; power: number };
        const isPod = (iData as any)?.isPod === true;
        if (!ctx) return undefined;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid: ctx.cardUid, defId: ctx.defId, baseIndex, baseDefId: state.core.bases[baseIndex].defId, power: ctx.power, consumesNormalLimit: false },
            timestamp,
        };
        // 检查该基地是否有对手随从可移动（保护检查在 buildMinionTargetOptions 中）
        const opponentMinions = state.core.bases[baseIndex].minions.filter(m => m.controller !== playerId);
        if (opponentMinions.length === 0) {
            return { state, events: [playedEvt] };
        }
        const moveOptions = buildMinionTargetOptions(
            opponentMinions.map(m => {
                const mDef = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = mDef?.name ?? m.defId;
                const pw = getMinionPower(state.core, m, baseIndex);
                return { uid: m.uid, defId: m.defId, baseIndex, label: `${name} (力量 ${pw})` };
            }),
            {
                state: state.core,
                sourcePlayerId: playerId,
                effectType: 'affect',
            }
        );
        if (moveOptions.length === 0) {
            return { state, events: [playedEvt] };
        }
        if (isPod) {
            moveOptions.unshift({ id: 'skip', label: '跳过（不移动）', value: { minionUid: '__skip__', baseIndex } as any });
        }
        const next = createSimpleChoice(
            `bear_cavalry_commission_move_minion_${timestamp}`, playerId,
            '委任：选择要移动的对手随从', moveOptions,
            { sourceId: 'bear_cavalry_commission_move_minion', targetType: 'minion' },
        );
        return {
            state: queueInteraction(state, {
                ...next,
                data: { ...next.data, continuationContext: { fromBaseIndex: baseIndex }, isPod },
            }),
            events: [playedEvt],
        };
    });

    // 委任第三步：选择对手随从后→选择目标基地
    registerInteractionHandler('bear_cavalry_commission_move_minion', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex: fromBase } = value as { minionUid: string; baseIndex: number };
        const isPod = (iData as any)?.isPod === true;
        if (minionUid === '__skip__') return { state, events: [] };
        const base = state.core.bases[fromBase];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const otherBases = state.core.bases.map((_b, i) => i).filter(i => i !== fromBase);
        if (otherBases.length === 0) return undefined;
        if (otherBases.length === 1) {
            return { state, events: [moveMinion(minionUid, target.defId, fromBase, otherBases[0], 'bear_cavalry_commission', timestamp)] };
        }
        const options = otherBases.map(i => {
            const baseDef = getBaseDef(state.core.bases[i].defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        const next = createSimpleChoice(
            `bear_cavalry_commission_move_dest_${timestamp}`, playerId, '委任：选择移动到的基地', buildBaseTargetOptions(options, state.core), { sourceId: 'bear_cavalry_commission_move_dest', targetType: 'base' }
            );
        return {
            state: queueInteraction(state, {
                ...next,
                data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase }, isPod },
            }),
            events: [],
        };
    });

    // 委任第四步：选择目标基地后移动
    registerInteractionHandler('bear_cavalry_commission_move_dest', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number };
        if (!ctx) return undefined;
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: ctx.minionUid,
                minionDefId: ctx.minionDefId,
                fromBaseIndex: ctx.fromBase,
                toBaseIndex: toBase,
                reason: 'bear_cavalry_commission',
                now: timestamp,
            }),
        };
    });

    // 黑熊骑兵第一步：选择随从后，链式选择目标基地
    registerInteractionHandler('bear_cavalry_bear_cavalry_choose_minion', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex: fromBase } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[fromBase];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const otherBases = state.core.bases.map((_b, i) => i).filter(i => i !== fromBase);
        if (otherBases.length === 0) return undefined;
        const options = otherBases.map(i => {
            const baseDef = getBaseDef(state.core.bases[i].defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        const next = createSimpleChoice(
            `bear_cavalry_bear_cavalry_choose_base_${timestamp}`, playerId, '选择要移动到的基地', buildBaseTargetOptions(options, state.core), { sourceId: 'bear_cavalry_bear_cavalry_choose_base', targetType: 'base' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase } } }), events: [] };
    });

    // 黑熊骑兵第二步：选择基地后移动
    registerInteractionHandler('bear_cavalry_bear_cavalry_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number };
        if (!ctx) return undefined;
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: ctx.minionUid,
                minionDefId: ctx.minionDefId,
                fromBaseIndex: ctx.fromBase,
                toBaseIndex: toBase,
                reason: 'bear_cavalry_bear_cavalry',
                now: timestamp,
            }),
        };
    });

    // 黑熊口粮：选择目标后消灭
    registerInteractionHandler('bear_cavalry_bear_necessities', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { type: string; uid: string; defId: string; baseIndex?: number; owner?: string; ownerId?: string };
        if (selected.type === 'minion') {
            return {
                state,
                events: buildValidatedDestroyEvents(state, {
                    minionUid: selected.uid,
                    minionDefId: selected.defId,
                    fromBaseIndex: selected.baseIndex!,
                    destroyerId: playerId,
                    reason: 'bear_cavalry_bear_necessities',
                    now: timestamp,
                }),
            };
        }
        return { state, events: [{ type: SU_EVENTS.ONGOING_DETACHED, payload: { cardUid: selected.uid, defId: selected.defId, ownerId: selected.ownerId!, reason: 'bear_cavalry_bear_necessities' }, timestamp }] };
    });

    // 你们已经完蛋：选择基地后→链式选择对手随从
    registerInteractionHandler('bear_cavalry_youre_screwed_choose_base', (state, playerId, value, _iData, _random, timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { baseIndex } = value as { baseIndex: number };
        const opponentMinions = state.core.bases[baseIndex].minions.filter(m => m.controller !== playerId);
        if (opponentMinions.length === 0) return { state, events: [] };
        const options = buildMinionTargetOptions(
            opponentMinions.map(m => {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const power = getMinionPower(state.core, m, baseIndex);
                return { uid: m.uid, defId: m.defId, baseIndex, label: `${name} (力量 ${power})` };
            }),
            {
                state: state.core,
                sourcePlayerId: playerId,
                effectType: 'affect',
            }
        );
        if (options.length === 0) return { state, events: [] };
        const next = createSimpleChoice(
            `bear_cavalry_youre_screwed_choose_minion_${timestamp}`, playerId,
            '选择要移动的对手随从', options,
            { sourceId: 'bear_cavalry_youre_screwed_choose_minion', targetType: 'minion' },
        );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { fromBaseIndex: baseIndex } } }), events: [] };
    });

    // 你们已经完蛋：选择随从后→链式选择目标基地
    registerInteractionHandler('bear_cavalry_youre_screwed_choose_minion', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex: fromBase } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[fromBase];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const otherBases = state.core.bases.map((_: any, i: number) => i).filter((i: number) => i !== fromBase);
        if (otherBases.length === 0) return undefined;
        const options = otherBases.map((i: number) => {
            const baseDef = getBaseDef(state.core.bases[i].defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        const next = createSimpleChoice(
            `bear_cavalry_youre_screwed_choose_dest_${timestamp}`, playerId, '选择目标基地', buildBaseTargetOptions(options, state.core), { sourceId: 'bear_cavalry_youre_screwed_choose_dest', targetType: 'base' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase } } }), events: [] };
    });

    registerInteractionHandler('bear_cavalry_youre_screwed_choose_dest', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number };
        if (!ctx) return undefined;
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: ctx.minionUid,
                minionDefId: ctx.minionDefId,
                fromBaseIndex: ctx.fromBase,
                toBaseIndex: toBase,
                reason: 'bear_cavalry_youre_screwed',
                now: timestamp,
            }),
        };
    });

    // 与熊同行：选择随从后→链式选择目标基地
    registerInteractionHandler('bear_cavalry_bear_rides_you_choose_minion', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex: fromBase } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[fromBase];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const otherBases = state.core.bases.map((_: any, i: number) => i).filter((i: number) => i !== fromBase);
        if (otherBases.length === 0) return undefined;
        const options = otherBases.map((i: number) => {
            const baseDef = getBaseDef(state.core.bases[i].defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        const next = createSimpleChoice(
            `bear_cavalry_bear_rides_you_choose_base_${timestamp}`, playerId, '选择目标基地', buildBaseTargetOptions(options, state.core), { sourceId: 'bear_cavalry_bear_rides_you_choose_base', targetType: 'base' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase } } }), events: [] };
    });

    registerInteractionHandler('bear_cavalry_bear_rides_you_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number };
        if (!ctx) return undefined;
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: ctx.minionUid,
                minionDefId: ctx.minionDefId,
                fromBaseIndex: ctx.fromBase,
                toBaseIndex: toBase,
                reason: 'bear_cavalry_bear_rides_you',
                now: timestamp,
            }),
        };
    });

    // 你们都是美食：选择来源基地后→链式选择目标基地
    registerInteractionHandler('bear_cavalry_borscht_choose_from', (state, playerId, value, _iData, _random, timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { baseIndex: fromBase } = value as { baseIndex: number };
        // 若没有任何可被移动的对手随从，则直接 fizzle（不再要求选择目标基地）
        const opponentMinions = state.core.bases[fromBase]?.minions.filter(m => m.controller !== playerId) ?? [];
        const movable = opponentMinions.filter(m => !isMinionProtected(state.core, m, fromBase, playerId, 'affect'));
        if (movable.length === 0) return { state, events: [] };
        const destBases: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            if (i === fromBase) continue;
            const baseDef = getBaseDef(state.core.bases[i].defId);
            destBases.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        if (destBases.length === 0) return { state, events: [] };
        const next = createSimpleChoice(
            `bear_cavalry_borscht_choose_dest_${timestamp}`, playerId, '选择目标基地（移动对手随从到此处）', buildBaseTargetOptions(destBases, state.core), { sourceId: 'bear_cavalry_borscht_choose_dest', targetType: 'base' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { fromBase } } }), events: [] };
    });

    registerInteractionHandler('bear_cavalry_borscht_choose_dest', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: destBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { fromBase: number };
        if (!ctx) return undefined;
        const events: SmashUpEvent[] = [];
        // 移动所有对手随从（保护检查自动应用）
        const opponentMinions = state.core.bases[ctx.fromBase].minions.filter(m => m.controller !== playerId);
        for (const m of opponentMinions) {
            // 检查保护（手动检查，因为这里不是构建选项而是批量移动）
            if (isMinionProtected(state.core, m, ctx.fromBase, playerId, 'affect')) continue;
            events.push(...buildValidatedMoveEvents(state, {
                minionUid: m.uid,
                minionDefId: m.defId,
                fromBaseIndex: ctx.fromBase,
                toBaseIndex: destBase,
                reason: 'bear_cavalry_youre_pretty_much_borscht',
                now: timestamp,
            }));
        }
        return { state, events };
    });

    // === POD 版本交互处理器 ===
    // 幼熊斥候 POD：消灭对手随从后，可选择移动己方小随从到本基地
    registerInteractionHandler('bear_cavalry_cub_scout_pod_destroy', (state, playerId, value, iData, _random, timestamp) => {
        const events: SmashUpEvent[] = [];
        
        // 处理跳过
        if ((value as any) === 'no') {
            return { state, events };
        }
        
        // 获取交互数据（直接从 iData 读取，不是 iData.data）
        const { minionUid, minionDefId, baseIndex, ownerId, scoutUid, scoutBaseIndex } = (iData ?? {}) as any;
        
        // 1. 消灭对手随从
        const destroyEvent = destroyMinion(
            minionUid,
            minionDefId,
            baseIndex,
            ownerId,
            playerId,
            'bear_cavalry_cub_scout_pod',
            timestamp
        );
        events.push(destroyEvent);
        
        // 2. 创建后续交互：选择移动己方小随从
        const candidates: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        // 查找所有基地上的己方随从（牌面战力≤3，含幼熊斥候所在基地）
        for (let i = 0; i < state.core.bases.length; i++) {
            for (const m of state.core.bases[i].minions) {
                if (m.controller !== playerId) continue;
                
                const def = getCardDef(m.defId) as MinionCardDef;
                if (!def || def.power === undefined) continue;
                
                if (def.power <= 3) {
                    const baseDef = getBaseDef(state.core.bases[i].defId);
                    candidates.push({
                        uid: m.uid,
                        defId: m.defId,
                        baseIndex: i,
                        label: `${def.name ?? m.defId} (力量 ${def.power}) @ ${baseDef?.name ?? i}`
                    });
                }
            }
        }
        
        if (candidates.length === 0) {
            // 没有符合条件的随从，直接返回
            return { state, events };
        }
        
        // 创建选择交互（可跳过）
        const interaction = createSimpleChoice(
            `bear_cavalry_cub_scout_pod_chain_move_${timestamp}_${scoutUid}`,
            playerId,
            '幼熊斥候：选择一个牌面战力≤3的己方随从移动到本基地（可跳过）',
            [
                ...buildMinionTargetOptions(candidates, { state: state.core, sourcePlayerId: playerId, effectType: 'move' }),
                { id: 'skip', label: '跳过', value: 'skip' as any }
            ],
            { sourceId: 'bear_cavalry_cub_scout_pod_chain_move', targetType: 'minion' }
        );
        (interaction.data as any).scoutBaseIndex = scoutBaseIndex;
        const matchState = queueInteraction(state, interaction);
        return { state: matchState, events };
    });
    
    // 幼熊斥候 POD：移动己方小随从到幼熊斥候所在基地
    registerInteractionHandler('bear_cavalry_cub_scout_pod_chain_move', (state, playerId, value, iData, _random, timestamp) => {
        const events: SmashUpEvent[] = [];
        
        // 处理跳过
        if ((value as any) === 'skip') {
            return { state, events };
        }
        
        const { minionUid, defId, baseIndex: fromBaseIndex } = value as { minionUid: string; defId: string; baseIndex: number };
        const { scoutBaseIndex } = (iData ?? {}) as any;
        
        // 移动随从
        const moveEvent = moveMinion(
            minionUid,
            defId,
            fromBaseIndex,
            scoutBaseIndex,
            'bear_cavalry_cub_scout_pod',
            timestamp
        );
        events.push(moveEvent);
        return { state, events };
    });
    
    // 黑熊骑兵 POD：选择随从后选择目标基地（可跳过）
    registerInteractionHandler('bear_cavalry_bear_cavalry_pod_choose_minion', (state, playerId, value, iData, _random, timestamp) => {
        // 处理跳过
        if ((value as any) === 'skip') {
            return { state, events: [] };
        }
        
        const { minionUid, baseIndex: fromBase } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[fromBase];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        
        const otherBases = state.core.bases.map((_b, i) => i).filter(i => i !== fromBase);
        if (otherBases.length === 0) return undefined;
        
        const options = otherBases.map(i => {
            const baseDef = getBaseDef(state.core.bases[i].defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        
        const next = createSimpleChoice(
            `bear_cavalry_bear_cavalry_pod_choose_base_${timestamp}`,
            playerId,
            '选择要移动到的基地',
            buildBaseTargetOptions(options, state.core),
            { sourceId: 'bear_cavalry_bear_cavalry_pod_choose_base', targetType: 'base' }
        );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase } } }), events: [] };
    });
    
    registerInteractionHandler('bear_cavalry_bear_cavalry_pod_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number };
        if (!ctx) return undefined;
        return { state, events: [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBase, toBase, 'bear_cavalry_bear_cavalry_pod', timestamp)] };
    });
    
    // 与熊同行 POD：选择随从后选择目标基地
    registerInteractionHandler('bear_cavalry_bear_rides_you_pod_choose_minion', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex: fromBase } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[fromBase];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        
        const otherBases = state.core.bases.map((_: any, i: number) => i).filter((i: number) => i !== fromBase);
        if (otherBases.length === 0) return undefined;
        
        const options = otherBases.map((i: number) => {
            const baseDef = getBaseDef(state.core.bases[i].defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        
        const next = createSimpleChoice(
            `bear_cavalry_bear_rides_you_pod_choose_base_${timestamp}`,
            playerId,
            '选择目标基地',
            buildBaseTargetOptions(options, state.core),
            { sourceId: 'bear_cavalry_bear_rides_you_pod_choose_base', targetType: 'base' }
        );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase, isMyMinion: target.controller === playerId } } }), events: [] };
    });
    
    registerInteractionHandler('bear_cavalry_bear_rides_you_pod_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number; isMyMinion: boolean };
        if (!ctx) return undefined;
        
        const events: SmashUpEvent[] = [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBase, toBase, 'bear_cavalry_bear_rides_you_pod', timestamp)];

        // 如果移动的是己方随从：可选择压制新基地上一张卡牌能力（含基地本身）
        if (!ctx.isMyMinion) return { state, events };

        const base = state.core.bases[toBase];
        if (!base) return { state, events };

        const suppressOptions: Array<{ id: string; label: string; value: BearRidesYouPodSuppressTarget }> = [];
        const baseDef = getBaseDef(base.defId);
        suppressOptions.push({
            id: 'base',
            label: `[基地] ${baseDef?.name ?? base.defId}`,
            value: { kind: 'base', baseIndex: toBase },
        });

        for (const m of base.minions) {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            suppressOptions.push({
                id: `minion-${m.uid}`,
                label: `[随从] ${def?.name ?? m.defId}`,
                value: { kind: 'minion', minionUid: m.uid, baseIndex: toBase },
            });
            for (const a of m.attachedActions ?? []) {
                const aDef = getCardDef(a.defId);
                suppressOptions.push({
                    id: `attached-${a.uid}`,
                    label: `[附着行动] ${aDef?.name ?? a.defId}`,
                    value: { kind: 'attached', cardUid: a.uid, baseIndex: toBase },
                });
            }
        }

        for (const oa of base.ongoingActions) {
            const oDef = getCardDef(oa.defId);
            suppressOptions.push({
                id: `ongoing-${oa.uid}`,
                label: `[持续行动] ${oDef?.name ?? oa.defId}`,
                value: { kind: 'ongoing', cardUid: oa.uid, baseIndex: toBase },
            });
        }

        // 泰坦：检查所有玩家的 activeTitan 是否在该基地
        for (const pid of state.core.turnOrder) {
            const p = state.core.players[pid];
            const t = (p as any)?.activeTitan as { titanUid: string; baseIndex: number; defId: string } | undefined;
            if (!t) continue;
            if (t.baseIndex !== toBase) continue;
            const tDef = getCardDef(t.defId);
            suppressOptions.push({
                id: `titan-${t.titanUid}`,
                label: `[泰坦] ${tDef?.name ?? t.defId}`,
                value: { kind: 'titan', titanUid: t.titanUid, baseIndex: toBase, ownerId: pid },
            });
        }

        suppressOptions.push({ id: 'skip', label: '跳过（不压制）', value: { kind: 'skip' } });

        const visibleSuppressOptions = suppressOptions.filter(option =>
            option.value.kind === 'base' || option.value.kind === 'skip'
        );

        const next = createSimpleChoice(
            `bear_cavalry_bear_rides_you_pod_choose_suppress_${timestamp}`,
            playerId,
            '与熊同行：选择要压制能力的卡牌（到你下回合开始）',
            visibleSuppressOptions as any[],
            { sourceId: 'bear_cavalry_bear_rides_you_pod_choose_suppress', targetType: 'generic', autoCancelOption: true }
        );
        (next.data as any).continuationContext = { toBase };

        return { state: queueInteraction(state, next), events };
    });

    registerInteractionHandler('bear_cavalry_bear_rides_you_pod_choose_suppress', (state, playerId, value, iData, _random, timestamp) => {
        const chosen = value as BearRidesYouPodSuppressTarget | { __cancel__?: true };
        if ((chosen as any)?.__cancel__) return { state, events: [] };
        if (!chosen || (chosen as any).kind === 'skip') return { state, events: [] };

        if (chosen.kind === 'base') {
            return {
                state,
                events: [{
                    type: SU_EVENTS.BASE_ABILITY_SUPPRESSED,
                    payload: { baseIndex: chosen.baseIndex, suppressorPlayerId: playerId, reason: 'bear_cavalry_bear_rides_you_pod' },
                    timestamp,
                } as any]
            };
        }

        return { state, events: [] };
    });
    
    // 全面优势 POD 天赋：摸牌或保护
    registerInteractionHandler('bear_cavalry_superiority_pod_talent', (state, playerId, value, iData, _random, timestamp) => {
        const action = (value as any) as 'draw' | 'protect';
        const events: SmashUpEvent[] = [];
        const cardUid = (iData as any)?.cardUid as string | undefined;
        const nextState = cardUid
            ? {
                ...state,
                core: {
                    ...state.core,
                    bases: state.core.bases.map(base => ({
                        ...base,
                        ongoingActions: base.ongoingActions.map(ongoing => {
                            if (ongoing.uid !== cardUid) return ongoing;
                            return {
                                ...ongoing,
                                metadata: {
                                    ...(ongoing.metadata ?? {}),
                                    superiorityProtect: action === 'protect',
                                },
                            };
                        }),
                    })),
                },
            }
            : state;
        
        if (action === 'draw') {
            // 摸一张牌（从牌库顶抽取）
            const player = state.core.players[playerId];
            if (player.deck.length > 0) {
                const drawnUid = player.deck[0].uid;
                events.push({
                    type: SU_EVENT_TYPES.CARDS_DRAWN,
                    payload: { playerId, count: 1, cardUids: [drawnUid], reason: 'bear_cavalry_superiority_pod' },
                    timestamp
                });
            }
        }
        
        return { state: nextState, events };
    });
    
    // 制高点 POD 触发器：消灭或摸牌打战术
    registerInteractionHandler('bear_cavalry_high_ground_pod_trigger', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { action: 'destroy' | 'draw'; minionUid?: string; minionDefId?: string; baseIndex?: number; ownerId?: string; ongoingUid: string };
        const events: SmashUpEvent[] = [];
        
        // POD 文本：destroy this action to either ... OR ...（两分支都先自毁）
        events.push({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: { cardUid: selected.ongoingUid, defId: 'bear_cavalry_high_ground_pod', ownerId: playerId, reason: 'bear_cavalry_high_ground_pod' },
            timestamp
        } as OngoingDetachedEvent);
        
        if (selected.action === 'destroy') {
            // 消灭随从
            if (selected.minionUid && selected.minionDefId !== undefined && selected.baseIndex !== undefined && selected.ownerId) {
                events.push(destroyMinion(
                    selected.minionUid,
                    selected.minionDefId,
                    selected.baseIndex,
                    selected.ownerId,
                    playerId,
                    'bear_cavalry_high_ground_pod',
                    timestamp
                ));
            }
        } else if (selected.action === 'draw') {
            // 摸一张牌（从牌库顶抽取）
            const player = state.core.players[playerId];
            if (player.deck.length > 0) {
                const drawnUid = player.deck[0].uid;
                events.push({
                    type: SU_EVENT_TYPES.CARDS_DRAWN,
                    payload: { playerId, count: 1, cardUids: [drawnUid], reason: 'bear_cavalry_high_ground_pod' },
                    timestamp
                });
            }
            
            // 打出一张战术（额外行动额度）
            events.push(grantExtraAction(playerId, 'bear_cavalry_high_ground_pod', timestamp));
        }
        
        return { state, events };
    });
    
    // 极地突击队员 POD 天赋：放置+1力量标记
    registerInteractionHandler('bear_cavalry_polar_commando_pod', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        return {
            state,
            events: [addPowerCounter(minionUid, baseIndex, 1, 'bear_cavalry_polar_commando_pod', timestamp)]
        };
    });
    
    // 伊万将军 POD 触发器：玩家选择是否给己方随从+1力量
    registerInteractionHandler('bear_cavalry_general_ivan_pod_trigger', (state, _playerId, value, iData, _random, timestamp) => {
        const events: SmashUpEvent[] = [];
        const action = value as string;
        const limitKey = (iData as any).limitKey as string;
        
        // 标记本回合已使用（无论选择是或否）
        if (!state.core.specialLimitUsed) {
            state.core.specialLimitUsed = {};
        }
        if (!state.core.specialLimitUsed[limitKey]) {
            state.core.specialLimitUsed[limitKey] = [];
        }
        state.core.specialLimitUsed[limitKey].push(0); // 使用 0 作为占位符（不需要基地索引）
        
        if (action === 'yes') {
            // 玩家选择使用效果：给该基地上己方所有随从+1临时力量
            const baseIndex = (iData as any).baseIndex as number;
            const ivanController = (iData as any).ivanController as string;
            const base = state.core.bases[baseIndex];
            
            if (base) {
                for (const m of base.minions) {
                    if (m.controller === ivanController) {
                        events.push(addTempPower(m.uid, baseIndex, 1, 'bear_cavalry_general_ivan_pod', timestamp));
                    }
                }
            }
        }
        // action === 'no' 时不产生任何事件
        
        return { state, events };
    });
}


