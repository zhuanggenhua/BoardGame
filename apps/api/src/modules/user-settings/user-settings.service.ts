import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { AudioSettingsPayload } from './dtos/audio-settings.dto';
import { UserAudioSettings, type UserAudioSettingsDocument } from './schemas/user-audio-settings.schema';
import { UserUISettings, type UserUISettingsDocument } from './schemas/user-ui-settings.schema';

@Injectable()
export class UserSettingsService {
    constructor(
        @InjectModel(UserAudioSettings.name)
        private readonly audioSettingsModel: Model<UserAudioSettingsDocument>,
        @InjectModel(UserUISettings.name)
        private readonly uiSettingsModel: Model<UserUISettingsDocument>,
    ) {}

    async getAudioSettings(userId: string): Promise<UserAudioSettingsDocument | null> {
        return this.audioSettingsModel.findOne({ userId });
    }

    async upsertAudioSettings(
        userId: string,
        settings: AudioSettingsPayload
    ): Promise<UserAudioSettingsDocument> {
        const normalizedSelections = normalizeBgmSelections(settings.bgmSelections);
        return this.audioSettingsModel.findOneAndUpdate(
            { userId },
            {
                $set: {
                    muted: settings.muted,
                    masterVolume: settings.masterVolume,
                    sfxVolume: settings.sfxVolume,
                    bgmVolume: settings.bgmVolume,
                    bgmSelections: normalizedSelections,
                    singleTrackLoop: settings.singleTrackLoop === true,
                },
                $setOnInsert: { userId },
            },
            { new: true, upsert: true }
        );
    }

    async getSeenHints(userId: string): Promise<string[]> {
        const doc = await this.uiSettingsModel.findOne({ userId });
        return doc?.seenHints ?? [];
    }

    async markHintSeen(userId: string, hintKey: string): Promise<void> {
        await this.uiSettingsModel.findOneAndUpdate(
            { userId },
            { $addToSet: { seenHints: hintKey }, $setOnInsert: { userId } },
            { upsert: true }
        );
    }

    async getCursorPreference(userId: string): Promise<{
        cursorTheme: string;
        overrideScope: string;
        highContrast: boolean;
        gameVariants: Record<string, string>;
    } | null> {
        const doc = await this.uiSettingsModel.findOne({ userId });
        if (!doc || (!doc.cursorTheme && !doc.cursorOverrideScope)) return null;
        return {
            cursorTheme: doc.cursorTheme || 'default',
            overrideScope: doc.cursorOverrideScope || 'home',
            highContrast: doc.cursorHighContrast === true,
            gameVariants: (doc.cursorGameVariants && typeof doc.cursorGameVariants === 'object')
                ? doc.cursorGameVariants
                : {},
        };
    }

    async upsertCursorPreference(
        userId: string,
        cursorTheme: string,
        overrideScope: string,
        highContrast: boolean,
        gameVariants: Record<string, string>,
    ): Promise<void> {
        await this.uiSettingsModel.findOneAndUpdate(
            { userId },
            {
                $set: {
                    cursorTheme,
                    cursorOverrideScope: overrideScope,
                    cursorHighContrast: highContrast,
                    cursorGameVariants: gameVariants,
                },
                $setOnInsert: { userId },
            },
            { upsert: true }
        );
    }

    async getLocalAiMatchPreference(userId: string, gameId: string): Promise<{
        numPlayers: number;
        seatControllers?: Record<string, unknown>;
        setupSelections?: Record<string, string | string[]>;
    } | null> {
        const doc = await this.uiSettingsModel.findOne({ userId });
        const preferences = doc?.localAiMatchPreferences;
        if (!preferences || typeof preferences !== 'object') {
            return null;
        }
        const record = preferences[gameId];
        if (!record || typeof record !== 'object') {
            return null;
        }
        return normalizeLocalAiMatchPreferenceRecord(record);
    }

    async getSmashUpPreference(userId: string): Promise<{
        overlayEnabled: boolean;
        interactionMode: 'click' | 'drag';
    } | null> {
        const doc = await this.uiSettingsModel.findOne({ userId });
        if (!doc || doc.smashupPreferenceInitialized !== true) return null;
        return {
            overlayEnabled: doc.smashupOverlayEnabled !== false,
            interactionMode: doc.smashupInteractionMode === 'drag' ? 'drag' : 'click',
        };
    }

    async upsertLocalAiMatchPreference(
        userId: string,
        gameId: string,
        settings: {
            numPlayers: number;
            seatControllers?: Record<string, unknown>;
            setupSelections?: Record<string, string | string[]>;
        },
    ): Promise<void> {
        await this.uiSettingsModel.findOneAndUpdate(
            { userId },
            {
                $set: {
                    [`localAiMatchPreferences.${gameId}`]: normalizeLocalAiMatchPreferenceRecord(settings),
                },
                $setOnInsert: { userId },
            },
            { upsert: true },
        );
    }

    async upsertSmashUpPreference(
        userId: string,
        overlayEnabled: boolean,
        interactionMode: 'click' | 'drag',
    ): Promise<void> {
        await this.uiSettingsModel.findOneAndUpdate(
            { userId },
            {
                $set: {
                    smashupPreferenceInitialized: true,
                    smashupOverlayEnabled: overlayEnabled,
                    smashupInteractionMode: interactionMode,
                },
                $setOnInsert: { userId },
            },
            { upsert: true }
        );
    }
}

function normalizeBgmSelections(
    input?: Record<string, Record<string, string>>
): Record<string, Record<string, string>> {
    if (!input || typeof input !== 'object') return {};
    const result: Record<string, Record<string, string>> = {};
    for (const [gameId, groups] of Object.entries(input)) {
        if (!groups || typeof groups !== 'object') continue;
        const normalizedGroups: Record<string, string> = {};
        for (const [groupId, key] of Object.entries(groups)) {
            if (typeof key === 'string') {
                normalizedGroups[groupId] = key;
            }
        }
        if (Object.keys(normalizedGroups).length > 0) {
            result[gameId] = normalizedGroups;
        }
    }
    return result;
}

function normalizeLocalAiMatchPreferenceRecord(input: {
    numPlayers?: unknown;
    seatControllers?: Record<string, unknown>;
    setupSelections?: Record<string, string | string[]>;
}): {
    numPlayers: number;
    seatControllers?: Record<string, unknown>;
    setupSelections?: Record<string, string | string[]>;
} {
    const numPlayersRaw = typeof input.numPlayers === 'number' ? input.numPlayers : Number(input.numPlayers);
    const numPlayers = Number.isInteger(numPlayersRaw) && numPlayersRaw > 0 ? numPlayersRaw : 2;

    const seatControllers = normalizePlainRecord(input.seatControllers);
    const setupSelections = normalizeSetupSelectionsRecord(input.setupSelections);

    return {
        numPlayers,
        ...(seatControllers ? { seatControllers } : {}),
        ...(setupSelections ? { setupSelections } : {}),
    };
}

function normalizePlainRecord(input?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
        if (typeof key === 'string' && value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = value;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeSetupSelectionsRecord(
    input?: Record<string, string | string[]>,
): Record<string, string | string[]> | undefined {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
    const result: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'string') {
            result[key] = value;
            continue;
        }
        if (Array.isArray(value)) {
            result[key] = value.filter((item): item is string => typeof item === 'string');
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
