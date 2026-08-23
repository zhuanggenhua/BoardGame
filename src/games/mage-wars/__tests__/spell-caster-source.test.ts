import { describe, expect, it } from 'vitest';
import { createInitialSystemState } from '../../../engine/pipeline';
import { createTimingOpportunitySystem } from '../../../engine';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
import {
    MAGE_WARS_EVENTS,
    type MageWarsSpellCastResolvedEvent,
    type MageWarsSpellCastStartedEvent,
} from '../domain/events';
import { MageWarsDomain } from '../domain';
import {
    createMageWarsResponseFrame,
    readMageWarsResponseContext,
    type MageWarsSpellResponseContext,
} from '../domain/responseResolution';
import { resolveMageWarsSpellCasterRef } from '../domain/spellCasting';
import { resolveMageWarsMagebaneCurseDamageSource } from '../domain/spellRules';
import type { MageWarsArenaObjectState, MageWarsCore } from '../domain/types';
import { ARENA_ZONE_IDS } from '../domain/ids';
import { createMageWarsInteractionSystem } from '../domain/systems';
import { createMageWarsTimingOpportunitySystemConfig } from '../domain/timingOpportunities';
import { engineConfig } from '../game';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 3,
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

function addObject(core: MageWarsCore, object: MageWarsArenaObjectState): MageWarsCore {
    return {
        ...core,
        objects: { ...core.objects, [object.id]: object },
        arena: core.arena.map((zone) => zone.id !== object.zoneId
            ? zone
            : {
                ...zone,
                objectIds: zone.objectIds.includes(object.id)
                    ? zone.objectIds
                    : [...zone.objectIds, object.id],
            }),
    };
}

function creature(
    id: string,
    ownerId: string,
    spellcastingSource?: { abilityId: string },
): MageWarsArenaObjectState {
    return {
        id,
        kind: 'creature',
        ownerId,
        sourceSpellCardId: 2906,
        sourceObjectId: `spell-card-2906-${id}`,
        ...(spellcastingSource ? { spellcastingSource } : {}),
        name: id,
        zoneId: ARENA_ZONE_IDS.A2,
        life: 10,
        damage: 0,
        armor: 0,
        actionReady: true,
        guarding: false,
        statusTokens: {},
    };
}

function hiddenCurse(id: string, ownerId: string, targetObjectId: string): MageWarsArenaObjectState {
    return {
        id,
        kind: 'enchantment',
        ownerId,
        sourceSpellCardId: 1804,
        sourceObjectId: 'spell-card-1804',
        name: '法师祸咒',
        zoneId: ARENA_ZONE_IDS.A2,
        life: 1,
        damage: 0,
        armor: 0,
        actionReady: false,
        guarding: false,
        statusTokens: {},
        revealed: false,
        anchoredToObjectId: targetObjectId,
    };
}

function afterSpellResolved(
    core: MageWarsCore,
    caster: MageWarsSpellCastResolvedEvent['payload']['caster'],
) {
    const event: MageWarsSpellCastResolvedEvent = {
        type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
        payload: {
            playerId: '0',
            caster,
            spellCardId: 3405,
            manaCost: 5,
            castMode: 'action',
        },
        sourceCommandType: 'mw:test_cast_spell',
        timestamp: 4,
    };

    return runMageWarsTimingAfterEvents(core, event);
}

function runMageWarsTimingAfterEvents(
    core: MageWarsCore,
    event: MageWarsSpellCastResolvedEvent | MageWarsSpellCastStartedEvent,
) {
    const state: MatchState<MageWarsCore> = {
        core,
        sys: {
            ...createInitialSystemState(['0', '1'], engineConfig.systems, 'local:mage-wars-spell-caster-source'),
            phase: 'creatureAction',
        },
    };

    return createTimingOpportunitySystem(
        MageWarsDomain,
        createMageWarsTimingOpportunitySystemConfig(),
    ).afterEvents?.({
        state,
        command: { type: 'mw:test_cast_spell', playerId: '0', payload: {} } as Command,
        events: [event],
        random: fixedRandom,
        playerIds: ['0', '1'],
    });
}

describe('mage-wars spell caster source', () => {
    it('resolves only configured owned creatures as non-player spell casters', () => {
        const core = MageWarsDomain.setup(['0', '1'], fixedRandom);
        const caster = creature('configured-spellcaster', '0', { abilityId: 'mw.creature.test.spellcasting' });
        const ordinary = creature('ordinary-creature', '0');
        const nextCore = addObject(addObject(core, caster), ordinary);

        expect(resolveMageWarsSpellCasterRef(nextCore, '0')).toEqual({ kind: 'mage', playerId: '0' });
        expect(resolveMageWarsSpellCasterRef(nextCore, '0', caster.id)).toEqual({
            kind: 'arena-object',
            objectId: caster.id,
            ownerId: '0',
        });
        expect(resolveMageWarsSpellCasterRef(nextCore, '0', ordinary.id)).toBeUndefined();
        expect(resolveMageWarsSpellCasterRef(nextCore, '1', caster.id)).toBeUndefined();
    });

    it('applies 1804 direct damage only after a configured creature caster resolves a spell', () => {
        const caster = creature('spellcaster-with-curse', '0', { abilityId: 'mw.creature.test.spellcasting' });
        const curse = hiddenCurse('curse-on-spellcaster', '1', caster.id);
        const core = addObject(
            addObject(
                addObject(MageWarsDomain.setup(['0', '1'], fixedRandom), caster),
                curse,
            ),
            hiddenCurse('second-curse-on-spellcaster', '1', caster.id),
        );

        const result = afterSpellResolved(core, {
            kind: 'arena-object',
            objectId: caster.id,
            ownerId: caster.ownerId,
        });
        const damage = result?.events?.filter((event) => event.type === 'DAMAGE_DEALT');

        expect(damage).toHaveLength(2);
        expect(damage?.[0]).toMatchObject({
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: caster.id,
                amount: 1,
                actualDamage: 1,
                sourceAbilityId: 'mw.spell.1804',
            },
        });
        expect(resolveMageWarsMagebaneCurseDamageSource(curse, caster.id)).toMatchObject({
            sourceObjectId: curse.id,
            sourceSpellCardId: 1804,
            ownerId: '1',
            sourceAbilityId: 'mw.spell.1804',
            amount: 1,
        });
    });

    it('does not apply 1804 before the spell reaches successful resolution', () => {
        const caster = creature('spellcaster-before-resolution', '0', { abilityId: 'mw.creature.test.spellcasting' });
        const core = addObject(
            addObject(MageWarsDomain.setup(['0', '1'], fixedRandom), caster),
            hiddenCurse('curse-before-resolution', '1', caster.id),
        );
        const event: MageWarsSpellCastStartedEvent = {
            type: MAGE_WARS_EVENTS.SPELL_CAST_STARTED,
            payload: {
                playerId: '0',
                caster: { kind: 'arena-object', objectId: caster.id, ownerId: '0' },
                spellCardId: 3405,
                manaCost: 5,
                castMode: 'action',
            },
            sourceCommandType: 'mw:test_cast_spell',
            timestamp: 4,
        };

        const result = runMageWarsTimingAfterEvents(core, event);

        expect(result?.events?.some((candidate) => candidate.type === 'DAMAGE_DEALT') ?? false).toBe(false);
    });

    it('does not let the legacy interaction system discover 1804 triggers', () => {
        const caster = creature('spellcaster-legacy-owner', '0', { abilityId: 'mw.creature.test.spellcasting' });
        const core = addObject(
            addObject(MageWarsDomain.setup(['0', '1'], fixedRandom), caster),
            hiddenCurse('curse-legacy-owner', '1', caster.id),
        );
        const state: MatchState<MageWarsCore> = {
            core,
            sys: {
                ...createInitialSystemState(['0', '1'], engineConfig.systems, 'local:mage-wars-spell-caster-source'),
                phase: 'creatureAction',
            },
        };
        const event: MageWarsSpellCastResolvedEvent = {
            type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
            payload: {
                playerId: '0',
                caster: { kind: 'arena-object', objectId: caster.id, ownerId: '0' },
                spellCardId: 3405,
                manaCost: 5,
                castMode: 'action',
            },
            sourceCommandType: 'mw:test_cast_spell',
            timestamp: 4,
        };

        const result = createMageWarsInteractionSystem().afterEvents?.({
            state,
            command: { type: 'mw:test_cast_spell', playerId: '0', payload: {} } as Command,
            events: [event],
            random: fixedRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.events?.some((candidate) => candidate.type === 'DAMAGE_DEALT') ?? false).toBe(false);
    });

    it('preserves a creature caster through a countered response without triggering 1804', () => {
        const caster = creature('spellcaster-countered', '0', { abilityId: 'mw.creature.test.spellcasting' });
        const core = addObject(
            addObject(MageWarsDomain.setup(['0', '1'], fixedRandom), caster),
            hiddenCurse('curse-on-countered-caster', '1', caster.id),
        );
        const context: MageWarsSpellResponseContext = {
            kind: 'spell-counter',
            responseId: 'mw-response-countered-creature-cast',
            responseCardId: 1825,
            responseObjectId: 'response-1825',
            responseOwnerId: '1',
            triggeringPlayerId: '0',
            caster: { kind: 'arena-object', objectId: caster.id, ownerId: caster.ownerId },
            spellCardId: 3405,
            manaCost: 5,
            castMode: 'action',
            sourceCommandType: 'mw:test_cast_spell',
        };
        const frame = createMageWarsResponseFrame(context);
        expect(readMageWarsResponseContext(frame)?.caster).toEqual(context.caster);

        const state: MatchState<MageWarsCore> = {
            core,
            sys: {
                ...createInitialSystemState(['0', '1'], engineConfig.systems, 'local:mage-wars-spell-caster-source'),
                phase: 'creatureAction',
            },
        };
        const result = createMageWarsInteractionSystem().afterEvents?.({
            state,
            command: { type: 'mw:test_cast_spell', playerId: '0', payload: {} } as Command,
            events: [
                {
                    type: MAGE_WARS_EVENTS.SPELL_CAST_STARTED,
                    payload: {
                        playerId: '0',
                        caster: context.caster,
                        spellCardId: context.spellCardId,
                        manaCost: context.manaCost,
                        castMode: context.castMode,
                    },
                    sourceCommandType: context.sourceCommandType,
                    timestamp: 4,
                },
                {
                    type: MAGE_WARS_EVENTS.SPELL_COUNTERED,
                    payload: {
                        responseCardId: context.responseCardId,
                        responseObjectId: context.responseObjectId,
                        spellCardId: context.spellCardId,
                        spellOwnerId: context.triggeringPlayerId,
                        manaCost: context.manaCost,
                    },
                    sourceCommandType: context.sourceCommandType,
                    timestamp: 4,
                },
            ],
            random: fixedRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.events?.some((event) => event.type === MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED) ?? false).toBe(false);
        expect(result?.events?.some((event) => event.type === 'DAMAGE_DEALT') ?? false).toBe(false);
    });

    it('does not apply 1804 to mage casts or unconfigured creature sources', () => {
        const ordinary = creature('ordinary-caster', '0');
        const core = addObject(
            addObject(MageWarsDomain.setup(['0', '1'], fixedRandom), ordinary),
            hiddenCurse('curse-on-ordinary-creature', '1', ordinary.id),
        );

        const mageResult = afterSpellResolved(core, { kind: 'mage', playerId: '0' });
        const objectResult = afterSpellResolved(core, {
            kind: 'arena-object',
            objectId: ordinary.id,
            ownerId: ordinary.ownerId,
        });

        expect(mageResult?.events?.some((event) => event.type === 'DAMAGE_DEALT') ?? false).toBe(false);
        expect(objectResult?.events?.some((event) => event.type === 'DAMAGE_DEALT') ?? false).toBe(false);
    });

    it('does not use a stale curse source after the caster leaves the arena', () => {
        const missingCasterId = 'removed-spellcaster';
        const core = addObject(
            MageWarsDomain.setup(['0', '1'], fixedRandom),
            hiddenCurse('stale-curse', '1', missingCasterId),
        );

        const result = afterSpellResolved(core, {
            kind: 'arena-object',
            objectId: missingCasterId,
            ownerId: '0',
        });

        expect(result?.events?.some((event) => event.type === 'DAMAGE_DEALT') ?? false).toBe(false);
    });
});
