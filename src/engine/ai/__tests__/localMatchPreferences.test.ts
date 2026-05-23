import { describe, expect, it } from 'vitest';
import {
    stripAiSeatsFromLocalMatchPreferences,
    type LocalMatchPreferences,
} from '../localMatchPreferences';

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
});
