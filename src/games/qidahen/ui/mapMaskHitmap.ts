// @asset-pipeline-allow
// 区域蒙版通过静态 png 像素构建命中表。
import { QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT } from '../data/mapRegions';
import { qidahenRegionColorKey, QIDAHEN_REGION_ID_BY_MASK_COLOR } from '../data/mapGraph';

export const buildRegionMaskHitmap = (image: HTMLImageElement) => {
    if (image.naturalWidth !== QIDAHEN_MAP_WIDTH || image.naturalHeight !== QIDAHEN_MAP_HEIGHT) {
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = QIDAHEN_MAP_WIDTH;
    canvas.height = QIDAHEN_MAP_HEIGHT;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT).data;
    for (let offset = 0; offset < data.length; offset += 4) {
        if (data[offset + 3] === 0) continue;
        const colorKey = qidahenRegionColorKey(data[offset], data[offset + 1], data[offset + 2]);
        if (QIDAHEN_REGION_ID_BY_MASK_COLOR[colorKey]) {
            return data;
        }
    }
    return null;
};
