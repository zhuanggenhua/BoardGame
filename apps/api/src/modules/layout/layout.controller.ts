import { Body, Controller, Post, Req, Res, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LayoutService } from './layout.service';
import type { AbilitySlotLayoutItem } from './layout.service';

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
            // TODO: 调试布局保存后移除日志（确认 DI 是否异常）
            const hasService = !!this.layoutService && typeof this.layoutService.saveSummonerWarsLayout === 'function';
            console.log(`[Layout] save request hasService=${hasService} bodyType=${typeof body} path=${req.path}`);
            if (!hasService) {
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
            const payload = this.normalizeAbilityLayoutBody(body);
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

    private normalizeAbilityLayoutBody(body: unknown): AbilitySlotLayoutItem[] | null {
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
}
