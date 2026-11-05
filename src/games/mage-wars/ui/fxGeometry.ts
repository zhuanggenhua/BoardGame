import type { FxBox } from '../../../engine/fx';

type ViewportBox = { left: number; top: number; width: number; height: number };

export function percentBoxToViewport(box: FxBox, host: DOMRect): ViewportBox {
    return {
        left: host.left + host.width * box.left / 100,
        top: host.top + host.height * box.top / 100,
        width: host.width * box.width / 100,
        height: host.height * box.height / 100,
    };
}
