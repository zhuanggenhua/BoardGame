import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createRoomInteractionRim, createThreeRoomOutline, paintRoomInteraction, type SceneHighlight } from './threeRoomOutline';
import { collectSpriteMotionPhases, resolveSpriteMotionFrame } from '../../engine/mapRenderer/spriteMotionModel';
import type {
    MapSceneSprite, MapSceneSpriteMotionPhaseCallback,
} from '../../engine/mapRenderer/types';

export interface SceneFigureAsset {
    id: string;
    mirrorX?: boolean;
}

export interface ScenePath {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    kind: 'move' | 'attack';
}

export interface SceneMarker {
    sprite: MapSceneSprite;
    ownerFigureId?: string;
    selectable: boolean;
    highlight?: SceneHighlight;
}

export interface GirlMarkerTransfer {
    id: string;
    targetFigureId: string;
    durationMs: number;
    onComplete: (id: string) => void;
}

export function resolveCarriedGirlMarker(figureId: string) {
    return figureId.startsWith('monster:')
        ? { size: 42, x: -20, z: 26, elevation: 24, tilt: Math.PI / 5 }
        : { size: 42, x: 34, z: 24, elevation: 0, tilt: 0 };
}

interface ScenePresentation {
    sprites: readonly MapSceneSprite[];
    discoveredRoomIds: ReadonlySet<string>;
    figures: ReadonlyMap<string, SceneFigureAsset>;
    paths: readonly ScenePath[];
    markers: readonly SceneMarker[];
    girlTransfer?: GirlMarkerTransfer;
    hauntFocusRoomId?: string;
    interactionBlocked: boolean;
    onMotionComplete?: (spriteId: string, motionId: string) => void;
    onMotionPhase?: MapSceneSpriteMotionPhaseCallback;
}

interface SceneNode {
    key: string;
    root: THREE.Group;
    figure?: FigureLevels;
    rim?: ReturnType<typeof createRoomInteractionRim>;
    hitSurface: Mesh;
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
type FigureLevel = { object: THREE.Object3D; meshes: Mesh[]; triangles: number };
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
    onGirlTransferFrame?: () => void,
) {
    const scene = new THREE.Scene();
    const nodes = new Map<string, SceneNode>();
    const outlines = createThreeRoomOutline(renderer);
    const pathGroup = new THREE.Group();
    scene.add(pathGroup);
    const pathMaterials = {
        move: new THREE.MeshBasicMaterial({ color: 0x83daae, transparent: true, opacity: .72, depthWrite: false }),
        attack: new THREE.MeshBasicMaterial({ color: 0xff826c, transparent: true, opacity: .88, depthWrite: false }),
    };
    let paths: readonly ScenePath[] | undefined;
    let highlights = new Map<string, SceneHighlight>();
    let hovered: string | undefined;
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
        const marker = sprite.id.startsWith('marker:');
        const entity = sprite.id.startsWith('player:') || monster || marker;
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
        let roomBody: Mesh | undefined;
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
            roomBody = board;
        }
        const faceMaterial = new THREE.MeshBasicMaterial({
            color: entity ? 0x272521 : 0x514437,
            ...(marker ? { alphaTest: .18 } : {}),
        });
        const faceGeometry = entity ? createTokenFace(sprite, size) : new THREE.PlaneGeometry(width, height);
        const face = addMesh(faceGeometry.rotateX(-Math.PI / 2), faceMaterial);
        face.position.y = entity ? DISK_HEIGHT + 1.05 : 0.1;
        const rim = entity ? undefined : createRoomInteractionRim(width, height);
        if (rim) root.add(rim);
        let alive = true;
        const node: SceneNode = {
            key, root, rim, hitSurface: roomBody ?? modelBase ?? tokenBase ?? face, face: faceMaterial, artworkReady: false,
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
                if (marker) {
                    root.visible = false;
                    return;
                }
                node.artworkReady = true;
            }),
            dispose: () => {
                alive = false;
                if (frame) faceMaterial.map?.dispose();
                rim?.geometry.dispose();
                rim?.material.dispose();
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
                const meshes: Mesh[] = [];
                let triangles = 0;
                model.traverse(object => {
                    if (!(object instanceof THREE.Mesh)) return;
                    const mesh = object as Mesh;
                    meshes.push(mesh);
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
                return { object: model, meshes, triangles };
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

    let girlMotion: { id: string; from: THREE.Vector3; tilt: number; startedAt: number } | undefined;
    let completedGirlTransferId: string | undefined;
    const transferEnd = new THREE.Vector3();

    function finishGirlTransfer(transfer: GirlMarkerTransfer) {
        if (completedGirlTransferId === transfer.id) return;
        completedGirlTransferId = transfer.id;
        transfer.onComplete(transfer.id);
    }

    function draw(now: number) {
        animation = 0;
        if (disposed || !presentation) return;
        const { sprites, discoveredRoomIds, girlTransfer, hauntFocusRoomId, interactionBlocked, onMotionComplete, onMotionPhase } = presentation;
        let moving = false;
        let detailChanged = false;
        const afterDraw: (() => void)[] = [];
        const figureHighlights = new Map<THREE.Object3D, SceneHighlight>();
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
            const state = highlights.get(sprite.id);
            const interaction = interactionBlocked ? undefined : sprite.id === hovered && state !== 'hostile'
                ? state === 'candidate' || state === 'selected' ? 'selected' : 'candidate'
                : state;
            if (node.rim) paintRoomInteraction(node.rim, interaction);
            if (node.figure && interaction && opacity > .5) {
                for (const mesh of activeFigureLevel(node.figure).meshes) figureHighlights.set(mesh, interaction);
            }
            if (isRoom) {
                const light = discoveredRoomIds.has(sprite.id) ? 1 : .63;
                const focusAttenuation = hauntFocusRoomId && hauntFocusRoomId !== sprite.id ? .62 : 1;
                if (node.face.map) node.face.color.setScalar(light * reveal * focusAttenuation);
            }
        }
        if (!girlTransfer) girlMotion = undefined;
        let drewGirlTransfer = false;
        for (const marker of presentation.markers) {
            const node = nodes.get(marker.sprite.id);
            if (!node) continue;
            const owner = marker.ownerFigureId && nodes.get(marker.ownerFigureId);
            const { x, y, width, height } = marker.sprite;
            const attachment = owner && marker.ownerFigureId ? resolveCarriedGirlMarker(marker.ownerFigureId) : null;
            const receiver = girlTransfer && nodes.get(girlTransfer.targetFigureId);
            if (girlTransfer && marker.sprite.id === 'marker:mummy-girl' && receiver && node.artworkReady) {
                if (girlMotion?.id !== girlTransfer.id) {
                    girlMotion = { id: girlTransfer.id, from: node.root.position.clone(), tilt: node.root.rotation.x, startedAt: now };
                }
                const destination = resolveCarriedGirlMarker(girlTransfer.targetFigureId);
                transferEnd.set(destination.x, destination.elevation, destination.z).add(receiver.root.position);
                const progress = girlTransfer.durationMs ? Math.min(1, (now - girlMotion.startedAt) / girlTransfer.durationMs) : 1;
                const eased = progress * progress * (3 - 2 * progress);
                node.root.position.lerpVectors(girlMotion.from, transferEnd, eased);
                node.root.position.y += 14 * Math.sin(Math.PI * eased);
                node.root.rotation.x = THREE.MathUtils.lerp(girlMotion.tilt, destination.tilt, eased);
                node.root.scale.setScalar(THREE.MathUtils.lerp(1, destination.size / width, eased));
                drewGirlTransfer = true;
                moving ||= progress < 1;
                if (progress === 1) afterDraw.push(() => finishGirlTransfer(girlTransfer));
            } else {
                node.root.position.set(x + width / 2, attachment?.elevation ?? 0, y + height / 2);
                node.root.rotation.x = attachment?.tilt ?? 0;
                node.root.scale.setScalar(1);
                if (owner) node.root.position.add(owner.root.position);
            }
            const state = !interactionBlocked && (hovered === marker.sprite.id ? 'selected' : marker.highlight);
            if (node.artworkReady && state) {
                for (const object of node.root.children) figureHighlights.set(object, state);
            }
        }
        renderer.render(scene, camera);
        outlines.render(scene, camera, figureHighlights);
        if (drewGirlTransfer) onGirlTransferFrame?.();
        if (girlTransfer && !drewGirlTransfer && ready) afterDraw.push(() => finishGirlTransfer(girlTransfer));
        if (ready && detailChanged) reportReady();
        afterDraw.forEach(callback => callback());
        if (moving) renderSoon();
    }

    function renderSoon() {
        if (!animation && !disposed) animation = requestAnimationFrame(draw);
    }

    function update(next: ScenePresentation) {
        presentation = next;
        if (paths !== next.paths) {
            paths = next.paths;
            replacePaths(paths);
        }
        const currentGeneration = ++generation;
        const sprites = [...next.sprites, ...next.markers.map(marker => marker.sprite)];
        const ids = new Set(sprites.map(sprite => sprite.id));
        for (const [id, node] of nodes) {
            if (ids.has(id)) continue;
            node.dispose();
            nodes.delete(id);
        }
        for (const sprite of sprites) {
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

    function replacePaths(segments: readonly ScenePath[]) {
        for (const mesh of pathGroup.children as Mesh[]) mesh.geometry.dispose();
        pathGroup.clear();
        for (const { x1, y1, x2, y2, kind } of segments) {
            const length = Math.hypot(x2 - x1, y2 - y1);
            const line = new THREE.Mesh(new THREE.PlaneGeometry(length, kind === 'attack' ? 4 : 3).rotateX(-Math.PI / 2),
                pathMaterials[kind]);
            line.position.set((x1 + x2) / 2, .6, (y1 + y2) / 2);
            line.rotation.y = -Math.atan2(y2 - y1, x2 - x1);
            pathGroup.add(line);
        }
    }

    const raycaster = new THREE.Raycaster();
    function projectBounds(object: THREE.Object3D) {
        const box = new THREE.Box3().setFromObject(object);
        if (box.isEmpty()) return undefined;
        const point = new THREE.Vector3();
        const screen = new THREE.Box2();
        for (const x of [box.min.x, box.max.x]) {
            for (const y of [box.min.y, box.max.y]) {
                for (const z of [box.min.z, box.max.z]) {
                    point.set(x, y, z).project(camera);
                    screen.expandByPoint(new THREE.Vector2((point.x + 1) / 2, (1 - point.y) / 2));
                }
            }
        }
        // A world AABB corner can project far above the visible model in a tilted view.
        box.getCenter(point);
        point.y = box.max.y;
        point.project(camera);
        return { min: screen.min, max: screen.max, headY: (1 - point.y) / 2 };
    }

    function pickObject(ndc: THREE.Vector2, scope: 'all' | 'figure' | 'room' = 'all') {
        raycaster.setFromCamera(ndc, camera);
        let nearest = Infinity;
        let picked: string | undefined;
        for (const [id, node] of nodes) {
            if (scope === 'all' && id.startsWith('marker:') && node.artworkReady &&
                presentation?.markers.some(marker => marker.sprite.id === id && marker.selectable)) {
                const hit = raycaster.intersectObject(node.hitSurface, false)[0];
                if (hit && hit.distance < nearest) {
                    nearest = hit.distance;
                    picked = id;
                }
                continue;
            }
            if (node.figure ? scope === 'room' : scope === 'figure' || !node.rim) continue;
            const targets = node.figure ? [activeFigureLevel(node.figure).object, node.hitSurface] : [node.hitSurface];
            const hit = raycaster.intersectObjects(targets, Boolean(node.figure))[0];
            if (!hit || hit.distance >= nearest) continue;
            nearest = hit.distance;
            picked = id;
        }
        return picked;
    }

    return {
        update, renderSoon, pickObject,
        completePendingGirlTransfer() {
            if (presentation?.girlTransfer) finishGirlTransfer(presentation.girlTransfer);
        },
        setHighlights(next: Map<string, SceneHighlight>) {
            highlights = next;
            renderSoon();
        },
        setHovered(id: string | undefined) {
            if (id === hovered) return;
            hovered = id;
            renderSoon();
        },
        hasFigure(id: string) { return Boolean(nodes.get(id)?.figure); },
        getMarkerScreenBounds(id: string) {
            const node = nodes.get(id);
            return node?.artworkReady ? projectBounds(node.hitSurface) : undefined;
        },
        getFigureScreenBounds(id: string) {
            const node = nodes.get(id);
            return node?.figure ? projectBounds(activeFigureLevel(node.figure).object) : undefined;
        },
        getFigureHitPoint(id: string) {
            const figure = nodes.get(id)?.figure;
            if (!figure) return undefined;
            const model = activeFigureLevel(figure).object;
            const bounds = new THREE.Box3().setFromObject(model);
            const point = bounds.getCenter(new THREE.Vector3());
            for (const fraction of [.65, .48, .8, .33, .18]) {
                point.y = THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, fraction);
                const projected = point.clone().project(camera);
                if (pickObject(new THREE.Vector2(projected.x, projected.y), 'figure') === id) return projected;
            }
            return undefined;
        },
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
            replacePaths([]);
            Object.values(pathMaterials).forEach(material => material.dispose());
            outlines.dispose();
        },
    };
}
