import { describe, expect, test } from 'vitest';
import {
    projectChoiceRequestToAiLegalActions,
} from '../../../engine/ChoiceRequest';
import { projectChoiceRequestToDirectSelectionTargets } from '../../../engine/systems';
import { buildChoiceRequestFromOpportunity } from '../../../engine/TimingOpportunity';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, RandomFn } from '../../../engine/types';
import { materializeMageWarsConfigPackage } from '../data/configPackage';
import {
    buildMageWarsConfigAbilityCatalog,
    getMageWarsSpellAbilityDef,
    getMageWarsSpellAbilityId,
    mageWarsAbilityRegistry,
    mageWarsObjectAbilityRegistry,
    summarizeMageWarsAbilityGaps,
} from '../domain/abilityCatalog';
import { MageWarsDomain } from '../domain';
import { MAGE_WARS_COMMANDS } from '../domain/commands';
import {
    buildMageWarsObjectAbilityActivationOpportunity,
    buildMageWarsSelfObjectAbilityActivationOpportunity,
    MAGE_WARS_OBJECT_ABILITY_EXECUTION_TAG,
    mageWarsObjectAbilityExecutorRegistry,
    type MageWarsObjectAbilityActivationChoiceValue,
} from '../domain/objectAbilityRuntime';
import {
    MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG,
    mageWarsSpellAbilityExecutorRegistry,
} from '../domain/spellAbilityExecutors';
import { ARENA_ZONE_IDS, MAGE_WARS_OBJECT_ABILITY_IDS } from '../domain/ids';
import type { MageWarsArenaObjectState, MageWarsCore } from '../domain/types';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 3,
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

function makeMageWarsAbilityState(overrides: {
    object?: Partial<MageWarsArenaObjectState>;
    mana?: number;
    phase?: string;
} = {}): MatchState<MageWarsCore> {
    const core = MageWarsDomain.setup(['0', '1'], fixedRandom);
    const object: MageWarsArenaObjectState = {
        id: 'blue-gremlin-1',
        kind: 'creature',
        ownerId: '0',
        sourceSpellCardId: 2822,
        sourceObjectId: 'spell-card-2822',
        name: '蓝色精怪',
        zoneId: ARENA_ZONE_IDS.A1,
        life: 5,
        damage: 0,
        armor: 0,
        actionReady: true,
        guarding: false,
        statusTokens: {},
        ...overrides.object,
    };

    return {
        core: {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    mana: overrides.mana ?? 2,
                },
            },
            objects: {
                ...core.objects,
                [object.id]: object,
            },
            arena: core.arena.map((zone) => (
                zone.id === object.zoneId
                    ? { ...zone, objectIds: [...zone.objectIds, object.id] }
                    : zone
            )),
        },
        sys: {
            ...createInitialSystemState(['0', '1'], [], 'mage-wars-ability-contract-test'),
            phase: overrides.phase ?? 'creatureAction',
        },
    };
}

function makeMageWarsAbilityObject(
    id: string,
    ownerId: string,
    zoneId: MageWarsArenaObjectState['zoneId'],
    overrides: Partial<MageWarsArenaObjectState> = {},
): MageWarsArenaObjectState {
    return {
        id,
        kind: 'creature',
        ownerId,
        sourceSpellCardId: 2823,
        sourceObjectId: `spell-card-${id}`,
        name: id,
        zoneId,
        life: 5,
        damage: 0,
        armor: 0,
        actionReady: true,
        guarding: false,
        statusTokens: {},
        ...overrides,
    };
}

function withMageWarsAbilityObject(
    state: MatchState<MageWarsCore>,
    object: MageWarsArenaObjectState,
): MatchState<MageWarsCore> {
    return {
        ...state,
        core: {
            ...state.core,
            objects: {
                ...state.core.objects,
                [object.id]: object,
            },
            arena: state.core.arena.map((zone) => (
                zone.id === object.zoneId && !zone.objectIds.includes(object.id)
                    ? { ...zone, objectIds: [...zone.objectIds, object.id] }
                    : zone
            )),
        },
    };
}

describe('mage-wars ability catalog', () => {
    test('registers every current arena object ability with an executor', () => {
        const objectAbilityIds = Object.values(MAGE_WARS_OBJECT_ABILITY_IDS);

        expect(mageWarsObjectAbilityRegistry.size).toBe(objectAbilityIds.length);

        for (const abilityId of objectAbilityIds) {
            const ability = mageWarsObjectAbilityRegistry.get(abilityId);
            expect(ability).toBeDefined();
            expect(ability).toMatchObject({
                id: abilityId,
                trigger: 'arena-object-ability',
                meta: {
                    abilityId,
                    implementationStatus: 'implemented',
                },
            });
            expect(ability?.meta.sourceKind).toMatch(/^(creature|attached-equipment)$/);
            expect(ability?.meta.sourceSpellCardId).toEqual(expect.any(Number));
            expect(ability?.meta.actionSpeed).toMatch(/^(quick|normal|source-trait)$/);
            expect(ability?.meta.actionCost).toMatch(/^(normal|none)$/);
            expect(ability?.effects[0]).toMatchObject({ type: 'object-ability-runtime' });
            expect(mageWarsObjectAbilityExecutorRegistry.has(abilityId, MAGE_WARS_OBJECT_ABILITY_EXECUTION_TAG)).toBe(true);
        }
    });

    test('registers every standard starting spell as a stable ability id', () => {
        const materialized = materializeMageWarsConfigPackage();
        const spellObjects = materialized.package.objects
            .filter((object) => object.tags?.includes('standard-starting-spell'));

        expect(spellObjects).toHaveLength(153);
        expect(mageWarsAbilityRegistry.size).toBe(153);

        for (const object of spellObjects) {
            const cardId = object.data?.cardId;
            expect(typeof cardId).toBe('number');
            const ability = getMageWarsSpellAbilityDef(cardId as number);
            expect(ability).toMatchObject({
                id: getMageWarsSpellAbilityId(cardId as number),
                name: object.name,
                trigger: 'spell-cast',
                meta: {
                    objectId: object.id,
                    cardId,
                    spellType: object.data?.spellType,
                    sourceContract: object.data?.sourceContract,
                },
            });
        }
    });

    test('keeps standard spell ability catalog and executors aligned', () => {
        const abilityCatalog = buildMageWarsConfigAbilityCatalog();
        const registeredAbilityIds = Array.from(mageWarsAbilityRegistry.getRegisteredIds()).sort();

        expect(Object.keys(abilityCatalog).sort()).toEqual(registeredAbilityIds);
        for (const abilityId of registeredAbilityIds) {
            expect(mageWarsSpellAbilityExecutorRegistry.has(
                abilityId,
                MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG,
            )).toBe(true);
        }

        const needsCodeIds = mageWarsAbilityRegistry.getByTag('implementation:needs-code')
            .map((def) => def.id)
            .sort();
        expect(needsCodeIds).toHaveLength(65);
        expect(needsCodeIds).toEqual(expect.arrayContaining([
            getMageWarsSpellAbilityId(1804),
            getMageWarsSpellAbilityId(2500),
            getMageWarsSpellAbilityId(25700),
        ]));
        expect(needsCodeIds).not.toContain(getMageWarsSpellAbilityId(3407));
    });

    test('tracks standard starting spell effects separately from code gaps', () => {
        expect(summarizeMageWarsAbilityGaps()).toEqual({
            total: 153,
            implemented: 88,
            needsCode: 65,
            bySpellType: {
                '攻击': { total: 12, implemented: 10, needsCode: 2 },
                '结界': { total: 38, implemented: 22, needsCode: 16 },
                '魔物': { total: 15, implemented: 2, needsCode: 13 },
                '生物': { total: 33, implemented: 25, needsCode: 8 },
                '咒语': { total: 28, implemented: 15, needsCode: 13 },
                '装备': { total: 27, implemented: 14, needsCode: 13 },
            },
        });

        expect(getMageWarsSpellAbilityDef(3402)?.tags).toEqual(expect.arrayContaining([
            'standard-starting-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));
        expect(getMageWarsSpellAbilityDef(3710)?.tags).toEqual(expect.arrayContaining([
            'standard-starting-spell',
            'spell-type:装备',
            'implementation:implemented',
        ]));
        expect(getMageWarsSpellAbilityDef(25700)?.effects).toEqual([expect.objectContaining({
            type: 'requires-code-support',
            cardId: 25700,
            spellType: '魔物',
        })]);
        expect(getMageWarsSpellAbilityDef(2500)?.effects).toEqual([expect.objectContaining({
            type: 'requires-code-support',
            cardId: 2500,
            spellType: '魔物',
        })]);
    });

    test('exposes a GameConfig-compatible ability catalog for validation', () => {
        const abilityCatalog = buildMageWarsConfigAbilityCatalog();

        expect(Object.keys(abilityCatalog)).toHaveLength(153);
        expect(abilityCatalog[getMageWarsSpellAbilityId(3402)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3402),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3710)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3710),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(25700)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(25700),
            implementationStatus: 'needs-code',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(2500)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(2500),
            implementationStatus: 'needs-code',
            allowExtraParams: true,
        });
    });

    test('projects a self object ability through Ability -> Opportunity -> ChoiceRequest', () => {
        const state = makeMageWarsAbilityState();
        const opportunity = buildMageWarsSelfObjectAbilityActivationOpportunity({
            state,
            playerId: '0',
            objectId: 'blue-gremlin-1',
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
            timestamp: 42,
        });

        expect(opportunity).toMatchObject({
            id: expect.stringContaining(MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT),
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            sourceRef: {
                id: 'blue-gremlin-1',
                controllerId: '0',
                ownerId: '0',
                metadata: {
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                    abilityLifecyclePhase: 'activation',
                    abilitySourceId: 'blue-gremlin-1',
                    mageWarsObjectAbilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                },
            },
            resolution: { type: 'choice-request' },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request).toMatchObject({
            gameId: 'mage-wars',
            playerId: '0',
            kind: 'confirm',
            sourceId: 'blue-gremlin-1',
            selection: { min: 1, max: 1 },
            ai: { status: 'shared-policy', policyId: 'mage-wars-button-options' },
            metadata: {
                opportunityId: opportunity!.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                abilitySourceId: 'blue-gremlin-1',
                objectId: 'blue-gremlin-1',
            },
        });
        expect(request.candidates).toHaveLength(1);
        expect(request.candidates[0]).toMatchObject({
            id: 'activate',
            value: {
                action: 'activate-object-ability',
                objectId: 'blue-gremlin-1',
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                manaCost: 1,
            },
            commands: [{
                type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                payload: {
                    objectId: 'blue-gremlin-1',
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                    manaCost: 1,
                },
            }],
            metadata: {
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                abilitySourceId: 'blue-gremlin-1',
                abilityControllerId: '0',
            },
            actionKeyParts: [
                'ability',
                'activation',
                'blue-gremlin-1',
                MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                'base',
                'activate',
            ],
        });
    });

    test('keeps invalid self object ability opportunities visible as inactive contracts', () => {
        const state = makeMageWarsAbilityState({ mana: 0 });
        const opportunity = buildMageWarsSelfObjectAbilityActivationOpportunity({
            state,
            playerId: '0',
            objectId: 'blue-gremlin-1',
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
        });

        expect(opportunity).toMatchObject({
            condition: { satisfied: false, reason: 'insufficientMana' },
        });
        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request.candidates[0]).toMatchObject({
            id: 'activate',
            disabled: true,
            disabledReason: 'insufficientMana',
        });
    });

    test('does not guess target enumeration for non-self object abilities', () => {
        const state = makeMageWarsAbilityState({
            object: {
                id: 'cleric-1',
                sourceSpellCardId: 2811,
                sourceObjectId: 'spell-card-2811',
                name: 'Asyran Cleric',
            },
        });

        expect(buildMageWarsSelfObjectAbilityActivationOpportunity({
            state,
            playerId: '0',
            objectId: 'cleric-1',
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
        })).toBeNull();
    });

    test('projects Asyran Cleric healing light target selection through Ability -> Opportunity -> ChoiceRequest', () => {
        let state = makeMageWarsAbilityState({
            object: {
                id: 'cleric-1',
                sourceSpellCardId: 2811,
                sourceObjectId: 'spell-card-2811',
                name: 'Asyran Cleric',
            },
        });
        state = withMageWarsAbilityObject(state, makeMageWarsAbilityObject('wounded-cat-0', '0', ARENA_ZONE_IDS.A2, {
            name: 'Wounded Cat',
            damage: 3,
        }));
        state = withMageWarsAbilityObject(state, makeMageWarsAbilityObject('skeleton-1', '1', ARENA_ZONE_IDS.A2, {
            sourceSpellCardId: 2826,
            name: 'Skeleton Sentry',
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体；精神免疫',
        }));
        state = withMageWarsAbilityObject(state, makeMageWarsAbilityObject('far-cat-1', '1', ARENA_ZONE_IDS.D3, {
            name: 'Far Cat',
        }));

        const opportunity = buildMageWarsObjectAbilityActivationOpportunity({
            state,
            playerId: '0',
            objectId: 'cleric-1',
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
            timestamp: 77,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: { targetMode: 'living-object' },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                objectId: 'cleric-1',
                targetMode: 'living-object',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request).toMatchObject({
            playerId: '0',
            kind: 'select-object',
            sourceId: 'cleric-1',
            selection: { min: 1, max: 1 },
            ai: { status: 'shared-policy', policyId: 'choice-request:simple-target' },
            metadata: {
                opportunityId: opportunity!.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                abilitySourceId: 'cleric-1',
                targetMode: 'living-object',
            },
        });

        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:wounded-cat-0')).toMatchObject({
            value: {
                action: 'activate-object-ability',
                objectId: 'cleric-1',
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                manaCost: 0,
                targetObjectId: 'wounded-cat-0',
            },
            commands: [{
                type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                payload: {
                    objectId: 'cleric-1',
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                    manaCost: 0,
                    targetObjectId: 'wounded-cat-0',
                },
            }],
            metadata: {
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                abilitySourceId: 'cleric-1',
                abilityControllerId: '0',
                targetObjectId: 'wounded-cat-0',
            },
            actionKeyParts: [
                'ability',
                'activation',
                'cleric-1',
                MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                'target',
                'wounded-cat-0',
            ],
        });
        expect(candidateById.get('target:skeleton-1')).toMatchObject({
            disabled: true,
            disabledReason: 'invalidTargetObject',
        });
        expect(candidateById.get('target:far-cat-1')).toMatchObject({
            disabled: true,
            disabledReason: 'targetOutOfRange',
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsObjectAbilityActivationChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => !target.disabled)
            .map((target) => ({
                id: target.id,
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual(expect.arrayContaining([{
            id: 'target:wounded-cat-0',
            targetRef: 'wounded-cat-0',
            commandPreview: [{
                type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                payload: {
                    objectId: 'cleric-1',
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                    manaCost: 0,
                    targetObjectId: 'wounded-cat-0',
                },
            }],
        }]));

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([{
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            payload: {
                objectId: 'cleric-1',
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                manaCost: 0,
                targetObjectId: 'wounded-cat-0',
            },
        }]));
    });
});
