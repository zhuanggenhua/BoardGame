import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { InteractionDescriptor, MultistepChoiceData } from '../InteractionSystem';
import { INTERACTION_COMMANDS } from '../InteractionSystem';
import { useMultistepInteraction } from '../useMultistepInteraction';

type SelectStep = { action: 'toggle'; dieId: number };
type SelectResult = { selectedDiceIds: number[] };

function BatchHarness({
    interaction,
    dispatchLog,
}: {
    interaction: InteractionDescriptor<MultistepChoiceData<SelectStep, SelectResult>>;
    dispatchLog: Array<{ type: string; payload?: unknown }>;
}) {
    const state = useMultistepInteraction<SelectStep, SelectResult>(
        interaction,
        (type, payload) => {
            dispatchLog.push({ type, payload });
        },
    );

    return (
        <div>
            <button type="button" onClick={() => state.step({ action: 'toggle', dieId: 0 })}>
                die-0
            </button>
            <button type="button" onClick={() => state.step({ action: 'toggle', dieId: 1 })}>
                die-1
            </button>
            <button type="button" onClick={state.confirm} disabled={!state.canConfirm}>
                confirm
            </button>
            <div data-testid="selected">{state.result?.selectedDiceIds.join(',') ?? ''}</div>
        </div>
    );
}

describe('useMultistepInteraction', () => {
    it('批量骰子交互第一次确认只提交本批次命令，不关闭整段交互', () => {
        const dispatchLog: Array<{ type: string; payload?: unknown }> = [];
        const interaction: InteractionDescriptor<MultistepChoiceData<SelectStep, SelectResult>> = {
            id: 'reroll-up-to-five',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                title: 'interaction.selectDiceToReroll',
                minSteps: 1,
                maxSteps: 5,
                confirmationMode: 'submitBatch',
                initialResult: { selectedDiceIds: [] },
                localReducer: (current, step) => {
                    if (step.action !== 'toggle') return current;
                    if (current.selectedDiceIds.includes(step.dieId)) {
                        return {
                            selectedDiceIds: current.selectedDiceIds.filter((id) => id !== step.dieId),
                        };
                    }
                    return { selectedDiceIds: [...current.selectedDiceIds, step.dieId] };
                },
                toCommands: (result) => result.selectedDiceIds.map((dieId) => ({
                    type: 'REROLL_DIE',
                    payload: { dieId },
                })),
                getCompletedSteps: (result) => result.selectedDiceIds.length,
                shouldResolveOnConfirm: (result) => result.selectedDiceIds.length === 0,
            },
        };

        render(<BatchHarness interaction={interaction} dispatchLog={dispatchLog} />);

        fireEvent.click(screen.getByText('die-0'));
        fireEvent.click(screen.getByText('die-1'));
        expect(screen.getByTestId('selected')).toHaveTextContent('0,1');

        fireEvent.click(screen.getByText('confirm'));

        expect(dispatchLog).toEqual([
            { type: 'REROLL_DIE', payload: { dieId: 0 } },
            { type: 'REROLL_DIE', payload: { dieId: 1 } },
        ]);
        expect(dispatchLog.some((entry) => entry.type === INTERACTION_COMMANDS.CONFIRM)).toBe(false);
        expect(screen.getByTestId('selected')).toHaveTextContent('');
    });
});
