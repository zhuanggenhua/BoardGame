import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameModeProvider } from '../../../contexts/GameModeContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { TutorialProvider } from '../../../contexts/TutorialContext';
import MageWarsBoard from '../Board';
import { MAGE_WARS_COMMANDS } from '../domain';
import type { MageWarsDeclareEquipmentAttackCommand } from '../domain/commands';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { ARENA_ZONE_IDS } from '../domain/ids';
import { makeArenaObject, runCommand, setupState, withArenaObject, withPlayerInZone } from './helpers/domainFlowHarness';

afterEach(cleanup);

describe('Mage Wars equipment attack entry', () => {
    it.each([
        { targetObjectId: 'near-creature', attackProfileId: 'attack-0' },
        { targetPlayerId: '1', attackProfileId: 'attack-1' },
    ])('uses the staff attack that reaches the selected target ($attackProfileId)', ({
        attackProfileId, ...target
    }) => {
        const state = setupState('creatureAction');
        const mage = state.core.players['0'];
        const staff = makeArenaObject('arcane-staff', '0', mage.mageZoneId, {
            kind: 'equipment',
            sourceSpellCardId: 3704,
            anchoredToPlayerId: '0',
            combatProfilesSource: 'config',
            actionReady: false,
        });
        const nearCreature = makeArenaObject('near-creature', '1', mage.mageZoneId);
        const farCreature = makeArenaObject('far-creature', '1', ARENA_ZONE_IDS.D1);
        const positioned = withPlayerInZone(state.core, '1', ARENA_ZONE_IDS.B3);
        const initial = {
            ...state,
            core: [staff, nearCreature, farCreature].reduce(withArenaObject, positioned),
        };
        const dispatch = vi.fn();
        const { container } = render(
            <ToastProvider>
                <GameModeProvider mode="test">
                    <TutorialProvider>
                        <MageWarsBoard G={initial} playerID="0" dispatch={dispatch} isMultiplayer={false} isConnected />
                    </TutorialProvider>
                </GameModeProvider>
            </ToastProvider>,
        );

        const weapon = container.querySelector('[data-testid="mage-wars-attached-card"][data-object-id="arcane-staff"]');
        expect(weapon?.getAttribute('data-primary-action-state')).toBe('enabled');
        fireEvent.click(weapon!);
        const nearCard = container.querySelector('[data-testid="mage-wars-zone-field-card"][data-object-id="near-creature"]');
        const farCard = container.querySelector('[data-testid="mage-wars-zone-field-card"][data-object-id="far-creature"]');
        const opposingMage = container.querySelector('[data-testid="mage-wars-zone-mage-entity"][data-player-id="1"]');
        expect(nearCard?.getAttribute('data-field-card-role')).toBe('target');
        expect(farCard?.getAttribute('data-field-card-role')).toBeNull();
        expect(opposingMage?.getAttribute('data-mage-role')).toBe('target');
        expect(dispatch).not.toHaveBeenCalled();

        fireEvent.click(('targetObjectId' in target ? nearCard : opposingMage)!);
        expect(dispatch).toHaveBeenCalledOnce();
        const [type, payload] = dispatch.mock.calls[0] as [
            typeof MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            MageWarsDeclareEquipmentAttackCommand['payload'],
        ];
        expect(type).toBe(MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK);
        expect(payload).toEqual({ equipmentObjectId: 'arcane-staff', attackProfileId, ...target });
        const result = runCommand(initial, { type, playerId: '0', payload });
        expect(result.success).toBe(true);
        expect(result.state.core.players['0'].actionReady).toBe(false);
        expect(result.events).toContainEqual(expect.objectContaining({
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
            payload: expect.objectContaining({
                attackerObjectId: 'arcane-staff',
                attackProfileId,
                ...target,
                diceResults: Array(attackProfileId === 'attack-0' ? 4 : 3).fill(1),
            }),
        }));
    });
});
