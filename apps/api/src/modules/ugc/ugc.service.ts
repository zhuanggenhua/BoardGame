import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { lookup as lookupMimeType } from 'mime-types';
import type { AssetRecord, AssetVariant } from '../../../../../src/ugc/assets/types';
import { createAssetRecord, generateAssetPath } from '../../../../../src/ugc/assets/types';
import { createAudioCompressor, createImageCompressor } from '../../../../../src/ugc/server/compression';
import type { AudioCompressionInput, ImageCompressionInput } from '../../../../../src/ugc/server/compression';
import { createPackageValidator } from '../../../../../src/ugc/server/package';
import type { PackageManifest } from '../../../../../src/ugc/server/package';
import { createUGCStorageService } from '../../../../../src/server/storage/UGCStorageService';
import type { CreateUgcPackageDto } from './dtos/create-ugc-package.dto';
import type { UpdateUgcPackageDto } from './dtos/update-ugc-package.dto';
import type { UgcPackageListQueryDto } from './dtos/ugc-list-query.dto';
import type { UploadUgcAssetDto } from './dtos/upload-ugc-asset.dto';
import { UgcAsset, type UgcAssetDocument } from './schemas/ugc-asset.schema';
import { UgcPackage, type UgcPackageDocument } from './schemas/ugc-package.schema';

const IMAGE_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg', 'bmp']);
const AUDIO_FORMATS = new Set(['ogg', 'mp3', 'wav', 'aac', 'flac', 'aiff', 'm4a']);
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const MAX_PACKAGE_UPLOAD_SIZE = 20 * 1024 * 1024;
const MIME_TO_FORMAT: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    'audio/aiff': 'aiff',
    'audio/x-aiff': 'aiff',
    'audio/mp4': 'm4a',
};

type PackageEntryInfo = {
    path: string;
    url: string;
};
const FORMAT_TO_MIME: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ogg: 'audio/ogg',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    aac: 'audio/aac',
    flac: 'audio/flac',
    aiff: 'audio/aiff',
    m4a: 'audio/mp4',
};

type UploadedFile = {
    buffer: Buffer;
    originalname: string;
    mimetype?: string;
    size: number;
};

export type ServiceResult<T, C extends string = string> =
    | { ok: true; data: T }
    | { ok: false; code: C; message?: string };

export type PackageSummary = {
    packageId: string;
    name: string;
    description?: string;
    tags?: string[];
    version?: string;
    gameId?: string;
    coverAssetId?: string;
    status: 'draft' | 'published';
    publishedAt?: Date | null;
    updatedAt?: Date;
};

type PackageUploadResult = {
    packageId: string;
    packageType: string | null;
    files: string[];
    entryPoints: Record<string, PackageEntryInfo | undefined>;
    manifest: Record<string, unknown>;
};

@Injectable()
export class UgcService {
    private readonly storage = createUGCStorageService();
    private readonly imageCompressor = createImageCompressor();
    private readonly audioCompressor = createAudioCompressor();

    constructor(
        @InjectModel(UgcPackage.name) private readonly packageModel: Model<UgcPackageDocument>,
        @InjectModel(UgcAsset.name) private readonly assetModel: Model<UgcAssetDocument>
    ) {}

    async createPackage(ownerId: string, dto: CreateUgcPackageDto): Promise<ServiceResult<UgcPackageDocument, 'duplicatePackageId'>> {
        const packageId = dto.packageId?.trim() || this.generatePackageId();
        const exists = await this.packageModel.findOne({ packageId }).lean();
        if (exists) {
            return { ok: false, code: 'duplicatePackageId' };
        }
        const created = await this.packageModel.create({
            packageId,
            ownerId,
            name: dto.name.trim(),
            description: dto.description?.trim() ?? '',
            tags: dto.tags ?? [],
            version: dto.version?.trim() ?? '',
            gameId: dto.gameId?.trim() ?? '',
            coverAssetId: dto.coverAssetId?.trim() ?? '',
            status: 'draft',
            manifest: dto.manifest ?? null,
        });
        return { ok: true, data: created };
    }

    async updatePackage(ownerId: string, packageId: string, dto: UpdateUgcPackageDto): Promise<ServiceResult<UgcPackageDocument, 'notFound'>> {
        const pkg = await this.packageModel.findOne({ packageId, ownerId });
        if (!pkg) {
            return { ok: false, code: 'notFound' };
        }
        if (dto.name !== undefined) pkg.name = dto.name.trim();
        if (dto.description !== undefined) pkg.description = dto.description?.trim() ?? '';
        if (dto.tags !== undefined) pkg.tags = dto.tags;
        if (dto.version !== undefined) pkg.version = dto.version.trim();
        if (dto.gameId !== undefined) pkg.gameId = dto.gameId.trim();
        if (dto.coverAssetId !== undefined) pkg.coverAssetId = dto.coverAssetId.trim();
        if (dto.manifest !== undefined) pkg.manifest = dto.manifest;
        await pkg.save();
        return { ok: true, data: pkg };
    }

    async publishPackage(ownerId: string, packageId: string): Promise<ServiceResult<UgcPackageDocument, 'notFound' | 'missingManifest'>> {
        const pkg = await this.packageModel.findOne({ packageId, ownerId });
        if (!pkg) {
            return { ok: false, code: 'notFound' };
        }
        if (!pkg.manifest) {
            return { ok: false, code: 'missingManifest' };
        }
        pkg.status = 'published';
        pkg.publishedAt = new Date();
        await pkg.save();
        return { ok: true, data: pkg };
    }

    async listPublished(query: UgcPackageListQueryDto) {
        const { page, limit } = query;
        const [items, total] = await Promise.all([
            this.packageModel
                .find({ status: 'published' })
                .sort({ publishedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean<UgcPackageDocument[]>(),
            this.packageModel.countDocuments({ status: 'published' }),
        ]);
        return {
            items: items.map((pkg) => this.toPublicPackage(pkg)),
            page,
            limit,
            total,
            hasMore: page * limit < total,
        };
    }

    async listOwnerPackages(ownerId: string, query: UgcPackageListQueryDto) {
        const { page, limit } = query;
        const [items, total] = await Promise.all([
            this.packageModel
                .find({ ownerId })
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean<UgcPackageDocument[]>(),
            this.packageModel.countDocuments({ ownerId }),
        ]);
        return {
            items: items.map((pkg) => this.toOwnerPackage(pkg)),
            page,
            limit,
            total,
            hasMore: page * limit < total,
        };
    }

    async getPublishedPackage(packageId: string) {
        const pkg = await this.packageModel.findOne({ packageId, status: 'published' }).lean<UgcPackageDocument | null>();
        if (!pkg) return null;
        return this.toPublicPackage(pkg);
    }

    async getPublishedManifest(packageId: string) {
        const pkg = await this.packageModel.findOne({ packageId, status: 'published' }).lean<UgcPackageDocument | null>();
        if (!pkg?.manifest) return null;
        return pkg.manifest;
    }

    async getOwnerPackage(ownerId: string, packageId: string) {
        return this.packageModel.findOne({ packageId, ownerId }).lean<UgcPackageDocument | null>();
    }

    async listAssets(ownerId: string, packageId: string) {
        return this.assetModel.find({ packageId, ownerId }).sort({ createdAt: -1 }).lean<UgcAssetDocument[]>();
    }

    async uploadAsset(
        ownerId: string,
        packageId: string,
        dto: UploadUgcAssetDto,
        file: UploadedFile
    ): Promise<ServiceResult<AssetRecord, 'notFound' | 'invalidType' | 'compressFailed' | 'tooLarge'>> {
        const pkg = await this.packageModel.findOne({ packageId, ownerId });
        if (!pkg) {
            return { ok: false, code: 'notFound' };
        }
        if (file.size > MAX_UPLOAD_SIZE) {
            return { ok: false, code: 'tooLarge' };
        }

        const format = this.resolveFormat(file.originalname, file.mimetype);
        const type = this.resolveAssetType(dto.type, format, file.mimetype);
        if (!type || (type !== 'image' && type !== 'audio')) {
            return { ok: false, code: 'invalidType' };
        }

        const assetId = dto.assetId?.trim() || this.generateAssetId();
        const baseInput = {
            buffer: file.buffer,
            filename: file.originalname,
            format,
            userId: ownerId,
            packageId,
            assetId,
        } as const;

        const result = type === 'image'
            ? await this.imageCompressor.compress(baseInput as ImageCompressionInput)
            : await this.audioCompressor.compress(baseInput as AudioCompressionInput);

        const shouldCompress = type === 'image'
            ? this.imageCompressor.shouldCompress(format)
            : this.audioCompressor.shouldCompress(format);

        if (!result.success || (shouldCompress && result.skipped)) {
            return { ok: false, code: 'compressFailed', message: result.error };
        }

        if (!result.compressedBuffer || !result.variant) {
            return { ok: false, code: 'compressFailed' };
        }

        const variant = await this.persistVariant(
            ownerId,
            packageId,
            assetId,
            result.variant,
            result.compressedBuffer
        );

        const assetRecord = createAssetRecord({
            id: assetId,
            packageId,
            userId: ownerId,
            type,
            originalFilename: file.originalname,
            originalFormat: format,
            originalSize: file.size,
            uploadedAt: new Date().toISOString(),
            compressionStatus: result.skipped ? 'skipped' : 'completed',
            compressedAt: new Date().toISOString(),
            metadata: result.metadata ?? {},
            variants: [variant],
            primaryVariantId: variant.id,
        });

        await this.assetModel.findOneAndUpdate(
            { packageId, assetId },
            { $set: { ...assetRecord, ownerId } },
            { upsert: true }
        );

        await this.syncPackageManifest(pkg, assetRecord);

        return { ok: true, data: assetRecord };
    }

    async uploadPackageZip(
        ownerId: string,
        packageId: string,
        file: UploadedFile
    ): Promise<ServiceResult<PackageUploadResult, 'notFound' | 'invalidZip' | 'tooLarge' | 'invalidPackage' | 'invalidEntry' | 'storageFailed'>> {
        const pkg = await this.packageModel.findOne({ packageId, ownerId });
        if (!pkg) {
            return { ok: false, code: 'notFound' };
        }
        if (file.size > MAX_PACKAGE_UPLOAD_SIZE) {
            return { ok: false, code: 'tooLarge' };
        }

        const zipMap = this.unzipPackage(file.buffer);
        if (!zipMap) {
            return { ok: false, code: 'invalidZip' };
        }

        const validator = createPackageValidator();
        const structure = validator.validateStructure(zipMap);
        if (!structure.valid) {
            return { ok: false, code: 'invalidPackage', message: structure.errors.join('; ') };
        }

        if (structure.entryPoints.view) {
            const viewBuffer = zipMap.get(structure.entryPoints.view);
            if (viewBuffer) {
                const viewResult = validator.validateEntryFile(viewBuffer, 'view');
                if (!viewResult.valid) {
                    return { ok: false, code: 'invalidEntry', message: viewResult.errors.join('; ') };
                }
            }
        }
        if (structure.entryPoints.rules) {
            const rulesBuffer = zipMap.get(structure.entryPoints.rules);
            if (rulesBuffer) {
                const rulesResult = validator.validateEntryFile(rulesBuffer, 'rules');
                if (!rulesResult.valid) {
                    return { ok: false, code: 'invalidEntry', message: rulesResult.errors.join('; ') };
                }
            }
        }

        const manifestBuffer = zipMap.get('manifest.json');
        let manifest: PackageManifest | null = null;
        if (manifestBuffer) {
            const manifestResult = validator.validateManifest(manifestBuffer);
            if (!manifestResult.valid || !manifestResult.manifest) {
                return { ok: false, code: 'invalidPackage', message: manifestResult.errors.join('; ') };
            }
            manifest = manifestResult.manifest;
        }

        const entryPoints: Record<string, PackageEntryInfo | undefined> = {};
        const storedFiles: string[] = [];
        for (const [filename, buffer] of zipMap.entries()) {
            if (!filename || filename.endsWith('/')) continue;
            const contentType = lookupMimeType(filename) || 'application/octet-stream';
            try {
                const url = await this.storage.upload({
                    userId: ownerId,
                    packageId,
                    fileName: filename,
                    fileBuffer: buffer,
                    contentType,
                });
                storedFiles.push(filename);
                if (structure.entryPoints.view === filename) {
                    entryPoints.view = { path: this.buildPackagePath(ownerId, packageId, filename), url };
                }
                if (structure.entryPoints.rules === filename) {
                    entryPoints.rules = { path: this.buildPackagePath(ownerId, packageId, filename), url };
                }
                if (filename === 'tutorial.js') {
                    entryPoints.tutorial = { path: this.buildPackagePath(ownerId, packageId, filename), url };
                }
            } catch (error) {
                return { ok: false, code: 'storageFailed', message: error instanceof Error ? error.message : '存储失败' };
            }
        }

        const mergedManifest = this.mergePackageManifest(pkg.manifest, manifest, storedFiles, entryPoints, structure.packageType);
        pkg.manifest = mergedManifest;
        await pkg.save();

        return {
            ok: true,
            data: {
                packageId: pkg.packageId,
                packageType: structure.packageType,
                files: storedFiles,
                entryPoints,
                manifest: mergedManifest,
            },
        };
    }

    private resolveFormat(filename: string, mimetype?: string): string {
        const ext = path.extname(filename).replace('.', '').toLowerCase();
        if (ext) return ext;
        if (mimetype && MIME_TO_FORMAT[mimetype]) {
            return MIME_TO_FORMAT[mimetype];
        }
        return '';
    }

    private resolveAssetType(type: string | undefined, format: string, mimetype?: string): 'image' | 'audio' | null {
        if (type === 'image' || type === 'audio') return type;
        if (mimetype?.startsWith('image/')) return 'image';
        if (mimetype?.startsWith('audio/')) return 'audio';
        if (IMAGE_FORMATS.has(format)) return 'image';
        if (AUDIO_FORMATS.has(format)) return 'audio';
        return null;
    }

    private resolveContentType(format: string): string {
        return FORMAT_TO_MIME[format] || 'application/octet-stream';
    }

    private unzipPackage(buffer: Buffer): Map<string, Buffer> | null {
        try {
            const entries = unzipSync(buffer);
            const files = new Map<string, Buffer>();
            for (const [fileName, entry] of Object.entries(entries)) {
                if (!entry) continue;
                const normalized = fileName.replace(/\\/g, '/');
                if (!normalized || normalized.endsWith('/')) continue;
                files.set(normalized, Buffer.from(entry));
            }
            return files.size > 0 ? files : null;
        } catch (error) {
            return null;
        }
    }

    private mergePackageManifest(
        current: Record<string, unknown> | null | undefined,
        manifest: PackageManifest | null,
        files: string[],
        entryPoints: Record<string, PackageEntryInfo | undefined>,
        packageType: string | null
    ): Record<string, unknown> {
        const base = (current && typeof current === 'object') ? { ...current } : {};
        const next: Record<string, unknown> = { ...base };
        if (manifest?.metadata) {
            next.metadata = { ...manifest.metadata };
        } else if (!next.metadata) {
            next.metadata = {};
        }
        next.files = files;
        next.packageType = packageType;
        next.entryPoints = {
            view: entryPoints.view?.path,
            rules: entryPoints.rules?.path,
            tutorial: entryPoints.tutorial?.path,
        };
        if (manifest?.assets) {
            next.assets = manifest.assets;
        }
        return next;
    }

    private buildPackagePath(ownerId: string, packageId: string, fileName: string): string {
        return `ugc/${ownerId}/${packageId}/${fileName}`;
    }

    private async persistVariant(
        ownerId: string,
        packageId: string,
        assetId: string,
        variant: AssetVariant,
        buffer: Buffer
    ): Promise<AssetVariant> {
        const format = variant.format || 'bin';
        const pathValue = generateAssetPath(ownerId, packageId, assetId, format);
        const fileName = path.basename(pathValue);
        const contentType = this.resolveContentType(format);
        const url = await this.storage.upload({
            userId: ownerId,
            packageId,
            fileName,
            fileBuffer: buffer,
            contentType,
        });
        return {
            ...variant,
            path: pathValue,
            url,
        };
    }

    private async syncPackageManifest(pkg: UgcPackageDocument, asset: AssetRecord) {
        const manifest = (pkg.manifest && typeof pkg.manifest === 'object') ? { ...pkg.manifest } : {};
        const assets = (manifest.assets && typeof manifest.assets === 'object')
            ? { ...(manifest.assets as Record<string, unknown>) }
            : {};
        assets[asset.id] = {
            type: asset.type,
            primaryVariantId: asset.primaryVariantId,
            variants: asset.variants,
            metadata: asset.metadata,
        };
        pkg.manifest = { ...manifest, assets };
        await pkg.save();
    }

    private toPublicPackage(pkg: UgcPackageDocument): PackageSummary {
        return {
            packageId: pkg.packageId,
            name: pkg.name,
            description: pkg.description,
            tags: pkg.tags,
            version: pkg.version,
            gameId: pkg.gameId,
            coverAssetId: pkg.coverAssetId,
            status: pkg.status,
            publishedAt: pkg.publishedAt ?? null,
        };
    }

    private toOwnerPackage(pkg: UgcPackageDocument): PackageSummary {
        return {
            packageId: pkg.packageId,
            name: pkg.name,
            description: pkg.description,
            tags: pkg.tags,
            version: pkg.version,
            gameId: pkg.gameId,
            coverAssetId: pkg.coverAssetId,
            status: pkg.status,
            publishedAt: pkg.publishedAt ?? null,
            updatedAt: pkg.updatedAt,
        };
    }

    private generatePackageId(): string {
        return `ugc-${randomBytes(6).toString('hex')}`;
    }

    private generateAssetId(): string {
        return `asset-${randomBytes(8).toString('hex')}`;
    }
}
