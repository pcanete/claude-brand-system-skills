#!/usr/bin/env node

// Un solo paso desde el proyecto hasta el ZIP instalable.
//
//   node scripts/publish.mjs --project .
//
// Construir, exportar, verificar y empaquetar son cuatro pasos que siempre van
// juntos y siempre en ese orden. Separados, la fricción no está en cada uno:
// está en acordarse de los cuatro cada vez que se corrige una palabra, y en que
// saltear la verificación no cuesta nada.
//
// Corta en el primer fallo. Un ZIP que sale de un paquete que no pasó el
// validador es peor que no tener ZIP: se sube igual y rompe la portada en vivo.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// fileURLToPath y no un recorte del pathname: la ruta real de esta máquina
// trae espacios y una eñe, que en una URL viajan percent-encoded.
const here = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function run(label, command, args, cwd) {
  process.stdout.write(`\n${label}\n`);

  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32' && command !== process.execPath
  });

  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label}: terminó con código ${result.status}`);
}

async function main() {
  const projectRoot = path.resolve(process.cwd(), arg('project', '.'));
  const configPath = path.resolve(projectRoot, arg('config', 'wordpress.config.json'));
  const skipBuild = process.argv.includes('--skip-build');

  if (!existsSync(configPath)) {
    throw new Error(`Falta ${path.relative(projectRoot, configPath)} en el proyecto.`);
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (!config.slug) throw new Error('El archivo de configuración no declara `slug`.');

  if (skipBuild) {
    process.stdout.write('\n1/4 · Construir — salteado por --skip-build\n');
  } else {
    run('1/4 · Construir el sitio', 'npm', ['run', 'build'], projectRoot);
  }

  const pluginDir = path.join(projectRoot, 'wordpress', 'build', config.slug);

  run(
    '2/4 · Exportar el plugin',
    process.execPath,
    [path.join(here, 'export-plugin.mjs'), '--project', projectRoot, '--config', configPath],
    projectRoot
  );

  run(
    '3/4 · Verificar que sea instalable',
    process.execPath,
    [path.join(here, 'validate-plugin.mjs'), '--plugin', pluginDir, '--config', configPath],
    projectRoot
  );

  run(
    '4/4 · Empaquetar',
    process.execPath,
    [path.join(here, 'package-plugin.mjs'), '--plugin', pluginDir],
    projectRoot
  );

  // Qué queda por hacer a mano depende del modo: subir el ZIP no siempre es
  // el último paso.
  const despues = {
    'front-page':
      '  La portada queda reemplazada al activar. Verificá en una ventana privada,\n' +
      '  y también desde un teléfono: guarda su propia copia y puede seguir\n' +
      '  mostrando la anterior.\n',
    'page-template':
      '  Falta asignar la plantilla: en cada página, Atributos → Plantilla, y elegir\n' +
      '  la que aporta este plugin. Hasta que alguien la elija, el sitio no cambia.\n',
    'embedded-page':
      `  Falta insertar el shortcode [${config.shortcode ?? `${String(config.slug).replaceAll('-', '_')}_page`} id="..."] donde vaya la pieza.\n` +
      '  Hasta que esté en el contenido de alguna página, el sitio no cambia.\n',
    'elementor-widgets':
      '  Los widgets aparecen en Elementor, en su propia categoría. El cuerpo de cada\n' +
      '  uno está en widgets/<id>.php del paquete: ahí entra el markup del build.\n'
  };

  process.stdout.write(
    '\n✓ Listo. Subí el ZIP desde el panel de WordPress (Plugins → Añadir nuevo →\n' +
      '  Subir plugin) y activalo. Si ya estaba instalado, el nuevo reemplaza al\n' +
      '  anterior: el plugin no guarda estado propio.\n\n' +
      (despues[config.mode ?? 'front-page'] ?? '')
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  });
}
