export interface ShadyUniform {
  type: string
  name: string
  arraySize?: number
  doc: string
}

export const SHADY_UNIFORMS: ShadyUniform[] = [
  { type: 'vec2',      name: 'iResolution',        doc: 'Viewport resolution in pixels.' },
  { type: 'float',     name: 'iTime',              doc: 'Seconds since the shader started.' },
  { type: 'float',     name: 'iTimeDelta',         doc: 'Seconds since the previous frame.' },
  { type: 'int',       name: 'iFrame',             doc: 'Current frame number.' },
  { type: 'vec4',      name: 'iMouse',             doc: 'Mouse position (xy) and click position (zw), in pixels.' },
  { type: 'vec4',      name: 'iDate',              doc: 'Year, month, day and seconds since midnight.' },
  { type: 'float',     name: 'iSampleRate',        doc: 'Sample rate of the active audio input (44100 if none).' },
  { type: 'vec3',      name: 'iChannelResolution', arraySize: 4, doc: 'Resolution of each channel in pixels (z is 1).' },
  { type: 'float',     name: 'iChannelTime',       arraySize: 4, doc: 'Playback time in seconds of each audio file channel.' },
  { type: 'sampler2D', name: 'iChannel0',          doc: 'Channel 0 (buffer A slot).' },
  { type: 'sampler2D', name: 'iChannel1',          doc: 'Channel 1 (buffer B slot).' },
  { type: 'sampler2D', name: 'iChannel2',          doc: 'Channel 2 (buffer C slot).' },
  { type: 'sampler2D', name: 'iChannel3',          doc: 'Channel 3 (buffer D slot).' },
]

export function uniformDeclarations(): string {
  return SHADY_UNIFORMS
    .map(u => `uniform ${u.type.padEnd(10)}${u.name}${u.arraySize ? `[${u.arraySize}]` : ''};`)
    .join('\n')
}

export interface GlslSnippet {
  label: string
  insertText: string
  detail: string
  doc?: string
}

const fn = (label: string, params: string, detail: string, doc?: string): GlslSnippet => {
  const args = params.split(',').filter(Boolean).map((p, i) => `\${${i + 1}:${p.trim()}}`).join(', ')
  return { label, insertText: `${label}(${args})`, detail, doc }
}

export const GLSL_FUNCTIONS: GlslSnippet[] = [
  fn('sin', 'x', 'genType sin(genType)'),
  fn('cos', 'x', 'genType cos(genType)'),
  fn('tan', 'x', 'genType tan(genType)'),
  fn('asin', 'x', 'genType asin(genType)'),
  fn('acos', 'x', 'genType acos(genType)'),
  fn('atan', 'y, x', 'genType atan(genType y, genType x)'),
  fn('pow', 'x, y', 'genType pow(genType x, genType y)'),
  fn('exp', 'x', 'genType exp(genType)'),
  fn('log', 'x', 'genType log(genType)'),
  fn('exp2', 'x', 'genType exp2(genType)'),
  fn('log2', 'x', 'genType log2(genType)'),
  fn('sqrt', 'x', 'genType sqrt(genType)'),
  fn('inversesqrt', 'x', 'genType inversesqrt(genType)'),
  fn('abs', 'x', 'genType abs(genType)'),
  fn('sign', 'x', 'genType sign(genType)'),
  fn('floor', 'x', 'genType floor(genType)'),
  fn('ceil', 'x', 'genType ceil(genType)'),
  fn('fract', 'x', 'genType fract(genType)'),
  fn('mod', 'x, y', 'genType mod(genType x, genType y)'),
  fn('min', 'x, y', 'genType min(genType x, genType y)'),
  fn('max', 'x, y', 'genType max(genType x, genType y)'),
  fn('clamp', 'x, minVal, maxVal', 'genType clamp(genType x, genType minVal, genType maxVal)'),
  fn('mix', 'a, b, t', 'genType mix(genType a, genType b, genType t)', 'Linear interpolation: a * (1 - t) + b * t.'),
  fn('step', 'edge, x', 'genType step(genType edge, genType x)', '0.0 if x < edge, otherwise 1.0.'),
  fn('smoothstep', 'edge0, edge1, x', 'genType smoothstep(genType edge0, genType edge1, genType x)'),
  fn('length', 'x', 'float length(genType)'),
  fn('distance', 'p0, p1', 'float distance(genType p0, genType p1)'),
  fn('dot', 'x, y', 'float dot(genType x, genType y)'),
  fn('cross', 'x, y', 'vec3 cross(vec3 x, vec3 y)'),
  fn('normalize', 'x', 'genType normalize(genType)'),
  fn('reflect', 'I, N', 'genType reflect(genType I, genType N)'),
  fn('refract', 'I, N, eta', 'genType refract(genType I, genType N, float eta)'),
  fn('texture', 'sampler, uv', 'vec4 texture(sampler2D, vec2)'),
  fn('textureLod', 'sampler, uv, lod', 'vec4 textureLod(sampler2D, vec2, float lod)'),
  fn('texelFetch', 'sampler, ivec2(p), 0', 'vec4 texelFetch(sampler2D, ivec2, int lod)', 'Reads a texel by integer coordinate, no filtering.'),
  fn('textureSize', 'sampler, 0', 'ivec2 textureSize(sampler2D, int lod)'),
  fn('dFdx', 'p', 'genType dFdx(genType)'),
  fn('dFdy', 'p', 'genType dFdy(genType)'),
  fn('fwidth', 'p', 'genType fwidth(genType)'),
]

export const SHADY_BUILTINS: GlslSnippet[] = [
  { label: 'fragCoord', insertText: 'fragCoord', detail: 'vec2 fragCoord', doc: 'Pixel coordinate of the current fragment (gl_FragCoord.xy). Provided by Shady.' },
  { label: 'fragColor', insertText: 'fragColor', detail: 'out vec4 fragColor', doc: 'Output color of the fragment.' },
]

export const GLSL_CONSTANT_KEYWORDS = ['true', 'false']
export const GLSL_PRECISION_KEYWORDS = ['highp', 'mediump', 'lowp']
export const GLSL_EXTRA_KEYWORDS = ['struct', 'switch', 'case', 'default', 'flat', 'smooth', 'centroid']
export const GLSL_EXTRA_TYPES = [
  'bvec2', 'bvec3', 'bvec4', 'mat2x2', 'mat2x3', 'mat2x4', 'mat3x2', 'mat3x3', 'mat3x4',
  'mat4x2', 'mat4x3', 'mat4x4', 'sampler3D', 'sampler2DArray', 'isampler2D', 'usampler2D',
]
export const GLSL_DIRECTIVES = ['#define', '#undef', '#if', '#ifdef', '#ifndef', '#else', '#elif', '#endif']
