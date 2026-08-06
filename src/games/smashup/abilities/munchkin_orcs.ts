import type { PlayerId } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerAbility } from '../domain/abilityRegistry';
import {
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildPlayerTargetOptions,
    buildSemanticOngoingAttachEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
} from '../domain/abilityHelpers';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import {
    registerBaseVpModifier,
    registerCardAbilitySuppression,
    fireTriggers,
    registerProtection,
    registerRestriction,
    registerTrigger,
    type ProtectionCheckContext,
    type RestrictionCheckContext,
    type TriggerContext,
    type TriggerResult,
} from '../domain/ongoingEffects';
import { getBaseDef, getCardDef } from '../data/cards';
import { getEffectivePower, getPlayerEffectivePowerOnBase } from '../domain/ongoingModifiers';
import { SU_EVENTS, type SmashUpCore, type SmashUpEvent } from '../domain/types';

const TOPPER_CHOPPER = 'munchkin_orcs_topper_chopper';
const HAMMER_SLAMMER = 'munchkin_orcs_hammer_slammer';
const DORK_ORC = 'munchkin_orcs_dork_orc';
const AND_STAY_DOWN = 'munchkin_orcs_and_stay_down';
const ANGRY_PILLAGERS = 'munchkin_orcs_angry_pillagers';
const CRUSH = 'munchkin_orcs_crush';
const DEATH_BREATH = 'munchkin_orcs_death_breath';
const DOGPILE = 'munchkin_orcs_dogpile';
const GIMME = 'munchkin_orcs_gimme';
const STALLING = 'munchkin_orcs_stalling';
const TOO_TOUGH = 'munchkin_orcs_too_tough';
const BASE_GARRISON = 'base_garrison';
const BASE_THE_PITS = 'base_the_pits';

const HAMMER_SLAMMER_TARGET_SOURCE_ID = 'munchkin_orcs_hammer_slammer_target';
const CRUSH_BASE_SOURCE_ID = 'munchkin_orcs_crush_base';
const CRUSH_PLAYER_SOURCE_ID = 'munchkin_orcs_crush_player';
const CRUSH_MINION_SOURCE_ID = 'munchkin_orcs_crush_minion';
const DEATH_BREATH_TARGET_SOURCE_ID = 'munchkin_orcs_death_breath_target';
const DOGPILE_MINION_SOURCE_ID = 'munchkin_orcs_dogpile_minion';
const DOGPILE_BASE_SOURCE_ID = 'munchkin_orcs_dogpile_base';
const GIMME_ACTION_SOURCE_ID = 'munchkin_orcs_gimme_action';
const GIMME_MINION_SOURCE_ID = 'munchkin_orcs_gimme_minion';
const STALLING_MINION_SOURCE_ID = 'munchkin_orcs_stalling_minion';

type MinionChoice = { minionUid?: string; minionDefId?: string; defId?: string; baseIndex?: number };
type BaseChoice = { baseIndex?: number; baseDefId?: string };
type PlayerChoice = { targetPlayerId?: PlayerId; baseIndex?: number };
type AttachedActionChoice = { cardUid?: string; defId?: string; ownerId?: PlayerId; baseIndex?: number };

type HammerSlammerInteractionData = { sourceMinionUid?: string; sourceBaseIndex?: number };
type CrushInteractionData = { sourceCardUid?: string; baseIndex?: number; targetPlayerId?: PlayerId };
type DogpileInteractionData = { sourceCardUid?: string; sourceMinionUid?: string; sourceBaseIndex?: number };
type GimmeInteractionData = {
    sourceCardUid?: string;
    actionUid?: string;
    actionDefId?: string;
    actionOwnerId?: PlayerId;
    hostUid?: string;
    hostBaseIndex?: number;
};
type StallingInteractionData = { sourceBaseIndex?: number; protectedActionDefId?: string };

function cardName(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function baseName(defId: string): string {
    return getBaseDef(defId)?.name ?? defId;
}

function buildHammerSlammerOptions(state: SmashUpCore, sourcePlayerId: PlayerId) {
    const candidates = state.bases.flatMap((base, baseIndex) => base.minions
        .filter(minion => getEffectivePower(state, minion, baseIndex) <= 2)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${cardName(minion.defId)}（力量 ${getEffectivePower(state, minion, baseIndex)}）`,
        })));

    return buildMinionTargetOptions(candidates, {
        state,
        sourcePlayerId,
        sourceDefId: HAMMER_SLAMMER,
        sourceKind: 'nonAction',
        effectType: 'destroy',
    }).map(option => ({ ...option, displayMode: 'card' as const }));
}

function isHammerSlammerSourceValid(state: SmashUpCore, playerId: PlayerId, baseIndex: number, uid: string): boolean {
    const source = state.bases[baseIndex]?.minions.find(minion => minion.uid === uid);
    return source?.defId === HAMMER_SLAMMER && source.controller === playerId;
}

function hammerSlammerOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildHammerSlammerOptions(ctx.state, ctx.playerId);
    if (!ctx.matchState || options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `${HAMMER_SLAMMER_TARGET_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '重击者：选择要摧毁的力量 2 或更少的仆从',
        options,
        {
            sourceId: HAMMER_SLAMMER_TARGET_SOURCE_ID,
            targetType: 'minion',
            titleKey: 'ui.munchkin_orcs_hammer_slammer_target_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            autoResolveIfSingle: false,
            displayCard: { defId: HAMMER_SLAMMER, cardUid: ctx.cardUid },
        },
    );
    interaction.data = { ...interaction.data, sourceMinionUid: ctx.cardUid, sourceBaseIndex: ctx.baseIndex } satisfies HammerSlammerInteractionData & Record<string, unknown>;
    interaction.data.optionsGenerator = latestState => buildHammerSlammerOptions(latestState.core as SmashUpCore, ctx.playerId);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function topperChopperTalent(_ctx: AbilityContext): AbilityResult {
    return { events: [] };
}

function getPlayerPowers(state: SmashUpCore, baseIndex: number): Map<PlayerId, number> {
    const base = state.bases[baseIndex];
    if (!base) return new Map();
    const playersWithMinions = new Set(base?.minions.map(minion => minion.controller) ?? []);
    const powers = new Map<PlayerId, number>();
    for (const playerId of Object.keys(state.players) as PlayerId[]) {
        const power = getPlayerEffectivePowerOnBase(state, base, baseIndex, playerId);
        if (power > 0 || playersWithMinions.has(playerId)) powers.set(playerId, power);
    }
    return powers;
}

function andStayDownValidateUse(ctx: AbilityContext): string | null {
    const baseIndex = ctx.baseIndex;
    if (baseIndex === undefined) return '当前没有可计分基地';
    const powers = getPlayerPowers(ctx.state, baseIndex);
    const ownPower = powers.get(ctx.playerId) ?? 0;
    const highest = Math.max(0, ...powers.values());
    return ownPower >= highest && ownPower > 0 ? null : '你不是该基地的最高力量玩家';
}

function andStayDownSpecial(ctx: AbilityContext): AbilityResult {
    if (ctx.baseIndex === undefined) return { events: [] };
    return {
        events: [{
            type: SU_EVENTS.BASE_METADATA_UPDATED,
            payload: {
                baseIndex: ctx.baseIndex,
                metadataUpdate: {
                    andStayDownSuppressorPlayerId: ctx.playerId,
                    andStayDownTurnNumber: ctx.state.turnNumber,
                },
                reason: AND_STAY_DOWN,
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function isAndStayDownActive(base: SmashUpCore['bases'][number] | undefined, turnNumber: number): boolean {
    const until = base?.metadata?.andStayDownTurnNumber;
    return typeof until === 'number' && until >= turnNumber && typeof base?.metadata?.andStayDownSuppressorPlayerId === 'string';
}

function andStayDownSuppression(state: SmashUpCore): string[] {
    const suppressed = new Set<string>();
    for (const base of state.bases) {
        if (!isAndStayDownActive(base, state.turnNumber)) continue;
        const suppressor = base.metadata?.andStayDownSuppressorPlayerId as PlayerId;
        for (const minion of base.minions) {
            if (minion.controller === suppressor) continue;
            if (getCardDef(minion.defId)?.abilityTags?.includes('special')) suppressed.add(minion.uid);
            for (const attached of minion.attachedActions) {
                if (getCardDef(attached.defId)?.abilityTags?.includes('special')) suppressed.add(attached.uid);
            }
        }
    }
    return [...suppressed];
}

function andStayDownRestriction(ctx: RestrictionCheckContext): boolean {
    const activationWindow = ctx.extra?.activationWindow;
    if (activationWindow !== 'meFirst') return false;
    const activeBase = ctx.state.bases[ctx.baseIndex];
    if (!isAndStayDownActive(activeBase, ctx.state.turnNumber)) return false;
    return activeBase.metadata?.andStayDownSuppressorPlayerId !== ctx.playerId;
}

function angryPillagersValidateUse(ctx: AbilityContext): string | null {
    const baseIndex = ctx.baseIndex;
    if (baseIndex === undefined) return '当前没有可计分基地';
    const powers = [...getPlayerPowers(ctx.state, baseIndex).entries()].sort((a, b) => b[1] - a[1]);
    const ownIndex = powers.findIndex(([playerId]) => playerId === ctx.playerId);
    if (ownIndex < 0 || ownIndex > 0) return '你不是该基地的第一名';
    const second = powers[1]?.[1] ?? 0;
    return powers[0][1] >= second + 3 ? null : '你没有领先第二名至少 3 点力量';
}

function angryPillagersSpecial(ctx: AbilityContext): AbilityResult {
    if (ctx.baseIndex === undefined) return { events: [] };
    return {
        events: [{
            type: SU_EVENTS.VP_AWARDED,
            payload: { playerId: ctx.playerId, amount: 1, reason: ANGRY_PILLAGERS },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function buildCrushBaseOptions(state: SmashUpCore, playerId: PlayerId) {
    return state.bases.flatMap((base, baseIndex) => {
        const ownCount = base.minions.filter(minion => minion.controller === playerId).length;
        const hasPlayer = Object.keys(state.players).some(targetPlayerId => targetPlayerId !== playerId
            && base.minions.filter(minion => minion.controller === targetPlayerId).length > 0
            && base.minions.filter(minion => minion.controller === targetPlayerId).length < ownCount);
        return hasPlayer ? [{ baseIndex, label: baseName(base.defId) }] : [];
    });
}

function buildCrushPlayerOptions(state: SmashUpCore, playerId: PlayerId, baseIndex: number) {
    const base = state.bases[baseIndex];
    if (!base) return [];
    const ownCount = base.minions.filter(minion => minion.controller === playerId).length;
    return buildPlayerTargetOptions(
        Object.keys(state.players)
            .filter(targetPlayerId => targetPlayerId !== playerId)
            .filter(targetPlayerId => {
                const count = base.minions.filter(minion => minion.controller === targetPlayerId).length;
                return count > 0 && count < ownCount;
            })
            .map(targetPlayerId => ({
                label: `玩家 ${Number(targetPlayerId) + 1}`,
                targetPlayerId,
                value: { baseIndex },
            })),
        { state, sourcePlayerId: playerId, effectIntent: 'destroy' },
    );
}

function buildCrushMinionOptions(state: SmashUpCore, playerId: PlayerId, baseIndex: number, targetPlayerId: PlayerId) {
    const base = state.bases[baseIndex];
    if (!base) return [];
    return buildMinionTargetOptions(
        base.minions
            .filter(minion => minion.controller === targetPlayerId)
            .map(minion => ({ uid: minion.uid, defId: minion.defId, baseIndex, label: cardName(minion.defId) })),
        { state, sourcePlayerId: playerId, sourceDefId: CRUSH, sourceKind: 'action', effectType: 'destroy' },
    );
}

function crushOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildBaseTargetOptions(buildCrushBaseOptions(ctx.state, ctx.playerId), ctx.state);
    if (!ctx.matchState || options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<BaseChoice>(
        `${CRUSH_BASE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '挤碎：选择基地',
        options,
        { sourceId: CRUSH_BASE_SOURCE_ID, targetType: 'base', titleKey: 'ui.munchkin_orcs_crush_base_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: CRUSH, cardUid: ctx.cardUid } },
    );
    interaction.data = { ...interaction.data, sourceCardUid: ctx.cardUid } satisfies CrushInteractionData & Record<string, unknown>;
    interaction.data.optionsGenerator = latestState => buildBaseTargetOptions(buildCrushBaseOptions(latestState.core as SmashUpCore, ctx.playerId), latestState.core as SmashUpCore);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function deathBreathOptions(state: SmashUpCore, playerId: PlayerId) {
    return buildMinionTargetOptions(
        state.bases.flatMap((base, baseIndex) => base.minions
            .filter(minion => getEffectivePower(state, minion, baseIndex) <= 4)
            .map(minion => ({ uid: minion.uid, defId: minion.defId, baseIndex, label: `${cardName(minion.defId)}（力量 ${getEffectivePower(state, minion, baseIndex)}）` }))),
        { state, sourcePlayerId: playerId, sourceDefId: DEATH_BREATH, sourceKind: 'action', effectType: 'return' },
    );
}

function deathBreathOnPlay(ctx: AbilityContext): AbilityResult {
    const options = deathBreathOptions(ctx.state, ctx.playerId);
    if (!ctx.matchState || options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `${DEATH_BREATH_TARGET_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '死亡之息：选择力量 4 或更少的仆从',
        options,
        { sourceId: DEATH_BREATH_TARGET_SOURCE_ID, targetType: 'minion', titleKey: 'ui.munchkin_orcs_death_breath_target_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: DEATH_BREATH, cardUid: ctx.cardUid } },
    );
    interaction.data = { ...interaction.data, sourceCardUid: ctx.cardUid };
    interaction.data.optionsGenerator = latestState => deathBreathOptions(latestState.core as SmashUpCore, ctx.playerId);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function buildDogpileMinionOptions(state: SmashUpCore, playerId: PlayerId) {
    return buildMinionTargetOptions(
        state.bases.flatMap((base, baseIndex) => base.minions
            .filter(minion => minion.controller === playerId)
            .filter(() => state.bases.some((targetBase, targetBaseIndex) => targetBaseIndex !== baseIndex
                && targetBase.minions.filter(candidate => candidate.controller === playerId).length >= 2))
            .map(minion => ({ uid: minion.uid, defId: minion.defId, baseIndex, label: `${cardName(minion.defId)}（${baseName(base.defId)}）` }))),
        { state, sourcePlayerId: playerId, sourceDefId: DOGPILE, sourceKind: 'action', effectType: 'move' },
    );
}

function buildDogpileBaseOptions(state: SmashUpCore, playerId: PlayerId, sourceBaseIndex: number) {
    return buildBaseTargetOptions(
        state.bases.flatMap((base, baseIndex) => baseIndex !== sourceBaseIndex
            && base.minions.filter(minion => minion.controller === playerId).length >= 2
            ? [{ baseIndex, label: baseName(base.defId) }]
            : []),
        state,
    );
}

function dogpileOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildDogpileMinionOptions(ctx.state, ctx.playerId);
    if (!ctx.matchState || options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `${DOGPILE_MINION_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '狗堆：选择要移动的己方仆从',
        options,
        { sourceId: DOGPILE_MINION_SOURCE_ID, targetType: 'minion', titleKey: 'ui.munchkin_orcs_dogpile_minion_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: DOGPILE, cardUid: ctx.cardUid } },
    );
    interaction.data = { ...interaction.data, sourceCardUid: ctx.cardUid } satisfies DogpileInteractionData & Record<string, unknown>;
    interaction.data.optionsGenerator = latestState => buildDogpileMinionOptions(latestState.core as SmashUpCore, ctx.playerId);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function buildGimmeActionOptions(state: SmashUpCore, playerId: PlayerId) {
    const options: Array<{ id: string; label: string; value: AttachedActionChoice; displayMode: 'card'; _source: 'field' }> = [];
    for (const [baseIndex, base] of state.bases.entries()) {
        for (const host of base.minions) {
            if (!state.bases.some(candidateBase => candidateBase.minions.some(minion => minion.controller === playerId && minion.uid !== host.uid))) continue;
            for (const action of host.attachedActions) {
                options.push({
                    id: `munchkin-orcs-gimme-${action.uid}`,
                    label: `${cardName(action.defId)}（${cardName(host.defId)}）`,
                    value: { cardUid: action.uid, defId: action.defId, ownerId: action.ownerId, baseIndex },
                    displayMode: 'card',
                    _source: 'field',
                });
            }
        }
    }
    return options;
}

function gimmeOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildGimmeActionOptions(ctx.state, ctx.playerId);
    if (!ctx.matchState || options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<AttachedActionChoice>(
        `${GIMME_ACTION_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '给我！：先选择要转移的附着行动',
        options,
        { sourceId: GIMME_ACTION_SOURCE_ID, targetType: 'ongoing', titleKey: 'ui.munchkin_orcs_gimme_action_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: GIMME, cardUid: ctx.cardUid } },
    );
    interaction.data = { ...interaction.data, sourceCardUid: ctx.cardUid };
    interaction.data.optionsGenerator = latestState => buildGimmeActionOptions(latestState.core as SmashUpCore, ctx.playerId);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function buildOwnNewHostOptions(state: SmashUpCore, playerId: PlayerId, hostUid: string) {
    return buildMinionTargetOptions(
        state.bases.flatMap((base, baseIndex) => base.minions
            .filter(minion => minion.controller === playerId && minion.uid !== hostUid)
            .map(minion => ({ uid: minion.uid, defId: minion.defId, baseIndex, label: `${cardName(minion.defId)}（${baseName(base.defId)}）` }))),
        { state, sourcePlayerId: playerId, sourceDefId: GIMME, sourceKind: 'action', effectType: 'affect' },
    );
}

function buildStallingMinionOptions(state: SmashUpCore, playerId: PlayerId, baseIndex: number) {
    const base = state.bases[baseIndex];
    if (!base) return [];
    return buildMinionTargetOptions(
        base.minions.filter(minion => minion.controller === playerId)
            .map(minion => ({ uid: minion.uid, defId: minion.defId, baseIndex, label: cardName(minion.defId) })),
        { state, sourcePlayerId: playerId, sourceDefId: STALLING, sourceKind: 'nonAction' },
    );
}

function stallingCanTrigger(ctx: TriggerContext): boolean {
    if (ctx.sourceBaseIndex === undefined || ctx.sourceControllerId === undefined) return false;
    if (ctx.actionTargetBaseIndex !== ctx.sourceBaseIndex || ctx.playerId === ctx.sourceControllerId) return false;
    if (ctx.triggerCardUid === ctx.sourceCardUid || !ctx.triggerCardDefId) return false;
    return buildStallingMinionOptions(ctx.state, ctx.sourceControllerId, ctx.sourceBaseIndex ?? 0).length > 0;
}

function stallingTrigger(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || ctx.sourceBaseIndex === undefined || ctx.sourceControllerId === undefined || !ctx.triggerCardDefId) return [];
    const options = [
        ...buildStallingMinionOptions(ctx.state, ctx.sourceControllerId, ctx.sourceBaseIndex),
        createSkipOption('不保护', 'ui.munchkin_orcs_stalling_skip'),
    ];
    const interaction = createSimpleChoice<MinionChoice & { skip?: boolean }>(
        `${STALLING_MINION_SOURCE_ID}_${ctx.sourceCardUid ?? 'source'}_${ctx.triggerCardUid ?? 'card'}_${ctx.now}`,
        ctx.sourceControllerId,
        '洗手间：选择一个己方仆从不受这张牌影响，或跳过',
        options,
        { sourceId: STALLING_MINION_SOURCE_ID, targetType: 'minion', titleKey: 'ui.munchkin_orcs_stalling_minion_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: STALLING, cardUid: ctx.sourceCardUid } },
    );
    interaction.data = { ...interaction.data, sourceBaseIndex: ctx.sourceBaseIndex, protectedActionDefId: ctx.triggerCardDefId } satisfies StallingInteractionData & Record<string, unknown>;
    interaction.data.optionsGenerator = latestState => [
        ...buildStallingMinionOptions(latestState.core as SmashUpCore, ctx.sourceControllerId!, ctx.sourceBaseIndex!),
        createSkipOption('不保护', 'ui.munchkin_orcs_stalling_skip'),
    ];
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function stallingProtection(ctx: ProtectionCheckContext): boolean {
    return ctx.sourcePlayerId !== ctx.targetMinion.controller
        && ctx.sourceKind === 'action'
        && ctx.sourceDefId === ctx.targetMinion.metadata?.stallingProtectedActionDefId
        && ctx.state.turnNumber === ctx.targetMinion.metadata?.stallingProtectedTurnNumber;
}

function tooToughProtection(ctx: ProtectionCheckContext): boolean {
    return ctx.sourcePlayerId !== ctx.targetMinion.controller
        && ctx.targetMinion.attachedActions.some(action => action.defId === TOO_TOUGH);
}

function garrisonVpModifier(state: SmashUpCore, baseIndex: number, playerId: PlayerId): number {
    const base = state.bases[baseIndex];
    if (!base) return 0;
    const powers = [...getPlayerPowers(state, baseIndex).entries()].sort((a, b) => b[1] - a[1]);
    const totalPower = powers.reduce((sum, [, power]) => sum + power, 0);
    if (totalPower < 22 || powers.length === 0) return 0;

    // 与基础计分的并列名次口径一致：并列第三的玩家也属于前三名。
    const distinctPowers = [...new Set(powers.map(([, power]) => power))];
    const cutoffPower = distinctPowers[Math.min(2, distinctPowers.length - 1)];
    return powers.some(([candidate, power]) => candidate === playerId && power >= cutoffPower) ? 1 : 0;
}

export function registerMunchkinOrcsAbilities(): void {
    registerAbility(TOPPER_CHOPPER, 'talent', topperChopperTalent);
    registerAbility(HAMMER_SLAMMER, 'onPlay', hammerSlammerOnPlay);
    registerAbility(AND_STAY_DOWN, 'special', { execute: andStayDownSpecial, validateUse: andStayDownValidateUse });
    registerAbility(ANGRY_PILLAGERS, 'special', { execute: angryPillagersSpecial, validateUse: angryPillagersValidateUse });
    registerAbility(CRUSH, 'onPlay', crushOnPlay);
    registerAbility(DEATH_BREATH, 'onPlay', deathBreathOnPlay);
    registerAbility(DOGPILE, 'onPlay', dogpileOnPlay);
    registerAbility(DOGPILE, 'special', dogpileOnPlay);
    registerAbility(GIMME, 'onPlay', gimmeOnPlay);

    registerProtection(DORK_ORC, 'action', ctx => ctx.targetMinion.defId === DORK_ORC && ctx.targetMinion.controller !== ctx.sourcePlayerId);
    registerProtection(BASE_THE_PITS, 'action', ctx => ctx.state.bases[ctx.targetBaseIndex]?.defId === BASE_THE_PITS
        && ctx.sourcePlayerId !== ctx.targetMinion.controller);
    registerProtection(STALLING, 'action', stallingProtection);
    registerProtection(TOO_TOUGH, 'action', tooToughProtection);
    registerRestriction(AND_STAY_DOWN, 'play_action', andStayDownRestriction, { global: true });
    registerCardAbilitySuppression(AND_STAY_DOWN, andStayDownSuppression);
    registerBaseVpModifier(BASE_GARRISON, (state, baseIndex, playerId) => garrisonVpModifier(state, baseIndex, playerId));
    registerTrigger(STALLING, 'onActionPlayed', stallingTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
        canTrigger: stallingCanTrigger,
    });
}

export function registerMunchkinOrcsInteractionHandlers(): void {
    registerInteractionHandler(HAMMER_SLAMMER_TARGET_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as HammerSlammerInteractionData | undefined;
        const choice = value as MinionChoice | undefined;
        const chosenDefId = choice?.minionDefId ?? choice?.defId;
        if (!data?.sourceMinionUid || data.sourceBaseIndex === undefined || !choice?.minionUid || chosenDefId === undefined || choice.baseIndex === undefined) return { state, events: [] };
        if (!isHammerSlammerSourceValid(state.core, playerId, data.sourceBaseIndex, data.sourceMinionUid)) return { state, events: [] };
        const target = state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid && minion.defId === chosenDefId && getEffectivePower(state.core, minion, choice.baseIndex!) <= 2);
        if (!target) return { state, events: [] };
        return { state, events: buildValidatedDestroyEvents(state.core, { minionUid: target.uid, minionDefId: target.defId, fromBaseIndex: choice.baseIndex, destroyerId: playerId, reason: HAMMER_SLAMMER, now: timestamp, sourcePlayerId: playerId, sourceCardUid: data.sourceMinionUid, sourceDefId: HAMMER_SLAMMER, sourceControllerId: playerId, sourceBaseIndex: data.sourceBaseIndex, sourceKind: 'nonAction' }) };
    });

    registerInteractionHandler(CRUSH_BASE_SOURCE_ID, (state, playerId, value, data, _random, timestamp) => {
        const selected = value as BaseChoice | undefined;
        const source = data as CrushInteractionData | undefined;
        if (!source?.sourceCardUid || selected?.baseIndex === undefined) return { state, events: [] };
        const options = buildPlayerTargetOptions(buildCrushPlayerOptions(state.core, playerId, selected.baseIndex).map(option => ({ label: option.label, targetPlayerId: option.value.targetPlayerId, value: { baseIndex: selected.baseIndex } })), { state: state.core, sourcePlayerId: playerId, effectIntent: 'destroy' });
        if (options.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<PlayerChoice>(`${CRUSH_PLAYER_SOURCE_ID}_${source.sourceCardUid}_${timestamp}`, playerId, '挤碎：选择在该基地仆从更少的玩家', options, { sourceId: CRUSH_PLAYER_SOURCE_ID, targetType: 'player', titleKey: 'ui.munchkin_orcs_crush_player_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false });
        interaction.data = { ...interaction.data, sourceCardUid: source.sourceCardUid, baseIndex: selected.baseIndex } satisfies CrushInteractionData & Record<string, unknown>;
        interaction.data.optionsGenerator = latestState => buildPlayerTargetOptions(buildCrushPlayerOptions(latestState.core as SmashUpCore, playerId, selected.baseIndex!).map(option => ({ label: option.label, targetPlayerId: option.value.targetPlayerId, value: { baseIndex: selected.baseIndex } })), { state: latestState.core as SmashUpCore, sourcePlayerId: playerId, effectIntent: 'destroy' });
        const triggered = fireTriggers(state.core, 'onActionPlayed', {
            state: state.core,
            matchState: state,
            playerId,
            baseIndex: selected.baseIndex,
            actionTargetBaseIndex: selected.baseIndex,
            actionTargetType: 'base',
            triggerCardUid: source.sourceCardUid,
            triggerCardDefId: CRUSH,
            random: _random,
            now: timestamp,
        });
        const nextState = queueInteraction(triggered.matchState ?? state, interaction);
        return { state: nextState, events: triggered.events };
    });

    registerInteractionHandler(CRUSH_PLAYER_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const source = interactionData as CrushInteractionData | undefined;
        const selected = value as PlayerChoice | undefined;
        if (!source?.sourceCardUid || source.baseIndex === undefined || !selected?.targetPlayerId) return { state, events: [] };
        const options = buildCrushMinionOptions(state.core, playerId, source.baseIndex, selected.targetPlayerId);
        if (options.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<MinionChoice>(`${CRUSH_MINION_SOURCE_ID}_${source.sourceCardUid}_${timestamp}`, playerId, '挤碎：选择要摧毁的那个玩家的仆从', options, { sourceId: CRUSH_MINION_SOURCE_ID, targetType: 'minion', titleKey: 'ui.munchkin_orcs_crush_minion_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false });
        interaction.data = { ...interaction.data, sourceCardUid: source.sourceCardUid, baseIndex: source.baseIndex, targetPlayerId: selected.targetPlayerId } satisfies CrushInteractionData & Record<string, unknown>;
        interaction.data.optionsGenerator = latestState => buildCrushMinionOptions(latestState.core as SmashUpCore, playerId, source.baseIndex!, selected.targetPlayerId!);
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler(CRUSH_MINION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const source = interactionData as CrushInteractionData | undefined;
        const selected = value as MinionChoice | undefined;
        const defId = selected?.minionDefId ?? selected?.defId;
        if (!source?.sourceCardUid || source.baseIndex === undefined || !selected?.minionUid || selected.baseIndex === undefined || !defId) return { state, events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid && minion.defId === defId && minion.controller === source.targetPlayerId);
        if (!target) return { state, events: [] };
        return { state, events: buildValidatedDestroyEvents(state.core, { minionUid: target.uid, minionDefId: target.defId, fromBaseIndex: selected.baseIndex, destroyerId: playerId, reason: CRUSH, now: timestamp, sourcePlayerId: playerId, sourceCardUid: source.sourceCardUid, sourceDefId: CRUSH, sourceControllerId: playerId, sourceBaseIndex: source.baseIndex, sourceKind: 'action' }) };
    });

    registerInteractionHandler(DEATH_BREATH_TARGET_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const source = interactionData as { sourceCardUid?: string } | undefined;
        const selected = value as MinionChoice | undefined;
        if (!source?.sourceCardUid || !selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target || getEffectivePower(state.core, target, selected.baseIndex) > 4) return { state, events: [] };
        return { state, events: buildValidatedCardToDeckBottomEvents(state.core, { cardUid: target.uid, defId: target.defId, ownerId: target.owner, sourcePlayerId: playerId, sourceCardUid: source.sourceCardUid, sourceDefId: DEATH_BREATH, sourceControllerId: playerId, sourceBaseIndex: selected.baseIndex, locationPlayerId: target.owner, reason: DEATH_BREATH, now: timestamp, expectedLocation: 'bases' }) };
    });

    registerInteractionHandler(DOGPILE_MINION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const source = interactionData as DogpileInteractionData | undefined;
        const selected = value as MinionChoice | undefined;
        if (!source?.sourceCardUid || !selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid && minion.controller === playerId);
        if (!target) return { state, events: [] };
        const options = buildDogpileBaseOptions(state.core, playerId, selected.baseIndex);
        if (options.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<BaseChoice>(`${DOGPILE_BASE_SOURCE_ID}_${source.sourceCardUid}_${timestamp}`, playerId, '狗堆：选择至少有两个己方仆从的基地', options, { sourceId: DOGPILE_BASE_SOURCE_ID, targetType: 'base', titleKey: 'ui.munchkin_orcs_dogpile_base_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: DOGPILE, cardUid: source.sourceCardUid } });
        interaction.data = { ...interaction.data, sourceCardUid: source.sourceCardUid, sourceMinionUid: target.uid, sourceBaseIndex: selected.baseIndex } satisfies DogpileInteractionData & Record<string, unknown>;
        interaction.data.optionsGenerator = latestState => buildDogpileBaseOptions(latestState.core as SmashUpCore, playerId, selected.baseIndex!);
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler(DOGPILE_BASE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const source = interactionData as DogpileInteractionData | undefined;
        const selected = value as BaseChoice | undefined;
        if (!source?.sourceCardUid || !source.sourceMinionUid || source.sourceBaseIndex === undefined || selected?.baseIndex === undefined) return { state, events: [] };
        const target = state.core.bases[source.sourceBaseIndex]?.minions.find(minion => minion.uid === source.sourceMinionUid && minion.controller === playerId);
        if (!target || selected.baseIndex === source.sourceBaseIndex) return { state, events: [] };
        if ((state.core.bases[selected.baseIndex]?.minions.filter(minion => minion.controller === playerId).length ?? 0) < 2) return { state, events: [] };
        return { state, events: buildValidatedMoveEvents(state.core, { minionUid: target.uid, minionDefId: target.defId, fromBaseIndex: source.sourceBaseIndex, toBaseIndex: selected.baseIndex, reason: DOGPILE, now: timestamp, sourcePlayerId: playerId, sourceCardUid: source.sourceCardUid, sourceDefId: DOGPILE, sourceControllerId: playerId, sourceBaseIndex: source.sourceBaseIndex, sourceKind: 'action' }) };
    });

    registerInteractionHandler(GIMME_ACTION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const source = interactionData as GimmeInteractionData | undefined;
        const selected = value as AttachedActionChoice | undefined;
        if (!source?.sourceCardUid || !selected?.cardUid || !selected.defId || selected.baseIndex === undefined) return { state, events: [] };
        const host = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.attachedActions.some(action => action.uid === selected.cardUid));
        if (!host || !host.attachedActions.some(action => action.uid === selected.cardUid && action.defId === selected.defId)) return { state, events: [] };
        const newHosts = buildOwnNewHostOptions(state.core, playerId, host.uid);
        if (newHosts.length === 0) return { state, events: [] };
        const destroyEvents = buildValidatedDestroyEvents(state.core, { minionUid: host.uid, minionDefId: host.defId, fromBaseIndex: selected.baseIndex, destroyerId: playerId, reason: GIMME, now: timestamp, sourcePlayerId: playerId, sourceCardUid: source.sourceCardUid, sourceDefId: GIMME, sourceControllerId: playerId, sourceBaseIndex: selected.baseIndex, sourceKind: 'action' });
        if (!destroyEvents.some(event => event.type === SU_EVENTS.MINION_DESTROYED)) return { state, events: destroyEvents };
        const interaction = createSimpleChoice<MinionChoice>(`${GIMME_MINION_SOURCE_ID}_${source.sourceCardUid}_${selected.cardUid}_${timestamp}`, playerId, '给我！：再选择你的新宿主随从', newHosts, { sourceId: GIMME_MINION_SOURCE_ID, targetType: 'minion', titleKey: 'ui.munchkin_orcs_gimme_minion_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: GIMME, cardUid: source.sourceCardUid } });
        interaction.data = { ...interaction.data, sourceCardUid: source.sourceCardUid, actionUid: selected.cardUid, actionDefId: selected.defId, actionOwnerId: selected.ownerId, hostUid: host.uid, hostBaseIndex: selected.baseIndex } satisfies GimmeInteractionData & Record<string, unknown>;
        interaction.data.optionsGenerator = latestState => buildOwnNewHostOptions(latestState.core as SmashUpCore, playerId, host.uid);
        return { state: queueInteraction(state, interaction), events: destroyEvents };
    });

    registerInteractionHandler(GIMME_MINION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const source = interactionData as GimmeInteractionData | undefined;
        const selected = value as MinionChoice | undefined;
        if (!source?.sourceCardUid || !source.actionUid || !source.actionDefId || !source.actionOwnerId || !selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid && minion.controller === playerId && minion.uid !== source.hostUid);
        if (!target) return { state, events: [] };
        return {
            state,
            events: buildSemanticOngoingAttachEvents(state.core, { cardUid: source.actionUid, defId: source.actionDefId, ownerId: source.actionOwnerId, sourcePlayerId: playerId, sourceKind: 'action', targetBaseIndex: selected.baseIndex, targetMinionUid: target.uid, onBlockedSourceDestination: 'discard', now: timestamp }),
        };
    });

    registerInteractionHandler(STALLING_MINION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const source = interactionData as StallingInteractionData | undefined;
        const selected = value as (MinionChoice & { skip?: boolean }) | undefined;
        if (selected?.skip) return { state, events: [] };
        if (source?.sourceBaseIndex === undefined || !selected?.minionUid || selected.baseIndex !== source.sourceBaseIndex || !source.protectedActionDefId) return { state, events: [] };
        const target = state.core.bases[source.sourceBaseIndex]?.minions.find(minion => minion.uid === selected.minionUid && minion.controller === playerId);
        if (!target) return { state, events: [] };
        return {
            state,
            events: [{
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: { minionUid: target.uid, baseIndex: source.sourceBaseIndex, metadataUpdate: { stallingProtectedActionDefId: source.protectedActionDefId, stallingProtectedTurnNumber: state.core.turnNumber }, reason: STALLING },
                timestamp,
            } as SmashUpEvent],
        };
    });
}
