import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { AudioSettingsPayload } from './dtos/audio-settings.dto';
import { UserAudioSettings, type UserAudioSettingsDocument } from './schemas/user-audio-settings.schema';

@Injectable()
export class UserSettingsService {
    constructor(
        @InjectModel(UserAudioSettings.name)
        private readonly audioSettingsModel: Model<UserAudioSettingsDocument>,
    ) {}

    async getAudioSettings(userId: string): Promise<UserAudioSettingsDocument | null> {
        return this.audioSettingsModel.findOne({ userId });
    }

    async upsertAudioSettings(
        userId: string,
        settings: AudioSettingsPayload
    ): Promise<UserAudioSettingsDocument> {
        return this.audioSettingsModel.findOneAndUpdate(
            { userId },
            {
                $set: {
                    muted: settings.muted,
                    masterVolume: settings.masterVolume,
                    sfxVolume: settings.sfxVolume,
                    bgmVolume: settings.bgmVolume,
                },
                $setOnInsert: { userId },
            },
            { new: true, upsert: true }
        );
    }
}
