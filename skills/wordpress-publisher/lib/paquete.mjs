// El armado del paquete, que es igual para los cuatro modos.
//
// Cada modo aporta tres cosas y nada más: los marcadores que necesita su PHP,
// los archivos propios que escribe, y las comprobaciones que hay que correrle
// al artefacto terminado. Todo lo demás —limpiar el destino, copiar el build,
// reescribir el CSS empaquetado, componer el archivo principal, dejar el
// informe— pasa acá una sola vez.

import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { contarArchivos, leerDocumento, reescribirCssEmpaquetado } from './html.mjs';
import { render } from './render.mjs';

const libDir = path.dirname(fileURLToPath(import.meta.url));
export const raizDePlantillas = path.resolve(libDir, '..', 'assets', 'plugin-template');

async function escribirArchivo(destino, contenido) {
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, contenido, 'utf8');
}

export async function generarPaquete({ projectRoot, config, exportador }) {
  const distDir = path.join(projectRoot, 'dist');
  const buildRoot = path.join(projectRoot, 'wordpress', 'build');
  const pluginDir = path.join(buildRoot, config.slug);
  const pluginDistDir = path.join(pluginDir, 'dist');

  const distInfo = await stat(distDir).catch(() => null);
  if (!distInfo?.isDirectory()) {
    throw new Error(`No existe el build de Astro: ${distDir}. Corré astro build primero.`);
  }

  // Nunca escribir fuera del directorio generado.
  const relativa = path.relative(buildRoot, pluginDir);
  if (!relativa || relativa.startsWith('..') || path.isAbsolute(relativa)) {
    throw new Error(`El destino queda fuera de wordpress/build: ${pluginDir}`);
  }

  const plantillaDir = path.join(raizDePlantillas, config.modo);

  const contexto = {
    projectRoot,
    distDir,
    pluginDir,
    pluginDistDir,
    plantillaDir,
    config,
    // El modo pide los documentos que necesita; el pipeline no adivina cuáles.
    leer: (rutaRelativa) => leerDocumento({ projectRoot, distDir, rutaRelativa, config }),
    plantilla: (nombre) => readFile(path.join(plantillaDir, ...nombre.split('/')), 'utf8')
  };

  const preparado = await exportador.preparar(contexto);

  await rm(pluginDir, { recursive: true, force: true });
  await mkdir(pluginDir, { recursive: true });

  // El archivo principal se compone por partes: la cabecera común, más las
  // piezas que el modo declara. Así el guard de copia duplicada, las
  // constantes y la lista blanca de estilos ajenos existen una sola vez, y
  // arreglar una las arregla en todos los modos que la usan.
  //
  // Una parte que empieza con `common/` sale de la carpeta compartida; el
  // resto, de la carpeta del modo.
  const partes = ['common/cabecera.php', ...(preparado.partes ?? ['plugin.php'])];
  const trozos = [];

  for (const parte of partes) {
    const desde = parte.startsWith('common/')
      ? path.join(raizDePlantillas, ...parte.split('/'))
      : path.join(plantillaDir, ...parte.split('/'));
    trozos.push(render(await readFile(desde, 'utf8'), config, preparado.marcadores ?? {}));
  }

  await escribirArchivo(path.join(pluginDir, `${config.slug}.php`), trozos.join(''));

  for (const nombre of exportador.comunes ?? []) {
    const fuente = await readFile(path.join(raizDePlantillas, 'common', ...nombre.split('/')), 'utf8');
    await escribirArchivo(path.join(pluginDir, ...nombre.split('/')), render(fuente, config));
  }

  // Un `.html` suelto adentro del paquete queda accesible por URL directa:
  // una copia cruda de la misma página, sin plantilla y sin canónica, que
  // Google puede indexar. El contenido ya viaja adentro del PHP.
  await cp(distDir, pluginDistDir, {
    recursive: true,
    filter: (origen) => !origen.toLowerCase().endsWith('.html')
  });

  const cssReescrito = await reescribirCssEmpaquetado(pluginDistDir, pluginDistDir, pluginDir);

  for (const archivo of preparado.archivos ?? []) {
    await escribirArchivo(path.join(pluginDir, ...archivo.ruta.split('/')), archivo.contenido);
  }

  if (typeof exportador.despues === 'function') {
    await exportador.despues({ ...contexto, preparado });
  }

  const inventario = await contarArchivos(pluginDir);

  const informe = {
    generatedAt: new Date().toISOString(),
    plugin: config.slug,
    version: config.version,
    mode: config.modo,
    source: preparado.origenes ?? [],
    output: path.relative(projectRoot, pluginDir).replaceAll('\\', '/'),
    referencedAssets: preparado.assets ?? 0,
    packagedFiles: inventario.count,
    packagedBytes: inventario.bytes,
    wordpressHooks: preparado.hooks ?? [],
    rewrittenCssFiles: cssReescrito,
    ...(preparado.resumen ?? {})
  };

  await mkdir(buildRoot, { recursive: true });
  await writeFile(
    path.join(buildRoot, 'wordpress-export-report.json'),
    `${JSON.stringify(informe, null, 2)}\n`,
    'utf8'
  );

  return { pluginDir, report: informe };
}
