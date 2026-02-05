import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export type LayoutSaveResult = {
    filePath: string;
    relativePath: string;
    bytes: number;
};

@Injectable()
export class LayoutService {
    private readonly baseDir: string;
    private readonly fileName = 'summonerwars.layout.json';

    constructor() {
        const envDir = process.env.LAYOUT_DATA_DIR?.trim();
        if (envDir) {
            this.baseDir = resolve(process.cwd(), envDir);
            return;
        }
        const cwd = process.cwd();
        const marker = `${sep}apps${sep}api`;
        const markerIndex = cwd.lastIndexOf(marker);
        const repoRoot = markerIndex >= 0 ? cwd.slice(0, markerIndex) : cwd;
        this.baseDir = resolve(repoRoot, 'public/game-data');
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

    private toRelativePath(filePath: string) {
        const root = process.cwd();
        if (filePath.startsWith(root)) {
            return filePath.slice(root.length + 1);
        }
        return filePath;
    }
}
