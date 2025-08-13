import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import {
  CANVAS_CONTAINER_STYLE,
  CANVAS_STYLE,
  FS_BUTTON_STYLE,
} from "../styles/constants";

interface WebGLCanvasProps {
  vertSrc: string;
  fragSrc: string;
  onCompileError: (error: string) => void;
  onCompileSuccess: () => void;
}

export interface WebGLCanvasRef {
  toggleFullscreen: () => void;
}

export const WebGLCanvas = forwardRef<WebGLCanvasRef, WebGLCanvasProps>(
  ({ vertSrc, fragSrc, onCompileError, onCompileSuccess }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const glRef = useRef<WebGLRenderingContext | null>(null);
    const programRef = useRef<WebGLProgram | null>(null);
    const vboRef = useRef<WebGLBuffer | null>(null);
    const uResolutionRef = useRef<WebGLUniformLocation | null>(null);
    const uTimeRef = useRef<WebGLUniformLocation | null>(null);
    const uMouseRef = useRef<WebGLUniformLocation | null>(null);
    const uMousePressedRef = useRef<WebGLUniformLocation | null>(null);
    const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const mousePressedRef = useRef<boolean>(false);

    // フルスクリーントグル関数
    const toggleFullscreen = () => {
      const el = wrapRef.current;
      if (!el) return;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        el.requestFullscreen({ navigationUI: "hide" as any }).catch(() => {});
      }
    };

    // 外部からアクセス可能な関数を公開
    useImperativeHandle(ref, () => ({
      toggleFullscreen,
    }));

    // 初期化（1回だけ）
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const gl = canvas.getContext("webgl", {
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: false,
        premultipliedAlpha: true,
      });
      if (!gl) {
        console.error("WebGL がサポートされていません。");
        return;
      }
      glRef.current = gl;

      // フルスクリーン三角形のVBO
      const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
      const vbo = gl.createBuffer();
      if (!vbo) throw new Error("VBO 作成に失敗");
      vboRef.current = vbo;
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      const resizeBackbuffer = () => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const dpr = 1; // まずは固定
        const w = Math.max(1, Math.round(wrap.clientWidth * dpr));
        const h = Math.max(1, Math.round(wrap.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
          if (uResolutionRef.current)
            gl.uniform2f(uResolutionRef.current, w, h);
        }
      };

      const onViewport = () => requestAnimationFrame(resizeBackbuffer);
      window.addEventListener("resize", onViewport);
      document.addEventListener("fullscreenchange", onViewport);
      onViewport();

      // キーボードでフルスクリーン切替（F キー）
      const onKey = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          toggleFullscreen();
        }
      };
      window.addEventListener("keydown", onKey);

      // マウス座標の追跡
      const onMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const dpr = 1; // DPRに合わせる
        mouseRef.current = {
          x: (e.clientX - rect.left) * dpr,
          y: (rect.bottom - e.clientY) * dpr, // Y座標を反転（WebGLの座標系に合わせる）
        };
      };
      canvas.addEventListener("mousemove", onMouseMove);

      // マウスボタンの追跡
      const onMouseDown = () => {
        mousePressedRef.current = true;
      };
      const onMouseUp = () => {
        mousePressedRef.current = false;
      };
      canvas.addEventListener("mousedown", onMouseDown);
      canvas.addEventListener("mouseup", onMouseUp);
      canvas.addEventListener("mouseleave", onMouseUp); // マウスがキャンバスを離れた時も放す

      let start = performance.now();
      const tick = (t: number) => {
        rafRef.current = requestAnimationFrame(tick);
        const sec = (t - start) / 1000;
        if (uTimeRef.current) gl.uniform1f(uTimeRef.current, sec);
        if (uMouseRef.current) {
          gl.uniform2f(
            uMouseRef.current,
            mouseRef.current.x,
            mouseRef.current.y
          );
        }
        if (uMousePressedRef.current) {
          gl.uniform1f(
            uMousePressedRef.current,
            mousePressedRef.current ? 1.0 : 0.0
          );
        }
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
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
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        document.removeEventListener("visibilitychange", onVis);
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        window.removeEventListener("resize", onViewport);
        window.removeEventListener("keydown", onKey);
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("mousedown", onMouseDown);
        canvas.removeEventListener("mouseup", onMouseUp);
        canvas.removeEventListener("mouseleave", onMouseUp);
        document.removeEventListener("fullscreenchange", onViewport);

        if (programRef.current) gl.deleteProgram(programRef.current);
        if (vboRef.current) gl.deleteBuffer(vboRef.current);
      };
    }, []);

    // シェーダのコンパイル&リンク（vertSrc/fragSrc が変わるたび）
    useEffect(() => {
      const gl = glRef.current;
      const vbo = vboRef.current;
      const canvas = canvasRef.current;
      if (!gl || !vbo || !canvas) return;

      const compile = (type: number, src: string) => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const log = gl.getShaderInfoLog(shader) || "";
          gl.deleteShader(shader);
          throw new Error(log);
        }
        return shader;
      };

      try {
        onCompileSuccess();
        const program = gl.createProgram();
        if (!program) throw new Error("Program 作成に失敗");

        const vs = compile(gl.VERTEX_SHADER, vertSrc);
        const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          const log = gl.getProgramInfoLog(program) || "";
          gl.deleteProgram(program);
          throw new Error(log);
        }

        if (programRef.current) gl.deleteProgram(programRef.current);
        programRef.current = program;

        gl.useProgram(program);

        const loc = gl.getAttribLocation(program, "position");
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        uResolutionRef.current = gl.getUniformLocation(program, "u_resolution");
        uTimeRef.current = gl.getUniformLocation(program, "u_time");
        uMouseRef.current = gl.getUniformLocation(program, "u_mouse");
        uMousePressedRef.current = gl.getUniformLocation(
          program,
          "u_mouse_pressed"
        );

        const w = canvas.width;
        const h = canvas.height;
        if (uResolutionRef.current) gl.uniform2f(uResolutionRef.current, w, h);
        if (uMouseRef.current) {
          gl.uniform2f(
            uMouseRef.current,
            mouseRef.current.x,
            mouseRef.current.y
          );
        }
        if (uMousePressedRef.current) {
          gl.uniform1f(
            uMousePressedRef.current,
            mousePressedRef.current ? 1.0 : 0.0
          );
        }
      } catch (e) {
        onCompileError(String(e));
      }
    }, [vertSrc, fragSrc, onCompileError, onCompileSuccess]);

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
