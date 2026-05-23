import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore } from '../domain';
import { resolveSmashUpLocalPregameControlledPlayerId } from '../localPregameControl';

function buildFactionSelectState(currentPlayerIndex: number): MatchState<SmashUpCore> {
    return {
        core: {
            turnOrder: ['0', '1'],
            currentPlayerIndex,
        } as SmashUpCore,
        sys: {
            phase: 'factionSelect',
        } as MatchState<SmashUpCore>['sys'],
    };
}

describe('resolveSmashUpLocalPregameControlledPlayerId', () => {
    it('没有手动代选 AI 时返回 null', () => {
        expect(resolveSmashUpLocalPregameControlledPlayerId({
            state: buildFactionSelectState(0),
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        })).toBeNull();
    });

    it('存在手动代选 AI 时，应在 factionSelect 阶段跟随当前选手', () => {
        expect(resolveSmashUpLocalPregameControlledPlayerId({
            state: buildFactionSelectState(0),
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
        })).toBe('0');

        expect(resolveSmashUpLocalPregameControlledPlayerId({
            state: buildFactionSelectState(1),
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
        })).toBe('1');
    });

    it('离开 factionSelect 后不再接管 pregame 控制', () => {
        expect(resolveSmashUpLocalPregameControlledPlayerId({
            state: {
                core: {
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 1,
                } as SmashUpCore,
                sys: {
                    phase: 'playCards',
                } as MatchState<SmashUpCore>['sys'],
            },
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
        })).toBeNull();
    });
});
