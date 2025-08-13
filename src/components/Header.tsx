import React from "react";
import { HEADER_STYLE } from "../styles/constants";

interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = "WebGL Canvas App (React + Vite + TypeScript) — ライブシェーダ編集",
}) => {
  return <header style={HEADER_STYLE}>{title}</header>;
};
