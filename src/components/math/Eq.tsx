import katex from "katex";

/** Render a TeX string with KaTeX. SSR-safe (renderToString runs in Node). */
export function Eq({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    output: "html",
  });
  return (
    <span
      className={display ? "block overflow-x-auto py-1" : "inline"}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
