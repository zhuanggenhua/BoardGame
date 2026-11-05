import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';
import { GameSubmissionDto } from './game-submission.dto';

export class ExternalGameEditDto extends GameSubmissionDto {
    @IsBoolean() published!: boolean;
}
export class CreateCreatorClaimDto {
    @IsString() @MinLength(1) @MaxLength(100) gameId!: string;
    @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2048) profileUrl!: string;
    @IsString() @MinLength(10) @MaxLength(4000) explanation!: string;
}
export class ReviewCreatorClaimDto {
    @IsIn(['approved', 'rejected']) decision!: 'approved' | 'rejected';
    @IsString() @MinLength(5) @MaxLength(2000) comment!: string;
    @IsBoolean() profileControlVerified!: boolean;
    @IsBoolean() gameRelationshipVerified!: boolean;
    @IsString() @MaxLength(64) evidenceDigest!: string;
}
export class ReviewSubmissionDto {
    @IsIn(['approved', 'rejected']) decision!: 'approved' | 'rejected';
    @IsString() @MinLength(1) @MaxLength(2000) comment!: string;
    @IsDateString() revision!: string;
}
export class CheckEmbedDto {
    @IsIn(['unknown', 'allowed', 'blocked']) status!: 'unknown' | 'allowed' | 'blocked';
    @IsString() @MaxLength(2000) reason!: string;
    @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) url!: string;
}
export class PlayHeartbeatDto {
    @IsInt() @Min(1) sequence!: number;
    @IsBoolean() active!: boolean;
    @IsInt() @Min(0) @Max(20_000) elapsedMs!: number;
    @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) offsetMs!: number;
    @IsOptional() @IsBoolean() ended?: boolean;
}
