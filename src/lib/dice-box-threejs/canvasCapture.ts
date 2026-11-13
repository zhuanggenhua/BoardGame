/** 同步读取仍存活的骰子画布；渲染和复制必须处于同一任务。 */
const renderers = new WeakMap<HTMLCanvasElement, () => void>();

export function registerDiceCanvas(canvas: HTMLCanvasElement, render: () => void): void {
    renderers.set(canvas, render);
}

export function unregisterDiceCanvas(canvas: HTMLCanvasElement): void {
    renderers.delete(canvas);
}

export function captureDiceCanvas(source: HTMLCanvasElement): HTMLCanvasElement | null {
    const render = renderers.get(source);
    if (!render) return null;
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const context = copy.getContext('2d');
    if (!context) throw new Error('Dice screenshot canvas context unavailable');
    render();
    context.drawImage(source, 0, 0);
    return copy;
}
