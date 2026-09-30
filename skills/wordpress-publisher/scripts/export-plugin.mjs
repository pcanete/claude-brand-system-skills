#!/usr/bin/env node

// Convierte un build de Astro en un plugin de WordPress.
//
//   node scripts/export-plugin.mjs --project . --config wordpress.config.json
//
// Qué parte de WordPress ocupa el paquete lo decide `mode` en la configuración:
//
//   front-page         la portada, y nada más (es el modo por defecto)
//   page-template      una plantilla de página que el cliente elige en el panel
//   embedded-page      un shortcode que inserta la página adentro del contenido
//   elementor-widgets  widgets propios, sólo para lo que tiene que ser dinámico
//
// Una configuración sin `mode` significa portada. Es la que ya está instalada
// en sitios vivos y tiene que seguir significando lo mismo.
//
// No inventa nada: lee el HTML construido, separa head y body, saca lo que
// WordPress ya provee, reescribe las URLs de assets a rutas del plugin y
// rellena la plantilla del modo. Si algo no cierra —un asset referenciado que
// no existe, un marcador que no se reemplazó, un hook de WordPress que
// desapareció— falla en lugar de publicar un paquete roto.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { MODOS, resolveConfig } from '../lib/config.mjs';
import { generarPaquete } from '../lib/paquete.mjs';

export { resolveConfig, MODOS };

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

/**
 * Un modo es un archivo en `exporters/`, no una rama de un condicional.
 * `MODOS` es el registro: lo que no está ahí no se importa.
 */
export async function cargarExportador(modo) {
  if (!MODOS.includes(modo)) {
    throw new Error(`Modo desconocido: ${JSON.stringify(modo)}. Opciones: ${MODOS.join(', ')}.`);
  }
  return import(new URL(`../exporters/${modo}.mjs`, import.meta.url).href);
}

export async function exportPlugin({ projectRoot, config }) {
  const exportador = await cargarExportador(config.modo);
  return generarPaquete({ projectRoot, config, exportador });
}

async function main() {
  const projectRoot = path.resolve(process.cwd(), arg('project', '.'));
  const configPath = path.resolve(projectRoot, arg('config', 'wordpress.config.json'));

  const raw = JSON.parse(await readFile(configPath, 'utf8'));
  const config = resolveConfig(raw);

  const { pluginDir, report } = await exportPlugin({ projectRoot, config });

  console.log(`Plugin exportado a ${pluginDir}`);
  console.log(`Modo: ${report.mode}`);
  console.log(
    `${report.packagedFiles} archivos, ${(report.packagedBytes / 1024 / 1024).toFixed(2)} MB, ` +
      `${report.referencedAssets} assets referenciados`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
