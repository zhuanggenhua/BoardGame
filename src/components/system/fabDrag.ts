export const shouldAllowFabDragFromTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return true;
    return !target.closest('[data-fab-panel-interactive="true"]');
};
