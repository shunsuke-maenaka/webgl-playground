import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import {
  CANVAS_CONTAINER_STYLE,
  CANVAS_STYLE,
  FS_BUTTON_STYLE,
} from "../styles/constants";

interface WebGLCanvasProps {
  vertSrc: string; // 互換のため残置（GPGPUでは未使用）
  fragSrc: string; // 互換のため残置（GPGPUでは未使用）
  onCompileError: (error: string) => void;
  onCompileSuccess: () => void;
  numParticles?: number; // 粒子数（任意）
}

export interface WebGLCanvasRef {
  toggleFullscreen: () => void;
}

export const WebGLCanvas = forwardRef<WebGLCanvasRef, WebGLCanvasProps>(
  (
    { vertSrc, fragSrc, onCompileError, onCompileSuccess, numParticles = 80 },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);

    const glRef = useRef<WebGL2RenderingContext | null>(null);

    // ---- GPGPU: 状態テクスチャ & FBO（ping-pong） ----
    const texARef = useRef<WebGLTexture | null>(null);
    const texBRef = useRef<WebGLTexture | null>(null);
    const fboARef = useRef<WebGLFramebuffer | null>(null);
    const fboBRef = useRef<WebGLFramebuffer | null>(null);

    // ---- Programs ----
    const progUpdateRef = useRef<WebGLProgram | null>(null); // 更新パス
    const progDrawRef = useRef<WebGLProgram | null>(null); // 描画パス

    // ---- Geometry ----
    const triVboRef = useRef<WebGLBuffer | null>(null); // フルスクリーン三角形（更新パス用VS）
    const vaoPointsRef = useRef<WebGLVertexArrayObject | null>(null); // POINTS用（空VAOでOK）

    // ---- Uniform cache（軽量化のため必要最低限のみ） ----
    const uUpd = useRef<Record<string, WebGLUniformLocation | null>>({});
    const uDraw = useRef<Record<string, WebGLUniformLocation | null>>({});

    // 入力
    const uTimeRef = useRef<number>(0);
    const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const mousePressedRef = useRef<boolean>(false);

    // フルスクリーントグル
    const toggleFullscreen = () => {
      const el = wrapRef.current;
      if (!el) return;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
      }
    };
    useImperativeHandle(ref, () => ({ toggleFullscreen }), []);

    // ====== 内部シェーダ（固定） ======
    // 更新パス：フルスクリーン三角形VS（idはgl_FragCoord.xで決定）
    const UPDATE_VS = `#version 300 es
    layout(location=0) in vec2 position;
    void main(){
      gl_Position = vec4(position, 0.0, 1.0);
    }`;

    // 更新パス：状態更新FS（pos.xy|vel.xy -> 次フレーム）
    const UPDATE_FS = `#version 300 es
    precision highp float;
    uniform sampler2D u_stateTex; // RGBA32F: pos.xy | vel.xy
    uniform vec2 u_resolution;    // 画面サイズ（境界反射に使用）
    uniform vec2 u_mouse;
    uniform float u_mouse_pressed;
    uniform float u_dt;
    uniform float u_maxForce;     // 500.0
    uniform float u_forceDecay;   // 0.98（今回は未使用でも良い）
    uniform float u_velDamp;      // 0.999
    uniform float u_mouseInf;     // 300.0
    uniform float u_minDist;      // 20.0
    uniform int   u_numParticles;
    out vec4 outState;

    vec2 indexToUV(int id, int w){ return vec2((float(id)+0.5)/float(w), 0.5); }

    void main(){
      int id = int(gl_FragCoord.x - 0.5);
      if (id >= u_numParticles) { outState = vec4(0.0); return; }

      vec2 uv = indexToUV(id, u_numParticles);
      vec4 st = texture(u_stateTex, uv);
      vec2 pos = st.xy;
      vec2 vel = st.zw;

      // 押下中のみ力を与え、非押下時は速度減衰のみで安定化させる
      vec2 acc = vec2(0.0);
      if (u_mouse_pressed > 0.5) {
        vec2 d = u_mouse - pos;
        float d2 = dot(d,d);
        float invLen = inversesqrt(max(d2, u_minDist*u_minDist));
        float mag = min(u_mouseInf / (d2 + 1.0), u_maxForce);
        acc += d * invLen * mag;
      }

      // 1ステップのみ（全画素×粒子×1回に抑える）
      vel = vel * u_velDamp + acc * u_dt;
      pos += vel * u_dt;

      // 画面境界で反射（エネルギー損失）
      if (pos.x < 0.0) { pos.x = -pos.x; vel.x = -vel.x * 0.8; }
      if (pos.x > u_resolution.x){ pos.x = 2.0*u_resolution.x - pos.x; vel.x = -vel.x * 0.8; }
      if (pos.y < 0.0) { pos.y = -pos.y; vel.y = -vel.y * 0.8; }
      if (pos.y > u_resolution.y){ pos.y = 2.0*u_resolution.y - pos.y; vel.y = -vel.y * 0.8; }

      outState = vec4(pos, vel);
    }`;

    // 描画パス：インスタンスPOINTS（1頂点×NUMで打つ）
    const DRAW_VS = `#version 300 es
    precision highp float;
    uniform sampler2D u_stateTex;
    uniform int  u_numParticles;
    uniform vec2 u_resolution;
    uniform float u_baseRadius; // 6.0
    out float v_speed;

    vec2 indexToUV(int id,int w){ return vec2((float(id)+0.5)/float(w), 0.5); }

    void main(){
      int id = gl_InstanceID;
      vec4 st = texture(u_stateTex, indexToUV(id, u_numParticles));
      vec2 pos = st.xy;
      vec2 vel = st.zw;

      // 画面座標→NDC
      vec2 ndc = (pos / u_resolution) * 2.0 - 1.0;
      ndc.y = -ndc.y;

      v_speed = length(vel);
      gl_Position = vec4(ndc, 0.0, 1.0);
      gl_PointSize = u_baseRadius + clamp(v_speed/50.0, 0.0, 8.0);
    }`;

    const DRAW_FS = `#version 300 es
    precision mediump float;
    in float v_speed;
    out vec4 fragColor;
    void main(){
      vec2 p = gl_PointCoord*2.0 - 1.0;
      float r = length(p);
      if (r>1.0) discard;

      float alpha = 1.0 - smoothstep(0.6, 1.0, r);
      vec3 slow = vec3(0.3, 0.6, 1.0);
      vec3 fast = vec3(1.0, 0.4, 0.2);
      vec3 col  = mix(slow, fast, clamp(v_speed/200.0, 0.0, 1.0));
      col += (1.0 - smoothstep(0.0, 0.6, r)) * vec3(0.2,0.2,0.3);

      fragColor = vec4(col, alpha);
    }`;

    // ====== ユーティリティ ======
    const createProgram = (
      gl: WebGL2RenderingContext,
      vsSrc: string,
      fsSrc: string,
      attribLoc?: { [name: string]: number }
    ) => {
      const compile = (type: number, src: string) => {
        const sh = gl.createShader(type)!;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
          const log = gl.getShaderInfoLog(sh) || "";
          gl.deleteShader(sh);
          throw new Error(log);
        }
        return sh;
      };
      const prog = gl.createProgram();
      if (!prog) throw new Error("Program creation failed");
      const vs = compile(gl.VERTEX_SHADER, vsSrc);
      const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      if (attribLoc) {
        for (const k of Object.keys(attribLoc)) {
          gl.bindAttribLocation(prog, attribLoc[k], k);
        }
      }
      gl.linkProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(prog) || "";
        gl.deleteProgram(prog);
        throw new Error(log);
      }
      return prog;
    };

    const createFloatTex = (
      gl: WebGL2RenderingContext,
      data: Float32Array,
      w: number,
      h = 1
    ) => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        w,
        h,
        0,
        gl.RGBA,
        gl.FLOAT,
        data
      );
      return tex;
    };

    // ====== 初期化 ======
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const gl = canvas.getContext("webgl2", {
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: false,
        premultipliedAlpha: true,
      });
      if (!gl) {
        onCompileError("WebGL2 が必要です。");
        return;
      }
      glRef.current = gl;

      // 浮動小数レンダー可否（なぜ：状態をfloatで保持し、演算精度を確保するため）
      const extCBF = gl.getExtension("EXT_color_buffer_float");
      if (!extCBF) {
        onCompileError("EXT_color_buffer_float が必要です。");
        return;
      }

      // フルスクリーン三角形（なぜ：1枚の三角形で画面全体を覆い、更新FSを実行するため）
      const tri = new Float32Array([-1, -1, 3, -1, -1, 3]);
      const triVbo = gl.createBuffer();
      if (!triVbo) {
        onCompileError("VBO 作成に失敗");
        return;
      }
      triVboRef.current = triVbo;
      gl.bindBuffer(gl.ARRAY_BUFFER, triVbo);
      gl.bufferData(gl.ARRAY_BUFFER, tri, gl.STATIC_DRAW);

      // POINTS描画用の空VAO（なぜ：WebGL2はVAO必須。POINTSは頂点属性不要のため空で良い）
      const vao = gl.createVertexArray()!;
      vaoPointsRef.current = vao;

      // 画面サイズに合わせてバックバッファ更新（なぜ：反射境界とNDC変換のため）
      const resizeBackbuffer = () => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const dpr = 1; // 必要なら window.devicePixelRatio
        const w = Math.max(1, Math.round(wrap.clientWidth * dpr));
        const h = Math.max(1, Math.round(wrap.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
        }
      };
      const onViewport = () => requestAnimationFrame(resizeBackbuffer);
      window.addEventListener("resize", onViewport);
      document.addEventListener("fullscreenchange", onViewport);
      onViewport();

      // 入力
      const onMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const dpr = 1;
        mouseRef.current = {
          x: (e.clientX - rect.left) * dpr,
          y: (rect.bottom - e.clientY) * dpr,
        };
      };
      const onMouseDown = () => (mousePressedRef.current = true);
      const onMouseUp = () => (mousePressedRef.current = false);
      canvas.addEventListener("mousemove", onMouseMove);
      canvas.addEventListener("mousedown", onMouseDown);
      canvas.addEventListener("mouseup", onMouseUp);
      canvas.addEventListener("mouseleave", onMouseUp);

      const onKey = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          toggleFullscreen();
        }
      };
      window.addEventListener("keydown", onKey);

      // ---- 状態初期化（なぜ：毎フレームの乱数生成を排除し、安定と高速化を両立） ----
      const initState = () => {
        const w = canvas.width || 1024;
        const h = canvas.height || 768;
        const N = numParticles;
        const arr = new Float32Array(N * 4);
        for (let i = 0; i < N; i++) {
          // pos: 画面内に一様分布
          arr[i * 4 + 0] = Math.random() * w;
          arr[i * 4 + 1] = Math.random() * h;
          // vel: 方向ランダム・大きさ10..60
          const ang = Math.random() * Math.PI * 2;
          const mag = 10 + Math.random() * 50;
          arr[i * 4 + 2] = Math.cos(ang) * mag;
          arr[i * 4 + 3] = Math.sin(ang) * mag;
        }
        return arr;
      };

      // テクスチャ & FBO
      const stateA = createFloatTex(gl, initState(), numParticles, 1);
      const stateB = createFloatTex(
        gl,
        new Float32Array(numParticles * 4),
        numParticles,
        1
      );
      texARef.current = stateA;
      texBRef.current = stateB;

      const fboA = gl.createFramebuffer()!;
      const fboB = gl.createFramebuffer()!;
      fboARef.current = fboA;
      fboBRef.current = fboB;

      gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        stateA,
        0
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        stateB,
        0
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // ---- Program 構築 ----
      let compileOk = false;
      try {
        // 更新パス
        const pUpd = createProgram(gl, UPDATE_VS, UPDATE_FS, { position: 0 });
        progUpdateRef.current = pUpd;
        gl.useProgram(pUpd);
        // 位置属性を有効化（フルスクリーン三角形）
        gl.bindBuffer(gl.ARRAY_BUFFER, triVboRef.current);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        // Uniform location cache
        uUpd.current = {
          u_stateTex: gl.getUniformLocation(pUpd, "u_stateTex"),
          u_resolution: gl.getUniformLocation(pUpd, "u_resolution"),
          u_mouse: gl.getUniformLocation(pUpd, "u_mouse"),
          u_mouse_pressed: gl.getUniformLocation(pUpd, "u_mouse_pressed"),
          u_dt: gl.getUniformLocation(pUpd, "u_dt"),
          u_maxForce: gl.getUniformLocation(pUpd, "u_maxForce"),
          u_forceDecay: gl.getUniformLocation(pUpd, "u_forceDecay"),
          u_velDamp: gl.getUniformLocation(pUpd, "u_velDamp"),
          u_mouseInf: gl.getUniformLocation(pUpd, "u_mouseInf"),
          u_minDist: gl.getUniformLocation(pUpd, "u_minDist"),
          u_numParticles: gl.getUniformLocation(pUpd, "u_numParticles"),
        };

        // 描画パス
        const pDraw = createProgram(gl, DRAW_VS, DRAW_FS);
        progDrawRef.current = pDraw;
        gl.useProgram(pDraw);
        uDraw.current = {
          u_stateTex: gl.getUniformLocation(pDraw, "u_stateTex"),
          u_resolution: gl.getUniformLocation(pDraw, "u_resolution"),
          u_numParticles: gl.getUniformLocation(pDraw, "u_numParticles"),
          u_baseRadius: gl.getUniformLocation(pDraw, "u_baseRadius"),
        };

        compileOk = true;
      } catch (e) {
        onCompileError(String(e));
      }
      if (compileOk) onCompileSuccess();

      // ====== ループ ======
      let ping = true;
      let last = performance.now();

      const tick = (t: number) => {
        rafRef.current = requestAnimationFrame(tick);
        const gl = glRef.current!;
        const canvas = canvasRef.current!;
        const w = canvas.width;
        const h = canvas.height;

        // dt を抑制（なぜ：タブ復帰などで暴れるのを防ぐ）
        const dt = Math.min((t - last) / 1000, 1 / 30);
        last = t;
        uTimeRef.current += dt;

        // ---- 更新パス ----
        gl.useProgram(progUpdateRef.current);
        // 入力テクスチャ（pingの反対側）
        const texIn = ping ? texARef.current! : texBRef.current!;
        const fboOut = ping ? fboBRef.current! : fboARef.current!;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texIn);
        gl.uniform1i(uUpd.current.u_stateTex, 0);

        // 統一パラメータ
        gl.uniform2f(uUpd.current.u_resolution, w, h);
        gl.uniform2f(
          uUpd.current.u_mouse,
          mouseRef.current.x,
          mouseRef.current.y
        );
        gl.uniform1f(
          uUpd.current.u_mouse_pressed,
          mousePressedRef.current ? 1.0 : 0.0
        );
        gl.uniform1f(uUpd.current.u_dt, dt);
        gl.uniform1f(uUpd.current.u_maxForce, 500.0);
        gl.uniform1f(uUpd.current.u_forceDecay, 0.98);
        gl.uniform1f(uUpd.current.u_velDamp, 0.999);
        gl.uniform1f(uUpd.current.u_mouseInf, 300.0);
        gl.uniform1f(uUpd.current.u_minDist, 20.0);
        gl.uniform1i(uUpd.current.u_numParticles, numParticles);

        // FBOへ書き出し（サイズ＝粒子×1）
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboOut);
        gl.viewport(0, 0, numParticles, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // ---- 描画パス ----
        gl.useProgram(progDrawRef.current);
        const texState = ping ? texBRef.current! : texARef.current!; // 直前に書いた側
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texState);
        gl.uniform1i(uDraw.current.u_stateTex, 0);
        gl.uniform2f(uDraw.current.u_resolution, w, h);
        gl.uniform1i(uDraw.current.u_numParticles, numParticles);
        gl.uniform1f(uDraw.current.u_baseRadius, 6.0);

        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindVertexArray(vaoPointsRef.current);
        gl.drawArraysInstanced(gl.POINTS, 0, 1, numParticles);
        gl.bindVertexArray(null);

        // 次フレームは入出力をスワップ（なぜ：ping-pongで最新状態を交互に保持）
        ping = !ping;
      };

      const onVis = () => {
        if (document.hidden) {
          if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        } else {
          if (rafRef.current == null)
            rafRef.current = requestAnimationFrame(tick);
        }
      };
      document.addEventListener("visibilitychange", onVis);

      // 起動
      rafRef.current = requestAnimationFrame(tick);

      // ====== クリーンアップ ======
      return () => {
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("resize", onViewport);
        document.removeEventListener("fullscreenchange", onViewport);

        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("mousedown", onMouseDown);
        canvas.removeEventListener("mouseup", onMouseUp);
        canvas.removeEventListener("mouseleave", onMouseUp);
        window.removeEventListener("keydown", onKey);

        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

        const gl = glRef.current;
        if (!gl) return;
        if (progUpdateRef.current) gl.deleteProgram(progUpdateRef.current);
        if (progDrawRef.current) gl.deleteProgram(progDrawRef.current);
        if (triVboRef.current) gl.deleteBuffer(triVboRef.current);
        if (vaoPointsRef.current) gl.deleteVertexArray(vaoPointsRef.current);
        if (texARef.current) gl.deleteTexture(texARef.current);
        if (texBRef.current) gl.deleteTexture(texBRef.current);
        if (fboARef.current) gl.deleteFramebuffer(fboARef.current);
        if (fboBRef.current) gl.deleteFramebuffer(fboBRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [numParticles]); // 粒子数が変わると再初期化

    // フルスクリーンボタン（DOM APIの都合で毎回参照）
    const isFullscreen = !!document.fullscreenElement;

    return (
      <div style={CANVAS_CONTAINER_STYLE}>
        <div ref={wrapRef} style={{ width: "100%", height: "100%" }}>
          <canvas ref={canvasRef} style={CANVAS_STYLE} />
        </div>
        <button
          type="button"
          aria-label={
            isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"
          }
          title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
          onClick={toggleFullscreen}
          style={FS_BUTTON_STYLE}
        >
          {isFullscreen ? "Exit FS" : "Fullscreen"}
        </button>
      </div>
    );
  }
);
