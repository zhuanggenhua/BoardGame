import { describe, expect, it } from 'vitest';
import { buildAiDecisionContext, getGameAiRuntime } from '../../../engine/ai';
import { resolveNextLocalAiAction } from '../../../engine/ai/localRunner';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import { setUndoAiSeatIds } from '../../../engine/systems/UndoSystem';
import type { MatchState, RandomFn } from '../../../engine/types';
import { getMageWarsSpellCardFromConfig } from '../data/configPackage';
import { buildMageWarsAiLegalActions, mageWarsAiRuntime } from '../ai';
import { MageWarsDomain, MAGE_WARS_COMMANDS } from '../domain';
import { MAGE_IDS, ARENA_ZONE_IDS } from '../domain/ids';
import type { MageWarsArenaObjectState, MageWarsCore, MageWarsPhase } from '../domain/types';
import {
    getMageWarsPresetSpellbookEntriesForMage,
    getMageWarsSpellbookCardCount,
} from '../domain/spellbook';
import { engineConfig } from '../game';
import manifest from '../manifest';

const PLAYER_IDS = ['0', '1'];

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 3,
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

function stateFor(core: MageWarsCore, phase: MageWarsPhase): MatchState<MageWarsCore> {
    return {
        core,
        sys: {
            ...createInitialSystemState(PLAYER_IDS, engineConfig.systems, 'local:mage-wars-ai-test'),
            phase,
        },
    };
}

function withMage(core: MageWarsCore, mageId: typeof MAGE_IDS[keyof typeof MAGE_IDS], mana = 10): MageWarsCore {
    const spellbookEntries = getMageWarsPresetSpellbookEntriesForMage(mageId);
    return {
        ...core,
        players: {
            ...core.players,
            '0': {
                ...core.players['0'],
                mageId,
                mana,
                spellbookEntries,
                spellbookCount: getMageWarsSpellbookCardCount(spellbookEntries),
            },
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

describe('mage-wars local AI support', () => {
    it('manifest opens local AI and game registration exposes the runtime', () => {
        expect(manifest.ai).toMatchObject({
            capture: true,
            localAi: true,
            remoteAi: false,
            defaultLocalAiSeats: 'first-opponent',
        });
        expect(getGameAiRuntime('mage-wars')).toBe(mageWarsAiRuntime);
    });

    it('planning phase exposes legal mage and object spell planning actions', () => {
        let core = withMage(MageWarsDomain.setup(PLAYER_IDS, fixedRandom), MAGE_IDS.WIZARD_APPRENTICE);
        core = addObject(core, sourceObject('familiar-ai', 2908, 'creature', ARENA_ZONE_IDS.A2, 3));
        const state = stateFor(core, 'planning');

        const actions = buildMageWarsAiLegalActions({ playerId: '0', state });
        const actionKinds = actions.map((action) => action.kind);
        const objectPlan = actions.find((action) => action.kind === 'plan-object-spell');

        expect(actionKinds).toContain('plan-object-spell');
        expect(actionKinds).toContain('plan-spells');
        expect(objectPlan?.commands[0]).toMatchObject({
            type: MAGE_WARS_COMMANDS.PLAN_OBJECT_SPELL,
            payload: { objectId: 'familiar-ai' },
        });
        expect(MageWarsDomain.validate(state, {
            type: objectPlan!.commands[0]!.type,
            playerId: '0',
            payload: objectPlan!.commands[0]!.payload,
            timestamp: 1,
        } as never).valid).toBe(true);
    });

    it('sequential phases expose a legal phase-advance fallback', () => {
        const state = stateFor(MageWarsDomain.setup(PLAYER_IDS, fixedRandom), 'deployment');

        const actions = buildMageWarsAiLegalActions({ playerId: '0', state });
        const advance = actions.find((action) => action.kind === 'advance-phase');

        expect(advance?.commands[0]).toEqual({
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            payload: {},
        });
    });

    it('baseline policy picks the highest-priority legal planning action', () => {
        let core = withMage(MageWarsDomain.setup(PLAYER_IDS, fixedRandom), MAGE_IDS.WIZARD_APPRENTICE);
        core = addObject(core, sourceObject('familiar-ai', 2908, 'creature', ARENA_ZONE_IDS.A2, 3));
        const state = stateFor(core, 'planning');
        const context = buildAiDecisionContext({
            gameId: 'mage-wars',
            matchId: 'local:mage-wars-ai-policy-test',
            playerId: '0',
            visibleState: state,
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', minimumActionDelayMs: 0 },
        });

        const decision = mageWarsAiRuntime.localPolicies?.baseline.decide(context);
        const selectedAction = context.legalActions.find((action) => action.actionId === decision?.actionId);

        expect(selectedAction?.kind).toBe('plan-object-spell');
    });

    it('shared local AI runner can resolve a real AI-seat planning command', async () => {
        const state = stateFor(MageWarsDomain.setup(PLAYER_IDS, fixedRandom), 'planning');

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:mage-wars-ai-runner-test',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', minimumActionDelayMs: 0 },
            },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.source).toBe('local-ai');
        expect(resolution?.action.kind).toBe('plan-spells');
        expect(resolution?.action.commands[0]?.type).toBe(MAGE_WARS_COMMANDS.PLAN_SPELLS);
    });

    it('AI-seat planning commands do not create human undo snapshots', () => {
        const state = setUndoAiSeatIds(
            stateFor(MageWarsDomain.setup(PLAYER_IDS, fixedRandom), 'planning'),
            ['1'],
        );

        const planned = executePipeline(
            { domain: engineConfig.domain, systems: engineConfig.systems, systemsConfig: engineConfig.systemsConfig },
            state,
            {
                type: MAGE_WARS_COMMANDS.PLAN_SPELLS,
                playerId: '1',
                payload: { spellCardIds: [] },
                timestamp: 1,
            } as never,
            fixedRandom,
            PLAYER_IDS,
        );

        expect(planned.success).toBe(true);
        expect(planned.state.sys.undo.snapshots).toHaveLength(0);
    });
});
