import { describe, expect, it } from 'vitest';
import { resolveGameHudLayout } from '../gameHudLayout';
import type { GameHudLayoutInput, GameHudLayoutResolver } from '../../components/game/framework/widgets/gameHudLayout';

const input: GameHudLayoutInput = { viewportWidth: 390, viewportHeight: 844, isSetupPhase: false, state: {} };

describe('game HUD layout ownership', () => {
    it('uses an explicitly loaded adapter without consulting the runtime registry', () => {
        const custom: GameHudLayoutResolver = () => ({ position: 'top-left', storageKey: 'custom' });
        expect(resolveGameHudLayout('new-game', custom)?.(input)).toEqual({ position: 'top-left', storageKey: 'custom' });
        expect(resolveGameHudLayout('new-game')).toBeUndefined();
    });
    it('retains legacy character selection and portrait placement in the game layer', () => {
        expect(resolveGameHudLayout('betrayal')?.({ ...input, state: { core: { phase: 'characterSelect' } } }).position).toBe('top-right');
        expect(resolveGameHudLayout('betrayal')?.(input).position).toBe('bottom-right');
        expect(resolveGameHudLayout('tictactoe')?.(input).position).toBe('top-right');
        expect(resolveGameHudLayout('tictactoe')?.({ ...input, viewportWidth: 1000 }).position).toBeUndefined();
    });
});
