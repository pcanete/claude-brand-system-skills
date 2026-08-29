#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function list(items) {
  return (items || []).map((item) => `<li>${esc(item)}</li>`).join("");
}

function buildDocument(content, blueprint) {
  const approval = blueprint.approval || { status: "draft" };
  const pages = Object.entries(blueprint.pages || {}).map(([pageId, page]) => {
    const sourcePage = content.pages?.[page.content_page];
    if (!sourcePage) throw new Error(`Blueprint page ${pageId} points to missing content page ${page.content_page}.`);
    const sourceSections = new Map((sourcePage.sections || []).map((section) => [section.id, section]));
    const sections = (page.sections || []).map((section, index) => {
      const source = sourceSections.get(section.content_section);
      if (!source) throw new Error(`${pageId}.${section.id} points to missing content section ${section.content_section}.`);
      const patterns = (section.reference_patterns || []).map((pattern) => pattern.style_path).join(" / ");
      return `<article class="section"><span>${String(index + 1).padStart(2, "0")}</span><div><h3>${esc(section.id)}</h3><p>${esc(section.role)}</p><dl><dt>Contenido</dt><dd>${esc(section.content_section)} / ${esc(source.type)}</dd><dt>Componente</dt><dd>${esc(section.component?.family)} / ${esc(section.component?.variant)}</dd><dt>Referencia</dt><dd>${esc(patterns || "Sin patrón declarado")}</dd><dt>Desktop</dt><dd>${esc(section.responsive?.desktop?.layout_intent)}</dd><dt>Mobile</dt><dd>${esc(section.responsive?.mobile?.layout_intent)}</dd></dl><details><summary>Composición y aceptación</summary><p>${esc(section.composition?.dominant_mass)}</p><ul>${list(section.acceptance?.visual)}${list(section.acceptance?.content)}${list(section.acceptance?.responsive)}${list(section.acceptance?.behavior)}</ul></details></div></article>`;
    }).join("");
    return `<section class="page"><header><span>Ruta ${esc(page.route)}</span><h2>${esc(pageId)}</h2><p>${esc(page.purpose)}</p></header><div class="path">${(page.reading_path || []).map((item) => `<b>${esc(item)}</b>`).join("<i>→</i>")}</div>${sections}<aside><strong>Contenido excluido</strong><ul>${(page.excluded_content_sections || []).map((item) => `<li>${esc(typeof item === "string" ? item : item.id || JSON.stringify(item))}</li>`).join("") || "<li>Ninguno</li>"}</ul></aside></section>`;
  }).join("");
  const journeys = (content.journeys || []).map((journey) => `<article><strong>${esc(journey.goal)}</strong><span>${esc((journey.steps || []).join(" → "))}</span><b>${esc(journey.priority)}</b></article>`).join("");
  const checkpoints = (blueprint.checkpoints || []).map((checkpoint) => `<li class="${esc(checkpoint.status)}"><b>${esc(checkpoint.id)}</b><span>${esc(checkpoint.status)}</span><small>${esc(checkpoint.notes || checkpoint.reason || "")}</small></li>`).join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Content Architecture / ${esc(blueprint.project?.name)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f1f1ef;color:#151515;font:16px/1.35 Arial,sans-serif}main>header,.page,.journeys,.checkpoints{padding:clamp(2rem,5vw,6rem);border-bottom:1px solid #ccc}h1,h2,h3{margin:0;font-weight:500;letter-spacing:-.055em;line-height:.92}h1{font-size:clamp(4rem,10vw,10rem);max-width:10ch}h2{font-size:clamp(3rem,7vw,7rem)}h3{font-size:clamp(2rem,4vw,4rem)}.status{position:fixed;right:0;bottom:0;background:${approval.status === "approved" ? "#18794e" : "#ff3d1f"};color:white;padding:.7rem 1rem;font:700 .7rem monospace;text-transform:uppercase}.page>header{display:grid;grid-template-columns:1fr 2fr;gap:2rem}.page>header p{max-width:36rem}.path{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;padding:2rem 0}.path b{border:1px solid #aaa;padding:.55rem}.section{display:grid;grid-template-columns:5rem 1fr;padding:2rem 0;border-top:1px solid #ccc}.section>span{font-family:monospace}.section>div{display:grid;grid-template-columns:1fr 2fr;gap:2rem}.section p{max-width:30rem}.section dl{display:grid;grid-template-columns:8rem 1fr;margin:0}.section dt,.section dd{padding:.6rem 0;border-bottom:1px solid #ddd}.section dt{font:700 .7rem monospace;text-transform:uppercase}.section details{grid-column:1/-1}.journeys article{display:grid;grid-template-columns:2fr 3fr auto;gap:1rem;padding:1rem 0;border-top:1px solid #ccc}.checkpoints ul{list-style:none;padding:0}.checkpoints li{display:grid;grid-template-columns:1fr auto 2fr;gap:1rem;padding:1rem 0;border-top:1px solid #ccc}.checkpoints li.approved span{color:#18794e}@media(max-width:760px){.page>header,.section>div{grid-template-columns:1fr}.section{grid-template-columns:2.5rem 1fr}.journeys article,.checkpoints li{grid-template-columns:1fr}}</style></head><body><div class="status">${esc(approval.status)} · no auto-approval</div><main><header><span>Content architecture checkpoint</span><h1>${esc(blueprint.project?.name)}</h1><p>${esc(blueprint.project?.objective)}</p></header>${pages}<section class="journeys"><h2>Conversion journeys</h2>${journeys || "<p>No journeys declared.</p>"}</section><section class="checkpoints"><h2>Approval gates</h2><ul>${checkpoints}</ul></section></main></body></html>`;
}

const contentFile = arg("content");
const blueprintFile = arg("blueprint");
const out = path.resolve(process.cwd(), arg("out", "content-architecture/index.html"));
if (!contentFile || !blueprintFile) throw new Error("Usage: build-content-architecture.mjs --content CONTENT_MANIFEST.json --blueprint SITE_BLUEPRINT.json [--out content-architecture/index.html]");
const [content, blueprint] = await Promise.all([
  fs.readFile(path.resolve(contentFile), "utf8").then(JSON.parse),
  fs.readFile(path.resolve(blueprintFile), "utf8").then(JSON.parse)
]);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, buildDocument(content, blueprint), "utf8");
console.log(`✓ Content architecture checkpoint built at ${out}`);
