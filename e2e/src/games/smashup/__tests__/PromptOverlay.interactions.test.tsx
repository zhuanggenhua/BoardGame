import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../contexts/ToastContext';
import { INTERACTION_COMMANDS, type InteractionDescriptor, type SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { PromptOverlay } from '../ui/PromptOverlay';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
        i18n: { exists: () => false },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

vi.mock('../../../components/common/media/CardPreview', () => ({
    CardPreview: ({ alt, title, className }: { alt?: string; title?: string; className?: string }) => (
        <div className={className} data-testid="mock-card-preview">{alt ?? title ?? 'card'}</div>
    ),
}));

function renderPromptOverlay(props: React.ComponentProps<typeof PromptOverlay>) {
    return render(
        <ToastProvider>
            <PromptOverlay {...props} />
        </ToastProvider>,
    );
}

describe('SmashUp PromptOverlay interaction regressions', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('button-only prompts submit the selected option', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'zombie_walker_1',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '牌库顶是「测试牌」，选择处理方式',
                sourceId: 'zombie_walker',
                targetType: 'button',
                options: [
                    { id: 'discard', label: '弃掉', value: { action: 'discard' }, displayMode: 'button' },
                    { id: 'keep', label: '放回牌库顶', value: { action: 'keep' }, displayMode: 'button' },
                ],
            },
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });
        fireEvent.click(screen.getByRole('button', { name: '弃掉' }));

        expect(dispatch).toHaveBeenCalledWith(INTERACTION_COMMANDS.RESPOND, { optionId: 'discard' });
    });

    it('button-only prompts submit on touch pointerdown before mobile click can be lost', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'zombie_walker_1',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '牌库顶是「测试牌」，选择处理方式',
                sourceId: 'zombie_walker',
                targetType: 'button',
                options: [
                    { id: 'discard', label: '弃掉', value: { action: 'discard' }, displayMode: 'button' },
                    { id: 'keep', label: '放回牌库顶', value: { action: 'keep' }, displayMode: 'button' },
                ],
            },
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });
        const discardButton = screen.getByRole('button', { name: '弃掉' });
        fireEvent.pointerDown(discardButton, { pointerType: 'touch' });
        fireEvent.click(discardButton);

        expect(dispatch).toHaveBeenCalledWith(INTERACTION_COMMANDS.RESPOND, { optionId: 'discard' });
        expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('discard display card mode toggles playable cards by uid', () => {
        const onSelect = vi.fn();
        const dispatch = vi.fn();

        renderPromptOverlay({
            interaction: undefined,
            dispatch,
            playerID: '0',
            displayCards: {
                title: '弃牌堆 (2)',
                cards: [
                    { uid: 'discard-card-1', defId: 'zombie_walker' },
                    { uid: 'discard-card-2', defId: 'pirate_first_mate' },
                ],
                onClose: vi.fn(),
                selectedUid: null,
                onSelect,
                playableDefIds: new Set(['zombie_walker']),
            },
        });

        fireEvent.click(screen.getAllByTestId('mock-card-preview')[0]);

        expect(onSelect).toHaveBeenCalledWith('discard-card-1');
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('discard display card mode does not enable same-defId cards outside playable uid set', () => {
        const onSelect = vi.fn();

        renderPromptOverlay({
            interaction: undefined,
            dispatch: vi.fn(),
            playerID: '0',
            displayCards: {
                title: '弃牌堆 (2)',
                cards: [
                    { uid: 'newer-unplayable-copy', defId: 'zombie_walker' },
                    { uid: 'prompt-option-copy', defId: 'zombie_walker' },
                ],
                onClose: vi.fn(),
                selectedUid: null,
                onSelect,
                playableUids: new Set(['prompt-option-copy']),
                playableDefIds: new Set(['zombie_walker']),
            },
        });

        const previews = screen.getAllByTestId('mock-card-preview');
        fireEvent.click(previews[0]);
        expect(onSelect).not.toHaveBeenCalled();

        fireEvent.click(previews[1]);
        expect(onSelect).toHaveBeenCalledWith('prompt-option-copy');
    });
});
