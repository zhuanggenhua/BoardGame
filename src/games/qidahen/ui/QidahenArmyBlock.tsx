import { OptimizedImage } from '../../../components/common/media/OptimizedImage';

type Props = {
    imageSrc: string;
    rotation?: number;
    quantity: number;
    className: string;
};

export function QidahenArmyStackFaces({ imageSrc, rotation = 0, quantity, scale = 1, backColor, faceOutline }: {
    imageSrc?: string;
    rotation?: number;
    quantity: number;
    scale?: number;
    backColor?: string;
    faceOutline?: string;
}) {
    if (quantity < 2) return null;
    const offsets = quantity === 2 ? [[5, 4]] : [[6, 5], [3, 2.5]];
    return <span aria-hidden="true" data-qidahen-army-stack-layers="true"
        className="pointer-events-none absolute inset-0 -z-10">
        {offsets.map(([x, y]) => <span key={x} className="absolute inset-0 rounded-md"
            style={{ backgroundColor: backColor, transform: `translate(${x * scale}px, ${y * scale}px)` }}>
            {imageSrc ? <OptimizedImage src={imageSrc} alt="" draggable={false} placeholder={false}
                className="size-full rounded-md object-cover brightness-90" style={{ transform: `rotate(${rotation}deg)` }} /> : null}
            {faceOutline ? <span className="absolute inset-0 rounded-md" style={{ boxShadow: faceOutline }} /> : null}
        </span>)}
    </span>;
}

/** Overlap copies of the same public face to show a stack. */
export function QidahenArmyBlock({ imageSrc, rotation = 0, quantity, className }: Props) {
    return <span className={`relative isolate block shrink-0 ${className}`} data-qidahen-army-block="flat" aria-hidden="true">
        <QidahenArmyStackFaces imageSrc={imageSrc} rotation={rotation} quantity={quantity} />
        <OptimizedImage src={imageSrc} alt="" placeholder={false} draggable={false}
            className="absolute inset-0 size-full rounded-md object-contain" style={{ transform: `rotate(${rotation}deg)` }} />
    </span>;
}
