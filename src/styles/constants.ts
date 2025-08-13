/**
 * アプリケーション全体で使用するスタイル定数
 */

export const ROOT_STYLE: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  backgroundColor: "#111",
  color: "white",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxSizing: "border-box",
  contain: "layout paint size",
};

export const HEADER_STYLE: React.CSSProperties = {
  padding: "1rem",
  fontSize: "0.875rem",
  opacity: 0.9,
  flex: "0 0 auto",
};

export const SECTION_PAD_STYLE: React.CSSProperties = {
  padding: "1rem",
  flex: "0 0 auto",
};

export const CANVAS_CONTAINER_STYLE: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "50vh",
};

export const CANVAS_STYLE: React.CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
  outline: "1px solid rgba(255,255,255,0.1)",
  display: "block",
};

export const FS_BUTTON_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  background: "rgba(0,0,0,0.5)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
  userSelect: "none",
};

export const PANEL_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.75rem",
  padding: "1rem",
  flex: "0 0 auto",
};

export const TEXTAREA_LABEL_STYLE: React.CSSProperties = {
  marginBottom: "0.5rem",
  opacity: 0.85,
};

export const TEXTAREA_STYLE: React.CSSProperties = {
  width: "100%",
  height: "240px",
  background: "#0d0d0d",
  color: "#d8d8d8",
  border: "1px solid #333",
  borderRadius: "8px",
  padding: "0.75rem",
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  fontSize: "12px",
  lineHeight: 1.5,
  outline: "none",
  resize: "vertical",
  overflow: "auto",
  boxSizing: "border-box",
};

export const FOOT_GRID_STYLE: React.CSSProperties = {
  padding: "0 1rem 1rem",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.75rem",
  flex: "0 0 auto",
};

export const THREE_COLUMN_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 2fr 1fr",
  gap: "0.75rem",
  padding: "1rem",
  flex: "0 0 auto",
};

export const SHADER_COLUMN_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

export const COMPILE_LOG_COLUMN_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

export const LOG_STYLE_OK: React.CSSProperties = {
  margin: 0,
  whiteSpace: "pre-wrap",
  background: "#1a1a1a",
  color: "#a0e8a0",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.75rem",
  minHeight: 60,
  boxSizing: "border-box",
  flex: "1",
  overflow: "auto",
};

export const LOG_STYLE_ERR: React.CSSProperties = {
  ...LOG_STYLE_OK,
  color: "#ffb4b4",
};
