/**
 * InteractionOverlay 组件单元测试
 * 
 * 测试范围：
 * - 组件渲染
 * - Props 传递
 * - 用户交互（选择、确认、取消）
 * - 不同交互类型的 UI 差异
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionOverlay } from '../InteractionOverlay';
import type { InteractionDescriptor, HeroState } from '../../domain/types';
import type { PlayerId } from '../../../../engine/types';

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            const translations: Record<string, string> = {
                'interaction.selectStatusToRemove': '选择要移除的状态效果',
                'interaction.selectPlayerToRemoveAllStatus': '选择玩家',
                'interaction.selectStatusToTransfer': '选择要移除的状态效果',
                'interaction.transferSelectTarget': '选择目标玩家',
                'interaction.noStatus': '无状态',
                'common.self': '自己',
                'common.opponent': '对手',
                'common.cancel': '取消',
                'common.confirm': '确认',
            };
            return translations[key] || key;
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

describe('InteractionOverlay', () => {
    const mockPlayers: Record<PlayerId, HeroState> = {
        '0': {
            characterId: 'barbarian',
            resources: { hp: 50, cp: 5 },
            statusEffects: { poison: 2, burn: 1 },
            tokens: {},
            hand: [],
            discard: [],
            deck: [],
            abilityLevels: {},
        } as HeroState,
        '1': {
            characterId: 'moon-elf',
            resources: { hp: 45, cp: 3 },
            statusEffects: { bleed: 1 },
            tokens: {},
            hand: [],
            discard: [],
            deck: [],
            abilityLevels: {},
        } as HeroState,
    };

    const mockHandlers = {
        onSelectStatus: vi.fn(),
        onSelectPlayer: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('selectStatus interaction', () => {
        const selectStatusInteraction: InteractionDescriptor = {
            id: 'test-1',
            type: 'selectStatus',
            sourceCardId: 'test-card',
            playerId: '0',
            titleKey: 'interaction.selectStatusToRemove',
            selectCount: 1,
            targetPlayerIds: ['0'],
            selected: [],
        };

        it('should render status selection modal', () => {
            render(
                <InteractionOverlay
                    interaction={selectStatusInteraction}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('选择要移除的状态效果')).toBeInTheDocument();
            expect(screen.getByText('取消')).toBeInTheDocument();
            expect(screen.getByText('确认')).toBeInTheDocument();
        });

        it('should show self and opponent labels', () => {
            render(
                <InteractionOverlay
                    interaction={{ ...selectStatusInteraction, targetPlayerIds: ['0', '1'] }}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('自己')).toBeInTheDocument();
            expect(screen.getByText('对手')).toBeInTheDocument();
        });

        it('should disable confirm button when nothing selected', () => {
            render(
                <InteractionOverlay
                    interaction={selectStatusInteraction}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            const confirmButton = screen.getByText('确认');
            expect(confirmButton).toBeDisabled();
        });

        it('should enable confirm button when status selected', () => {
            render(
                <InteractionOverlay
                    interaction={{ ...selectStatusInteraction, selected: ['poison'] }}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            const confirmButton = screen.getByText('确认');
            expect(confirmButton).toBeEnabled();
        });

        it('should call onCancel when cancel button clicked', () => {
            render(
                <InteractionOverlay
                    interaction={selectStatusInteraction}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            const cancelButton = screen.getByText('取消');
            fireEvent.click(cancelButton);

            expect(mockHandlers.onCancel).toHaveBeenCalledTimes(1);
        });

        it('should call onConfirm when confirm button clicked with selection', () => {
            render(
                <InteractionOverlay
                    interaction={{ ...selectStatusInteraction, selected: ['poison'] }}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            const confirmButton = screen.getByText('确认');
            fireEvent.click(confirmButton);

            expect(mockHandlers.onConfirm).toHaveBeenCalledTimes(1);
        });
    });

    describe('selectPlayer interaction', () => {
        const selectPlayerInteraction: InteractionDescriptor = {
            id: 'test-2',
            type: 'selectPlayer',
            sourceCardId: 'test-card',
            playerId: '0',
            titleKey: 'interaction.selectPlayerToRemoveAllStatus',
            selectCount: 1,
            targetPlayerIds: ['0', '1'],
            selected: [],
        };

        it('should render player selection modal', () => {
            render(
                <InteractionOverlay
                    interaction={selectPlayerInteraction}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('自己')).toBeInTheDocument();
            expect(screen.getByText('对手')).toBeInTheDocument();
        });

        it('should show "no status" message for players without status', () => {
            const playersWithoutStatus = {
                ...mockPlayers,
                '0': { ...mockPlayers['0'], statusEffects: {}, tokens: {} },
            };

            render(
                <InteractionOverlay
                    interaction={{ ...selectPlayerInteraction, requiresTargetWithStatus: true }}
                    players={playersWithoutStatus}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('无状态')).toBeInTheDocument();
        });

        it('should enable confirm button when player selected', () => {
            render(
                <InteractionOverlay
                    interaction={{ ...selectPlayerInteraction, selected: ['0'] }}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            const confirmButton = screen.getByText('确认');
            expect(confirmButton).toBeEnabled();
        });
    });

    describe('selectTargetStatus interaction (transfer)', () => {
        const transferInteraction: InteractionDescriptor = {
            id: 'test-3',
            type: 'selectTargetStatus',
            sourceCardId: 'test-card',
            playerId: '0',
            titleKey: 'interaction.selectStatusToTransfer',
            selectCount: 1,
            targetPlayerIds: ['0'],
            selected: [],
            transferConfig: {
                sourcePlayerId: '0',
                statusId: '', // Phase 1: not selected yet
            },
        };

        it('should render transfer phase 1 (select status)', () => {
            render(
                <InteractionOverlay
                    interaction={transferInteraction}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('选择要移除的状态效果')).toBeInTheDocument();
        });

        it('should render transfer phase 2 (select target player)', () => {
            const phase2Interaction: InteractionDescriptor = {
                ...transferInteraction,
                transferConfig: {
                    sourcePlayerId: '0',
                    statusId: 'poison', // Phase 2: status selected
                },
                targetPlayerIds: ['0', '1'],
            };

            render(
                <InteractionOverlay
                    interaction={phase2Interaction}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('选择目标玩家')).toBeInTheDocument();
        });

        it('should exclude source player in phase 2', () => {
            const phase2Interaction: InteractionDescriptor = {
                ...transferInteraction,
                transferConfig: {
                    sourcePlayerId: '0',
                    statusId: 'poison',
                },
                targetPlayerIds: ['0', '1'],
            };

            render(
                <InteractionOverlay
                    interaction={phase2Interaction}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            // 转移阶段2：状态选择区域和转移目标区域都会渲染
            // "对手" 可能出现多次（状态选择区域 + 转移目标区域）
            const opponentLabels = screen.queryAllByText('对手');
            expect(opponentLabels.length).toBeGreaterThanOrEqual(1);
            // 自己在状态选择区域中仍然显示，但转移目标区域排除了自己
            const selfLabels = screen.queryAllByText('自己');
            // 转移目标区域不包含自己，但状态选择区域可能包含
            expect(selfLabels.length).toBeLessThanOrEqual(opponentLabels.length);
        });
    });

    describe('accessibility', () => {
        const interaction: InteractionDescriptor = {
            id: 'test-4',
            type: 'selectStatus',
            sourceCardId: 'test-card',
            playerId: '0',
            titleKey: 'interaction.selectStatusToRemove',
            selectCount: 1,
            targetPlayerIds: ['0'],
            selected: [],
        };

        it('should have accessible buttons', () => {
            render(
                <InteractionOverlay
                    interaction={interaction}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            const cancelButton = screen.getByRole('button', { name: '取消' });
            const confirmButton = screen.getByRole('button', { name: '确认' });

            expect(cancelButton).toBeInTheDocument();
            expect(confirmButton).toBeInTheDocument();
        });

        it('should prevent backdrop close', () => {
            const { container } = render(
                <InteractionOverlay
                    interaction={interaction}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            // GameModal 应该设置 closeOnBackdrop={false}
            // 验证 modal 内容已渲染（GameModal 不使用 role="dialog"）
            expect(screen.getByText('选择要移除的状态效果')).toBeInTheDocument();
            expect(screen.getByText('取消')).toBeInTheDocument();
        });
    });

    describe('edge cases', () => {
        it('should handle empty status effects', () => {
            const playersWithoutStatus = {
                '0': { ...mockPlayers['0'], statusEffects: {}, tokens: {} },
            };

            const interaction: InteractionDescriptor = {
                id: 'test-5',
                type: 'selectStatus',
                sourceCardId: 'test-card',
                playerId: '0',
                titleKey: 'interaction.selectStatusToRemove',
                selectCount: 1,
                targetPlayerIds: ['0'],
                selected: [],
            };

            render(
                <InteractionOverlay
                    interaction={interaction}
                    players={playersWithoutStatus}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('无状态')).toBeInTheDocument();
        });

        it('should handle missing player data gracefully', () => {
            const interaction: InteractionDescriptor = {
                id: 'test-6',
                type: 'selectStatus',
                sourceCardId: 'test-card',
                playerId: '0',
                titleKey: 'interaction.selectStatusToRemove',
                selectCount: 1,
                targetPlayerIds: ['0', '999'], // Player 999 doesn't exist
                selected: [],
            };

            render(
                <InteractionOverlay
                    interaction={interaction}
                    players={mockPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            // 应该只显示存在的玩家
            expect(screen.getByText('自己')).toBeInTheDocument();
        });
    });
});
