#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { validateLab } from "./validate-lab.mjs";

function arg(name, fallback = null) { const index = process.argv.indexOf(name); return index === -1 ? fallback : process.argv[index + 1]; }
function esc(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function getPath(object, dottedPath) { return dottedPath.split(".").reduce((value, key) => value?.[key], object); }
// Ancho de `.marquee article` en el CSS de abajo (22rem a 16px de raíz).
const MARQUEE_ITEM_PX = 352;

function list(value, fallback) { return Array.isArray(value) && value.length ? value : fallback; }

function demoMarkup(demo) {
  const items = list(demo.config.items, ["Alpha", "Beta", "Gamma"]);
  const labels = list(demo.config.labels, ["Open", "Close"]);
  switch (demo.kind) {
    case "loader": return `<div class="loader-stage"><div class="loader-value">0%</div><button data-restart>Restart</button></div>`;
    case "filter": return `<div class="filter-demo"><div class="filter-controls">${items.map((item, index) => `<button data-filter="${esc(item)}" class="${index === 0 ? "active" : ""}">${esc(item)}</button>`).join("")}</div><div class="filter-grid">${items.concat(items).map((item, index) => `<article data-category="${esc(item)}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(item)}</strong></article>`).join("")}</div></div>`;
    case "media-sequence":
    case "marquee": {
      // La duración sale del ancho real de la pista y la velocidad declarada.
      // Un piso alto silenciaba cualquier medición rápida: 302 px/s y 900 px/s
      // rendían lo mismo, y quien aprobaba el checkpoint no veía lo medido.
      const speed = Number(demo.config.speed_px_s) || 40;
      const seconds = Math.max(0.5, (items.length * MARQUEE_ITEM_PX) / speed);
      return `<div class="marquee" style="--duration:${seconds.toFixed(2)}s"><div class="marquee-track">${items.concat(items).map((item, index) => `<article><span>${String((index % items.length) + 1).padStart(2, "0")}</span><strong>${esc(item)}</strong><i></i></article>`).join("")}</div></div>`;
    }
    case "drag-surface": return `<div class="drag-stage"><div class="drag-object" tabindex="0"><span>${esc(labels[0])}</span></div><p>${esc(labels.join(" / "))}</p></div>`;
    case "fullscreen": return `<div class="fullscreen-demo"><button data-open-dialog>${esc(labels[0])}</button><dialog><button data-close-dialog>${esc(labels[1] || "Close")}</button><div class="generated-media"><span>Generated media</span></div></dialog></div>`;
    case "hover-label": return `<button class="rolling-label"><span>${esc(labels[0])}</span><span aria-hidden="true">${esc(labels[1] || labels[0])}</span></button>`;
    case "navigation": return `<div class="nav-demo"><button data-menu-toggle>${esc(labels[0] || "Menu")} +</button><div class="nav-panel">${items.map((item, index) => `<a href="#">${String(index + 1).padStart(2, "0")} ${esc(item)}</a>`).join("")}</div></div>`;
    case "scroll-reveal": return `<p class="reveal-copy">${items.join(" ").split(" ").map((word) => `<span>${esc(word)}</span>`).join(" ")}</p>`;
    case "sticky-stack": return `<div class="stack-demo">${items.map((item, index) => `<article style="--i:${index}"><span>0${index + 1}</span><h3>${esc(item)}</h3></article>`).join("")}</div>`;
    case "parallax": {
      // Antes eran tres formas fijas con tres ratios fijos: el laboratorio
      // mostraba lo mismo declarara el spec seis actores o dos.
      const base = Number(demo.config.ratio) || 0.18;
      return `<div class="parallax-stage" style="--count:${items.length}">${items.map((item, index) => {
        const ratio = (base * (index % 2 ? -1 : 1) * (1 - (index % 3) * 0.3)).toFixed(3);
        return `<i data-ratio="${ratio}" style="--n:${index}"><span>${esc(item)}</span></i>`;
      }).join("")}</div>`;
    }
    case "typography": {
      // Un nivel por elemento declarado. La versión anterior concatenaba del
      // segundo en adelante en un solo titular, así que la demo cuyo objeto es
      // la escala mostraba dos tamaños y escondía el resto.
      const levels = list(demo.config.items, ["Display", "Headline", "Subhead", "Body", "Label"]);

      // Si el spec declara los tamaños medidos, se usan esos. La demo cita el
      // registro tipográfico como fuente: generar una escala propia y mostrarla
      // en su lugar invita a aprobar algo que nadie midió.
      const measured = Array.isArray(demo.config.sizes_px)
        && demo.config.sizes_px.length === levels.length
        && demo.config.sizes_px.every((value) => Number.isFinite(Number(value)))
        ? demo.config.sizes_px.map(Number)
        : null;

      const tracking = Array.isArray(demo.config.tracking_px) ? demo.config.tracking_px.map(Number) : null;
      const leading = Array.isArray(demo.config.line_height_px) ? demo.config.line_height_px.map(Number) : null;

      return `<div class="type-demo" data-scale="${measured ? "measured" : "adaptive"}">${levels.map((level, index) => {
        const step = levels.length > 1 ? index / (levels.length - 1) : 0;
        // Sin medición, una escala adaptativa cuyo piso no baja de ~0.72rem:
        // una etiqueta técnica sigue siendo texto que hay que poder leer.
        const size = measured
          ? `${measured[index]}px`
          : `clamp(${(2.3 - step * 1.58).toFixed(2)}rem, ${(11 - step * 9.4).toFixed(2)}vw, ${(7.5 - step * 6.55).toFixed(2)}rem)`;
        const extra = [
          leading?.[index] ? `line-height:${leading[index]}px` : "",
          tracking?.[index] ? `letter-spacing:${tracking[index]}px` : ""
        ].filter(Boolean).join(";");
        const ratio = measured && index > 0 ? ` · ${(measured[index - 1] / measured[index]).toFixed(2)}×` : "";
        return `<p class="type-level" style="--fs:${size}${extra ? `;${extra}` : ""}"><span class="type-index">${String(index + 1).padStart(2, "0")}${measured ? ` · ${measured[index]}px${ratio}` : " · adaptativo"}</span>${esc(level)}</p>`;
      }).join("")}<p class="type-note">${measured ? "Tamaños medidos en la referencia, con la razón entre niveles consecutivos." : "Escala adaptativa: el spec no declaró tamaños medidos."}</p></div>`;
    }
    default: return "";
  }
}

function renderDemo(demo, style, evidenceIds) {
  const source = Object.fromEntries(demo.source_paths.map((sourcePath) => [sourcePath, getPath(style, sourcePath)]));
  return `<section id="${esc(demo.id)}" class="demo" data-kind="${esc(demo.kind)}" data-duration="${Number(demo.config.duration_ms || 1600)}"><header><div><span class="index">${esc(demo.kind)}</span><h2>${esc(demo.title)}</h2></div><p>${esc(demo.note)}</p></header><div class="stage">${demoMarkup(demo)}</div><details><summary>Source and evidence</summary><pre>${esc(JSON.stringify({ source, evidence_refs: demo.evidence_refs.filter((ref) => evidenceIds.has(ref)) }, null, 2))}</pre></details></section>`;
}

function document({ style, evidence, spec }) {
  const t = spec.theme;
  const evidenceIds = new Set();
  const walk = (node) => { if (Array.isArray(node)) node.forEach(walk); else if (node && typeof node === "object") { if (node.id) evidenceIds.add(node.id); Object.values(node).forEach(walk); } };
  walk(evidence);
  const demos = spec.demos.map((demo) => renderDemo(demo, style, evidenceIds)).join("\n");
  const nav = spec.demos.map((demo) => `<a href="#${esc(demo.id)}">${esc(demo.title)}</a>`).join("");
  const checklist = spec.review.checklist.map((item) => `<li class="${esc(item.status)}"><i></i><span>${esc(item.label)}</span></li>`).join("");
  const cases = spec.responsive_cases.map((item) => `<li><strong>${esc(item.label)}</strong><span>${item.width} × ${item.height}</span><p>${esc(item.notes)}</p></li>`).join("");
  const draft = spec.review.status === "approved" ? "" : `<div class="draft">${esc(spec.review.status)} — not approved</div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(spec.project.reference_label)} — Reference Lab</title><style>
:root{--canvas:${t.canvas};--ink:${t.ink};--muted:${t.muted};--accent:${t.accent};--border:${t.border};--display:${t.display_family};--body:${t.body_family};--mono:${t.mono_family}}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--canvas);color:var(--ink);font-family:var(--body);line-height:1.35}.draft{position:fixed;right:0;bottom:0;z-index:50;background:var(--accent);color:#fff;padding:.65rem 1rem;font:700 .7rem var(--mono);text-transform:uppercase}.top{position:sticky;top:0;z-index:20;display:grid;grid-template-columns:1fr 3fr;align-items:center;padding:1rem 1.5rem;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--canvas) 92%,transparent);backdrop-filter:blur(12px)}.top strong{font-family:var(--display)}nav{display:flex;justify-content:flex-end;gap:1rem;overflow:auto}nav a{color:inherit;text-decoration:none;white-space:nowrap;font:.65rem var(--mono);text-transform:uppercase}.hero{min-height:75vh;display:grid;grid-template-columns:1fr 3fr;gap:2rem;padding:clamp(3rem,8vw,9rem) 1.5rem;border-bottom:1px solid var(--border)}.index{font:.68rem var(--mono);text-transform:uppercase;color:var(--muted)}h1,h2,h3{font-family:var(--display);font-weight:500;letter-spacing:-.055em;line-height:.92;margin:0}.hero h1{font-size:clamp(4rem,11vw,11rem);max-width:10ch}.hero p{font-size:clamp(1rem,1.8vw,1.45rem);max-width:40rem}.demo{padding:clamp(3rem,7vw,7rem) 1.5rem;border-bottom:1px solid var(--border)}.demo>header{display:grid;grid-template-columns:2fr 1fr;gap:2rem;margin-bottom:3rem}.demo h2{font-size:clamp(2.5rem,6vw,6rem);max-width:12ch}.demo>header p{max-width:32rem}.stage{min-height:28rem;border:1px solid var(--border);overflow:hidden;background:color-mix(in srgb,var(--canvas) 88%,var(--ink) 2%);position:relative}button{border:1px solid var(--ink);background:var(--ink);color:var(--canvas);font:700 .72rem var(--mono);text-transform:uppercase;padding:1rem 1.25rem;cursor:pointer}.loader-stage{height:28rem;display:grid;place-items:center}.loader-value{font:500 clamp(5rem,18vw,14rem) var(--display);letter-spacing:-.08em}.loader-stage button{position:absolute;right:1rem;bottom:1rem}.filter-controls{display:flex;gap:.5rem;padding:1rem}.filter-controls button{background:transparent;color:var(--ink)}.filter-controls button.active{background:var(--accent);border-color:var(--accent);color:#fff}.filter-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border-top:1px solid var(--border)}.filter-grid article{min-height:15rem;padding:1rem;background:var(--canvas);display:flex;flex-direction:column;justify-content:space-between}.filter-grid article[hidden]{display:none}.filter-grid span,.marquee span{font:.7rem var(--mono)}.filter-grid strong{font-size:2rem}.marquee{height:28rem;display:flex;align-items:center;overflow:hidden}.marquee-track{display:flex;width:max-content;animation:marquee var(--duration) linear infinite}.marquee article{width:22rem;height:19rem;border:1px solid var(--border);padding:1rem;display:grid;grid-template-rows:auto 1fr;flex:none;background:var(--canvas)}.marquee article i{display:block;margin-top:1rem;background:linear-gradient(135deg,var(--ink),var(--muted));clip-path:polygon(15% 0,100% 20%,83% 100%,0 78%)}.marquee:hover .marquee-track{animation-duration:calc(var(--duration)*2.5)}@keyframes marquee{to{transform:translateX(-50%)}}.drag-stage{height:28rem;position:relative;display:grid;place-items:center;touch-action:none}.drag-object{width:10rem;height:10rem;border-radius:50%;background:var(--accent);display:grid;place-items:center;color:#fff;font:700 .75rem var(--mono);cursor:grab;user-select:none}.drag-object:active{cursor:grabbing}.drag-stage p{position:absolute;bottom:1rem}.fullscreen-demo{height:28rem;display:grid;place-items:center}.fullscreen-demo dialog{width:min(90vw,70rem);height:min(80vh,45rem);border:0;background:var(--ink);color:var(--canvas);padding:1rem}.fullscreen-demo dialog::backdrop{background:rgba(0,0,0,.75)}.fullscreen-demo dialog button{float:right;border-color:var(--canvas)}.generated-media{height:calc(100% - 4rem);clear:both;display:grid;place-items:center;background:radial-gradient(circle at 65% 30%,var(--accent),transparent 28%),linear-gradient(145deg,#333,#080808)}.rolling-label{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);height:3.3rem;overflow:hidden}.rolling-label span{display:block;transition:transform .3s}.rolling-label:hover span{transform:translateY(-100%)}.nav-demo{padding:1rem}.nav-panel{position:absolute;inset:0;background:var(--ink);color:var(--canvas);display:grid;align-content:center;padding:10%;transform:translateY(-105%);transition:transform .45s cubic-bezier(.2,.8,.2,1)}.nav-panel.open{transform:none}.nav-panel a{color:inherit;text-decoration:none;font:500 clamp(2rem,7vw,6rem) var(--display);border-bottom:1px solid #555}.reveal-copy{padding:5rem;font:500 clamp(2.5rem,6vw,6rem) var(--display);line-height:1}.reveal-copy span{color:var(--border);transition:color .25s}.reveal-copy span.visible{color:var(--ink)}.stack-demo{padding:3rem;min-height:60rem}.stack-demo article{position:sticky;top:6rem;height:18rem;margin-bottom:5rem;padding:2rem;background:var(--ink);color:var(--canvas);transform:translateY(calc(var(--i)*1rem))}.stack-demo h3{font-size:4rem}.parallax-stage{height:38rem;overflow:hidden}.parallax-stage i{position:absolute;width:calc(84%/var(--count));min-width:6rem;height:20rem;background:var(--accent);top:18%;left:calc(4% + var(--n)*(92%/var(--count)));display:grid;align-content:end;padding:.75rem}.parallax-stage i:nth-child(even){background:var(--ink)}.parallax-stage i:nth-child(3n){background:var(--muted)}.parallax-stage i span{font:.7rem var(--mono);color:var(--canvas)}.type-demo{padding:4rem}.type-level{font-family:var(--display);font-size:var(--fs);font-weight:500;line-height:.95;letter-spacing:-.05em;margin:0 0 .35em;max-width:22ch}.type-index{display:block;font:.68rem var(--mono);letter-spacing:0;color:var(--muted);margin-bottom:.35rem}.type-note{font-size:1.1rem;max-width:32rem;color:var(--muted);margin-top:2.5rem}details{margin-top:1rem}summary{font:.68rem var(--mono);text-transform:uppercase;cursor:pointer}pre{white-space:pre-wrap;padding:1rem;border:1px solid var(--border);font:.72rem/1.45 var(--mono)}.responsive,.review{padding:clamp(3rem,7vw,7rem) 1.5rem}.responsive h2,.review h2{font-size:clamp(3rem,8vw,8rem);max-width:10ch}.responsive ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:1px;background:var(--border);padding:1px;list-style:none}.responsive li{padding:1.5rem;background:var(--canvas)}.responsive li span{display:block;font:1.5rem var(--mono)}.review{background:var(--ink);color:var(--canvas)}.review ul{list-style:none;padding:0;max-width:55rem}.review li{display:grid;grid-template-columns:1rem 1fr;gap:1rem;padding:1rem 0;border-top:1px solid #444}.review li i{width:.7rem;height:.7rem;border-radius:50%;background:var(--muted)}.review li.accepted i{background:#5bd077}.review li.changes-requested i{background:var(--accent)}
@media(max-width:760px){.top{grid-template-columns:1fr;gap:1rem}.top nav{justify-content:flex-start}.hero,.demo>header{grid-template-columns:1fr}.hero{min-height:auto;padding:4rem 1rem}.demo,.responsive,.review{padding:4rem 1rem}.stage{min-height:22rem}.filter-grid{grid-template-columns:1fr 1fr}.filter-grid article{min-height:10rem}.marquee,.loader-stage,.drag-stage,.fullscreen-demo{height:22rem}.reveal-copy{padding:2rem}.stack-demo{padding:1rem}.type-demo{padding:2rem}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.marquee-track{animation:none}.nav-panel,.rolling-label span{transition:none}}
</style></head><body>${draft}<header class="top"><strong>Reference Lab / ${esc(spec.project.reference_label)}</strong><nav>${nav}</nav></header><main><section class="hero"><span class="index">Evidence-backed behavior checkpoint</span><div><h1>${esc(spec.project.reference_label)}</h1><p>${esc(spec.project.objective)}</p></div></section>${demos}<section class="responsive"><span class="index">Responsive cases</span><h2>Inspect the system at its edges.</h2><ul>${cases}</ul></section><section class="review"><span class="index">Human checkpoint</span><h2>Approve understanding, not decoration.</h2><ul>${checklist}</ul><p>Status: <strong>${esc(spec.review.status)}</strong></p></section></main><script>
document.querySelectorAll('[data-kind="loader"]').forEach(section=>{const value=section.querySelector('.loader-value');const run=()=>{const duration=Number(section.dataset.duration)||1600;const start=performance.now();const tick=now=>{const p=Math.min(1,(now-start)/duration);value.textContent=Math.round(p*100)+'%';if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)};section.querySelector('[data-restart]').addEventListener('click',run);run()});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{const demo=button.closest('.filter-demo');demo.querySelectorAll('[data-filter]').forEach(item=>item.classList.toggle('active',item===button));demo.querySelectorAll('[data-category]').forEach(card=>card.hidden=card.dataset.category!==button.dataset.filter)}));
document.querySelectorAll('.drag-object').forEach(object=>{let active=false,ox=0,oy=0;const stage=object.parentElement;object.addEventListener('pointerdown',event=>{active=true;object.setPointerCapture(event.pointerId);ox=event.clientX-object.offsetLeft;oy=event.clientY-object.offsetTop});object.addEventListener('pointermove',event=>{if(!active)return;const x=Math.max(0,Math.min(stage.clientWidth-object.offsetWidth,event.clientX-ox));const y=Math.max(0,Math.min(stage.clientHeight-object.offsetHeight,event.clientY-oy));object.style.position='absolute';object.style.left=x+'px';object.style.top=y+'px'});object.addEventListener('pointerup',()=>active=false)});
document.querySelectorAll('[data-open-dialog]').forEach(button=>{const dialog=button.nextElementSibling;button.addEventListener('click',()=>dialog.showModal());dialog.querySelector('[data-close-dialog]').addEventListener('click',()=>dialog.close())});
document.querySelectorAll('[data-menu-toggle]').forEach(button=>button.addEventListener('click',()=>button.nextElementSibling.classList.toggle('open')));
const reveal=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.querySelectorAll('span').forEach((span,index)=>setTimeout(()=>span.classList.add('visible'),index*45))}),{threshold:.35});document.querySelectorAll('.reveal-copy').forEach(item=>reveal.observe(item));
const updateParallax=()=>document.querySelectorAll('.parallax-stage i').forEach(item=>{const rect=item.parentElement.getBoundingClientRect();item.style.transform='translateY('+((innerHeight/2-rect.top)*Number(item.dataset.ratio))+'px)'});addEventListener('scroll',updateParallax,{passive:true});updateParallax();
</script></body></html>`;
}

async function main() {
  const styleFile=arg("--style"), evidenceFile=arg("--evidence"), specFile=arg("--spec"), out=path.resolve(process.cwd(),arg("--out","reference-lab"));
  if(!styleFile||!evidenceFile||!specFile) throw new Error("Usage: build-lab.mjs --style STYLE_DNA.json --evidence REFERENCE_EVIDENCE.json --spec REFERENCE_LAB_SPEC.json [--out reference-lab]");
  const result=await validateLab({styleFile,evidenceFile,specFile,allowDraft:true});
  await fs.mkdir(out,{recursive:true});
  await fs.writeFile(path.join(out,"index.html"),document(result),"utf8");
  await fs.writeFile(path.join(out,"REFERENCE_LAB.json"),JSON.stringify({version:"0.1",generated_at:new Date().toISOString(),project:result.spec.project,demos:result.spec.demos,responsive_cases:result.spec.responsive_cases,review:result.spec.review},null,2),"utf8");
  console.log(`✓ Reference lab built at ${out}`);
}

main().catch(error=>{console.error(error.message);process.exit(1)});

