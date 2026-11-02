import { BadRequestException } from '@nestjs/common';
import { Schema } from 'mongoose';
import { createHash } from 'node:crypto';
import { MAX_RULES_FILE_BYTES, type GameRulesDocument } from '../../../../../src/shared/externalGames';

export const GameRulesDocumentSchema = new Schema<GameRulesDocument>({
    url: { type: String, required: true }, name: { type: String, required: true }, size: { type: Number, required: true },
}, { _id: false });

export interface GameRulesUpload { buffer: Buffer; originalname: string; mimetype: string; }

/** 检查真实文件内容；用户文件名只作展示，不用于存储路径。 */
export function validateGameRulesFile(file: GameRulesUpload) {
    if (file.buffer.length > MAX_RULES_FILE_BYTES) throw new BadRequestException('规则文件不能超过 10 MB');
    if (!/\.pdf$/i.test(file.originalname) || !['application/pdf', 'application/octet-stream', ''].includes(file.mimetype)
        || !file.buffer.subarray(0, 8).toString('ascii').startsWith('%PDF-')
        || !file.buffer.subarray(-1024).toString('ascii').includes('%%EOF')) {
        throw new BadRequestException('请选择有效的 PDF 规则文件');
    }
    const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const original = [...file.originalname].some(character => character.codePointAt(0)! > 255) || decoded.includes('\ufffd') ? file.originalname : decoded;
    const name = [...original.split(/[\\/]/).at(-1)!].filter(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127).join('').slice(-160) || '规则.pdf';
    const digest = createHash('sha256').update(file.buffer).digest('hex').slice(0, 24);
    return { name, size: file.buffer.length, fileName: `rules-${digest}.pdf`, contentType: 'application/pdf' };
}
