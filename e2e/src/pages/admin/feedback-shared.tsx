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

function measureTextBlock(value?: string | null): { chars: number; lines: number } | null {
    if (!value?.trim()) return null;
    const normalized = value.replace(/\r\n/g, '\n');
    return {
        chars: normalized.length,
        lines: normalized.split('\n').length,
    };
}

function prettyPrintJson(raw?: string | null): string | null {
    if (!raw?.trim()) return null;
    try {
        return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
        return raw.trim();
    }
}

function buildClientContextLines(context: FeedbackClientContext | null | undefined): string[] {
    if (!context) return ['- 未附带客户端上下文'];

    return [
        `- route: ${context.route || '-'}`,
        `- mode: ${context.mode || '-'}`,
        `- matchId: ${context.matchId || '-'}`,
        `- playerId: ${context.playerId || '-'}`,
        `- gameId: ${context.gameId || '-'}`,
        `- appVersion: ${context.appVersion || '-'}`,
        `- language: ${context.language || '-'}`,
        `- timezone: ${context.timezone || '-'}`,
        `- viewport: ${context.viewport ? `${context.viewport.width}x${context.viewport.height}` : '-'}`,
        `- userAgent: ${context.userAgent || '-'}`,
    ];
}

function buildErrorContextLines(context: FeedbackErrorContext | null | undefined): string[] {
    if (!context) return ['- 未附带错误上下文'];

    return [
        `- source: ${context.source || '-'}`,
        `- name: ${context.name || '-'}`,
        `- message: ${context.message || '-'}`,
    ];
}

export function buildFeedbackAiDiagnosticPacket(item: FeedbackItem, t: TFunction<'admin'>): string {
    const parsedSnapshot = parseStateSnapshot(item.stateSnapshot);
    const inferredGameId = inferGameId(parsedSnapshot, item.clientContext?.gameId, item.gameName);
    const gameLabel = item.gameName && inferredGameId && item.gameName !== inferredGameId
        ? `${item.gameName}(${inferredGameId})`
        : item.gameName ?? inferredGameId;
    const reporter = item.userId?.username || t('feedback.anonymous');
    const screenshots = extractEmbeddedImages(item.content);
    const operationSummary = summarizeOperationLogs(item.actionLog);
    const stateSummary = summarizeStateSnapshot(parsedSnapshot);
    const actionLogMetrics = measureTextBlock(item.actionLog);
    const stateSnapshotMetrics = measureTextBlock(item.stateSnapshot);
    const prettyActionLog = prettyPrintJson(item.actionLog);
    const prettyStateSnapshot = prettyPrintJson(item.stateSnapshot);
    const errorStack = item.errorContext?.stack?.trim() || null;
    const contentText = extractText(item.content, t);

    return [
        '# AI 排障诊断包',
        '',
        '请基于下面的完整证据链定位问题。输出时优先给出：问题复述、最可疑模块或状态字段、验证步骤、如果证据不足还缺什么。',
        '',
        '## 1. 工单信息',
        `- 反馈ID: ${item._id}`,
        `- 时间: ${formatAbsoluteTime(item.createdAt)}`,
        `- 类型: ${t(`feedback.type.${item.type}`)}`,
        `- 严重度: ${t(`feedback.severity.${item.severity}`)}`,
        `- 状态: ${t(`feedback.status.${item.status}`)}`,
        gameLabel ? `- 游戏: ${gameLabel}` : '',
        `- 提交人: ${reporter}`,
        item.contactInfo ? `- 联系方式: ${item.contactInfo}` : '',
        '',
        '## 2. 用户反馈原文',
        contentText,
        '',
        '## 3. 证据索引',
        `- 内嵌截图: ${screenshots.length} 张`,
        ...screenshots.map((image, index) => `- 截图${index + 1}: ${image.alt || '未命名截图'}`),
        screenshots.length > 0
            ? '- 说明: 为避免把 base64 图片正文污染对话上下文，复制文本只保留截图索引，原图请回后台反馈详情查看。'
            : '',
        `- 操作日志: ${actionLogMetrics ? `${actionLogMetrics.lines} 行 / ${actionLogMetrics.chars} 字符` : '未附带'}`,
        `- 状态快照: ${stateSnapshotMetrics ? `${stateSnapshotMetrics.lines} 行 / ${stateSnapshotMetrics.chars} 字符` : '未附带'}`,
        stateSummary ? `- 状态摘要: ${stateSummary}` : '',
        errorStack ? `- 错误堆栈: ${measureTextBlock(errorStack)?.lines ?? 0} 行` : '- 错误堆栈: 未附带',
        '',
        '## 4. 客户端上下文',
        ...buildClientContextLines(item.clientContext),
        '',
        '## 5. 错误上下文',
        ...buildErrorContextLines(item.errorContext),
        ...(errorStack
            ? [
                '',
                '### 错误堆栈',
                '```text',
                errorStack,
                '```',
            ]
            : []),
        ...(operationSummary
            ? [
                '',
                '## 6. 操作日志摘要',
                operationSummary,
            ]
            : []),
        ...(prettyActionLog
            ? [
                '',
                '## 7. 操作日志原文',
                '```json',
                prettyActionLog,
                '```',
            ]
            : []),
        ...(stateSummary
            ? [
                '',
                '## 8. 状态快照摘要',
                stateSummary,
            ]
            : []),
        ...(prettyStateSnapshot
            ? [
                '',
                '## 9. 状态快照原文',
                '```json',
                prettyStateSnapshot,
                '```',
            ]
            : []),
    ].filter(Boolean).join('\n');
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
        const payloadText = buildFeedbackAiDiagnosticPacket(item, t);
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
