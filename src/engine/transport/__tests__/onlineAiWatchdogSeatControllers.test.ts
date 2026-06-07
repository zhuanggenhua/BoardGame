import { describe, expect, it } from 'vitest';
import {
    extractSetupSeatControllers,
    resolveOnlineAiWatchdogSeatControllers,
} from '../onlineAiWatchdogSeatControllers';

describe('onlineAiWatchdogSeatControllers', () => {
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
