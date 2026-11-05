import {expect,type Page} from '@playwright/test';

/** 同时核卡面和描边的完整上下边界；横向浏览不被误当成纵向裁切。 */
export async function assertFateHandCardsUnclipped(page:Page){
 await expect.poll(()=>page.evaluate(()=>{
  const failures:unknown[]=[];
  for(const card of document.querySelectorAll<HTMLElement>('.fd-runtime-card')){
   const row=card.closest('.fd-runtime-card-row');if(!row)continue;
   const box=card.getBoundingClientRect(),clip=row.getBoundingClientRect();
   if(box.right<=Math.max(0,clip.left)||box.left>=Math.min(innerWidth,clip.right))continue;
   const face=card.querySelector<HTMLElement>(':scope > img,:scope > [data-card-atlas-frame="true"]');
   if(!face){failures.push({card:card.getAttribute('aria-label'),failure:'missing-face'});continue;}
   const art=face.getBoundingClientRect(),style=getComputedStyle(card);
   const rim=style.outlineStyle==='none'?0:parseFloat(style.outlineWidth)+Math.max(0,parseFloat(style.outlineOffset));
   if(art.height<=0||box.top-rim<Math.max(0,clip.top)-1||box.bottom+rim>Math.min(innerHeight,clip.bottom)+1||art.bottom>box.bottom+1||art.top<box.top-1){
    failures.push({card:card.getAttribute('aria-label'),top:box.top,bottom:box.bottom,faceBottom:art.bottom,rowTop:clip.top,rowBottom:clip.bottom,rim,viewport:innerHeight});
   }
   const ratio=face instanceof HTMLImageElement?face.naturalWidth/face.naturalHeight:Number(face.dataset.cardAtlasAspectRatio);
   if(Number.isFinite(ratio)&&ratio>0&&Math.abs(art.width/art.height/ratio-1)>.02)failures.push({card:card.getAttribute('aria-label'),failure:'source-ratio-changed'});
  }
  return failures;
 }),{timeout:5000,message:'当前可见手牌的卡面、原比例及描边必须完整处于浏览行和视口之内'}).toEqual([]);
}
