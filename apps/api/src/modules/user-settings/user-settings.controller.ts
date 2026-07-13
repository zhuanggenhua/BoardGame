import { Body, Controller, Get, Inject, Param, Post, Put, Req, Res, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { createRequestI18n } from '../../shared/i18n';
import { UpdateAudioSettingsDto, UpdateSmashUpPreferenceDto } from './dtos/audio-settings.dto';
import { UserSettingsService } from './user-settings.service';

@Controller('auth/user-settings')
export class UserSettingsController {
    constructor(@Inject(UserSettingsService) private readonly userSettingsService: UserSettingsService) {}

    @UseGuards(JwtAuthGuard)
    @Get('audio')
    async getAudioSettings(
        @CurrentUser() currentUser: { userId: string } | null,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }

        const settings = await this.userSettingsService.getAudioSettings(currentUser.userId);
        if (!settings) {
            return res.json({ empty: true, settings: null });
        }

        return res.json({
            empty: false,
            settings: this.formatAudioSettings(settings),
        });
    }

    @UseGuards(JwtAuthGuard)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true, expectedType: UpdateAudioSettingsDto }))
    @Put('audio')
    async updateAudioSettings(
        @CurrentUser() currentUser: { userId: string } | null,
        @Body() body: UpdateAudioSettingsDto,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }

        const updated = await this.userSettingsService.upsertAudioSettings(currentUser.userId, body);
        return res.status(201).json({ settings: this.formatAudioSettings(updated) });
    }

    @UseGuards(JwtAuthGuard)
    @Get('smashup')
    async getSmashUpPreference(
        @CurrentUser() currentUser: { userId: string } | null,
        @Res() res: Response
    ) {
        if (!currentUser?.userId) return res.status(401).json({ error: 'Unauthorized' });
        const settings = await this.userSettingsService.getSmashUpPreference(currentUser.userId);
        if (!settings) {
            return res.json({ empty: true, settings: null });
        }
        return res.json({ empty: false, settings });
    }

    @UseGuards(JwtAuthGuard)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true, expectedType: UpdateSmashUpPreferenceDto }))
    @Put('smashup')
    async updateSmashUpPreference(
        @CurrentUser() currentUser: { userId: string } | null,
        @Body() body: UpdateSmashUpPreferenceDto,
        @Res() res: Response
    ) {
        if (!currentUser?.userId) return res.status(401).json({ error: 'Unauthorized' });
        await this.userSettingsService.upsertSmashUpPreference(
            currentUser.userId,
            body.overlayEnabled,
            body.interactionMode,
        );
        return res.status(201).json({
            settings: {
                overlayEnabled: body.overlayEnabled,
                interactionMode: body.interactionMode,
            },
        });
    }

    private formatAudioSettings(settings: {
        muted: boolean;
        masterVolume: number;
        sfxVolume: number;
        bgmVolume: number;
        bgmSelections?: Record<string, Record<string, string>>;
        singleTrackLoop?: boolean;
    }) {
        return {
            muted: settings.muted,
            masterVolume: settings.masterVolume,
            sfxVolume: settings.sfxVolume,
            bgmVolume: settings.bgmVolume,
            bgmSelections: settings.bgmSelections ?? {},
            singleTrackLoop: settings.singleTrackLoop === true,
        };
    }

    private sendError(res: Response, status: number, message: string) {
        return res.status(status).json({ error: message });
    }

    @UseGuards(JwtAuthGuard)
    @Get('ui-hints')
    async getSeenHints(
        @CurrentUser() currentUser: { userId: string } | null,
        @Res() res: Response
    ) {
        if (!currentUser?.userId) return res.status(401).json({ error: 'Unauthorized' });
        const seenHints = await this.userSettingsService.getSeenHints(currentUser.userId);
        return res.json({ seenHints });
    }

    @UseGuards(JwtAuthGuard)
    @Post('ui-hints/:key')
    async markHintSeen(
        @CurrentUser() currentUser: { userId: string } | null,
        @Param('key') key: string,
        @Res() res: Response
    ) {
        if (!currentUser?.userId) return res.status(401).json({ error: 'Unauthorized' });
        await this.userSettingsService.markHintSeen(currentUser.userId, key);
        return res.status(201).json({ ok: true });
    }

    @UseGuards(JwtAuthGuard)
    @Get('cursor')
    async getCursorPreference(
        @CurrentUser() currentUser: { userId: string } | null,
        @Res() res: Response
    ) {
        if (!currentUser?.userId) return res.status(401).json({ error: 'Unauthorized' });
        const settings = await this.userSettingsService.getCursorPreference(currentUser.userId);
        if (!settings) {
            return res.json({ empty: true, settings: null });
        }
        return res.json({ empty: false, settings });
    }

    @UseGuards(JwtAuthGuard)
    @Put('cursor')
    async updateCursorPreference(
        @CurrentUser() currentUser: { userId: string } | null,
        @Body() body: {
            cursorTheme?: string;
            overrideScope?: string;
            highContrast?: boolean;
            gameVariants?: Record<string, string>;
        },
        @Res() res: Response
    ) {
        if (!currentUser?.userId) return res.status(401).json({ error: 'Unauthorized' });
        const cursorTheme = typeof body.cursorTheme === 'string' ? body.cursorTheme : 'default';
        const overrideScope = body.overrideScope === 'all' ? 'all' : 'home';
        const highContrast = body.highContrast === true;
        const gameVariants = normalizeGameVariants(body.gameVariants);
        await this.userSettingsService.upsertCursorPreference(
            currentUser.userId, cursorTheme, overrideScope, highContrast, gameVariants,
        );
        return res.status(201).json({ settings: { cursorTheme, overrideScope, highContrast, gameVariants } });
    }

    @UseGuards(JwtAuthGuard)
    @Get('local-ai/:gameId')
    async getLocalAiMatchPreference(
        @CurrentUser() currentUser: { userId: string } | null,
        @Param('gameId') gameId: string,
        @Res() res: Response,
    ) {
        if (!currentUser?.userId) return res.status(401).json({ error: 'Unauthorized' });
        const settings = await this.userSettingsService.getLocalAiMatchPreference(currentUser.userId, gameId);
        if (!settings) {
            return res.json({ empty: true, settings: null });
        }
        return res.json({ empty: false, settings });
    }

    @UseGuards(JwtAuthGuard)
    @Put('local-ai/:gameId')
    async updateLocalAiMatchPreference(
        @CurrentUser() currentUser: { userId: string } | null,
        @Param('gameId') gameId: string,
        @Body() body: {
            numPlayers?: unknown;
            seatControllers?: Record<string, unknown>;
            setupSelections?: Record<string, string | string[]>;
        },
        @Res() res: Response,
    ) {
        if (!currentUser?.userId) return res.status(401).json({ error: 'Unauthorized' });
        const settings = {
            numPlayers: typeof body?.numPlayers === 'number' ? body.numPlayers : Number(body?.numPlayers),
            seatControllers: body?.seatControllers,
            setupSelections: body?.setupSelections,
        };
        await this.userSettingsService.upsertLocalAiMatchPreference(currentUser.userId, gameId, settings);
        const saved = await this.userSettingsService.getLocalAiMatchPreference(currentUser.userId, gameId);
        return res.status(201).json({ settings: saved });
    }
}


/** gameVariants 只允许 string→string 映射，过滤非法值 */
function normalizeGameVariants(input?: Record<string, string>): Record<string, string> {
    if (!input || typeof input !== 'object') return {};
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(input)) {
        if (typeof key === 'string' && typeof val === 'string') {
            result[key] = val;
        }
    }
    return result;
}
