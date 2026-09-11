# Mage Wars 首页弹窗旧资源反馈关闭证据（2026-09-11）

## 本轮口径

- 反馈 ID：`6aa2015361ba00ac3b6485ee`
- 处理口径：线上真实反馈
- 诊断包：`temp/feedback-closeout/2026-09-11T00-34-recheck-before-close/6aa2015361ba00ac3b6485ee.md`
- 真实写回入口：无管理 token，使用生产 Mongo SSH 写入口
- 检查时间：北京时间 2026-09-11 00:34

## 反馈原文

```text
[auto][home-modal-error-boundary] getMageWarsDefaultSpellbookEntries is not defined
```

## 当前现场

- 现实含义：玩家打开首页 Mage Wars 详情弹窗时触发首页弹窗错误边界，报错内容是 Mage Wars 默认法术书读取函数在运行时未定义。
- 反馈堆栈里的旧资源是 `http://8.148.71.102/assets/runtimeAdapter-DQTZbN9F.js`。
- 当前生产入口 HTML 引用的是 `/assets/index-2HKUwlwe.js`、`/assets/vendor-runtime-Cpj98o6Y.js`、`/assets/vendor-react-Dy9NzIkc.js`、`/assets/vendor-i18n-lDyozFiN.js`。
- 当前直接请求旧资源 `http://8.148.71.102/assets/runtimeAdapter-DQTZbN9F.js` 返回 `404 Not Found`，说明该旧 chunk 已不再是现存线上入口。
- 当前源码 `src/games/mage-wars/runtimeAdapter.tsx` 通过 `resolveMageWarsSpellbookEntriesForSeat` 和 `buildMageWarsMageSetupData` 读取默认法术书，没有直接引用未导入的 `getMageWarsDefaultSpellbookEntries`。

## 验证

```text
node --input-type=module -e "<Playwright current production pageerror check>"
```

- 当前生产首页 Mage Wars 参数入口 `http://8.148.71.102/?homeStyle=classic&game=mage-wars` 连续 3 次返回 200。
- Playwright 每次加载 10 秒均未捕获 `pageerror`。
- 捕获到的浏览器错误中没有 `getMageWarsDefaultSpellbookEntries`、`ReferenceError` 或同名报错。

## 结论

- 该反馈命中的是已经下线的旧前端资源。
- 本轮没有改 Mage Wars 法术书数据、法师选择逻辑或首页弹窗结构。
- 按“当前线上入口已不再复现旧资源报错”关闭该反馈；不把它表述为本轮新增代码修复。
