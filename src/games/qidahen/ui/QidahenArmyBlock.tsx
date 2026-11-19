import { OptimizedImage } from '../../../components/common/media/OptimizedImage';

type Props = {
    imageSrc: string;
    rotation?: number;
    quantity: number;
    className: string;
};

/** The face carries the troop type and level; the offset edges only indicate a stack. */
export function QidahenArmyBlock({ imageSrc, rotation = 0, quantity, className }: Props) {
    return <span className={`relative block shrink-0 ${className}`} data-qidahen-army-block="flat" aria-hidden="true">
        {quantity > 1 ? <span className="pointer-events-none absolute inset-x-1 -bottom-1 top-2 rounded-md border border-[#241b10] bg-[#b99b67]" /> : null}
        {quantity > 2 ? <span className="pointer-events-none absolute inset-x-2 -bottom-2 top-3 -z-10 rounded-md border border-[#241b10] bg-[#8b6d46]" /> : null}
        <OptimizedImage src={imageSrc} alt="" placeholder={false} draggable={false}
            className="absolute inset-0 size-full rounded-md object-contain" style={{ transform: `rotate(${rotation}deg)` }} />
    </span>;
}
