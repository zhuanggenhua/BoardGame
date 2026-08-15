import { GameModeProvider } from '../contexts/GameModeContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
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

const fallbackTutorialChapterAccents = ['#d2b775', '#9f3426', '#ead7a7', '#c59152', '#b85b47', '#d2b775'] as const;

export type MatchRoomTutorialCatalogTheme = {
    className?: string;
    chapterAccents?: readonly string[];
};

export type MatchRoomTutorialBoardStageModel = {
    noTutorialText: string;
    gameId?: string;
    tutorialId?: string;
    tutorialCatalog: TutorialCollection | null;
    tutorialCatalogTheme?: MatchRoomTutorialCatalogTheme;
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

    const chapterAccents = stage.tutorialCatalogTheme?.chapterAccents?.length
        ? stage.tutorialCatalogTheme.chapterAccents
        : fallbackTutorialChapterAccents;
    const catalogThemeClass = stage.tutorialCatalogTheme?.className ?? 'tutorial-catalog-stage--default';

    return (
        <div data-testid="tutorial-catalog-stage" className={`tutorial-catalog-stage ${catalogThemeClass}`}>
            <div className="tutorial-catalog-stage__shell">
                <div className="tutorial-catalog-stage__content">
                    <div className="tutorial-catalog-stage__header">
                        <div className="tutorial-catalog-stage__eyebrow">
                            {tLobby('matchRoom.tutorialCatalog.eyebrow')}
                        </div>
                        <h2 className="tutorial-catalog-stage__title">
                            {tLobby('matchRoom.tutorialCatalog.title')}
                        </h2>
                    </div>
                    <div className="tutorial-catalog-stage__list">
                        {entries.map(([tutorialId, entry], index) => {
                            const title = entry.titleKey
                                ? t(entry.titleKey, { defaultValue: entry.title ?? tutorialId })
                                : (entry.title ?? tutorialId);
                            const description = entry.descriptionKey
                                ? t(entry.descriptionKey, { defaultValue: entry.description ?? '' })
                                : (entry.description ?? '');
                        const isDefault = recommendedTutorialId === tutorialId;
                        const isCompleted = completedTutorialIds.has(tutorialId);
                        const entryStyle = {
                            '--tutorial-chapter-index': index,
                            '--tutorial-chapter-accent': chapterAccents[index % chapterAccents.length],
                        } as CSSProperties;

                        return (
                            <button
                                key={tutorialId}
                                type="button"
                                data-testid={`tutorial-catalog-entry-${tutorialId}`}
                                onClick={() => navigate(`/play/${stage.gameId}/tutorial/${tutorialId}`)}
                                style={entryStyle}
                                className="tutorial-catalog-stage__entry"
                            >
                                <div className="tutorial-catalog-stage__index">
                                    {String(index + 1).padStart(2, '0')}
                                </div>
                                <div className="tutorial-catalog-stage__entry-body">
                                    <div className="tutorial-catalog-stage__entry-title">
                                        <span>{title}</span>
                                    </div>
                                    <div className="tutorial-catalog-stage__tags">
                                        {isCompleted ? (
                                            <span
                                                className="tutorial-catalog-stage__tag tutorial-catalog-stage__tag--completed"
                                                aria-label={tLobby('matchRoom.tutorialCatalog.completed')}
                                            >
                                                ✓ {tLobby('matchRoom.tutorialCatalog.completed')}
                                            </span>
                                        ) : null}
                                        {isDefault ? (
                                            <span className="tutorial-catalog-stage__tag tutorial-catalog-stage__tag--recommended">
                                                {tLobby('matchRoom.tutorialCatalog.recommended')}
                                            </span>
                                        ) : null}
                                    </div>
                                    {description ? (
                                        <div className="tutorial-catalog-stage__description">
                                            {description}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="tutorial-catalog-stage__enter">
                                    {tLobby('matchRoom.tutorialCatalog.enter')}
                                </div>
                                </button>
                            );
                        })}
                    </div>
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
            <MatchRoomTutorialBoardStageRuntime
                key={`${stage.runtime.gameId ?? 'unknown'}:${stage.runtime.tutorialId ?? stage.runtime.tutorialManifest?.id ?? 'tutorial'}`}
                runtime={stage.runtime}
            />
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
