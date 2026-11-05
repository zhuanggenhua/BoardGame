export type SocketIoServerTransport = 'websocket' | 'polling';

export const SOCKET_IO_SERVER_TRANSPORTS_AUTOMATIC: SocketIoServerTransport[] = ['websocket', 'polling'];
export const SOCKET_IO_SERVER_TRANSPORTS_WEBSOCKET_ONLY: SocketIoServerTransport[] = ['websocket'];

type SocketIoTransportEnv = {
    [key: string]: string | undefined;
    SOCKET_IO_ALLOW_POLLING?: string;
};

export function resolveSocketIoServerTransports(
    env: SocketIoTransportEnv = process.env,
): SocketIoServerTransport[] {
    return env.SOCKET_IO_ALLOW_POLLING === 'false'
        ? [...SOCKET_IO_SERVER_TRANSPORTS_WEBSOCKET_ONLY]
        : [...SOCKET_IO_SERVER_TRANSPORTS_AUTOMATIC];
}
