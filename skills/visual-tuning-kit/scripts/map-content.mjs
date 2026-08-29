#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const TEXT_FIELDS = new Set([
  "eyebrow", "kicker", "title", "subtitle", "heading", "intro", "lede",
  "body", "copy", "cta", "label", "note", "answer", "question", "caption",
  "description", "tagline", "steps", "items"
]);

const NOT_VISIBLE_CONTENT = new Set([
  "id", "type", "route", "seo", "href", "url", "target", "media", "assets",
  "links", "section_order", "title_lines", "focal_point", "usage", "metadata"
]);

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function rtaSegment(value) {
  return String(value).replaceAll("_", "-").replace(/[^a-zA-Z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function collectTexts(manifest, pageId, { includeShared = false } = {}) {
  const pages = manifest.pages || {};
  const id = pageId || Object.keys(pages)[0];
  const page = pages[id];
  if (!page) throw new Error(`El manifiesto no tiene la página "${id}".`);

  const texts = [];

  function push(contentPath, rtaId, value) {
    if (typeof value !== "string") return;
    const clean = normalize(value);
    if (clean.length <= 1) return;
    texts.push({ content_path: contentPath, rta_id: rtaId, value: clean });
  }

  function walk(node, contentPath, rtaId, textContext = false) {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${contentPath}.${index}`, `${rtaId}.${index}`, textContext));
      return;
    }

    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (NOT_VISIBLE_CONTENT.has(key)) continue;
        const nextContext = textContext || TEXT_FIELDS.has(key);
        if (!nextContext && (typeof value !== "object" || value === null)) continue;
        walk(value, `${contentPath}.${key}`, `${rtaId}.${rtaSegment(key)}`, nextContext);
      }
      return;
    }

    if (textContext) push(contentPath, rtaId, node);
  }

  for (const [key, value] of Object.entries(page)) {
    if (NOT_VISIBLE_CONTENT.has(key) || key === "sections") continue;
    walk(value, `pages.${id}.${key}`, `${id}.${rtaSegment(key)}`, TEXT_FIELDS.has(key));
  }

  for (const [index, section] of (page.sections || []).entries()) {
    const sectionId = section.id || `section-${index}`;
    for (const [key, value] of Object.entries(section)) {
      if (NOT_VISIBLE_CONTENT.has(key)) continue;
      walk(
        value,
        `pages.${id}.sections.${sectionId}.${key}`,
        `${id}.${rtaSegment(sectionId)}.${rtaSegment(key)}`,
        TEXT_FIELDS.has(key)
      );
    }
  }

  if (includeShared) {
    walk(manifest.brand, "brand", "shared.brand", false);
    walk(manifest.navigation, "navigation", "shared.navigation", true);
  }

  return { pageId: id, texts };
}

export function summarizeMappings(mapped) {
  const linked = mapped.filter((item) => item.matches === 1);
  const missing = mapped.filter((item) => item.matches === 0);
  const ambiguous = mapped.filter((item) => item.matches > 1);
  return {
    declared: mapped.length,
    linked: linked.length,
    missing: missing.length,
    ambiguous: ambiguous.length,
    coverage: mapped.length ? Math.round((linked.length / mapped.length) * 100) : 0
  };
}

async function loadChromium(playwrightRoot) {
  const roots = [process.cwd(), playwrightRoot].filter(Boolean);
  for (const root of roots) {
    try {
      return createRequire(path.join(path.resolve(root), "package.json"))("playwright").chromium;
    } catch {}
  }

  const module = await import("playwright").catch(() => null);
  if (module) return module.chromium;
  throw new Error(
    "Playwright no está disponible. Instalalo en el proyecto o indicá el skill que ya lo posee con --playwright-root /ruta/al/skill."
  );
}

async function main() {
  const manifestPath = path.resolve(arg("manifest", "CONTENT_MANIFEST.json"));
  const url = arg("url", "http://localhost:4321");
  const outPath = arg("out");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const { pageId, texts } = collectTexts(manifest, arg("page"), {
    includeShared: process.argv.includes("--include-shared")
  });
  const chromium = await loadChromium(arg("playwright-root"));
  const browser = await chromium.launch({ headless: true });
  let mapped;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(url, { waitUntil: "domcontentloaded" });

    mapped = await page.evaluate((wanted) => {
      const clean = (value) => value.replace(/\s+/g, " ").trim();
      const all = [...document.body.querySelectorAll("*")].filter((element) => !element.closest("[data-visual-tuner]"));
      const explicitContent = all.filter((element) => element.hasAttribute("data-content-path"));
      const legacyContent = all.filter((element) => element.hasAttribute("data-content-key"));
      const explicitRta = all.filter((element) => element.hasAttribute("data-rta-id"));

      const describe = (element) => {
        const region = element.closest("section, header, footer, main");
        return {
          tag: element.tagName.toLowerCase(),
          region: region?.getAttribute("id") || region?.tagName.toLowerCase() || null,
          rta_id: element.getAttribute("data-rta-id") || element.closest("[data-rta-id]")?.getAttribute("data-rta-id") || null,
          tune_id: element.getAttribute("data-tune-id") || element.closest("[data-tune-id]")?.getAttribute("data-tune-id") || null
        };
      };

      const exactTextMatches = (value) => {
        const matches = all.filter((element) => clean(element.textContent || "") === value);
        return matches.filter((element) => !matches.some((other) => other !== element && element.contains(other)));
      };

      return wanted.map((item) => {
        const contentHits = explicitContent.filter((element) => element.getAttribute("data-content-path") === item.content_path);
        const legacyHits = legacyContent.filter((element) => element.getAttribute("data-content-key") === item.content_path);
        const rtaHits = explicitRta.filter((element) => element.getAttribute("data-rta-id") === item.rta_id);
        const preferred = contentHits.length ? [contentHits, "data-content-path"]
          : legacyHits.length ? [legacyHits, "data-content-key"]
            : rtaHits.length ? [rtaHits, "data-rta-id"]
              : [exactTextMatches(item.value), "text"];
        const [hits, by] = preferred;

        return {
          ...item,
          matches: hits.length,
          by: hits.length ? by : null,
          where: hits.length === 1 ? describe(hits[0]) : null
        };
      });
    }, texts);
  } finally {
    await browser.close();
  }

  const summary = summarizeMappings(mapped);
  const report = {
    version: "0.1",
    page: pageId,
    url,
    manifest: manifestPath.replaceAll("\\", "/"),
    summary,
    mapped
  };

  console.log(`Página "${pageId}": ${summary.declared} textos visibles declarados.`);
  console.log(`  vinculados sin ambigüedad : ${summary.linked}`);
  console.log(`  no encontrados            : ${summary.missing}`);
  console.log(`  ambiguos                  : ${summary.ambiguous}`);
  console.log(`  cobertura                 : ${summary.coverage}%`);

  if (outPath) {
    await writeFile(path.resolve(outPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`reporte escrito: ${outPath}`);
  }

  if (summary.missing || summary.ambiguous) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
