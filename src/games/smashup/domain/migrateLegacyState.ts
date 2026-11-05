import type { SmashUpCore } from './types';
import type { MatchState } from '../../../engine/types';
import { migrateSmashUpLegacyMatchState } from './legacyRuntimeState';

export function normalizeSmashUpRuntimeObjectArray<T extends object>(value: T[] | null | undefined): T[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return [];

    let changed = false;
    const normalized: T[] = [];
    value.forEach((entry) => {
        if (entry && typeof entry === 'object') {
            normalized.push(entry);
            return;
        }
        changed = true;
    });

    return changed ? normalized : value;
}

export function normalizeSmashUpRuntimeStringArray(value: string[] | null | undefined): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return undefined;

    let changed = false;
    const normalized: string[] = [];
    value.forEach((entry) => {
        if (typeof entry === 'string') {
            normalized.push(entry);
            return;
        }
        changed = true;
    });

    return changed ? normalized : value;
}

export function normalizeSmashUpRuntimeMadnessDeck(value: SmashUpCore['madnessDeck']): SmashUpCore['madnessDeck'] {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return [];

    let changed = false;
    const normalized: string[] = [];
    value.forEach((entry) => {
        if (typeof entry === 'string') {
            normalized.push(entry);
            return;
        }
        if (entry && typeof entry === 'object' && typeof (entry as { defId?: unknown }).defId === 'string') {
            normalized.push((entry as { defId: string }).defId);
            changed = true;
            return;
        }
        changed = true;
    });

    return changed ? normalized : value;
}

export function normalizeLegacySmashUpMatchState(state: MatchState<SmashUpCore>): MatchState<SmashUpCore> {
    const core = state.core;
    let changed = false;

    const normalizedPlayers = Object.fromEntries(
        Object.entries(core.players).map(([playerId, player]) => {
            const pendingMinionPlayEffects = normalizeSmashUpRuntimeObjectArray(player.pendingMinionPlayEffects);
            const usedDiscardPlayAbilities = normalizeSmashUpRuntimeStringArray(player.usedDiscardPlayAbilities);

            if (
                pendingMinionPlayEffects === player.pendingMinionPlayEffects &&
                usedDiscardPlayAbilities === player.usedDiscardPlayAbilities
            ) {
                return [playerId, player];
            }

            changed = true;
            return [
                playerId,
                {
                    ...player,
                    pendingMinionPlayEffects,
                    usedDiscardPlayAbilities,
                },
            ];
        }),
    ) as SmashUpCore['players'];

    const normalizedBases = core.bases.map((base) => {
        const buriedCards = normalizeSmashUpRuntimeObjectArray(base.buriedCards);
        if (buriedCards === base.buriedCards) {
            return base;
        }
        changed = true;
        return {
            ...base,
            buriedCards,
        };
    });

    const normalizedMadnessDeck = normalizeSmashUpRuntimeMadnessDeck(core.madnessDeck);
    if (normalizedMadnessDeck !== core.madnessDeck) {
        changed = true;
    }

    const normalizedState = changed
        ? {
              ...state,
              core: {
                  ...core,
                  players: normalizedPlayers,
                  bases: normalizedBases,
                  madnessDeck: normalizedMadnessDeck,
              },
          }
        : state;

    return migrateSmashUpLegacyMatchState(normalizedState);
}
