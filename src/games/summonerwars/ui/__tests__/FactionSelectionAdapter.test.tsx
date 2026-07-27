/**
 * FactionSelectionAdapter 组件单元测试
 * 
 * 测试覆盖：
 * - 正确加载自定义牌组列表
 * - 阵营选择区按 2x4 槽位分页
 * - 卡片顺序正确（默认阵营 → 自定义牌组（最多1个） → "+"按钮）
 * - "+"按钮始终显示（有牌组时显示"更多"，无牌组时显示"新建"）
 * - 选择自定义牌组后状态更新
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FactionSelection } from '../FactionSelectionAdapter';
import type { SavedDeckSummary } from '../../../../api/custom-deck';
import type { TFunction } from 'i18next';

const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
};

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: ((key: string) => key) as TFunction,
    i18n: { language: 'zh-CN' },
  }),
}));

vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ token: 'mock-token' })),
}));

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: vi.fn(() => ({
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  })),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, style, initial, animate, exit, transition, whileHover, whileTap, layoutId, ...rest }: any) => (
      <div {...rest} className={className} onClick={onClick} style={style}>
        {children}
      </div>
    ),
    button: ({ children, className, onClick, style, initial, animate, exit, transition, whileHover, whileTap, layoutId, ...rest }: any) => (
      <button {...rest} className={className} onClick={onClick} style={style}>
        {children}
      </button>
    ),
    h1: ({ children, className, style, initial, animate, exit, transition, whileHover, whileTap, layoutId, ...rest }: any) => (
      <h1 {...rest} className={className} style={style}>{children}</h1>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('../CardSprite', () => ({
  CardSprite: ({ atlasId }: { atlasId: string }) => (
    <div data-testid="card-sprite" data-atlas-id={atlasId}>
      Mock CardSprite
    </div>
  ),
}));

vi.mock('../../../common/media/OptimizedImage', () => ({
  OptimizedImage: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="optimized-image" />
  ),
}));

vi.mock('../../../common/overlays/MagnifyOverlay', () => ({
  MagnifyOverlay: ({ isOpen, children }: any) => (
    isOpen ? <div data-testid="magnify-overlay">{children}</div> : null
  ),
}));

vi.mock('../DeckBuilderDrawer', () => ({
  DeckBuilderDrawer: ({ isOpen }: any) => (
    isOpen ? <div data-testid="deck-builder-drawer">Deck Builder</div> : null
  ),
}));

vi.mock('../CustomDeckCard', () => ({
  CustomDeckCard: ({ deck, onSelect, onEdit }: any) => (
    <div data-testid={`custom-deck-card-${deck.id}`}>
      <span>{deck.name}</span>
      <button onClick={onSelect} data-testid={`select-${deck.id}`}>Select</button>
      <button onClick={() => onEdit(deck.id)} data-testid={`edit-${deck.id}`}>Edit</button>
    </div>
  ),
}));

vi.mock('../cardAtlas', () => ({
  initSpriteAtlases: vi.fn(),
  getSpriteAtlasSource: vi.fn(() => ({ image: '/mock-image.png' })),
  getFactionAtlasId: vi.fn(() => 'mock-atlas-id'),
}));

vi.mock('../helpers/customDeckHelpers', () => ({
  getSummonerAtlasIdByFaction: vi.fn((factionId: string) => `sw:${factionId}:hero`),
}));

vi.mock('../../../../hooks/ui/useRuntimeViewport', () => ({
  useRuntimeViewport: vi.fn(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    keyboardInsetBottom: 0,
  })),
}));

// Mock API
const mockListCustomDecks = vi.fn();
const mockGetCustomDeck = vi.fn();

vi.mock('../../../../api/custom-deck', () => ({
  listCustomDecks: (...args: any[]) => mockListCustomDecks(...args),
  getCustomDeck: (...args: any[]) => mockGetCustomDeck(...args),
}));

describe('FactionSelection', () => {
  const defaultProps = {
    isOpen: true,
    currentPlayerId: '0' as any,
    hostPlayerId: '0' as any,
    selectedFactions: { '0': 'unselected' as any, '1': 'unselected' as any },
    readyPlayers: { '0': false, '1': false },
    playerNames: { '0': 'Player 1', '1': 'Player 2' },
    onSelect: vi.fn(),
    onReady: vi.fn(),
    onStart: vi.fn(),
    onSelectCustomDeck: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setViewportSize(1280, 720);
    mockListCustomDecks.mockResolvedValue([]);
    mockGetCustomDeck.mockResolvedValue({
      id: 'deck-1',
      name: 'Test Deck',
      summonerFaction: 'phoenix_elves',
      summonerId: 'summoner-1',
    });
  });

  it('应该在 isOpen=false 时不渲染', () => {
    const { container } = render(
      <FactionSelection {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('应该在 isOpen=true 时渲染', () => {
    render(<FactionSelection {...defaultProps} />);
    expect(screen.getByText('factionSelection.title')).toBeInTheDocument();
  });

  it('预览占位卡应提供显式宽高，兼容旧 WebView', async () => {
    render(<FactionSelection {...defaultProps} />);

    const placeholder = await screen.findByText('factionSelection.hoverToPreview');
    const frame = placeholder.parentElement as HTMLElement | null;

    expect(frame?.style.height).toBeTruthy();
    expect(frame?.style.width).toContain('4 / 3');
    expect(frame?.style.aspectRatio).toBe('4 / 3');
  });

  it('应该加载自定义牌组列表', async () => {
    const mockDecks: SavedDeckSummary[] = [
      {
        id: 'deck-1',
        name: '我的牌组1',
        summonerFaction: 'phoenix_elves' as any,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ];
    mockListCustomDecks.mockResolvedValue(mockDecks);

    render(<FactionSelection {...defaultProps} />);

    await waitFor(() => {
      expect(mockListCustomDecks).toHaveBeenCalledWith('mock-token');
    });

    await waitFor(() => {
      expect(screen.getByTestId('custom-deck-card-deck-1')).toBeInTheDocument();
    });
  });

  it('应该只显示第一个自定义牌组', async () => {
    const mockDecks: SavedDeckSummary[] = [
      {
        id: 'deck-1',
        name: '牌组1',
        summonerFaction: 'phoenix_elves' as any,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
      {
        id: 'deck-2',
        name: '牌组2',
        summonerFaction: 'tundra_orcs' as any,
        createdAt: '2024-01-02',
        updatedAt: '2024-01-02',
      },
      {
        id: 'deck-3',
        name: '牌组3',
        summonerFaction: 'guild_dwarves' as any,
        createdAt: '2024-01-03',
        updatedAt: '2024-01-03',
      },
    ];
    mockListCustomDecks.mockResolvedValue(mockDecks);

    render(<FactionSelection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('custom-deck-card-deck-1')).toBeInTheDocument();
      expect(screen.queryByTestId('custom-deck-card-deck-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('custom-deck-card-deck-3')).not.toBeInTheDocument();
    });
  });

  it('应该在有自定义牌组时显示"更多牌组"按钮', async () => {
    const mockDecks: SavedDeckSummary[] = [
      {
        id: 'deck-1',
        name: '牌组1',
        summonerFaction: 'phoenix_elves' as any,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ];
    mockListCustomDecks.mockResolvedValue(mockDecks);

    render(<FactionSelection {...defaultProps} />);

    await waitFor(() => {
      // 当有牌组时，显示"更多牌组"按钮
      expect(screen.getByText('factionSelection.moreDeck')).toBeInTheDocument();
    });
  });

  it('应该在没有自定义牌组时显示"新建牌组"按钮', async () => {
    mockListCustomDecks.mockResolvedValue([]);

    render(<FactionSelection {...defaultProps} />);

    await waitFor(() => {
      expect(mockListCustomDecks).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('factionSelection.newDeck')).toBeInTheDocument();
    });
  });

  it('应该按 2x4 槽位显示第一页阵营与牌组入口', () => {
    const { container } = render(<FactionSelection {...defaultProps} />);
    
    const gridContainer = screen.getByTestId('sw-faction-grid');
    const pagerContainer = screen.getByTestId('sw-faction-pager');
    expect(pagerContainer.getAttribute('style')).toContain('calc(var(--sw-selection-inline-unit) * 72)');
    expect(pagerContainer.getAttribute('style')).toContain('clamp(44px');
    expect(gridContainer).toBeInTheDocument();
    expect(gridContainer).toHaveClass('grid-cols-4');
    expect(gridContainer).toHaveAttribute('data-grid-capacity', '8');
    expect(gridContainer).toHaveAttribute('data-page', '1');
    expect(gridContainer).toHaveAttribute('data-page-count', '2');
    expect(container.querySelectorAll('[data-testid^="sw-faction-card-"][data-faction-id]').length).toBe(7);
    expect(screen.queryAllByTestId('sw-faction-grid-placeholder')).toHaveLength(0);
    expect(screen.getByTestId('sw-custom-deck-entry')).toBeInTheDocument();
    expect(Array.from(gridContainer.children).at(-1)).toBe(screen.getByTestId('sw-custom-deck-entry'));
    expect(screen.queryByTestId('sw-faction-card-huijin')).not.toBeInTheDocument();
  });

  it('应该通过左右翻页按钮切换后续阵营', () => {
    render(<FactionSelection {...defaultProps} />);

    const previousButton = screen.getByTestId('sw-faction-page-prev');
    const nextButton = screen.getByTestId('sw-faction-page-next');

    expect(previousButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
    expect(screen.queryByTestId('sw-faction-card-huijin')).not.toBeInTheDocument();

    fireEvent.click(nextButton);

    expect(screen.getByTestId('sw-faction-grid')).toHaveAttribute('data-page', '2');
    expect(screen.getByTestId('sw-faction-card-huijin')).toBeInTheDocument();
    expect(screen.queryByTestId('sw-faction-card-necromancer')).not.toBeInTheDocument();
    expect(screen.getByTestId('sw-custom-deck-entry')).toBeInTheDocument();
    expect(screen.queryAllByTestId('sw-faction-grid-placeholder')).toHaveLength(4);
    expect(Array.from(screen.getByTestId('sw-faction-grid').children)).toHaveLength(8);
    expect(Array.from(screen.getByTestId('sw-faction-grid').children).at(-1)).toBe(screen.getByTestId('sw-custom-deck-entry'));

    fireEvent.click(screen.getByTestId('sw-faction-page-prev'));

    expect(screen.getByTestId('sw-faction-grid')).toHaveAttribute('data-page', '1');
    expect(screen.getByTestId('sw-faction-card-necromancer')).toBeInTheDocument();
  });

  it('应该在加载牌组列表失败时显示错误提示', async () => {
    const mockToast = vi.fn();
    const { useToast } = await import('../../../../contexts/ToastContext');
    (useToast as any).mockReturnValue({
      error: mockToast,
      success: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    });

    mockListCustomDecks.mockRejectedValue(new Error('Network error'));

    render(<FactionSelection {...defaultProps} />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'i18n',
          key: 'factionSelection.loadDeckFailed',
        }),
        undefined,
        expect.objectContaining({
          dedupeKey: 'load-deck-list-failed',
        })
      );
    });
  });

  it('应该渲染默认阵营卡片', () => {
    render(<FactionSelection {...defaultProps} />);
    
    // 应该有多个 CardSprite（默认阵营）
    const sprites = screen.getAllByTestId('card-sprite');
    expect(sprites.length).toBeGreaterThan(0);
  });

  it('应该显示玩家状态区', () => {
    render(<FactionSelection {...defaultProps} />);
    
    expect(screen.getByText('Player 1')).toBeInTheDocument();
    expect(screen.getByText('Player 2')).toBeInTheDocument();
  });

  it('应该在 host 且全员就绪时显示开始按钮', () => {
    render(
      <FactionSelection
        {...defaultProps}
        selectedFactions={{
          '0': 'phoenix_elves' as any,
          '1': 'tundra_orcs' as any,
        }}
        readyPlayers={{ '0': false, '1': true }}
      />
    );

    expect(screen.getByText('factionSelection.start')).toBeInTheDocument();
  });

  it('应该在非 host 且已选择时显示准备按钮', () => {
    render(
      <FactionSelection
        {...defaultProps}
        currentPlayerId={'1' as any}
        selectedFactions={{
          '0': 'unselected' as any,
          '1': 'phoenix_elves' as any,
        }}
      />
    );

    expect(screen.getByText('factionSelection.ready')).toBeInTheDocument();
  });

  it('手机横屏应保持 1280x720 的等比缩放舞台参数', () => {
    setViewportSize(1000, 500);

    render(<FactionSelection {...defaultProps} />);

    const stage = screen.getByTestId('sw-faction-stage');
    const expectedScale = Math.min((1000 - 12) / 1280, (500 - 4) / 720, 1);
    const expectedWidthPx = Math.round(1280 * expectedScale);
    const expectedHeightPx = Math.round(720 * expectedScale);
    expect(stage).toHaveStyle({ width: `${expectedWidthPx}px` });
    expect(stage).toHaveStyle({ height: `${expectedHeightPx}px` });
    expect(stage.style.getPropertyValue('--sw-selection-inline-unit')).toBe(`${expectedWidthPx / 100}px`);
    expect(stage.style.getPropertyValue('--sw-selection-block-unit')).toBe(`${expectedHeightPx / 100}px`);
  });
});
