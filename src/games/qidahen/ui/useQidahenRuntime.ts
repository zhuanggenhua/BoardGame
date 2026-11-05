import React from 'react';
import type { Props } from './boardTypes';
import { useTutorial, useTutorialBridge } from '../../../contexts/TutorialContext';
import { useEndgame } from '../../../hooks/game/useEndgame';
import { useGameAudio } from '../../../lib/audio/useGameAudio';
import { QIDAHEN_AUDIO_CONFIG } from '../audio.config';
import { QIDAHEN_MANIFEST } from '../manifest';
import { getCurrentFactionId } from '../domain/factionTurnAccessors';
import { resolveViewerFactionId } from './boardReadModel';

export function useQidahenRuntime({ G, dispatch, playerID, reset, matchData, isMultiplayer }: Props) {
    const { isActive: isTutorialActive, currentStep: tutorialStep, nextStep: nextTutorialStep } = useTutorial();

    const core = G.core;

    const isGameOver = Boolean(G.sys?.gameover);

    const gameOverResult = G.sys?.gameover;

    const runtimeDispatch = dispatch as (type: string, payload?: unknown) => void;

    useTutorialBridge(G.sys.tutorial, runtimeDispatch);

    React.useEffect(() => {
        if (!isTutorialActive || !tutorialStep?.hideOverlay) {
            return undefined;
        }
        if (core.lastSeasonSummary?.title !== '轮盘征兵/训练') {
            return undefined;
        }
        const timeoutId = window.setTimeout(() => {
            nextTutorialStep('auto');
        }, 2200);
        return () => window.clearTimeout(timeoutId);
    }, [
        core.lastSeasonSummary?.id,
        core.lastSeasonSummary?.title,
        isTutorialActive,
        nextTutorialStep,
        tutorialStep?.hideOverlay,
        tutorialStep?.id,
    ]);

    const { overlayProps: endgameProps } = useEndgame({
        result: gameOverResult || undefined,
        playerID,
        reset,
        matchData,
        isMultiplayer,
    });

    const winnerPlayerId = gameOverResult?.winner;

    useGameAudio({
        config: QIDAHEN_AUDIO_CONFIG,
        gameId: QIDAHEN_MANIFEST.id,
        G: core,
        ctx: {
            turnPhase: core.turnPhase,
            isGameOver,
            isWinner: winnerPlayerId != null ? winnerPlayerId === playerID : undefined,
        },
        eventEntries: G.sys.eventStream?.entries,
    });

    const viewerFactionId = React.useMemo(
        () =>
            playerID == null && !core.factionSelection
                ? getCurrentFactionId(core)
                : resolveViewerFactionId(core, playerID),
        [core, playerID],
    );

    const playerNamesById = React.useMemo(
        () =>
            Object.fromEntries(
                (matchData ?? []).map((player) => [String(player.id), player.name?.trim() || `席位 ${player.id + 1}`]),
            ),
        [matchData],
    );

    const isTutorialCommandAllowed = React.useCallback(
        (commandType: string): boolean => {
            if (!isTutorialActive || !tutorialStep) {
                return true;
            }
            if (tutorialStep.allowedCommands && tutorialStep.allowedCommands.length > 0) {
                return tutorialStep.allowedCommands.includes(commandType);
            }
            return tutorialStep.infoStep !== true;
        },
        [isTutorialActive, tutorialStep],
    );
    return {
        isTutorialActive,
        tutorialStep,
        core,
        isGameOver,
        runtimeDispatch,
        endgameProps,
        viewerFactionId,
        playerNamesById,
        isTutorialCommandAllowed,
    };
}
