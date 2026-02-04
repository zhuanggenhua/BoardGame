import 'dotenv/config';
import 'reflect-metadata';
import { existsSync } from 'fs';
import { join } from 'path';
import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        cors: {
            origin: '*',
            credentials: true,
        },
    });
    const expressApp = app.getHttpAdapter().getInstance();
    const gameServerTarget =
        process.env.GAME_SERVER_PROXY_TARGET
        || process.env.GAME_SERVER_URL
        || 'http://127.0.0.1:18000';

    const gameProxy = createProxyMiddleware({
        target: gameServerTarget,
        changeOrigin: true,
        ws: true,
    });

    expressApp.use(['/games', '/default', '/lobby-socket', '/socket.io'], gameProxy);

    const distPath = join(process.cwd(), 'dist');
    const uploadsPath = join(process.cwd(), 'uploads');
    if (existsSync(uploadsPath)) {
        expressApp.use('/assets', express.static(uploadsPath));
    }
    if (existsSync(distPath)) {
        expressApp.use(express.static(distPath));

        const spaExclude = /^\/(auth|health|social-socket|games|default|lobby-socket|socket\.io|admin)(\/|$)/;
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
    // 只代理游戏服相关的 WebSocket 升级，避免社交 Socket 被错误转发导致断线
    server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
        const url = req.url || '';
        if (url.startsWith('/lobby-socket') || url.startsWith('/socket.io')) {
            gameProxy.upgrade(req, socket, head);
        }
    });
    console.log(`[API] listening on http://localhost:${port}`);
}

bootstrap();
