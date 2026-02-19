import 'dotenv/config';
import 'reflect-metadata';
import { existsSync } from 'fs';
import { join } from 'path';
import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import express from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { MsgpackIoAdapter } from './adapters/msgpack-io.adapter';
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
    const app = await NestFactory.create(AppModule, {
        cors: {
            origin: '*',
            credentials: true,
        },
        rawBody: false,
    });

    // 使用 MessagePack 序列化的 socket.io 适配器
    app.useWebSocketAdapter(new MsgpackIoAdapter(app));

    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(express.json({ limit: '2mb' }));
    expressApp.use(express.urlencoded({ extended: true, limit: '2mb' }));

    const gameServerTarget =
        process.env.GAME_SERVER_PROXY_TARGET
        || process.env.GAME_SERVER_URL
        || 'http://127.0.0.1:18000';

    // 不使用 app.use(path, proxy) 挂载方式，因为 Express 会剥掉挂载前缀导致路径错误。
    // 改用全局挂载 + pathFilter 让代理自行匹配路径，保留完整 URL 转发到 game-server。
    // 注意：pathFilter 不能混用字符串和 glob，必须全用 glob 模式
    const gameProxy = createProxyMiddleware({
        target: gameServerTarget,
        changeOrigin: true,
        ws: true,
        pathFilter: ['/games/**', '/default/**', '/lobby-socket/**', '/socket.io/**'],
        // fixRequestBody: NestJS 的 body parser 会在代理之前消费 request stream，
        // 导致 POST/PUT 请求转发时 body 为空，game-server 挂起等待数据。
        // fixRequestBody 将已解析的 req.body 重新写入 proxy request。
        on: {
            proxyReq: fixRequestBody,
        },
    });

    // 全局挂载，代理内部通过 pathFilter 决定是否转发
    expressApp.use(gameProxy);

    const distPath = join(process.cwd(), 'dist');
    const uploadsPath = join(process.cwd(), 'uploads');
    if (existsSync(uploadsPath)) {
        expressApp.use('/assets', express.static(uploadsPath));
    }
    if (existsSync(distPath)) {
        expressApp.use(express.static(distPath));

        const spaExclude = /^\/(auth|health|social-socket|games|default|lobby-socket|socket\.io|admin|ugc|layout|feedback|review|invite|message|friend|user-settings|sponsors|notifications)(\/|$)/;
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
