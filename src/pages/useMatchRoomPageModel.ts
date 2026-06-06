import type { i18n as I18nInstance } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';
import type { ModalEntry } from '../contexts/ModalStackContext';
import { useMatchRoomPageEffects } from './useMatchRoomPageEffects';
import { useMatchRoomPageIdentity } from './useMatchRoomPageIdentity';
import { buildMatchRoomPageViewModel } from './matchRoomPageModelBuilders';
import type { MatchRoomLobbyTranslator } from './matchRoomPageTypes';
import { useMatchRoomPageRuntimeModel } from './useMatchRoomPageRuntimeModel';

export function useMatchRoomPageModel(args: {
    gameId?: string;
    matchId?: string;
    tutorialId?: string;
    pathname: string;
    searchParams: URLSearchParams;
    navigate: NavigateFunction;
    debugPlayerID?: string | null;
    setPlayerID: (playerID: string | null) => void;
    openModal: (entry: Omit<ModalEntry, 'id'> & { id?: string }) => string;
    closeModal: (id: string) => void;
    tLobby: MatchRoomLobbyTranslator;
    i18n: I18nInstance;
    userId?: string;
    username?: string | null;
    token?: string | null;
}) {
    const {
        gameId,
        matchId,
        tutorialId,
        pathname,
        searchParams,
        navigate,
        debugPlayerID,
        setPlayerID,
        openModal,
        closeModal,
        tLobby,
        i18n,
        userId,
        username,
        token,
    } = args;

    const pageIdentity = useMatchRoomPageIdentity({
        gameId,
        matchId,
        pathname,
        tLobby,
    });

    useMatchRoomPageEffects({
        gameId,
        matchId,
        isTutorialRoute: pageIdentity.isTutorialRoute,
        searchParams,
        userId,
        gamePageDataAttributes: pageIdentity.gamePageDataAttributes,
    });

    const pageRuntime = useMatchRoomPageRuntimeModel({
        gameId,
        matchId,
        tutorialId,
        searchParams,
        navigate,
        debugPlayerID,
        setPlayerID,
        openModal,
        closeModal,
        tLobby,
        i18n,
        userId,
        username,
        token,
        pageIdentity,
    });

    return buildMatchRoomPageViewModel({
        gameId,
        matchId,
        pageIdentity,
        pageRuntime,
        tLobby,
    });
}

export type MatchRoomPageModel = ReturnType<typeof useMatchRoomPageModel>;
