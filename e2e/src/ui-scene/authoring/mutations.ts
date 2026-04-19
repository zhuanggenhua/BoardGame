import type { UISceneRect, UISceneSourceDocument } from '../types';

function cloneRect(rect: UISceneRect): UISceneRect {
    return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
    };
}

export function updateSceneZoneRect(
    source: UISceneSourceDocument,
    zoneId: string,
    updater: (rect: UISceneRect) => UISceneRect,
): UISceneSourceDocument {
    const currentRect = source.scene.artboard.zones?.[zoneId];
    if (!currentRect) {
        return source;
    }

    const nextRect = updater(cloneRect(currentRect));
    return {
        scene: {
            ...source.scene,
            artboard: {
                ...source.scene.artboard,
                zones: {
                    ...(source.scene.artboard.zones ?? {}),
                    [zoneId]: nextRect,
                },
            },
        },
    };
}
