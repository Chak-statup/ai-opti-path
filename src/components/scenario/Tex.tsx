import katex from "katex";
import { useMemo } from "react";

export function Tex({ children, block = false }: { children: string; block?: boolean }) {
  const html = useMemo(
    () =>
      katex.renderToString(children, {
        displayMode: block,
        throwOnError: false,
      }),
    [children, block],
  );
  return (
    <span
      className={block ? "exp-tex-block" : "exp-tex-inline"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
