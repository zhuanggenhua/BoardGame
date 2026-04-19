# Cardia ActionLog UID 解析和 i18n 加载修复

## 问题描述

用户报告 UI 行为日志显示异常：
1. 第一次报告："打出deck_i_card_09_1775881348955_eiii1tdrz到遭遇 {{slot}}"
2. 第二次报告："打出发明家到遭遇 {{slot}}"

## 根因分析

### 问题 1: 卡牌名称显示 UID

- `getCardiaCardPreviewMeta` 函数接收的是完整的 UID（`deck_i_card_09_1775881348955_eiii1tdrz`）
- 但 `cardRegistry.get()` 需要的是 defId（`deck_i_card_09`）
- 导致查找失败，返回 null，最终显示原始 UID

### 问题 2: 参数占位符未替换

- `I18nSegment` 组件使用 `useTranslation(ns)` 时，`game-cardia` namespace 可能还没有加载完成
- i18next 在 namespace 未加载时，会返回原始的 key 和未替换的参数占位符
- 导致显示 `{{slot}}` 而不是实际的数值

## 修复方案

### 修复 1: UID 解析

修改 `src/games/cardia/ui/cardPreviewHelper.ts`：

```typescript
// 修复前
export function getCardiaCardPreviewMeta(cardId: string): CardPreviewMeta | null {
    const cardDef = cardRegistry.get(cardId);
    // ...
}

// 修复后
export function getCardiaCardPreviewMeta(cardIdOrUid: string): CardPreviewMeta | null {
    // 从 UID 中提取 defId（格式：defId_timestamp_random）
    // 例如：deck_i_card_09_1775881348955_eiii1tdrz -> deck_i_card_09
    const defId = cardIdOrUid.split('_').slice(0, 4).join('_');
    
    const cardDef = cardRegistry.get(defId);
    // ...
}
```

### 修复 2: i18n Namespace 加载等待

修改 `src/components/game/framework/widgets/ActionLogSegments.tsx`：

```typescript
// 修复前
const I18nSegment: React.FC<{...}> = ({ ns, i18nKey, params, paramI18nKeys }) => {
    const { t } = useTranslation(ns);
    // 直接翻译，可能 namespace 还没加载完成
    return <span>{t(i18nKey, resolvedParams)}</span>;
};

// 修复后
const I18nSegment: React.FC<{...}> = ({ ns, i18nKey, params, paramI18nKeys }) => {
    const { t, ready } = useTranslation(ns);
    
    // 等待 namespace 加载完成
    if (!ready) {
        return <span>{i18nKey}</span>;
    }
    
    // namespace 加载完成后再翻译
    return <span>{t(i18nKey, resolvedParams)}</span>;
};
```

## UID 格式说明

Cardia 卡牌 UID 格式：`{defId}_{timestamp}_{random}`

示例：
- defId: `deck_i_card_09`（4 个下划线分隔的部分）
- timestamp: `1775881348955`
- random: `eiii1tdrz`
- 完整 UID: `deck_i_card_09_1775881348955_eiii1tdrz`

提取 defId 的逻辑：
```typescript
const defId = cardIdOrUid.split('_').slice(0, 4).join('_');
```

## i18n Namespace 加载机制

- 核心 namespaces（`common`, `game`, `lobby` 等）在应用启动时预加载
- 游戏专属 namespaces（`game-cardia`, `game-dicethrone` 等）按需加载
- `useTranslation(ns)` 会触发 namespace 加载，但加载是异步的
- `ready` 标志表示 namespace 是否已加载完成
- 在 `ready=false` 时翻译会返回原始 key 和未替换的参数

## 验证结果

### 单元测试

1. **cardPreviewHelper.test.ts**:
   ```typescript
   it('应该从 UID 提取 defId 并获取卡牌预览元数据', () => {
       const meta = getCardiaCardPreviewMeta('deck_i_card_09_1775881348955_eiii1tdrz');
       expect(meta).not.toBeNull();
       expect(meta?.name).toBe('cards.deck_i_card_09.name');
   });
   ```
   **结果**: ✅ 所有测试通过（9 个测试）

2. **actionLog-format.test.ts**:
   ```typescript
   it('应该生成包含卡牌和遭遇位置的日志条目', () => {
       // 验证 segments 结构和参数
       expect(entry.segments[2]).toMatchObject({
           type: 'i18n',
           ns: 'game-cardia',
           key: 'actionLog.toSlot',
           params: { slot: 0 },
       });
   });
   ```
   **结果**: ✅ 所有测试通过（2 个测试）

### E2E 测试

运行 `cardia-action-log.e2e.ts`：

**结果**: ✅ 所有 4 个测试用例通过

### ESLint 检查

**结果**: ✅ 0 errors

### i18n 检查

运行 `npm run i18n:check`：

**结果**: ✅ 无缺失 keys

## 修复文件

1. `src/games/cardia/ui/cardPreviewHelper.ts` - 修复 UID 解析逻辑
2. `src/components/game/framework/widgets/ActionLogSegments.tsx` - 修复 i18n namespace 加载等待
3. `src/games/cardia/__tests__/cardPreviewHelper.test.ts` - 新增单元测试
4. `src/games/cardia/__tests__/actionLog-format.test.ts` - 新增格式化测试

## 预期效果

修复后，UI 行为日志应该正确显示：
- ✅ "打出发明家到遭遇 0"（而不是 "打出发明家到遭遇 {{slot}}"）
- ✅ 卡牌名称正确翻译为中文
- ✅ 参数占位符正确替换为实际值
- ✅ 卡牌名称支持 hover 预览
- ✅ 即使在 namespace 加载过程中也不会显示错误的占位符

## 技术细节

### ActionLog 数据流

1. **命令执行** → 生成事件（包含 cardUid）
2. **formatCardiaActionEntry** → 调用 `buildCardSegment(cardUid)`
3. **buildCardSegment** → 调用 `getCardiaCardPreviewMeta(cardUid)`
4. **getCardiaCardPreviewMeta** → 从 UID 提取 defId → 查询 cardRegistry
5. **返回 CardPreviewMeta** → 包含 nameKey 和 previewRef
6. **UI 渲染** → ActionLogSegments 组件等待 namespace 加载
7. **namespace 加载完成** → 翻译 i18n key 并替换参数
8. **最终显示** → 完整的中文日志条目

### 为什么需要等待 namespace 加载

- i18next 的 `useTranslation(ns)` 会触发异步加载
- 在加载完成前，`t(key, params)` 会返回原始 key
- 参数插值也不会工作，导致显示 `{{slot}}` 这样的占位符
- 使用 `ready` 标志可以确保只在加载完成后才翻译
- 在加载期间显示原始 key 比显示错误的占位符更好

## 相关文件

- `src/games/cardia/actionLog.ts` - ActionLog 格式化逻辑
- `src/games/cardia/ui/cardPreviewHelper.ts` - 卡牌预览辅助函数
- `src/components/game/framework/widgets/ActionLogSegments.tsx` - UI 渲染组件
- `public/locales/zh-CN/game-cardia.json` - 中文翻译
- `public/locales/en/game-cardia.json` - 英文翻译
- `src/lib/i18n/index.ts` - i18n 初始化配置
- `src/lib/i18n/namespaces.ts` - namespace 定义
