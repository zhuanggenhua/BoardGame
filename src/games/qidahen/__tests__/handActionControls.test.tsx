import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QidahenHandActionControls } from '../ui/QidahenHandActionControls';
import type { useQidahenTurnInput } from '../ui/useQidahenTurnInput';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

it('教程推荐作用于行动本体，同时保留其它正式行动入口', () => {
    const choose = vi.fn();
    const input = {
        active: true, step: 'menu', canAct: true, choose,
        handOptions: ['recruit', 'raid'].map(actionId => ({
            id: `hand-action:${actionId}`, value: { kind: 'choose-hand', actionId },
        })),
    } as unknown as ReturnType<typeof useQidahenTurnInput>;
    const view = render(<QidahenHandActionControls input={input} recommendedOptionIds={['hand-action:recruit']} />);
    const recruit = screen.getByTestId('qidahen-action-recruit');
    const raid = screen.getByTestId('qidahen-action-raid');
    expect(recruit.getAttribute('data-qidahen-tutorial-recommended')).toBe('true');
    expect(raid.getAttribute('data-qidahen-tutorial-recommended')).toBeNull();
    fireEvent.click(raid);
    expect(choose).toHaveBeenCalledWith('hand-action:raid');
    view.rerender(<QidahenHandActionControls input={input} />);
    expect(recruit.getAttribute('data-qidahen-tutorial-recommended')).toBeNull();
});
