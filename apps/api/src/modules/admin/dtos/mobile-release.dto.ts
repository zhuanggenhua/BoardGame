import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export type AndroidOtaChannel = 'stable' | 'gray' | 'edge';
export type AndroidVersionBump = 'patch' | 'minor' | 'major';

const parseBoolean = (value: unknown): boolean | undefined => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
};

export class AndroidOtaReleaseDto {
    @IsIn(['stable', 'gray', 'edge'])
    channel!: AndroidOtaChannel;

    @IsOptional()
    @IsString()
    @MaxLength(96)
    @Matches(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(?:-ota-[0-9TZ.-]+)?$/)
    version?: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    @Matches(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/)
    otaVersionBase?: string;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    forceUpdate?: boolean;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    dryRun?: boolean;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    skipLatest?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    forceUpdateTitle?: string;

    @IsOptional()
    @IsString()
    @MaxLength(160)
    forceUpdateMessage?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    notes?: string;
}

export class AndroidNativeReleaseDto {
    @IsIn(['stable', 'gray', 'edge'])
    channel!: AndroidOtaChannel;

    @IsOptional()
    @IsIn(['patch', 'minor', 'major'])
    bump?: AndroidVersionBump;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    dryRun?: boolean;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    skipLatest?: boolean;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    skipBuild?: boolean;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    forceUpdate?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    notes?: string;
}

export class AndroidGamePackageReleaseDto {
    @IsIn(['stable', 'gray', 'edge'])
    channel!: AndroidOtaChannel;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    @Matches(/^[a-z0-9][a-z0-9._-]*$/i)
    gameId?: string;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    dryRun?: boolean;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    manifestOnly?: boolean;
}

export class DeployRollbackPreviewDto {
    @IsIn(['rollback-last', 'rollback'])
    action!: 'rollback-last' | 'rollback';

    @IsOptional()
    @IsString()
    @MaxLength(80)
    @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
    tag?: string;
}

export class DeployRollbackExecuteDto extends DeployRollbackPreviewDto {
    @IsString()
    @MaxLength(20)
    confirmText!: string;
}

export class DeployUpdatePreviewDto {
    @IsOptional()
    @IsString()
    @MaxLength(80)
    @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
    tag?: string;

    @IsOptional()
    @IsIn(['stable', 'gray', 'edge'])
    channel?: AndroidOtaChannel;

    @IsOptional()
    @IsString()
    @MaxLength(96)
    @Matches(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(?:-ota-[0-9TZ.-]+)?$/)
    version?: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    @Matches(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/)
    otaVersionBase?: string;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    forceUpdate?: boolean;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => parseBoolean(value))
    @IsBoolean()
    skipLatest?: boolean;
}

export class DeployUpdateExecuteDto extends DeployUpdatePreviewDto {
    @IsString()
    @MaxLength(20)
    confirmText!: string;
}
