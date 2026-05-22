export const TOOL_ROUTE_BY_ID: Record<string, string> = {
    assetslicer: '/dev/slicer',
    fxpreview: '/dev/fx',
    audiobrowser: '/dev/audio',
    archview: '/dev/arch',
    qidahenregionmask: '/dev/qidahen-region-mask',
    ugcbuilder: '/dev/ugc',
};

export const resolveToolRoute = (id: string): string | null => TOOL_ROUTE_BY_ID[id] ?? null;
