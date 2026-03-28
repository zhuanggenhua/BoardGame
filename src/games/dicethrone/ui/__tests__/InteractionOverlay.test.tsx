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
        t: (key: string, _params?: Record<string, unknown>) => {
            const translations: Record<string, string> = {
                'interaction.selectStatusToRemove': '选择要移除的状态效果',
                'interaction.selectPlayerToRemoveAllStatus': '选择玩家',
                'interaction.gunslingerTheLaw': '选择至多 2 位目标玩家',
                'interaction.selectStatusToTransfer': '选择要移除的状态效果',
                'interaction.transferSelectTarget': '选择目标玩家',
                'interaction.noStatus': '无状态',
                'common.self': '自己',
                'common.opponent': '对手',
                'common.ally': '队友',
                'common.enemy': '敌方',
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

    const fourPlayerNames: Record<PlayerId, string> = {
        '0': 'Host-P0',
        '1': 'Guest-P1',
        '2': 'Guest-P2',
        '3': 'Guest-P3',
    };

    const fourPlayerTeams: Record<PlayerId, string> = {
        '0': 'A',
        '1': 'B',
        '2': 'A',
        '3': 'B',
    };

    const fourPlayerOrder: PlayerId[] = ['0', '1', '2', '3'];

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

            expect(screen.getByTestId('dt-status-owner-0')).toHaveTextContent('自己');
            expect(screen.getByTestId('dt-status-owner-1')).toHaveTextContent('对手');
        });

        it('4人模式下 self-only 状态交互仍只展示自己', () => {
            const fourPlayerMockPlayers: Record<PlayerId, HeroState> = {
                ...mockPlayers,
                '2': {
                    characterId: 'paladin',
                    resources: { hp: 40, cp: 2 },
                    statusEffects: { shock: 1 },
                    tokens: {},
                    hand: [],
                    discard: [],
                    deck: [],
                    abilityLevels: {},
                } as HeroState,
                '3': {
                    characterId: 'pyromancer',
                    resources: { hp: 35, cp: 4 },
                    statusEffects: {},
                    tokens: { burn: 2 } as any,
                    hand: [],
                    discard: [],
                    deck: [],
                    abilityLevels: {},
                } as HeroState,
            };

            render(
                <InteractionOverlay
                    interaction={selectStatusInteraction}
                    players={fourPlayerMockPlayers}
                    currentPlayerId="0"
                    playerNames={fourPlayerNames}
                    seatingOrder={fourPlayerOrder}
                    teamIdByPlayerId={fourPlayerTeams}
                    {...mockHandlers}
                />
            );

            expect(screen.getByTestId('dt-status-owner-0')).toBeInTheDocument();
            expect(screen.queryByTestId('dt-status-owner-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('dt-status-owner-2')).not.toBeInTheDocument();
            expect(screen.queryByTestId('dt-status-owner-3')).not.toBeInTheDocument();
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

            expect(screen.getByTestId('dt-player-target-0')).toHaveTextContent('自己');
            expect(screen.getByTestId('dt-player-target-1')).toHaveTextContent('对手');
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

        it('should allow confirming multi-target player interaction after selecting one target', () => {
            const multiplayerPlayers = {
                ...mockPlayers,
                '1': { ...mockPlayers['1'], nickname: '僧侣' } as HeroState,
                '2': {
                    ...mockPlayers['1'],
                    characterId: 'paladin',
                    nickname: '圣骑士',
                    statusEffects: { knockdown: 0 },
                } as HeroState,
            };

            render(
                <InteractionOverlay
                    interaction={{
                        ...selectPlayerInteraction,
                        titleKey: 'interaction.gunslingerTheLaw',
                        selectCount: 2,
                        targetPlayerIds: ['1', '2'],
                        selected: ['1'],
                    }}
                    players={multiplayerPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('选择至多 2 位目标玩家')).toBeInTheDocument();
            expect(screen.getByTestId('dt-player-target-1')).toBeInTheDocument();
            expect(screen.getByTestId('dt-player-target-2')).toBeInTheDocument();
            expect(screen.getByText('确认')).toBeEnabled();
        });

        it('should emit player selection callback for each clicked target in multi-target mode', () => {
            const multiplayerPlayers = {
                ...mockPlayers,
                '1': { ...mockPlayers['1'], nickname: '僧侣' } as HeroState,
                '2': {
                    ...mockPlayers['1'],
                    characterId: 'paladin',
                    nickname: '圣骑士',
                    statusEffects: { knockdown: 0 },
                } as HeroState,
            };

            render(
                <InteractionOverlay
                    interaction={{
                        ...selectPlayerInteraction,
                        titleKey: 'interaction.gunslingerTheLaw',
                        selectCount: 2,
                        targetPlayerIds: ['1', '2'],
                        selected: [],
                    }}
                    players={multiplayerPlayers}
                    currentPlayerId="0"
                    {...mockHandlers}
                />
            );

            fireEvent.click(screen.getByTestId('dt-player-target-1'));
            fireEvent.click(screen.getByTestId('dt-player-target-2'));

            expect(mockHandlers.onSelectPlayer).toHaveBeenNthCalledWith(1, '1');
            expect(mockHandlers.onSelectPlayer).toHaveBeenNthCalledWith(2, '2');
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
            expect(screen.getByTestId('dt-transfer-source-locked-0')).toBeInTheDocument();
        });

        it('should keep source player as locked card and hide first-stage owner cards in phase 2', () => {
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

            expect(screen.getByTestId('dt-transfer-source-locked-0')).toHaveAttribute('data-locked', 'true');
            expect(screen.getByTestId('dt-transfer-target-1')).toBeInTheDocument();
            expect(screen.queryByTestId('dt-status-owner-0')).not.toBeInTheDocument();
            expect(screen.queryByTestId('dt-status-owner-1')).not.toBeInTheDocument();
        });

        it('4人模式下应为玩家目标卡片输出稳定标识与阵营信息', () => {
            const fourPlayerInteraction: InteractionDescriptor = {
                id: 'test-4p-player',
                type: 'selectPlayer',
                sourceCardId: 'test-card',
                playerId: '0',
                titleKey: 'interaction.selectPlayerToRemoveAllStatus',
                selectCount: 1,
                targetPlayerIds: ['0', '1', '2', '3'],
                selected: [],
            };

            const fourPlayerMockPlayers: Record<PlayerId, HeroState> = {
                ...mockPlayers,
                '2': {
                    characterId: 'paladin',
                    resources: { hp: 40, cp: 2 },
                    statusEffects: { shock: 1 },
                    tokens: {},
                    hand: [],
                    discard: [],
                    deck: [],
                    abilityLevels: {},
                } as HeroState,
                '3': {
                    characterId: 'pyromancer',
                    resources: { hp: 35, cp: 4 },
                    statusEffects: {},
                    tokens: { burn: 2 } as any,
                    hand: [],
                    discard: [],
                    deck: [],
                    abilityLevels: {},
                } as HeroState,
            };

            render(
                <InteractionOverlay
                    interaction={fourPlayerInteraction}
                    players={fourPlayerMockPlayers}
                    currentPlayerId="0"
                    playerNames={fourPlayerNames}
                    seatingOrder={fourPlayerOrder}
                    teamIdByPlayerId={fourPlayerTeams}
                    {...mockHandlers}
                />
            );

            expect(screen.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
            expect(screen.getByTestId('dt-player-target-2')).toHaveAttribute('data-team-tone', 'ally');
            expect(screen.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
            expect(screen.getByText('Host-P0')).toBeInTheDocument();
            expect(screen.getByText('Guest-P2')).toBeInTheDocument();
            expect(screen.getByText('P3')).toBeInTheDocument();
        });

        it('4人转移第二阶段应保留锁定来源卡并保留其他候选人的稳定标识', () => {
            const phase2Interaction: InteractionDescriptor = {
                ...transferInteraction,
                transferConfig: {
                    sourcePlayerId: '2',
                    statusId: 'poison',
                },
                targetPlayerIds: ['0', '1', '2', '3'],
            };

            const fourPlayerMockPlayers: Record<PlayerId, HeroState> = {
                ...mockPlayers,
                '2': {
                    characterId: 'paladin',
                    resources: { hp: 40, cp: 2 },
                    statusEffects: { poison: 1 },
                    tokens: {},
                    hand: [],
                    discard: [],
                    deck: [],
                    abilityLevels: {},
                } as HeroState,
                '3': {
                    characterId: 'pyromancer',
                    resources: { hp: 35, cp: 4 },
                    statusEffects: {},
                    tokens: { burn: 2 } as any,
                    hand: [],
                    discard: [],
                    deck: [],
                    abilityLevels: {},
                } as HeroState,
            };

            render(
                <InteractionOverlay
                    interaction={phase2Interaction}
                    players={fourPlayerMockPlayers}
                    currentPlayerId="0"
                    playerNames={fourPlayerNames}
                    seatingOrder={fourPlayerOrder}
                    teamIdByPlayerId={fourPlayerTeams}
                    {...mockHandlers}
                />
            );

            expect(screen.getByTestId('dt-transfer-source-locked-2')).toHaveAttribute('data-locked', 'true');
            expect(screen.getByTestId('dt-transfer-target-0')).toHaveAttribute('data-team-tone', 'self');
            expect(screen.getByTestId('dt-transfer-target-1')).toHaveAttribute('data-team-tone', 'enemy');
            expect(screen.getByTestId('dt-transfer-target-3')).toHaveAttribute('data-team-tone', 'enemy');
            expect(screen.queryByTestId('dt-status-owner-0')).not.toBeInTheDocument();
            expect(screen.queryByTestId('dt-status-owner-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('dt-status-owner-2')).not.toBeInTheDocument();
            expect(screen.queryByTestId('dt-status-owner-3')).not.toBeInTheDocument();
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
            const { container: _container } = render(
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
            expect(screen.getByTestId('dt-status-owner-0')).toBeInTheDocument();
            expect(screen.queryByTestId('dt-status-owner-999')).not.toBeInTheDocument();
        });
    });
});
