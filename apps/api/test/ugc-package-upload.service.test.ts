import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { strToU8, zipSync } from 'fflate';
import { join } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { UgcModule } from '../src/modules/ugc/ugc.module';
import { UgcService } from '../src/modules/ugc/ugc.service';
import { UgcPackage, type UgcPackageDocument } from '../src/modules/ugc/schemas/ugc-package.schema';

describe('UgcService.uploadPackageZip', () => {
    let mongo: MongoMemoryServer | null;
    let moduleRef: import('@nestjs/testing').TestingModule;
    let ugcService: UgcService;
    let packageModel: Model<UgcPackageDocument>;
    const uploadDir = join(process.cwd(), 'uploads-test');

    beforeAll(async () => {
        process.env.UGC_STORAGE_MODE = 'local';
        process.env.UGC_LOCAL_PATH = uploadDir;
        process.env.UGC_PUBLIC_URL_BASE = '/assets';

        const externalMongoUri = process.env.MONGO_URI;
        mongo = externalMongoUri ? null : await MongoMemoryServer.create();
        const mongoUri = externalMongoUri ?? mongo?.getUri();
        if (!mongoUri) {
            throw new Error('缺少 MongoDB 连接地址，请配置 MONGO_URI 或启用内存 MongoDB');
        }

        moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register({ isGlobal: true }),
                MongooseModule.forRoot(mongoUri),
                UgcModule,
            ],
        }).compile();

        await moduleRef.init();

        ugcService = moduleRef.get(UgcService);
        packageModel = moduleRef.get<Model<UgcPackageDocument>>(getModelToken(UgcPackage.name));
    });

    beforeEach(async () => {
        await packageModel.deleteMany({});
    });

    afterAll(async () => {
        if (moduleRef) {
            await moduleRef.close();
        }
        if (mongo) {
            await mongo.stop();
        }
        if (existsSync(uploadDir)) {
            rmSync(uploadDir, { recursive: true, force: true });
        }
    });

    const buildZipBuffer = () => {
        const manifest = {
            metadata: {
                id: 'ugc-test',
                name: '测试包',
                version: '1.0.0',
                type: 'full',
                gameId: 'ugc-test',
                author: 'tester',
            },
            files: ['index.html', 'main.js', 'domain.js', 'tutorial.js', 'manifest.json'],
        };
        return Buffer.from(zipSync({
            'index.html': strToU8('<!DOCTYPE html><html><script>postMessage()</script></html>'),
            'main.js': strToU8('console.log("main")'),
            'domain.js': strToU8('const domain = { gameId: "ugc-test", setup(){}, validate(){}, execute(){}, reduce(){} };'),
            'tutorial.js': strToU8('export const tutorial = { steps: [] };'),
            'manifest.json': strToU8(JSON.stringify(manifest)),
        }));
    };

    it('应上传 zip 并更新 manifest 与入口', async () => {
        await packageModel.create({
            packageId: 'ugc-test',
            ownerId: 'user-1',
            name: '测试包',
            status: 'draft',
        });

        const buffer = buildZipBuffer();
        const result = await ugcService.uploadPackageZip('user-1', 'ugc-test', {
            buffer,
            originalname: 'package.zip',
            mimetype: 'application/zip',
            size: buffer.length,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.data.files).toContain('index.html');
        expect(result.data.entryPoints.view?.path).toBe('ugc/user-1/ugc-test/index.html');
        expect(result.data.entryPoints.rules?.path).toBe('ugc/user-1/ugc-test/domain.js');
        expect(result.data.entryPoints.tutorial?.path).toBe('ugc/user-1/ugc-test/tutorial.js');

        const stored = await packageModel.findOne({ packageId: 'ugc-test', ownerId: 'user-1' }).lean();
        const manifest = stored?.manifest as Record<string, unknown> | null;
        expect(manifest?.files).toBeDefined();
        expect((manifest?.entryPoints as Record<string, unknown>)?.view).toBe('ugc/user-1/ugc-test/index.html');
        expect(existsSync(join(uploadDir, 'ugc', 'user-1', 'ugc-test', 'index.html'))).toBe(true);
    });

    it('应拒绝无效 zip', async () => {
        await packageModel.create({
            packageId: 'ugc-test',
            ownerId: 'user-1',
            name: '测试包',
            status: 'draft',
        });

        const buffer = Buffer.from('not-a-zip');
        const result = await ugcService.uploadPackageZip('user-1', 'ugc-test', {
            buffer,
            originalname: 'package.zip',
            mimetype: 'application/zip',
            size: buffer.length,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe('invalidZip');
        }
    });
});
