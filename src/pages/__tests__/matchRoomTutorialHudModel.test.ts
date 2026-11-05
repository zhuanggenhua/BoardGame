import { describe, expect, it, vi } from 'vitest';
import { buildTutorialHudModel } from '../matchRoomPageModelBuilders';
import type { MatchRoomPageRuntimeModel } from '../useMatchRoomPageRuntimeModel';
import type { MatchRoomPageIdentityModel } from '../useMatchRoomPageIdentity';

describe('tutorial HUD adapter ownership', () => {
    it('takes the layout resolver from the nested tutorial stage adapter', () => {
        const resolveHudLayout = vi.fn();
        const pageRuntime = {
            tutorialHud: { players: [], isHost: true, isLoading: false },
            stages: { tutorial: { resolveHudLayout } },
        } as unknown as MatchRoomPageRuntimeModel;
        const pageIdentity = { isTutorialRoute: true, gameConfig: undefined } as unknown as MatchRoomPageIdentityModel;
        const model = buildTutorialHudModel({ gameId: 'tictactoe', pageIdentity, pageRuntime });
        expect(model?.resolveHudLayout).toBe(resolveHudLayout);
    });
});
