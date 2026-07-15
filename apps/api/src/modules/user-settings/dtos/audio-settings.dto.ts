import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, Max, Min } from 'class-validator';

export type AudioSettingsPayload = {
    muted: boolean;
    masterVolume: number;
    sfxVolume: number;
    bgmVolume: number;
    bgmSelections?: Record<string, Record<string, string>>;
    singleTrackLoop?: boolean;
};

export type SmashUpPreferencePayload = {
    overlayEnabled: boolean;
    interactionMode: 'click' | 'drag';
};

export class UpdateAudioSettingsDto {
    @IsBoolean()
    muted!: boolean;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(1)
    masterVolume!: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(1)
    sfxVolume!: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(1)
    bgmVolume!: number;

    @IsOptional()
    @IsObject()
    bgmSelections?: Record<string, Record<string, string>>;

    @IsOptional()
    @IsBoolean()
    singleTrackLoop?: boolean;
}

export class UpdateSmashUpPreferenceDto {
    @IsBoolean()
    overlayEnabled!: boolean;

    @IsIn(['click', 'drag'])
    interactionMode!: 'click' | 'drag';
}
