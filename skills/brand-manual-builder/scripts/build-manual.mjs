#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { validateManual } from "./validate-manual.mjs";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => value?.[key], object);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function humanize(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderValue(value, depth = 0) {
  if (value === null || value === undefined || value === "") return '<span class="empty">Not established</span>';
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `<p>${escapeHtml(value)}</p>`;
  }
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="empty">Not established</span>';
    return `<div class="collection">${value.map((item, index) => `<article class="item"><span class="index">${String(index + 1).padStart(2, "0")}</span>${renderValue(item, depth + 1)}</article>`).join("")}</div>`;
  }
  const entries = Object.entries(value).filter(([, item]) => item !== null && item !== "" && !(Array.isArray(item) && item.length === 0) && !(typeof item === "object" && item && Object.keys(item).length === 0));
  if (!entries.length) return '<span class="empty">Not established</span>';
  return `<dl class="object">${entries.map(([key, item]) => `<div><dt>${escapeHtml(humanize(key))}</dt><dd>${renderValue(item, depth + 1)}</dd></div>`).join("")}</dl>`;
}

function fontFaces(theme) {
  return (theme.font_faces || []).map((font) => `@font-face{font-family:${JSON.stringify(font.family)};src:url(${JSON.stringify(font.src)});font-weight:${font.weight};font-style:${font.style};font-display:swap;}`).join("\n");
}

function renderSection(section, dna, evidenceById) {
  const sources = section.source_paths.map((sourcePath) => `<article class="source-block"><div class="path">${escapeHtml(sourcePath)}</div>${renderValue(getPath(dna, sourcePath))}</article>`).join("");
  const evidence = section.evidence_refs.map((ref) => evidenceById.get(ref)).filter(Boolean);
  const evidenceMarkup = evidence.length
    ? `<details><summary>Evidence (${evidence.length})</summary><div class="evidence-grid">${evidence.map((item) => `<article><strong>${escapeHtml(item.id)}</strong><p>${escapeHtml(item.description || "Recorded evidence")}</p></article>`).join("")}</div></details>`
    : "";
  return `<section id="${escapeHtml(section.id)}" class="section section--${escapeHtml(section.kind)}"><div class="section-head"><span>${escapeHtml(section.eyebrow)}</span><h2>${escapeHtml(section.title)}</h2>${section.note ? `<p>${escapeHtml(section.note)}</p>` : ""}</div><div class="section-body">${sources}${evidenceMarkup}</div></section>`;
}

function htmlDocument({ dna, evidence, spec }) {
  const theme = spec.theme;
  const evidenceById = new Map((evidence.evidence || []).map((item) => [item.id, item]));
  const nav = spec.sections.map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.eyebrow || section.title)}</a>`).join("");
  const sections = spec.sections.map((section) => renderSection(section, dna, evidenceById)).join("\n");
  const checklist = spec.review.checklist.map((item) => `<li><span class="review-status review-status--${escapeHtml(item.status)}"></span><div><strong>${escapeHtml(item.label)}</strong>${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}</div></li>`).join("");
  const logo = theme.logo_path ? `<img class="brand-logo" src="${escapeHtml(theme.logo_path)}" alt="${escapeHtml(spec.project.brand_name)}">` : `<span class="brand-wordmark">${escapeHtml(spec.project.brand_name)}</span>`;
  const draft = spec.review.status === "approved" ? "" : `<div class="draft">${escapeHtml(spec.review.status)} — checkpoint not approved</div>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(spec.project.brand_name)} — Brand Manual</title>
<style>${fontFaces(theme)}
:root{--canvas:${theme.canvas};--ink:${theme.ink};--muted:${theme.muted};--accent:${theme.accent};--border:${theme.border};--display:${theme.display_family};--body:${theme.body_family};--mono:${theme.mono_family}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--canvas);color:var(--ink);font-family:var(--body);line-height:1.35}.draft{position:fixed;z-index:20;right:0;bottom:0;background:var(--accent);color:#fff;padding:.65rem 1rem;font:700 .7rem var(--mono);text-transform:uppercase;letter-spacing:.08em}.topbar{position:sticky;top:0;z-index:10;display:grid;grid-template-columns:minmax(12rem,1fr) 3fr;align-items:center;min-height:4.5rem;padding:0 2rem;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--canvas) 90%,transparent);backdrop-filter:blur(12px)}.brand-logo{max-height:2rem;max-width:10rem}.brand-wordmark{font:700 1rem var(--display)}nav{display:flex;justify-content:flex-end;gap:1rem;overflow:auto}nav a{color:inherit;text-decoration:none;white-space:nowrap;font:.68rem var(--mono);text-transform:uppercase}.intro{min-height:72vh;display:grid;grid-template-columns:1fr 3fr;padding:clamp(2rem,7vw,8rem) 2rem;border-bottom:1px solid var(--border)}.intro .meta{font:.7rem var(--mono);text-transform:uppercase;color:var(--muted)}h1,h2{font-family:var(--display);font-weight:500;letter-spacing:-.06em;line-height:.9;margin:0}.intro h1{font-size:clamp(4rem,10vw,10rem);max-width:12ch}.intro p{max-width:42rem;font-size:clamp(1rem,1.5vw,1.35rem)}.section{display:grid;grid-template-columns:1fr 3fr;min-height:70vh;border-bottom:1px solid var(--border);padding:clamp(2rem,6vw,6rem) 2rem;gap:2rem}.section-head>span,.path,.index{font:.7rem var(--mono);text-transform:uppercase;color:var(--muted)}.section-head h2{font-size:clamp(2.75rem,6vw,7rem);max-width:12ch;margin-top:1rem}.section-body{display:grid;align-content:start;gap:1rem}.source-block{padding:1.25rem 0;border-top:1px solid var(--border)}.source-block>p{font-size:clamp(1.35rem,2.5vw,2.6rem);max-width:32ch}.object{margin:1rem 0}.object>div{display:grid;grid-template-columns:minmax(8rem,1fr) 3fr;gap:1rem;padding:1rem 0;border-top:1px solid var(--border)}dt{font:.7rem var(--mono);text-transform:uppercase;color:var(--muted)}dd{margin:0}.collection{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:1px;background:var(--border);border:1px solid var(--border)}.item{background:var(--canvas);padding:1rem;min-height:9rem}.empty{color:var(--muted);font-style:italic}details{margin-top:2rem;border-top:1px solid var(--border);padding-top:1rem}summary{cursor:pointer;font:.7rem var(--mono);text-transform:uppercase}.evidence-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:1rem;margin-top:1rem}.evidence-grid article{padding:1rem;border:1px solid var(--border)}.review{padding:clamp(3rem,7vw,8rem) 2rem;background:var(--ink);color:var(--canvas)}.review h2{font-size:clamp(3rem,7vw,8rem);max-width:10ch}.review ul{list-style:none;padding:0;margin:3rem 0;max-width:55rem}.review li{display:grid;grid-template-columns:1rem 1fr;gap:1rem;padding:1rem 0;border-top:1px solid color-mix(in srgb,var(--canvas) 25%,transparent)}.review-status{width:.65rem;height:.65rem;margin-top:.3rem;border-radius:50%;background:var(--muted)}.review-status--accepted{background:#5cd078}.review-status--changes-requested{background:var(--accent)}
@media(max-width:760px){.topbar{grid-template-columns:1fr;padding:1rem;gap:.8rem}nav{justify-content:flex-start}.intro,.section{grid-template-columns:1fr;padding:3rem 1rem;min-height:auto}.intro{gap:3rem}.object>div{grid-template-columns:1fr}.section-head h2{font-size:clamp(2.6rem,15vw,5rem)}.review{padding:4rem 1rem}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body>${draft}<header class="topbar">${logo}<nav>${nav}</nav></header><main><section class="intro"><div class="meta">Brand manual / ${escapeHtml(spec.review.status)}</div><div><h1>${escapeHtml(spec.project.brand_name)}</h1><p>${escapeHtml(spec.project.objective)}</p></div></section>${sections}<section class="review"><span class="path">Human checkpoint</span><h2>Review before production.</h2><ul>${checklist}</ul><p>Status: <strong>${escapeHtml(spec.review.status)}</strong></p></section></main></body></html>`;
}

async function main() {
  const dnaFile = arg("--dna");
  const evidenceFile = arg("--evidence");
  const specFile = arg("--spec");
  const out = path.resolve(process.cwd(), arg("--out", "brand-manual"));
  if (!dnaFile || !evidenceFile || !specFile) throw new Error("Usage: build-manual.mjs --dna BRAND_DNA.json --evidence BRAND_EVIDENCE.json --spec BRAND_MANUAL_SPEC.json [--out brand-manual]");
  const result = await validateManual({ dnaFile, evidenceFile, specFile, allowDraft: true });
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, "index.html"), htmlDocument(result), "utf8");
  await fs.writeFile(path.join(out, "BRAND_MANUAL.json"), JSON.stringify({ version: "0.1", generated_at: new Date().toISOString(), project: result.spec.project, review: result.spec.review, sections: result.spec.sections }, null, 2), "utf8");
  console.log(`✓ Brand manual built at ${out}`);
}

main().catch((error) => { console.error(error.message); process.exit(1); });

