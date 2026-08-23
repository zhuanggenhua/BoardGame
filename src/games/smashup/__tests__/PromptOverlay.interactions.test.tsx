import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../contexts/ToastContext';
import type { InteractionDescriptor, SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { PromptOverlay } from '../ui/PromptOverlay';
import { respondCommand, respondOptionsCommand } from './helpers';

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

    it('multi prompts submit skip as a control action instead of mixing it with selected options', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'multi-control-skip',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '选择至多两个目标，或跳过',
                sourceId: 'multi_control_skip_regression',
                targetType: 'generic',
                multi: { min: 0, max: 2 },
                options: [
                    { id: 'target-a', label: '目标 A', value: { cardUid: 'target-a' } },
                    { id: 'target-b', label: '目标 B', value: { cardUid: 'target-b' } },
                    { id: 'target-c', label: '目标 C', value: { cardUid: 'target-c' } },
                    { id: 'target-d', label: '目标 D', value: { cardUid: 'target-d' } },
                    { id: 'skip', label: '跳过', value: { action: 'skip' }, displayMode: 'button' },
                ],
            },
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });

        fireEvent.click(screen.getByRole('button', { name: '目标 A' }));
        expect(dispatch).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: '跳过' }));

        const response = respondOptionsCommand(['skip']);
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

    it('discard display card mode keeps multiple selected cards until explicit confirm', () => {
        const onSelect = vi.fn();
        const onConfirmSelection = vi.fn();
        const dispatch = vi.fn();

        renderPromptOverlay({
            interaction: undefined,
            dispatch,
            playerID: '0',
            displayCards: {
                title: '弃牌堆 (3)',
                cards: [
                    { uid: 'discard-card-1', defId: 'rock_stars_groupie' },
                    { uid: 'discard-card-2', defId: 'rock_stars_classic_rocker' },
                    { uid: 'discard-card-3', defId: 'rock_stars_rick_roll' },
                ],
                onClose: vi.fn(),
                selectedUids: new Set(['discard-card-1', 'discard-card-2']),
                onSelect,
                playableUids: new Set(['discard-card-1', 'discard-card-2', 'discard-card-3']),
                onConfirmSelection,
                minSelections: 0,
                maxSelections: 3,
                confirmLabel: '确认选择',
            },
        });

        fireEvent.click(screen.getAllByTestId('mock-card-preview')[0]);
        fireEvent.click(screen.getByRole('button', { name: '确认选择' }));

        expect(onSelect).toHaveBeenCalledWith('discard-card-1');
        expect(onConfirmSelection).toHaveBeenCalledTimes(1);
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
        expect(screen.getAllByTestId('mock-card-preview')).toHaveLength(3);

        fireEvent.click(screen.getByTestId('prompt-card-1'));

        expect(dispatch).toHaveBeenCalledWith('SYS_INTERACTION_RESPOND', {
            interactionId: interaction.id,
            optionId: 'base-1',
        });
    });

    it('卡图模式候选较多时提供搜索，并按搜索词过滤当前卡图列表', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'banned-list-search',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '禁卡表：命名一张牌',
                sourceId: 'geeks_banned_list',
                targetType: 'generic',
                options: [
                    { id: 'card-0', label: '收藏家', value: { defId: 'alien_collector' }, displayMode: 'card' },
                    { id: 'card-1', label: '急速闪电', value: { defId: 'wizard_zap' }, displayMode: 'card' },
                    { id: 'card-2', label: '大副', value: { defId: 'pirate_first_mate' }, displayMode: 'card' },
                    { id: 'card-3', label: '禁卡表', value: { defId: 'geeks_banned_list' }, displayMode: 'card' },
                    { id: 'card-4', label: '菲丽希亚', value: { defId: 'geeks_felicia_day' }, displayMode: 'card' },
                    { id: 'card-5', label: '恶棍', value: { defId: 'bear_cavalry' }, displayMode: 'card' },
                    { id: 'card-6', label: '机器人', value: { defId: 'robot_microbot_alpha' }, displayMode: 'card' },
                    { id: 'card-7', label: '忍者侍从', value: { defId: 'ninja_apprentice' }, displayMode: 'card' },
                    { id: 'card-8', label: '大脚怪', value: { defId: 'trickster_leprechaun' }, displayMode: 'card' },
                ],
            },
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });

        expect(screen.getByTestId('prompt-card-search-input')).toBeInTheDocument();
        expect(screen.getAllByTestId('mock-card-preview')).toHaveLength(9);

        fireEvent.change(screen.getByTestId('prompt-card-search-input'), { target: { value: '禁卡' } });

        expect(screen.getAllByTestId('mock-card-preview')).toHaveLength(1);
        expect(screen.getByText('ui.card_filter_result_count')).toBeInTheDocument();
    });

    it('间谍牌库重排面板启用纵向滚动上限，避免确认按钮掉出屏幕', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'spy-reorder',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '间谍：重排牌库',
                sourceId: 'super_spies_spy_reorder',
                targetType: 'generic',
                inspectedCards: [
                    { uid: 'deck-a', defId: 'super_spies_spy' },
                    { uid: 'deck-b', defId: 'robot_microbot_alpha' },
                    { uid: 'deck-c', defId: 'wizard_zap' },
                ],
                options: [
                    { id: 'order-1', label: '方案一', value: { targetPlayerId: '0', topUids: ['deck-a'], bottomUids: ['deck-b', 'deck-c'] } },
                    { id: 'order-2', label: '方案二', value: { targetPlayerId: '0', topUids: ['deck-b'], bottomUids: ['deck-a', 'deck-c'] } },
                ],
            },
        };

        const { container } = renderPromptOverlay({ interaction, dispatch, playerID: '0' });

        expect(screen.getByRole('button', { name: 'ui.deck_reorder_confirm' })).toBeInTheDocument();
        expect(container.querySelector('.max-h-\\[min\\(92vh\\2c 56rem\\)\\]')).toBeTruthy();
        expect(container.querySelector('.overflow-y-auto')).toBeTruthy();
    });

    it('单排仍能放下时不应提前显示搜索框', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'single-row-no-search',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '选择一张牌',
                sourceId: 'single_row_prompt',
                targetType: 'generic',
                options: [
                    { id: 'card-0', label: '收藏家', value: { defId: 'alien_collector' }, displayMode: 'card' },
                    { id: 'card-1', label: '急速闪电', value: { defId: 'wizard_zap' }, displayMode: 'card' },
                    { id: 'card-2', label: '大副', value: { defId: 'pirate_first_mate' }, displayMode: 'card' },
                    { id: 'card-3', label: '禁卡表', value: { defId: 'geeks_banned_list' }, displayMode: 'card' },
                    { id: 'card-4', label: '菲丽希亚', value: { defId: 'geeks_felicia_day' }, displayMode: 'card' },
                ],
            },
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });

        expect(screen.queryByTestId('prompt-card-search-input')).not.toBeInTheDocument();
        expect(screen.getAllByTestId('mock-card-preview')).toHaveLength(5);
    });

    it('基地卡单排放不下时才显示搜索框', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'base-row-search',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '选择目标基地',
                sourceId: 'base_row_prompt',
                targetType: 'base',
                options: [
                    { id: 'base-0', label: '基地一', value: { baseIndex: 0, baseDefId: 'base_0' }, displayMode: 'card' },
                    { id: 'base-1', label: '基地二', value: { baseIndex: 1, baseDefId: 'base_mushroom_kingdom' }, displayMode: 'card' },
                    { id: 'base-2', label: '基地三', value: { baseIndex: 2, baseDefId: 'base_2' }, displayMode: 'card' },
                    { id: 'base-3', label: '基地四', value: { baseIndex: 3, baseDefId: 'base_the_factory' }, displayMode: 'card' },
                    { id: 'base-4', label: '基地五', value: { baseIndex: 4, baseDefId: 'base_the_mothership' }, displayMode: 'card' },
                    { id: 'base-5', label: '基地六', value: { baseIndex: 5, baseDefId: 'base_plateau_of_leng' }, displayMode: 'card' },
                ],
            },
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });

        expect(screen.getByTestId('prompt-card-search-input')).toBeInTheDocument();
    });

    it('顺序选择类选项只要携带 displayCard，也应走卡图面板而不是文本按钮', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'ordered-card-choice',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '更多的计划：选择下一张放回牌库顶的牌',
                sourceId: 'mega_troopers_plan_for_more_order',
                targetType: 'generic',
                options: [
                    {
                        id: 'order-0',
                        label: '闪电水晶 放在下一张',
                        value: { cardUid: 'crystal', defId: 'mega_troopers_lightning_crystal' },
                        displayCard: { defId: 'mega_troopers_lightning_crystal', cardUid: 'crystal' },
                    },
                    {
                        id: 'order-1',
                        label: '强力姿势 放在下一张',
                        value: { cardUid: 'pose', defId: 'mega_troopers_power_pose' },
                        displayCard: { defId: 'mega_troopers_power_pose', cardUid: 'pose' },
                    },
                ],
            },
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });

        expect(screen.getAllByTestId('mock-card-preview')).toHaveLength(2);
        expect(screen.queryByRole('button', { name: '闪电水晶 放在下一张' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('prompt-card-1'));

        expect(dispatch).toHaveBeenCalledWith('SYS_INTERACTION_RESPOND', {
            interactionId: interaction.id,
            optionId: 'order-1',
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

        expect(screen.getByText('ui.waiting_for_player')).toBeInTheDocument();

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

        expect(screen.queryByText('ui.waiting_for_player')).not.toBeInTheDocument();
    });
});
