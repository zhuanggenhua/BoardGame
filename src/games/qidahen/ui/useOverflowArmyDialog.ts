import * as React from 'react';

/** 只记录当前交互中关闭的检视层；交互切换时重置。 */
export function useOverflowArmyDialog(context: string, regionIds: readonly string[], automaticRegionIds: readonly string[] = regionIds) {
    const [state, setState] = React.useState<{ context: string; dismissed: string[]; opened: string | null }>(
        () => ({ context, dismissed: [], opened: null }),
    );
    React.useEffect(() => {
        setState(current => current.context === context ? current : { context, dismissed: [], opened: null });
    }, [context]);
    const current = state.context === context ? state : { context, dismissed: [], opened: null };
    const regionId = current.opened && regionIds.includes(current.opened) ? current.opened
        : automaticRegionIds.find(id => regionIds.includes(id) && !current.dismissed.includes(id)) ?? null;
    const close = (id: string) => setState(previous => {
        const dismissed = previous.context === context ? previous.dismissed : [];
        return { context, dismissed: [...new Set([...dismissed, id])], opened: null };
    });
    const open = (id: string) => setState(previous => ({ context,
        dismissed: (previous.context === context ? previous.dismissed : []).filter(item => item !== id), opened: id }));
    return { regionId, close, open };
}
