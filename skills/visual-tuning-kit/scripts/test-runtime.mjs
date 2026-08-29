#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import visualTunerDev, { validNavigation } from "./visual-tuner-dev.mjs";
import { deriveRange, findAdjustables, RANGE_UNITS } from "./derive-schema.mjs";
import { collectTexts, summarizeMappings } from "./map-content.mjs";
import { tunedOrder, tunedText, tunedValue } from "../assets/tuning-runtime.mjs";

assert.deepEqual(deriveRange({ number: 0, unit: "px" }), { min: -64, max: 64, step: 1 });
assert.deepEqual(deriveRange({ number: 0, unit: "ms" }), { min: 0, max: 1000, step: 10 });
assert.equal(deriveRange({ number: 240, unit: "ms" }).min >= 0, true);
assert.equal(RANGE_UNITS.includes("svh") && RANGE_UNITS.includes("s"), true);
const discovered = findAdjustables([
  { file: "a.css", content: ":root { --hero-offset-y: 0px; --hero-duration: 240ms; }" },
  { file: "b.astro", content: ".hero { transform: translateY(var(--hero-offset-y, 0px)); }" }
]);
assert.equal(discovered.length, 2);
assert.equal(discovered.find((item) => item.name === "--hero-offset-y").conflicts.length, 0);
const manifestCoverage = collectTexts({ pages: { home: {
  route: "/",
  seo: { title: "No cuenta como contenido visible" },
  featured_story: { title: "Historia destacada" },
  sections: [{ id: "preguntas", type: "faq", title: "Preguntas", items: [{ question: "¿Una?", answer: ["Respuesta."] }] }]
} } }, "home");
assert.deepEqual(manifestCoverage.texts.map((item) => item.content_path), [
  "pages.home.featured_story.title",
  "pages.home.sections.preguntas.title",
  "pages.home.sections.preguntas.items.0.question",
  "pages.home.sections.preguntas.items.0.answer.0"
]);
assert.equal(manifestCoverage.texts[2].rta_id, "home.preguntas.items.0.question");
assert.deepEqual(summarizeMappings([{ matches: 1 }, { matches: 0 }, { matches: 2 }]), {
  declared: 3, linked: 1, missing: 1, ambiguous: 1, coverage: 33
});
const navigationControl = { min_items: 1, max_items: 6, max_length: 40, allowed_hosts: ["example.com"], allow_hash: true, allow_relative: true };
assert.equal(validNavigation(navigationControl, [{ id: "about", label: "About", href: "/about", target: "_self", visible: true }]), true);
assert.equal(validNavigation(navigationControl, [{ id: "bad", label: "Bad", href: "javascript:alert(1)", target: "_self", visible: true }]), false);
assert.equal(validNavigation(navigationControl, [{ id: "external", label: "External", href: "https://evil.example/", target: "_blank", visible: true }]), false);

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "visual-tuning-kit-"));
await fs.mkdir(path.join(temp, "src", "tuning"), { recursive: true });
await fs.mkdir(path.join(temp, "public", "assets", "editable"), { recursive: true });
await fs.copyFile(new URL("../assets/TUNING_SCHEMA.example.json", import.meta.url), path.join(temp, "src", "tuning", "tuning.schema.json"));
await fs.copyFile(new URL("../assets/TUNING_VALUES.example.json", import.meta.url), path.join(temp, "src", "tuning", "tuning.values.json"));
await fs.writeFile(path.join(temp, "public", "assets", "editable", "hero-default.webp"), "test");

const plugin = visualTunerDev({ root: temp });
assert.equal(plugin.apply, "serve");
assert.equal(tunedValue({ values: { spacing: 12 } }, "spacing", 4), 12);
assert.equal(tunedText({ values: { title: ["Uno", "Dos"] } }, "title"), "Uno\nDos");
assert.deepEqual(tunedOrder({ values: { order: ["b", "a"] } }, "order", ["a", "b"]), ["b", "a"]);
assert.deepEqual(tunedOrder({ values: { order: ["a", "a"] } }, "order", ["a", "b"]), ["a", "b"]);

const middleware = [];
plugin.configureServer({ middlewares: { use(prefix, handler) { middleware.push(typeof prefix === "function" ? { prefix: null, handler: prefix } : { prefix, handler }); } } });
assert.equal(middleware.length, 1);
const request = { method: "GET", url: "/__visual-tuner/client.js" };
const chunks = [];
const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { chunks.push(value); } };
await middleware[0].handler(request, response, () => {});
const clientSource = chunks.join("");
assert.match(clientSource, /customElements|visual-tuner/);
assert.match(clientSource, /schema\.groups\.entries/);
assert.match(clientSource, /related\.push\(control\)/);
assert.match(clientSource, /renderNavigation/);
assert.match(clientSource, /positionStorageKey/);
assert.match(clientSource, /setPointerCapture/);
assert.match(clientSource, /data-dragging/);

const configChunks = [];
const configResponse = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { configChunks.push(value); } };
await middleware[0].handler({ method: "GET", url: "/__visual-tuner/config" }, configResponse, () => {});
const config = JSON.parse(configChunks.join(""));
const imageControl = config.schema.groups.flatMap((group) => group.controls).find((control) => control.id === "hero-image");
assert.deepEqual(imageControl.asset_options, [{ value: "/assets/editable/hero-default.webp", label: "hero-default.webp", src: "/assets/editable/hero-default.webp" }]);
console.log("✓ Development-only tuner and production helpers verified");
