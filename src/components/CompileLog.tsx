import React from "react";
import {
  LOG_STYLE_OK,
  LOG_STYLE_ERR,
  COMPILE_LOG_COLUMN_STYLE,
  TEXTAREA_LABEL_STYLE,
} from "../styles/constants";

interface CompileLogProps {
  compileLog: string;
}

export const CompileLog: React.FC<CompileLogProps> = ({ compileLog }) => {
  const logStyle = compileLog ? LOG_STYLE_ERR : LOG_STYLE_OK;

  return (
    <div style={COMPILE_LOG_COLUMN_STYLE}>
      <div style={TEXTAREA_LABEL_STYLE}>Compile Log</div>
      <pre style={logStyle}>{compileLog || "Compiled successfully"}</pre>
    </div>
  );
};
