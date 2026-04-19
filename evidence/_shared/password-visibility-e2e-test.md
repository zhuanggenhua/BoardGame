# 密码显隐按钮验证

## 范围

- 登录弹窗密码输入框增加右侧眼睛按钮。
- 共享密码输入组件同步复用到改密表单、创建房间密码、私密房间入场密码。

## 已执行验证

- `npm run test -- src/components/lobby/__tests__/CreateRoomModal.test.tsx`
- `npm run test:e2e:ci:file -- e2e/_shared/auth-account-login.e2e.ts "AuthModal login should remain usable on desktop"`
- `npm run typecheck`

## 截图核对

### 登录弹窗桌面端

- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\auth-modal-desktop-login-filled.png`
- 我实际看到什么：登录弹窗里的密码输入框右侧已经出现眼睛按钮，按钮位于输入框内部右侧，没有跑到外层容器外，也没有遮住“忘记密码？”链接。
- 我实际看到什么：密码字段默认仍显示为圆点遮罩，说明默认态是密文，符合商业项目常见行为；输入框宽度和主按钮宽度保持稳定，没有因为新增按钮把表单挤歪。
- 是否达到验收标准：达到。这个截图已经直接证明“密码框右侧有眼睛按钮来显示”的核心诉求已落到真实界面。

## 未作为收口证据的尝试

- 我还尝试用裸 Playwright 跑 `e2e/_shared/account-settings.e2e.ts` 和 `e2e/_shared/lobby.e2e.ts` 的相关用例，但失败点落在现有测试入口本身没有稳定打开对应弹窗，不是“眼睛按钮不存在”或“显隐切换失败”。
- 因此本轮最终收口证据只采用上面的登录弹窗真实截图，加上共享组件复用和单测覆盖；其余两条失败尝试不作为“已验证通过”的依据。
