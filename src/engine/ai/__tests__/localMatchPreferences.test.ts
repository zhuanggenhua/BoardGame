import { describe, expect, it } from 'vitest';
import {
    createDefaultLocalMatchPreferences,
    normalizeLocalMatchPreferences,
    stripAiSeatsFromLocalMatchPreferences,
    type LocalMatchPreferences,
} from '../localMatchPreferences';
import type { GameManifestEntry } from '../../../shared/gameManifest.types';

const defaultSetupManifest: GameManifestEntry = {
    id: 'test-card-game',
    type: 'game',
    enabled: true,
    titleKey: 'games.test-card-game.title',
    descriptionKey: 'games.test-card-game.description',
    category: 'card',
    playersKey: 'games.test-card-game.players',
    icon: '🎲',
    allowLocalMode: false,
    playerOptions: [2, 3, 4],
    setupOptions: {
        expansions: {
            type: 'multi-select',
            labelKey: 'games.test-card-game.setup.expansions.label',
            options: [
                { value: 'core', labelKey: 'games.test-card-game.setup.expansions.core' },
                { value: 'advanced', labelKey: 'games.test-card-game.setup.expansions.advanced' },
                { value: 'custom', labelKey: 'games.test-card-game.setup.expansions.custom' },
            ],
            default: ['core', 'advanced', 'custom'],
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
            minimumActionDelayMs: 3000,
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
            minimumActionDelayMs: 3000,
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

    it('首次创建会保留 manifest 声明的 setup 默认值', () => {
        const normalized = createDefaultLocalMatchPreferences(defaultSetupManifest);

        expect(normalized.minimumActionDelayMs).toBe(1000);
        expect(normalized.setupSelections).toEqual({
            expansions: ['core', 'advanced', 'custom'],
        });
    });

    it('manifest 可声明首次本地开局默认把所有非本地座位设为 AI，避免合作局空座卡住', () => {
        const normalized = createDefaultLocalMatchPreferences({
            id: 'cooperative-test-game',
            type: 'game',
            enabled: true,
            titleKey: 'games.cooperative-test-game.title',
            descriptionKey: 'games.cooperative-test-game.description',
            category: 'card',
            playersKey: 'games.cooperative-test-game.players',
            icon: '🃏',
            allowLocalMode: true,
            playerOptions: [3, 4, 5, 6],
            ai: {
                capture: true,
                localAi: true,
                remoteAi: false,
                defaultLocalAiSeats: 'all-opponents',
            },
        });

        expect(normalized.numPlayers).toBe(3);
        expect(normalized.seatControllers).toEqual({
            '0': { type: 'human' },
            '1': { type: 'local-ai', difficulty: 'normal' },
            '2': { type: 'local-ai', difficulty: 'normal' },
        });
    });

    it('手动关闭可选 setup 后，不会在后续归一化时被重新打开', () => {
        const normalized = normalizeLocalMatchPreferences(defaultSetupManifest, {
            numPlayers: 2,
            minimumActionDelayMs: 2000,
            setupSelections: {
                expansions: ['core'],
            },
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'human' },
            },
        });

        expect(normalized.minimumActionDelayMs).toBe(2000);
        expect(normalized.setupSelections).toEqual({
            expansions: ['core'],
        });
    });
});
