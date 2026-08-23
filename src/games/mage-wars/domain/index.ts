import type { DomainCore, PlayerId, RandomFn } from '../../../engine/types';
import {
    MAGE_WARS_GAME_ID,
    type ArenaZoneId,
} from './ids';
import {
    getFormalArenaZonesFromConfig,
    getFormalStartingMageIdFromConfig,
    getFormalStartingZoneIdFromConfig,
    getPresetMageSetupFromConfig,
    getPresetSpellbookCountFromConfig,
} from '../data/configPackage';
import { executeCommand } from './execute';
import { reduceEvent } from './reducer';
import { validateCommand } from './validate';
import type { MageWarsCore, MageWarsCommand, MageWarsEvent, MageWarsPlayerState } from './types';
import { discoverMageWarsTimingOpportunities } from './timingOpportunities';

function normalizePlayerIds(playerIds: PlayerId[]): PlayerId[] {
    return playerIds.length >= 2 ? playerIds.slice(0, 2) : ['0', '1'];
}

function createPlayerState(playerId: PlayerId, seatIndex: number, mageZoneId: ArenaZoneId): MageWarsPlayerState {
    const mageId = getFormalStartingMageIdFromConfig(seatIndex);
    const setup = getPresetMageSetupFromConfig(mageId);

    return {
        id: playerId,
        mageId,
        life: setup.startingLife,
        damage: 0,
        mana: setup.startingMana,
        channeling: setup.channeling,
        baseMeleeDice: setup.baseMeleeDice,
        actionReady: true,
        quickcastReady: true,
        guarding: false,
        statusTokens: {},
        mageZoneId,
        spellbookCount: getPresetSpellbookCountFromConfig(mageId),
        preparedSpellSlots: 0,
        preparedSpellCardIds: [],
        discardSpellCardIds: [],
    };
}

function createFormalArena(playerIds: PlayerId[]) {
    const startingZoneByPlayerId = new Map(
        playerIds.map((playerId, index) => [playerId, getFormalStartingZoneIdFromConfig(index)] as const),
    );

    return getFormalArenaZonesFromConfig().map(({ zoneId, rowIndex, colIndex }) => ({
        id: zoneId,
        row: rowIndex,
        col: colIndex,
        occupantIds: playerIds.filter((playerId) => startingZoneByPlayerId.get(playerId) === zoneId),
        objectIds: [],
        conjurationIds: [],
    }));
}

function resolveStartingZoneId(seatIndex: number): ArenaZoneId {
    return getFormalStartingZoneIdFromConfig(seatIndex);
}

function createMageWarsPlayerView(core: MageWarsCore, playerId: PlayerId): Partial<MageWarsCore> {
        return {
            objects: Object.fromEntries(Object.entries(core.objects).map(([objectId, object]) => {
                if (object.ownerId === playerId || object.preparedSpellCardId === undefined) {
                    return [objectId, object];
            }
            const { preparedSpellCardId: _hiddenPreparedSpellCardId, ...visibleObject } = object;
                return [objectId, { ...visibleObject, preparedSpellCount: object.preparedSpellCount ?? 1 }];
            })),
            walls: core.walls,
        };
}

export const MageWarsDomain: DomainCore<MageWarsCore, MageWarsCommand, MageWarsEvent> = {
    gameId: MAGE_WARS_GAME_ID,

    setup: (playerIds: PlayerId[], _random: RandomFn): MageWarsCore => {
        const normalizedPlayerIds = normalizePlayerIds(playerIds);
        const players = Object.fromEntries(
            normalizedPlayerIds.map((playerId, index) => [
                playerId,
                createPlayerState(playerId, index, resolveStartingZoneId(index)),
            ]),
        ) as Record<PlayerId, MageWarsPlayerState>;

        return {
            playerOrder: normalizedPlayerIds,
            currentPlayerId: normalizedPlayerIds[0],
            phaseReadyPlayerIds: [],
            turnNumber: 1,
            arenaMode: 'formal-4x3',
            players,
            objects: {},
            walls: {},
            arena: createFormalArena(normalizedPlayerIds),
            foundationStatus: {
                intakeComplete: true,
                openDesignArtifact: true,
                spellFxRequired: true,
                spellFxDriver: 'domain-events',
            },
            gameResult: undefined,
        };
    },

    validate: validateCommand,
    execute: executeCommand,
    reduce: reduceEvent,
    discoverTimingOpportunities: discoverMageWarsTimingOpportunities,
    playerView: createMageWarsPlayerView,
    isGameOver: (core) => {
        if (core.gameResult) return core.gameResult;
        const defeated = core.playerOrder.filter((playerId) => {
            const player = core.players[playerId];
            return player && player.damage >= player.life;
        });
        if (defeated.length === 0) return undefined;
        if (defeated.length > 1) return { draw: true };
        return { winner: core.playerOrder.find((playerId) => playerId !== defeated[0]) };
    },
};

export type {
    MageWarsCommand,
    MageWarsArenaObjectState,
    MageWarsCore,
    MageWarsEvent,
    MageWarsPlayerState,
    MageWarsSpellCasterRef,
} from './types';

export {
    MAGE_WARS_COMMANDS,
    MAGE_WARS_EVENTS,
} from './types';
