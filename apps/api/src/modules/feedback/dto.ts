import { Transform, Type } from 'class-transformer';
import { Allow, ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { FeedbackReporterType, FeedbackSeverity, FeedbackStatus, FeedbackType } from './feedback.schema';

export const FEEDBACK_SORT_OPTIONS = ['newest', 'oldest'] as const;
export type FeedbackSortOption = typeof FEEDBACK_SORT_OPTIONS[number];

const parseBoolean = (value: unknown): boolean | undefined => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
};

export class FeedbackViewportDto {
    @IsNumber()
    width!: number;

    @IsNumber()
    height!: number;
}

export class FeedbackElementSummaryDto {
    @IsString()
    @IsOptional()
    @MaxLength(32)
    tagName?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    testId?: string;

    @IsString()
    @IsOptional()
    @MaxLength(32)
    role?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    id?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    name?: string;

    @IsString()
    @IsOptional()
    @MaxLength(32)
    type?: string;

    @IsString()
    @IsOptional()
    @MaxLength(80)
    ariaLabel?: string;

    @IsString()
    @IsOptional()
    @MaxLength(80)
    text?: string;
}

export class FeedbackUserActionSummaryDto {
    @IsString()
    @MaxLength(32)
    type!: string;

    @IsString()
    @MaxLength(40)
    at!: string;

    @IsString()
    @IsOptional()
    @MaxLength(32)
    key?: string;

    @ValidateNested()
    @Type(() => FeedbackElementSummaryDto)
    @IsOptional()
    target?: FeedbackElementSummaryDto;
}

export class FeedbackRouteChangeSummaryDto {
    @IsString()
    @IsOptional()
    @MaxLength(300)
    from?: string;

    @IsString()
    @MaxLength(300)
    to!: string;

    @IsIn(['init', 'pushState', 'replaceState', 'popstate', 'hashchange'])
    trigger!: 'init' | 'pushState' | 'replaceState' | 'popstate' | 'hashchange';

    @IsString()
    @MaxLength(40)
    at!: string;
}

export class FeedbackPageFlagsDto {
    @IsBoolean()
    @IsOptional()
    isGamePage?: boolean;

    @IsBoolean()
    @IsOptional()
    hasModalOpen?: boolean;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    gameId?: string;

    @IsString()
    @IsOptional()
    @MaxLength(32)
    homeStyle?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    mobileLayoutPreset?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    mobileProfile?: string;
}

export class FeedbackClientContextDto {
    @IsString()
    @IsOptional()
    @MaxLength(300)
    route?: string;

    @IsString()
    @IsOptional()
    @MaxLength(32)
    mode?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    matchId?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    playerId?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    gameId?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    appVersion?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    appCommitSha?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    appBuildTime?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    appReleaseChannel?: string;

    @IsString()
    @IsOptional()
    @MaxLength(512)
    userAgent?: string;

    @ValidateNested()
    @Type(() => FeedbackViewportDto)
    @IsOptional()
    viewport?: FeedbackViewportDto;

    @IsString()
    @IsOptional()
    @MaxLength(32)
    language?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    timezone?: string;

    @ValidateNested()
    @Type(() => FeedbackElementSummaryDto)
    @IsOptional()
    activeElement?: FeedbackElementSummaryDto;

    @ValidateNested()
    @Type(() => FeedbackUserActionSummaryDto)
    @IsOptional()
    lastUserAction?: FeedbackUserActionSummaryDto;

    @IsArray()
    @ArrayMaxSize(8)
    @ValidateNested({ each: true })
    @Type(() => FeedbackUserActionSummaryDto)
    @IsOptional()
    recentUserActions?: FeedbackUserActionSummaryDto[];

    @ValidateNested()
    @Type(() => FeedbackRouteChangeSummaryDto)
    @IsOptional()
    lastRouteChange?: FeedbackRouteChangeSummaryDto;

    @IsArray()
    @ArrayMaxSize(6)
    @ValidateNested({ each: true })
    @Type(() => FeedbackRouteChangeSummaryDto)
    @IsOptional()
    recentRouteChanges?: FeedbackRouteChangeSummaryDto[];

    @ValidateNested()
    @Type(() => FeedbackPageFlagsDto)
    @IsOptional()
    pageFlags?: FeedbackPageFlagsDto;
}

export class FeedbackErrorContextDto {
    @IsString()
    @IsOptional()
    @MaxLength(300)
    message?: string;

    @IsString()
    @IsOptional()
    @MaxLength(120)
    name?: string;

    @IsString()
    @IsOptional()
    @MaxLength(4000)
    stack?: string;

    @IsString()
    @IsOptional()
    @MaxLength(128)
    source?: string;

    @IsString()
    @IsOptional()
    @MaxLength(4000)
    jsStack?: string;

    @IsString()
    @IsOptional()
    @MaxLength(4000)
    componentStack?: string;
}

export class FeedbackConfigProposalSourceContextDto {
    @IsString()
    @IsOptional()
    @MaxLength(300)
    route?: string;

    @IsString()
    @IsOptional()
    @MaxLength(160)
    tableId?: string;

    @IsString()
    @IsOptional()
    @MaxLength(160)
    rowId?: string;

    @IsString()
    @IsOptional()
    @MaxLength(80)
    cellKey?: string;

    @IsString()
    @IsOptional()
    @MaxLength(32)
    language?: string;

    @Allow()
    @IsOptional()
    objectContext?: unknown;
}

export class FeedbackConfigProposalDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    gameId!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    configVersion!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(160)
    objectId!: string;

    @IsString()
    @IsOptional()
    @MaxLength(200)
    objectDisplayName?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    objectType?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(300)
    fieldPath!: string;

    @IsString()
    @IsOptional()
    @MaxLength(160)
    fieldDisplayName?: string;

    @Allow()
    @IsOptional()
    currentValue?: unknown;

    @Allow()
    suggestedValue?: unknown;

    @IsString()
    @IsOptional()
    @MaxLength(2000)
    currentDisplayValue?: string;

    @IsString()
    @IsOptional()
    @MaxLength(2000)
    updatedDisplayValue?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(4000)
    reason!: string;

    @IsString()
    @IsOptional()
    @MaxLength(4000)
    evidence?: string;

    @ValidateNested()
    @Type(() => FeedbackConfigProposalSourceContextDto)
    @IsOptional()
    sourceContext?: FeedbackConfigProposalSourceContextDto;

    @IsIn([
        'pending_ai_review',
        'ai_suggest_accept',
        'ai_suggest_reject',
        'needs_more_evidence',
        'needs_human_review',
        'needs_code_support',
        'accepted',
        'rejected',
        'closed',
    ])
    @IsOptional()
    status?: string;
}

export class CreateFeedbackDto {
    @IsString()
    @IsNotEmpty()
    content!: string;

    @IsEnum(FeedbackType)
    @IsOptional()
    type?: FeedbackType;

    @IsEnum(FeedbackSeverity)
    @IsOptional()
    severity?: FeedbackSeverity;

    @IsString()
    @IsOptional()
    gameName?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    source?: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    autoReportKind?: string;

    @IsString()
    @IsOptional()
    contactInfo?: string;

    @IsString()
    @IsOptional()
    @MaxLength(50000)
    actionLog?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500000)
    stateSnapshot?: string;

    @ValidateNested()
    @Type(() => FeedbackClientContextDto)
    @IsOptional()
    clientContext?: FeedbackClientContextDto;

    @ValidateNested()
    @Type(() => FeedbackErrorContextDto)
    @IsOptional()
    errorContext?: FeedbackErrorContextDto;

    @ValidateNested()
    @Type(() => FeedbackConfigProposalDto)
    @IsOptional()
    configProposal?: FeedbackConfigProposalDto;

    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => FeedbackConfigProposalDto)
    @IsOptional()
    configProposals?: FeedbackConfigProposalDto[];
}

export class CreateSystemFeedbackDto {
    @IsString()
    @IsNotEmpty()
    content!: string;

    @IsEnum(FeedbackType)
    @IsOptional()
    type?: FeedbackType;

    @IsEnum(FeedbackSeverity)
    @IsOptional()
    severity?: FeedbackSeverity;

    @IsEnum(FeedbackStatus)
    @IsOptional()
    status?: FeedbackStatus;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    resolvedMethod?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    source!: string;

    @IsString()
    @IsOptional()
    @MaxLength(64)
    autoReportKind?: string;

    @IsString()
    @IsOptional()
    @MaxLength(128)
    incidentKey?: string;

    @IsString()
    @IsOptional()
    gameName?: string;

    @IsString()
    @IsOptional()
    contactInfo?: string;

    @IsString()
    @IsOptional()
    @MaxLength(50000)
    actionLog?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500000)
    stateSnapshot?: string;

    @ValidateNested()
    @Type(() => FeedbackClientContextDto)
    @IsOptional()
    clientContext?: FeedbackClientContextDto;

    @ValidateNested()
    @Type(() => FeedbackErrorContextDto)
    @IsOptional()
    errorContext?: FeedbackErrorContextDto;
}

export class UpdateFeedbackStatusDto {
    @IsEnum(FeedbackStatus)
    status!: FeedbackStatus;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    closedReason?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    resolvedMethod?: string;
}

export class QueryFeedbackDto {
    @IsOptional()
    page?: number;

    @IsOptional()
    limit?: number;

    @IsOptional()
    @IsEnum(FeedbackStatus)
    status?: FeedbackStatus;

    @IsOptional()
    @IsEnum(FeedbackType)
    type?: FeedbackType;

    @IsOptional()
    @IsEnum(FeedbackSeverity)
    severity?: FeedbackSeverity;

    @IsOptional()
    @IsEnum(FeedbackReporterType)
    reporterType?: FeedbackReporterType;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    source?: string;

    @IsOptional()
    @IsIn(FEEDBACK_SORT_OPTIONS)
    sort?: FeedbackSortOption;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    preferMine?: boolean;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    mineOnly?: boolean;
}

export class FeedbackFilterDto {
    @IsOptional()
    @IsEnum(FeedbackStatus)
    status?: FeedbackStatus;

    @IsOptional()
    @IsEnum(FeedbackType)
    type?: FeedbackType;

    @IsOptional()
    @IsEnum(FeedbackSeverity)
    severity?: FeedbackSeverity;

    @IsOptional()
    @IsEnum(FeedbackReporterType)
    reporterType?: FeedbackReporterType;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    source?: string;
}

export class BulkFeedbackIdsDto {
    @IsArray()
    @IsString({ each: true })
    ids: string[] = [];
}

