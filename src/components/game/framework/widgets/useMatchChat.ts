import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../contexts/ToastContext';
import { matchSocket } from '../../../../services/matchSocket';
import { MAX_CHAT_MESSAGES, type MatchChatChannel, type MatchChatMessage } from '../../../../shared/chat';

const emptyUnread = () => ({ players: 0, room: 0 });
const emptyDrafts = () => ({ players: '', room: '' });
export function useMatchChat(options: {
    isOnline: boolean; matchId?: string; playerId?: string | null; credentials?: string; displayName: string;
}) {
    const { isOnline, matchId, playerId, credentials, displayName } = options;
    const isSpectator = isOnline && playerId == null;
    const [channel, setChannel] = useState<MatchChatChannel>(isSpectator ? 'room' : 'players');
    const [messages, setMessages] = useState<MatchChatMessage[]>([]);
    const [drafts, setDrafts] = useState(emptyDrafts);
    const [unread, setUnread] = useState(emptyUnread);
    const [sending, setSending] = useState(false);
    const [latestIncoming, setLatestIncoming] = useState<MatchChatMessage | null>(null);
    const open = useRef(false);
    const active = useRef(channel);
    const [ownIds, setOwnIds] = useState(() => new Set<string>());
    const sessionKey = `${isOnline}:${matchId}:${playerId}:${credentials}:${displayName}`;
    const [previousSessionKey, setPreviousSessionKey] = useState(sessionKey);
    const generation = useRef(0);
    const pendingSendIds = useRef<Partial<Record<MatchChatChannel, { text: string; id: string }>>>({});
    useEffect(() => {
        generation.current += 1;
        pendingSendIds.current = {};
        return () => { generation.current += 1; };
    }, [sessionKey]);
    if (previousSessionKey !== sessionKey) {
        setPreviousSessionKey(sessionKey);
        setMessages([]); setDrafts(emptyDrafts()); setUnread(emptyUnread());
        setLatestIncoming(null); setOwnIds(new Set()); setSending(false);
        setChannel(isSpectator ? 'room' : 'players');
    }
    const { t } = useTranslation('game');
    const toast = useToast();
    const currentChannel = isSpectator ? 'room' : channel;
    useEffect(() => { active.current = currentChannel; }, [currentChannel]);
    const selectChannel = useCallback((next: MatchChatChannel) => {
        if (isSpectator && next === 'players') return;
        active.current = next;
        setChannel(next);
        setUnread(prev => ({ ...prev, [next]: 0 }));
    }, [isSpectator]);
    const onOpenChange = useCallback((value: boolean) => {
        open.current = value;
        if (value) setUnread(prev => ({ ...prev, [active.current]: 0 }));
    }, []);

    useEffect(() => {
        let activeSubscription = true;
        if (!isOnline || !matchId) return;
        const unsubHistory = matchSocket.subscribeChatHistory(history => {
            if (!activeSubscription) return;
            const visible = history.filter(message => message.matchId === matchId && (!isSpectator || message.channel !== 'players'));
            setMessages(prev => [...new Map([...visible, ...prev].map(message => [message.id, message])).values()]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
        });
        const unsubscribe = matchSocket.subscribeChat(message => {
            if (!activeSubscription || message.matchId !== matchId || (isSpectator && message.channel === 'players')) return;
            const target = message.channel ?? 'room';
            const own = matchSocket.isOwnChatMessage(message);
            if (own) setOwnIds(prev => new Set([...prev, message.id]));
            setMessages(prev => prev.some(item => item.id === message.id) ? prev : [
                ...prev.filter(item => (item.channel ?? 'room') !== target),
                ...[...prev.filter(item => (item.channel ?? 'room') === target), message].slice(-MAX_CHAT_MESSAGES),
            ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
            if (!own) {
                setLatestIncoming(message);
                if (!open.current || active.current !== target) setUnread(prev => ({ ...prev, [target]: prev[target] + 1 }));
            }
        });
        matchSocket.joinChat(matchId, { playerId: playerId ?? undefined, credentials, senderName: displayName });
        return () => {
            activeSubscription = false;
            unsubHistory(); unsubscribe(); matchSocket.leaveChat();
        };
    }, [isOnline, matchId, playerId, credentials, displayName, isSpectator]);

    const input = drafts[currentChannel];
    const send = async () => {
        const text = input.trim();
        if (!text || sending) return;
        const destination = currentChannel;
        const pending = pendingSendIds.current[destination];
        const clientMessageId = pending?.text === text ? pending.id : crypto.randomUUID();
        pendingSendIds.current[destination] = { text, id: clientMessageId };
        const sendGeneration = generation.current;
        setSending(true);
        if (isOnline) {
            const result = await matchSocket.sendChat(text, destination, clientMessageId);
            if (generation.current !== sendGeneration) return;
            setSending(false);
            if (!result.ok) {
                toast.error(t(result.reason === 'not_player' ? 'hud.chat.playersOnly' : 'hud.chat.sendFailed'));
                return;
            }
            if (pendingSendIds.current[destination]?.id === clientMessageId) delete pendingSendIds.current[destination];
        } else {
            const message: MatchChatMessage = {
                id: crypto.randomUUID(), matchId: matchId ?? 'local', channel: destination,
                senderId: playerId ?? undefined, senderName: displayName, senderRole: 'player', text, createdAt: new Date().toISOString(),
            };
            setOwnIds(prev => new Set([...prev, message.id]));
            setMessages(prev => [...prev, message].slice(-MAX_CHAT_MESSAGES));
            delete pendingSendIds.current[destination];
            setSending(false);
        }
        setDrafts(prev => prev[destination].trim() === text ? { ...prev, [destination]: '' } : prev);
    };
    return {
        channel: currentChannel, selectChannel, messages: messages.filter(message => (message.channel ?? 'room') === currentChannel),
        input, setInput: (value: string) => setDrafts(prev => ({ ...prev, [currentChannel]: value })),
        unread, unreadTotal: unread.players + unread.room, latestIncoming, onOpenChange, sending, send,
        isOwn: (message: MatchChatMessage) => ownIds.has(message.id) || (playerId != null && message.senderRole !== 'spectator' && message.senderId === playerId),
    };
}
