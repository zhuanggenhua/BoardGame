import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameModeProvider } from '../../../contexts/GameModeContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { TutorialProvider } from '../../../contexts/TutorialContext';
import MageWarsBoard from '../Board';
import { getMageWarsSpellCardFromConfig } from '../data/configPackage';
import { MAGE_WARS_COMMANDS, type MageWarsCore } from '../domain';
import type { MageWarsCommand } from '../domain/commands';
import { ARENA_ZONE_IDS } from '../domain/ids';
import type { MatchState } from '../../../engine/types';
import { makeArenaObject, planCommand, runCommand, setupState, withArenaObject } from './helpers/domainFlowHarness';

afterEach(cleanup);

describe('Mage Wars spawn point board entry', () => {
    it('plans for the lair from the spellbook and deploys from its own zone and mana', () => {
        const initial = setupState('planning');
        const lair = makeArenaObject('player-lair', '0', ARENA_ZONE_IDS.B2, {
            kind: 'conjuration',
            name: '巢穴',
            sourceSpellCardId: 2218,
            actionReady: false,
            mana: 4,
            spellcastingSource: getMageWarsSpellCardFromConfig(2218)?.spellcastingSource,
        });
        const state = { ...initial, core: withArenaObject(initial.core, lair) };
        const dispatch = vi.fn();
        const board = (G: MatchState<MageWarsCore>) => (
            <ToastProvider>
                <GameModeProvider mode="test">
                    <TutorialProvider>
                        <MageWarsBoard G={G} playerID="0" dispatch={dispatch} isMultiplayer={false} isConnected />
                    </TutorialProvider>
                </GameModeProvider>
            </ToastProvider>
        );
        const { container, rerender } = render(board(state));
        const lairCard = () => container.querySelector('[data-testid="mage-wars-zone-field-card"][data-object-id="player-lair"]')!;
        const readCommand = (): MageWarsCommand => {
            const [type, payload] = dispatch.mock.lastCall!;
            return { type, playerId: '0', payload } as MageWarsCommand;
        };

        fireEvent.click(lairCard());
        expect(lairCard().getAttribute('data-field-card-role')).toBe('source');
        fireEvent.click(screen.getByTestId('mage-wars-spellbook-category-creature'));
        const fox = () => container.querySelector('[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id="2812"]');
        for (let page = 0; !fox() && page < 10; page += 1) {
            const nextPage = screen.getByTestId<HTMLButtonElement>('mage-wars-spellbook-next-page');
            if (nextPage.disabled) break;
            fireEvent.click(nextPage);
        }
        expect(fox()).not.toBeNull();
        fireEvent.click(fox()!);
        expect(dispatch).toHaveBeenCalledWith(MAGE_WARS_COMMANDS.PLAN_OBJECT_SPELL, {
            objectId: lair.id, spellCardId: 2812,
        });
        const planned = runCommand(state, readCommand());
        expect(planned.success).toBe(true);
        expect(planned.state.core.objects[lair.id].preparedSpellCardId).toBe(2812);
        const ours = runCommand(planned.state, planCommand([]));
        const both = runCommand(ours.state, planCommand([], '1'));
        expect(both.state.sys.phase).toBe('deployment');
        expect(both.state.core.players['0'].preparedSpellCardIds).toEqual([]);

        dispatch.mockClear();
        rerender(board(both.state));
        fireEvent.click(lairCard());
        const lairZone = screen.getByTestId('mage-wars-arena-zone-b2');
        expect(lairZone.getAttribute('data-legal-target-zone')).toBe('true');
        expect(screen.getByTestId('mage-wars-arena-zone-a3').getAttribute('data-legal-target-zone')).toBeNull();
        fireEvent.click(lairZone);
        expect(dispatch).toHaveBeenCalledOnce();
        expect(dispatch).toHaveBeenCalledWith(MAGE_WARS_COMMANDS.CAST_SPELL, {
            casterObjectId: lair.id, spellCardId: 2812, manaCost: 5, targetZoneId: ARENA_ZONE_IDS.B2,
        });
        const cast = runCommand(both.state, readCommand());
        expect(cast.success).toBe(true);
        expect(cast.state.core.objects[lair.id]).toMatchObject({ preparedSpellCardId: undefined, mana: 0 });
        expect(cast.state.core.players['0'].mana).toBe(both.state.core.players['0'].mana - 1);
        expect(Object.values(cast.state.core.objects)).toContainEqual(expect.objectContaining({
            kind: 'creature', sourceSpellCardId: 2812, zoneId: ARENA_ZONE_IDS.B2,
        }));
    });
});
