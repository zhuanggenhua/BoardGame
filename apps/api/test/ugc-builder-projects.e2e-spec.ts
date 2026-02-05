import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Model } from 'mongoose';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { GlobalHttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { UgcModule } from '../src/modules/ugc/ugc.module';
import { UgcBuilderProject, type UgcBuilderProjectDocument } from '../src/modules/ugc/schemas/ugc-builder-project.schema';

interface RegisteredUser {
    token: string;
    userId: string;
}

describe('UGC Builder Projects (e2e)', () => {
    let mongo: MongoMemoryServer | null;
    let app: import('@nestjs/common').INestApplication;
    let authService: AuthService;
    let userModel: Model<UserDocument>;
    let builderProjectModel: Model<UgcBuilderProjectDocument>;

    const registerUser = async (email: string, username: string): Promise<RegisteredUser> => {
        const code = '123456';
        await authService.storeEmailCode(email, code);
        const res = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username, email, code, password: 'pass1234' })
            .expect(201);
        return {
            token: res.body.token as string,
            userId: res.body.user.id as string,
        };
    };

    beforeAll(async () => {
        const externalMongoUri = process.env.MONGO_URI;
        mongo = externalMongoUri ? null : await MongoMemoryServer.create();
        const mongoUri = externalMongoUri ?? mongo?.getUri();
        if (!mongoUri) {
            throw new Error('缺少 MongoDB 连接地址，请配置 MONGO_URI 或启用内存 MongoDB');
        }

        const moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register({ isGlobal: true }),
                MongooseModule.forRoot(mongoUri, externalMongoUri ? { dbName: 'boardgame_test_ugc_builder' } : undefined),
                AuthModule,
                UgcModule,
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                transform: true,
            })
        );
        app.useGlobalFilters(new GlobalHttpExceptionFilter());
        await app.init();

        authService = moduleRef.get(AuthService);
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
        builderProjectModel = moduleRef.get<Model<UgcBuilderProjectDocument>>(getModelToken(UgcBuilderProject.name));
    });

    beforeEach(async () => {
        await Promise.all([
            userModel.deleteMany({}),
            builderProjectModel.deleteMany({}),
        ]);
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
        if (mongo) {
            await mongo.stop();
        }
    });

    it('未登录访问应返回 401', async () => {
        await request(app.getHttpServer())
            .get('/ugc/builder/projects')
            .expect(401);

        await request(app.getHttpServer())
            .post('/ugc/builder/projects')
            .send({ name: '未授权' })
            .expect(401);

        await request(app.getHttpServer())
            .get('/ugc/builder/projects/builder-test')
            .expect(401);

        await request(app.getHttpServer())
            .put('/ugc/builder/projects/builder-test')
            .send({ name: '未授权' })
            .expect(401);

        await request(app.getHttpServer())
            .delete('/ugc/builder/projects/builder-test')
            .expect(401);
    });

    it('应完成草稿的创建-读取-更新-删除流程', async () => {
        const user = await registerUser('builder-user@example.com', 'builder-user');

        const createRes = await request(app.getHttpServer())
            .post('/ugc/builder/projects')
            .set('Authorization', `Bearer ${user.token}`)
            .send({
                name: '测试草稿',
                description: '初始描述',
                data: { name: '测试游戏', schemas: [], layout: [] },
            })
            .expect(201);

        expect(createRes.body.projectId).toBeTruthy();
        const projectId = createRes.body.projectId as string;

        const listRes = await request(app.getHttpServer())
            .get('/ugc/builder/projects')
            .set('Authorization', `Bearer ${user.token}`)
            .expect(200);

        expect(listRes.body.items).toHaveLength(1);
        expect(listRes.body.items[0].projectId).toBe(projectId);

        const getRes = await request(app.getHttpServer())
            .get(`/ugc/builder/projects/${projectId}`)
            .set('Authorization', `Bearer ${user.token}`)
            .expect(200);

        expect(getRes.body.name).toBe('测试草稿');
        expect(getRes.body.data?.name).toBe('测试游戏');

        const updateRes = await request(app.getHttpServer())
            .put(`/ugc/builder/projects/${projectId}`)
            .set('Authorization', `Bearer ${user.token}`)
            .send({
                name: '更新草稿',
                description: '更新描述',
                data: { name: '更新后的游戏' },
            })
            .expect(200);

        expect(updateRes.body.name).toBe('更新草稿');
        expect(updateRes.body.description).toBe('更新描述');
        expect(updateRes.body.data?.name).toBe('更新后的游戏');

        await request(app.getHttpServer())
            .delete(`/ugc/builder/projects/${projectId}`)
            .set('Authorization', `Bearer ${user.token}`)
            .expect(200);

        const listAfter = await request(app.getHttpServer())
            .get('/ugc/builder/projects')
            .set('Authorization', `Bearer ${user.token}`)
            .expect(200);

        expect(listAfter.body.items).toHaveLength(0);
    });

    it('不同用户不能访问彼此的草稿', async () => {
        const owner = await registerUser('owner@example.com', 'owner');
        const other = await registerUser('other@example.com', 'other');

        const createRes = await request(app.getHttpServer())
            .post('/ugc/builder/projects')
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ name: '私有草稿', data: { name: '仅自己可见' } })
            .expect(201);

        const projectId = createRes.body.projectId as string;

        await request(app.getHttpServer())
            .get(`/ugc/builder/projects/${projectId}`)
            .set('Authorization', `Bearer ${other.token}`)
            .expect(404);

        await request(app.getHttpServer())
            .put(`/ugc/builder/projects/${projectId}`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({ name: '越权修改' })
            .expect(404);

        await request(app.getHttpServer())
            .delete(`/ugc/builder/projects/${projectId}`)
            .set('Authorization', `Bearer ${other.token}`)
            .expect(404);
    });
});
