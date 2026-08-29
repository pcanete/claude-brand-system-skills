#!/usr/bin/env node

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const SOURCE_EXTENSIONS = new Set([
  ".astro", ".css", ".ts", ".js", ".mjs", ".jsx", ".tsx", ".svelte", ".vue"
]);

const SKIP_DIRECTORIES = new Set([
  "node_modules", "dist", ".astro", ".git", "qa", "wordpress", "public"
]);

export const RANGE_UNITS = [
  "px", "rem", "em", "vw", "vh", "svh", "dvh", "ch", "%", "deg", "ms", "s"
];

const VALUE = new RegExp(`^(-?\\d+(?:\\.\\d+)?)(${RANGE_UNITS.join("|")})?$`);

async function collectSources(root) {
  const files = [];

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) await walk(target);
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(target);
      }
    }
  }

  await walk(root);
  return files;
}

export function findAdjustables(sources) {
  const found = new Map();

  function record(name, raw, file) {
    const value = raw.trim();
    const match = VALUE.exec(value);
    if (!match) return;

    const number = Number(match[1]);
    const unit = match[2] ?? "";
    const existing = found.get(name);

    if (existing) {
      if (existing.number !== number || existing.unit !== unit) {
        existing.conflicts.push({ file, value });
      }
      return;
    }

    found.set(name, { name, number, unit, file, conflicts: [] });
  }

  for (const { file, content } of sources) {
    for (const match of content.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,\s*([^),]+)\)/gi)) {
      record(match[1], match[2], file);
    }

    for (const block of content.matchAll(/(?:html)?:root\s*\{([^}]*)\}/gi)) {
      for (const declaration of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
        record(declaration[1], declaration[2], file);
      }
    }

    for (const match of content.matchAll(
      /\(\s*['"`](--[a-z0-9-]+)['"`]\s*,\s*(-?\d+(?:\.\d+)?[a-z%]*)\s*\)/gi
    )) {
      record(match[1], match[2], file);
    }
  }

  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function zeroRange(unit) {
  if (unit === "deg") return { min: -6, max: 6, step: 0.5 };
  if (unit === "ms") return { min: 0, max: 1000, step: 10 };
  if (unit === "s") return { min: 0, max: 2, step: 0.05 };
  if (unit === "px") return { min: -64, max: 64, step: 1 };
  if (["rem", "em"].includes(unit)) return { min: -4, max: 4, step: 0.05 };
  if (["vw", "vh", "svh", "dvh", "ch", "%"].includes(unit)) {
    return { min: -10, max: 10, step: 0.1 };
  }
  return { min: 0, max: 1, step: 0.01 };
}

export function deriveRange({ number, unit }) {
  const magnitude = Math.abs(number);

  if (magnitude === 0) return zeroRange(unit);
  if (!unit && magnitude <= 1) return { min: 0, max: 1, step: 0.01 };

  if (unit === "deg") {
    const bound = Math.max(6, Math.ceil(magnitude * 2));
    return { min: -bound, max: bound, step: 0.5 };
  }

  const decimals = Number.isInteger(number) && magnitude >= 10 ? 0 : magnitude >= 1 ? 1 : 2;
  const round = (value) => Number(value.toFixed(decimals));
  const duration = unit === "ms" || unit === "s";
  const min = duration ? Math.max(0, number - magnitude * 0.4) : number - magnitude * 0.4;

  return {
    min: round(min),
    max: round(number + magnitude * 0.6),
    step: duration
      ? (unit === "ms" ? Math.max(1, Math.round(magnitude / 20)) : 0.01)
      : decimals === 0 ? (magnitude >= 200 ? 5 : 1) : decimals === 1 ? 0.1 : 0.01
  };
}

function humanize(name) {
  const words = name.replace(/^--/, "").split("-");
  const label = words.slice(1).join(" ") || words.join(" ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupOf(name) {
  return name.replace(/^--/, "").split("-")[0];
}

export function buildSchema({ adjustables, id, title, projectRoot }) {
  const groups = new Map();

  for (const adjustable of adjustables) {
    const key = groupOf(adjustable.name);
    if (!groups.has(key)) groups.set(key, []);

    const range = deriveRange(adjustable);
    const origin = path.relative(projectRoot, adjustable.file).replaceAll("\\", "/");
    groups.get(key).push({
      id: adjustable.name.replace(/^--/, ""),
      kind: "range",
      label: humanize(adjustable.name),
      rationale: `Borrador derivado de ${adjustable.name} en ${origin}, con valor inicial ${adjustable.number}${adjustable.unit}. Revisar rango, etiqueta y pertenencia al panel antes de aprobar.`,
      default: adjustable.number,
      target: { css_variable: adjustable.name },
      min: range.min,
      max: range.max,
      step: range.step,
      ...(adjustable.unit ? { unit: adjustable.unit } : {})
    });
  }

  return {
    version: "0.1",
    id,
    title,
    query_parameter: "tune",
    development_only: true,
    groups: [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, controls]) => ({
        id: key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        controls: controls.sort((a, b) => a.id.localeCompare(b.id))
      }))
  };
}

async function main() {
  const projectRoot = path.resolve(process.cwd(), arg("project", "."));
  const outPath = arg("out");
  const valuesOut = arg("values-out");
  const allowConflicts = process.argv.includes("--allow-conflicts");
  const info = await stat(projectRoot).catch(() => null);

  if (!info?.isDirectory()) throw new Error(`No existe el proyecto: ${projectRoot}`);

  const sourceRoot = path.join(projectRoot, "src");
  const base = (await stat(sourceRoot).catch(() => null))?.isDirectory() ? sourceRoot : projectRoot;
  const files = await collectSources(base);
  const sources = await Promise.all(
    files.map(async (file) => ({ file, content: await readFile(file, "utf8") }))
  );
  const adjustables = findAdjustables(sources);
  const conflicts = adjustables.filter((item) => item.conflicts.length);

  if (conflicts.length && !allowConflicts) {
    const detail = conflicts.map((item) => {
      const alternatives = item.conflicts.map((conflict) => `${conflict.value} (${path.relative(projectRoot, conflict.file)})`);
      return `  - ${item.name}: ${item.number}${item.unit} (${path.relative(projectRoot, item.file)}) vs ${alternatives.join(", ")}`;
    });
    throw new Error(
      `No se generó el contrato: hay valores por defecto contradictorios.\n${detail.join("\n")}\nCorregilos en el proyecto o repetí con --allow-conflicts para producir un borrador explícitamente no resuelto.`
    );
  }

  const schema = buildSchema({
    adjustables,
    projectRoot,
    id: arg("id", `${path.basename(projectRoot)}-home`),
    title: arg("title", "Calibrador")
  });

  if (!schema.groups.length) {
    throw new Error("No se encontraron variables numéricas ajustables con valor por defecto.");
  }

  const values = {
    version: "0.1",
    schema: schema.id,
    status: "draft",
    values: Object.fromEntries(
      schema.groups.flatMap((group) => group.controls.map((control) => [control.id, control.default]))
    ),
    approved_by: null,
    approved_at: null
  };

  if (valuesOut) {
    await writeFile(path.resolve(projectRoot, valuesOut), `${JSON.stringify(values, null, 2)}\n`, "utf8");
  }

  if (outPath) {
    await writeFile(path.resolve(projectRoot, outPath), `${JSON.stringify(schema, null, 2)}\n`, "utf8");
  } else {
    console.log(JSON.stringify(schema, null, 2));
  }

  const total = schema.groups.reduce((sum, group) => sum + group.controls.length, 0);
  console.error(`${total} controles borrador en ${schema.groups.length} grupos, desde ${files.length} archivos.`);
  if (conflicts.length) console.error("Advertencia: el borrador conserva el primer valor de cada conflicto permitido.");
  console.error("Revisá rangos, etiquetas, preview_id y pertenencia al panel antes de aprobar.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
