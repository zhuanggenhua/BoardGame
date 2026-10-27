import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RightSidebar } from '../RightSidebar';

vi.mock('react-i18next', async importOriginal => ({
    ...await importOriginal<typeof import('react-i18next')>(),
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../DiceTray', () => ({
    DiceTray: () => null,
    DiceActions: ({ isResponseWindowOpen }: { isResponseWindowOpen?: boolean }) => <div data-testid="response-window-wiring">{String(isResponseWindowOpen)}</div>,
}));
vi.mock('../DiscardPile', () => ({ DiscardPile: React.forwardRef(() => null) }));
vi.mock('../PassiveAbilityPanel', () => ({ PassiveAbilityPanel: () => null }));

describe('右侧骰盘共享交互接线', () => {
    it('响应窗口状态必须传递给原掷骰动作区', () => {
        render(<RightSidebar dice={[]} rollCount={1} rollLimit={3} rollConfirmed={false} currentPhase="offensiveRoll"
            canInteractDice isResponseWindowOpen isRolling={false} setIsRolling={vi.fn()} onToggleLock={vi.fn()}
            onRoll={vi.fn()} onConfirm={vi.fn()} showAdvancePhaseButton={false} advanceLabel="" isAdvanceButtonEnabled={false}
            onAdvance={vi.fn()} discardPileRef={React.createRef<HTMLDivElement>()} discardCards={[]} canUndoDiscard={false}
            onUndoDiscard={vi.fn()} discardHighlighted={false} sellButtonVisible={false} rootPlayerId="0" />);
        expect(screen.getByTestId('response-window-wiring')).toHaveTextContent('true');
    });
});
