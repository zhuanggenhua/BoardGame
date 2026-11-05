export type QidahenGuidePoint = { x: number; y: number };

export type QidahenGuideBounds = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    center: QidahenGuidePoint;
};

export type QidahenGuideCandidate = {
    id: string;
    targetRegionId: string;
    targetRegionName: string;
    resolutionHint?: string;
    pathPoints: QidahenGuidePoint[];
    sourcePoint?: QidahenGuidePoint;
    sourceTokenBounds?: QidahenGuideBounds;
    sourceLabel?: string;
    targetLabel?: string;
    targetPoint?: QidahenGuidePoint;
    arrowTargetPoint?: QidahenGuidePoint;
    arrowHeadAnchorRatio?: number;
    targetFocusDisabled?: boolean;
    targetTokenIds?: string[];
    targetTokenBounds?: QidahenGuideBounds;
};

export const buildQidahenGuideDisplayPoints = (
    points: QidahenGuidePoint[],
    trimLength: number,
): QidahenGuidePoint[] => {
    if (points.length < 2) {
        return points;
    }
    const result = points.map((point) => ({ ...point }));
    let remainingTrim = trimLength;
    for (let index = result.length - 1; index > 0 && remainingTrim > 0; index -= 1) {
        const current = result[index];
        const previous = result[index - 1];
        const dx = current.x - previous.x;
        const dy = current.y - previous.y;
        const segmentLength = Math.hypot(dx, dy);
        if (segmentLength <= 0) {
            result.pop();
            continue;
        }
        if (segmentLength > remainingTrim) {
            const ratio = (segmentLength - remainingTrim) / segmentLength;
            result[index] = {
                x: previous.x + dx * ratio,
                y: previous.y + dy * ratio,
            };
            return result;
        }
        remainingTrim -= segmentLength;
        result.pop();
    }
    return result.length >= 2 ? result : points;
};

export const buildQidahenGuideArrowHeadPath = (
    center: QidahenGuidePoint,
    tangent: QidahenGuidePoint,
    length: number,
    width: number,
): string => {
    const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
    const unitX = tangent.x / tangentLength;
    const unitY = tangent.y / tangentLength;
    const normalX = -unitY;
    const normalY = unitX;
    const arrowTip = { x: center.x + unitX * length, y: center.y + unitY * length };
    const leftTail = {
        x: center.x - unitX * (length * 0.46) + normalX * width,
        y: center.y - unitY * (length * 0.46) + normalY * width,
    };
    const rightTail = {
        x: center.x - unitX * (length * 0.46) - normalX * width,
        y: center.y - unitY * (length * 0.46) - normalY * width,
    };
    return [
        `M ${arrowTip.x} ${arrowTip.y}`,
        `L ${leftTail.x} ${leftTail.y}`,
        `L ${rightTail.x} ${rightTail.y}`,
        'Z',
    ].join(' ');
};

export const buildQidahenGuideLinePath = (points: QidahenGuidePoint[], curved: boolean = true): string | null => {
    if (points.length < 2) {
        return null;
    }
    const start = points[0];
    const end = points[points.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (!curved) {
        return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }
    const curveLift = Math.min(108, Math.max(34, distance * 0.14));
    const normalX = -dy / distance;
    const normalY = dx / distance;
    const control1 = {
        x: start.x + dx * 0.24 + normalX * curveLift,
        y: start.y + dy * 0.18 + normalY * curveLift,
    };
    const control2 = {
        x: start.x + dx * 0.78 + normalX * (curveLift * 0.72),
        y: start.y + dy * 0.84 + normalY * (curveLift * 0.72),
    };
    return `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`;
};

export const buildQidahenGuideArrow = (
    points: QidahenGuidePoint[],
    lineTrimLength: number,
    headLength: number,
    headWidth: number,
    headAnchorRatio: number = 0.952,
): { linePath: string | null; headPath: string | null } => {
    if (points.length < 2) {
        return { linePath: null, headPath: null };
    }
    const start = points[0];
    const end = points[points.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy) || 1;
    const curveLift = Math.min(108, Math.max(34, distance * 0.14));
    const normalX = -dy / distance;
    const normalY = dx / distance;
    const control1 = {
        x: start.x + dx * 0.24 + normalX * curveLift,
        y: start.y + dy * 0.18 + normalY * curveLift,
    };
    const control2 = {
        x: start.x + dx * 0.78 + normalX * (curveLift * 0.72),
        y: start.y + dy * 0.84 + normalY * (curveLift * 0.72),
    };
    const lineEnd = {
        x: start.x + (end.x - start.x) * Math.max(0.4, headAnchorRatio - 0.037),
        y: start.y + (end.y - start.y) * Math.max(0.4, headAnchorRatio - 0.037),
    };
    const displayPoints = buildQidahenGuideDisplayPoints([start, control1, control2, lineEnd], lineTrimLength);
    const linePath = buildQidahenGuideLinePath(displayPoints);
    const headCenter = {
        x: start.x + dx * headAnchorRatio,
        y: start.y + dy * headAnchorRatio,
    };
    const headTangent = {
        x: 3 * (end.x - control2.x),
        y: 3 * (end.y - control2.y),
    };
    return {
        linePath,
        headPath: buildQidahenGuideArrowHeadPath(headCenter, headTangent, headLength, headWidth),
    };
};
