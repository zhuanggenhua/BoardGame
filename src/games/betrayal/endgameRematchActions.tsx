import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGameMode } from '../../contexts/GameModeContext';
import { useRematch } from '../../contexts/RematchContext';
import { useEndgame } from '../../hooks/game/useEndgame';
import { RematchActions } from '../../components/game/framework/widgets/RematchActions';
import type { MatchPlayerInfo } from '../../engine/transport/protocol';

export interface EndgameRematchProps {
    playerID?: string | null;
    reset?: () => void;
    isMultiplayer?: boolean;
    isConnected?: boolean;
    matchData?: MatchPlayerInfo[];
}

/** Only adapts the existing result button to the platform's local-reset / vote flow. */
export function EndgameRematchActions({ playerID = null, reset, isMultiplayer, isConnected, matchData }: EndgameRematchProps) {
    const { t } = useTranslation('game-betrayal');
    const gameMode = useGameMode();
    const { isConnected: rematchConnected } = useRematch();
    const online = isMultiplayer ?? gameMode?.isMultiplayer ?? false;
    const spectator = gameMode?.isSpectator === true || (online && playerID === null);
    const unavailable = spectator || (online ? isConnected === false || !rematchConnected : !reset);
    const { overlayProps } = useEndgame({
        result: undefined,
        isGameOverOverride: true,
        playerID,
        reset: online || spectator ? undefined : reset,
        isMultiplayer: online,
        matchData,
    });
    return <RematchActions
        {...overlayProps}
        playerID={playerID}
        className="flex-wrap"
        renderButton={({ role, label, onClick, disabled }) => role === 'backToLobby' ? null : (
            <button type="button" onClick={onClick} disabled={disabled || unavailable} className="relative inline-flex min-w-[138px] items-center justify-center gap-3 overflow-hidden border border-[#7d643a] bg-[linear-gradient(180deg,rgba(18,25,21,0.96),rgba(10,15,13,0.98))] px-4 py-2.5 text-[17px] font-semibold tracking-[0.12em] text-[#ddb774] shadow-[inset_0_0_0_1px_rgba(221,183,116,0.08)] disabled:cursor-not-allowed disabled:opacity-50">
                <span className="pointer-events-none absolute inset-1 border border-[rgba(214,191,129,0.12)]" />
                <span className="pointer-events-none absolute inset-x-4 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.34),transparent)]" />
                <RotateCcw size={22} />
                <span>{role === 'playAgain' || role === 'vote' ? t('board.endgame.rematch') : label}</span>
            </button>
        )}
    />;
}
