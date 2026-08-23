export const TRANSPORT_BATCH_COMMAND = 'SYS_TRANSPORT_BATCH';

export type TransportBatchCommand = {
    type: string;
    payload: unknown;
};

export type TransportBatchPayload = {
    commands: TransportBatchCommand[];
};

export function getTransportBatchCommands(payload: unknown): TransportBatchCommand[] {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('SYS_TRANSPORT_BATCH payload must be an object');
    }

    const commands = (payload as { commands?: unknown }).commands;
    if (!Array.isArray(commands)) {
        throw new Error('SYS_TRANSPORT_BATCH payload.commands must be an array');
    }

    return commands.map((command, index) => {
        if (!command || typeof command !== 'object' || Array.isArray(command)) {
            throw new Error(`SYS_TRANSPORT_BATCH command at index ${index} must be an object`);
        }

        const type = (command as { type?: unknown }).type;
        if (typeof type !== 'string' || type.length === 0) {
            throw new Error(`SYS_TRANSPORT_BATCH command at index ${index} must have a type`);
        }
        if (type === TRANSPORT_BATCH_COMMAND) {
            throw new Error('SYS_TRANSPORT_BATCH cannot contain another SYS_TRANSPORT_BATCH command');
        }

        return {
            type,
            payload: (command as { payload?: unknown }).payload,
        };
    });
}
