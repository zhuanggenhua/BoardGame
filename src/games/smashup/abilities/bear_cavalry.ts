/**
 * 大杀四方 - 黑熊骑兵派系能力
 *
 * 主题：消灭对手最弱随从、移动对手随从
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    grantExtraMinion,
    getMinionPower,
    applySemanticMinionEffectBatch,
    buildMinionTargetOptions,
    buildBaseTargetOptions,
    resolveOrPrompt,
    buildAbilityFeedback,
    createSkipOption,
    addTempPower,
    addPowerCounter,
    addOngoingCardCounter,
    grantContextualExtraAction,
    grantExtraAction,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    getTitansOnBase,
    buildStandardDrawEventsFromRuntimeContext,
    buildStandardDrawEvents,
} from '../domain/abilityHelpers';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, MinionOnBase, MinionPlayedEvent } from '../domain/types';
import type { MinionCardDef } from '../domain/types';
import { getCardDef, getBaseDef } from '../data/cards';
import { partitionMinionTargetsBySemantics } from '../domain/effectSemantics';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, TriggerContext } from '../domain/ongoingEffects';
import {
    createAbilityRuntimeSimpleChoice,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { MatchState, PlayerId } from '../../../engine/types';

// 本文件中使用的 defId 匹配工具：基础版与 `_pod` 版本都视为同一张牌
function matchesDefId(defId: string | undefined | null, baseDefId: string): boolean {
    return defId === baseDefId || defId === `${baseDefId}_pod`;
}

type BearCavalryPromptContext = {
    matchState: MatchState<any>;
    playerId: PlayerId;
    cardUid?: string;
    defId?: string;
    baseIndex?: number;
    now: number;
};

type BearCavalryPolarCommandoPromptContext = BearCavalryPromptContext & {
    cardUid: string;
    baseIndex: number;
};

type BearCavalrySuperiorityPromptContext = BearCavalryPromptContext & {
    cardUid: string;
};

type BearCavalryGeneralIvanPromptContext = BearCavalryPromptContext & {
    baseIndex: number;
    ivanController: string;
    limitKey: string;
};

type BearCavalryHighGroundPromptContext = BearCavalryPromptContext & {
    ongoingUid: string;
    ongoingOwnerId: string;
    minionUid: string;
    minionDefId: string;
    baseIndex: number;
    ownerId: string;
};

type BearNecessitiesValue =
    | { type: 'minion'; uid: string; minionUid: string; defId: string; baseIndex: number; owner: string }
    | { type: 'action'; uid: string; cardUid: string; defId: string; ownerId: string; baseIndex: number };

function createBearCavalryPromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: MatchState<any>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): BearCavalryPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

function canTriggerBearCavalryCubScoutPod(ctx: TriggerContext): boolean {
    const destBaseIndex = ctx.baseIndex;
    if (destBaseIndex === undefined || !ctx.triggerMinionUid || !ctx.matchState) return false;
    if (ctx.moveToBaseIndex !== undefined && destBaseIndex !== ctx.moveToBaseIndex) return false;

    const destBase = ctx.state.bases[destBaseIndex];
    if (!destBase) return false;

    let movedMinion: MinionOnBase | undefined;
    for (const base of ctx.state.bases) {
        const found = base.minions.find(minion => minion.uid === ctx.triggerMinionUid);
        if (found) {
            movedMinion = found;
            break;
        }
    }
    if (!movedMinion) return false;

    return destBase.minions.some(scout => {
        if (ctx.sourceCardUid && scout.uid !== ctx.sourceCardUid) return false;
        if (scout.defId !== 'bear_cavalry_cub_scout_pod') return false;
        if (scout.controller === movedMinion.controller) return false;
        return getMinionPower(ctx.state, movedMinion, destBaseIndex) < getMinionPower(ctx.state, scout, destBaseIndex);
    });
}

/** 注册黑熊骑兵派系所有能力 */
export function registerBearCavalryAbilities(): void {
    // 黑熊擒抱（行动卡）：每位对手消灭自己最弱的随从
    registerAbility('bear_cavalry_bear_hug', 'onPlay', bearCavalryBearHug);
    registerAbility('bear_cavalry_bear_hug_pod', 'onPlay', bearCavalryBearHug);  // POD 版相同
    // 委任（行动卡）：额外打出一个随从
    registerAbility('bear_cavalry_commission', 'onPlay', bearCavalryCommission);
    registerAbility('bear_cavalry_commission_pod', 'onPlay', bearCavalryCommission);  // POD 版相同
    // 黑熊骑兵（随从 onPlay）：移动对手在本基地的一个随从到另一个基地
    registerAbility('bear_cavalry_bear_cavalry', 'onPlay', bearCavalryBearCavalryAbility);
    // 你们已经完蛋（行动卡）：选择有己方随从的基地，移动对手随从
    registerAbility('bear_cavalry_youre_screwed', 'onPlay', bearCavalryYoureScrewed);
    // 与熊同行（行动卡）：移动己方一个随从到其他基地
    registerAbility('bear_cavalry_bear_rides_you', 'onPlay', bearCavalryBearRidesYou);
    // 你们都是美食（行动卡）：移动一个基地上所有对手随从到其他基地
    registerAbility('bear_cavalry_youre_pretty_much_borscht', 'onPlay', bearCavalryYourePrettyMuchBorscht);
    registerAbility('bear_cavalry_youre_pretty_much_borscht_pod', 'onPlay', bearCavalryYourePrettyMuchBorscht);  // POD 版相同
    // 黑熊口粮（行动卡）：消灭一个随从或一个已打出的行动卡
    registerAbility('bear_cavalry_bear_necessities', 'onPlay', bearCavalryBearNecessities);

    // === ongoing 效果注册 ===
    // 伊万将军：己方随从不收回能被消灭
    registerProtection('bear_cavalry_general_ivan', 'destroy', bearCavalryGeneralIvanChecker);
    // 极地突击队员：唯一随从时不收回可消灭（+2力量的ongoingModifiers 中注册）
    registerProtection('bear_cavalry_polar_commando', 'destroy', bearCavalryPolarCommandoChecker);
    // 全面优势：保护己方随从不受被消灭、移动、影响类效果影响
    registerProtection('bear_cavalry_superiority', 'destroy', bearCavalrySuperiorityChecker);
    registerProtection('bear_cavalry_superiority', 'move', bearCavalrySuperiorityChecker);
    registerProtection('bear_cavalry_superiority', 'affect', bearCavalrySuperiorityChecker);
    // 幼熊斥候：对手随从移入时消灭弱?
    registerTrigger('bear_cavalry_cub_scout', 'onMinionMoved', bearCavalryCubScoutTrigger, {
    });
    // 制高点：消灭移入的对手随从
    registerTrigger('bear_cavalry_high_ground', 'onMinionMoved', bearCavalryHighGroundTrigger, {
    });

    // === POD 版本能力注册 ===
    // 伊万将军 POD：保护 + 响应式加成
    registerProtection('bear_cavalry_general_ivan_pod', 'destroy', bearCavalryGeneralIvanPodProtection);
    registerTrigger('bear_cavalry_general_ivan_pod', 'onMinionMoved', bearCavalryGeneralIvanPodTrigger, {
        canTrigger: canTriggerBearCavalryGeneralIvanPod,
    });
    // 极地突击队员 POD：天赋放置指示物
    registerAbility('bear_cavalry_polar_commando_pod', 'talent', bearCavalryPolarCommandoPodTalent);
    // 黑熊骑兵 POD: 入场移动
    registerAbility('bear_cavalry_bear_cavalry_pod', 'onPlay', bearCavalryBearCavalryPodAbility);
    // 幼熊斥候 POD：响应式消灭
    registerTrigger('bear_cavalry_cub_scout_pod', 'onMinionMoved', bearCavalryCubScoutPodTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        canTrigger: canTriggerBearCavalryCubScoutPod,
    });
    // 黑熊擒抱 POD：全局最弱消灭（与原版相同，已在上方注册）
    // 你们已经完蛋 POD：降低临界点并提供 +2 力量
    registerAbility('bear_cavalry_youre_screwed_pod', 'onPlay', bearCavalryYoureScrewedPodAbility);
    // 黑熊口粮 POD：压制天赋 + 回合开始自毁
    registerAbility('bear_cavalry_bear_necessities_pod', 'talent', bearCavalryBearNecessitiesPodTalent);
    // 你们都是美食 POD: 批量移动（与原版相同，已在上方注册）
    // 与熊同行 POD: 移动 + 压制能力
    registerAbility('bear_cavalry_bear_rides_you_pod', 'onPlay', bearCavalryBearRidesYouPod);
    // 委任 POD: 额外随从 + 移动（与原版相同，已在上方注册）
    // 全面优势 POD: 保护 + 抽牌天赋
    registerProtection('bear_cavalry_superiority_pod', 'destroy', bearCavalrySuperiorityPodProtection);
    registerProtection('bear_cavalry_superiority_pod', 'move', bearCavalrySuperiorityPodProtection);
    registerProtection('bear_cavalry_superiority_pod', 'affect', bearCavalrySuperiorityPodProtection);
    registerAbility('bear_cavalry_superiority_pod', 'talent', {
        execute: bearCavalrySuperiorityPodTalent,
        validateUse: (ctx) => {
            const base = ctx.state.bases[ctx.baseIndex];
            if (!base) return '当前没有可选择的目标';

            const playerPowers: { [pid: string]: number } = {};
            for (const minion of base.minions) {
                playerPowers[minion.controller] = (playerPowers[minion.controller] || 0) + getMinionPower(ctx.state, minion, ctx.baseIndex);
            }

            const myPower = playerPowers[ctx.playerId] || 0;
            const isHighest = Object.entries(playerPowers).every(([pid, power]) => pid === ctx.playerId || power < myPower);
            return isHighest ? null : '当前没有可选择的目标';
        },
    });
    // 制高点 POD：响应式消灭并抽牌
    registerTrigger('bear_cavalry_high_ground_pod', 'onMinionMoved', bearCavalryHighGroundPodTrigger, {
        playerContext: 'sourceController',
        canTrigger: canTriggerBearCavalryHighGroundPod,
    });
}

function collectBearNecessitiesTargets(state: AbilityContext['state'], playerId: PlayerId) {
    const minionTargets: Array<{ uid: string; defId: string; baseIndex: number; owner: string; label: string }> = [];
    const actionTargets: Array<{ uid: string; defId: string; ownerId: string; baseIndex: number; label: string }> = [];

    for (let i = 0; i < state.bases.length; i++) {
        const base = state.bases[i];
        const baseDef = getBaseDef(base.defId);
        const baseName = baseDef?.name ?? `基地 ${i + 1}`;

        for (const m of base.minions) {
            if (m.controller !== playerId) {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const power = getMinionPower(state, m, i);
                minionTargets.push({
                    uid: m.uid,
                    defId: m.defId,
                    baseIndex: i,
                    owner: m.owner,
                    label: `[随从] ${name} (力量 ${power}) @ ${baseName}`,
                });
            }
        }

        for (const o of base.ongoingActions) {
            const ongoingControllerId = o.metadata?.sourceControllerId ?? o.ownerId;
            if (ongoingControllerId !== playerId) {
                const def = getCardDef(o.defId);
                const name = def?.name ?? o.defId;
                actionTargets.push({ uid: o.uid, defId: o.defId, ownerId: o.ownerId, baseIndex: i, label: `[行动] ${name} @ ${baseName}` });
            }
        }
    }

    return [...minionTargets, ...actionTargets];
}

const bearCavalryPolarCommandoPodPromptProgram = createPromptProgram<BearCavalryPolarCommandoPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'bear_cavalry_polar_commando_pod',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.baseIndex];
        const commando = base?.minions.find(m => m.uid === context.cardUid);
        const commandoPower = commando ? getMinionPower(context.matchState.core, commando, context.baseIndex) : 0;
        const options: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];

        for (let i = 0; i < context.matchState.core.bases.length; i++) {
            const currentBase = context.matchState.core.bases[i];
            for (const minion of currentBase.minions) {
                const power = minion.uid === context.cardUid ? commandoPower : getMinionPower(context.matchState.core, minion, i);
                if (minion.uid !== context.cardUid && power >= commandoPower) continue;
                const def = getCardDef(minion.defId) as MinionCardDef | undefined;
                const name = def?.name ?? minion.defId;
                options.push({ uid: minion.uid, defId: minion.defId, baseIndex: i, label: `${name} (力量 ${power})` });
            }
        }

        return createAbilityRuntimeSimpleChoice(
            `bear_cavalry_polar_commando_pod_${context.now}`,
            context.playerId,
            '选择放置 +1 力量标记的随从',
            buildMinionTargetOptions(options, { state: context.matchState.core, sourcePlayerId: context.playerId }) as any[],
            { sourceId: 'bear_cavalry_polar_commando_pod', targetType: 'minion', titleKey: 'ui.bear_cavalry_polar_commando_pod_title' },
        );
    },
    onResolve: ({ value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'bear_cavalry_polar_commando_pod', timestamp)],
        };
    },
});

const bearCavalrySuperiorityPodPromptProgram = createPromptProgram<BearCavalrySuperiorityPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'bear_cavalry_superiority_pod_talent',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `bear_cavalry_superiority_pod_talent_${context.now}`,
        context.playerId,
        '全面优势：选择一项',
        [
            { id: 'draw', label: '摸一张牌', labelKey: 'ui.bear_cavalry_superiority_pod_draw_option', value: { action: 'draw' as const }, displayMode: 'button' as const },
            { id: 'protect', label: '保护随从直到下回合', labelKey: 'ui.bear_cavalry_superiority_pod_protect_option', value: { action: 'protect' as const }, displayMode: 'button' as const },
        ],
        { sourceId: 'bear_cavalry_superiority_pod_talent', targetType: 'button', titleKey: 'ui.bear_cavalry_superiority_pod_title' },
    ),
    onResolve: (args) => {
        const { context, state, value, interactionData, playerId } = args;
        const action = typeof value === 'string'
            ? value as 'draw' | 'protect'
            : (value as { action?: 'draw' | 'protect' } | undefined)?.action;
        if (!action) return { events: [] };
        const cardUid = context?.cardUid ?? (interactionData?.cardUid as string | undefined);

        const events: SmashUpEvent[] = [];
        if (cardUid) {
            const baseIndex = state.core.bases.findIndex(base =>
                base.ongoingActions.some(ongoing => ongoing.uid === cardUid),
            );
            if (baseIndex !== -1) {
                events.push(addOngoingCardCounter(
                    cardUid,
                    baseIndex,
                    0,
                    'bear_cavalry_superiority_pod_talent',
                    args.timestamp,
                    { metadataUpdate: { superiorityProtect: action === 'protect' } },
                ));
            }
        }
        if (action === 'draw') {
            events.push(...buildStandardDrawEventsFromRuntimeContext(args, playerId, 1));
        }
        return { events };
    },
});

const bearCavalryGeneralIvanPodPromptProgram = createPromptProgram<BearCavalryGeneralIvanPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'bear_cavalry_general_ivan_pod_trigger',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `bear_cavalry_general_ivan_pod_trigger_${context.now}_${context.ivanController}`,
        context.playerId,
        '伊万将军：是否给对手随从移动到的基地上你的随从 +1 力量直到回合结束？（每回合限一次）',
        [
            { id: 'yes', label: '是（给己方随从 +1 力量）', labelKey: 'ui.bear_cavalry_general_ivan_pod_yes_option', value: { action: 'yes' as const }, displayMode: 'button' as const },
            { id: 'no', label: '否', labelKey: 'ui.bear_cavalry_general_ivan_pod_no_option', value: { action: 'no' as const }, displayMode: 'button' as const },
        ],
        { sourceId: 'bear_cavalry_general_ivan_pod_trigger', targetType: 'button', titleKey: 'ui.bear_cavalry_general_ivan_pod_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const action = (value as { action?: 'yes' | 'no' } | undefined)?.action;
        if (!action) return { events: [] };
        const limitUsedEvent: SmashUpEvent = {
            type: SU_EVENTS.SPECIAL_LIMIT_USED,
            payload: {
                playerId: context.playerId,
                baseIndex: 0,
                limitGroup: context.limitKey,
                abilityDefId: 'bear_cavalry_general_ivan_pod',
            },
            timestamp,
        };

        if (action !== 'yes') {
            return { events: [limitUsedEvent] };
        }

        const base = state.core.bases[context.baseIndex];
        const events = base
            ? base.minions
                .filter(minion => minion.controller === context.ivanController)
                .map(minion => addTempPower(minion.uid, context.baseIndex, 1, 'bear_cavalry_general_ivan_pod', timestamp))
            : [];

        return { events: [limitUsedEvent, ...events] };
    },
});

const bearCavalryHighGroundPodPromptProgram = createPromptProgram<BearCavalryHighGroundPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'bear_cavalry_high_ground_pod_trigger',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `bear_cavalry_high_ground_pod_trigger_${context.now}_${context.ongoingUid}`,
        context.playerId,
        '制高点：选择一项',
        [
            { id: 'destroy', label: '消灭制高点并消灭该随从', labelKey: 'ui.bear_cavalry_high_ground_pod_destroy_option', value: { action: 'destroy' as const }, displayMode: 'button' as const },
            { id: 'draw', label: '摸一张牌并打出一张战术', labelKey: 'ui.bear_cavalry_high_ground_pod_draw_option', value: { action: 'draw' as const }, displayMode: 'button' as const },
        ],
        { sourceId: 'bear_cavalry_high_ground_pod_trigger', targetType: 'button', titleKey: 'ui.bear_cavalry_high_ground_pod_title' },
    ),
    onResolve: (args) => {
        const { context, state, value, timestamp, playerId } = args;
        const action = (value as { action?: 'destroy' | 'draw' } | undefined)?.action;
        if (!action) return { events: [] };

        const events: SmashUpEvent[] = buildValidatedOngoingDetachEvents(state, {
            cardUid: context.ongoingUid,
            defId: 'bear_cavalry_high_ground_pod',
            ownerId: context.ongoingOwnerId,
            reason: 'bear_cavalry_high_ground_pod',
            now: timestamp,
            expectedLocation: 'base',
        });
        if (events.length === 0) return { events: [] };

        if (action === 'destroy') {
            events.push(...buildValidatedDestroyEvents(state, {
                minionUid: context.minionUid,
                minionDefId: context.minionDefId,
                fromBaseIndex: context.baseIndex,
                destroyerId: playerId,
                sourcePlayerId: playerId,
                sourceCardUid: context.ongoingUid,
                sourceDefId: 'bear_cavalry_high_ground_pod',
                sourceControllerId: playerId,
                sourceBaseIndex: context.baseIndex,
                sourceKind: 'nonAction',
                reason: 'bear_cavalry_high_ground_pod',
                now: timestamp,
            }));
            return { events };
        }

        events.push(...buildStandardDrawEventsFromRuntimeContext(args, playerId, 1));
        events.push(grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'bear_cavalry_high_ground_pod'));
        return { events };
    },
});

const bearCavalryBearNecessitiesPromptProgram = createPromptProgram<BearCavalryPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'bear_cavalry_bear_necessities',
    buildInteraction: (context) => {
        const allTargets = collectBearNecessitiesTargets(context.matchState.core, context.playerId);
        const options = allTargets.map((target, index) => ({
            id: `target-${index}`,
            label: target.label,
            value: ('owner' in target
                ? { type: 'minion' as const, uid: target.uid, minionUid: target.uid, defId: target.defId, baseIndex: target.baseIndex, owner: target.owner }
                : { type: 'action' as const, uid: target.uid, cardUid: target.uid, defId: target.defId, ownerId: target.ownerId, baseIndex: target.baseIndex }) as BearNecessitiesValue,
            displayMode: 'card' as const,
        }));
        return createAbilityRuntimeSimpleChoice(
            `bear_cavalry_bear_necessities_${context.now}`,
            context.playerId,
            '选择要消灭的随从或行动卡',
            options as any[],
            {
                sourceId: 'bear_cavalry_bear_necessities',
                targetType: 'board',
                titleKey: 'ui.bear_cavalry_bear_necessities_title',
                autoResolveIfSingle: false,
            },
        );
    },
    onResolve: ({ context, state, value, timestamp, playerId }) => {
        const selected = value as BearNecessitiesValue | undefined;
        if (!selected) return { events: [] };
        if (selected.type === 'minion') {
            const selectedMinionUid = selected.minionUid ?? selected.uid;
            return {
                events: buildValidatedDestroyEvents(state.core, {
                    minionUid: selectedMinionUid,
                    minionDefId: selected.defId,
                    fromBaseIndex: selected.baseIndex,
                    destroyerId: playerId,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: context.cardUid,
                    sourceDefId: context.defId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.baseIndex,
                    sourceKind: 'action',
                    reason: 'bear_cavalry_bear_necessities',
                    now: timestamp,
                }),
            };
        }
        const selectedCardUid = selected.cardUid ?? selected.uid;
        const actionStillOnBoard = state.core.bases[selected.baseIndex]?.ongoingActions.some(action => action.uid === selectedCardUid) ?? false;
        if (!actionStillOnBoard) return { events: [] };
        return {
            events: buildValidatedOngoingDetachEvents(state, {
                cardUid: selectedCardUid,
                defId: selected.defId,
                ownerId: selected.ownerId,
                reason: 'bear_cavalry_bear_necessities',
                now: timestamp,
                expectedLocation: 'base',
            }),
        };
    },
});

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
            events.push(...buildValidatedDestroyEvents(ctx.state, {
                minionUid: weakest[0].minion.uid,
                minionDefId: weakest[0].minion.defId,
                fromBaseIndex: weakest[0].baseIndex,
                destroyerId: ctx.playerId,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                sourceKind: 'action',
                reason: 'bear_cavalry_bear_hug',
                now: ctx.now,
            }));
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
                events.push(...buildValidatedDestroyEvents(ctx.state, {
                    minionUid: weakest[0].uid,
                    minionDefId: weakest[0].defId,
                    fromBaseIndex: weakest[0].baseIndex,
                    destroyerId: ctx.playerId,
                    sourcePlayerId: ctx.playerId,
                    sourceCardUid: ctx.cardUid,
                    sourceDefId: ctx.defId,
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: ctx.baseIndex,
                    sourceKind: 'action',
                    reason: 'bear_cavalry_bear_hug',
                    now: ctx.now,
                }));
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
            buildMinionTargetOptions(options, {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                sourceDefId: ctx.defId,
                sourceKind: 'action',
                effectType: 'destroy',
                respectActionProtection: true,
            }),
            { sourceId: 'bear_cavalry_bear_hug', targetType: 'minion', titleKey: 'ui.bear_cavalry_bear_hug_title' },
        );
        (interaction.data as any).continuationContext = {
            opponents,
            opponentIdx: idx,
            destroyerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
        };
        return { events, matchState: queueInteraction(ctx.matchState, interaction) };
    }
    return { events };
}

/** 委任 onPlay：给予额外随从额度，并选择手牌随从打出到基地，然后移动该基地上对手随从 */
function bearCavalryCommission(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const handMinions = player.hand.filter(c => c.type === 'minion');
    // 给予 1 点“额外随从额度”（banked），保证后续链式交互打出的随从不会被额度门禁拦住
    // （交互链中真正打出的随从会消费这次额度，详见 interactionChainE2E 相关用例）
    const events: SmashUpEvent[] = [grantExtraMinion(ctx.playerId, 'bear_cavalry_commission', ctx.now)];
    if (handMinions.length === 0) {
        // 规则口径：playCards 阶段获得的普通额外随从可暂存到本阶段稍后使用
        return { events };
    }

    // 让玩家选择要打出的手牌随从
    const options = handMinions.map((c, i) => {
        const def = getCardDef(c.defId) as MinionCardDef | undefined;
        const name = def?.name ?? c.defId;
        const power = def?.power ?? 0;
        return { id: `hand-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, ownerId: c.owner, power }, _source: 'hand' as const, displayMode: 'card' as const };
    });
    const interaction = createSimpleChoice(
        `bear_cavalry_commission_choose_minion_${ctx.now}`, ctx.playerId,
        '委任：选择要额外打出的随从', options as any[],
        { sourceId: 'bear_cavalry_commission_choose_minion', targetType: 'hand', titleKey: 'ui.bear_cavalry_commission_choose_minion_title' },
    );
    // 标记是否为 POD 版本，用于后续交互链区分“必须移动”和“可以跳过”
    (interaction.data as any).isPod = ctx.defId === 'bear_cavalry_commission_pod';
    (interaction.data as any).sourceCardUid = ctx.cardUid;
    (interaction.data as any).sourceDefId = ctx.defId;
    (interaction.data as any).sourceBaseIndex = ctx.baseIndex;
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}


/** 委任 POD onPlay：额外随从并移动 */
// ============================================================================
// ongoing 效果检查器与触发器
// ============================================================================

/** 伊万将军保护检查：你控制的所有随从（含伊万自身）不能被消灭 */
function bearCavalryGeneralIvanChecker(ctx: ProtectionCheckContext): boolean {
    for (const base of ctx.state.bases) {
        const hasMatchingIvan = base.minions.some(
            minion => matchesDefId(minion.defId, 'bear_cavalry_general_ivan')
                && minion.controller === ctx.targetMinion.controller,
        );
        if (hasMatchingIvan) {
            // 原版文本：Your minions cannot be destroyed.
            // FAQ 指明不区分来源，因此同控制者的所有随从（包括伊万自己）一律保护
            return true;
        }
    }
    return false;
}


/** 伊万将军 POD 保护检查：你的随从不可被消灭 */
function bearCavalryGeneralIvanPodProtection(ctx: ProtectionCheckContext): boolean {
    // 检查是否有伊万将军 POD 在场
    for (const base of ctx.state.bases) {
        const hasMatchingIvan = base.minions.some(
            minion => minion.defId === 'bear_cavalry_general_ivan_pod'
                && minion.controller === ctx.targetMinion.controller,
        );
        if (hasMatchingIvan) {
            // 保护同控制者的所有随从（包括伊万自己）
            // POD 文本：Your minions cannot be destroyed.（不区分来源）
            return true;
        }
    }
    return false;
}


/** 伊万将军 POD 触发器：其他玩家随从移动后可选择给己方随从 +1 力量（每回合限一次） */
function findBearCavalryMovedMinion(ctx: TriggerContext): { minion: MinionOnBase; baseIndex: number } | undefined {
    if (!ctx.triggerMinionUid) return undefined;
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex++) {
        const minion = ctx.state.bases[baseIndex].minions.find(candidate => candidate.uid === ctx.triggerMinionUid);
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function hasQueuedBearCavalryInteraction(ctx: TriggerContext, sourceId: string, predicate: (data: any) => boolean): boolean {
    if (!ctx.matchState) return false;
    const current = ctx.matchState.sys.interaction.current;
    const queued = ctx.matchState.sys.interaction.queue;
    return (current ? [current, ...queued] : queued).some((interaction: any) =>
        interaction.data?.sourceId === sourceId && predicate(interaction.data),
    );
}

function canTriggerBearCavalryGeneralIvanPod(ctx: TriggerContext): boolean {
    if (!ctx.matchState) return false;
    const moved = findBearCavalryMovedMinion(ctx);
    if (!moved) return false;
    const movedToBase = ctx.state.bases[moved.baseIndex];
    if (!movedToBase) return false;
    const ivans = ctx.state.bases.flatMap(base => base.minions)
        .filter(minion =>
            minion.defId === 'bear_cavalry_general_ivan_pod'
            && (!ctx.sourceCardUid || minion.uid === ctx.sourceCardUid),
        );
    return ivans.some(ivan => {
        if (moved.minion.controller === ivan.controller) return false;
        if (!movedToBase.minions.some(minion => minion.controller === ivan.controller)) return false;
        const limitKey = `bear_cavalry_general_ivan_pod_${ivan.controller}`;
        if (ctx.state.specialLimitUsed?.[limitKey]?.length) return false;
        return !hasQueuedBearCavalryInteraction(ctx, 'bear_cavalry_general_ivan_pod_trigger', data =>
            data?.ivanController === ivan.controller
            && data?.turnNumber === ctx.state.turnNumber,
        );
    });
}

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
    let currentMatchState = ctx.matchState;
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex++) {
        const base = ctx.state.bases[baseIndex];
        const ivans = base.minions.filter(m => m.defId === 'bear_cavalry_general_ivan_pod');
        if (!ivans.length) continue;

        for (const ivan of ivans) {
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
            if (currentMatchState) {
                const queue = currentMatchState.sys.interaction.queue;
                const current = currentMatchState.sys.interaction.current;
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

            if (!currentMatchState) return events;
            const result = executeAbilityProgram(
                bearCavalryGeneralIvanPodPromptProgram,
                createBearCavalryPromptContext(currentMatchState, ivan.controller, ctx.now, {
                    baseIndex: movedToBaseIndex,
                    ivanController: ivan.controller,
                    limitKey,
                }) satisfies BearCavalryGeneralIvanPromptContext,
            );
            events.push(...result.events);
            currentMatchState = result.matchState ?? currentMatchState;
        }
    }
    
    return currentMatchState && currentMatchState !== ctx.matchState
        ? { events, matchState: currentMatchState }
        : events;
}

/** 极地突击队员保护检查：基地上唯一己方随从时不收回可消灭 */
function bearCavalryPolarCommandoChecker(ctx: ProtectionCheckContext): boolean {
    if (!matchesDefId(ctx.targetMinion.defId, 'bear_cavalry_polar_commando')) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    const myMinionCount = base.minions.filter(m => m.controller === ctx.targetMinion.controller).length;
    return myMinionCount === 1;
}


/** 极地突击队员 POD 天赋：放置 +1 力量标记 */
function bearCavalryPolarCommandoPodTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    // 找到极地突击队员（在当前 baseIndex 上发动天赋）
    const commando = base.minions.find(m => m.uid === ctx.cardUid);
    if (!commando) return { events: [] };

    const commandoPower = getMinionPower(ctx.state, commando, ctx.baseIndex);

    // POD 文本：this minion 或 “a minion with less power than this minion”
    // 目标范围：任意基地上的任意随从（不限定己方；满足“更低战力”即可）
    const targets: Array<{ minion: MinionOnBase; baseIndex: number; power: number }> = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const b = ctx.state.bases[i];
        for (const m of b.minions) {
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

    const result = executeAbilityProgram(
        bearCavalryPolarCommandoPodPromptProgram,
        createBearCavalryPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
            baseIndex: ctx.baseIndex,
        }) satisfies BearCavalryPolarCommandoPromptContext,
    );
    return { events: result.events, matchState: result.matchState };
}

/** 全面优势保护检查：保护基地上己方随从不受其他玩家的消灭、移动和影响 */
function bearCavalrySuperiorityChecker(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.ongoingActions.some(
        a => matchesDefId(a.defId, 'bear_cavalry_superiority')
            && ((a.metadata?.sourceControllerId as PlayerId | undefined) ?? a.ownerId) === ctx.targetMinion.controller
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
             (((a.metadata?.sourceControllerId as PlayerId | undefined) ?? a.ownerId) === ctx.targetMinion.controller) &&
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
    
    const result = executeAbilityProgram(
        bearCavalrySuperiorityPodPromptProgram,
        createBearCavalryPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
        }) satisfies BearCavalrySuperiorityPromptContext,
    );
    return { events: result.events, matchState: result.matchState };
}

/** 幼熊斥候触发：对手随从移入时，若力量低于斥候则消灭 */
function bearCavalryCubScoutTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const destBaseIndex = ctx.baseIndex;
    if (destBaseIndex === undefined || !ctx.triggerMinionUid) return events;
    if (ctx.moveToBaseIndex !== undefined && destBaseIndex !== ctx.moveToBaseIndex) return events;
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
        if (ctx.sourceCardUid && scout.uid !== ctx.sourceCardUid) continue;
        if (!matchesDefId(scout.defId, 'bear_cavalry_cub_scout')) continue;
        if (scout.controller === movedMinion.controller) continue;
        const scoutPower = getMinionPower(ctx.state, scout, destBaseIndex);
        const movedPower = getMinionPower(ctx.state, movedMinion, destBaseIndex);
        if (movedPower < scoutPower) {
            events.push(...buildValidatedDestroyEvents(ctx.state, {
                minionUid: movedMinion.uid,
                minionDefId: movedMinion.defId,
                fromBaseIndex: destBaseIndex,
                destroyerId: scout.controller,
                sourcePlayerId: scout.controller,
                sourceCardUid: scout.uid,
                sourceDefId: scout.defId,
                sourceControllerId: scout.controller,
                sourceBaseIndex: destBaseIndex,
                sourceKind: 'nonAction',
                reason: 'bear_cavalry_cub_scout',
                now: ctx.now,
                targetSnapshot: {
                    ownerId: movedMinion.owner,
                    controllerId: movedMinion.controller,
                    attachedActions: movedMinion.attachedActions,
                    metadata: movedMinion.metadata,
                    playedThisTurn: movedMinion.playedThisTurn,
                },
            }));
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
    if (ctx.moveToBaseIndex !== undefined && destBaseIndex !== ctx.moveToBaseIndex) {
        return events;
    }
    
    // 去重检查：检查交互队列中是否已存在相同的消灭确认交互
    if (ctx.matchState) {
        const queue = ctx.matchState.sys.interaction.queue;
        const current = ctx.matchState.sys.interaction.current;
        const allInteractions = current ? [current, ...queue] : queue;
        
        const existingInteraction = allInteractions.find(
            (i: any) => i.data?.sourceId === 'bear_cavalry_cub_scout_pod_destroy' &&
                        i.data?.minionUid === ctx.triggerMinionUid &&
                        (!ctx.sourceCardUid || i.data?.scoutUid === ctx.sourceCardUid)
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
        if (ctx.sourceCardUid && scout.uid !== ctx.sourceCardUid) continue;
        if (scout.defId !== 'bear_cavalry_cub_scout_pod') continue;
        if (scout.controller === movedMinion.controller) continue;

        const scoutPower = getMinionPower(ctx.state, scout, destBaseIndex);
        const movedPower = getMinionPower(ctx.state, movedMinion, destBaseIndex);

        if (movedPower < scoutPower) {
            if (!ctx.matchState) return events;

            // 有 matchState：创建交互，询问是否消灭并后续可移动己方小随从
            const interaction = createSimpleChoice(
                `bear_cavalry_cub_scout_pod_destroy_${ctx.now}_${scout.uid}`,
                scout.controller,
                `幼熊斥候：是否消灭 ${getCardDef(movedMinion.defId)?.name ?? movedMinion.defId}？`,
                [
                    { id: 'yes', label: '是（消灭并移动己方小随从）', labelKey: 'ui.bear_cavalry_cub_scout_pod_destroy_yes_option', value: 'yes' as any, displayMode: 'button' as const },
                    { id: 'no', label: '否', labelKey: 'ui.bear_cavalry_cub_scout_pod_destroy_no_option', value: 'no' as any, displayMode: 'button' as const },
                ],
                {
                    sourceId: 'bear_cavalry_cub_scout_pod_destroy',
                    targetType: 'generic',
                    titleKey: 'ui.bear_cavalry_cub_scout_pod_destroy_title',
                    titleParams: { minionName: getCardDef(movedMinion.defId)?.name ?? movedMinion.defId },
                },
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

/** 制高点触发：有己方随从时消灭移入的对手随从 */
function bearCavalryHighGroundTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const destBaseIndex = ctx.baseIndex;
    if (destBaseIndex === undefined || !ctx.triggerMinionUid) return events;
    if (ctx.moveToBaseIndex !== undefined && destBaseIndex !== ctx.moveToBaseIndex) return events;
    const destBase = ctx.state.bases[destBaseIndex];
    if (!destBase) return events;

    let movedMinion: MinionOnBase | undefined;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const found = ctx.state.bases[i].minions.find(m => m.uid === ctx.triggerMinionUid);
        if (found) { movedMinion = found; break; }
    }
    if (!movedMinion) return events;

    for (const ongoing of destBase.ongoingActions) {
        if (ctx.sourceCardUid && ongoing.uid !== ctx.sourceCardUid) continue;
        if (!matchesDefId(ongoing.defId, 'bear_cavalry_high_ground')) continue;
        const ongoingControllerId = (ongoing.metadata?.sourceControllerId as PlayerId | undefined) ?? ongoing.ownerId;
        if (ongoingControllerId === movedMinion.controller) continue;
        const controllerHasMinion = destBase.minions.some(m => m.controller === ongoingControllerId);
        if (!controllerHasMinion) continue;
        events.push(...buildValidatedDestroyEvents(ctx.state, {
            minionUid: movedMinion.uid,
            minionDefId: movedMinion.defId,
            fromBaseIndex: destBaseIndex,
            destroyerId: ongoingControllerId,
            sourcePlayerId: ongoingControllerId,
            sourceCardUid: ongoing.uid,
            sourceDefId: ongoing.defId,
            sourceControllerId: ongoingControllerId,
            sourceBaseIndex: destBaseIndex,
            sourceKind: 'nonAction',
            reason: 'bear_cavalry_high_ground',
            now: ctx.now,
            targetSnapshot: {
                ownerId: movedMinion.owner,
                controllerId: movedMinion.controller,
                attachedActions: movedMinion.attachedActions,
                metadata: movedMinion.metadata,
                playedThisTurn: movedMinion.playedThisTurn,
            },
        }));
        break;
    }
    return events;
}


/** 制高点 POD 触发器：移动后消灭，或摸牌并打出战术 */
function canTriggerBearCavalryHighGroundPod(ctx: TriggerContext): boolean {
    if (!ctx.matchState) return false;
    const destBaseIndex = ctx.baseIndex;
    if (destBaseIndex === undefined || (ctx.moveToBaseIndex !== undefined && destBaseIndex !== ctx.moveToBaseIndex)) {
        return false;
    }
    const destBase = ctx.state.bases[destBaseIndex];
    const moved = findBearCavalryMovedMinion(ctx);
    if (!destBase || !moved) return false;
    return destBase.ongoingActions.some(ongoing => {
        if (ctx.sourceCardUid && ongoing.uid !== ctx.sourceCardUid) return false;
        if (ongoing.defId !== 'bear_cavalry_high_ground_pod') return false;
        const ongoingControllerId = (ongoing.metadata?.sourceControllerId as PlayerId | undefined) ?? ongoing.ownerId;
        if (ongoingControllerId === moved.minion.controller) return false;
        if (!destBase.minions.some(minion => minion.controller === ongoingControllerId)) return false;
        return !hasQueuedBearCavalryInteraction(ctx, 'bear_cavalry_high_ground_pod_trigger', data =>
            data?.ongoingUid === ongoing.uid
            && data?.minionUid === moved.minion.uid,
        );
    });
}

function bearCavalryHighGroundPodTrigger(ctx: TriggerContext): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: any } {
    const events: SmashUpEvent[] = [];
    const destBaseIndex = ctx.baseIndex;
    if (destBaseIndex === undefined || !ctx.triggerMinionUid) return events;
    if (ctx.moveToBaseIndex !== undefined && destBaseIndex !== ctx.moveToBaseIndex) return events;
    
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
        if (ctx.sourceCardUid && ongoing.uid !== ctx.sourceCardUid) continue;
        if (ongoing.defId !== 'bear_cavalry_high_ground_pod') continue;
        const ongoingControllerId = (ongoing.metadata?.sourceControllerId as PlayerId | undefined) ?? ongoing.ownerId;
        if (ongoingControllerId === movedMinion.controller) continue;

        const ownerHasMinion = destBase.minions.some(m => m.controller === ongoingControllerId);
        if (!ownerHasMinion) continue;

        if (!ctx.matchState) return events;

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

        const result = executeAbilityProgram(
            bearCavalryHighGroundPodPromptProgram,
            createBearCavalryPromptContext(ctx.matchState, ongoingControllerId, ctx.now, {
                ongoingUid: ongoing.uid,
                ongoingOwnerId: ongoing.ownerId,
                minionUid: movedMinion.uid,
                minionDefId: movedMinion.defId,
                baseIndex: destBaseIndex,
                ownerId: movedMinion.owner,
            }) satisfies BearCavalryHighGroundPromptContext,
        );
        return { events: [...events, ...result.events], matchState: result.matchState };
    }
    
    return events;
}

/** 黑熊骑兵 onPlay：移动对手在本基地的一个随从到另一个基地 */
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

    // 选择随从（第一步），buildMinionTargetOptions 会自动过滤受保护的随从
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
        { sourceId: 'bear_cavalry_bear_cavalry_choose_minion', targetType: 'minion', titleKey: 'ui.bear_cavalry_choose_enemy_minion_title' },
    );
    (interaction.data as any).continuationContext = { fromBaseIndex: ctx.baseIndex };
    (interaction.data as any).sourceCardUid = ctx.cardUid;
    (interaction.data as any).sourceDefId = ctx.defId;
    (interaction.data as any).sourceBaseIndex = ctx.baseIndex;
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
        { sourceId: 'bear_cavalry_bear_cavalry_pod_choose_minion', targetType: 'minion', titleKey: 'ui.bear_cavalry_bear_cavalry_pod_title' }
    );
    (interaction.data as any).continuationContext = { fromBaseIndex: ctx.baseIndex };
    (interaction.data as any).sourceCardUid = ctx.cardUid;
    (interaction.data as any).sourceDefId = ctx.defId;
    (interaction.data as any).sourceBaseIndex = ctx.baseIndex;
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
        { sourceId: 'bear_cavalry_youre_screwed_choose_base', targetType: 'base', autoCancelOption: true, titleKey: 'ui.bear_cavalry_youre_screwed_choose_base_title' }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}


/** 你们已经完蛋 POD onPlay：ongoing 效果（动态调整临界点） */
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
        `bear_cavalry_bear_rides_you_choose_minion_${ctx.now}`, ctx.playerId, '选择要移动的己方随从', buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }), { sourceId: 'bear_cavalry_bear_rides_you_choose_minion', targetType: 'minion', titleKey: 'ui.bear_cavalry_bear_rides_you_choose_minion_title' }
        );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}


/** 与熊同行 POD onPlay：移动随从并压制能力 */
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
        { sourceId: 'bear_cavalry_bear_rides_you_pod_choose_minion', targetType: 'minion', titleKey: 'ui.bear_cavalry_bear_rides_you_pod_choose_minion_title' }
    );
    (interaction.data as any).sourceCardUid = ctx.cardUid;
    (interaction.data as any).sourceDefId = ctx.defId;
    (interaction.data as any).sourceBaseIndex = ctx.baseIndex;
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

type BearRidesYouPodSuppressTarget =
    | { kind: 'skip' }
    | { kind: 'base'; baseIndex: number; baseDefId?: string }
    | { kind: 'minion'; baseIndex: number; minionUid: string; minionDefId: string }
    | { kind: 'ongoing'; baseIndex: number; cardUid: string; defId?: string }
    | { kind: 'attached'; baseIndex: number; cardUid: string; defId?: string }
    | { kind: 'titan'; baseIndex: number; titanUid: string; defId?: string; ownerId?: string };

/** 你们都是美食 onPlay：选择有己方随从的基地，再选择目标基地，移动所有对手随从 */
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
        { sourceId: 'bear_cavalry_borscht_choose_from', targetType: 'base', autoCancelOption: true, titleKey: 'ui.bear_cavalry_borscht_choose_from_title' }
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
    const actionTargets: { uid: string; defId: string; ownerId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        const baseDef = getBaseDef(base.defId);
        const baseName = baseDef?.name ?? `基地 ${i + 1}`;
        for (const o of base.ongoingActions) {
            const ongoingControllerId = o.metadata?.sourceControllerId ?? o.ownerId;
            if (ongoingControllerId !== ctx.playerId) {
                const def = getCardDef(o.defId);
                const name = def?.name ?? o.defId;
                actionTargets.push({ uid: o.uid, defId: o.defId, ownerId: o.ownerId, baseIndex: i, label: `[行动] ${name} @ ${baseName}` });
            }
        }
    }
    const allTargets = [...minionTargets, ...actionTargets];
    if (allTargets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    if (!ctx.matchState) return { events: [] };

    const result = executeAbilityProgram(
        bearCavalryBearNecessitiesPromptProgram,
        createBearCavalryPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            baseIndex: ctx.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}


/** 黑熊口粮 POD 天赋：压制其他玩家打额外牌 */
function bearCavalryBearNecessitiesPodTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    
    // 天赋能力不需要生成额外事件，reducer 会自动生成 TALENT_USED 事件并设置 talentUsed 标志
    // 压制效果通过 commands.ts 中的验证逻辑实现（检查 ongoing.talentUsed 标志）
    return { events: [] };
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
        const ctx = (iData as any)?.continuationContext as {
            opponents: string[];
            opponentIdx: number;
            destroyerId?: PlayerId;
            sourceCardUid?: string;
            sourceDefId?: string;
            sourceBaseIndex?: number;
        } | undefined;
        const destroyerId = ctx?.destroyerId ?? playerId;
        const events: SmashUpEvent[] = buildValidatedDestroyEvents(state, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: baseIndex,
            destroyerId,
            sourcePlayerId: destroyerId,
            sourceCardUid: ctx?.sourceCardUid,
            sourceDefId: ctx?.sourceDefId,
            sourceControllerId: destroyerId,
            sourceBaseIndex: ctx?.sourceBaseIndex,
            sourceKind: 'action',
            reason: 'bear_cavalry_bear_hug',
            now: timestamp,
        });

        // 链式处理下一个对手
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
                    events.push(...buildValidatedDestroyEvents(state, {
                        minionUid: weakest[0].uid,
                        minionDefId: weakest[0].defId,
                        fromBaseIndex: weakest[0].baseIndex,
                        destroyerId,
                        sourcePlayerId: destroyerId,
                        sourceCardUid: ctx?.sourceCardUid,
                        sourceDefId: ctx?.sourceDefId,
                        sourceControllerId: destroyerId,
                        sourceBaseIndex: ctx?.sourceBaseIndex,
                        sourceKind: 'action',
                        reason: 'bear_cavalry_bear_hug',
                        now: timestamp,
                    }));
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
                '\u9ed1\u718a\u64d2\u62b1\uff1a\u9009\u62e9\u8981\u6d88\u706d\u7684\u6700\u5f31\u968f\u4ece',
                buildMinionTargetOptions(options, {
                    state: state.core,
                    sourcePlayerId: destroyerId,
                    sourceDefId: ctx?.sourceDefId,
                    sourceKind: 'action',
                    effectType: 'destroy',
                    respectActionProtection: true,
                }),
                { sourceId: 'bear_cavalry_bear_hug', targetType: 'minion', titleKey: 'ui.bear_cavalry_bear_hug_title' }
            );
            (interaction.data as any).continuationContext = {
                opponents: ctx.opponents,
                opponentIdx: i,
                destroyerId,
                sourceCardUid: ctx?.sourceCardUid,
                sourceDefId: ctx?.sourceDefId,
                sourceBaseIndex: ctx?.sourceBaseIndex,
            };
            return { state: queueInteraction(state, interaction), events };
        }

        return { state, events };
    });

    // 委任第一步：选择手牌随从后→选择目标基地
    registerInteractionHandler('bear_cavalry_commission_choose_minion', (state, playerId, value, iData, _random, timestamp) => {
        const { cardUid, defId, ownerId, power } = value as { cardUid: string; defId: string; ownerId?: string; power: number };
        const isPod = (iData as any)?.isPod === true;
        const sourceCardUid = (iData as any)?.sourceCardUid as string | undefined;
        const sourceDefId = (iData as any)?.sourceDefId as string | undefined;
        const sourceBaseIndex = (iData as any)?.sourceBaseIndex as number | undefined;
        const baseCandidates = state.core.bases.map((b, i) => {
            const baseDef = getBaseDef(b.defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        const next = createSimpleChoice(
            `bear_cavalry_commission_choose_base_${timestamp}`,
            playerId,
            '委任：选择打出随从的基地',
            buildBaseTargetOptions(baseCandidates, state.core),
            {
                sourceId: 'bear_cavalry_commission_choose_base',
                targetType: 'base',
                titleKey: 'ui.bear_cavalry_commission_choose_base_title',
                autoResolveIfSingle: false,
            }
        );
        return {
            state: queueInteraction(state, {
                ...next,
                data: { ...next.data, continuationContext: { cardUid, defId, ownerId, power }, isPod, sourceCardUid, sourceDefId, sourceBaseIndex },
            }),
            events: [],
        };
    });

    // 委任第二步：选择基地后打出随从并进入移动步骤
    registerInteractionHandler('bear_cavalry_commission_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; defId: string; ownerId?: string; power: number };
        const isPod = (iData as any)?.isPod === true;
        const sourceCardUid = (iData as any)?.sourceCardUid as string | undefined;
        const sourceDefId = (iData as any)?.sourceDefId as string | undefined;
        const sourceBaseIndex = (iData as any)?.sourceBaseIndex as number | undefined;
        if (!ctx) return undefined;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid: ctx.cardUid, defId: ctx.defId, ownerId: ctx.ownerId, baseIndex, baseDefId: state.core.bases[baseIndex].defId, power: ctx.power },
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
            moveOptions.unshift(createSkipOption('跳过（不移动）', 'ui.bear_cavalry_skip_move_option'));
        }
        const next = createSimpleChoice(
            `bear_cavalry_commission_move_minion_${timestamp}`, playerId,
            '委任：选择要移动的对手随从', moveOptions,
            {
                sourceId: 'bear_cavalry_commission_move_minion',
                targetType: 'minion',
                titleKey: 'ui.bear_cavalry_commission_move_minion_title',
                autoResolveIfSingle: false,
            },
        );
        return {
            state: queueInteraction(state, {
                ...next,
                data: { ...next.data, continuationContext: { fromBaseIndex: baseIndex }, isPod, sourceCardUid, sourceDefId, sourceBaseIndex },
            }),
            events: [playedEvt],
        };
    });

    // 委任第三步：选择对手随从后→选择目标基地
    registerInteractionHandler('bear_cavalry_commission_move_minion', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex: fromBase, skip } = value as { minionUid?: string; baseIndex?: number; skip?: boolean };
        const isPod = (iData as any)?.isPod === true;
        const sourceCardUid = (iData as any)?.sourceCardUid as string | undefined;
        const sourceDefId = (iData as any)?.sourceDefId as string | undefined;
        const sourceBaseIndex = (iData as any)?.sourceBaseIndex as number | undefined;
        if (skip) return { state, events: [] };
        if (!minionUid || fromBase === undefined) return undefined;
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
            `bear_cavalry_commission_move_dest_${timestamp}`,
            playerId,
            '委任：选择移动到的基地',
            buildBaseTargetOptions(options, state.core),
            {
                sourceId: 'bear_cavalry_commission_move_dest',
                targetType: 'base',
                titleKey: 'ui.bear_cavalry_commission_move_dest_title',
                autoResolveIfSingle: false,
            },
        );
        return {
            state: queueInteraction(state, {
                ...next,
                data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase }, isPod, sourceCardUid, sourceDefId, sourceBaseIndex },
            }),
            events: [],
        };
    });

    // 委任第四步：选择目标基地后移动
    registerInteractionHandler('bear_cavalry_commission_move_dest', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number };
        const sourceCardUid = (iData as any)?.sourceCardUid as string | undefined;
        const sourceDefId = (iData as any)?.sourceDefId as string | undefined;
        const sourceBaseIndex = (iData as any)?.sourceBaseIndex as number | undefined;
        if (!ctx) return undefined;
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: ctx.minionUid,
                minionDefId: ctx.minionDefId,
                fromBaseIndex: ctx.fromBase,
                toBaseIndex: toBase,
                sourcePlayerId: playerId,
                sourceCardUid,
                sourceDefId,
                sourceControllerId: playerId,
                sourceBaseIndex,
                sourceKind: 'action',
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
            `bear_cavalry_bear_cavalry_choose_base_${timestamp}`,
            playerId,
            '选择要移动到的基地',
            buildBaseTargetOptions(options, state.core),
            { sourceId: 'bear_cavalry_bear_cavalry_choose_base', targetType: 'base', titleKey: 'ui.bear_cavalry_choose_destination_base_title' }
        );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase } } }), events: [] };
    });

    // 黑熊骑兵第二步：选择基地后移动
    registerInteractionHandler('bear_cavalry_bear_cavalry_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number };
        const sourceCardUid = (iData as any)?.sourceCardUid as string | undefined;
        const sourceDefId = (iData as any)?.sourceDefId as string | undefined;
        const sourceBaseIndex = (iData as any)?.sourceBaseIndex as number | undefined;
        if (!ctx) return undefined;
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: ctx.minionUid,
                minionDefId: ctx.minionDefId,
                fromBaseIndex: ctx.fromBase,
                toBaseIndex: toBase,
                sourcePlayerId: playerId,
                sourceCardUid,
                sourceDefId,
                sourceControllerId: playerId,
                sourceBaseIndex,
                sourceKind: 'nonAction',
                reason: 'bear_cavalry_bear_cavalry',
                now: timestamp,
            }),
        };
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
            { sourceId: 'bear_cavalry_youre_screwed_choose_minion', targetType: 'minion', titleKey: 'ui.bear_cavalry_choose_enemy_minion_title' },
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
            `bear_cavalry_youre_screwed_choose_dest_${timestamp}`, playerId, '选择目标基地', buildBaseTargetOptions(options, state.core), { sourceId: 'bear_cavalry_youre_screwed_choose_dest', targetType: 'base', titleKey: 'ui.bear_cavalry_choose_target_base_title' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase } } }), events: [] };
    });

    registerInteractionHandler('bear_cavalry_youre_screwed_choose_dest', (state, playerId, value, iData, _random, timestamp) => {
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
                sourcePlayerId: playerId,
                sourceDefId: 'bear_cavalry_youre_screwed',
                sourceControllerId: playerId,
                sourceBaseIndex: ctx.fromBase,
                sourceKind: 'action',
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
            `bear_cavalry_bear_rides_you_choose_base_${timestamp}`, playerId, '选择目标基地', buildBaseTargetOptions(options, state.core), { sourceId: 'bear_cavalry_bear_rides_you_choose_base', targetType: 'base', titleKey: 'ui.bear_cavalry_choose_target_base_title' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase } } }), events: [] };
    });

    registerInteractionHandler('bear_cavalry_bear_rides_you_choose_base', (state, playerId, value, iData, _random, timestamp) => {
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
                sourcePlayerId: playerId,
                sourceDefId: 'bear_cavalry_bear_rides_you',
                sourceControllerId: playerId,
                sourceBaseIndex: ctx.fromBase,
                sourceKind: 'action',
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
        const movable = partitionMinionTargetsBySemantics(
            state.core,
            opponentMinions.map(minion => ({ minion, baseIndex: fromBase })),
            {
                sourcePlayerId: playerId,
                sourceKind: 'action',
                effectType: 'move',
                respectActionProtection: true,
                mode: 'preview',
            },
        ).allowed;
        if (movable.length === 0) {
            return {
                state,
                events: opponentMinions.length > 0
                    ? [buildAbilityFeedback(playerId, 'feedback.all_protected', timestamp, undefined, 'warning')]
                    : [],
            };
        }
        const destBases: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            if (i === fromBase) continue;
            const baseDef = getBaseDef(state.core.bases[i].defId);
            destBases.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        if (destBases.length === 0) return { state, events: [] };
        const next = createSimpleChoice(
            `bear_cavalry_borscht_choose_dest_${timestamp}`,
            playerId,
            '选择目标基地（移动对手随从到此处）',
            buildBaseTargetOptions(destBases, state.core),
            { sourceId: 'bear_cavalry_borscht_choose_dest', targetType: 'base', titleKey: 'ui.bear_cavalry_borscht_choose_dest_title' }
        );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { fromBase } } }), events: [] };
    });

    registerInteractionHandler('bear_cavalry_borscht_choose_dest', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: destBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { fromBase: number };
        if (!ctx) return undefined;
        // 移动所有对手随从（保护检查自动应用）
        const opponentMinions = state.core.bases[ctx.fromBase].minions.filter(m => m.controller !== playerId);
        return {
            state,
            events: applySemanticMinionEffectBatch(
                state,
                opponentMinions.map(minion => ({ minion, baseIndex: ctx.fromBase })),
                {
                    sourcePlayerId: playerId,
                    sourceKind: 'action',
                    effectType: 'move',
                    respectActionProtection: true,
                    mode: 'apply',
                    feedbackPlayerId: playerId,
                    now: timestamp,
                    buildEvents: ({ minion }) => buildValidatedMoveEvents(state, {
                        minionUid: minion.uid,
                        minionDefId: minion.defId,
                        fromBaseIndex: ctx.fromBase,
                        toBaseIndex: destBase,
                        sourcePlayerId: playerId,
                        sourceDefId: 'bear_cavalry_youre_pretty_much_borscht',
                        sourceControllerId: playerId,
                        sourceBaseIndex: ctx.fromBase,
                        sourceKind: 'action',
                        reason: 'bear_cavalry_youre_pretty_much_borscht',
                        now: timestamp,
                    }),
                },
            ).events,
        };
    });

    // === POD 版本交互处理 ===
    // 幼熊斥候 POD：消灭对手随从后，可选择移动己方小随从到本基地
    registerInteractionHandler('bear_cavalry_cub_scout_pod_destroy', (state, playerId, value, iData, _random, timestamp) => {
        const events: SmashUpEvent[] = [];
        
        // 处理跳过
        if ((value as any) === 'no') {
            return { state, events };
        }
        
        // 获取交互数据（直接从 iData 读取，不走 iData.data）
        const { minionUid, minionDefId, baseIndex, ownerId, scoutUid, scoutBaseIndex } = (iData ?? {}) as any;
        
        // 1. 消灭对手随从
        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid,
            minionDefId,
            fromBaseIndex: baseIndex,
            destroyerId: playerId,
            sourcePlayerId: playerId,
            sourceCardUid: scoutUid,
            sourceDefId: 'bear_cavalry_cub_scout_pod',
            sourceControllerId: playerId,
            sourceBaseIndex: scoutBaseIndex,
            sourceKind: 'nonAction',
            reason: 'bear_cavalry_cub_scout_pod',
            now: timestamp,
        });
        events.push(...destroyEvents);
        if (!destroyEvents.some(event => event.type === SU_EVENTS.MINION_DESTROYED)) {
            return { state, events };
        }
        
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
                { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: 'skip' as any, displayMode: 'button' as const }
            ],
            { sourceId: 'bear_cavalry_cub_scout_pod_chain_move', targetType: 'minion', titleKey: 'ui.bear_cavalry_cub_scout_pod_chain_move_title' }
        );
        (interaction.data as any).scoutBaseIndex = scoutBaseIndex;
        (interaction.data as any).scoutUid = scoutUid;
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
        const { scoutBaseIndex, scoutUid } = (iData ?? {}) as any;
        
        // 移动随从
        events.push(...buildValidatedMoveEvents(state, {
            minionUid,
            minionDefId: defId,
            fromBaseIndex,
            toBaseIndex: scoutBaseIndex,
            sourcePlayerId: playerId,
            sourceCardUid: scoutUid,
            sourceDefId: 'bear_cavalry_cub_scout_pod',
            sourceControllerId: playerId,
            sourceBaseIndex: scoutBaseIndex,
            sourceKind: 'nonAction',
            reason: 'bear_cavalry_cub_scout_pod',
            now: timestamp,
        }));
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
            { sourceId: 'bear_cavalry_bear_cavalry_pod_choose_base', targetType: 'base', titleKey: 'ui.bear_cavalry_choose_destination_base_title' }
        );
        return {
            state: queueInteraction(state, {
                ...next,
                data: {
                    ...next.data,
                    continuationContext: { minionUid, minionDefId: target.defId, fromBase },
                    sourceCardUid: (iData as any)?.sourceCardUid,
                    sourceDefId: (iData as any)?.sourceDefId,
                    sourceBaseIndex: (iData as any)?.sourceBaseIndex,
                },
            }),
            events: [],
        };
    });
    
    registerInteractionHandler('bear_cavalry_bear_cavalry_pod_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number };
        const sourceCardUid = (iData as any)?.sourceCardUid as string | undefined;
        const sourceDefId = (iData as any)?.sourceDefId as string | undefined;
        const sourceBaseIndex = (iData as any)?.sourceBaseIndex as number | undefined;
        if (!ctx) return undefined;
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: ctx.minionUid,
                minionDefId: ctx.minionDefId,
                fromBaseIndex: ctx.fromBase,
                toBaseIndex: toBase,
                sourcePlayerId: playerId,
                sourceCardUid,
                sourceDefId,
                sourceControllerId: playerId,
                sourceBaseIndex,
                sourceKind: 'nonAction',
                reason: 'bear_cavalry_bear_cavalry_pod',
                now: timestamp,
            }),
        };
    });
    
    // 与熊同行 POD：选择随从后选择目标基地
    registerInteractionHandler('bear_cavalry_bear_rides_you_pod_choose_minion', (state, playerId, value, iData, _random, timestamp) => {
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
            { sourceId: 'bear_cavalry_bear_rides_you_pod_choose_base', targetType: 'base', titleKey: 'ui.bear_cavalry_choose_target_base_title' }
        );
        return {
            state: queueInteraction(state, {
                ...next,
                data: {
                    ...next.data,
                    continuationContext: { minionUid, minionDefId: target.defId, fromBase, isMyMinion: target.controller === playerId },
                    sourceCardUid: (iData as any)?.sourceCardUid,
                    sourceDefId: (iData as any)?.sourceDefId,
                    sourceBaseIndex: (iData as any)?.sourceBaseIndex,
                },
            }),
            events: [],
        };
    });
    
    registerInteractionHandler('bear_cavalry_bear_rides_you_pod_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number; isMyMinion: boolean };
        const sourceCardUid = (iData as any)?.sourceCardUid as string | undefined;
        const sourceDefId = (iData as any)?.sourceDefId as string | undefined;
        const sourceBaseIndex = (iData as any)?.sourceBaseIndex as number | undefined;
        if (!ctx) return undefined;

        const events = buildValidatedMoveEvents(state, {
            minionUid: ctx.minionUid,
            minionDefId: ctx.minionDefId,
            fromBaseIndex: ctx.fromBase,
            toBaseIndex: toBase,
            sourcePlayerId: playerId,
            sourceCardUid,
            sourceDefId,
            sourceControllerId: playerId,
            sourceBaseIndex,
            sourceKind: 'action',
            reason: 'bear_cavalry_bear_rides_you_pod',
            now: timestamp,
        });
        if (!events.some(event => event.type === SU_EVENTS.MINION_MOVED)) {
            return { state, events };
        }

        // 如果移动的是己方随从：可选择压制新基地上一张卡牌能力（含基地本身）
        if (!ctx.isMyMinion) return { state, events };

        const base = state.core.bases[toBase];
        if (!base) return { state, events };

        const suppressOptions: Array<{ id: string; label: string; value: BearRidesYouPodSuppressTarget; displayMode?: 'card' | 'button' }> = [];
        const baseDef = getBaseDef(base.defId);
        suppressOptions.push({
            id: 'base',
            label: `[基地] ${baseDef?.name ?? base.defId}`,
            value: { kind: 'base', baseIndex: toBase, baseDefId: base.defId },
            displayMode: 'card',
        });

        // 交互创建时 moveMinion 事件尚未 reduce，因此这里要把“即将移动过来的随从”也纳入候选项。
        const movedMinion = state.core.bases[ctx.fromBase]?.minions.find(m => m.uid === ctx.minionUid);
        const minionsOnNewBase = movedMinion && !base.minions.some(m => m.uid === movedMinion.uid)
            ? [...base.minions, movedMinion]
            : base.minions;

        for (const m of minionsOnNewBase) {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            suppressOptions.push({
                id: `minion-${m.uid}`,
                label: `[随从] ${def?.name ?? m.defId}`,
                value: { kind: 'minion', minionUid: m.uid, minionDefId: m.defId, baseIndex: toBase },
                displayMode: 'card',
            });
            for (const a of m.attachedActions ?? []) {
                const aDef = getCardDef(a.defId);
                suppressOptions.push({
                    id: `attached-${a.uid}`,
                    label: `[附着行动] ${aDef?.name ?? a.defId}`,
                    value: { kind: 'attached', cardUid: a.uid, defId: a.defId, baseIndex: toBase },
                    displayMode: 'card',
                });
            }
        }

        for (const oa of base.ongoingActions) {
            const oDef = getCardDef(oa.defId);
            suppressOptions.push({
                id: `ongoing-${oa.uid}`,
                label: `[持续行动] ${oDef?.name ?? oa.defId}`,
                value: { kind: 'ongoing', cardUid: oa.uid, defId: oa.defId, baseIndex: toBase },
                displayMode: 'card',
            });
        }

        // 泰坦：检查该基地上所有在场泰坦
        for (const titan of getTitansOnBase(state, toBase)) {
            const tDef = getCardDef(titan.defId);
            suppressOptions.push({
                id: `titan-${titan.uid}`,
                label: `[泰坦] ${tDef?.name ?? titan.defId}`,
                value: { kind: 'titan', titanUid: titan.uid, defId: titan.defId, baseIndex: toBase, ownerId: titan.ownerId },
                displayMode: 'card',
            });
        }

        suppressOptions.push({ id: 'skip', label: '跳过（不压制）', labelKey: 'ui.bear_cavalry_bear_rides_you_pod_skip_suppress_option', value: { kind: 'skip' }, displayMode: 'button' });

        const next = createSimpleChoice(
            `bear_cavalry_bear_rides_you_pod_choose_suppress_${timestamp}`,
            playerId,
            '与熊同行：选择要压制能力的卡牌（到你下回合开始）',
            suppressOptions as any[],
            { sourceId: 'bear_cavalry_bear_rides_you_pod_choose_suppress', targetType: 'generic', autoCancelOption: true, titleKey: 'ui.bear_cavalry_bear_rides_you_pod_choose_suppress_title' }
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

        if (chosen.kind === 'minion') {
            return {
                state,
                events: [{
                    type: SU_EVENTS.CARD_SUPPRESSED,
                    payload: {
                        cardUid: chosen.minionUid,
                        baseIndex: chosen.baseIndex,
                        suppressorPlayerId: playerId,
                        cardType: 'minion',
                        reason: 'bear_cavalry_bear_rides_you_pod',
                    },
                    timestamp,
                } as any],
            };
        }

        if (chosen.kind === 'ongoing') {
            return {
                state,
                events: [{
                    type: SU_EVENTS.CARD_SUPPRESSED,
                    payload: {
                        cardUid: chosen.cardUid,
                        baseIndex: chosen.baseIndex,
                        suppressorPlayerId: playerId,
                        cardType: 'ongoing',
                        reason: 'bear_cavalry_bear_rides_you_pod',
                    },
                    timestamp,
                } as any],
            };
        }

        if (chosen.kind === 'attached') {
            return {
                state,
                events: [{
                    type: SU_EVENTS.CARD_SUPPRESSED,
                    payload: {
                        cardUid: chosen.cardUid,
                        baseIndex: chosen.baseIndex,
                        suppressorPlayerId: playerId,
                        cardType: 'attached',
                        reason: 'bear_cavalry_bear_rides_you_pod',
                    },
                    timestamp,
                } as any],
            };
        }

        if (chosen.kind === 'titan') {
            return {
                state,
                events: [{
                    type: SU_EVENTS.CARD_SUPPRESSED,
                    payload: {
                        cardUid: chosen.titanUid,
                        baseIndex: chosen.baseIndex,
                        suppressorPlayerId: playerId,
                        cardType: 'titan',
                        reason: 'bear_cavalry_bear_rides_you_pod',
                    },
                    timestamp,
                } as any],
            };
        }

        return { state, events: [] };
    });
    
}

