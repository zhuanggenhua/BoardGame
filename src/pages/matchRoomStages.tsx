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
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(255,242,202,0.035)_0_1px,transparent_1px_18px),radial-gradient(ellipse_at_50%_42%,rgba(122,77,34,0.18),transparent_38rem),linear-gradient(180deg,#2c2116_0%,#21160e_58%,#180f09_100%)] px-5 py-12 text-[#342313]">
            <div className="w-full max-w-[760px]">
                <div className="mb-7">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f7e7be]/80 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                        {tLobby('matchRoom.tutorialCatalog.eyebrow')}
                    </div>
                    <h2 className="mt-2 font-serif text-[clamp(30px,4vw,44px)] font-bold leading-[1.12] tracking-[0.02em] text-[#f7e7be] drop-shadow-[0_3px_16px_rgba(0,0,0,0.62)]">
                        {tLobby('matchRoom.tutorialCatalog.title')}
                    </h2>
                </div>
                <div className="relative grid gap-0 rounded-[18px] border border-[#79572b]/20 bg-[#f2e8cf]/[0.82] px-7 py-[22px] shadow-[0_20px_42px_rgba(19,10,4,0.2)] backdrop-blur-[1px] before:absolute before:bottom-[34px] before:left-[49px] before:top-[34px] before:border-l before:border-dashed before:border-[#74532d]/45 max-md:px-4 max-md:py-[18px] max-md:before:left-[37px]">
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
                                className="group relative grid min-h-[94px] cursor-pointer grid-cols-[46px_1fr_auto] items-start gap-[18px] border-b border-[#74532d]/15 py-3 pb-[18px] text-left transition-colors duration-200 last:border-b-0 last:pb-1 hover:bg-[#fff5df]/30 focus-visible:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] max-md:grid-cols-[44px_1fr] max-md:gap-3"
                            >
                                <div className="relative z-[1] grid h-[42px] w-[42px] place-items-center rounded-full border border-[#79572b]/40 bg-[linear-gradient(180deg,#f5edd8,#dfd0b3)] text-[13px] font-extrabold tracking-[0.14em] text-[#6b4c22] shadow-[0_0_0_5px_rgba(242,232,207,0.82)]">
                                    {String(index + 1).padStart(2, '0')}
                                </div>
                                <div>
                                    <div className="font-serif text-[22px] font-bold leading-tight tracking-[0.02em] text-[#342313]">
                                        {title}
                                        {isCompleted ? (
                                            <span
                                                className="ml-2 inline-block -translate-y-1 rounded border border-[#556b2f]/30 bg-[#556b2f]/10 px-2 py-0.5 font-sans text-[11px] font-extrabold tracking-[0.12em] text-[#556b2f]"
                                                aria-label={tLobby('matchRoom.tutorialCatalog.completed')}
                                            >
                                                ✓ {tLobby('matchRoom.tutorialCatalog.completed')}
                                            </span>
                                        ) : null}
                                        {isDefault ? (
                                            <span className="ml-2 inline-block -translate-y-1 rounded border border-[#a17022]/30 bg-[#c49032]/10 px-2 py-0.5 font-sans text-[11px] font-extrabold text-[#805714]">
                                                {tLobby('matchRoom.tutorialCatalog.recommended')}
                                            </span>
                                        ) : null}
                                    </div>
                                    {description ? (
                                        <div className="mt-2 max-w-[520px] font-sans text-sm leading-7 text-[#5f4a31]">
                                            {description}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="mt-2 min-w-24 border-l border-[#74532d]/15 pl-4 pt-1 font-sans text-sm font-extrabold text-[#775015] max-md:col-start-2 max-md:mt-0 max-md:min-w-0 max-md:border-l-0 max-md:pl-0">
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
