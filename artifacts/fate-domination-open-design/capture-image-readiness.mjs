/** Runs in the page. Only pixels in this viewport participate in a full-frame capture. */
export function renderedImagesReady(mode = 'ready') {
  const images = [...document.images].filter(image => {
    const rect = image.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.bottom <= 0
      || rect.left >= innerWidth || rect.top >= innerHeight) return false;
    for (let node = image; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
        || (node !== image && Number(style.opacity || 1) === 0)) return false;
    }
    return true;
  });
  if (mode === 'decode') return Promise.all(images.map(image => image.decode()));
  return images.every(image => image.complete && image.naturalWidth > 0
    && Number(getComputedStyle(image).opacity || 1) >= 1);
}
