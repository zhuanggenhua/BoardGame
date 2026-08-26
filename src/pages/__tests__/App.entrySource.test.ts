import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('App 首页入口源码守卫', () => {
    it('首页应按路由加载，避免配置表同步转换首页目录', () => {
        const source = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');

        expect(source).toContain("const LazyHomeEntry = React.lazy(() => import('./pages/HomeEntry')");
        expect(source).toContain('<LazyHomeEntry />');
    });

    it('首页外壳应同步引入 GlobalHUD，避免入口级命名导出懒加载崩溃', () => {
        const source = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');

        expect(source).toContain("import { GlobalHUD } from './components/system/GlobalHUD';");
        expect(source).toContain('{!isPlayRoute ? <GlobalHUD feedbackGameOptions={feedbackGameOptions} /> : null}');
        expect(source).not.toContain("const LazyGlobalHUD = React.lazy(() => import('./components/system/GlobalHUD')");
    });

    it('配置表路由应消费共享定义，不在完整应用里重复维护路径', () => {
        const source = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');

        expect(source).toContain("from './pages/ConfigReviewRoutes';");
        expect(source).toContain('CONFIG_REVIEW_PAGE_ROUTES.map');
        expect(source).not.toContain('path="/games/betrayal/config"');
    });
});
