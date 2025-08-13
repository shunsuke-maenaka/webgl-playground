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
uniform vec2 u_mouse;
uniform float u_mouse_pressed;
uniform float u_time;

// パーティクルの数
#define NUM_PARTICLES 50

// ハッシュ関数（擬似乱数生成）
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// パーティクルの初期位置を生成
vec2 getInitialPosition(float id) {
  vec2 seed = vec2(id * 0.317, id * 0.241);
  return vec2(
    hash(seed) * u_resolution.x,
    hash(seed + 1.0) * u_resolution.y
  );
}

// パーティクルの初期速度を生成
vec2 getInitialVelocity(float id) {
  vec2 seed = vec2(id * 0.159, id * 0.731);
  float angle = hash(seed) * 6.28318;
  float speed = hash(seed + 1.0) * 50.0 + 10.0;
  return vec2(cos(angle), sin(angle)) * speed;
}

// パーティクルの位置と速度を計算
void getParticleState(float id, out vec2 pos, out vec2 vel) {
  vec2 initialPos = getInitialPosition(id);
  vec2 initialVel = getInitialVelocity(id);
  
  // 基本的な物理法則による移動
  float t = u_time;
  float dampening = exp(-t * 0.5); // 指数減衰
  
  // 基本移動（減衰を考慮）
  pos = initialPos + initialVel * t * dampening;
  vel = initialVel * dampening;
  
  // マウスの影響（現在の状態のみ）
  if (u_mouse_pressed > 0.5) {
    vec2 toMouse = u_mouse - pos;
    float dist = max(length(toMouse), 20.0);
    float attraction = 1000.0 / (dist + 50.0);
    
    // マウス方向への加速
    vec2 mouseForce = normalize(toMouse) * attraction;
    vel += mouseForce * 0.1;
    pos += mouseForce * 0.05;
  }
  
  // 時間による追加の動き（波のような効果）
  float wave = sin(t * 2.0 + id * 0.5) * 20.0;
  pos.x += wave * cos(id);
  pos.y += wave * sin(id);
  
  // 画面境界の処理
  if (pos.x < 0.0) {
    pos.x = u_resolution.x + pos.x;
  }
  if (pos.x > u_resolution.x) {
    pos.x = pos.x - u_resolution.x;
  }
  if (pos.y < 0.0) {
    pos.y = u_resolution.y + pos.y;
  }
  if (pos.y > u_resolution.y) {
    pos.y = pos.y - u_resolution.y;
  }
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec3 color = vec3(0.05, 0.05, 0.1); // 背景色
  
  // 各パーティクルを描画
  for (float i = 0.0; i < float(NUM_PARTICLES); i++) {
    vec2 particlePos, particleVel;
    getParticleState(i, particlePos, particleVel);
    
    float dist = distance(fragCoord, particlePos);
    float radius = 8.0 + sin(u_time * 2.0 + i * 0.5) * 2.0;
    
    if (dist < radius) {
      // パーティクルの色（速度に基づく）
      float speed = length(particleVel);
      vec3 particleColor = mix(
        vec3(0.2, 0.5, 1.0),
        vec3(1.0, 0.3, 0.2),
        clamp(speed / 100.0, 0.0, 1.0)
      );
      
      // ソフトなエッジ
      float alpha = 1.0 - smoothstep(radius * 0.3, radius, dist);
      color = mix(color, particleColor, alpha);
    }
  }
  
  // マウス位置の表示
  if (u_mouse_pressed > 0.5) {
    float mouseDist = distance(fragCoord, u_mouse);
    if (mouseDist < 15.0) {
      float alpha = 1.0 - smoothstep(5.0, 15.0, mouseDist);
      color = mix(color, vec3(1.0, 1.0, 0.5), alpha * 0.8);
    }
  }
  
  gl_FragColor = vec4(color, 1.0);
}
`;
