/**
 * UGC 远程宿主 Board（Remote Host）
 *
 * 仅透传命令与状态，不在客户端执行 rulesCode。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameBoardProps } from '../../engine/transport/protocol';
import type { MatchState } from '../../engine/types';
import type { UGCGameState, PlayerId } from '../sdk/types';
import { createHostBridge, type UGCHostBridge } from '../runtime/hostBridge';
import { attachBuilderPreviewConfig, type BuilderPreviewConfig } from '../runtime/previewConfig';

export interface UgcRemoteHostBoardOptions {
    packageId: string;
    viewUrl?: string | null;
    allowedOrigins?: string[];
    previewConfig?: BuilderPreviewConfig;
}

const DEFAULT_RUNTIME_VIEW_URL = '/dev/ugc/runtime-view';

export const createUgcRemoteHostBoard = (options: UgcRemoteHostBoardOptions) => {
    const { packageId, viewUrl, allowedOrigins, previewConfig } = options;
    const iframeSrc = viewUrl && viewUrl.trim() ? viewUrl.trim() : DEFAULT_RUNTIME_VIEW_URL;

    const UgcRemoteHostBoard = ({ G, dispatch, playerID, matchData }: GameBoardProps<UGCGameState>) => {
        const iframeRef = useRef<HTMLIFrameElement | null>(null);
        const bridgeRef = useRef<UGCHostBridge | null>(null);
        const stateRef = useRef<UGCGameState | null>(null);
        const buildStateRef = useRef<(() => UGCGameState) | null>(null);
        const handleCommandRef = useRef<((commandType: string, playerId: PlayerId, params: Record<string, unknown>) =>
            Promise<{ success: boolean; error?: string }>) | null>(null);
        const [iframeReady, setIframeReady] = useState(false);
        const [runtimeError, setRuntimeError] = useState<string | null>(null);

        const coreState = (G?.core ?? {}) as Partial<UGCGameState>;
        const corePlayers = (coreState.players && typeof coreState.players === 'object')
            ? coreState.players
            : {};

        const playerIds = useMemo<PlayerId[]>(() => {
            // 从 matchData 获取玩家列表，或从 core state 获取
            if (matchData && matchData.length > 0) {
                return matchData.map((p) => String(p.id));
            }
            return Object.keys(corePlayers);
        }, [matchData, corePlayers]);

        const currentPlayerId = useMemo<PlayerId>(() => {
            if (coreState.activePlayerId) return coreState.activePlayerId;
            return playerIds[0] ?? '';
        }, [coreState.activePlayerId, playerIds]);

        const buildState = useCallback((): UGCGameState => {
            const phase = typeof coreState.phase === 'string' ? coreState.phase : (G?.sys?.phase ?? '');
            const turnNumber = typeof coreState.turnNumber === 'number' ? coreState.turnNumber : (G?.sys?.turnNumber ?? 0);
            const sysGameOver = G?.sys?.gameover
                ? { winner: G.sys.gameover.winner, draw: G.sys.gameover.draw }
                : undefined;
            const gameOver = coreState.gameOver ?? sysGameOver;
            const baseState: UGCGameState = {
                phase,
                activePlayerId: coreState.activePlayerId ?? currentPlayerId,
                turnNumber,
                players: corePlayers,
                publicZones: coreState.publicZones ?? {},
                gameOver,
            };
            if (previewConfig) {
                return attachBuilderPreviewConfig(baseState, previewConfig);
            }
            return baseState;
        }, [coreState, corePlayers, G?.sys?.phase, G?.sys?.turnNumber, G?.sys?.gameover, currentPlayerId, previewConfig]);

        useEffect(() => {
            buildStateRef.current = buildState;
        }, [buildState]);

        useEffect(() => {
            const nextState = buildState();
            // 只有状态真正变化时才发送更新
            if (JSON.stringify(stateRef.current) !== JSON.stringify(nextState)) {
                stateRef.current = nextState;
                bridgeRef.current?.sendStateUpdate();
            }
        }, [buildState]);

        const handleCommand = useCallback(async (
            commandType: string,
            runtimePlayerId: PlayerId,
            params: Record<string, unknown>
        ) => {
            // 通过 dispatch 发送命令到引擎
            try {
                dispatch(commandType, params);
                return { success: true };
            } catch (error) {
                return { success: false, error: error instanceof Error ? error.message : '命令执行失败' };
            }
        }, [dispatch]);

        useEffect(() => {
            handleCommandRef.current = handleCommand;
        }, [handleCommand]);

        const commandHandler = useCallback((
            commandType: string,
            playerId: PlayerId,
            params: Record<string, unknown>
        ) => handleCommandRef.current?.(commandType, playerId, params)
            ?? Promise.resolve({ success: false, error: '命令处理器未就绪' }), []);

        useEffect(() => {
            if (!iframeReady || !iframeRef.current) return undefined;

            const bridge = createHostBridge({
                iframe: iframeRef.current,
                packageId,
                currentPlayerId,
                playerIds,
                allowedOrigins,
                onCommand: commandHandler,
                getState: () => stateRef.current ?? buildStateRef.current?.() ?? buildState(),
                onError: (error) => setRuntimeError(error),
            });
            bridge.start();
            bridgeRef.current = bridge;

            return () => {
                bridge.stop();
                bridgeRef.current = null;
            };
        }, [iframeReady, packageId, currentPlayerId, playerIds, allowedOrigins, commandHandler]);

        if (runtimeError) {
            return (
                <div className="flex h-full w-full items-center justify-center bg-slate-950 text-red-300 text-xs">
                    {runtimeError}
                </div>
            );
        }

        return (
            <div className="relative h-full w-full bg-slate-950">
                <iframe
                    ref={iframeRef}
                    title={`UGC Remote Host ${packageId}`}
                    src={iframeSrc}
                    className="h-full w-full border-0"
                    onLoad={() => setIframeReady(true)}
                />
            </div>
        );
    };

    UgcRemoteHostBoard.displayName = `UgcRemoteHostBoard(${packageId})`;
    return UgcRemoteHostBoard;
};
