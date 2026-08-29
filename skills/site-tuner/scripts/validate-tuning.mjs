#!/usr/bin/env node

// Verifica el contrato del calibrador de un proyecto y los valores aprobados.
//
//   node scripts/validate-tuning.mjs \
//     --schema src/config/tuning.schema.json \
//     --values src/config/tuning.values.json
//
// El panel de desarrollo ya rechaza un guardado inválido. Esto cubre el otro
// lado: que el contrato esté bien formado antes de exponer el panel, y que los
// valores aprobados —que sí se compilan al sitio— sigan dentro de lo declarado
// aunque alguien haya editado el archivo a mano.
//
//   --lenient   sólo la forma del contrato, sin revisar los valores

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

const cwd = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

const strict = !process.argv.includes('--lenient');

async function readJson(file) {
  const absolute = path.resolve(cwd, file);
  try {
    return JSON.parse(await readFile(absolute, 'utf8'));
  } catch (error) {
    throw new Error(`No se pudo leer ${absolute}\n${error.message}`);
  }
}

export function controlsOf(schema) {
  return (schema.groups || []).flatMap((group) => group.controls || []);
}

/** La misma validación por tipo que aplica el endpoint al guardar. */
export function valueFits(control, value) {
  if (control.kind === 'range') {
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= control.min &&
      value <= control.max
    );
  }
  if (control.kind === 'select') {
    return (
      typeof value === 'string' && (control.options || []).some((o) => o.value === value)
    );
  }
  if (control.kind === 'boolean') return typeof value === 'boolean';
  if (control.kind === 'text-lines') {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 30 &&
      value.every((line) => typeof line === 'string' && line.length <= 500)
    );
  }
  return false;
}

export function checkContract(schema) {
  const issues = [];
  const seen = new Set();

  for (const control of controlsOf(schema)) {
    if (seen.has(control.id)) issues.push(`control duplicado: ${control.id}`);
    seen.add(control.id);

    if (!valueFits(control, control.default)) {
      issues.push(`${control.id}: el default no cumple lo que el propio control declara`);
    }

    if (control.kind === 'range' && control.min >= control.max) {
      issues.push(`${control.id}: min (${control.min}) no es menor que max (${control.max})`);
    }

    // Un control que no declara ningún efecto no hace nada: ocupa lugar en el
    // panel y da la impresión de que algo cambió.
    const hasEffect =
      control.css_variable || control.class_name || control.event || control.selector;

    if (!hasEffect) {
      issues.push(
        `${control.id}: no declara efecto (css_variable, class_name, event o selector)`,
      );
    }
  }

  if (!seen.size) issues.push('el contrato no declara ningún control');

  return issues;
}

export function checkValues(schema, values) {
  const issues = [];

  if (values.schema !== schema.id) {
    issues.push(
      `los valores declaran el contrato "${values.schema}" y este contrato es "${schema.id}"`,
    );
  }

  const byId = new Map(controlsOf(schema).map((control) => [control.id, control]));

  for (const [id, value] of Object.entries(values.values || {})) {
    const control = byId.get(id);
    if (!control) {
      issues.push(`${id}: valor aprobado para un control que el contrato no declara`);
      continue;
    }
    if (!valueFits(control, value)) {
      issues.push(`${id}: el valor aprobado ${JSON.stringify(value)} está fuera de lo declarado`);
    }
  }

  // Un control sin valor aprobado cae al default, que ya se verificó. No es un
  // error: es el estado de un control que nadie tocó todavía.
  return issues;
}

async function main() {
  const schemaFile = arg('schema', 'src/config/tuning.schema.json');
  const valuesFile = arg('values', 'src/config/tuning.values.json');

  const contract = await readJson(path.join(scriptDir, '..', 'schemas', 'tuning-contract.schema.json'));
  const schema = await readJson(schemaFile);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(contract);

  let failed = false;

  if (validate(schema)) {
    console.log('✓ el contrato del calibrador cumple su forma');
  } else {
    failed = true;
    console.error('\n✗ el contrato del calibrador no cumple su forma');
    for (const error of validate.errors || []) {
      console.error(`  - ${error.instancePath || '/'}: ${error.message}`);
    }
  }

  const contractIssues = checkContract(schema);
  if (contractIssues.length) {
    failed = true;
    console.error('\n✗ el contrato se contradice');
    for (const issue of contractIssues) console.error(`  - ${issue}`);
  } else {
    console.log('✓ cada control es coherente con lo que declara');
  }

  if (strict) {
    const values = await readJson(valuesFile);
    const valueIssues = checkValues(schema, values);
    if (valueIssues.length) {
      failed = true;
      console.error('\n✗ hay valores aprobados fuera del contrato');
      for (const issue of valueIssues) console.error(`  - ${issue}`);
    } else {
      console.log('✓ los valores aprobados están dentro de lo declarado');
    }
  }

  if (failed) {
    console.error('\nCalibrador rechazado. Corregí el contrato antes de exponer el panel.');
    process.exitCode = 1;
    return;
  }

  console.log(`\nCalibrador verificado${strict ? '' : ' (lenient: sólo el contrato)'}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
