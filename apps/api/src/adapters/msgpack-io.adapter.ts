/**
 * 自定义 socket.io 适配器
 *
 * 使用 MessagePack 序列化替代 JSON，减少 WebSocket 传输体积。
 * 所有 NestJS WebSocketGateway（如 SocialGateway）自动使用此适配器。
 */

import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import msgpackParser from 'socket.io-msgpack-parser';

export class MsgpackIoAdapter extends IoAdapter {
    createIOServer(port: number, options?: ServerOptions) {
        const opts: ServerOptions = {
            ...options,
            parser: msgpackParser,
        };
        return super.createIOServer(port, opts);
    }
}
