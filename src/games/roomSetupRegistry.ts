import type { PublicSetupSummary } from '../shared/lobby';
import {
    buildFantasyRealmsPublicRoomSummary,
} from './fantasyrealms/roomSetup';
import { buildBetrayalPublicRoomSummary } from './betrayal/roomSetup';
import { buildQidahenPublicRoomSummary } from './qidahen/roomSetup';
import { buildSmashUpPublicRoomSummary } from './smashup/roomSetup';

type SetupDataRecord = Record<string, unknown> | undefined;
type PublicSetupSummaryBuilder = (setupData?: SetupDataRecord, runtimeState?: unknown) => PublicSetupSummary;

const PUBLIC_SETUP_SUMMARY_BUILDERS: Record<string, PublicSetupSummaryBuilder | undefined> = {
    betrayal: buildBetrayalPublicRoomSummary,
    fantasyrealms: buildFantasyRealmsPublicRoomSummary,
    qidahen: buildQidahenPublicRoomSummary,
    smashup: buildSmashUpPublicRoomSummary,
};

function normalizeGameId(gameId?: string): string {
    return (gameId ?? '').trim().toLowerCase();
}

export function buildGamePublicRoomSummary(
    gameId: string,
    setupData?: SetupDataRecord,
    runtimeState?: unknown,
): PublicSetupSummary {
    return PUBLIC_SETUP_SUMMARY_BUILDERS[normalizeGameId(gameId)]?.(setupData, runtimeState);
}

export function shouldReadGameStateForPublicRoomSummary(gameId?: string): boolean {
    return normalizeGameId(gameId) === 'betrayal';
}

export function shouldRefreshPublicRoomSummaryAfterCommand(gameId: string | undefined, commandType: string): boolean {
    return normalizeGameId(gameId) === 'betrayal' && commandType === 'START_SCENARIO';
}
