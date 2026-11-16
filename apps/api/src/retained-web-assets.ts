import express from 'express';
import type { RequestHandler } from 'express';
import { LONG_CACHE_MAX_AGE } from './spa-fallback';

// 只回退 Vite 内容指纹文件；未版本化的配置、上传和游戏资源不能读到旧版。
const RETAINED_BUILD_ASSET = /^\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(?:js|mjs|css|svg|png|jpe?g|webp|avif|gif|woff2?|ttf|otf|wasm)$/i;

export function createRetainedWebAssetsMiddleware(directory: string): RequestHandler {
    const serve = express.static(directory, { maxAge: LONG_CACHE_MAX_AGE, immutable: true });
    return (req, res, next) => {
        if (!RETAINED_BUILD_ASSET.test(req.path)) return next();
        return serve(req, res, next);
    };
}
