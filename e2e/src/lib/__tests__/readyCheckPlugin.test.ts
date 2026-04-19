import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readyCheckPlugin } from '../../../vite-plugins/ready-check';

type MiddlewareHandler = (req: any, res: {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
    end: (body?: string) => void;
}) => void;

function createFakeServer() {
    const handlers = new Map<string, MiddlewareHandler>();
    let closeHandler: (() => void) | null = null;

    const httpServer = {
        listening: false,
        once: vi.fn((event: string, handler: () => void) => {
            if (event === 'close') {
                closeHandler = handler;
            }
        }),
    };

    const server: any = {
        httpServer,
        middlewares: {
            use: vi.fn((route: string, handler: MiddlewareHandler) => {
                handlers.set(route, handler);
            }),
        },
        listen: vi.fn(async () => {
            httpServer.listening = true;
            return server;
        }),
    };

    return {
        server,
        getHandler: (route: string) => handlers.get(route),
        close: () => closeHandler?.(),
    };
}

function createResponse() {
    let body = '';
    const headers: Record<string, string> = {};
    const response = {
        statusCode: 0,
        setHeader: (name: string, value: string) => {
            headers[name] = value;
        },
        end: (payload = '') => {
            body = payload;
        },
    };

    return {
        response,
        readBody: () => (body ? JSON.parse(body) : null),
        headers,
    };
}

function invokeReady(handler: MiddlewareHandler) {
    const { response, readBody, headers } = createResponse();
    handler({}, response);
    return {
        statusCode: response.statusCode,
        headers,
        body: readBody(),
    };
}

async function invokeCaptureSave(handler: MiddlewareHandler, body: Record<string, unknown>) {
    const { response, readBody, headers } = createResponse();
    const request = Readable.from([JSON.stringify(body)]) as Readable & {
        method?: string;
        url?: string;
    };
    request.method = 'POST';
    request.url = '/__capture/save';
    handler(request, response);
    const startedAt = Date.now();
    while (response.statusCode === 0 && Date.now() - startedAt < 2000) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(response.statusCode).toBeGreaterThan(0);
    return {
        statusCode: response.statusCode,
        headers,
        body: readBody(),
    };
}

async function invokeCaptureStatusPost(handler: MiddlewareHandler, body: Record<string, unknown>) {
    const { response, readBody, headers } = createResponse();
    const request = Readable.from([JSON.stringify(body)]) as Readable & {
        method?: string;
        url?: string;
    };
    request.method = 'POST';
    request.url = '/__capture/status';
    handler(request, response);
    const startedAt = Date.now();
    while (response.statusCode === 0 && Date.now() - startedAt < 2000) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(response.statusCode).toBeGreaterThan(0);
    return {
        statusCode: response.statusCode,
        headers,
        body: readBody(),
    };
}

function invokeCaptureStatusGet(handler: MiddlewareHandler, scenario: string) {
    const { response, readBody, headers } = createResponse();
    const request = {
        method: 'GET',
        url: `/__capture/status?scenario=${encodeURIComponent(scenario)}`,
    };
    handler(request, response);
    return {
        statusCode: response.statusCode,
        headers,
        body: readBody(),
    };
}

describe('readyCheckPlugin', () => {
    afterEach(async () => {
        vi.useRealTimers();
        delete process.env.BG_ENABLE_CAPTURE_SAVE;
        await fs.rm(path.join(process.cwd(), 'temp', 'ready-check-plugin-test'), {
            recursive: true,
            force: true,
        });
    });

    it('会在 listen 完成后才把 /__ready 置为 ready', async () => {
        vi.useFakeTimers();
        const plugin = readyCheckPlugin();
        const { server, getHandler } = createFakeServer();

        plugin.configureServer?.(server);
        const handler = getHandler('/__ready');
        expect(handler).toBeDefined();

        expect(invokeReady(handler!)).toMatchObject({
            statusCode: 503,
            body: { ready: false, message: 'Server is starting...' },
        });

        await server.listen();
        await vi.advanceTimersByTimeAsync(1000);

        expect(invokeReady(handler!)).toMatchObject({
            statusCode: 200,
            body: expect.objectContaining({ ready: true }),
        });
    });

    it('服务器关闭后会重新回到 not ready', async () => {
        vi.useFakeTimers();
        const plugin = readyCheckPlugin();
        const { server, getHandler, close } = createFakeServer();

        plugin.configureServer?.(server);
        const handler = getHandler('/__ready');
        expect(handler).toBeDefined();

        await server.listen();
        await vi.advanceTimersByTimeAsync(1000);
        expect(invokeReady(handler!).statusCode).toBe(200);

        close();

        expect(invokeReady(handler!)).toMatchObject({
            statusCode: 503,
            body: { ready: false, message: 'Server is starting...' },
        });
    });

    it('启用开关后允许把截图保存到工作区内', async () => {
        process.env.BG_ENABLE_CAPTURE_SAVE = '1';
        const plugin = readyCheckPlugin();
        const { server, getHandler } = createFakeServer();
        plugin.configureServer?.(server);

        const handler = getHandler('/__capture/save');
        expect(handler).toBeDefined();

        const outputPath = path.join(process.cwd(), 'temp', 'ready-check-plugin-test', 'capture.png');
        const result = await invokeCaptureSave(handler!, {
            scenario: 'test-scenario',
            outputPath,
            imageDataUrl: 'data:image/png;base64,aGVsbG8=',
        });

        expect(result.statusCode).toBe(200);
        expect(result.body).toMatchObject({
            ok: true,
            outputPath,
            scenario: 'test-scenario',
        });
        await expect(fs.readFile(outputPath)).resolves.toEqual(Buffer.from('hello'));
    });

    it('会拒绝写到工作区外的路径', async () => {
        process.env.BG_ENABLE_CAPTURE_SAVE = '1';
        const plugin = readyCheckPlugin();
        const { server, getHandler } = createFakeServer();
        plugin.configureServer?.(server);

        const handler = getHandler('/__capture/save');
        expect(handler).toBeDefined();

        const outputPath = path.resolve(process.cwd(), '..', 'escape.png');
        const result = await invokeCaptureSave(handler!, {
            scenario: 'outside-workspace',
            outputPath,
            imageDataUrl: 'data:image/png;base64,aGVsbG8=',
        });

        expect(result.statusCode).toBe(400);
        expect(result.body).toMatchObject({
            ok: false,
            error: 'output_path_outside_workspace',
        });
    });

    it('启用开关后允许记录并查询补图状态', async () => {
        process.env.BG_ENABLE_CAPTURE_SAVE = '1';
        const plugin = readyCheckPlugin();
        const { server, getHandler } = createFakeServer();
        plugin.configureServer?.(server);

        const statusHandler = getHandler('/__capture/status');
        expect(statusHandler).toBeDefined();

        const postResult = await invokeCaptureStatusPost(statusHandler!, {
            scenario: 'smashup-4p-mobile-attached-actions',
            phase: 'scenario-ready',
            message: '场景准备完成',
            outputPath: path.join(process.cwd(), 'temp', 'ready-check-plugin-test', 'capture.png'),
        });

        expect(postResult.statusCode).toBe(200);
        expect(postResult.body).toMatchObject({
            ok: true,
            status: expect.objectContaining({
                scenario: 'smashup-4p-mobile-attached-actions',
                phase: 'scenario-ready',
                message: '场景准备完成',
            }),
        });

        const getResult = invokeCaptureStatusGet(statusHandler!, 'smashup-4p-mobile-attached-actions');
        expect(getResult.statusCode).toBe(200);
        expect(getResult.body).toMatchObject({
            ok: true,
            status: expect.objectContaining({
                scenario: 'smashup-4p-mobile-attached-actions',
                phase: 'scenario-ready',
            }),
        });
    });

    it('保存截图后会把状态更新为 upload-saved', async () => {
        process.env.BG_ENABLE_CAPTURE_SAVE = '1';
        const plugin = readyCheckPlugin();
        const { server, getHandler } = createFakeServer();
        plugin.configureServer?.(server);

        const saveHandler = getHandler('/__capture/save');
        const statusHandler = getHandler('/__capture/status');
        expect(saveHandler).toBeDefined();
        expect(statusHandler).toBeDefined();

        const outputPath = path.join(process.cwd(), 'temp', 'ready-check-plugin-test', 'capture.png');
        const saveResult = await invokeCaptureSave(saveHandler!, {
            scenario: 'smashup-4p-mobile-attached-actions',
            outputPath,
            imageDataUrl: 'data:image/png;base64,aGVsbG8=',
        });

        expect(saveResult.statusCode).toBe(200);

        const getResult = invokeCaptureStatusGet(statusHandler!, 'smashup-4p-mobile-attached-actions');
        expect(getResult.statusCode).toBe(200);
        expect(getResult.body).toMatchObject({
            ok: true,
            status: expect.objectContaining({
                scenario: 'smashup-4p-mobile-attached-actions',
                phase: 'upload-saved',
                outputPath,
                bytes: Buffer.from('hello').length,
            }),
        });
    });
});
