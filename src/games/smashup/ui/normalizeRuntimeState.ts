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

export interface SmashUpRuntimeStateAnomaly {
    path: string;
    actual: 'null' | 'non-array' | 'invalid-entry';
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
        return core;
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
    return asObjectArray<OngoingActionOnBase>(value, path, anomalies);
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
    return asObjectArray<TitanState>(titans, 'titans', anomalies);
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
