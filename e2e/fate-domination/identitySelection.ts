import type { Page } from '@playwright/test';

/** 仅驱动正式选角页面的真实候选与类型切换，不写运行时状态。 */
export async function chooseFateIdentity(page:Page,kind:'master'|'servant',id:string){
    await page.getByRole('tab',{name:kind==='master'?'御主':'从者',exact:true}).click();
    await page.getByTestId(`fate-setup-${kind}-${id}`).click();
}
