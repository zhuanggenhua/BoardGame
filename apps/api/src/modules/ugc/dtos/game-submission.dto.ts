import { IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class GameSubmissionDetailsDto {
    @IsOptional() @IsString() @MaxLength(100) name?: string;
    @IsOptional() @IsIn(['card', 'dice', 'abstract', 'wargame', 'casual', 'tools', 'uncategorized']) category?: string;
    @IsOptional() @IsInt() @Min(1) @Max(100) minPlayers?: number;
    @IsOptional() @IsInt() @Min(1) @Max(100) maxPlayers?: number;
    @IsOptional() @IsInt() @Min(1) @Max(1440) durationMinutes?: number;
    @IsOptional() @IsString() @MaxLength(100) author?: string;
    @IsOptional() @IsUrl({ protocols: ['https', 'http'], require_protocol: true }) @MaxLength(2048) authorProfileUrl?: string;
    @IsOptional() @IsString() @MaxLength(10000) description?: string;
    @IsOptional() @IsString() @MaxLength(50000) rules?: string;
}

export class GameSubmissionDto extends GameSubmissionDetailsDto {
    @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(2048) url!: string;
}
