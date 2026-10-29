/**
 * 自动跳过角色选择阶段的 Hook
 * 从 Board.tsx 提取
 */

import React from 'react';
import type { DiceThroneMoveMap } from '../ui/resolveMoves';
import { isSetupReadyToStart } from '../domain/rules';
import type { CharacterId } from '../domain/types';

interface AutoSkipSelectionParams {
    currentPhase: string;
    isSpectator: boolean;
    gameMode: { mode: string } | null | undefined;
    rootPid: string;
    selectedCharacters: Record<string, CharacterId>;
    hostPlayerId?: string;
    hostStarted?: boolean;
    readyPlayers?: Record<string, boolean>;
    engineMoves: Pick<DiceThroneMoveMap, 'selectCharacter' | 'hostStartGame' | 'playerReady'>;
}

export function useAutoSkipSelection({
    currentPhase,
    isSpectator,
    gameMode,
    rootPid,
    selectedCharacters,
    hostPlayerId,
    hostStarted,
    readyPlayers,
    engineMoves,
}: AutoSkipSelectionParams) {
    const shouldAutoSkipSelection = React.useMemo(() => {
        if (typeof window === 'undefined') return false;
        try {
            return window.localStorage.getItem('tutorial_skip') === '1';
        } catch {
            return false;
        }
    }, []);
    const autoSkipStageRef = React.useRef<'idle' | 'selected' | 'completed'>('idle');

    React.useEffect(() => {
        if (!shouldAutoSkipSelection) return;
        if (isSpectator) return;
        if (gameMode?.mode === 'tutorial') return;
        if (currentPhase !== 'setup') return;

        const isAutoSkipDone = () => {
            const selectedCharacter = selectedCharacters[rootPid];
            const hasSelected = selectedCharacter && selectedCharacter !== 'unselected';
            if (!hasSelected) return false;
            if (gameMode?.mode === 'online') {
                if (rootPid === hostPlayerId) {
                    return hostStarted;
                }
                return !!readyPlayers?.[rootPid];
            }
            if (gameMode?.mode === 'local') {
                return hostStarted;
            }
            return false;
        };

        const attemptAutoSkip = () => {
            if (isAutoSkipDone()) {
                autoSkipStageRef.current = 'completed';
                window.clearInterval(timer);
                return;
            }

            const selectedCharacter = selectedCharacters[rootPid];
            const hasSelected = selectedCharacter && selectedCharacter !== 'unselected';

            if (!hasSelected) {
                const defaultCharacter = rootPid === '1' ? 'barbarian' : 'monk';
                engineMoves.selectCharacter(defaultCharacter);
                autoSkipStageRef.current = 'selected';
                return;
            }

            if (gameMode?.mode === 'online') {
                if (rootPid === hostPlayerId) {
                    const canStart = isSetupReadyToStart({
                        playerIds: Object.keys(selectedCharacters),
                        hostPlayerId: hostPlayerId ?? rootPid,
                        selectedCharacters,
                        readyPlayers: readyPlayers ?? {},
                    });
                    if (!hostStarted && canStart) {
                        engineMoves.hostStartGame();
                    }
                } else if (!readyPlayers?.[rootPid]) {
                    engineMoves.playerReady();
                }
                return;
            }

            if (gameMode?.mode === 'local') {
                if (!hostStarted) {
                    engineMoves.hostStartGame();
                }
            }
        };

        const timer = window.setInterval(attemptAutoSkip, 800);
        attemptAutoSkip();

        return () => {
            window.clearInterval(timer);
        };
    }, [
        selectedCharacters,
        currentPhase,
        engineMoves,
        gameMode?.mode,
        isSpectator,
        rootPid,
        shouldAutoSkipSelection,
        hostPlayerId,
        hostStarted,
        readyPlayers,
    ]);
}
