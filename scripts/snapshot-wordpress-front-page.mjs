#!/usr/bin/env node

// Congela lo que hoy produce el modo `front-page`, archivo por archivo.
//
//   node scripts/snapshot-wordpress-front-page.mjs
//
// Existe por una razón concreta: `wordpress-publisher` pasó de un exportador
// único a uno por modo, y el modo viejo es el que está instalado en sitios
// vivos. "No rompí nada" es una afirmación que se mide o no vale nada.
//
// La comprobación del repositorio vuelve a exportar el fixture y compara cada
// archivo contra este manifiesto. Regenerarlo es un acto deliberado: si el
// cambio en la salida es intencional, se regenera y el diff del manifiesto
// queda en el commit, a la vista de quien revise.
//
// La única diferencia que se tolera sin regenerar es la línea que declara el
// modo, que el artefacto viejo no tenía y el nuevo sí.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/**
 * Lo que no cuenta como diferencia.
 *
 * El final de línea, porque git lo convierte al hacer checkout en Windows y
 * las plantillas terminan mezclando CRLF con LF según qué las haya escrito: una
 * huella sensible a eso falla en otra máquina sin que nada esté mal.
 *
 * Y la línea que declara el modo, que es lo único que el refactor agrega a
 * propósito al archivo principal.
 */
export function normalizar(contenido) {
  return contenido
    .replaceAll('\r\n', '\n')
    .replace(/^define\( '[A-Z0-9_]+_MODE', '[a-z-]+' \);\n/m, '');
}

export function huella(contenido) {
  return createHash('sha256').update(normalizar(contenido), 'utf8').digest('hex');
}

function listar(directorio, prefijo = '') {
  const encontrados = [];

  for (const entrada of fs.readdirSync(path.join(directorio, prefijo), { withFileTypes: true })) {
    const relativa = prefijo ? `${prefijo}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) encontrados.push(...listar(directorio, relativa));
    else encontrados.push(relativa);
  }

  return encontrados.sort();
}

function copiar(origen, destino) {
  fs.mkdirSync(destino, { recursive: true });
  for (const entrada of fs.readdirSync(origen, { withFileTypes: true })) {
    const desde = path.join(origen, entrada.name);
    const hasta = path.join(destino, entrada.name);
    if (entrada.isDirectory()) copiar(desde, hasta);
    else fs.copyFileSync(desde, hasta);
  }
}

/**
 * Exporta el fixture en modo portada y devuelve ruta -> huella.
 * La usa tanto este generador como la comprobación del repositorio.
 */
export function exportarFixture() {
  const proyecto = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cbss-baseline-')), 'project');
  copiar(path.join(root, 'tests', 'wordpress-fixture'), proyecto);

  const resultado = spawnSync(
    process.execPath,
    [
      path.join(root, 'skills', 'wordpress-publisher', 'scripts', 'export-plugin.mjs'),
      '--project',
      proyecto
    ],
    { cwd: proyecto, encoding: 'utf8' }
  );

  if (resultado.status !== 0) {
    throw new Error(`El exportador falló sobre el fixture:\n${resultado.stderr || resultado.stdout}`);
  }

  const plugin = path.join(proyecto, 'wordpress', 'build', 'portada-fixture');
  const huellas = {};

  for (const relativa of listar(plugin)) {
    huellas[relativa] = huella(fs.readFileSync(path.join(plugin, ...relativa.split('/')), 'utf8'));
  }

  fs.rmSync(path.dirname(proyecto), { recursive: true, force: true });
  return huellas;
}

function main() {
  const destino = path.join(root, 'tests', 'wordpress-fixture', 'expected', 'front-page.json');
  fs.mkdirSync(path.dirname(destino), { recursive: true });

  const huellas = exportarFixture();

  const documento = {
    que_es:
      'Huella sha256 de cada archivo que produce el modo front-page sobre el fixture. ' +
      'La línea que declara el modo se quita antes de calcularla.',
    como_se_regenera: 'node scripts/snapshot-wordpress-front-page.mjs',
    archivos: huellas
  };

  fs.writeFileSync(destino, `${JSON.stringify(documento, null, 2)}\n`, 'utf8');

  console.log(`Línea base escrita: ${path.relative(root, destino)}`);
  console.log(`${Object.keys(huellas).length} archivos congelados.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
