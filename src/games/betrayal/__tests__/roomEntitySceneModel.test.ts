import { describe, expect, it } from 'vitest';
import { GIRL_ROOM_SLOT, resolveRoomEntitySlots } from '../roomEntitySceneModel';

describe('room entity scene layout', () => {
    it('uses stable seat order, independent of current-player projection order', () => {
        const ids = ['player:2', 'monster:b', 'player:0', 'player:1'];
        expect(resolveRoomEntitySlots(ids)).toEqual(resolveRoomEntitySlots([...ids].reverse()));
    });
    it('reserves a distinct girl slot beside four figures without overlapping them', () => {
        const ids = ['player:2', 'monster:mummy', 'player:0', 'player:1'];
        const slots = resolveRoomEntitySlots(ids, true);
        const girl = slots.get(GIRL_ROOM_SLOT)!;
        expect(slots.size).toBe(5);
        expect(girl.x + girl.size).toBeLessThanOrEqual(184);
        expect(girl.y + girl.size).toBeLessThanOrEqual(184);
        for (const id of ids) {
            const figure = slots.get(id)!;
            expect(
                girl.x + girl.size <= figure.x || figure.x + figure.size <= girl.x ||
                girl.y + girl.size <= figure.y || figure.y + figure.size <= girl.y,
            ).toBe(true);
        }
        expect(resolveRoomEntitySlots([ids[0]], true).has(GIRL_ROOM_SLOT)).toBe(false);
    });
    it('keeps all pieces separate and inside a room for the normal nine-piece capacity', () => {
        for (let count = 1; count <= 9; count++) {
            const slots = [...resolveRoomEntitySlots(Array.from({ length: count }, (_, i) => `player:${i}`)).values()];
            for (const slot of slots) {
                expect(slot.size).toBeGreaterThanOrEqual(44);
                expect(slot.x).toBeGreaterThanOrEqual(0);
                expect(slot.y).toBeGreaterThanOrEqual(0);
                expect(slot.x + slot.size).toBeLessThanOrEqual(184);
                expect(slot.y + slot.size).toBeLessThanOrEqual(184);
            }
            for (let a = 0; a < slots.length; a++) for (let b = a + 1; b < slots.length; b++) {
                const left = slots[a]; const right = slots[b];
                expect(left.x + left.size <= right.x || right.x + right.size <= left.x || left.y + left.size <= right.y || right.y + right.size <= left.y).toBe(true);
            }
        }
    });
});
