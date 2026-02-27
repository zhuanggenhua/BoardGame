# 反馈系统速率限制 TODO

## 问题描述

当前反馈 API (`POST /feedback`) 没有速率限制，匿名用户可以无限制提交反馈，存在以下风险：
- 恶意用户可以通过脚本大量提交垃圾反馈
- 可能导致数据库被垃圾数据填满
- 影响正常用户的反馈体验

## 解决方案

### 1. 安装依赖

```bash
npm install @nestjs/throttler
```

### 2. 配置全局速率限制

在 `apps/api/src/app.module.ts` 中添加：

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    // ... 其他 imports
    ThrottlerModule.forRoot([{
      ttl: 60000, // 时间窗口：60 秒
      limit: 10,  // 默认限制：每分钟 10 次请求
    }]),
  ],
  providers: [
    // 全局启用速率限制守卫
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

### 3. 为反馈 API 设置特定限制

在 `apps/api/src/modules/feedback/feedback.controller.ts` 中：

```typescript
import { Throttle } from '@nestjs/throttler';

@Controller('feedback')
export class FeedbackController {
    // 匿名用户：每分钟最多 3 次请求
    @Throttle({ default: { limit: 3, ttl: 60000 } })
    @Post()
    async create(@Request() req: any, @Body() dto: CreateFeedbackDto) {
        const userId = req.user?.userId || null;
        return this.feedbackService.create(userId, dto);
    }
}
```

### 4. 为已登录用户提供更高限额

可以创建自定义守卫，根据用户身份动态调整限额：

```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // 已登录用户：使用 userId 作为追踪键
    if (req.user?.userId) {
      return `user-${req.user.userId}`;
    }
    // 匿名用户：使用 IP 地址
    return req.ip;
  }

  protected async getLimit(context: ExecutionContext): Promise<number> {
    const request = context.switchToHttp().getRequest();
    // 已登录用户：每分钟 10 次
    if (request.user?.userId) {
      return 10;
    }
    // 匿名用户：每分钟 3 次
    return 3;
  }
}
```

## 当前状态

- ✅ 已在 `feedback.controller.ts` 中添加 TODO 注释和文档
- ⏳ 等待安装 `@nestjs/throttler` 依赖
- ⏳ 等待配置全局速率限制模块
- ⏳ 等待启用反馈 API 的速率限制装饰器

## 优先级

**高** - 这是一个安全问题，应该尽快修复。

## 相关文件

- `apps/api/src/modules/feedback/feedback.controller.ts`
- `apps/api/src/app.module.ts`
