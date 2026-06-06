import type { PublicSetupSummary } from '../shared/lobby';
import { buildSmashUpPublicRoomSummary } from './smashup/roomSetup';

type SetupDataRecord = Record<string, unknown> | undefined;

type PublicSetupSummaryBuilder = (setupData?: SetupDataRecord) => PublicSetupSummary;

const PUBLIC_SETUP_SUMMARY_BUILDERS: Record<string, PublicSetupSummaryBuilder | undefined> = {
    smashup: buildSmashUpPublicRoomSummary,
};

export function buildGamePublicRoomSummary(
    gameId: string,
    setupData?: SetupDataRecord,
): PublicSetupSummary {
    return PUBLIC_SETUP_SUMMARY_BUILDERS[gameId]?.(setupData);
}
