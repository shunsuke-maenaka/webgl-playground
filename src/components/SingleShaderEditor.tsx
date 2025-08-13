import React from "react";
import {
  TEXTAREA_LABEL_STYLE,
  TEXTAREA_STYLE,
  SHADER_COLUMN_STYLE,
} from "../styles/constants";

interface SingleShaderEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export const SingleShaderEditor: React.FC<SingleShaderEditorProps> = ({
  label,
  value,
  onChange,
}) => {
  return (
    <div style={SHADER_COLUMN_STYLE}>
      <div style={TEXTAREA_LABEL_STYLE}>{label}</div>
      <textarea
        spellCheck={false}
        style={TEXTAREA_STYLE}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};
