import type { RandomFn, PlayerId } from '../../../engine/types';
import {
    getAllBaseDefIds,
    getBaseDef,
    getBaseDefIdsForFactionExpansionSets,
    getBaseDefIdsForFactions,
    isBaseDefAvailableForRuntimeBasePool,
} from '../data/cards';
import {
    buildFactionSelectionIdentitySet,
    isSmashUpDiyFaction,
    normalizeFactionSelectionId,
    SMASHUP_FACTION_IDS,
} from './ids';
import {
    isSmashUpFactionAvailableForParticipation,
    isSmashUpFactionIncludedInParticipationPool,
} from '../factionParticipationPool';
import type {
    BaseInPlay,
    FactionSelectionState,
    SmashUpBanStage,
    SmashUpBanPolicy,
    SmashUpBasePoolPolicy,
    SmashUpCore,
    SmashUpFactionSelectionPhase,
    SmashUpFactionSelectionMode,
} from './types';
import { createEntityId } from '../../../engine/primitives';

const DEFAULT_EXPANSIONS = ['titans', 'diy'] as const;

function getSmashUpBanStageCount(policy: SmashUpBanPolicy = 'none'): number {
    if (policy === 'preAndAfterFirstRound') return 2;
    if (policy === 'preDraft' || policy === 'afterFirstRound') return 1;
    return 0;
}

export function getSmashUpFactionsPerPlayer(selection?: FactionSelectionState): number {
    return selection?.factionsPerPlayer ?? 2;
}

export function getSmashUpDraftTurnOrder(core: Pick<SmashUpCore, 'turnOrder' | 'factionSelection'>): PlayerId[] {
    const draftTurnOrder = core.factionSelection?.draftTurnOrder;
    return draftTurnOrder && draftTurnOrder.length > 0
        ? draftTurnOrder
        : core.turnOrder;
}

export function getSmashUpInitialFactionSelectionPhase(banPolicy: FactionSelectionState['banPolicy'] = 'none'): {
    phase: SmashUpFactionSelectionPhase;
    banStage?: SmashUpBanStage;
} {
    return banPolicy === 'preDraft' || banPolicy === 'preAndAfterFirstRound'
        ? { phase: 'banPreDraft', banStage: 'preDraft' }
        : { phase: 'selecting' };
}

export function resolveSmashUpSupportedBanPolicy(
    requestedBanPolicy: SmashUpBanPolicy,
    mode: SmashUpFactionSelectionMode,
    playerIds: readonly PlayerId[],
    factionsPerPlayer: number,
    availableFactionIds: readonly string[],
): { banPolicy: SmashUpBanPolicy; reason?: string } {
    if (requestedBanPolicy === 'none') return { banPolicy: 'none' };
    if (mode === 'freePick') {
        return {
            banPolicy: 'none',
            reason: 'faction_ban_disabled_free_pick',
        };
    }
    if (mode === 'individualPools') {
        return {
            banPolicy: 'none',
            reason: 'faction_ban_disabled_individual_pools',
        };
    }

    const availableIdentityCount = buildFactionSelectionIdentitySet(availableFactionIds).size;
    const requiredPicks = playerIds.length * factionsPerPlayer;
    const canSupport = (policy: SmashUpBanPolicy) => (
        availableIdentityCount >= requiredPicks + playerIds.length * getSmashUpBanStageCount(policy)
    );

    if (canSupport(requestedBanPolicy)) return { banPolicy: requestedBanPolicy };

    if (requestedBanPolicy === 'preAndAfterFirstRound') {
        if (canSupport('preDraft')) {
            return {
                banPolicy: 'preDraft',
                reason: 'faction_ban_downgrade_to_pre_draft',
            };
        }
        if (canSupport('afterFirstRound')) {
            return {
                banPolicy: 'afterFirstRound',
                reason: 'faction_ban_downgrade_to_after_first_round',
            };
        }
    }

    return {
        banPolicy: 'none',
        reason: 'faction_ban_disabled_insufficient_pool',
    };
}


export function isSmashUpBanSelectionPhase(selection?: FactionSelectionState): boolean {
    return selection?.phase === 'banPreDraft' || selection?.phase === 'banAfterFirstRound';
}

export function getSmashUpCurrentBanStage(selection?: FactionSelectionState): SmashUpBanStage | undefined {
    if (selection?.phase === 'banPreDraft') return 'preDraft';
    if (selection?.phase === 'banAfterFirstRound') return 'afterFirstRound';
    return selection?.banStage;
}

export function getSmashUpBanTurnOrder(core: Pick<SmashUpCore, 'turnOrder' | 'factionSelection'>): PlayerId[] {
    return getSmashUpDraftTurnOrder(core);
}

export function getSmashUpNextBanPlayerIndex(
    turnOrder: readonly PlayerId[],
    banSelections: Record<PlayerId, string[]>,
    fallbackIndex: number,
): number {
    if (turnOrder.length === 0) return 0;
    const nextIndex = turnOrder.findIndex((playerId) => (banSelections[playerId] ?? []).length === 0);
    if (nextIndex >= 0) return nextIndex;
    return Math.max(0, Math.min(fallbackIndex, turnOrder.length - 1));
}

export function hasSmashUpBanStageCompleted(
    turnOrder: readonly PlayerId[],
    banSelections: Record<PlayerId, string[]>,
): boolean {
    return turnOrder.length > 0 && turnOrder.every((playerId) => (banSelections[playerId] ?? []).length >= 1);
}

export function shouldSmashUpEnterAfterFirstRoundBan(
    selection: FactionSelectionState,
    playerSelections: Record<PlayerId, string[]>,
    turnOrder: readonly PlayerId[],
): boolean {
    const policy = selection.banPolicy ?? 'none';
    const completedStages = new Set(selection.completedBanStages ?? []);
    return (policy === 'afterFirstRound' || policy === 'preAndAfterFirstRound')
        && !completedStages.has('afterFirstRound')
        && turnOrder.length > 0
        && turnOrder.every((playerId) => (playerSelections[playerId] ?? []).length >= 1);
}

export function getSmashUpSelectableFactionIds(
    enabledExpansions: readonly string[] = DEFAULT_EXPANSIONS,
    includedFactionIds?: readonly string[],
): string[] {
    return Object.values(SMASHUP_FACTION_IDS).filter((factionId) => (
        isSmashUpFactionAvailableForParticipation(factionId, enabledExpansions)
        && isSmashUpFactionIncludedInParticipationPool(factionId, includedFactionIds)
    ));
}

export function buildSmashUpPlayerCandidatePools(
    playerIds: readonly PlayerId[],
    candidatePoolSize: number,
    random: RandomFn,
    enabledExpansions: readonly string[] = DEFAULT_EXPANSIONS,
    includedFactionIds?: readonly string[],
): Record<PlayerId, string[]> {
    const candidates = getSmashUpSelectableFactionIds(enabledExpansions, includedFactionIds);
    const shuffledCandidates = random.shuffle(candidates);
    const pools: Record<PlayerId, string[]> = {};
    let cursor = 0;

    for (const playerId of playerIds) {
        const pool: string[] = [];
        const used = new Set<string>();
        while (pool.length < candidatePoolSize && used.size < shuffledCandidates.length) {
            const factionId = shuffledCandidates[cursor % shuffledCandidates.length];
            cursor += 1;
            if (!factionId || used.has(factionId)) continue;
            used.add(factionId);
            pool.push(factionId);
        }
        pools[playerId] = pool;
    }

    return pools;
}

export function buildSmashUpSharedCandidatePool(
    playerIds: readonly PlayerId[],
    candidatePoolSize: number,
    random: RandomFn,
    enabledExpansions: readonly string[] = DEFAULT_EXPANSIONS,
    includedFactionIds?: readonly string[],
): string[] {
    const targetSize = Math.max(playerIds.length * candidatePoolSize, playerIds.length * 2);
    const shuffledCandidates = random.shuffle(getSmashUpSelectableFactionIds(enabledExpansions, includedFactionIds));
    const pool: string[] = [];
    const usedIdentities = new Set<string>();

    for (const factionId of shuffledCandidates) {
        const identity = normalizeFactionSelectionId(factionId);
        if (usedIdentities.has(identity)) continue;
        usedIdentities.add(identity);
        pool.push(factionId);
        if (pool.length >= targetSize) break;
    }

    return pool;
}

export function getSmashUpNextDraftPlayerIndex(
    turnOrder: readonly PlayerId[],
    playerSelections: Record<PlayerId, string[]>,
    fallbackIndex: number,
    mode: SmashUpFactionSelectionMode = 'snakeDraft',
    factionsPerPlayer = 2,
): number {
    if (turnOrder.length === 0) return 0;

    const counts = turnOrder.map((playerId) => (playerSelections[playerId] ?? []).length);
    if (counts.every((count) => count >= factionsPerPlayer)) {
        return 0;
    }

    if (mode === 'freePick' || mode === 'individualPools') {
        const firstIncompleteIndex = counts.findIndex((count) => count < factionsPerPlayer);
        return firstIncompleteIndex >= 0 ? firstIncompleteIndex : fallbackIndex;
    }

    const sequence: PlayerId[] = [];
    for (let round = 0; round < factionsPerPlayer; round += 1) {
        const roundOrder = mode === 'snakeDraft' && round % 2 === 1
            ? [...turnOrder].reverse()
            : [...turnOrder];
        sequence.push(...roundOrder);
    }

    const selectedCount = counts.reduce((sum, count) => sum + count, 0);
    for (let cursor = selectedCount; cursor < sequence.length; cursor += 1) {
        const nextPlayerId = sequence[cursor];
        const nextIndex = nextPlayerId === undefined ? -1 : turnOrder.indexOf(nextPlayerId);
        if (nextIndex >= 0 && counts[nextIndex] < factionsPerPlayer) {
            return nextIndex;
        }
    }

    for (let offset = 0; offset < turnOrder.length; offset += 1) {
        const index = (fallbackIndex + offset + turnOrder.length) % turnOrder.length;
        if ((playerSelections[turnOrder[index]] ?? []).length < factionsPerPlayer) {
            return index;
        }
    }

    return fallbackIndex;
}

export function buildSmashUpCompletedDraftPlayers(
    turnOrder: readonly PlayerId[],
    playerSelections: Record<PlayerId, string[]>,
    factionsPerPlayer = 2,
): PlayerId[] {
    return turnOrder.filter((playerId) => (playerSelections[playerId] ?? []).length >= factionsPerPlayer);
}

export function buildSmashUpTakenFactionsFromPlayerSelections(
    playerSelections: Record<PlayerId, string[]>,
): string[] {
    return Object.values(playerSelections).flatMap((items) => items.filter((item): item is string => typeof item === 'string'));
}

export function canSmashUpPlayerSelectFaction(core: SmashUpCore, playerId: PlayerId, factionId: string): { valid: true } | { valid: false; error: string } {
    const selection = core.factionSelection;
    if (!selection) return { valid: false, error: '派系选择状态未初始化' };
    if (isSmashUpBanSelectionPhase(selection)) {
        return { valid: false, error: '当前正在 Ban Pick 阶段' };
    }
    if (selection.phase === 'ready') {
        return { valid: false, error: '派系选择已锁定，请等待其他玩家 ready' };
    }
    if ((selection.lockedPlayers ?? []).includes(playerId)) {
        return { valid: false, error: '你的派系选择已锁定' };
    }

    const mode = selection.mode ?? core.factionSelectionMode ?? 'snakeDraft';
    const draftTurnOrder = getSmashUpDraftTurnOrder(core);
    const currentDraftPlayerId = draftTurnOrder[core.currentPlayerIndex] ?? draftTurnOrder[0];
    if (mode !== 'freePick' && mode !== 'individualPools' && playerId !== currentDraftPlayerId) {
        return { valid: false, error: 'player_mismatch' };
    }

    if (!core.players[playerId]) {
        return { valid: false, error: '玩家不存在' };
    }

    const enabledExpansions = core.enabledExpansions ?? DEFAULT_EXPANSIONS;
    if (isSmashUpDiyFaction(factionId) && !enabledExpansions.includes('diy')) {
        return { valid: false, error: '该 DIY 派系未开启' };
    }
    if (!isSmashUpFactionAvailableForParticipation(factionId, enabledExpansions)) {
        return { valid: false, error: '该派系尚未接入完成' };
    }

    if (!isSmashUpFactionIncludedInParticipationPool(factionId, core.includedFactionIds)) {
        return { valid: false, error: '该派系不在本局参与池中' };
    }

    const factionIdentity = normalizeFactionSelectionId(factionId);
    const takenFactionIdentities = buildFactionSelectionIdentitySet(
        buildSmashUpTakenFactionsFromPlayerSelections(selection.playerSelections),
    );
    if (takenFactionIdentities.has(factionIdentity)) {
        return { valid: false, error: '该派系已被选择' };
    }

    const bannedFactionIdentities = buildFactionSelectionIdentitySet(selection.bannedFactions ?? []);
    if (bannedFactionIdentities.has(factionIdentity)) {
        return { valid: false, error: '该派系已被 Ban' };
    }

    const playerSelections = selection.playerSelections[playerId] || [];
    const playerSelectionIdentities = buildFactionSelectionIdentitySet(playerSelections);
    if (playerSelectionIdentities.has(factionIdentity)) {
        return { valid: false, error: '该派系已被选择' };
    }

    const factionsPerPlayer = getSmashUpFactionsPerPlayer(selection);
    if (playerSelections.length >= factionsPerPlayer) {
        return { valid: false, error: `你已选择了 ${factionsPerPlayer} 个派系` };
    }

    if (mode === 'individualPools') {
        const candidatePool = selection.playerCandidatePools?.[playerId] ?? [];
        const candidateIdentities = buildFactionSelectionIdentitySet(candidatePool);
        if (!candidateIdentities.has(factionIdentity)) {
            return { valid: false, error: '该派系不在你的随机候选池中' };
        }
    } else if (
        (mode === 'snakeDraft' || mode === 'straightDraft')
        && (selection.sharedCandidatePool?.length ?? 0) > 0
    ) {
        const candidateIdentities = buildFactionSelectionIdentitySet(selection.sharedCandidatePool ?? []);
        if (!candidateIdentities.has(factionIdentity)) {
            return { valid: false, error: '该派系不在本局草案池中' };
        }
    }

    return { valid: true };
}

export function canSmashUpPlayerBanFaction(core: SmashUpCore, playerId: PlayerId, factionId: string): { valid: true } | { valid: false; error: string } {
    const selection = core.factionSelection;
    if (!selection) return { valid: false, error: '派系选择状态未初始化' };
    if (!isSmashUpBanSelectionPhase(selection)) {
        return { valid: false, error: '当前不是 Ban Pick 阶段' };
    }
    if (!core.players[playerId]) {
        return { valid: false, error: '玩家不存在' };
    }

    const turnOrder = getSmashUpBanTurnOrder(core);
    const currentBanPlayerId = turnOrder[core.currentPlayerIndex] ?? turnOrder[0];
    if (playerId !== currentBanPlayerId) {
        return { valid: false, error: 'player_mismatch' };
    }

    const enabledExpansions = core.enabledExpansions ?? DEFAULT_EXPANSIONS;
    if (isSmashUpDiyFaction(factionId) && !enabledExpansions.includes('diy')) {
        return { valid: false, error: '该 DIY 派系未开启' };
    }
    if (!isSmashUpFactionAvailableForParticipation(factionId, enabledExpansions)) {
        return { valid: false, error: '该派系尚未接入完成' };
    }

    if (!isSmashUpFactionIncludedInParticipationPool(factionId, core.includedFactionIds)) {
        return { valid: false, error: '该派系不在本局参与池中' };
    }

    const factionIdentity = normalizeFactionSelectionId(factionId);
    const takenFactionIdentities = buildFactionSelectionIdentitySet(selection.takenFactions);
    if (takenFactionIdentities.has(factionIdentity)) {
        return { valid: false, error: '已被选择的派系不能再 Ban' };
    }
    const bannedFactionIdentities = buildFactionSelectionIdentitySet(selection.bannedFactions ?? []);
    if (bannedFactionIdentities.has(factionIdentity)) {
        return { valid: false, error: '该派系已被 Ban' };
    }

    const mode = selection.mode ?? core.factionSelectionMode ?? 'snakeDraft';
    if (
        (mode === 'snakeDraft' || mode === 'straightDraft')
        && (selection.sharedCandidatePool?.length ?? 0) > 0
    ) {
        const candidateIdentities = buildFactionSelectionIdentitySet(selection.sharedCandidatePool ?? []);
        if (!candidateIdentities.has(factionIdentity)) {
            return { valid: false, error: '该派系不在本局草案池中' };
        }
    }

    const stage = getSmashUpCurrentBanStage(selection);
    if (!stage) return { valid: false, error: 'Ban 阶段未初始化' };
    const stageSelections = selection.banSelections?.[stage] ?? {};
    if ((stageSelections[playerId] ?? []).length >= 1) {
        return { valid: false, error: '你本阶段已经 Ban 过派系' };
    }

    return { valid: true };
}

export function canSmashUpPlayerConfirmFactionReady(core: SmashUpCore, playerId: PlayerId): { valid: true } | { valid: false; error: string } {
    const selection = core.factionSelection;
    if (!selection) return { valid: false, error: '派系选择状态未初始化' };
    if (selection.mode !== 'individualPools') {
        return { valid: false, error: '只有随机个人池模式需要 ready' };
    }
    if (isSmashUpBanSelectionPhase(selection)) {
        return { valid: false, error: 'Ban Pick 阶段不能 ready' };
    }
    if (!core.players[playerId]) {
        return { valid: false, error: '玩家不存在' };
    }
    if ((selection.readyPlayers ?? []).includes(playerId)) {
        return { valid: false, error: '你已经 ready' };
    }
    const factionsPerPlayer = getSmashUpFactionsPerPlayer(selection);
    if ((selection.playerSelections[playerId] ?? []).length < factionsPerPlayer) {
        return { valid: false, error: `需要先选择 ${factionsPerPlayer} 个派系` };
    }
    return { valid: true };
}

function getBasePoolForPolicy(
    selectedFactions: string[],
    enabledExpansions: readonly string[],
    basePoolPolicy: SmashUpBasePoolPolicy = 'selectedFactionBases',
): string[] {
    if (basePoolPolicy === 'allRegularBases') {
        return getAllBaseDefIds().filter((defId) => (
            !defId.endsWith('_pod')
            && isBaseDefAvailableForRuntimeBasePool(defId, enabledExpansions)
        ));
    }
    if (basePoolPolicy === 'selectedExpansionBases') {
        return getBaseDefIdsForFactionExpansionSets(selectedFactions, enabledExpansions, { includeInProgress: false });
    }
    return getBaseDefIdsForFactions(selectedFactions, enabledExpansions, { includeInProgress: false });
}

export function buildSmashUpSetupBasesForSelectedFactions(
    selectedFactions: string[],
    playerCount: number,
    random: RandomFn,
    enabledExpansions: readonly string[] = DEFAULT_EXPANSIONS,
    basePoolPolicy: SmashUpBasePoolPolicy = 'selectedFactionBases',
): { bases: BaseInPlay[]; baseDeck: string[]; nextBaseInstanceId: number } {
    let shuffledBasePool = random.shuffle(getBasePoolForPolicy(selectedFactions, enabledExpansions, basePoolPolicy));
    const baseCount = playerCount + 1;
    const bases: BaseInPlay[] = [];

    while (bases.length < baseCount && shuffledBasePool.length > 0) {
        const defId = shuffledBasePool.shift()!;
        const def = getBaseDef(defId);
        if (def?.replaceOnSetup) {
            shuffledBasePool.push(defId);
            shuffledBasePool = random.shuffle(shuffledBasePool);
            continue;
        }
        bases.push({
            instanceId: createEntityId('smashup:base', bases.length + 1),
            defId,
            minions: [],
            ongoingActions: [],
        });
    }

    return {
        bases,
        baseDeck: shuffledBasePool,
        nextBaseInstanceId: bases.length + 1,
    };
}
