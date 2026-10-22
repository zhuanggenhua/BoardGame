import { IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';

export class GameSubmissionDto {
    @IsString() @MinLength(1) @MaxLength(100) name!: string;
    @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(2048) url!: string;
    @IsIn(['card', 'dice', 'abstract', 'wargame', 'casual', 'tools']) category!: string;
    @IsInt() @Min(1) @Max(100) minPlayers!: number;
    @IsInt() @Min(1) @Max(100) maxPlayers!: number;
    @IsOptional() @IsInt() @Min(1) @Max(1440) durationMinutes?: number;
    @IsString() @MaxLength(100) author!: string;
    @IsString() @MinLength(1) @MaxLength(10000) description!: string;
    @IsString() @MaxLength(50000) rules!: string;
}
