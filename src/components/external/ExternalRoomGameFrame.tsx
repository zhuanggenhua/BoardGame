import { useCallback, useEffect, useRef } from 'react';
import { externalRoomRosterKey, MAX_EXTERNAL_SIGNAL_LENGTH, type ExternalRoomView } from '../../shared/externalRoom';
import { SandboxedWebGameFrame } from './SandboxedWebGameFrame';

interface RoomConnection {
    port: MessagePort;
    lastRoom?: string;
    delivered: Set<string>;
    started: boolean;
}

function deliver(connection: RoomConnection, view: ExternalRoomView) {
    const snapshot = JSON.stringify(view.room);
    if (connection.lastRoom !== snapshot) {
        connection.port.postMessage({ type: 'room', room: view.room });
        connection.lastRoom = snapshot;
    }
    for (const signal of view.signals) {
        if (connection.delivered.has(signal.id)) continue;
        connection.delivered.add(signal.id);
        connection.port.postMessage({ type: 'signal', roomId: view.room.roomId,
            fromSeatId: signal.fromSeatId, kind: signal.kind, value: signal.value });
    }
    if (!connection.started && view.started) {
        connection.started = true;
        connection.port.postMessage({ type: 'start', roomId: view.room.roomId });
    }
}

export function ExternalRoomGameFrame({ view, send, onHandshakeTimeout }: {
    view: ExternalRoomView;
    send: (data: Record<string, unknown>) => void;
    onHandshakeTimeout: () => void;
}) {
    const latest = useRef({ view, send });
    latest.current = { view, send };
    const connection = useRef<RoomConnection | null>(null);
    const connect = useCallback((port: MessagePort) => {
        connection.current?.port.close();
        const current: RoomConnection = { port, delivered: new Set(), started: false };
        connection.current = current;
        const roomId = latest.current.view.room.roomId;
        const rosterKey = externalRoomRosterKey(latest.current.view.room.players);
        port.onmessage = ({ data }: MessageEvent<Record<string, unknown>>) => {
            if (data?.roomId !== roomId || connection.current !== current) return;
            switch (data.type) {
                case 'ready':
                    if (typeof data.ready === 'boolean') latest.current.send({ type: 'ready', ready: data.ready, rosterKey });
                    break;
                case 'signal':
                    if (typeof data.toSeatId === 'string' && (data.kind === 'offer' || data.kind === 'answer')
                        && typeof data.value === 'string' && data.value.length > 0 && data.value.length <= MAX_EXTERNAL_SIGNAL_LENGTH) {
                        latest.current.send({ type: 'signal', toSeatId: data.toSeatId, kind: data.kind, value: data.value, rosterKey });
                    }
                    break;
                case 'disconnect':
                    latest.current.send({ type: 'ready', ready: false, rosterKey });
                    port.close();
                    connection.current = null;
                    break;
            }
        };
        deliver(current, latest.current.view);
    }, []);
    useEffect(() => {
        if (connection.current) deliver(connection.current, view);
    }, [view]);
    useEffect(() => {
        const timer = window.setTimeout(() => { if (!connection.current) onHandshakeTimeout(); }, 15_000);
        return () => window.clearTimeout(timer);
    }, [onHandshakeTimeout]);
    useEffect(() => () => connection.current?.port.close(), []);
    return <SandboxedWebGameFrame gameId={view.gameId} entry={view.entry} title={view.title} onRoomConnect={connect} />;
}
