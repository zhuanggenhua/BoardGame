import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { PipelineStage } from 'mongoose';
import { normalizeDeveloperGameIds } from '../auth/schemas/developer-game-access';
import { User, type UserDocument } from '../auth/schemas/user.schema';
import type { UserRole } from '../auth/schemas/user-role';
import { Feedback, FeedbackDocument, FeedbackReporterType, FeedbackStatus } from './feedback.schema';
import { CreateFeedbackDto, CreateSystemFeedbackDto, FeedbackFilterDto, QueryFeedbackDto, UpdateFeedbackStatusDto } from './dto';

type FeedbackManagerScope = {
    actorUserId: string;
    actorUserObjectId: Types.ObjectId | null;
    role: UserRole;
    developerGameIds: string[] | null;
};

const DEFAULT_USER_SOURCE = 'feedback-modal';
const CONFIG_REVIEW_SOURCE = 'config-review';
const PUBLIC_AUTO_FEEDBACK_SOURCES = new Set([
    'client-auto-report',
    'client-runtime-guard',
    'client-window-error',
    'client-unhandled-rejection',
    'react-error-boundary',
    'board-render-error',
    'home-modal-error-boundary',
]);
const PUBLIC_AUTO_FEEDBACK_SOURCE_LIST = Array.from(PUBLIC_AUTO_FEEDBACK_SOURCES);
const ALLOWED_USER_SOURCES = new Set([
    DEFAULT_USER_SOURCE,
    CONFIG_REVIEW_SOURCE,
    ...PUBLIC_AUTO_FEEDBACK_SOURCE_LIST,
]);
const LEGACY_WATCHDOG_SOURCE = 'online-ai-watchdog';
const WATCHDOG_AGGREGATION_SOURCE = 'online-ai-watchdog';
const INFRA_CPU_WATCH_SOURCE = 'infra-cpu-watch';
const SYSTEM_AGGREGATION_SOURCES = new Set([
    WATCHDOG_AGGREGATION_SOURCE,
    INFRA_CPU_WATCH_SOURCE,
]);
export const WATCHDOG_AGGREGATION_WINDOW_MS = 6 * 60 * 60 * 1000;
export const WATCHDOG_RECENT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
export const WATCHDOG_MAX_RECENT_RECORDS = 100;
export const FEEDBACK_REWARD_POINTS = 1;
const FEEDBACK_SUMMARY_PREVIEW_SOURCE_LENGTH = 360;
const FEEDBACK_SUMMARY_PREVIEW_LENGTH = 180;

const FEEDBACK_SEVERITY_RANK: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
};

type WatchdogAggregationPlan = {
    dedupeKey: string;
    windowStartedAt: Date;
    windowMs: number;
    retentionPolicy: 'windowed-counter-aggregate';
};

type WatchdogSnapshotRecord = Record<string, unknown>;
type FeedbackListRecord = Feedback & {
    contentPreviewSource?: string;
    contentPreview?: string;
    hasEmbeddedImage?: boolean;
    hasActionLog?: boolean;
    hasStateSnapshot?: boolean;
    hasClientContext?: boolean;
    hasErrorContext?: boolean;
};

@Injectable()
export class FeedbackService {
    private readonly watchdogAggregationLocks = new Map<string, Promise<Feedback>>();

    constructor(
        @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) { }

    async create(userId: string | null, dto: CreateFeedbackDto): Promise<Feedback> {
        const source = this.normalizeUserSource(dto.source);
        const rewardPoints = userId ? FEEDBACK_REWARD_POINTS : 0;
        const created = await this.feedbackModel.create({
            ...dto,
            gameId: this.normalizeFeedbackGameIdCandidates(
                dto.clientContext?.gameId,
                dto.gameName,
                dto.configProposal?.gameId,
                dto.configProposals?.[0]?.gameId,
            ),
            reporterType: this.resolvePublicReporterType(source),
            source,
            rewardPoints,
            ...(userId && { userId }),
        });
        if (userId && rewardPoints > 0) {
            await this.userModel.updateOne(
                { _id: userId },
                { $inc: { feedbackPoints: rewardPoints } },
            ).exec();
        }
        return created;
    }

    async createSystem(dto: CreateSystemFeedbackDto): Promise<Feedback> {
        const source = this.normalizeSource(dto.source, 'unknown');
        const gameId = this.normalizeFeedbackGameIdCandidates(dto.clientContext?.gameId, dto.gameName);
        const resolvedMethod = this.resolveSystemFeedbackResolvedMethod(dto);
        if (this.shouldAggregateSystemFeedback(dto, source, gameId)) {
            return this.createOrUpdateAggregatedSystemFeedback(dto, source, gameId);
        }
        return this.feedbackModel.create({
            ...dto,
            source,
            reporterType: FeedbackReporterType.SYSTEM,
            gameId,
            ...(resolvedMethod ? { resolvedMethod } : {}),
        });
    }

    async findAll(actorUserId: string | null, query: QueryFeedbackDto) {
        const manager = actorUserId ? await this.assertActorCanManage(actorUserId) : null;
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
        const { status, type, severity, sort, reporterType, source, preferMine, mineOnly, summaryOnly } = query;
        if (mineOnly && !manager) {
            return {
                items: [],
                total: 0,
                page,
                limit,
            };
        }
        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        if (type) filter.type = type;
        if (severity) filter.severity = severity;
        if (mineOnly && manager) {
            Object.assign(filter, this.buildOwnFeedbackFilter(manager));
        }
        const originFilter = this.buildOriginFilter(reporterType, source);
        if (originFilter) {
            filter.$and = filter.$and ? [...(filter.$and as Record<string, unknown>[]), originFilter] : [originFilter];
        }
        const createdAtSort = sort === 'oldest' ? 1 : -1;

        const total = await this.feedbackModel.countDocuments(filter);
        const skip = (page - 1) * limit;
        let items: Array<FeedbackDocument | FeedbackListRecord> = [];
        const shouldPreferMine = Boolean(manager?.actorUserObjectId && preferMine);

        if (manager?.actorUserObjectId || summaryOnly) {
            const addMineFieldStage: PipelineStage[] = manager?.actorUserObjectId
                ? [{
                    $addFields: {
                        __isMine: {
                            $cond: [{ $eq: [{ $toString: '$userId' }, manager.actorUserId] }, 1, 0],
                        },
                    },
                }]
                : [];
            const summaryProjectionStage: PipelineStage[] = summaryOnly ? [{ $project: this.buildSummaryProjection() }] : [];
            const aggregatedItems = await this.feedbackModel.aggregate<Array<FeedbackListRecord & { __isMine?: number }>>([
                { $match: filter },
                ...addMineFieldStage,
                {
                    $sort: {
                        ...(shouldPreferMine ? { __isMine: -1 } : {}),
                        createdAt: createdAtSort,
                    },
                },
                { $skip: skip },
                { $limit: limit },
                ...summaryProjectionStage,
            ]).exec();

            const populated = await this.feedbackModel.populate(
                aggregatedItems,
                { path: 'userId', select: 'username avatar email' },
            ) as Array<FeedbackListRecord & { __isMine?: number }>;
            items = populated.map((item) => {
                const { __isMine: _unusedIsMine, ...rest } = item;
                return rest as FeedbackListRecord;
            });
        } else {
            items = await this.feedbackModel
                .find(filter)
                .sort({ createdAt: createdAtSort })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'username avatar email')
                .exec();
        }

        return {
            items: items.map((item) => this.formatListItem(item, manager, Boolean(summaryOnly))),
            total,
            page,
            limit,
        };
    }

    async findOne(actorUserId: string | null, id: string): Promise<(Feedback & { canManage: boolean }) | null> {
        if (!Types.ObjectId.isValid(id)) {
            return null;
        }
        const manager = actorUserId ? await this.assertActorCanManage(actorUserId) : null;
        const item = await this.feedbackModel
            .findById(id)
            .populate('userId', 'username avatar email')
            .exec();
        if (!item) {
            return null;
        }
        const decorated = this.decorateLegacyOrigin(item);
        return {
            ...decorated,
            canManage: manager ? this.canActorManageFeedbackItem(manager, decorated) : false,
        };
    }

    async updateStatus(actorUserId: string, id: string, dto: UpdateFeedbackStatusDto): Promise<Feedback | null> {
        const manager = await this.assertActorCanManage(actorUserId);
        const scopeFilter = this.buildMutationScopeFilter(manager);
        const status = dto.status;
        if (status === FeedbackStatus.CLOSED) {
            const current = await this.feedbackModel.findOne({ _id: id, ...scopeFilter }).select({
                _id: 1,
                source: 1,
                reporterType: 1,
                contactInfo: 1,
                errorContext: 1,
                content: 1,
            }).lean<{
                _id: unknown;
                source?: string;
                reporterType?: FeedbackReporterType;
                contactInfo?: string | null;
                errorContext?: { source?: string | null } | null;
                content?: string;
            } | null>();
            if (!current) {
                return null;
            }
            const closedReason = this.normalizeClosedReason(dto.closedReason);
            if (!this.isAutomaticFeedbackLike(current) && !closedReason) {
                throw new BadRequestException('关闭理由不能为空');
            }
            return this.feedbackModel.findOneAndUpdate(
                { _id: id, ...scopeFilter },
                {
                    $set: {
                        status,
                        ...(closedReason ? { closedReason } : {}),
                    },
                    $unset: {
                        aggregationActiveKey: '',
                        resolvedMethod: '',
                        ...(closedReason ? {} : { closedReason: '' }),
                    },
                },
                { new: true },
            );
        }
        const current = await this.feedbackModel.findOne({ _id: id, ...scopeFilter }).select({
            _id: 1,
            source: 1,
            reporterType: 1,
            aggregationKey: 1,
        }).lean<{
            _id: unknown;
            source?: string;
            reporterType?: FeedbackReporterType;
            aggregationKey?: string;
        } | null>();
        if (!current) {
            return null;
        }
        const resolvedMethod = this.normalizeResolvedMethod(dto.resolvedMethod);
        if (status === FeedbackStatus.RESOLVED && !resolvedMethod) {
            throw new BadRequestException('解决方式不能为空');
        }
        const shouldRestoreAggregationActiveKey = Boolean(
            current.aggregationKey
            && (current.source === WATCHDOG_AGGREGATION_SOURCE || current.reporterType === FeedbackReporterType.SYSTEM),
        );
        if (shouldRestoreAggregationActiveKey) {
            const conflictingActive = await this.feedbackModel.findOne({
                ...scopeFilter,
                _id: { $ne: id },
                aggregationActiveKey: current.aggregationKey,
                status: { $in: [FeedbackStatus.OPEN, FeedbackStatus.IN_PROGRESS, FeedbackStatus.RESOLVED] },
            }).select({ _id: 1 }).lean();
            if (conflictingActive) {
                throw new ConflictException('同一聚合键已存在活跃反馈，不能直接重新打开归档记录');
            }
        }
        const updatePayload: Record<string, unknown> = shouldRestoreAggregationActiveKey
            ? {
                $set: {
                    status,
                    aggregationActiveKey: current.aggregationKey,
                    ...(status === FeedbackStatus.RESOLVED && resolvedMethod ? { resolvedMethod } : {}),
                },
                $unset: {
                    closedReason: '',
                    ...(status === FeedbackStatus.RESOLVED ? {} : { resolvedMethod: '' }),
                },
            }
            : {
                $set: {
                    status,
                    ...(status === FeedbackStatus.RESOLVED && resolvedMethod ? { resolvedMethod } : {}),
                },
                $unset: {
                    closedReason: '',
                    ...(status === FeedbackStatus.RESOLVED ? {} : { resolvedMethod: '' }),
                },
            };
        try {
            return await this.feedbackModel.findOneAndUpdate(
                { _id: id, ...scopeFilter },
                updatePayload,
                { new: true },
            );
        } catch (error) {
            if (shouldRestoreAggregationActiveKey && this.isDuplicateKeyError(error)) {
                throw new ConflictException('同一聚合键已存在活跃反馈，不能直接重新打开归档记录');
            }
            throw error;
        }
    }

    async deleteOne(actorUserId: string, id: string): Promise<boolean> {
        const manager = await this.assertActorCanManage(actorUserId);
        const scopeFilter = this.buildMutationScopeFilter(manager);
        const result = await this.feedbackModel.deleteOne({ _id: id, ...scopeFilter });
        return (result.deletedCount ?? 0) > 0;
    }

    async bulkDeleteByIds(actorUserId: string, ids: string[]) {
        const manager = await this.assertActorCanManage(actorUserId);
        const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
        if (!uniqueIds.length) {
            return { requested: 0, deleted: 0 };
        }
        const scopeFilter = this.buildMutationScopeFilter(manager);
        const result = await this.feedbackModel.deleteMany({ _id: { $in: uniqueIds }, ...scopeFilter });
        return { requested: uniqueIds.length, deleted: result.deletedCount ?? 0 };
    }

    async bulkDeleteByFilter(actorUserId: string, filterDto: FeedbackFilterDto) {
        const manager = await this.assertActorCanManage(actorUserId);
        const filter = this.buildMutationScopeFilter(manager);
        if (filterDto.status) filter.status = filterDto.status;
        if (filterDto.type) filter.type = filterDto.type;
        if (filterDto.severity) filter.severity = filterDto.severity;
        const originFilter = this.buildOriginFilter(filterDto.reporterType, filterDto.source);
        if (originFilter) {
            filter.$and = filter.$and ? [...(filter.$and as Record<string, unknown>[]), originFilter] : [originFilter];
        }
        const total = await this.feedbackModel.countDocuments(filter);
        if (total === 0) {
            return { requested: 0, deleted: 0 };
        }
        const result = await this.feedbackModel.deleteMany(filter);
        return { requested: total, deleted: result.deletedCount ?? 0 };
    }

    private normalizeFeedbackGameId(value?: string | null): string | undefined {
        if (typeof value !== 'string') {
            return undefined;
        }
        const normalized = value.trim().toLowerCase();
        return normalized || undefined;
    }

    private normalizeFeedbackGameIdCandidates(...values: Array<string | null | undefined>): string | undefined {
        for (const value of values) {
            const normalized = this.normalizeFeedbackGameId(value);
            if (normalized) {
                return normalized;
            }
        }
        return undefined;
    }

    private normalizeSource(value?: string | null, fallback = DEFAULT_USER_SOURCE): string {
        if (typeof value !== 'string') {
            return fallback;
        }
        const normalized = value.trim().toLowerCase();
        return normalized || fallback;
    }

    private normalizeUserSource(value?: string | null): string {
        const normalized = this.normalizeSource(value, DEFAULT_USER_SOURCE);
        if (ALLOWED_USER_SOURCES.has(normalized)) {
            return normalized;
        }
        return DEFAULT_USER_SOURCE;
    }

    private normalizeClosedReason(value?: string | null): string | undefined {
        if (typeof value !== 'string') {
            return undefined;
        }
        const normalized = value.trim();
        return normalized || undefined;
    }

    private normalizeResolvedMethod(value?: string | null): string | undefined {
        if (typeof value !== 'string') {
            return undefined;
        }
        const normalized = value.trim();
        return normalized || undefined;
    }

    private resolveSystemFeedbackResolvedMethod(dto: CreateSystemFeedbackDto): string | undefined {
        if (dto.status !== FeedbackStatus.RESOLVED) {
            return undefined;
        }
        return this.normalizeResolvedMethod(dto.resolvedMethod)
            ?? this.buildDefaultSystemResolvedMethod(dto);
    }

    private buildDefaultSystemResolvedMethod(dto: CreateSystemFeedbackDto): string {
        const incidentKind = this.normalizeWatchdogAutoReportFamily(
            dto.autoReportKind ?? dto.errorContext?.name,
        );
        if (incidentKind === 'legal-action-recovered') {
            return '系统已自动找到可执行操作并继续推进该 AI 座位，对局没有停在该步骤。';
        }
        if (incidentKind === 'force-end-turn') {
            return '系统已自动推进停滞的 AI 座位，让对局继续进行。';
        }
        return '系统已自动恢复这次在线 AI 步骤，对局已继续运行。';
    }

    private isPublicAutoFeedbackSource(source?: string | null): boolean {
        return Boolean(source && PUBLIC_AUTO_FEEDBACK_SOURCES.has(source));
    }

    private resolvePublicReporterType(source: string): FeedbackReporterType {
        return this.isPublicAutoFeedbackSource(source)
            ? FeedbackReporterType.SYSTEM
            : FeedbackReporterType.USER;
    }

    private isAutomaticFeedbackLike(feedback: {
        reporterType?: FeedbackReporterType;
        source?: string | null;
        contactInfo?: string | null;
        errorContext?: { source?: string | null } | null;
        content?: string | null;
    }): boolean {
        if (feedback.reporterType === FeedbackReporterType.SYSTEM) {
            return true;
        }
        const source = this.normalizeSource(feedback.source ?? undefined, '');
        if (source === WATCHDOG_AGGREGATION_SOURCE || this.isPublicAutoFeedbackSource(source)) {
            return true;
        }
        return feedback.contactInfo === 'system:online-ai-watchdog'
            || feedback.errorContext?.source === LEGACY_WATCHDOG_SOURCE
            || /^\[system\]\[online-ai-watchdog\]\s+/.test(feedback.content ?? '');
    }

    private shouldAggregateSystemFeedback(
        dto: CreateSystemFeedbackDto,
        source: string,
        gameId?: string,
    ): boolean {
        if (!SYSTEM_AGGREGATION_SOURCES.has(source)) {
            return false;
        }
        return Boolean(gameId && (dto.autoReportKind || dto.errorContext?.name));
    }

    private buildWatchdogAggregationPlan(
        dto: CreateSystemFeedbackDto,
        source: string,
        gameId?: string,
        now = new Date(),
    ): WatchdogAggregationPlan | null {
        if (!gameId) {
            return null;
        }
        const autoReportFamily = this.normalizeWatchdogAutoReportFamily(
            dto.autoReportKind ?? dto.errorContext?.name,
        );
        const normalizedReason = this.normalizeWatchdogReason(
            dto,
            autoReportFamily,
        );
        const normalizedRoute = this.normalizeAggregationSegment(dto.clientContext?.route, 'unknown-route');
        const normalizedMode = this.normalizeAggregationSegment(dto.clientContext?.mode, 'unknown-mode');
        const dedupeKey = [
            'system-feedback',
            source,
            gameId,
            normalizedRoute,
            normalizedMode,
            autoReportFamily,
            normalizedReason || 'unknown',
        ].join(':');
        return {
            dedupeKey,
            windowStartedAt: new Date(now.getTime() - WATCHDOG_AGGREGATION_WINDOW_MS),
            windowMs: WATCHDOG_AGGREGATION_WINDOW_MS,
            retentionPolicy: 'windowed-counter-aggregate',
        };
    }

    private normalizeAggregationSegment(value: string | null | undefined, fallback: string): string {
        if (typeof value !== 'string') {
            return fallback;
        }
        const normalized = value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9:_-]/g, '');
        return normalized || fallback;
    }

    private normalizeWatchdogAutoReportFamily(value?: string | null): string {
        const normalized = typeof value === 'string'
            ? value.trim().toLowerCase()
            : '';
        if (!normalized) {
            return 'unknown';
        }
        if (normalized.startsWith('force-end-turn-')) {
            return 'force-end-turn';
        }
        return normalized;
    }

    private normalizeWatchdogReason(
        dto: CreateSystemFeedbackDto,
        autoReportFamily: string,
    ): string {
        const value = dto.errorContext?.message
            ?? dto.content.replace(/^\[system\]\[[^\]]+\]\s+/i, '');
        if (typeof value !== 'string') {
            return 'unknown';
        }
        const normalized = value
            .trim()
            .toLowerCase()
            .replace(/:steps=\d+\b/g, ':steps')
            .replace(/\s+/g, ' ')
            || 'unknown';
        if (['unsatisfiable-interaction-auto-skipped', 'force-end-turn', 'legal-action-recovered'].includes(autoReportFamily)) {
            const fingerprint = this.buildWatchdogAggregationFingerprint(autoReportFamily, dto.stateSnapshot);
            if (fingerprint) {
                return `${normalized}:${fingerprint}`;
            }
        }
        const segments = normalized.split(':').filter(Boolean);
        if (segments.length >= 2 && ['recover-interaction', 'follow-up-advance'].includes(segments[1])) {
            return `${segments[0]}:${segments[1]}`;
        }
        if (segments.length >= 3 && segments[1] === 'legal-action') {
            return `${segments[0]}:${segments[1]}:${segments[2]}`;
        }
        return normalized;
    }

    private buildWatchdogAggregationFingerprint(
        autoReportFamily: string,
        stateSnapshot?: string | null,
    ): string | null {
        const snapshot = this.parseWatchdogStateSnapshot(stateSnapshot);
        if (!snapshot) {
            return null;
        }
        const explicitFingerprint = this.normalizeAggregationSegment(
            typeof snapshot.blockerFingerprint === 'string' ? snapshot.blockerFingerprint : undefined,
            '',
        );
        if (explicitFingerprint) {
            return explicitFingerprint;
        }
        if (autoReportFamily === 'unsatisfiable-interaction-auto-skipped') {
            return this.buildUnsatisfiableInteractionAggregationFingerprintFromSnapshot(snapshot);
        }
        if (autoReportFamily === 'force-end-turn' || autoReportFamily === 'legal-action-recovered') {
            return this.buildOnlineAiRecoveryAggregationFingerprint(snapshot);
        }
        return null;
    }

    private buildUnsatisfiableInteractionAggregationFingerprint(
        stateSnapshot?: string | null,
    ): string | null {
        const snapshot = this.parseWatchdogStateSnapshot(stateSnapshot);
        if (!snapshot) {
            return null;
        }
        return this.buildUnsatisfiableInteractionAggregationFingerprintFromSnapshot(snapshot);
    }

    private buildUnsatisfiableInteractionAggregationFingerprintFromSnapshot(
        snapshot: WatchdogSnapshotRecord,
    ): string | null {
        const interaction = this.toRecord(snapshot.interaction);
        const seatInteraction = this.toRecord(interaction?.seat);
        const phase = this.normalizeAggregationSegment(
            typeof snapshot.phase === 'string' ? snapshot.phase : undefined,
            'unknown-phase',
        );
        const commandType = this.normalizeAggregationSegment(
            typeof snapshot.commandType === 'string' ? snapshot.commandType : undefined,
            'unknown-command',
        );
        const interactionKind = this.normalizeAggregationSegment(
            typeof seatInteraction?.kind === 'string' ? seatInteraction.kind : undefined,
            'unknown-kind',
        );
        const sourceId = this.normalizeAggregationSegment(
            typeof seatInteraction?.sourceId === 'string'
                ? seatInteraction.sourceId
                : typeof seatInteraction?.id === 'string'
                    ? seatInteraction.id
                    : undefined,
            'unknown-source',
        );
        return `${phase}:${interactionKind}:${sourceId}:${commandType}`;
    }

    private buildOnlineAiRecoveryAggregationFingerprint(
        snapshot: WatchdogSnapshotRecord,
    ): string | null {
        const phase = this.normalizeAggregationSegment(
            typeof snapshot.phase === 'string' ? snapshot.phase : undefined,
            'unknown-phase',
        );
        const reason = this.normalizeAggregationSegment(
            typeof snapshot.reason === 'string' ? snapshot.reason : undefined,
            'unknown-reason',
        );
        const interaction = this.toRecord(snapshot.interaction);
        const seatInteraction = this.toRecord(interaction?.seat);
        const sharedInteraction = this.toRecord(interaction?.shared);
        const effectiveInteraction = seatInteraction ?? sharedInteraction;
        if (effectiveInteraction) {
            const interactionKind = this.normalizeAggregationSegment(
                typeof effectiveInteraction.kind === 'string' ? effectiveInteraction.kind : undefined,
                'unknown-kind',
            );
            const sourceId = this.normalizeAggregationSegment(
                typeof effectiveInteraction.sourceId === 'string'
                    ? effectiveInteraction.sourceId
                    : typeof effectiveInteraction.id === 'string'
                        ? effectiveInteraction.id
                        : undefined,
                'unknown-source',
            );
            return `${phase}:${reason}:interaction:${interactionKind}:${sourceId}`;
        }

        const responseWindow = this.toRecord(snapshot.responseWindow);
        if (responseWindow) {
            const responderQueue = Array.isArray(responseWindow.responderQueue)
                ? responseWindow.responderQueue.filter((value): value is string => typeof value === 'string')
                : [];
            const responderIndex = typeof responseWindow.currentResponderIndex === 'number'
                ? responseWindow.currentResponderIndex
                : 0;
            const responderId = this.normalizeAggregationSegment(
                typeof responderQueue[responderIndex] === 'string' ? responderQueue[responderIndex] : undefined,
                'unknown-responder',
            );
            const windowType = this.normalizeAggregationSegment(
                typeof responseWindow.windowType === 'string' ? responseWindow.windowType : undefined,
                'unknown-window',
            );
            const sourceId = this.normalizeAggregationSegment(
                typeof responseWindow.sourceId === 'string' ? responseWindow.sourceId : undefined,
                'unknown-source',
            );
            return `${phase}:${reason}:response-window:${windowType}:${sourceId}:${responderId}`;
        }

        const pendingDamage = this.toRecord(snapshot.pendingDamage);
        if (pendingDamage) {
            const responseType = this.normalizeAggregationSegment(
                typeof pendingDamage.responseType === 'string' ? pendingDamage.responseType : undefined,
                'unknown-response',
            );
            const sourceAbilityId = this.normalizeAggregationSegment(
                typeof pendingDamage.sourceAbilityId === 'string' ? pendingDamage.sourceAbilityId : undefined,
                'unknown-source-ability',
            );
            const responderId = this.normalizeAggregationSegment(
                typeof pendingDamage.responderId === 'string' ? pendingDamage.responderId : undefined,
                'unknown-responder',
            );
            return `${phase}:${reason}:pending-damage:${responseType}:${sourceAbilityId}:${responderId}`;
        }

        return null;
    }

    private parseWatchdogStateSnapshot(stateSnapshot?: string | null): WatchdogSnapshotRecord | null {
        if (typeof stateSnapshot !== 'string' || !stateSnapshot.trim()) {
            return null;
        }
        try {
            const parsed = JSON.parse(stateSnapshot);
            return this.toRecord(parsed);
        } catch {
            return null;
        }
    }

    private toRecord(value: unknown): WatchdogSnapshotRecord | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        return value as WatchdogSnapshotRecord;
    }

    private pickMoreSevereSeverity(
        current?: string,
        incoming?: string,
    ): string | undefined {
        if (!incoming) {
            return current;
        }
        if (!current) {
            return incoming;
        }
        return (FEEDBACK_SEVERITY_RANK[incoming] ?? 0) >= (FEEDBACK_SEVERITY_RANK[current] ?? 0)
            ? incoming
            : current;
    }

    private resolveAggregatedSystemStatus(
        existingStatus: FeedbackStatus | undefined,
        incomingStatus: FeedbackStatus | undefined,
    ): FeedbackStatus {
        if (
            existingStatus === FeedbackStatus.IN_PROGRESS
            || existingStatus === FeedbackStatus.CLOSED
            || existingStatus === FeedbackStatus.RESOLVED
        ) {
            return existingStatus;
        }
        if (incomingStatus === FeedbackStatus.RESOLVED) {
            return existingStatus === FeedbackStatus.OPEN
                ? FeedbackStatus.OPEN
                : FeedbackStatus.RESOLVED;
        }
        return FeedbackStatus.OPEN;
    }

    private async createOrUpdateAggregatedSystemFeedback(
        dto: CreateSystemFeedbackDto,
        source: string,
        gameId?: string,
        retryDepth = 0,
        lockAcquired = false,
    ): Promise<Feedback> {
        const now = new Date();
        const aggregationPlan = this.buildWatchdogAggregationPlan(dto, source, gameId, now);
        if (!aggregationPlan) {
            const resolvedMethod = this.resolveSystemFeedbackResolvedMethod(dto);
            return this.feedbackModel.create({
                ...dto,
                source,
                reporterType: FeedbackReporterType.SYSTEM,
                gameId,
                ...(resolvedMethod ? { resolvedMethod } : {}),
            });
        }
        if (!lockAcquired) {
            return this.runWithWatchdogAggregationLock(
                aggregationPlan.dedupeKey,
                () => this.createOrUpdateAggregatedSystemFeedback(dto, source, gameId, retryDepth, true),
            );
        }
        await this.enforceWatchdogFeedbackRetention(now);
        const aggregationKey = aggregationPlan.dedupeKey;
        const aggregationActiveKey = aggregationKey;

        // 先查找活跃 canonical；若已超过去重窗口，先归档旧 canonical 再新开。
        let existing = await this.feedbackModel.findOne({
            aggregationActiveKey,
            status: { $ne: FeedbackStatus.CLOSED },
        }).exec();

        if (!existing) {
            existing = await this.feedbackModel.findOne({
                aggregationKey,
                status: { $ne: FeedbackStatus.CLOSED },
            }).sort({ lastOccurredAt: -1, updatedAt: -1, createdAt: -1 }).exec();
            if (existing && existing.aggregationActiveKey !== aggregationActiveKey) {
                try {
                    await this.feedbackModel.updateOne(
                        { _id: existing._id, status: { $ne: FeedbackStatus.CLOSED } },
                        { $set: { aggregationActiveKey } },
                    ).exec();
                    existing.aggregationActiveKey = aggregationActiveKey;
                } catch (error) {
                    if (!this.isDuplicateKeyError(error)) {
                        throw error;
                    }
                    existing = await this.feedbackModel.findOne({
                        aggregationActiveKey,
                        status: { $ne: FeedbackStatus.CLOSED },
                    }).exec();
                }
            }
        }

        if (existing) {
            const baseline = existing.lastOccurredAt ?? existing.createdAt ?? now;
            const baselineMs = baseline instanceof Date ? baseline.getTime() : new Date(baseline).getTime();
            const isWithinWindow = Number.isFinite(baselineMs)
                && baselineMs >= aggregationPlan.windowStartedAt.getTime();
            if (!isWithinWindow) {
                await this.feedbackModel.updateOne(
                    { _id: existing._id, status: { $ne: FeedbackStatus.CLOSED } },
                    { $set: { status: FeedbackStatus.CLOSED }, $unset: { aggregationActiveKey: '' } },
                );
                existing = null;
            }
        }

        if (!existing) {
            try {
                const resolvedMethod = this.resolveSystemFeedbackResolvedMethod(dto);
                const created = await this.feedbackModel.create({
                    ...dto,
                    source,
                    reporterType: FeedbackReporterType.SYSTEM,
                    gameId,
                    ...(resolvedMethod ? { resolvedMethod } : {}),
                    incidentKey: aggregationKey,
                    aggregationKey,
                    aggregationActiveKey,
                    occurrenceCount: 1,
                    firstOccurredAt: now,
                    lastOccurredAt: now,
                    latestIncidentKey: dto.incidentKey,
                });
                await this.enforceWatchdogFeedbackRetention(now);
                return created;
            } catch (error) {
                if (!this.isDuplicateKeyError(error)) {
                    throw error;
                }
                // 兼容历史/旁路状态更新：closed 记录若仍保留 activeKey，会阻塞新 canonical 建立。
                const releasedClosedDoc = await this.feedbackModel.findOneAndUpdate(
                    { aggregationActiveKey, status: FeedbackStatus.CLOSED },
                    { $unset: { aggregationActiveKey: '' } },
                    { sort: { updatedAt: -1 } },
                ).exec();
                if (releasedClosedDoc) {
                    try {
                        const resolvedMethod = this.resolveSystemFeedbackResolvedMethod(dto);
                        const created = await this.feedbackModel.create({
                            ...dto,
                            source,
                            reporterType: FeedbackReporterType.SYSTEM,
                            gameId,
                            ...(resolvedMethod ? { resolvedMethod } : {}),
                            incidentKey: aggregationKey,
                            aggregationKey,
                            aggregationActiveKey,
                            occurrenceCount: 1,
                            firstOccurredAt: now,
                            lastOccurredAt: now,
                            latestIncidentKey: dto.incidentKey,
                        });
                        await this.enforceWatchdogFeedbackRetention(now);
                        return created;
                    } catch (retryError) {
                        if (!this.isDuplicateKeyError(retryError)) {
                            throw retryError;
                        }
                    }
                }
                existing = await this.feedbackModel.findOne({
                    aggregationActiveKey,
                    status: { $ne: FeedbackStatus.CLOSED },
                }).exec();
                if (!existing) {
                    throw error;
                }
            }
        }

        const mergedSeverity = this.pickMoreSevereSeverity(existing.severity, dto.severity) as typeof existing.severity;
        const mergedStatus = this.resolveAggregatedSystemStatus(existing.status, dto.status);
        const mergedResolvedMethod = mergedStatus === FeedbackStatus.RESOLVED
            ? this.normalizeResolvedMethod(dto.resolvedMethod)
                ?? this.normalizeResolvedMethod(existing.resolvedMethod)
                ?? this.buildDefaultSystemResolvedMethod(dto)
            : undefined;
        const updated = await this.feedbackModel.findOneAndUpdate(
            { _id: existing._id, status: { $ne: FeedbackStatus.CLOSED } },
            {
                $set: {
                    content: dto.content,
                    type: dto.type ?? existing.type,
                    severity: mergedSeverity,
                    status: mergedStatus,
                    ...(mergedResolvedMethod ? { resolvedMethod: mergedResolvedMethod } : {}),
                    source,
                    reporterType: FeedbackReporterType.SYSTEM,
                    gameId,
                    gameName: dto.gameName ?? existing.gameName,
                    autoReportKind: dto.autoReportKind ?? existing.autoReportKind,
                    contactInfo: dto.contactInfo ?? existing.contactInfo,
                    actionLog: dto.actionLog ?? existing.actionLog,
                    stateSnapshot: dto.stateSnapshot ?? existing.stateSnapshot,
                    clientContext: dto.clientContext ?? existing.clientContext,
                    errorContext: dto.errorContext ?? existing.errorContext,
                    incidentKey: aggregationKey,
                    aggregationKey,
                    aggregationActiveKey,
                    firstOccurredAt: existing.firstOccurredAt ?? now,
                    lastOccurredAt: now,
                    latestIncidentKey: dto.incidentKey ?? existing.latestIncidentKey,
                },
                $inc: {
                    occurrenceCount: 1,
                },
            },
            { new: true },
        ).exec();

        if (!updated) {
            if (retryDepth >= 1) {
                throw new Error('failed_to_update_aggregated_system_feedback_after_retry');
            }
            return this.createOrUpdateAggregatedSystemFeedback(dto, source, gameId, retryDepth + 1, true);
        }
        await this.enforceWatchdogFeedbackRetention(now);
        return updated.toObject() as Feedback;
    }

    private async runWithWatchdogAggregationLock(
        dedupeKey: string,
        task: () => Promise<Feedback>,
    ): Promise<Feedback> {
        const previous = this.watchdogAggregationLocks.get(dedupeKey) ?? Promise.resolve(undefined as unknown as Feedback);
        const current = previous
            .catch(() => undefined as unknown as Feedback)
            .then(task)
            .finally(() => {
                if (this.watchdogAggregationLocks.get(dedupeKey) === current) {
                    this.watchdogAggregationLocks.delete(dedupeKey);
                }
            });
        this.watchdogAggregationLocks.set(dedupeKey, current);
        return current;
    }

    private async enforceWatchdogFeedbackRetention(now: Date): Promise<void> {
        const cutoff = new Date(now.getTime() - WATCHDOG_RECENT_RETENTION_MS);
        try {
            const keepRows = await this.feedbackModel.aggregate<Array<{ _id: Types.ObjectId }>>([
                {
                    $match: {
                        source: WATCHDOG_AGGREGATION_SOURCE,
                        reporterType: FeedbackReporterType.SYSTEM,
                    },
                },
                {
                    $addFields: {
                        __retentionSortAt: {
                            $ifNull: [
                                '$lastOccurredAt',
                                { $ifNull: ['$createdAt', '$updatedAt'] },
                            ],
                        },
                    },
                },
                {
                    $match: {
                        __retentionSortAt: { $gte: cutoff },
                    },
                },
                {
                    $sort: {
                        __retentionSortAt: -1,
                        _id: -1,
                    },
                },
                {
                    $limit: WATCHDOG_MAX_RECENT_RECORDS,
                },
                {
                    $project: {
                        _id: 1,
                    },
                },
            ]).exec();

            const keepIds = keepRows.map((row) => row._id);
            const deleteFilter: Record<string, unknown> = {
                source: WATCHDOG_AGGREGATION_SOURCE,
                reporterType: FeedbackReporterType.SYSTEM,
            };
            if (keepIds.length > 0) {
                deleteFilter._id = { $nin: keepIds };
            }
            await this.feedbackModel.deleteMany({
                ...deleteFilter,
            }).exec();
        } catch {
            // 清理失败不应影响线上 watchdog 反馈上报链路。
        }
    }

    private isDuplicateKeyError(error: unknown): boolean {
        if (!error || typeof error !== 'object') {
            return false;
        }
        const maybeCode = (error as { code?: unknown }).code;
        if (typeof maybeCode === 'number') {
            return maybeCode === 11000;
        }
        const maybeMessage = (error as { message?: unknown }).message;
        return typeof maybeMessage === 'string' && maybeMessage.includes('E11000');
    }

    private buildOriginFilter(
        reporterType?: FeedbackReporterType,
        source?: string,
    ): Record<string, unknown> | null {
        if (!reporterType && !source) {
            return null;
        }
        const normalizedSource = source ? this.normalizeSource(source) : undefined;
        const base: Record<string, unknown> = {};
        if (reporterType) base.reporterType = reporterType;
        if (normalizedSource) base.source = normalizedSource;

        if (reporterType === FeedbackReporterType.USER) {
            if (normalizedSource && this.isPublicAutoFeedbackSource(normalizedSource)) {
                return { _id: { $exists: false } };
            }
            return normalizedSource
                ? base
                : {
                    ...base,
                    source: { $nin: PUBLIC_AUTO_FEEDBACK_SOURCE_LIST },
                };
        }

        const legacyFilters: Record<string, unknown>[] = [];
        const legacyWatchdogFilter = this.buildLegacyWatchdogFilterForOrigin(normalizedSource);
        if (legacyWatchdogFilter) {
            legacyFilters.push(legacyWatchdogFilter);
        }
        const legacyPublicAutoFilter = this.buildLegacyPublicAutoFilter(normalizedSource);
        if (legacyPublicAutoFilter) {
            legacyFilters.push(legacyPublicAutoFilter);
        }

        if (legacyFilters.length > 0) {
            return { $or: [base, ...legacyFilters] };
        }

        return base;
    }

    private buildLegacyWatchdogFilterForOrigin(source?: string): Record<string, unknown> | null {
        if (source && source !== LEGACY_WATCHDOG_SOURCE) {
            return null;
        }
        return this.buildLegacyWatchdogFilter();
    }

    private buildLegacyPublicAutoFilter(source?: string): Record<string, unknown> | null {
        if (source && !this.isPublicAutoFeedbackSource(source)) {
            return null;
        }
        return {
            reporterType: FeedbackReporterType.USER,
            source: source ?? { $in: PUBLIC_AUTO_FEEDBACK_SOURCE_LIST },
        };
    }

    private buildLegacyWatchdogFilter(): Record<string, unknown> {
        return {
            reporterType: null,
            $or: [
                { contactInfo: 'system:online-ai-watchdog' },
                { 'errorContext.source': LEGACY_WATCHDOG_SOURCE },
                { content: /^\[system\]\[online-ai-watchdog\]\s+/ },
            ],
        };
    }

    private buildSummaryProjection(): Record<string, unknown> {
        return {
            _id: 1,
            userId: 1,
            type: 1,
            severity: 1,
            status: 1,
            closedReason: 1,
            resolvedMethod: 1,
            reporterType: 1,
            source: 1,
            autoReportKind: 1,
            incidentKey: 1,
            latestIncidentKey: 1,
            occurrenceCount: 1,
            firstOccurredAt: 1,
            lastOccurredAt: 1,
            gameName: 1,
            gameId: 1,
            contactInfo: 1,
            rewardPoints: 1,
            createdAt: 1,
            updatedAt: 1,
            contentPreviewSource: {
                $substrCP: [{ $ifNull: ['$content', ''] }, 0, FEEDBACK_SUMMARY_PREVIEW_SOURCE_LENGTH],
            },
            hasEmbeddedImage: {
                $regexMatch: {
                    input: { $ifNull: ['$content', ''] },
                    regex: /data:image\//,
                },
            },
            hasActionLog: {
                $gt: [{ $strLenCP: { $ifNull: ['$actionLog', ''] } }, 0],
            },
            hasStateSnapshot: {
                $gt: [{ $strLenCP: { $ifNull: ['$stateSnapshot', ''] } }, 0],
            },
            hasClientContext: {
                $gt: [{ $size: { $objectToArray: { $ifNull: ['$clientContext', {}] } } }, 0],
            },
            hasErrorContext: {
                $gt: [{ $size: { $objectToArray: { $ifNull: ['$errorContext', {}] } } }, 0],
            },
            clientContext: {
                gameId: '$clientContext.gameId',
                route: '$clientContext.route',
                appVersion: '$clientContext.appVersion',
                appCommitSha: '$clientContext.appCommitSha',
                appBuildTime: '$clientContext.appBuildTime',
                lastUserAction: '$clientContext.lastUserAction',
                activeElement: '$clientContext.activeElement',
            },
            errorContext: {
                source: '$errorContext.source',
                name: '$errorContext.name',
                message: '$errorContext.message',
            },
        };
    }

    private formatListItem(
        item: FeedbackDocument | FeedbackListRecord,
        manager: FeedbackManagerScope | null,
        summaryOnly: boolean,
    ): Record<string, unknown> {
        if (!summaryOnly) {
            const decorated = this.decorateLegacyOrigin(item as FeedbackDocument | Feedback);
            return {
                ...decorated,
                canManage: manager ? this.canActorManageFeedbackItem(manager, decorated) : false,
            };
        }

        const raw = this.toFeedbackObject(item as FeedbackDocument | Feedback) as FeedbackListRecord;
        const originInput = {
            ...raw,
            content: raw.content ?? raw.contentPreviewSource ?? '',
        } as Feedback;
        const decorated = this.decorateLegacyOrigin(originInput);
        const canManage = manager ? this.canActorManageFeedbackItem(manager, decorated) : false;
        const summary: Record<string, unknown> = { ...decorated };
        const previewSource = typeof summary.contentPreviewSource === 'string'
            ? summary.contentPreviewSource
            : '';

        summary.contentPreview = this.buildContentPreview(previewSource);
        summary.canManage = canManage;
        delete summary.contentPreviewSource;
        delete summary.content;
        delete summary.actionLog;
        delete summary.stateSnapshot;

        return summary;
    }

    private buildContentPreview(source: string): string {
        const withoutImages = source
            .replace(/!\[[^\]]*\]\(data:image\/[^)]*\)/g, ' ')
            .replace(/!\[[^\]]*\]\(data:image\/.*$/s, ' ');
        const normalized = withoutImages.replace(/\s+/g, ' ').trim();
        if (normalized.length <= FEEDBACK_SUMMARY_PREVIEW_LENGTH) {
            return normalized;
        }
        return `${normalized.slice(0, FEEDBACK_SUMMARY_PREVIEW_LENGTH - 3)}...`;
    }

    private decorateLegacyOrigin(item: FeedbackDocument | Feedback): Feedback {
        const raw = this.toFeedbackObject(item);
        const isLegacyPublicAuto = this.isPublicAutoFeedbackSource(raw.source)
            && raw.reporterType !== FeedbackReporterType.SYSTEM;
        if (isLegacyPublicAuto) {
            return {
                ...raw,
                reporterType: FeedbackReporterType.SYSTEM,
            };
        }
        const isLegacyWatchdog = raw.contactInfo === 'system:online-ai-watchdog'
            || raw.errorContext?.source === LEGACY_WATCHDOG_SOURCE
            || /^\[system\]\[online-ai-watchdog\]\s+/.test(raw.content);
        if (!isLegacyWatchdog) {
            if (raw.reporterType && raw.source) {
                return raw;
            }
            return raw;
        }
        return {
            ...raw,
            reporterType: FeedbackReporterType.SYSTEM,
            source: LEGACY_WATCHDOG_SOURCE,
            autoReportKind: raw.errorContext?.name || raw.autoReportKind,
        };
    }

    private toFeedbackObject(item: FeedbackDocument | Feedback): Feedback {
        if (item && typeof (item as FeedbackDocument).toObject === 'function') {
            return (item as FeedbackDocument).toObject() as Feedback;
        }
        return item as Feedback;
    }

    private canActorManageFeedbackItem(manager: FeedbackManagerScope, item: Feedback): boolean {
        if (manager.role === 'admin' || manager.developerGameIds === null) {
            return true;
        }

        const feedbackUserId = this.extractFeedbackUserId(item.userId);
        const ownFeedback = Boolean(
            manager.actorUserObjectId
            && feedbackUserId
            && feedbackUserId === String(manager.actorUserObjectId),
        );
        if (ownFeedback) {
            return true;
        }

        if (manager.role !== 'developer' || manager.developerGameIds.length === 0) {
            return false;
        }

        const feedbackGameId = this.normalizeFeedbackGameIdCandidates(
            item.gameId,
            item.clientContext?.gameId,
            item.gameName,
        );
        return Boolean(feedbackGameId && manager.developerGameIds.includes(feedbackGameId));
    }

    private extractFeedbackUserId(value: unknown): string | null {
        if (!value) {
            return null;
        }

        if (typeof value === 'string') {
            return value;
        }

        if (value instanceof Types.ObjectId) {
            return value.toString();
        }

        if (typeof value === 'object') {
            const maybeId = (value as { _id?: unknown })._id;
            if (typeof maybeId === 'string') {
                return maybeId;
            }
            if (maybeId instanceof Types.ObjectId) {
                return maybeId.toString();
            }
        }

        return null;
    }

    private buildOwnFeedbackFilter(manager: FeedbackManagerScope): Record<string, unknown> {
        const ownScope = manager.actorUserObjectId
            ? [{ userId: manager.actorUserObjectId }, { userId: manager.actorUserId }]
            : [{ userId: manager.actorUserId }];
        if (ownScope.length === 0) {
            return { _id: { $exists: false } };
        }
        return ownScope.length === 1 ? ownScope[0] : { $or: ownScope };
    }

    private buildMutationScopeFilter(manager: FeedbackManagerScope): Record<string, unknown> {
        if (manager.role === 'admin' || manager.developerGameIds === null) {
            return {};
        }

        const ownScope = manager.actorUserObjectId
            ? [{ userId: manager.actorUserObjectId }, { userId: manager.actorUserId }]
            : [{ userId: manager.actorUserId }];

        if (manager.role === 'user') {
            if (ownScope.length === 0) {
                return { _id: { $exists: false } };
            }
            return ownScope.length === 1 ? ownScope[0] : { $or: ownScope };
        }

        const gameScopes = manager.developerGameIds.length > 0
            ? [
                { gameId: { $in: manager.developerGameIds } },
                { 'clientContext.gameId': { $in: manager.developerGameIds } },
                { gameName: { $in: manager.developerGameIds } },
            ]
            : [];

        const combinedScopes = [...ownScope, ...gameScopes];
        if (combinedScopes.length === 0) {
            return { _id: { $exists: false } };
        }

        return { $or: combinedScopes };
    }

    private async assertActorCanManage(actorUserId: string): Promise<FeedbackManagerScope> {
        const actor = await this.userModel.findById(actorUserId).select('role developerGameIds').lean<{
            role: UserRole;
            developerGameIds?: string[];
        } | null>();

        if (!actor || (actor.role !== 'admin' && actor.role !== 'developer' && actor.role !== 'user')) {
            throw new ForbiddenException('无权管理反馈');
        }

        if (actor.role === 'admin') {
            return {
                actorUserId,
                actorUserObjectId: Types.ObjectId.isValid(actorUserId) ? new Types.ObjectId(actorUserId) : null,
                role: actor.role,
                developerGameIds: null,
            };
        }

        return {
            actorUserId,
            actorUserObjectId: Types.ObjectId.isValid(actorUserId) ? new Types.ObjectId(actorUserId) : null,
            role: actor.role,
            developerGameIds: actor.role === 'developer' ? normalizeDeveloperGameIds(actor.developerGameIds) : [],
        };
    }
}

