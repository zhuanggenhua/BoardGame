import { describe, expect, it } from 'vitest';
import { validate } from '../domain/commands';
import { makeMatchState, makeState } from './helpers';

describe('SmashUp command validation', () => {
    it('should return error when command type is missing', () => {
        const core = makeState();
        const ms = makeMatchState(core);

        const result = validate(ms as any, {} as any);
        expect(result.valid).toBe(false);
        expect((result as any).error).toBe('Invalid command: missing type');
    });
});

