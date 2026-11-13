import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Send, SmilePlus, Users } from 'lucide-react';
import { MAX_CHAT_LENGTH, type MatchChatChannel } from '../../../../shared/chat';
import type { EmoteDefinition } from '../../../../shared/emotes';
import type { MatchEmoteEvent } from '../../../../services/matchSocket';
import { OptimizedImage } from '../../../common/media/OptimizedImage';
import { EmotePicker } from './EmotePicker';
import type { useMatchChat } from './useMatchChat';

export function MatchChatPanel({ chat, isOnline, isSpectator, matchId, players, myPlayerId, myDisplayName, emotes, resolveEmote, canUseEmotes, localEmotes, onSendEmote }: {
    chat: ReturnType<typeof useMatchChat>; isOnline: boolean; isSpectator: boolean; matchId?: string;
    players?: Array<{ id: number; name?: string; isConnected?: boolean }>; myPlayerId?: string | null; myDisplayName: string;
    emotes: readonly EmoteDefinition[]; resolveEmote: (id: string) => EmoteDefinition | undefined;
    canUseEmotes: boolean; localEmotes: MatchEmoteEvent[]; onSendEmote: (id: string) => void;
}) {
    const { t } = useTranslation('game');
    const [membersOpen, setMembersOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const scroll = useRef<HTMLDivElement>(null);
    const positions = useRef<Partial<Record<MatchChatChannel, number>>>({});
    const previousChannel = useRef(chat.channel);
    const atBottom = useRef(true);
    useLayoutEffect(() => {
        const element = scroll.current;
        if (!element) return;
        if (previousChannel.current !== chat.channel) {
            element.scrollTop = positions.current[chat.channel] ?? element.scrollHeight;
            previousChannel.current = chat.channel;
        } else if (atBottom.current) element.scrollTop = element.scrollHeight;
    }, [chat.channel, chat.messages.length, localEmotes.length]);
    const scope = chat.channel === 'players' ? t('hud.chat.playersScope') : t('hud.chat.roomScope');
    return (
        <div className="flex min-h-0 flex-col" style={{ height: 'min(24rem, var(--fab-panel-content-height, calc(var(--runtime-viewport-height, 100dvh) - 7rem)))' }} data-testid="match-chat-panel">
            {isOnline && <div className="mb-1 flex shrink-0 items-center justify-between gap-2 border-b border-[#d3ccba]">
                <div role="tablist" aria-label={t('hud.chat.channels')} className="flex gap-4">
                {(['players', 'room'] as const).filter(channel => !isSpectator || channel === 'room').map(channel => <button
                    key={channel} type="button" role="tab" aria-selected={chat.channel === channel} data-testid={`chat-channel-${channel}`}
                    onClick={() => { if (scroll.current) positions.current[chat.channel] = scroll.current.scrollTop; chat.selectChannel(channel); setPickerOpen(false); }}
                    className={`relative flex h-7 items-center gap-1 border-b-2 px-0.5 text-xs transition-colors after:absolute after:-inset-y-2 after:-inset-x-2 ${chat.channel === channel ? 'border-indigo-300 font-semibold text-[#433422]' : 'border-transparent text-[#6f6253] hover:text-[#433422]'}`}>
                    {t(`hud.chat.channel.${channel}`)}{chat.unread[channel] > 0 && <span
                        data-testid={`chat-unread-${channel}`} role="img"
                        aria-label={t('hud.chat.unreadLabel', { channel: t(`hud.chat.channel.${channel}`), count: chat.unread[channel] })}
                        title={t('hud.chat.unreadLabel', { channel: t(`hud.chat.channel.${channel}`), count: chat.unread[channel] })}
                        className="shrink-0 rounded-full bg-indigo-400/25 px-1.5 text-[10px] text-[#433422]">
                        {chat.unread[channel] > 99 ? '99+' : chat.unread[channel]}
                    </span>}
                </button>)}
                </div>
                <button type="button" aria-expanded={membersOpen} onClick={() => setMembersOpen(value => !value)} className="relative flex h-7 shrink-0 items-center gap-1 text-[10px] text-[#6f6253] hover:text-[#433422] after:absolute after:-inset-y-2 after:inset-x-0" aria-label={t('hud.chat.members')}>
                    <Users size={12} /><span>{t('hud.chat.playerCount', { count: players?.filter(player => player.name).length ?? 0 })}</span><ChevronDown size={10} className={membersOpen ? 'rotate-180' : ''} />
                </button>
            </div>}
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2 text-[10px] text-[#817363]">
                <span data-testid="chat-channel-scope">{scope}</span>
                {isOnline && <span className="max-w-20 truncate font-mono text-[9px] text-[#817363]" title={`${t('hud.actions.room')} ${matchId}`}>{matchId}</span>}
            </div>
            {membersOpen && <div className="mb-2 max-h-24 shrink-0 overflow-y-auto rounded border border-[#d3ccba] bg-[#f4f1eb] p-2 text-xs">
                {players?.map(player => <div key={player.id} className="flex items-center gap-2 py-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${player.isConnected ? 'bg-green-400' : 'bg-[#a99c8a]'}`} />
                    <span>{player.name || t('hud.status.empty')}{String(player.id) === myPlayerId ? ` (${t('hud.status.self')})` : ''}</span>
                </div>)}
            </div>}
            <div ref={scroll} role="log" aria-label={t('hud.chat.messages')} onScroll={() => {
                const element = scroll.current;
                if (element) atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
            }} className="custom-scrollbar flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 text-xs">
                {chat.messages.length === 0 && <div className="py-8 text-center text-[#817363]">{t('hud.chat.empty')}</div>}
                {chat.messages.map((message, index) => {
                    const own = chat.isOwn(message);
                    const previous = chat.messages[index - 1];
                    const showHeader = !previous || previous.senderId !== message.senderId || previous.senderName !== message.senderName || Date.parse(message.createdAt) - Date.parse(previous.createdAt) > 120000;
                    return <div key={message.id} className={`flex flex-col ${own ? 'items-end' : 'items-start'}`}>
                        {showHeader && <div className="mb-1 flex max-w-full items-center gap-1.5 text-[10px] text-[#6f6253]">
                            <span className="truncate font-semibold text-[#514637]">{message.senderName}</span>
                            <span className={message.senderRole === 'spectator' ? 'text-[#8a6632]' : 'text-[#6f6253]'}>{t(message.senderRole === 'spectator' ? 'hud.chat.spectator' : 'hud.chat.player')}</span>
                            <time className="shrink-0 text-[#817363]">{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                        </div>}
                        <div className={`max-w-[92%] whitespace-pre-wrap break-words rounded-lg px-2.5 py-2 leading-relaxed ${own ? 'rounded-tr-sm bg-indigo-500/20 text-[#433422]' : 'rounded-tl-sm bg-[#eeeae2] text-[#433422]'}`}>{message.text}</div>
                    </div>;
                })}
                {chat.channel === 'players' && localEmotes.map(event => {
                    const emote = resolveEmote(event.emoteId);
                    return emote && <div key={`${event.playerId}:${event.createdAt}`} className="flex flex-col items-end" data-testid={`hud-chat-local-emote-${event.emoteId}`}>
                        <span className="mb-1 text-[10px] text-[#6f6253]">{myDisplayName}</span><OptimizedImage src={emote.assetPath} alt={emote.label} placeholder={false} draggable={false} className="h-16 w-16 object-contain" />
                    </div>;
                })}
            </div>
            {pickerOpen && canUseEmotes && <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-[#d3ccba] bg-[#f4f1eb] p-2" data-testid="hud-chat-emote-panel">
                <EmotePicker emotes={emotes} onSelect={id => { onSendEmote(id); setPickerOpen(false); }} />
            </div>}
            <form onSubmit={event => { event.preventDefault(); atBottom.current = true; void chat.send(); }} className="mt-2 flex shrink-0 items-center gap-1.5 border-t border-[#d3ccba] pt-2">
                {canUseEmotes && chat.channel === 'players' && <button type="button" onClick={() => setPickerOpen(value => !value)} aria-label={t('hud.actions.emotes')} className="relative flex h-8 w-9 shrink-0 items-center justify-center text-[#6f6253] hover:text-[#433422] after:absolute after:-inset-y-1.5 after:-inset-x-1" data-testid="hud-chat-emote-toggle"><SmilePlus size={16} /></button>}
                <input data-testid="chat-message-input" aria-label={t('hud.chat.inputLabel', { channel: t(`hud.chat.channel.${chat.channel}`) })} value={chat.input} onChange={event => chat.setInput(event.target.value)} maxLength={MAX_CHAT_LENGTH} placeholder={t('hud.chat.channelPlaceholder', { channel: t(`hud.chat.channel.${chat.channel}`) })} className="h-8 min-w-0 flex-1 rounded border border-[#d3ccba] bg-[#f4f1eb] px-2 text-base text-[#433422] placeholder-[#817363] focus:border-indigo-300/70 focus:outline-none sm:text-xs" />
                <button type="submit" aria-label={t('hud.chat.send')} disabled={!chat.input.trim() || chat.sending} className="relative flex h-8 w-9 shrink-0 items-center justify-center text-[#6f6253] hover:text-[#433422] disabled:cursor-not-allowed disabled:opacity-30 after:absolute after:-inset-y-1.5 after:-inset-x-1"><Send size={15} /></button>
            </form>
        </div>
    );
}
