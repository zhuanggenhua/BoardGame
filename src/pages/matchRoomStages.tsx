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

const tutorialChapterAccents = ['#d2b775', '#9f3426', '#ead7a7', '#c59152', '#b85b47', '#d2b775'] as const;

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
        <div data-testid="tutorial-catalog-stage" className="tutorial-catalog-stage h-full w-full overflow-y-auto bg-[linear-gradient(135deg,rgba(255,242,202,0.035)_0_1px,transparent_1px_18px),radial-gradient(ellipse_at_50%_42%,rgba(122,77,34,0.18),transparent_38rem),linear-gradient(180deg,#2c2116_0%,#21160e_58%,#180f09_100%)] px-5 py-12 text-[#342313] max-md:px-3 max-md:py-5">
            <div className="tutorial-catalog-stage__shell mx-auto flex min-h-full w-full max-w-[760px] items-center max-md:block">
                <div className="w-full">
                    <div className="tutorial-catalog-stage__header mb-7 max-md:mb-4 max-md:px-1">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f7e7be]/80 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                            {tLobby('matchRoom.tutorialCatalog.eyebrow')}
                        </div>
                        <h2 className="tutorial-catalog-stage__title mt-2 font-serif text-[clamp(30px,4vw,44px)] font-bold leading-[1.12] tracking-[0.02em] text-[#f7e7be] drop-shadow-[0_3px_16px_rgba(0,0,0,0.62)] max-md:text-[29px]">
                            {tLobby('matchRoom.tutorialCatalog.title')}
                        </h2>
                    </div>
                    <div className="tutorial-catalog-stage__list relative grid gap-0 rounded-[18px] border border-[#79572b]/20 bg-[#f2e8cf]/[0.82] px-7 py-[22px] shadow-[0_20px_42px_rgba(19,10,4,0.2)] backdrop-blur-[1px] before:absolute before:bottom-[34px] before:left-[49px] before:top-[34px] before:border-l before:border-dashed before:border-[#74532d]/45 max-md:rounded-[16px] max-md:px-3 max-md:py-3 max-md:before:hidden">
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
                            '--tutorial-chapter-accent': tutorialChapterAccents[index % tutorialChapterAccents.length],
                        } as CSSProperties;

                        return (
                            <button
                                    key={tutorialId}
                                    type="button"
                                data-testid={`tutorial-catalog-entry-${tutorialId}`}
                                onClick={() => navigate(`/play/${stage.gameId}/tutorial/${tutorialId}`)}
                                style={entryStyle}
                                className="tutorial-catalog-stage__entry group relative grid min-h-[94px] cursor-pointer grid-cols-[46px_1fr_auto] items-start gap-[18px] border-b border-[#74532d]/15 py-3 pb-[18px] text-left transition-colors duration-200 last:border-b-0 last:pb-1 hover:bg-[#fff5df]/30 focus-visible:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] max-md:min-h-0 max-md:grid-cols-[40px_minmax(0,1fr)] max-md:gap-x-3 max-md:gap-y-2 max-md:rounded-xl max-md:px-2 max-md:py-3 max-md:pb-4"
                            >
                                    <div className="tutorial-catalog-stage__index relative z-[1] grid h-[42px] w-[42px] place-items-center rounded-full border border-[#79572b]/40 bg-[linear-gradient(180deg,#f5edd8,#dfd0b3)] text-[13px] font-extrabold tracking-[0.14em] text-[#6b4c22] shadow-[0_0_0_5px_rgba(242,232,207,0.82)] max-md:h-10 max-md:w-10 max-md:text-[12px] max-md:shadow-[0_0_0_3px_rgba(242,232,207,0.82)]">
                                        {String(index + 1).padStart(2, '0')}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="tutorial-catalog-stage__entry-title font-serif text-[22px] font-bold leading-tight tracking-[0.02em] text-[#342313] max-md:text-[18px]">
                                            <span className="break-words">{title}</span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                            {isCompleted ? (
                                                <span
                                                    className="tutorial-catalog-stage__tag tutorial-catalog-stage__tag--completed inline-flex min-h-[26px] items-center rounded border border-[#556b2f]/30 bg-[#556b2f]/10 px-2 py-0.5 font-sans text-[11px] font-extrabold tracking-[0.12em] text-[#556b2f]"
                                                    aria-label={tLobby('matchRoom.tutorialCatalog.completed')}
                                                >
                                                    ✓ {tLobby('matchRoom.tutorialCatalog.completed')}
                                                </span>
                                            ) : null}
                                            {isDefault ? (
                                                <span className="tutorial-catalog-stage__tag tutorial-catalog-stage__tag--recommended inline-flex min-h-[26px] items-center rounded border border-[#a17022]/30 bg-[#c49032]/10 px-2 py-0.5 font-sans text-[11px] font-extrabold text-[#805714]">
                                                    {tLobby('matchRoom.tutorialCatalog.recommended')}
                                                </span>
                                            ) : null}
                                        </div>
                                        {description ? (
                                            <div className="tutorial-catalog-stage__description mt-2 max-w-[520px] font-sans text-sm leading-7 text-[#5f4a31] max-md:text-[13px] max-md:leading-6">
                                                {description}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="tutorial-catalog-stage__enter mt-2 min-w-24 border-l border-[#74532d]/15 pl-4 pt-1 font-sans text-sm font-extrabold text-[#775015] max-md:col-start-2 max-md:mt-0 max-md:inline-flex max-md:min-h-[44px] max-md:min-w-0 max-md:items-center max-md:border-l-0 max-md:pl-0 max-md:text-[13px]">
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
