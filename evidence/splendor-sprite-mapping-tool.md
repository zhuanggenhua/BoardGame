# Splendor 雪碧图映射工具证据

更新时间：2026-03-28

## 文档定位

- 本文档对应 [splendor-feature-matrix.md](./splendor-feature-matrix.md) 中“雪碧图映射工具”的证据沉淀。
- 本文档只记录 `/dev/slicer?mode=splendor-mapping` 工具页相关实现与验证。

## 对应总表条目

- 雪碧图映射工具

## 覆盖范围

本文件覆盖以下能力：

1. 映射真值文件独立维护
2. 运行时从映射配置读取卡牌/贵族雪碧图顺序
3. 页面化工具支持切换图集、选中格子、替换模型 ID、导出配置
4. 基础映射完整性与顺序约束自动校验

## 对应用例与命令

### Vitest

```bash
fnm exec --using 24.1.0 -- node .\node_modules\vitest\vitest.mjs run src/games/splendor --configLoader native
```

### E2E

```bash
npm run test:e2e:ci:file -- e2e/splendor.e2e.ts "Splendor：映射工具应支持切换图集并导出当前映射配置"
```

## 自动化结果

- Splendor 领域测试：65/65 通过
- 映射工具专门 E2E：1/1 通过
- Splendor 全量 E2E：11/11 通过

## 证据截图

<a id="mapping-tool"></a>
- `test-results/evidence-screenshots/splendor.e2e/Splendor：映射工具应支持切换图集并导出当前映射配置/splendor-mapping-tool.png`

## 验证点

### 1. 数据与代码结构

- `src/games/splendor/spriteMapping.ts` 作为映射真值文件存在。
- `src/games/splendor/sprites.ts` 读取映射配置，而不再手写分散顺序。

### 2. 页面化工具能力

- 页面成功进入 `splendor` 映射校对模式。
- 左侧显示图集切换、当前格子、校验与导出面板。
- 主区显示雪碧图格子网格。
- 右侧显示当前图集对应的数据模型列表。

### 3. 自动化验证到的交互

- 切换到贵族图集。
- 修改第 1 格映射为 `noble-2`。
- 导出内容正确反映顺序交换结果。

## 备注

- 本文档与 [splendor-feature-matrix.md](./splendor-feature-matrix.md) 保持一一对应。
- 若未来继续扩展工具能力，应同步更新总表中的“雪碧图映射工具”条目与本文档的“覆盖范围/验证点”。
