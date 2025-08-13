import React from "react";
import {
  PANEL_GRID_STYLE,
  TEXTAREA_LABEL_STYLE,
  TEXTAREA_STYLE,
} from "../styles/constants";

interface ShaderEditorProps {
  vertSrc: string;
  fragSrc: string;
  onVertSrcChange: (value: string) => void;
  onFragSrcChange: (value: string) => void;
}

export const ShaderEditor: React.FC<ShaderEditorProps> = ({
  vertSrc,
  fragSrc,
  onVertSrcChange,
  onFragSrcChange,
}) => {
  return (
    <div style={PANEL_GRID_STYLE}>
      <div>
        <div style={TEXTAREA_LABEL_STYLE}>Vertex Shader</div>
        <textarea
          spellCheck={false}
          style={TEXTAREA_STYLE}
          value={vertSrc}
          onChange={(e) => onVertSrcChange(e.target.value)}
        />
      </div>
      <div>
        <div style={TEXTAREA_LABEL_STYLE}>Fragment Shader</div>
        <textarea
          spellCheck={false}
          style={TEXTAREA_STYLE}
          value={fragSrc}
          onChange={(e) => onFragSrcChange(e.target.value)}
        />
      </div>
    </div>
  );
};
