#!/usr/bin/env node

// Verifica el calibrador contra un servidor de desarrollo, sin saber nada del
// proyecto: todo lo que espera lo lee del contrato.
//
//   node scripts/smoke-test.mjs --url http://localhost:4321 \
//     --schema src/config/tuning.schema.json
//
//   --values <archivo>   además comprueba que Aplicar escriba el valor
//
// Requiere Playwright disponible en el proyecto.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

const baseUrl = arg('url', 'http://localhost:4321');
const schemaPath = arg('schema', 'src/config/tuning.schema.json');
const valuesPath = arg('values', null);

const schema = JSON.parse(fs.readFileSync(path.resolve(schemaPath), 'utf8'));
const controls = schema.groups.flatMap((group) => group.controls);
const parameter = schema.query_parameter ?? 'tune';

// El skill vive fuera del proyecto, así que su import no ve el node_modules
// del proyecto. Se busca primero ahí, que es donde corresponde que esté.
const { chromium } = await (async () => {
  const fromProject = createRequire(path.join(process.cwd(), 'noop.js'));

  try {
    return fromProject('playwright');
  } catch {
    try {
      return await import('playwright');
    } catch {
      throw new Error(
        'Playwright no está disponible. Instalalo en el proyecto: npm i -D playwright',
      );
    }
  }
})();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));

const results = {};

try {
  await page.goto(`${baseUrl}/?${parameter}=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-visual-tuner]');

  // La cantidad la manda el contrato, no un número escrito acá.
  const rendered = await page.locator('[data-control-id]').count();
  if (rendered !== controls.length) {
    throw new Error(
      `El contrato declara ${controls.length} controles y el panel muestra ${rendered}`,
    );
  }
  results.controles = rendered;

  const groups = await page.locator('[data-tuner-group]').count();
  if (groups !== schema.groups.length) {
    throw new Error(
      `El contrato declara ${schema.groups.length} grupos y el panel muestra ${groups}`,
    );
  }
  results.grupos = groups;

  // Un panel con todo abierto es un tablero, no una herramienta.
  const open = await page.locator('[data-tuner-group][open]').count();
  if (open !== 1) throw new Error(`Se esperaba un grupo abierto y hay ${open}`);

  // Mover un control tiene que cambiar la variable en vivo. Se elige el
  // primero que escriba una variable CSS, sea cual sea.
  const target = controls.find((control) => control.kind === 'range' && control.css_variable);
  if (!target) throw new Error('El contrato no declara ningún control range con css_variable.');

  const probe = target.default === target.min ? target.max : target.min;
  const input = page.locator(`[data-control-id="${target.id}"]`);
  await input.fill(String(probe));
  await input.dispatchEvent('input');

  const live = await page.evaluate(
    (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    target.css_variable,
  );

  const expected = `${probe}${target.unit ?? ''}`;
  if (live !== expected) {
    throw new Error(`Se esperaba ${target.css_variable}: ${expected} y quedó ${live}`);
  }
  results.cambioEnVivo = { control: target.id, valor: expected };

  if (valuesPath) {
    const file = path.resolve(valuesPath);
    const before = JSON.parse(fs.readFileSync(file, 'utf8'));

    await page.locator('[data-tuner-apply]').click();

    const deadline = Date.now() + 5000;
    let applied = false;

    while (Date.now() < deadline) {
      const current = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (current.values[target.id] === probe) {
        applied = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!applied) throw new Error(`Aplicar no escribió ${target.id} en ${valuesPath}`);

    // Se restaura el valor aprobado: una prueba no deja el proyecto cambiado.
    await input.fill(String(before.values[target.id] ?? target.default));
    await input.dispatchEvent('input');
    await page.locator('[data-tuner-apply]').click();
    await new Promise((resolve) => setTimeout(resolve, 400));

    results.aplicaYRestaura = true;
  }
} finally {
  await browser.close();
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ...results, erroresDeConsola: 0 }, null, 2));
  console.log('\nCalibrador verificado en vivo.');
}
