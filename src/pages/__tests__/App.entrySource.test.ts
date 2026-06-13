import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('App 首页入口源码守卫', () => {
    it('首页应继续同步引入 HomeEntry，而不是额外拆成懒加载 chunk', () => {
        const source = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');

        expect(source).toContain("import { HomeEntry } from './pages/HomeEntry';");
        expect(source).toContain('element={<HomeEntry />}');
        expect(source).not.toContain("const LazyHomeEntry = React.lazy(() => import('./pages/HomeEntry')");
    });

    it('首页外壳应同步引入 GlobalHUD，避免入口级命名导出懒加载崩溃', () => {
        const source = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');

        expect(source).toContain("import { GlobalHUD } from './components/system/GlobalHUD';");
        expect(source).toContain('{!isPlayRoute ? <GlobalHUD /> : null}');
        expect(source).not.toContain("const LazyGlobalHUD = React.lazy(() => import('./components/system/GlobalHUD')");
    });
});
