import type { ExternalRoomPlayer, ExternalRoomSnapshot } from '../../shared/externalRoom';

interface ValeSlot {
    name: string;
    connected: boolean;
    inviting: boolean;
    offer: string;
    nameLocked?: boolean;
    peer?: { dc?: RTCDataChannel; ready: Promise<void>; close: () => void } | null;
}

interface ValeApp {
    onlineLobby?: { slots: ValeSlot[] };
    net?: ValeSlot['peer'];
    hostInit(total: number, name: string): void;
    hostInvite(index: number): Promise<void>;
    hostAccept(index: number, code: string): Promise<void>;
    guestConnect(offer: string, name: string): Promise<string>;
    hostStart(): void;
    returnHome(): void;
}

interface ValeUI {
    showOnline(tab: 'host' | 'join'): void;
    onlineHost(body: HTMLElement, profile: unknown): void;
    onlineLobbyRefresh?: () => void;
    toast(message: string, tone: string): void;
}

// 注入托管页面，与原版 App 和 UI 一起运行。此函数不可引用模块闭包。
export function installValeNativeRoomBridge(origin: string, handshake: string, mode: 'host' | 'guest', autoOpen: boolean) {
    window.addEventListener('DOMContentLoaded', () => window.setTimeout(() => {
        const game = window as unknown as { App: ValeApp; UI: ValeUI };
        const { App, UI } = game;
        if (typeof App?.hostInit !== 'function' || typeof UI?.showOnline !== 'function') return;
        const channel = new MessageChannel();
        const port = channel.port1;
        const post = (data: Record<string, unknown>) => port.postMessage(data);
        const slots = new Map<string, number>();
        let room: ExternalRoomSnapshot | undefined;
        let pendingSeat: string | undefined;
        let offerTimer = 0;
        let started = false;
        let publishedFromPlatform = false;
        const failure = (error: unknown) => UI.toast(error instanceof Error ? error.message : String(error), 'err');

        function releaseSlot(seat: string) {
            const index = slots.get(seat);
            if (index === undefined) return;
            slots.delete(seat);
            const slot = App.onlineLobby?.slots[index];
            if (!slot) return;
            slot.peer?.close();
            Object.assign(slot, { peer: null, connected: false, inviting: false, offer: '', name: '玩家 ' + (index + 2), nameLocked: false });
            UI.onlineLobbyRefresh?.();
        }

        async function connectNext() {
            if (!room || pendingSeat || started || mode !== 'host') return;
            const guest = room.players.find(player => player.seatId !== room!.hostSeatId && !slots.has(player.seatId));
            const lobby = App.onlineLobby;
            if (!guest || !lobby || lobby.slots.some(slot => slot.inviting && !slot.connected)) return;
            const index = lobby.slots.findIndex((slot, number) => !slot.connected && ![...slots.values()].includes(number));
            if (index < 0) return;
            const { seatId, displayName } = guest;
            pendingSeat = seatId;
            slots.set(seatId, index);
            const slot = lobby.slots[index];
            slot.name = displayName;
            slot.nameLocked = true;
            try {
                await App.hostInvite(index);
                if (pendingSeat !== seatId || started) return;
                post({ type: 'signal', toSeatId: seatId, kind: 'offer', value: slot.offer });
                offerTimer = window.setTimeout(() => {
                    releaseSlot(seatId);
                    pendingSeat = undefined;
                    failure('连接超时，可以请对方重新加入。');
                }, 25000);
            } catch (error) {
                releaseSlot(seatId);
                pendingSeat = undefined;
                failure(error);
            }
        }

        async function receiveSignal(from: string, kind: string, value: string) {
            if (!room || started) return;
            try {
                if (mode === 'guest' && kind === 'offer' && from === room.hostSeatId) {
                    const name = room.players.find(player => player.seatId === room!.seatId)?.displayName || '游客';
                    const answer = await App.guestConnect(value, name);
                    post({ type: 'signal', toSeatId: from, kind: 'answer', value: answer });
                } else if (mode === 'host' && kind === 'answer' && from === pendingSeat) {
                    window.clearTimeout(offerTimer);
                    const index = slots.get(from);
                    if (index === undefined) return;
                    await App.hostAccept(index, value);
                    const slot = App.onlineLobby?.slots[index];
                    if (slot?.peer?.dc?.readyState !== 'open' && slot?.peer) {
                        slot.connected = false;
                        await Promise.race([slot.peer.ready, new Promise<never>((_, reject) => {
                            offerTimer = window.setTimeout(() => reject(new Error('等待联机连接超时。')), 25000);
                        })]);
                        window.clearTimeout(offerTimer);
                    }
                    UI.onlineLobbyRefresh?.();
                    pendingSeat = undefined;
                    void connectNext();
                }
            } catch (error) {
                if (mode === 'host') releaseSlot(from);
                pendingSeat = undefined;
                failure(error);
            }
        }

        port.onmessage = ({ data }) => {
            if (data?.type === 'room') {
                room = data.room;
                if (!room || mode !== 'host' || started) return;
                const roster = new Set(room.players.map((player: ExternalRoomPlayer) => player.seatId));
                for (const seat of slots.keys()) {
                    if (roster.has(seat)) continue;
                    if (pendingSeat === seat) {
                        pendingSeat = undefined;
                        window.clearTimeout(offerTimer);
                    }
                    releaseSlot(seat);
                }
                void connectNext();
            } else if (data?.type === 'signal') {
                void receiveSignal(data.fromSeatId, data.kind, data.value);
            } else if (data?.type === 'error') {
                failure(data.message);
            } else if (data?.type === 'publish-error') {
                publishedFromPlatform = false;
                UI.onlineLobbyRefresh?.();
                failure(data.message);
            }
        };
        window.parent.postMessage({ type: handshake }, origin, [channel.port2]);
        if (mode === 'host') {
            const renderHost = UI.onlineHost.bind(UI);
            UI.onlineHost = (body, profile) => {
                renderHost(body, profile);
                if (publishedFromPlatform) body.querySelectorAll('[data-inv]').forEach(invite => invite.remove());
                const help = body.querySelector('#oh-create') && body.querySelector('.mode-note');
                if (help) help.textContent = '创建后，好友可以从易桌游游戏详情的房间列表直接加入。';
            };
            const init = App.hostInit.bind(App);
            App.hostInit = (total, name) => {
                init(total, name);
                window.clearTimeout(offerTimer);
                pendingSeat = undefined;
                slots.clear();
                room = undefined;
                started = false;
                publishedFromPlatform = true;
                post({ type: 'publish', capacity: total, name });
            };
            const start = App.hostStart.bind(App);
            App.hostStart = () => {
                start();
                started = true;
                post({ type: 'start' });
            };
        } else {
            UI.toast('正在连接房主…', 'good');
        }
        const home = App.returnHome.bind(App);
        App.returnHome = () => { home(); post({ type: 'leave' }); };
        if (mode === 'host' && autoOpen) UI.showOnline('host');
    }, 0), { once: true });
}
