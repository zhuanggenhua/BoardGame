import { describe, expect, it } from 'vitest';
import {
    buildAiLegalActionsFromInteractionDecision,
    type AiDecisionDescriptor,
} from '../../../engine/ai/decisionSemantics';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { RESPONSE_WINDOW_COMMANDS } from '../../../engine/systems/ResponseWindowSystem';
import { completeResolutionFrame, updateResolutionFrame } from '../../../engine/systems/resolutionStack';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
import { getPresetSpellbookEntriesFromConfig } from '../data/configPackage';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { MAGE_WARS_COMMANDS } from '../domain/commands';
import { MageWarsDomain } from '../domain';
import { ARENA_ZONE_IDS, MAGE_IDS } from '../domain/ids';
import type { MageWarsArenaObjectState, MageWarsCommand, MageWarsCore } from '../domain/types';
import { engineConfig } from '../game';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 3,
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

function createWarlockSpellbookEntriesWith(spellCardId: number): Array<{ spellCardId: number; count: number }> {
    const entries = [...getPresetSpellbookEntriesFromConfig(MAGE_IDS.WARLOCK_APPRENTICE)];
    if (!entries.some((entry) => entry.spellCardId === spellCardId)) {
        entries.push({ spellCardId, count: 1 });
    }
    return entries;
}

function countSpellbookEntries(entries: readonly { count: number }[]): number {
    return entries.reduce((total, entry) => total + entry.count, 0);
}

function setupState(phase: 'initiativeQuickcast' | 'creatureAction'): MatchState<MageWarsCore> {
    const playerIds = ['0', '1'];
    return {
        core: MageWarsDomain.setup(playerIds, fixedRandom),
        sys: {
            ...createInitialSystemState(playerIds, engineConfig.systems, 'local:mage-wars-enchantment-response'),
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
            : {
                ...zone,
                objectIds: zone.objectIds.includes(object.id)
                    ? zone.objectIds
                    : [...zone.objectIds, object.id],
            }),
    };
}

function makeCreature(
    id: string,
    ownerId: string,
    zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS],
    attackOrTraitLine = '利爪：快速近战 2 骰',
): MageWarsArenaObjectState {
    return {
        id,
        kind: 'creature',
        ownerId,
        sourceSpellCardId: 2906,
        sourceObjectId: `spell-card-2906-${id}`,
        name: id,
        zoneId,
        life: 20,
        damage: 0,
        armor: 0,
        actionReady: true,
        guarding: false,
        statusTokens: {},
        attackOrTraitLine,
    };
}

function makeHiddenResponse(
    id: string,
    ownerId: string,
    zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS],
    targetObjectId: string | undefined,
    spellCardId: 1825 | 1901 | 1904,
    targetPlayerId?: string,
): MageWarsArenaObjectState {
    return {
        id,
        kind: 'enchantment',
        ownerId,
        sourceSpellCardId: spellCardId,
        sourceObjectId: `spell-card-${spellCardId}`,
        name: `response-${spellCardId}`,
        zoneId,
        life: 1,
        damage: 0,
        armor: 0,
        actionReady: false,
        guarding: false,
        statusTokens: {},
        revealed: false,
        ...(targetObjectId ? { anchoredToObjectId: targetObjectId } : { anchoredToPlayerId: targetPlayerId }),
    };
}

function runCommand(
    state: MatchState<MageWarsCore>,
    command: MageWarsCommand | Command<string, unknown>,
) {
    return executePipeline(
        {
            domain: engineConfig.domain,
            systems: engineConfig.systems,
            systemsConfig: engineConfig.systemsConfig,
        },
        state,
        command as MageWarsCommand,
        fixedRandom,
        ['0', '1'],
    );
}

function withPreparedSpell(
    state: MatchState<MageWarsCore>,
    spellCardId: number,
): MatchState<MageWarsCore> {
    const spellbookEntries = createWarlockSpellbookEntriesWith(spellCardId);
    return {
        ...state,
        core: {
            ...state.core,
            players: {
                ...state.core.players,
                '0': {
                    ...state.core.players['0'],
                    mageId: MAGE_IDS.WARLOCK_APPRENTICE,
                    spellbookCount: countSpellbookEntries(spellbookEntries),
                    spellbookEntries,
                    mana: 20,
                    preparedSpellCardIds: [spellCardId],
                    preparedSpellSlots: 1,
                },
            },
        },
    };
}

function responseCommand(
    state: MatchState<MageWarsCore>,
    overrides: { interactionId?: string; playerId?: string } = {},
): Command<string, unknown> {
    return {
        type: INTERACTION_COMMANDS.RESPOND,
        playerId: overrides.playerId ?? '1',
        payload: {
            interactionId: overrides.interactionId ?? state.sys.interaction.current?.id,
            optionId: 'reveal',
        },
    };
}

describe('mage-wars enchantment response windows', () => {
    it('1901 counters an opponent enchantment target and cannot be passed', () => {
        let state = setupState('initiativeQuickcast');
        const target = makeCreature('target-creature', '1', ARENA_ZONE_IDS.A2);
        const response = makeHiddenResponse(
            'hidden-mana-failure',
            '1',
            target.zoneId,
            target.id,
            1901,
        );
        state = withPreparedSpell({
            ...state,
            core: addObject(addObject(state.core, target), response),
        }, 1800);
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '1': { ...state.core.players['1'], discardSpellCardIds: [1901] },
                },
            },
        };

        const blockedCast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 1800, manaCost: 5, targetObjectId: target.id },
        });

        expect(blockedCast.success).toBe(true);
        expect(blockedCast.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ENCHANTMENT_RESPONSE_REQUIRED);
        expect(blockedCast.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED);
        expect(blockedCast.state.core.players['0']).toMatchObject({
            mana: 15,
            preparedSpellCardIds: [],
            discardSpellCardIds: [],
        });
        const responseWindow = blockedCast.state.sys.responseWindow.current;
        expect(responseWindow?.requiredInteractionId).toBeDefined();
        const interaction = blockedCast.state.sys.interaction.current;
        expect(interaction).toMatchObject({
            id: responseWindow?.requiredInteractionId,
            kind: 'simple-choice',
            playerId: '1',
            data: {
                sourceId: 'mw.enchantment-response.reveal',
                targetType: 'button',
                choiceRequest: {
                    sourceId: 'mw.enchantment-response.reveal',
                    metadata: expect.objectContaining({
                        opportunityId: responseWindow?.requiredInteractionId,
                        mageWarsTimingOpportunity: 'mage-wars.enchantment-response',
                        responseId: responseWindow?.id,
                        responseObjectId: response.id,
                        responseCardId: 1901,
                    }),
                },
            },
        });
        expect(interaction?.data.ai).toMatchObject({ status: 'semantic' });
        expect((interaction?.data.ai?.decisions?.[0] as AiDecisionDescriptor | undefined)?.metadata)
            .toMatchObject({
                opportunityId: responseWindow?.requiredInteractionId,
                mageWarsTimingOpportunity: 'mage-wars.enchantment-response',
            });
        const aiActions = buildAiLegalActionsFromInteractionDecision(
            interaction!.data.ai!.decisions![0] as AiDecisionDescriptor,
        );
        expect(aiActions.map((action) => (action.commands[0]?.payload as { optionId?: string }).optionId))
            .toEqual(['reveal']);

        const passed = runCommand(blockedCast.state, {
            type: RESPONSE_WINDOW_COMMANDS.PASS,
            playerId: '1',
            payload: {},
        });
        expect(passed.success).toBe(false);
        expect(passed.error).toContain('无法跳过');

        const resolved = runCommand(blockedCast.state, responseCommand(blockedCast.state));
        expect(resolved.success).toBe(true);
        expect(resolved.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.ENCHANTMENT_REVEALED,
            MAGE_WARS_EVENTS.SPELL_COUNTERED,
            MAGE_WARS_EVENTS.ARENA_OBJECT_SOURCE_CONSUME_AVAILABLE,
            MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
        ]));
        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_SOURCE_CONSUME_AVAILABLE,
                payload: expect.objectContaining({
                    sourceObjectId: response.id,
                    sourceAbilityId: 'mw.spell.1901.response',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: response.id,
                    sourceAbilityId: 'mw.spell.1901.response',
                }),
            }),
        ]));
        const consumeAvailableIndex = resolved.events.findIndex((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_SOURCE_CONSUME_AVAILABLE
            && event.payload.sourceObjectId === response.id
        ));
        const sourceDefeatedIndex = resolved.events.findIndex((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED
            && event.payload.objectId === response.id
        ));
        expect(consumeAvailableIndex).toBeGreaterThanOrEqual(0);
        expect(sourceDefeatedIndex).toBeGreaterThanOrEqual(0);
        expect(consumeAvailableIndex).toBeLessThan(sourceDefeatedIndex);
        expect(resolved.state.core.objects[response.id]).toBeUndefined();
        expect(resolved.state.core.players['0']).toMatchObject({
            mana: 15,
            preparedSpellCardIds: [],
            discardSpellCardIds: [1800],
        });
        expect(resolved.state.core.players['1'].discardSpellCardIds).toEqual([1901]);
        expect(resolved.state.sys.responseWindow.current).toBeUndefined();
        expect(resolved.state.sys.resolution).toBeUndefined();
    });

    it('rejects stale, wrong-responder, and duplicate reveal commands', () => {
        let state = setupState('initiativeQuickcast');
        const target = makeCreature('stale-response-target', '1', ARENA_ZONE_IDS.A2);
        const response = makeHiddenResponse(
            'stale-response-enchantment',
            '1',
            target.zoneId,
            target.id,
            1901,
        );
        state = withPreparedSpell({
            ...state,
            core: addObject(addObject(state.core, target), response),
        }, 1800);

        const blockedCast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 1800, manaCost: 5, targetObjectId: target.id },
        });
        expect(blockedCast.success).toBe(true);

        const staleInteraction = runCommand(
            blockedCast.state,
            responseCommand(blockedCast.state, { interactionId: 'old-interaction' }),
        );
        expect(staleInteraction.success).toBe(false);

        const wrongResponder = runCommand(
            blockedCast.state,
            responseCommand(blockedCast.state, { playerId: '0' }),
        );
        expect(wrongResponder.success).toBe(false);

        const resolved = runCommand(blockedCast.state, responseCommand(blockedCast.state));
        expect(resolved.success).toBe(true);
        const duplicate = runCommand(resolved.state, responseCommand(resolved.state));
        expect(duplicate.success).toBe(false);
        expect(resolved.state.core.objects[response.id]).toBeUndefined();
    });

    it('rejects reveal when the active response frame points to another source', () => {
        let state = setupState('initiativeQuickcast');
        const target = makeCreature('wrong-frame-source-target', '1', ARENA_ZONE_IDS.A2);
        const response = makeHiddenResponse(
            'wrong-frame-source-enchantment',
            '1',
            target.zoneId,
            target.id,
            1901,
        );
        state = withPreparedSpell({
            ...state,
            core: addObject(addObject(state.core, target), response),
        }, 1800);

        const blockedCast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 1800, manaCost: 5, targetObjectId: target.id },
        });
        expect(blockedCast.success).toBe(true);

        const responseFrameId = blockedCast.state.sys.resolution?.activeFrameId;
        expect(responseFrameId).toBe(blockedCast.state.sys.responseWindow.current?.resolutionFrameId);
        const mismatchedFrameState = updateResolutionFrame(
            blockedCast.state,
            responseFrameId!,
            (frame) => ({
                ...frame,
                metadata: {
                    ...frame.metadata,
                    mageWarsResponse: {
                        ...(frame.metadata?.mageWarsResponse as Record<string, unknown>),
                        responseObjectId: 'another-response-source',
                    },
                },
            }),
        );

        const rejected = runCommand(mismatchedFrameState, responseCommand(mismatchedFrameState));
        expect(rejected.success).toBe(false);
        expect(rejected.error).toBe('该选项不可用');
        expect(rejected.state.sys.interaction.current?.id)
            .toBe(blockedCast.state.sys.interaction.current?.id);
        expect(rejected.state.core.objects[response.id]).toMatchObject({ revealed: false });
    });

    it('rejects reveal when the response frame has already been removed', () => {
        let state = setupState('initiativeQuickcast');
        const target = makeCreature('deleted-frame-target', '1', ARENA_ZONE_IDS.A2);
        const response = makeHiddenResponse(
            'deleted-frame-enchantment',
            '1',
            target.zoneId,
            target.id,
            1901,
        );
        state = withPreparedSpell({
            ...state,
            core: addObject(addObject(state.core, target), response),
        }, 1800);

        const blockedCast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 1800, manaCost: 5, targetObjectId: target.id },
        });
        expect(blockedCast.success).toBe(true);

        const responseFrameId = blockedCast.state.sys.resolution?.activeFrameId;
        expect(responseFrameId).toBeDefined();
        const deletedFrameState = completeResolutionFrame(blockedCast.state, responseFrameId);
        expect(deletedFrameState.sys.resolution).toBeUndefined();
        expect(deletedFrameState.sys.interaction.current?.id)
            .toBe(blockedCast.state.sys.interaction.current?.id);

        const rejected = runCommand(deletedFrameState, responseCommand(deletedFrameState));
        expect(rejected.success).toBe(false);
        expect(rejected.error).toBe('该选项不可用');
        expect(rejected.state.sys.interaction.current?.id)
            .toBe(blockedCast.state.sys.interaction.current?.id);
        expect(rejected.state.core.objects[response.id]).toMatchObject({ revealed: false });
    });

    it('does not let 1825 trigger merely because the attached creature is targeted', () => {
        let state = setupState('initiativeQuickcast');
        const target = makeCreature('target-with-doom', '1', ARENA_ZONE_IDS.A2);
        const response = makeHiddenResponse(
            'hidden-doom',
            '1',
            target.zoneId,
            target.id,
            1825,
        );
        state = withPreparedSpell({
            ...state,
            core: addObject(addObject(state.core, target), response),
        }, 1800);

        const cast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 1800, manaCost: 5, targetObjectId: target.id },
        });

        expect(cast.success).toBe(true);
        expect(cast.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED);
        expect(cast.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ENCHANTMENT_RESPONSE_REQUIRED);
        expect(cast.state.core.objects[response.id]).toMatchObject({ revealed: false });
    });

    it('1825 attached to a mage counters a quick spell and returns its mana and prepared card', () => {
        let state = setupState('initiativeQuickcast');
        const target = makeCreature('target-for-mage-doom', '1', ARENA_ZONE_IDS.A2);
        const response = makeHiddenResponse(
            'hidden-doom-on-mage',
            '1',
            state.core.players['0'].mageZoneId,
            undefined,
            1825,
            '0',
        );
        state = withPreparedSpell({
            ...state,
            core: addObject(addObject(state.core, target), response),
        }, 1800);

        const blockedCast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 1800, manaCost: 5, targetObjectId: target.id },
        });

        expect(blockedCast.success).toBe(true);
        expect(blockedCast.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.SPELL_CAST_STARTED,
            MAGE_WARS_EVENTS.ENCHANTMENT_RESPONSE_REQUIRED,
        ]));
        expect(blockedCast.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED);
        expect(blockedCast.state.core.players['0']).toMatchObject({
            mana: 15,
            preparedSpellCardIds: [],
            discardSpellCardIds: [],
        });

        const resolved = runCommand(blockedCast.state, responseCommand(blockedCast.state));
        expect(resolved.success).toBe(true);
        expect(resolved.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.SPELL_COUNTERED,
            MAGE_WARS_EVENTS.SPELL_DISCARDED,
            MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
        ]));
        expect(resolved.state.core.players['0']).toMatchObject({
            mana: 20,
            preparedSpellCardIds: [1800],
            discardSpellCardIds: [],
        });
        expect(resolved.state.core.players['1'].discardSpellCardIds).toEqual([1825]);
        expect(resolved.state.core.objects[response.id]).toBeUndefined();
    });

    it('1825 attached to a mage does not trigger for a standard spell', () => {
        let state = setupState('creatureAction');
        const response = makeHiddenResponse(
            'hidden-doom-standard-spell',
            '1',
            state.core.players['0'].mageZoneId,
            undefined,
            1825,
            '0',
        );
        state = withPreparedSpell({
            ...state,
            core: addObject(state.core, response),
        }, 3405);
        const beastmasterSpellbookEntries = [...getPresetSpellbookEntriesFromConfig(MAGE_IDS.BEASTMASTER_APPRENTICE)];
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': {
                        ...state.core.players['0'],
                        mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                        spellbookCount: countSpellbookEntries(beastmasterSpellbookEntries),
                        spellbookEntries: beastmasterSpellbookEntries,
                    },
                },
            },
        };

        const cast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 3405, manaCost: 9, targetZoneId: state.core.players['0'].mageZoneId },
        });

        expect(cast.success).toBe(true);
        expect(cast.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED);
        expect(cast.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ENCHANTMENT_RESPONSE_REQUIRED);
        expect(cast.state.core.objects[response.id]).toMatchObject({ revealed: false });
        expect(cast.state.core.players['0'].discardSpellCardIds).toEqual([3405]);
    });

    it('1904 reverses an avoidable object attack and keeps the original action cost', () => {
        let state = setupState('creatureAction');
        const attacker = makeCreature('original-attacker', '0', ARENA_ZONE_IDS.A2);
        const defender = makeCreature('original-defender', '1', ARENA_ZONE_IDS.A2);
        const response = makeHiddenResponse(
            'hidden-reversal',
            '1',
            defender.zoneId,
            defender.id,
            1904,
        );
        state = {
            ...state,
            core: addObject(addObject(addObject(state.core, attacker), defender), response),
        };

        const blockedAttack = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: defender.id,
            },
        });
        expect(blockedAttack.success).toBe(true);
        expect(blockedAttack.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ENCHANTMENT_RESPONSE_REQUIRED);
        expect(blockedAttack.state.core.players['0'].actionReady).toBe(true);
        expect(blockedAttack.state.core.objects[attacker.id]?.actionReady).toBe(false);

        const resolved = runCommand(blockedAttack.state, responseCommand(blockedAttack.state));
        expect(resolved.success).toBe(true);
        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_REVERSED,
                payload: expect.objectContaining({ reversed: true }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_SOURCE_CONSUME_AVAILABLE,
                payload: expect.objectContaining({
                    sourceObjectId: response.id,
                    sourceAbilityId: 'mw.spell.1904.response',
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: response.id,
                    sourceAbilityId: 'mw.spell.1904.response',
                }),
            }),
        ]));
        const consumeAvailableIndex = resolved.events.findIndex((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_SOURCE_CONSUME_AVAILABLE
            && event.payload.sourceObjectId === response.id
        ));
        const sourceDefeatedIndex = resolved.events.findIndex((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED
            && event.payload.objectId === response.id
        ));
        expect(consumeAvailableIndex).toBeGreaterThanOrEqual(0);
        expect(sourceDefeatedIndex).toBeGreaterThanOrEqual(0);
        expect(consumeAvailableIndex).toBeLessThan(sourceDefeatedIndex);
        expect(resolved.state.core.objects[response.id]).toBeUndefined();
        expect(resolved.state.core.objects[attacker.id]?.damage).toBe(6);
        expect(resolved.state.core.objects[defender.id]?.damage).toBe(0);
    });

    it('1904 on an unavoidable attack is destroyed without exchanging source and target', () => {
        let state = setupState('creatureAction');
        const attacker = makeCreature('unavoidable-attacker', '0', ARENA_ZONE_IDS.A2, '利爪：快速近战 2 骰（无法回避）');
        const defender = makeCreature('unavoidable-defender', '1', ARENA_ZONE_IDS.A2);
        const response = makeHiddenResponse(
            'hidden-unavoidable-reversal',
            '1',
            defender.zoneId,
            defender.id,
            1904,
        );
        state = {
            ...state,
            core: addObject(addObject(addObject(state.core, attacker), defender), response),
        };

        const blockedAttack = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: defender.id,
            },
        });
        expect(blockedAttack.success).toBe(true);
        const resolved = runCommand(blockedAttack.state, responseCommand(blockedAttack.state));

        expect(resolved.success).toBe(true);
        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_REVERSED,
                payload: expect.objectContaining({ reversed: false, unavoidable: true }),
            }),
        ]));
        expect(resolved.state.core.objects[response.id]).toBeUndefined();
        expect(resolved.state.core.objects[attacker.id]?.damage).toBe(0);
        expect(resolved.state.core.objects[defender.id]?.damage).toBe(6);
    });
});
