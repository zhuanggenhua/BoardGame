import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateUgcBuilderProjectDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsObject()
    data?: Record<string, unknown>;
}
