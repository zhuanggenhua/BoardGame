import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveNativeExternalRoom, publishNativeExternalRoom, readNativeExternalRoom, sendNativeExternalRoomAction } from '../../api/external-games';
import { useAuth } from '../../contexts/AuthContext';
import { getExternalRoomGuestKey } from './nativeRoomGuestKey';
import { MAX_EXTERNAL_SIGNAL_LENGTH, type ExternalRoomView } from '../../shared/externalRoom';
import { SandboxedWebGameFrame } from './SandboxedWebGameFrame';

export function NativeExternalRoomGame({ gameId, entry, title, autoOpen, guestRoom }: {
    gameId: string; entry: string; title: string; autoOpen?: boolean; guestRoom?: ExternalRoomView;
}) {
    const { token, user } = useAuth();
    const [guestKey] = useState(getExternalRoomGuestKey);
    const identity = token ? { token } : { guestKey };
    const [roomId, setRoomId] = useState(guestRoom?.room.roomId);
    const client = useQueryClient();
    const roomKey = ['native-external-room', roomId, user?.id ?? guestKey];
    const view = useQuery({
        queryKey: roomKey,
        queryFn: () => readNativeExternalRoom(identity, roomId!),
        enabled: Boolean(roomId),
        initialData: guestRoom,
        retry: false,
        refetchInterval: query => query.state.data?.started ? false : 900,
    }).data;
    const latest = useRef({ identity, view, gameId, roomId, entry, owner: user?.id ?? guestKey });
    latest.current = { identity, view, gameId, roomId, entry, owner: user?.id ?? guestKey };
    const connection = useRef<{ port: MessagePort; delivered: Set<string>; snapshot?: string }>(null);
    const cleanup = useRef<number | undefined>(undefined);
    const publishing = useRef(0);

    const sync = useCallback((state: ExternalRoomView | undefined) => {
        const target = connection.current;
        if (!state || !target) return;
        const room = JSON.stringify(state.room);
        if (room !== target.snapshot) {
            target.snapshot = room;
            target.port.postMessage({ type: 'room', room: state.room });
        }
        for (const signal of state.signals) {
            if (target.delivered.has(signal.id)) continue;
            target.delivered.add(signal.id);
            target.port.postMessage({ type: 'signal', fromSeatId: signal.fromSeatId, kind: signal.kind, value: signal.value });
        }
    }, []);
    useEffect(() => sync(view), [sync, view]);

    const connect = useCallback((port: MessagePort) => {
        connection.current?.port.close();
        connection.current = { port, delivered: new Set() };
        sync(latest.current.view);
        port.onmessage = ({ data }: MessageEvent<Record<string, unknown>>) => {
            if (port !== connection.current?.port) return;
            const state = latest.current;
            const report = (error: Error) => port.postMessage({ type: 'error', message: error.message });
            if (data?.type === 'publish' && !guestRoom && typeof data.capacity === 'number' && typeof data.name === 'string') {
                const request = ++publishing.current;
                if (state.roomId) void leaveNativeExternalRoom(state.identity, state.roomId).catch(() => {});
                void publishNativeExternalRoom(state.identity, state.gameId, data.capacity, data.name, state.entry).then(result => {
                    if (request !== publishing.current || connection.current?.port !== port) {
                        void leaveNativeExternalRoom(state.identity, result.room.roomId).catch(() => {});
                        return;
                    }
                    client.setQueryData(['native-external-room', result.room.roomId, state.owner], result);
                    setRoomId(result.room.roomId);
                }).catch((error: Error) => port.postMessage({ type: 'publish-error', message: error.message }));
                return;
            }
            if (!state.roomId) return;
            if (data?.type === 'leave') {
                ++publishing.current;
                void leaveNativeExternalRoom(state.identity, state.roomId).catch(report);
                setRoomId(undefined);
            } else if (data?.type === 'start' && !guestRoom) {
                void sendNativeExternalRoomAction(state.identity, state.roomId, { type: 'start' }).then(result => {
                    client.setQueryData(['native-external-room', result.room.roomId, state.owner], result);
                }).catch(report);
            } else if (data?.type === 'signal' && typeof data.toSeatId === 'string' && typeof data.value === 'string'
                && data.value.length <= MAX_EXTERNAL_SIGNAL_LENGTH && (data.kind === 'offer' || data.kind === 'answer')) {
                void sendNativeExternalRoomAction(state.identity, state.roomId, {
                    type: 'signal', toSeatId: data.toSeatId, kind: data.kind, value: data.value,
                }).catch(report);
            }
        };
    }, [client, guestRoom, sync]);

    useEffect(() => {
        window.clearTimeout(cleanup.current);
        const release = () => {
            ++publishing.current;
            const { roomId: active, identity: guest, view: state } = latest.current;
            if (active && !state?.started) void leaveNativeExternalRoom(guest, active).catch(() => {});
            connection.current?.port.close();
            connection.current = null;
        };
        window.addEventListener('pagehide', release);
        return () => {
            window.removeEventListener('pagehide', release);
            cleanup.current = window.setTimeout(release, 0);
        };
    }, []);
    return <SandboxedWebGameFrame gameId={gameId} entry={entry} title={title} nativeMode={guestRoom ? 'guest' : 'host'}
        autoOpen={autoOpen} onNativeRoomConnect={connect} />;
}
