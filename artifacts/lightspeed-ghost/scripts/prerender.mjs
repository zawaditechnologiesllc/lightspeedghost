// Injects the build-time pre-rendered landing HTML into the client index.html
// so the hero paints from the document itself (fast FCP/LCP on mobile) instead
// of waiting for the JS to download and execute. Fails loudly so a broken
// pre-render aborts the build rather than shipping an empty shell.
import { readFileSync, writeFileSync } from "node:fs";

const HTML = "dist/public/index.html";
const ROOT = '<div id="root"></div>';

const { render } = await import("../dist/prerender/prerender.js");
const appHtml = render();

if (!appHtml || appHtml.length < 1000) {
  throw new Error(`prerender: render() returned suspiciously small output (${appHtml?.length ?? 0} chars)`);
}

let html = readFileSync(HTML, "utf8");
if (!html.includes(ROOT)) {
  throw new Error(`prerender: could not find empty ${ROOT} in ${HTML}`);
}

html = html.replace(ROOT, `<div id="root">${appHtml}</div>`);
writeFileSync(HTML, html);
console.log(`prerender: injected ${appHtml.length.toLocaleString()} chars of landing HTML into #root`);
