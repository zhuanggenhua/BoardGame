import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSettingsController } from './user-settings.controller';
import { UserSettingsService } from './user-settings.service';
import { UserAudioSettings, UserAudioSettingsSchema } from './schemas/user-audio-settings.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: UserAudioSettings.name, schema: UserAudioSettingsSchema },
        ]),
    ],
    controllers: [UserSettingsController],
    providers: [UserSettingsService],
    exports: [UserSettingsService],
})
export class UserSettingsModule {}
