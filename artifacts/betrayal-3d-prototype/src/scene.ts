import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { layout, type Blocker } from './spatial';

export const rooms = [
  { name: '舞厅', tile: 4, x: 0, z: 0, type: '事件', detail: '尘封的吊灯下，舞步声忽远忽近。' },
  { name: '画廊', tile: 3, x: 0, z: 1, type: '事件', detail: '画像的目光追随着每一个来客。' },
  { name: '餐厅', tile: 11, x: -1, z: 0, type: '物品', detail: '长桌已经摆好。主人却迟迟没有现身。' },
  { name: '厨房', tile: 5, x: -1, z: 1, type: '事件', detail: '炉膛里的余烬，似乎刚刚熄灭。' },
  { name: '礼拜堂', tile: 9, x: 1, z: 0, type: '预兆', detail: '烛光微颤，祷告没有得到回答。' },
  { name: '书房', tile: 25, x: 0, z: -1, type: '物品', detail: '一本翻开的书，停在没有署名的一页。' },
  { name: '温室', tile: 7, x: -1, z: -1, type: '事件', detail: '潮湿的空气里，枝叶贴着玻璃生长。' },
  { name: '主卧室', tile: 31, x: 1, z: -1, type: '预兆', detail: '床单平整得像从未有人来过。' },
  { name: '储藏室', tile: 10, x: -1, z: 2, type: '物品', detail: '木架深处传来细微的抓挠声。' },
  { name: '雕像走廊', tile: 2, x: 0, z: -2, type: '事件', detail: '你不确定那座雕像刚才是否面朝这里。' },
  { name: '天文台', tile: 0, x: 1, z: -2, type: '预兆', detail: '望远镜正对着一片没有星星的天空。' },
  { name: '墓地', tile: 8, x: 1, z: 1, type: '事件', detail: '新翻动的泥土旁，多出了一块墓碑。' },
];

const tileSize = 4.6;
const roomSlots = [
  { x: -1.55, z: 1.45 },
  { x: -1.55, z: -1.45 },
  { x: 1.75, z: 1.45 },
  { x: 1.75, z: -1.45 },
  { x: 0, z: 1.65 },
  { x: 0, z: -1.65 },
];

function slotPoint(roomIndex: number, slotIndex: number) {
  const room = rooms[roomIndex];
  const slot = roomSlots[slotIndex % roomSlots.length];
  return { x: room.x * tileSize + slot.x, z: room.z * tileSize + slot.z };
}
type CharacterEntry = {
  name: string;
  mesh: string;
  texture: string;
  normal?: string;
  metalness?: string;
  occlusion?: string;
  emissive?: string;
  rotationY: number;
  scale: number;
};
export type SceneApi = {
  select: (index: number) => void;
  move: () => Promise<boolean>;
  reset: () => void;
  top: (enabled: boolean) => void;
  walls: (enabled: boolean) => void;
  exposure: (value: number) => void;
  atmosphere: (enabled: boolean) => void;
  zoom: (factor: number) => void;
  dispose: () => void;
};

export async function createScene(host: HTMLDivElement, onSelect: (index: number) => void): Promise<SceneApi> {
  const scene = new THREE.Scene();
  const space = layout(rooms);
  scene.background = new THREE.Color('#14191a');
  scene.fog = new THREE.FogExp2('#14191a', 0.011);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '山屋三维地图');
  const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 160);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.085;
  controls.minDistance = 6;
  controls.maxDistance = 55;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  const reset = () => { camera.position.set(16, 23, 27); controls.target.set(0, 0, 0.2); controls.update(); };
  reset();

  scene.add(new THREE.HemisphereLight('#b4d8db', '#514337', 2.2));
  const moon = new THREE.DirectionalLight('#c7e6ec', 3.1);
  moon.position.set(-9, 22, -12);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.025;
  scene.add(moon);

  const stone = new THREE.MeshStandardMaterial({ color: '#777a71', roughness: 0.93 });
  const wood = new THREE.MeshStandardMaterial({ color: '#514439', roughness: 0.86 });
  const brass = new THREE.MeshStandardMaterial({ color: '#bba069', metalness: 0.65, roughness: 0.4 });
  const cloth = new THREE.MeshStandardMaterial({ color: '#5c2e35', roughness: 0.94 });
  const wax = new THREE.MeshStandardMaterial({ color: '#d6c6a4', roughness: 0.78 });
  const flameMaterial = new THREE.MeshBasicMaterial({ color: '#ffe2aa' });
  const bookMaterials = ['#6d2f35', '#2f4e62', '#5d4a2b', '#3f5c3a'].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.86 }));
  const walls = new THREE.Group();
  scene.add(walls);
  const routeLayer = new THREE.Group();
  routeLayer.name = 'legal-route-preview';
  scene.add(routeLayer);
  const routeLineMaterial = new THREE.MeshStandardMaterial({
    color: '#f0bb6f',
    emissive: '#6c3b13',
    emissiveIntensity: 0.55,
    roughness: 0.55,
    transparent: true,
    opacity: 0.9,
  });
  const routeDotMaterial = new THREE.MeshBasicMaterial({ color: '#ffe0a3', transparent: true, opacity: 0.96 });
  const routeEndMaterial = new THREE.MeshBasicMaterial({ color: '#9df0d0', transparent: true, opacity: 0.98 });
  function box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, parent: THREE.Object3D = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const clearRoutePreview = () => {
    for (const child of routeLayer.children) if (child instanceof THREE.Mesh) child.geometry.dispose();
    routeLayer.clear();
    routeLayer.userData.pointCount = 0;
  };
  const simplifyRoute = (points: { x: number; z: number }[]) => {
    if (points.length <= 2) return points;
    const simplified = [points[0]];
    let lastDirection = '';
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1];
      const point = points[i];
      const dx = Math.sign(Math.round((point.x - previous.x) * 1000));
      const dz = Math.sign(Math.round((point.z - previous.z) * 1000));
      const direction = `${dx}:${dz}`;
      if (i === 1) {
        lastDirection = direction;
        continue;
      }
      if (direction !== lastDirection) simplified.push(previous);
      lastDirection = direction;
    }
    simplified.push(points[points.length - 1]);
    return simplified;
  };
  const renderRoutePreview = (points: { x: number; z: number }[], live = false) => {
    clearRoutePreview();
    routeLayer.userData.pointCount = points.length;
    if (points.length < 2) return;
    const corners = simplifyRoute(points);
    for (let i = 1; i < corners.length; i++) {
      const start = corners[i - 1];
      const end = corners[i];
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.05) continue;
      const segment = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, length, 8), routeLineMaterial);
      segment.position.set((start.x + end.x) / 2, 0.22, (start.z + end.z) / 2);
      segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, 0, dz).normalize());
      segment.castShadow = false;
      segment.receiveShadow = false;
      routeLayer.add(segment);
    }
    const stride = live ? 5 : 7;
    for (let i = 0; i < points.length; i += stride) {
      const point = points[i];
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.085, 18), routeDotMaterial);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(point.x, 0.255, point.z);
      routeLayer.add(dot);
    }
    const end = points[points.length - 1];
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 32), routeEndMaterial);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(end.x, 0.265, end.z);
    routeLayer.add(marker);
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: '#242b2a', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.3;
  ground.receiveShadow = true;
  scene.add(ground);

  const loader = new THREE.TextureLoader();
  const tiles: THREE.Mesh[] = [];
  const tileMaps = await Promise.all(rooms.map(room => loader.loadAsync(`/betrayal-3d/room-${room.tile}.webp`)));
  rooms.forEach((room, index) => {
    const x = room.x * tileSize, z = room.z * tileSize;
    const texture = tileMaps[index];
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.center.set(0.5, 0.5);
    texture.rotation = (room.turns ?? 0) * Math.PI / 2;
    box(4.5, 0.25, 4.5, x, -0.07, z, wood);
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(4.46, 4.46), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 }));
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(x, 0.065, z);
    tile.receiveShadow = true;
    tile.userData.roomIndex = index;
    tiles.push(tile);
    scene.add(tile);
    {
      for (const edge of space.edges.filter(edge => edge.room === index)) {
        const { side, open } = edge;
        const wall = new THREE.Group();
        wall.position.set(x, 0, z);
        wall.rotation.y = side * Math.PI / 2;
        walls.add(wall);
        const height = 0.65;
        if (!open) {
          box(4.6, height, 0.16, 0, height / 2 + 0.06, -2.3, stone, wall);
          box(4.6, 0.07, 0.19, 0, height + 0.1, -2.3, wood, wall);
          continue;
        }
        for (const sign of [-1, 1]) {
          box(1.66, height, 0.16, sign * 1.47, height / 2 + 0.06, -2.3, stone, wall);
          box(1.66, 0.07, 0.19, sign * 1.47, height + 0.1, -2.3, wood, wall);
          box(0.12, 1.25, 0.2, sign * 0.64, 0.69, -2.3, wood, wall);
        }
        box(1.4, 0.1, 0.2, 0, 1.34, -2.3, wood, wall);
        if (edge.connected) box(1.12, 0.04, 0.52, 0, 0.12, -2.3, brass, wall);
        if (!edge.connected) box(1.16, 1.22, 0.1, 0, 0.7, -2.3, wood, wall);
      }
    }
    const lamp = new THREE.PointLight(index === 11 ? '#8ce3c4' : '#ffc47d', 12, 7, 2);
    lamp.position.set(x - 1.7, 1.5, z - 1.7);
    scene.add(lamp);
    box(0.12, 0.42, 0.12, x - 1.7, 0.6, z - 1.7, brass);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), flameMaterial);
    flame.position.set(x - 1.7, 0.85, z - 1.7);
    scene.add(flame);
  });

  // Furniture is rendered from the same obstacle list that blocks movement.
  for (const furniture of space.furniture) {
    const { x, z, w, d, kind } = furniture;
    if (kind === 'chair') {
      box(w, 0.34, d, x, 0.25, z, wood);
      box(w * 0.92, 0.28, 0.05, x, 0.55, z - d * 0.43, wood);
    } else if (kind === 'shelf') {
      for (let i = 0; i < 3; i++) box(w, 0.08, d, x, 0.25 + i * 0.4, z, wood);
      for (const dx of [-w / 2, w / 2]) box(0.08, 1.1, d, x + dx, 0.58, z, wood);
      for (let row = 0; row < 2; row++) for (let i = 0; i < 7; i++) {
        const material = bookMaterials[(row + i) % bookMaterials.length];
        box(0.08, 0.22, d * 0.62, x - w * 0.38 + i * 0.16, 0.42 + row * 0.38, z, material);
      }
    } else {
      const h = kind === 'desk' ? 0.62 : 0.49;
      box(w, 0.09, d, x, h, z, wood);
      if (kind === 'table') box(w * 0.9, 0.025, d * 0.86, x, h + 0.06, z, cloth);
      for (const dx of [-w * 0.38, w * 0.38]) for (const dz of [-d * 0.38, d * 0.38]) box(0.08, h - 0.08, 0.08, x + dx, (h - 0.08) / 2, z + dz, wood);
      if (kind === 'desk') {
        box(0.09, 0.32, 0.09, x + w * 0.25, h + 0.2, z - d * 0.24, brass);
        box(0.22, 0.08, 0.22, x + w * 0.25, h + 0.4, z - d * 0.24, wax);
      }
    }
  }
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 3), new THREE.MeshStandardMaterial({ color: '#652b31', roughness: 1 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(4.6, 0.08, 0);
  scene.add(carpet);

  const selection = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-2.25, 0.16, -2.25), new THREE.Vector3(2.25, 0.16, -2.25),
    new THREE.Vector3(2.25, 0.16, 2.25), new THREE.Vector3(-2.25, 0.16, 2.25),
  ]), new THREE.LineBasicMaterial({ color: '#eed8a4' }));
  scene.add(selection);
  let selected = 0;
  let explorerRoom = 0;
  const select = (index: number) => { selected = index; selection.position.set(rooms[index].x * tileSize, 0, rooms[index].z * tileSize); onSelect(index); previewRoute?.(); };

  const objLoader = new OBJLoader();
  const normalizeObject = (object: THREE.Object3D, targetHeight: number) => {
    object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = targetHeight / Math.max(size.y, 0.001);
    object.scale.setScalar(scale);
    object.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  };
  const place = (object: THREE.Object3D, roomIndex: number, slotIndex: number, y = 0.12) => {
    const point = slotPoint(roomIndex, slotIndex);
    object.position.set(point.x, y, point.z);
  };
  const loadTexture = async (name: string, srgb = false) => {
    const texture = await loader.loadAsync(`/betrayal-3d/${name}`);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  const loadCharacterMaterial = async (entry: CharacterEntry) => {
    const [map, normalMap, metalnessMap, aoMap, emissiveMap] = await Promise.all([
      loadTexture(entry.texture, true),
      entry.normal ? loadTexture(entry.normal) : undefined,
      entry.metalness ? loadTexture(entry.metalness) : undefined,
      entry.occlusion ? loadTexture(entry.occlusion) : undefined,
      entry.emissive ? loadTexture(entry.emissive, true) : undefined,
    ]);
    return new THREE.MeshStandardMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(0.46, 0.46),
      metalnessMap,
      aoMap,
      emissiveMap,
      emissive: emissiveMap ? new THREE.Color('#403028') : new THREE.Color('#000000'),
      emissiveIntensity: emissiveMap ? 0.18 : 0,
      roughness: 0.72,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
  };
  const rosterResponse = await fetch('/betrayal-3d/characters.json');
  if (!rosterResponse.ok) throw new Error('角色资源清单加载失败');
  const roster = await rosterResponse.json() as CharacterEntry[];
  const miniSpecs = [
    { rosterIndex: 0, roomIndex: 0, slotIndex: 0, color: '#8c4242' },
    { rosterIndex: 1, roomIndex: 2, slotIndex: 1, color: '#487d8c' },
    { rosterIndex: 4, roomIndex: 4, slotIndex: 2, color: '#b79b59' },
  ];
  const minis = await Promise.all(miniSpecs.map(async spec => {
    const entry = roster[spec.rosterIndex];
    const [object, material] = await Promise.all([objLoader.loadAsync(`/betrayal-3d/${entry.mesh}`), loadCharacterMaterial(entry)]);
    object.traverse(child => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry.attributes.uv && !child.geometry.attributes.uv2) child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
        child.material = material;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    // Apply the authored upright pose before measuring height and centering the base.
    object.rotation.set(0, 0, 0);
    object.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.rotation.set(-Math.PI / 2, 0, 0);
      }
    });
    normalizeObject(object, 0.78);
    const mini = new THREE.Group();
    mini.userData.kind = 'explorer';
    mini.userData.radius = 0.34;
    mini.add(object);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.035, 40), new THREE.MeshStandardMaterial({ color: spec.color, metalness: 0.35, roughness: 0.5 }));
    base.position.y = 0.05;
    mini.add(base);
    place(mini, spec.roomIndex, spec.slotIndex);
    scene.add(mini);
    return mini;
  }));
  const monsterObject = await objLoader.loadAsync('/betrayal-3d/monster-skeleton.obj');
  const monsterMaterial = new THREE.MeshStandardMaterial({ color: '#b8aa8f', roughness: 0.78, metalness: 0.05 });
  monsterObject.traverse(child => { if (child instanceof THREE.Mesh) { child.material = monsterMaterial; child.castShadow = true; child.receiveShadow = true; } });
  normalizeObject(monsterObject, 0.96);
  const monster = new THREE.Group();
  monster.userData.kind = 'monster';
  monster.userData.radius = 0.42;
  monster.add(monsterObject);
  const monsterBase = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.35, 0.045, 44), new THREE.MeshStandardMaterial({ color: '#36302c', metalness: 0.25, roughness: 0.55 }));
  monsterBase.position.y = 0.05;
  monster.add(monsterBase);
  const monsterAura = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.68, 48), new THREE.MeshBasicMaterial({ color: '#a83232', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  monsterAura.rotation.x = -Math.PI / 2;
  monsterAura.position.y = 0.085;
  monster.add(monsterAura);
  place(monster, 11, 1);
  scene.add(monster);
  let route: { x: number; z: number }[] = [];
  let lastRoute: { x: number; z: number }[] = [];
  let finishMove: ((value: boolean) => void) | undefined;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down = { x: 0, y: 0 };
  const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
  const pointerUp = (event: PointerEvent) => {
    if (event.button !== 0 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(tiles)[0];
    if (hit) select(hit.object.userData.roomIndex);
  };
  const pieceBlockers = (): Blocker[] => [
    ...minis.slice(1).map(mini => ({ x: mini.position.x, z: mini.position.z, radius: mini.userData.radius as number })),
    { x: monster.position.x, z: monster.position.z, radius: monster.userData.radius as number },
  ];
  const chooseDestination = (roomIndex: number) => {
    const blockers = pieceBlockers();
    for (let i = 0; i < roomSlots.length; i++) {
      const target = slotPoint(roomIndex, i);
      if (!space.canStand(target, blockers)) continue;
      const candidate = space.path(minis[0].position, target, blockers);
      if (candidate.length) return candidate;
    }
    return [];
  };
  const previewRoute = () => {
    if (finishMove || selected === explorerRoom) {
      clearRoutePreview();
      return;
    }
    renderRoutePreview(chooseDestination(selected));
  };
  renderer.domElement.addEventListener('pointerdown', pointerDown);
  renderer.domElement.addEventListener('pointerup', pointerUp);
  select(0);
  previewRoute();
  const pieceInfo = (piece: THREE.Object3D, kind: string, index: number) => {
    const bounds = new THREE.Box3().setFromObject(piece);
    const size = bounds.getSize(new THREE.Vector3());
    return { kind, index, x: piece.position.x, z: piece.position.z, radius: piece.userData.radius, height: size.y };
  };
  const focusRoom = (roomIndex: number, height = 6.2) => {
    const room = rooms[roomIndex];
    const center = new THREE.Vector3(room.x * tileSize, 0, room.z * tileSize);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(4.2, height, 5.2));
    controls.update();
  };
  (window as unknown as { __betrayal3d?: unknown }).__betrayal3d = {
    rooms,
    edges: space.edges,
    doors: space.doors,
    furniture: space.furniture,
    monsterSource: 'Animated Monsters by Quaternius / CC0 1.0',
    focusRoom,
    get pieces() {
      return [
        ...minis.map((mini, index) => pieceInfo(mini, 'explorer', index)),
        pieceInfo(monster, 'monster', 0),
      ];
    },
    get lastRoute() { return lastRoute; },
    get routePreviewPointCount() { return routeLayer.userData.pointCount || 0; },
  };

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const atmosphere = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, strength: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float strength; varying vec2 vUv;
      void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb;
      float vignette=smoothstep(0.25,0.85,length((vUv-0.5)*vec2(1.0,0.9)));
      float grain=fract(sin(dot(vUv+fract(time),vec2(12.9898,78.233)))*43758.5453)-0.5;
      c*=1.0-vignette*0.36*strength; c+=grain*0.012*strength; gl_FragColor=vec4(c,1.0); }`,
  });
  composer.addPass(atmosphere);
  composer.addPass(new OutputPass());
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  let last = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min((now - last) / 1000, 0.2);
    last = now;
    if (route.length) {
      let remaining = dt * 3.8;
      while (route.length && remaining > 0) {
        const next = route[0];
        const delta = new THREE.Vector3(next.x, 0.12, next.z).sub(minis[0].position);
        const distance = delta.length();
        if (distance <= remaining) {
          minis[0].position.set(next.x, 0.12, next.z);
          route.shift();
          remaining -= distance;
        } else {
          minis[0].position.add(delta.normalize().multiplyScalar(remaining));
          remaining = 0;
        }
      }
      if (!route.length) { explorerRoom = selected; clearRoutePreview(); finishMove?.(true); finishMove = undefined; }
    }
    atmosphere.uniforms.time.value = now / 1000;
    controls.update();
    composer.render();
    renderer.domElement.dataset.frames = String(Number(renderer.domElement.dataset.frames || 0) + 1);
  });
  host.dataset.ready = 'true';
  return {
    select,
    move: () => {
      if (finishMove) return Promise.resolve(false);
      const candidate = chooseDestination(selected);
      route = candidate.slice();
      lastRoute = candidate.slice();
      if (!route.length) return Promise.resolve(false);
      renderRoutePreview(route, true);
      return new Promise(resolve => { finishMove = resolve; });
    },
    reset,
    top: enabled => {
      if (enabled) {
        const minX = Math.min(...rooms.map(room => room.x * tileSize - tileSize / 2));
        const maxX = Math.max(...rooms.map(room => room.x * tileSize + tileSize / 2));
        const minZ = Math.min(...rooms.map(room => room.z * tileSize - tileSize / 2));
        const maxZ = Math.max(...rooms.map(room => room.z * tileSize + tileSize / 2));
        controls.target.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
        camera.position.copy(controls.target).add(new THREE.Vector3(0, 42, 0.01));
      } else {
        reset();
      }
      controls.update();
    },
    walls: enabled => { walls.visible = enabled; },
    exposure: value => { renderer.toneMappingExposure = value; },
    atmosphere: enabled => { atmosphere.uniforms.strength.value = enabled ? 1 : 0; scene.fog = enabled ? new THREE.FogExp2('#14191a', 0.011) : null; },
    zoom: factor => { camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target); controls.update(); },
    dispose: () => {
      finishMove?.(false);
      finishMove = undefined;
      route = [];
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      scene.traverse(child => { if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
      } });
      for (const material of materials) { for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value); material.dispose(); }
      for (const texture of textures) texture.dispose();
      routeLineMaterial.dispose();
      routeDotMaterial.dispose();
      routeEndMaterial.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
