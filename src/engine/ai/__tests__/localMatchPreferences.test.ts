import { describe, expect, it } from 'vitest';
import {
    createDefaultLocalMatchPreferences,
    normalizeLocalMatchPreferences,
    stripAiSeatsFromLocalMatchPreferences,
    type LocalMatchPreferences,
} from '../localMatchPreferences';
import type { GameManifestEntry } from '../../../shared/gameManifest.types';

const smashupManifest: GameManifestEntry = {
    id: 'smashup',
    type: 'game',
    enabled: true,
    titleKey: 'games.smashup.title',
    descriptionKey: 'games.smashup.description',
    category: 'card',
    playersKey: 'games.smashup.players',
    icon: '🎲',
    allowLocalMode: false,
    playerOptions: [2, 3, 4],
    setupOptions: {
        expansions: {
            type: 'multi-select',
            labelKey: 'games.smashup.setup.expansions.label',
            options: [
                { value: 'titans', labelKey: 'games.smashup.setup.expansions.titans' },
                { value: 'diy', labelKey: 'games.smashup.setup.expansions.diy' },
            ],
            default: ['titans', 'diy'],
        },
    },
    ai: {
        capture: true,
        localAi: true,
        remoteAi: false,
    },
};

describe('localMatchPreferences create-room sanitization', () => {
    it('会移除 AI 座位与 manualFactionSelection，只保留人数和 setup 选择', () => {
        const preferences: LocalMatchPreferences = {
            numPlayers: 4,
            setupSelections: {
                expansions: ['titans'],
            },
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', difficulty: 'hard', manualFactionSelection: true },
                '2': { type: 'remote-ai', providerId: 'astrbot', manualFactionSelection: true },
                '3': { type: 'local-ai', difficulty: 'normal' },
            },
        };

        const sanitized = stripAiSeatsFromLocalMatchPreferences(preferences);

        expect(sanitized).toEqual({
            numPlayers: 4,
            setupSelections: {
                expansions: ['titans'],
            },
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'human' },
                '2': { type: 'human' },
                '3': { type: 'human' },
            },
        });
        expect(preferences.seatControllers['1']).toEqual({
            type: 'local-ai',
            difficulty: 'hard',
            manualFactionSelection: true,
        });
    });

    it('Smash Up 首次创建默认开启 diy 扩展', () => {
        const normalized = createDefaultLocalMatchPreferences(smashupManifest);

        expect(normalized.setupSelections).toEqual({
            expansions: ['titans', 'diy'],
        });
    });

    it('Smash Up 手动关闭 diy 后，不会在后续归一化时被重新打开', () => {
        const normalized = normalizeLocalMatchPreferences(smashupManifest, {
            numPlayers: 2,
            setupSelections: {
                expansions: ['titans'],
            },
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'human' },
            },
        });

        expect(normalized.setupSelections).toEqual({
            expansions: ['titans'],
        });
    });
});
