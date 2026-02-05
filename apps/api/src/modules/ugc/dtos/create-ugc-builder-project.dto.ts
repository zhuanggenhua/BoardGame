import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateUgcBuilderProjectDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsObject()
    data?: Record<string, unknown>;
}
