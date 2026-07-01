import { GameModeProvider } from '../contexts/GameModeContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TutorialCollection } from '../engine/types';
import {
    MatchRoomOnlineBoardRuntime as MatchRoomOnlineBoardStageRuntime,
    type MatchRoomOnlineBoardRuntimeModel as MatchRoomOnlineBoardStageRuntimeModel,
} from './matchRoomOnlineStageRuntime';
import {
    MatchRoomTutorialBoardRuntime as MatchRoomTutorialBoardStageRuntime,
    type MatchRoomTutorialBoardRuntimeModel as MatchRoomTutorialBoardStageRuntimeModel,
} from './matchRoomTutorialStageRuntime';
import { getVisibleTutorialCatalogEntries } from './useMatchRoomRuntimeSetup';

export type MatchRoomTutorialBoardStageModel = {
    noTutorialText: string;
    gameId?: string;
    tutorialId?: string;
    tutorialCatalog: TutorialCollection | null;
    runtime: MatchRoomTutorialBoardStageRuntimeModel | null;
};

export type MatchRoomOnlineBoardStageModel = {
    noClientText: string;
    runtime: MatchRoomOnlineBoardStageRuntimeModel | null;
};

const MatchRoomTutorialCatalogStage = ({ stage }: { stage: MatchRoomTutorialBoardStageModel }) => {
    const navigate = useNavigate();
    const { t: tLobby } = useTranslation('lobby');
    const { t } = useTranslation(stage.gameId ? `game-${stage.gameId}` : undefined);
    const tutorialCatalog = stage.tutorialCatalog;

    if (!stage.gameId || !tutorialCatalog) {
        return null;
    }

    const entries = getVisibleTutorialCatalogEntries(tutorialCatalog);
    const recommendedTutorialId = tutorialCatalog.tutorials[tutorialCatalog.defaultTutorialId]?.hiddenFromCatalog === true
        ? entries[0]?.[0]
        : tutorialCatalog.defaultTutorialId;

    return (
        <div className="flex h-full w-full items-center justify-center bg-[#120f0c] px-6 py-8 text-[#f4ead4]">
            <div className="w-full max-w-5xl rounded-[28px] border border-[#4f3d24] bg-[linear-gradient(180deg,rgba(46,32,18,0.96),rgba(24,17,10,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.42)] md:p-8">
                <div className="mb-6">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d5b98a]">
                        {tLobby('matchRoom.tutorialCatalog.eyebrow')}
                    </div>
                    <h2 className="mt-2 text-3xl font-bold text-[#f8f0df]">
                        {tLobby('matchRoom.tutorialCatalog.title')}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d6c6aa]">
                        {tLobby('matchRoom.tutorialCatalog.description')}
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    {entries.map(([tutorialId, entry], index) => {
                        const title = entry.titleKey
                            ? t(entry.titleKey, { defaultValue: entry.title ?? tutorialId })
                            : (entry.title ?? tutorialId);
                        const description = entry.descriptionKey
                            ? t(entry.descriptionKey, { defaultValue: entry.description ?? '' })
                            : (entry.description ?? '');
                        const isDefault = recommendedTutorialId === tutorialId;

                        return (
                            <button
                                key={tutorialId}
                                type="button"
                                data-testid={`tutorial-catalog-entry-${tutorialId}`}
                                onClick={() => navigate(`/play/${stage.gameId}/tutorial/${tutorialId}`)}
                                className="group flex min-h-[168px] flex-col rounded-[22px] border border-[#5d482a] bg-[rgba(255,248,233,0.04)] p-5 text-left transition hover:border-[#c9a96d] hover:bg-[rgba(255,248,233,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b67b]"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="text-sm font-semibold tracking-[0.16em] text-[#c9a96d]">
                                        {String(index + 1).padStart(2, '0')}
                                    </div>
                                    {isDefault ? (
                                        <span className="rounded-full border border-[#8e6d3b] bg-[rgba(201,169,109,0.12)] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#f0d7a1]">
                                            {tLobby('matchRoom.tutorialCatalog.recommended')}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="mt-5 text-2xl font-bold leading-tight text-[#f8f0df]">
                                    {title}
                                </div>
                                {description ? (
                                    <div className="mt-3 text-sm leading-6 text-[#d6c6aa]">
                                        {description}
                                    </div>
                                ) : null}
                                <div className="mt-auto pt-5 text-sm font-semibold text-[#f0d7a1]">
                                    {tLobby('matchRoom.tutorialCatalog.enter')}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const MatchRoomTutorialBoardStage = ({ stage }: { stage: MatchRoomTutorialBoardStageModel }) => {
    const tutorialCatalog = stage.tutorialCatalog;
    const shouldShowCatalog = !stage.tutorialId
        && Boolean(tutorialCatalog)
        && getVisibleTutorialCatalogEntries(tutorialCatalog).length > 1;

    if (shouldShowCatalog) {
        return (
            <GameModeProvider mode="tutorial">
                <MatchRoomTutorialCatalogStage stage={stage} />
            </GameModeProvider>
        );
    }

    if (!stage.runtime) {
        return (
            <GameModeProvider mode="tutorial">
                <div className="w-full h-full flex items-center justify-center text-white/50">
                    {stage.noTutorialText}
                </div>
            </GameModeProvider>
        );
    }

    return (
        <GameModeProvider mode="tutorial">
            <MatchRoomTutorialBoardStageRuntime runtime={stage.runtime} />
        </GameModeProvider>
    );
};

export const MatchRoomOnlineBoardStage = ({ stage }: { stage: MatchRoomOnlineBoardStageModel }) => {
    if (!stage.runtime) {
        return (
            <div className="w-full h-full flex items-center justify-center text-white/50">
                {stage.noClientText}
            </div>
        );
    }

    return (
        <GameModeProvider mode="online" isSpectator={stage.runtime.connection.isSpectatorRoute}>
            <MatchRoomOnlineBoardStageRuntime runtime={stage.runtime} />
        </GameModeProvider>
    );
};
