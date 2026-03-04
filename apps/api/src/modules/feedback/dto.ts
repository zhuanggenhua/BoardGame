import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { FeedbackSeverity, FeedbackStatus, FeedbackType } from './feedback.schema';

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
    @MaxLength(500000) // 状态 JSON 可能较大
    stateSnapshot?: string;
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
}

export class FeedbackFilterDto {
    @IsOptional()
    @IsEnum(FeedbackStatus)
    status?: FeedbackStatus;

    @IsOptional()
    @IsEnum(FeedbackType)
    type?: FeedbackType;
}

export class BulkFeedbackIdsDto {
    @IsArray()
    @IsString({ each: true })
    ids: string[] = [];
}
