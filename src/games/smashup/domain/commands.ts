/**
 * 大杀四方 (Smash Up) - 命令验证
 */

import type { MatchState, ValidationResult } from '../../../engine/types';
import type {
    SmashUpCommand,
    SmashUpCore,
    ActionCardDef,
    FusionCardDef,
    PlayConstraint,
    SmashUpActivationKind,
    SmashUpActivationWindow,
} from './types';
import { SU_COMMANDS, getCurrentPlayerId, HAND_LIMIT } from './types';
import { getCardDef, getFusionDef, getMinionDef, getMinionLikePower, getTitanDef } from '../data/cards';
import { isOperationRestricted } from './ongoingEffects';
import {
    getScoringEligibleBaseIndices,
    getPlayerEffectivePowerOnBase,
} from './ongoingModifiers';
import { canPlayActionFromDiscard } from './discardActionPlayability';
import { canPlayFromDiscard } from './discardPlayability';
import { canActivateSpecialFromDiscard } from './discardSpecialAbilities';
import { getTitanByUid, isSpecialLimitBlocked } from './abilityHelpers';
import { canUseActiveBaseAbility, getActiveBaseAbilityOptions, hasActiveBaseAbility, type BaseAbilityContext } from './baseAbilities';
import {
    getActionPlayTargetMode,
    getActionPlayRestrictionError,
    validateActionPlaySemantics,
    validateDiscardMinionPlaySemantics,
} from './playLegality';
import { resolveOngoingActivation, resolveSpecial, resolveTalent, validateSpecialUse, validateTalentUse } from './abilityRegistry';
import { validateTitanOngoingActivation, validateTitanSpecialActivation, validateTitanTalentUse } from './titanAbilityValidators';
import { getCardActivatableAbilities, hasCardActivatableAbility } from './activationMetadata';
import { getMunchkinSpecialCardDescriptor } from '../data/factions/munchkin';
import {
    actionLikeNeedsResponseWindowBase,
    canCardBePlayedInResponseWindowForMatchState,
    getActionLikeResponseWindowTiming,
    canUseBaseLimitedMinionQuota,
    canUseSameNameMinionQuota,
    getMaxRemainingBaseLimitedPowerQuota,
    getMaxRemainingGlobalPowerLimitedQuota,
    getResponseWindowPlayableBaseIndicesForMatchState,
    isMinionLikeRespondableInWindow,
    isSameNameDefId,
    mustUseBaseLimitedMinionQuota,
    mustUseGlobalPowerLimitedMinionQuota,
} from './utils';
import { isCardActionLike, isCardMinionLike } from './utils';
import { getSmashUpReactionWindowContext, hasBlockingLegacyResponseWindow } from './reactionWindowState';
import { isSmashUpDiyFaction } from './ids';

type TitanAbilityKind = SmashUpActivationKind;
const POD_FACTION_SUFFIX = '_pod';

function normalizeFactionSelectionId(factionId: string): string {
    return factionId.endsWith(POD_FACTION_SUFFIX)
        ? factionId.slice(0, -POD_FACTION_SUFFIX.length)
        : factionId;
}

function buildFactionSelectionIdentitySet(factionIds: Iterable<string>): Set<string> {
    const identities = new Set<string>();
    for (const factionId of factionIds) {
        identities.add(normalizeFactionSelectionId(factionId));
    }
    return identities;
}

function getCurrentManualActivationWindow(state: MatchState<SmashUpCore>): SmashUpActivationWindow {
    if (state.sys.phase !== 'scoreBases') return 'playCards';
    const turnOrder = state.core.turnOrder ?? [];
    const legacyQueue = state.sys.responseWindow?.current?.responderQueue ?? [];
    if (legacyQueue.some((playerId) => !turnOrder.includes(playerId))) {
        return 'playCards';
    }
    const reactionWindow = getSmashUpReactionWindowContext(state);
    if (reactionWindow?.windowType === 'meFirst') return 'beforeScoring';
    if (reactionWindow?.windowType === 'afterScoring') return 'afterScoring';
    return getAfterScoringSourceBaseIndex(state) !== undefined ? 'afterScoring' : 'beforeScoring';
}

function getManualSpecialAvailability(
    defId: string,
    options: {
        zone: 'board' | 'discard' | 'setaside' | 'hand';
        window: SmashUpActivationWindow;
        face?: 'minion' | 'action';
    },
): {
    hasSpecialActivation: boolean;
    hasSpecialExecutor: boolean;
} {
    return {
        hasSpecialActivation: hasCardActivatableAbility(
            defId,
            { kind: 'special', zone: options.zone, window: options.window },
            options.face ? { face: options.face } : {},
        ),
        hasSpecialExecutor: Boolean(resolveSpecial(defId)),
    };
}

function getAfterScoringSourceBaseIndex(state: MatchState<SmashUpCore>): number | undefined {
    const reactionWindow = getSmashUpReactionWindowContext(state);
    if (reactionWindow?.windowType !== 'afterScoring') return undefined;
    return typeof reactionWindow.sourceBaseIndex === 'number' ? reactionWindow.sourceBaseIndex : undefined;
}

export function getManualSpecialScoringBaseIndices(
    state: MatchState<SmashUpCore>,
): number[] {
    if (state.sys.phase !== 'scoreBases') {
        return [];
    }

    const reactionWindow = getSmashUpReactionWindowContext(state);
    if (reactionWindow?.windowType === 'meFirst' && typeof reactionWindow.sourceBaseIndex === 'number') {
        return [reactionWindow.sourceBaseIndex];
    }

    const afterScoringSourceBaseIndex = getAfterScoringSourceBaseIndex(state);
    if (afterScoringSourceBaseIndex !== undefined) {
        return [afterScoringSourceBaseIndex];
    }

    return getScoringEligibleBaseIndices(state.core);
}

function validateManualSpecialScoringBase(
    state: MatchState<SmashUpCore>,
    baseIndex: number,
    defIdOrSourceScope?: string | 'anyBase',
): ValidationResult | undefined {
    if (state.sys.phase !== 'scoreBases') {
        return undefined;
    }

    const afterScoringSourceBaseIndex = getAfterScoringSourceBaseIndex(state);
    if (afterScoringSourceBaseIndex !== undefined) {
        if (baseIndex !== afterScoringSourceBaseIndex) {
            return { valid: false, error: 'afterScoring 只能选择当前正在结算的基地' };
        }
        return undefined;
    }

    const canSourceFromAnyBase = defIdOrSourceScope === 'anyBase'
        || (defIdOrSourceScope !== undefined
            && getCardActivatableAbilities(defIdOrSourceScope).some(ability =>
                ability.kind === 'special'
                && ability.window === 'beforeScoring'
                && ability.sourceScope === 'anyBase'));
    const eligibleIndices = getManualSpecialScoringBaseIndices(state);
    if (!canSourceFromAnyBase && !eligibleIndices.includes(baseIndex)) {
        return { valid: false, error: '只能在达到临界点的基地上激活计分前特殊能力' };
    }

    if (hasBlockingLegacyResponseWindow(state)) {
        return { valid: false, error: 'Me First! 响应窗口仍在进行中' };
    }

    return undefined;
}

function resolveTitanAbilityLabel(kind: TitanAbilityKind): string {
    switch (kind) {
        case 'special':
            return '特殊能力';
        case 'talent':
            return '天赋能力';
        case 'ongoing':
            return '持续能力';
        default:
            return '能力';
    }
}

function validateTitanAbility(
    state: MatchState<SmashUpCore>,
    command: { playerId: string; payload: { titanUid?: string; baseIndex: number } },
    kind: TitanAbilityKind,
): ValidationResult {
    const core = state.core;
    const { titanUid, baseIndex } = command.payload;
    if (!titanUid) return { valid: false, error: '必须指定泰坦' };
    if (baseIndex < 0 || baseIndex >= core.bases.length) {
        return { valid: false, error: '无效的基地索引' };
    }

    const titan = getTitanByUid(core, titanUid);
    if (!titan) return { valid: false, error: '该泰坦不存在' };

    const titanDef = getTitanDef(titan.defId);
    if (!titanDef) return { valid: false, error: '泰坦定义不存在' };

    const abilityLabel = resolveTitanAbilityLabel(kind);
    const activationZone = kind === 'special' ? 'setaside' : 'board';
    const activationWindow = kind === 'special' ? getCurrentManualActivationWindow(state) : 'playCards';
    if (!hasCardActivatableAbility(titan.defId, { kind, zone: activationZone, window: activationWindow })) {
        return { valid: false, error: `该泰坦的${abilityLabel}不能手动激活` };
    }

    if (kind === 'special') {
        if (!resolveSpecial(titan.defId)) {
            return { valid: false, error: '该泰坦的特殊能力不能手动激活' };
        }
        if (titan.location.zone !== 'setaside') {
            return { valid: false, error: '该泰坦当前不在牌库旁' };
        }
        if (titan.controllerId !== command.playerId) {
            return { valid: false, error: '只能激活自己控制的泰坦特殊能力' };
        }
    } else {
        if (titan.location.zone !== 'base') {
            return { valid: false, error: '该泰坦当前不在场' };
        }
        if (titan.controllerId !== command.playerId) {
            return { valid: false, error: `只能使用自己控制的泰坦${abilityLabel}` };
        }
    }

    if (kind === 'talent' && !resolveTalent(titan.defId)) {
        return { valid: false, error: '该泰坦的天赋不能手动激活' };
    }
    if (kind === 'ongoing' && !resolveOngoingActivation(titan.defId)) {
        return { valid: false, error: '该泰坦的持续能力不能手动激活' };
    }
    if (kind === 'ongoing' && (core.titanOngoingSuppressedUntilTurnEnd ?? []).includes(titan.uid)) {
        return { valid: false, error: '该泰坦的持续能力已被压制' };
    }

    const ctx = { state: core, playerId: command.playerId, titan, titanDef, baseIndex };
    const error = kind === 'special'
        ? validateTitanSpecialActivation(ctx)
        : kind === 'talent'
            ? validateTitanTalentUse(ctx)
            : validateTitanOngoingActivation(ctx);
    if (error) return { valid: false, error };

    if (kind === 'special') {
        return validateSpecialUse({
            state: core,
            matchState: state,
            playerId: command.playerId,
            cardUid: titan.uid,
            defId: titan.defId,
            baseIndex,
            random: { random: () => Math.random(), d: () => 1, range: (min: number) => min, shuffle: <T>(arr: T[]) => [...arr] },
            now: core.turnNumber ?? 0,
        });
    }
    if (kind === 'talent') {
        return validateTalentUse({
            state: core,
            matchState: state,
            playerId: command.playerId,
            cardUid: titan.uid,
            defId: titan.defId,
            baseIndex,
            random: { random: () => Math.random(), d: () => 1, range: (min: number) => min, shuffle: <T>(arr: T[]) => [...arr] },
            now: core.turnNumber ?? 0,
        });
    }
    return { valid: true };
}

function hasActiveBearNecessitiesPodRestriction(core: SmashUpCore, playerId: string): boolean {
    for (const base of core.bases) {
        const hasPlayerMinion = base.minions.some(minion => minion.controller === playerId);
        if (!hasPlayerMinion) continue;
        const hasOpponentActivePod = base.ongoingActions.some(ongoing =>
            ongoing.defId === 'bear_cavalry_bear_necessities_pod'
            && (((ongoing.metadata as { sourceControllerId?: string } | undefined)?.sourceControllerId ?? ongoing.ownerId) !== playerId)
            && ongoing.talentUsed === true,
        );
        if (hasOpponentActivePod) return true;
    }
    return false;
}

function hasActivePrincessesElizaRestriction(core: SmashUpCore, playerId: string): boolean {
    for (const base of core.bases) {
        const hasOpponentEliza = base.minions.some(minion =>
            (minion.defId === 'princesses_eliza' || minion.defId === 'princesses_eliza_pod')
            && minion.controller !== playerId,
        );
        if (hasOpponentEliza) return true;
    }
    return false;
}

function isExtraMinionPlayAttempt(
    core: SmashUpCore,
    playerId: string,
    baseIndex: number,
    cardDefId: string,
    basePower: number,
    fromDiscard: boolean,
    consumesNormalLimit: boolean,
): boolean {
    const player = core.players[playerId];
    if (!player) return false;
    const globalQuotaRemaining = player.minionLimit - player.minionsPlayed;
    if (fromDiscard && consumesNormalLimit === false) return true;
    if (player.minionsPlayed >= 1) return true;
    if (globalQuotaRemaining <= 0) {
        if (canUseBaseLimitedMinionQuota(core, player, baseIndex, cardDefId, basePower)) return true;
        if (canUseSameNameMinionQuota(player, cardDefId)) return true;
    }
    if (mustUseBaseLimitedMinionQuota(core, player, baseIndex, cardDefId, basePower)) return true;
    if (mustUseGlobalPowerLimitedMinionQuota(core, player, baseIndex, cardDefId, basePower)) return true;
    return false;
}

function isExtraActionPlayAttempt(core: SmashUpCore, playerId: string): boolean {
    const player = core.players[playerId];
    if (!player) return false;
    return player.actionsPlayed >= 1;
}

export function validate(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand
): ValidationResult {
    const core = state.core;
    const currentPlayerId = getCurrentPlayerId(core);
    const phase = state.sys.phase;
    const reactionWindow = getSmashUpReactionWindowContext(state);

    // 防御性检查：确保 command 和 type 存在
    if (!command || typeof command.type !== 'string') {
        return { valid: false, error: 'invalid_command_missing_type' };
    }

    // 系统命令（SYS_ 前缀）由引擎层处理，领域层直接放行
    if (command.type.startsWith('SYS_')) {
        return { valid: true };
    }

    switch (command.type) {
        case SU_COMMANDS.PLAY_MINION: {
            // meFirst 响应窗口期间：允许从手牌打出 beforeScoringPlayable 随从到即将计分的基地
            if (reactionWindow?.windowType === 'meFirst') {
                const currentResponderId = reactionWindow.activePlayerId;
                if (command.playerId !== currentResponderId) {
                    return { valid: false, error: '等待对方响应' };
                }
                const mfPlayer = core.players[command.playerId];
                if (!mfPlayer) return { valid: false, error: '玩家不存在' };
                const mfCard = mfPlayer.hand.find(c => c.uid === command.payload.cardUid);
                if (!mfCard) return { valid: false, error: '手牌中没有该卡牌' };
                if (!isCardMinionLike(mfCard)) return { valid: false, error: '该卡牌不是随从' };
                if (!isMinionLikeRespondableInWindow(mfCard.defId, 'meFirst')) {
                    return { valid: false, error: '该随从不能在基地计分前打出' };
                }
                const mfBaseIndex = command.payload.baseIndex;
                if (mfBaseIndex < 0 || mfBaseIndex >= core.bases.length) {
                    return { valid: false, error: '无效的基地索引' };
                }
                const mfEligible = getResponseWindowPlayableBaseIndicesForMatchState(state, mfCard.defId, 'meFirst');
                if (!mfEligible.includes(mfBaseIndex)) {
                    return { valid: false, error: '只能打出到即将计分的基地' };
                }
                const mfMinionDef = getMinionDef(mfCard.defId);
                const mfFusionDef = getFusionDef(mfCard.defId);
                const mfBasePower = getMinionLikePower(mfCard.defId) ?? 0;
                if (isOperationRestricted(core, mfBaseIndex, command.playerId, 'play_minion', {
                    minionDefId: mfCard.defId,
                    basePower: mfBasePower,
                    usesBaseLimitedMinionQuota: false,
                    cardUid: mfCard.uid,
                    fromDiscard: false,
                    activationWindow: 'meFirst',
                })) {
                    return { valid: false, error: '该基地禁止打出该随从' };
                }
                const mfConstraint = mfMinionDef?.playConstraint ?? mfFusionDef?.minionPlayConstraint;
                if (mfConstraint) {
                    const constraintError = checkPlayConstraint(mfConstraint, core, mfBaseIndex, command.playerId);
                    if (constraintError) return { valid: false, error: constraintError };
                }
                return { valid: true };
            }

            if (phase !== 'playCards') {
                return { valid: false, error: '只能在出牌阶段打出随从' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const player = core.players[command.playerId];
            if (!player) return { valid: false, error: '玩家不存在' };

            const { baseIndex, fromDiscard, fromDeck, fromStored, playAsAction, replacementHandCardUid } = command.payload;
            if (baseIndex < 0 || baseIndex >= core.bases.length) {
                return { valid: false, error: '无效的基地索引' };
            }
            const externalSourceCount = [fromDiscard, fromDeck, fromStored].filter(Boolean).length;
            if (externalSourceCount > 1) {
                return { valid: false, error: '不能同时从多个外部区域打出随从' };
            }

            if (replacementHandCardUid) {
                if (externalSourceCount > 0 || playAsAction === true) {
                    return { valid: false, error: '跳舞企鹅只能替代普通手牌随从打出' };
                }
                if (replacementHandCardUid === command.payload.cardUid) {
                    return { valid: false, error: '跳舞企鹅不能替代自己' };
                }
                const originalCard = player.hand.find(c => c.uid === command.payload.cardUid);
                if (!originalCard) return { valid: false, error: '手牌中没有要被替代的随从' };
                if (!isCardMinionLike(originalCard)) return { valid: false, error: '要被替代的牌不是随从' };
                if (originalCard.defId === 'penguins_dancing_penguin') {
                    return { valid: false, error: '跳舞企鹅只能替代其他随从' };
                }
                const replacementCard = player.hand.find(c => c.uid === replacementHandCardUid);
                if (!replacementCard) return { valid: false, error: '手牌中没有跳舞企鹅' };
                if (replacementCard.defId !== 'penguins_dancing_penguin' || !isCardMinionLike(replacementCard)) {
                    return { valid: false, error: '替代牌必须是跳舞企鹅' };
                }
                const originalValidation = validate(state, {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: command.playerId,
                    payload: { cardUid: originalCard.uid, baseIndex },
                });
                if (!originalValidation.valid) return originalValidation;
                const replacementValidation = validate(state, {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: command.playerId,
                    payload: { cardUid: replacementCard.uid, baseIndex },
                });
                if (!replacementValidation.valid) {
                    return { valid: false, error: replacementValidation.error ?? '跳舞企鹅不能打到该基地' };
                }
                return { valid: true };
            }

            // 从弃牌堆打出：通过 discardPlayability 模块验证
            if (fromDiscard) {
                const discardCheck = canPlayFromDiscard(core, command.playerId, command.payload.cardUid, baseIndex);
                if (!discardCheck) {
                    return { valid: false, error: '该卡牌不能从弃牌堆打出到此基地' };
                }
                // 限制检查
                const discardCard = player.discard.find(c => c.uid === command.payload.cardUid);
                if (!discardCard || !isCardMinionLike(discardCard)) {
                    return { valid: false, error: '弃牌堆中没有该随从' };
                }
                const basePower = getMinionLikePower(discardCard.defId) ?? 0;
                const discardSemantics = validateDiscardMinionPlaySemantics(core, command.playerId, {
                    cardUid: discardCard.uid,
                    baseIndex,
                    consumesNormalLimit: discardCheck.consumesNormalLimit,
                });
                if (!discardSemantics.valid) return discardSemantics;
                const blockedByBearNecessitiesPod = hasActiveBearNecessitiesPodRestriction(core, command.playerId)
                    && isExtraMinionPlayAttempt(
                        core,
                        command.playerId,
                        baseIndex,
                        discardCard.defId,
                        basePower,
                        true,
                        discardCheck.consumesNormalLimit,
                    );
                if (blockedByBearNecessitiesPod) {
                    return { valid: false, error: '受黑熊口粮POD限制：你不能打出额外牌' };
                }
                const blockedByEliza = hasActivePrincessesElizaRestriction(core, command.playerId)
                    && (player.extraCardsPlayedThisTurn ?? 0) >= 1
                    && isExtraMinionPlayAttempt(
                        core,
                        command.playerId,
                        baseIndex,
                        discardCard.defId,
                        basePower,
                        true,
                        discardCheck.consumesNormalLimit,
                    );
                if (blockedByEliza) {
                    return { valid: false, error: '受伊莱莎限制：你本回合不能再打出额外牌' };
                }
                const usesBaseLimitedMinionQuota = discardCheck.consumesNormalLimit
                    && mustUseBaseLimitedMinionQuota(core, player, baseIndex, discardCard.defId, basePower);
                if (isOperationRestricted(core, baseIndex, command.playerId, 'play_minion', {
                    minionDefId: discardCard.defId,
                    basePower,
                    usesBaseLimitedMinionQuota,
                    cardUid: discardCard.uid,
                    fromDiscard: true,
                })) {
                    return { valid: false, error: '该基地禁止打出该随从' };
                }
                return { valid: true };
            }

            if (fromDeck) {
                const deckCard = player.deck.find(c => c.uid === command.payload.cardUid);
                if (!deckCard) return { valid: false, error: '牌库中没有该随从' };
                if (!isCardMinionLike(deckCard)) return { valid: false, error: '该牌库牌不是随从' };
                const deckMinionDef = getMinionDef(deckCard.defId);
                const deckFusionDef = getFusionDef(deckCard.defId);
                const deckBasePower = (deckMinionDef?.power ?? deckFusionDef?.minionPower) ?? 0;
                const blockedByBearNecessitiesPod = hasActiveBearNecessitiesPodRestriction(core, command.playerId)
                    && isExtraMinionPlayAttempt(
                        core,
                        command.playerId,
                        baseIndex,
                        deckCard.defId,
                        deckBasePower,
                        false,
                        false,
                    );
                if (blockedByBearNecessitiesPod) {
                    return { valid: false, error: '受黑熊口粮POD限制：你不能打出额外牌' };
                }
                const blockedByEliza = hasActivePrincessesElizaRestriction(core, command.playerId)
                    && (player.extraCardsPlayedThisTurn ?? 0) >= 1
                    && isExtraMinionPlayAttempt(
                        core,
                        command.playerId,
                        baseIndex,
                        deckCard.defId,
                        deckBasePower,
                        false,
                        false,
                    );
                if (blockedByEliza) {
                    return { valid: false, error: '受伊莱莎限制：你本回合不能再打出额外牌' };
                }
                if (isOperationRestricted(core, baseIndex, command.playerId, 'play_minion', {
                    minionDefId: deckCard.defId,
                    basePower: deckBasePower,
                    usesBaseLimitedMinionQuota: false,
                    cardUid: deckCard.uid,
                    fromDiscard: false,
                })) {
                    return { valid: false, error: '该基地禁止打出该随从' };
                }
                const deckConstraint = deckMinionDef?.playConstraint ?? deckFusionDef?.minionPlayConstraint;
                if (deckConstraint) {
                    const constraintError = checkPlayConstraint(deckConstraint, core, baseIndex, command.playerId);
                    if (constraintError) return { valid: false, error: constraintError };
                }
                return { valid: true };
            }

            if (fromStored) {
                const storedCard = player.storedCards?.find(c => c.uid === command.payload.cardUid);
                if (!storedCard) return { valid: false, error: '暂存区中没有该随从' };
                if (!isCardMinionLike(storedCard)) return { valid: false, error: '该暂存牌不是随从' };
                if ((storedCard.counters ?? 0) > 0) return { valid: false, error: '该停滞牌仍有停滞指示物' };
                const storedMinionDef = getMinionDef(storedCard.defId);
                const storedFusionDef = getFusionDef(storedCard.defId);
                const storedBasePower = (storedMinionDef?.power ?? storedFusionDef?.minionPower) ?? 0;
                const blockedByBearNecessitiesPod = hasActiveBearNecessitiesPodRestriction(core, command.playerId)
                    && isExtraMinionPlayAttempt(
                        core,
                        command.playerId,
                        baseIndex,
                        storedCard.defId,
                        storedBasePower,
                        false,
                        false,
                    );
                if (blockedByBearNecessitiesPod) {
                    return { valid: false, error: '受黑熊口粮POD限制：你不能打出额外牌' };
                }
                const blockedByEliza = hasActivePrincessesElizaRestriction(core, command.playerId)
                    && (player.extraCardsPlayedThisTurn ?? 0) >= 1
                    && isExtraMinionPlayAttempt(
                        core,
                        command.playerId,
                        baseIndex,
                        storedCard.defId,
                        storedBasePower,
                        false,
                        false,
                    );
                if (blockedByEliza) {
                    return { valid: false, error: '受伊莱莎限制：你本回合不能再打出额外牌' };
                }
                if (isOperationRestricted(core, baseIndex, command.playerId, 'play_minion', {
                    minionDefId: storedCard.defId,
                    basePower: storedBasePower,
                    usesBaseLimitedMinionQuota: false,
                    cardUid: storedCard.uid,
                    fromDiscard: false,
                })) {
                    return { valid: false, error: '该基地禁止打出该随从' };
                }
                const storedConstraint = storedMinionDef?.playConstraint ?? storedFusionDef?.minionPlayConstraint;
                if (storedConstraint) {
                    const constraintError = checkPlayConstraint(storedConstraint, core, baseIndex, command.playerId);
                    if (constraintError) return { valid: false, error: constraintError };
                }
                return { valid: true };
            }

            const card = player.hand.find(c => c.uid === command.payload.cardUid);
            if (!card) return { valid: false, error: '手牌中没有该卡牌' };
            if (!isCardMinionLike(card)) return { valid: false, error: '该卡牌不是随从' };
            const minionDef = getMinionDef(card.defId);
            const fusionDef = getFusionDef(card.defId);
            const basePower = (minionDef?.power ?? fusionDef?.minionPower) ?? 0;

            if (playAsAction === true) {
                if (!minionDef?.playAsAction) {
                    return { valid: false, error: '该随从不能替代行动额度打出' };
                }
                const actionRestrictionError = getActionPlayRestrictionError(core, command.playerId);
                if (actionRestrictionError) {
                    return { valid: false, error: actionRestrictionError };
                }
                if (player.actionsPlayed >= player.actionLimit) {
                    return { valid: false, error: '本回合行动额度已用完' };
                }
            }

            // 正常手牌打出：全局额度 + 同名额度 + 基地限定额度
            const baseQuota = player.baseLimitedMinionQuota?.[baseIndex] ?? 0;
            const sameNameRemaining = player.sameNameMinionRemaining ?? 0;
            const globalQuotaRemaining = player.minionLimit - player.minionsPlayed;
            if (!playAsAction && globalQuotaRemaining <= 0 && sameNameRemaining <= 0 && baseQuota <= 0) {
                return { valid: false, error: '本回合随从额度已用完' };
            }
            const blockedByBearNecessitiesPod = hasActiveBearNecessitiesPodRestriction(core, command.playerId)
                && isExtraMinionPlayAttempt(
                    core,
                    command.playerId,
                    baseIndex,
                    card.defId,
                    basePower,
                    false,
                    true,
                );
            if (blockedByBearNecessitiesPod) {
                return { valid: false, error: '受黑熊口粮POD限制：你不能打出额外牌' };
            }
            const blockedByEliza = hasActivePrincessesElizaRestriction(core, command.playerId)
                && (player.extraCardsPlayedThisTurn ?? 0) >= 1
                && isExtraMinionPlayAttempt(
                    core,
                    command.playerId,
                    baseIndex,
                    card.defId,
                    basePower,
                    false,
                    true,
                );
            if (blockedByEliza) {
                return { valid: false, error: '受伊莱莎限制：你本回合不能再打出额外牌' };
            }
            const usesBaseLimitedMinionQuota = mustUseBaseLimitedMinionQuota(core, player, baseIndex, card.defId, basePower);
            // 同名额度检查：全局额度用完后，如果只剩同名额度，必须匹配已锁定的 defId
            if (!playAsAction && globalQuotaRemaining <= 0 && sameNameRemaining > 0 && baseQuota <= 0) {
                // 已锁定 defId 时，只能打出同名随从
                if (
                    player.sameNameMinionDefId !== null
                    && player.sameNameMinionDefId !== undefined
                    && !isSameNameDefId(card.defId, player.sameNameMinionDefId)
                ) {
                    return { valid: false, error: '额外出牌只能打出同名随从' };
                }
            }
            // 基地限定同名额度检查：全局额度和全局同名额度都用完后，使用基地限定额度时检查同名约束
            if (!playAsAction && usesBaseLimitedMinionQuota) {
                if (player.baseLimitedSameNameRequired?.[baseIndex]) {
                    // 必须与触发能力时的随从同名
                    const requiredDefId = player.baseLimitedSameNameDefId?.[baseIndex];
                    if (requiredDefId) {
                        if (!isSameNameDefId(card.defId, requiredDefId)) {
                            const requiredCard = getCardDef(requiredDefId);
                            const requiredName = requiredCard?.name ?? requiredDefId;
                            return { valid: false, error: `只能打出与触发能力的随从同名的随从（${requiredName}）` };
                        }
                    } else {
                        const hasSameNameOnBase = core.bases[baseIndex]?.minions.some(minion => isSameNameDefId(card.defId, minion.defId)) ?? false;
                        if (!hasSameNameOnBase) {
                            return { valid: false, error: '只能打出与该基地上某个随从同名的随从' };
                        }
                    }
                }
                if (!canUseBaseLimitedMinionQuota(core, player, baseIndex, card.defId, basePower)) {
                    const maxAllowedPower = getMaxRemainingBaseLimitedPowerQuota(player, baseIndex);
                    if (maxAllowedPower !== undefined && basePower > maxAllowedPower) {
                        return { valid: false, error: `额外出牌只能打出力量≤${maxAllowedPower}的随从` };
                    }
                    return { valid: false, error: '该基地禁止打出该随从' };
                }
            }
            // 全局力量限制检查：额外出牌机会可能有力量上限（如家园：力量≤2）
            if (!playAsAction && mustUseGlobalPowerLimitedMinionQuota(core, player, baseIndex, card.defId, basePower)) {
                const maxAllowedPower = getMaxRemainingGlobalPowerLimitedQuota(player);
                if (maxAllowedPower !== undefined && basePower > maxAllowedPower) {
                    return { valid: false, error: `额外出牌只能打出力量≤${maxAllowedPower}的随从` };
                }
            }
            // 限制检查：是否禁止打出随从到此基地（包括基地效果和 ongoing 效果）
            if (isOperationRestricted(core, baseIndex, command.playerId, 'play_minion', {
                minionDefId: card.defId,
                basePower,
                usesBaseLimitedMinionQuota,
                cardUid: card.uid,
                fromDiscard: false,
            })) {
                return { valid: false, error: '该基地禁止打出该随从' };
            }
            // 随从打出约束（数据驱动）
            const constraint = minionDef?.playConstraint ?? fusionDef?.minionPlayConstraint;
            if (constraint) {
                const constraintError = checkPlayConstraint(constraint, core, baseIndex, command.playerId);
                if (constraintError) return { valid: false, error: constraintError };
            }
            return { valid: true };
        }

        case SU_COMMANDS.PLAY_ACTION: {
            // 响应窗口期间：允许当前响应者打出特殊行动卡
            if (reactionWindow && (reactionWindow.windowType === 'meFirst' || reactionWindow.windowType === 'afterScoring')) {
                const currentResponderId = reactionWindow.activePlayerId;

                if (command.playerId !== currentResponderId) {
                    return { valid: false, error: '等待对方响应' };
                }
                const rPlayer = core.players[command.playerId];
                if (!rPlayer) {
                    return { valid: false, error: '玩家不存在' };
                }
                const rCard = rPlayer.hand.find(c => c.uid === command.payload.cardUid);
                if (!rCard) {
                    return { valid: false, error: '手牌中没有该卡牌' };
                }
                if (!isCardActionLike(rCard)) {
                    return { valid: false, error: '该卡牌不是行动卡' };
                }
                const rDef = getCardDef(rCard.defId) as ActionCardDef | FusionCardDef | undefined;
                if (!rDef) {
                    return { valid: false, error: '卡牌定义不存在' };
                }
                const responseTiming = getActionLikeResponseWindowTiming(rDef);
                if (!responseTiming) {
                    return { valid: false, error: '该行动卡不能在响应窗口中打出' };
                }
                
                if (reactionWindow.windowType === 'meFirst' && responseTiming !== 'beforeScoring') {
                    return { valid: false, error: '该卡牌只能在计分后打出' };
                }
                if (reactionWindow.windowType === 'afterScoring' && responseTiming !== 'afterScoring') {
                    return { valid: false, error: '该卡牌只能在计分前打出' };
                }

                const restrictionError = getActionPlayRestrictionError(core, command.playerId, rCard.defId);
                if (restrictionError) {
                    return { valid: false, error: restrictionError };
                }

                const targetBase = command.payload.targetBaseIndex;
                const targetMinionUid = command.payload.targetMinionUid;

                const targetMode = getActionPlayTargetMode(rDef);
                const needsBase = actionLikeNeedsResponseWindowBase(rDef);
                if (!canCardBePlayedInResponseWindowForMatchState(state, rCard, reactionWindow.windowType)) {
                    return { valid: false, error: '该行动卡当前没有可执行的响应目标' };
                }
                if (needsBase || targetMode === 'minion') {
                    if (typeof targetBase !== 'number' || !Number.isInteger(targetBase)) {
                        return { valid: false, error: '该行动卡需要选择一个达标基地' };
                    }
                    const targetBaseIndex = targetBase;
                    if (targetBaseIndex < 0 || targetBaseIndex >= core.bases.length) {
                        return { valid: false, error: '无效的基地索引' };
                    }

                    const eligibleIndices = getResponseWindowPlayableBaseIndicesForMatchState(
                        state,
                        rCard.defId,
                        reactionWindow.windowType,
                    );

                    if (!eligibleIndices.includes(targetBaseIndex)) {
                        return { valid: false, error: '只能选择达到临界点的基地' };
                    }

                    if (isOperationRestricted(core, targetBaseIndex, command.playerId, 'play_action', {
                        activationWindow: reactionWindow.windowType,
                    })) {
                        return { valid: false, error: '该基地计分时禁止其他玩家打出行动卡' };
                    }

                    // specialLimitGroup 检查：该基地本回合是否已使用过同组 special 能力
                    const isBlocked = isSpecialLimitBlocked(core, rCard.defId, targetBaseIndex);

                    if (isBlocked) {
                        return { valid: false, error: '该基地本回合已使用过同组特殊能力' };
                    }
                } else if (targetBase !== undefined) {
                    return { valid: false, error: '该行动卡不需要基地目标' };
                }

                if (targetMode === 'minion') {
                    if (!targetMinionUid) {
                        return { valid: false, error: '该行动卡需要选择目标随从' };
                    }
                    const targetBaseIndex = targetBase as number;
                    const semanticsValidation = validateActionPlaySemantics(core, command.playerId, {
                        defId: rCard.defId,
                        targetBaseIndex,
                        targetMinionUid,
                        effectiveHandSize: rPlayer.hand.length,
                    });
                    if (!semanticsValidation.valid) {
                        return semanticsValidation;
                    }
                } else if (targetMinionUid !== undefined) {
                    return { valid: false, error: '该行动卡不需要选择随从目标' };
                }

                return { valid: true };
            }

            if (phase !== 'playCards') {
                return { valid: false, error: '只能在出牌阶段打出行动卡' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const player = core.players[command.playerId];
            if (!player) return { valid: false, error: '玩家不存在' };
            if (hasActiveBearNecessitiesPodRestriction(core, command.playerId) && isExtraActionPlayAttempt(core, command.playerId)) {
                return { valid: false, error: '受黑熊口粮POD限制：你不能打出额外牌' };
            }
            if (
                hasActivePrincessesElizaRestriction(core, command.playerId)
                && (player.extraCardsPlayedThisTurn ?? 0) >= 1
                && isExtraActionPlayAttempt(core, command.playerId)
            ) {
                return { valid: false, error: '受伊莱莎限制：你本回合不能再打出额外牌' };
            }
            const fromDiscard = command.payload.fromDiscard === true;
            const fromStored = command.payload.fromStored === true;
            if (fromDiscard && fromStored) {
                return { valid: false, error: '不能同时从弃牌堆和暂存区打出行动卡' };
            }
            const card = fromStored
                ? player.storedCards?.find(c => c.uid === command.payload.cardUid)
                : fromDiscard
                ? player.discard.find(c => c.uid === command.payload.cardUid)
                : player.hand.find(c => c.uid === command.payload.cardUid);
            if (!card) {
                return {
                    valid: false,
                    error: fromStored ? '暂存区中没有该卡牌' : fromDiscard ? '弃牌堆中没有该卡牌' : '手牌中没有该卡牌',
                };
            }
            if (!isCardActionLike(card)) return { valid: false, error: '该卡牌不是行动卡' };
            if (fromStored && (card.counters ?? 0) > 0) {
                return { valid: false, error: '该停滞牌仍有停滞指示物' };
            }
            const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
            if (!def) return { valid: false, error: '卡牌定义不存在' };
            let discardActionPlay: ReturnType<typeof canPlayActionFromDiscard> | null = null;
            if (fromDiscard) {
                const targetBaseIndex = command.payload.targetBaseIndex;
                const targetMinionUid = command.payload.targetMinionUid;
                const targetMode = getActionPlayTargetMode(def);
                if (targetMode !== 'none' && typeof targetBaseIndex !== 'number') {
                    return { valid: false, error: '从弃牌堆打出该行动需要选择合法的基地目标' };
                }
                discardActionPlay = canPlayActionFromDiscard(core, command.playerId, card.uid, targetBaseIndex, targetMinionUid);
                if (!discardActionPlay) {
                    return { valid: false, error: '该行动当前不能从弃牌堆以该目标打出' };
                }
            }
            if (!fromStored && player.actionsPlayed >= player.actionLimit && (!fromDiscard || discardActionPlay?.consumesNormalLimit !== false)) {
                return { valid: false, error: '本回合行动额度已用完' };
            }
            return validateActionPlaySemantics(core, command.playerId, {
                defId: card.defId,
                targetBaseIndex: command.payload.targetBaseIndex,
                targetMinionUid: command.payload.targetMinionUid,
                effectiveHandSize: player.hand.length,
            });
        }

        case SU_COMMANDS.DISCARD_TO_LIMIT: {
            if (phase !== 'draw') {
                return { valid: false, error: '只能在抽牌阶段弃牌' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const player = core.players[command.playerId];
            if (!player) return { valid: false, error: '玩家不存在' };
            const excess = player.hand.length - HAND_LIMIT;
            if (excess <= 0) return { valid: false, error: '手牌未超过上限' };
            if (command.payload.cardUids.length !== excess) {
                return { valid: false, error: `需要弃掉 ${excess} 张牌` };
            }
            const handUids = new Set(player.hand.map(c => c.uid));
            for (const uid of command.payload.cardUids) {
                if (!handUids.has(uid)) {
                    return { valid: false, error: `手牌中不存在 uid=${uid}` };
                }
            }
            return { valid: true };
        }

        case SU_COMMANDS.SELECT_FACTION: {
            if (phase !== 'factionSelect') {
                return { valid: false, error: '只能在派系选择阶段选择派系' };
            }
            // Check turn order strictness
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const selection = core.factionSelection;
            if (!selection) return { valid: false, error: '派系选择状态未初始化' };

            const factionId = command.payload.factionId;
            if (isSmashUpDiyFaction(factionId) && !(core.enabledExpansions ?? ['titans', 'diy']).includes('diy')) {
                return { valid: false, error: '该 DIY 派系未开启' };
            }
            const factionIdentity = normalizeFactionSelectionId(factionId);
            const takenFactionIdentities = buildFactionSelectionIdentitySet(selection.takenFactions);
            if (takenFactionIdentities.has(factionIdentity)) {
                return { valid: false, error: '该派系已被选择' };
            }
            const playerSelections = selection.playerSelections[command.playerId] || [];
            const playerSelectionIdentities = buildFactionSelectionIdentitySet(playerSelections);
            if (playerSelectionIdentities.has(factionIdentity)) {
                return { valid: false, error: '该派系已被选择' };
            }
            if (playerSelections.length >= 2) {
                return { valid: false, error: '你已选择了两个派系' };
            }

            return { valid: true };
        }

        case SU_COMMANDS.DESELECT_FACTION: {
            if (phase !== 'factionSelect') {
                return { valid: false, error: '只能在派系选择阶段取消派系' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const selection = core.factionSelection;
            if (!selection) return { valid: false, error: '派系选择状态未初始化' };

            const factionId = command.payload.factionId;
            const playerSelections = selection.playerSelections[command.playerId] || [];
            if (!playerSelections.includes(factionId)) {
                return { valid: false, error: '尚未选择该派系' };
            }
            return { valid: true };
        }

        case SU_COMMANDS.SWAP_SEAT: {
            if (phase !== 'factionSelect') {
                return { valid: false, error: '只能在派系选择阶段换位' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const targetPlayerId = String(command.payload.targetPlayerId ?? '');
            if (!targetPlayerId) {
                return { valid: false, error: '目标座位无效' };
            }
            if (targetPlayerId === command.playerId) {
                return { valid: false, error: '不能与自己换位' };
            }
            if (!core.turnOrder.some((playerId) => playerId === targetPlayerId)) {
                return { valid: false, error: '目标玩家不存在' };
            }
            return { valid: true };
        }

        case SU_COMMANDS.USE_BASE_ABILITY: {
            if (phase !== 'playCards') {
                return { valid: false, error: '只能在出牌阶段使用基地能力' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const { baseIndex } = command.payload;
            const base = core.bases[baseIndex];
            if (!base) return { valid: false, error: '无效的基地索引' };

            if (!hasActiveBaseAbility(base.defId)) {
                return { valid: false, error: '该基地没有可主动使用的能力' };
            }

            const activeOptions = getActiveBaseAbilityOptions(base.defId);
            if (activeOptions?.oncePerTurn) {
                const used = core.usedBaseAbilitiesThisTurn ?? [];
                if (used.some(entry => entry.playerId === command.playerId && entry.baseIndex === baseIndex && entry.baseDefId === base.defId)) {
                    return { valid: false, error: '该基地能力本回合已使用' };
                }
            }

            const baseAbilityContext: BaseAbilityContext = {
                state: core,
                matchState: state,
                baseIndex,
                baseDefId: base.defId,
                playerId: command.playerId,
                now: core.turnNumber ?? 0,
            };
            const canUse = canUseActiveBaseAbility(base.defId, baseAbilityContext);
            if (!canUse) {
                return { valid: false, error: '当前不能使用该基地能力' };
            }

            return { valid: true };
        }

        case SU_COMMANDS.USE_TALENT: {
            if (phase !== 'playCards') {
                return { valid: false, error: '只能在出牌阶段使用天赋' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const { minionUid, ongoingCardUid, titanUid, baseIndex } = command.payload;
            const targetCount = [minionUid, ongoingCardUid, titanUid].filter(Boolean).length;
            if (targetCount !== 1) {
                return { valid: false, error: '蹇呴』涓旀墜鑳藉彧鑳芥寚瀹氫竴绉嶅ぉ璧嬬洰鏍?' };
            }
            if (titanUid) {
                return validateTitanAbility(state, command, 'talent');
            }
            const targetBase = core.bases[baseIndex];
            if (!targetBase) return { valid: false, error: '无效的基地索引' };

            if (ongoingCardUid) {
                // 先查基地 ongoingActions
                let ongoing = targetBase.ongoingActions.find(o => o.uid === ongoingCardUid);
                let attachedHostMinion = undefined as typeof targetBase.minions[number] | undefined;
                // 再查随从 attachedActions
                if (!ongoing) {
                    for (const m of targetBase.minions) {
                        const aa = m.attachedActions.find(a => a.uid === ongoingCardUid);
                        if (aa) {
                            ongoing = aa;
                            attachedHostMinion = m;
                            break;
                        }
                    }
                }
                if (!ongoing) return { valid: false, error: '基地上没有该持续行动卡' };
                const ongoingControllerId =
                    (ongoing.metadata as { sourceControllerId?: string } | undefined)?.sourceControllerId
                    ?? ongoing.ownerId;
                if (ongoingControllerId !== command.playerId) {
                    return { valid: false, error: '只能使用自己的持续行动卡天赋' };
                }
                if (ongoing.talentUsed) {
                    // 巨石阵例外：附着在己方随从上的持续行动卡天赋可额外使用一次
                    const canUseStandingStonesDoubleTalent =
                        Boolean(attachedHostMinion)
                        && targetBase.defId === 'base_standing_stones'
                        && attachedHostMinion?.controller === command.playerId
                        && !core.standingStonesDoubleTalentMinionUid;
                    const canUseSeastarDouble =
                        (ongoing.metadata as { mythicHorsesSeastarExtraTalent?: boolean; mythicHorsesSeastarExtraTalentConsumed?: boolean } | undefined)
                            ?.mythicHorsesSeastarExtraTalent === true
                        && (ongoing.metadata as { mythicHorsesSeastarExtraTalentConsumed?: boolean } | undefined)
                            ?.mythicHorsesSeastarExtraTalentConsumed !== true;
                    if (!canUseStandingStonesDoubleTalent && !canUseSeastarDouble) {
                        return { valid: false, error: '本回合天赋已使用' };
                    }
                }
                const oDef = getCardDef(ongoing.defId);
                if (!oDef || !('abilityTags' in oDef) || !oDef.abilityTags?.includes('talent')) {
                    return { valid: false, error: '该持续行动卡没有天赋能力' };
                }
                const talentValidation = validateTalentUse({
                    state: core,
                    matchState: state,
                    playerId: command.playerId,
                    cardUid: ongoingCardUid,
                    defId: ongoing.defId,
                    baseIndex,
                    random: { random: () => Math.random(), d: () => 1, range: (min: number) => min, shuffle: <T>(arr: T[]) => [...arr] },
                    now: core.turnNumber ?? 0,
                });
                if (!talentValidation.valid) {
                    return talentValidation;
                }
                return { valid: true };
            }

            // 随从天赋
            if (!minionUid) return { valid: false, error: '必须指定随从或持续行动卡' };
            const targetMinion = targetBase.minions.find(m => m.uid === minionUid);
            if (!targetMinion) return { valid: false, error: '基地上没有该随从' };
            if (targetMinion.controller !== command.playerId) {
                return { valid: false, error: '只能使用自己控制的随从的天赋' };
            }
            if (targetMinion.talentUsed) {
                // 巨石阵例外：允许一个随从每回合使用才能两次
                const isStandingStones = targetBase.defId === 'base_standing_stones';
                const doubleTalentAvailable = !core.standingStonesDoubleTalentMinionUid;
                const greatWolfSpirit = (core.titans ?? []).find(titan =>
                    titan.defId === 'werewolves_great_wolf_spirit'
                    && titan.location.zone === 'base'
                    && titan.controllerId === command.playerId
                    && !(core.titanOngoingSuppressedUntilTurnEnd ?? []).includes(titan.uid),
                );
                const greatWolfSpiritBaseIndex = greatWolfSpirit?.location.zone === 'base' ? greatWolfSpirit.location.baseIndex : undefined;
                const canUseGreatWolfSpiritDouble =
                    greatWolfSpiritBaseIndex === baseIndex
                    && !((core.greatWolfSpiritDoubleTalentCardUids ?? []).includes(minionUid));
                const canUseSeastarDouble =
                    targetMinion.metadata?.mythicHorsesSeastarExtraTalent === true
                    && targetMinion.metadata?.mythicHorsesSeastarExtraTalentConsumed !== true;

                if (!(isStandingStones && doubleTalentAvailable) && !canUseGreatWolfSpiritDouble && !canUseSeastarDouble) {
                    return { valid: false, error: '本回合天赋已使用' };
                }
            }
            // 检查是否有天赋能力
            const mDef = getCardDef(targetMinion.defId);
            if (!mDef || !('abilityTags' in mDef) || !mDef.abilityTags?.includes('talent')) {
                return { valid: false, error: '该随从没有天赋能力' };
            }

            const talentValidation = validateTalentUse({
                state: core,
                matchState: state,
                playerId: command.playerId,
                cardUid: minionUid,
                defId: targetMinion.defId,
                baseIndex,
                random: { random: () => Math.random(), d: () => 1, range: (min: number) => min, shuffle: <T>(arr: T[]) => [...arr] },
                now: core.turnNumber ?? 0,
            });
            if (!talentValidation.valid) {
                return talentValidation;
            }
            return { valid: true };
        }

        case SU_COMMANDS.ACTIVATE_SPECIAL: {
            // 允许在 playCards 和 scoreBases 阶段激活特殊能力
            // scoreBases 阶段：基地计分前的 beforeScoring 特殊能力（如忍者侍从）
            if (phase !== 'playCards' && phase !== 'scoreBases') {
                return { valid: false, error: '只能在出牌阶段或计分阶段激活特殊能力' };
            }
            const currentResponderOrTurnPlayer = phase === 'scoreBases' && reactionWindow
                ? reactionWindow.activePlayerId
                : currentPlayerId;
            if (command.playerId !== currentResponderOrTurnPlayer) {
                return { valid: false, error: 'player_mismatch' };
            }
            const {
                minionUid: spMinionUid,
                titanUid: spTitanUid,
                discardCardUid: spDiscardCardUid,
                handCardUid: spHandCardUid,
                baseIndex: spBaseIndex,
                targetMinionUid: spTargetMinionUid,
            } = command.payload;
            const targetCount = [spMinionUid, spTitanUid, spDiscardCardUid, spHandCardUid].filter(Boolean).length;
            if (targetCount !== 1) {
                return { valid: false, error: '蹇呴』涓旀墜鑳藉彧鑳芥寚瀹氫竴涓壒娈婅兘鍔涚洰鏍?' };
            }
            const activationWindow = getCurrentManualActivationWindow(state);
            const spBase = core.bases[spBaseIndex];
            if (!spBase) return { valid: false, error: '无效的基地索引' };
            if (spHandCardUid) {
                const player = core.players[command.playerId];
                if (!player) return { valid: false, error: '玩家不存在' };
                const handCard = player.hand.find(card => card.uid === spHandCardUid);
                if (!handCard) {
                    return { valid: false, error: '手牌中没有该卡牌' };
                }
                const handCardFace = handCard.type === 'minion'
                    ? 'minion'
                    : handCard.type === 'action'
                        ? 'action'
                        : undefined;
                const specialAvailability = getManualSpecialAvailability(handCard.defId, {
                    zone: 'hand',
                    window: activationWindow,
                    ...(handCardFace ? { face: handCardFace } : {}),
                });
                if (!specialAvailability.hasSpecialActivation) {
                    return { valid: false, error: '该手牌没有特殊能力' };
                }
                if (!specialAvailability.hasSpecialExecutor) {
                    return { valid: false, error: '该手牌的特殊能力不能手动激活' };
                }
                const scoringBaseValidation = validateManualSpecialScoringBase(state, spBaseIndex, handCard.defId);
                if (scoringBaseValidation) {
                    return scoringBaseValidation;
                }
                const specialValidation = validateSpecialUse({
                    state: core,
                    matchState: state,
                    playerId: command.playerId,
                    cardUid: spHandCardUid,
                    defId: handCard.defId,
                    baseIndex: spBaseIndex,
                    random: { random: () => Math.random(), d: () => 1, range: (min: number) => min, shuffle: <T>(arr: T[]) => [...arr] },
                    now: core.turnNumber ?? 0,
                });
                if (!specialValidation.valid) {
                    return specialValidation;
                }
                return { valid: true };
            }
            if (spDiscardCardUid) {
                if (phase !== 'playCards') {
                    return { valid: false, error: '弃牌堆中的特殊能力只能在出牌阶段激活' };
                }
                const player = core.players[command.playerId];
                if (!player) return { valid: false, error: '玩家不存在' };
                const discardCard = player.discard.find(card => card.uid === spDiscardCardUid);
                if (!discardCard) {
                    return { valid: false, error: '弃牌堆中没有该随从' };
                }
                const discardCardFace = discardCard.type === 'minion'
                    ? 'minion'
                    : discardCard.type === 'action'
                        ? 'action'
                        : undefined;
                const specialAvailability = getManualSpecialAvailability(discardCard.defId, {
                    zone: 'discard',
                    window: activationWindow,
                    ...(discardCardFace ? { face: discardCardFace } : {}),
                });
                if (!specialAvailability.hasSpecialActivation) {
                    return { valid: false, error: '该弃牌堆随从没有特殊能力' };
                }
                if (!specialAvailability.hasSpecialExecutor) {
                    return { valid: false, error: '该弃牌堆随从的特殊能力不能手动激活' };
                }
                const discardSpecialCheck = canActivateSpecialFromDiscard(core, command.playerId, spDiscardCardUid, spBaseIndex, spTargetMinionUid);
                if (!discardSpecialCheck) {
                    return { valid: false, error: '该弃牌堆随从当前不能这样激活特殊能力' };
                }
                const specialValidation = validateSpecialUse({
                    state: core,
                    matchState: state,
                    playerId: command.playerId,
                    cardUid: spDiscardCardUid,
                    defId: discardCard.defId,
                    baseIndex: spBaseIndex,
                    targetMinionUid: spTargetMinionUid,
                    random: { random: () => Math.random(), d: () => 1, range: (min: number) => min, shuffle: <T>(arr: T[]) => [...arr] },
                    now: core.turnNumber ?? 0,
                });
                if (!specialValidation.valid) {
                    return specialValidation;
                }
                return { valid: true };
            }
            if (spTitanUid) {
                const titanValidation = validateTitanAbility(
                    state,
                    { playerId: command.playerId, payload: { titanUid: spTitanUid, baseIndex: spBaseIndex } },
                    'special',
                );
                if (!titanValidation.valid) {
                    return titanValidation;
                }
                const titan = getTitanByUid(core, spTitanUid);
                if (!titan) return { valid: false, error: '该泰坦不存在' };
                const scoringBaseValidation = validateManualSpecialScoringBase(state, spBaseIndex, titan.defId);
                if (scoringBaseValidation) {
                    return scoringBaseValidation;
                }
                return { valid: true };
            }

            const spMinion = spBase.minions.find(m => m.uid === spMinionUid);
            if (!spMinion) return { valid: false, error: '基地上没有该随从' };
            if (spMinion.controller !== command.playerId) {
                return { valid: false, error: '只能激活自己控制的随从的特殊能力' };
            }
            const specialAvailability = getManualSpecialAvailability(spMinion.defId, {
                zone: 'board',
                window: activationWindow,
                face: 'minion',
            });
            if (!specialAvailability.hasSpecialActivation) {
                return { valid: false, error: '该随从没有特殊能力' };
            }
            if (!specialAvailability.hasSpecialExecutor) {
                return { valid: false, error: '该随从的特殊能力不能手动激活' };
            }
            const spMinionDef = getMinionDef(spMinion.defId);
            const sourceScope = spMinionDef?.activatableAbilities?.some(ability =>
                ability.kind === 'special'
                && ability.zone === 'board'
                && ability.window === activationWindow
                && ability.sourceScope === 'anyBase',
            )
                ? 'anyBase'
                : undefined;
            const scoringBaseValidation = validateManualSpecialScoringBase(state, spBaseIndex, sourceScope ?? spMinion.defId);
            if (scoringBaseValidation) {
                return scoringBaseValidation;
            }
            // specialLimitGroup 检查
            if (isSpecialLimitBlocked(core, spMinion.defId, spBaseIndex)) {
                return { valid: false, error: '该基地本回合已使用过同组特殊能力' };
            }
            const specialValidation = validateSpecialUse({
                state: core,
                matchState: state,
                playerId: command.playerId,
                cardUid: spMinionUid,
                defId: spMinion.defId,
                baseIndex: spBaseIndex,
                random: { random: () => Math.random(), d: () => 1, range: (min: number) => min, shuffle: <T>(arr: T[]) => [...arr] },
                now: core.turnNumber ?? 0,
            });
            if (!specialValidation.valid) {
                return specialValidation;
            }
            return { valid: true };
        }

        case SU_COMMANDS.ACTIVATE_TITAN_ONGOING: {
            if (phase !== 'playCards') {
                return { valid: false, error: '鍙兘鍦ㄥ嚭鐗岄樁娈垫縺娲绘嘲鍧︽寔缁兘鍔?' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            return validateTitanAbility(state, command, 'ongoing');
        }

        case SU_COMMANDS.DEFEAT_MUNCHKIN_MONSTER: {
            if (phase !== 'playCards') {
                return { valid: false, error: '只能在出牌阶段击败怪物' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }

            const { baseIndex, monsterUid } = command.payload;
            const base = core.bases[baseIndex];
            if (!base) {
                return { valid: false, error: '无效的基地索引' };
            }

            const monster = base.monsters?.find(candidate => candidate.uid === monsterUid);
            if (!monster) {
                return { valid: false, error: '该基地没有这个怪物' };
            }
            if (monster.controllerId !== undefined) {
                return { valid: false, error: '已受控怪物不能被击败' };
            }

            const descriptor = getMunchkinSpecialCardDescriptor(monster.defId);
            if (descriptor?.kind !== 'monster') {
                return { valid: false, error: '该对象不是怪物' };
            }

            const monsterPower = descriptor.power ?? 0;
            const playerPower = getPlayerEffectivePowerOnBase(core, base, baseIndex, command.playerId);
            if (playerPower < monsterPower) {
                return { valid: false, error: `你在该基地的力量不足以击败这个怪物（需要${monsterPower}）` };
            }

            return { valid: true };
        }

        default:
            // RESPONSE_PASS 由引擎 ResponseWindowSystem 处理，领域层直接放行
            if ((command as { type: string }).type === 'RESPONSE_PASS') {
                return { valid: true };
            }
            return { valid: false, error: '未知命令' };
    }
}

/**
 * 通用打出约束检查（数据驱动）。
 * 返回 null 表示通过，返回字符串表示拒绝原因。
 */
function checkPlayConstraint(
    constraint: PlayConstraint,
    core: SmashUpCore,
    baseIndex: number,
    playerId: string,
): string | null {
    if (constraint === 'requireOwnMinion') {
        const hasOwnMinion = core.bases[baseIndex].minions.some(m => m.controller === playerId);
        if (!hasOwnMinion) return '目标基地上必须有你的随从';
        return null;
    }
    if (constraint === 'requireNoCharacters') {
        const hasCharacters = core.bases[baseIndex].minions.length > 0;
        if (hasCharacters) return '目标基地上不能有任何角色';
        return null;
    }
    if (constraint === 'onlyCardInHand') {
        const handSize = core.players[playerId]?.hand.length ?? 0;
        if (handSize !== 1) return '只能在本卡是你的唯一手牌时打出';
        return null;
    }
    if (typeof constraint === 'object' && constraint.type === 'requireOwnPower') {
        const base = core.bases[baseIndex];
        const myPower = getPlayerEffectivePowerOnBase(core, base, baseIndex, playerId);
        if (myPower < constraint.minPower) {
            return `只能打到你至少拥有${constraint.minPower}点力量的基地`;
        }
        return null;
    }
    return null;
}
