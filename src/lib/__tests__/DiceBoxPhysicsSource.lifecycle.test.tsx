// @vitest-environment jsdom
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DiceBoxPhysicsSource } from '../dice-physics/DiceBoxPhysicsSource';

const { createEngine } = vi.hoisted(() => ({ createEngine: vi.fn() }));
vi.mock('../dice-box-threejs/engine', () => ({ DiceBoxThreeEngine: { create: createEngine } }));

it('连续检定更换画布后，新引擎仍须真实投掷并报告新轮次停稳', async () => {
    const makeEngine = () => {
        let hasDice = false;
        return {
            resize: vi.fn(), destroy: vi.fn(), setCanvasDiagnostics: vi.fn(),
            setDieSkins: vi.fn(), setDiceHighlights: vi.fn(), getPhysicsState: vi.fn(),
            hasDice: vi.fn(() => hasDice),
            rollToValues: vi.fn(async () => { hasDice = true; }),
            rerollToValues: vi.fn(async () => {}), syncSettledValues: vi.fn(),
            previewValues: vi.fn(), clear: vi.fn(), removeDice: vi.fn(), restoreValues: vi.fn(),
        };
    };
    const first = makeEngine();
    const second = makeEngine();
    createEngine.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const onSettled = vi.fn();
    const view = render(<DiceBoxPhysicsSource dice={[{id:1,value:6}]}
        canvasTestId="might-canvas" motion={{type:'roll',id:'might'}} settledIdentity="might"
        onSettledChange={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalledWith(true, 'might'));
    await act(async () => {
        view.rerender(<DiceBoxPhysicsSource dice={[{id:1,value:3}]}
            canvasTestId="speed-canvas" motion={{type:'roll',id:'speed'}} settledIdentity="speed"
            onSettledChange={onSettled} />);
    });
    await waitFor(() => expect(createEngine).toHaveBeenCalledTimes(2));
    expect(first.destroy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(second.rollToValues).toHaveBeenCalledWith([3]));
    expect(onSettled).toHaveBeenCalledWith(false, 'speed');
    expect(onSettled).toHaveBeenCalledWith(true, 'speed');
    view.unmount();
});
