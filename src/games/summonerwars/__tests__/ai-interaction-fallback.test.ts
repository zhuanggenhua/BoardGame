import { describe, expect, it } from 'vitest';

import { buildSummonerWarsAiLegalActions } from '../ai';

describe('Summoner Wars AI 交互兜底', () => {
    it('未知阻塞交互属于 AI 时应生成带 interactionId 的紧急取消动作', () => {
        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: {
                core: {},
                sys: {
                    interaction: {
                        current: {
                            id: 'sw-custom-blocker',
                            playerId: '0',
                            kind: 'sw:future-choice',
                            data: { sourceId: 'future-choice' },
                        },
                        queue: [],
                    },
                },
            } as any,
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]).toMatchObject({
            kind: 'interaction-cancel',
            commands: [{
                type: 'SYS_INTERACTION_CANCEL',
                payload: {
                    interactionId: 'sw-custom-blocker',
                    reason: 'missing-support',
                },
            }],
        });
    });

    it('交互属于其他玩家时不应继续生成当前 AI 的阶段动作', () => {
        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: {
                core: { currentPlayer: '0' },
                sys: {
                    interaction: {
                        current: {
                            id: 'sw-other-player-choice',
                            playerId: '1',
                            kind: 'simple-choice',
                            data: {
                                options: [{ id: 'ok', label: '确认' }],
                            },
                        },
                        queue: [],
                    },
                },
            } as any,
        });

        expect(actions).toEqual([]);
    });
});
