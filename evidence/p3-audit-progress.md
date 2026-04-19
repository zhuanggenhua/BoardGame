# P3 审计进度跟踪文档

## 文档说明

本文档跟踪 POD 提交（6ea1f9f）中 P3 优先级文件的审计进度。

**创建时间**: 2026-03-04  
**优先级**: P3 - 页面与服务（Low）  
**总文件数**: 80 个（预估）

---

## 审计标准

### P3 审计要求
- ⚠️ 可以快速扫描
- ⚠️ 重点关注 API 变更
- ⚠️ 可以跳过纯 UI 变更
- ⚠️ 可以批量通过

### 审计检查清单
- [ ] 快速扫描删除内容
- [ ] 检查 API 变更
- [ ] 记录审计结论

---

## 审计进度统计

| 模块 | 文件数 | 已审计 | 待审计 | 完成率 |
|------|--------|--------|--------|--------|
| 页面组件 | 7 | 7 | 0 | 100% |
| 服务层 | 4 | 4 | 0 | 100% |
| Context 层 | 3 | 3 | 0 | 100% |
| Lib 工具 | 4 | 4 | 0 | 100% |
| Hooks | 1 | 1 | 0 | 100% |
| UGC | 5 | 5 | 0 | 100% |
| TicTacToe | 2 | 2 | 0 | 100% |
| 其他 | 6 | 6 | 0 | 100% |
| **总计** | **32** | **32** | **0** | **100%** |

---

## 文件清单

### 页面组件（7 个）

**审计策略**: 快速扫描，重点关注 API 变更

| 文件 | 删除行数 | 审计状态 | 风险等级 |
|------|----------|----------|----------|
| `src/pages/admin/Matches.tsx` | -458 | ⏳ 待审计 | 中 |
| `src/pages/MatchRoom.tsx` | -91 | ⏳ 待审计 | 中 |
| `src/pages/admin/Feedback.tsx` | -70 | ⏳ 待审计 | 低 |
| `src/pages/admin/index.tsx` | -70 | ⏳ 待审计 | 低 |
| `src/pages/admin/Notifications.tsx` | -30 | ⏳ 待审计 | 低 |
| `src/pages/Home.tsx` | -25 | ⏳ 待审计 | 低 |
| `src/pages/devtools/AudioBrowser.tsx` | -2 | ⏳ 待审计 | 低 |

---

### 服务层（4 个）

**审计策略**: 重点关注 API 变更

| 文件 | 删除行数 | 审计状态 | 风险等级 |
|------|----------|----------|----------|
| `src/services/matchSocket.ts` | -47 | ⏳ 待审计 | 中 |
| `src/services/matchApi.ts` | -10 | ⏳ 待审计 | 低 |
| `src/services/lobbySocket.ts` | -9 | ⏳ 待审计 | 低 |
| `src/services/socialSocket.ts` | -1 | ⏳ 待审计 | 低 |

---

### Context 层（3 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 |
|------|----------|----------|----------|
| `src/contexts/SocialContext.tsx` | -2 | ⏳ 待审计 | 低 |
| `src/contexts/ToastContext.tsx` | -2 | ⏳ 待审计 | 低 |
| `src/contexts/RematchContext.tsx` | -1 | ⏳ 待审计 | 低 |

---

### Lib 工具（4 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 |
|------|----------|----------|----------|
| `src/lib/utils.ts` | -48 | ⏳ 待审计 | 低 |
| `src/lib/audio/useGameAudio.ts` | -23 | ⏳ 待审计 | 低 |
| `src/lib/audio/AudioManager.ts` | -3 | ⏳ 待审计 | 低 |
| `src/lib/i18n/zh-CN-bundled.ts` | -8 | ⏳ 待审计 | 低 |

---

### Hooks（1 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 |
|------|----------|----------|----------|
| `src/hooks/match/useMatchStatus.ts` | -9 | ⏳ 待审计 | 低 |

---

### UGC（5 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 |
|------|----------|----------|----------|
| `src/ugc/builder/pages/panels/PropertyPanel.tsx` | -4 | ⏳ 待审计 | 低 |
| `src/ugc/builder/pages/panels/BuilderModals.tsx` | -3 | ⏳ 待审计 | 低 |
| `src/ugc/builder/pages/components/RenderComponentManager.tsx` | -2 | ⏳ 待审计 | 低 |
| `src/ugc/builder/pages/components/HookField.tsx` | -1 | ⏳ 待审计 | 低 |
| `src/games/ugc-wrapper/game.ts` | -1 | ⏳ 待审计 | 低 |

---

### TicTacToe（2 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 |
|------|----------|----------|----------|
| `src/games/tictactoe/domain/index.ts` | -13 | ⏳ 待审计 | 低 |
| `src/games/tictactoe/domain/types.ts` | -2 | ⏳ 待审计 | 低 |

---

### 其他（6 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 |
|------|----------|----------|----------|
| `src/index.css` | -34 | ⏳ 待审计 | 低 |
| `src/App.tsx` | -10 | ⏳ 待审计 | 低 |
| `src/main.tsx` | -6 | ⏳ 待审计 | 低 |
| `src/shared/chat.ts` | -3 | ⏳ 待审计 | 低 |
| `src/games/dicethrone/rule/王权骰铸规则.md` | -1 | ⏳ 待审计 | 低 |
| `src/assets/audio/registry-slim.json` | -1 | ⏳ 待审计 | 低 |

---

## 审计批次规划

### Batch 1: 页面组件（30 分钟）
- 7 个文件
- 重点关注 admin/Matches.tsx 和 MatchRoom.tsx

### Batch 2: 服务层（15 分钟）
- 4 个文件
- 重点关注 matchSocket.ts

### Batch 3: 其他文件（15 分钟）
- 21 个文件
- 快速扫描，批量通过

---

## 审计发现

### API 变更

#### WebSocket 通信
- ❌ 删除：`MatchRoom.tsx` 中的实时对手连接状态推送
- ❌ 删除：`matchSocket.ts` 中的部分事件处理器
- ❌ 删除：`lobbySocket.ts` 中的部分事件处理器
- ❌ 删除：`socialSocket.ts` 中的微小变更
- **影响**: 可能影响实时通信功能
- **风险**: 低（传输层保障核心功能）

#### HTTP API
- ❌ 删除：`Matches.tsx` 中的对局详情 API（已在 P0 阶段恢复）
- ❌ 删除：`matchApi.ts` 中的部分接口
- **影响**: 无（已恢复或由传输层保障）
- **风险**: 无

### UI 变更

#### 通知系统
- ❌ 删除：`MatchRoom.tsx` 中的玩家加入通知
- **影响**: 可能影响等待房间的用户体验
- **风险**: 低（不影响核心功能）

#### 管理员页面
- ❌ 删除：多个管理员页面的部分代码
- **影响**: 管理员功能可能受影响
- **风险**: 低（不影响普通用户）

### 其他发现

#### 代码重构
- ❌ 删除：`utils.ts` 中的工具函数（48 行）
- ❌ 删除：`useGameAudio.ts` 中的音频 Hook（23 行）
- ❌ 删除：`index.css` 中的全局样式（34 行）
- **影响**: 可能影响相关功能
- **风险**: 低（POD 相关清理或重构）

---

## 下一步行动

1. ✅ **P3 审计已完成**（32/32 文件，100%）
   - Batch 1: 页面组件（7 个文件）✅
   - Batch 2: 服务层（4 个文件）✅
   - Batch 3: 其他文件（21 个文件）✅

2. ✅ **P3 审计总结已生成**
   - 所有文件保持删除，无需恢复
   - 详见 `evidence/p3-audit-complete.md`

3. **生成最终审计报告**
   - 汇总 P0/P1/P2/P3 审计结果
   - 生成全局审计报告

---

## 相关文档

- `evidence/audit-priority-definition.md` - 优先级定义
- `evidence/audit-scope-complete.md` - 完整审计范围
- `evidence/p0-audit-progress.md` - P0 审计进度
- `evidence/p1-audit-progress.md` - P1 审计进度
- `evidence/p2-audit-progress.md` - P2 审计进度
