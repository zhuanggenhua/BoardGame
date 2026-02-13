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

// 需要代理到 game-server 的路径前缀
const PROXY_PATHS = ['/games', '/default', '/lobby-socket', '/socket.io'];

async function bootstrap() {
    const gameServerTarget =
        process.env.GAME_SERVER_PROXY_TARGET
        || process.env.GAME_SERVER_URL
        || 'http://127.0.0.1:18000';

    const gameProxy = createProxyMiddleware({
        target: gameServerTarget,
        changeOrigin: true,
        ws: true,
    });

    // 创建 Express 实例，先注册代理
    // 关键：代理必须在 NestJS 路由和 body-parser 之前
    // 否则 NestJS 会对未知路径返回 404，或 body-parser 消费 stream 导致代理挂起
    const expressInstance = express();
    expressInstance.use(PROXY_PATHS, gameProxy);

    // 把预配置的 Express 传给 NestJS（ExpressAdapter）
    const app = await NestFactory.create(
        AppModule,
        new ExpressAdapter(expressInstance),
        {
            cors: {
                origin: '*',
                credentials: true,
            },
            rawBody: false,
        },
    );

    // body 解析在代理之后注册，不会影响代理路径
    expressInstance.use(express.json({ limit: '2mb' }));
    expressInstance.use(express.urlencoded({ extended: true, limit: '2mb' }));

    const distPath = join(process.cwd(), 'dist');
    const uploadsPath = join(process.cwd(), 'uploads');
    if (existsSync(uploadsPath)) {
        expressInstance.use('/assets', express.static(uploadsPath));
    }
    if (existsSync(distPath)) {
        expressInstance.use(express.static(distPath));

        const spaExclude = /^\/(auth|health|social-socket|games|default|lobby-socket|socket\.io|admin|ugc|layout|feedback|review|invite|message|friend|user-settings|sponsors)(\/|$)/;
        expressInstance.get('*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    const httpServer = await app.listen(port);
    // 只代理游戏服相关的 WebSocket 升级
    httpServer.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
        const url = req.url || '';
        if (url.startsWith('/lobby-socket') || url.startsWith('/socket.io')) {
            gameProxy.upgrade(req, socket, head);
        }
    });
    console.log(`[API] listening on http://localhost:${port}`);
}

bootstrap();
