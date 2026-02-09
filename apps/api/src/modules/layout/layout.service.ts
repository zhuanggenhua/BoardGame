import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

export type LayoutSaveResult = {
    filePath: string;
    relativePath: string;
    bytes: number;
};

export type AbilitySlotLayoutItem = {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
};

@Injectable()
export class LayoutService {
    private readonly baseDir: string;
    private readonly fileName = 'summonerwars.layout.json';
    private readonly repoRoot: string;
    private readonly abilityLayoutPath: string;

    constructor() {
        const cwd = process.cwd();
        const marker = `${sep}apps${sep}api`;
        const markerIndex = cwd.lastIndexOf(marker);
        this.repoRoot = markerIndex >= 0 ? cwd.slice(0, markerIndex) : cwd;
        const envDir = process.env.LAYOUT_DATA_DIR?.trim();
        if (envDir) {
            this.baseDir = resolve(cwd, envDir);
        } else {
            this.baseDir = resolve(this.repoRoot, 'public/game-data');
        }
        const envAbilityPath = process.env.DICETHRONE_ABILITY_LAYOUT_PATH?.trim();
        this.abilityLayoutPath = envAbilityPath
            ? resolve(cwd, envAbilityPath)
            : resolve(this.repoRoot, 'src/games/dicethrone/ui/abilitySlotLayout.ts');
    }

    async saveSummonerWarsLayout(config: Record<string, unknown>): Promise<LayoutSaveResult> {
        if (!config || typeof config !== 'object') {
            throw new Error('layoutConfig.invalid');
        }
        await mkdir(this.baseDir, { recursive: true });
        const filePath = resolve(this.baseDir, this.fileName);
        const content = JSON.stringify(config, null, 2);
        await writeFile(filePath, content, 'utf8');
        return {
            filePath,
            relativePath: this.toRelativePath(filePath),
            bytes: Buffer.byteLength(content, 'utf8'),
        };
    }

    async saveDiceThroneAbilityLayout(layout: AbilitySlotLayoutItem[]): Promise<LayoutSaveResult> {
        if (!Array.isArray(layout) || layout.length === 0) {
            throw new Error('layoutConfig.invalid');
        }
        const content = this.buildDiceThroneAbilityLayoutFile(layout);
        await mkdir(dirname(this.abilityLayoutPath), { recursive: true });
        await writeFile(this.abilityLayoutPath, content, 'utf8');
        return {
            filePath: this.abilityLayoutPath,
            relativePath: this.toRelativePath(this.abilityLayoutPath),
            bytes: Buffer.byteLength(content, 'utf8'),
        };
    }

    private buildDiceThroneAbilityLayoutFile(layout: AbilitySlotLayoutItem[]) {
        const lines = layout.map((slot) => {
            const x = this.formatSlotValue(slot.x);
            const y = this.formatSlotValue(slot.y);
            const w = this.formatSlotValue(slot.w);
            const h = this.formatSlotValue(slot.h);
            return `    { id: '${slot.id}', x: ${x}, y: ${y}, w: ${w}, h: ${h} },`;
        });
        return `/**\n * DiceThrone 技能槽布局（游戏级配置）\n * - 使用百分比坐标，基于玩家面板图片\n * - 所有用户共享一致配置\n */\nexport interface AbilitySlotLayoutItem {\n    id: string;\n    x: number;\n    y: number;\n    w: number;\n    h: number;\n}\n\nexport const DEFAULT_ABILITY_SLOT_LAYOUT: AbilitySlotLayoutItem[] = [\n${lines.join('\n')}\n];\n`;
    }

    private formatSlotValue(value: number) {
        if (!Number.isFinite(value)) return '0';
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }

    private toRelativePath(filePath: string) {
        const root = process.cwd();
        if (filePath.startsWith(root)) {
            return filePath.slice(root.length + 1);
        }
        return filePath;
    }
}
