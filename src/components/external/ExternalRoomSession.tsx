import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { ExternalApiError, externalRoomAction, joinExternalRoom, leaveExternalRoom, readExternalRoom } from '../../api/external-games';
import { DetailsPrimaryButton } from '../common/DetailsPrimaryButton';
import { PasswordEntryModal } from '../common/overlays/PasswordEntryModal';
import { ExternalRoomGameFrame } from './ExternalRoomGameFrame';
import { getExternalRoomGuestKey } from './nativeRoomGuestKey';
import { externalRoomPath } from './externalRoomPath';
import { useExternalPlay } from './useExternalPlay';
import { GameHUD } from '../game/framework/widgets/GameHUD';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { EXTERNAL_ROOM_PASSWORD_REQUIRED, externalRoomRosterKey } from '../../shared/externalRoom';

function roomEnded(error: unknown) {
    return error instanceof ExternalApiError && (error.status === 403 || error.status === 404);
}

export function ExternalRoomSession({ gameId, roomId }: { gameId: string; roomId: string }) {
    const { t } = useTranslation(['lobby', 'common']);
    const { token, user, isLoading } = useAuth();
    const navigate = useNavigate();
    const { error: notifyError } = useToast();
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
    const autoJoin = !view && query.error instanceof ExternalApiError && query.error.status === 403;
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
    const onHandshakeTimeout = useCallback(() => notifyError(t('platform.externalRoom.handshakeTimeout')), [notifyError, t]);
    const back = `/?game=${encodeURIComponent(view?.gameId ?? gameId)}`;
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
    const terminalError = view
        ? (roomEnded(query.error) && !view.started ? query.error?.message
            : (view.native || (view.started && !entered)) ? t('platform.externalRoom.alreadyStarted') : undefined)
        : needsPassword ? undefined : join.error?.message ?? (autoJoin ? undefined : query.error?.message);
    useEffect(() => {
        if (terminalError) {
            notifyError(terminalError);
            navigate(back, { replace: true });
        }
    }, [back, navigate, notifyError, terminalError]);
    if (terminalError) return null;
    if (!view) return needsPassword
        ? <PasswordEntryModal open isLoading={join.isPending} error={join.variables ? join.error?.message : undefined}
            onClose={() => navigate(back, { replace: true })} onConfirm={password => join.mutate(password)} />
        : <div className="external-game-message" role="status">{t('platform.externalGamePage.loading')}</div>;
    if (view.gameId !== gameId) return <Navigate replace to={externalRoomPath(view.gameId, roomId)} />;
    const { room, capacity, started } = view;
    const full = room.players.length === capacity;
    const allReady = full && room.players.every(player => player.ready);
    const invite = new URL(externalRoomPath(gameId, roomId), window.location.origin).href;
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
    const isHost = room.seatId === room.hostSeatId;
    return <div className="external-player">
        <ExternalRoomGameFrame key={rosterKey} view={view} send={send} onHandshakeTimeout={onHandshakeTimeout} />
        <GameHUD mode="external" gameId={gameId} onLeave={() => void leave()} externalRoomAction={started ? undefined : {
            id: 'external-room',
            icon: <Users size={20} />,
            label: t('platform.externalRoom.list'),
            active: isHost && allReady,
            content: <div className="space-y-3">
                <p role="status">{t(allReady ? 'platform.externalRoom.waitingToStart' : full ? 'platform.externalRoom.connecting' : 'platform.externalRoom.waiting',
                    { seated: room.players.length, capacity })}</p>
                {isHost && <DetailsPrimaryButton onClick={() => start.mutate()} disabled={!allReady || start.isPending}>
                    {t('platform.externalRoom.start')}
                </DetailsPrimaryButton>}
                <input className="w-full min-h-11 px-2 border border-current" aria-label={t('platform.externalRoom.inviteLink')}
                    ref={inviteInput} readOnly value={invite} onFocus={event => event.target.select()} />
                <button className="min-h-11 font-semibold underline" type="button" onClick={copy}>{t('platform.externalRoom.copyInvite')}</button>
                {(issue || start.error || query.error) && <p role="alert">{start.error?.message || query.error?.message || issue}</p>}
            </div>,
        }} />
    </div>;
}
