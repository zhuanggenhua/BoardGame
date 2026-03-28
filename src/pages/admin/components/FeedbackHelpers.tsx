import { useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface FeedbackItemLike {
    _id: string;
    userId?: {
        _id: string;
        username: string;
        avatar?: string;
    };
    content: string;
    type: 'bug' | 'suggestion' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    gameName?: string;
    contactInfo?: string;
    actionLog?: string;
    stateSnapshot?: string;
    createdAt: string;
}

const EMBEDDED_IMG_RE = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;

function createEmbeddedImageRegExp(): RegExp {
    return new RegExp(EMBEDDED_IMG_RE.source, EMBEDDED_IMG_RE.flags);
}

export function extractText(content: string, t: TFunction<'admin'>): string {
    return content.replace(EMBEDDED_IMG_RE, '').trim() || t('feedback.content.onlyImage');
}

export function hasEmbeddedImage(content: string): boolean {
    return createEmbeddedImageRegExp().test(content);
}

export function FeedbackContent({
    content,
    onImageClick,
    t,
}: {
    content: string;
    onImageClick: (src: string) => void;
    t: TFunction<'admin'>;
}) {
    const embeddedImageRegExp = createEmbeddedImageRegExp();

    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = embeddedImageRegExp.exec(content)) !== null) {
        if (match.index > lastIndex) {
            const text = content.slice(lastIndex, match.index).trim();
            if (text) {
                parts.push(
                    <p key={key++} className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                        {text}
                    </p>
                );
            }
        }

        const imgSrc = match[2];
        parts.push(
            <button
                key={key++}
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onImageClick(imgSrc);
                }}
                className="block text-left"
            >
                <img
                    src={imgSrc}
                    alt={match[1] || t('feedback.content.screenshotAlt')}
                    className="max-h-72 max-w-full rounded-lg border border-zinc-200 bg-white object-contain transition-shadow cursor-zoom-in hover:shadow-md"
                />
            </button>
        );

        lastIndex = match.index + match[0].length;
    }

    const remaining = content.slice(lastIndex).trim();
    if (remaining) {
        parts.push(
            <p key={key++} className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                {remaining}
            </p>
        );
    }

    if (parts.length === 0) {
        parts.push(
            <p key={0} className="text-sm italic text-zinc-400">
                {t('feedback.content.empty')}
            </p>
        );
    }

    return <div className="space-y-3">{parts}</div>;
}

function compressStateSnapshot(stateJson: string): string {
    try {
        const state = JSON.parse(stateJson);
        const lines: string[] = [];

        lines.push('=== 游戏状态快照（压缩版）===');
        lines.push(`游戏: ${state.gameId || 'unknown'}`);
        lines.push(`回合: P${state.core?.currentPlayer ?? '?'} | 阶段: ${state.core?.phase ?? '?'}`);

        if (state.core?.players) {
            lines.push('\n--- 玩家 ---');
            Object.entries(state.core.players).forEach(([pid, player]: [string, any]) => {
                const resources = player.resources
                    ? Object.entries(player.resources).map(([key, value]) => `${key}:${value}`).join(' ')
                    : '';
                lines.push(`P${pid}: HP=${player.hp ?? '?'} ${resources} | 手牌=${player.hand?.length ?? 0} 牌库=${player.deck?.length ?? 0} 弃牌=${player.discard?.length ?? 0}`);
            });
        }

        if (state.core?.field && state.core.field.length > 0) {
            lines.push('\n--- 场上 ---');
            state.core.field.forEach((unit: any, index: number) => {
                const tags = unit.tags ? Object.keys(unit.tags).join(',') : '';
                lines.push(`[${index}] ${unit.card?.defId ?? '?'} (P${unit.owner}) HP=${unit.hp ?? '?'} ${tags ? `[${tags}]` : ''}`);
            });
        }

        if (state.sys?.interaction?.current) {
            const interaction = state.sys.interaction.current;
            lines.push('\n--- 交互 ---');
            lines.push(`类型: ${interaction.type} | 玩家: P${interaction.playerId}`);
            lines.push(`选项数: ${interaction.data?.options?.length ?? 0}`);
        }

        if (state.sys?.responseWindow?.current) {
            lines.push('\n--- 响应窗口 ---');
            lines.push(`触发事件: ${state.sys.responseWindow.current.triggerEvent?.type ?? '?'}`);
        }

        if (state.sys?.eventStream?.entries) {
            const recent = state.sys.eventStream.entries.slice(-10);
            if (recent.length > 0) {
                lines.push('\n--- 最近事件 ---');
                recent.forEach((entry: any) => {
                    let params = '';
                    if (entry.payload) {
                        const payload = entry.payload;
                        if (payload.playerId !== undefined) params += ` P${payload.playerId}`;
                        if (payload.targetId !== undefined) params += ` -> ${payload.targetId}`;
                        if (payload.damage !== undefined) params += ` dmg=${payload.damage}`;
                        if (payload.amount !== undefined) params += ` amt=${payload.amount}`;
                        if (payload.cardDefId) params += ` [${payload.cardDefId}]`;
                        if (payload.abilityId) params += ` {${payload.abilityId}}`;
                    }
                    lines.push(`${entry.id}: ${entry.type}${params}`);
                });
            }
        }

        return lines.join('\n');
    } catch (err) {
        return `[状态解析失败: ${err instanceof Error ? err.message : '未知错误'}]`;
    }
}

export function CopyFeedbackButton({
    item,
    t,
}: {
    item: FeedbackItemLike;
    t: TFunction<'admin'>;
}) {
    const [copied, setCopied] = useState(false);
    const [copiedJson, setCopiedJson] = useState(false);

    const handleCopy = (event: ReactMouseEvent) => {
        event.stopPropagation();
        const submitter = item.userId?.username || t('feedback.anonymous');
        const parts = [
            `【${t(`feedback.type.${item.type}`)}】【${t(`feedback.severity.${item.severity}`)}】`,
            item.gameName ? `游戏: ${item.gameName}` : '',
            `提交者: ${submitter}`,
            `时间: ${new Date(item.createdAt).toLocaleString('zh-CN')}`,
            '',
            '--- 反馈内容 ---',
            extractText(item.content, t),
            item.actionLog ? `\n--- 操作日志 ---\n${item.actionLog}` : '',
            item.stateSnapshot ? `\n--- 游戏状态 ---\n${compressStateSnapshot(item.stateSnapshot)}` : '',
        ].filter(Boolean).join('\n');

        navigator.clipboard.writeText(parts).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleCopyJson = (event: ReactMouseEvent) => {
        event.stopPropagation();
        if (!item.stateSnapshot) return;

        navigator.clipboard.writeText(item.stateSnapshot).then(() => {
            setCopiedJson(true);
            setTimeout(() => setCopiedJson(false), 2000);
        });
    };

    return (
        <div className="inline-flex items-center gap-1">
            <button
                type="button"
                onClick={handleCopy}
                className={cn(
                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors',
                    copied ? 'bg-emerald-50 text-emerald-600' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
                )}
                title={t('feedback.actions.copyAll')}
            >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? t('feedback.actions.copied') : t('feedback.actions.copyAll')}
            </button>
            {item.stateSnapshot && (
                <button
                    type="button"
                    onClick={handleCopyJson}
                    className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors',
                        copiedJson ? 'bg-emerald-50 text-emerald-600' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
                    )}
                    title={t('feedback.stateSnapshot.copy')}
                >
                    {copiedJson ? <Check size={12} /> : <Copy size={12} />}
                    {copiedJson ? t('feedback.stateSnapshot.copied') : 'JSON'}
                </button>
            )}
        </div>
    );
}

export function formatTime(iso: string, t: TFunction<'admin'>): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return t('feedback.time.justNow');
    if (diffMin < 60) return t('feedback.time.minutesAgo', { count: diffMin });

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return t('feedback.time.hoursAgo', { count: diffHour });

    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return t('feedback.time.daysAgo', { count: diffDay });

    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatAbsoluteTime(iso: string): string {
    const date = new Date(iso);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
