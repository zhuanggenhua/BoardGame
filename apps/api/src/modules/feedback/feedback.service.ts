import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { normalizeDeveloperGameIds } from '../auth/schemas/developer-game-access';
import { User, type UserDocument } from '../auth/schemas/user.schema';
import type { UserRole } from '../auth/schemas/user-role';
import { Feedback, FeedbackDocument, FeedbackReporterType, FeedbackStatus } from './feedback.schema';
import { CreateFeedbackDto, CreateSystemFeedbackDto, FeedbackFilterDto, QueryFeedbackDto } from './dto';

type FeedbackManagerScope = {
    role: Extract<UserRole, 'developer' | 'admin'>;
    developerGameIds: string[] | null;
};

const DEFAULT_USER_SOURCE = 'feedback-modal';
const LEGACY_WATCHDOG_SOURCE = 'online-ai-watchdog';
const WATCHDOG_AGGREGATION_SOURCE = 'online-ai-watchdog';

const FEEDBACK_SEVERITY_RANK: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
};

@Injectable()
export class FeedbackService {
    constructor(
        @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) { }

    async create(userId: string | null, dto: CreateFeedbackDto): Promise<Feedback> {
        return this.feedbackModel.create({
            ...dto,
            gameId: this.normalizeFeedbackGameId(dto.clientContext?.gameId ?? dto.gameName),
            reporterType: FeedbackReporterType.USER,
            source: DEFAULT_USER_SOURCE,
            ...(userId && { userId }),
        });
    }

    async createSystem(dto: CreateSystemFeedbackDto): Promise<Feedback> {
        const source = this.normalizeSource(dto.source, 'unknown');
        const gameId = this.normalizeFeedbackGameId(dto.clientContext?.gameId ?? dto.gameName);
        if (this.shouldAggregateSystemFeedback(dto, source, gameId)) {
            return this.createOrUpdateAggregatedSystemFeedback(dto, source, gameId);
        }
        return this.feedbackModel.create({
            ...dto,
            source,
            reporterType: FeedbackReporterType.SYSTEM,
            gameId,
        });
    }

    async findAll(actorUserId: string, query: QueryFeedbackDto) {
        const manager = await this.assertActorCanManage(actorUserId);
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
        const { status, type, severity, sort, reporterType, source } = query;
        const filter = this.buildScopedFilter(manager);
        if (status) filter.status = status;
        if (type) filter.type = type;
        if (severity) filter.severity = severity;
        const originFilter = this.buildOriginFilter(reporterType, source);
        if (originFilter) {
            filter.$and = filter.$and ? [...(filter.$and as Record<string, unknown>[]), originFilter] : [originFilter];
        }
        const createdAtSort = sort === 'oldest' ? 1 : -1;

        const total = await this.feedbackModel.countDocuments(filter);
        const items = await this.feedbackModel
            .find(filter)
            .sort({ createdAt: createdAtSort })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('userId', 'username avatar email')
            .exec();

        return {
            items: items.map((item) => this.decorateLegacyOrigin(item)),
            total,
            page,
            limit,
        };
    }

    async updateStatus(actorUserId: string, id: string, status: FeedbackStatus): Promise<Feedback | null> {
        const manager = await this.assertActorCanManage(actorUserId);
        const scopeFilter = this.buildScopedFilter(manager);
        return this.feedbackModel.findOneAndUpdate({ _id: id, ...scopeFilter }, { status }, { new: true });
    }

    async deleteOne(actorUserId: string, id: string): Promise<boolean> {
        const manager = await this.assertActorCanManage(actorUserId);
        const scopeFilter = this.buildScopedFilter(manager);
        const result = await this.feedbackModel.deleteOne({ _id: id, ...scopeFilter });
        return (result.deletedCount ?? 0) > 0;
    }

    async bulkDeleteByIds(actorUserId: string, ids: string[]) {
        const manager = await this.assertActorCanManage(actorUserId);
        const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
        if (!uniqueIds.length) {
            return { requested: 0, deleted: 0 };
        }
        const scopeFilter = this.buildScopedFilter(manager);
        const result = await this.feedbackModel.deleteMany({ _id: { $in: uniqueIds }, ...scopeFilter });
        return { requested: uniqueIds.length, deleted: result.deletedCount ?? 0 };
    }

    async bulkDeleteByFilter(actorUserId: string, filterDto: FeedbackFilterDto) {
        const manager = await this.assertActorCanManage(actorUserId);
        const filter = this.buildScopedFilter(manager);
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

    private normalizeSource(value?: string | null, fallback = DEFAULT_USER_SOURCE): string {
        if (typeof value !== 'string') {
            return fallback;
        }
        const normalized = value.trim().toLowerCase();
        return normalized || fallback;
    }

    private shouldAggregateSystemFeedback(
        dto: CreateSystemFeedbackDto,
        source: string,
        gameId?: string,
    ): boolean {
        if (source !== WATCHDOG_AGGREGATION_SOURCE) {
            return false;
        }
        return Boolean(gameId && (dto.autoReportKind || dto.errorContext?.name));
    }

    private buildSystemAggregationKey(
        dto: CreateSystemFeedbackDto,
        source: string,
        gameId?: string,
    ): string | null {
        if (!gameId) {
            return null;
        }
        const autoReportFamily = this.normalizeWatchdogAutoReportFamily(
            dto.autoReportKind ?? dto.errorContext?.name,
        );
        const normalizedReason = this.normalizeWatchdogReason(
            dto.errorContext?.message
            ?? dto.content.replace(/^\[system\]\[online-ai-watchdog\]\s+/i, ''),
        );
        return [
            'system-feedback',
            source,
            gameId,
            autoReportFamily,
            normalizedReason || 'unknown',
        ].join(':');
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

    private normalizeWatchdogReason(value?: string | null): string {
        if (typeof value !== 'string') {
            return 'unknown';
        }
        const normalized = value
            .trim()
            .toLowerCase()
            .replace(/:steps=\d+\b/g, ':steps')
            .replace(/\s+/g, ' ')
            || 'unknown';
        const segments = normalized.split(':').filter(Boolean);
        if (segments.length >= 2 && ['recover-interaction', 'follow-up-advance'].includes(segments[1])) {
            return `${segments[0]}:${segments[1]}`;
        }
        return normalized;
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
        if (existingStatus === FeedbackStatus.IN_PROGRESS || existingStatus === FeedbackStatus.CLOSED) {
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
    ): Promise<Feedback> {
        const aggregationKey = this.buildSystemAggregationKey(dto, source, gameId);
        if (!aggregationKey) {
            return this.feedbackModel.create({
                ...dto,
                source,
                reporterType: FeedbackReporterType.SYSTEM,
                gameId,
            });
        }

        const now = new Date();
        const existing = await this.feedbackModel.findOne({ aggregationKey }).exec();
        if (!existing) {
            return this.feedbackModel.create({
                ...dto,
                source,
                reporterType: FeedbackReporterType.SYSTEM,
                gameId,
                incidentKey: aggregationKey,
                aggregationKey,
                occurrenceCount: 1,
                firstOccurredAt: now,
                lastOccurredAt: now,
                latestIncidentKey: dto.incidentKey,
            });
        }

        existing.content = dto.content;
        existing.type = dto.type ?? existing.type;
        existing.severity = this.pickMoreSevereSeverity(existing.severity, dto.severity) as typeof existing.severity;
        existing.status = this.resolveAggregatedSystemStatus(existing.status, dto.status);
        existing.source = source;
        existing.reporterType = FeedbackReporterType.SYSTEM;
        existing.gameId = gameId;
        existing.gameName = dto.gameName ?? existing.gameName;
        existing.autoReportKind = dto.autoReportKind ?? existing.autoReportKind;
        existing.contactInfo = dto.contactInfo ?? existing.contactInfo;
        existing.actionLog = dto.actionLog ?? existing.actionLog;
        existing.stateSnapshot = dto.stateSnapshot ?? existing.stateSnapshot;
        existing.clientContext = dto.clientContext ?? existing.clientContext;
        existing.errorContext = dto.errorContext ?? existing.errorContext;
        existing.incidentKey = aggregationKey;
        existing.aggregationKey = aggregationKey;
        existing.occurrenceCount = Math.max(1, Number(existing.occurrenceCount) || 1) + 1;
        existing.firstOccurredAt = existing.firstOccurredAt ?? now;
        existing.lastOccurredAt = now;
        existing.latestIncidentKey = dto.incidentKey ?? existing.latestIncidentKey;
        await existing.save();
        return existing.toObject() as Feedback;
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

        if (reporterType === FeedbackReporterType.SYSTEM
            && (!normalizedSource || normalizedSource === LEGACY_WATCHDOG_SOURCE)) {
            const legacyFilter = this.buildLegacyWatchdogFilter();
            return { $or: [base, legacyFilter] };
        }

        return base;
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

    private decorateLegacyOrigin(item: FeedbackDocument): Feedback {
        const raw = item.toObject() as Feedback;
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

    private buildScopedFilter(
        manager: FeedbackManagerScope,
        extra: Record<string, unknown> = {}
    ): Record<string, unknown> {
        const filter: Record<string, unknown> = { ...extra };

        if (manager.role === 'admin' || manager.developerGameIds === null) {
            return filter;
        }

        if (manager.developerGameIds.length === 0) {
            filter._id = { $exists: false };
            return filter;
        }

        filter.$or = [
            { gameId: { $in: manager.developerGameIds } },
            { 'clientContext.gameId': { $in: manager.developerGameIds } },
            { gameName: { $in: manager.developerGameIds } },
        ];

        return filter;
    }

    private async assertActorCanManage(actorUserId: string): Promise<FeedbackManagerScope> {
        const actor = await this.userModel.findById(actorUserId).select('role developerGameIds').lean<{
            role: UserRole;
            developerGameIds?: string[];
        } | null>();

        if (!actor || (actor.role !== 'admin' && actor.role !== 'developer')) {
            throw new ForbiddenException('无权管理反馈');
        }

        if (actor.role === 'admin') {
            return {
                role: actor.role,
                developerGameIds: null,
            };
        }

        return {
            role: actor.role,
            developerGameIds: normalizeDeveloperGameIds(actor.developerGameIds),
        };
    }
}

