import { describe, expect, it } from 'vitest';
import { resolveBetrayalRoomSoundSurface } from '../roomSurfaceConfig';

describe('Betrayal room sound surfaces', () => {
    it('maps only the visually verified fixed starting rooms', () => {
        expect(resolveBetrayalRoomSoundSurface('grand-staircase', 'startTriple')).toBe('wood');
        expect(resolveBetrayalRoomSoundSurface('hallway', 'startHallway')).toBe('carpet');
        expect(resolveBetrayalRoomSoundSurface('entrance-hall', 'startTriple')).toBe('carpet');
        expect(resolveBetrayalRoomSoundSurface('upper-landing', 'upperLanding')).toBe('wood');
        expect(resolveBetrayalRoomSoundSurface('basement-landing', 'basementLanding')).toBe('hard-ground');
    });

    it('uses a neutral generic surface for unknown or mismatched visuals', () => {
        expect(resolveBetrayalRoomSoundSurface('new-room', 'startTriple')).toBe('generic');
        expect(resolveBetrayalRoomSoundSurface('grand-staircase', 'startHallway')).toBe('generic');
        expect(resolveBetrayalRoomSoundSurface('study', 'study')).toBe('generic');
    });
});
