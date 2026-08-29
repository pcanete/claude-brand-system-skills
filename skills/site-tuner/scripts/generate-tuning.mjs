#!/usr/bin/env node

// Deriva un contrato de calibración leyendo el proyecto. No lo inventa.
//
//   node scripts/generate-tuning.mjs --project . --style STYLE_DNA.json \
//     --out src/config/tuning.schema.json
//
// La señal es `var(--nombre, default)` en el código: una variable usada con
// valor por defecto ya es un punto de ajuste declarado por quien construyó el
// sitio. El generador la convierte en control y deriva el rango del valor que
// el proyecto eligió.
//
// Lo que no encuentra, no lo propone. Un titular con el tamaño escrito en duro
// no puede tener control: eso se arregla parametrizándolo en el código, y el
// informe lo dice.

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

const SOURCE_EXTENSIONS = new Set(['.astro', '.css', '.ts', '.js', '.mjs', '.jsx', '.tsx', '.svelte', '.vue']);
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', '.astro', '.git', 'qa', 'wordpress']);

// Unidades que admiten un rango. Un color o una familia tipográfica no se
// afinan con un deslizador.
const UNITS = ['px', 'rem', 'em', 'vw', 'vh', 'svh', 'dvh', 'ch', '%', 'deg', 'ms', 's'];

const VALUE = new RegExp(`^(-?\\d+(?:\\.\\d+)?)(${UNITS.join('|')})?$`);

async function collectSources(root) {
  const files = [];

  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        await walk(target);
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(target);
      }
    }
  };

  await walk(root);
  return files;
}

/** Un punto de ajuste: nombre de variable, valor por defecto y dónde aparece. */
export function findAdjustables(sources) {
  const found = new Map();

  const record = (name, raw, file) => {
    const value = raw.trim();
    const match = VALUE.exec(value);
    if (!match) return;

    const number = Number(match[1]);
    const unit = match[2] ?? '';

    // Se conserva la primera aparición: si el proyecto repite la variable con
    // otro default, el primero es el que manda y la divergencia se informa.
    if (found.has(name)) {
      const existing = found.get(name);
      if (existing.number !== number || existing.unit !== unit) {
        existing.conflicts.push({ file, value });
      }
      return;
    }

    found.set(name, { name, number, unit, files: [file], conflicts: [] });
  };

  for (const { file, content } of sources) {
    // var(--nombre, default) — la declaración explícita de un punto de ajuste
    for (const match of content.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,\s*([^),]+)\)/gi)) {
      record(match[1], match[2], file);
    }

    // --nombre: valor  dentro de :root / html:root
    for (const block of content.matchAll(/(?:html)?:root\s*\{([^}]*)\}/gi)) {
      for (const declaration of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
        record(declaration[1], declaration[2], file);
      }
    }

    // El mismo patrón expresado desde JavaScript: un helper que lee la
    // variable con un valor por defecto. Es tan declarativo como el var() de
    // CSS, y se usa justamente para lo que el script tiene que animar.
    for (const match of content.matchAll(
      /\(\s*['"`](--[a-z0-9-]+)['"`]\s*,\s*(-?\d+(?:\.\d+)?[a-z%]*)\s*\)/gi,
    )) {
      record(match[1], match[2], file);
    }
  }

  return [...found.values()];
}

/** El rango sale del valor que el proyecto eligió, no de una tabla. */
export function deriveRange({ number, unit }) {
  const magnitude = Math.abs(number);

  // Proporciones y opacidades viven entre 0 y 1: ampliarlas por porcentaje
  // produce rangos sin sentido.
  if (!unit && magnitude <= 1) {
    return { min: 0, max: 1, step: 0.01 };
  }

  // Un ángulo se afina alrededor de cero, en los dos sentidos.
  if (unit === 'deg') {
    const bound = Math.max(6, Math.ceil(magnitude * 2));
    return { min: -bound, max: bound, step: 0.5 };
  }

  const min = number - magnitude * 0.4;
  const max = number + magnitude * 0.6;
  const decimals = Number.isInteger(number) && magnitude >= 10 ? 0 : magnitude >= 1 ? 1 : 2;
  const round = (value) => Number(value.toFixed(decimals));
  const step = decimals === 0 ? (magnitude >= 200 ? 5 : 1) : decimals === 1 ? 0.1 : 0.01;

  return { min: Math.max(round(min), unit === '%' ? 0 : round(min)), max: round(max), step };
}

function humanize(name) {
  const words = name.replace(/^--/, '').split('-');
  const label = words.slice(1).join(' ') || words.join(' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupOf(name) {
  return name.replace(/^--/, '').split('-')[0];
}

/** Las áreas que la referencia marcó como salientes, para ordenar los grupos. */
function salientAreas(styleDna) {
  const areas = new Set();

  for (const observation of styleDna?.observations || []) {
    if ((observation.salience ?? 0) < 0.6) continue;
    const [block] = (observation.path || '').split('.');
    if (block) areas.add(block);
  }

  return areas;
}

export function buildSchema({ adjustables, styleDna, id, title }) {
  const areas = salientAreas(styleDna);
  const groups = new Map();

  for (const adjustable of adjustables) {
    const key = groupOf(adjustable.name);
    if (!groups.has(key)) groups.set(key, []);

    const range = deriveRange(adjustable);

    groups.get(key).push({
      id: adjustable.name.replace(/^--/, ''),
      kind: 'range',
      label: humanize(adjustable.name),
      css_variable: adjustable.name,
      min: range.min,
      max: range.max,
      step: range.step,
      ...(adjustable.unit ? { unit: adjustable.unit } : {}),
      default: adjustable.number,
      derived_from: adjustable.files.map((file) => file.replaceAll('\\', '/')).join(', '),
    });
  }

  return {
    version: '1.0',
    id,
    title,
    query_parameter: 'tune',
    groups: [...groups.entries()]
      .sort(([a], [b]) => Number(areas.has(b)) - Number(areas.has(a)) || a.localeCompare(b))
      .map(([key, controls]) => ({
        id: key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        controls: controls.sort((x, y) => x.id.localeCompare(y.id)),
      })),
  };
}

async function main() {
  const projectRoot = path.resolve(process.cwd(), arg('project', '.'));
  const stylePath = arg('style', null);
  const outPath = arg('out', null);

  const info = await stat(projectRoot).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`No existe el proyecto: ${projectRoot}`);

  const sourceRoot = path.join(projectRoot, 'src');
  const base = (await stat(sourceRoot).catch(() => null))?.isDirectory() ? sourceRoot : projectRoot;

  const files = await collectSources(base);
  const sources = await Promise.all(
    files.map(async (file) => ({
      file: path.relative(projectRoot, file),
      content: await readFile(file, 'utf8'),
    })),
  );

  const adjustables = findAdjustables(sources);

  const styleDna = stylePath
    ? JSON.parse(await readFile(path.resolve(projectRoot, stylePath), 'utf8'))
    : null;

  const schema = buildSchema({
    adjustables,
    styleDna,
    id: arg('id', `${path.basename(projectRoot)}-home`),
    title: arg('title', 'Calibrador'),
  });

  const total = schema.groups.reduce((sum, group) => sum + group.controls.length, 0);

  if (outPath) {
    await writeFile(path.resolve(projectRoot, outPath), `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
    console.log(`contrato escrito: ${outPath}`);
  } else {
    console.log(JSON.stringify(schema, null, 2));
  }

  console.error(`\n${total} controles en ${schema.groups.length} grupos, desde ${files.length} archivos.`);

  const conflicted = adjustables.filter((item) => item.conflicts.length);
  if (conflicted.length) {
    console.error('\nVariables con más de un valor por defecto — se tomó el primero:');
    for (const item of conflicted) {
      console.error(`  ${item.name}: ${item.number}${item.unit} vs ${item.conflicts.map((c) => c.value).join(', ')}`);
    }
  }

  // No se compara contra los bloques del STYLE_DNA: sus nombres describen el
  // sistema de la referencia (`typography`, `tokens`, `art_direction`) y los
  // de las variables describen secciones del sitio (`hero`, `shop`). Cruzarlos
  // marcaba como faltante todo lo que existía, que es peor que no avisar.
  // El STYLE_DNA se usa para ordenar los grupos, no para reclamar ausencias.

  console.error('\nEs un punto de partida: revisá rangos y etiquetas antes de usarlo.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
