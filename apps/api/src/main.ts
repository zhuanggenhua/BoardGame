import 'dotenv/config';
import 'reflect-metadata';
import { existsSync } from 'fs';
import { join } from 'path';
import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as Sentry from '@sentry/nestjs';
import { GlobalHttpExceptionFilter } from './shared/filters/http-exception.filter';

// 初始化 Sentry (后端)
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 1.0,
    });
}

async function bootstrap() {
    // 先创建 Express 实例并注册代理，确保代理在 NestJS 路由之前处理请求
    const expressApp = express();

    const gameServerTarget =
        process.env.GAME_SERVER_PROXY_TARGET
        || process.env.GAME_SERVER_URL
        || 'http://127.0.0.1:18000';

    const gameProxy = createProxyMiddleware({
        target: gameServerTarget,
        changeOrigin: true,
        ws: true,
    });

    // 代理必须在 NestJS 路由之前注册，否则 NestJS 会先返回 404
    expressApp.use(['/games', '/default', '/lobby-socket', '/socket.io'], gameProxy);

    // 把预配置的 Express 传给 NestJS
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
        cors: {
            origin: '*',
            credentials: true,
        },
        rawBody: false,
    });

    // 提升 JSON body 大小限制
    expressApp.use(express.json({ limit: '2mb' }));
    expressApp.use(express.urlencoded({ extended: true, limit: '2mb' }));

    const distPath = join(process.cwd(), 'dist');
    const uploadsPath = join(process.cwd(), 'uploads');
    if (existsSync(uploadsPath)) {
        expressApp.use('/assets', express.static(uploadsPath));
    }
    if (existsSync(distPath)) {
        expressApp.use(express.static(distPath));

        const spaExclude = /^\/(auth|health|social-socket|games|default|lobby-socket|socket\.io|admin|ugc|layout|feedback|review|invite|message|friend|user-settings|sponsors)(\/|$)/;
        expressApp.get('*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (spaExclude.test(req.path)) return next();
            return res.sendFile(join(distPath, 'index.html'));
        });
    }

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
        })
    );
    app.useGlobalFilters(new GlobalHttpExceptionFilter());

    const port = Number(process.env.API_SERVER_PORT) || 18001;
    const server = await app.listen(port);
    // 只代理游戏服相关的 WebSocket 升级
    server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
        const url = req.url || '';
        if (url.startsWith('/lobby-socket') || url.startsWith('/socket.io')) {
            gameProxy.upgrade(req, socket, head);
        }
    });
    console.log(`[API] listening on http://localhost:${port}`);
}

bootstrap();
