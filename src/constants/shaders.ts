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
#define NUM_PARTICLES 80

// シミュレーション定数
#define MAX_FORCE 500.0        // 最大加速度
#define FORCE_DECAY 0.98       // 加速度減衰率（マウス非押下時）
#define VELOCITY_DAMPING 0.999 // 速度減衰
#define MOUSE_INFLUENCE 300.0  // マウスの影響力
#define MIN_DISTANCE 20.0      // マウスからの最小距離

// ハッシュ関数（擬似乱数生成）
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// 2D回転行列
mat2 rotate(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

// パーティクルの初期位置を生成
vec2 getInitialPosition(float id) {
  vec2 seed = vec2(id * 0.317, id * 0.241);
  return vec2(
    hash(seed) * u_resolution.x,
    hash(seed + 1.0) * u_resolution.y
  );
}

// パーティクルの初期加速度を生成
vec2 getInitialAcceleration(float id) {
  vec2 seed = vec2(id * 0.159, id * 0.731);
  float angle = hash(seed) * 6.28318;
  float magnitude = hash(seed + 1.0) * 50.0 + 10.0;
  return vec2(cos(angle), sin(angle)) * magnitude;
}

// オイラー積分による物理シミュレーション
void simulateParticle(float id, out vec2 pos, out vec2 vel, out vec2 acc) {
  vec2 initialPos = getInitialPosition(id);
  vec2 initialAcc = getInitialAcceleration(id);
  
  // 初期状態
  pos = initialPos;
  vel = vec2(0.0);
  acc = initialAcc;
  
  // タイムステップ
  float dt = 0.016; // 約60FPS相当
  float timeSteps = u_time / dt;
  int maxSteps = int(timeSteps);
  
  // 物理シミュレーションループ
  for (int step = 0; step < 1000; step++) {
    if (step >= maxSteps) break;
    
    float currentTime = float(step) * dt;
    
    // マウスの影響を計算
    vec2 mouseForce = vec2(0.0);
    
    // 過去のマウス押下状態をシミュレート（簡易版）
    // 実際には前フレームの状態を保存する必要があるが、
    // ここでは現在の状態を使用
    if (u_mouse_pressed > 0.5) {
      vec2 toMouse = u_mouse - pos;
      float distance = max(length(toMouse), MIN_DISTANCE);
      
      // 距離による減衰（逆二乗則）
      float forceMagnitude = MOUSE_INFLUENCE / (distance * distance + 1.0);
      forceMagnitude = min(forceMagnitude, MAX_FORCE);
      
      mouseForce = normalize(toMouse) * forceMagnitude;
      
      // 加速度にマウスの力を追加
      acc += mouseForce;
    } else {
      // マウスが押下されていない時は加速度を減衰
      acc *= FORCE_DECAY;
    }
    
    // 位置と速度の更新（オイラー積分）
    vel += acc * dt;
    vel *= VELOCITY_DAMPING; // 速度減衰
    pos += vel * dt;
    
    // 画面境界での反射
    if (pos.x < 0.0) {
      pos.x = -pos.x;
      vel.x = -vel.x * 0.8; // エネルギー損失
    }
    if (pos.x > u_resolution.x) {
      pos.x = 2.0 * u_resolution.x - pos.x;
      vel.x = -vel.x * 0.8;
    }
    if (pos.y < 0.0) {
      pos.y = -pos.y;
      vel.y = -vel.y * 0.8;
    }
    if (pos.y > u_resolution.y) {
      pos.y = 2.0 * u_resolution.y - pos.y;
      vel.y = -vel.y * 0.8;
    }
    
    // 加速度の大きさを制限
    float accMagnitude = length(acc);
    if (accMagnitude > MAX_FORCE) {
      acc = normalize(acc) * MAX_FORCE;
    }
  }
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec3 color = vec3(0.02, 0.05, 0.15); // 深い青の背景
  
  // 各パーティクルを描画
  for (float i = 0.0; i < float(NUM_PARTICLES); i++) {
    vec2 particlePos, particleVel, particleAcc;
    simulateParticle(i, particlePos, particleVel, particleAcc);
    
    float dist = distance(fragCoord, particlePos);
    
    // パーティクルサイズ（加速度に応じて変化）
    float accMagnitude = length(particleAcc);
    float radius = 6.0 + clamp(accMagnitude / 50.0, 0.0, 8.0);
    
    if (dist < radius) {
      // パーティクルの色（速度と加速度に基づく）
      float speed = length(particleVel);
      float acceleration = length(particleAcc);
      
      // ベースカラー（速度による）
      vec3 baseColor = mix(
        vec3(0.3, 0.6, 1.0),    // 低速：青
        vec3(1.0, 0.4, 0.2),    // 高速：赤
        clamp(speed / 200.0, 0.0, 1.0)
      );
      
      // 加速度による白いハイライト
      vec3 accColor = vec3(1.0, 1.0, 0.8);
      float accFactor = clamp(acceleration / 100.0, 0.0, 1.0);
      
      vec3 particleColor = mix(baseColor, accColor, accFactor * 0.6);
      
      // ソフトなエッジエフェクト
      float alpha = 1.0 - smoothstep(radius * 0.4, radius, dist);
      
      // 中心部をより明るく
      float centerGlow = 1.0 - smoothstep(0.0, radius * 0.6, dist);
      particleColor += centerGlow * vec3(0.2, 0.2, 0.3);
      
      color = mix(color, particleColor, alpha);
    }
    
    // パーティクルの軌跡エフェクト
    if (length(particleVel) > 10.0) {
      vec2 trailDir = normalize(particleVel);
      float trailLength = min(length(particleVel) * 0.5, 30.0);
      
      for (float t = 1.0; t <= 10.0; t += 1.0) {
        vec2 trailPos = particlePos - trailDir * (t * trailLength / 10.0);
        float trailDist = distance(fragCoord, trailPos);
        float trailRadius = radius * (1.0 - t / 10.0) * 0.5;
        
        if (trailDist < trailRadius) {
          float trailAlpha = (1.0 - t / 10.0) * 0.3 * (1.0 - smoothstep(0.0, trailRadius, trailDist));
          color = mix(color, vec3(0.8, 0.9, 1.0), trailAlpha);
        }
      }
    }
  }
  
  // マウス位置とその影響範囲の表示
  if (u_mouse_pressed > 0.5) {
    float mouseDist = distance(fragCoord, u_mouse);
    
    // マウスカーソル
    if (mouseDist < 12.0) {
      float alpha = 1.0 - smoothstep(8.0, 12.0, mouseDist);
      color = mix(color, vec3(1.0, 1.0, 0.6), alpha);
    }
    
    // 影響範囲の可視化
    float influenceRadius = sqrt(MOUSE_INFLUENCE);
    if (mouseDist > influenceRadius - 3.0 && mouseDist < influenceRadius + 3.0) {
      float ringAlpha = 0.3 * (1.0 - abs(mouseDist - influenceRadius) / 3.0);
      color = mix(color, vec3(1.0, 1.0, 0.0), ringAlpha);
    }
  }
  
  gl_FragColor = vec4(color, 1.0);
}
`;