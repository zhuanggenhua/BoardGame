export const TOOL_ROUTE_BY_ID: Record<string, string> = {
    assetslicer: '/dev/slicer',
    fxpreview: '/dev/fx',
    audiobrowser: '/dev/audio',
    archview: '/dev/arch',
};

export const resolveToolRoute = (id: string): string | null => TOOL_ROUTE_BY_ID[id] ?? null;
