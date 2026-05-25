import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../contexts/ToastContext';
import { INTERACTION_COMMANDS, type InteractionDescriptor, type SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { PromptOverlay } from '../ui/PromptOverlay';
import { RevealOverlay } from '../ui/RevealOverlay';
import { SU_EVENTS } from '../domain/types';
import type { EventStreamEntry } from '../../../engine/types';

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

    it('button-only prompt 不归当前页面所有时，应只显示等待文案而不暴露操作按钮', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'secret-agent-waiting',
            kind: 'simple-choice',
            playerId: '1',
            data: {
                title: '秘密特工：选择要弃掉的手牌',
                sourceId: 'super_spies_secret_agent_discard',
                targetType: 'button',
                options: [
                    { id: 'hand-a', label: '手牌 A', value: { cardUid: 'hand-a' }, displayMode: 'button' },
                    { id: 'hand-b', label: '手牌 B', value: { cardUid: 'hand-b' }, displayMode: 'button' },
                ],
            },
        };

        renderPromptOverlay({
            interaction,
            dispatch,
            playerID: '0',
            playerNames: {
                '0': 'Host',
                '1': 'Guest',
            },
        });

        expect(screen.getByText('正在等待 {{player}}')).toBeInTheDocument();
        expect(screen.queryByText('秘密特工：选择要弃掉的手牌')).toBeNull();
        expect(screen.queryByRole('button', { name: '手牌 A' })).toBeNull();
        expect(screen.queryByRole('button', { name: '手牌 B' })).toBeNull();
    });

    it('Host 页先关闭私有 reveal overlay 后，仍只应保留非 owner discard prompt 的等待壳', async () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'spy-discard-waiting-host',
            kind: 'simple-choice',
            playerId: '1',
            data: {
                title: '抛弃我的间谍：选择一张随从牌弃掉',
                sourceId: 'super_spies_the_spy_who_ditched_me_discard',
                targetType: 'button',
                options: [
                    { id: 'minion-a', label: '鲨鱼 A', value: { cardUid: 'minion-a' }, displayMode: 'button' },
                    { id: 'minion-b', label: '鲨鱼 B', value: { cardUid: 'minion-b' }, displayMode: 'button' },
                ],
            },
        };
        const revealEntries: EventStreamEntry[] = [{
            id: 99,
            event: {
                type: SU_EVENTS.REVEAL_HAND,
                payload: {
                    targetPlayerId: '2',
                    viewerPlayerId: '0',
                    cards: [{ uid: 'action-only', defId: 'super_spies_for_my_eyes_only' }],
                    reason: 'super_spies_the_spy_who_ditched_me',
                },
                timestamp: 9900,
            },
        }];

        render(
            <ToastProvider>
                <PromptOverlay
                    interaction={interaction}
                    dispatch={dispatch}
                    playerID="0"
                    playerNames={{
                        '0': 'Host',
                        '1': 'Guest',
                    }}
                />
                <RevealOverlay
                    entries={revealEntries}
                    currentPlayerId="0"
                    playerNames={{
                        '0': 'Host',
                        '2': 'P3',
                    }}
                />
            </ToastProvider>,
        );

        expect(await screen.findByTestId('reveal-overlay')).toBeInTheDocument();
        expect(screen.getByText('正在等待 {{player}}')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('reveal-dismiss-btn'));

        expect(screen.queryByTestId('reveal-overlay')).toBeNull();
        expect(screen.getByText('正在等待 {{player}}')).toBeInTheDocument();
        expect(screen.queryByText('抛弃我的间谍：选择一张随从牌弃掉')).toBeNull();
        expect(screen.queryByRole('button', { name: '鲨鱼 A' })).toBeNull();
        expect(screen.queryByRole('button', { name: '鲨鱼 B' })).toBeNull();
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

    it('deck reorder prompts render a fixed editor instead of permutation button wall', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'spy-reorder-1',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '间谍：将这几张牌按任意顺序放回牌库顶/底',
                sourceId: 'super_spies_spy_reorder',
                targetType: 'player',
                inspectedCards: [
                    { uid: 'deck-a', defId: 'super_spies_spy' },
                    { uid: 'deck-b', defId: 'super_spies_operative' },
                    { uid: 'deck-c', defId: 'super_spies_mole' },
                ],
                options: [
                    {
                        id: 'spy-order-1',
                        label: '顶：间谍 / 密探；底：内鬼',
                        value: { targetPlayerId: '0', topUids: ['deck-a', 'deck-c'], bottomUids: ['deck-b'] },
                    },
                ],
            } as any,
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });

        expect(screen.getByText('当前操作对象')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '前移' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '重置' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '顶：间谍 / 密探；底：内鬼' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '确认顺序' })).toBeInTheDocument();
    });

    it('deck reorder prompts dispatch the matched underlying option after local editing', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'spy-reorder-2',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '间谍：将这几张牌按任意顺序放回牌库顶/底',
                sourceId: 'super_spies_spy_reorder',
                targetType: 'player',
                inspectedCards: [
                    { uid: 'deck-a', defId: 'super_spies_spy' },
                    { uid: 'deck-b', defId: 'super_spies_operative' },
                    { uid: 'deck-c', defId: 'super_spies_mole' },
                ],
                options: [
                    {
                        id: 'spy-order-keep',
                        label: '顶：间谍 / 内鬼 / 密探；底：无',
                        value: { targetPlayerId: '0', topUids: ['deck-a', 'deck-b', 'deck-c'], bottomUids: [] },
                    },
                    {
                        id: 'spy-order-target',
                        label: '顶：密探 / 间谍；底：内鬼',
                        value: { targetPlayerId: '0', topUids: ['deck-c', 'deck-a'], bottomUids: ['deck-b'] },
                    },
                ],
            } as any,
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });

        fireEvent.click(document.querySelector('[data-deck-reorder-card-uid="deck-b"]') as Element);
        fireEvent.click(screen.getByRole('button', { name: '移到牌库底' }));
        fireEvent.click(document.querySelector('[data-deck-reorder-card-uid="deck-c"]') as Element);
        fireEvent.click(screen.getByRole('button', { name: '前移' }));
        fireEvent.click(screen.getByRole('button', { name: '确认顺序' }));

        expect(dispatch).toHaveBeenCalledWith(INTERACTION_COMMANDS.RESPOND, { optionId: 'spy-order-target' });
    });

    it('deck reorder prompt 不归当前页面所有时，应只显示等待态而不暴露编辑工具', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'spy-reorder-waiting',
            kind: 'simple-choice',
            playerId: '1',
            data: {
                title: '间谍：将这几张牌按任意顺序放回牌库顶/底',
                sourceId: 'super_spies_spy_reorder',
                targetType: 'player',
                inspectedCards: [
                    { uid: 'deck-a', defId: 'super_spies_spy' },
                    { uid: 'deck-b', defId: 'super_spies_operative' },
                ],
                options: [
                    {
                        id: 'spy-order-waiting',
                        label: '顶：间谍 / 密探；底：无',
                        value: { targetPlayerId: '1', topUids: ['deck-a', 'deck-b'], bottomUids: [] },
                    },
                ],
            } as any,
        };

        renderPromptOverlay({
            interaction,
            dispatch,
            playerID: '0',
            playerNames: {
                '0': 'Host',
                '1': 'Guest',
            },
        });

        expect(screen.getByText('正在等待 {{player}}')).toBeInTheDocument();
        expect(screen.getByText('等待调整')).toBeInTheDocument();
        expect(screen.queryByText('编辑工具')).toBeNull();
        expect(screen.queryByRole('button', { name: '确认顺序' })).toBeNull();
        expect(screen.queryByRole('button', { name: '移到牌库底' })).toBeNull();
        expect(screen.queryByRole('button', { name: '移到牌库顶' })).toBeNull();
        expect(screen.queryByRole('button', { name: '前移' })).toBeNull();
        expect(screen.queryByRole('button', { name: '后移' })).toBeNull();
        expect(screen.queryByRole('button', { name: '重置' })).toBeNull();
    });

    it('compact multi prompt 不归当前页面所有时，应只显示一处等待文案', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'operative-player-choice-waiting',
            kind: 'simple-choice',
            playerId: '1',
            data: {
                title: '密探：选择要查看牌库顶牌的玩家',
                sourceId: 'super_spies_operative_players',
                targetType: 'generic',
                multi: { min: 0, max: 2 },
                options: [
                    { id: 'player-0', label: '玩家 0', value: { targetPlayerId: '0' }, displayMode: 'button' },
                    { id: 'player-1', label: '玩家 1', value: { targetPlayerId: '1' }, displayMode: 'button' },
                ],
            } as any,
        };

        renderPromptOverlay({
            interaction,
            dispatch,
            playerID: '0',
            playerNames: {
                '0': 'Host',
                '1': 'Guest',
            },
        });

        expect(screen.queryAllByText('正在等待 {{player}}')).toHaveLength(1);
        expect(screen.queryByText('密探：选择要查看牌库顶牌的玩家')).toBeNull();
        expect(screen.queryByText('等待对方选择…')).toBeNull();
        expect(screen.queryByRole('button', { name: '玩家 0' })).toBeNull();
        expect(screen.queryByRole('button', { name: '玩家 1' })).toBeNull();
        expect(screen.queryByRole('button', { name: '确认' })).toBeNull();
    });

    it('card mode prompt 不归当前页面所有时，应只显示一处等待文案而不泄露候选卡面', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'operative-card-choice-waiting',
            kind: 'simple-choice',
            playerId: '1',
            data: {
                title: '密探：选择要放到各自牌库底的牌（未选保持在顶）',
                sourceId: 'super_spies_operative_top_bottom',
                targetType: 'generic',
                multi: { min: 0, max: 2 },
                options: [
                    { id: 'p0-top', label: '只为我的眼睛', value: { targetPlayerId: '0', cardUid: 'p0-top', previewDefId: 'super_spies_for_my_eyes_only' }, displayMode: 'card' },
                    { id: 'p1-top', label: '跳跃者', value: { targetPlayerId: '1', cardUid: 'p1-top', previewDefId: 'time_travelers_jumper' }, displayMode: 'card' },
                ],
            } as any,
        };

        renderPromptOverlay({
            interaction,
            dispatch,
            playerID: '0',
            playerNames: {
                '0': 'Host',
                '1': 'Guest',
            },
        });

        expect(screen.queryAllByText('正在等待 {{player}}')).toHaveLength(1);
        expect(screen.queryByText('密探：选择要放到各自牌库底的牌（未选保持在顶）')).toBeNull();
        expect(screen.queryByText('等待对方选择…')).toBeNull();
        expect(screen.queryByText('只为我的眼睛')).toBeNull();
        expect(screen.queryByText('跳跃者')).toBeNull();
        expect(screen.queryByRole('button', { name: '确认' })).toBeNull();
    });

    it('list mode prompt 不归当前页面所有时，应只显示一处等待文案而不渲染文本按钮', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'list-waiting',
            kind: 'simple-choice',
            playerId: '1',
            data: {
                title: '选择一个反应动作',
                sourceId: 'smashup_reaction_choose',
                targetType: 'generic',
                options: [
                    { id: 'a', label: '动作 A', value: { action: 'a' }, displayMode: 'button' },
                    { id: 'b', label: '动作 B', value: { action: 'b' }, displayMode: 'button' },
                    { id: 'c', label: '动作 C', value: { action: 'c' }, displayMode: 'button' },
                    { id: 'd', label: '动作 D', value: { action: 'd' }, displayMode: 'button' },
                ],
            } as any,
        };

        renderPromptOverlay({
            interaction,
            dispatch,
            playerID: '0',
            playerNames: {
                '0': 'Host',
                '1': 'Guest',
            },
        });

        expect(screen.queryAllByText('正在等待 {{player}}')).toHaveLength(1);
        expect(screen.queryByText('选择一个反应动作')).toBeNull();
        expect(screen.queryByText('等待对方选择…')).toBeNull();
        expect(screen.queryByRole('button', { name: '动作 A' })).toBeNull();
        expect(screen.queryByRole('button', { name: '动作 B' })).toBeNull();
        expect(screen.queryByRole('button', { name: '动作 C' })).toBeNull();
        expect(screen.queryByRole('button', { name: '动作 D' })).toBeNull();
    });

    it('prompt content switches reset local multi-select state and replace stale first-step UI', () => {
        const dispatch = vi.fn();
        const firstInteraction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'operative-shared-id',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '密探：选择要查看牌库顶牌的玩家',
                sourceId: 'super_spies_operative_players',
                targetType: 'generic',
                multi: { min: 0, max: 2 },
                options: [
                    { id: 'player-0', label: '玩家 0', value: { targetPlayerId: '0' }, displayMode: 'button' },
                    { id: 'player-1', label: '玩家 1', value: { targetPlayerId: '1' }, displayMode: 'button' },
                ],
            } as any,
        };
        const secondInteraction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'operative-shared-id',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '密探：选择要放到各自牌库底的牌（未选保持在顶）',
                sourceId: 'super_spies_operative_top_bottom',
                targetType: 'generic',
                multi: { min: 0, max: 2 },
                options: [
                    { id: 'p0-top', label: '只为我的眼睛', value: { targetPlayerId: '0', cardUid: 'p0-top', defId: 'super_spies_for_my_eyes_only' }, displayMode: 'card' },
                    { id: 'p1-top', label: '跳跃者', value: { targetPlayerId: '1', cardUid: 'p1-top', defId: 'time_travelers_jumper' }, displayMode: 'card' },
                ],
            } as any,
        };

        const view = renderPromptOverlay({ interaction: firstInteraction, dispatch, playerID: '0' });
        fireEvent.click(screen.getByRole('button', { name: '玩家 0' }));
        fireEvent.click(screen.getByRole('button', { name: '玩家 1' }));
        expect(screen.getByRole('button', { name: '确认 (2)' })).toBeInTheDocument();

        view.rerender(
            <ToastProvider>
                <PromptOverlay interaction={secondInteraction} dispatch={dispatch} playerID="0" />
            </ToastProvider>,
        );

        expect(screen.getByText('密探：选择要放到各自牌库底的牌（未选保持在顶）')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '玩家 0' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '玩家 1' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '确认 (2)' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument();
        expect(screen.getByText('只为我的眼睛')).toBeInTheDocument();
        expect(screen.getByText('跳跃者')).toBeInTheDocument();
    });

    it('two-card multi card prompts keep a compact action bar without select-all noise', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'operative-card-choice',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '密探：选择要放到各自牌库底的牌（未选保持在顶）',
                sourceId: 'super_spies_operative_top_bottom',
                targetType: 'generic',
                multi: { min: 0, max: 2 },
                options: [
                    { id: 'p0-top', label: '只为我的眼睛', value: { targetPlayerId: '0', cardUid: 'p0-top', previewDefId: 'super_spies_for_my_eyes_only' }, displayMode: 'card' },
                    { id: 'p1-top', label: '跳跃者', value: { targetPlayerId: '1', cardUid: 'p1-top', previewDefId: 'time_travelers_jumper' }, displayMode: 'card' },
                ],
            } as any,
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });

        expect(screen.queryByRole('button', { name: '全选' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument();
        expect(screen.getByText('已选 0 / 2')).toBeInTheDocument();
    });

    it('two-option multi button prompts also hide select-all noise', () => {
        const dispatch = vi.fn();
        const interaction: InteractionDescriptor<SimpleChoiceData> = {
            id: 'operative-player-choice',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                title: '密探：选择要查看牌库顶牌的玩家',
                sourceId: 'super_spies_operative_players',
                targetType: 'generic',
                multi: { min: 0, max: 2 },
                options: [
                    { id: 'player-0', label: '玩家 0', value: { targetPlayerId: '0' }, displayMode: 'button' },
                    { id: 'player-1', label: '玩家 1', value: { targetPlayerId: '1' }, displayMode: 'button' },
                ],
            } as any,
        };

        renderPromptOverlay({ interaction, dispatch, playerID: '0' });

        expect(screen.queryByRole('button', { name: '全选' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument();
    });
});
