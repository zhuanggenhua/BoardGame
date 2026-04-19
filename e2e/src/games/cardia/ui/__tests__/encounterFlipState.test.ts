import { describe, expect, it } from 'vitest';

import { getInitialOpponentFlipState, getNextOpponentFlipState } from '../encounterFlipState';

describe('cardia/ui/encounterFlipState', () => {
    it('历史遭遇：初始状态永远明牌', () => {
        expect(getInitialOpponentFlipState({ isLatest: false, opponentCardRevealed: false })).toBe(true);
        expect(getInitialOpponentFlipState({ isLatest: false, opponentCardRevealed: true })).toBe(true);
    });

    it('当前遭遇：若已应揭示，初始直接明牌（避免重挂载错过翻面）', () => {
        expect(getInitialOpponentFlipState({ isLatest: true, opponentCardRevealed: true })).toBe(true);
        expect(getInitialOpponentFlipState({ isLatest: true, opponentCardRevealed: false })).toBe(false);
    });

    it('从当前遭遇变历史遭遇：必须强制明牌', () => {
        expect(getNextOpponentFlipState({
            isLatest: false,
            opponentCardRevealed: false,
            currentFlipState: false,
        })).toBe(true);
    });

    it('当前遭遇：一旦应揭示为 true，翻面保持明牌', () => {
        expect(getNextOpponentFlipState({
            isLatest: true,
            opponentCardRevealed: true,
            currentFlipState: false,
        })).toBe(true);
        expect(getNextOpponentFlipState({
            isLatest: true,
            opponentCardRevealed: true,
            currentFlipState: true,
        })).toBe(true);
    });

    it('当前遭遇：应揭示为 false 时保持现状', () => {
        expect(getNextOpponentFlipState({
            isLatest: true,
            opponentCardRevealed: false,
            currentFlipState: false,
        })).toBe(false);
        expect(getNextOpponentFlipState({
            isLatest: true,
            opponentCardRevealed: false,
            currentFlipState: true,
        })).toBe(true);
    });
});

