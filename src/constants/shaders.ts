/**
 * デフォルトシェーダソースコード
 */

export const DEFAULT_VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const DEFAULT_FRAGMENT_SHADER = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;

vec3 palette(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + t));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float n = 0.5 + 0.5 * cos(6.28318 * (uv.x + u_time * 0.2));
  vec3 col = mix(palette(u_time * 0.05), palette(uv.y + u_time * 0.1), n);
  gl_FragColor = vec4(col, 1.0);
}
`;
