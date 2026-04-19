export function isNodeContainedBy(container: Node | null | undefined, target: EventTarget | null | undefined): boolean {
    if (!container) return false;
    if (!(target instanceof Node)) return false;
    return container.contains(target);
}
