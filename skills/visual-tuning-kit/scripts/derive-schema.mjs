#!/usr/bin/env node

// Deriva un TUNING_SCHEMA leyendo el proyecto, en vez de escribirlo a mano.
//
//   node scripts/derive-schema.mjs --project . --out TUNING_SCHEMA.json
//
// La señal es `var(--nombre, valor)` en el código: una variable usada con
// valor por defecto ya es un punto de ajuste declarado por quien construyó el
// sitio, con su valor al lado. Cuenta también el mismo patrón desde
// JavaScript —un helper que lee la variable con un default— que es como se
// declara justamente lo que los scripts animan.
//
// Lo que no encuentra, no lo propone. Un titular con el tamaño escrito en duro
// no puede tener control: eso se arregla parametrizándolo en el código.
//
// Es un punto de partida. El contrato final lo decide una persona: acá se
// propone todo lo que el proyecto parametrizó, y lo que no merece estar en el
// panel se saca.

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

const SOURCE_EXTENSIONS = new Set([
  '.astro', '.css', '.ts', '.js', '.mjs', '.jsx', '.tsx', '.svelte', '.vue',
]);

const SKIP_DIRECTORIES = new Set([
  'node_modules', 'dist', '.astro', '.git', 'qa', 'wordpress', 'public',
]);

// Unidades que admiten un rango. Un color o una familia tipográfica no se
// afinan con un deslizador.
const UNITS = ['px', 'rem', 'em', 'vw', 'vh', 'svh', 'dvh', 'ch', '%', 'deg', 'ms', 's'];
const VALUE = new RegExp(`^(-?\\d+(?:\\.\\d+)?)(${UNITS.join('|')})?$`);

async function collectSources(root) {
  const files = [];

  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
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

/** Un punto de ajuste: variable, valor por defecto y dónde aparece. */
export function findAdjustables(sources) {
  const found = new Map();

  const record = (name, raw, file) => {
    const value = raw.trim();
    const match = VALUE.exec(value);
    if (!match) return;

    const number = Number(match[1]);
    const unit = match[2] ?? '';

    if (found.has(name)) {
      const existing = found.get(name);
      if (existing.number !== number || existing.unit !== unit) {
        existing.conflicts.push({ file, value });
      }
      return;
    }

    found.set(name, { name, number, unit, file, conflicts: [] });
  };

  for (const { file, content } of sources) {
    for (const match of content.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,\s*([^),]+)\)/gi)) {
      record(match[1], match[2], file);
    }

    for (const block of content.matchAll(/(?:html)?:root\s*\{([^}]*)\}/gi)) {
      for (const declaration of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
        record(declaration[1], declaration[2], file);
      }
    }

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
  if (!unit && magnitude <= 1) return { min: 0, max: 1, step: 0.01 };

  // Un ángulo se afina alrededor de cero, en los dos sentidos.
  if (unit === 'deg') {
    const bound = Math.max(6, Math.ceil(magnitude * 2));
    return { min: -bound, max: bound, step: 0.5 };
  }

  const decimals = Number.isInteger(number) && magnitude >= 10 ? 0 : magnitude >= 1 ? 1 : 2;
  const round = (value) => Number(value.toFixed(decimals));

  return {
    min: round(number - magnitude * 0.4),
    max: round(number + magnitude * 0.6),
    step: decimals === 0 ? (magnitude >= 200 ? 5 : 1) : decimals === 1 ? 0.1 : 0.01,
  };
}

function humanize(name) {
  const words = name.replace(/^--/, '').split('-');
  const label = words.slice(1).join(' ') || words.join(' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const groupOf = (name) => name.replace(/^--/, '').split('-')[0];

export function buildSchema({ adjustables, id, title, projectRoot }) {
  const groups = new Map();

  for (const adjustable of adjustables) {
    const key = groupOf(adjustable.name);
    if (!groups.has(key)) groups.set(key, []);

    const range = deriveRange(adjustable);
    const origin = path.relative(projectRoot, adjustable.file).replaceAll('\\', '/');

    groups.get(key).push({
      id: adjustable.name.replace(/^--/, ''),
      kind: 'range',
      label: humanize(adjustable.name),
      // El contrato exige una razón por control, y con motivo: un control sin
      // justificación es un deslizador que nadie sabe por qué está. Acá la
      // razón es verificable — de dónde salió.
      rationale: `Derivado de ${adjustable.name} en ${origin}, con valor por defecto ${adjustable.number}${adjustable.unit}.`,
      default: adjustable.number,
      target: { css_variable: adjustable.name },
      min: range.min,
      max: range.max,
      step: range.step,
      ...(adjustable.unit ? { unit: adjustable.unit } : {}),
    });
  }

  return {
    version: '0.1',
    id,
    title,
    query_parameter: 'tune',
    development_only: true,
    groups: [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, controls]) => ({
        id: key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        controls: controls.sort((x, y) => x.id.localeCompare(y.id)),
      })),
  };
}

async function main() {
  const projectRoot = path.resolve(process.cwd(), arg('project', '.'));
  const outPath = arg('out', null);

  const info = await stat(projectRoot).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`No existe el proyecto: ${projectRoot}`);

  const sourceRoot = path.join(projectRoot, 'src');
  const base = (await stat(sourceRoot).catch(() => null))?.isDirectory() ? sourceRoot : projectRoot;

  const files = await collectSources(base);
  const sources = await Promise.all(
    files.map(async (file) => ({ file, content: await readFile(file, 'utf8') })),
  );

  const adjustables = findAdjustables(sources);

  const schema = buildSchema({
    adjustables,
    projectRoot,
    id: arg('id', `${path.basename(projectRoot)}-home`),
    title: arg('title', 'Calibrador'),
  });

  const total = schema.groups.reduce((sum, group) => sum + group.controls.length, 0);

  // Los valores arrancan en borrador y sin firmar. Aprobar es del usuario:
  // una herramienta que se autoaprueba convierte el estado en decoración.
  const values = {
    version: '0.1',
    schema: schema.id,
    status: 'draft',
    values: Object.fromEntries(
      schema.groups.flatMap((group) => group.controls.map((c) => [c.id, c.default])),
    ),
    approved_by: null,
    approved_at: null,
  };

  const valuesOut = arg('values-out', null);
  if (valuesOut) {
    await writeFile(
      path.resolve(projectRoot, valuesOut),
      `${JSON.stringify(values, null, 2)}
`,
      'utf8',
    );
    console.log(`valores iniciales (borrador): ${valuesOut}`);
  }

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
      console.error(
        `  ${item.name}: ${item.number}${item.unit} vs ${item.conflicts.map((c) => c.value).join(', ')}`,
      );
    }
  }

  console.error(
    '\nEs un punto de partida. Revisá rangos y etiquetas, sacá lo que no merezca estar' +
      '\nen el panel, y agregá a mano los controles de texto, imagen y orden de secciones.',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
