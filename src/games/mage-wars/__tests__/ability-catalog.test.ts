import { describe, expect, test } from 'vitest';
import {
    projectChoiceRequestToAiLegalActions,
} from '../../../engine/ChoiceRequest';
import { projectChoiceRequestToDirectSelectionTargets } from '../../../engine/systems';
import { buildChoiceRequestFromOpportunity } from '../../../engine/TimingOpportunity';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, RandomFn } from '../../../engine/types';
import {
    getMageWarsSpellCardFromConfig,
    materializeMageWarsConfigPackage,
} from '../data/configPackage';
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
    MAGE_WARS_OBJECT_ABILITY_EXECUTION_TAG,
    mageWarsObjectAbilityExecutorRegistry,
    type MageWarsObjectAbilityActivationChoiceValue,
} from '../domain/objectAbilityRuntime';
import {
    buildMageWarsMageAbilityActivationOpportunity,
    type MageWarsMageAbilityActivationChoiceValue,
} from '../domain/mageAbilityRuntime';
import {
    buildMageWarsSpellCastOpportunity,
    type MageWarsSpellCastChoiceValue,
} from '../domain/spellCastRuntime';
import { resolveMageWarsSpellCastChoiceFamily } from '../domain/spellRules';
import {
    MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG,
    executeMageWarsSpellAbility,
    mageWarsSpellAbilityExecutorRegistry,
} from '../domain/spellAbilityExecutors';
import {
    ARENA_ZONE_IDS,
    getMageWarsWallEdgeId,
    MAGE_IDS,
    MAGE_WARS_MAGE_ABILITY_IDS,
    MAGE_WARS_OBJECT_ABILITY_IDS,
    STATUS_TOKEN_IDS,
    type MageId,
} from '../domain/ids';
import type { MageWarsArenaObjectState, MageWarsCore } from '../domain/types';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 3,
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

function makeMageWarsAbilityState(overrides: {
    object?: Partial<MageWarsArenaObjectState>;
    mageId?: MageId;
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
                    mageId: overrides.mageId ?? core.players['0'].mageId,
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

function withPreparedMageWarsSpell(
    state: MatchState<MageWarsCore>,
    playerId: string,
    spellCardId: number,
): MatchState<MageWarsCore> {
    return {
        ...state,
        core: {
            ...state.core,
            players: {
                ...state.core.players,
                [playerId]: {
                    ...state.core.players[playerId],
                    preparedSpellCardIds: [spellCardId],
                },
            },
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
        expect(needsCodeIds).toHaveLength(63);
        expect(needsCodeIds).toEqual(expect.arrayContaining([
            getMageWarsSpellAbilityId(1804),
        ]));
        expect(needsCodeIds).not.toContain(getMageWarsSpellAbilityId(3407));
        expect(needsCodeIds).not.toContain(getMageWarsSpellAbilityId(2500));
        expect(needsCodeIds).not.toContain(getMageWarsSpellAbilityId(25700));
    });

    test('uses concrete spell-cast families instead of a coarse zone target family', () => {
        const familyBySpellCardId = (spellCardId: number): string | undefined => {
            const spell = getMageWarsSpellCardFromConfig(spellCardId);
            expect(spell).toBeDefined();
            return resolveMageWarsSpellCastChoiceFamily(spell!);
        };
        const families = [
            familyBySpellCardId(2800),
            familyBySpellCardId(1701),
            familyBySpellCardId(3405),
            familyBySpellCardId(1913),
        ];

        expect(families).toEqual([
            'summon-creature',
            'zone-attack',
            'zone-healing',
            'visible-area-enchantment',
        ]);
        expect(families).not.toContain('zone-target');
    });

    test('throws a contract error when execution is reached without a spell-cast family', () => {
        const spellCardId = 1804;
        const spell = getMageWarsSpellCardFromConfig(spellCardId);
        expect(spell).toBeDefined();

        expect(() => executeMageWarsSpellAbility({
            ownerId: '0',
            timestamp: 104,
            state: makeMageWarsAbilityState({
                mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                mana: 20,
                phase: 'creatureAction',
            }),
            command: {
                type: MAGE_WARS_COMMANDS.CAST_SPELL,
                playerId: '0',
                payload: {
                    spellCardId,
                    manaCost: 8,
                    targetPlayerId: '1',
                },
            },
            random: fixedRandom,
            spell: spell!,
            manaCost: 8,
        })).toThrow(/without a spell-cast family/);
    });

    test('tracks standard starting spell effects separately from code gaps', () => {
        expect(summarizeMageWarsAbilityGaps()).toEqual({
            total: 153,
            implemented: 90,
            needsCode: 63,
            bySpellType: {
                '攻击': { total: 12, implemented: 10, needsCode: 2 },
                '结界': { total: 38, implemented: 22, needsCode: 16 },
                '魔物': { total: 15, implemented: 4, needsCode: 11 },
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
        expect(getMageWarsSpellAbilityDef(25700)?.tags).toEqual(expect.arrayContaining([
            'standard-starting-spell',
            'spell-type:魔物',
            'implementation:implemented',
            '墙体',
        ]));
        expect(getMageWarsSpellAbilityDef(25700)?.effects).toEqual([]);
        expect(getMageWarsSpellAbilityDef(2500)?.tags).toEqual(expect.arrayContaining([
            'standard-starting-spell',
            'spell-type:魔物',
            'implementation:implemented',
            '墙体',
        ]));
        expect(getMageWarsSpellAbilityDef(2500)?.effects).toEqual([]);
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
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(2500)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(2500),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
    });

    test('projects a self object ability through Ability -> Opportunity -> ChoiceRequest', () => {
        const state = makeMageWarsAbilityState();
        const opportunity = buildMageWarsObjectAbilityActivationOpportunity({
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
        const opportunity = buildMageWarsObjectAbilityActivationOpportunity({
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

    test('does not downgrade target object abilities to self confirmations', () => {
        const state = makeMageWarsAbilityState({
            object: {
                id: 'cleric-1',
                sourceSpellCardId: 2811,
                sourceObjectId: 'spell-card-2811',
                name: 'Asyran Cleric',
            },
        });

        const opportunity = buildMageWarsObjectAbilityActivationOpportunity({
            state,
            playerId: '0',
            objectId: 'cleric-1',
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
        });

        expect(opportunity).toMatchObject({
            targetRequest: {
                kind: 'select-object',
                metadata: { targetMode: 'living-object' },
            },
            resolution: { type: 'choice-request' },
        });
        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request.kind).toBe('select-object');
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

    test('projects Priestess quick restoration through Ability -> Opportunity -> ChoiceRequest', () => {
        const state = makeMageWarsAbilityState({
            mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'burning-cleric-0',
                sourceSpellCardId: 2907,
                sourceObjectId: 'spell-card-2907',
                name: 'Burning Cleric',
                zoneId: ARENA_ZONE_IDS.A2,
                statusTokens: {
                    [STATUS_TOKEN_IDS.BURN]: 2,
                    [STATUS_TOKEN_IDS.DAZE]: 1,
                },
            },
        });

        const opportunity = buildMageWarsMageAbilityActivationOpportunity({
            state,
            playerId: '0',
            abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK,
            timestamp: 91,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'creature-status-removal',
                    statusTokenScope: 'single-status-type',
                },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK,
                playerId: '0',
                targetMode: 'creature-status-removal',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request).toMatchObject({
            playerId: '0',
            kind: 'select-object',
            sourceId: '0',
            selection: { min: 1, max: 1 },
            ai: { status: 'shared-policy', policyId: 'choice-request:simple-target' },
            metadata: {
                opportunityId: opportunity!.id,
                abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK,
                abilitySourceId: '0',
                targetMode: 'creature-status-removal',
            },
        });

        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:burning-cleric-0:status:burn')).toMatchObject({
            value: {
                action: 'activate-mage-ability',
                playerId: '0',
                abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK,
                manaCost: 4,
                targetObjectId: 'burning-cleric-0',
                statusTokenIds: [STATUS_TOKEN_IDS.BURN],
            },
            commands: [{
                type: MAGE_WARS_COMMANDS.USE_MAGE_ABILITY,
                payload: {
                    abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK,
                    manaCost: 4,
                    targetObjectId: 'burning-cleric-0',
                    statusTokenIds: [STATUS_TOKEN_IDS.BURN],
                },
            }],
            metadata: {
                abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK,
                abilitySourceId: '0',
                abilityControllerId: '0',
                targetObjectId: 'burning-cleric-0',
                statusTokenIds: [STATUS_TOKEN_IDS.BURN],
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsMageAbilityActivationChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:burning-cleric-0:status:burn')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'burning-cleric-0',
            commandPreview: [{
                type: MAGE_WARS_COMMANDS.USE_MAGE_ABILITY,
                payload: {
                    abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK,
                    manaCost: 4,
                    targetObjectId: 'burning-cleric-0',
                    statusTokenIds: [STATUS_TOKEN_IDS.BURN],
                },
            }],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([{
            type: MAGE_WARS_COMMANDS.USE_MAGE_ABILITY,
            payload: {
                abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK,
                manaCost: 4,
                targetObjectId: 'burning-cleric-0',
                statusTokenIds: [STATUS_TOKEN_IDS.BURN],
            },
        }]));
    });

    test('projects Priestess standard restoration status combinations for AI and direct target surfaces', () => {
        const state = makeMageWarsAbilityState({
            mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
            mana: 10,
            phase: 'creatureAction',
            object: {
                id: 'afflicted-angel-0',
                sourceSpellCardId: 2907,
                sourceObjectId: 'spell-card-2907',
                name: 'Afflicted Angel',
                zoneId: ARENA_ZONE_IDS.A2,
                statusTokens: {
                    [STATUS_TOKEN_IDS.BURN]: 1,
                    [STATUS_TOKEN_IDS.STUN]: 1,
                    [STATUS_TOKEN_IDS.SLEEP]: 1,
                },
            },
        });

        const opportunity = buildMageWarsMageAbilityActivationOpportunity({
            state,
            playerId: '0',
            abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_STANDARD,
            timestamp: 92,
        });
        const request = buildChoiceRequestFromOpportunity(opportunity!);

        expect(request).toMatchObject({
            playerId: '0',
            kind: 'select-object',
            sourceId: '0',
            ai: { status: 'shared-policy', policyId: 'choice-request:simple-target' },
            metadata: {
                abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_STANDARD,
                statusTokenScope: 'multiple-status-types',
            },
        });

        const fullRestoreCommand = {
            type: MAGE_WARS_COMMANDS.USE_MAGE_ABILITY,
            payload: {
                abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_STANDARD,
                manaCost: 9,
                targetObjectId: 'afflicted-angel-0',
                statusTokenIds: [STATUS_TOKEN_IDS.BURN, STATUS_TOKEN_IDS.STUN, STATUS_TOKEN_IDS.SLEEP],
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:afflicted-angel-0:status:burn+stun+sleep')).toMatchObject({
            value: {
                action: 'activate-mage-ability',
                playerId: '0',
                abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_STANDARD,
                manaCost: 9,
                targetObjectId: 'afflicted-angel-0',
                statusTokenIds: [STATUS_TOKEN_IDS.BURN, STATUS_TOKEN_IDS.STUN, STATUS_TOKEN_IDS.SLEEP],
            },
            commands: [fullRestoreCommand],
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsMageAbilityActivationChoiceValue>(request);
        expect(directSurface.targets.some((target) => (
            target.targetRef === 'afflicted-angel-0'
            && target.commandPreview.some((command) => (
                command.type === MAGE_WARS_COMMANDS.USE_MAGE_ABILITY
                && command.payload?.manaCost === 9
            ))
        ))).toBe(true);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            fullRestoreCommand,
        ]));
    });

    test('projects Rouse the Beast spell casting through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 3403;
        const state = makeMageWarsAbilityState({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            mana: 10,
            phase: 'finalQuickcast',
            object: {
                id: 'fresh-cat-0',
                ownerId: '0',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Fresh Cat',
                zoneId: ARENA_ZONE_IDS.A3,
                actionReady: false,
                summonedTurnNumber: 1,
            },
        });
        const preparedState: MatchState<MageWarsCore> = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': {
                        ...state.core.players['0'],
                        preparedSpellCardIds: [spellCardId],
                    },
                },
            },
        };

        const opportunity = buildMageWarsSpellCastOpportunity({
            state: preparedState,
            playerId: '0',
            spellCardId,
            timestamp: 93,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                spellCardId,
                targetMode: 'direct-object',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request).toMatchObject({
            playerId: '0',
            kind: 'select-object',
            selection: { min: 1, max: 1 },
            ai: { status: 'shared-policy', policyId: 'choice-request:simple-target' },
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceKind: 'card',
                spellCardId,
                targetMode: 'direct-object',
            },
        });

        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 1,
                targetObjectId: 'fresh-cat-0',
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:fresh-cat-0')).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 1,
                targetObjectId: 'fresh-cat-0',
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'fresh-cat-0',
                spellCardId,
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:fresh-cat-0')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'fresh-cat-0',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects legacy Charge On spell casting through Ability -> Opportunity -> ChoiceRequest legality rejection', () => {
        const spellCardId = 3407;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'charge-target-cat',
                ownerId: '0',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Charge Target Cat',
                zoneId: ARENA_ZONE_IDS.A2,
            },
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 94,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: false, reason: 'spellNotInPresetSpellbook' },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 4,
                targetObjectId: 'charge-target-cat',
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:charge-target-cat')).toMatchObject({
            disabled: true,
            disabledReason: 'spellNotInPresetSpellbook',
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 4,
                targetObjectId: 'charge-target-cat',
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'charge-target-cat',
                spellCardId,
                targetMode: 'direct-object',
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:charge-target-cat')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
                disabled: target.disabled,
                disabledReason: target.disabledReason,
            }))).toEqual([{
            targetRef: 'charge-target-cat',
            commandPreview: [expectedCommand],
            disabled: true,
            disabledReason: 'spellNotInPresetSpellbook',
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.actions).toEqual([]);
        expect(legalActions.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({
                severity: 'error',
                code: 'mandatory-choice-unsatisfied',
            }),
        ]));
    });

    test('projects Call of the Wild as a confirm spell ChoiceRequest', () => {
        const spellCardId = 3417;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 95,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'confirm',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'no-target',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                spellCardId,
                targetMode: 'no-target',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 4,
            },
        };
        expect(request).toMatchObject({
            playerId: '0',
            kind: 'confirm',
            selection: { min: 1, max: 1 },
            ai: { status: 'shared-policy', policyId: 'choice-request:confirm-current' },
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceKind: 'card',
                spellCardId,
                targetMode: 'no-target',
            },
        });
        expect(request.candidates).toHaveLength(1);
        expect(request.candidates[0]).toMatchObject({
            id: `confirm:${spellCardId}`,
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 4,
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                spellCardId,
                targetMode: 'no-target',
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets.map((target) => ({
            id: target.id,
            commandPreview: target.commandPreview,
        }))).toEqual([{
            id: `confirm:${spellCardId}`,
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual([expectedCommand]);
    });

    test('projects Sleep spell casting through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 3411;
        const state = makeMageWarsAbilityState({
            mageId: MAGE_IDS.WIZARD_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'sleep-target-cat',
                ownerId: '1',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Sleep Target Cat',
                zoneId: ARENA_ZONE_IDS.A2,
            },
        });
        const preparedState: MatchState<MageWarsCore> = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': {
                        ...state.core.players['0'],
                        preparedSpellCardIds: [spellCardId],
                    },
                },
            },
        };

        const opportunity = buildMageWarsSpellCastOpportunity({
            state: preparedState,
            playerId: '0',
            spellCardId,
            timestamp: 94,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                phase: 'initiativeQuickcast',
                spellCardId,
                targetMode: 'direct-object',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request).toMatchObject({
            playerId: '0',
            kind: 'select-object',
            selection: { min: 1, max: 1 },
            ai: { status: 'shared-policy', policyId: 'choice-request:simple-target' },
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceKind: 'card',
                spellCardId,
                targetMode: 'direct-object',
            },
        });

        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 4,
                targetObjectId: 'sleep-target-cat',
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:sleep-target-cat')).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 4,
                targetObjectId: 'sleep-target-cat',
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'sleep-target-cat',
                spellCardId,
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:sleep-target-cat')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'sleep-target-cat',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects Bloodstrike spell casting through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 3404;
        const state = makeMageWarsAbilityState({
            mageId: MAGE_IDS.WARLOCK_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'bloodstrike-cat-0',
                ownerId: '0',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Bloodstrike Cat',
                zoneId: ARENA_ZONE_IDS.A2,
            },
        });
        const preparedState: MatchState<MageWarsCore> = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': {
                        ...state.core.players['0'],
                        preparedSpellCardIds: [spellCardId],
                    },
                },
            },
        };

        const opportunity = buildMageWarsSpellCastOpportunity({
            state: preparedState,
            playerId: '0',
            spellCardId,
            timestamp: 95,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                phase: 'initiativeQuickcast',
                spellCardId,
                targetMode: 'direct-object',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request).toMatchObject({
            playerId: '0',
            kind: 'select-object',
            selection: { min: 1, max: 1 },
            ai: { status: 'shared-policy', policyId: 'choice-request:simple-target' },
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceKind: 'card',
                spellCardId,
                targetMode: 'direct-object',
            },
        });

        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 3,
                targetObjectId: 'bloodstrike-cat-0',
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:bloodstrike-cat-0')).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 3,
                targetObjectId: 'bloodstrike-cat-0',
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'bloodstrike-cat-0',
                spellCardId,
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:bloodstrike-cat-0')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'bloodstrike-cat-0',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects single healing spell object and player targets through ChoiceRequest', () => {
        const spellCardId = 3402;
        let state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'healing-target-cat',
                ownerId: '0',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Healing Target Cat',
                zoneId: ARENA_ZONE_IDS.A2,
                damage: 3,
            },
        }), '0', spellCardId);
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': { ...state.core.players['0'], mageZoneId: ARENA_ZONE_IDS.A2, damage: 2 },
                },
            },
        };

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 94,
        });

        expect(opportunity).toMatchObject({
            condition: { satisfied: true },
            targetRequest: {
                kind: 'choose-option',
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const objectCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 5,
                targetObjectId: 'healing-target-cat',
            },
        };
        const playerCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 5,
                targetPlayerId: '0',
            },
        };

        expect(request.kind).toBe('choose-option');
        expect(request.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'target:healing-target-cat', commands: [objectCommand] }),
            expect.objectContaining({ id: 'target-player:0', commands: [playerCommand] }),
        ]));

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets.map((target) => ({
            targetRef: target.targetRef,
            commandPreview: target.commandPreview,
        }))).toEqual(expect.arrayContaining([
            { targetRef: 'healing-target-cat', commandPreview: [objectCommand] },
            { targetRef: '0', commandPreview: [playerCommand] },
        ]));

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            objectCommand,
            playerCommand,
        ]));
    });

    test('projects Life Drain player targets through ChoiceRequest', () => {
        const spellCardId = 3400;
        let state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WARLOCK_APPRENTICE,
            mana: 20,
            phase: 'initiativeQuickcast',
            object: {
                id: 'life-drain-target-cat',
                ownerId: '1',
                sourceSpellCardId: 2907,
                sourceObjectId: 'spell-card-2907',
                name: 'Life Drain Target',
                zoneId: ARENA_ZONE_IDS.A2,
            },
        }), '0', spellCardId);
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': { ...state.core.players['0'], mageZoneId: ARENA_ZONE_IDS.A2, damage: 5 },
                    '1': { ...state.core.players['1'], mageZoneId: ARENA_ZONE_IDS.A2 },
                },
            },
        };

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 95,
        });

        expect(opportunity).toMatchObject({
            condition: { satisfied: true },
            targetRequest: {
                kind: 'choose-option',
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 12,
                targetPlayerId: '1',
            },
        };

        expect(request.candidates.find((candidate) => candidate.id === 'target-player:0')).toBeUndefined();
        expect(request.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'target-player:1', commands: [expectedCommand] }),
        ]));

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects ordinary equipment self-target spell through ChoiceRequest', () => {
        const spellCardId = 3702;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WARLOCK_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 96,
        });

        expect(opportunity).toMatchObject({
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-player',
                metadata: {
                    targetMode: 'direct-player',
                    spellCardId,
                },
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 2,
                targetPlayerId: '0',
            },
        };

        expect(request.kind).toBe('select-player');
        expect(request.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'target-player:0', commands: [expectedCommand] }),
        ]));
        expect(request.candidates.find((candidate) => candidate.id === 'target-player:1')).toBeUndefined();

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets.map((target) => ({
            targetRef: target.targetRef,
            commandPreview: target.commandPreview,
        }))).toEqual([{
            targetRef: '0',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual([
            expectedCommand,
        ]);
    });

    test('projects damage-barrier equipment self-target spell through ChoiceRequest', () => {
        const spellCardId = 3700;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WARLOCK_APPRENTICE,
            mana: 12,
            phase: 'initiativeQuickcast',
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 97,
        });

        expect(opportunity).toMatchObject({
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-player',
                metadata: {
                    targetMode: 'direct-player',
                    spellCardId,
                },
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 8,
                targetPlayerId: '0',
            },
        };

        expect(request.kind).toBe('select-player');
        expect(request.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'target-player:0', commands: [expectedCommand] }),
        ]));
        expect(request.candidates.find((candidate) => candidate.id === 'target-player:1')).toBeUndefined();

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets.map((target) => ({
            targetRef: target.targetRef,
            commandPreview: target.commandPreview,
        }))).toEqual([{
            targetRef: '0',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual([
            expectedCommand,
        ]);
    });

    test('projects Elemental Staff cast binding choices through ChoiceRequest', () => {
        const spellCardId = 3716;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WIZARD_APPRENTICE,
            mana: 12,
            phase: 'initiativeQuickcast',
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 98,
        });

        expect(opportunity).toMatchObject({
            condition: { satisfied: true },
            targetRequest: {
                kind: 'choose-option',
                metadata: {
                    targetMode: 'player-bound-spell',
                    spellCardId,
                },
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const noBindingCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 5,
                targetPlayerId: '0',
            },
        };
        const boundSpellCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 5,
                targetPlayerId: '0',
                boundSpellCardId: 1705,
            },
        };

        expect(request.kind).toBe('choose-option');
        expect(request.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'target-player:0:bound-spell:none',
                commands: [noBindingCommand],
                metadata: expect.objectContaining({
                    targetPlayerId: '0',
                    targetMode: 'player-bound-spell',
                }),
            }),
            expect.objectContaining({
                id: 'target-player:0:bound-spell:1705',
                commands: [boundSpellCommand],
                metadata: expect.objectContaining({
                    targetPlayerId: '0',
                    boundSpellCardId: 1705,
                    targetMode: 'player-bound-spell',
                }),
            }),
        ]));

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.targetRef === '0')
            .map((target) => target.commandPreview[0])).toEqual(expect.arrayContaining([
            noBindingCommand,
            boundSpellCommand,
        ]));

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            noBindingCommand,
            boundSpellCommand,
        ]));
    });

    test('projects direct attack spell object and mage targets through ChoiceRequest', () => {
        const spellCardId = 1700;
        let state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WARLOCK_APPRENTICE,
            mana: 20,
            phase: 'initiativeQuickcast',
            object: {
                id: 'fireball-target-cat',
                ownerId: '1',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Fireball Target Cat',
                zoneId: ARENA_ZONE_IDS.A2,
            },
        }), '0', spellCardId);
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': { ...state.core.players['0'], mageZoneId: ARENA_ZONE_IDS.A2 },
                    '1': { ...state.core.players['1'], mageZoneId: ARENA_ZONE_IDS.A2 },
                },
            },
        };

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 97,
        });

        expect(opportunity).toMatchObject({
            condition: { satisfied: true },
            targetRequest: {
                kind: 'choose-option',
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const objectCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 8,
                targetObjectId: 'fireball-target-cat',
            },
        };
        const playerCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 8,
                targetPlayerId: '1',
            },
        };

        expect(request.kind).toBe('choose-option');
        expect(request.candidates.find((candidate) => candidate.id === 'target-player:0')).toBeUndefined();
        expect(request.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'target:fireball-target-cat', commands: [objectCommand] }),
            expect.objectContaining({ id: 'target-player:1', commands: [playerCommand] }),
        ]));

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets.map((target) => ({
            targetRef: target.targetRef,
            commandPreview: target.commandPreview,
        }))).toEqual(expect.arrayContaining([
            { targetRef: 'fireball-target-cat', commandPreview: [objectCommand] },
            { targetRef: '1', commandPreview: [playerCommand] },
        ]));

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            objectCommand,
            playerCommand,
        ]));
    });

    test('projects Jet Stream object and push destination choices through ChoiceRequest', () => {
        const spellCardId = 1711;
        const baseState = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            mana: 20,
            phase: 'initiativeQuickcast',
            object: {
                id: 'jet-stream-target-cat',
                ownerId: '1',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Jet Stream Target Cat',
                zoneId: ARENA_ZONE_IDS.A2,
            },
        }), '0', spellCardId);
        const state = {
            ...baseState,
            core: {
                ...baseState.core,
                players: {
                    ...baseState.core.players,
                    '1': {
                        ...baseState.core.players['1'],
                        mageZoneId: ARENA_ZONE_IDS.A2,
                    },
                },
                arena: baseState.core.arena.map((zone) => ({
                    ...zone,
                    occupantIds: zone.id === ARENA_ZONE_IDS.A2
                        ? Array.from(new Set([...zone.occupantIds.filter((id) => id !== '1'), '1']))
                        : zone.occupantIds.filter((id) => id !== '1'),
                })),
            },
        };

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 98,
        });

        expect(opportunity).toMatchObject({
            condition: { satisfied: true },
            targetRequest: {
                kind: 'choose-option',
                metadata: {
                    targetMode: 'target-push-zone',
                    spellCardId,
                },
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 4,
                targetObjectId: 'jet-stream-target-cat',
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
        };
        const expectedPlayerCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 4,
                targetPlayerId: '1',
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
        };
        const candidateId = `target:jet-stream-target-cat:push-zone:${ARENA_ZONE_IDS.A3}`;
        const playerCandidateId = `target-player:1:push-zone:${ARENA_ZONE_IDS.A3}`;

        expect(request.kind).toBe('choose-option');
        expect(request.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: candidateId, commands: [expectedCommand] }),
            expect.objectContaining({ id: playerCandidateId, commands: [expectedPlayerCommand] }),
        ]));

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === candidateId)
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'jet-stream-target-cat',
            commandPreview: [expectedCommand],
        }]);
        expect(directSurface.targets
            .filter((target) => target.id === playerCandidateId)
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: '1',
            commandPreview: [expectedPlayerCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
            expectedPlayerCommand,
        ]));
    });

    test('projects hidden response enchantment object and mage targets through ChoiceRequest', () => {
        const spellCardId = 1825;
        let state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WIZARD_APPRENTICE,
            mana: 20,
            phase: 'initiativeQuickcast',
            object: {
                id: 'doom-target-cat',
                ownerId: '1',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Doom Target Cat',
                zoneId: ARENA_ZONE_IDS.A2,
            },
        }), '0', spellCardId);
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': { ...state.core.players['0'], mageZoneId: ARENA_ZONE_IDS.A2 },
                    '1': { ...state.core.players['1'], mageZoneId: ARENA_ZONE_IDS.A2 },
                },
            },
        };

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 98,
        });

        expect(opportunity).toMatchObject({
            condition: { satisfied: true },
            targetRequest: {
                kind: 'choose-option',
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const objectCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 3,
                targetObjectId: 'doom-target-cat',
            },
        };
        const playerCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 3,
                targetPlayerId: '1',
            },
        };

        expect(request.kind).toBe('choose-option');
        expect(request.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'target:doom-target-cat', commands: [objectCommand] }),
            expect.objectContaining({ id: 'target-player:1', commands: [playerCommand] }),
        ]));

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets.map((target) => ({
            targetRef: target.targetRef,
            commandPreview: target.commandPreview,
        }))).toEqual(expect.arrayContaining([
            { targetRef: 'doom-target-cat', commandPreview: [objectCommand] },
            { targetRef: '1', commandPreview: [playerCommand] },
        ]));

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            objectCommand,
            playerCommand,
        ]));
    });

    test('projects Dissolve spell casting through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 3605;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WIZARD_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'contract-equipment-3703',
                kind: 'equipment',
                ownerId: '0',
                sourceSpellCardId: 3703,
                sourceObjectId: 'spell-card-3703',
                name: 'Contract Dragonscale Hauberk',
                zoneId: ARENA_ZONE_IDS.A2,
                typeLine: '装备 / 胸甲',
                anchoredToPlayerId: '0',
            },
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 96,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                phase: 'initiativeQuickcast',
                spellCardId,
                targetMode: 'direct-object',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 6,
                targetObjectId: 'contract-equipment-3703',
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:contract-equipment-3703')).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 6,
                targetObjectId: 'contract-equipment-3703',
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'contract-equipment-3703',
                spellCardId,
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:contract-equipment-3703')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'contract-equipment-3703',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects Dispel spell casting through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 3606;
        let state = makeMageWarsAbilityState({
            mageId: MAGE_IDS.WIZARD_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'contract-enchanted-cat',
                ownerId: '0',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Contract Enchanted Cat',
                zoneId: ARENA_ZONE_IDS.A2,
            },
        });
        state = withMageWarsAbilityObject(state, makeMageWarsAbilityObject('contract-visible-enchantment-1800', '0', ARENA_ZONE_IDS.A2, {
            kind: 'enchantment',
            sourceSpellCardId: 1800,
            sourceObjectId: 'spell-card-1800',
            name: 'Contract Visible Enchantment',
            revealed: true,
            anchoredToObjectId: 'contract-enchanted-cat',
        }));
        state = withPreparedMageWarsSpell(state, '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 97,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                phase: 'initiativeQuickcast',
                spellCardId,
                targetMode: 'direct-object',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 5,
                targetObjectId: 'contract-visible-enchantment-1800',
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:contract-visible-enchantment-1800')).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 5,
                targetObjectId: 'contract-visible-enchantment-1800',
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'contract-visible-enchantment-1800',
                spellCardId,
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:contract-visible-enchantment-1800')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'contract-visible-enchantment-1800',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects Explode spell casting through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 3401;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WARLOCK_APPRENTICE,
            mana: 20,
            phase: 'initiativeQuickcast',
            object: {
                id: 'contract-explode-equipment-3703',
                kind: 'equipment',
                ownerId: '0',
                sourceSpellCardId: 3703,
                sourceObjectId: 'spell-card-3703',
                name: 'Contract Explode Hauberk',
                zoneId: ARENA_ZONE_IDS.A2,
                typeLine: '装备 / 胸甲',
                anchoredToPlayerId: '0',
            },
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 98,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                phase: 'initiativeQuickcast',
                spellCardId,
                targetMode: 'direct-object',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 12,
                targetObjectId: 'contract-explode-equipment-3703',
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:contract-explode-equipment-3703')).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 12,
                targetObjectId: 'contract-explode-equipment-3703',
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'contract-explode-equipment-3703',
                spellCardId,
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:contract-explode-equipment-3703')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'contract-explode-equipment-3703',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects Tanglevine spell casting through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 2224;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'contract-tanglevine-target',
                ownerId: '1',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Contract Tanglevine Target',
                zoneId: ARENA_ZONE_IDS.A2,
                attackOrTraitLine: '利爪：快速近战 2 骰',
            },
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 99,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                phase: 'initiativeQuickcast',
                spellCardId,
                targetMode: 'direct-object',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 5,
                targetObjectId: 'contract-tanglevine-target',
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:contract-tanglevine-target')).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 5,
                targetObjectId: 'contract-tanglevine-target',
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'contract-tanglevine-target',
                spellCardId,
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:contract-tanglevine-target')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'contract-tanglevine-target',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects visible object enchantment spell casting through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 1908;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WIZARD_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'contract-force-grip-target',
                ownerId: '1',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Contract Force Grip Target',
                zoneId: ARENA_ZONE_IDS.A2,
                attackOrTraitLine: '利爪：快速近战 2 骰',
            },
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 100,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                phase: 'initiativeQuickcast',
                spellCardId,
                targetMode: 'direct-object',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 4,
                targetObjectId: 'contract-force-grip-target',
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:contract-force-grip-target')).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 4,
                targetObjectId: 'contract-force-grip-target',
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'contract-force-grip-target',
                spellCardId,
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:contract-force-grip-target')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'contract-force-grip-target',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects Agony visible curse spell casting through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 1800;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WARLOCK_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'contract-agony-target',
                ownerId: '1',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Contract Agony Target',
                zoneId: ARENA_ZONE_IDS.A2,
                attackOrTraitLine: '利爪：快速近战 4 骰',
            },
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 100,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 5,
                targetObjectId: 'contract-agony-target',
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:contract-agony-target')).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 5,
                targetObjectId: 'contract-agony-target',
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'contract-agony-target',
                spellCardId,
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:contract-agony-target')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'contract-agony-target',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects Death Link visible curse spell casting through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 1801;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WARLOCK_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'contract-death-link-target',
                ownerId: '1',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Contract Death Link Target',
                zoneId: ARENA_ZONE_IDS.A2,
                attackOrTraitLine: '利爪：快速近战 4 骰',
            },
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 100,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 8,
                targetObjectId: 'contract-death-link-target',
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:contract-death-link-target')).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 8,
                targetObjectId: 'contract-death-link-target',
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'contract-death-link-target',
                spellCardId,
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:contract-death-link-target')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'contract-death-link-target',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects Force Push object and destination choices through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 3425;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WARLOCK_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'contract-force-push-target',
                ownerId: '1',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Contract Force Push Target',
                zoneId: ARENA_ZONE_IDS.A2,
            },
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 101,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'object-push-zone',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 3,
                targetObjectId: 'contract-force-push-target',
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:contract-force-push-target:push-zone:a3')).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 3,
                targetObjectId: 'contract-force-push-target',
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'contract-force-push-target',
                pushToZoneId: ARENA_ZONE_IDS.A3,
                spellCardId,
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:contract-force-push-target:push-zone:a3')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'contract-force-push-target',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects Teleport object and destination choices through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 3410;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WIZARD_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
            object: {
                id: 'contract-teleport-target',
                ownerId: '1',
                sourceSpellCardId: 2906,
                sourceObjectId: 'spell-card-2906',
                name: 'Contract Teleport Target',
                zoneId: ARENA_ZONE_IDS.A2,
            },
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 102,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'direct-object',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 6,
                targetObjectId: 'contract-teleport-target',
                targetZoneId: ARENA_ZONE_IDS.B3,
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:contract-teleport-target:zone:b3')).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 6,
                targetObjectId: 'contract-teleport-target',
                targetZoneId: ARENA_ZONE_IDS.B3,
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: 'contract-teleport-target',
                destinationZoneId: ARENA_ZONE_IDS.B3,
                spellCardId,
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'target:contract-teleport-target:zone:b3')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 'contract-teleport-target',
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects visible area enchantment zone choices through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 1913;
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
            mana: 10,
            phase: 'initiativeQuickcast',
        }), '0', spellCardId);
        const targetZoneId = state.core.players['0'].mageZoneId;

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 103,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-zone',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'zone',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request.kind).toBe('select-zone');
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 6,
                targetZoneId,
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get(`target-zone:${targetZoneId}`)).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 6,
                targetZoneId,
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetZoneId,
                destinationZoneId: targetZoneId,
                spellCardId,
                targetMode: 'zone',
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === `target-zone:${targetZoneId}`)
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: targetZoneId,
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects wall-edge spell choices through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 25700;
        const targetWallEdgeId = getMageWarsWallEdgeId(ARENA_ZONE_IDS.A3, ARENA_ZONE_IDS.B3);
        const state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            mana: 20,
            phase: 'initiativeQuickcast',
        }), '0', spellCardId);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 104,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-position',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'wall-edge',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request.kind).toBe('select-position');
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 5,
                targetWallEdgeId,
            },
        };
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get(`target-wall-edge:${targetWallEdgeId}`)).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 5,
                targetWallEdgeId,
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetWallEdgeId,
                spellCardId,
                targetMode: 'wall-edge',
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === `target-wall-edge:${targetWallEdgeId}`)
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: targetWallEdgeId,
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects Chain Lightning object chains through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 1703;
        const firstTargetId = 'chain-contract-first';
        const secondTarget = makeMageWarsAbilityObject('chain-contract-second', '1', ARENA_ZONE_IDS.B3, {
            name: 'Chain Contract Second',
            life: 30,
        });
        const thirdTarget = makeMageWarsAbilityObject('chain-contract-third', '1', ARENA_ZONE_IDS.B2, {
            name: 'Chain Contract Third',
            life: 30,
        });
        let state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WIZARD_APPRENTICE,
            mana: 20,
            phase: 'creatureAction',
            object: {
                id: firstTargetId,
                ownerId: '1',
                name: 'Chain Contract First',
                zoneId: ARENA_ZONE_IDS.A3,
                life: 30,
            },
        }), '0', spellCardId);
        state = withMageWarsAbilityObject(state, secondTarget);
        state = withMageWarsAbilityObject(state, thirdTarget);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 105,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'object-chain',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request.kind).toBe('select-object');
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 12,
                targetObjectId: firstTargetId,
                chainLightningTargets: [
                    { targetObjectId: secondTarget.id },
                    { targetObjectId: thirdTarget.id },
                ],
            },
        };
        const candidateId = `target:${firstTargetId}:chain:${secondTarget.id}:${thirdTarget.id}`;
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get(candidateId)).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 12,
                targetObjectId: firstTargetId,
                chainLightningTargets: [
                    { targetObjectId: secondTarget.id },
                    { targetObjectId: thirdTarget.id },
                ],
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: firstTargetId,
                chainTargetObjectIds: [firstTargetId, secondTarget.id, thirdTarget.id],
                spellCardId,
                targetMode: 'object-chain',
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === candidateId)
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: firstTargetId,
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects Steal Enchantment as first target plus new anchor through Ability -> Opportunity -> ChoiceRequest', () => {
        const spellCardId = 3409;
        let state = withPreparedMageWarsSpell(makeMageWarsAbilityState({
            mageId: MAGE_IDS.WIZARD_APPRENTICE,
            mana: 20,
            phase: 'creatureAction',
        }), '0', spellCardId);
        const friendlyCreature = state.core.objects['blue-gremlin-1'];
        const enchantedCreature = makeMageWarsAbilityObject('steal-enchanted-creature-1', '1', ARENA_ZONE_IDS.A2);
        const visibleEnchantment = makeMageWarsAbilityObject('steal-visible-enchantment-1800', '1', ARENA_ZONE_IDS.A2, {
            kind: 'enchantment',
            sourceSpellCardId: 1800,
            sourceObjectId: 'spell-card-1800',
            name: '剧痛难当',
            life: 1,
            actionReady: false,
            typeLine: '结界 / 诅咒',
            attackOrTraitLine: undefined,
            rulesText: '每当本生物进行非法术远程或近战攻击时，少投掷2颗攻击骰子。',
            revealed: true,
            anchoredToObjectId: enchantedCreature.id,
        });
        state = withMageWarsAbilityObject(state, enchantedCreature);
        state = withMageWarsAbilityObject(state, visibleEnchantment);

        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId: '0',
            spellCardId,
            timestamp: 105,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: {
                    targetMode: 'object-new-anchor',
                    spellCardId,
                },
            },
            resolution: { type: 'choice-request' },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request.kind).toBe('select-object');
        const expectedCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload: {
                spellCardId,
                manaCost: 10,
                targetObjectId: visibleEnchantment.id,
                newTargetObjectId: friendlyCreature.id,
            },
        };
        const candidateId = `target:${visibleEnchantment.id}:new-object:${friendlyCreature.id}`;
        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get(candidateId)).toMatchObject({
            value: {
                action: 'cast-spell',
                playerId: '0',
                spellCardId,
                manaCost: 10,
                targetObjectId: visibleEnchantment.id,
                newTargetObjectId: friendlyCreature.id,
            },
            commands: [expectedCommand],
            metadata: {
                abilityId: `mw.spell.cast.${spellCardId}`,
                abilitySourceId: `spell:${spellCardId}`,
                abilityControllerId: '0',
                targetObjectId: visibleEnchantment.id,
                newTargetObjectId: friendlyCreature.id,
                newTargetResolvedZoneId: friendlyCreature.zoneId,
                spellCardId,
                targetMode: 'object-new-anchor',
            },
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === candidateId)
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: visibleEnchantment.id,
            commandPreview: [expectedCommand],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual(expect.arrayContaining([
            expectedCommand,
        ]));
    });

    test('projects Beast Staff source-trait cost and target modes through Ability -> Opportunity -> ChoiceRequest', () => {
        let state = makeMageWarsAbilityState({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            mana: 10,
            object: {
                id: 'beast-staff-0',
                kind: 'equipment',
                sourceSpellCardId: 3710,
                sourceObjectId: 'spell-card-3710',
                name: '群兽法杖',
                typeLine: '装备 / 武器',
                attackOrTraitLine: '蛮力一击：快速近战 4 骰',
                combatProfilesSource: 'config',
                combatTraitsSource: 'config',
                anchoredToPlayerId: '0',
                actionReady: false,
            },
        });
        const nearZoneId = state.core.players['0'].mageZoneId;
        state = withMageWarsAbilityObject(state, makeMageWarsAbilityObject('friendly-wolf-0', '0', nearZoneId, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: 'Friendly Wolf',
            typeLine: '生物 / 动物',
            damage: 3,
        }));
        state = withMageWarsAbilityObject(state, makeMageWarsAbilityObject('enemy-wolf-1', '1', nearZoneId, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: 'Enemy Wolf',
            typeLine: '生物 / 动物',
        }));
        state = withMageWarsAbilityObject(state, makeMageWarsAbilityObject('friendly-knight-0', '0', nearZoneId, {
            name: 'Friendly Knight',
            typeLine: '生物 / 士兵',
        }));
        state = withMageWarsAbilityObject(state, makeMageWarsAbilityObject('far-wolf-0', '0', ARENA_ZONE_IDS.D3, {
            sourceSpellCardId: 2819,
            sourceObjectId: 'spell-card-2819',
            name: 'Far Wolf',
            typeLine: '生物 / 动物',
        }));

        const opportunity = buildMageWarsObjectAbilityActivationOpportunity({
            state,
            playerId: '0',
            objectId: 'beast-staff-0',
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
            timestamp: 88,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-object',
                min: 1,
                max: 1,
                metadata: { targetMode: 'friendly-living-animal' },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                objectId: 'beast-staff-0',
                targetMode: 'friendly-living-animal',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request).toMatchObject({
            playerId: '0',
            kind: 'select-object',
            sourceId: 'beast-staff-0',
            selection: { min: 1, max: 1 },
            ai: { status: 'shared-policy', policyId: 'choice-request:simple-target' },
            metadata: {
                opportunityId: opportunity!.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                abilitySourceId: 'beast-staff-0',
                targetMode: 'friendly-living-animal',
            },
        });

        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('target:friendly-wolf-0:mode:melee-bonus')).toMatchObject({
            value: {
                action: 'activate-object-ability',
                objectId: 'beast-staff-0',
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                manaCost: 2,
                targetObjectId: 'friendly-wolf-0',
                mode: 'melee-bonus',
            },
            commands: [{
                type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                payload: {
                    objectId: 'beast-staff-0',
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                    manaCost: 2,
                    targetObjectId: 'friendly-wolf-0',
                    mode: 'melee-bonus',
                },
            }],
            metadata: {
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                abilitySourceId: 'beast-staff-0',
                abilityControllerId: '0',
                targetObjectId: 'friendly-wolf-0',
                mode: 'melee-bonus',
            },
            actionKind: 'mage-wars-object-ability-target-mode',
            actionKeyParts: [
                'ability',
                'activation',
                'beast-staff-0',
                MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                'target',
                'friendly-wolf-0',
                'mode',
                'melee-bonus',
            ],
        });
        expect(candidateById.get('target:friendly-wolf-0:mode:heal')).toMatchObject({
            value: {
                manaCost: 2,
                targetObjectId: 'friendly-wolf-0',
                mode: 'heal',
            },
            commands: [{
                type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                payload: {
                    objectId: 'beast-staff-0',
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                    manaCost: 2,
                    targetObjectId: 'friendly-wolf-0',
                    mode: 'heal',
                },
            }],
        });
        expect(candidateById.get('target:enemy-wolf-1:mode:heal')).toMatchObject({
            disabled: true,
            disabledReason: 'invalidTargetObject',
        });
        expect(candidateById.get('target:friendly-knight-0:mode:melee-bonus')).toMatchObject({
            disabled: true,
            disabledReason: 'invalidTargetObject',
        });
        expect(candidateById.get('target:far-wolf-0:mode:heal')).toMatchObject({
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
            }))).toEqual(expect.arrayContaining([
            {
                id: 'target:friendly-wolf-0:mode:melee-bonus',
                targetRef: 'friendly-wolf-0',
                commandPreview: [{
                    type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                    payload: {
                        objectId: 'beast-staff-0',
                        abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                        manaCost: 2,
                        targetObjectId: 'friendly-wolf-0',
                        mode: 'melee-bonus',
                    },
                }],
            },
            {
                id: 'target:friendly-wolf-0:mode:heal',
                targetRef: 'friendly-wolf-0',
                commandPreview: [{
                    type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                    payload: {
                        objectId: 'beast-staff-0',
                        abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                        manaCost: 2,
                        targetObjectId: 'friendly-wolf-0',
                        mode: 'heal',
                    },
                }],
            },
        ]));

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions.map((action) => action.commands[0])).toEqual([
            {
                type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                payload: {
                    objectId: 'beast-staff-0',
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                    manaCost: 2,
                    targetObjectId: 'friendly-wolf-0',
                    mode: 'melee-bonus',
                },
            },
            {
                type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                payload: {
                    objectId: 'beast-staff-0',
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                    manaCost: 2,
                    targetObjectId: 'friendly-wolf-0',
                    mode: 'heal',
                },
            },
        ]);
    });

    test('projects Elemental Staff binding choices through Ability -> Opportunity -> ChoiceRequest', () => {
        const state = makeMageWarsAbilityState({
            mageId: MAGE_IDS.WIZARD_APPRENTICE,
            mana: 10,
            phase: 'finalQuickcast',
            object: {
                id: 'elemental-staff-0',
                kind: 'equipment',
                sourceSpellCardId: 3716,
                sourceObjectId: 'spell-card-3716',
                name: '元素魔杖',
                typeLine: '装备 / 法杖',
                attackOrTraitLine: '法术绑定',
                anchoredToPlayerId: '0',
                boundSpellCardId: 1704,
                actionReady: false,
            },
        });

        const opportunity = buildMageWarsObjectAbilityActivationOpportunity({
            state,
            playerId: '0',
            objectId: 'elemental-staff-0',
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
            timestamp: 99,
        });

        expect(opportunity).toMatchObject({
            controllerId: '0',
            class: 'optional',
            condition: { satisfied: true },
            targetRequest: {
                kind: 'select-card',
                min: 1,
                max: 1,
                metadata: { targetMode: 'bound-spell' },
            },
            resolution: { type: 'choice-request' },
            metadata: {
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
                objectId: 'elemental-staff-0',
                targetMode: 'bound-spell',
            },
        });

        const request = buildChoiceRequestFromOpportunity(opportunity!);
        expect(request).toMatchObject({
            playerId: '0',
            kind: 'select-card',
            sourceId: 'elemental-staff-0',
            selection: { min: 1, max: 1 },
            ai: { status: 'shared-policy', policyId: 'choice-request:simple-target' },
            metadata: {
                opportunityId: opportunity!.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
                abilitySourceId: 'elemental-staff-0',
                targetMode: 'bound-spell',
            },
        });

        const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate]));
        expect(candidateById.get('bound-spell:1705')).toMatchObject({
            value: {
                action: 'activate-object-ability',
                objectId: 'elemental-staff-0',
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
                manaCost: 3,
                boundSpellCardId: 1705,
            },
            commands: [{
                type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                payload: {
                    objectId: 'elemental-staff-0',
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
                    manaCost: 3,
                    boundSpellCardId: 1705,
                },
            }],
            metadata: {
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
                abilitySourceId: 'elemental-staff-0',
                abilityControllerId: '0',
                cardId: 1705,
                boundSpellCardId: 1705,
            },
            actionKind: 'mage-wars-object-ability-bound-spell',
            actionKeyParts: [
                'ability',
                'activation',
                'elemental-staff-0',
                MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
                'bound-spell',
                1705,
            ],
        });
        expect(candidateById.get('bound-spell:1704')).toMatchObject({
            disabled: true,
            disabledReason: 'sameBoundSpell',
        });
        expect(candidateById.get('bound-spell:1806')).toMatchObject({
            disabled: true,
            disabledReason: 'invalidBoundSpell',
        });

        const directSurface = projectChoiceRequestToDirectSelectionTargets<MageWarsObjectAbilityActivationChoiceValue>(request);
        expect(directSurface.targets
            .filter((target) => target.id === 'bound-spell:1705')
            .map((target) => ({
                targetRef: target.targetRef,
                commandPreview: target.commandPreview,
            }))).toEqual([{
            targetRef: 1705,
            commandPreview: [{
                type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                payload: {
                    objectId: 'elemental-staff-0',
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
                    manaCost: 3,
                    boundSpellCardId: 1705,
                },
            }],
        }]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        const legalBoundSpellIds = legalActions.actions
            .map((action) => action.commands[0].payload)
            .map((payload) => (
                payload && typeof payload === 'object' && 'boundSpellCardId' in payload
                    ? payload.boundSpellCardId
                    : undefined
            ));
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalBoundSpellIds).toContain(1705);
        expect(legalBoundSpellIds).not.toContain(1704);
    });
});
