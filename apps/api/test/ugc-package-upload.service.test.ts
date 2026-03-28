import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { join } from 'node:path';
import { existsSync, rmSync } from 'node:fs';

// 必须在导入 UgcModule 之前设置环境变量。
const uploadDir = join(process.cwd(), 'uploads-test');
process.env.UGC_STORAGE_MODE = 'local';
process.env.UGC_LOCAL_PATH = uploadDir;
process.env.UGC_PUBLIC_URL_BASE = '/assets';

import { CacheModule } from '@nestjs/cache-manager';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import { UgcModule } from '../src/modules/ugc/ugc.module';
import { UgcService } from '../src/modules/ugc/ugc.service';
import { UgcPackage, type UgcPackageDocument } from '../src/modules/ugc/schemas/ugc-package.schema';

const VALID_PACKAGE_ZIP_BASE64 = 'UEsDBBQAAAAIALW+eVx0fVLnLwAAADoAAAAKAAAAaW5kZXguaHRtbLNRdPF3DokMcFXIKMnNsbOBkMXJRZkFJXYF+cUlvqnFxYnpqRqaNvpQURt9sCIAUEsDBBQAAAAIALW+eVzPzIVUFQAAABMAAAAHAAAAbWFpbi5qc0vOzyvOz0nVy8lP11DKTczMU9IEAFBLAwQUAAAACAC1vnlcbUMIY0wAAABYAAAACQAAAGRvbWFpbi5qc0vOzysuUUjJz03MzFOwVahWSE/MTfVMsVJQKk1P1i1JLS5R0lEoTi0pLdDQrK7VUShLzMlMSSxJhfBSK1KTS2GcotSU0mQwW6HWGgBQSwMEFAAAAAgAtb55XNYasMQoAAAAJgAAAAsAAAB0dXRvcmlhbC5qc0utKMgvKlFIzs8rLlEoKS3JL8pMzFGwVahWKC5JLSi2UoiOVai1BgBQSwMEFAAAAAgAtb55XFawCwyIAAAAxQAAAA0AAABtYW5pZmVzdC5qc29uXY5LDsIwDETv4nUblW1vwBkQC6txUkM+VeIgUNW74wgkJHbzxp7R7BBJ0KIgzDuwhRmaX0ahKjBAwkjqdBo3XO7oSd0Hlco56eFkJjOpI6+t/7kWgpLX1PmvCZusuXy7qMAxgONAFeYLcLL0NKvEHo7IydyqKpt/Wprkwhg+FDGx0x4lnXE93lBLAQIUABQAAAAIALW+eVx0fVLnLwAAADoAAAAKAAAAAAAAAAAAAAAAAAAAAABpbmRleC5odG1sUEsBAhQAFAAAAAgAtb55XM/MhVQVAAAAEwAAAAcAAAAAAAAAAAAAAAAAVwAAAG1haW4uanNQSwECFAAUAAAACAC1vnlcbUMIY0wAAABYAAAACQAAAAAAAAAAAAAAAACRAAAAZG9tYWluLmpzUEsBAhQAFAAAAAgAtb55XNYasMQoAAAAJgAAAAsAAAAAAAAAAAAAAAAABAEAAHR1dG9yaWFsLmpzUEsBAhQAFAAAAAgAtb55XFawCwyIAAAAxQAAAA0AAAAAAAAAAAAAAAAAVQEAAG1hbmlmZXN0Lmpzb25QSwUGAAAAAAUABQAYAQAACAIAAAAA';

describe('UgcService.uploadPackageZip', () => {
    let mongo: MongoMemoryServer | null;
    let moduleRef: import('@nestjs/testing').TestingModule;
    let ugcService: UgcService;
    let packageModel: Model<UgcPackageDocument>;

    beforeAll(async () => {
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
        return Buffer.from(VALID_PACKAGE_ZIP_BASE64, 'base64');
    };

    it('应上传 zip 并更新 manifest 与入口', async () => {
        await packageModel.create({
            packageId: 'ugc-test',
            ownerId: 'user-1',
            name: 'test-package',
            status: 'draft',
        });

        const buffer = buildZipBuffer();
        const result = await ugcService.uploadPackageZip('user-1', 'ugc-test', {
            buffer,
            originalname: 'package.zip',
            mimetype: 'application/zip',
            size: buffer.length,
        });

        if (!result.ok) {
            throw new Error(`Upload failed: ${result.code} - ${result.message || 'no message'}`);
        }
        expect(result.ok).toBe(true);

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
            name: 'test-package',
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
