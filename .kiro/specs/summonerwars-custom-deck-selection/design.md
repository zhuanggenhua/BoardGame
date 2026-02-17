# 召唤师战争 - 自定义牌组选择界面 - 设计文档

## 架构设计

### 组件层次结构

```
FactionSelectionAdapter (修改)
├── 阵营卡片网格 (grid-cols-4，保持不变)
│   ├── FactionCard × 6 (默认阵营)
│   ├── CustomDeckCard × 0-2 (已保存的自定义牌组) [新增]
│   └── NewDeckButton × 0-1 ("+"按钮，如果未满 2 个自定义牌组则显示) [重构]
├── 预览区
└── 玩家状态区
    └── PlayerStatusCard (修改，支持显示自定义牌组信息)
```

### 数据流

```
FactionSelectionAdapter
  ↓ (useEffect + token)
listCustomDecks API
  ↓ (返回 SavedDeckSummary[])
savedDecks state
  ↓ (slice(0, 2))
CustomDeckCard × 2
  ↓ (onClick)
getCustomDeck API
  ↓ (返回 SerializedCustomDeck)
onSelectCustomDeck callback
  ↓
父组件处理选择逻辑
```

## 组件设计

### 1. CustomDeckCard 组件（新增）

**文件路径**: `src/games/summonerwars/ui/CustomDeckCard.tsx`

**Props 接口**:
```typescript
interface CustomDeckCardProps {
  deck: SavedDeckSummary;           // 牌组摘要信息
  index: number;                     // 用于动画延迟
  isSelectedByMe: boolean;           // 是否被当前玩家选中
  occupyingPlayers: string[];        // 占用该牌组的玩家 ID 列表
  t: TFunction;                      // i18n 翻译函数
  onSelect: () => void;              // 选择牌组回调
  onEdit: () => void;                // 编辑牌组回调
  onMagnify: (factionId: FactionId) => void; // 放大预览回调
}
```

**SavedDeckSummary 类型**（已存在于 API）:
```typescript
interface SavedDeckSummary {
  id: string;                        // 牌组 ID
  name: string;                      // 牌组名称
  summonerId: string;                // 召唤师卡牌 ID
  summonerFaction: FactionId;        // 召唤师所属阵营
  createdAt: string;                 // 创建时间
  updatedAt: string;                 // 更新时间
}
```

**视觉设计**:
- 卡片结构与 `FactionCard` 一致
- 顶部显示召唤师卡牌（使用 `CardSprite`，根据 `summonerFaction` 获取 atlasId）
- 底部渐变遮罩显示牌组名称
- 右上角显示"DIY"徽章（紫色，区分默认牌组）
- Hover 时右上角显示"编辑"按钮（铅笔图标）
- 选中状态：金色边框 + ring 效果（与 `FactionCard` 一致）

**动画效果**:
- 使用 framer-motion 的 `motion.div`
- `initial={{ opacity: 0, y: 15 }}`
- `animate={{ opacity: 1, y: 0 }}`
- `whileHover={{ scale: 1.02, y: -4 }}`
- `transition.delay` 基于 `index`（与其他卡片保持一致的入场动画）

### 2. FactionSelectionAdapter 修改

**状态管理**:
```typescript
// 新增状态
const [savedDecks, setSavedDecks] = useState<SavedDeckSummary[]>([]);
const [selectedCustomDeckId, setSelectedCustomDeckId] = useState<string | null>(null);

// 新增 Effect：加载自定义牌组列表
useEffect(() => {
  if (!token) return;
  
  const fetchDecks = async () => {
    try {
      const decks = await listCustomDecks(token);
      setSavedDecks(decks);
    } catch (err) {
      console.warn('[FactionSelection] 加载自定义牌组列表失败:', err);
    }
  };
  
  void fetchDecks();
}, [token]);
```

**布局调整**:
```tsx
{/* 保持 grid-cols-4 不变 */}
<div className="grid grid-cols-4 gap-[0.8vw] max-w-[96vw] mx-auto">
  {/* 默认阵营卡片 × 6 */}
  {availableFactions.map((faction, index) => (
    <FactionCard key={faction.id} {...props} />
  ))}
  
  {/* 自定义牌组卡片 × 0-2 */}
  {currentPlayerId && savedDecks.slice(0, 2).map((deck, index) => (
    <CustomDeckCard
      key={deck.id}
      deck={deck}
      index={availableFactions.length + index}
      isSelectedByMe={selectedCustomDeckId === deck.id}
      occupyingPlayers={[]} // TODO: 实现多玩家占用逻辑
      t={t}
      onSelect={async () => {
        if (!token) return;
        try {
          const fullDeck = await getCustomDeck(token, deck.id);
          setSelectedCustomDeckId(deck.id);
          onSelectCustomDeck?.(fullDeck);
        } catch (err) {
          console.error('[FactionSelection] 加载自定义牌组失败:', err);
        }
      }}
      onEdit={() => {
        // TODO: 打开构建器并加载该牌组
        setIsDeckBuilderOpen(true);
        // 需要传递 deckId 给 DeckBuilderDrawer
      }}
      onMagnify={handleMagnifyCard}
    />
  ))}
  
  {/* "+"按钮（仅当自定义牌组数量 < 2 时显示） */}
  {currentPlayerId && savedDecks.length < 2 && (
    <NewDeckButton
      index={availableFactions.length + savedDecks.length}
      onClick={() => setIsDeckBuilderOpen(true)}
      t={t}
    />
  )}
</div>
```

### 3. DeckBuilderDrawer 修改

**新增 Props**:
```typescript
interface DeckBuilderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deck: SerializedCustomDeck) => void;
  currentPlayerId: PlayerId;
  initialDeckId?: string;  // 新增：用于编辑模式
}
```

**编辑模式逻辑**:
```typescript
useEffect(() => {
  if (isOpen && initialDeckId) {
    // 加载指定的牌组
    void loadDeck(initialDeckId);
  } else if (isOpen && !initialDeckId) {
    // 新建模式：重置牌组
    resetDeck();
  }
}, [isOpen, initialDeckId]);
```

### 4. PlayerStatusCard 修改

**自定义牌组显示逻辑**:
```typescript
// 判断是否为自定义牌组
const isCustomDeck = !!customDeckInfo;

// 显示名称
const displayName = isCustomDeck
  ? t('factionSelection.customDeckLabel')
  : factionEntry
    ? t(factionEntry.nameKey)
    : t('factionSelection.notSelected');

// 子文本（显示召唤师阵营）
const customDeckSubtext = isCustomDeck && customDeckInfo
  ? t('factionSelection.customDeckSummoner', { 
      name: t(FACTION_CATALOG.find(f => f.id === customDeckInfo.summonerFaction)?.nameKey ?? '') 
    })
  : null;
```

## 状态管理

### 选择状态

**问题**: 如何区分"选择默认阵营"和"选择自定义牌组"？

**方案**: 扩展 `selectedFactions` 的类型

```typescript
// 当前实现
selectedFactions: Record<PlayerId, FactionId | 'unselected'>

// 扩展方案（推荐）
selectedFactions: Record<PlayerId, FactionId | `custom:${string}` | 'unselected'>

// 示例
selectedFactions = {
  '0': 'necromancer',           // 玩家0选择默认阵营
  '1': 'custom:deck-id-123',    // 玩家1选择自定义牌组
}
```

**辅助函数**:
```typescript
function isCustomDeckSelection(selection: string): boolean {
  return selection.startsWith('custom:');
}

function extractCustomDeckId(selection: string): string | null {
  if (!isCustomDeckSelection(selection)) return null;
  return selection.replace('custom:', '');
}
```

### 自定义牌组信息存储

**方案**: 在 `FactionSelectionAdapter` 中维护一个映射表

```typescript
const [customDeckInfoMap, setCustomDeckInfoMap] = useState<Record<string, CustomDeckInfo>>({});

interface CustomDeckInfo {
  deckId: string;
  deckName: string;
  summonerName: string;
  summonerFaction: FactionId;
}
```

## API 交互

### 加载自定义牌组列表

```typescript
// 时机：组件挂载 + token 变化
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
    }
  };
  
  void fetchDecks();
  
  return () => { cancelled = true; };
}, [token]);
```

### 选择自定义牌组

```typescript
const handleSelectCustomDeck = async (deckId: string) => {
  if (!token) return;
  
  try {
    // 1. 获取完整牌组数据
    const fullDeck = await getCustomDeck(token, deckId);
    
    // 2. 更新选择状态
    setSelectedCustomDeckId(deckId);
    
    // 3. 存储牌组信息（用于 PlayerStatusCard 显示）
    setCustomDeckInfoMap(prev => ({
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
    // TODO: 显示错误提示
  }
};
```

## 精灵图处理

### 获取召唤师精灵图

```typescript
function getSummonerAtlasIdByFaction(factionId: FactionId): string {
  const entry = FACTION_CATALOG.find(f => f.id === factionId);
  if (!entry) return '';
  
  // 从 heroImagePath 提取目录名
  // 例如: 'summonerwars/hero/Necromancer/hero' → 'necromancer'
  const match = entry.heroImagePath.match(/hero\/(\w+)\//);
  const dir = match?.[1] ?? 'Necromancer';
  
  return `sw:${dir.toLowerCase()}:hero`;
}
```

### CustomDeckCard 中使用

```tsx
const CustomDeckCard: React.FC<CustomDeckCardProps> = ({ deck, ... }) => {
  const atlasId = getSummonerAtlasIdByFaction(deck.summonerFaction);
  
  return (
    <motion.div {...}>
      <div onClick={onSelect}>
        <CardSprite
          atlasId={atlasId}
          frameIndex={0}  // 召唤师始终是第一帧
          className="w-full"
        />
      </div>
      
      {/* 底部渐变遮罩 + 牌组名称 */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-1.5 pb-1 pt-4 pointer-events-none">
        <div className="font-bold text-xs text-white leading-tight truncate">
          {deck.name}
        </div>
      </div>
      
      {/* DIY 徽章 */}
      <div className="absolute top-1 left-1 bg-purple-500/20 text-purple-300 text-[8px] px-1.5 py-0.5 rounded border border-purple-500/30 uppercase tracking-wider font-bold">
        DIY
      </div>
      
      {/* 编辑按钮（hover 显示） */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white/70 hover:bg-black/80 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
        title={t('factionSelection.editDeck')}
      >
        {/* 铅笔图标 */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    </motion.div>
  );
};
```

## 错误处理

### 加载失败

```typescript
try {
  const decks = await listCustomDecks(token);
  setSavedDecks(decks);
} catch (err) {
  console.warn('[FactionSelection] 加载自定义牌组列表失败:', err);
  // 静默失败，不阻塞界面
  // 用户仍可选择默认阵营或创建新牌组
}
```

### 选择失败

```typescript
try {
  const fullDeck = await getCustomDeck(token, deckId);
  onSelectCustomDeck?.(fullDeck);
} catch (err) {
  console.error('[FactionSelection] 加载自定义牌组失败:', err);
  // TODO: 显示 Toast 提示用户
  // 例如: "加载牌组失败，请重试"
}
```

## 性能优化

### 1. 精灵图预加载

```typescript
useEffect(() => {
  // 预加载已保存牌组的召唤师精灵图
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

### 2. 防抖加载

```typescript
// 避免频繁调用 API
const debouncedFetchDecks = useMemo(
  () => debounce(async () => {
    if (!token) return;
    const decks = await listCustomDecks(token);
    setSavedDecks(decks);
  }, 300),
  [token]
);
```

### 3. 缓存策略

```typescript
// 使用 React Query 或 SWR 缓存 API 响应
// 避免每次打开阵营选择界面都重新加载
const { data: savedDecks, isLoading } = useQuery(
  ['customDecks', token],
  () => listCustomDecks(token!),
  {
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5分钟内不重新请求
  }
);
```

## 测试策略

### 单元测试

**CustomDeckCard.test.tsx**:
- 渲染测试：正确显示牌组名称、DIY 徽章
- 交互测试：点击选择、点击编辑
- 精灵图测试：正确获取 atlasId

**FactionSelectionAdapter.test.tsx**:
- 布局测试：3列网格、卡片顺序正确
- 状态测试：选择自定义牌组后状态更新
- API 测试：加载牌组列表、选择牌组

### E2E 测试

**summonerwars-custom-deck-selection.e2e.ts**:
```typescript
test('显示已保存的自定义牌组', async ({ page }) => {
  // 1. 登录并创建房间
  // 2. 进入阵营选择界面
  // 3. 验证显示 6 个默认阵营 + 2 个自定义牌组 + 1 个"+"按钮
  // 4. 验证自定义牌组卡片显示正确信息
});

test('选择自定义牌组进入对局', async ({ page }) => {
  // 1. 进入阵营选择界面
  // 2. 点击自定义牌组卡片
  // 3. 验证卡片高亮
  // 4. 验证玩家状态区显示牌组信息
  // 5. 点击"准备"
  // 6. 房主点击"开始游戏"
  // 7. 验证游戏使用自定义牌组初始化
});

test('编辑已保存的自定义牌组', async ({ page }) => {
  // 1. 进入阵营选择界面
  // 2. Hover 自定义牌组卡片
  // 3. 点击"编辑"按钮
  // 4. 验证牌组构建器打开并加载牌组数据
  // 5. 修改牌组并保存
  // 6. 验证阵营选择界面刷新显示更新后的信息
});
```

## 国际化

### 中文文案
```json
{
  "factionSelection": {
    "customDeck": "自定义牌组",
    "customDeckLabel": "自定义牌组",
    "customDeckSummoner": "{{name}} 召唤师",
    "clickToBuild": "点击构建",
    "editDeck": "编辑牌组",
    "newDeck": "新建牌组",
    "loadingDecks": "加载牌组中...",
    "loadDeckFailed": "加载牌组失败，请重试"
  }
}
```

### 英文文案
```json
{
  "factionSelection": {
    "customDeck": "Custom Deck",
    "customDeckLabel": "Custom Deck",
    "customDeckSummoner": "{{name}} Summoner",
    "clickToBuild": "Click to Build",
    "editDeck": "Edit Deck",
    "newDeck": "New Deck",
    "loadingDecks": "Loading decks...",
    "loadDeckFailed": "Failed to load deck, please try again"
  }
}
```

## 风险与缓解

### 风险 1: 卡片数量限制
**描述**: 最多显示 2 个自定义牌组可能不满足部分用户需求  
**缓解**: 在牌组构建器中提供删除功能，允许用户管理牌组；未来可扩展为分页或滚动查看

### 风险 2: 性能问题
**描述**: 加载多个精灵图可能导致性能下降  
**缓解**: 使用预加载策略，复用已有的精灵图缓存机制

### 风险 3: 状态同步
**描述**: 多玩家同时选择自定义牌组时状态可能不一致  
**缓解**: 使用 WebSocket 实时同步选择状态（与默认阵营选择一致）

## 未来扩展

1. **显示更多自定义牌组**: 支持分页或滚动查看所有已保存牌组
2. **牌组排序**: 按创建时间、使用频率、胜率等排序
3. **牌组标签**: 为牌组添加标签（如"进攻型"、"防守型"）
4. **牌组分享**: 生成分享码，其他玩家可导入
5. **牌组统计**: 显示牌组的使用次数、胜率等数据
