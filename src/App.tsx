/**
 * WebGL ライブ編集対応キャンバス（React + Vite + TypeScript）
 * - 頂点/フラグメントシェーダを Textarea からライブ編集。
 * - ルートを vw/vh 固定にして全体スクロールを抑止（Textareaのみスクロール可）。
 * - DPR は一旦 1 に固定（必要ならオプション化）。
 * - 追加: ボタン/キーボード(F)でフルスクリーンをトグル。
 */

import { useState, useRef } from "react";
import {
  Header,
  WebGLCanvas,
  type WebGLCanvasRef,
  SingleShaderEditor,
  CompileLog,
} from "./components";
import { useDocumentStyles } from "./hooks/useDocumentStyles";
import {
  DEFAULT_VERTEX_SHADER,
  DEFAULT_FRAGMENT_SHADER,
} from "./constants/shaders";
import {
  ROOT_STYLE,
  SECTION_PAD_STYLE,
  THREE_COLUMN_GRID_STYLE,
} from "./styles/constants";

export default function WebGLCanvasApp() {
  const canvasRef = useRef<WebGLCanvasRef>(null);

  // ドキュメント全体のスタイルを設定
  useDocumentStyles();

  // シェーダソースコードの状態管理
  const [vertSrc, setVertSrc] = useState<string>(DEFAULT_VERTEX_SHADER);
  const [fragSrc, setFragSrc] = useState<string>(DEFAULT_FRAGMENT_SHADER);
  const [compileLog, setCompileLog] = useState<string>("");

  // コンパイルエラー時のコールバック
  const handleCompileError = (error: string) => {
    setCompileLog(error);
  };

  // コンパイル成功時のコールバック
  const handleCompileSuccess = () => {
    setCompileLog("");
  };

  return (
    <div style={ROOT_STYLE}>
      <Header />

      <div style={SECTION_PAD_STYLE}>
        <WebGLCanvas
          ref={canvasRef}
          vertSrc={vertSrc}
          fragSrc={fragSrc}
          onCompileError={handleCompileError}
          onCompileSuccess={handleCompileSuccess}
        />
      </div>

      <div style={THREE_COLUMN_GRID_STYLE}>
        <SingleShaderEditor
          label="Vertex Shader"
          value={vertSrc}
          onChange={setVertSrc}
        />
        <SingleShaderEditor
          label="Fragment Shader"
          value={fragSrc}
          onChange={setFragSrc}
        />
        <CompileLog compileLog={compileLog} />
      </div>
    </div>
  );
}
