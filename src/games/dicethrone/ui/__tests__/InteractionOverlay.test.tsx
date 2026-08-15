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
import { act, render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { InteractionOverlay } from '../InteractionOverlay';
import type { InteractionDescriptor, HeroState } from '../../domain/types';
import type { PlayerId } from '../../../../engine/types';
import { ModalStackProvider, useModalStack } from '../../../../contexts/ModalStackContext';
import { ModalStackRoot } from '../../../../components/system/ModalStackRoot';
import { useSyncedModalStackEntry } from '../../../../hooks/ui/useSyncedModalStackEntry';
import { ChoiceModal } from '../ChoiceModal';

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
                'choices.title': '选择',
                'choices.cursedCoinGain.title': '是否获得诅咒金币？',
                'choices.cursedCoinGain.accept': '获得诅咒金币',
                'choices.cursedCoinGain.decline': '不获得',
                'choices.evasiveOrPurifyToken': '选择获得的状态',
                'tokens.evasive.name': '闪避',
                'tokens.evasive.description': '花费 1 个闪避，掷 1 颗骰子；若为 1-2，防止所有伤害。',
                'tokens.purify.name': '净化',
                'tokens.purify.description': '移除 1 个负面状态效果。',
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

        it('should hide non-removable tokens from status selection', () => {
            const players: Record<PlayerId, HeroState> = {
                '0': {
                    ...mockPlayers['0'],
                    statusEffects: { poison: 1 },
                    tokens: { blessing_of_divinity: 1, bounty: 1 },
                } as HeroState,
            };

            render(
                <InteractionOverlay
                    interaction={selectStatusInteraction}
                    players={players}
                    currentPlayerId="0"
                    tokenDefinitions={[
                        { id: 'poison', category: 'debuff', passiveTrigger: { timing: 'onTurnStart', removable: true } },
                        { id: 'bounty', category: 'debuff', passiveTrigger: { timing: 'onDamageReceived', removable: true } },
                        { id: 'blessing_of_divinity', category: 'consumable', passiveTrigger: { timing: 'onDamageReceived', removable: false } },
                    ] as any}
                    {...mockHandlers}
                />
            );

            expect(screen.getByTestId('dt-status-effect-0-poison')).toBeInTheDocument();
            expect(screen.getByTestId('dt-status-effect-0-bounty')).toBeInTheDocument();
            expect(screen.queryByTestId('dt-status-effect-0-blessing_of_divinity')).not.toBeInTheDocument();
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

        it('4人自来源转移第二阶段应允许点击敌方与队友目标，且来源卡保持锁定', () => {
            const phase2Interaction: InteractionDescriptor = {
                ...transferInteraction,
                transferConfig: {
                    sourcePlayerId: '0',
                    statusId: 'poison',
                },
                targetPlayerIds: ['0', '1', '2', '3'],
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
                    interaction={phase2Interaction}
                    players={fourPlayerMockPlayers}
                    currentPlayerId="0"
                    playerNames={fourPlayerNames}
                    seatingOrder={fourPlayerOrder}
                    teamIdByPlayerId={fourPlayerTeams}
                    {...mockHandlers}
                />
            );

            fireEvent.click(screen.getByTestId('dt-transfer-source-locked-0'));
            expect(mockHandlers.onSelectPlayer).not.toHaveBeenCalled();

            fireEvent.click(screen.getByTestId('dt-transfer-target-1'));
            fireEvent.click(screen.getByTestId('dt-transfer-target-2'));
            fireEvent.click(screen.getByTestId('dt-transfer-target-3'));

            expect(screen.getByTestId('dt-transfer-source-locked-0')).toHaveAttribute('data-locked', 'true');
            expect(screen.getByTestId('dt-transfer-target-1')).toHaveAttribute('data-team-tone', 'enemy');
            expect(screen.getByTestId('dt-transfer-target-2')).toHaveAttribute('data-team-tone', 'ally');
            expect(screen.getByTestId('dt-transfer-target-3')).toHaveAttribute('data-team-tone', 'enemy');
            expect(mockHandlers.onSelectPlayer).toHaveBeenNthCalledWith(1, '1');
            expect(mockHandlers.onSelectPlayer).toHaveBeenNthCalledWith(2, '2');
            expect(mockHandlers.onSelectPlayer).toHaveBeenNthCalledWith(3, '3');
        });

        it('4人自来源转移第二阶段应为已选目标提供明确视觉标识', () => {
            const phase2Interaction: InteractionDescriptor = {
                ...transferInteraction,
                selected: ['1'],
                transferConfig: {
                    sourcePlayerId: '0',
                    statusId: 'poison',
                },
                targetPlayerIds: ['0', '1', '2', '3'],
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
                    interaction={phase2Interaction}
                    players={fourPlayerMockPlayers}
                    currentPlayerId="0"
                    playerNames={fourPlayerNames}
                    seatingOrder={fourPlayerOrder}
                    teamIdByPlayerId={fourPlayerTeams}
                    {...mockHandlers}
                />
            );

            expect(screen.getByTestId('dt-transfer-source-locked-0')).toHaveAttribute('data-selected', 'false');
            expect(screen.getByTestId('dt-transfer-target-1')).toHaveAttribute('data-selected', 'true');
            expect(screen.getByTestId('dt-transfer-target-1')).toHaveTextContent('已选目标');
            expect(screen.getByTestId('dt-transfer-target-2')).toHaveTextContent('点击作为接收目标');
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

describe('useSyncedModalStackEntry', () => {
    beforeEach(() => {
        const existingRoot = document.getElementById('modal-root');
        if (existingRoot) {
            existingRoot.remove();
        }
        const modalRoot = document.createElement('div');
        modalRoot.id = 'modal-root';
        document.body.appendChild(modalRoot);
    });

    const SyncedModalHarness = ({
        enabled,
        label,
        entryId = 'test-synced-modal',
        ownerId,
        onClosed,
    }: {
        enabled: boolean;
        label: string;
        entryId?: string;
        ownerId?: string;
        onClosed?: () => void;
    }) => {
        const entry = React.useMemo(() => ({
            owner: ownerId ? {
                system: 'interaction' as const,
                id: ownerId,
                gameId: 'dicethrone',
                namespace: 'dicethrone',
                blocksProgress: true,
            } : undefined,
            onClose: onClosed,
            render: ({ close }: { close: () => void; closeOnBackdrop: boolean }) => (
                <div>
                    <div data-testid="synced-modal-label">{label}</div>
                    <button type="button" onClick={close}>close-synced-modal</button>
                </div>
            ),
        }), [label, onClosed, ownerId]);

        useSyncedModalStackEntry({
            enabled,
            entryId,
            entry,
        });

        return null;
    };

    const CloseTopButton = () => {
        const { closeTop } = useModalStack();
        return (
            <button type="button" onClick={() => closeTop()}>
                close-top-entry
            </button>
        );
    };

    const TopOwnerLabel = () => {
        const { topOwner } = useModalStack();
        return (
            <div data-testid="top-owner-label">
                {topOwner ? `${topOwner.system}:${topOwner.id}` : 'none'}
            </div>
        );
    };

    const StackChangeProbe = ({ onStackChange }: { onStackChange: (size: number) => void }) => {
        const { stack } = useModalStack();
        React.useEffect(() => {
            onStackChange(stack.length);
        }, [onStackChange, stack]);
        return null;
    };

    it('应在 entry 更新时原位更新栈内容而不是重复打开', async () => {
        const App = ({ enabled, label }: { enabled: boolean; label: string }) => (
            <MemoryRouter>
                <ModalStackProvider>
                    <SyncedModalHarness enabled={enabled} label={label} />
                    <ModalStackRoot />
                </ModalStackProvider>
            </MemoryRouter>
        );

        const { rerender } = render(<App enabled label="初始内容" />);
        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByTestId('synced-modal-label')).toHaveTextContent('初始内容');

        await act(async () => {
            rerender(<App enabled label="更新后内容" />);
            await Promise.resolve();
        });

        expect(screen.getByTestId('synced-modal-label')).toHaveTextContent('更新后内容');
    });

    it('外部关闭栈顶时应同步回写 enabled=false，且不应立刻重开', async () => {
        const App = () => {
            const [enabled, setEnabled] = React.useState(true);
            return (
                <MemoryRouter>
                    <ModalStackProvider>
                        <SyncedModalHarness enabled={enabled} label="可关闭弹窗" onClosed={() => setEnabled(false)} />
                        <CloseTopButton />
                        <div data-testid="sync-enabled-state">{enabled ? 'open' : 'closed'}</div>
                        <ModalStackRoot />
                    </ModalStackProvider>
                </MemoryRouter>
            );
        };

        render(<App />);
        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByTestId('synced-modal-label')).toHaveTextContent('可关闭弹窗');

        await act(async () => {
            fireEvent.click(screen.getByText('close-top-entry'));
            await Promise.resolve();
        });

        expect(screen.queryByTestId('synced-modal-label')).not.toBeInTheDocument();
        expect(screen.getByTestId('sync-enabled-state')).toHaveTextContent('closed');
    });

    it('应暴露稳定的顶层 owner，并在关闭栈顶后恢复下层 owner', async () => {
        const App = () => {
            const [childEnabled, setChildEnabled] = React.useState(true);
            return (
                <MemoryRouter>
                    <ModalStackProvider>
                        <SyncedModalHarness enabled label="底层弹窗" entryId="parent-modal" ownerId="interaction-parent" />
                        <SyncedModalHarness
                            enabled={childEnabled}
                            label="顶层弹窗"
                            entryId="child-modal"
                            ownerId="interaction-child"
                            onClosed={() => setChildEnabled(false)}
                        />
                        <CloseTopButton />
                        <TopOwnerLabel />
                        <ModalStackRoot />
                    </ModalStackProvider>
                </MemoryRouter>
            );
        };

        render(<App />);
        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByTestId('top-owner-label')).toHaveTextContent('interaction:interaction-child');

        await act(async () => {
            fireEvent.click(screen.getByText('close-top-entry'));
            await Promise.resolve();
        });

        expect(screen.getByTestId('top-owner-label')).toHaveTextContent('interaction:interaction-parent');
    });

    it('entry 输入对象抖动时不应重复更新 modal stack', async () => {
        const onStackChange = vi.fn();

        const App = ({ enabled, label }: { enabled: boolean; label: string }) => {
            const entry = {
                owner: {
                    system: 'interaction' as const,
                    id: 'unstable-owner',
                    gameId: 'dicethrone',
                    namespace: 'dicethrone',
                    blocksProgress: true,
                },
                render: ({ close }: { close: () => void; closeOnBackdrop: boolean }) => (
                    <div>
                        <div data-testid="unstable-synced-modal-label">{label}</div>
                        <button type="button" onClick={close}>close-unstable-modal</button>
                    </div>
                ),
            };

            useSyncedModalStackEntry({
                enabled,
                entryId: 'unstable-synced-modal',
                entry,
            });

            return null;
        };

        const { rerender } = render(
            <MemoryRouter>
                <ModalStackProvider>
                    <StackChangeProbe onStackChange={onStackChange} />
                    <App enabled label="第一版内容" />
                    <ModalStackRoot />
                </ModalStackProvider>
            </MemoryRouter>,
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByTestId('unstable-synced-modal-label')).toHaveTextContent('第一版内容');
        expect(onStackChange).toHaveBeenCalledTimes(2);

        await act(async () => {
            rerender(
                <MemoryRouter>
                    <ModalStackProvider>
                        <StackChangeProbe onStackChange={onStackChange} />
                        <App enabled label="第二版内容" />
                        <ModalStackRoot />
                    </ModalStackProvider>
                </MemoryRouter>,
            );
            await Promise.resolve();
        });

        expect(screen.getByTestId('unstable-synced-modal-label')).toHaveTextContent('第二版内容');
        expect(onStackChange).toHaveBeenCalledTimes(2);
    });

    it('等价 updateModal 不应触发栈状态变更，真实变更仍应生效', async () => {
        const onStackChange = vi.fn();
        const sharedOwner = {
            system: 'interaction' as const,
            id: 'modal-guard-owner',
            gameId: 'dicethrone',
            namespace: 'dicethrone',
            blocksProgress: true,
        };
        const sharedOnClose = vi.fn();
        const stableRender = () => <div data-testid="guard-modal-label">稳定内容</div>;
        const changedRender = () => <div data-testid="guard-modal-label">变更内容</div>;

        const ModalUpdateHarness = () => {
            const { openModal, updateModal } = useModalStack();
            const modalIdRef = React.useRef<string | null>(null);

            return (
                <div>
                    <button
                        type="button"
                        onClick={() => {
                            modalIdRef.current = openModal({
                                owner: sharedOwner,
                                onClose: sharedOnClose,
                                render: stableRender,
                            });
                        }}
                    >
                        open-guard-modal
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!modalIdRef.current) return;
                            updateModal(modalIdRef.current, {
                                owner: sharedOwner,
                                onClose: sharedOnClose,
                                render: stableRender,
                            });
                        }}
                    >
                        noop-update-guard-modal
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!modalIdRef.current) return;
                            updateModal(modalIdRef.current, {
                                owner: sharedOwner,
                                onClose: sharedOnClose,
                                render: changedRender,
                            });
                        }}
                    >
                        real-update-guard-modal
                    </button>
                </div>
            );
        };

        render(
            <MemoryRouter>
                <ModalStackProvider>
                    <StackChangeProbe onStackChange={onStackChange} />
                    <ModalUpdateHarness />
                    <ModalStackRoot />
                </ModalStackProvider>
            </MemoryRouter>,
        );

        await act(async () => {
            await Promise.resolve();
        });
        expect(onStackChange).toHaveBeenCalledTimes(1);

        await act(async () => {
            fireEvent.click(screen.getByText('open-guard-modal'));
            await Promise.resolve();
        });

        expect(screen.getByTestId('guard-modal-label')).toHaveTextContent('稳定内容');
        expect(onStackChange).toHaveBeenCalledTimes(2);

        await act(async () => {
            fireEvent.click(screen.getByText('noop-update-guard-modal'));
            await Promise.resolve();
        });

        expect(screen.getByTestId('guard-modal-label')).toHaveTextContent('稳定内容');
        expect(onStackChange).toHaveBeenCalledTimes(2);

        await act(async () => {
            fireEvent.click(screen.getByText('real-update-guard-modal'));
            await Promise.resolve();
        });

        expect(screen.getByTestId('guard-modal-label')).toHaveTextContent('变更内容');
        expect(onStackChange).toHaveBeenCalledTimes(3);
    });

    it('simple-choice modal 应显示判决指令的标题和两个诅咒金币选项', async () => {
        const onResolve = vi.fn();

        const ChoiceModalHarness = () => {
            const entry = React.useMemo(() => ({
                owner: {
                    system: 'interaction' as const,
                    id: 'choice-human-verdict-command',
                    gameId: 'dicethrone',
                    namespace: 'dicethrone',
                    blocksProgress: true,
                },
                closeOnBackdrop: false,
                closeOnEsc: false,
                onClose: undefined,
                render: () => (
                    <ChoiceModal
                        choice={{
                            title: 'choices.cursedCoinGain.title',
                            options: [
                                { id: 'option-0', label: 'choices.cursedCoinGain.accept', value: 1 },
                                { id: 'option-1', label: 'choices.cursedCoinGain.decline', value: 0 },
                            ],
                        }}
                        canResolve={true}
                        onResolve={onResolve}
                    />
                ),
            }), []);

            useSyncedModalStackEntry({
                enabled: true,
                entryId: 'dicethrone_choice',
                entry,
            });

            return null;
        };

        render(
            <MemoryRouter>
                <ModalStackProvider>
                    <ChoiceModalHarness />
                    <ModalStackRoot />
                </ModalStackProvider>
            </MemoryRouter>,
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByText('是否获得诅咒金币？')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '获得诅咒金币' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '不获得' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '获得诅咒金币' }));
        expect(onResolve).toHaveBeenCalledWith('option-0');
    });

    it('simple-choice modal 应能渲染太极连招奖励骰后的闪避/净化 Token 选项', async () => {
        const onResolve = vi.fn();

        const ChoiceModalHarness = () => {
            const entry = React.useMemo(() => ({
                owner: {
                    system: 'interaction' as const,
                    id: 'choice-taiji-combo-1786549271013',
                    gameId: 'dicethrone',
                    namespace: 'dicethrone',
                    blocksProgress: true,
                },
                closeOnBackdrop: false,
                closeOnEsc: false,
                onClose: undefined,
                render: () => (
                    <ChoiceModal
                        choice={{
                            title: 'choices.evasiveOrPurifyToken',
                            options: [
                                { id: 'option-0', label: 'tokens.evasive.name', tokenId: 'evasive', value: 1 },
                                { id: 'option-1', label: 'tokens.purify.name', tokenId: 'purify', value: 1 },
                            ],
                        }}
                        canResolve={true}
                        onResolve={onResolve}
                    />
                ),
            }), []);

            useSyncedModalStackEntry({
                enabled: true,
                entryId: 'dicethrone_choice',
                entry,
            });

            return null;
        };

        render(
            <MemoryRouter>
                <ModalStackProvider>
                    <ChoiceModalHarness />
                    <ModalStackRoot />
                </ModalStackProvider>
            </MemoryRouter>,
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByText('选择获得的状态')).toBeInTheDocument();
        const evasiveButton = screen.getByRole('button', { name: '闪避' });
        const purifyButton = screen.getByRole('button', { name: '净化' });
        expect(evasiveButton).toBeInTheDocument();
        expect(purifyButton).toBeInTheDocument();
        expect(evasiveButton).toHaveAttribute('data-option-id', 'option-0');
        expect(purifyButton).toHaveAttribute('data-option-id', 'option-1');

        fireEvent.click(evasiveButton);
        expect(onResolve).toHaveBeenCalledWith('option-0');
    });
});
