import { useEffect, useRef, useState } from 'react';
import { useSocial } from '../../contexts/SocialContext';
import { useAuth } from '../../contexts/AuthContext';
import { Send, Gamepad2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { Message } from '../../types/social';
import { socialSocket, SOCIAL_EVENTS, type NewMessagePayload } from '../../services/socialSocket';

// NOTE: 该组件是“好友私聊”窗口，不是局内聊天。局内聊天在 `src/components/game/GameHUD.tsx`。

interface ChatWindowProps {
    targetUserId: string;
    inviteData?: {
        matchId: string;
        gameName: string; // 该字段与界面命名保持一致
    };
}

export const ChatWindow = ({ targetUserId, inviteData }: ChatWindowProps) => {
    const { friends, sendMessage, getMessages, markAsRead, conversations } = useSocial();
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation(['social', 'common']);

    const friend = friends.find(f => f.id === targetUserId);
    const conversation = conversations.find(c => c.userId === targetUserId);

    // 初次加载与轮询/更新
    // 理想情况是社交上下文通过 socket 推送实时更新会话或全局消息仓库。
    // 目前只更新会话列表（最后一条消息）。
    // 没有完整的消息历史存储，因此需要在这里拉取或监听事件更新。
    // 是否提供事件/仓库？
    // 在当前实现中：
    // 新消息只会刷新会话列表，不会把完整消息写入映射。
    // 因此这里需要监听新消息事件，或由上下文暴露事件。
    // 上下文暴露了 socket，可直接监听。
    // 拉取历史消息。

    // 更好的方案：
    // 上下文维护消息映射（按用户编号存储消息列表）。
    // 但目前先在这里拉取/监听作为过渡方案。

    useEffect(() => {
        let active = true;
        setLoading(true);
        getMessages(targetUserId).then(msgs => {
            if (active) {
                setMessages(msgs);
                setLoading(false);
                scrollToBottom();
                markAsRead(targetUserId);
            }
        });

        return () => { active = false; };
    }, [targetUserId, getMessages, markAsRead]);

    // 监听新消息
    useEffect(() => {
        const handleNewMessage = (payload: NewMessagePayload) => {
            // 只处理当前会话的消息
            if (payload.from === targetUserId || (payload.to === targetUserId && payload.from === user?.id)) {
                const newMsg: Message = {
                    id: payload.id,
                    from: payload.from,
                    to: payload.to, // 当前用户
                    content: payload.content,
                    type: payload.type,
                    read: false,
                    createdAt: payload.createdAt
                };

                setMessages(prev => {
                    // 去重
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });

                if (payload.from === targetUserId) {
                    markAsRead(targetUserId);
                }
                setTimeout(scrollToBottom, 100);
            }
        };

        const cleanup = socialSocket.on(SOCIAL_EVENTS.NEW_MESSAGE, handleNewMessage);
        return () => { cleanup(); };
    }, [targetUserId, markAsRead, user?.id]);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        const content = inputValue;
        setInputValue(''); // 乐观清空

        try {
            const msg = await sendMessage(targetUserId, content);
            // 本地追加
            setMessages(prev => [...prev, msg]);
            scrollToBottom();
        } catch (error) {
            console.error('Failed to send', error);
            setInputValue(content); // 回滚
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!friend && !conversation) {
        return <div className="flex-1 flex items-center justify-center text-[#8c7b64]">{t('social:chat.userNotFound')}</div>;
    }

    const username = friend?.username || conversation?.username || t('common:unknownUser');
    const isOnline = friend?.online || conversation?.online || false;

    // 临时日志：确认布局高度是否生效（问题解决后会删除）
    useEffect(() => {
        if (!containerRef.current) return;
        const el = containerRef.current;
        const log = (reason: string) => {
            const rect = el.getBoundingClientRect();
            console.log(`[ChatWindow] reason=${reason} targetUserId=${targetUserId} height=${Math.round(rect.height)}px width=${Math.round(rect.width)}px`);
        };

        // 强制定时打印：用来证明组件是否真的渲染、以及高度是否变化
        log('mount');
        const intervalId = window.setInterval(() => log('tick'), 1500);

        // 兼容旧浏览器 / 被禁用场景
        if (typeof ResizeObserver === 'undefined') {
            console.log('[ChatWindow] ResizeObserver=undefined');
            return () => window.clearInterval(intervalId);
        }

        const ro = new ResizeObserver(() => log('resize'));
        ro.observe(el);
        return () => {
            ro.disconnect();
            window.clearInterval(intervalId);
        };
    }, [targetUserId]);

    return (
        <div ref={containerRef} className="flex flex-col h-full bg-parchment-card-bg">
            {/* 顶部栏：不要挤压消息区域，把“房间/用户名”信息独立出来并控制高度 */}
            <div className="shrink-0 border-b border-parchment-card-border/30 bg-parchment-base-bg shadow-sm z-10">
                <div className="h-14 flex items-center px-4">
                    <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-parchment-card-border flex items-center justify-center text-parchment-card-bg font-bold">
                            {username[0].toUpperCase()}
                        </div>
                        {isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-parchment-base-bg" />}
                    </div>
                    <div className="ml-3 flex-1">
                        <div className="font-bold text-parchment-base-text text-sm">{username}</div>
                        <div className="text-[10px] text-parchment-light-text">
                            {isOnline ? t('social:status.online') : t('social:status.offline')}
                        </div>
                    </div>
                    {inviteData && isOnline && (
                        <button
                            onClick={async () => {
                                try {
                                    const content = JSON.stringify({ matchId: inviteData.matchId, gameName: inviteData.gameName });
                                    await sendMessage(targetUserId, content, 'invite');
                                } catch (e) {
                                    console.error("Failed to invite", e);
                                }
                            }}
                            className="p-2 bg-parchment-base-text text-parchment-card-bg rounded-full hover:bg-parchment-brown transition-colors"
                            title={t('social:actions.invite')}
                        >
                            <Gamepad2 size={16} />
                        </button>
                    )}
                </div>

                {/* 信息区：跟悬浮球预览同排，展示最近一条消息摘要 */}
                <div className="px-4 pb-3 text-xs text-parchment-light-text">
                    <div className="leading-5">
                        {t('social:chat.roomLabel')}{(inviteData?.matchId ?? '').slice(0, 12) || t('social:chat.emptyValue')}
                    </div>
                    <div className="leading-5">
                        {t('social:chat.meLabel')}{user?.username || user?.id || t('social:chat.emptyValue')}
                    </div>
                    <div className="mt-1 leading-5 text-[11px] text-parchment-base-text/70 truncate">
                        {messages.length > 0 ? messages[messages.length - 1]?.content : t('social:chat.noMessages')}
                    </div>
                </div>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                {loading && <div className="text-center text-xs text-parchment-light-text">{t('common:loading')}</div>}
                {messages.map((msg, index) => {
                    const isMe = msg.from !== targetUserId;
                    const showTime = index === 0 || (new Date(msg.createdAt).getTime() - new Date(messages[index - 1].createdAt).getTime() > 5 * 60 * 1000);

                    return (
                        <div key={msg.id} className="flex flex-col">
                            {showTime && (
                                <div className="text-center text-[10px] text-parchment-light-text/60 mb-2 mt-2">
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                            <div className={clsx("max-w-[80%] rounded-lg p-3 text-sm shadow-sm",
                                isMe ? "self-end bg-parchment-base-text text-parchment-card-bg rounded-br-none" : "self-start bg-white border border-parchment-card-border/30 text-parchment-base-text rounded-bl-none"
                            )}>
                                {msg.type === 'invite' ? (
                                    <div className="flex items-center gap-2">
                                        <Gamepad2 size={16} className="shrink-0" />
                                        <span>{t('social:chat.gameInvite')}</span>
                                        {/* 待办：若可加入对局则增加加入按钮 */}
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 输入区 */}
            <div className="shrink-0 p-3 bg-white border-t border-parchment-card-border/30">
                <form onSubmit={handleSend} className="relative flex items-center gap-2">
                    <input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('social:chat.placeholder')}
                        className="flex-1 bg-parchment-base-bg border border-parchment-card-border/40 rounded-full pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-parchment-base-text transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="absolute right-2 p-1.5 bg-parchment-base-text text-parchment-card-bg rounded-full hover:bg-parchment-brown disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
};
