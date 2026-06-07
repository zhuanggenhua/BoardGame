import { useState } from 'react';
import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { Check, Copy } from 'lucide-react';
import type { FeedbackClientContext, FeedbackElementSummary, FeedbackErrorContext } from '../../../lib/feedback/feedbackPayload';
import { cn } from '../../../lib/utils';

interface FeedbackItemLike {
    _id: string;
    userId?: {
        _id: string;
        username: string;
        avatar?: string;
        email?: string;
    };
    content: string;
    type: 'bug' | 'suggestion' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    closedReason?: string | null;
    reporterType?: 'user' | 'system';
    source?: string;
    autoReportKind?: string;
    incidentKey?: string;
    latestIncidentKey?: string;
    occurrenceCount?: number;
    firstOccurredAt?: string;
    lastOccurredAt?: string;
    gameName?: string;
    contactInfo?: string;
    actionLog?: string;
    stateSnapshot?: string;
    rewardPoints?: number;
    clientContext?: FeedbackClientContext;
    errorContext?: FeedbackErrorContext;
    createdAt: string;
}

const EMBEDDED_IMG_RE = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;

function createEmbeddedImageRegExp(): RegExp {
    return new RegExp(EMBEDDED_IMG_RE.source, EMBEDDED_IMG_RE.flags);
}

function extractEmbeddedImages(content: string) {
    return Array.from(content.matchAll(EMBEDDED_IMG_RE), (match) => ({
        alt: match[1] || '',
        src: match[2],
    }));
}

function parseOperationLogs(actionLog?: string): unknown[] {
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

function parseStateSnapshot(stateSnapshot?: string): unknown | null {
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
    return `${normalized.slice(0, Math.max(0, maxLength - 1))}...`;
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

function toStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function extractFactionStateSummary(stateSnapshot: unknown): string | null {
    const snapshot = toRecord(stateSnapshot);
    if (!snapshot) return null;

    const core = toRecord(snapshot.core) ?? snapshot;
    const selectedFactions = toRecord(core.selectedFactions) ?? toRecord(snapshot.selectedFactions);
    const factionSelection = toRecord(core.factionSelection) ?? toRecord(snapshot.factionSelection);
    const takenFactions = toStringList(factionSelection?.takenFactions);
    const playerSelections = toRecord(factionSelection?.playerSelections);

    const selectedParts = selectedFactions
        ? Object.entries(selectedFactions)
            .map(([playerId, factionId]) => {
                if (typeof factionId !== 'string' || !factionId.trim()) return '';
                return `${playerId}=${factionId.trim()}`;
            })
            .filter(Boolean)
        : [];

    const draftParts = playerSelections
        ? Object.entries(playerSelections)
            .map(([playerId, picks]) => {
                const normalizedPicks = toStringList(picks);
                if (normalizedPicks.length === 0) return '';
                return `${playerId}=${normalizedPicks.join('/')}`;
            })
            .filter(Boolean)
        : [];

    const parts = [
        selectedParts.length > 0 ? `已选玩家 ${selectedParts.join(', ')}` : '',
        draftParts.length > 0 ? `选秀记录 ${draftParts.join(', ')}` : '',
        takenFactions.length > 0 ? `已占用 ${takenFactions.join(', ')}` : '',
    ].filter(Boolean);

    return parts.length > 0 ? parts.join('; ') : null;
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
    const factionSummary = extractFactionStateSummary(stateSnapshot);
    const parts = [
        gameId ? `game=${gameId}` : '',
        turn != null ? `turn=${String(turn)}` : '',
        currentPlayer != null ? `player=${String(currentPlayer)}` : '',
        phase != null ? `phase=${String(phase)}` : '',
        players ? `players=${Object.keys(players).length}` : '',
        factionSummary ? `factions=${factionSummary}` : '',
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

function formatElementSummary(element?: FeedbackElementSummary): string {
    if (!element) return '-';

    const head = [
        element.tagName || '',
        element.type ? `[type=${element.type}]` : '',
        element.role ? `[role=${element.role}]` : '',
        element.testId ? `[testid=${element.testId}]` : '',
        element.id ? `#${element.id}` : '',
        element.name ? `[name=${element.name}]` : '',
    ].filter(Boolean).join('');
    const tail = [element.ariaLabel ? `label=${element.ariaLabel}` : '', element.text ? `text=${element.text}` : '']
        .filter(Boolean)
        .join(', ');

    return tail ? `${head || '-'} (${tail})` : head || '-';
}

function formatLastUserAction(context: FeedbackClientContext): string {
    const action = context.lastUserAction;
    if (!action) return '-';
    const parts = [
        action.type,
        action.key ? `key=${action.key}` : '',
        action.at ? `at=${action.at}` : '',
        action.target ? `target=${formatElementSummary(action.target)}` : '',
    ].filter(Boolean);
    return parts.join(', ');
}

function formatRouteChange(context: FeedbackClientContext): string {
    const routeChange = context.lastRouteChange;
    if (!routeChange) return '-';
    const from = routeChange.from || '-';
    return `${from} -> ${routeChange.to} (${routeChange.trigger} @ ${routeChange.at})`;
}

function formatPageFlags(context: FeedbackClientContext): string {
    const flags = context.pageFlags;
    if (!flags) return '-';
    const parts = [
        flags.isGamePage ? 'game-page' : '',
        flags.hasModalOpen ? 'modal-open' : '',
        flags.gameId ? `game=${flags.gameId}` : '',
        flags.homeStyle ? `homeStyle=${flags.homeStyle}` : '',
        flags.mobileLayoutPreset ? `layout=${flags.mobileLayoutPreset}` : '',
        flags.mobileProfile ? `profile=${flags.mobileProfile}` : '',
    ].filter(Boolean);
    return parts.join(', ') || '-';
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
        `- activeElement: ${formatElementSummary(context.activeElement)}`,
        `- lastUserAction: ${formatLastUserAction(context)}`,
        `- lastRouteChange: ${formatRouteChange(context)}`,
        `- pageFlags: ${formatPageFlags(context)}`,
        `- userAgent: ${context.userAgent || '-'}`,
    ];
}

function buildErrorContextLines(context: FeedbackErrorContext | null | undefined): string[] {
    if (!context) return ['- 未附带错误上下文'];

    return [
        `- source: ${context.source || '-'}`,
        `- name: ${context.name || '-'}`,
        `- message: ${context.message || '-'}`,
        `- jsStack: ${measureTextBlock(context.jsStack || context.stack) ? `${measureTextBlock(context.jsStack || context.stack)?.lines ?? 0} 行` : '-'}`,
        `- componentStack: ${measureTextBlock(context.componentStack) ? `${measureTextBlock(context.componentStack)?.lines ?? 0} 行` : '-'}`,
    ];
}

export function extractText(content: string, t: TFunction<'admin'>): string {
    return content.replace(EMBEDDED_IMG_RE, '').trim() || t('feedback.content.onlyImage');
}

export function hasEmbeddedImage(content: string): boolean {
    return createEmbeddedImageRegExp().test(content);
}

export function buildFeedbackAiDiagnosticPacket(item: FeedbackItemLike, t: TFunction<'admin'>): string {
    const parsedSnapshot = parseStateSnapshot(item.stateSnapshot);
    const inferredGameId = inferGameId(parsedSnapshot, item.clientContext?.gameId, item.gameName);
    const gameLabel = item.gameName && inferredGameId && item.gameName !== inferredGameId
        ? `${item.gameName}(${inferredGameId})`
        : item.gameName ?? inferredGameId;
    const reporter = item.userId?.username || t('feedback.anonymous');
    const screenshots = extractEmbeddedImages(item.content);
    const operationSummary = summarizeOperationLogs(item.actionLog);
    const stateSummary = summarizeStateSnapshot(parsedSnapshot);
    const factionSummary = extractFactionStateSummary(parsedSnapshot);
    const actionLogMetrics = measureTextBlock(item.actionLog);
    const stateSnapshotMetrics = measureTextBlock(item.stateSnapshot);
    const prettyActionLog = prettyPrintJson(item.actionLog);
    const prettyStateSnapshot = prettyPrintJson(item.stateSnapshot);
    const errorStack = item.errorContext?.stack?.trim() || null;
    const jsStack = item.errorContext?.jsStack?.trim() || null;
    const componentStack = item.errorContext?.componentStack?.trim() || null;
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
        item.closedReason ? `- 关闭理由: ${item.closedReason}` : '',
        gameLabel ? `- 游戏: ${gameLabel}` : '',
        `- 提交人: ${reporter}`,
        item.contactInfo ? `- 联系方式: ${item.contactInfo}` : '',
        typeof item.rewardPoints === 'number' && item.rewardPoints > 0 ? `- 奖励积分: +${item.rewardPoints}` : '',
        typeof item.occurrenceCount === 'number' ? `- 聚合次数: ${item.occurrenceCount}` : '',
        item.firstOccurredAt ? `- 首次出现: ${formatAbsoluteTime(item.firstOccurredAt)}` : '',
        item.lastOccurredAt ? `- 最近出现: ${formatAbsoluteTime(item.lastOccurredAt)}` : '',
        item.latestIncidentKey ? `- 最新 Incident: ${item.latestIncidentKey}` : '',
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
        factionSummary ? `- 派系摘要: ${factionSummary}` : '',
        jsStack
            ? `- JS 堆栈: ${measureTextBlock(jsStack)?.lines ?? 0} 行`
            : errorStack
                ? `- 错误堆栈: ${measureTextBlock(errorStack)?.lines ?? 0} 行`
                : '- 错误堆栈: 未附带',
        componentStack ? `- 组件栈: ${measureTextBlock(componentStack)?.lines ?? 0} 行` : '',
        '',
        '## 4. 客户端上下文',
        ...buildClientContextLines(item.clientContext),
        '',
        '## 5. 错误上下文',
        ...buildErrorContextLines(item.errorContext),
        ...((jsStack || (!jsStack && errorStack))
            ? [
                '',
                jsStack ? '### JS 堆栈' : '### 错误堆栈',
                '```text',
                jsStack || errorStack || '',
                '```',
            ]
            : []),
        ...(componentStack
            ? [
                '',
                '### React 组件栈',
                '```text',
                componentStack,
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

export function CopyFeedbackButton({
    item,
    t,
    onAiPayloadCopy,
}: {
    item: FeedbackItemLike;
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
