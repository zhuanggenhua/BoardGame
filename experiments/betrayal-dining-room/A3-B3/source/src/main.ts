import './style.css';
import {createStudy} from './scene';
import {bindPageLifecycle} from './page-lifecycle.mjs';

document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<main>
  <div id="scene"></div>
  <header><p class="eyebrow">小黑屋 · 美术方向研究 03</p><h1>暮色餐厅</h1><p class="subtitle">一间旧宅，两种叙事方式</p></header>
  <span class="gate">独立原型 · 未视觉验收</span>
  <section class="art-panel" aria-label="美术方向">
    <p class="panel-label">CHOOSE A STUDY</p>
    <button class="art-choice selected" data-art="detailed" aria-pressed="true"><b>B3</b><span>旧宅微缩<small>曲木 · 帷幔 · 油画 · 旧痕</small></span></button>
    <button class="art-choice" data-art="abstract" aria-pressed="false"><b>A3</b><span>纸上剧场<small>刀模剪影 · 叠纸 · 印刷线</small></span></button>
    <p class="compare-note">切换方向保留视角，方便对照。</p>
  </section>
  <details class="study-notes"><summary>关于这次研究</summary><p>这是美术候选，不含正式规则。细节版补入弧形餐边柜、窗框帷幔和墙面肖像；抽象版独立采用纸片剪影与印刷线条。保留六席、椭圆桌和斜向地毯构图。</p><p>尚未运行图形窗口或完成截图验收，不代表最终画面已通过。</p></details>
  <div class="loading" role="status">正在构建房间…</div>
  <nav aria-label="样板检视">
    <div class="group" role="group" aria-label="视角"><button data-view="overview" aria-pressed="true" class="selected">整体</button><button data-view="detail" aria-pressed="false">桌面</button><button data-view="top" aria-pressed="false">俯视</button></div>
    <div class="group" role="group" aria-label="灯光"><button data-light="neutral" aria-pressed="true" class="selected">中性光</button><button data-light="warm" aria-pressed="false">暖光</button></div>
    <label class="wall-control">墙体<select id="walls" aria-label="墙体显示"><option value="cutaway">切面</option><option value="full">完整</option><option value="floor">仅地面</option></select></label>
    <button id="reset">重置</button>
  </nav>
  <footer><span>拖动旋转 · 滚轮缩放 · 右键平移</span><span>原创几何与纹理 · 旧版均保留</span></footer>
</main>`;
const buttons=[...document.querySelectorAll<HTMLButtonElement>('button')];
const loading=document.querySelector<HTMLElement>('.loading')!;
const walls=document.querySelector<HTMLSelectElement>('#walls')!;
buttons.forEach(button=>button.disabled=true);walls.disabled=true;
function select(attribute:'view'|'light'|'art',value:string) {
  document.querySelectorAll<HTMLButtonElement>(`[data-${attribute}]`).forEach(button=>{
    const active=button.dataset[attribute]===value;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));
  });
}
requestAnimationFrame(()=>setTimeout(()=>{
  try {
    const study=createStudy(document.querySelector<HTMLElement>('#scene')!);
    loading.remove();buttons.forEach(button=>button.disabled=false);walls.disabled=false;
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.addEventListener('click',()=>{study.view(button.dataset.view as 'overview'|'detail'|'top');select('view',button.dataset.view!);}));
    document.querySelectorAll<HTMLButtonElement>('[data-light]').forEach(button=>button.addEventListener('click',()=>{study.light(button.dataset.light as 'neutral'|'warm');select('light',button.dataset.light!);}));
    document.querySelectorAll<HTMLButtonElement>('[data-art]').forEach(button=>button.addEventListener('click',()=>{study.art(button.dataset.art as 'detailed'|'abstract');select('art',button.dataset.art!);}));
    walls.addEventListener('change',()=>study.walls(walls.value as 'cutaway'|'full'|'floor'));
    document.querySelector('#reset')!.addEventListener('click',()=>{study.reset();select('view','overview');select('light','neutral');walls.value='cutaway';});
    bindPageLifecycle(window,study);
    document.querySelector('main')!.dataset.ready='true';
  } catch(error) {
    loading.classList.add('error');loading.textContent=`无法运行样板：${error instanceof Error?error.message:String(error)}。请用支持 WebGL 2 的浏览器打开。`;
  }
},0));
