import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    initContext,
} from '../helpers/common';
import { saveScreenshot } from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-config-review/explorer-assets';
const SEARCH_RESULT_SCREENSHOT = `${EVIDENCE_DIR}/01-配置表搜索探索者-面板与Token预览.jpg`;
const TOKEN_FIELDS_SCREENSHOT = `${EVIDENCE_DIR}/02-配置表横向字段-Token源图与职责.jpg`;
const PANEL_PICKER_SCREENSHOT = `${EVIDENCE_DIR}/03-点击面板图-面板候选列表.jpg`;
const TOKEN_PICKER_SCREENSHOT = `${EVIDENCE_DIR}/04-点击地图Token-Token候选列表.jpg`;
const EDIT_DRAFT_SCREENSHOT = `${EVIDENCE_DIR}/05-选择地图Token-待提交修正.jpg`;
const PROPOSAL_MODAL_SCREENSHOT = `${EVIDENCE_DIR}/06-配置表修改交互-修正提案弹窗.jpg`;

const DRAFT_TOKEN_ASSET = 'betrayal/tokens/explorers/darryl-highla';

test.describe('山屋惊魂配置表探索者素材关联', () => {
    test('真实配置表入口可索引探索者玩家面板资源和地图 token', async ({ page, context }) => {
        test.setTimeout(90000);
        await initContext(context, {
            storageKey: 'betrayal-config-review-explorer-assets',
            skipTutorial: true,
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1600, height: 900 });
        await page.goto('/games/betrayal/config', { waitUntil: 'domcontentloaded' });

        await expect(page.getByRole('heading', { name: '小黑屋配置表' })).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-config-table')).toBeVisible();

        await page.getByTestId('betrayal-config-type-filter').selectOption('explorer');
        await page.getByTestId('betrayal-config-search').fill('jaden-jones');

        await expect(page.getByTestId('betrayal-config-visible-range')).toContainText('1 / 1');
        await expect(page.getByText('杰登·琼斯')).toBeVisible();
        const panelAssetCell = page.getByTestId('betrayal-config-asset-picker-cell-panelAsset');
        await expect(panelAssetCell).toContainText('Jade Jones');
        await expect(panelAssetCell).not.toContainText('betrayal/explorers/jade-jones');
        await expect(panelAssetCell).toHaveAttribute('data-asset', 'betrayal/explorers/jade-jones');
        await expect(page.getByText('Jade Jones · PNG · 面板源图已索引', { exact: true })).toBeVisible();
        await expect(page.getByText('public/assets/i18n/zh-CN/betrayal/explorers/jade-jones.png', { exact: true })).toHaveCount(0);

        const preview = page.getByTestId('betrayal-config-explorer-asset-preview');
        await expect(preview).toHaveCount(1);
        await expect(preview).toHaveAttribute('data-panel-asset', 'betrayal/explorers/jade-jones');
        await expect(preview).toHaveAttribute('data-map-token-asset', 'betrayal/tokens/explorers/jaden-jones');
        await saveScreenshot(page, SEARCH_RESULT_SCREENSHOT);

        await page.getByTestId('betrayal-config-table').evaluate((element) => {
            element.scrollTo({ left: 1500, top: 0 });
        });
        const mapTokenAssetCell = page.getByTestId('betrayal-config-asset-picker-cell-mapTokenAsset');
        await expect(mapTokenAssetCell).toContainText('Jaden Jones');
        await expect(mapTokenAssetCell).not.toContainText('betrayal/tokens/explorers/jaden-jones');
        await expect(mapTokenAssetCell).toHaveAttribute('data-asset', 'betrayal/tokens/explorers/jaden-jones');
        await expect(page.getByText('Jaden Jones · PNG · 地图 Token 源图已索引', { exact: true })).toBeVisible();
        await expect(page.getByText('Jaden Jones · WEBP · 地图 Token 运行压缩图已索引', { exact: true })).toBeVisible();
        await expect(page.getByText('public/assets/i18n/zh-CN/betrayal/tokens/explorers/jaden-jones.png', { exact: true })).toHaveCount(0);
        await expect(page.getByText('public/assets/i18n/zh-CN/betrayal/tokens/explorers/compressed/jaden-jones.webp', { exact: true })).toHaveCount(0);
        await expect(page.getByText('玩家面板使用 panelAsset / portraitAsset；地图房间角色 token 使用 mapTokenAsset / tokenAsset；两者不能互相替代', { exact: true })).toBeVisible();
        await saveScreenshot(page, TOKEN_FIELDS_SCREENSHOT);

        await page.getByTestId('betrayal-config-table').evaluate((element) => {
            element.scrollTo({ left: 0, top: 0 });
        });
        await page.getByTestId('betrayal-config-explorer-asset-panel-button').click();
        await expect(page.getByTestId('betrayal-config-asset-picker')).toBeVisible();
        await expect(page.getByTestId('betrayal-config-asset-picker-title')).toContainText('玩家面板资源');
        const panelOption = page.locator('[data-testid="betrayal-config-asset-picker-option"][data-asset="betrayal/explorers/jade-jones"]');
        await expect(panelOption).toBeVisible();
        await expect(panelOption).toContainText('Jade Jones');
        await expect(panelOption).not.toContainText('betrayal/explorers/jade-jones');
        await saveScreenshot(page, PANEL_PICKER_SCREENSHOT);
        await page.getByTestId('betrayal-config-asset-picker-close').click();
        await expect(page.getByTestId('betrayal-config-asset-picker')).toBeHidden();

        await page.getByTestId('betrayal-config-explorer-asset-token-button').click();
        await expect(page.getByTestId('betrayal-config-asset-picker')).toBeVisible();
        await expect(page.getByTestId('betrayal-config-asset-picker-title')).toContainText('地图 Token');
        await expect(page.getByText('点击正确 Token 图；提交前只是草稿。', { exact: true })).toBeVisible();
        const draftTokenOption = page.locator(`[data-testid="betrayal-config-asset-picker-option"][data-asset="${DRAFT_TOKEN_ASSET}"]`);
        await draftTokenOption.scrollIntoViewIfNeeded();
        await expect(draftTokenOption).toBeVisible();
        await expect(draftTokenOption).not.toContainText('Darryl Highla');
        await expect(draftTokenOption).not.toContainText('Token 候选');
        await expect(draftTokenOption).not.toContainText('正式素材候选');
        await expect(draftTokenOption).not.toContainText(DRAFT_TOKEN_ASSET);
        await saveScreenshot(page, TOKEN_PICKER_SCREENSHOT);
        await draftTokenOption.click();

        await expect(page.getByTestId('betrayal-config-asset-picker')).toBeHidden();
        await expect(page.getByTestId('betrayal-config-asset-picker-cell-mapTokenAsset')).toContainText('Darryl Highla');
        await expect(page.getByTestId('betrayal-config-asset-picker-cell-mapTokenAsset')).not.toContainText(DRAFT_TOKEN_ASSET);
        await expect(page.getByTestId('betrayal-config-asset-picker-cell-mapTokenAsset')).toHaveAttribute('data-asset', DRAFT_TOKEN_ASSET);
        await expect(page.getByTestId('betrayal-config-explorer-asset-preview')).toHaveAttribute('data-map-token-asset', DRAFT_TOKEN_ASSET);
        await expect(page.getByTestId('betrayal-config-pending-count')).toContainText('已暂存 1 个字段修改');
        await expect(page.getByTestId('betrayal-config-submit-edits')).toContainText('提交修正（1）');
        await expect(page.getByTestId('betrayal-config-submit-edits')).toBeEnabled();
        await saveScreenshot(page, EDIT_DRAFT_SCREENSHOT);

        await page.getByTestId('betrayal-config-submit-edits').click();
        await expect(page.getByTestId('feedback-modal')).toBeVisible();
        await expect(page.getByTestId('feedback-config-proposal-context')).toContainText('配置修正提案');
        await expect(page.getByTestId('feedback-config-proposal-context')).toContainText('杰登·琼斯');
        await expect(page.getByTestId('feedback-config-proposal-change')).toContainText('Jaden Jones');
        await expect(page.getByTestId('feedback-config-proposal-change')).toContainText('Darryl Highla');
        await expect(page.getByTestId('feedback-config-proposal-change')).not.toContainText('betrayal/tokens/explorers/jaden-jones');
        await expect(page.getByTestId('feedback-config-proposal-change')).not.toContainText(DRAFT_TOKEN_ASSET);
        await saveScreenshot(page, PROPOSAL_MODAL_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-config-review-explorer-assets', diagnostics }]);
    });
});
