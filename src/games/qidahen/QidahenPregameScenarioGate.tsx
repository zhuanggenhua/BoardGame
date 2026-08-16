import React from 'react';
import type { GameSetupSelections } from '../../shared/gameSetupOptions';
import { resolveQidahenLocalSetup } from './pregameSetup';

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

export function QidahenPregameScenarioGate({
    searchParams,
    tutorialId,
    tutorialMode = false,
    children,
}: QidahenPregameScenarioGateProps) {
    const setup = React.useMemo(
        () => resolveQidahenLocalSetup({ searchParams, tutorialId, tutorialMode }),
        [searchParams, tutorialId, tutorialMode],
    );
    const readyState: QidahenPregameScenarioGateReadyState = {
        numPlayers: setup.numPlayers,
        setupSelections: setup.setupSelections ?? {},
        setupData: setup.setupData ?? {},
    };

    return (
        <>
            {children(readyState)}
        </>
    );
}

export default QidahenPregameScenarioGate;
