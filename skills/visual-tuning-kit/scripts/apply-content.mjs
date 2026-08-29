#!/usr/bin/env node

// Lleva los valores aprobados de contenido al CONTENT_MANIFEST.
//
//   node scripts/apply-content.mjs --schema TUNING_SCHEMA.json \
//     --values TUNING_VALUES.json --content CONTENT_MANIFEST.json
//
// `build-approved-css.mjs` cierra el circuito de los controles con
// `css_variable`. Los que tienen `content_path` —texto, líneas, imagen y orden
// de secciones— no tenían quién los llevara a ningún lado: se editaban, se
// aprobaban y el siguiente build los perdía.
//
// El archivo canónico es el CONTENT_MANIFEST. El calibrador propone; acá el
// cambio aprobado vuelve al contrato, y el sitio se reconstruye desde ahí.
//
// No crea claves. Si la ruta no existe, es un error del contrato de calibración
// y no algo que este script deba inventar en el contenido.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const readJson = async (file) => JSON.parse(await readFile(path.resolve(file), 'utf8'));

// Misma semántica de resolución que el resto de la cadena: un segmento puede
// ser una clave o el `id` de un elemento de un arreglo, que es como el
// CONTENT_MANIFEST guarda las secciones.
function walk(root, dottedPath) {
  const segments = String(dottedPath).split('.');
  let node = root;

  for (const segment of segments.slice(0, -1)) {
    if (node && typeof node === 'object' && !Array.isArray(node) && segment in node) {
      node = node[segment];
      continue;
    }
    if (Array.isArray(node)) {
      const match = node.find((item) => item && typeof item === 'object' && item.id === segment);
      if (match !== undefined) {
        node = match;
        continue;
      }
    }
    return { found: false, stoppedAt: segment };
  }

  const leaf = segments[segments.length - 1];

  if (Array.isArray(node)) {
    const index = node.findIndex((item) => item && typeof item === 'object' && item.id === leaf);
    if (index === -1) return { found: false, stoppedAt: leaf };
    return { found: true, container: node, key: index };
  }

  if (!node || typeof node !== 'object' || !(leaf in node)) {
    return { found: false, stoppedAt: leaf };
  }

  return { found: true, container: node, key: leaf };
}

/** Lo que cada tipo de control puede escribir, y en qué forma. */
export function coerce(kind, value, current) {
  switch (kind) {
    case 'text':
      if (typeof value !== 'string') throw new Error('un control text escribe una cadena');
      return value;

    case 'text-lines': {
      const lines = Array.isArray(value) ? value : String(value).split('\n');
      const clean = lines.map((line) => String(line)).filter((line) => line.trim().length);
      if (!clean.length) throw new Error('un control text-lines no puede quedar vacío');
      return clean;
    }

    case 'image':
      if (typeof value !== 'string' || !value.startsWith('/')) {
        throw new Error('un control image escribe una ruta pública que empieza con /');
      }
      return value;

    case 'section-order': {
      if (!Array.isArray(current)) throw new Error('section-order apunta a algo que no es un arreglo');
      const wanted = Array.isArray(value) ? value.map(String) : String(value).split(',').map((id) => id.trim());
      const byId = new Map(current.map((item) => [item?.id, item]));

      const missing = wanted.filter((id) => !byId.has(id));
      if (missing.length) throw new Error(`orden con secciones inexistentes: ${missing.join(', ')}`);

      // Reordenar no es descartar: lo que el orden no nombra queda al final,
      // en su orden original, en vez de desaparecer del sitio en silencio.
      const rest = current.filter((item) => !wanted.includes(item?.id));
      return [...wanted.map((id) => byId.get(id)), ...rest];
    }

    default:
      throw new Error(`el tipo '${kind}' no escribe contenido`);
  }
}

export function applyContent(schema, values, content) {
  const applied = [];
  const issues = [];

  const controls = schema.groups
    .flatMap((group) => group.controls)
    .filter((control) => control.target?.content_path);

  for (const control of controls) {
    const value = values.values?.[control.id];
    if (value === undefined) {
      issues.push(`${control.id}: sin valor aprobado`);
      continue;
    }

    const spot = walk(content, control.target.content_path);
    if (!spot.found) {
      issues.push(
        `${control.id}: la ruta '${control.target.content_path}' no existe en el contenido ` +
          `(se corta en '${spot.stoppedAt}')`
      );
      continue;
    }

    const before = spot.container[spot.key];

    let next;
    try {
      next = coerce(control.kind, value, before);
    } catch (error) {
      issues.push(`${control.id}: ${error.message}`);
      continue;
    }

    if (JSON.stringify(before) === JSON.stringify(next)) continue;

    spot.container[spot.key] = next;
    applied.push({ id: control.id, path: control.target.content_path, before, after: next });
  }

  return { applied, issues, controls: controls.length };
}

async function main() {
  const schemaFile = arg('schema');
  const valuesFile = arg('values');
  const contentFile = arg('content');
  const dryRun = process.argv.includes('--dry-run');

  if (!schemaFile || !valuesFile || !contentFile) {
    throw new Error(
      'Uso: apply-content.mjs --schema TUNING_SCHEMA.json --values TUNING_VALUES.json ' +
        '--content CONTENT_MANIFEST.json [--out otro.json] [--dry-run]'
    );
  }

  const [schema, values, content] = await Promise.all([
    readJson(schemaFile),
    readJson(valuesFile),
    readJson(contentFile)
  ]);

  // La misma regla que el CSS aprobado: un borrador no llega a producción.
  if (values.status !== 'approved' || !values.approved_by || !values.approved_at) {
    throw new Error('Solo valores aprobados por una persona pueden modificar el contenido');
  }

  const { applied, issues, controls } = applyContent(schema, values, content);

  if (issues.length) {
    throw new Error(`No se aplicó nada:\n${issues.map((item) => `  - ${item}`).join('\n')}`);
  }

  if (!applied.length) {
    console.log(`Sin cambios: los ${controls} controles de contenido ya coinciden con el manifiesto.`);
    return;
  }

  for (const change of applied) {
    const show = (value) => JSON.stringify(value).slice(0, 70);
    console.log(`  ${change.path}\n    antes: ${show(change.before)}\n    ahora: ${show(change.after)}`);
  }

  if (dryRun) {
    console.log(`\n${applied.length} cambios listos. Nada escrito: --dry-run.`);
    return;
  }

  const out = path.resolve(arg('out', contentFile));
  await writeFile(out, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  console.log(`\n✓ ${applied.length} cambios aplicados a ${out}`);
  console.log('Reconstruí el sitio para verlos publicados.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
