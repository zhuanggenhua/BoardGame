import type { MatchStorage } from '../engine/transport/storage';
import { isAuthenticatedRematchPlayer } from './rematch';
import { BETRAYAL_SCENARIO_SETUP_OPTIONS } from '../games/betrayal/roomSetup';
import {
    isMageWarsSelectableMageId,
    MAGE_WARS_SEAT_MAGE_SETUP_FIELDS,
    MAGE_WARS_SEAT_SPELLBOOK_SETUP_FIELDS,
} from '../games/mage-wars/roomSetup';

type RematchErrorCode = 'REMATCH_PROOF_REQUIRED' | 'REMATCH_PROOF_INVALID'
    | 'REMATCH_SOURCE_NOT_FOUND' | 'REMATCH_OWNER_MISMATCH' | 'REMATCH_SETUP_UNSUPPORTED'
    | 'ROOM_REPLACEMENT_UNSUPPORTED';

export class RematchCreateError extends Error {
    constructor(readonly status: 403 | 404 | 409, readonly code: RematchErrorCode) {
        super(code);
        this.name = 'RematchCreateError';
    }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : undefined;
}

function unsupported(): never {
    throw new RematchCreateError(409, 'REMATCH_SETUP_UNSUPPORTED');
}

const COMMON_SETUP_FIELDS = new Set([
    'ownerKey', 'ownerType', 'guestId', 'roomName', 'password', 'ttlSeconds',
    'enableAi', 'seatControllers', 'setupSelections', 'firstPlayerId', 'turnOrder',
]);
const BETRAYAL_FIELDS = new Set(['scenario', 'scenarioId']);
const MAGE_FIELDS = new Set<string>([...MAGE_WARS_SEAT_MAGE_SETUP_FIELDS, ...MAGE_WARS_SEAT_SPELLBOOK_SETUP_FIELDS]);
const CONTROLLER_FIELDS: Record<string, readonly string[]> = {
    human: ['type'],
    'local-ai': ['type', 'policyId', 'fallbackPolicyId', 'difficulty', 'minimumActionDelayMs', 'manualSetupSelection', 'manualFactionSelection'],
    'remote-ai': ['type', 'providerId', 'fallbackPolicyId', 'timeoutMs', 'retryCount', 'minimumActionDelayMs', 'manualSetupSelection', 'manualFactionSelection'],
};

function validateControllers(value: unknown, playerIds: string[]): void {
    const controllers = asRecord(value);
    if (!controllers) unsupported();
    for (const [id, raw] of Object.entries(controllers)) {
        const controller = asRecord(raw);
        const fields = typeof controller?.type === 'string' ? CONTROLLER_FIELDS[controller.type] : undefined;
        if (!playerIds.includes(id) || !controller || !fields) unsupported();
        for (const [key, field] of Object.entries(controller)) {
            if (!fields.includes(key)) unsupported();
            if (['policyId', 'fallbackPolicyId', 'providerId'].includes(key) && (typeof field !== 'string' || !field.trim())) unsupported();
            if (key === 'difficulty' && !['easy', 'normal', 'hard', 'expert'].includes(String(field))) unsupported();
            if (['manualSetupSelection', 'manualFactionSelection'].includes(key) && typeof field !== 'boolean') unsupported();
            if (['minimumActionDelayMs', 'timeoutMs', 'retryCount'].includes(key)
                && (typeof field !== 'number' || !Number.isSafeInteger(field) || field < 0)) unsupported();
        }
        if (controller.type === 'remote-ai' && typeof controller.providerId !== 'string') unsupported();
    }
}

function validateGameFields(gameName: string, fields: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(fields)) {
        if (gameName === 'betrayal' && BETRAYAL_FIELDS.has(key)) {
            if (!BETRAYAL_SCENARIO_SETUP_OPTIONS.some(option => option.value === value)) unsupported();
        } else if (gameName === 'mage-wars' && MAGE_FIELDS.has(key)) {
            if ((MAGE_WARS_SEAT_MAGE_SETUP_FIELDS as readonly string[]).includes(key)) {
                if (!isMageWarsSelectableMageId(value)) unsupported();
            } else {
                let entries: unknown = value;
                if (typeof entries === 'string') {
                    try { entries = JSON.parse(entries); } catch { unsupported(); }
                }
                if (!Array.isArray(entries)) unsupported();
                for (const raw of entries) {
                    const entry = asRecord(raw);
                    if (!entry || Object.keys(entry).some(field => field !== 'spellCardId' && field !== 'count')
                        || typeof entry.spellCardId !== 'number' || !Number.isSafeInteger(entry.spellCardId)
                        || typeof entry.count !== 'number' || !Number.isSafeInteger(entry.count) || entry.count <= 0) unsupported();
                }
            }
        } else unsupported();
    }
}

/** Fail closed rather than silently replacing an unsupported game's private setup. */
function cloneSupportedSetup(gameName: string, setup: Record<string, unknown>, playerIds: string[]): Record<string, unknown> {
    if (!['tictactoe', 'betrayal', 'mage-wars'].includes(gameName)) unsupported();
    const gameFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(setup)) {
        if (!COMMON_SETUP_FIELDS.has(key)) gameFields[key] = value;
    }
    validateGameFields(gameName, gameFields);
    for (const key of ['roomName', 'password', 'guestId']) {
        if (Object.hasOwn(setup, key) && typeof setup[key] !== 'string') unsupported();
    }
    if (Object.hasOwn(setup, 'ttlSeconds')) {
        const ttl = setup.ttlSeconds;
        // Storage accepts integer durations, including values outside the UI presets.
        if (typeof ttl !== 'number' || !Number.isSafeInteger(ttl) || ttl < 0 || Date.now() + ttl * 1000 > 8.64e15) unsupported();
    }
    if (Object.hasOwn(setup, 'enableAi') && typeof setup.enableAi !== 'boolean') unsupported();
    if (Object.hasOwn(setup, 'seatControllers')) validateControllers(setup.seatControllers, playerIds);
    if (Object.hasOwn(setup, 'setupSelections')) {
        const selections = asRecord(setup.setupSelections);
        if (!selections) unsupported();
        validateGameFields(gameName, selections);
    }
    const copy = structuredClone(setup);
    // These are previous-round runtime hints, not persistent room choices.
    delete copy.firstPlayerId;
    delete copy.turnOrder;
    return copy;
}

/** Source metadata is server-only. P0 proof is checked before any configuration is returned. */
export async function prepareRematchCreate(args: {
    gameName: string;
    request: unknown;
    authenticatedUserId?: string;
    fetch: MatchStorage['fetch'];
}): Promise<{
    sourceMatchID: string;
    numPlayers: number;
    setupData: Record<string, unknown>;
    ownerKey: string;
    ownerType: 'guest' | 'user';
    ownerName?: string;
}> {
    const request = asRecord(args.request);
    if (typeof request?.matchID !== 'string' || !request.matchID.trim()
        || request.playerID !== '0' || typeof request.credentials !== 'string' || !request.credentials.trim()) {
        throw new RematchCreateError(403, 'REMATCH_PROOF_REQUIRED');
    }
    const { metadata } = await args.fetch(request.matchID, { metadata: true });
    if (!metadata) throw new RematchCreateError(404, 'REMATCH_SOURCE_NOT_FOUND');
    if (metadata.gameName.toLowerCase() !== args.gameName
        || !isAuthenticatedRematchPlayer(metadata, '0', request.credentials)) {
        throw new RematchCreateError(403, 'REMATCH_PROOF_INVALID');
    }
    const setup = asRecord(metadata.setupData);
    const ownerKey = setup?.ownerKey;
    const ownerType = setup?.ownerType;
    if (!setup || typeof ownerKey !== 'string' || !['guest', 'user'].includes(String(ownerType))
        || !ownerKey.startsWith(`${ownerType}:`) || !ownerKey.slice(String(ownerType).length + 1)
        || (metadata.players['0'].ownerKey !== undefined && metadata.players['0'].ownerKey !== ownerKey)
        || (ownerType === 'user' && ownerKey !== `user:${args.authenticatedUserId ?? ''}`)
        || (ownerType === 'guest' && setup.guestId !== undefined && ownerKey !== `guest:${setup.guestId}`)) {
        throw new RematchCreateError(403, 'REMATCH_OWNER_MISMATCH');
    }
    const playerIds = Object.keys(metadata.players).sort((a, b) => Number(a) - Number(b));
    if (!playerIds.length || playerIds.some((id, index) => id !== String(index))) unsupported();
    return {
        sourceMatchID: request.matchID,
        numPlayers: playerIds.length,
        setupData: cloneSupportedSetup(args.gameName, setup, playerIds),
        ownerKey,
        ownerType: ownerType as 'guest' | 'user',
        ownerName: metadata.players['0'].name,
    };
}
