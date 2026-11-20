import * as THREE from 'three';

export type SceneHighlight = 'candidate' | 'selected' | 'hostile' | 'passive';

export function createRoomInteractionRim(width: number, height: number) {
    const material = new THREE.ShaderMaterial({
        uniforms: { tone: { value: new THREE.Color() }, weight: { value: 1 } },
        vertexShader: /* glsl */ `
            varying vec2 vRoom;
            void main() {
                vRoom = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec2 vRoom;
            uniform vec3 tone;
            uniform float weight;
            void main() {
                vec2 sides = min(vRoom, 1.0 - vRoom);
                float distance = min(sides.x, sides.y);
                float line = 1.0 - smoothstep(0.014 * weight, 0.022 * weight, distance);
                float alpha = line * 0.92 + 0.24 * exp(-distance * 40.0);
                if (alpha < 0.01) discard;
                gl_FragColor = vec4(tone, min(alpha, 1.0));
            }
        `,
        transparent: true, depthWrite: false,
    });
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(width - 5, height - 5).rotateX(-Math.PI / 2), material);
    rim.position.y = .25;
    rim.visible = false;
    return rim;
}

export function paintRoomInteraction(rim: ReturnType<typeof createRoomInteractionRim>, state?: SceneHighlight) {
    rim.visible = Boolean(state);
    if (!state) return;
    rim.material.uniforms.tone.value.set({
        selected: 0xffd578, hostile: 0xff745e, candidate: 0x66edaa, passive: 0x518f71,
    }[state]).convertLinearToSRGB();
    rim.material.uniforms.weight.value = state === 'selected' ? 1.35 : state === 'passive' ? .62 : 1;
}

const vertexShader = /* glsl */ `
    varying vec2 vScreen;
    void main() {
        vScreen = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    varying vec2 vScreen;
    uniform sampler2D mask;
    uniform sampler2D depths;
    uniform vec2 texel;
    uniform float pixelRatio;

    void main() {
        vec4 center = texture2D(mask, vScreen);
        if (max(max(center.r, center.g), max(center.b, center.a)) > 0.5) discard;
        float depth = texture2D(depths, vScreen).r;
        vec4 edge = vec4(0.0);
        for (int i = 0; i < 8; ++i) {
            float angle = float(i) * 0.785398;
            vec2 stepUv = vec2(cos(angle), sin(angle)) * texel * pixelRatio;
            vec2 nearUv = vScreen + stepUv * 1.6;
            vec2 farUv = vScreen + stepUv * 2.8;
            if (texture2D(depths, nearUv).r <= depth + 0.00045)
                edge = max(edge, texture2D(mask, nearUv));
            if (texture2D(depths, farUv).r <= depth + 0.00045)
                edge.g = max(edge.g, texture2D(mask, farUv).g);
        }
        if (edge.g > 0.5) gl_FragColor = vec4(1.0, 0.83, 0.38, 0.99);
        else if (edge.b > 0.5) gl_FragColor = vec4(1.0, 0.42, 0.31, 0.95);
        else if (edge.r > 0.5) gl_FragColor = vec4(0.36, 0.94, 0.64, 0.91);
        else if (edge.a > 0.5) gl_FragColor = vec4(0.31, 0.67, 0.51, 0.65);
        else discard;
    }
`;

// The mask and occluders use the same camera and live mesh transforms as the board.
export function createThreeRoomOutline(renderer: THREE.WebGLRenderer) {
    const colors = {
        candidate: [1, 0, 0, 0],
        selected: [0, 1, 0, 0],
        hostile: [0, 0, 1, 0],
        passive: [0, 0, 0, 1],
        occluder: [0, 0, 0, 0],
    } as const;
    const materials = Object.fromEntries(Object.entries(colors).map(([key, rgba]) => [
        key, new THREE.ShaderMaterial({
            uniforms: { stateColor: { value: new THREE.Vector4(...rgba) } },
            vertexShader: /* glsl */ `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: /* glsl */ `uniform vec4 stateColor; void main() { gl_FragColor = stateColor; }`,
            side: THREE.DoubleSide,
        }),
    ])) as Record<keyof typeof colors, THREE.ShaderMaterial>;
    const target = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    });
    const output = new THREE.ShaderMaterial({
        uniforms: {
            mask: { value: target.texture }, depths: { value: target.depthTexture },
            texel: { value: new THREE.Vector2() }, pixelRatio: { value: 1 },
        },
        vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), output);
    quad.frustumCulled = false;
    const composite = new THREE.Scene();
    composite.add(quad);
    const screenCamera = new THREE.Camera();
    const size = new THREE.Vector2();
    const clear = new THREE.Color();
    return {
        render(scene: THREE.Scene, camera: THREE.Camera, highlights: ReadonlyMap<THREE.Object3D, SceneHighlight>) {
            if (highlights.size === 0) return;
            renderer.getDrawingBufferSize(size);
            const resolutionScale = Math.min(1, 1440 / Math.max(size.x, size.y));
            const width = Math.max(1, Math.round(size.x * resolutionScale));
            const height = Math.max(1, Math.round(size.y * resolutionScale));
            if (target.width !== width || target.height !== height) target.setSize(width, height);
            output.uniforms.texel.value.set(1 / width, 1 / height);
            output.uniforms.pixelRatio.value = renderer.getPixelRatio() * resolutionScale;
            const seen: Array<{ mesh: THREE.Mesh; material: THREE.Mesh['material']; visible: boolean }> = [];
            scene.traverseVisible(object => {
                if (!(object instanceof THREE.Mesh)) return;
                seen.push({ mesh: object, material: object.material, visible: object.visible });
                const state = highlights.get(object);
                const material = object.material;
                // Glow planes and fading motion must not write opaque mask depth.
                if (!state && !Array.isArray(material) && !material.depthWrite) object.visible = false;
                else object.material = materials[state ?? 'occluder'];
            });
            const previousTarget = renderer.getRenderTarget();
            const previousAlpha = renderer.getClearAlpha();
            renderer.getClearColor(clear);
            const autoClear = renderer.autoClear;
            try {
                renderer.setRenderTarget(target);
                renderer.setClearColor(0, 0);
                renderer.clear();
                renderer.render(scene, camera);
            } finally {
                for (const { mesh, material, visible } of seen) {
                    mesh.material = material;
                    mesh.visible = visible;
                }
                renderer.setRenderTarget(previousTarget);
                renderer.setClearColor(clear, previousAlpha);
            }
            try {
                renderer.autoClear = false;
                renderer.render(composite, screenCamera);
            } finally {
                renderer.autoClear = autoClear;
            }
        },
        dispose() {
            target.dispose();
            quad.geometry.dispose();
            output.dispose();
            Object.values(materials).forEach(material => material.dispose());
        },
    };
}
