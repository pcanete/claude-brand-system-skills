#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
};

const main = async () => {
  const project = arg("--project");
  if (!project) throw new Error("Usage: scaffold-tuner.mjs --project <astro-root> [--schema file] [--values file]");
  const root = path.resolve(project);
  const target = path.join(root, "src", "tuning");
  await fs.mkdir(target, { recursive: true });
  const sources = {
    "tuning.schema.json": arg("--schema") || path.resolve(here, "../assets/TUNING_SCHEMA.example.json"),
    "tuning.values.json": arg("--values") || path.resolve(here, "../assets/TUNING_VALUES.example.json"),
    "visual-tuner-dev.mjs": path.resolve(here, "visual-tuner-dev.mjs"),
    "visual-tuner-client.js": path.resolve(here, "../assets/visual-tuner-client.js"),
    "VisualTunerLoader.astro": path.resolve(here, "../assets/VisualTunerLoader.astro"),
    "tuning-runtime.mjs": path.resolve(here, "../assets/tuning-runtime.mjs")
  };
  for (const [filename, source] of Object.entries(sources)) await fs.copyFile(path.resolve(source), path.join(target, filename));
  console.log(`✓ Visual tuner scaffolded at ${target}`);
  console.log("Add this Vite plugin to astro.config.mjs:");
  console.log("import visualTunerDev from './src/tuning/visual-tuner-dev.mjs';");
  console.log("export default defineConfig({ vite: { plugins: [visualTunerDev()] } });");
  console.log("Import VisualTunerLoader from './src/tuning/VisualTunerLoader.astro' and render it once in the base layout.");
  console.log("Open the development site with ?tune=1. The plugin is serve-only and is excluded from production builds.");
};

main().catch((error) => { console.error(error.message); process.exit(1); });
