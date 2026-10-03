// Turns src/index.html into one data URI. Run: node build.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { minify } from "terser";

const LIMIT = 3072;
let html = readFileSync("src/index.html", "utf8");

function glsl(code) {
  return code
    .replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([-+*\/=<>(){}\[\];,!&|?:])\s*/g, "$1")
    .trim();
}

// 1. Minify JavaScript inside <script> tags
const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
const scriptMatches = [...html.matchAll(scriptRegex)];

for (const match of scriptMatches) {
  const rawJs = match[1].replace(/glsl`([^`]*)`/g, (_, s) => JSON.stringify(glsl(s)));
  
  // Disable toplevel mangling or reserve 't' so Terser doesn't remove it as dead code
  const minified = await minify(rawJs, { 
    toplevel: false, 
    compress: { passes: 3 } 
  });
  
  if (minified.error) {
    console.error("Terser Error:", minified.error);
  }

  const minifiedCode = minified.code || rawJs;
  html = html.replace(match[0], `<script>${minifiedCode}</script>`);
}

// 2. Minify CSS inside <style> tags
html = html.replace(/<style>([\s\S]*?)<\/style>/gi, (_, css) => {
  return `<style>${css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};:,>])\s*/g, "$1").replace(/;}/g, "}")}</style>`;
});

// 3. Minify HTML structure
html = html
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/>\s+</g, "><")
  .trim();

// 4. Create Data URI
const uri = "data:text/html," + html.replace(/%/g, "%25").replace(/#/g, "%23").replace(/\n/g, "%0A");

mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", html);
writeFileSync("dist/uri.txt", uri);

const bytes = Buffer.byteLength(uri);
console.log(bytes + " / " + LIMIT + " bytes, " + (bytes > LIMIT ? bytes - LIMIT + " over" : LIMIT - bytes + " left"));