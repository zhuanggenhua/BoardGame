const params = new URLSearchParams(window.location.search);
const directory = params.get("dir") ?? "";
const directoryKey = params.get("key") ?? "";
const focusPath = params.get("focus") ?? "";
const directoryLabel = document.querySelector("#directory");
const board = document.querySelector("#board");
const viewport = document.querySelector("#viewport");
const summary = document.querySelector("#summary");
const selection = document.querySelector("#selection");
const refreshButton = document.querySelector("#refresh");
const autoRefresh = document.querySelector("#autoRefresh");
const zoomInButton = document.querySelector("#zoomIn");
const zoomOutButton = document.querySelector("#zoomOut");
const fitViewButton = document.querySelector("#fitView");
const resetViewButton = document.querySelector("#resetView");
const indexPanel = document.querySelector("#indexPanel");
const toggleIndexButton = document.querySelector("#toggleIndex");
const indexMeta = document.querySelector("#indexMeta");
const indexList = document.querySelector("#indexList");
const empty = document.querySelector("#empty");

const MIN_SCALE = 0.12;
const MAX_SCALE = 4;
const TILE_WIDTH = 360;
const TILE_GAP = 26;
const LABEL_HEIGHT = 34;
const BOARD_PADDING = 60;
const RENDER_MARGIN = 700;
const MEDIA_LOAD_SCALE = 0.28;
const MAX_MEDIA_TILES = 80;
const MAX_RENDER_TILES = 480;
const DRAG_THRESHOLD = 4;
const FOCUS_SCALE = 0.72;
const INDEX_COLLAPSED_STORAGE_KEY = "boardgame:e2e-image-viewer:index-collapsed";

let items = [];
let positionedItems = [];
let selectedPath = "";
let transform = { x: 64, y: 48, scale: 0.72 };
let boardSize = { width: 1, height: 1 };
let dragState = null;
let visibleRenderFrame = 0;
let renderedTiles = new Map();
let renderStats = { visible: 0, mounted: 0, loaded: 0 };
let listSignature = "";
let hasLoadedDirectory = false;
let suppressTileClickUntil = 0;
let indexCollapsed = false;
let lastAppliedFocusToken = "";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatBytes = (value) => {
  if (!Number.isFinite(value)) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

const formatTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
};

const displayTitle = (item) => item.displayTitle || item.relativePath;

const displayDescription = (item) => item.description || "";

const mediaTitle = (item) => [
  displayTitle(item),
  displayDescription(item),
  `${formatBytes(item.size)} · ${formatTime(item.modifiedAt)}`,
].filter(Boolean).join("\n");

const readIndexCollapsed = () => {
  try {
    return window.localStorage.getItem(INDEX_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const writeIndexCollapsed = (collapsed) => {
  try {
    window.localStorage.setItem(INDEX_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // localStorage 不可用时仍允许本次页面内收起。
  }
};

const applyIndexCollapsed = (collapsed) => {
  indexCollapsed = collapsed;
  indexPanel.classList.toggle("collapsed", collapsed);
  toggleIndexButton.textContent = collapsed ? ">" : "<";
  toggleIndexButton.title = collapsed ? "展开截图索引" : "收起截图索引";
  toggleIndexButton.setAttribute("aria-label", collapsed ? "展开截图索引" : "收起截图索引");
  toggleIndexButton.setAttribute("aria-expanded", String(!collapsed));
};

const signatureForItems = (nextItems) => (
  nextItems.map((item) => `${item.relativePath}:${item.modifiedAt}:${item.size}:${item.displayTitle ?? ""}:${item.description ?? ""}`).join("|")
);

const updateSummary = () => {
  const zoom = Math.round(transform.scale * 100);
  summary.textContent = `${items.length} 个媒体文件 · 当前挂载 ${renderStats.mounted}/${renderStats.visible} 张 · 加载图片 ${renderStats.loaded} 张 · 缩放 ${zoom}%`;
};

const applyTransform = () => {
  board.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
  scheduleVisibleRender();
};

const estimateMediaHeight = (item) => {
  if (item.kind === "video") return 236;
  if (item.relativePath.toLowerCase().endsWith(".gif")) return 236;
  return 236;
};

const chooseColumnCount = () => {
  if (items.length <= 1) return 1;
  const viewportRatio = clamp(viewport.clientWidth / Math.max(1, viewport.clientHeight), 1, 2.2);
  return clamp(Math.ceil(Math.sqrt(items.length * viewportRatio)), 1, 20);
};

const layoutItems = () => {
  const columns = chooseColumnCount();
  const positioned = [];
  const columnHeights = Array.from({ length: columns }, () => BOARD_PADDING);

  for (const item of items) {
    let column = 0;
    for (let index = 1; index < columnHeights.length; index += 1) {
      if (columnHeights[index] < columnHeights[column]) {
        column = index;
      }
    }

    const height = estimateMediaHeight(item) + LABEL_HEIGHT;
    const x = BOARD_PADDING + column * (TILE_WIDTH + TILE_GAP);
    const y = columnHeights[column];
    columnHeights[column] += height + TILE_GAP;
    positioned.push({ item, x, y, width: TILE_WIDTH, height });
  }

  boardSize = {
    width: BOARD_PADDING * 2 + columns * TILE_WIDTH + Math.max(0, columns - 1) * TILE_GAP,
    height: Math.max(...columnHeights, 1) + BOARD_PADDING,
  };
  return positioned;
};

const getVisibleBoardRect = () => ({
  left: (-transform.x) / transform.scale - RENDER_MARGIN,
  top: (-transform.y) / transform.scale - RENDER_MARGIN,
  right: (viewport.clientWidth - transform.x) / transform.scale + RENDER_MARGIN,
  bottom: (viewport.clientHeight - transform.y) / transform.scale + RENDER_MARGIN,
});

const intersectsVisibleRect = (entry, rect) => (
  entry.x <= rect.right
  && entry.x + entry.width >= rect.left
  && entry.y <= rect.bottom
  && entry.y + entry.height >= rect.top
);

const distanceToRectCenter = (entry, rect) => {
  const centerX = (rect.left + rect.right) / 2;
  const centerY = (rect.top + rect.bottom) / 2;
  const tileCenterX = entry.x + entry.width / 2;
  const tileCenterY = entry.y + entry.height / 2;
  return Math.hypot(tileCenterX - centerX, tileCenterY - centerY);
};

const chooseRenderEntries = (visibleEntries, rect) => {
  if (visibleEntries.length <= MAX_RENDER_TILES) return visibleEntries;
  return [...visibleEntries]
    .sort((left, right) => distanceToRectCenter(left, rect) - distanceToRectCenter(right, rect))
    .slice(0, MAX_RENDER_TILES);
};

const createTile = (entry, shouldLoadMedia) => {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "tile";
  tile.dataset.loadMode = shouldLoadMedia ? "media" : "placeholder";
  if (!shouldLoadMedia) {
    tile.classList.add("placeholder");
  }
  tile.dataset.path = entry.item.relativePath;
  tile.title = mediaTitle(entry.item);
  updateTilePosition(tile, entry);

  if (shouldLoadMedia) {
    const media = entry.item.kind === "video" ? document.createElement("video") : document.createElement("img");
    media.src = entry.item.url;
    if (entry.item.kind === "video") {
      media.controls = true;
      media.muted = true;
      media.preload = "metadata";
    } else {
      media.alt = displayTitle(entry.item);
      media.loading = "lazy";
      media.decoding = "async";
      media.draggable = false;
    }
    tile.append(media);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "tile-placeholder";
    placeholder.textContent = "放大后加载";
    tile.append(placeholder);
  }

  const label = document.createElement("span");
  label.className = "tile-label";
  label.textContent = displayTitle(entry.item);

  tile.append(label);
  tile.addEventListener("click", (event) => {
    if (performance.now() < suppressTileClickUntil) {
      event.preventDefault();
      return;
    }
    selectItem(entry.item);
  });
  tile.addEventListener("dblclick", (event) => {
    if (performance.now() < suppressTileClickUntil) {
      event.preventDefault();
      return;
    }
    copyPath(entry.item);
  });
  return tile;
};

const updateIndexSelection = () => {
  for (const entry of indexList.querySelectorAll(".index-item")) {
    entry.classList.toggle("selected", entry.dataset.path === selectedPath);
  }
};

const updateTilePosition = (tile, entry) => {
  tile.style.left = `${entry.x}px`;
  tile.style.top = `${entry.y}px`;
  tile.style.width = `${entry.width}px`;
  tile.style.height = `${entry.height}px`;
};

const selectItem = (item, announce = true) => {
  selectedPath = item?.relativePath ?? "";
  for (const tile of board.querySelectorAll(".tile")) {
    tile.classList.toggle("selected", tile.dataset.path === selectedPath);
  }
  updateIndexSelection();
  if (!item) {
    selection.textContent = "拖拽画布或图片平移，滚轮缩放。";
    return;
  }
  if (announce) {
    const description = displayDescription(item);
    selection.textContent = `${displayTitle(item)}${description ? ` · ${description}` : ""}`;
  }
};

const copyPath = async (item) => {
  if (!item) return;
  await navigator.clipboard.writeText(item.absolutePath);
  selection.textContent = `已复制本地路径：${displayTitle(item)}`;
};

const centerItem = (item) => {
  const entry = positionedItems.find((candidate) => candidate.item.relativePath === item.relativePath);
  if (!entry) return;
  const scale = clamp(Math.max(transform.scale, FOCUS_SCALE), MIN_SCALE, MAX_SCALE);
  transform = {
    x: viewport.clientWidth / 2 - (entry.x + entry.width / 2) * scale,
    y: viewport.clientHeight / 2 - (entry.y + entry.height / 2) * scale,
    scale,
  };
  applyTransform();
};

const focusItem = (item) => {
  selectItem(item);
  centerItem(item);
};

const renderIndex = (indexMatchedCount = 0) => {
  indexList.textContent = "";
  indexMeta.textContent = indexMatchedCount > 0
    ? `${items.length} 张 · ${indexMatchedCount} 条中文说明`
    : `${items.length} 张 · 未找到中文索引`;

  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "index-item";
    button.dataset.path = item.relativePath;
    button.title = mediaTitle(item);

    const title = document.createElement("span");
    title.className = "index-item-title";
    title.textContent = displayTitle(item);
    button.append(title);

    const description = displayDescription(item);
    if (description) {
      const detail = document.createElement("span");
      detail.className = "index-item-description";
      detail.textContent = description;
      button.append(detail);
    }

    button.addEventListener("click", () => focusItem(item));
    indexList.append(button);
  }

  updateIndexSelection();
};

const renderBoard = () => {
  board.textContent = "";
  renderedTiles = new Map();
  positionedItems = layoutItems();
  board.style.width = `${boardSize.width}px`;
  board.style.height = `${boardSize.height}px`;
  renderVisibleTiles();
  empty.classList.toggle("hidden", items.length > 0);
  selectItem(items.find((item) => item.relativePath === selectedPath) ?? items[0], false);
};

const renderVisibleTiles = () => {
  const visibleRect = getVisibleBoardRect();
  const visibleEntries = positionedItems.filter((entry) => intersectsVisibleRect(entry, visibleRect));
  const renderEntries = chooseRenderEntries(visibleEntries, visibleRect);
  const canLoadMedia = transform.scale >= MEDIA_LOAD_SCALE || renderEntries.length <= MAX_MEDIA_TILES;
  const nextKeys = new Set();
  let mediaTiles = 0;

  for (const entry of renderEntries) {
    const shouldLoadMedia = canLoadMedia && mediaTiles < MAX_MEDIA_TILES;
    const loadMode = shouldLoadMedia ? "media" : "placeholder";
    const key = entry.item.relativePath;
    const existing = renderedTiles.get(key);
    if (shouldLoadMedia) {
      mediaTiles += 1;
    }

    nextKeys.add(key);
    if (existing?.element?.dataset.loadMode === loadMode) {
      updateTilePosition(existing.element, entry);
      existing.element.title = mediaTitle(entry.item);
      existing.element.classList.toggle("selected", key === selectedPath);
      continue;
    }

    if (existing?.element) {
      existing.element.remove();
    }
    const tile = createTile(entry, shouldLoadMedia);
    tile.classList.toggle("selected", key === selectedPath);
    board.append(tile);
    renderedTiles.set(key, { element: tile });
  }

  for (const [key, rendered] of renderedTiles) {
    if (nextKeys.has(key)) continue;
    rendered.element.remove();
    renderedTiles.delete(key);
  }

  selectItem(items.find((item) => item.relativePath === selectedPath), false);
  renderStats = { visible: visibleEntries.length, mounted: renderEntries.length, loaded: mediaTiles };
  updateSummary();
};

const scheduleVisibleRender = () => {
  if (visibleRenderFrame) return;
  visibleRenderFrame = window.requestAnimationFrame(() => {
    visibleRenderFrame = 0;
    renderVisibleTiles();
  });
};

const zoomAt = (clientX, clientY, nextScale) => {
  const rect = viewport.getBoundingClientRect();
  const oldScale = transform.scale;
  const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const boardX = (px - transform.x) / oldScale;
  const boardY = (py - transform.y) / oldScale;
  transform = {
    x: px - boardX * scale,
    y: py - boardY * scale,
    scale,
  };
  applyTransform();
};

const fitView = () => {
  if (items.length === 0) return;
  const availableWidth = Math.max(1, viewport.clientWidth - 80);
  const availableHeight = Math.max(1, viewport.clientHeight - 80);
  const scale = clamp(Math.min(availableWidth / boardSize.width, availableHeight / boardSize.height, 1), MIN_SCALE, MAX_SCALE);
  transform = {
    x: (viewport.clientWidth - boardSize.width * scale) / 2,
    y: (viewport.clientHeight - boardSize.height * scale) / 2,
    scale,
  };
  applyTransform();
};

const resetView = ({ rerender = true } = {}) => {
  transform = { x: 64, y: 48, scale: 0.72 };
  if (rerender) {
    renderBoard();
  }
  applyTransform();
};

const focusRequestFromPayload = (payload, nextItems) => {
  const stateFocusPath = payload.focus?.relativePath ?? "";
  const stateFocusToken = payload.focus?.updatedAt ? `state:${payload.focus.updatedAt}:${stateFocusPath}` : "";
  const stateFocusItem = stateFocusPath ? nextItems.find((item) => item.relativePath === stateFocusPath) : null;
  if (stateFocusItem && stateFocusToken) return { item: stateFocusItem, token: stateFocusToken };
  const urlFocusItem = focusPath ? nextItems.find((item) => item.relativePath === focusPath) : null;
  return urlFocusItem ? { item: urlFocusItem, token: `url:${focusPath}` } : null;
};

const applyFocusRequest = (request) => {
  if (!request || request.token === lastAppliedFocusToken) return false;
  focusItem(request.item);
  lastAppliedFocusToken = request.token;
  return true;
};

const loadDirectory = async ({ preserveView = true } = {}) => {
  const hasDirectoryTarget = Boolean(directory || directoryKey);
  directoryLabel.textContent = hasDirectoryTarget ? "正在读取截图目录..." : "未提供目录";
  if (!hasDirectoryTarget) {
    summary.textContent = "缺少 dir 或 key 参数。";
    empty.textContent = "缺少 dir 或 key 参数。";
    return;
  }

  const previousSignature = listSignature;
  const query = directoryKey
    ? `key=${encodeURIComponent(directoryKey)}`
    : `dir=${encodeURIComponent(directory)}`;
  const response = await fetch(`/api/list?${query}`, { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `读取失败: ${response.status}`);
  }

  const payload = await response.json();
  const nextItems = payload.items;
  const focusRequest = focusRequestFromPayload(payload, nextItems);
  if (focusRequest && !selectedPath) {
    selectedPath = focusRequest.item.relativePath;
  }
  const nextSignature = `${payload.directory}|${signatureForItems(nextItems)}`;
  summary.dataset.directory = payload.directory;
  directoryLabel.textContent = payload.directoryTitle
    ? `${payload.directoryTitle}${payload.autoSelectedDirectory ? "（自动定位最新截图）" : ""}`
    : "端到端截图目录";

  if (hasLoadedDirectory && previousSignature === nextSignature) {
    applyFocusRequest(focusRequest);
    updateSummary();
    return;
  }

  items = nextItems;
  listSignature = nextSignature;
  hasLoadedDirectory = true;
  renderBoard();
  renderIndex(payload.indexMatchedCount ?? 0);
  if (!preserveView || previousSignature.length === 0) {
    resetView({ rerender: false });
  } else {
    applyTransform();
  }
  applyFocusRequest(focusRequest);
};

refreshButton.addEventListener("click", () => {
  loadDirectory().catch((error) => {
    summary.textContent = error instanceof Error ? error.message : String(error);
  });
});

zoomInButton.addEventListener("click", () => {
  zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, transform.scale * 1.18);
});

zoomOutButton.addEventListener("click", () => {
  zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, transform.scale / 1.18);
});

fitViewButton.addEventListener("click", fitView);
resetViewButton.addEventListener("click", resetView);

applyIndexCollapsed(readIndexCollapsed());

toggleIndexButton.addEventListener("click", () => {
  applyIndexCollapsed(!indexCollapsed);
  writeIndexCollapsed(indexCollapsed);
  window.requestAnimationFrame(() => {
    renderBoard();
    applyTransform();
  });
});

viewport.addEventListener("wheel", (event) => {
  event.preventDefault();
  const direction = event.deltaY > 0 ? 0.9 : 1.1;
  zoomAt(event.clientX, event.clientY, transform.scale * direction);
}, { passive: false });

viewport.addEventListener("click", (event) => {
  if (performance.now() >= suppressTileClickUntil) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

viewport.addEventListener("dblclick", (event) => {
  if (performance.now() >= suppressTileClickUntil) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

viewport.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 && event.button !== 1) return;
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: transform.x,
    originY: transform.y,
    dragging: false,
  };
  viewport.setPointerCapture(event.pointerId);
});

viewport.addEventListener("pointermove", (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const offsetX = event.clientX - dragState.startX;
  const offsetY = event.clientY - dragState.startY;
  if (!dragState.dragging && Math.hypot(offsetX, offsetY) < DRAG_THRESHOLD) return;
  dragState.dragging = true;
  event.preventDefault();
  viewport.classList.add("dragging");
  transform.x = dragState.originX + offsetX;
  transform.y = dragState.originY + offsetY;
  applyTransform();
});

const stopDrag = (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  if (dragState.dragging) {
    suppressTileClickUntil = performance.now() + 220;
  }
  if (viewport.hasPointerCapture(event.pointerId)) {
    viewport.releasePointerCapture(event.pointerId);
  }
  dragState = null;
  viewport.classList.remove("dragging");
};

viewport.addEventListener("pointerup", stopDrag);
viewport.addEventListener("pointercancel", stopDrag);

window.addEventListener("keydown", (event) => {
  if (event.key === "0") resetView();
  if (event.key === "f" || event.key === "F") fitView();
  if (event.key === "+" || event.key === "=") zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, transform.scale * 1.18);
  if (event.key === "-") zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, transform.scale / 1.18);
});

window.addEventListener("resize", () => {
  renderBoard();
  applyTransform();
});

window.setInterval(() => {
  if (!autoRefresh.checked) return;
  loadDirectory().catch((error) => {
    summary.textContent = error instanceof Error ? error.message : String(error);
  });
}, 2500);

loadDirectory({ preserveView: false }).catch((error) => {
  summary.textContent = error instanceof Error ? error.message : String(error);
  empty.textContent = error instanceof Error ? error.message : String(error);
});
