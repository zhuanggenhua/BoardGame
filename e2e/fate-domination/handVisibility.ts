import {expect,type Page} from '@playwright/test';

/** 只等待真实卡图就绪；卡面比例、贴底、遮挡与描边由逐图视觉账本裁决。 */
export async function expectFateHandArtLoaded(page:Page){
 await expect.poll(()=>page.evaluate(()=>Array.from(document.querySelectorAll<HTMLElement>('.fd-runtime-card')).every(card=>{
  const face=card.querySelector(':scope > img,:scope > [data-card-atlas-frame="true"]');
  if(face instanceof HTMLImageElement)return face.complete&&face.naturalWidth>0;
  if(!(face instanceof HTMLElement)||face.classList.contains('atlas-shimmer'))return false;
  const image=face.querySelector('img');
  return Boolean(image?.complete&&image.naturalWidth>0);
 })),{timeout:5000,message:'当前手牌必须完成真实卡图加载'}).toBe(true);
}
