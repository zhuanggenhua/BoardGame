import { describe, expect, it } from 'vitest';
import { resolveSocketIoServerTransports } from '../socketTransports';

describe('resolveSocketIoServerTransports', () => {
    it('默认允许 WebSocket 优先并保留 polling 回退', () => {
        expect(resolveSocketIoServerTransports({})).toEqual(['websocket', 'polling']);
    });

    it('只有显式关闭 polling 时才退回 WebSocket-only', () => {
        expect(resolveSocketIoServerTransports({ SOCKET_IO_ALLOW_POLLING: 'false' })).toEqual(['websocket']);
    });

    it('显式开启 polling 与默认策略一致', () => {
        expect(resolveSocketIoServerTransports({ SOCKET_IO_ALLOW_POLLING: 'true' })).toEqual(['websocket', 'polling']);
    });
});
