import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { joinNativeExternalRoom } from '../api/external-games';
import { NativeExternalRoomGame } from '../components/external/NativeExternalRoomGame';
import { useExternalPlay } from '../components/external/useExternalPlay';
import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import { useAuth } from '../contexts/AuthContext';
import { getExternalRoomGuestKey } from '../components/external/nativeRoomGuestKey';
import './external-game-page.css';

export default function NativeExternalRoomPage() {
    const { roomId = '' } = useParams();
    const { t } = useTranslation('lobby');
    const { token, user, isLoading } = useAuth();
    const [guestKey] = useState(getExternalRoomGuestKey);
    const navigate = useNavigate();
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
    if (query.isPending) return <main className="external-game-message" role="status">{t('platform.externalGamePage.loading')}</main>;
    if (query.isError || !view?.native || view.started || view.room.seatId === view.room.hostSeatId) {
        return <main className="external-game-message">
            <p role="alert">{query.error?.message ?? t('platform.externalRoom.alreadyStarted')}</p>
            <Link to={view ? `/?game=${encodeURIComponent(view.gameId)}` : '/'}>{t('platform.externalGamePage.back')}</Link>
        </main>;
    }
    return <main className="external-page">
        <div className="external-player">
            <NativeExternalRoomGame entry={view.entry} gameId={view.gameId} title={view.title} guestRoom={view} />
            <GameHUD mode="external" gameId={view.gameId} onLeave={() => navigate(`/?game=${encodeURIComponent(view.gameId)}`)} />
        </div>
    </main>;
}
