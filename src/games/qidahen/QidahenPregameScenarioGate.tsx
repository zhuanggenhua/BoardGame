import React from 'react';
import {
    buildLocalMatchSetupData,
    resolveLocalMatchPlayerCount,
} from '../../engine/ai/seatControllers';
import type { GameSetupSelections } from '../setupOptions';
import {
    QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD,
    QIDAHEN_PLAYER_OPTIONS,
} from './roomSetup';
import { QIDAHEN_DEFAULT_TUTORIAL_ID } from './tutorial';
import { buildQidahenTutorialSetupData } from './tutorialSetup';

type QidahenPregameScenarioGateReadyState = {
    numPlayers: number;
    setupSelections: GameSetupSelections;
    setupData: Record<string, unknown>;
};

type QidahenPregameScenarioGateProps = {
    searchParams: URLSearchParams;
    tutorialId?: string;
    tutorialMode?: boolean;
    onSearchParamsChange: (nextSearchParams: URLSearchParams) => void;
    children: (readyState: QidahenPregameScenarioGateReadyState) => React.ReactNode;
};

const QIDAHEN_DEFAULT_LOCAL_PLAYERS = 3;
const QIDAHEN_LOCAL_PLAYER_OPTIONS = [
    QIDAHEN_DEFAULT_LOCAL_PLAYERS,
    ...QIDAHEN_PLAYER_OPTIONS.filter((count) => count !== QIDAHEN_DEFAULT_LOCAL_PLAYERS),
];

const createInMatchScenarioVoteSelections = (): GameSetupSelections => ({
    [QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD]: 'enabled',
});

export function QidahenPregameScenarioGate({
    searchParams,
    tutorialId,
    tutorialMode = false,
    children,
}: QidahenPregameScenarioGateProps) {
    const effectiveTutorialId = tutorialMode
        ? (tutorialId ?? QIDAHEN_DEFAULT_TUTORIAL_ID)
        : tutorialId;
    const tutorialSetupData = React.useMemo(
        () => buildQidahenTutorialSetupData(effectiveTutorialId),
        [effectiveTutorialId],
    );

    if (tutorialSetupData) {
        return (
            <>
                {children({
                    numPlayers: tutorialSetupData.numPlayers,
                    setupSelections: tutorialSetupData.setupSelections,
                    setupData: tutorialSetupData.setupData,
                })}
            </>
        );
    }

    const numPlayers = resolveLocalMatchPlayerCount(
        searchParams.get('players'),
        QIDAHEN_LOCAL_PLAYER_OPTIONS,
    );
    const setupSelections = createInMatchScenarioVoteSelections();

    return (
        <>
            {children({
                numPlayers,
                setupSelections,
                setupData: buildLocalMatchSetupData(setupSelections),
            })}
        </>
    );
}

export default QidahenPregameScenarioGate;
