import { getLocalAssetPath } from '../../core';

const thumbnailSrc = getLocalAssetPath('splendor/compressed/picture.webp');

export default function Thumbnail() {
    return (
        <div className="relative h-full w-full overflow-hidden bg-parchment-cream">
            <img
                src={thumbnailSrc}
                alt="Splendor"
                className="absolute inset-0 h-full w-full object-cover"
            />
        </div>
    );
}
