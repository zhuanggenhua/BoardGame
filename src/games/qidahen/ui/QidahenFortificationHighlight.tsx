import { useId, useLayoutEffect, useRef, useState } from 'react';
import { getQidahenFortificationGeometry } from './fortificationGeometry';

/** 当前维护对象的地图位置；墙线不成为新的点击候选。 */
export function QidahenFortificationHighlight({ id, label }: { id: string | null; label: string }) {
    const maskId = useId().replace(/:/g, '') + '-wall-cost';
    const geometry = getQidahenFortificationGeometry(id);
    const textRef = useRef<SVGTextElement>(null);
    const [position, setPosition] = useState<{ id: string | null; point: readonly [number, number] } | null>(null);
    const point = position?.id === id ? position.point : geometry?.labelAnchor;
    useLayoutEffect(() => {
        const text = textRef.current;
        if (!text || !geometry || !point) return;
        const matrix = text.getScreenCTM();
        const map = text.closest('[data-testid="qidahen-map-content"]');
        if (!matrix || !map) return;
        const bounds = text.getBoundingClientRect();
        const obstacles = [...map.querySelectorAll('[data-qidahen-map-token-region], [data-testid^="qidahen-map-population-"]')]
            .map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
        const candidates: (readonly [number, number])[] = [geometry.labelAnchor,
            ...geometry.points.flatMap(([x,y]) => [[x,y - 18], [x,y + 22]] as const)];
        candidates.sort((a,b) => Math.hypot(a[0] - geometry.labelAnchor[0], a[1] - geometry.labelAnchor[1])
            - Math.hypot(b[0] - geometry.labelAnchor[0], b[1] - geometry.labelAnchor[1]));
        const chosen = candidates.find(([x,y]) => {
            const dx = (x - point[0]) * matrix.a + (y - point[1]) * matrix.c;
            const dy = (x - point[0]) * matrix.b + (y - point[1]) * matrix.d;
            const left = bounds.left + dx - 4, top = bounds.top + dy - 4;
            const right = bounds.right + dx + 4, bottom = bounds.bottom + dy + 4;
            return left >= 0 && top >= 0 && right <= innerWidth && bottom <= innerHeight
                && !obstacles.some(rect => left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top);
        });
        if (chosen) setPosition(current => current?.id === id && current.point[0] === chosen[0] && current.point[1] === chosen[1]
            ? current : { id, point: chosen });
    });
    if (!geometry) return null;
    return <g data-testid="qidahen-fortification-highlight" data-fortification-id={id}>
        <defs><mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={1265} height={893}>
            <rect width={1265} height={893} fill="white" />
            <circle cx={geometry.costMarker.x} cy={geometry.costMarker.y} r={geometry.costMarker.radius} fill="black" />
        </mask></defs>
        <polyline points={geometry.points.map(point => point.join(',')).join(' ')} fill="none" stroke="#87e8ec"
            strokeWidth={3} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" mask={`url(#${maskId})`} />
        <text ref={textRef} x={point![0]} y={point![1]} textAnchor="middle" fontSize={10} fontWeight="bold"
            fill="#e2ffff" stroke="#282016" strokeWidth={2} paintOrder="stroke">{label}</text>
    </g>;
}
