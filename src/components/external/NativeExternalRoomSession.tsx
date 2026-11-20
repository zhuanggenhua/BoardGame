import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { joinNativeExternalRoom } from '../../api/external-games';
import { NativeExternalRoomGame } from './NativeExternalRoomGame';
import { useExternalPlay } from './useExternalPlay';
import { GameHUD } from '../game/framework/widgets/GameHUD';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getExternalRoomGuestKey } from './nativeRoomGuestKey';
import { externalRoomPath } from './externalRoomPath';

export function NativeExternalRoomSession({ gameId, roomId }: { gameId: string; roomId: string }) {
    const { t } = useTranslation('lobby');
    const { token, user, isLoading } = useAuth();
    const [guestKey] = useState(getExternalRoomGuestKey);
    const navigate = useNavigate();
    const { error: notifyError } = useToast();
    const query = useQuery({
        queryKey: ['native-external-room-join', roomId, user?.id ?? guestKey],
        queryFn: () => joinNativeExternalRoom(token ? { token } : { guestKey }, roomId),
        enabled: Boolean(roomId && !isLoading),
        retry: false,
        staleTime: Infinity,
        gcTime: 0,
        refetchOnWindowFocus: false,
    });
    const view = query.data;
    const playing = Boolean(view?.native && !view.started && view.room.seatId !== view.room.hostSeatId);
    useExternalPlay(view?.gameId ?? '', token, playing);
    const back = `/?game=${encodeURIComponent(view?.gameId ?? gameId)}`;
    const issue = query.error?.message ?? (query.isSuccess && !playing ? t('platform.externalRoom.alreadyStarted') : undefined);
    useEffect(() => {
        if (issue) {
            notifyError(issue);
            navigate(back, { replace: true });
        }
    }, [back, issue, navigate, notifyError]);
    if (issue) return null;
    if (!view) return <div className="external-game-message" role="status">{t('platform.externalGamePage.loading')}</div>;
    if (view.gameId !== gameId) return <Navigate replace to={externalRoomPath(view.gameId, roomId, true)} />;
    return <div className="external-player">
        <NativeExternalRoomGame entry={view.entry} gameId={gameId} title={view.title} guestRoom={view} />
        <GameHUD mode="external" gameId={gameId} onLeave={() => navigate(back)} />
    </div>;
}
