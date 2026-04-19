/**
 * Shader FX 子模块
 *
 * 提供 WebGL shader 特效的渲染基础设施。
 * 与 Canvas 2D 粒子系统共存，按需使用。
 */

// 核心组件
export { ShaderCanvas } from './ShaderCanvas';

// 工具
export { compileShader, createProgram, setUniforms } from './ShaderMaterial';
export { precompileShaders, registerShader, flushRegisteredShaders } from './ShaderPrecompile';

// 类型
export type { UniformValue, ShaderCanvasProps } from './types';

// Vertex Shader
export { COMMON_VERT } from './shaders/common.vert';

// GLSL 库
export { NOISE_GLSL } from './glsl/noise.glsl';

// Shader 预设
export { VORTEX_FRAG } from './shaders/vortex.frag';
