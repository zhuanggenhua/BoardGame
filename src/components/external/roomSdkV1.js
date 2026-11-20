(function () {
const ROOM_PROTOCOL_VERSION = 1;
const ROOM_SDK_RELEASE = '1.0.0';
const ROOM_CONNECT_MESSAGE = 'boardgame:room-connect';
const MAX_SIGNAL_LENGTH = 65_536;

const isId = value => typeof value === 'string' && value.length > 0 && value.length <= 128;
const isSignal = (kind, value) => (kind === 'offer' || kind === 'answer')
    && typeof value === 'string' && value.length > 0 && value.length <= MAX_SIGNAL_LENGTH;

function toRoom(value) {
    if (!value || !isId(value.roomId) || !isId(value.seatId) || !isId(value.hostSeatId)
        || !Array.isArray(value.players) || value.players.length > 32) return null;
    const players = [];
    const seats = new Set();
    for (const player of value.players) {
        if (!player || !isId(player.seatId) || seats.has(player.seatId)
            || typeof player.displayName !== 'string' || player.displayName.length > 100
            || typeof player.ready !== 'boolean') return null;
        seats.add(player.seatId);
        players.push(Object.freeze({ seatId: player.seatId, displayName: player.displayName, ready: player.ready }));
    }
    if (!seats.has(value.seatId) || !seats.has(value.hostSeatId)) return null;
    const capacity = Number.isInteger(value.capacity) && value.capacity >= players.length && value.capacity <= 32
        ? value.capacity : undefined;
    const settings = Object.freeze({ ...value.settings });
    return Object.freeze({ roomId: value.roomId, seatId: value.seatId, hostSeatId: value.hostSeatId, players: Object.freeze(players), capacity, settings });
}

function createBoardGameRoomClient({ platformOrigin, timeoutMs = 5000, onRoom, onSignal, onStart, onClose } = {}) {
    const origin = new URL(platformOrigin);
    if (origin.origin !== platformOrigin || !['http:', 'https:'].includes(origin.protocol)) {
        throw new TypeError('platformOrigin 必须是易桌游页面的 HTTP(S) 来源');
    }
    if (window.parent === window) throw new Error('请在平台房间中初始化 SDK');

    const channel = new MessageChannel();
    let room = null;
    let closed = false;
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const deadline = setTimeout(() => finish('平台未建立房间连接'), timeoutMs);

    function finish(reason) {
        if (closed) return;
        closed = true;
        clearTimeout(deadline);
        channel.port1.close();
        if (!room) rejectReady(new Error(reason));
        onClose?.(reason);
    }

    function send(type, payload = {}) {
        if (!room || closed) throw new Error('房间连接尚未就绪或已关闭');
        channel.port1.postMessage({ type, roomId: room.roomId, ...payload });
    }

    channel.port1.onmessage = ({ data }) => {
        if (closed || !data || typeof data !== 'object') return;
        if (data.type === 'room') {
            const next = toRoom(data.room);
            if (!next || (room && (room.roomId !== next.roomId || room.seatId !== next.seatId))) return;
            const previous = room;
            room = next;
            clearTimeout(deadline);
            if (previous) onRoom?.(next);
            else resolveReady(next);
            return;
        }
        if (data.type === 'close' && (!room || data.roomId === room.roomId)) {
            finish(typeof data.reason === 'string' ? data.reason : '平台已关闭房间连接');
            return;
        }
        if (!room || data.roomId !== room.roomId) return;
        if (data.type === 'start') onStart?.(room);
        if (data.type === 'signal' && data.fromSeatId !== room.seatId && room.players.some(player => player.seatId === data.fromSeatId)
            && isSignal(data.kind, data.value)) {
            onSignal?.({ fromSeatId: data.fromSeatId, kind: data.kind, value: data.value });
        }
    };

    try {
        window.parent.postMessage({ type: ROOM_CONNECT_MESSAGE, version: ROOM_PROTOCOL_VERSION }, origin.origin, [channel.port2]);
    } catch (error) {
        channel.port2.close();
        finish(error instanceof Error ? error.message : '房间连接初始化失败');
    }

    return {
        ready,
        get room() { return room; },
        sendSignal(toSeatId, kind, value) {
            if (!isSignal(kind, value) || toSeatId === room?.seatId || !room?.players.some(player => player.seatId === toSeatId)) {
                throw new TypeError('无效的信令或座位');
            }
            send('signal', { toSeatId, kind, value });
        },
        setReady(ready) {
            if (typeof ready !== 'boolean') throw new TypeError('就绪状态必须为布尔值');
            send('ready', { ready });
        },
        close() {
            if (!closed && room) send('disconnect');
            finish('游戏已关闭连接');
        },
    };
}

window.BoardGameRoomSDK = Object.freeze({
    version: ROOM_PROTOCOL_VERSION,
    release: ROOM_SDK_RELEASE,
    createClient: createBoardGameRoomClient,
});
})();
