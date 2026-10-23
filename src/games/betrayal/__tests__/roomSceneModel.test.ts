import { describe, expect, it } from 'vitest';
import { resolveBetrayalRoomSceneSprites } from '../roomSceneModel';
import { resolveRoomCanvasLayout, resolveRoomTileStyle } from '../roomMapModel';
import { resolveBetrayalRoomNodeTileVisual } from '../roomAtlas';
import { createStartedFirstScenarioCore } from './helpers/firstScenarioRuntimeHarness';

describe('Betrayal room scene projection', () => {
    it('uses the correct left, middle and right artwork for the three starting rooms', () => {
        const core = createStartedFirstScenarioCore();
        for (const [id, frameIndex] of [['grand-staircase', 0], ['hallway', 1], ['entrance-hall', 2]] as const) {
            const room = core.rooms.find(candidate => candidate.id === id)!;
            expect(resolveBetrayalRoomNodeTileVisual(room, true)).toMatchObject({
                image: 'betrayal/rooms/start-triple-room', frameIndex,
            });
        }
    });
    it('does not reveal the entrance front while hidden or override a different authored visual', () => {
        const room = createStartedFirstScenarioCore().rooms.find(candidate => candidate.id === 'entrance-hall')!;
        expect(resolveBetrayalRoomNodeTileVisual(room, false)).toMatchObject({ image: 'betrayal/rooms/room-back-atlas', frameIndex: 4 });
        expect(resolveBetrayalRoomNodeTileVisual({ ...room, visualId: 'library' }, true)).toMatchObject({ image: 'betrayal/rooms/room-front-atlas', frameIndex: 25 });
    });
    it('projects the canonical room geometry without changing the core', () => {
        const core = createStartedFirstScenarioCore();
        const before = structuredClone(core);
        const rooms = core.rooms.filter(room => room.floor === 'ground');
        const layout = resolveRoomCanvasLayout(rooms);
        const sprites = resolveBetrayalRoomSceneSprites(rooms, layout, 'zh-CN');
        expect(sprites).toHaveLength(rooms.length);
        for (const room of rooms) {
            const sprite = sprites.find(candidate => candidate.id === room.id)!;
            const rect = resolveRoomTileStyle(room, layout);
            expect(sprite.x + sprite.width / 2).toBeCloseTo(rect.left + rect.width / 2);
            expect(sprite.y + sprite.height / 2).toBeCloseTo(rect.top + rect.height / 2);
            expect(sprite.width).toBeLessThanOrEqual(rect.width);
            expect(sprite.height).toBeLessThanOrEqual(rect.height);
            expect(sprite.textureUrls.length).toBeGreaterThan(0);
        }
        expect(core).toEqual(before);
    });

    it('keeps atlas crop coordinates normalized, including the three-room starting board', () => {
        const core = createStartedFirstScenarioCore();
        const rooms = core.rooms.filter(room => room.state === 'discovered' && room.floor === 'ground');
        const sprites = resolveBetrayalRoomSceneSprites(rooms, resolveRoomCanvasLayout(rooms), 'zh-CN');
        for (const [index, room] of rooms.entries()) {
            const visual = resolveBetrayalRoomNodeTileVisual(room, true);
            if (visual.image.endsWith('start-triple-room')) {
                expect(sprites[index].frame?.width).toBeCloseTo(1 / 3);
                expect(sprites[index].frame?.x).toBeCloseTo(visual.frameIndex / 3);
                expect(sprites[index].frame?.height).toBe(1);
            }
        }
        expect(sprites.filter(sprite => sprite.frame?.width === 1 / 3)).toHaveLength(3);
    });
});
