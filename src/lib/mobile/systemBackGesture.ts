const SYSTEM_BACK_GESTURE_EDGE_PX = 24;

export const shouldReserveSystemBackGesture = ({
    enabled,
    clientX,
    viewportWidth,
}: {
    enabled: boolean;
    clientX: number;
    viewportWidth: number;
}) => {
    if (!enabled || !Number.isFinite(clientX) || !Number.isFinite(viewportWidth) || viewportWidth <= 0) {
        return false;
    }

    const edgeSize = Math.max(0, Math.min(SYSTEM_BACK_GESTURE_EDGE_PX, viewportWidth / 2));
    return clientX <= edgeSize || clientX >= viewportWidth - edgeSize;
};
