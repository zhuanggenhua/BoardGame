import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalApiError, externalRoomAction, joinExternalRoom, leaveExternalRoom, readExternalRoom } from '../api/external-games';
import { AuthModal } from '../components/auth/AuthModal';
import { DetailsPrimaryButton } from '../components/common/DetailsPrimaryButton';
import { ExternalRoomGameFrame } from '../components/external/ExternalRoomGameFrame';
import { useExternalPlay } from '../components/external/useExternalPlay';
import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import { useAuth } from '../contexts/AuthContext';
import { externalRoomRosterKey } from '../shared/externalRoom';
import './external-game-page.css';
import './external-room-page.css';

function roomEnded(error: unknown) {
    return error instanceof ExternalApiError && (error.status === 403 || error.status === 404);
}

export default function ExternalRoomPage() {
    const { roomId = '' } = useParams();
    const { t } = useTranslation(['lobby', 'common']);
    const { token, user, isLoading } = useAuth();
    const navigate = useNavigate();
    const client = useQueryClient();
    const [authOpen, setAuthOpen] = useState(false);
    const [issue, setIssue] = useState('');
    const inviteInput = useRef<HTMLInputElement>(null);
    const enteredLobby = useRef('');
    const roomKey = ['external-room', roomId, user?.id];
    const query = useQuery({
        queryKey: roomKey, queryFn: () => readExternalRoom(token!, roomId), enabled: Boolean(token && roomId),
        retry: false, refetchOnWindowFocus: false,
        refetchInterval: state => state.state.data?.started || roomEnded(state.state.error) ? false : 700,
    });
    const join = useMutation({
        mutationFn: () => joinExternalRoom(token!, roomId),
        onSuccess: view => client.setQueryData(roomKey, view),
    });
    const start = useMutation({
        mutationFn: () => externalRoomAction(token!, roomId, { type: 'start' }),
        onSuccess: view => client.setQueryData(roomKey, view),
    });
    const view = query.data;
    if (view && !view.started) enteredLobby.current = roomId;
    const entered = enteredLobby.current === roomId;
    useExternalPlay(view?.gameId ?? '', token, Boolean(view?.started && entered));
    const waiting = Boolean(view && !view.started);
    useEffect(() => {
        if (!token || !waiting) return;
        const release = () => { void leaveExternalRoom(token, roomId).catch(() => {}); };
        window.addEventListener('pagehide', release);
        return () => window.removeEventListener('pagehide', release);
    }, [roomId, token, waiting]);
    const onHandshakeTimeout = useCallback(() => setIssue(t('platform.externalRoom.handshakeTimeout')), [t]);
    const back = view ? `/?game=${encodeURIComponent(view.gameId)}` : '/';
    const leave = async () => {
        if (token && view && !view.started) {
            try { await leaveExternalRoom(token, roomId); }
            catch (error) { setIssue((error as Error).message); return; }
        }
        client.removeQueries({ queryKey: roomKey });
        navigate(back);
    };
    const send = (data: Record<string, unknown>) => {
        if (!token) return;
        void externalRoomAction(token, roomId, data).catch((error: Error) => setIssue(error.message));
    };
    if ((isLoading && !view) || (token && query.isFetching && !view && !query.isError)) {
        return <main className="external-game-message" role="status">{t('platform.externalGamePage.loading')}</main>;
    }
    if (!view || (roomEnded(query.error) && !view.started)) {
        return <main className="external-page external-room-page">
            <section className="external-summary external-room-panel">
                <h1>{t('platform.externalRoom.join')}</h1>
                {(join.error || (view && query.error)) && <p role="alert">{(join.error ?? query.error)?.message}</p>}
                <div className="external-actions">
                    {!view && <DetailsPrimaryButton className="external-primary" disabled={join.isPending}
                        onClick={() => token ? join.mutate() : setAuthOpen(true)}>
                        {t(!token ? 'platform.profile.login' : 'platform.externalRoom.join')}
                    </DetailsPrimaryButton>}
                    <Link to={back}>{t('platform.externalGamePage.back')}</Link>
                </div>
            </section>
            {!token && authOpen && <AuthModal isOpen initialMode="login" visualStyle="platform" onClose={() => setAuthOpen(false)} />}
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
    const invite = new URL(`/external/rooms/${roomId}`, window.location.origin).href;
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
        {!started && <section className="external-summary external-room-panel">
            <h1>{view.title}</h1>
            <label>{t('platform.externalRoom.inviteLink')}
                <input ref={inviteInput} readOnly value={invite} onFocus={event => event.target.select()} />
            </label>
            <p role="status">{t(allReady ? 'platform.externalRoom.waitingToStart' : full ? 'platform.externalRoom.connecting' : 'platform.externalRoom.waiting',
                { seated: room.players.length, capacity })}</p>
            <ul className="external-room-seats">
                {room.players.map(player => <li key={player.seatId}>
                    <span>{player.displayName}{player.seatId === room.hostSeatId ? ` · ${t('platform.externalRoom.host')}` : ''}</span>
                    <span>{t(player.ready ? 'platform.externalRoom.ready' : 'platform.externalRoom.notReady')}</span>
                </li>)}
            </ul>
            {(issue || start.error || query.error) && <p role="alert">{start.error?.message || query.error?.message || issue}</p>}
            <div className="external-actions">
                {room.seatId === room.hostSeatId && <DetailsPrimaryButton className="external-primary"
                    onClick={() => start.mutate()} disabled={!allReady || start.isPending}>
                    {t('platform.externalRoom.start')}
                </DetailsPrimaryButton>}
                <button type="button" onClick={copy}>{t('platform.externalRoom.copyInvite')}</button>
                <button type="button" onClick={() => void leave()}>{t('platform.externalGamePage.back')}</button>
            </div>
        </section>}
        {full && <div className={started ? 'external-player' : 'external-room-preload'} aria-hidden={!started} inert={!started}>
            <ExternalRoomGameFrame key={rosterKey} view={view} send={send} onHandshakeTimeout={onHandshakeTimeout} />
            {started && <GameHUD mode="external" gameId={view.gameId} onLeave={() => void leave()} />}
        </div>}
    </main>;
}
