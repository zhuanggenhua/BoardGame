import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { ExecutionContext } from '@nestjs/common';
import * as NestCommon from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { JwtAuthGuard } from './jwt-auth.guard';

const { Inject, Injectable, UnauthorizedException } = NestCommon;

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
    constructor(@Inject(CACHE_MANAGER) cacheManager: Cache) {
        super(cacheManager);
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<{
            headers?: { authorization?: string };
            user?: unknown;
        }>();
        const authHeader = request.headers?.authorization;

        if (!authHeader) {
            return true;
        }
        if (!authHeader.startsWith('Bearer ')) {
            delete request.user;
            return true;
        }

        try {
            return await super.canActivate(context);
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                delete request.user;
                return true;
            }
            throw error;
        }
    }
}
