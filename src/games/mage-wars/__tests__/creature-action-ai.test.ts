import { describe, expect, it } from 'vitest';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import { buildMageWarsAiLegalActions } from '../ai';
import { MAGE_WARS_COMMANDS } from '../domain';
import { runCommand, setupState } from './helpers/domainFlowHarness';

describe('mage-wars AI creature actions', () => {
    it('cannot skip equal active counts and can finish after choosing no action', () => {
        const base = setupState('creatureAction');
        const state = { ...base, core: { ...base.core, phaseReadyPlayerIds: [], phaseActorId: '0' } };
        const before = buildMageWarsAiLegalActions({ state, playerId: '0' });
        expect(before.some((action) => action.commands.some((command) => command.type === FLOW_COMMANDS.ADVANCE_PHASE))).toBe(false);
        expect(before.some((action) => action.commands.some((command) => command.type === MAGE_WARS_COMMANDS.CREATURE_NO_ACTION))).toBe(true);
        const idle = runCommand(state, { type: MAGE_WARS_COMMANDS.CREATURE_NO_ACTION, playerId: '0', payload: {} });
        expect(idle.success).toBe(true);
        const after = buildMageWarsAiLegalActions({ state: idle.state, playerId: '0' });
        expect(after.some((action) => action.commands.some((command) => command.type === FLOW_COMMANDS.ADVANCE_PHASE))).toBe(true);
        expect(after.some((action) => action.commands.some((command) => command.type === MAGE_WARS_COMMANDS.CREATURE_NO_ACTION))).toBe(false);
    });
});
