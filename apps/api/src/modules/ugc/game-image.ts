import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export async function encodeGameImage(buffer: Buffer): Promise<Buffer> {
    try {
        return await sharp(buffer, { limitInputPixels: 40_000_000 }).rotate()
            .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch { throw new BadRequestException('图片不是可读取的图片'); }
}
