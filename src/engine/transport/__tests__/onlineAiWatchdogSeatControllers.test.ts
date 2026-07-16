import { describe, expect, it } from 'vitest';
import {
    extractSetupSeatControllers,
    resolveOnlineAiWatchdogSeatControllers,
} from '../onlineAiWatchdogSeatControllers';

describe('onlineAiWatchdogSeatControllers', () => {
    it('显式 enableAi=false 时 watchdog 应忽略残留 AI 座位定义', () => {
        const resolved = resolveOnlineAiWatchdogSeatControllers({
            gameId: 'custom-manual-setup-game',
            playerIds: ['0', '1'],
            setupData: {
                enableAi: false,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'stale-ai-policy' },
                },
            },
            state: {
                core: {
                    seatControllers: {
                        '1': { type: 'local-ai', policyId: 'stale-state-policy' },
                    },
                },
            } as any,
            gameManifests: {
                'custom-manual-setup-game': {
                    ai: {
                        capture: true,
                        localAi: true,
                        remoteAi: false,
                    },
                },
            },
        });

        expect(resolved.hasAiSeat).toBe(false);
        expect(resolved.seatControllers).toEqual({
            '0': { type: 'human' },
            '1': { type: 'human' },
        });
    });

    it('应保留 setupData 里的 manualSetupSelection 别名，供 watchdog 链路继续使用', () => {
        const setupData = {
            seatControllers: {
                '0': { type: 'human' },
                '1': {
                    type: 'local-ai',
                    policyId: 'manualSetupSelectionPolicy',
                    manualSetupSelection: true,
                },
            },
        };

        expect(extractSetupSeatControllers(setupData)?.['1']).toMatchObject({
            type: 'local-ai',
            policyId: 'manualSetupSelectionPolicy',
            manualSetupSelection: true,
        });

        const resolved = resolveOnlineAiWatchdogSeatControllers({
            gameId: 'custom-manual-setup-game',
            playerIds: ['0', '1'],
            setupData,
            gameManifests: {
                'custom-manual-setup-game': {
                    ai: {
                        capture: true,
                        localAi: true,
                        remoteAi: false,
                    },
                },
            },
        });

        expect(resolved.hasAiSeat).toBe(true);
        expect(resolved.seatControllers['1']).toMatchObject({
            type: 'local-ai',
            policyId: 'manualSetupSelectionPolicy',
            manualSetupSelection: true,
            manualFactionSelection: true,
        });
    });
});
