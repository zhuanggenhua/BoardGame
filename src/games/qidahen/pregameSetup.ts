import {
    buildLocalMatchSetupData,
    resolveLocalMatchPlayerCount,
} from '../../engine/ai/seatControllers';
import type {
    GameRuntimeLocalSetupContext,
    GameRuntimeLocalSetupResult,
} from '../gameRuntimeAdapter';
import type { GameSetupSelections } from '../../shared/gameSetupOptions';
import {
    QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD,
    QIDAHEN_PLAYER_OPTIONS,
} from './roomSetup';
import { QIDAHEN_DEFAULT_TUTORIAL_ID } from './tutorial';
import { buildQidahenTutorialSetupData } from './tutorialSetup';

const QIDAHEN_DEFAULT_LOCAL_PLAYERS = 3;
const QIDAHEN_LOCAL_PLAYER_OPTIONS = [
    QIDAHEN_DEFAULT_LOCAL_PLAYERS,
    ...QIDAHEN_PLAYER_OPTIONS.filter((count) => count !== QIDAHEN_DEFAULT_LOCAL_PLAYERS),
];

const createInMatchScenarioVoteSelections = (): GameSetupSelections => ({
    [QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD]: 'enabled',
});

export function resolveQidahenLocalSetup({
    searchParams,
    tutorialId,
    tutorialMode = false,
}: GameRuntimeLocalSetupContext): GameRuntimeLocalSetupResult {
    const effectiveTutorialId = tutorialMode
        ? (tutorialId ?? QIDAHEN_DEFAULT_TUTORIAL_ID)
        : tutorialId;
    const tutorialSetupData = buildQidahenTutorialSetupData(effectiveTutorialId);

    if (tutorialSetupData) {
        return tutorialSetupData;
    }

    const numPlayers = resolveLocalMatchPlayerCount(
        searchParams.get('players'),
        QIDAHEN_LOCAL_PLAYER_OPTIONS,
    );
    const setupSelections = createInMatchScenarioVoteSelections();

    return {
        numPlayers,
        setupSelections,
        setupData: buildLocalMatchSetupData(setupSelections),
    };
}
