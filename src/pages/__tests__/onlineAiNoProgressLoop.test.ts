import { describe, expect, it } from 'vitest';
import type { AiResolution } from '../../engine/ai';
import type { MatchState } from '../../engine/types';
import {
    ONLINE_AI_NO_PROGRESS_FORCE_END_THRESHOLD,
    buildOnlineAiEffectiveProgressMarker,
    resolveOnlineAiNoProgressLoopTracker,
    shouldForceEndOnlineAiNoProgressLoop,
    type OnlineAiNoProgressLoopTracker,
} from '../onlineAiNoProgressLoop';

const buildState = (overrides?: {
    phase?: string;
    nextId?: number;
    interactionId?: string | null;
    attackCount?: number;
}): MatchState<unknown> => ({
    core: {
        currentPlayer: '1',
        players: {
            '1': {
                attackCount: overrides?.attackCount ?? 0,
            },
        },
    },
    sys: {
        phase: overrides?.phase ?? 'attack',
        turnNumber: 3,
        decisionEpoch: overrides?.nextId ?? 1,
        eventStream: {
            nextId: overrides?.nextId ?? 1,
            entries: [],
        },
        interaction: overrides?.interactionId
            ? {
                current: {
                    id: overrides.interactionId,
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        sourceId: 'sw-before-attack-healing',
                        options: [{ id: 'card-a', disabled: false }],
                    },
                },
            }
            : undefined,
    },
}) as MatchState<unknown>;

const resolution: AiResolution = {
    playerId: '1',
    attemptKey: 'attempt',
    source: 'local-ai',
    action: {
        actionId: 'attack:temple-priest:stonethrower',
        kind: 'declare-attack',
        label: '攻击',
        commands: [{ type: 'sw:declare_attack', payload: {} }],
    },
};

describe('online AI 无有效推进循环检测', () => {
    it('忽略事件流和交互壳层变化，只看核心局面是否推进', () => {
        const before = buildState({ nextId: 10, interactionId: null });
        const after = buildState({ nextId: 11, interactionId: 'healing-choice' });

        expect(buildOnlineAiEffectiveProgressMarker({ state: after }))
            .toBe(buildOnlineAiEffectiveProgressMarker({ state: before }));
    });

    it('同一核心局面连续 5 次无推进后，应触发强制结束', () => {
        let tracker: OnlineAiNoProgressLoopTracker | null = null;
        const before = buildState({ nextId: 10 });
        const after = buildState({ nextId: 11, interactionId: 'healing-choice' });

        for (let i = 1; i <= ONLINE_AI_NO_PROGRESS_FORCE_END_THRESHOLD; i += 1) {
            const result = resolveOnlineAiNoProgressLoopTracker({
                current: tracker,
                beforeState: before,
                afterState: after,
                playerId: '1',
                resolution,
                commandTypes: ['sw:declare_attack'],
                now: i,
            });
            tracker = result.nextTracker;
            expect(result.didProgress).toBe(false);
            expect(result.shouldForceEnd).toBe(i >= ONLINE_AI_NO_PROGRESS_FORCE_END_THRESHOLD);
        }

        expect(shouldForceEndOnlineAiNoProgressLoop({
            tracker,
            state: after,
            playerId: '1',
        })).toBe(true);
    });

    it('核心局面推进后会清空循环计数，避免误杀正常动作', () => {
        const before = buildState({ attackCount: 0 });
        const after = buildState({ attackCount: 1, nextId: 12 });

        const result = resolveOnlineAiNoProgressLoopTracker({
            current: {
                key: 'old',
                count: 4,
                playerId: '1',
                actionKind: 'declare-attack',
                actionId: 'attack',
                commandTypes: ['sw:declare_attack'],
                updatedAt: 1,
            },
            beforeState: before,
            afterState: after,
            playerId: '1',
            resolution,
            commandTypes: ['sw:declare_attack'],
        });

        expect(result.didProgress).toBe(true);
        expect(result.nextTracker).toBeNull();
        expect(result.shouldForceEnd).toBe(false);
    });
});
