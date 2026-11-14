import { expect, test } from '@playwright/test';
import { initContext } from '../helpers/common';

test('自行选择御主和从者后才能完成准备', async ({page, context}, testInfo) => {
    test.setTimeout(180000);
    await initContext(context, { skipImageGate: false });
    await context.addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
    await page.goto('/play/fate-domination?players=3&playerID=0&seed=identity-choice', {waitUntil:'domcontentloaded'});
    const confirm = page.getByTestId('fate-domination-primary-action');
    await expect(page.getByRole('tab', {name:'御主', exact:true})).toBeVisible({timeout:45000});
    await expect(confirm).toBeDisabled();
    await page.getByTestId('fate-setup-master-m_waver').click({timeout:15000});
    await expect(page.getByTestId('fate-setup-master-m_waver')).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'从者',exact:true}).click();
    await expect(confirm).toBeDisabled();
    await page.screenshot({path:testInfo.outputPath('从者选择.png')});
    await page.getByTestId('fate-setup-servant-servant-saber').click();
    await expect(confirm).toBeEnabled();
    await page.screenshot({path:testInfo.outputPath('组合完成.png')});
    await confirm.click();
    await expect(page.getByRole('region',{name:'选择御主与从者'})).toHaveCount(0);
});
