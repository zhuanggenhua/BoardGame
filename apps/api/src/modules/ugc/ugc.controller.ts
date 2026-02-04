import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { createRequestI18n } from '../../shared/i18n';
import { CreateUgcPackageDto } from './dtos/create-ugc-package.dto';
import { UgcPackageListQueryDto } from './dtos/ugc-list-query.dto';
import { UpdateUgcPackageDto } from './dtos/update-ugc-package.dto';
import { UploadUgcAssetDto } from './dtos/upload-ugc-asset.dto';
import { UgcService } from './ugc.service';

@Controller('ugc')
export class UgcController {
    constructor(@Inject(UgcService) private readonly ugcService: UgcService) {}

    @Get('packages')
    async listPublished(@Query() query: UgcPackageListQueryDto, @Res() res: Response) {
        const result = await this.ugcService.listPublished(query);
        return res.json(result);
    }

    @Get('packages/:packageId')
    async getPublished(@Param('packageId') packageId: string, @Res() res: Response) {
        const pkg = await this.ugcService.getPublishedPackage(packageId.trim());
        if (!pkg) {
            return this.sendError(res, 404, '未找到已发布的 UGC 包');
        }
        return res.json(pkg);
    }

    @Get('packages/:packageId/manifest')
    async getPublishedManifest(@Param('packageId') packageId: string, @Res() res: Response) {
        const manifest = await this.ugcService.getPublishedManifest(packageId.trim());
        if (!manifest) {
            return this.sendError(res, 404, '未找到已发布的 UGC 包');
        }
        return res.json({ manifest });
    }

    @UseGuards(JwtAuthGuard)
    @Get('my/packages')
    async listMine(
        @CurrentUser() currentUser: { userId: string } | null,
        @Query() query: UgcPackageListQueryDto,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }
        const result = await this.ugcService.listOwnerPackages(currentUser.userId, query);
        return res.json(result);
    }

    @UseGuards(JwtAuthGuard)
    @Get('my/packages/:packageId')
    async getMine(
        @CurrentUser() currentUser: { userId: string } | null,
        @Param('packageId') packageId: string,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }
        const pkg = await this.ugcService.getOwnerPackage(currentUser.userId, packageId.trim());
        if (!pkg) {
            return this.sendError(res, 404, '未找到 UGC 包');
        }
        return res.json(pkg);
    }

    @UseGuards(JwtAuthGuard)
    @Post('packages')
    async createPackage(
        @CurrentUser() currentUser: { userId: string } | null,
        @Body() body: CreateUgcPackageDto,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }
        const result = await this.ugcService.createPackage(currentUser.userId, body);
        if (!result.ok) {
            return this.sendError(res, 409, 'packageId 已存在');
        }
        return res.status(201).json(result.data);
    }

    @UseGuards(JwtAuthGuard)
    @Post('my/packages/:packageId/package')
    @UseInterceptors(FileInterceptor('file'))
    async uploadPackageZip(
        @CurrentUser() currentUser: { userId: string } | null,
        @Param('packageId') packageId: string,
        @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype?: string; size: number } | undefined,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }
        if (!file) {
            return this.sendError(res, 400, '缺少上传文件');
        }
        const result = await this.ugcService.uploadPackageZip(currentUser.userId, packageId.trim(), file);
        if (!result.ok) {
            if (result.code === 'notFound') {
                return this.sendError(res, 404, '未找到 UGC 包');
            }
            if (result.code === 'tooLarge') {
                return this.sendError(res, 400, '文件过大');
            }
            if (result.code === 'invalidZip') {
                return this.sendError(res, 400, 'zip 包格式无效');
            }
            if (result.code === 'invalidEntry') {
                return this.sendError(res, 400, result.message ?? '入口文件不合法');
            }
            if (result.code === 'invalidPackage') {
                return this.sendError(res, 400, result.message ?? '包结构不合法');
            }
            if (result.code === 'storageFailed') {
                return this.sendError(res, 500, result.message ?? '包存储失败');
            }
            return this.sendError(res, 400, result.message ?? '包处理失败');
        }
        return res.status(201).json(result.data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('packages/:packageId')
    async updatePackage(
        @CurrentUser() currentUser: { userId: string } | null,
        @Param('packageId') packageId: string,
        @Body() body: UpdateUgcPackageDto,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }
        const result = await this.ugcService.updatePackage(currentUser.userId, packageId.trim(), body);
        if (!result.ok) {
            return this.sendError(res, 404, '未找到 UGC 包');
        }
        return res.json(result.data);
    }

    @UseGuards(JwtAuthGuard)
    @Post('packages/:packageId/publish')
    async publishPackage(
        @CurrentUser() currentUser: { userId: string } | null,
        @Param('packageId') packageId: string,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }
        const result = await this.ugcService.publishPackage(currentUser.userId, packageId.trim());
        if (!result.ok) {
            if (result.code === 'missingManifest') {
                return this.sendError(res, 400, 'manifest 缺失，无法发布');
            }
            return this.sendError(res, 404, '未找到 UGC 包');
        }
        return res.json(result.data);
    }

    @UseGuards(JwtAuthGuard)
    @Get('my/packages/:packageId/assets')
    async listAssets(
        @CurrentUser() currentUser: { userId: string } | null,
        @Param('packageId') packageId: string,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }
        const assets = await this.ugcService.listAssets(currentUser.userId, packageId.trim());
        return res.json({ assets });
    }

    @UseGuards(JwtAuthGuard)
    @Post('my/packages/:packageId/assets')
    @UseInterceptors(FileInterceptor('file'))
    async uploadAsset(
        @CurrentUser() currentUser: { userId: string } | null,
        @Param('packageId') packageId: string,
        @Body() body: UploadUgcAssetDto,
        @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype?: string; size: number } | undefined,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }
        if (!file) {
            return this.sendError(res, 400, '缺少上传文件');
        }
        const result = await this.ugcService.uploadAsset(currentUser.userId, packageId.trim(), body, file);
        if (!result.ok) {
            if (result.code === 'notFound') {
                return this.sendError(res, 404, '未找到 UGC 包');
            }
            if (result.code === 'tooLarge') {
                return this.sendError(res, 400, '文件过大');
            }
            if (result.code === 'invalidType') {
                return this.sendError(res, 400, '不支持的资源类型');
            }
            return this.sendError(res, 400, result.message ?? '资源处理失败');
        }
        return res.status(201).json(result.data);
    }

    private sendError(res: Response, status: number, message: string) {
        return res.status(status).json({ error: message });
    }
}
