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
import { readCompletedTutorialIds } from './useMatchRoomTutorialLifecycle';
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
    const completedTutorialIds = readCompletedTutorialIds(stage.gameId);
    const recommendedTutorialId = tutorialCatalog.tutorials[tutorialCatalog.defaultTutorialId]?.hiddenFromCatalog === true
        ? entries[0]?.[0]
        : tutorialCatalog.defaultTutorialId;

    return (
        <div className="flex h-full w-full items-center justify-center bg-[#24180d] px-6 py-8 text-[#433422]">
            <div className="w-full max-w-5xl rounded-[16px] border border-[#8c7b64]/35 bg-[#f4ecd8] p-6 shadow-[0_18px_48px_rgba(67,52,34,0.22)] md:p-8">
                <div className="mb-6">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8c7b64]">
                        {tLobby('matchRoom.tutorialCatalog.eyebrow')}
                    </div>
                    <h2 className="mt-2 font-serif text-3xl font-bold text-[#433422]">
                        {tLobby('matchRoom.tutorialCatalog.title')}
                    </h2>
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
                        const isCompleted = completedTutorialIds.has(tutorialId);

                        return (
                            <button
                                key={tutorialId}
                                type="button"
                                data-testid={`tutorial-catalog-entry-${tutorialId}`}
                                onClick={() => navigate(`/play/${stage.gameId}/tutorial/${tutorialId}`)}
                                className="group flex min-h-[168px] cursor-pointer flex-col rounded-[10px] border border-[#8c7b64]/32 bg-[#f9f1df] p-5 text-left shadow-[0_2px_8px_rgba(67,52,34,0.05)] transition-colors duration-200 hover:border-[#8c7b64]/60 hover:bg-[#fff6e5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="text-sm font-semibold tracking-[0.16em] text-[#8c7b64]">
                                        {String(index + 1).padStart(2, '0')}
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        {isCompleted ? (
                                            <span
                                                className="rounded border border-[#556b2f]/35 bg-[#556b2f]/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#556b2f]"
                                                aria-label={tLobby('matchRoom.tutorialCatalog.completed')}
                                            >
                                                ✓ {tLobby('matchRoom.tutorialCatalog.completed')}
                                            </span>
                                        ) : null}
                                        {isDefault ? (
                                            <span className="rounded border border-[#d4af37]/45 bg-[#d4af37]/12 px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#7a5a17]">
                                                {tLobby('matchRoom.tutorialCatalog.recommended')}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="mt-5 font-serif text-2xl font-bold leading-tight text-[#433422]">
                                    {title}
                                </div>
                                {description ? (
                                    <div className="mt-3 text-sm leading-6 text-[#6f5d45]">
                                        {description}
                                    </div>
                                ) : null}
                                <div className="mt-auto pt-5 text-sm font-semibold text-[#7a5a17]">
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
