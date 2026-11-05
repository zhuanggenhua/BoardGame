/** Surface descriptions are display data tied to verified room artwork, not floor/material inference. */
export type BetrayalRoomSoundSurface = 'carpet' | 'wood' | 'hard-ground' | 'generic';

const VERIFIED_FIXED_ROOM_SURFACES: Readonly<Record<string, { visualId: string; surface: BetrayalRoomSoundSurface }>> = {
    // start-triple-room: the ground-floor staircase is wooden steps; hallway and entrance hall are carpet.
    'grand-staircase': { visualId: 'startTriple', surface: 'wood' },
    hallway: { visualId: 'startHallway', surface: 'carpet' },
    'entrance-hall': { visualId: 'startTriple', surface: 'carpet' },
    'upper-landing': { visualId: 'upperLanding', surface: 'wood' },
    // Stone/block artwork is represented by the neutral hard-ground sound pool; this does not assert concrete.
    'basement-landing': { visualId: 'basementLanding', surface: 'hard-ground' },
};

/** Unknown or mismatched visuals stay generic; room names never imply a material. */
export function resolveBetrayalRoomSoundSurface(roomId: string, visualId: string): BetrayalRoomSoundSurface {
    const fixedRoom = VERIFIED_FIXED_ROOM_SURFACES[roomId];
    return fixedRoom?.visualId === visualId ? fixedRoom.surface : 'generic';
}
