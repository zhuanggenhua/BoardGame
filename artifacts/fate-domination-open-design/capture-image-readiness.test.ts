// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renderedImagesReady } from './capture-image-readiness.mjs';

function addImage({ loaded = false, left = 10, hidden = '' } = {}) {
  const parent = document.createElement('div');
  parent.style.cssText = hidden;
  const image = document.createElement('img');
  parent.append(image); document.body.append(parent);
  vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({ left, top: 10, right: left + 100, bottom: 110, width: 100, height: 100 } as DOMRect);
  Object.defineProperties(image, { complete: { value: loaded }, naturalWidth: { value: loaded ? 100 : 0 } });
  image.decode = vi.fn(async () => {});
  return image;
}
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });
it('仍等待当前画面中未完成或损坏的图片', () => {
  addImage();
  expect(renderedImagesReady()).toBe(false);
});
it('不让屏幕外懒加载图片或透明抽屉阻塞当前整屏', () => {
  addImage({ left: innerWidth + 10 });
  addImage({ hidden: 'opacity: 0' });
  addImage({ hidden: 'display: none' });
  addImage({ loaded: true });
  expect(renderedImagesReady()).toBe(true);
});
it('解码和等待使用同一可见范围，显示后的抽屉会重新参与检查', async () => {
  const visible = addImage({ loaded: true });
  const hidden = addImage({ hidden: 'visibility: hidden' });
  await renderedImagesReady('decode');
  expect(visible.decode).toHaveBeenCalledOnce();
  expect(hidden.decode).not.toHaveBeenCalled();
  hidden.parentElement!.style.visibility = 'visible';
  expect(renderedImagesReady()).toBe(false);
});
it('透明的实际图片仍须加载成功，不能把加载中或损坏的封面排除', () => {
  const pending = addImage();
  pending.style.opacity = '0';
  expect(renderedImagesReady()).toBe(false);
});
it('已加载的图片也必须完成淡入后才能截图', () => {
  const loaded = addImage({ loaded: true });
  loaded.style.opacity = '0.5';
  expect(renderedImagesReady()).toBe(false);
  loaded.style.opacity = '1';
  expect(renderedImagesReady()).toBe(true);
});
