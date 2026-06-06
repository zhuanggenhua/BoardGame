# Change: 添加 Splendor 雪碧图映射校对/配置工具

## Why
`splendor` 当前的雪碧图校对依赖人工对照 `sprite-mapping.md`、`sprites.ts` 和实际图片，流程分散、修改成本高，也不利于后续继续校正卡牌与贵族图的映射关系。
需要一个页面化工具，把“雪碧图格子”和“卡牌/贵族数据模型”放到同一视图中进行校对与配置，降低人工验收与维护成本。

## What Changes
- 在现有 `assetslicer` 开发工具中新增 `splendor` 雪碧图映射校对/配置模式。
- 支持同时展示雪碧图格子和对应的卡牌/贵族数据模型，并允许在页面中建立/调整映射关系。
- 支持检测未映射、重复映射、缺失模型等问题，减少人工漏检。
- 支持导出映射配置，作为 `splendor` 运行时雪碧图顺序的单一真实来源。
- `splendor` 运行时从独立映射配置读取顺序，不再把人工维护逻辑分散在说明文档和多处手写数组中。

## Impact
- Affected specs: 新增 `sprite-mapping-tool` capability
- Affected code:
  - `src/pages/devtools/AssetSlicer.tsx`
  - `src/games/splendor/sprites.ts`
  - `src/games/splendor/__tests__/sprites.test.ts`
  - `src/games/splendor/` 下新增映射配置文件
  - `public/assets/splendor/sprite-mapping.md`
  - 可能新增 `evidence/` 与 E2E/单测
