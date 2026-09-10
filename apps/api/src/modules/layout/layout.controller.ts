import { Body, Controller, Post, Req, Res, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LayoutService } from './layout.service';
import type {
    AbilitySlotLayoutItem,
    DiceThroneAbilityLayoutVersion,
    DiceThroneBoardLayoutPayload,
    PlayerBoardUiTuning,
} from './layout.service';

@Controller('layout')
export class LayoutController {
    constructor(@Inject(LayoutService) private readonly layoutService: LayoutService) {}

    @Post('summonerwars')
    async saveSummonerWarsLayout(
        @Body() body: unknown,
        @Req() req: Request,
        @Res() res: Response
    ) {
        if (process.env.NODE_ENV === 'production' && process.env.LAYOUT_SAVE_ALLOW !== '1') {
            return res.status(403).json({ error: '布局保存已禁用' });
        }
        try {
            if (!this.layoutService || typeof this.layoutService.saveSummonerWarsLayout !== 'function') {
                return res.status(500).json({ error: '布局保存失败', message: 'layoutService.missing', path: req.path });
            }
            const payload = this.normalizeBody(body);
            if (!payload) {
                return res.status(400).json({ error: '布局保存失败', message: 'layoutConfig.invalid', path: req.path });
            }
            const result = await this.layoutService.saveSummonerWarsLayout(payload);
            return res.status(201).json(result);
        } catch (error) {
            const message = error instanceof Error ? error.message : '未知错误';
            return res.status(400).json({ error: '布局保存失败', message, path: req.path });
        }
    }

    @Post('dicethrone/ability-layout')
    async saveDiceThroneAbilityLayout(
        @Body() body: unknown,
        @Req() req: Request,
        @Res() res: Response
    ) {
        if (process.env.NODE_ENV === 'production' && process.env.LAYOUT_SAVE_ALLOW !== '1') {
            return res.status(403).json({ error: '布局保存已禁用' });
        }
        try {
            const payload = this.normalizeBoardLayoutPayload(body);
            if (!payload) {
                return res.status(400).json({ error: '布局保存失败', message: 'layoutConfig.invalid', path: req.path });
            }
            const result = await this.layoutService.saveDiceThroneAbilityLayout(payload);
            return res.status(201).json(result);
        } catch (error) {
            const message = error instanceof Error ? error.message : '未知错误';
            return res.status(400).json({ error: '布局保存失败', message, path: req.path });
        }
    }

    private normalizeBody(body: unknown): Record<string, unknown> | null {
        if (!body) return null;
        if (typeof body === 'string') {
            try {
                const parsed = JSON.parse(body) as Record<string, unknown>;
                return parsed && typeof parsed === 'object' ? parsed : null;
            } catch {
                return null;
            }
        }
        if (typeof body === 'object') {
            return body as Record<string, unknown>;
        }
        return null;
    }

    private normalizeArrayBody(body: unknown): Array<Record<string, unknown>> | null {
        if (!body) return null;
        if (typeof body === 'string') {
            try {
                const parsed = JSON.parse(body) as unknown;
                return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : null;
            } catch {
                return null;
            }
        }
        if (Array.isArray(body)) {
            return body as Array<Record<string, unknown>>;
        }
        return null;
    }

    private normalizeBoardLayoutPayload(body: unknown): DiceThroneBoardLayoutPayload | null {
        if (!body) return null;
        const raw = this.normalizeBody(body);
        const slotLayouts = raw?.slotLayouts as Record<string, unknown> | undefined;
        const uiTuning = raw?.uiTuning as Record<string, unknown> | undefined;
        if (!slotLayouts || typeof slotLayouts !== 'object' || !uiTuning || typeof uiTuning !== 'object') {
            return null;
        }

        const versions: DiceThroneAbilityLayoutVersion[] = ['v1', 'v2'];
        const normalizedSlotLayouts = {} as Record<DiceThroneAbilityLayoutVersion, AbilitySlotLayoutItem[]>;
        const normalizedUiTuning = {} as Record<DiceThroneAbilityLayoutVersion, PlayerBoardUiTuning>;
        for (const version of versions) {
            const normalizedLayout = this.normalizeAbilityLayoutArray(slotLayouts[version]);
            const normalizedTuning = this.normalizeUiTuning(uiTuning[version]);
            if (!normalizedLayout || !normalizedTuning) return null;
            normalizedSlotLayouts[version] = normalizedLayout;
            normalizedUiTuning[version] = normalizedTuning;
        }

        return {
            slotLayouts: normalizedSlotLayouts,
            uiTuning: normalizedUiTuning,
        };
    }

    private normalizeAbilityLayoutArray(body: unknown): AbilitySlotLayoutItem[] | null {
        const raw = this.normalizeArrayBody(body);
        if (!raw) return null;
        const normalized: AbilitySlotLayoutItem[] = [];
        for (const item of raw) {
            if (!item || typeof item !== 'object') return null;
            const record = item as Record<string, unknown>;
            const { id, x, y, w, h } = record;
            if (typeof id !== 'string') return null;
            if (![x, y, w, h].every((value) => typeof value === 'number' && Number.isFinite(value))) {
                return null;
            }
            normalized.push({ id, x: x as number, y: y as number, w: w as number, h: h as number });
        }
        return normalized.length > 0 ? normalized : null;
    }

    private normalizeUiTuning(body: unknown): PlayerBoardUiTuning | null {
        if (!body || typeof body !== 'object') return null;
        const record = body as Record<string, unknown>;
        const {
            shellTranslateX,
            playerBoardTranslateY,
            magnifyButtonTop,
            playerBoardBaseHeightUnits,
            tipBoardHeightUnits,
            centerBoardGapUnits,
        } = record;

        if (![
            shellTranslateX,
            playerBoardTranslateY,
            magnifyButtonTop,
            playerBoardBaseHeightUnits,
            tipBoardHeightUnits,
            centerBoardGapUnits,
        ].every((value) => typeof value === 'number' && Number.isFinite(value))) {
            return null;
        }

        return {
            shellTranslateX,
            playerBoardTranslateY,
            magnifyButtonTop,
            playerBoardBaseHeightUnits,
            tipBoardHeightUnits,
            centerBoardGapUnits,
        } as PlayerBoardUiTuning;
    }
}
