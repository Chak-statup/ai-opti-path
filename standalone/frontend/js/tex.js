// tex.js — KaTeX render helper (uses the global katex loaded via CDN).
export function tex(str, block = false) {
  if (typeof window !== "undefined" && window.katex) {
    return window.katex.renderToString(str, { displayMode: block, throwOnError: false });
  }
  return `<span class="exp-tex">${str}</span>`;
}
