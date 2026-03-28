/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FeedbackClientContext {
    route?: string;
    mode?: string;
    matchId?: string;
    playerId?: string;
    gameId?: string;
    appVersion?: string;
    userAgent?: string;
    viewport?: {
        width: number;
        height: number;
    };
    language?: string;
    timezone?: string;
}

export interface FeedbackErrorContext {
    message?: string;
    name?: string;
    stack?: string;
    source?: string;
}

export interface FeedbackUser {
    _id: string;
    username: string;
    avatar?: string;
    email?: string;
}

export interface FeedbackItem {
    _id: string;
    userId?: FeedbackUser;
    content: string;
    type: 'bug' | 'suggestion' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    gameName?: string;
    contactInfo?: string;
    actionLog?: string;
    stateSnapshot?: string;
    clientContext?: FeedbackClientContext;
    errorContext?: FeedbackErrorContext;
    createdAt: string;
}

const EMBEDDED_IMG_RE = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;

export function extractEmbeddedImages(content: string) {
    return Array.from(content.matchAll(EMBEDDED_IMG_RE), (match) => ({
        alt: match[1] || '',
        src: match[2],
    }));
}

export function hasEmbeddedImage(content: string): boolean {
    EMBEDDED_IMG_RE.lastIndex = 0;
    return EMBEDDED_IMG_RE.test(content);
}

export function extractText(content: string, t: TFunction<'admin'>): string {
    return content.replace(EMBEDDED_IMG_RE, '').trim() || t('feedback.content.onlyImage');
}

export function parseOperationLogs(actionLog?: string): unknown[] {
    if (!actionLog?.trim()) return [];
    try {
        const parsed = JSON.parse(actionLog);
        if (Array.isArray(parsed)) return parsed;
        return [parsed];
    } catch {
        return actionLog
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
    }
}

export function parseStateSnapshot(stateSnapshot?: string): unknown | null {
    if (!stateSnapshot?.trim()) return null;
    try {
        return JSON.parse(stateSnapshot);
    } catch {
        return { parseError: true, raw: stateSnapshot };
    }
}

function inferGameId(stateSnapshot: unknown, fallbackGameId?: string, fallbackGameName?: string): string | null {
    if (stateSnapshot && typeof stateSnapshot === 'object' && 'gameId' in stateSnapshot) {
        const gameId = (stateSnapshot as { gameId?: unknown }).gameId;
        if (typeof gameId === 'string' && gameId.trim()) {
            return gameId;
        }
    }
    if (fallbackGameId?.trim()) return fallbackGameId;
    if (fallbackGameName?.trim()) return fallbackGameName;
    return null;
}

function normalizeInlineText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function truncateInlineText(value: string, maxLength = 160): string {
    const normalized = normalizeInlineText(value);
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

function toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function formatInlineValue(value: unknown, depth = 0): string {
    if (value == null) return '';
    if (typeof value === 'string') return truncateInlineText(value, depth === 0 ? 120 : 48);
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
    if (Array.isArray(value)) {
        const items = value
            .slice(0, depth === 0 ? 4 : 2)
            .map((entry) => formatInlineValue(entry, depth + 1))
            .filter(Boolean);
        if (items.length === 0) return `items=${value.length}`;
        const suffix = value.length > items.length ? ` +${value.length - items.length}` : '';
        return `${items.join('/')}${suffix}`;
    }

    const record = toRecord(value);
    if (!record) return '';

    const keys = Object.keys(record);
    const entries = keys
        .filter((key) => record[key] != null)
        .slice(0, depth === 0 ? 4 : 2)
        .map((key) => {
            const formatted = formatInlineValue(record[key], depth + 1);
            return formatted ? `${key}=${formatted}` : '';
        })
        .filter(Boolean);

    if (entries.length === 0) return '';
    const suffix = keys.length > entries.length ? `, +${keys.length - entries.length}` : '';
    return `${entries.join(', ')}${suffix}`;
}

function summarizeClientContext(context: FeedbackClientContext | null | undefined): string | null {
    if (!context) return null;

    const parts = [
        context.route ? `route=${truncateInlineText(context.route, 80)}` : '',
        context.matchId ? `match=${context.matchId}` : '',
        context.playerId ? `player=${context.playerId}` : '',
        context.gameId ? `game=${context.gameId}` : '',
        context.mode ? `mode=${context.mode}` : '',
        context.appVersion ? `app=${context.appVersion}` : '',
        context.viewport ? `viewport=${context.viewport.width}x${context.viewport.height}` : '',
        context.language ? `lang=${context.language}` : '',
        context.timezone ? `tz=${context.timezone}` : '',
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : null;
}

function summarizeErrorContext(context: FeedbackErrorContext | null | undefined): string | null {
    if (!context) return null;

    const parts = [
        context.source ? truncateInlineText(context.source, 48) : '',
        context.name ? truncateInlineText(context.name, 48) : '',
        context.message ? truncateInlineText(context.message, 120) : '',
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' | ') : null;
}

function summarizeOperationLogs(actionLog?: string): string | null {
    const logs = parseOperationLogs(actionLog);
    if (logs.length === 0) return null;

    const preview = logs.slice(0, 4).map((entry, index) => {
        const formatted = formatInlineValue(entry);
        return `${index + 1}.${formatted || 'unknown'}`;
    });
    const suffix = logs.length > preview.length ? `; +${logs.length - preview.length}条` : '';
    return `${preview.join('; ')}${suffix}`;
}

function summarizeStateSnapshot(stateSnapshot: unknown): string | null {
    const snapshot = toRecord(stateSnapshot);
    if (!snapshot) return formatInlineValue(stateSnapshot) || null;

    if (snapshot.parseError === true && typeof snapshot.raw === 'string') {
        return `parseError=${truncateInlineText(snapshot.raw, 120)}`;
    }

    const core = toRecord(snapshot.core);
    const sys = toRecord(snapshot.sys);
    const interaction = toRecord(toRecord(sys?.interaction)?.current);
    const responseWindow = toRecord(toRecord(sys?.responseWindow)?.current);
    const topField = Array.isArray(snapshot.field) ? snapshot.field : null;
    const coreField = Array.isArray(core?.field) ? core.field : null;
    const field = topField ?? coreField;

    const gameId = inferGameId(stateSnapshot)
        ?? (typeof core?.gameId === 'string' ? core.gameId : null);
    const turn = snapshot.turn ?? core?.turn ?? snapshot.round ?? core?.round;
    const currentPlayer = snapshot.currentPlayer ?? core?.currentPlayer;
    const phase = snapshot.phase ?? core?.phase;
    const players = toRecord(snapshot.players) ?? toRecord(core?.players);
    const parts = [
        gameId ? `game=${gameId}` : '',
        turn != null ? `turn=${String(turn)}` : '',
        currentPlayer != null ? `player=${String(currentPlayer)}` : '',
        phase != null ? `phase=${String(phase)}` : '',
        players ? `players=${Object.keys(players).length}` : '',
    ].filter(Boolean);

    if (field) {
        const fieldPreview = field.slice(0, 3).map((entry) => {
            const unit = toRecord(entry);
            if (!unit) return formatInlineValue(entry);
            const card = toRecord(unit.card);
            const unitId = typeof unit.id === 'string'
                ? unit.id
                : typeof card?.defId === 'string'
                    ? card.defId
                    : 'unknown';
            const owner = unit.owner != null ? `@${String(unit.owner)}` : '';
            return `${unitId}${owner}`;
        }).filter(Boolean);
        const suffix = field.length > fieldPreview.length ? ', ...' : '';
        parts.push(`field=${field.length}${fieldPreview.length > 0 ? `(${fieldPreview.join(', ')}${suffix})` : ''}`);
    }

    if (interaction) {
        const interactionType = typeof interaction.type === 'string' ? interaction.type : 'unknown';
        const interactionPlayer = interaction.playerId != null ? `@${String(interaction.playerId)}` : '';
        parts.push(`interaction=${interactionType}${interactionPlayer}`);
    }

    if (responseWindow) {
        const triggerEvent = toRecord(responseWindow.triggerEvent);
        if (typeof triggerEvent?.type === 'string') {
            parts.push(`response=${triggerEvent.type}`);
        }
    }

    if (parts.length > 0) return parts.join(', ');

    const keys = Object.keys(snapshot).slice(0, 8);
    return keys.length > 0 ? `keys=${keys.join(', ')}` : null;
}

export function buildFeedbackAiSummary(item: FeedbackItem, t: TFunction<'admin'>): string {
    const parsedSnapshot = parseStateSnapshot(item.stateSnapshot);
    const inferredGameId = inferGameId(parsedSnapshot, item.clientContext?.gameId, item.gameName);
    const gameLabel = item.gameName && inferredGameId && item.gameName !== inferredGameId
        ? `${item.gameName}(${inferredGameId})`
        : item.gameName ?? inferredGameId;
    const reporter = item.userId?.username || t('feedback.anonymous');
    const clientSummary = summarizeClientContext(item.clientContext);
    const errorSummary = summarizeErrorContext(item.errorContext);
    const operationSummary = summarizeOperationLogs(item.actionLog);
    const stateSummary = summarizeStateSnapshot(parsedSnapshot);

    return [
        `反馈ID=${item._id}`,
        `时间=${formatAbsoluteTime(item.createdAt)}`,
        `类型=${t(`feedback.type.${item.type}`)}/${t(`feedback.severity.${item.severity}`)}/${t(`feedback.status.${item.status}`)}`,
        gameLabel ? `游戏=${gameLabel}` : '',
        `提交人=${reporter}`,
        `内容=${truncateInlineText(extractText(item.content, t), 220)}`,
        clientSummary ? `客户端=${clientSummary}` : '',
        errorSummary ? `错误=${errorSummary}` : '',
        operationSummary ? `操作=${operationSummary}` : '',
        stateSummary ? `状态=${stateSummary}` : '',
    ].filter(Boolean).join(' | ');
}

export function CopyFeedbackButton({
    item,
    t,
    onAiPayloadCopy,
}: {
    item: FeedbackItem;
    t: TFunction<'admin'>;
    onAiPayloadCopy: (payloadText: string) => void;
}) {
    const [copied, setCopied] = useState(false);
    const [copiedJson, setCopiedJson] = useState(false);

    const handleCopy = (event: React.MouseEvent) => {
        event.stopPropagation();
        const payloadText = buildFeedbackAiSummary(item, t);
        navigator.clipboard.writeText(payloadText).then(() => {
            onAiPayloadCopy(payloadText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => undefined);
    };

    const handleCopyJson = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (!item.stateSnapshot) return;

        navigator.clipboard.writeText(item.stateSnapshot).then(() => {
            setCopiedJson(true);
            setTimeout(() => setCopiedJson(false), 2000);
        }).catch(() => undefined);
    };

    return (
        <div className="inline-flex items-center gap-1" data-testid="feedback-copy-actions" data-feedback-id={item._id}>
            <button
                type="button"
                data-testid="feedback-copy-ai-payload"
                onClick={handleCopy}
                className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                    copied
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800'
                )}
                title={t('feedback.actions.copyAll')}
            >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? t('feedback.actions.copied') : t('feedback.actions.copyAll')}
            </button>
            {item.stateSnapshot && (
                <button
                    type="button"
                    data-testid="feedback-copy-state-json"
                    onClick={handleCopyJson}
                    className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                        copiedJson
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800'
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

export function FeedbackContent({
    content,
    onImageClick,
    t,
}: {
    content: string;
    onImageClick: (src: string) => void;
    t: TFunction<'admin'>;
}) {
    const images = extractEmbeddedImages(content);
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    images.forEach((image) => {
        const token = `![${image.alt}](${image.src})`;
        const matchIndex = content.indexOf(token, lastIndex);

        if (matchIndex > lastIndex) {
            const text = content.slice(lastIndex, matchIndex).trim();
            if (text) {
                parts.push(
                    <p key={key++} className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                        {text}
                    </p>
                );
            }
        }

        parts.push(
            <button
                key={key++}
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onImageClick(image.src);
                }}
                className="block text-left"
            >
                <img
                    src={image.src}
                    alt={image.alt || t('feedback.content.screenshotAlt')}
                    className="max-h-72 max-w-full rounded-xl border border-zinc-200 bg-white object-contain transition-shadow hover:shadow-md"
                />
            </button>
        );

        lastIndex = matchIndex + token.length;
    });

    const remaining = content.slice(lastIndex).trim();
    if (remaining) {
        parts.push(
            <p key={key++} className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                {remaining}
            </p>
        );
    }

    if (parts.length === 0) {
        return <p className="text-sm italic text-zinc-400">{t('feedback.content.empty')}</p>;
    }

    return <div className="space-y-3">{parts}</div>;
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
