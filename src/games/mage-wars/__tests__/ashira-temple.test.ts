import { describe, expect, test } from 'vitest';
import { getMageWarsSpellCardFromConfig } from '../data/configPackage';
import {
    MAGE_WARS_COMMANDS,
    MAGE_WARS_EVENTS,
} from '../domain';
import { MAGE_WARS_OBJECT_ABILITY_IDS, MAGE_IDS, ARENA_ZONE_IDS } from '../domain/ids';
import { resolveMageWarsSpellCastChoiceFamily } from '../domain/spellRules';
import type { MageWarsArenaObjectState, MageWarsCore } from '../domain/types';
import {
    fixedRandom,
    makeArenaObject,
    runCommand,
    setupState,
    validateCommand,
    withArenaObject,
    withPlayerMage,
} from './helpers/domainFlowHarness';

function makeTemple(
    id: string,
    mana: number,
    overrides: Partial<MageWarsArenaObjectState> = {},
): MageWarsArenaObjectState {
    const spell = getMageWarsSpellCardFromConfig(2203);
    return makeArenaObject(id, '0', ARENA_ZONE_IDS.A1, {
        kind: 'conjuration',
        sourceSpellCardId: 2203,
        sourceObjectId: 'spell-card-2203',
        name: '阿希拉神殿',
        life: 9,
        armor: 3,
        actionReady: false,
        typeLine: '魔物 / 神殿、传送门',
        attackOrTraitLine: '再生点·区域独占；史诗·限定神圣法师',
        rulesText: spell?.rulesText,
        spellcastingSource: spell?.spellcastingSource,
        mana,
        anchoredToZoneId: ARENA_ZONE_IDS.A1,
        ...overrides,
    });
}

function makePriest(id: string, overrides: Partial<MageWarsArenaObjectState> = {}): MageWarsArenaObjectState {
    return makeArenaObject(id, '0', ARENA_ZONE_IDS.A1, {
        sourceSpellCardId: 2811,
        sourceObjectId: 'spell-card-2811',
        name: '阿希拉牧师',
        typeLine: '生物 / 牧师',
        schoolLine: '圣光',
        ...overrides,
    });
}

function makePentagram(
    id: string,
    mana: number,
    overrides: Partial<MageWarsArenaObjectState> = {},
): MageWarsArenaObjectState {
    const spell = getMageWarsSpellCardFromConfig(2209);
    return makeArenaObject(id, '0', ARENA_ZONE_IDS.A1, {
        kind: 'conjuration',
        sourceSpellCardId: 2209,
        sourceObjectId: 'spell-card-2209',
        name: '五星魔阵',
        life: 10,
        armor: 1,
        actionReady: false,
        typeLine: '魔物 / 传送门、符文',
        attackOrTraitLine: '再生点·区域独占·虚体；史诗·限定邪术师',
        rulesText: spell?.rulesText,
        spellcastingSource: spell?.spellcastingSource,
        mana,
        anchoredToZoneId: ARENA_ZONE_IDS.A1,
        ...overrides,
    });
}

function withObjects(state: ReturnType<typeof setupState>, objects: MageWarsArenaObjectState[]): ReturnType<typeof setupState> {
    return {
        ...state,
        core: objects.reduce((core, object) => withArenaObject(core, object), state.core),
    };
}

describe('阿希拉神殿', () => {
    test('uses the visible area conjuration family and a deployment holy-creature spawn point', () => {
        const spell = getMageWarsSpellCardFromConfig(2203);
        expect(spell).toMatchObject({
            requiresCodeSupport: false,
            semantics: {
                abilityKind: 'visible-area-conjuration',
                attachment: { kind: 'conjuration', visibility: 'revealed', anchor: 'zone' },
            },
            spellcastingSource: {
                kind: 'spawn-point',
                phase: 'deployment',
                allowedSpellTypes: ['生物'],
                allowedSchoolLineIncludes: ['圣光'],
                minimumMana: 2,
            },
        });
        expect(resolveMageWarsSpellCastChoiceFamily(spell!)).toBe('visible-area-conjuration');
    });

    test('lets two friendly ready priests spend their actions to place mana, then rejects the third use', () => {
        const base = setupState('creatureAction');
        const temple = makeTemple('temple-0', 0);
        const priests = [makePriest('priest-1'), makePriest('priest-2'), makePriest('priest-3')];
        let state = withObjects(base, [temple, ...priests]);

        for (const priest of priests.slice(0, 2)) {
            const result = runCommand(state, {
                type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                playerId: '0',
                payload: {
                    objectId: temple.id,
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_TEMPLE_PLACE_MANA,
                    manaCost: 0,
                    targetObjectId: priest.id,
                },
            });
            expect(result.success).toBe(true);
            expect(result.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
                    payload: expect.objectContaining({
                        manaGain: 1,
                        targetActionCost: 'normal',
                    }),
                }),
            ]));
            state = result.state;
        }

        expect(state.core.objects[temple.id]).toMatchObject({
            mana: 2,
            abilityUseCountsThisRound: {
                [MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_TEMPLE_PLACE_MANA]: 2,
            },
        });
        expect(state.core.objects['priest-1']).toMatchObject({ actionReady: false, guarding: false });
        expect(state.core.objects['priest-2']).toMatchObject({ actionReady: false, guarding: false });
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: temple.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_TEMPLE_PLACE_MANA,
                manaCost: 0,
                targetObjectId: 'priest-3',
            },
        })).toBe('objectAbilityAlreadyUsedThisRound');
    });

    test('rejects non-priests, enemies, spent priests, and stunned priests', () => {
        const base = setupState('creatureAction');
        const temple = makeTemple('temple-0', 0);
        const nonPriest = makePriest('not-priest', { typeLine: '生物 / 动物' });
        const enemy = makePriest('enemy-priest', { ownerId: '1' });
        const spent = makePriest('spent-priest', { actionReady: false });
        const stunned = makePriest('stunned-priest', { statusTokens: { stun: 1 } });
        const state = withObjects(base, [temple, nonPriest, enemy, spent, stunned]);
        const command = (targetObjectId: string) => ({
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: temple.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_TEMPLE_PLACE_MANA,
                manaCost: 0,
                targetObjectId,
            },
        } as const);

        expect(validateCommand(state, command(nonPriest.id))).toBe('invalidTargetObject');
        expect(validateCommand(state, command(enemy.id))).toBe('invalidTargetObject');
        expect(validateCommand(state, command(spent.id))).toBe('objectActionSpent');
        expect(validateCommand(state, command(stunned.id))).toBe('objectStunned');
    });

    test('requires two mana on the temple and only summons holy creatures through the shared cast path', () => {
        const base = setupState('deployment');
        const mageCore = withPlayerMage(base.core, '0', MAGE_IDS.PRIESTESS_APPRENTICE);
        const lowTemple = makeTemple('temple-low', 1, {
            preparedSpellCardId: 2811,
            preparedSpellCount: 1,
        });
        const lowState = {
            ...base,
            core: withArenaObject({
                ...mageCore,
                players: {
                    ...mageCore.players,
                    '0': { ...mageCore.players['0'], mana: 20 },
                },
            }, lowTemple),
        };
        const castPayload = {
            spellCardId: 2811,
            manaCost: 5,
            casterObjectId: lowTemple.id,
            targetZoneId: ARENA_ZONE_IDS.A1,
        } as const;
        expect(validateCommand(lowState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: castPayload,
        })).toBe('insufficientSourceMana');

        const readyTemple = makeTemple('temple-ready', 2, {
            preparedSpellCardId: 2811,
            preparedSpellCount: 1,
        });
        const readyState = {
            ...lowState,
            core: withArenaObject(lowState.core, readyTemple),
        };
        const cast = runCommand(readyState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { ...castPayload, casterObjectId: readyTemple.id },
        }, fixedRandom);

        expect(cast.success).toBe(true);
        expect(cast.state.core.objects[readyTemple.id]).toMatchObject({
            mana: 0,
            preparedSpellCardId: undefined,
        });
        expect(cast.state.core.players['0'].mana).toBe(17);
        const summonedPriest = Object.values(cast.state.core.objects).find((object) => (
            object.sourceSpellCardId === 2811 && object.id !== readyTemple.id
        ));
        expect(summonedPriest).toMatchObject({
            kind: 'creature',
            schoolLine: '圣光',
            typeLine: '生物 / 牧师',
            rulesText: getMageWarsSpellCardFromConfig(2811)?.rulesText,
        });
    });

    test('uses the visible area conjuration family and a deployment dark-creature spawn point', () => {
        const spell = getMageWarsSpellCardFromConfig(2209);
        expect(spell).toMatchObject({
            requiresCodeSupport: false,
            semantics: {
                abilityKind: 'visible-area-conjuration',
                attachment: { kind: 'conjuration', visibility: 'revealed', anchor: 'zone' },
            },
            spellcastingSource: {
                kind: 'spawn-point',
                phase: 'deployment',
                allowedSpellTypes: ['生物'],
                allowedSchoolLineIncludes: ['黑暗'],
                minimumMana: 2,
            },
        });
        expect(resolveMageWarsSpellCastChoiceFamily(spell!)).toBe('visible-area-conjuration');
    });

    test('requires two mana and only summons dark creatures through the shared cast path', () => {
        const base = setupState('deployment');
        const mageCore = withPlayerMage(base.core, '0', MAGE_IDS.WARLOCK_APPRENTICE);
        const lowPentagram = makePentagram('pentagram-low', 1, {
            preparedSpellCardId: 2800,
            preparedSpellCount: 1,
        });
        const lowState = {
            ...base,
            core: withArenaObject({
                ...mageCore,
                players: {
                    ...mageCore.players,
                    '0': { ...mageCore.players['0'], mana: 20 },
                },
            }, lowPentagram),
        };
        const castPayload = {
            spellCardId: 2800,
            manaCost: 13,
            casterObjectId: lowPentagram.id,
            targetZoneId: ARENA_ZONE_IDS.A1,
        } as const;
        expect(validateCommand(lowState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: castPayload,
        })).toBe('insufficientSourceMana');

        const readyPentagram = makePentagram('pentagram-ready', 2, {
            preparedSpellCardId: 2800,
            preparedSpellCount: 1,
        });
        const readyState = {
            ...lowState,
            core: withArenaObject(lowState.core, readyPentagram),
        };
        const cast = runCommand(readyState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { ...castPayload, casterObjectId: readyPentagram.id },
        }, fixedRandom);

        expect(cast.success).toBe(true);
        expect(cast.state.core.objects[readyPentagram.id]).toMatchObject({
            mana: 0,
            preparedSpellCardId: undefined,
        });
        const summonedDarkCreature = Object.values(cast.state.core.objects).find((object) => (
            object.sourceSpellCardId === 2800 && object.id !== readyPentagram.id
        ));
        expect(summonedDarkCreature).toMatchObject({
            kind: 'creature',
            schoolLine: '黑暗',
            rulesText: getMageWarsSpellCardFromConfig(2800)?.rulesText,
        });

        const holySpellPentagram = makePentagram('pentagram-holy', 2, {
            preparedSpellCardId: 2811,
            preparedSpellCount: 1,
        });
        const holyState = {
            ...readyState,
            core: withArenaObject({
                ...readyState.core,
                players: {
                    ...readyState.core.players,
                    '0': {
                        ...readyState.core.players['0'],
                        spellbookEntries: [
                            ...(readyState.core.players['0'].spellbookEntries ?? []),
                            { spellCardId: 2811, count: 1 },
                        ],
                    },
                },
            }, holySpellPentagram),
        };
        expect(validateCommand(holyState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 2811,
                manaCost: 5,
                casterObjectId: holySpellPentagram.id,
                targetZoneId: ARENA_ZONE_IDS.A1,
            },
        })).toBe('spellSchoolLineNotAllowed');
    });
});
