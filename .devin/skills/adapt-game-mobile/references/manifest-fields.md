# Manifest 字段约定

本 skill 只接受以下字段命名，不接受别名。

## 批准字段

```ts
mobileProfile: 'none' | 'landscape-adapted' | 'portrait-adapted' | 'tablet-only';
preferredOrientation?: 'landscape' | 'portrait';
mobileLayoutPreset?: 'board-shell' | 'portrait-simple';
shellTargets?: Array<'pwa' | 'app-webview' | 'mini-program-webview'>;
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

### `shellTargets`

- 默认 `['pwa']`。
- 仅在 H5 横屏适配通过后，再加 `app-webview`。
- 仅在 H5 横屏适配通过、且业务域名/登录/分享/拉起链路明确后，再加 `mini-program-webview`。

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
