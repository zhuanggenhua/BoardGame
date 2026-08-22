import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { MatchState, RandomFn } from '../../../engine/types';
import { getPresetSpellbookCardIdsFromConfig, getMageWarsSpellCardFromConfig } from '../data/configPackage';
import { MageWarsDomain, MAGE_WARS_COMMANDS, MAGE_WARS_EVENTS } from '../domain';
import { reduceEvent } from '../domain/reducer';
import { ARENA_ZONE_IDS, MAGE_IDS } from '../domain/ids';
import type { MageWarsArenaObjectState, MageWarsCore } from '../domain/types';
import { engineConfig } from '../game';

const playerIds = ['0', '1'];
const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 3,
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

function stateFor(core: MageWarsCore, phase: 'planning' | 'deployment' | 'creatureAction'): MatchState<MageWarsCore> {
    return {
        core,
        sys: {
            ...createInitialSystemState(playerIds, engineConfig.systems, 'local:mage-wars-familiar-spellcasting'),
            phase,
        },
    };
}

function addObject(core: MageWarsCore, object: MageWarsArenaObjectState): MageWarsCore {
    return {
        ...core,
        objects: { ...core.objects, [object.id]: object },
        arena: core.arena.map((zone) => zone.id !== object.zoneId
            ? zone
            : { ...zone, objectIds: [...zone.objectIds, object.id] }),
    };
}

function sourceObject(
    id: string,
    sourceSpellCardId: 2908 | 2218,
    kind: 'creature' | 'conjuration',
    zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS],
    mana: number,
): MageWarsArenaObjectState {
    const source = getMageWarsSpellCardFromConfig(sourceSpellCardId)?.spellcastingSource;
    if (!source) throw new Error(`missing test source ${sourceSpellCardId}`);
    return {
        id,
        kind,
        ownerId: '0',
        sourceSpellCardId,
        sourceObjectId: `spell-${sourceSpellCardId}`,
        spellcastingSource: source,
        mana,
        name: sourceSpellCardId === 2908 ? '乌鸦魔宠胡金' : '巢穴',
        zoneId,
        life: sourceSpellCardId === 2908 ? 5 : 13,
        damage: 0,
        armor: sourceSpellCardId === 2908 ? 0 : 3,
        actionReady: kind === 'creature',
        guarding: false,
        statusTokens: {},
    };
}

function ordinaryCreature(id: string, zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS]): MageWarsArenaObjectState {
    return {
        id,
        kind: 'creature',
        ownerId: '0',
        sourceSpellCardId: 2906,
        sourceObjectId: 'spell-2906',
        name: '野性山猫',
        zoneId,
        life: 4,
        damage: 2,
        armor: 0,
        actionReady: true,
        guarding: false,
        statusTokens: {},
    };
}

function withMage(core: MageWarsCore, mageId: typeof MAGE_IDS[keyof typeof MAGE_IDS], mana: number): MageWarsCore {
    const spellbookCount = getPresetSpellbookCardIdsFromConfig(mageId).length;
    return {
        ...core,
        players: {
            ...core.players,
            '0': {
                ...core.players['0'],
                mageId,
                spellbookCount,
                mana,
            },
        },
    };
}

describe('mage-wars familiar and spawn-point spellcasting', () => {
    it('keeps source-card restrictions in the config package while standard spellbooks include their source cards', () => {
        expect(getMageWarsSpellCardFromConfig(2908)?.spellcastingSource).toEqual({
            abilityId: 'mw.source.2908.familiar',
            kind: 'familiar',
            phase: 'creatureAction',
            allowedSpellTypes: ['咒语'],
            maxSpellLevel: 2,
            channeling: 3,
        });
        expect(getMageWarsSpellCardFromConfig(2218)?.spellcastingSource).toEqual({
            abilityId: 'mw.source.2218.spawn-point',
            kind: 'spawn-point',
            phase: 'deployment',
            allowedSpellTypes: ['生物'],
            allowedTypeLineIncludes: ['动物'],
            channeling: 4,
        });
        expect(getPresetSpellbookCardIdsFromConfig(MAGE_IDS.BEASTMASTER_APPRENTICE)).toContain(2218);
        expect(getPresetSpellbookCardIdsFromConfig(MAGE_IDS.WIZARD_APPRENTICE)).toContain(2908);
    });

    it('plans and casts a familiar incantation from the familiar location with familiar-first payment', () => {
        const spellCardId = 3402;
        let core = withMage(MageWarsDomain.setup(playerIds, fixedRandom), MAGE_IDS.WIZARD_APPRENTICE, 2);
        const familiar = sourceObject('familiar-2908', 2908, 'creature', ARENA_ZONE_IDS.A2, 3);
        core = addObject(core, familiar);
        core = addObject(core, ordinaryCreature('healing-target', ARENA_ZONE_IDS.A2));

        const planned = executePipeline(
            { domain: engineConfig.domain, systems: engineConfig.systems, systemsConfig: engineConfig.systemsConfig },
            stateFor(core, 'planning'),
            {
                type: MAGE_WARS_COMMANDS.PLAN_OBJECT_SPELL,
                playerId: '0',
                payload: { objectId: familiar.id, spellCardId },
            },
            fixedRandom,
            playerIds,
        );
        expect(planned.success).toBe(true);
        expect(planned.state.core.players['0'].preparedSpellCardIds).toEqual([]);
        expect(planned.state.core.objects[familiar.id].preparedSpellCardId).toBe(spellCardId);
        expect(MageWarsDomain.validate(stateFor(planned.state.core, 'deployment'), {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                casterObjectId: familiar.id,
                spellCardId,
                manaCost: 5,
                targetObjectId: 'healing-target',
            },
        }).error).toBe('wrongPhase');

        const cast = executePipeline(
            { domain: engineConfig.domain, systems: engineConfig.systems, systemsConfig: engineConfig.systemsConfig },
            stateFor(planned.state.core, 'creatureAction'),
            {
                type: MAGE_WARS_COMMANDS.CAST_SPELL,
                playerId: '0',
                payload: {
                    casterObjectId: familiar.id,
                    spellCardId,
                    manaCost: 5,
                    targetObjectId: 'healing-target',
                },
            },
            fixedRandom,
            playerIds,
        );

        expect(cast.success).toBe(true);
        expect(cast.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: expect.objectContaining({
                    caster: { kind: 'arena-object', objectId: familiar.id, ownerId: '0' },
                    objectManaCost: 3,
                    playerManaCost: 2,
                }),
            }),
        ]));
        expect(cast.state.core.objects[familiar.id]).toMatchObject({
            mana: 0,
            preparedSpellCardId: undefined,
            actionReady: false,
        });
        expect(cast.state.core.players['0'].mana).toBe(0);
        expect(cast.state.core.players['0'].discardSpellCardIds).toContain(spellCardId);
    });

    it('plans and casts a spawn-point animal in deployment using the spawn-point location', () => {
        const spellCardId = 2819;
        let core = withMage(MageWarsDomain.setup(playerIds, fixedRandom), MAGE_IDS.BEASTMASTER_APPRENTICE, 5);
        const spawnPoint = sourceObject('spawn-point-2218', 2218, 'conjuration', ARENA_ZONE_IDS.A1, 4);
        core = addObject(core, spawnPoint);

        const planned = executePipeline(
            { domain: engineConfig.domain, systems: engineConfig.systems, systemsConfig: engineConfig.systemsConfig },
            stateFor(core, 'planning'),
            {
                type: MAGE_WARS_COMMANDS.PLAN_OBJECT_SPELL,
                playerId: '0',
                payload: { objectId: spawnPoint.id, spellCardId },
            },
            fixedRandom,
            playerIds,
        );
        expect(planned.success).toBe(true);

        const cast = executePipeline(
            { domain: engineConfig.domain, systems: engineConfig.systems, systemsConfig: engineConfig.systemsConfig },
            stateFor(planned.state.core, 'deployment'),
            {
                type: MAGE_WARS_COMMANDS.CAST_SPELL,
                playerId: '0',
                payload: {
                    casterObjectId: spawnPoint.id,
                    spellCardId,
                    manaCost: 9,
                    targetZoneId: ARENA_ZONE_IDS.A1,
                },
            },
            fixedRandom,
            playerIds,
        );

        expect(cast.success).toBe(true);
        expect(cast.state.core.objects[spawnPoint.id].mana).toBe(0);
        expect(cast.state.core.players['0'].mana).toBe(0);
        expect(cast.state.core.objects['mwobj-0-2819-1']).toMatchObject({
            sourceSpellCardId: spellCardId,
            zoneId: ARENA_ZONE_IDS.A1,
        });
    });

    it('returns an uncast object spell and refunds a countered object cast without leaking its identity', () => {
        const familiar = sourceObject('familiar-lifecycle', 2908, 'creature', ARENA_ZONE_IDS.A2, 3);
        const base = addObject(
            withMage(MageWarsDomain.setup(playerIds, fixedRandom), MAGE_IDS.WIZARD_APPRENTICE, 2),
            familiar,
        );
        const planned = reduceEvent(base, {
            type: MAGE_WARS_EVENTS.OBJECT_SPELL_PLANNED,
            payload: { ownerId: '0', objectId: familiar.id, spellCardId: 3402 },
            sourceCommandType: MAGE_WARS_COMMANDS.PLAN_OBJECT_SPELL,
            timestamp: 1,
        });
        const returned = reduceEvent(planned, {
            type: MAGE_WARS_EVENTS.OBJECT_SPELL_RETURNED,
            payload: { ownerId: '0', objectId: familiar.id, spellCardId: 3402, reason: 'turn-expired' },
            sourceCommandType: 'ADVANCE_PHASE',
            timestamp: 2,
        });
        expect(returned.objects[familiar.id].preparedSpellCardId).toBeUndefined();

        const destroyed = reduceEvent(planned, {
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
            payload: { objectId: familiar.id, ownerId: '0' },
            sourceCommandType: 'mw:test_destroy_source',
            timestamp: 2,
        });
        expect(destroyed.objects[familiar.id]).toBeUndefined();
        expect(destroyed.players['0'].discardSpellCardIds).not.toContain(3402);

        const started = reduceEvent(planned, {
            type: MAGE_WARS_EVENTS.SPELL_CAST_STARTED,
            payload: {
                playerId: '0',
                caster: { kind: 'arena-object', objectId: familiar.id, ownerId: '0' },
                spellCardId: 3402,
                manaCost: 5,
                objectManaCost: 3,
                playerManaCost: 2,
                castMode: 'action',
            },
            sourceCommandType: MAGE_WARS_COMMANDS.CAST_SPELL,
            timestamp: 3,
        });
        const countered = reduceEvent(started, {
            type: MAGE_WARS_EVENTS.SPELL_COUNTERED,
            payload: {
                responseCardId: 1825,
                responseObjectId: 'counterspell',
                spellCardId: 3402,
                spellOwnerId: '0',
                manaCost: 5,
                caster: { kind: 'arena-object', objectId: familiar.id, ownerId: '0' },
                objectManaCost: 3,
                playerManaCost: 2,
            },
            sourceCommandType: MAGE_WARS_COMMANDS.CAST_SPELL,
            timestamp: 4,
        });
        expect(countered.objects[familiar.id]).toMatchObject({ mana: 3, preparedSpellCardId: 3402 });
        expect(countered.players['0'].mana).toBe(2);

        const hidden = MageWarsDomain.playerView?.(planned, '1');
        expect(hidden?.objects?.[familiar.id]).not.toHaveProperty('preparedSpellCardId');
        expect(hidden?.objects?.[familiar.id]).toMatchObject({ preparedSpellCount: 1 });
        expect(MageWarsDomain.playerView?.(planned, '0')?.objects?.[familiar.id]).toMatchObject({
            preparedSpellCardId: 3402,
        });
    });
});
