/**
 * 大杀四方 - 蒸汽朋克派系能力
 *
 * 主题：战术卡（行动卡）复用、从弃牌堆取回行动卡
 */

import type { MatchState, PlayerId } from '../../../engine/types';
import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext } from '../domain/abilityRegistry';
import { recoverCardsFromDiscard, grantContextualExtraAction, grantExtraAction, resolveExtraPlayTiming, buildAbilityFeedback, buildMinionTargetOptions, buildBaseTargetOptions, buildSemanticOngoingAttachEvents, getMinionPower, buildStandardDrawEvents, buildValidatedMoveEvents, buildValidatedReturnEvents } from '../domain/abilityHelpers';
import { appendResolvedActionAbility, getExternalActionEffectiveHandSize } from '../domain/externalActionPlay';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, SmashUpCore, MinionReturnedEvent, ActionCardDef } from '../domain/types';
import { registerRestriction, registerTrigger, registerInterceptor } from '../domain/ongoingEffects';
import type { RestrictionCheckContext, TriggerContext } from '../domain/ongoingEffects';
import { getCardDef, getBaseDef } from '../data/cards';
import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
} from '../domain/abilityRuntime';
import { validateActionPlaySemantics } from '../domain/playLegality';
import { buildAffectRecords } from '../domain/affect';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import {
    createCardObjectRef,
    createCardObjectRefFromInstance,
    createCardTransferEvent,
} from '../domain/objectProvenance';

type SteampunkPromptContext = {
    matchState: MatchState<SmashUpCore>;
    state: SmashUpCore;
    playerId: PlayerId;
    now: number;
    sourceCardUid?: string;
    sourceDefId?: string;
    currentBaseIndex?: number;
    zepBaseIndex?: number;
    selectedMinionUid?: string;
    selectedMinionDefId?: string;
    fromBaseIndex?: number;
    replayCardUid?: string;
    replayDefId?: string;
    replayOwnerId?: string;
};

function createPromptContext(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra: Omit<SteampunkPromptContext, 'matchState' | 'state' | 'playerId' | 'now'> = {},
): SteampunkPromptContext {
    return {
        matchState,
        state: matchState.core,
        playerId,
        now,
        ...extra,
    };
}

function buildReplayOngoingAttachedEvent(
    state: MatchState<SmashUpCore> | SmashUpCore,
    context: Pick<SteampunkPromptContext, 'replayCardUid' | 'replayDefId' | 'replayOwnerId'>,
    sourcePlayerId: PlayerId,
    target:
        | { targetType: 'base'; targetBaseIndex: number }
        | { targetType: 'minion'; targetBaseIndex: number; targetMinionUid: string },
    timestamp: number,
): SmashUpEvent[] {
    const ownerId = context.replayOwnerId ?? sourcePlayerId;
    return buildSemanticOngoingAttachEvents(state, {
        cardUid: context.replayCardUid,
        defId: context.replayDefId,
        ownerId,
        ...(ownerId !== sourcePlayerId ? { sourcePlayerId } : {}),
        targetBaseIndex: target.targetBaseIndex,
        ...(target.targetType === 'minion' ? { targetMinionUid: target.targetMinionUid } : {}),
        onBlockedSourceDestination: 'discard',
        now: timestamp,
    });
}

function buildDiscardActionOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    excludeCardUid?: string,
): PromptOption<{ cardUid: string; defId: string }>[] {
    return core.players[playerId].discard
        .filter(card => card.type === 'action' && card.uid !== excludeCardUid)
        .map((card, index) => {
            const def = getCardDef(card.defId);
            return {
                id: `card-${index}`,
                label: def?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            };
        });
}

function buildMechanicDiscardOptions(
    core: SmashUpCore,
    playerId: PlayerId,
): PromptOption<{ cardUid: string; defId: string }>[] {
    const player = core.players[playerId];
    return player.discard
        .filter(card => isMechanicReplayableDiscardAction(core, playerId, card.defId, player.hand.length + 1))
        .map((card, index) => ({
            id: `card-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'discard' as const,
            displayMode: 'card' as const,
        }));
}

function buildChangeOfVenueOngoingOptions(
    core: SmashUpCore,
    playerId: PlayerId,
): PromptOption<{ cardUid: string; defId: string; ownerId: string }>[] {
    const options: PromptOption<{ cardUid: string; defId: string; ownerId: string }>[] = [];
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        const base = core.bases[baseIndex];
        for (const ongoing of base.ongoingActions) {
            const ongoingControllerId = ongoing.metadata?.sourceControllerId ?? ongoing.ownerId;
            if (ongoingControllerId !== playerId) continue;
            options.push({
                id: `ongoing-${options.length}`,
                label: getCardDef(ongoing.defId)?.name ?? ongoing.defId,
                value: { cardUid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId },
                _source: 'ongoing' as const,
                displayMode: 'card' as const,
            });
        }
        for (const minion of base.minions) {
            for (const attached of minion.attachedActions) {
                const attachedControllerId = attached.metadata?.sourceControllerId ?? attached.ownerId;
                if (attachedControllerId !== playerId) continue;
                options.push({
                    id: `ongoing-${options.length}`,
                    label: getCardDef(attached.defId)?.name ?? attached.defId,
                    value: { cardUid: attached.uid, defId: attached.defId, ownerId: attached.ownerId },
                    _source: 'ongoing' as const,
                    displayMode: 'card' as const,
                });
            }
        }
    }
    return options;
}

function buildCaptainAhabBaseOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    currentBaseIndex: number,
): PromptOption<{ baseIndex: number; baseDefId: string }>[] {
    const candidates: Array<{ baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        if (baseIndex === currentBaseIndex) continue;
        const base = core.bases[baseIndex];
        if (!base.ongoingActions.some(ongoing => (ongoing.metadata?.sourceControllerId ?? ongoing.ownerId) === playerId)) continue;
        candidates.push({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        });
    }
    return buildBaseTargetOptions(candidates, core).map(option => ({ ...option, displayMode: 'card' as const }));
}

function buildZeppelinMinionOptions(
    core: SmashUpCore,
    playerId: PlayerId,
): PromptOption<{ minionUid: string; baseIndex: number; defId: string }>[] {
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        const base = core.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            if (minion.controller !== playerId) continue;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} (力量 ${getMinionPower(core, minion, baseIndex)}) @ ${baseName}`,
            });
        }
    }
    return buildMinionTargetOptions(candidates, { state: core, sourcePlayerId: playerId });
}

function buildZeppelinBaseOptions(
    core: SmashUpCore,
    zepBaseIndex: number,
    fromBaseIndex: number,
): PromptOption<{ baseIndex: number; baseDefId: string }>[] {
    const allowedBaseIndices = fromBaseIndex === zepBaseIndex
        ? core.bases.map((_, index) => index).filter(index => index !== fromBaseIndex)
        : [zepBaseIndex];
    const candidates = allowedBaseIndices.map(baseIndex => {
        const baseDef = getBaseDef(core.bases[baseIndex].defId);
        const name = baseDef?.name ?? `基地 ${baseIndex + 1}`;
        const suffix = baseIndex === zepBaseIndex ? ' (齐柏林所在基地)' : '';
        return { baseIndex, label: `${name}${suffix}` };
    });
    return buildBaseTargetOptions(candidates, core).map(option => ({ ...option, displayMode: 'card' as const }));
}

function buildMechanicBaseOptions(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    defId: string,
): PromptOption<{ baseIndex: number; baseDefId: string }>[] {
    return matchState.core.bases
        .map((base, baseIndex) => ({ base, baseIndex }))
        .filter(({ baseIndex }) => validateActionPlaySemantics(matchState.core, playerId, {
            defId,
            targetBaseIndex: baseIndex,
            effectiveHandSize: getExternalActionEffectiveHandSize(matchState, playerId, true),
        }).valid)
        .map(({ base, baseIndex }) => ({
            id: `base-${baseIndex}`,
            label: getBaseDef(base.defId)?.name ?? base.defId,
            value: { baseIndex, baseDefId: base.defId },
            _source: 'base' as const,
            displayMode: 'card' as const,
        }));
}

function buildChangeOfVenueMinionOptions(
    core: SmashUpCore,
    playerId: PlayerId,
): PromptOption<{ baseIndex: number; minionUid: string; minionDefId: string }>[] {
    const options: PromptOption<{ baseIndex: number; minionUid: string; minionDefId: string }>[] = [];
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        for (const minion of core.bases[baseIndex].minions) {
            if (minion.controller !== playerId) continue;
            options.push({
                id: minion.uid,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
                value: { baseIndex, minionUid: minion.uid, minionDefId: minion.defId },
                _source: 'field' as const,
                displayMode: 'card' as const,
            });
        }
    }
    return options;
}

function buildChangeOfVenueBaseOptions(
    core: SmashUpCore,
): PromptOption<{ baseIndex: number; baseDefId: string }>[] {
    return core.bases.map((base, baseIndex) => ({
        id: `base-${baseIndex}`,
        label: getBaseDef(base.defId)?.name ?? base.defId,
        value: { baseIndex, baseDefId: base.defId },
        _source: 'base' as const,
        displayMode: 'card' as const,
    }));
}

function findMinionBaseIndexByUid(core: SmashUpCore, cardUid: string): number {
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        if (core.bases[baseIndex].minions.some(minion => minion.uid === cardUid)) {
            return baseIndex;
        }
    }
    return -1;
}

function findOngoingBaseIndexByUid(core: SmashUpCore, cardUid: string): number {
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        if (core.bases[baseIndex].ongoingActions.some(ongoing => ongoing.uid === cardUid)) {
            return baseIndex;
        }
        if (core.bases[baseIndex].minions.some(minion => minion.attachedActions.some(action => action.uid === cardUid))) {
            return baseIndex;
        }
    }
    return -1;
}

// steampunk_steam_man (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（按行动卡数+力量的
// steampunk_aggromotive (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（有随从?5?
// steampunk_rotary_slug_thrower (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（己方随从2?

// ============================================================================
// ongoing 效果检查器
// ============================================================================

/**
 * steam_queen 拦截器：己方 ongoing 行动卡不受对手卡牌影响
 *
 * 规则：当 steam_queen 在场时，拥有者的行动卡不能被对手的卡牌影响
 */
export function steampunkSteamQueenInterceptor(state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | SmashUpEvent[] | null | undefined {
    const affectRecords = buildAffectRecords(state, event);
    if (affectRecords.length === 0) return undefined;

    for (const record of affectRecords) {
        if (record.targetKind !== 'ongoing' && record.targetKind !== 'attached_action') continue;
        if (!record.sourcePlayerId) continue;
        if (record.reason?.includes('self_destruct') || record.reason?.includes('expired')) continue;

        const actionControllerId = findInPlayActionController(state, record.targetUid);
        if (!actionControllerId) continue;
        if (record.sourcePlayerId === actionControllerId) continue;

        const hasSteamQueen = state.bases.some(base =>
            base.minions.some(minion => minion.defId.startsWith('steampunk_steam_queen') && minion.controller === actionControllerId),
        );
        if (hasSteamQueen) return null;
    }

    return undefined;
}

function findInPlayActionController(state: SmashUpCore, cardUid: string): string | undefined {
    for (const base of state.bases) {
        const ongoing = base.ongoingActions.find(action => action.uid === cardUid);
        if (ongoing) return (ongoing.metadata?.sourceControllerId as PlayerId | undefined) ?? ongoing.ownerId;

        for (const minion of base.minions) {
            const attached = minion.attachedActions.find(action => action.uid === cardUid);
            if (attached) return (attached.metadata?.sourceControllerId as PlayerId | undefined) ?? attached.ownerId;
        }
    }
    return undefined;
}

/**
 * ornate_dome 限制检查：禁止对手打行动卡到此基地
 */
export function steampunkOrnateDomeChecker(ctx: RestrictionCheckContext): boolean {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return false;
    return base.ongoingActions
        .filter(ongoing => ongoing.defId.startsWith('steampunk_ornate_dome'))
        .some(dome => {
            const domeControllerId = dome.metadata?.sourceControllerId ?? dome.ownerId;
            return ctx.playerId !== domeControllerId;
        });
}

/**
 * ornate_dome onPlay：摧毁所有其他玩家打到这里的战术
 * 描述："打出到基地上。摧毁所有其他玩家打到这里的战术。"
 */
export function steampunkOrnateDomeOnPlay(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events };

    // 摧毁基地上所有非己方的 ongoing 行动卡
    for (const ongoing of base.ongoingActions) {
        const ongoingControllerId = ongoing.metadata?.sourceControllerId ?? ongoing.ownerId;
        if (ongoingControllerId === ctx.playerId) continue;
        // 排除 ornate_dome 自身（使用 uid 排除更安全，同时支持 POD 版）
        if (ongoing.uid === ctx.cardUid) continue;
        events.push(...buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: ongoing.uid,
            defId: ongoing.defId,
            ownerId: ongoing.ownerId,
            reason: 'steampunk_ornate_dome_destroy',
            now: ctx.now,
            expectedLocation: 'base',
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        }));
    }

    // 摧毁基地上随从附着的非己方行动卡
    for (const m of base.minions) {
        for (const a of m.attachedActions) {
            const attachedControllerId = a.metadata?.sourceControllerId ?? a.ownerId;
            if (attachedControllerId === ctx.playerId) continue;
            events.push(...buildValidatedOngoingDetachEvents(ctx.state, {
                cardUid: a.uid,
                defId: a.defId,
                ownerId: a.ownerId,
                reason: 'steampunk_ornate_dome_destroy',
                now: ctx.now,
                expectedLocation: 'minion',
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            }));
        }
    }

    return { events };
}

/**
 * difference_engine 触发：回合结束时控制者多??
 */
/**
 * difference_engine 触发：回合结束时，如果拥有者在此基地有随从，多抽一张牌
 */
export function steampunkDifferenceEngineTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceCardUid) {
        for (let i = 0; i < ctx.state.bases.length; i++) {
            const ongoing = ctx.state.bases[i].ongoingActions.find(action =>
                action.uid === ctx.sourceCardUid && action.defId.startsWith('steampunk_difference_engine'),
            );
            if (!ongoing) continue;
            const controllerId = ctx.sourceControllerId ?? ongoing.ownerId;
            if (controllerId !== ctx.playerId) return [];
            const hasMinion = ctx.state.bases[i].minions.some(m => m.controller === controllerId);
            if (!hasMinion) return [];
            const player = ctx.state.players[controllerId];
            if (!player || player.deck.length === 0) return [];
            const drawnUid = player.deck[0].uid;
            return [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: controllerId, count: 1, cardUids: [drawnUid] },
                timestamp: ctx.now,
            } as CardsDrawnEvent];
        }
        return [];
    }

    // difference_engine 是 ongoing action，在 base.ongoingActions 中查找
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const ongoing of base.ongoingActions) {
            if (!ongoing.defId.startsWith('steampunk_difference_engine')) continue;
            const controllerId = ctx.sourceControllerId ?? ongoing.ownerId;
            if (controllerId !== ctx.playerId) continue;
            // 检查控制者在此基地是否有随从
            const hasMinion = base.minions.some(m => m.controller === controllerId);
            if (!hasMinion) continue;
            const events = buildStandardDrawEvents(ctx.state, controllerId, 1, ctx.random, ctx.now);
            if (events.length > 0) return events;
        }
    }
    return [];
}


/**
 * escape_hatch 触发：己方随从被消灭时回手牌（而非进弃牌堆?
 * 
 * 规则：当 escape_hatch 附着在基地上时，该基地上拥有者的随从被消灭时回手牌
 */
export function steampunkEscapeHatchTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.triggerMinionUid) return [];
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return [];

    const hatch = ctx.sourceCardUid
        ? base.ongoingActions.find(o =>
            o.uid === ctx.sourceCardUid && o.defId.startsWith('steampunk_escape_hatch'))
        : base.ongoingActions.find(o => o.defId.startsWith('steampunk_escape_hatch'));
    if (!hatch) return [];

    // 找被消灭的随从
    const minion = base.minions.find(m => m.uid === ctx.triggerMinionUid);
    if (!minion) return [];
    // borrowed ongoing 的保护归当前控制者，不归真实 owner。
    const hatchControllerId = (hatch.metadata?.sourceControllerId as PlayerId | undefined) ?? hatch.ownerId;
    if (minion.controller !== hatchControllerId) return [];

    return buildValidatedReturnEvents(ctx.state, {
        minionUid: minion.uid,
        minionDefId: minion.defId,
        fromBaseIndex: ctx.baseIndex,
        toPlayerId: minion.owner,
        sourcePlayerId: hatchControllerId,
        reason: 'steampunk_escape_hatch',
        now: ctx.now,
    });
}

// ============================================================================
// 新增能力实现
// ============================================================================

const steampunkScrapDivingPromptProgram = createPromptProgram<SteampunkPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'steampunk_scrap_diving',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `steampunk_scrap_diving_${context.now}`,
            context.playerId,
            '选择要从弃牌堆取回的行动卡',
            buildDiscardActionOptions(context.state, context.playerId, context.sourceCardUid),
            {
                sourceId: 'steampunk_scrap_diving',
                titleKey: 'ui.steampunk_scrap_diving_title',
                targetType: 'generic',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = state =>
            buildDiscardActionOptions(state.core as SmashUpCore, context.playerId, context.sourceCardUid);
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as Partial<{ cardUid: string; defId: string }> | undefined;
        if (!selected?.cardUid) return { events: [] };
        const liveCard = state.core.players[playerId]?.discard.find(
            card => card.uid === selected.cardUid && card.type === 'action' && card.uid !== context.sourceCardUid,
        );
        if (!liveCard) return { events: [] };
        return {
            events: [recoverCardsFromDiscard(playerId, [liveCard.uid], 'steampunk_scrap_diving', timestamp)],
        };
    },
});

const steampunkScrapDivingProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    if (buildDiscardActionOptions(ctx.state, ctx.playerId, ctx.cardUid).length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    }
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
        }),
        nextProgram: steampunkScrapDivingPromptProgram,
    };
});

const steampunkCaptainAhabPromptProgram = createPromptProgram<SteampunkPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'steampunk_captain_ahab',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `steampunk_captain_ahab_${context.now}`,
        context.playerId,
        '选择要移动到的基地',
        buildCaptainAhabBaseOptions(context.state, context.playerId, context.currentBaseIndex ?? -1),
        {
            sourceId: 'steampunk_captain_ahab',
            titleKey: 'ui.steampunk_captain_ahab_title',
            targetType: 'base',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as Partial<{ baseIndex: number }> | undefined;
        if (typeof selected?.baseIndex !== 'number' || !context.sourceCardUid || !context.sourceDefId) {
            return { events: [] };
        }
        const currentBaseIndex = findMinionBaseIndexByUid(state.core, context.sourceCardUid);
        if (currentBaseIndex === -1) return { events: [] };
        const isStillValid = buildCaptainAhabBaseOptions(state.core, context.playerId, currentBaseIndex)
            .some(option => option.value.baseIndex === selected.baseIndex);
        if (!isStillValid) return { events: [] };
        return {
            events: buildValidatedMoveEvents(state, {
                minionUid: context.sourceCardUid,
                minionDefId: context.sourceDefId,
                fromBaseIndex: currentBaseIndex,
                toBaseIndex: selected.baseIndex,
                reason: 'steampunk_captain_ahab',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: context.sourceDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: currentBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    },
});

const steampunkCaptainAhabProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const currentBaseIndex = findMinionBaseIndexByUid(ctx.state, ctx.cardUid);
    if (currentBaseIndex === -1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const options = buildCaptainAhabBaseOptions(ctx.state, ctx.playerId, currentBaseIndex);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (options.length === 1) {
        return {
            events: buildValidatedMoveEvents(ctx.state, {
                minionUid: ctx.cardUid,
                minionDefId: ctx.defId,
                fromBaseIndex: currentBaseIndex,
                toBaseIndex: options[0].value.baseIndex,
                reason: 'steampunk_captain_ahab',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: currentBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    }
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            currentBaseIndex,
        }),
        nextProgram: steampunkCaptainAhabPromptProgram,
    };
});

const steampunkZeppelinChooseBasePromptProgram = createPromptProgram<SteampunkPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'steampunk_zeppelin_choose_base',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `steampunk_zeppelin_base_${context.now}`,
            context.playerId,
            '齐柏林飞艇：点击目标基地',
            buildZeppelinBaseOptions(context.state, context.zepBaseIndex ?? -1, context.fromBaseIndex ?? -1),
            {
                sourceId: 'steampunk_zeppelin_choose_base',
                titleKey: 'ui.steampunk_zeppelin_choose_base_title',
                targetType: 'base',
                autoResolveIfSingle: false,
            },
        );
        interaction.data.optionsGenerator = state =>
            buildZeppelinBaseOptions(state.core as SmashUpCore, context.zepBaseIndex ?? -1, context.fromBaseIndex ?? -1);
        return interaction;
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as Partial<{ baseIndex: number }> | undefined;
        if (
            typeof selected?.baseIndex !== 'number'
            || context.fromBaseIndex === undefined
            || !context.sourceCardUid
            || !context.selectedMinionUid
            || !context.selectedMinionDefId
        ) {
            return { events: [] };
        }
        const sourceStillThere = state.core.bases[context.zepBaseIndex ?? -1]?.ongoingActions.some(
            ongoing => ongoing.uid === context.sourceCardUid && ongoing.defId === 'steampunk_zeppelin',
        );
        if (!sourceStillThere) return { events: [] };
        const stillThere = state.core.bases[context.fromBaseIndex]?.minions.some(
            minion => minion.uid === context.selectedMinionUid,
        );
        if (!stillThere) return { events: [] };
        const isStillValid = buildZeppelinBaseOptions(state.core, context.zepBaseIndex ?? -1, context.fromBaseIndex)
            .some(option => option.value.baseIndex === selected.baseIndex);
        if (!isStillValid) return { events: [] };
        return {
            events: buildValidatedMoveEvents(state, {
                minionUid: context.selectedMinionUid,
                minionDefId: context.selectedMinionDefId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                reason: 'steampunk_zeppelin',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: 'steampunk_zeppelin',
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.zepBaseIndex,
                sourceKind: 'action',
            }),
        };
    },
});

const steampunkZeppelinChooseMinionPromptProgram = createPromptProgram<SteampunkPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'steampunk_zeppelin_choose_minion',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `steampunk_zeppelin_minion_${context.now}`,
            context.playerId,
            '齐柏林飞艇：点击要移动的随从',
            buildZeppelinMinionOptions(context.state, context.playerId),
            {
                sourceId: 'steampunk_zeppelin_choose_minion',
                titleKey: 'ui.steampunk_zeppelin_choose_minion_title',
                targetType: 'minion',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = state =>
            buildZeppelinMinionOptions(state.core as SmashUpCore, context.playerId);
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as Partial<{ minionUid: string; baseIndex: number; defId: string }> | undefined;
        if (
            !selected?.minionUid
            || typeof selected.baseIndex !== 'number'
            || context.zepBaseIndex === undefined
        ) {
            return { events: [] };
        }
        const liveOption = buildZeppelinMinionOptions(state.core, playerId)
            .find(option => option.value.minionUid === selected.minionUid && option.value.baseIndex === selected.baseIndex);
        if (!liveOption?.value?.defId) return { events: [] };
        return {
            events: [],
            context: createPromptContext(state, playerId, timestamp, {
                sourceCardUid: context.sourceCardUid,
                zepBaseIndex: context.zepBaseIndex,
                fromBaseIndex: selected.baseIndex,
                selectedMinionUid: selected.minionUid,
                selectedMinionDefId: liveOption.value.defId,
            }),
            nextProgram: steampunkZeppelinChooseBasePromptProgram,
        };
    },
});

const steampunkZeppelinProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const zepBaseIndex = findOngoingBaseIndexByUid(ctx.state, ctx.cardUid);
    if (zepBaseIndex === -1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (buildZeppelinMinionOptions(ctx.state, ctx.playerId).length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            zepBaseIndex,
        }),
        nextProgram: steampunkZeppelinChooseMinionPromptProgram,
    };
});

const steampunkMechanicTargetPromptProgram = createPromptProgram<SteampunkPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'steampunk_mechanic_target',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `steampunk_mechanic_target_${context.now}`,
            context.playerId,
            '选择要将行动卡打出到的基地',
            buildMechanicBaseOptions(context.matchState, context.playerId, context.replayDefId ?? ''),
            {
                sourceId: 'steampunk_mechanic_target',
                titleKey: 'ui.steampunk_mechanic_target_title',
                targetType: 'base',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = state =>
            buildMechanicBaseOptions(state as MatchState<SmashUpCore>, context.playerId, context.replayDefId ?? '');
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const selected = value as Partial<{ baseIndex: number }> | undefined;
        if (
            typeof selected?.baseIndex !== 'number'
            || !context.replayCardUid
            || !context.replayDefId
        ) {
            return { events: [] };
        }
        const inHand = state.core.players[playerId]?.hand.some(card => card.uid === context.replayCardUid) ?? false;
        if (!inHand) return { events: [] };
        const ok = validateActionPlaySemantics(state.core, playerId, {
            defId: context.replayDefId,
            targetBaseIndex: selected.baseIndex,
            effectiveHandSize: getExternalActionEffectiveHandSize(state, playerId, true),
        });
        if (!ok.valid) return { events: [] };
        return appendResolvedActionAbility({
            state,
            playerId,
            cardUid: context.replayCardUid,
            defId: context.replayDefId,
            random,
            timestamp,
            baseIndex: selected.baseIndex,
            events: [
                buildActionPlayedEvent({
                    playerId,
                    cardUid: context.replayCardUid,
                    defId: context.replayDefId,
                    ownerId: context.replayOwnerId,
                    targetBaseIndex: selected.baseIndex,
                    timestamp,
                }),
                ...buildReplayOngoingAttachedEvent(
                    state,
                    context,
                    playerId,
                    { targetType: 'base', targetBaseIndex: selected.baseIndex },
                    timestamp,
                ),
                grantExtraAction(playerId, 'steampunk_mechanic_replay_refund', timestamp, {
                    playTiming: resolveExtraPlayTiming(state),
                }),
            ],
        });
    },
});

const steampunkMechanicPromptProgram = createPromptProgram<SteampunkPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'steampunk_mechanic',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `steampunk_mechanic_${context.now}`,
            context.playerId,
            '选择要从弃牌堆打出的行动卡',
            buildMechanicDiscardOptions(context.state, context.playerId),
            {
                sourceId: 'steampunk_mechanic',
                titleKey: 'ui.steampunk_mechanic_title',
                targetType: 'generic',
                autoCancelOption: true,
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = state =>
            buildMechanicDiscardOptions(state.core as SmashUpCore, context.playerId);
        return interaction;
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as ({ __cancel__?: boolean } & Partial<{ cardUid: string; defId: string }>) | undefined;
        if (selected?.__cancel__ || !selected?.cardUid) return { events: [] };
        const liveCard = state.core.players[playerId]?.discard.find(card => card.uid === selected.cardUid);
        const defId = selected.defId ?? liveCard?.defId ?? '';
        if (!liveCard || !isMechanicReplayableDiscardAction(state.core, playerId, defId, (state.core.players[playerId]?.hand.length ?? 0) + 1)) {
            return { events: [] };
        }
        const recoverEvent = createCardTransferEvent({
            card: createCardObjectRefFromInstance(liveCard),
            fromPlayerId: playerId,
            toPlayerId: playerId,
            reason: 'steampunk_mechanic',
            timestamp,
        }) as SmashUpEvent;
        return {
            events: [recoverEvent],
            context: createPromptContext(state, playerId, timestamp, {
                replayCardUid: selected.cardUid,
                replayDefId: defId,
                replayOwnerId: liveCard.owner,
            }),
            nextProgram: steampunkMechanicTargetPromptProgram,
        };
    },
});

const steampunkMechanicProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    if (buildMechanicDiscardOptions(ctx.state, ctx.playerId).length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
        nextProgram: steampunkMechanicPromptProgram,
    };
});

const steampunkChangeOfVenueChooseMinionPromptProgram = createPromptProgram<SteampunkPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'steampunk_change_of_venue_choose_minion',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `steampunk_cov_target_${context.now}`,
            context.playerId,
            '选择要将行动卡附着到的随从',
            buildChangeOfVenueMinionOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'steampunk_change_of_venue_choose_minion',
                titleKey: 'ui.steampunk_change_of_venue_choose_minion_title',
                targetType: 'minion',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = state =>
            buildChangeOfVenueMinionOptions(state.core as SmashUpCore, context.playerId);
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const selected = value as Partial<{ baseIndex: number; minionUid: string; minionDefId: string }> | undefined;
        if (
            typeof selected?.baseIndex !== 'number'
            || !selected?.minionUid
            || !selected?.minionDefId
            || !context.replayCardUid
            || !context.replayDefId
        ) {
            return { events: [] };
        }
        const inHand = state.core.players[playerId]?.hand.some(card => card.uid === context.replayCardUid) ?? false;
        if (!inHand) return { events: [] };
        const liveTarget = state.core.bases[selected.baseIndex]?.minions.find(
            minion => minion.uid === selected.minionUid && minion.controller === playerId,
        );
        if (!liveTarget) return { events: [] };
        return appendResolvedActionAbility({
            state,
            playerId,
            cardUid: context.replayCardUid,
            defId: context.replayDefId,
            random,
            timestamp,
            baseIndex: selected.baseIndex,
            targetMinionUid: selected.minionUid,
            events: [
                buildActionPlayedEvent({
                    playerId,
                    cardUid: context.replayCardUid,
                    defId: context.replayDefId,
                    ownerId: context.replayOwnerId,
                    targetBaseIndex: selected.baseIndex,
                    targetMinionUid: selected.minionUid,
                    timestamp,
                }),
                ...buildReplayOngoingAttachedEvent(
                    state,
                    context,
                    playerId,
                    {
                        targetType: 'minion',
                        targetBaseIndex: selected.baseIndex,
                        targetMinionUid: selected.minionUid,
                    },
                    timestamp,
                ),
                grantExtraAction(playerId, 'steampunk_change_of_venue_replay_refund', timestamp, {
                    playTiming: resolveExtraPlayTiming(state),
                }),
            ],
        });
    },
});

const steampunkChangeOfVenueChooseBasePromptProgram = createPromptProgram<SteampunkPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'steampunk_change_of_venue_choose_base',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `steampunk_cov_target_${context.now}`,
            context.playerId,
            '选择要将行动卡附着到的基地',
            buildChangeOfVenueBaseOptions(context.matchState.core),
            {
                sourceId: 'steampunk_change_of_venue_choose_base',
                titleKey: 'ui.steampunk_change_of_venue_choose_base_title',
                targetType: 'base',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = state =>
            buildChangeOfVenueBaseOptions(state.core as SmashUpCore);
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const selected = value as Partial<{ baseIndex: number }> | undefined;
        if (
            typeof selected?.baseIndex !== 'number'
            || !context.replayCardUid
            || !context.replayDefId
        ) {
            return { events: [] };
        }
        const inHand = state.core.players[playerId]?.hand.some(card => card.uid === context.replayCardUid) ?? false;
        if (!inHand) return { events: [] };
        const ok = validateActionPlaySemantics(state.core, playerId, {
            defId: context.replayDefId,
            targetBaseIndex: selected.baseIndex,
            effectiveHandSize: getExternalActionEffectiveHandSize(state, playerId, true),
        });
        if (!ok.valid) return { events: [] };
        return appendResolvedActionAbility({
            state,
            playerId,
            cardUid: context.replayCardUid,
            defId: context.replayDefId,
            random,
            timestamp,
            baseIndex: selected.baseIndex,
            events: [
                buildActionPlayedEvent({
                    playerId,
                    cardUid: context.replayCardUid,
                    defId: context.replayDefId,
                    ownerId: context.replayOwnerId,
                    targetBaseIndex: selected.baseIndex,
                    timestamp,
                }),
                ...buildReplayOngoingAttachedEvent(
                    state,
                    context,
                    playerId,
                    { targetType: 'base', targetBaseIndex: selected.baseIndex },
                    timestamp,
                ),
                grantExtraAction(playerId, 'steampunk_change_of_venue_replay_refund', timestamp, {
                    playTiming: resolveExtraPlayTiming(state),
                }),
            ],
        });
    },
});

const steampunkChangeOfVenuePromptProgram = createPromptProgram<SteampunkPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'steampunk_change_of_venue',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `steampunk_change_of_venue_${context.now}`,
            context.playerId,
            '选择要取回的持续行动卡',
            buildChangeOfVenueOngoingOptions(context.state, context.playerId),
            {
                sourceId: 'steampunk_change_of_venue',
                titleKey: 'ui.steampunk_change_of_venue_title',
                targetType: 'ongoing',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = state =>
            buildChangeOfVenueOngoingOptions(state.core as SmashUpCore, context.playerId);
        return interaction;
    },
    onResolve: ({ state, playerId, value, random, timestamp }) => {
        const selected = value as Partial<{ cardUid: string; defId: string; ownerId: string }> | undefined;
        if (!selected?.cardUid || !selected?.defId || !selected?.ownerId) return { events: [] };
        if (findOngoingBaseIndexByUid(state.core, selected.cardUid) === -1) return { events: [] };
        const cardDef = getCardDef(selected.defId) as ActionCardDef | undefined;
        const detachEvent = buildValidatedOngoingDetachEvents(state, {
            cardUid: selected.cardUid,
            defId: selected.defId,
            ownerId: selected.ownerId,
            reason: 'steampunk_change_of_venue',
            now: timestamp,
        })[0];
        if (!detachEvent) return { events: [] };
        const recoverEvent = createCardTransferEvent({
            card: createCardObjectRef({
                uid: selected.cardUid,
                defId: selected.defId,
                ownerId: selected.ownerId as PlayerId,
            }),
            fromPlayerId: selected.ownerId as PlayerId,
            toPlayerId: playerId,
            reason: 'steampunk_change_of_venue',
            timestamp,
        }) as SmashUpEvent;

        if (cardDef?.subtype === 'ongoing') {
            const targets = (cardDef.ongoingTarget ?? 'base') === 'minion'
                ? buildChangeOfVenueMinionOptions(state.core, playerId)
                : buildChangeOfVenueBaseOptions(state.core);
            if (targets.length === 0) {
                return {
                    events: [detachEvent, recoverEvent, grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'steampunk_change_of_venue')],
                };
            }
            return {
                events: [detachEvent, recoverEvent],
                context: createPromptContext(state, playerId, timestamp, {
                    replayCardUid: selected.cardUid,
                    replayDefId: selected.defId,
                    replayOwnerId: selected.ownerId,
                }),
                nextProgram: (cardDef.ongoingTarget ?? 'base') === 'minion'
                    ? steampunkChangeOfVenueChooseMinionPromptProgram
                    : steampunkChangeOfVenueChooseBasePromptProgram,
            };
        }

        return appendResolvedActionAbility({
            state,
            playerId,
            cardUid: selected.cardUid,
            defId: selected.defId,
            random,
            timestamp,
            baseIndex: 0,
            events: [
                detachEvent,
                recoverEvent,
                buildActionPlayedEvent({
                    playerId,
                    cardUid: selected.cardUid,
                    defId: selected.defId,
                    ownerId: selected.ownerId as PlayerId,
                    timestamp,
                }),
                grantExtraAction(playerId, 'steampunk_change_of_venue_replay_refund', timestamp, {
                    playTiming: resolveExtraPlayTiming(state),
                }),
            ],
        });
    },
});

const steampunkChangeOfVenueProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    if (buildChangeOfVenueOngoingOptions(ctx.state, ctx.playerId).length === 0) {
        return { events: [grantContextualExtraAction(ctx, 'steampunk_change_of_venue')] };
    }
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
        nextProgram: steampunkChangeOfVenuePromptProgram,
    };
});


function isMechanicReplayableDiscardAction(
    core: SmashUpCore,
    playerId: string,
    defId: string,
    effectiveHandSize: number,
): boolean {
    const def = getCardDef(defId) as ActionCardDef | undefined;
    if (!def || def.type !== 'action') return false;
    if (def.subtype !== 'ongoing') return false;
    if ((def.ongoingTarget ?? 'base') !== 'base') return false;

    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        const ok = validateActionPlaySemantics(core, playerId, {
            defId,
            targetBaseIndex: baseIndex,
            effectiveHandSize,
        });
        if (ok.valid) return true;
    }
    return false;
}

/** 注册蒸汽朋克派系所有能力*/
export function registerSteampunkAbilities(): void {
    // 废物利用（行动卡）：从弃牌堆取回一张行动卡到手牌
    registerAbilityProgram('steampunk_scrap_diving', 'onPlay', { program: steampunkScrapDivingProgram });
    // 机械师（随从 onPlay）：从弃牌堆打出一张持续行动卡
    registerAbilityProgram('steampunk_mechanic', 'onPlay', { program: steampunkMechanicProgram });
    // 换场（行动卡）：取回一张己方 ongoing 行动卡到手牌 + 额外行动
    registerAbilityProgram('steampunk_change_of_venue', 'onPlay', { program: steampunkChangeOfVenueProgram });
    // 亚哈船长（talent）：移动到有己方行动卡的基地
    registerAbilityProgram('steampunk_captain_ahab', 'talent', {
        program: steampunkCaptainAhabProgram,
        validateUse: (ctx) => {
            const currentBaseIndex = findMinionBaseIndexByUid(ctx.state, ctx.cardUid);
            if (currentBaseIndex === -1) return '当前没有可选择的目标';
            return buildCaptainAhabBaseOptions(ctx.state, ctx.playerId, currentBaseIndex).length > 0
                ? null
                : '当前没有可选择的目标';
        },
    });

    // === ongoing 效果注册 ===
    registerInterceptor('steampunk_steam_queen', steampunkSteamQueenInterceptor);
    registerSimpleAbility('steampunk_ornate_dome', 'onPlay', steampunkOrnateDomeOnPlay);
    registerRestriction('steampunk_ornate_dome', 'play_action', steampunkOrnateDomeChecker);
    registerTrigger('steampunk_difference_engine', 'onTurnEnd', steampunkDifferenceEngineTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('steampunk_escape_hatch', 'onMinionDestroyed', steampunkEscapeHatchTrigger, {
        perInstance: true,
        phase: 'replacement',
    });
    registerAbilityProgram('steampunk_zeppelin', 'talent', {
        program: steampunkZeppelinProgram,
        validateUse: (ctx) => {
            let zepBaseIndex = -1;
            for (let i = 0; i < ctx.state.bases.length; i++) {
                if (ctx.state.bases[i].ongoingActions.some(o => o.uid === ctx.cardUid)) {
                    zepBaseIndex = i;
                    break;
                }
            }
            if (zepBaseIndex === -1) return '当前没有可选择的目标';
            const hasCandidateMinion = ctx.state.bases.some(base =>
                base.minions.some(minion => minion.controller === ctx.playerId),
            );
            return hasCandidateMinion ? null : '当前没有可选择的目标';
        },
    });
}


