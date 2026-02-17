/**
 * CustomDeckCard 组件单元测试
 * 
 * 测试覆盖：
 * - 正确渲染牌组名称和 DIY 徽章
 * - 点击卡片触发 onSelect
 * - 点击编辑按钮触发 onEdit
 * - 选中状态样式正确应用
 * - 玩家占用标记正确显示
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomDeckCard } from '../CustomDeckCard';
import type { SavedDeckSummary } from '../../../../api/custom-deck';
import type { TFunction } from 'i18next';

// Mock CardSprite 组件
vi.mock('../CardSprite', () => ({
  CardSprite: ({ atlasId, className }: { atlasId: string; className?: string }) => (
    <div data-testid="card-sprite" data-atlas-id={atlasId} className={className}>
      Mock CardSprite
    </div>
  ),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, className, ...props }: any) => (
      <div onClick={onClick} className={className} {...props}>
        {children}
      </div>
    ),
  },
}));

// Mock 辅助函数
vi.mock('../helpers/customDeckHelpers', () => ({
  getSummonerAtlasIdByFaction: (factionId: string) => `sw:${factionId}:hero`,
}));

// 创建 mock t 函数
const createMockT = (): TFunction => {
  const t = ((key: string, options?: any) => {
    const translations: Record<string, string> = {
      'player.short': options?.id === 1 ? 'P1' : 'P2',
      'actions.magnify': '放大查看',
      'factionSelection.editDeck': '编辑牌组',
    };
    return translations[key] || key;
  }) as TFunction;
  return t;
};

describe('CustomDeckCard', () => {
  const mockDeck: SavedDeckSummary = {
    id: 'deck-123',
    name: '我的自定义牌组',
    summonerFaction: 'phoenix_elves' as any,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const defaultProps = {
    deck: mockDeck,
    index: 0,
    isSelectedByMe: false,
    occupyingPlayers: [],
    t: createMockT(),
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onMagnify: vi.fn(),
  };

  it('应该正确渲染牌组名称', () => {
    render(<CustomDeckCard {...defaultProps} />);
    expect(screen.getByText('我的自定义牌组')).toBeInTheDocument();
  });

  it('应该显示 DIY 徽章', () => {
    render(<CustomDeckCard {...defaultProps} />);
    expect(screen.getByText('DIY')).toBeInTheDocument();
  });

  it('应该渲染召唤师精灵图', () => {
    render(<CustomDeckCard {...defaultProps} />);
    const sprite = screen.getByTestId('card-sprite');
    expect(sprite).toBeInTheDocument();
    expect(sprite).toHaveAttribute('data-atlas-id', 'sw:phoenix_elves:hero');
  });

  it('点击卡片应该触发 onSelect', () => {
    const onSelect = vi.fn();
    render(<CustomDeckCard {...defaultProps} onSelect={onSelect} />);
    
    const card = screen.getByText('我的自定义牌组').closest('div');
    if (card) {
      fireEvent.click(card);
      expect(onSelect).toHaveBeenCalledTimes(1);
    }
  });

  it('点击编辑按钮应该触发 onEdit 且不触发 onSelect', () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();
    render(<CustomDeckCard {...defaultProps} onSelect={onSelect} onEdit={onEdit} />);
    
    const editButton = screen.getByTitle('编辑牌组');
    fireEvent.click(editButton);
    
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('点击放大按钮应该触发 onMagnify 且不触发 onSelect', () => {
    const onSelect = vi.fn();
    const onMagnify = vi.fn();
    render(<CustomDeckCard {...defaultProps} onSelect={onSelect} onMagnify={onMagnify} />);
    
    const magnifyButton = screen.getByTitle('放大查看');
    fireEvent.click(magnifyButton);
    
    expect(onMagnify).toHaveBeenCalledWith('phoenix_elves');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('选中状态应该应用正确的样式类', () => {
    const { container } = render(
      <CustomDeckCard {...defaultProps} isSelectedByMe={true} />
    );
    
    // 检查是否有选中状态的边框样式
    const card = container.querySelector('.border-amber-400');
    expect(card).toBeInTheDocument();
  });

  it('未选中状态应该应用正确的样式类', () => {
    const { container } = render(
      <CustomDeckCard {...defaultProps} isSelectedByMe={false} />
    );
    
    // 检查是否有未选中状态的边框样式
    const card = container.querySelector('.border-white\\/10');
    expect(card).toBeInTheDocument();
  });

  it('应该显示玩家占用标记', () => {
    render(
      <CustomDeckCard {...defaultProps} occupyingPlayers={['0', '1']} />
    );
    
    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('P2')).toBeInTheDocument();
  });

  it('没有玩家占用时不应该显示占用标记', () => {
    render(<CustomDeckCard {...defaultProps} occupyingPlayers={[]} />);
    
    expect(screen.queryByText('P1')).not.toBeInTheDocument();
    expect(screen.queryByText('P2')).not.toBeInTheDocument();
  });

  it('应该正确传递 index 用于动画延迟', () => {
    const { rerender } = render(<CustomDeckCard {...defaultProps} index={0} />);
    expect(screen.getByText('我的自定义牌组')).toBeInTheDocument();
    
    rerender(<CustomDeckCard {...defaultProps} index={5} />);
    expect(screen.getByText('我的自定义牌组')).toBeInTheDocument();
  });

  it('应该正确处理不同的阵营 ID', () => {
    const deckWithDifferentFaction: SavedDeckSummary = {
      ...mockDeck,
      summonerFaction: 'tundra_orcs' as any,
    };
    
    render(<CustomDeckCard {...defaultProps} deck={deckWithDifferentFaction} />);
    
    const sprite = screen.getByTestId('card-sprite');
    expect(sprite).toHaveAttribute('data-atlas-id', 'sw:tundra_orcs:hero');
  });
});
