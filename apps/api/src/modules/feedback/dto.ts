import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { FeedbackReporterType, FeedbackSeverity, FeedbackStatus, FeedbackType } from './feedback.schema';

export const FEEDBACK_SORT_OPTIONS = ['newest', 'oldest'] as const;
export type FeedbackSortOption = typeof FEEDBACK_SORT_OPTIONS[number];

export class FeedbackViewportDto {
    @IsNumber()
    width!: number;

    @IsNumber()
    height!: number;
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

