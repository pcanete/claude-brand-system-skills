#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import visualTunerDev from "./visual-tuner-dev.mjs";
import { tunedOrder, tunedText, tunedValue } from "../assets/tuning-runtime.mjs";

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
assert.match(chunks.join(""), /customElements|visual-tuner/);

const configChunks = [];
const configResponse = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { configChunks.push(value); } };
await middleware[0].handler({ method: "GET", url: "/__visual-tuner/config" }, configResponse, () => {});
const config = JSON.parse(configChunks.join(""));
const imageControl = config.schema.groups.flatMap((group) => group.controls).find((control) => control.id === "hero-image");
assert.deepEqual(imageControl.asset_options, [{ value: "/assets/editable/hero-default.webp", label: "hero-default.webp", src: "/assets/editable/hero-default.webp" }]);
console.log("✓ Development-only tuner and production helpers verified");
