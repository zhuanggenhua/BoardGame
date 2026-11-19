import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { collectSpriteMotionPhases, resolveSpriteMotionFrame } from '../../engine/mapRenderer/spriteMotionModel';
import type {
    MapSceneSprite, MapSceneSpriteMotionPhaseCallback,
} from '../../engine/mapRenderer/types';

export interface SceneFigureAsset {
    id: string;
    mirrorX?: boolean;
}

interface ScenePresentation {
    sprites: readonly MapSceneSprite[];
    discoveredRoomIds: ReadonlySet<string>;
    figures: ReadonlyMap<string, SceneFigureAsset>;
    onMotionComplete?: (spriteId: string, motionId: string) => void;
    onMotionPhase?: MapSceneSpriteMotionPhaseCallback;
}

interface SceneNode {
    key: string;
    root: THREE.Group;
    figure?: FigureLevels;
    face: THREE.MeshBasicMaterial;
    materials: MaterialState[];
    artwork: Promise<unknown>;
    artworkReady: boolean;
    dispose: () => void;
    motion?: {
        id: string;
        startedAt: number;
        landingEmitted: boolean;
        settledEmitted: boolean;
    };
}

type Mesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
type MaterialState = Pick<THREE.Material, 'transparent' | 'depthWrite' | 'opacity'> & { material: THREE.Material };
type FigureCounts = { explorers: number; monsters: number; detail: number; triangles: number };
type FigureSources = { detail: THREE.Object3D; table?: THREE.Object3D };
type FigureLevel = { object: THREE.Object3D; triangles: number };
type FigureLevels = { detail: FigureLevel; table?: FigureLevel };

const TILE_DEPTH = 7;
const DISK_HEIGHT = 5;
const DAYLIGHT = 0xffeed2;
const DETAIL_ENTER_ZOOM = 1.65;
const DETAIL_EXIT_ZOOM = 1.45;

function materialState(material: THREE.Material): MaterialState {
    const { depthWrite, opacity, transparent } = material;
    return { material, depthWrite, opacity, transparent };
}

function createRevealGlow() {
    const size = 64;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const index = (y * size + x) * 4;
            const radius = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
            pixels.set([218, 235, 181, 255 * Math.max(0, 1 - radius) ** 2], index);
        }
    }
    const map = new THREE.DataTexture(pixels, size, size);
    map.magFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
    mesh.visible = false;
    return mesh;
}

function createTokenFace(sprite: MapSceneSprite, size: number) {
    if (!sprite.clipPolygon) return new THREE.CircleGeometry(size * .46, 40);
    const points = sprite.clipPolygon.map(point => new THREE.Vector2(
        (point.x - .5) * sprite.width, (.5 - point.y) * sprite.height,
    ));
    const geometry = new THREE.ShapeGeometry(new THREE.Shape(points));
    const positions = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    for (let index = 0; index < uv.count; index++) {
        uv.setXY(index, positions.getX(index) / sprite.width + .5, positions.getY(index) / sprite.height + .5);
    }
    return geometry;
}

function disposeFigures({ detail, table }: FigureSources) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    const collect = (object: THREE.Object3D) => {
        if (!(object instanceof THREE.Mesh)) return;
        const mesh = object as Mesh;
        geometries.add(mesh.geometry);
        materials.add(mesh.material);
    };
    detail.traverse(collect);
    table?.traverse(collect);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
        for (const property of Object.values(material)) {
            if (property instanceof THREE.Texture) textures.add(property);
        }
        material.dispose();
    }
    for (const texture of textures) {
        const image = texture.source.data;
        if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
        texture.dispose();
    }
}

function activeFigureLevel(figure: FigureLevels) {
    return figure.table?.object.visible ? figure.table : figure.detail;
}

function updateFigureDetail(figure: FigureLevels, zoom: number) {
    if (!figure.table) return false;
    const detail = figure.detail.object;
    const next = zoom >= (detail.visible ? DETAIL_EXIT_ZOOM : DETAIL_ENTER_ZOOM);
    if (next === detail.visible) return false;
    detail.visible = next;
    figure.table.object.visible = !next;
    return true;
}

export function createBetrayalThreeScene(
    renderer: THREE.WebGLRenderer,
    camera: THREE.OrthographicCamera,
    onStateChange: (status: 'ready' | 'error', models: FigureCounts) => void,
) {
    const scene = new THREE.Scene();
    const nodes = new Map<string, SceneNode>();
    const textures = new Map<string, Promise<THREE.Texture>>();
    const models = new Map<string, Promise<FigureSources>>();
    const progressRing = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xede0ad, transparent: true, depthWrite: false }),
    );
    progressRing.visible = false;
    scene.add(progressRing);
    const revealGlow = createRevealGlow();
    scene.add(revealGlow);
    scene.add(new THREE.HemisphereLight(DAYLIGHT, 0x647666, 2.3));
    const key = new THREE.DirectionalLight(DAYLIGHT, 2.0);
    key.position.set(-400, 560, 310);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc8dcff, 0.65);
    fill.position.set(320, 200, -420);
    scene.add(fill);

    const textureLoader = new THREE.TextureLoader();
    const modelLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    let presentation: ScenePresentation | undefined;
    let disposed = false;
    let ready = false;
    let generation = 0;
    let animation = 0;

    function loadTexture(urls: readonly string[]) {
        const key = urls.join('\n');
        const existing = textures.get(key);
        if (existing) return existing;
        const promise = (async () => {
            for (const url of urls) {
                try {
                    const texture = await textureLoader.loadAsync(url);
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                    return texture;
                } catch {
                    // The game's runtime asset resolver supplies ordered format/CDN candidates.
                }
            }
            throw new Error(`Betrayal atlas unavailable: ${urls[0]}`);
        })();
        textures.set(key, promise);
        return promise;
    }

    function loadFigure(id: string) {
        const cached = models.get(id);
        if (cached) return cached;
        const promise = modelLoader.loadAsync(`${import.meta.env.BASE_URL}betrayal-models/${id}.glb`)
            .then(result => ({ detail: result.scene, table: result.scenes.find(scene => scene.name === 'table') }));
        models.set(id, promise);
        return promise;
    }

    function addNode(sprite: MapSceneSprite, asset: SceneFigureAsset | undefined, key: string) {
        const root = new THREE.Group();
        const ownedMeshes: Mesh[] = [];
        const modelMaterials = new Map<THREE.Material, THREE.Material>();
        const monster = sprite.id.startsWith('monster:');
        const entity = sprite.id.startsWith('player:') || monster;
        const { width, height, border, frame } = sprite;
        const size = Math.min(width, height);
        const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
            const mesh = new THREE.Mesh(geometry, material);
            ownedMeshes.push(mesh);
            root.add(mesh);
            return mesh;
        };
        const addDisk = (diameter: number, y: number, color: number) => {
            const disk = addMesh(new THREE.CylinderGeometry(diameter / 2, diameter / 2, DISK_HEIGHT, 40),
                new THREE.MeshStandardMaterial({ color, roughness: .87 }));
            disk.position.y = y;
            return disk;
        };
        const baseDiameter = size * (monster ? .84 : .74);
        let tokenBase: Mesh | undefined;
        let modelBase: Mesh | undefined;
        let monsterBaseTop: Mesh | undefined;
        if (entity) {
            tokenBase = addDisk(size, DISK_HEIGHT / 2 + 1, border?.color ?? 0xccb980);
            if (asset) {
                modelBase = addDisk(baseDiameter, DISK_HEIGHT / 2 + 1, border?.color ?? 0xccb980);
                modelBase.visible = false;
                if (monster) {
                    monsterBaseTop = addDisk(baseDiameter * .96, DISK_HEIGHT + .25, 0x322922);
                    monsterBaseTop.scale.y = .4;
                    monsterBaseTop.visible = false;
                }
            }
        } else {
            const board = addMesh(new THREE.BoxGeometry(width, TILE_DEPTH, height),
                new THREE.MeshStandardMaterial({ color: 0x40372d, roughness: 1 }));
            board.position.y = -TILE_DEPTH / 2;
        }
        const faceMaterial = new THREE.MeshBasicMaterial({ color: entity ? 0x272521 : 0x514437 });
        const faceGeometry = entity ? createTokenFace(sprite, size) : new THREE.PlaneGeometry(width, height);
        const face = addMesh(faceGeometry.rotateX(-Math.PI / 2), faceMaterial);
        face.position.y = entity ? DISK_HEIGHT + 1.05 : 0.1;
        let alive = true;
        const node: SceneNode = {
            key, root, face: faceMaterial, artworkReady: false,
            materials: ownedMeshes.map(mesh => materialState(mesh.material)),
            artwork: loadTexture(sprite.textureUrls).then(texture => {
                if (!alive) return;
                node.artworkReady = true;
                if (node.figure) return;
                if (frame) {
                    faceMaterial.map = texture.clone();
                    faceMaterial.map.repeat.set(frame.width, frame.height);
                    faceMaterial.map.offset.set(frame.x, 1 - frame.y - frame.height);
                } else {
                    faceMaterial.map = texture;
                }
                faceMaterial.color.set(0xffffff);
                faceMaterial.needsUpdate = true;
                renderSoon();
            }).catch(error => {
                if (!entity) throw error;
                node.artworkReady = true;
            }),
            dispose: () => {
                alive = false;
                if (frame) faceMaterial.map?.dispose();
                for (const mesh of ownedMeshes) {
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                }
                modelMaterials.forEach(material => material.dispose());
                scene.remove(root);
            },
        };

        if (asset) void loadFigure(asset.id).then(source => {
            if (!alive) return;
            const bounds = new THREE.Box3().setFromObject(source.detail);
            const modelSize = bounds.getSize(new THREE.Vector3());
            const center = bounds.getCenter(new THREE.Vector3());
            const heightLimit = size * (monster ? 1.24 : 1.02);
            const widthLimit = size * (monster ? .88 : .72);
            const scale = Math.min(heightLimit / modelSize.y, widthLimit / Math.max(modelSize.x, modelSize.z));
            const figure = new THREE.Group();
            const anchor = new THREE.Vector3(center.x, bounds.min.y, center.z);
            const createLevel = (original: THREE.Object3D): FigureLevel => {
                const model = original.clone();
                let triangles = 0;
                model.traverse(object => {
                    if (!(object instanceof THREE.Mesh)) return;
                    const mesh = object as Mesh;
                    let material = modelMaterials.get(mesh.material);
                    if (!material) {
                        material = mesh.material.clone();
                        modelMaterials.set(mesh.material, material);
                        node.materials.push(materialState(material));
                    }
                    mesh.material = material;
                    triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
                });
                model.position.sub(anchor);
                figure.add(model);
                return { object: model, triangles };
            };
            figure.scale.setScalar(scale);
            if (asset.mirrorX) figure.scale.x = -scale;
            figure.position.y = DISK_HEIGHT + 1;
            const detail = createLevel(source.detail);
            const table = source.table ? createLevel(source.table) : undefined;
            if (table) {
                detail.object.visible = camera.zoom >= DETAIL_ENTER_ZOOM;
                table.object.visible = !detail.object.visible;
            }
            node.figure = { detail, table };
            root.add(figure);
            if (modelBase) modelBase.visible = true;
            if (monsterBaseTop) monsterBaseTop.visible = true;
            if (tokenBase) tokenBase.visible = false;
            face.visible = false;
            if (ready) reportReady();
            renderSoon();
        }).catch(error => {
            if (alive) console.warn('Betrayal figure model unavailable', asset.id, error);
        });
        scene.add(root);
        return node;
    }

    function reportReady() {
        const counts: FigureCounts = { explorers: 0, monsters: 0, detail: 0, triangles: 0 };
        for (const [id, node] of nodes) {
            if (!node.figure) continue;
            counts[id.startsWith('monster:') ? 'monsters' : 'explorers']++;
            const level = activeFigureLevel(node.figure);
            if (level === node.figure.detail) counts.detail++;
            counts.triangles += level.triangles;
        }
        onStateChange('ready', counts);
    }

    function draw(now: number) {
        animation = 0;
        if (disposed || !presentation) return;
        const { sprites, discoveredRoomIds, onMotionComplete, onMotionPhase } = presentation;
        let moving = false;
        let detailChanged = false;
        const afterDraw: (() => void)[] = [];
        progressRing.visible = false;
        revealGlow.visible = false;
        for (const sprite of sprites) {
            const node = nodes.get(sprite.id);
            if (!node) continue;
            if (node.figure && updateFigureDetail(node.figure, camera.zoom)) detailChanged = true;
            let { x, y } = sprite;
            let elevation = 0;
            let scale = 1;
            let reveal = 1;
            let opacity = 1;
            const motion = sprite.motion;
            if (ready && motion && (motion.kind !== 'reveal' || node.artworkReady) && node.motion?.id !== motion.id) {
                node.motion = { id: motion.id, startedAt: now, landingEmitted: false, settledEmitted: false };
            }
            if (motion && node.motion?.id === motion.id && !node.motion.settledEmitted) {
                const frame = resolveSpriteMotionFrame(now - node.motion.startedAt, motion);
                const t = frame.progress;
                const eased = t * t * (3 - 2 * t);
                if (motion.kind === 'fade') {
                    if (t < .5) ({ x, y } = motion.from);
                    opacity = Math.abs(Math.cos(Math.PI * t));
                } else if (motion.kind === 'hop') {
                    x = THREE.MathUtils.lerp(motion.from.x, x, eased);
                    y = THREE.MathUtils.lerp(motion.from.y, y, eased);
                    elevation = Math.sin(Math.PI * t) * (motion.arcHeight ?? 16) * 1.5;
                } else {
                    elevation = (1 - eased) * 30;
                    scale = THREE.MathUtils.lerp(motion.startScale ?? .96, 1, eased);
                    reveal = .45 + .55 * eased;
                    if (!frame.complete) {
                        revealGlow.position.set(x + sprite.width / 2, elevation + .18, y + sprite.height / 2);
                        revealGlow.scale.set(sprite.width * (1.6 + t * .8), 1, sprite.height * (1.6 + t * .8));
                        revealGlow.material.opacity = .65 * Math.sin(Math.PI * t);
                        revealGlow.visible = true;
                    }
                }
                if (frame.shouldRenderRipple) {
                    const radius = sprite.width * (.38 + frame.landingProgress * .23);
                    progressRing.scale.set(radius, 1, radius);
                    progressRing.position.set(x + sprite.width / 2, .6, y + sprite.height / 2);
                    progressRing.material.opacity = 1 - frame.landingProgress;
                    progressRing.visible = !frame.complete;
                }
                for (const phase of collectSpriteMotionPhases(frame, motion.kind, node.motion)) {
                    afterDraw.push(() => onMotionPhase?.(sprite.id, motion.id, phase));
                }
                if (frame.complete) afterDraw.push(() => onMotionComplete?.(sprite.id, motion.id));
                moving ||= !frame.complete;
            }
            node.root.position.set(x + sprite.width / 2, elevation, y + sprite.height / 2);
            node.root.rotation.y = -(sprite.rotation ?? 0);
            node.root.scale.setScalar(scale);
            for (const original of node.materials) {
                original.material.opacity = original.opacity * opacity;
                original.material.transparent = original.transparent || opacity < 1;
                original.material.depthWrite = original.depthWrite && opacity === 1;
            }
            const isRoom = !sprite.id.startsWith('player:') && !sprite.id.startsWith('monster:');
            if (isRoom) {
                const light = discoveredRoomIds.has(sprite.id) ? 1 : .63;
                if (node.face.map) node.face.color.setScalar(light * reveal);
            }
        }
        renderer.render(scene, camera);
        if (ready && detailChanged) reportReady();
        afterDraw.forEach(callback => callback());
        if (moving) renderSoon();
    }

    function renderSoon() {
        if (!animation && !disposed) animation = requestAnimationFrame(draw);
    }

    function update(next: ScenePresentation) {
        presentation = next;
        const currentGeneration = ++generation;
        const ids = new Set(next.sprites.map(sprite => sprite.id));
        for (const [id, node] of nodes) {
            if (ids.has(id)) continue;
            node.dispose();
            nodes.delete(id);
        }
        for (const sprite of next.sprites) {
            const model = next.figures.get(sprite.id);
            const key = JSON.stringify([sprite.textureUrls, sprite.frame, sprite.width, sprite.height, sprite.border, model]);
            const existing = nodes.get(sprite.id);
            if (existing?.key === key) continue;
            existing?.dispose();
            nodes.set(sprite.id, addNode(sprite, model, key));
        }
        void Promise.all([...nodes.values()].map(node => node.artwork)).then(() => {
            if (disposed || currentGeneration !== generation) return;
            ready = true;
            reportReady();
            renderSoon();
        }).catch(error => {
            if (disposed || currentGeneration !== generation) return;
            console.warn('Betrayal 3D board artwork unavailable', error);
            onStateChange('error', { explorers: 0, monsters: 0, detail: 0, triangles: 0 });
        });
        renderSoon();
    }

    const raycaster = new THREE.Raycaster();
    function pickFigure(ndc: THREE.Vector2) {
        raycaster.setFromCamera(ndc, camera);
        const figures = [...nodes.entries()].flatMap(([id, node]) => node.figure ? [{ id, figure: activeFigureLevel(node.figure).object }] : []);
        let nearest = Infinity;
        let picked: string | undefined;
        for (const { id, figure } of figures) {
            const hit = raycaster.intersectObject(figure, true)[0];
            if (!hit || hit.distance >= nearest) continue;
            nearest = hit.distance;
            picked = id;
        }
        return picked;
    }

    return {
        update, renderSoon, pickFigure,
        dispose() {
            disposed = true;
            cancelAnimationFrame(animation);
            nodes.forEach(node => node.dispose());
            textures.forEach(promise => void promise.then(texture => texture.dispose()).catch(() => {}));
            models.forEach(promise => void promise.then(disposeFigures).catch(() => {}));
            progressRing.geometry.dispose();
            progressRing.material.dispose();
            revealGlow.geometry.dispose();
            revealGlow.material.map?.dispose();
            revealGlow.material.dispose();
        },
    };
}
