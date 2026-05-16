# 项目地图（超详细目录树）

> 目标：把项目目录结构作为“地图”使用。当用户只说功能名时，先从这里定位到对应目录/文件，再进入代码。
> 
> 约束：本文件只基于仓库实际文件结构生成，不解读代码内容。

## Repo Root

```
/ (repo root)
├── AGENTS.md
├── server.ts
├── src/
├── server/
├── public/
├── scripts/
├── docs/
├── openspec/
├── e2e/
├── test/
├── docker/
├── design/
├── evidence/
└── screenshots/
```

## src/

### 重点模块速记（功能边界）

- `src/components/system/`：系统级 UI 浮层聚合区（悬浮球/Fab、全局 HUD、Modal 栈渲染根、Toast 视口、引擎通知监听）。
- `src/contexts/`：全局状态与服务注入点（Auth/Audio/ModalStack/Undo/Rematch/GameMode 等）。
- `src/services/`：独立的实时通道（match/lobby/social socket），用于大厅/社交/重赛投票等。
- `src/engine/systems/`：引擎插件系统（Undo/Prompt/Flow/Rematch/Tutorial/ResponseWindow/Log 等），通过 hook 介入 command/event 管线。

```
src/
├── App.tsx
├── index.css
├── main.tsx
├── api/
├── assets/
├── components/
├── config/
├── contexts/                    # 全局状态/服务注入点（Auth/Audio/Modal/Undo/Rematch/Social/Toast/Tutorial/Debug）
├── core/
├── engine/                      # 引擎层（确定性规则核心 + 系统管线）
├── games/
├── hooks/
├── lib/
├── pages/
├── server/                       # 服务端共享模块（db/邮件/存储/模型；被 server.ts 使用）
├── services/
├── shared/
├── systems/
├── types/
└── ugc/
```

### src/components/

```
src/components/
├── GameDebugPanel.tsx
├── __tests__/
│   ├── actionLogFormat.test.ts
│   ├── GameHUDChatPreview.test.ts
│   └── ManifestGameThumbnail.test.tsx
├── auth/
│   ├── AdminGuard.tsx
│   ├── AuthModal.tsx
│   ├── AvatarUpdateModal.tsx
│   ├── EmailBindModal.tsx
│   └── ...
├── common/
│   ├── 🛡️ common/agents.md
│   ├── SEO.tsx
│   ├── animations/
│   │   ├── CardDrawAnimation.tsx
│   │   ├── FlyingEffect.tsx
│   │   ├── HitStopContainer.tsx
│   │   ├── ImpactContainer.tsx
│   │   ├── index.ts
│   │   ├── PulseGlow.tsx
│   │   ├── ShakeContainer.tsx
│   │   ├── SlashEffect.tsx
│   │   ├── variants.ts
│   │   └── VictoryParticles.tsx
│   ├── feedback/
│   │   └── ToastItem.tsx
│   ├── i18n/
│   │   └── LanguageSwitcher.tsx
│   ├── labels/
│   │   └── HoverOverlayLabel.tsx
│   ├── media/
│   │   ├── CardPreview.tsx
│   │   └── OptimizedImage.tsx
│   └── overlays/
│       ├── ConfirmModal.tsx
│       ├── InfoTooltip.tsx
│       ├── MagnifyOverlay.tsx
│       ├── ModalBase.tsx
│       └── PasswordEntryModal.tsx
├── game/
│   ├── actionLogFormat.ts
│   ├── AudioControlSection.tsx
│   ├── EndgameOverlay.tsx
│   ├── GameControls.tsx
│   ├── GameHUD.tsx
│   ├── index.ts
│   ├── RematchActions.tsx
│   ├── UndoFab.tsx
│   └── framework/
│       ├── BoardLayoutEditor.tsx
│       ├── BoardLayoutRenderer.tsx
│       ├── CharacterSelectionSkeleton.tsx
│       ├── HandAreaSkeleton.tsx
│       ├── index.ts
│       ├── PhaseIndicatorSkeleton.tsx
│       ├── PlayerPanelSkeleton.tsx
│       ├── presets.tsx
│       ├── ResourceTraySkeleton.tsx
│       ├── SpotlightSkeleton.tsx
│       ├── types.ts
│       ├── debug/
│       │   ├── cardNameResolver.ts
│       │   └── __tests__/
│       │       └── cardNameResolver.test.ts
│       └── hooks/
│           ├── index.ts
│           ├── useAutoSkipPhase.ts
│           ├── useDragCard.ts
│           ├── useGameBoard.ts
│           ├── useHandArea.ts
│           ├── useResourceTray.ts
│           └── useVisualSequenceGate.ts
├── layout/
│   └── CategoryPills.tsx
├── lobby/
│   ├── CreateRoomModal.tsx
│   ├── GameDetailsModal.tsx
│   ├── GameList.tsx
│   └── thumbnails.tsx
├── review/
│   ├── ApprovalBar.tsx
│   ├── GameReviewSection.tsx
│   ├── ReviewForm.tsx
│   ├── ReviewItem.tsx
│   ├── ReviewList.tsx
│   └── ...
├── social/
│   ├── ChatWindow.tsx
│   ├── FriendList.tsx
│   ├── FriendsChatModal.tsx
│   ├── MatchHistoryModal.tsx
│   └── UserMenu.tsx
├── system/
│   ├── FabMenu.tsx                  # 悬浮球/悬浮菜单组件（拖拽定位 + 展开卫星按钮 + 侧边面板/tooltip/preview）
│   ├── GlobalHUD.tsx                # 非游戏页的全局 HUD：装配 FabMenu 菜单项（设置/全屏/关于/反馈/社交）
│   ├── ModalStackRoot.tsx           # 全局弹窗栈渲染根：Portal 到 #modal-root + ESC 关闭 + 滚动锁 + AnimatePresence
│   ├── ToastViewport.tsx            # 全局 Toast 视口：固定右上角渲染 ToastItem 列表
│   ├── EngineNotificationListener.tsx # 引擎通知监听：接收 ENGINE_NOTIFICATION_EVENT 并转成 i18n/toast warning（dedupe）
│   ├── AboutModal.tsx               # “关于”弹窗（由 GlobalHUD 触发）
│   └── FeedbackModal.tsx            # “反馈”弹窗：带登录校验，POST 到管理端 feedback API
└── tutorial/
    ├── TUTORIAL.md
    └── TutorialOverlay.tsx
```

注：悬浮球/悬浮菜单入口在 `src/components/system/FabMenu.tsx`。

### src/pages/

```
src/pages/
├── admin/
│   ├── Feedback.tsx
│   ├── index.tsx
│   ├── Matches.tsx
│   ├── UserDetail.tsx
│   ├── Users.tsx
│   └── components/
│       ├── AdminLayout.tsx
│       ├── DataTable.tsx
│       └── StatsCard.tsx
└── ...（Home.tsx / MatchRoom.tsx 等见 src/ 顶层文件列表）
```

### src/contexts/

```
src/contexts/
├── AuthContext.tsx              # 登录态/JWT：token+user 持久化到 localStorage，提供 login/register/logout/邮箱验证/改密/头像更新
├── AudioContext.tsx             # 音频状态：封装 AudioManager，提供 mute/音量/播放 SFX/BGM/播放列表
├── ModalStackContext.tsx        # 弹窗栈数据结构：openModal/closeModal/closeTop/replaceTop/closeAll（渲染由 ModalStackRoot 负责）
├── ToastContext.tsx             # Toast 状态：show/success/info/warning/error + dedupeKey 去重 + TTL 自动消失
├── SocialContext.tsx            # 社交状态：好友/请求/会话/未读；HTTP 拉取 + socialSocket 事件驱动刷新
├── RematchContext.tsx           # 多人重赛投票：封装 matchSocket 的 join/vote/reset/newRoom；主机用 LobbyClient playAgain 创建新房间
├── UndoContext.tsx              # 撤销 UI 桥：用 useSyncExternalStore 暴露 UndoSystem 状态（pendingRequest/snapshots）并计算红点
├── TutorialContext.tsx          # 教学 UI 桥：绑定 moves 调用 TutorialSystem 命令；同步 tutorial state；支持 AI 动作自动执行/自动下一步
├── GameModeContext.tsx          # 模式注入：local/online/tutorial + spectator 标记，写入 window.__BG_GAME_MODE__
├── MatchRoomExitContext.tsx     # 退出对局能力：由 MatchRoom 注入 exitToLobby，供 HUD/按钮调用
└── DebugContext.tsx             # 调试玩家视角：持久化 debug_playerID，供调试面板/本地测试切换 playerID
```

### src/services/

```
src/services/
├── lobbySocket.ts               # 大厅实时订阅：房间列表/创建/更新/结束事件；带 version 防回退与强制刷新
├── matchSocket.ts               # 对局内 socket：重赛投票状态/触发 reset/调试新房间广播 + 对局聊天 join/send/message
└── socialSocket.ts              # 社交 socket：好友在线/离线/请求/新消息/邀请等事件；token 变更复用连接并本地分发监听
```

### src/lib/

```
src/lib/
├── audio/
│   ├── AudioManager.ts
│   ├── SynthAudio.ts
│   ├── audioRouting.ts
│   ├── audioUtils.ts
│   ├── common.config.ts
│   ├── mergeAudioConfigs.ts
│   ├── types.ts
│   ├── useGameAudio.ts
│   └── __tests__/
│       ├── audioRouting.test.ts
│       └── audioUtils.test.ts
└── i18n/
    └── ...
```

### src/games/

```
src/games/
├── archview/
│   └── manifest.ts
├── assetslicer/
│   └── manifest.ts
├── audiobrowser/
│   └── manifest.ts
├── cardia/
│   ├── domain/
│   ├── Board.tsx
│   ├── game.ts
│   ├── manifest.ts
│   └── tutorial.ts
├── dicethrone/
│   ├── __tests__/
│   ├── audio.config.ts
│   ├── barbarian/
│   ├── monk/
│   ├── rule/
│   │   └── 王权骰铸规则.md
│   ├── ui/
│   ├── Board.tsx
│   ├── conditions.ts
│   ├── debug-config.tsx
│   ├── game.ts
│   ├── index.ts
│   ├── manifest.ts
│   ├── thumbnail.tsx
│   ├── tutorial.ts
│   └── types.ts
├── fxpreview/
│   └── manifest.ts
├── qidahen/
│   ├── rule/
│   ├── Board.tsx
│   ├── game.ts
│   └── manifest.ts
├── smashup/
│   ├── __tests__/
│   ├── abilities/
│   ├── domain/
│   ├── ui/
│   ├── Board.tsx
│   ├── game.ts
│   └── manifest.ts
├── splendor/
│   ├── domain/
│   ├── ui/
│   ├── Board.tsx
│   ├── game.ts
│   ├── manifest.ts
│   └── tutorial.ts
├── summonerwars/
│   ├── config/
│   ├── domain/
│   ├── ui/
│   ├── Board.tsx
│   ├── game.ts
│   ├── index.ts
│   ├── manifest.ts
│   ├── thumbnail.tsx
│   └── tutorial.ts
├── tictactoe/
│   ├── __tests__/
│   ├── audio.config.ts
│   ├── domain/
│   ├── Board.tsx
│   ├── game.ts
│   ├── manifest.ts
│   ├── thumbnail.tsx
│   └── tutorial.ts
├── ugc-wrapper/
│   └── game.ts
├── manifest.ts
├── manifest.client.generated.tsx
├── manifest.client.tsx
├── manifest.server.ts
├── manifest.server.types.ts
├── manifest.types.ts
└── registry.ts
```

### src/ugc/

```
src/ugc/
├── index.ts
├── __tests__/
├── assets/
│   ├── index.ts
│   └── types.ts
├── builder/
│   ├── index.ts
│   ├── types.ts
│   ├── __tests__/
│   ├── ai/
│   │   ├── PromptGenerator.ts
│   │   ├── hooks/
│   │   │   └── index.ts
│   │   ├── index.ts
│   │   ├── promptUtils.ts
│   │   └── usePromptGenerator.ts
│   ├── context/
│   │   ├── BuilderContext.tsx
│   │   └── index.ts
│   ├── pages/
│   │   └── UnifiedBuilder.tsx
│   ├── schema/
│   │   ├── index.ts
│   │   └── types.ts
│   ├── ui/
│   │   ├── DataTable.tsx
│   │   ├── index.ts
│   │   ├── RenderPreview.tsx
│   │   └── SceneCanvas.tsx
│   └── utils/
│       ├── resolvePlayerContext.ts
│       └── validateAbilityJson.ts
└── client/
    └── types.ts
```

## docs/

```
docs/
├── api/
│   ├── README.md
│   ├── admin.md
│   ├── auth.md
│   ├── friend.md
│   ├── invite.md
│   ├── message.md
│   └── review.md
├── audio/
│   ├── compressed-stats.txt
│   ├── migration-log.csv
│   ├── migration-plan-from-source-zips.md
│   └── prune-deleted.csv
├── components/
│   ├── GameHUD-Undo-Integration.md
│   ├── UndoFab-CHANGELOG.md
│   └── UndoFab.md
├── design/
│   └── gas-style-ability-system.md
├── framework/
│   ├── backend.md
│   ├── board-layout.md
│   └── frontend.md
├── refactor/
│   └── dicethrone-hand-area-refactor.md
├── automated-testing.md
├── debug-tool-refactor.md
├── deploy.md
├── dicethrone-audio-plan.md
├── dicethrone-i18n.md
├── mongodb-16mb-fix.md
├── sprite-rendering-lessons.md
├── test-mode.md
├── tools.md
└── ugc-builder.md
```

## scripts/

```
scripts/
├── audio/                          # 音频相关
│   ├── compress_audio.js
│   ├── generate_common_audio_registry.js
│   ├── generate_ai_audio_registry.js
│   ├── generate_ai_audio_registry_dicethrone.js
│   ├── generate_audio_assets_md.js
│   ├── check-audio-assets.cjs
│   ├── merge_audio_translations.js
│   ├── migrate_audio_assets.ps1
│   ├── admin-archive-refactor-audio.ps1
│   └── admin-move-tictactoe-audio.ps1
├── assets/                         # 图片/图集/资源
│   ├── compress_images.js / .py
│   ├── atlas_grid_scan.js / .py
│   ├── pack_sprite_atlas.js / .py
│   ├── scan_sprite_bounds.py
│   ├── scan_atlas_to_file.py
│   ├── generate_uniform_atlas.cjs
│   ├── check_edges.py
│   ├── profile_scan.py
│   ├── extract_assets.js
│   ├── generate_asset_manifests.js
│   └── upload-to-r2.js
├── deploy/                         # 部署
│   ├── deploy-auto.sh
│   ├── deploy-image.sh
│   └── deploy-quick.sh
├── db/                             # 数据库
│   ├── cleanup-db.ts
│   ├── init_admin.ts
│   └── diagnose-rooms.ts
├── game/                           # 游戏相关
│   ├── generate_game_manifests.js
│   ├── generate-card-locales.cjs
│   └── fix_dicethrone_ids_mistake.cjs
├── ugc/                            # UGC
│   ├── ugc-generate-preview.mjs
│   └── ugc-publish-preview.mjs
├── infra/                          # 基础设施
│   ├── clean_ports.js
│   ├── wait_for_ports.js
│   ├── simulate-host.ts
│   ├── verify_social_ws.ts
│   ├── check-architecture.cjs
│   └── pdf_to_md.js
├── verify/                         # 验证
│   └── social-ws.ts
├── alipan_save_tool/               # 阿里云盘转存
│   ├── README.txt
│   ├── alipan_save.py
│   ├── alipan_secrets.example.json
│   ├── run.bat
│   └── run.ps1
└── image-viewer-mcp/               # MCP 图片查看器
```

## openspec/

```
openspec/
├── 🛡️ AGENTS.md
├── project.md
├── specs/
│   ├── backend-platform/spec.md
│   ├── dice-system/spec.md
│   ├── flow-system/spec.md
│   ├── friend-system/spec.md
│   ├── game-invite/spec.md
│   ├── game-registry/spec.md
│   ├── i18n/spec.md
│   ├── manage-modals/spec.md
│   ├── match-archive/spec.md
│   ├── messaging/spec.md
│   ├── review-backend/spec.md
│   ├── review-frontend/spec.md
│   ├── social-widget/spec.md
│   ├── tutorial-engine/spec.md
│   ├── ugc-asset-processing/spec.md
│   ├── ugc-prototype-builder/spec.md
│   ├── ugc-runtime/spec.md
│   └── undo-system/spec.md
└── changes/
    └── ...（每个变更一个目录，含 proposal/design/specs/tasks）
```
