import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../contexts/ToastContext';
import type { InteractionDescriptor, SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { PromptOverlay } from '../ui/PromptOverlay';
import { respondCommand } from './helpers';

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

        const response = respondCommand('discard');
        expect(dispatch).toHaveBeenCalledWith(response.type, {
            ...response.payload,
            interactionId: interaction.id,
        });
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

        const response = respondCommand('discard');
        expect(dispatch).toHaveBeenCalledWith(response.type, {
            ...response.payload,
            interactionId: interaction.id,
        });
        expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('button-only prompts render an explicit context card preview when displayCard is provided', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'zombie_walker_1',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '牌库顶是「行尸」，选择处理方式',
                sourceId: 'zombie_walker',
                targetType: 'button',
                displayCard: { defId: 'zombie_walker', cardUid: 'top-card' },
                options: [
                    { id: 'discard', label: '弃掉', value: { action: 'discard' }, displayMode: 'button' },
                    { id: 'keep', label: '放回牌库顶', value: { action: 'keep' }, displayMode: 'button' },
                ],
            },
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });

        expect(screen.getByTestId('prompt-context-card')).toBeInTheDocument();
        expect(screen.getByTestId('mock-card-preview')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '弃掉' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '放回牌库顶' })).toBeInTheDocument();
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
                playableUids: new Set(['discard-card-1']),
            },
        });

        fireEvent.click(screen.getAllByTestId('mock-card-preview')[0]);

        expect(onSelect).toHaveBeenCalledWith('discard-card-1');
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('discard display card mode ignores defId-only selectability from stale callers', () => {
        const onSelect = vi.fn();

        renderPromptOverlay({
            interaction: undefined,
            dispatch: vi.fn(),
            playerID: '0',
            displayCards: {
                title: '弃牌堆 (2)',
                cards: [
                    { uid: 'discard-card-1', defId: 'zombie_walker' },
                    { uid: 'discard-card-2', defId: 'zombie_walker' },
                ],
                onClose: vi.fn(),
                selectedUid: null,
                onSelect,
                playableDefIds: new Set(['zombie_walker']),
            } as any,
        });

        fireEvent.click(screen.getAllByTestId('mock-card-preview')[0]);
        fireEvent.click(screen.getAllByTestId('mock-card-preview')[1]);

        expect(onSelect).not.toHaveBeenCalled();
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
            },
        });

        const previews = screen.getAllByTestId('mock-card-preview');
        fireEvent.click(previews[0]);
        expect(onSelect).not.toHaveBeenCalled();

        fireEvent.click(previews[1]);
        expect(onSelect).toHaveBeenCalledWith('prompt-option-copy');
    });

    it('基地卡展示模式下点击中间选项时，应提交对应的 optionId', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'mechanic-base-choice',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '选择目标基地',
                sourceId: 'steampunk_mechanic_target',
                targetType: 'base',
                options: [
                    { id: 'base-0', label: '基地一', value: { baseIndex: 0, baseDefId: 'base_0' }, displayMode: 'card' },
                    { id: 'base-1', label: '基地二', value: { baseIndex: 1, baseDefId: 'base_mushroom_kingdom' }, displayMode: 'card' },
                    { id: 'base-2', label: '基地三', value: { baseIndex: 2, baseDefId: 'base_2' }, displayMode: 'card' },
                ],
            },
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });
        expect(screen.getByTestId('prompt-base-grid')).toHaveClass('grid', 'grid-cols-2');
        expect(screen.getAllByTestId('mock-card-preview')).toHaveLength(3);

        fireEvent.click(screen.getByTestId('prompt-card-1'));

        expect(dispatch).toHaveBeenCalledWith('SYS_INTERACTION_RESPOND', {
            interactionId: interaction.id,
            optionId: 'base-1',
        });
    });

    it('非 owner 只有拿到可见 current prompt 时才会出现中央 waiting_for_player 文案', () => {
        const dispatch = vi.fn();
        const visiblePrompt: InteractionDescriptor<SimpleChoiceData> = {
            id: 'shared-visible-choice',
            kind: 'simple-choice',
            playerId: '1',
            data: {
                title: '由另一位玩家决定',
                sourceId: 'shared_visible_prompt',
                targetType: 'button',
                options: [
                    { id: 'confirm', label: '确认', value: { chosenBy: '1' }, displayMode: 'button' },
                ],
            },
        };

        const { rerender } = render(
            <ToastProvider>
                <PromptOverlay
                    interaction={visiblePrompt}
                    dispatch={dispatch}
                    playerID="0"
                    playerNames={{ '0': 'Host-SU-E2E', '1': 'Guest-SU-E2E' }}
                />
            </ToastProvider>,
        );

        expect(screen.getByText('正在等待 {{player}}')).toBeInTheDocument();

        rerender(
            <ToastProvider>
                <PromptOverlay
                    interaction={undefined}
                    dispatch={dispatch}
                    playerID="0"
                    playerNames={{ '0': 'Host-SU-E2E', '1': 'Guest-SU-E2E' }}
                />
            </ToastProvider>,
        );

        expect(screen.queryByText('正在等待 {{player}}')).not.toBeInTheDocument();
    });
});
