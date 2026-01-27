import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateReviewDto {
    @IsBoolean()
    isPositive!: boolean;

    @IsOptional()
    @IsString()
    content?: string;
}
