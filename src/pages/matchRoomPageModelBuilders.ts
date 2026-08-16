import type { CSSProperties } from 'react';
import { getGamePageDataAttributes } from '../shared/mobileSupport';
import type { GameManifestEntry, GameMobileBattlefieldZoom } from '../shared/gameManifest.types';
import type { MatchRoomBlockingState } from './matchRoomBlockingResolver';
import type {
    MatchRoomOnlineBoardStageModel,
    MatchRoomTutorialBoardStageModel,
} from './matchRoomStages';
import {
    buildMatchRoomOnlineBoardRuntimeModel,
    buildMatchRoomTutorialBoardRuntimeModel,
} from './matchRoomStageRuntimeModelBuilders';
import type { MatchRoomPageIdentityModel } from './useMatchRoomPageIdentity';
import type { MatchRoomLobbyTranslator } from './matchRoomPageTypes';
import { buildGameHudRuntimeProps } from './gameHudRuntimeProps';
import type {
    MatchRoomOnlineStageAdapter,
    MatchRoomPageRuntimeModel,
    MatchRoomTutorialStageAdapter,
} from './useMatchRoomPageRuntimeModel';

type MatchRoomRootDataAttributes = ReturnType<typeof getGamePageDataAttributes>;

export type MatchRoomTutorialHudModel = {
    mode: 'tutorial';
    matchId?: string;
    gameId?: string;
    isHost: boolean;
    credentials?: string;
    myPlayerId?: string | null;
    opponentName?: string | null;
    opponentConnected?: boolean;
    players: MatchRoomPageRuntimeModel['tutorialHud']['players'];
    onLeave: MatchRoomPageRuntimeModel['tutorialHud']['onLeave'];
    onDestroy: MatchRoomPageRuntimeModel['tutorialHud']['onDestroy'];
    onForceExit: MatchRoomPageRuntimeModel['tutorialHud']['onForceExit'];
    isLoading: boolean;
    preferredFullscreenOrientation?: ReturnType<typeof buildGameHudRuntimeProps>['preferredFullscreenOrientation'];
    renderRuntimeSettings?: ReturnType<typeof buildGameHudRuntimeProps>['renderRuntimeSettings'];
    availableEmotes: ReturnType<typeof buildGameHudRuntimeProps>['availableEmotes'];
    resolveEmote: ReturnType<typeof buildGameHudRuntimeProps>['resolveEmote'];
};

export type MatchRoomPageShellModel = {
    gameId?: string;
    rootDataAttributes: MatchRoomRootDataAttributes;
    seoTitle: string;
    showSpectatorShield: boolean;
    battlefieldZoomMode?: GameMobileBattlefieldZoom;
    boardShellStyle: CSSProperties;
    boardShell: MatchRoomPageRuntimeModel['shell']['boardShell'];
    cursorThemeId?: GameManifestEntry['cursorTheme'];
    cursorPlayerID: MatchRoomPageRuntimeModel['shell']['cursorPlayerID'];
    tutorialHud: MatchRoomTutorialHudModel | null;
    tutorialStage: MatchRoomTutorialBoardStageModel | null;
    onlineStage: MatchRoomOnlineBoardStageModel | null;
};

export type MatchRoomPageViewModel = {
    shell: MatchRoomPageShellModel;
    blockingState: MatchRoomBlockingState;
};

export function buildTutorialHudModel(args: {
    gameId?: string;
    matchId?: string;
    pageIdentity: MatchRoomPageIdentityModel;
    pageRuntime: MatchRoomPageRuntimeModel;
}): MatchRoomTutorialHudModel | null {
    const { gameId, matchId, pageIdentity, pageRuntime } = args;
    if (!pageIdentity.isTutorialRoute) {
        return null;
    }

    return {
        mode: 'tutorial',
        matchId,
        gameId,
        isHost: pageRuntime.tutorialHud.isHost,
        credentials: pageRuntime.tutorialHud.credentials,
        myPlayerId: pageRuntime.tutorialHud.myPlayerId,
        opponentName: pageRuntime.tutorialHud.opponentName,
        opponentConnected: pageRuntime.tutorialHud.opponentConnected,
        players: pageRuntime.tutorialHud.players,
        onLeave: pageRuntime.tutorialHud.onLeave,
        onDestroy: pageRuntime.tutorialHud.onDestroy,
        onForceExit: pageRuntime.tutorialHud.onForceExit,
        isLoading: pageRuntime.tutorialHud.isLoading,
        ...buildGameHudRuntimeProps({
            gameId,
            gameConfig: pageIdentity.gameConfig,
        }),
    };
}

export function buildTutorialStageModel(args: {
    gameId?: string;
    pageIdentity: MatchRoomPageIdentityModel;
    stage: MatchRoomTutorialStageAdapter;
    tLobby: MatchRoomLobbyTranslator;
}): MatchRoomTutorialBoardStageModel | null {
    const { gameId, pageIdentity, stage, tLobby } = args;
    if (!pageIdentity.isTutorialRoute) {
        return null;
    }

    return {
        noTutorialText: tLobby('matchRoom.noTutorial'),
        gameId,
        tutorialId: stage.tutorialId,
        tutorialCatalog: stage.tutorialCatalog,
        tutorialCatalogTheme: pageIdentity.gameConfig?.pageShell?.tutorialCatalogTheme,
        runtime: buildMatchRoomTutorialBoardRuntimeModel({
            gameId,
            stage,
            tLobby,
        }),
    };
}

export function buildOnlineStageModel(args: {
    gameId?: string;
    matchId?: string;
    pageIdentity: MatchRoomPageIdentityModel;
    stage: MatchRoomOnlineStageAdapter;
    tLobby: MatchRoomLobbyTranslator;
}): MatchRoomOnlineBoardStageModel | null {
    const {
        gameId,
        matchId,
        pageIdentity,
        stage,
        tLobby,
    } = args;
    if (pageIdentity.isTutorialRoute) {
        return null;
    }

    return {
        noClientText: tLobby('matchRoom.noClient'),
        runtime: buildMatchRoomOnlineBoardRuntimeModel({
            gameId,
            matchId,
            stage,
            tLobby,
        }),
    };
}

export function buildMatchRoomPageShellModel(args: {
    gameId?: string;
    matchId?: string;
    pageIdentity: MatchRoomPageIdentityModel;
    pageRuntime: MatchRoomPageRuntimeModel;
    tLobby: MatchRoomLobbyTranslator;
}): MatchRoomPageShellModel {
    const {
        gameId,
        matchId,
        pageIdentity,
        pageRuntime,
        tLobby,
    } = args;
    const tutorialHud = buildTutorialHudModel({
        gameId,
        matchId,
        pageIdentity,
        pageRuntime,
    });
    const tutorialStage = buildTutorialStageModel({
        gameId,
        pageIdentity,
        stage: pageRuntime.stages.tutorial,
        tLobby,
    });
    const onlineStage = buildOnlineStageModel({
        gameId,
        matchId,
        pageIdentity,
        stage: pageRuntime.stages.online,
        tLobby,
    });

    return {
        gameId,
        rootDataAttributes: pageIdentity.gamePageDataAttributes,
        seoTitle: pageIdentity.isTutorialRoute
            ? tLobby('matchRoom.tutorialTitle', { game: pageIdentity.gameDisplayName })
            : tLobby('matchRoom.matchTitle', { game: pageIdentity.gameDisplayName }),
        showSpectatorShield: pageRuntime.shell.isSpectatorRoute && !pageIdentity.isTutorialRoute,
        battlefieldZoomMode: pageIdentity.gameConfig?.mobileBattlefieldZoom,
        boardShellStyle: {
            '--font-game-display': pageIdentity.gameConfig?.fontFamily?.display
                ? `'${pageIdentity.gameConfig.fontFamily.display}', serif`
                : undefined,
        } as CSSProperties,
        boardShell: pageRuntime.shell.boardShell,
        cursorThemeId: pageIdentity.gameConfig?.cursorTheme,
        cursorPlayerID: pageRuntime.shell.cursorPlayerID,
        tutorialHud,
        tutorialStage,
        onlineStage,
    };
}

export function buildMatchRoomPageViewModel(args: {
    gameId?: string;
    matchId?: string;
    pageIdentity: MatchRoomPageIdentityModel;
    pageRuntime: MatchRoomPageRuntimeModel;
    tLobby: MatchRoomLobbyTranslator;
}): MatchRoomPageViewModel {
    const {
        gameId,
        matchId,
        pageIdentity,
        pageRuntime,
        tLobby,
    } = args;

    return {
        blockingState: pageRuntime.blockingState,
        shell: buildMatchRoomPageShellModel({
            gameId,
            matchId,
            pageIdentity,
            pageRuntime,
            tLobby,
        }),
    };
}
