export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

const UNIFORM_BLOCK = `
uniform vec2      iResolution;
uniform float     iTime;
uniform float     iTimeDelta;
uniform int       iFrame;
uniform vec4      iMouse;
uniform vec4      iDate;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;`

export const STARTER_MAIN_SHADER = `#version 300 es
precision highp float;
${UNIFORM_BLOCK}

out vec4 fragColor;

void main() {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

  float angle = iTime;
  float size = 0.15;

  mat2 rotationMatrix = mat2(cos(angle), -sin(angle),
                             sin(angle),  cos(angle));

  uv = rotationMatrix * uv;

  vec2 d = abs(uv) - size;
  float distanceToEdge = max(d.x, d.y);
  float mask = step(distanceToEdge, 0.0);

  fragColor = vec4(vec3(mask), 1.0);
}`

export const STARTER_BUFFER_SHADER = `#version 300 es
precision highp float;
${UNIFORM_BLOCK}

out vec4 fragColor;

void main() {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = vec4(uv, 0.5 + 0.5 * sin(iTime), 1.0);
}`
