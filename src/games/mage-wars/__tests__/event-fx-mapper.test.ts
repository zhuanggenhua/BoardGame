import { describe, expect, it } from 'vitest';
import type { EventStreamEntry, RandomFn } from '../../../engine/types';
import { MageWarsDomain } from '../domain';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { ARENA_ZONE_IDS } from '../domain/ids';
import { mapMageWarsEventToFx } from '../ui/eventFxMapper';
import { MW_FX } from '../ui/fxCues';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 3,
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

function createEntry(event: EventStreamEntry['event'], id = 1): EventStreamEntry {
    return { id, event };
}

function getArenaCell(core: ReturnType<typeof MageWarsDomain.setup>, zoneId: string): { row: number; col: number } {
    const zone = core.arena.find((candidate) => candidate.id === zoneId);
    if (!zone) throw new Error(`missing arena zone ${zoneId}`);
    return { row: zone.row, col: zone.col };
}

function getMageCell(core: ReturnType<typeof MageWarsDomain.setup>, playerId: string): { row: number; col: number } {
    const player = core.players[playerId];
    if (!player) throw new Error(`missing mage player ${playerId}`);
    return getArenaCell(core, player.mageZoneId);
}

describe('mage-wars event FX mapper', () => {
    it('maps spell cast events to the target mage zone', () => {
        const core = MageWarsDomain.setup(['0', '1'], fixedRandom);

        const instruction = mapMageWarsEventToFx(createEntry({
            type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
            payload: {
                playerId: '0',
                caster: { kind: 'mage', playerId: '0' },
                spellCardId: 1700,
                manaCost: 4,
                castMode: 'quickcast',
                targetPlayerId: '1',
            },
            timestamp: 1,
        }), core);

        expect(instruction).toMatchObject({
            sourceEventId: 1,
            cue: MW_FX.SPELL_CAST,
            ctx: {
                cell: getMageCell(core, '1'),
                intensity: 'normal',
            },
            params: {
                source: getMageCell(core, '0'),
                spellCardId: 1700,
                targetPlayerId: '1',
            },
        });
    });

    it('maps zone-targeted action casts to the explicit target zone', () => {
        const core = MageWarsDomain.setup(['0', '1'], fixedRandom);

        const instruction = mapMageWarsEventToFx(createEntry({
            type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
            payload: {
                playerId: '0',
                caster: { kind: 'mage', playerId: '0' },
                spellCardId: 1710,
                manaCost: 6,
                castMode: 'action',
                targetZoneId: ARENA_ZONE_IDS.A2,
            },
            timestamp: 1,
        }), core);

        expect(instruction).toMatchObject({
            cue: MW_FX.SPELL_CAST,
            ctx: {
                cell: getArenaCell(core, ARENA_ZONE_IDS.A2),
                intensity: 'strong',
            },
            params: {
                source: getMageCell(core, '0'),
                targetZoneId: ARENA_ZONE_IDS.A2,
            },
        });
    });

    it('maps arena-object spell casts from the caster object zone instead of the mage zone', () => {
        const casterId = 'mwobj-0-familiar';
        const baseCore = MageWarsDomain.setup(['0', '1'], fixedRandom);
        const core = {
            ...baseCore,
            objects: {
                [casterId]: {
                    id: casterId,
                    kind: 'creature' as const,
                    ownerId: '0',
                    sourceSpellCardId: 2803,
                    sourceObjectId: 'spell-2803',
                    spellcastingSource: { abilityId: 'mw.creature.test.spellcasting' },
                    name: '施法仆从',
                    zoneId: ARENA_ZONE_IDS.B2,
                    life: 6,
                    damage: 0,
                    armor: 0,
                    actionReady: true,
                    guarding: false,
                    statusTokens: {},
                },
            },
            arena: baseCore.arena.map((zone) => (
                zone.id === ARENA_ZONE_IDS.B2
                    ? { ...zone, objectIds: [casterId] }
                    : zone
            )),
        };

        const instruction = mapMageWarsEventToFx(createEntry({
            type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
            payload: {
                playerId: '0',
                caster: { kind: 'arena-object', objectId: casterId, ownerId: '0' },
                spellCardId: 1710,
                manaCost: 6,
                castMode: 'action',
                targetZoneId: ARENA_ZONE_IDS.A2,
            },
            timestamp: 2,
        }), core);

        expect(instruction).toMatchObject({
            cue: MW_FX.SPELL_CAST,
            ctx: {
                cell: getArenaCell(core, ARENA_ZONE_IDS.A2),
            },
            params: {
                source: getArenaCell(core, ARENA_ZONE_IDS.B2),
                caster: { kind: 'arena-object', objectId: casterId, ownerId: '0' },
            },
        });
    });

    it('maps attack and damage events to defender impact cues', () => {
        const core = MageWarsDomain.setup(['0', '1'], fixedRandom);

        const attackInstruction = mapMageWarsEventToFx(createEntry({
            type: MAGE_WARS_EVENTS.ATTACK_DECLARED,
            payload: {
                attackerId: '0',
                defenderId: '1',
                diceResults: [3, 3, 3],
                baseDamage: 9,
            },
            timestamp: 1,
        }), core);

        expect(attackInstruction).toMatchObject({
            cue: MW_FX.ATTACK_IMPACT,
            ctx: {
                cell: getMageCell(core, '1'),
                intensity: 'strong',
            },
            params: {
                source: getMageCell(core, '0'),
                damageAmount: 9,
            },
        });

        const damageInstruction = mapMageWarsEventToFx(createEntry({
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 5,
                actualDamage: 4,
                sourceAbilityId: 'mage-basic-melee',
            },
            timestamp: 2,
        }), core);

        expect(damageInstruction).toMatchObject({
            sourceEventId: 1,
            cue: MW_FX.DAMAGE_IMPACT,
            ctx: {
                cell: getMageCell(core, '1'),
                intensity: 'normal',
            },
            params: {
                targetId: '1',
                damageAmount: 4,
                sourceAbilityId: 'mage-basic-melee',
            },
        });
    });

    it('maps arena-object attacks with their rolled dice and both board endpoints', () => {
        const attackerId = 'mwobj-0-attacker';
        const targetId = 'mwobj-1-target';
        const baseCore = MageWarsDomain.setup(['0', '1'], fixedRandom);
        const core = {
            ...baseCore,
            objects: {
                [attackerId]: {
                    id: attackerId,
                    kind: 'creature' as const,
                    ownerId: '0',
                    sourceSpellCardId: 2803,
                    sourceObjectId: 'spell-2803',
                    name: '烈焰狱鬼',
                    zoneId: ARENA_ZONE_IDS.A2,
                    life: 6,
                    damage: 0,
                    armor: 0,
                    actionReady: true,
                    guarding: false,
                    statusTokens: {},
                },
                [targetId]: {
                    id: targetId,
                    kind: 'creature' as const,
                    ownerId: '1',
                    sourceSpellCardId: 2909,
                    sourceObjectId: 'spell-2909',
                    name: '西锁骑士',
                    zoneId: ARENA_ZONE_IDS.B2,
                    life: 6,
                    damage: 0,
                    armor: 0,
                    actionReady: true,
                    guarding: false,
                    statusTokens: {},
                },
            },
            arena: baseCore.arena.map((zone) => (
                zone.id === ARENA_ZONE_IDS.A2
                    ? { ...zone, objectIds: [attackerId] }
                    : zone.id === ARENA_ZONE_IDS.B2
                        ? { ...zone, objectIds: [targetId] }
                        : zone
            )),
        };

        const instruction = mapMageWarsEventToFx(createEntry({
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
            payload: {
                ownerId: '0',
                attackerObjectId: attackerId,
                attackProfileId: 'attack-0',
                targetObjectId: targetId,
                targetZoneId: ARENA_ZONE_IDS.B2,
                diceResults: [1, 2, 3],
                effectDieResult: 9,
                baseDamage: 6,
            },
            timestamp: 3,
        }), core);

        expect(instruction).toMatchObject({
            cue: MW_FX.ATTACK_IMPACT,
            ctx: {
                cell: getArenaCell(core, ARENA_ZONE_IDS.B2),
                intensity: 'strong',
            },
            params: {
                source: getArenaCell(core, ARENA_ZONE_IDS.A2),
                attackerId,
                defenderId: targetId,
                targetZoneId: ARENA_ZONE_IDS.B2,
                diceResults: [1, 2, 3],
                effectDieResult: 9,
                damageAmount: 6,
            },
        });
    });

    it('maps spell attack and damage events to arena object zones', () => {
        const objectId = 'mwobj-0-2906-1';
        const baseCore = MageWarsDomain.setup(['0', '1'], fixedRandom);
        const core = {
            ...baseCore,
            objects: {
                [objectId]: {
                    id: objectId,
                    kind: 'creature' as const,
                    ownerId: '0',
                    sourceSpellCardId: 2906,
                    sourceObjectId: 'spell-2906',
                    name: '野性山猫',
                    zoneId: ARENA_ZONE_IDS.A2,
                    life: 4,
                    damage: 0,
                    armor: 0,
                    actionReady: false,
                    guarding: false,
                    statusTokens: {},
                },
            },
            arena: baseCore.arena.map((zone) => (
                zone.id === ARENA_ZONE_IDS.A2
                    ? { ...zone, objectIds: [objectId] }
                    : zone
            )),
        };

        const spellAttackInstruction = mapMageWarsEventToFx(createEntry({
            type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
            payload: {
                playerId: '0',
                spellCardId: 1710,
                sourceAbilityId: 'mw.spell.1710',
                targetObjectId: objectId,
                targetZoneId: ARENA_ZONE_IDS.A2,
                diceResults: [3, 3, 3],
                baseDamage: 9,
            },
            timestamp: 3,
        }), core);

        expect(spellAttackInstruction).toMatchObject({
            cue: MW_FX.ATTACK_IMPACT,
            ctx: {
                cell: getArenaCell(core, ARENA_ZONE_IDS.A2),
                intensity: 'strong',
            },
            params: {
                defenderId: objectId,
                damageAmount: 9,
            },
        });

        const damageInstruction = mapMageWarsEventToFx(createEntry({
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: objectId,
                amount: 9,
                actualDamage: 9,
                sourceAbilityId: 'mw.spell.1710',
            },
            timestamp: 4,
        }), core);

        expect(damageInstruction).toMatchObject({
            cue: MW_FX.DAMAGE_IMPACT,
            ctx: {
                cell: getArenaCell(core, ARENA_ZONE_IDS.A2),
                intensity: 'strong',
            },
        });
    });

    it('uses spell attack target zone when the damaged object is no longer in final core state', () => {
        const removedObjectId = 'mwobj-0-removed-target';
        const core = MageWarsDomain.setup(['0', '1'], fixedRandom);

        const instruction = mapMageWarsEventToFx(createEntry({
            type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
            payload: {
                playerId: '0',
                spellCardId: 1710,
                sourceAbilityId: 'mw.spell.1710',
                targetObjectId: removedObjectId,
                targetZoneId: ARENA_ZONE_IDS.A2,
                diceResults: [3, 3, 3],
                baseDamage: 9,
            },
            timestamp: 7,
        }), core);

        expect(instruction).toMatchObject({
            cue: MW_FX.ATTACK_IMPACT,
            ctx: {
                cell: getArenaCell(core, ARENA_ZONE_IDS.A2),
                intensity: 'strong',
            },
            params: {
                source: getMageCell(core, '0'),
                defenderId: removedObjectId,
                spellCardId: 1710,
                damageAmount: 9,
            },
        });
    });

    it('maps spell push events to the destination zone', () => {
        const core = MageWarsDomain.setup(['0', '1'], fixedRandom);

        const instruction = mapMageWarsEventToFx(createEntry({
            type: MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED,
            payload: {
                playerId: '0',
                spellCardId: 1711,
                sourceAbilityId: 'mw.spell.1711',
                targetObjectId: 'angel-1',
                fromZoneId: ARENA_ZONE_IDS.A2,
                toZoneId: ARENA_ZONE_IDS.A3,
            },
            timestamp: 5,
        }), core);

        expect(instruction).toMatchObject({
            cue: MW_FX.SPELL_PUSH,
            ctx: {
                cell: getArenaCell(core, ARENA_ZONE_IDS.A3),
                intensity: 'normal',
            },
            params: {
                source: getArenaCell(core, ARENA_ZONE_IDS.A2),
                spellCardId: 1711,
                targetObjectId: 'angel-1',
                fromZoneId: ARENA_ZONE_IDS.A2,
                toZoneId: ARENA_ZONE_IDS.A3,
            },
        });
    });
    it('maps spell teleport events to the destination zone with a teleport cue', () => {
        const core = MageWarsDomain.setup(['0', '1'], fixedRandom);

        const instruction = mapMageWarsEventToFx(createEntry({
            type: MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED,
            payload: {
                playerId: '0',
                spellCardId: 3410,
                sourceAbilityId: 'mw.spell.3410',
                targetObjectId: 'cat-1',
                fromZoneId: ARENA_ZONE_IDS.A2,
                toZoneId: ARENA_ZONE_IDS.B1,
                distance: 2,
            },
            timestamp: 6,
        }), core);

        expect(instruction).toMatchObject({
            cue: MW_FX.SPELL_TELEPORT,
            ctx: {
                cell: getArenaCell(core, ARENA_ZONE_IDS.B1),
                intensity: 'strong',
            },
            params: {
                source: getArenaCell(core, ARENA_ZONE_IDS.A2),
                spellCardId: 3410,
                targetObjectId: 'cat-1',
                fromZoneId: ARENA_ZONE_IDS.A2,
                toZoneId: ARENA_ZONE_IDS.B1,
                distance: 2,
            },
        });
    });
});
