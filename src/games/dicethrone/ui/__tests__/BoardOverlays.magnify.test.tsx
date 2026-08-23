import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BoardOverlays, type BoardOverlaysProps } from '../BoardOverlays';

const abilityOverlaysSpy = vi.fn();
const cardSpotlightOverlaySpy = vi.fn();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../AbilityOverlays', () => ({
    AbilityOverlays: (props: {
        canSelect: boolean;
        canHighlight?: boolean;
        selectedAbilityId?: string;
        activatingAbilityId?: string;
        onSelectAbility: (abilityId: string) => void;
        onMagnifyCard?: unknown;
    }) => {
        abilityOverlaysSpy(props);
        return (
            <button
                type="button"
                data-testid="magnified-ability-overlay"
                onClick={() => props.onSelectAbility('merciless-plunder')}
            >
                magnified-ability-overlay
            </button>
        );
    },
}));

vi.mock('../../../components/common/media/CardPreview', () => ({
    CardPreview: () => <div data-testid="mock-card-preview" />,
}));

vi.mock('../../../components/common/media/OptimizedImage', () => ({
    OptimizedImage: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}));

vi.mock('../CardSpotlightOverlay', () => ({
    CardSpotlightOverlay: (props: unknown) => {
        cardSpotlightOverlaySpy(props);
        return null;
    },
}));

vi.mock('../../../components/game/framework/widgets/EndgameOverlay', () => ({
    EndgameOverlay: () => null,
}));

vi.mock('../../../components/game/framework/widgets/RematchActions', () => ({
    RematchActions: () => null,
}));

vi.mock('../DiceThroneEndgame', () => ({
    DiceThroneEndgameContent: () => null,
    renderDiceThroneButton: vi.fn(),
}));

vi.mock('../../../hooks/ui/useHorizontalDragScroll', () => ({
    useHorizontalDragScroll: () => ({
        ref: { current: null },
        dragProps: {},
    }),
}));

vi.mock('../abilitySlotLayout', async () => {
    const actual = await vi.importActual<typeof import('../abilitySlotLayout')>('../abilitySlotLayout');
    return {
        ...actual,
        getPlayerBoardAspectRatio: () => 1.6,
    };
});

describe('BoardOverlays 放大预览', () => {
    beforeEach(() => {
        abilityOverlaysSpy.mockClear();
        cardSpotlightOverlaySpy.mockClear();
    });

    const buildProps = (overrides: Partial<BoardOverlaysProps> = {}): BoardOverlaysProps => ({
        isMagnifyOpen: true,
        magnifiedImage: '/assets/dicethrone/player-board-monk.webp',
        magnifiedCard: null,
        magnifiedCards: [],
        onCloseMagnify: vi.fn(),
        availableAbilityIds: ['merciless-plunder'],
        canSelectAbility: true,
        canHighlightAbility: false,
        onSelectAbility: vi.fn(),
        onHighlightedAbilityClick: vi.fn(),
        selectedAbilityId: undefined,
        activatingAbilityId: undefined,
        abilityLevels: {},
        viewCharacterId: 'monk',
        viewPlayerBoardFace: 'normal',
        players: {} as BoardOverlaysProps['players'],
        currentPlayerId: '0',
        playerNames: {},
        seatingOrder: [],
        teamIdByPlayerId: {},
        cardSpotlightQueue: [],
        onCardSpotlightClose: vi.fn(),
        opponentHeaderRef: { current: null },
        isGameOver: false,
        gameoverResult: null,
        playerID: '0',
        reset: vi.fn(),
        rematchState: null,
        onRematchVote: vi.fn(),
        statusIconAtlas: null,
        locale: 'zh-CN',
        currentPhase: 'offensiveRoll',
        selectedCharacters: {} as BoardOverlaysProps['selectedCharacters'],
        hostPlayerId: '0',
        tutorialSpotlightAutoCloseDelayMs: undefined,
        ...overrides,
    });

    it('玩家面板放大态会复用技能槽点击并在选择后关闭预览', () => {
        const onSelectAbility = vi.fn();
        const onCloseMagnify = vi.fn();
        render(<BoardOverlays {...buildProps({ onSelectAbility, onCloseMagnify })} />);

        fireEvent.click(screen.getByTestId('magnified-ability-overlay'));

        expect(onSelectAbility).toHaveBeenCalledWith('merciless-plunder');
        expect(onCloseMagnify).toHaveBeenCalledTimes(1);

        const overlayProps = abilityOverlaysSpy.mock.lastCall?.[0];
        expect(overlayProps?.canSelect).toBe(true);
        expect(overlayProps?.onMagnifyCard).toBeUndefined();
    });

    it('玩家面板放大态会继续转发高亮与选中状态', () => {
        render(
            <BoardOverlays
                {...buildProps({
                    canHighlightAbility: true,
                    selectedAbilityId: 'merciless-plunder',
                    activatingAbilityId: 'merciless-plunder',
                })}
            />
        );

        const overlayProps = abilityOverlaysSpy.mock.lastCall?.[0];
        expect(overlayProps?.canHighlight).toBe(true);
        expect(overlayProps?.selectedAbilityId).toBe('merciless-plunder');
        expect(overlayProps?.activatingAbilityId).toBe('merciless-plunder');
    });

    it('关闭按钮保持绝对定位，不参与放大内容排版', () => {
        render(<BoardOverlays {...buildProps()} />);

        const closeButton = screen.getByRole('button', { name: 'actions.closePreview' });
        expect(closeButton.className).toContain('absolute');
        expect(closeButton.className).toContain('-top-12');
        expect(closeButton.className).toContain('right-0');
    });

    it('教程模式下会把牌面特写自动关闭延迟传给特写层', () => {
        render(
            <BoardOverlays
                {...buildProps({
                    isMagnifyOpen: false,
                    cardSpotlightQueue: [
                        {
                            id: 'card-spotlight-1',
                            cardId: 'ai-card',
                            timestamp: 1,
                            playerId: '1',
                        },
                    ],
                    tutorialSpotlightAutoCloseDelayMs: 3000,
                })}
            />
        );

        const spotlightProps = cardSpotlightOverlaySpy.mock.lastCall?.[0] as
            | { autoCloseDelay?: number }
            | undefined;
        expect(spotlightProps?.autoCloseDelay).toBe(3000);
    });
});
