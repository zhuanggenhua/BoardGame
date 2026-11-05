export interface DevRuntimePorts { frontend: number; gameServer: number; apiServer: number }
export function createDevRuntimeEnv(ports: DevRuntimePorts, extraEnv?: Record<string, string | undefined>): Record<string, string | undefined>;
export function saveDevRuntimePorts(ports: DevRuntimePorts): DevRuntimePorts;
export function loadDevRuntimePorts(options?: { requireLiveOwner?: boolean }): DevRuntimePorts | null;
export function removeDevRuntimePorts(options?: { force?: boolean }): boolean;
