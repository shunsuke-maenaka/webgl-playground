import { useEffect } from "react";

/**
 * アプリケーション全体のスタイルを管理するカスタムフック
 * ルートコンテキストをビューポート固定にして全体スクロールを抑止
 */
export const useDocumentStyles = () => {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const rootEl = document.getElementById("root");

    // 現在のスタイルを保存
    const prevHtml = {
      width: html.style.width,
      height: html.style.height,
      overflow: html.style.overflow,
    };
    const prevBody = {
      width: body.style.width,
      height: body.style.height,
      margin: body.style.margin,
      overflow: body.style.overflow,
    };
    const prevRoot = rootEl
      ? {
          width: rootEl.style.width,
          height: rootEl.style.height,
          overflow: rootEl.style.overflow,
        }
      : null;

    // 新しいスタイルを適用
    html.style.width = "100vw";
    html.style.height = "100vh";
    html.style.overflow = "hidden";

    body.style.width = "100vw";
    body.style.height = "100vh";
    body.style.margin = "0";
    body.style.overflow = "hidden";

    if (rootEl) {
      rootEl.style.width = "100vw";
      rootEl.style.height = "100vh";
      rootEl.style.overflow = "hidden";
    }

    // クリーンアップ関数で元に戻す
    return () => {
      html.style.width = prevHtml.width;
      html.style.height = prevHtml.height;
      html.style.overflow = prevHtml.overflow;
      body.style.width = prevBody.width;
      body.style.height = prevBody.height;
      body.style.margin = prevBody.margin;
      body.style.overflow = prevBody.overflow;
      if (rootEl && prevRoot) {
        rootEl.style.width = prevRoot.width;
        rootEl.style.height = prevRoot.height;
        rootEl.style.overflow = prevRoot.overflow;
      }
    };
  }, []);
};
