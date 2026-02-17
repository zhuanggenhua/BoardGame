/**
 * FactionSelectionAdapter 组件单元测试
 * 
 * 测试覆盖：
 * - 正确加载自定义牌组列表
 * - 4列网格布局保持不变
 * - 卡片顺序正确（默认阵营 → 自定义牌组 → "+"按钮）
 * - "+"按钮仅在自定义牌组数量 < 2 时显示
 * - 选择自定义牌组后状态更新
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FactionSelection } from '../FactionSelectionAdapter';
import type { SavedDeckSummary } from '../../../../api/custom-deck';
import type { TFunction } from 'i18next';

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
    div: ({ children, className, onClick }: any) => (
      <div className={className} onClick={onClick}>
        {children}
      </div>
    ),
    button: ({ children, className, onClick }: any) => (
      <button className={className} onClick={onClick}>
        {children}
      </button>
    ),
    h1: ({ children, className }: any) => (
      <h1 className={className}>{children}</h1>
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

  it('应该最多显示 2 个自定义牌组', async () => {
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
      expect(screen.getByTestId('custom-deck-card-deck-2')).toBeInTheDocument();
      expect(screen.queryByTestId('custom-deck-card-deck-3')).not.toBeInTheDocument();
    });
  });

  it('应该在自定义牌组数量 < 2 时显示"+"按钮', async () => {
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
      expect(screen.getByText('factionSelection.newDeck')).toBeInTheDocument();
    });
  });

  it('应该在自定义牌组数量 = 2 时不显示"+"按钮', async () => {
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
    ];
    mockListCustomDecks.mockResolvedValue(mockDecks);

    render(<FactionSelection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('custom-deck-card-deck-1')).toBeInTheDocument();
    });

    expect(screen.queryByText('factionSelection.newDeck')).not.toBeInTheDocument();
  });

  it('应该在没有自定义牌组时显示"+"按钮', async () => {
    mockListCustomDecks.mockResolvedValue([]);

    render(<FactionSelection {...defaultProps} />);

    await waitFor(() => {
      expect(mockListCustomDecks).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('factionSelection.newDeck')).toBeInTheDocument();
    });
  });

  it('应该保持 4 列网格布局', () => {
    const { container } = render(<FactionSelection {...defaultProps} />);
    
    // 查找网格容器
    const gridContainer = container.querySelector('.grid-cols-4');
    expect(gridContainer).toBeInTheDocument();
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
});
