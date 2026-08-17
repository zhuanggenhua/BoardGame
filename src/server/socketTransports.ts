export type SocketIoServerTransport = 'websocket' | 'polling';

export const SOCKET_IO_SERVER_TRANSPORTS_AUTOMATIC: SocketIoServerTransport[] = ['websocket', 'polling'];
export const SOCKET_IO_SERVER_TRANSPORTS_WEBSOCKET_ONLY: SocketIoServerTransport[] = ['websocket'];

export function resolveSocketIoServerTransports(
    env: Pick<NodeJS.ProcessEnv, 'SOCKET_IO_ALLOW_POLLING'> = process.env,
): SocketIoServerTransport[] {
    return env.SOCKET_IO_ALLOW_POLLING === 'false'
        ? [...SOCKET_IO_SERVER_TRANSPORTS_WEBSOCKET_ONLY]
        : [...SOCKET_IO_SERVER_TRANSPORTS_AUTOMATIC];
}
