import type {
    BaseInPlay,
    BuriedCardOnBase,
    CardInstance,
    MinionOnBase,
    MonsterOnBase,
    OngoingActionOnBase,
    PlayerState,
    SmashUpCore,
    TitanState,
} from '../domain/types';
import {
    getSmashUpDraftTurnOrder,
    getSmashUpFactionsPerPlayer,
    getSmashUpNextDraftPlayerIndex,
    isSmashUpBanSelectionPhase,
} from '../domain/pregameDraft';

export interface SmashUpRuntimeStateAnomaly {
    path: string;
    actual: 'null' | 'non-array' | 'invalid-entry' | 'invalid-number';
}

export interface SmashUpRuntimeStateNormalizationResult {
    core: SmashUpCore | undefined;
    anomalies: SmashUpRuntimeStateAnomaly[];
}

export function normalizeSmashUpMatchStateForUi<TState extends { core?: SmashUpCore; sys?: unknown } | null | undefined>(
    state: TState,
): TState {
    if (!state || !state.core) {
        return state;
    }

    const normalized = normalizeSmashUpCoreForUi(state.core);
    if (!normalized.core) {
        return state;
    }

    const phase = typeof (state.sys as { phase?: unknown } | undefined)?.phase === 'string'
        ? (state.sys as { phase?: string }).phase
        : undefined;

    return {
        ...state,
        core: ensureFactionSelectionState(normalized.core, phase),
    };
}

function ensureFactionSelectionState(
    core: SmashUpCore,
    phase: string | undefined,
): SmashUpCore {
    if (phase !== 'factionSelect' || core.factionSelection || isFactionDraftReadyToStart(core)) {
        return normalizeFactionSelectionCurrentPlayer(core, phase);
    }

    const playerSelections = Object.fromEntries(
        core.turnOrder.map((playerId) => [playerId, []]),
    ) as NonNullable<SmashUpCore['factionSelection']>['playerSelections'];

    return {
        ...core,
        factionSelection: {
            takenFactions: [],
            playerSelections,
            completedPlayers: [],
        },
    };
}

function normalizeFactionSelectionCurrentPlayer(
    core: SmashUpCore,
    phase: string | undefined,
): SmashUpCore {
    const selection = core.factionSelection;
    if (
        phase !== 'factionSelect'
        || !selection
        || isSmashUpBanSelectionPhase(selection)
        || selection.phase === 'ready'
    ) {
        return core;
    }

    const draftTurnOrder = getSmashUpDraftTurnOrder(core);
    if (draftTurnOrder.length === 0) return core;

    const factionsPerPlayer = getSmashUpFactionsPerPlayer(selection);
    const hasIncompletePlayer = draftTurnOrder.some((playerId) => (
        (selection.playerSelections[playerId] ?? []).length < factionsPerPlayer
    ));
    if (!hasIncompletePlayer) return core;

    const currentPlayerId = draftTurnOrder[core.currentPlayerIndex] ?? draftTurnOrder[0];
    if ((selection.playerSelections[currentPlayerId] ?? []).length < factionsPerPlayer) {
        return core;
    }

    const nextPlayerIndex = getSmashUpNextDraftPlayerIndex(
        draftTurnOrder,
        selection.playerSelections,
        core.currentPlayerIndex,
        selection.mode ?? core.factionSelectionMode ?? 'snakeDraft',
        factionsPerPlayer,
    );
    if (nextPlayerIndex === core.currentPlayerIndex) return core;

    return {
        ...core,
        currentPlayerIndex: nextPlayerIndex,
    };
}

function isFactionDraftReadyToStart(core: SmashUpCore): boolean {
    return core.turnOrder.length > 0 && core.turnOrder.every((playerId) => {
        const player = core.players[playerId];
        return Boolean(
            player
            && player.factions.length === 2
            && (player.hand.length > 0 || player.deck.length > 0),
        );
    });
}

function pushArrayAnomaly(
    anomalies: SmashUpRuntimeStateAnomaly[],
    path: string,
    value: unknown,
) {
    if (Array.isArray(value)) return;
    anomalies.push({
        path,
        actual: value === null ? 'null' : 'non-array',
    });
}

function asObjectArray<T extends object>(
    value: unknown,
    path: string,
    anomalies: SmashUpRuntimeStateAnomaly[],
): T[] {
    pushArrayAnomaly(anomalies, path, value);
    if (!Array.isArray(value)) return [];

    const normalized: T[] = [];
    value.forEach((item, index) => {
        if (item && typeof item === 'object') {
            normalized.push(item as T);
            return;
        }
        anomalies.push({
            path: `${path}[${index}]`,
            actual: 'invalid-entry',
        });
    });
    return normalized;
}

function normalizeCardArray(value: unknown, path: string, anomalies: SmashUpRuntimeStateAnomaly[]): CardInstance[] {
    return asObjectArray<CardInstance>(value, path, anomalies);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function normalizeRequiredNumber(
    value: unknown,
    path: string,
    fallback: number,
    anomalies: SmashUpRuntimeStateAnomaly[],
): number {
    if (isFiniteNumber(value)) return value;
    anomalies.push({ path, actual: 'invalid-number' });
    return fallback;
}

function normalizeOptionalNumber(
    value: unknown,
    path: string,
    anomalies: SmashUpRuntimeStateAnomaly[],
): number | undefined {
    if (value === undefined) return undefined;
    if (isFiniteNumber(value)) return value;
    anomalies.push({ path, actual: 'invalid-number' });
    return undefined;
}

function normalizeNumberRecord(
    value: unknown,
    path: string,
    anomalies: SmashUpRuntimeStateAnomaly[],
): Record<number, number> | undefined {
    if (value === undefined) return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        anomalies.push({
            path,
            actual: value === null ? 'null' : 'non-array',
        });
        return undefined;
    }

    const normalized: Record<number, number> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
        if (!isFiniteNumber(entry)) {
            anomalies.push({ path: `${path}.${key}`, actual: 'invalid-number' });
            return;
        }
        normalized[Number(key)] = entry;
    });
    return normalized;
}

function normalizeNumberArray(
    value: unknown,
    path: string,
    anomalies: SmashUpRuntimeStateAnomaly[],
): number[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
        anomalies.push({
            path,
            actual: value === null ? 'null' : 'non-array',
        });
        return undefined;
    }

    const normalized: number[] = [];
    value.forEach((entry, index) => {
        if (!isFiniteNumber(entry)) {
            anomalies.push({ path: `${path}[${index}]`, actual: 'invalid-number' });
            return;
        }
        normalized.push(entry);
    });
    return normalized;
}

function normalizeNumberArrayRecord(
    value: unknown,
    path: string,
    anomalies: SmashUpRuntimeStateAnomaly[],
): Record<number, number[]> | undefined {
    if (value === undefined) return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        anomalies.push({
            path,
            actual: value === null ? 'null' : 'non-array',
        });
        return undefined;
    }

    const normalized: Record<number, number[]> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
        const arrayValue = normalizeNumberArray(entry, `${path}.${key}`, anomalies);
        if (arrayValue !== undefined) {
            normalized[Number(key)] = arrayValue;
        }
    });
    return normalized;
}

function normalizeSpecificExtraMinionPlays(
    value: unknown,
    path: string,
    anomalies: SmashUpRuntimeStateAnomaly[],
): PlayerState['specificExtraMinionPlays'] {
    if (value === undefined) return undefined;
    return asObjectArray<NonNullable<PlayerState['specificExtraMinionPlays']>[number]>(value, path, anomalies)
        .flatMap((entry, index) => {
            if (typeof entry.cardUid !== 'string' || typeof entry.reason !== 'string') {
                anomalies.push({ path: `${path}[${index}]`, actual: 'invalid-entry' });
                return [];
            }
            const restrictToBase = normalizeOptionalNumber(entry.restrictToBase, `${path}[${index}].restrictToBase`, anomalies);
            const powerMax = normalizeOptionalNumber(entry.powerMax, `${path}[${index}].powerMax`, anomalies);
            return [{
                cardUid: entry.cardUid,
                reason: entry.reason,
                ...(restrictToBase !== undefined ? { restrictToBase } : {}),
                ...(powerMax !== undefined ? { powerMax } : {}),
                ...(entry.sameNameOnly === true ? { sameNameOnly: true } : {}),
                ...(typeof entry.sameNameDefId === 'string' ? { sameNameDefId: entry.sameNameDefId } : {}),
            }];
        });
}

function normalizeMadnessDeck(
    value: unknown,
    path: string,
    anomalies: SmashUpRuntimeStateAnomaly[],
): string[] {
    pushArrayAnomaly(anomalies, path, value);
    if (!Array.isArray(value)) return [];

    const normalized: string[] = [];
    value.forEach((item, index) => {
        if (typeof item === 'string') {
            normalized.push(item);
            return;
        }
        if (item && typeof item === 'object' && typeof (item as { defId?: unknown }).defId === 'string') {
            normalized.push((item as { defId: string }).defId);
            return;
        }
        anomalies.push({
            path: `${path}[${index}]`,
            actual: 'invalid-entry',
        });
    });
    return normalized;
}

function normalizeAttachedActions(
    value: unknown,
    path: string,
    anomalies: SmashUpRuntimeStateAnomaly[],
): MinionOnBase['attachedActions'] {
    return asObjectArray<MinionOnBase['attachedActions'][number]>(value, path, anomalies);
}

function normalizeMinions(value: unknown, path: string, anomalies: SmashUpRuntimeStateAnomaly[]): MinionOnBase[] {
    return asObjectArray<MinionOnBase>(value, path, anomalies).map((minion, index) => ({
        ...minion,
        basePower: normalizeRequiredNumber(minion.basePower, `${path}[${index}].basePower`, 0, anomalies),
        powerCounters: normalizeRequiredNumber(minion.powerCounters, `${path}[${index}].powerCounters`, 0, anomalies),
        powerModifier: normalizeRequiredNumber(minion.powerModifier, `${path}[${index}].powerModifier`, 0, anomalies),
        tempPowerModifier: normalizeRequiredNumber(minion.tempPowerModifier, `${path}[${index}].tempPowerModifier`, 0, anomalies),
        attachedActions: normalizeAttachedActions(
            minion.attachedActions,
            `${path}[${index}].attachedActions`,
            anomalies,
        ),
    }));
}

function normalizeOngoingActions(
    value: unknown,
    path: string,
    anomalies: SmashUpRuntimeStateAnomaly[],
): OngoingActionOnBase[] {
    return asObjectArray<OngoingActionOnBase>(value, path, anomalies).map((ongoingAction, index) => {
        if (ongoingAction.metadata === undefined || !Object.prototype.hasOwnProperty.call(ongoingAction.metadata, 'powerCounters')) {
            return ongoingAction;
        }
        return {
            ...ongoingAction,
            metadata: {
                ...ongoingAction.metadata,
                powerCounters: normalizeRequiredNumber(
                    ongoingAction.metadata.powerCounters,
                    `${path}[${index}].metadata.powerCounters`,
                    0,
                    anomalies,
                ),
            },
        };
    });
}

function normalizeBuriedCards(
    value: unknown,
    path: string,
    anomalies: SmashUpRuntimeStateAnomaly[],
): BuriedCardOnBase[] | undefined {
    if (value === undefined) return undefined;
    return asObjectArray<BuriedCardOnBase>(value, path, anomalies);
}

function normalizeMonsters(
    value: unknown,
    path: string,
    anomalies: SmashUpRuntimeStateAnomaly[],
): MonsterOnBase[] | undefined {
    if (value === undefined) return undefined;
    return asObjectArray<MonsterOnBase>(value, path, anomalies);
}

function normalizePlayers(
    players: SmashUpCore['players'] | null | undefined,
    anomalies: SmashUpRuntimeStateAnomaly[],
): SmashUpCore['players'] {
    if (!players || typeof players !== 'object') {
        anomalies.push({
            path: 'players',
            actual: players === null ? 'null' : 'non-array',
        });
        return {} as SmashUpCore['players'];
    }

    return Object.fromEntries(
        Object.entries(players).flatMap(([playerId, player]) => {
            if (!player || typeof player !== 'object') {
                anomalies.push({
                    path: `players.${playerId}`,
                    actual: 'invalid-entry',
                });
                return [];
            }
            const normalizedPlayer: PlayerState = {
                ...(player as PlayerState),
                vp: normalizeRequiredNumber((player as PlayerState).vp, `players.${playerId}.vp`, 0, anomalies),
                hand: normalizeCardArray((player as PlayerState).hand, `players.${playerId}.hand`, anomalies),
                deck: normalizeCardArray((player as PlayerState).deck, `players.${playerId}.deck`, anomalies),
                discard: normalizeCardArray((player as PlayerState).discard, `players.${playerId}.discard`, anomalies),
                removedFromGame: (player as PlayerState).removedFromGame === undefined
                    ? undefined
                    : normalizeCardArray((player as PlayerState).removedFromGame, `players.${playerId}.removedFromGame`, anomalies),
                pendingMinionPlayEffects: (player as PlayerState).pendingMinionPlayEffects === undefined
                    ? undefined
                    : asObjectArray<NonNullable<PlayerState['pendingMinionPlayEffects']>[number]>(
                        (player as PlayerState).pendingMinionPlayEffects,
                        `players.${playerId}.pendingMinionPlayEffects`,
                        anomalies,
                    ),
                usedDiscardPlayAbilities: Array.isArray((player as PlayerState).usedDiscardPlayAbilities)
                    ? (player as PlayerState).usedDiscardPlayAbilities?.filter((entry): entry is string => typeof entry === 'string')
                    : undefined,
                minionsPlayed: normalizeRequiredNumber((player as PlayerState).minionsPlayed, `players.${playerId}.minionsPlayed`, 0, anomalies),
                minionLimit: normalizeRequiredNumber((player as PlayerState).minionLimit, `players.${playerId}.minionLimit`, 1, anomalies),
                actionsPlayed: normalizeRequiredNumber((player as PlayerState).actionsPlayed, `players.${playerId}.actionsPlayed`, 0, anomalies),
                actionLimit: normalizeRequiredNumber((player as PlayerState).actionLimit, `players.${playerId}.actionLimit`, 1, anomalies),
                actionCardsPlayedThisTurn: normalizeOptionalNumber((player as PlayerState).actionCardsPlayedThisTurn, `players.${playerId}.actionCardsPlayedThisTurn`, anomalies),
                extraCardsPlayedThisTurn: normalizeOptionalNumber((player as PlayerState).extraCardsPlayedThisTurn, `players.${playerId}.extraCardsPlayedThisTurn`, anomalies),
                minionsPlayedPerBase: normalizeNumberRecord((player as PlayerState).minionsPlayedPerBase, `players.${playerId}.minionsPlayedPerBase`, anomalies),
                baseLimitedMinionQuota: normalizeNumberRecord((player as PlayerState).baseLimitedMinionQuota, `players.${playerId}.baseLimitedMinionQuota`, anomalies),
                baseLimitedMinionPowerCaps: normalizeNumberArrayRecord((player as PlayerState).baseLimitedMinionPowerCaps, `players.${playerId}.baseLimitedMinionPowerCaps`, anomalies),
                specificExtraMinionPlays: normalizeSpecificExtraMinionPlays((player as PlayerState).specificExtraMinionPlays, `players.${playerId}.specificExtraMinionPlays`, anomalies),
                extraMinionPowerMax: normalizeOptionalNumber((player as PlayerState).extraMinionPowerMax, `players.${playerId}.extraMinionPowerMax`, anomalies),
                extraMinionPowerCaps: normalizeNumberArray((player as PlayerState).extraMinionPowerCaps, `players.${playerId}.extraMinionPowerCaps`, anomalies),
                sameNameMinionRemaining: normalizeOptionalNumber((player as PlayerState).sameNameMinionRemaining, `players.${playerId}.sameNameMinionRemaining`, anomalies),
            };
            if ((player as PlayerState).usedDiscardPlayAbilities !== undefined && !Array.isArray((player as PlayerState).usedDiscardPlayAbilities)) {
                anomalies.push({
                    path: `players.${playerId}.usedDiscardPlayAbilities`,
                    actual: (player as PlayerState).usedDiscardPlayAbilities === null ? 'null' : 'non-array',
                });
            }
            return [[playerId, normalizedPlayer]];
        }),
    ) as SmashUpCore['players'];
}

function normalizeBases(
    bases: SmashUpCore['bases'] | null | undefined,
    anomalies: SmashUpRuntimeStateAnomaly[],
): BaseInPlay[] {
    return asObjectArray<BaseInPlay>(bases, 'bases', anomalies).map((base, index) => ({
        ...base,
        minions: normalizeMinions(base.minions, `bases[${index}].minions`, anomalies),
        ongoingActions: normalizeOngoingActions(base.ongoingActions, `bases[${index}].ongoingActions`, anomalies),
        monsters: normalizeMonsters(base.monsters, `bases[${index}].monsters`, anomalies),
        buriedCards: normalizeBuriedCards(base.buriedCards, `bases[${index}].buriedCards`, anomalies),
    }));
}

function normalizeTitans(
    titans: SmashUpCore['titans'] | null | undefined,
    anomalies: SmashUpRuntimeStateAnomaly[],
): TitanState[] | undefined {
    if (titans === undefined) return undefined;
    return asObjectArray<TitanState>(titans, 'titans', anomalies).map((titan, index) => ({
        ...titan,
        powerCounters: normalizeRequiredNumber(titan.powerCounters, `titans[${index}].powerCounters`, 0, anomalies),
    }));
}

export function normalizeSmashUpCoreForUi(core: SmashUpCore | null | undefined): SmashUpRuntimeStateNormalizationResult {
    if (!core) {
        return { core: undefined, anomalies: [] };
    }

    const anomalies: SmashUpRuntimeStateAnomaly[] = [];
    const normalizedCore: SmashUpCore = {
        ...core,
        players: normalizePlayers(core.players, anomalies),
        bases: normalizeBases(core.bases, anomalies),
        turnOrder: Array.isArray(core.turnOrder)
            ? core.turnOrder.filter((playerId): playerId is string => typeof playerId === 'string')
            : [],
        titans: normalizeTitans(core.titans, anomalies),
        madnessDeck: core.madnessDeck === undefined
            ? undefined
            : normalizeMadnessDeck(core.madnessDeck, 'madnessDeck', anomalies),
        monsterDeck: core.monsterDeck === undefined
            ? undefined
            : normalizeMadnessDeck(core.monsterDeck, 'monsterDeck', anomalies),
        treasureDeck: core.treasureDeck === undefined
            ? undefined
            : normalizeMadnessDeck(core.treasureDeck, 'treasureDeck', anomalies),
        treasureDiscard: core.treasureDiscard === undefined
            ? undefined
            : normalizeMadnessDeck(core.treasureDiscard, 'treasureDiscard', anomalies),
    };

    if (core.turnOrder !== undefined && !Array.isArray(core.turnOrder)) {
        anomalies.push({
            path: 'turnOrder',
            actual: core.turnOrder === null ? 'null' : 'non-array',
        });
    }

    return {
        core: normalizedCore,
        anomalies,
    };
}
