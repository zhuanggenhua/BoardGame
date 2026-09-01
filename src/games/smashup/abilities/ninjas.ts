/**
 * 大杀四方 - 忍者派系能力
 *
 * 主题：消灭随从、潜入基地
 */

import { registerAbility, registerAbilityProgram, resolveSpecial } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { getMinionPower, buildMinionTargetOptions, buildBaseTargetOptions, isSpecialLimitBlocked, emitSpecialLimitUsed, buildAbilityFeedback, buildValidatedDestroyEvents, buildValidatedMoveEvents, buildValidatedReturnEvents } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, MinionPlayedEvent, PlayerState } from '../domain/types';
import { getCardDef, getBaseDef } from '../data/cards';
import type { MinionCardDef } from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import { matchesDefId } from '../domain/utils';
import type { MatchState, PlayerId } from '../../../engine/types';
import { validateImmediateHandExtraMinionPlaySemantics } from '../domain/playLegality';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
} from '../domain/abilityRuntime';

type NinjaPromptContext = {
    matchState: MatchState<any>;
    playerId: PlayerId;
    now: number;
};

type NinjaDestroyMinionPromptContext = NinjaPromptContext & {
    sourceId: 'ninja_master' | 'ninja_tiger_assassin' | 'ninja_seeing_stars';
    title: string;
    allowSkip?: boolean;
    targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
};

type NinjaDestroyOngoingPromptContext = NinjaPromptContext & {
    sourceId: 'ninja_infiltrate_destroy' | 'ninja_infiltrate_pod_destroy';
    title: string;
    allowSkip?: boolean;
    targets: Array<{ uid: string; defId: string; ownerId: string; label: string }>;
};

type NinjaMovePromptContext = NinjaPromptContext & {
    sourceId: 'ninja_way_of_deception_choose_minion' | 'ninja_way_of_deception_choose_base';
    title: string;
    minionCandidates?: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
    fromBaseIndex?: number;
    minionUid?: string;
    minionDefId?: string;
};

type NinjaPlayFromHandPromptContext = NinjaPromptContext & {
    sourceId: 'ninja_hidden_ninja' | 'ninja_acolyte_play';
    title: string;
    baseIndex: number;
    includeSkip?: boolean;
    handOptions: Array<{
        id: string;
        label: string;
        value: { cardUid: string; defId: string; power: number };
        _source: 'hand';
        displayMode: 'card';
    }>;
};

type NinjaDisguiseContext = NinjaPromptContext & {
    sourceId:
        | 'ninja_disguise_choose_base'
        | 'ninja_disguise_choose_minions'
        | 'ninja_disguise_choose_play1'
        | 'ninja_disguise_choose_play2';
    cardUid: string;
    eligibleBases: Array<{ baseIndex: number; count: number; label: string }>;
    baseIndex?: number;
    selectedMinionUids?: string[];
    totalToPlay?: number;
    playedHandUids?: string[];
};

function createNinjaPromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: MatchState<any>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): NinjaPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

function createSkipButton(label = '跳过') {
    return { id: 'skip', label, value: { skip: true }, displayMode: 'button' as const };
}

function buildDestroyMinionOptions(
    context: NinjaDestroyMinionPromptContext,
) {
    const options = buildMinionTargetOptions(context.targets, {
        state: context.matchState.core,
        sourcePlayerId: context.playerId,
        effectType: 'destroy',
    });
    if (context.allowSkip) {
        options.push(createSkipButton());
    }
    return options as any[];
}

function buildHandPlayEvents(
    playerId: PlayerId,
    baseIndex: number,
    cardUid: string,
    defId: string,
    power: number,
    timestamp: number,
): MinionPlayedEvent {
    return {
        type: SU_EVENTS.MINION_PLAYED,
        payload: { playerId, cardUid, defId, baseIndex, power, consumesNormalLimit: false },
        timestamp,
    };
}

function hasPlayedAnyMinionThisTurn(player: PlayerState | undefined): boolean {
    if (!player) return false;
    if (player.minionsPlayed > 0) return true;
    return Object.values(player.minionsPlayedPerBase ?? {}).some((count) => count > 0);
}

function ninjaAcolyteSpecialValidate(ctx: AbilityContext): string | null {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return '玩家不存在';
    if (hasPlayedAnyMinionThisTurn(player)) {
        return '本回合已打出过随从，不能使用该特殊能力';
    }
    return null;
}

function ninjaAcolytePodTalentValidate(ctx: AbilityContext): string | null {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return '玩家不存在';
    if (hasPlayedAnyMinionThisTurn(player)) {
        return '本回合已打出过随从，不能使用该天赋';
    }
    return null;
}

/** 注册忍者派系所有能力*/
export function registerNinjaAbilities(): void {
    // 忍者大师：消灭本基地一个随从
    registerAbilityProgram('ninja_master', 'onPlay', { program: ninjaMasterProgram });
    // 猛虎刺客：消灭本基地一个力量≤3的随从
    registerAbilityProgram('ninja_tiger_assassin', 'onPlay', { program: ninjaTigerAssassinProgram });
    // 手里剑（行动卡）：消灭一个力量≤3的随从（任意基地）
    registerAbilityProgram('ninja_seeing_stars', 'onPlay', { program: ninjaSeeingStarsProgram });
    // 欺骗之道（行动卡）：移动己方一个随从到另一个基地
    registerAbilityProgram('ninja_way_of_deception', 'onPlay', { program: ninjaWayOfDeceptionProgram });
    // 伪装（行动卡）：将己方一个随从返回手牌，然后打出一个随从到该基地
    registerAbilityProgram('ninja_disguise', 'onPlay', { program: ninjaDisguiseProgram });
    // 渗透（ongoing 行动卡）：onPlay 消灭基地上一个已有的战术
    registerAbilityProgram('ninja_infiltrate', 'onPlay', { program: ninjaInfiltrateOnPlayProgram });
    // 渗透 POD（ongoing 行动卡）：onPlay 可选消灭基地上另一张战术；talent 可自毁以压制基地能力
    registerAbilityProgram('ninja_infiltrate_pod', 'onPlay', { program: ninjaInfiltratePodOnPlayProgram });
    registerAbility('ninja_infiltrate_pod', 'talent', ninjaInfiltratePodTalent);
    // 隐忍（special action）：基地计分前打出手牌中的随从到该基地
    registerAbilityProgram('ninja_hidden_ninja', 'special', { program: ninjaHiddenNinjaProgram });
    // 忍者侍从（special）：基地计分前返回手牌并额外打出一个随从到该基地
    registerAbilityProgram('ninja_acolyte', 'special', {
        program: ninjaAcolyteSpecialProgram,
        validateUse: ninjaAcolyteSpecialValidate,
    });
    // 忍者侍从 POD（talent）：若本回合尚未打出过随从，则返回手牌并立即在这里额外打出一个随从
    registerAbilityProgram('ninja_acolyte_pod', 'talent', {
        program: ninjaAcolytePodTalentProgram,
        validateUse: ninjaAcolytePodTalentValidate,
    });

    // 注册 ongoing 拦截器（含 beforeScoring 触发器：影舞者、忍者侍从）
    registerNinjaOngoingEffects();
}

const ninjaDestroyMinionPromptProgram = createPromptProgram<NinjaDestroyMinionPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'ninja_destroy_minion_prompt',
    interactionSourceIds: ['ninja_master', 'ninja_tiger_assassin', 'ninja_seeing_stars'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        buildDestroyMinionOptions(context),
        { sourceId: context.sourceId, targetType: 'minion' },
    ),
    onResolve: ({ state, playerId, value, context, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const base = state.core.bases[selected.baseIndex];
        if (!base) return { events: [] };
        const target = base.minions.find((minion) => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: context.sourceId,
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: context.sourceId,
                sourceControllerId: playerId,
                sourceKind: 'nonAction',
            }),
        };
    },
});

const ninjaMasterProgram = createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.minions
        .filter((minion) => minion.uid !== ctx.cardUid)
        .map((minion) => {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const power = getMinionPower(ctx.state, minion, ctx.baseIndex);
            return { uid: minion.uid, defId: minion.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
        });
    if (targets.length === 0) return { events: [] };
    return {
        events: [],
        context: createNinjaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'ninja_master',
            title: '选择要消灭的随从（可跳过）',
            allowSkip: true,
            targets,
        }),
        nextProgram: ninjaDestroyMinionPromptProgram,
    };
});

const ninjaTigerAssassinProgram = createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.minions
        .filter((minion) => minion.uid !== ctx.cardUid && getMinionPower(ctx.state, minion, ctx.baseIndex) <= 3)
        .map((minion) => {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const power = getMinionPower(ctx.state, minion, ctx.baseIndex);
            return { uid: minion.uid, defId: minion.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
        });
    if (targets.length === 0) return { events: [] };
    return {
        events: [],
        context: createNinjaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'ninja_tiger_assassin',
            title: '选择要消灭的力量≤3的随从（可跳过）',
            allowSkip: true,
            targets,
        }),
        nextProgram: ninjaDestroyMinionPromptProgram,
    };
});

const ninjaSeeingStarsProgram = createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
    const targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let index = 0; index < ctx.state.bases.length; index += 1) {
        for (const minion of ctx.state.bases[index].minions) {
            if (getMinionPower(ctx.state, minion, index) > 3) continue;
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const baseDef = getBaseDef(ctx.state.bases[index].defId);
            const baseName = baseDef?.name ?? `基地 ${index + 1}`;
            const power = getMinionPower(ctx.state, minion, index);
            targets.push({ uid: minion.uid, defId: minion.defId, baseIndex: index, label: `${name} (力量 ${power}) @ ${baseName}` });
        }
    }
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [],
        context: createNinjaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'ninja_seeing_stars',
            title: '选择要消灭的力量≤3的随从',
            targets,
        }),
        nextProgram: ninjaDestroyMinionPromptProgram,
    };
});

// ninja_poison (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（-4力量）
// onPlay 效果：消灭目标随从身上的所有战术（附着的行动卡）
registerAbility('ninja_poison', 'onPlay', ninjaPoisonOnPlay);

/**
 * 下毒 onPlay：消灭目标随从身上的所有战术（附着的行动卡）
 * 描述："打出到一个随从上。消灭在它身上的任意数量的战术。"
 */
function ninjaPoisonOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const events: SmashUpEvent[] = [];

    // 找到目标随从
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events };
    const target = base.minions.find(m => m.uid === ctx.targetMinionUid);
    if (!target) return { events };

    // 消灭目标随从身上所有附着的行动卡（排除刚附着的 ninja_poison 自身）
    for (const a of target.attachedActions) {
        if (a.uid === ctx.cardUid) continue;
        events.push(...buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: a.uid,
            defId: a.defId,
            ownerId: a.ownerId,
            reason: 'ninja_poison_destroy',
            now: ctx.now,
            expectedLocation: 'minion',
        }));
    }

    return { events };
}

const ninjaDestroyOngoingPromptProgram = createPromptProgram<NinjaDestroyOngoingPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'ninja_destroy_ongoing_prompt',
    interactionSourceIds: ['ninja_infiltrate_destroy', 'ninja_infiltrate_pod_destroy'],
    buildInteraction: (context) => {
        const options = context.targets.map((target, index) => ({
            id: `tactic-${index}`,
            label: target.label,
            value: { cardUid: target.uid, defId: target.defId, ownerId: target.ownerId },
            _source: 'ongoing' as const,
            displayMode: 'card' as const,
        }));
        if (context.allowSkip) {
            options.push(createSkipButton('跳过（不消灭）'));
        }
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_${context.now}`,
            context.playerId,
            context.title,
            options as any[],
            { sourceId: context.sourceId, targetType: 'ongoing', autoResolveIfSingle: false },
        );
    },
    onResolve: ({ state, value, context, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as { cardUid?: string; defId?: string; ownerId?: string } | undefined;
        if (!selected?.cardUid || !selected.defId || !selected.ownerId) return { events: [] };
        return {
            events: buildValidatedOngoingDetachEvents(state, {
                cardUid: selected.cardUid,
                defId: selected.defId,
                ownerId: selected.ownerId,
                reason: context.sourceId,
                now: timestamp,
            }),
        };
    },
});

const ninjaInfiltrateOnPlayProgram = createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.ongoingActions
        .filter((ongoing) => ongoing.uid !== ctx.cardUid)
        .map((ongoing) => {
            const def = getCardDef(ongoing.defId);
            return { uid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId, label: def?.name ?? ongoing.defId };
        });
    if (targets.length === 0) return { events: [] };
    if (!ctx.matchState) return { events: [] };
    return {
        events: [],
        context: createNinjaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'ninja_infiltrate_destroy',
            title: '选择要消灭的战术',
            targets,
        }),
        nextProgram: ninjaDestroyOngoingPromptProgram,
    };
});

const ninjaInfiltratePodOnPlayProgram = createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.ongoingActions
        .filter((ongoing) => ongoing.uid !== ctx.cardUid)
        .map((ongoing) => {
            const def = getCardDef(ongoing.defId);
            return { uid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId, label: def?.name ?? ongoing.defId };
        });
    if (targets.length === 0) return { events: [] };
    return {
        events: [],
        context: createNinjaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'ninja_infiltrate_pod_destroy',
            title: '你可以消灭该基地上的另一张战术',
            allowSkip: true,
            targets,
        }),
        nextProgram: ninjaDestroyOngoingPromptProgram,
    };
});

const ninjaWayOfDeceptionBasePromptProgram = createPromptProgram<NinjaMovePromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'ninja_way_of_deception_base_prompt',
    interactionSourceIds: ['ninja_way_of_deception_choose_base'],
    buildInteraction: (context) => {
        const candidates: Array<{ baseIndex: number; label: string }> = [];
        for (let index = 0; index < context.matchState.core.bases.length; index += 1) {
            if (index === context.fromBaseIndex) continue;
            const baseDef = getBaseDef(context.matchState.core.bases[index].defId);
            candidates.push({ baseIndex: index, label: baseDef?.name ?? `基地 ${index + 1}` });
        }
        return createAbilityRuntimeSimpleChoice(
            `ninja_way_of_deception_base_${context.now}`,
            context.playerId,
            '选择目标基地',
            buildBaseTargetOptions(candidates, context.matchState.core) as any[],
            {
                sourceId: 'ninja_way_of_deception_choose_base',
                targetType: 'base',
                titleKey: 'ui.ninja_way_of_deception_choose_base_title',
            },
        );
    },
    onResolve: ({ state, value, context, timestamp }) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined || context.fromBaseIndex === undefined || !context.minionUid || !context.minionDefId) {
            return { events: [] };
        }
        return {
            events: buildValidatedMoveEvents(state, {
                minionUid: context.minionUid,
                minionDefId: context.minionDefId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                sourcePlayerId: context.playerId,
                sourceDefId: 'ninja_way_of_deception',
                sourceControllerId: context.playerId,
                reason: 'ninja_way_of_deception',
                now: timestamp,
            }),
        };
    },
});

const ninjaWayOfDeceptionMinionPromptProgram = createPromptProgram<NinjaMovePromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'ninja_way_of_deception_minion_prompt',
    interactionSourceIds: ['ninja_way_of_deception_choose_minion'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `ninja_way_of_deception_${context.now}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.minionCandidates ?? [], {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: 'ninja_way_of_deception',
        }) as any[],
        { sourceId: 'ninja_way_of_deception_choose_minion', targetType: 'minion' },
    ),
    onResolve: ({ state, value, context, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const base = state.core.bases[selected.baseIndex];
        if (!base) return { events: [] };
        const minion = base.minions.find((item) => item.uid === selected.minionUid);
        if (!minion) return { events: [] };
        const candidates: Array<{ baseIndex: number; label: string }> = [];
        for (let index = 0; index < state.core.bases.length; index += 1) {
            if (index === selected.baseIndex) continue;
            const baseDef = getBaseDef(state.core.bases[index].defId);
            candidates.push({ baseIndex: index, label: baseDef?.name ?? `基地 ${index + 1}` });
        }
        if (candidates.length === 0) return { events: [] };
        return {
            events: [],
            context: createNinjaPromptContext(state, context.playerId, timestamp, {
                sourceId: 'ninja_way_of_deception_choose_base',
                title: '选择目标基地',
                fromBaseIndex: selected.baseIndex,
                minionUid: selected.minionUid,
                minionDefId: minion.defId,
            }),
            nextProgram: ninjaWayOfDeceptionBasePromptProgram,
        };
    },
});

const ninjaWayOfDeceptionProgram = createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
    const myMinions: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let index = 0; index < ctx.state.bases.length; index += 1) {
        for (const minion of ctx.state.bases[index].minions) {
            if (minion.controller !== ctx.playerId) continue;
            const power = getMinionPower(ctx.state, minion, index);
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const baseDef = getBaseDef(ctx.state.bases[index].defId);
            const baseName = baseDef?.name ?? `基地 ${index + 1}`;
            myMinions.push({ uid: minion.uid, defId: minion.defId, baseIndex: index, label: `${name} (力量 ${power}) @ ${baseName}` });
        }
    }
    if (myMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (ctx.state.bases.length <= 1) {
        return { events: [] };
    }
    return {
        events: [],
        context: createNinjaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'ninja_way_of_deception_choose_minion',
            title: '选择要移动的己方随从',
            minionCandidates: myMinions,
        }),
        nextProgram: ninjaWayOfDeceptionMinionPromptProgram,
    };
});

function buildHandMinionOptions(cards: AbilityContext['state']['players'][PlayerId]['hand']) {
    return cards
        .filter((card) => card.type === 'minion')
        .map((card, index) => {
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            const name = def?.name ?? card.defId;
            const power = def?.power ?? 0;
            return {
                id: `hand-${index}`,
                label: `${name} (力量 ${power})`,
                value: { cardUid: card.uid, defId: card.defId, power },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            };
        });
}

const ninjaPlayFromHandPromptProgram = createPromptProgram<NinjaPlayFromHandPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'ninja_play_from_hand_prompt',
    interactionSourceIds: ['ninja_hidden_ninja', 'ninja_acolyte_play'],
    buildInteraction: (context) => {
        const options = context.includeSkip
            ? [...context.handOptions, createSkipButton()]
            : context.handOptions;
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_${context.now}`,
            context.playerId,
            context.title,
            options as any[],
            { sourceId: context.sourceId, targetType: 'hand', titleKey: 'ui.ninja_disguise_choose_play_title' },
        );
    },
    onResolve: ({ value, context, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as { cardUid?: string; defId?: string; power?: number } | undefined;
        if (!selected?.cardUid || !selected.defId || selected.power === undefined) return { events: [] };
        const playCheck = validateImmediateHandExtraMinionPlaySemantics(context.matchState.core, context.playerId, {
            cardUid: selected.cardUid,
            baseIndex: context.baseIndex,
        });
        if (!playCheck.valid) return { events: [] };
        return {
            events: [buildHandPlayEvents(context.playerId, context.baseIndex, selected.cardUid, selected.defId, selected.power, timestamp)],
        };
    },
});

const ninjaHiddenNinjaProgram = createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
    if (isSpecialLimitBlocked(ctx.state, 'ninja_hidden_ninja', ctx.baseIndex)) {
        return { events: [] };
    }
    const player = ctx.state.players[ctx.playerId];
    const handOptions = buildHandMinionOptions(player.hand);
    if (handOptions.length === 0) return { events: [] };
    const limitEvt = resolveSpecial('ninja_hidden_ninja')
        ? undefined
        : emitSpecialLimitUsed(ctx.playerId, 'ninja_hidden_ninja', ctx.baseIndex, ctx.now);
    return {
        events: limitEvt ? [limitEvt] : [],
        context: createNinjaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'ninja_hidden_ninja',
            title: '选择要打出到该基地的随从（可跳过）',
            baseIndex: ctx.baseIndex,
            includeSkip: true,
            handOptions,
        }),
        nextProgram: ninjaPlayFromHandPromptProgram,
    };
});

const ninjaAcolyteSpecialProgram = createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
    if (isSpecialLimitBlocked(ctx.state, 'ninja_acolyte', ctx.baseIndex)) return { events: [] };
    const player = ctx.state.players[ctx.playerId];
    if (hasPlayedAnyMinionThisTurn(player)) return { events: [] };
    const limitEvt = emitSpecialLimitUsed(ctx.playerId, 'ninja_acolyte', ctx.baseIndex, ctx.now);
    const events: SmashUpEvent[] = limitEvt ? [limitEvt] : [];
    events.push(...buildValidatedReturnEvents(ctx.matchState, {
        minionUid: ctx.cardUid,
        minionDefId: 'ninja_acolyte',
        fromBaseIndex: ctx.baseIndex,
        toPlayerId: ctx.playerId,
        sourcePlayerId: ctx.playerId,
        reason: 'ninja_acolyte',
        now: ctx.now,
    }));
    const acolyteDef = getCardDef('ninja_acolyte') as MinionCardDef | undefined;
    const handOptions = [
        ...buildHandMinionOptions(player.hand),
        {
            id: 'hand-self',
            label: `${acolyteDef?.name ?? '忍者侍从'} (力量 ${acolyteDef?.power ?? 2})`,
            value: { cardUid: ctx.cardUid, defId: 'ninja_acolyte', power: acolyteDef?.power ?? 2 },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        },
    ];
    if (handOptions.length === 0) return { events };
    return {
        events,
        context: createNinjaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'ninja_acolyte_play',
            title: '选择要打出到该基地的随从（可跳过）',
            baseIndex: ctx.baseIndex,
            includeSkip: true,
            handOptions,
        }),
        nextProgram: ninjaPlayFromHandPromptProgram,
    };
});

const ninjaAcolytePodTalentProgram = createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
    const player = ctx.state.players[ctx.playerId];
    if (hasPlayedAnyMinionThisTurn(player)) return { events: [] };

    const events: SmashUpEvent[] = buildValidatedReturnEvents(ctx.matchState, {
        minionUid: ctx.cardUid,
        minionDefId: 'ninja_acolyte_pod',
        fromBaseIndex: ctx.baseIndex,
        toPlayerId: ctx.playerId,
        sourcePlayerId: ctx.playerId,
        reason: 'ninja_acolyte_pod',
        now: ctx.now,
    });

    const acolyteDef = getCardDef('ninja_acolyte_pod') as MinionCardDef | undefined;
    const handOptions = [
        ...buildHandMinionOptions(player.hand),
        {
            id: 'hand-self',
            label: `${acolyteDef?.name ?? '忍者侍从'} (力量 ${acolyteDef?.power ?? 2})`,
            value: { cardUid: ctx.cardUid, defId: 'ninja_acolyte_pod', power: acolyteDef?.power ?? 2 },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        },
    ];

    if (handOptions.length === 0) return { events };
    return {
        events,
        context: createNinjaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'ninja_acolyte_play',
            title: '选择要打出到该基地的随从（可跳过）',
            baseIndex: ctx.baseIndex,
            includeSkip: true,
            handOptions,
        }),
        nextProgram: ninjaPlayFromHandPromptProgram,
    };
});

function buildNinjaDisguiseEligibleBases(
    ctx: AbilityContext,
): Array<{ baseIndex: number; count: number; label: string }> {
    const handMinionCount = ctx.state.players[ctx.playerId]?.hand.filter(
        (card) => card.type === 'minion' && card.uid !== ctx.cardUid,
    ).length ?? 0;
    if (handMinionCount === 0) return [];

    const candidates: Array<{ baseIndex: number; count: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        const count = ctx.state.bases[baseIndex].minions.filter(
            (minion) => minion.controller === ctx.playerId,
        ).length;
        if (count === 0) continue;
        const baseDef = getBaseDef(ctx.state.bases[baseIndex].defId);
        candidates.push({
            baseIndex,
            count,
            label: `${baseDef?.name ?? `基地 ${baseIndex + 1}`} (${count} 个己方随从)`,
        });
    }
    return candidates;
}

function buildNinjaDisguiseHandOptions(
    state: AbilityContext['state'],
    playerId: PlayerId,
    cardUid: string,
    excludedCardUids: string[] = [],
) {
    return state.players[playerId].hand
        .filter((card) => card.type === 'minion' && card.uid !== cardUid && !excludedCardUids.includes(card.uid))
        .map((card, index) => {
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            const name = def?.name ?? card.defId;
            const power = def?.power ?? 0;
            return {
                id: `hand-${index}`,
                label: `${name} (力量 ${power})`,
                value: { cardUid: card.uid, defId: card.defId, power },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            };
        });
}

function buildNinjaDisguiseReturnEvents(
    state: AbilityContext['state'],
    baseIndex: number,
    selectedMinionUids: string[],
    sourcePlayerId: PlayerId,
    timestamp: number,
): SmashUpEvent[] {
    const base = state.bases[baseIndex];
    if (!base) return [];

    const events: SmashUpEvent[] = [];
    for (const minionUid of selectedMinionUids) {
        const minion = base.minions.find((entry) => entry.uid === minionUid);
        if (!minion) continue;
        events.push(...buildValidatedReturnEvents(state, {
            minionUid,
            minionDefId: minion.defId,
            fromBaseIndex: baseIndex,
            toPlayerId: minion.owner,
            sourcePlayerId: sourcePlayerId,
            reason: 'ninja_disguise',
            now: timestamp,
        }));
    }
    return events;
}

const ninjaDisguiseChooseBasePromptProgram = createPromptProgram<NinjaDisguiseContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'ninja_disguise_choose_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `ninja_disguise_base_${context.now}`,
        context.playerId,
        '伪装：选择一个基地',
        buildBaseTargetOptions(context.eligibleBases, context.matchState.core),
        {
            sourceId: 'ninja_disguise_choose_base',
            targetType: 'base',
            autoCancelOption: true,
            autoResolveIfSingle: false,
            titleKey: 'ui.ninja_disguise_choose_base_title',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        if ((value as { __cancel__?: boolean } | undefined)?.__cancel__) {
            return { events: [], matchState: state };
        }
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) {
            return { events: [], matchState: state };
        }
        return {
            events: [],
            matchState: state,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                baseIndex: selected.baseIndex,
                sourceId: 'ninja_disguise_choose_minions',
            },
            nextProgram: ninjaDisguiseChooseMinionsPromptProgram,
        };
    },
});

const ninjaDisguiseChooseMinionsPromptProgram = createPromptProgram<NinjaDisguiseContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'ninja_disguise_choose_minions',
    buildInteraction: (context) => {
        if (context.baseIndex === undefined) {
            throw new Error('ninja_disguise_choose_minions 缺少 baseIndex');
        }
        const base = context.matchState.core.bases[context.baseIndex];
        if (!base) {
            throw new Error(`ninja_disguise_choose_minions 基地不存在: ${context.baseIndex}`);
        }

        const handOptions = buildNinjaDisguiseHandOptions(
            context.matchState.core,
            context.playerId,
            context.cardUid,
        );
        const myMinions = base.minions.filter((minion) => minion.controller === context.playerId);
        const maxSelect = Math.min(2, myMinions.length, handOptions.length);
        if (maxSelect <= 0) {
            throw new Error('ninja_disguise_choose_minions 没有可执行的伪装目标');
        }

        const minionOptions = myMinions.map((minion) => {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const power = getMinionPower(context.matchState.core, minion, context.baseIndex!);
            return {
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.baseIndex!,
                label: `${name} (力量 ${power})`,
            };
        });

        return createAbilityRuntimeSimpleChoice(
            `ninja_disguise_select_${context.now}`,
            context.playerId,
            `伪装：选择 1-${maxSelect} 个己方随从`,
            buildMinionTargetOptions(minionOptions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
            }),
            { sourceId: 'ninja_disguise_choose_minions', targetType: 'minion' },
            undefined,
            { min: 1, max: maxSelect },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const selections = (Array.isArray(value) ? value : [value]) as Array<{ minionUid?: string }>;
        const selectedMinionUids = selections
            .map((selection) => selection.minionUid)
            .filter((minionUid): minionUid is string => typeof minionUid === 'string');
        if (selectedMinionUids.length === 0) {
            return { events: [], matchState: state };
        }
        return {
            events: [],
            matchState: state,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                selectedMinionUids,
                totalToPlay: selectedMinionUids.length,
                playedHandUids: [],
                sourceId: 'ninja_disguise_choose_play1',
            },
            nextProgram: ninjaDisguisePlayPromptProgram,
        };
    },
});

const ninjaDisguisePlayPromptProgram = createPromptProgram<NinjaDisguiseContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'ninja_disguise_choose_play1',
    interactionSourceIds: ['ninja_disguise_choose_play2'],
    buildInteraction: (context) => {
        if (context.baseIndex === undefined) {
            throw new Error('ninja_disguise_choose_play 缺少 baseIndex');
        }
        if (!context.selectedMinionUids?.length || context.totalToPlay === undefined) {
            throw new Error('ninja_disguise_choose_play 缺少已选随从上下文');
        }

        const handOptions = buildNinjaDisguiseHandOptions(
            context.matchState.core,
            context.playerId,
            context.cardUid,
            context.playedHandUids ?? [],
        );
        if (handOptions.length === 0) {
            throw new Error('ninja_disguise_choose_play 没有可打出的手牌随从');
        }

        const choosingSecond = (context.playedHandUids?.length ?? 0) > 0;
        return createAbilityRuntimeSimpleChoice(
            `ninja_disguise_play_${context.now}_${context.playedHandUids?.length ?? 0}`,
            context.playerId,
            choosingSecond ? '伪装：选择第二个要打出的手牌随从' : '伪装：选择要打出的手牌随从',
            handOptions,
            {
                sourceId: context.sourceId,
                targetType: 'hand',
                titleKey: choosingSecond
                    ? 'ui.ninja_disguise_choose_second_play_title'
                    : 'ui.ninja_disguise_choose_play_title',
            },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        if (context.baseIndex === undefined) {
            throw new Error('ninja_disguise_choose_play resolve 缺少 baseIndex');
        }
        if (!context.selectedMinionUids?.length || context.totalToPlay === undefined) {
            throw new Error('ninja_disguise_choose_play resolve 缺少已选随从上下文');
        }

        const selected = value as { cardUid?: string; defId?: string; power?: number } | undefined;
        if (!selected?.cardUid || !selected.defId || selected.power === undefined) {
            return { events: [], matchState: state };
        }
        const selectedCard = state.core.players[playerId]?.hand.find((card) =>
            card.uid === selected.cardUid
            && card.defId === selected.defId
            && card.type === 'minion',
        );
        if (!selectedCard) {
            return { events: [], matchState: state };
        }

        const base = state.core.bases[context.baseIndex];
        if (!base) {
            return { events: [], matchState: state };
        }

        const playedEvent: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId,
                cardUid: selectedCard.uid,
                defId: selectedCard.defId,
                ownerId: selectedCard.owner,
                baseIndex: context.baseIndex,
                baseDefId: base.defId,
                power: selected.power,
                consumesNormalLimit: false,
            },
            timestamp,
        };

        const playedHandUids = [...(context.playedHandUids ?? []), selected.cardUid];
        const events: SmashUpEvent[] = [playedEvent];

        if (playedHandUids.length < context.totalToPlay) {
            const remainingHandOptions = buildNinjaDisguiseHandOptions(
                state.core,
                playerId,
                context.cardUid,
                playedHandUids,
            );
            if (remainingHandOptions.length > 0) {
                return {
                    events,
                    matchState: state,
                    context: {
                        ...context,
                        matchState: state,
                        now: timestamp,
                        playedHandUids,
                        sourceId: 'ninja_disguise_choose_play2',
                    },
                    nextProgram: ninjaDisguisePlayPromptProgram,
                };
            }
        }

        events.push(
            ...buildNinjaDisguiseReturnEvents(
                state.core,
                context.baseIndex,
                context.selectedMinionUids,
                playerId,
                timestamp,
            ),
        );
        return { events, matchState: state };
    },
});

const ninjaDisguiseProgram = createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
    const eligibleBases = buildNinjaDisguiseEligibleBases(ctx);
    if (eligibleBases.length === 0) {
        return { events: [] };
    }

    if (!ctx.matchState) return { events: [] };

    return {
        events: [],
        context: createNinjaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'ninja_disguise_choose_base',
            cardUid: ctx.cardUid,
            eligibleBases,
        }),
        nextProgram: ninjaDisguiseChooseBasePromptProgram,
    };
});

/**
 * 渗透 POD talent：消灭本战术，压制该基地能力直到你的下回合开始。
 */
function ninjaInfiltratePodTalent(ctx: AbilityContext): AbilityResult {
    const ownerId = ctx.playerId;
    const detachEvent = buildValidatedOngoingDetachEvents(ctx.state, {
        cardUid: ctx.cardUid,
        defId: 'ninja_infiltrate_pod',
        ownerId,
        reason: 'ninja_infiltrate_pod_talent',
        now: ctx.now,
        expectedLocation: 'any',
    })[0];
    if (!detachEvent) return { events: [] };
    const events: SmashUpEvent[] = [
        detachEvent,
        {
            type: SU_EVENTS.BASE_ABILITY_SUPPRESSED,
            payload: { baseIndex: ctx.baseIndex, suppressorPlayerId: ownerId, reason: 'ninja_infiltrate_pod_talent' },
            timestamp: ctx.now,
        } as any,
    ];
    return { events };
}

// ============================================================================
// Ongoing 拦截器注册
// ============================================================================

/** 注册忍者派系的 ongoing 拦截?*/
function registerNinjaOngoingEffects(): void {
    // === beforeScoring 触发器 ===
    // 影舞者（ninja_shinobi）已迁移到 Me First! 响应窗口机制：
    // 通过 MinionCardDef.beforeScoringPlayable=true 标记，在 Me First! 窗口中
    // 允许使用 PLAY_MINION 命令从手牌打出到即将计分的基地。
    // 不再需要 beforeScoring 触发器和 ninja_shinobi_scoring 交互处理器。

    // === 保护/拦截器 ===

    // 烟雾弹：保护同基地己方随从不受对手行动卡影响
    // 烟幕弹是 ongoingTarget: 'minion'，附着在随从的 attachedActions 上
    // 卡牌描述："该随从不会受到其他玩家战术的影响" → 保护被附着的随从
    registerProtection('ninja_smoke_bomb', 'action', (ctx) => {
        return ctx.targetMinion.attachedActions.some((bomb) => {
            if (!matchesDefId(bomb.defId, 'ninja_smoke_bomb')) return false;
            const controllerId = (bomb.metadata?.sourceControllerId as PlayerId | undefined) ?? bomb.ownerId;
            return ctx.targetMinion.controller === controllerId && ctx.sourcePlayerId !== controllerId;
        });
    });

    // 暗杀：回合结束时消灭目标随从（附着在随从上）
    // 注意：只在暗杀卡拥有者的回合结束时触发
    registerTrigger('ninja_assassination', 'onTurnEnd', (trigCtx) => {
        if (trigCtx.sourceCardUid) {
            for (let i = 0; i < trigCtx.state.bases.length; i++) {
                const base = trigCtx.state.bases[i];
                for (const m of base.minions) {
                    const assassinationCard = m.attachedActions.find((a) =>
                        a.uid === trigCtx.sourceCardUid
                        && matchesDefId(a.defId, 'ninja_assassination')
                    );
                    if (!assassinationCard) continue;
                    const controllerId = (assassinationCard.metadata?.sourceControllerId as PlayerId | undefined) ?? assassinationCard.ownerId;
                    if (controllerId !== trigCtx.playerId) return [];
                    return buildValidatedDestroyEvents(trigCtx.state, {
                        minionUid: m.uid,
                        minionDefId: m.defId,
                        fromBaseIndex: i,
                        destroyerId: controllerId,
                        reason: 'ninja_assassination',
                        now: trigCtx.now,
                        sourcePlayerId: controllerId,
                        sourceCardUid: assassinationCard.uid,
                        sourceDefId: assassinationCard.defId,
                        sourceControllerId: controllerId,
                        sourceBaseIndex: i,
                    });
                }
            }
            return [];
        }

        const events: SmashUpEvent[] = [];
        // 查找所有附着了 assassination 的随从
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            for (const m of base.minions) {
                const assassinationCard = m.attachedActions.find((a) =>
                    matchesDefId(a.defId, 'ninja_assassination')
                    && (((a.metadata?.sourceControllerId as PlayerId | undefined) ?? a.ownerId) === trigCtx.playerId),
                );
                // 只在当前回合玩家拥有/控制的那张暗杀上触发，不被宿主上的第一张同名来源抢走
                const controllerId = assassinationCard
                    ? ((assassinationCard.metadata?.sourceControllerId as PlayerId | undefined) ?? assassinationCard.ownerId)
                    : undefined;
                if (assassinationCard && controllerId === trigCtx.playerId) {
                    events.push(...buildValidatedDestroyEvents(trigCtx.state, {
                        minionUid: m.uid,
                        minionDefId: m.defId,
                        fromBaseIndex: i,
                        destroyerId: controllerId,
                        reason: 'ninja_assassination',
                        now: trigCtx.now,
                        sourcePlayerId: controllerId,
                        sourceCardUid: assassinationCard.uid,
                        sourceDefId: assassinationCard.defId,
                        sourceControllerId: controllerId,
                        sourceBaseIndex: i,
                    }));
                }
            }
        }
        return events;
    }, {
        playerContext: 'sourceController',
    });

    // 渗透：附着此卡的随从不受基地能力影响（广义保护）?
    registerProtection('ninja_infiltrate', 'affect', (ctx) => {
        // 只有基础版 Infiltrate 具有这条旧版保护语义；POD 版不能混入这条链路。
        return ctx.targetMinion.attachedActions.some(a => a.defId === 'ninja_infiltrate');
    });
}

// ============================================================================
// 交互解决处理函数（InteractionHandler）
// ============================================================================

/** 注册忍者派系的交互解决处理函数 */
export function registerNinjaInteractionHandlers(): void {
    // 忍者当前已无额外 raw InteractionHandler；
    // 所有需要玩家交互的能力均走声明式 ability runtime。
}
