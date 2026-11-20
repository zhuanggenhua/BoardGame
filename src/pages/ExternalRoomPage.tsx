import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ExternalApiError, externalRoomAction, joinExternalRoom, leaveExternalRoom, readExternalRoom } from '../api/external-games';
import { DetailsPrimaryButton } from '../components/common/DetailsPrimaryButton';
import { PasswordEntryModal } from '../components/common/overlays/PasswordEntryModal';
import { ExternalRoomGameFrame } from '../components/external/ExternalRoomGameFrame';
import { getExternalRoomGuestKey } from '../components/external/nativeRoomGuestKey';
import { useExternalPlay } from '../components/external/useExternalPlay';
import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import { useAuth } from '../contexts/AuthContext';
import { EXTERNAL_ROOM_PASSWORD_REQUIRED, externalRoomRosterKey } from '../shared/externalRoom';
import './external-game-page.css';
import './external-room-page.css';

function roomEnded(error: unknown) {
    return error instanceof ExternalApiError && (error.status === 403 || error.status === 404);
}

export default function ExternalRoomPage() {
    const { roomId = '' } = useParams();
    const [search] = useSearchParams();
    const { t } = useTranslation(['lobby', 'common']);
    const { token, user, isLoading } = useAuth();
    const navigate = useNavigate();
    const client = useQueryClient();
    const [issue, setIssue] = useState('');
    const [passwordRoomId, setPasswordRoomId] = useState('');
    const inviteInput = useRef<HTMLInputElement>(null);
    const [enteredLobby, setEnteredLobby] = useState('');
    const autoJoinAttempt = useRef('');
    const guestKey = !isLoading && !token ? getExternalRoomGuestKey() : undefined;
    const identity = { token, guestKey };
    const roomKey = ['external-room', roomId, user?.id];
    const query = useQuery({
        queryKey: roomKey, queryFn: () => readExternalRoom(identity, roomId), enabled: !isLoading && Boolean(roomId),
        retry: false, refetchOnWindowFocus: false,
        refetchInterval: state => state.state.data?.started || roomEnded(state.state.error) ? false : 700,
    });
    const join = useMutation({
        mutationFn: (password?: string) => joinExternalRoom(identity, roomId, password),
        onSuccess: view => client.setQueryData(roomKey, view),
        onError: error => {
            if (error instanceof ExternalApiError && error.code === EXTERNAL_ROOM_PASSWORD_REQUIRED) setPasswordRoomId(roomId);
        },
    });
    const start = useMutation({
        mutationFn: () => externalRoomAction(identity, roomId, { type: 'start' }),
        onSuccess: view => client.setQueryData(roomKey, view),
    });
    const view = query.data;
    const autoJoin = search.get('join') === '1' && query.error instanceof ExternalApiError && query.error.status === 403;
    const joinNow = join.mutate;
    useEffect(() => {
        if (!autoJoin || isLoading || autoJoinAttempt.current === roomId) return;
        autoJoinAttempt.current = roomId;
        joinNow(undefined);
    }, [autoJoin, isLoading, joinNow, roomId]);
    if (view && !view.started && enteredLobby !== roomId) setEnteredLobby(roomId);
    const entered = enteredLobby === roomId;
    useExternalPlay(view?.gameId ?? '', token, Boolean(view?.started && entered));
    const waiting = Boolean(view && !view.started);
    useEffect(() => {
        if ((!token && !guestKey) || !waiting) return;
        const release = () => { void leaveExternalRoom({ token, guestKey }, roomId).catch(() => {}); };
        window.addEventListener('pagehide', release);
        return () => window.removeEventListener('pagehide', release);
    }, [roomId, token, guestKey, waiting]);
    const onHandshakeTimeout = useCallback(() => setIssue(t('platform.externalRoom.handshakeTimeout')), [t]);
    const back = view ? `/?game=${encodeURIComponent(view.gameId)}` : '/';
    const leave = async () => {
        if (view && !view.started) {
            try { await leaveExternalRoom(identity, roomId); }
            catch (error) { setIssue((error as Error).message); return; }
        }
        client.removeQueries({ queryKey: roomKey });
        navigate(back);
    };
    const send = (data: Record<string, unknown>) => {
        void externalRoomAction(identity, roomId, data).catch((error: Error) => setIssue(error.message));
    };
    const needsPassword = passwordRoomId === roomId;
    if (!view && (isLoading || query.isPending || (autoJoin && !join.isError && !needsPassword))) {
        return <main className="external-game-message" role="status">{t('platform.externalGamePage.loading')}</main>;
    }
    if (!view || (roomEnded(query.error) && !view.started)) {
        return <main className="external-page external-room-page">
            <section className="external-summary external-room-panel">
                <h1>{t('platform.externalRoom.join')}</h1>
                {!needsPassword && (join.error || (query.error instanceof ExternalApiError && query.error.status !== 403))
                    && <p role="alert">{(join.error ?? query.error)?.message}</p>}
                <div className="external-actions">
                    {!view && <DetailsPrimaryButton className="external-primary" disabled={join.isPending}
                        onClick={() => join.mutate(undefined)}>
                        {t('platform.externalRoom.join')}
                    </DetailsPrimaryButton>}
                    <Link to={back}>{t('platform.externalGamePage.back')}</Link>
                </div>
            </section>
            {needsPassword && <PasswordEntryModal open isLoading={join.isPending} error={join.variables ? join.error?.message : undefined}
                onClose={() => navigate(back, { replace: true })} onConfirm={password => join.mutate(password)} />}
        </main>;
    }
    const { room, capacity, started } = view;
    if (started && !entered) {
        return <main className="external-page external-room-page">
            <section className="external-summary external-room-panel">
                <h1>{view.title}</h1>
                <p>{t('platform.externalRoom.alreadyStarted')}</p>
                <div className="external-actions"><Link to={back}>{t('platform.externalGamePage.back')}</Link></div>
            </section>
        </main>;
    }
    const full = room.players.length === capacity;
    const allReady = full && room.players.every(player => player.ready);
    const invite = new URL(`/external/rooms/${roomId}?join=1`, window.location.origin).href;
    const rosterKey = externalRoomRosterKey(room.players);
    const copy = () => {
        const field = inviteInput.current;
        if (navigator.clipboard) {
            void navigator.clipboard.writeText(invite).catch(() => { field?.focus(); field?.select(); });
        } else {
            field?.focus();
            field?.select();
            document.execCommand('copy');
        }
    };
    return <main className="external-page external-room-page">
        <div className={started ? 'external-player' : 'external-player external-room-player'}>
            <ExternalRoomGameFrame key={rosterKey} view={view} send={send} onHandshakeTimeout={onHandshakeTimeout} />
            {started ? <GameHUD mode="external" gameId={view.gameId} onLeave={() => void leave()} />
                : <section className="external-room-controls" aria-label={t('platform.externalRoom.list')}>
                    <div className="external-room-occupancy">
                        <p role="status">{t(allReady ? 'platform.externalRoom.waitingToStart' : full ? 'platform.externalRoom.connecting' : 'platform.externalRoom.waiting',
                            { seated: room.players.length, capacity })}</p>
                        <ul className="external-room-seats">
                            {room.players.map(player => <li key={player.seatId}>
                                {player.displayName}{player.seatId === room.hostSeatId ? ` · ${t('platform.externalRoom.host')}` : ''}
                            </li>)}
                        </ul>
                    </div>
                    <div className="external-actions">
                        {room.seatId === room.hostSeatId && <DetailsPrimaryButton className="external-primary"
                            onClick={() => start.mutate()} disabled={!allReady || start.isPending}>
                            {t('platform.externalRoom.start')}
                        </DetailsPrimaryButton>}
                        <input aria-label={t('platform.externalRoom.inviteLink')} ref={inviteInput} readOnly value={invite}
                            onFocus={event => event.target.select()} />
                        <button type="button" onClick={copy}>{t('platform.externalRoom.copyInvite')}</button>
                        <button type="button" onClick={() => void leave()}>{t('platform.externalGamePage.back')}</button>
                    </div>
                    {(issue || start.error || query.error) && <p role="alert">{start.error?.message || query.error?.message || issue}</p>}
                </section>}
        </div>
    </main>;
}
