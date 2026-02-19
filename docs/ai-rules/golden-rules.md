# Golden Rules — 详细规范与代码示例

> 本文档是 `AGENTS.md` 的补充，包含历史教训的详细代码示例与排查流程。
> **触发条件**：遇到 React 渲染错误、白屏、函数未定义、高频交互卡顿/跳动时阅读。

---

## React Hooks 规则（强制）

> **禁止在条件语句或 return 之后调用 Hooks**。永远将 Hooks 置于组件顶部。

- **早期返回必须在所有 Hooks 之后**：`if (condition) return null` 这类早期返回必须放在所有 `useState`、`useEffect`、`useCallback`、`useMemo` 等 Hooks 调用之后，否则会导致 "Rendered more hooks than during the previous render" 错误。
- **典型错误模式**：
  ```tsx
  // ❌ 错误：useEffect 在早期返回之后
  const [position, setPosition] = useState(null);
  if (!position) return null;  // 早期返回
  useEffect(() => { ... }, []); // 这个 hook 在某些渲染中不会执行
  
  // ✅ 正确：所有 hooks 在早期返回之前
  const [position, setPosition] = useState(null);
  useEffect(() => { ... }, []); // 先声明所有 hooks
  if (!position) return null;  // 早期返回放最后
  ```

---

## React useEffect 执行时序（强制）

> **子组件的 effect 先于父组件执行**。React 渲染自上而下（parent → child），但 effect 执行自下而上（child → parent）。

- **核心规则**：当父子组件各有 `useEffect` 且存在依赖关系时，不能假设父组件的 effect 先执行。
- **典型陷阱**：父组件 effect 设置数据 → 子组件 effect 消费数据。实际执行顺序相反，子组件 effect 先跑，此时数据还没准备好。
- **教训案例**：
  ```
  MatchRoom（父）的 effect 调用 startTutorial() 设置 pendingStartRef
  Board（子）的 effect 调用 bindDispatch() 消费 pendingStartRef
  
  预期时序：startTutorial → bindDispatch（先设置再消费）
  实际时序：bindDispatch → startTutorial（子先于父，消费时数据为空）
  ```
- **解决方案**：跨组件 effect 通信时，必须处理两种时序——"生产者先执行"和"消费者先执行"。用 ref 暂存 + 双向检查：
  - 消费者先到：暂存消费能力（如 controller），等生产者到达时直接使用
  - 生产者先到：暂存数据（如 pendingStartRef），等消费者到达时消费
- **防重入条件必须区分"已完成"和"未开始"**：`controller 存在` 不等于 `教程已启动`，可能只是 Board 先挂载了。

---

## 白屏问题排查流程（强制）

> **白屏时禁止盲目修改代码**，必须先获取证据。

1. **第一步：运行 E2E 测试获取错误日志**
   ```bash
   npx playwright test e2e/<相关测试>.e2e.ts --reporter=list
   ```
2. **第二步：如果 E2E 无法捕获，请求用户提供浏览器控制台日志**
3. **第三步：根据错误信息定位问题**，常见白屏原因：
   - React Hooks 顺序错误（"Rendered more hooks than during the previous render"）
   - 组件渲染时抛出异常
   - 路由配置错误
   - 资源加载失败（404）
4. **禁止行为**：在没有错误日志的情况下"猜测"问题并随意修改代码

---

## Vite SSR 函数提升陷阱（强制）

> **Vite 的 SSR 转换会将 `function` 声明转为变量赋值，导致函数提升（hoisting）失效。**

- **问题**：原生 JS 中 `function foo() {}` 会被提升到作用域顶部，但 Vite SSR（vite-node）会将其转换为类似 `const foo = function() {}` 的形式，此时在定义之前引用会抛出 `ReferenceError: xxx is not defined`。
- **典型错误模式**：
  ```typescript
  // ❌ 错误：注册函数在文件上方，被引用的函数定义在文件下方
  export function registerAll(): void {
      registerAbility('foo', handler); // handler 还未定义！
  }
  // ... 200 行后 ...
  function handler(ctx: Context) { ... }
  
  // ✅ 正确：确保所有被引用的函数在注册调用之前定义，或将注册函数放在文件末尾
  function handler(ctx: Context) { ... }
  export function registerAll(): void {
      registerAbility('foo', handler); // handler 已定义
  }
  ```
- **规则**：在能力注册文件（`abilities/*.ts`）中，`register*Abilities()` 导出函数必须放在文件末尾，确保所有被引用的实现函数都已定义。

---

## const/let 声明顺序与 TDZ（强制）

> **`const`/`let` 声明不会提升，在声明语句之前引用会抛出 `ReferenceError: Cannot access 'xxx' before initialization`。**
> 在大型组件函数中尤其容易出现：中间插入条件分支引用了后面才声明的变量。

- **问题**：与 `var`（会提升为 `undefined`）不同，`const`/`let` 存在暂时性死区（Temporal Dead Zone），在声明行之前的任何引用都会直接报错导致白屏。
- **典型错误模式**：
  ```tsx
  // ❌ 错误：settingsAction 在声明前被引用
  if (useChatAsMain) {
      items.push(settingsAction); // ReferenceError!
  }
  const settingsAction: FabAction = { ... };

  // ✅ 正确：先声明，再引用
  const settingsAction: FabAction = { ... };
  if (useChatAsMain) {
      items.push(settingsAction);
  }
  ```
- **自检规则**：
  1. 新增/移动代码块时，检查块内引用的所有 `const`/`let` 变量是否已在上方声明
  2. 大型组件中插入条件分支时，特别注意分支内引用的变量声明位置
  3. 重构代码顺序后，用 `getDiagnostics` 验证无 TDZ 错误

---

## 高频交互规范

- **Ref 优先**：`MouseMove` 等高频回调优先用 `useRef` 避开 `useState` 异步延迟导致的跳动。
- **直操 DOM**：实时 UI 更新建议直接修改 `DOM.style` 绕过 React 渲染链以优化性能。
- **状态卫生**：在 `window` 监听 `mouseup` 防止状态卡死；重置业务时同步清空相关 Ref。
- **锚点算法**：建立 `anchorPoint` 逻辑处理坐标缩放与定位补偿，确保交互一致性。
- **拖拽回弹规范（DiceThrone）**：手牌拖拽回弹必须统一由外层 `motionValue` 控制；当 `onDragEnd` 丢失时由 `window` 兜底结束，并用 `animate(x/y → 0)` 手动回弹。禁止混用 `dragSnapToOrigin` 与手动回弹，避免二次写入导致回弹后跳位。
- **Hover 事件驱动原则**：禁止用 `whileHover` 处理"元素会移动到鼠标下"的场景（如卡牌回弹），否则会导致假 hover。应用 `onHoverStart/onHoverEnd` + 显式状态驱动，确保只有"鼠标进入元素"而非"元素移到鼠标下"才触发 hover。
- **拖拽回弹规则**：当需要回弹到原位时，**不要**关闭 `drag`，否则 `dragSnapToOrigin` 不会执行；应保持 `drag={true}` 并用 `dragListener` 控制是否可拖。

---

## AudioContext 异步解锁规范（强制）

> **`ctx.resume()` 是异步的，禁止在调用后立即同步检查 context 状态并依据结果决定是否播放。**

- **问题**：`AudioContext.resume()` 返回 Promise，调用后 `ctx.state` 可能仍为 `'suspended'`，导致紧跟其后的 `if (ctx.state === 'suspended')` 误判。这会导致“概率性”音频不播放——有时 resume 快则正常，有时慢则失败。
- **典型错误模式**：
  ```typescript
  // ❌ 错误：resume 是异步的，下一行 ctx.state 可能仍为 'suspended'
  ctx.resume();
  if (ctx.state === 'suspended') {
      // 误判为“仍未解锁”，跳过播放
      pendingKey = key;
      return;
  }
  howl.play();

  // ✅ 正确：等待 resume 完成后再播放
  ctx.resume().then(() => {
      howl.play();
  });
  ```
- **HTML5 Audio vs WebAudio**：BGM 使用 `html5: true` 走浏览器原生 `<audio>`，**不依赖 WebAudio context 状态**。禁止用 `isContextSuspended()` 阻止 HTML5 Audio 播放。若浏览器自动播放策略拦截，由 Howler 的 `onplayerror` 捕获并重试。
- **规则总结**：
  1. 禁止在 `ctx.resume()` 之后同步检查 `ctx.state` 并据此跳过播放
  2. 用户手势解锁处理中，必须 `await ctx.resume()` 或 `.then()` 后再播放
  3. BGM（`html5: true`）不受 WebAudio context 状态影响，不应用 `isContextSuspended()` 拦截
  4. 单独创建的 AudioContext（如 SynthAudio）也必须等待 resume 完成后再播放


---

## Bug 修复必须先 diff 原始版本（强制）

> **修 bug 时，禁止在未对比原始正常版本的情况下假设根因并重写代码。**

- **教训**：精灵图不显示，AI 假设"avif 格式不兼容 CSS background-image"，花大量时间尝试 `<picture>` + `<img>` + overflow:hidden / object-fit:none / 隐藏探测等复杂方案。实际根因是 `computeSpriteStyle` 在重构时把 `backgroundPosition` 公式从 `x / (imageW - cardW)` 改成了 `-x / (imageW - cardW)`——一个负号的差异。如果第一时间 `git show` 对比原始版本，一眼就能发现。
- **强制流程**：
  1. **先定位"最后正常工作"的版本**：`git log --oneline -N -- <文件>` 找到相关 commit
  2. **diff 当前代码与正常版本**：`git show <commit>:<file>` 或 `git diff <commit> -- <file>`
  3. **逐行对比变更点**，确认哪些改动引入了问题
  4. **只有在 diff 无法定位时**，才进入假设→验证→日志排查模式
- **反模式**：
  - ❌ 假设根因 → 重写整个组件 → 不行 → 换更复杂方案 → 循环
  - ❌ 连续多次"试试"不同方案而不质疑最初的假设
  - ✅ 先 diff → 发现变更点 → 验证变更点是否为根因 → 最小修复
- **适用场景**：任何"之前好好的，现在不行了"类型的 bug。尤其是重构/迁移后出现的回归问题。


---

## useEffect 中无条件 setState 导致不必要的 unmount/remount（强制）

> **"刷新就好"类 bug，第一时间排查哪些 useEffect 会触发子树 unmount/remount。**

- **问题模式**：`useEffect` 中无条件执行 `setState(false)` 再异步 `setState(true)`，即使值已经是 `true`。当该 state 控制子树是否渲染（如 `if (!ready) return <Loading />`），会导致子树先卸载再重新挂载。子树中的 ref 在第一次挂载时被设置，卸载时不会重置（ref 属于父组件），第二次挂载时因 ref 残留而跳过关键逻辑。
- **典型错误模式**：
  ```tsx
  // ❌ 错误：namespace 已加载时仍然 false→true 翻转，导致子树 unmount/remount
  useEffect(() => {
      setIsReady(false);  // 即使已经 ready，也先设为 false
      loadSomething().then(() => setIsReady(true));
  }, [dep]);

  // 子树中的 ref 在第一次挂载时设为 true，unmount 时不重置
  // 第二次挂载时 ref 仍为 true → 跳过初始化逻辑

  // ✅ 正确：已加载时跳过翻转
  useEffect(() => {
      if (isAlreadyLoaded(dep)) {
          setIsReady(true);
          return;
      }
      setIsReady(false);
      loadSomething().then(() => setIsReady(true));
  }, [dep]);
  ```
- **教训案例**：i18n namespace loading effect 无条件 `setIsGameNamespaceReady(false)`，从同游戏在线对局进入教程时 namespace 已加载，但仍触发 false→true 翻转 → `LocalGameProvider` 子树 unmount/remount → `tutorialStartedRef` 残留为 `true` → 第二次挂载时 `startTutorial` 被跳过 → 教程卡死。
- **排查规则**：遇到"刷新正常、导航过来不正常"的问题，优先检查：
  1. 哪些 `useEffect` 会在依赖不变时仍触发 `setState`？
  2. 该 `setState` 是否控制子树渲染（条件渲染 / early return）？
  3. 子树 unmount/remount 后，父组件的 ref 是否残留了旧值？

---

## 跨模式状态隔离（强制）

> **不同游戏模式（online/tutorial/local）之间的全局 Context 状态必须严格隔离。**

- **问题**：共享的 Context（如 `TutorialContext`）如果在所有模式下都同步状态，在线对局的状态会污染教程模式的初始条件，反之亦然。
- **典型错误模式**：
  ```tsx
  // ❌ 错误：所有模式都同步 tutorial 状态到全局 Context
  useTutorialBridge(G.sys.tutorial, dispatch);  // 在线模式也会执行

  // ✅ 正确：只在教程模式下同步
  useEffect(() => {
      if (!isTutorialMode) return;  // 非教程模式不同步
      context.syncTutorialState(tutorial);
  }, [tutorial, isTutorialMode]);
  ```
- **通用规则**：
  1. Bridge/Sync 类 Hook 必须有模式守卫，只在对应模式下执行写操作
  2. 模式切换时（如从在线对局返回再进教程），Context 的 cleanup 必须彻底重置状态
  3. 新增全局 Context 的 sync 逻辑时，自检：这个 sync 在其他模式下执行会不会污染状态？
