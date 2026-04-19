import type { CanActivate, ExecutionContext } from '@nestjs/common';
import * as NestCommon from '@nestjs/common';

const {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} = NestCommon;

@Injectable()
export class InternalFeedbackGuard implements CanActivate {
  private readonly token: string | null;

  constructor() {
    // 生产/CI 可配置 INTERNAL_FEEDBACK_TOKEN 以启用内部反馈入口。
    // 在本地开发 / E2E 隔离运行时若未配置，也不应该让 API 进程直接崩溃。
    this.token = process.env.INTERNAL_FEEDBACK_TOKEN ?? null;
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.token) {
      // 不暴露内部入口存在；同时避免因为缺少 env 变量导致 Nest 启动失败。
      throw new NotFoundException('内部反馈入口已禁用');
    }

    const request = context.switchToHttp().getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
    const rawHeader = request.headers?.['x-internal-feedback-token'];
    const token = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!token) {
      throw new UnauthorizedException('缺少内部反馈凭证');
    }

    if (token !== this.token) {
      throw new ForbiddenException('内部反馈凭证无效');
    }

    return true;
  }
}
