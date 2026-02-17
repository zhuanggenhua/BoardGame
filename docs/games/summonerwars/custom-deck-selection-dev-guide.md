# 召唤师战争 - 自定义牌组选择功能开发文档

## 概述

本文档描述召唤师战争自定义牌组选择功能的技术实现，包括组件设计、API 使用、数据流和扩展指南。

## 架构设计

### 组件层次结构

```
FactionSelectionAdapter (阵营选择适配器)
├── FactionCard × 6 (默认阵营卡片)
├── CustomDeckCard × 0-2 (自定义牌组卡片)
├── NewDeckButton (新建牌组按钮，条件显示)
├── PlayerStatusCard × 2 (玩家状态卡片)
├── ActionButton (操作按钮)
├── MagnifyOverlay (放大预览)
└── DeckBuilderDrawer (牌组构建器抽屉)
```

### 数据流

```
用户登录
  ↓
listCustomDecks API (加载牌组列表)
  ↓
savedDecks state (最多 2 个)
  ↓
CustomDeckCard × 0-2 (渲染卡片)
  ↓ (用户点击选择)
getCustomDeck API (获取完整牌组数据)
  ↓
onSelectCustomDeck callback (通知父组件)
  ↓
父组件处理选择逻辑
```

## 核心组件

### 1. CustomDeckCard

**文件**: `src/games/summonerwars/ui/CustomDeckCard.tsx`

**职责**:
- 渲染自定义牌组卡片
- 处理用户交互（选择、编辑、放大）
- 显示选中状态和玩家占用标记

**Props**:
```typescript
interface CustomDeckCardProps {
  deck: SavedDeckSummary;           // 牌组摘要信息
  index: number;                     // 动画延迟索引
  isSelectedByMe: boolean;           // 是否被当前玩家选中
  occupyingPlayers: string[];        // 占用该牌组的玩家 ID 列表
  t: TFunction;                      // i18n 翻译函数
  onSelect: () => void;              // 选择牌组回调
  onEdit: () => void;                // 编辑牌组回调
  onMagnify: (factionId: FactionId) => void; // 放大预览回调
}
```

**关键实现**:
```typescript
// 获取召唤师精灵图 atlasId
const atlasId = getSummonerAtlasIdByFaction(deck.summonerFaction);

// 渲染召唤师精灵图
<CardSprite atlasId={atlasId} frameIndex={0} className="w-full" />

// DIY 徽章
<div className="absolute top-[0.3vw] left-[0.3vw] bg-purple-500/20 text-purple-300 ...">
  DIY
</div>

// 编辑按钮（Hover 显示）
<button
  onClick={(e) => { e.stopPropagation(); onEdit(); }}
  className="opacity-0 group-hover:opacity-100 ..."
>
  {/* 铅笔图标 */}
</button>
```

**动画**:
- 入场动画：`initial={{ opacity: 0, y: 15 }}`
- Hover 动画：`whileHover={{ scale: 1.02, y: -4 }}`
- 点击动画：`whileTap={{ scale: 0.98 }}`
- 延迟：`delay: index * 0.06`

### 2. FactionSelectionAdapter

**文件**: `src/games/summonerwars/ui/FactionSelectionAdapter.tsx`

**职责**:
- 管理阵营选择状态
- 加载和显示自定义牌组列表
- 处理自定义牌组选择逻辑
- 集成牌组构建器

**关键状态**:
```typescript
// 已保存的自定义牌组列表
const [savedDecks, setSavedDecks] = useState<SavedDeckSummary[]>([]);

// 当前选中的自定义牌组 ID
const [selectedCustomDeckId, setSelectedCustomDeckId] = useState<string | null>(null);

// 编辑中的牌组 ID
const [editingDeckId, setEditingDeckId] = useState<string | null>(null);

// 自定义牌组选择信息（按玩家 ID 存储）
const [customDeckSelections, setCustomDeckSelections] = useState<Record<string, CustomDeckInfo>>({});
```

**关键函数**:

#### 加载牌组列表
```typescript
useEffect(() => {
  if (!token) return;
  
  let cancelled = false;
  
  const fetchDecks = async () => {
    try {
      const decks = await listCustomDecks(token);
      if (!cancelled) {
        setSavedDecks(decks);
      }
    } catch (err) {
      console.warn('[FactionSelection] 加载自定义牌组列表失败:', err);
      if (!cancelled) {
        toast.error(
          { kind: 'i18n', ns: 'game-summonerwars', key: 'factionSelection.loadDeckFailed' },
          undefined,
          { dedupeKey: 'load-deck-list-failed' }
        );
      }
    }
  };
  
  void fetchDecks();
  
  return () => { cancelled = true; };
}, [token, toast]);
```

#### 选择自定义牌组
```typescript
const handleSelectCustomDeck = useCallback(async (deckId: string) => {
  if (!token) return;
  
  try {
    // 1. 获取完整牌组数据
    const fullDeck = await getCustomDeck(token, deckId);
    
    // 2. 更新选中状态
    setSelectedCustomDeckId(deckId);
    
    // 3. 存储牌组信息（用于 PlayerStatusCard 显示）
    setCustomDeckSelections(prev => ({
      ...prev,
      [currentPlayerId]: {
        deckId: fullDeck.id,
        deckName: fullDeck.name,
        summonerName: fullDeck.summonerId,
        summonerFaction: fullDeck.summonerFaction,
      },
    }));
    
    // 4. 通知父组件
    onSelectCustomDeck?.(fullDeck);
  } catch (err) {
    console.error('[FactionSelection] 加载自定义牌组失败:', err);
    toast.error(
      { kind: 'i18n', ns: 'game-summonerwars', key: 'factionSelection.loadDeckFailed' },
      undefined,
      { dedupeKey: `select-deck-${deckId}-failed` }
    );
  }
}, [token, currentPlayerId, onSelectCustomDeck, toast]);
```

#### 刷新牌组列表
```typescript
const refreshDeckList = useCallback(async () => {
  if (!token) return;
  
  try {
    const decks = await listCustomDecks(token);
    setSavedDecks(decks);
  } catch (err) {
    console.warn('[FactionSelection] 刷新自定义牌组列表失败:', err);
    toast.error(
      { kind: 'i18n', ns: 'game-summonerwars', key: 'factionSelection.loadDeckFailed' },
      undefined,
      { dedupeKey: 'refresh-deck-list-failed' }
    );
  }
}, [token, toast]);
```

### 3. DeckBuilderDrawer

**文件**: `src/games/summonerwars/ui/DeckBuilderDrawer.tsx`

**扩展 Props**:
```typescript
interface DeckBuilderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (deck: SerializedCustomDeck) => void;
  currentPlayerId: string;
  initialDeckId?: string;           // 新增：编辑模式时传入牌组 ID
  onDeckSaved?: () => void;         // 新增：牌组保存后的回调
}
```

**编辑模式逻辑**:
```typescript
// 编辑模式：打开抽屉时自动加载指定牌组
useEffect(() => {
  if (isOpen && initialDeckId) {
    // 加载指定的牌组
    void loadDeck(initialDeckId);
  } else if (isOpen && !initialDeckId) {
    // 新建模式：重置牌组
    resetDeck();
  }
}, [isOpen, initialDeckId, loadDeck, resetDeck]);

// 包装 saveDeck 函数，保存成功后通知父组件刷新
const handleSaveDeck = useCallback(async (name: string) => {
  await saveDeck(name);
  // 通知父组件刷新牌组列表
  onDeckSaved?.();
}, [saveDeck, onDeckSaved]);

// 包装 deleteDeck 函数，删除成功后通知父组件刷新
const handleDeleteDeck = useCallback(async (deckId: string) => {
  await deleteDeck(deckId);
  // 通知父组件刷新牌组列表
  onDeckSaved?.();
}, [deleteDeck, onDeckSaved]);
```

## API 使用

### 1. listCustomDecks

**用途**: 获取用户保存的自定义牌组列表

**签名**:
```typescript
function listCustomDecks(token: string): Promise<SavedDeckSummary[]>
```

**返回类型**:
```typescript
interface SavedDeckSummary {
  id: string;
  name: string;
  summonerFaction: FactionId;
  createdAt: string;
  updatedAt: string;
}
```

**使用示例**:
```typescript
const decks = await listCustomDecks(token);
setSavedDecks(decks);
```

### 2. getCustomDeck

**用途**: 获取指定自定义牌组的完整数据

**签名**:
```typescript
function getCustomDeck(token: string, deckId: string): Promise<SerializedCustomDeck>
```

**返回类型**:
```typescript
interface SerializedCustomDeck {
  id: string;
  name: string;
  summonerId: string;
  summonerFaction: FactionId;
  cards: Array<{ cardId: string; quantity: number }>;
}
```

**使用示例**:
```typescript
const fullDeck = await getCustomDeck(token, deckId);
onSelectCustomDeck?.(fullDeck);
```

## 辅助函数

### customDeckHelpers.ts

**文件**: `src/games/summonerwars/ui/helpers/customDeckHelpers.ts`

#### getSummonerAtlasIdByFaction
```typescript
/**
 * 根据阵营 ID 获取召唤师精灵图 atlasId
 * 
 * @param factionId - 阵营 ID
 * @returns 精灵图 atlasId，格式为 "sw:{faction}:hero"
 */
export function getSummonerAtlasIdByFaction(factionId: FactionId): string {
  const entry = FACTION_CATALOG.find(f => f.id === factionId);
  if (!entry) return '';
  
  const match = entry.heroImagePath.match(/hero\/(\w+)\//);
  const dir = match?.[1] ?? 'Necromancer';
  return `sw:${dir.toLowerCase()}:hero`;
}
```

#### isCustomDeckSelection
```typescript
/**
 * 判断选择字符串是否为自定义牌组
 * 
 * @param selection - 选择字符串
 * @returns 是否为自定义牌组
 */
export function isCustomDeckSelection(selection: string): boolean {
  return selection.startsWith('custom:');
}
```

#### extractCustomDeckId
```typescript
/**
 * 从选择字符串中提取牌组 ID
 * 
 * @param selection - 选择字符串，格式为 "custom:{deckId}"
 * @returns 牌组 ID，如果不是自定义牌组则返回 null
 */
export function extractCustomDeckId(selection: string): string | null {
  if (!isCustomDeckSelection(selection)) return null;
  return selection.replace('custom:', '');
}
```

## 国际化

### 文案 Key

**文件**: `public/locales/{lang}/game-summonerwars.json`

```json
{
  "factionSelection": {
    "editDeck": "编辑牌组",
    "newDeck": "新建牌组",
    "loadingDecks": "加载牌组中...",
    "loadDeckFailed": "加载牌组失败，请重试",
    "customDeckLabel": "自定义牌组",
    "customDeckSummoner": "{{name}} - 召唤师",
    "clickToBuild": "点击构建"
  }
}
```

## 样式规范

### DIY 徽章
```css
bg-purple-500/20      /* 背景：紫色，20% 透明度 */
text-purple-300       /* 文字：紫色 */
border-purple-500/30  /* 边框：紫色，30% 透明度 */
```

### 选中状态
```css
border-amber-400                              /* 边框：金色 */
shadow-[0_0_25px_rgba(251,191,36,0.4)]      /* 阴影：金色光晕 */
```

### 编辑按钮
```css
opacity-0 group-hover:opacity-100  /* Hover 时显示 */
bg-black/60 hover:bg-black/80      /* 背景：半透明黑色 */
text-white/70 hover:text-white     /* 文字：白色 */
```

## 测试

### 单元测试

**CustomDeckCard 测试**:
```typescript
// 文件: src/games/summonerwars/ui/__tests__/CustomDeckCard.test.tsx

describe('CustomDeckCard', () => {
  it('应该正确渲染牌组名称', () => {
    render(<CustomDeckCard {...defaultProps} />);
    expect(screen.getByText('我的自定义牌组')).toBeInTheDocument();
  });

  it('应该显示 DIY 徽章', () => {
    render(<CustomDeckCard {...defaultProps} />);
    expect(screen.getByText('DIY')).toBeInTheDocument();
  });

  it('点击卡片应该触发 onSelect', () => {
    const onSelect = vi.fn();
    render(<CustomDeckCard {...defaultProps} onSelect={onSelect} />);
    
    const card = screen.getByText('我的自定义牌组').closest('div');
    fireEvent.click(card!);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
```

**FactionSelectionAdapter 测试**:
```typescript
// 文件: src/games/summonerwars/ui/__tests__/FactionSelectionAdapter.test.tsx

describe('FactionSelection', () => {
  it('应该加载自定义牌组列表', async () => {
    const mockDecks: SavedDeckSummary[] = [
      { id: 'deck-1', name: '我的牌组1', summonerFaction: 'phoenix_elves', ... },
    ];
    mockListCustomDecks.mockResolvedValue(mockDecks);

    render(<FactionSelection {...defaultProps} />);

    await waitFor(() => {
      expect(mockListCustomDecks).toHaveBeenCalledWith('mock-token');
      expect(screen.getByTestId('custom-deck-card-deck-1')).toBeInTheDocument();
    });
  });

  it('应该最多显示 2 个自定义牌组', async () => {
    const mockDecks: SavedDeckSummary[] = [
      { id: 'deck-1', ... },
      { id: 'deck-2', ... },
      { id: 'deck-3', ... },
    ];
    mockListCustomDecks.mockResolvedValue(mockDecks);

    render(<FactionSelection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('custom-deck-card-deck-1')).toBeInTheDocument();
      expect(screen.getByTestId('custom-deck-card-deck-2')).toBeInTheDocument();
      expect(screen.queryByTestId('custom-deck-card-deck-3')).not.toBeInTheDocument();
    });
  });
});
```

### E2E 测试

**文件**: `e2e/summonerwars-custom-deck-selection.e2e.ts`

参考手动测试指南：`.tmp/custom-deck-selection-e2e-manual-test-guide.md`

## 扩展指南

### 增加自定义牌组数量限制

**当前限制**: 最多 2 个自定义牌组

**修改步骤**:
1. 在 `FactionSelectionAdapter.tsx` 中修改 `slice(0, 2)` 为 `slice(0, N)`
2. 修改"+"按钮显示条件：`savedDecks.length < N`
3. 调整网格布局（如果需要）
4. 更新文档和测试

### 添加牌组分类

**实现思路**:
1. 在 `SavedDeckSummary` 中添加 `category` 字段
2. 在 `FactionSelectionAdapter` 中添加分类过滤器
3. 在 `CustomDeckCard` 中显示分类标签
4. 更新 API 和数据库模型

### 添加牌组分享功能

**实现思路**:
1. 在 `CustomDeckCard` 中添加分享按钮
2. 实现分享 API（生成分享链接或分享码）
3. 实现导入 API（通过分享链接或分享码导入牌组）
4. 添加分享历史记录

## 性能优化

### API 缓存

**使用 React Query**:
```typescript
import { useQuery } from '@tanstack/react-query';

const { data: savedDecks, isLoading, error } = useQuery({
  queryKey: ['customDecks', token],
  queryFn: () => listCustomDecks(token!),
  enabled: !!token,
  staleTime: 5 * 60 * 1000, // 5 分钟
  cacheTime: 10 * 60 * 1000, // 10 分钟
});
```

### 精灵图预加载优化

**当前实现**:
```typescript
useEffect(() => {
  savedDecks.forEach(deck => {
    const atlasId = getSummonerAtlasIdByFaction(deck.summonerFaction);
    const source = getSpriteAtlasSource(atlasId);
    if (source) {
      const img = new Image();
      img.src = source.image;
    }
  });
}, [savedDecks]);
```

**优化建议**:
- 使用 `Promise.all` 并行加载
- 添加加载状态指示
- 实现加载失败重试机制

## 故障排查

### 问题：自定义牌组不显示

**可能原因**:
1. 用户未登录
2. API 调用失败
3. 网络连接问题

**排查步骤**:
1. 检查浏览器控制台是否有错误日志
2. 检查 Network 面板，确认 API 调用是否成功
3. 检查 `token` 是否存在
4. 检查 `savedDecks` 状态是否正确更新

### 问题：编辑按钮不显示

**可能原因**:
1. CSS 样式问题
2. 事件冒泡被阻止

**排查步骤**:
1. 检查 `group-hover:opacity-100` 样式是否生效
2. 检查父元素是否有 `group` 类名
3. 使用浏览器开发工具检查元素层级

### 问题：保存后列表不刷新

**可能原因**:
1. `onDeckSaved` 回调未正确传递
2. `refreshDeckList` 函数未正确实现

**排查步骤**:
1. 检查 `DeckBuilderDrawer` 的 `onDeckSaved` prop 是否传递
2. 检查 `handleSaveDeck` 和 `handleDeleteDeck` 是否调用 `onDeckSaved`
3. 检查 `refreshDeckList` 函数是否正确调用 API

## 相关文档

- [用户使用指南](./custom-deck-selection-user-guide.md)
- [牌组构建器文档](./deck-builder-guide.md)
- [API 文档](../../api/custom-deck-api.md)
- [测试文档](../../testing/summonerwars-tests.md)

## 贡献指南

如果你想为自定义牌组选择功能贡献代码，请遵循以下步骤：

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/custom-deck-enhancement`)
3. 提交更改 (`git commit -am 'Add some feature'`)
4. 推送到分支 (`git push origin feature/custom-deck-enhancement`)
5. 创建 Pull Request

**代码规范**:
- 遵循项目的 ESLint 配置
- 添加单元测试
- 更新相关文档
- 确保所有测试通过

---

**最后更新**: 2024-XX-XX
**维护者**: [姓名]
