# Fate/Domination OpenDesign v4 审计

## 结论

`PASS`：v4 使用未标注真实棋盘，并在其上独立绘制测试交互层；可交给用户确认方向，仍保持 `not-approved`，不直接回填运行时。

## 证据

- OpenDesign 项目：`b4bb4fbb-ee71-4465-9e34-e4c24f397155`
- 当前 artifact：`fate-domination-v4-2.html`
- 真实棋盘：`assets/fuyuki-city.webp`
- 坐标参考：`repository-relative-reference-not-committed`，只用于定位，不进入画面
- 桌面：1920×1080，页面宽度 1920，无页面滚动
- 移动：390px 宽，页面宽度 390，无横向溢出
- 图片：17 张资源全部加载，0 broken image
- 热点：60 个可点击目标（20 个白色半透明区域热点 + 40 个积分轨道节点），默认测试标记开启
- OpenDesign lint：0 P0、0 P1、0 P2

## 交互检查

- 点击方格热点：热点显示 cyan 高亮，底部显示区域编号。
- 点击卡牌外沿检查按钮：打开检查弹层，不改变热点选择。
- 点击“测试标记”：隐藏/显示全部方格与字母覆盖层。
- 点击右下阶段控件：切换到“等待对手响应”示意状态。

## 方向核验

| 项目 | 结论 |
|---|---|
| 参考图用途 | PASS：只作为坐标参考，没有把 Fuyuki.webp 当作最终视觉素材。 |
| 可交互区域 | PASS：A1/A2、B1/B2/B3、C、D1/D2、E、F、G、H 均有独立覆盖层。 |
| 开放式牌桌 | PASS：中央棋盘、左右席位、顶部牌库、底部扇形手牌、右下阶段按钮保持开放构图。 |
| DiceThrone 手牌方向 | PASS：实体牌面重叠排列，选中上浮，检查入口在牌外沿。 |
