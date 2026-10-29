export interface DevRuntimePorts {
  frontend: number;
  gameServer: number;
  apiServer: number;
}

export function loadDevRuntimePorts(options?: {
  requireLiveOwner?: boolean;
}): DevRuntimePorts | null;
