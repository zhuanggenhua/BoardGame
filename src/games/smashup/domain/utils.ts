import type { MatchState, PlayerId, RandomFn, ResponseWindowType } from '../../../engine/types';
import type { ActionCardDef, CardInstance, FusionCardDef, PlayerState, SmashUpCore, MinionOnBase, SpecialTiming } from './types';
import { getBaseDef, getCardDef, getFactionCards, getFusionDef, getMinionDef } from '../data/cards';
import { getScoringEligibleBaseIndices } from './ongoingModifiers';
import { getCardDefActivatableAbilities } from './activationMetadata';
import { getSmashUpReactionWindowContext } from './reactionWindowState';

const POTION_OF_STRAIGHT_LINE_RUNNING_AWAY = 'munchkin_treasure_potion_of_straight_line_running_away';

// ============================================================================
// 玩家显示名
// ============================================================================

/** 玩家编号→友好显示名映射（支持 2-4 人） */
const PLAYER_LABELS = ['一', '二', '三', '四'];

/** 获取玩家友好显示名（如"玩家一"、"玩家二"） */
export function getPlayerLabel(pid: PlayerId): string {
    const idx = typeof pid === 'number' ? pid : parseInt(pid, 10);
    return `玩家${PLAYER_LABELS[idx] ?? (idx + 1)}`;
}

/** 获取对手友好显示名（如"对手一"） */
export function getOpponentLabel(pid: PlayerId): string {
    const idx = typeof pid === 'number' ? pid : parseInt(pid, 10);
    return `对手${PLAYER_LABELS[idx] ?? (idx + 1)}`;
}

/**
 * 检查 defId 是否匹配指定基础版 ID（包含对应的 `_pod` 版本）
 *
 * 用于 POD 自动映射后的运行时判断，避免注册成功但执行阶段仍只识别基础版。
 */
export function matchesDefId(defId: string | undefined | null, baseDefId: string): boolean {
    return defId === baseDefId || defId === `${baseDefId}_pod`;
}

/** 归一化 POD defId（去掉 _pod 后缀） */
export function normalizePodDefId(defId: string | undefined | null): string | undefined {
    if (!defId) return undefined;
    return defId.endsWith('_pod') ? defId.slice(0, -4) : defId;
}

/** 判断两个 defId 是否视为“同名”（支持 POD 版本） */
export function isSameNameDefId(cardDefId: string | undefined, requiredDefId: string | undefined | null): boolean {
    const normalized = normalizePodDefId(requiredDefId);
    if (!normalized || !cardDefId) return false;
    return matchesDefId(cardDefId, normalized);
}

/**
 * 获取随从天赋当前不可发动的原因。
 *
 * 这里只放“卡牌自身规则前置条件”，供命令校验、UI 高亮和 execute 兜底共用，
 * 避免出现前端显示可点、点了却没有实际效果的分层不一致问题。
 */
export function getMinionTalentActivationError(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number,
): string | null {
    void state;
    void baseIndex;

    if (matchesDefId(minion.defId, 'frankenstein_the_monster') && (minion.powerCounters ?? 0) < 1) {
        return '该随从当前无法发动天赋：没有+1力量指示物';
    }

    return null;
}

export function resolveLiveBaseIndex(
    state: { bases: Array<{ defId: string }> },
    baseIndex: number | undefined,
    baseDefId?: string,
): number | undefined {
    if (baseIndex !== undefined && state.bases[baseIndex]) {
        if (!baseDefId || state.bases[baseIndex].defId === baseDefId) {
            return baseIndex;
        }
    }
    if (baseDefId) {
        const liveIndex = state.bases.findIndex(base => base.defId === baseDefId);
        if (liveIndex >= 0) return liveIndex;
        return undefined;
    }
    if (baseIndex !== undefined && state.bases[baseIndex]) {
        return baseIndex;
    }
    return undefined;
}

function isFusionDef(defId: string): boolean {
    const def = getCardDef(defId) as FusionCardDef | undefined;
    return def?.type === 'fusion';
}

/**
 * 融合卡规则：除非“正在被打出”，否则融合卡同时视为随从与战术。
 *
 * 引擎侧的 CardInstance.type 只能是单值，因此提供这两个 helper
 * 统一处理“是否算随从/是否算战术”的判断。
 */
export function isCardMinionLike(card: CardInstance): boolean {
    return card.type === 'minion' || (card.type === 'fusion' && isFusionDef(card.defId));
}

export function isCardActionLike(card: CardInstance): boolean {
    return card.type === 'action' || (card.type === 'fusion' && isFusionDef(card.defId));
}

type ActionLikeDef = ActionCardDef | FusionCardDef;
export type ResponseWindowPlayableTiming = Extract<SpecialTiming, 'beforeScoring' | 'afterScoring'>;

function isFusionActionDef(def: ActionLikeDef): def is FusionCardDef {
    return def.type === 'fusion';
}

function toResponseWindowPlayableTiming(
    timing: SpecialTiming | undefined,
): ResponseWindowPlayableTiming | undefined {
    if (timing === 'beforeScoring' || timing === 'afterScoring') {
        return timing;
    }
    return undefined;
}

function hasManualSpecialActivation(def: ActionLikeDef): boolean {
    const abilities = isFusionActionDef(def)
        ? getCardDefActivatableAbilities(def, { face: 'action' })
        : getCardDefActivatableAbilities(def);
    return abilities.some(ability => ability.kind === 'special');
}

function getDeclaredActionLikeSpecialTiming(def: ActionLikeDef): SpecialTiming | undefined {
    if (isFusionActionDef(def)) {
        if (def.actionSubtype !== 'special') return undefined;
        if (def.actionSpecialTiming) return def.actionSpecialTiming;
        if (hasManualSpecialActivation(def)) return undefined;
        throw new Error(`[SmashUp] ${def.id} 的 fusion actionSubtype=special 缺少显式 actionSpecialTiming 或 manual special 声明`);
    }

    if (def.subtype !== 'special') return undefined;
    if (def.specialTiming) return def.specialTiming;
    if (hasManualSpecialActivation(def)) return undefined;
    throw new Error(`[SmashUp] ${def.id} 的 subtype=special 缺少显式 specialTiming 或 manual special 声明`);
}

function getActionLikeResponseWindowLimitGroup(def: ActionLikeDef): string | undefined {
    if (isFusionActionDef(def)) {
        return def.actionSubtype === 'special' ? def.actionSpecialLimitGroup : undefined;
    }
    return def.subtype === 'special' ? def.specialLimitGroup : undefined;
}

export function getActionLikeResponseWindowTiming(def: ActionLikeDef): ResponseWindowPlayableTiming | undefined {
    if (isFusionActionDef(def)) {
        return toResponseWindowPlayableTiming(def.actionResponseWindowTiming)
            ?? toResponseWindowPlayableTiming(getDeclaredActionLikeSpecialTiming(def));
    }

    return toResponseWindowPlayableTiming(def.responseWindowTiming)
        ?? toResponseWindowPlayableTiming(getDeclaredActionLikeSpecialTiming(def));
}

export function actionLikeNeedsResponseWindowBase(def: ActionLikeDef): boolean {
    if (isFusionActionDef(def)) {
        if (def.actionSubtype === 'special') {
            return def.actionSpecialNeedsBase === true;
        }
        return def.actionResponseWindowNeedsBase === true;
    }

    if (def.subtype === 'special') {
        return def.specialNeedsBase === true;
    }
    return def.responseWindowNeedsBase === true;
}

export function actionLikeNeedsPlayBase(def: ActionLikeDef): boolean {
    if (isFusionActionDef(def)) {
        return def.actionPlayNeedsBase === true;
    }
    return def.playNeedsBase === true;
}

export function actionLikeNeedsPlayMinion(def: ActionLikeDef): boolean {
    if (isFusionActionDef(def)) {
        return def.actionPlayNeedsMinion === true;
    }
    return def.playNeedsMinion === true;
}

export function actionLikePlayTargetMinionController(def: ActionLikeDef): 'self' | 'opponent' | 'any' {
    if (isFusionActionDef(def)) {
        return def.actionPlayTargetMinionController ?? 'any';
    }
    return def.playTargetMinionController ?? 'any';
}

export function isActionLikeRespondableInWindow(
    def: ActionLikeDef,
    windowType: ResponseWindowType,
): boolean {
    const timing = getActionLikeResponseWindowTiming(def);
    if (!timing) return false;
    if (windowType === 'meFirst') return timing === 'beforeScoring';
    if (windowType === 'afterScoring') return timing === 'afterScoring';
    return false;
}

export function isMinionLikeRespondableInWindow(
    cardDefId: string,
    windowType: ResponseWindowType,
): boolean {
    if (windowType !== 'meFirst') return false;
    const minionDef = getMinionDef(cardDefId);
    if (minionDef?.beforeScoringPlayable) return true;
    const fusionDef = getFusionDef(cardDefId);
    return fusionDef?.minionBeforeScoringPlayable === true;
}

function isSpecialLimitBlockedByGroup(
    state: SmashUpCore,
    limitGroup: string | undefined,
    baseIndex: number,
): boolean {
    if (!limitGroup) return false;
    return state.specialLimitUsed?.[limitGroup]?.includes(baseIndex) ?? false;
}

function hasPendingMunchkinTreasureReward(state: SmashUpCore): boolean {
    return (state.pendingMunchkinTreasureReward?.treasureCards.length ?? 0) > 0;
}

export function getMinionLikeResponseWindowLimitGroup(
    cardDefId: string,
    windowType: ResponseWindowType,
): string | undefined {
    if (!isMinionLikeRespondableInWindow(cardDefId, windowType)) return undefined;
    const minionDef = getMinionDef(cardDefId);
    if (minionDef?.beforeScoringPlayable) return minionDef.specialLimitGroup;
    const fusionDef = getFusionDef(cardDefId);
    if (fusionDef?.minionBeforeScoringPlayable) return fusionDef.minionSpecialLimitGroup;
    return undefined;
}

/**
 * 计算某张牌在 Me First! 窗口中可响应的基地索引。
 *
 * 仅处理两类需要“锁定到即将计分基地”的牌：
 * - beforeScoringPlayable 随从（如影舞者）
 * - 在 Me First! 窗口中需要选基地的行动卡（如便衣忍者）
 */
export function getMeFirstPlayableBaseIndicesForCard(
    state: SmashUpCore,
    cardDefId: string,
): number[] {
    return getResponseWindowPlayableBaseIndicesForCard(state, cardDefId, 'meFirst');
}

export function getResponseWindowPlayableBaseIndicesForCard(
    state: SmashUpCore,
    cardDefId: string,
    windowType: ResponseWindowType,
    options?: { sourceBaseIndex?: number; baseIndices?: number[] },
): number[] {
    const eligibleBaseIndices = options?.baseIndices
        ?? (typeof options?.sourceBaseIndex === 'number'
            ? [options.sourceBaseIndex]
            : getScoringEligibleBaseIndices(state));
    if (eligibleBaseIndices.length === 0) return [];

    if (isMinionLikeRespondableInWindow(cardDefId, windowType)) {
        const limitGroup = getMinionLikeResponseWindowLimitGroup(cardDefId, windowType);
        return eligibleBaseIndices.filter(baseIndex =>
            !isSpecialLimitBlockedByGroup(state, limitGroup, baseIndex),
        );
    }

    const actionDef = getCardDef(cardDefId) as ActionCardDef | FusionCardDef | undefined;
    if (!actionDef || !isActionLikeRespondableInWindow(actionDef, windowType)) {
        return [];
    }
    if (!actionLikeNeedsResponseWindowBase(actionDef)) {
        return [];
    }

    const limitGroup = getActionLikeResponseWindowLimitGroup(actionDef);
    return eligibleBaseIndices.filter(baseIndex =>
        !isSpecialLimitBlockedByGroup(state, limitGroup, baseIndex),
    );
}

export function getResponseWindowBaseIndices(
    state: MatchState<SmashUpCore>,
    windowType: ResponseWindowType,
): number[] {
    const reactionWindow = getSmashUpReactionWindowContext(state);
    if (reactionWindow?.windowType === windowType && typeof reactionWindow.sourceBaseIndex === 'number') {
        const sourceBaseIndex = reactionWindow.sourceBaseIndex;
        return state.core.bases[sourceBaseIndex] ? [sourceBaseIndex] : [];
    }
    return getScoringEligibleBaseIndices(state.core);
}

export function getResponseWindowPlayableBaseIndicesForMatchState(
    state: MatchState<SmashUpCore>,
    cardDefId: string,
    windowType: ResponseWindowType,
): number[] {
    return getResponseWindowPlayableBaseIndicesForCard(state.core, cardDefId, windowType, {
        baseIndices: getResponseWindowBaseIndices(state, windowType),
    });
}

export function canCardBePlayedInResponseWindow(
    state: SmashUpCore,
    card: CardInstance,
    windowType: ResponseWindowType,
): boolean {
    if (isCardMinionLike(card)) {
        return getResponseWindowPlayableBaseIndicesForCard(state, card.defId, windowType).length > 0;
    }

    if (!isCardActionLike(card)) return false;
    const actionDef = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
    if (!actionDef || !isActionLikeRespondableInWindow(actionDef, windowType)) {
        return false;
    }
    if (
        normalizePodDefId(card.defId) === POTION_OF_STRAIGHT_LINE_RUNNING_AWAY
        && windowType === 'afterScoring'
        && !hasPendingMunchkinTreasureReward(state)
    ) {
        return false;
    }

    if (
        actionLikeNeedsResponseWindowBase(actionDef)
        && getResponseWindowPlayableBaseIndicesForCard(state, card.defId, windowType).length === 0
    ) {
        return false;
    }

    if (normalizePodDefId(card.defId) === 'ninja_hidden_ninja') {
        const player = state.players[card.owner];
        if (!player?.hand.some(handCard => handCard.uid !== card.uid && isCardMinionLike(handCard))) {
            return false;
        }
    }

    return true;
}

export function canCardBePlayedInResponseWindowForMatchState(
    state: MatchState<SmashUpCore>,
    card: CardInstance,
    windowType: ResponseWindowType,
): boolean {
    if (isCardMinionLike(card)) {
        return getResponseWindowPlayableBaseIndicesForMatchState(state, card.defId, windowType).length > 0;
    }

    if (!isCardActionLike(card)) return false;
    const actionDef = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
    if (!actionDef || !isActionLikeRespondableInWindow(actionDef, windowType)) {
        return false;
    }
    if (
        normalizePodDefId(card.defId) === POTION_OF_STRAIGHT_LINE_RUNNING_AWAY
        && windowType === 'afterScoring'
        && !hasPendingMunchkinTreasureReward(state.core)
    ) {
        return false;
    }

    if (
        actionLikeNeedsResponseWindowBase(actionDef)
        && getResponseWindowPlayableBaseIndicesForMatchState(state, card.defId, windowType).length === 0
    ) {
        return false;
    }

    if (normalizePodDefId(card.defId) === 'ninja_hidden_ninja') {
        const player = state.core.players[card.owner];
        if (!player?.hand.some(handCard => handCard.uid !== card.uid && isCardMinionLike(handCard))) {
            return false;
        }
    }

    return true;
}

/**
 * 判断同名额外随从额度对当前卡是否可用。
 *
 * - 没有同名额度 → false
 * - 尚未锁定 defId → 任意随从都可使用，首次使用时再锁定
 * - 已锁定 defId → 只有同名随从可使用
 */
export function canUseSameNameMinionQuota(
    player: PlayerState | undefined,
    cardDefId: string | undefined,
): boolean {
    if (!player || !cardDefId) return false;
    const sameNameRemaining = player.sameNameMinionRemaining ?? 0;
    if (sameNameRemaining <= 0) return false;
    return player.sameNameMinionDefId === null
        || player.sameNameMinionDefId === undefined
        || isSameNameDefId(cardDefId, player.sameNameMinionDefId);
}

/**
 * 判断当前卡能否消耗指定基地的基地限定额外随从额度。
 *
 * 会同时检查：
 * - 该基地是否仍有额度
 * - 基地限定同名约束是否满足
 * - 基地定义上的额外随从力量限制是否满足（如神秘花园）
 */
export function canUseBaseLimitedMinionQuota(
    state: SmashUpCore,
    player: PlayerState | undefined,
    baseIndex: number,
    cardDefId: string | undefined,
    basePower?: number,
): boolean {
    if (!player) return false;
    const quota = player.baseLimitedMinionQuota?.[baseIndex] ?? 0;
    if (quota <= 0) return false;
    if (player.baseLimitedSameNameRequired?.[baseIndex]) {
        const requiredDefId = player.baseLimitedSameNameDefId?.[baseIndex];
        if (requiredDefId) {
            if (!isSameNameDefId(cardDefId, requiredDefId)) return false;
        } else {
            const baseMinions = state.bases[baseIndex]?.minions ?? [];
            if (!baseMinions.some(minion => isSameNameDefId(cardDefId, minion.defId))) {
                return false;
            }
        }
    }
    const baseDefId = state.bases[baseIndex]?.defId;
    const baseDef = baseDefId ? getBaseDef(baseDefId) : undefined;
    const basePowerLimit = baseDef?.restrictions?.find(
        restriction => restriction.type === 'play_minion' && restriction.condition?.extraPlayMinionPowerMax !== undefined,
    )?.condition?.extraPlayMinionPowerMax;
    if (basePowerLimit !== undefined && basePower !== undefined && basePower > basePowerLimit) {
        return false;
    }
    const restrictedCaps = getRemainingBaseLimitedPowerLimitedMinionQuotas(player, baseIndex);
    if (restrictedCaps.length > 0) {
        const unrestrictedQuotaRemaining = Math.max(0, quota - restrictedCaps.length);
        if (unrestrictedQuotaRemaining <= 0) {
            if (basePower === undefined) return false;
            return restrictedCaps.some(powerCap => basePower <= powerCap);
        }
    }
    return true;
}

/**
 * 判断这次打出是否“只能”消耗指定基地的基地限定随从额度。
 *
 * 只要玩家还存在其他可用额度（通用额度 / 同名额度），就不应把这次打出
 * 视为在消耗基地限定额度；只有没有其他可用额度，且该基地仍有额度时，
 * 才算“被迫使用基地限定额度”。
 */
export function mustUseBaseLimitedMinionQuota(
    state: SmashUpCore,
    player: PlayerState | undefined,
    baseIndex: number,
    cardDefId: string | undefined,
    basePower?: number,
): boolean {
    void state;
    void basePower;
    if (!player) return false;
    const globalQuotaRemaining = player.minionLimit - player.minionsPlayed;
    if (globalQuotaRemaining > 0) return false;
    if (canUseSameNameMinionQuota(player, cardDefId)) return false;
    const quota = player.baseLimitedMinionQuota?.[baseIndex] ?? 0;
    return quota > 0;
}

/** 获取当前剩余的基地限定受限额外随从额度列表。 */
export function getRemainingBaseLimitedPowerLimitedMinionQuotas(
    player: PlayerState | undefined,
    baseIndex: number,
): number[] {
    if (!player) return [];
    return [...(player.baseLimitedMinionPowerCaps?.[baseIndex] ?? [])];
}

/** 获取当前卡可用的最严格基地限定受限额度（用于优先消耗受限额度）。 */
export function getBestMatchingBaseLimitedPowerQuota(
    player: PlayerState | undefined,
    baseIndex: number,
    basePower: number,
): number | undefined {
    const candidates = getRemainingBaseLimitedPowerLimitedMinionQuotas(player, baseIndex)
        .filter(powerCap => basePower <= powerCap)
        .sort((a, b) => a - b);
    return candidates[0];
}

/** 获取当前剩余基地限定受限额度中最宽松的力量上限（用于错误提示）。 */
export function getMaxRemainingBaseLimitedPowerQuota(
    player: PlayerState | undefined,
    baseIndex: number,
): number | undefined {
    const quotas = getRemainingBaseLimitedPowerLimitedMinionQuotas(player, baseIndex);
    if (quotas.length === 0) return undefined;
    return Math.max(...quotas);
}

/** 获取当前剩余的全局受限额外随从额度列表。 */
export function getRemainingGlobalPowerLimitedMinionQuotas(player: PlayerState | undefined): number[] {
    if (!player) return [];
    if (player.extraMinionPowerCaps && player.extraMinionPowerCaps.length > 0) {
        return [...player.extraMinionPowerCaps];
    }
    if (player.extraMinionPowerMax !== undefined) {
        const globalQuotaRemaining = Math.max(0, player.minionLimit - player.minionsPlayed);
        return Array.from({ length: globalQuotaRemaining }, () => player.extraMinionPowerMax!);
    }
    return [];
}

/** 获取当前剩余的全局“不限力量”的额外随从额度数量。 */
export function getRemainingUnrestrictedGlobalMinionQuota(
    player: PlayerState | undefined,
): number {
    if (!player) return 0;
    const globalQuotaRemaining = Math.max(0, player.minionLimit - player.minionsPlayed);
    const restrictedQuotaCount = getRemainingGlobalPowerLimitedMinionQuotas(player).length;
    return Math.max(0, globalQuotaRemaining - restrictedQuotaCount);
}

/** 获取当前卡可用的最严格全局受限额外随从额度（用于优先消耗受限额度）。 */
export function getBestMatchingGlobalPowerLimitedQuota(
    player: PlayerState | undefined,
    basePower: number,
): number | undefined {
    const candidates = getRemainingGlobalPowerLimitedMinionQuotas(player)
        .filter(powerCap => basePower <= powerCap)
        .sort((a, b) => a - b);
    return candidates[0];
}

/** 获取当前剩余全局受限额外随从额度中最宽松的力量上限（用于错误提示）。 */
export function getMaxRemainingGlobalPowerLimitedQuota(
    player: PlayerState | undefined,
): number | undefined {
    const quotas = getRemainingGlobalPowerLimitedMinionQuotas(player);
    if (quotas.length === 0) return undefined;
    return Math.max(...quotas);
}

/**
 * 判断当前打出是否“只能”消耗全局受限额外随从额度。
 *
 * 若还存在其他可用路径（不限力量的全局额度 / 同名额度 / 当前基地可用的基地额度），
 * 就不应该对这次打出强制施加全局力量上限。
 */
export function mustUseGlobalPowerLimitedMinionQuota(
    state: SmashUpCore,
    player: PlayerState | undefined,
    baseIndex: number,
    cardDefId: string | undefined,
    basePower?: number,
): boolean {
    if (!player) return false;
    const restrictedQuotas = getRemainingGlobalPowerLimitedMinionQuotas(player);
    if (restrictedQuotas.length === 0) return false;
    const globalQuotaRemaining = Math.max(0, player.minionLimit - player.minionsPlayed);
    if (globalQuotaRemaining <= 0) return false;
    if (getRemainingUnrestrictedGlobalMinionQuota(player) > 0) return false;
    if (canUseSameNameMinionQuota(player, cardDefId)) return false;
    if (canUseBaseLimitedMinionQuota(state, player, baseIndex, cardDefId, basePower)) return false;
    return true;
}

// ============================================================================
// 微型机判断
// ============================================================================

/** 微型机 defId 集合（原始定义） */
export const MICROBOT_DEF_IDS = new Set([
    'robot_microbot_guard', 'robot_microbot_fixer', 'robot_microbot_reclaimer',
    'robot_microbot_archive', 'robot_microbot_alpha',
]);

/**
 * 判断一个随从是否算作微型机
 *
 * 规则：robot_microbot_alpha 的持续效果"你的所有随从均视为微型机"
 * - alpha 在场时，同控制者的所有随从都算微型机
 * - alpha 不在场时，只有原始微型机 defId 才算
 */
export function isMicrobot(state: SmashUpCore, minion: MinionOnBase): boolean {
    if (Array.from(MICROBOT_DEF_IDS).some(defId => matchesDefId(minion.defId, defId))) return true;
    // 检查同控制者的 alpha 是否在场
    for (const base of state.bases) {
        if (base.minions.some(m => matchesDefId(m.defId, 'robot_microbot_alpha') && m.controller === minion.controller)) {
            return true;
        }
    }
    return false;
}

/**
 * 判断一个弃牌堆中的卡是否算作微型机（用于回收等场景）
 * alpha 在场时所有己方随从卡都算微型机
 */
export function isDiscardMicrobot(state: SmashUpCore, card: CardInstance, playerId: PlayerId): boolean {
    if (!isCardMinionLike(card)) return false;
    if (Array.from(MICROBOT_DEF_IDS).some(defId => matchesDefId(card.defId, defId))) return true;
    // 检查该玩家的 alpha 是否在场
    for (const base of state.bases) {
        if (base.minions.some(m => matchesDefId(m.defId, 'robot_microbot_alpha') && m.controller === playerId)) {
            return true;
        }
    }
    return false;
}

/** 将派系卡牌定义展开为卡牌实例列表 */
export function buildDeck(
    factions: [string, string],
    owner: PlayerId,
    startUid: number,
    random: RandomFn
): { deck: CardInstance[]; nextUid: number } {
    const cards: CardInstance[] = [];
    let uid = startUid;
    for (const factionId of factions) {
        const defs = getFactionCards(factionId);
        for (const def of defs) {
            for (let i = 0; i < def.count; i++) {
                cards.push({
                    uid: `c${uid++}`,
                    defId: def.id,
                    type: def.type,
                    owner,
                });
            }
        }
    }
    return { deck: random.shuffle(cards), nextUid: uid };
}

/** 从牌库顶部抽牌 */
export function drawCards(
    player: PlayerState,
    count: number,
    random: RandomFn
): {
    hand: CardInstance[];
    deck: CardInstance[];
    discard: CardInstance[];
    drawnUids: string[];
    reshuffledDeckUids?: string[];
} {
    let deck = [...player.deck];
    let discard = [...player.discard];
    const drawn: CardInstance[] = [];
    let reshuffledDeckUids: string[] | undefined;

    for (let i = 0; i < count; i++) {
        if (deck.length === 0 && discard.length > 0) {
            deck = random.shuffle([...discard]);
            discard = [];
            if (!reshuffledDeckUids) {
                reshuffledDeckUids = deck.map(card => card.uid);
            }
        }
        if (deck.length === 0) break;
        drawn.push(deck[0]);
        deck = deck.slice(1);
    }

    return {
        hand: [...player.hand, ...drawn],
        deck,
        discard,
        drawnUids: drawn.map(c => c.uid),
        reshuffledDeckUids,
    };
}
