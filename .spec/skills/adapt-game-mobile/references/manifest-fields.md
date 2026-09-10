# Manifest 字段约定

本 skill 只接受以下字段命名，不接受别名。

## 批准字段

```ts
mobileProfile: 'none' | 'landscape-adapted' | 'portrait-adapted' | 'tablet-only';
preferredOrientation?: 'landscape' | 'portrait';
mobileLayoutPreset?: 'board-shell' | 'portrait-simple' | 'map-shell';
shellTargets?: Array<'pwa' | 'app-webview' | 'mini-program-webview'>;
mobileBoardShellLayout?: {
  designWidth?: number;
  designHeight?: number;
  referenceWidth?: number;
  referenceHeight?: number;
  minLogicalHeight?: number;
  minReadableScale?: number;
};
```

如果代码里还没合入这些字段，以 OpenSpec 为准，不要临时发明 `supportsMobile`、`mobileMode`、`responsive` 之类替代字段。

## 选择规则

### `mobileProfile`

- `none`
  - 不建议手机使用，只保留桌面降级或暂不暴露到壳。
- `landscape-adapted`
  - 默认值。
  - 适用于 PC 为主、信息密度较高、需要保留主棋盘或主桌面的复杂游戏。
- `portrait-adapted`
  - 只给天生适合竖屏的小型、轻量、低信息密度游戏。
- `tablet-only`
  - 平板可用，但手机横屏仍不足以提供可靠体验。

### `preferredOrientation`

- 复杂桌游默认 `landscape`。
- 只有在竖屏被明确设计为主形态时才用 `portrait`。

### `mobileLayoutPreset`

- `board-shell`
  - 默认值。
  - 适用于“保留桌面主画布 + 外围 HUD/侧栏/预览改为移动壳”的模式。
- `portrait-simple`
  - 只给本来就能在竖屏单列完成主循环的简单游戏。
- `map-shell`
  - 适用于地图本体需要独立缩放、平移或触摸手势，而玩家状态、手牌 / 法术书、计划区等界面对象需要避让真实设备 / 浏览器安全区的游戏；该字段不表示桌面端可以生成固定比例内框或自造摆放范围。

### `shellTargets`

- 默认 `['pwa']`。
- 仅在 H5 横屏适配通过后，再加 `app-webview`。
- 仅在 H5 横屏适配通过、且业务域名/登录/分享/拉起链路明确后，再加 `mini-program-webview`。

### `mobileBoardShellLayout`

- `designWidth` / `designHeight` 是外层固定画布尺寸，只用于 `scale = min(availableWidth / designWidth, availableHeight / designHeight)`。
- `referenceWidth` / `referenceHeight` 是壳内 UI 单位来源；当移动横屏设计画布与 PC 参考画布不同，必须显式声明 PC 参考尺寸，不能用移动画布宽度重算主按钮、阶段提示、手牌、HUD、token / 状态或牌桌对象尺寸。
- 未声明 `referenceWidth` / `referenceHeight` 时，壳内单位沿用设计画布尺寸，只用于旧实现兼容；不能把这个兼容默认当成 PC 同构通过证据。

## 推荐默认

对多数复杂桌游，直接从这个组合起步：

```ts
mobileProfile: 'landscape-adapted'
preferredOrientation: 'landscape'
mobileLayoutPreset: 'board-shell'
shellTargets: ['pwa']
```

## 命名冻结

不要使用这些命名：

- `supportsMobile`
- `mobileEnabled`
- `mobileMode`
- `responsiveMode`
- `webviewReady`

这些命名都太模糊，无法表达支持级别、方向偏好和容器目标。
