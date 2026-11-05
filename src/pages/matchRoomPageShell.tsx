import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import { SEO } from '../components/common/SEO';
import { MobileBoardShell } from '../components/game/framework';
import { UI_Z_INDEX } from '../core';
import { GameCursorProvider } from '../core/cursor';
import { GamePageRuntimeProvider } from '../games/pageRuntimeAdapter';
import {
    MatchRoomOnlineBoardStage,
    MatchRoomTutorialBoardStage,
} from './matchRoomStages';
import { shouldShowMatchRoomTutorialCatalog } from './matchRoomTutorialCatalog';
import type { MatchRoomPageShellModel } from './matchRoomPageModelBuilders';

export function MatchRoomPageShell({ shell }: { shell: MatchRoomPageShellModel }) {
    const BoardRuntimeProvider = shell.boardShell.Provider;
    const stageContent = (
        <>
            {shell.tutorialHud ? <GameHUD {...shell.tutorialHud} /> : null}
            <div className="w-full h-full" style={shell.boardShellStyle}>
                <BoardRuntimeProvider>
                    <GameCursorProvider
                        themeId={shell.cursorThemeId}
                        gameId={shell.gameId}
                        playerID={shell.cursorPlayerID}
                    >
                        {shell.tutorialStage ? <MatchRoomTutorialBoardStage stage={shell.tutorialStage} /> : null}
                        {shell.onlineStage ? <MatchRoomOnlineBoardStage stage={shell.onlineStage} /> : null}
                    </GameCursorProvider>
                </BoardRuntimeProvider>
            </div>
        </>
    );

    return (
        <div className="relative w-full game-page-viewport bg-black overflow-hidden font-sans" {...shell.rootDataAttributes}>
            <SEO title={shell.seoTitle} ogType="game" noIndex />
            <GamePageRuntimeProvider gameId={shell.gameId}>
                {shell.showSpectatorShield && (
                    <div
                        className="absolute inset-0 bg-transparent pointer-events-auto"
                        style={{ zIndex: UI_Z_INDEX.loading }}
                        aria-hidden="true"
                    />
                )}

                {shouldShowMatchRoomTutorialCatalog(shell.tutorialStage) ? stageContent : (
                    <MobileBoardShell battlefieldZoomMode={shell.battlefieldZoomMode}>
                        {stageContent}
                    </MobileBoardShell>
                )}
            </GamePageRuntimeProvider>
        </div>
    );
}
