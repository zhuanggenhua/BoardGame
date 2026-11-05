import { describe, expect, it } from 'vitest';
import { resolveSceneMovementFacts } from '../sceneMovementModel';
import { createStartedFirstScenarioCore } from './helpers/firstScenarioRuntimeHarness';
import type { EventStreamEntry } from '../../../engine/types';

const rooms = createStartedFirstScenarioCore().rooms;
const move = (id: number, roomId: string): EventStreamEntry => ({ id, event: { type: 'EXPLORER_MOVED', payload: { playerId: '0', roomId, logText: '' }, timestamp: 1 } });
describe('confirmed scene movement facts', () => {
    it('does not animate a click, rejected command, or unrelated state update', () => {
        expect(resolveSceneMovementFacts([], new Map([['player:0', 'entrance-hall']]), rooms)).toEqual([]);
    });
    it('retains separate identities and sources for two same-batch room steps', () => {
        const result = resolveSceneMovementFacts([move(10, 'hallway'), move(11, 'grand-staircase')], new Map([['player:0', 'entrance-hall']]), rooms);
        expect(result).toHaveLength(2);
        expect(result.map(step => step.id)).toEqual(['10', '11']);
        expect(result[1].fromRoomId).toBe('hallway');
        expect(result.every(step => step.kind === 'hop')).toBe(true);
    });
    it('uses arrival/fade rather than a flying path for crossing floors', () => {
        const result = resolveSceneMovementFacts([move(12, 'upper-landing')], new Map([['player:0', 'grand-staircase']]), rooms);
        expect(result[0].kind).toBe('fade');
    });
    it.each([{skeletonKeyCardId:'skeleton-key'}, {usedActionId:'stalk-the-prey'}])('does not turn special movement %j into an ordinary hop', (special) => {
        const entry=move(16,'hallway');
        entry.event.payload={...entry.event.payload as object,...special};
        const result=resolveSceneMovementFacts([entry],new Map([['player:0','entrance-hall']]),rooms);
        expect(result[0].kind).toBe('fade');
    });
    it('does not invent a through-wall hop for neighboring rooms without reciprocal doors', () => {
        const disconnected=rooms.map(room=>room.id==='entrance-hall'||room.id==='hallway'?{...room,doorways:[]}:room);
        const result=resolveSceneMovementFacts([move(17,'hallway')],new Map([['player:0','entrance-hall']]),disconnected);
        expect(result[0].kind).toBe('fade');
    });
    it('requires a doorway on both sides, not only the source room', () => {
        const oneSided=rooms.map(room=>room.id==='hallway'?{...room,doorways:[]}:room);
        expect(resolveSceneMovementFacts([move(18,'hallway')],new Map([['player:0','entrance-hall']]),oneSided)[0].kind).toBe('fade');
    });
    it.each(['same-edge','wrong-geometry'] as const)('rejects a nonphysical %s connection', reason => {
        const source=rooms.find(room=>room.id==='entrance-hall')!;
        const target=rooms.find(room=>room.id==='hallway')!;
        const malformed=[
            {...source,x:0,y:0,doorways:[{edge:'east' as const,connectsToRoomId:target.id}]},
            {...target,x:reason==='same-edge'?1:0,y:reason==='same-edge'?0:-1,
                doorways:[{edge:reason==='same-edge'?'east' as const:'west' as const,connectsToRoomId:source.id}]},
        ];
        expect(resolveSceneMovementFacts([move(19,target.id)],new Map([['player:0',source.id]]),malformed)[0].kind).toBe('fade');
    });
    it('keeps same-floor monster teleports on the fade path', () => {
        const entry: EventStreamEntry = {
            id: 15,
            event: {
                type: 'MONSTER_MOVED',
                payload: {
                    playerId: '0', monsterId: 'teleporter', monsterName: 'Teleporter',
                    fromRoomId: 'entrance-hall', toRoomId: 'hallway', moveCost: 1,
                    moveRemaining: 0, teleportMove: true, logText: '',
                },
                timestamp: 1,
            },
        };
        const result = resolveSceneMovementFacts([entry], new Map(), rooms);
        expect(result).toMatchObject([{ eventType: 'MONSTER_MOVED', entityId: 'monster:teleporter', kind: 'fade' }]);
    });
    it.each([
        ['jack-spirit', 'monster:jack-spirit'],
        ['feverish', 'monster:feverish-0'],
    ])('moves the controlled %s token, not its owner pawn', (controlledToken, entityId) => {
        const event = move(13, 'hallway');
        event.event.payload = { ...event.event.payload as object, controlledToken };
        const result = resolveSceneMovementFacts([event], new Map([[entityId, 'entrance-hall'], ['player:0', 'upper-landing']]), rooms);
        expect(result).toMatchObject([{ entityId, fromRoomId: 'entrance-hall', toRoomId: 'hallway' }]);
    });
    it('presents the confirmed entry into an explored room', () => {
        const entry: EventStreamEntry = { id: 14, event: { type: 'ROOM_EXPLORED', payload: { playerId: '0', roomId: 'ground-east' }, timestamp: 1 } };
        const result = resolveSceneMovementFacts([entry], new Map([['player:0', 'entrance-hall']]), rooms);
        expect(result).toMatchObject([{ entityId: 'player:0', fromRoomId: 'entrance-hall', toRoomId: 'ground-east', kind: 'hop' }]);
    });
});
