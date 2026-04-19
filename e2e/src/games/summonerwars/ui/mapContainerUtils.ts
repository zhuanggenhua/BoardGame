const SYSTEM_BACK_GESTURE_EDGE_PX = 24;

export const shouldReserveSystemBackGesture = (args: {
  enabled: boolean;
  clientX: number;
  viewportWidth: number;
}) => {
  if (!args.enabled) return false;
  if (!Number.isFinite(args.clientX) || !Number.isFinite(args.viewportWidth) || args.viewportWidth <= 0) {
    return false;
  }
  const edgeSize = Math.max(0, Math.min(SYSTEM_BACK_GESTURE_EDGE_PX, args.viewportWidth / 2));
  return args.clientX <= edgeSize || args.clientX >= args.viewportWidth - edgeSize;
};
